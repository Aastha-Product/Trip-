import "server-only";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { checkPerson, checkPlan, daysBetween, rankRecommendations, type RawPerson } from "./analysis";
import { formatDateRange, formatINR } from "./format";
import {
  DEALBREAKERS,
  DESTINATION_TYPES,
  PACES,
  STAYS,
  VIBES,
  type GroupSnapshot,
  type InclusionPlan,
  type Member,
  type Recommendation,
  type Source,
  type Trip,
} from "./types";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

const strip = (label: string) => label.replace(/^\S+\s/, ""); // drop the emoji

function describeMember(m: Member) {
  const p = m.prefs;
  return {
    memberId: m.id,
    name: m.name,
    homeCity: p.homeCity,
    freeOn: p.dateRanges.map((r) => `${r.from}..${r.to}`),
    tripLengthDays: `${p.lengthMin}-${p.lengthMax}`,
    budgetPerPersonAllIn: `${p.budgetMin}-${p.budgetMax} INR`,
    couldStretchBudgetBy: p.budgetStretch ? `${p.budgetStretch} INR` : "no",
    couldJoinLateOrLeaveEarlyBy: p.dateFlex ? `${p.dateFlex} day(s)` : "no",
    maxOneWayTravel: p.maxTravelHours ? `${p.maxTravelHours}h` : "any",
    dealbreakers: [...p.dealbreakers.map((d) => strip(DEALBREAKERS[d])), p.dealbreakerOther].filter(Boolean),
    lovesRanked: p.destinationTypes.map((d) => strip(DESTINATION_TYPES[d])),
    vibe: p.vibe && strip(VIBES[p.vibe]),
    pace: p.pace && strip(PACES[p.pace]),
    stay: p.stay && strip(STAYS[p.stay]),
    wishlist: p.wishlist || undefined,
    notes: p.notes || undefined,
  };
}

function snapshotFacts(s: GroupSnapshot) {
  return {
    bestWindow: s.bestWindow && {
      dates: `${s.bestWindow.from}..${s.bestWindow.to}`,
      cantMakeIt: s.bestWindow.missing,
    },
    tripLengthMostAgreeOn: s.tripLength && `${s.tripLength.min}-${s.tripLength.max} days`,
    budgetBandForMost: s.budgetBand && {
      band: `${s.budgetBand.min}-${s.budgetBand.max} INR`,
      outside: s.budgetBand.outside,
    },
    dealbreakers: s.dealbreakers.map((d) => `${d.label}: ${d.names.join(", ")}`),
  };
}

const NO_PRONOUNS =
  "Refer to people only by name or 'they'. Never guess gendered pronouns (he/she/his/her) from names.";

/* ----------------------------- Step 1: research ----------------------------- */

async function research(ai: GoogleGenAI, trip: Trip, members: Member[], snapshot: GroupSnapshot) {
  const prompt = [
    "You are researching a group trip for friends in India. Use Google Search for current, realistic numbers.",
    `Trip window: ${trip.windowStart} to ${trip.windowEnd}. Year matters for weather and festivals.`,
    trip.ideas ? `The coordinator already has these ideas in mind: ${trip.ideas}` : "",
    "",
    "GROUP (JSON):",
    JSON.stringify(members.map(describeMember)),
    "",
    "FACTS COMPUTED IN CODE (authoritative):",
    JSON.stringify(snapshotFacts(snapshot)),
    "",
    "Do this:",
    "1. Pick 5 candidate destinations that best fit the group as a whole: reachable from everyone's home city within their travel limits, within most budgets, respecting every dealbreaker, matching their loved destination types and wishlists.",
    "2. For each candidate, research: best 3–5 day dates inside the window; the cheapest sensible travel mode, one-way time and return fare from EACH home city (respect 'no flights' / 'no overnight buses'); stay cost per night for their stay styles; food + activities per day; weather in those dates; how easy vegetarian food is; party/nightlife scene; whether it needs trekking.",
    "3. For the people who don't fit (the ones outside the best dates or budget, or with conflicting dealbreakers), research concrete ways to include them: alternate date windows, cheaper stays (hostels/homestays/zostel-type), daytime trains or buses, cheaper nearby alternatives, joining a day later.",
    "Write compact factual notes (max ~700 words), with numbers in INR. No fluff.",
  ]
    .filter(Boolean)
    .join("\n");

  const res = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { tools: [{ googleSearch: {} }], temperature: 0.4, httpOptions: { timeout: 120_000 } },
  });

  const chunks = res.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const seen = new Set<string>();
  const sources: Source[] = [];
  for (const c of chunks) {
    const title = c.web?.title?.trim();
    const url = c.web?.uri;
    if (!title || !url || seen.has(title)) continue;
    seen.add(title);
    sources.push({ title, url });
  }
  return { notes: res.text ?? "", sources: sources.slice(0, 10) };
}

/* ----------------------------- Step 2: structure ---------------------------- */

const isoDate = z.string().describe("YYYY-MM-DD");

