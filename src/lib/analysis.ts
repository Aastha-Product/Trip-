/**
 * Everything we can compute exactly, in code: group snapshot, per-person
 * "can they actually go" checks, plan verification, ranking and the
 * "what changed" note. The AI never does this arithmetic for us.
 */
import { formatINR } from "./format";
import {
  DEALBREAKERS,
  type GroupSnapshot,
  type InclusionPlan,
  type Member,
  type PersonFit,
  type PlanCheck,
  type Recommendation,
  type Trip,
  type TripResult,
} from "./types";

const DAY = 86_400_000;
export const toDay = (d: string) => Math.floor(Date.parse(`${d}T00:00:00Z`) / DAY);
export const fromDay = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);
export const daysBetween = (from: string, to: string) => toDay(to) - toDay(from) + 1;

/** Is the person free for every day in [start, end]? */
function freeFor(m: Member, start: number, end: number): boolean {
  return m.prefs.dateRanges.some((r) => toDay(r.from) <= start && end <= toDay(r.to));
}

/**
 * "full" – free for the whole trip; "flex" – could make it by joining late or
 * leaving early within their stated flexibility; "no" – can't make it.
 */
export function dateFit(m: Member, from: string, to: string): { fit: "full" | "flex" | "no"; days: number } {
  const s = toDay(from);
  const e = toDay(to);
  if (freeFor(m, s, e)) return { fit: "full", days: 0 };
  for (let k = 1; k <= m.prefs.dateFlex && k < e - s + 1; k++) {
    for (let late = 0; late <= k; late++) {
      if (freeFor(m, s + late, e - (k - late))) return { fit: "flex", days: k };
    }
  }
  return { fit: "no", days: 0 };
}

/* ---------------------------------- Snapshot --------------------------------- */

export function computeSnapshot(trip: Trip, members: Member[]): GroupSnapshot {
  const snapshot: GroupSnapshot = {
    memberCount: members.length,
    expectedSize: trip.expectedSize,
    bestWindow: null,
    tripLength: null,
    budgetBand: null,
    dealbreakers: [],
  };
  if (members.length === 0) return snapshot;

  // Trip length: the range of lengths acceptable to the most people.
  let bestCount = 0;
  const counts: number[] = [];
  for (let len = 1; len <= 30; len++) {
    counts[len] = members.filter((m) => m.prefs.lengthMin <= len && len <= m.prefs.lengthMax).length;
    bestCount = Math.max(bestCount, counts[len]);
  }
  const bestLens = counts.map((c, len) => (c === bestCount ? len : 0)).filter(Boolean);
  if (bestCount > 0) snapshot.tripLength = { min: bestLens[0], max: bestLens[bestLens.length - 1], worksFor: bestCount };

  // Best window: slide a trip of the shortest agreeable length across the trip window,
  // find the start days that suit the most people, and merge them into one stretch.
  const len = snapshot.tripLength?.min ?? 3;
  const ws = toDay(trip.windowStart);
  const we = toDay(trip.windowEnd);
  let best: { start: number; end: number; who: string[] } | null = null;
  for (let s = ws; s + len - 1 <= we; s++) {
    const who = members.filter((m) => freeFor(m, s, s + len - 1)).map((m) => m.id);
    if (!best || who.length > best.who.length) best = { start: s, end: s + len - 1, who };
    else if (who.length === best.who.length && best.end === s + len - 2 && who.join() === best.who.join()) {
      best.end = s + len - 1; // same people, contiguous: extend the stretch
    }
  }
  if (best && best.who.length > 0) {
    snapshot.bestWindow = {
      from: fromDay(best.start),
      to: fromDay(best.end),
      days: best.end - best.start + 1,
      worksFor: members.filter((m) => best.who.includes(m.id)).map((m) => m.name),
      missing: members.filter((m) => !best.who.includes(m.id)).map((m) => m.name),
    };
  }

  // Budget band: the ₹5,000-wide band that overlaps the most people's ranges (cheapest on ties).
  const top = Math.max(...members.map((m) => m.prefs.budgetMax));
  let band: { min: number; max: number; who: string[] } | null = null;
  for (let lo = 0; lo <= top; lo += 1000) {
    const hi = lo + 5000;
    const who = members.filter((m) => m.prefs.budgetMin <= hi && m.prefs.budgetMax >= lo).map((m) => m.name);
    if (!band || who.length > band.who.length) band = { min: lo, max: hi, who };
  }
  if (band) {
    snapshot.budgetBand = {
      min: band.min,
      max: band.max,
      worksFor: band.who,
      outside: members.map((m) => m.name).filter((n) => !band.who.includes(n)),
    };
  }

  // Dealbreakers, with who holds each.
  const map = new Map<string, { label: string; names: string[] }>();
  for (const m of members) {
    for (const d of m.prefs.dealbreakers) {
      const entry = map.get(d) ?? { label: DEALBREAKERS[d].replace(/^\S+\s/, ""), names: [] };
      entry.names.push(m.name);
      map.set(d, entry);
    }
    if (m.prefs.dealbreakerOther.trim()) {
      const key = `other:${m.prefs.dealbreakerOther.trim().toLowerCase()}`;
      const entry = map.get(key) ?? { label: m.prefs.dealbreakerOther.trim(), names: [] };
      entry.names.push(m.name);
      map.set(key, entry);
    }
  }
  snapshot.dealbreakers = [...map.entries()]
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.names.length - a.names.length);

  return snapshot;
}