const aiSchema = z.object({
  recommendations: z
    .array(
      z.object({
        destination: z.string().describe("Place name, e.g. 'Rishikesh'"),
        region: z.string().describe("State or region, e.g. 'Uttarakhand'"),
        startDate: isoDate,
        endDate: isoDate,
        costPerPerson: z.number().int().describe("All-in INR per person (average across home cities)"),
        breakdown: z.object({
          travel: z.number().int(),
          stay: z.number().int(),
          foodFun: z.number().int(),
        }),
        pitch: z.string().describe("2 sentences on why this works for this group"),
        pros: z.array(z.string()).describe("2-4 short pros for the group"),
        cons: z.array(z.string()).describe("1-3 honest cons for the group"),
        people: z.array(
          z.object({
            memberId: z.string(),
            score: z.number().int().min(0).max(100).describe("How happy this person would be, 0-100"),
            reason: z.string().describe("One specific sentence, max ~20 words"),
            travelHours: z.number().nullable().describe("Estimated one-way door-to-door hours from their home city"),
            dealbreakerHit: z
              .string()
              .nullable()
              .describe("The dealbreaker this option violates for them, or null"),
          }),
        ),
        plans: z
          .array(
            z.object({
              kind: z.enum(["shift-dates", "join-late", "budget", "travel", "swap", "other"]),
              title: z.string().describe("Short, e.g. 'Move to 9–12 Oct so Saurabh can come'"),
              forMemberIds: z.array(z.string()),
              askOfGroup: z.string().describe("What everyone else must accept, in plain words"),
              details: z.string().describe("Concrete how-to from the research: train names, stay types, prices"),
              costImpact: z.string().describe("e.g. '+₹0 for others, −₹3,000 for Ramanjeet'"),
              newStartDate: isoDate.nullable(),
              newEndDate: isoDate.nullable(),
              newCostPerPerson: z.number().int().nullable().describe("New all-in price for EVERYONE, if the group price changes"),
              costForThem: z
                .number()
                .int()
                .nullable()
                .describe("All-in price for just the forMemberIds people, if only their cost changes (e.g. hostel bed, daytime train)"),
            }),
          )
          .describe("0-3 plans to include people who can't go or are compromising (score < 55)"),
      }),
    )
    .describe("Exactly 3 recommendations, best first"),
});

async function structure(
  ai: GoogleGenAI,
  trip: Trip,
  members: Member[],
  snapshot: GroupSnapshot,
  notes: string,
) {
  const prompt = [
    "Turn the research into exactly 3 trip recommendations for this group of friends. The group decides — you recommend.",
    `All dates must be inside ${trip.windowStart}..${trip.windowEnd}.`,
    "For EVERY recommendation, score EVERY person (use their exact memberId).",
    "Budgets are all-in per person. Use the research numbers; don't invent precision.",
    "Flag dealbreakerHit only when the option clearly violates something that person listed.",
    "",
    "INCLUSION PLANS are the most important part. For each recommendation, if someone can't make the dates, is over budget beyond their stretch, hits a dealbreaker, or scores under 55, propose up to 3 concrete plans that would let them come, e.g.:",
    "- shift-dates: move the whole trip (give newStartDate/newEndDate) — say who else is affected",
    "- join-late: they join a day late or leave early (use their stated flexibility)",
    "- budget: a cheaper stay/transport for them (give costForThem) or for the whole group (give newCostPerPerson)",
    "- travel: a route that avoids their dealbreaker or travel limit (e.g. a daytime train)",
    "- swap: swap an activity/area that conflicts with them",
    "Each plan must say exactly what the rest of the group has to accept. Prefer plans within people's stated stretch/flexibility.",
    "NEVER propose that someone drops or makes an exception to their own dealbreaker, or exceeds their stated stretch: work around it instead, or propose nothing.",
    NO_PRONOUNS,
    "",
    "GROUP (JSON):",
    JSON.stringify(members.map(describeMember)),
    "",
    "FACTS COMPUTED IN CODE (authoritative):",
    JSON.stringify(snapshotFacts(snapshot)),
    "",
    "RESEARCH NOTES:",
    notes,
  ].join("\n");

  const res = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: z.toJSONSchema(aiSchema),
      temperature: 0.3,
      httpOptions: { timeout: 120_000 },
    },
  });
  return aiSchema.parse(JSON.parse(res.text ?? ""));
}

/* ----------------------------- Step 3: verify ------------------------------- */

function clampDate(d: string, trip: Trip) {
  return d < trip.windowStart ? trip.windowStart : d > trip.windowEnd ? trip.windowEnd : d;
}

/**
 * Stable ids so votes survive a regeneration: "I'm in" on Rishikesh stays attached to
 * Rishikesh, and "shift dates for Saurabh" stays attached to that kind of plan for them.
 */
const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "x";

function verify(trip: Trip, members: Member[], parsed: z.infer<typeof aiSchema>): Recommendation[] {
  const recs = parsed.recommendations.slice(0, 3).map((r) => {
    const startDate = clampDate(r.startDate, trip);
    const endDate = clampDate(r.endDate < startDate ? startDate : r.endDate, trip);
    const sc = { startDate, endDate, costPerPerson: r.costPerPerson };

    // Rebuild around our member list so a missing or invented id can't leak through.
    const raws = new Map<string, RawPerson>();
    for (const m of members) {
      const p = r.people.find((x) => x.memberId === m.id);
      raws.set(m.id, {
        memberId: m.id,
        score: p?.score ?? 50,
        reason: p?.reason ?? "No details from the model for this person.",
        travelHours: p?.travelHours ?? null,
        dealbreakerHit: p?.dealbreakerHit ?? null,
      });
    }
    const people = members.map((m) => checkPerson(m, raws.get(m.id)!, sc));

    const recId = `rec-${slug(r.destination)}`;
    const usedPlanIds = new Set<string>();
    const plans: InclusionPlan[] = r.plans.slice(0, 3).map((pl) => {
      const forMemberIds = [...new Set(pl.forMemberIds.filter((id) => raws.has(id)))].sort();
      let id = `${recId}:${pl.kind}:${forMemberIds.map((x) => x.slice(0, 8)).join("+") || "all"}`;
      for (let n = 2; usedPlanIds.has(id); n++) id = `${id.replace(/#\d+$/, "")}#${n}`;
      usedPlanIds.add(id);
      const base = {
        id,
        kind: pl.kind,
        title: pl.title,
        forMemberIds,
        forNames: forMemberIds.map((id) => members.find((m) => m.id === id)!.name),
        askOfGroup: pl.askOfGroup,
        details: pl.details,
        costImpact: pl.costImpact,
        newStartDate: pl.newStartDate ? clampDate(pl.newStartDate, trip) : null,
        newEndDate: pl.newEndDate ? clampDate(pl.newEndDate, trip) : null,
        newCostPerPerson: pl.newCostPerPerson,
        costForThem: pl.costForThem,
      };
      return { ...base, check: checkPlan(base, { ...sc, people }, members, raws) };
    });

    const going = people.filter((p) => p.canJoin);
    const lowest = [...people].sort((a, b) => Number(a.canJoin) - Number(b.canJoin) || a.score - b.score)[0];
    const biggestCompromise =
      lowest && (lowest.score < 60 || !lowest.canJoin)
        ? { name: lowest.name, reason: lowest.issues.find((i) => i.blocker)?.label ?? lowest.reason }
        : null;

    return {
      id: recId,
      destination: r.destination,
      region: r.region,
      startDate,
      endDate,
      days: daysBetween(startDate, endDate),
      costPerPerson: r.costPerPerson,
      breakdown: r.breakdown,
      pitch: r.pitch,
      pros: r.pros.slice(0, 4),
      cons: r.cons.slice(0, 3),
      people,
      canJoinCount: going.length,
      avgScore: Math.round(people.reduce((s, p) => s + p.score, 0) / Math.max(1, people.length)),
      biggestCompromise,
      plans,
    } satisfies Recommendation;
  });
  return rankRecommendations(recs);
}

export async function recommend(trip: Trip, members: Member[], snapshot: GroupSnapshot) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("AI isn't configured (GEMINI_API_KEY missing).");
  const ai = new GoogleGenAI({ apiKey });

  const { notes, sources } = await research(ai, trip, members, snapshot);
  let parsed: z.infer<typeof aiSchema>;
  try {
    parsed = await structure(ai, trip, members, snapshot, notes);
  } catch (err) {
    console.warn("[ai] structure step failed once, retrying:", err);
    parsed = await structure(ai, trip, members, snapshot, notes);
  }
  return { recommendations: verify(trip, members, parsed), sources };
}

/** Plain-text summary for the WhatsApp share message. */
export function shareText(trip: Trip, recs: Recommendation[], snapshot: GroupSnapshot, url: string, names: string[]) {
  const medals = ["🥇", "🥈", "🥉"];
  const lines = [
    `🧳 *${trip.name}*: Plan Pakka`,
    `Based on preferences from ${names.length} of us (${names.join(", ")}):`,
    "",
    ...recs.map(
      (r, i) =>
        `${medals[i]} ${r.destination}: ${formatINR(r.costPerPerson)}/person, ${formatDateRange(r.startDate, r.endDate)} (${r.canJoinCount}/${r.people.length} can go)`,
    ),
  ];
  if (snapshot.budgetBand)
    lines.push("", `💰 Budget that works for most: ${formatINR(snapshot.budgetBand.min)}–${formatINR(snapshot.budgetBand.max)}`);
  if (snapshot.bestWindow) lines.push(`📅 Best dates: ${formatDateRange(snapshot.bestWindow.from, snapshot.bestWindow.to)}`);
  const plan = recs[0]?.plans[0];
  if (plan) lines.push("", `💡 To get everyone there: ${plan.title}. Tap "I'm OK with this" if you agree 👇`);
  lines.push("", `See where you stand & vote: ${url}`);
  return lines.join("\n");
}