/* ------------------------------- Person checks ------------------------------- */

export interface RawPerson {
  memberId: string;
  score: number;
  reason: string;
  travelHours: number | null;
  dealbreakerHit: string | null;
}

interface Scenario {
  startDate: string;
  endDate: string;
  costPerPerson: number;
}

export function checkPerson(m: Member, raw: RawPerson, sc: Scenario, waive: Set<"travel" | "dealbreaker"> = new Set()): PersonFit {
  const issues: PersonFit["issues"] = [];
  const p = m.prefs;

  const d = dateFit(m, sc.startDate, sc.endDate);
  if (d.fit === "no") issues.push({ kind: "dates", label: "Not free on these dates", blocker: true });
  if (d.fit === "flex") issues.push({ kind: "dates", label: `Joins late / leaves early (${d.days}d)`, blocker: false });

  const over = sc.costPerPerson - p.budgetMax;
  if (over > p.budgetStretch) issues.push({ kind: "budget", label: `${formatINR(over)} over budget`, blocker: true });
  else if (over > 0) issues.push({ kind: "budget", label: `Stretching ${formatINR(over)}`, blocker: false });

  if (!waive.has("travel") && raw.travelHours != null && p.maxTravelHours != null && raw.travelHours > p.maxTravelHours) {
    issues.push({ kind: "travel", label: `~${Math.round(raw.travelHours)}h travel (limit ${p.maxTravelHours}h)`, blocker: false });
  }
  if (!waive.has("dealbreaker") && raw.dealbreakerHit) {
    issues.push({ kind: "dealbreaker", label: `Dealbreaker: ${raw.dealbreakerHit}`, blocker: true });
  }

  const canJoin = !issues.some((i) => i.blocker);
  const score = Math.round(Math.max(0, Math.min(100, canJoin ? raw.score : Math.min(raw.score, 40))));
  return {
    memberId: m.id,
    name: m.name,
    score,
    mood: !canJoin ? "out" : score >= 80 ? "love" : score >= 60 ? "happy" : "meh",
    reason: raw.reason,
    travelHours: raw.travelHours,
    canJoin,
    issues,
  };
}

/* ------------------------------ Plan verification ----------------------------- */

export function checkPlan(
  plan: Omit<InclusionPlan, "check">,
  rec: Scenario & { people: PersonFit[] },
  members: Member[],
  raws: Map<string, RawPerson>,
): PlanCheck {
  const sc: Scenario = {
    startDate: plan.newStartDate ?? rec.startDate,
    endDate: plan.newEndDate ?? rec.endDate,
    costPerPerson: plan.newCostPerPerson ?? rec.costPerPerson,
  };
  // A route or activity swap is meant to remove the target's travel/dealbreaker problem.
  const targets = new Set(plan.forMemberIds);
  const waive = plan.kind === "travel" || plan.kind === "swap";
  const after = members.map((m) =>
    checkPerson(
      m,
      raws.get(m.id)!,
      targets.has(m.id) && plan.costForThem != null ? { ...sc, costPerPerson: plan.costForThem } : sc,
      targets.has(m.id) && waive ? new Set(["travel", "dealbreaker"]) : new Set(),
    ),
  );
  const before = new Map(rec.people.map((p) => [p.memberId, p]));
  const helps = after.filter((a) => a.canJoin && !before.get(a.memberId)?.canJoin).map((a) => a.name);
  const hurts = after.filter((a) => !a.canJoin && before.get(a.memberId)?.canJoin).map((a) => a.name);
  const worksFor = after.filter((a) => a.canJoin).length;
  const stillOut = plan.forNames.filter((n) => !after.find((a) => a.name === n)?.canJoin);

  let note: string;
  if (worksFor === members.length) note = `Works for all ${members.length} ✓`;
  else if (hurts.length) note = `Works for ${worksFor} of ${members.length}, but ${hurts.join(", ")} would drop out`;
  else note = `Works for ${worksFor} of ${members.length}`;
  if (stillOut.length && !helps.length) note += ` · doesn't fully fix it for ${stillOut.join(", ")}`;

  return { worksFor, of: members.length, helps, hurts, note };
}

/* ---------------------------------- Ranking ---------------------------------- */

export function rankRecommendations(recs: Recommendation[]): Recommendation[] {
  return [...recs].sort((a, b) => b.canJoinCount - a.canJoinCount || b.avgScore - a.avgScore);
}

/* -------------------------------- What changed -------------------------------- */

export function changeNote(prev: TripResult | null, next: Recommendation[], members: Member[]): string | null {
  if (!prev || prev.recommendations.length === 0) return null;
  const prevIds = new Set(prev.memberIds);
  const joined = members.filter((m) => !prevIds.has(m.id)).map((m) => m.name);
  const edited = members
    .filter((m) => prevIds.has(m.id) && Date.parse(m.updatedAt) > Date.parse(prev.createdAt))
    .map((m) => m.name);
  const who = [
    joined.length ? `${joined.join(", ")} joined` : "",
    edited.length ? `${edited.join(", ")} updated their answers` : "",
  ]
    .filter(Boolean)
    .join(" and ");
  const before = prev.recommendations[0]?.destination;
  const now = next[0]?.destination;
  const outcome =
    before && now && before !== now ? `${now} is now the top pick (was ${before})` : `${now} is still the top pick`;
  return who ? `${who}: ${outcome}.` : `Refreshed: ${outcome}.`;
}
