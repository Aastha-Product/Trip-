import { avatarColor, formatDateRange, formatINR, formatShortINR, initials, MOOD_META } from "@/lib/format";
import type { GroupSnapshot, InclusionPlan, PersonFit, PublicMember, Recommendation, Source, Vote } from "@/lib/types";
import { VoteBar, YouBadge } from "./client";

const MEDALS = ["🥇", "🥈", "🥉"];

export function Avatar({ id, name, size = "h-9 w-9" }: { id: string; name: string; size?: string }) {
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center rounded-full font-bold text-white ${size} ${avatarColor(id)}`}>
      {initials(name)}
    </span>
  );
}

export function MemberList({ tripId, members, expected }: { tripId: string; members: PublicMember[]; expected: number | null }) {
  const waiting = expected ? Math.max(0, expected - members.length) : 0;
  return (
    <section className="card space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl font-bold">
          {members.length} {members.length === 1 ? "person has" : "people have"} joined
        </h2>
        {expected && <span className="text-sm text-stone-500">{waiting > 0 ? `waiting on ${waiting}` : "everyone's in 🎉"}</span>}
      </div>
      {expected && (
        <div className="h-2 overflow-hidden rounded-full bg-orange-100">
          <div className="h-full rounded-full bg-orange-500" style={{ width: `${Math.min(100, (members.length / expected) * 100)}%` }} />
        </div>
      )}
      <ul className="divide-y divide-stone-100">
        {members.map((m) => (
          <li key={m.id} className="flex items-start gap-3 py-3">
            <Avatar id={m.id} name={m.name} />
            <div className="min-w-0">
              <p className="font-semibold text-stone-900">
                {m.name} <span className="font-normal text-stone-500">· {m.prefs.homeCity}</span> <YouBadge tripId={tripId} memberId={m.id} />
              </p>
              <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-stone-600">
                <span>💰 {formatShortINR(m.prefs.budgetMin)}–{formatShortINR(m.prefs.budgetMax)}</span>
                {m.prefs.dateRanges.map((r, i) => (
                  <span key={i}>📅 {formatDateRange(r.from, r.to)}</span>
                ))}
                <span>⏱ {m.prefs.lengthMin}–{m.prefs.lengthMax} days</span>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-amber-700">⚠️ {children}</p>;
}

export function SnapshotCard({ s }: { s: GroupSnapshot }) {
  return (
    <section className="card space-y-5">
      <h2 className="font-display text-xl font-bold">The group at a glance</h2>
      {s.budgetBand && (
        <div className="flex gap-3">
          <span className="text-2xl" aria-hidden>💰</span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Budget that works for most</p>
            <p className="text-lg font-semibold">{formatINR(s.budgetBand.min)} – {formatINR(s.budgetBand.max)} per person</p>
            {s.budgetBand.outside.length > 0 ? (
              <Warn>Works for {s.budgetBand.worksFor.length} of {s.memberCount}. {s.budgetBand.outside.join(", ")} outside it</Warn>
            ) : (
              <p className="text-sm text-emerald-700">✓ Works for everyone</p>
            )}
          </div>
        </div>
      )}
      {s.bestWindow && (
        <div className="flex gap-3">
          <span className="text-2xl" aria-hidden>📅</span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Best dates</p>
            <p className="text-lg font-semibold">{formatDateRange(s.bestWindow.from, s.bestWindow.to)} ({s.bestWindow.days} days)</p>
            {s.bestWindow.missing.length > 0 ? (
              <Warn>Works for {s.bestWindow.worksFor.length} of {s.memberCount}. {s.bestWindow.missing.join(", ")} can&apos;t make it</Warn>
            ) : (
              <p className="text-sm text-emerald-700">✓ Everyone&apos;s free</p>
            )}
          </div>
        </div>
      )}
      {s.tripLength && (
        <div className="flex gap-3">
          <span className="text-2xl" aria-hidden>⏱</span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Trip length</p>
            <p className="text-lg font-semibold">
              {s.tripLength.min === s.tripLength.max ? s.tripLength.min : `${s.tripLength.min}–${s.tripLength.max}`} days
            </p>
            {s.tripLength.worksFor < s.memberCount && <Warn>Suits {s.tripLength.worksFor} of {s.memberCount}</Warn>}
          </div>
        </div>
      )}
      {s.dealbreakers.length > 0 && (
        <div className="flex gap-3">
          <span className="text-2xl" aria-hidden>🚫</span>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">Dealbreakers</p>
            <ul className="flex flex-wrap gap-2">
              {s.dealbreakers.map((d) => (
                <li key={d.key} className="rounded-full bg-orange-50 px-3 py-1 text-sm">
                  {d.label} <span className="text-stone-500">· {d.names.join(", ")}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

function PersonRow({ tripId, p }: { tripId: string; p: PersonFit }) {
  const m = MOOD_META[p.mood];
  return (
    <li className="py-3">
      <div className="flex items-center gap-3">
        <Avatar id={p.memberId} name={p.name} size="h-8 w-8 text-sm" />
        <span className="w-28 truncate font-semibold text-stone-900 sm:w-36" title={p.name}>
          {p.name} <YouBadge tripId={tripId} memberId={p.memberId} />
        </span>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-stone-100" role="meter" aria-valuenow={p.score} aria-valuemin={0} aria-valuemax={100} aria-label={`${p.name}: ${p.score} out of 100`}>
          <div className={`h-full rounded-full ${m.bar}`} style={{ width: `${p.score}%` }} />
        </div>
        <span className={`w-8 text-right font-bold tabular-nums ${m.text}`}>{p.score}</span>
        <span className="text-xl" title={m.label} aria-label={m.label}>{m.emoji}</span>
      </div>
      <p className="mt-1 pl-11 text-sm text-stone-600">{p.reason}</p>
      {p.issues.length > 0 && (
        <ul className="mt-1.5 flex flex-wrap gap-1.5 pl-11">
          {p.issues.map((i, k) => (
            <li key={k} className={`rounded-full px-2 py-0.5 text-xs font-medium ${i.blocker ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}`}>
              {i.blocker ? "✕" : "!"} {i.label}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

const PLAN_ICONS: Record<InclusionPlan["kind"], string> = {
  "shift-dates": "📅",
  "join-late": "🕒",
  budget: "💸",
  travel: "🚆",
  swap: "🔁",
  other: "💡",
};

function votersFor(targetId: string, votes: Vote[], members: PublicMember[]) {
  const byId = new Map(members.map((m) => [m.id, m.name]));
  const pick = (v: Vote["value"]) =>
    votes
      .filter((x) => x.targetId === targetId && x.value === v && byId.has(x.memberId))
      .map((x) => ({ id: x.memberId, name: byId.get(x.memberId)! }));
  return { yes: pick("yes"), no: pick("no") };
}

function PlanCard({ tripId, plan, votes, members, chosen }: { tripId: string; plan: InclusionPlan; votes: Vote[]; members: PublicMember[]; chosen: boolean }) {
  const v = votersFor(plan.id, votes, members);
  const ok = plan.check && plan.check.hurts.length === 0 && plan.check.worksFor > 0;
  return (
    <li className={`rounded-2xl border p-4 ${chosen ? "border-emerald-400 bg-emerald-50" : "border-violet-200 bg-violet-50/60"}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden>{PLAN_ICONS[plan.kind]}</span>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-semibold text-stone-900">
            {plan.title} {chosen && <span className="ml-1 rounded-full bg-emerald-600 px-2 py-0.5 text-xs text-white">Locked in</span>}
          </p>
          <p className="text-sm text-stone-700">
            <span className="font-semibold">What everyone else accepts:</span> {plan.askOfGroup}
          </p>
          <p className="text-sm text-stone-600">{plan.details}</p>
          <div className="flex flex-wrap gap-2 text-xs">
            {plan.newStartDate && plan.newEndDate && (
              <span className="rounded-full bg-white px-2 py-1 text-stone-700">📅 {formatDateRange(plan.newStartDate, plan.newEndDate)}</span>
            )}
            {plan.newCostPerPerson != null && (
              <span className="rounded-full bg-white px-2 py-1 text-stone-700">💰 {formatINR(plan.newCostPerPerson)}/person</span>
            )}
            {plan.costForThem != null && (
              <span className="rounded-full bg-white px-2 py-1 text-stone-700">💰 {formatINR(plan.costForThem)} for {plan.forNames.join(", ")}</span>
            )}
            <span className="rounded-full bg-white px-2 py-1 text-stone-700">{plan.costImpact}</span>
          </div>
          {plan.check && (
            <p className={`text-sm font-medium ${ok ? "text-emerald-700" : "text-amber-700"}`}>
              {ok ? "✓" : "⚠️"} Checked against everyone&apos;s answers: {plan.check.note}
            </p>
          )}
          <VoteBar tripId={tripId} targetId={plan.id} yes={v.yes} no={v.no} total={members.length} yesLabel="I'm OK with this" noLabel="Not for me" />
        </div>
      </div>
    </li>
  );
}

export function RecCard({
  tripId,
  rec,
  rank,
  votes,
  members,
  lockedPlanId,
  isLocked,
  adminSlot,
}: {
  tripId: string;
  rec: Recommendation;
  rank: number;
  votes: Vote[];
  members: PublicMember[];
  lockedPlanId: string | null;
  isLocked: boolean;
  adminSlot?: React.ReactNode;
}) {
  const total = rec.breakdown.travel + rec.breakdown.stay + rec.breakdown.foodFun || 1;
  const happy = rec.people.filter((p) => p.mood === "love" || p.mood === "happy").length;
  const compromising = rec.people.filter((p) => p.mood === "meh").length;
  const out = rec.people.filter((p) => p.mood === "out").length;
  const inVotes = votersFor(rec.id, votes, members);

  return (
    <article className={`card space-y-5 ${isLocked ? "border-emerald-400 ring-4 ring-emerald-100" : rank === 0 ? "border-orange-300 ring-4 ring-orange-100" : ""}`}>
      <header className="flex items-start gap-3">
        <span className="text-4xl" aria-hidden>{MEDALS[rank] ?? "•"}</span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-2xl font-bold leading-tight text-stone-900">{rec.destination}</h3>
          <p className="text-stone-500">{rec.region}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl font-bold">{formatINR(rec.costPerPerson)}</p>
          <p className="text-xs text-stone-500">per person, est.</p>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded-full bg-orange-50 px-3 py-1 text-orange-800">📅 {formatDateRange(rec.startDate, rec.endDate)} · {rec.days} days</span>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800">😊 {happy} happy</span>
        {compromising > 0 && <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-800">😬 {compromising} compromising</span>}
        {out > 0 && <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-800">🚫 {out} can&apos;t go as planned</span>}
      </div>

      <div>
        <div className="flex h-2.5 overflow-hidden rounded-full" aria-hidden>
          <div className="bg-teal-600" style={{ width: `${(rec.breakdown.travel / total) * 100}%` }} />
          <div className="bg-orange-500" style={{ width: `${(rec.breakdown.stay / total) * 100}%` }} />
          <div className="bg-pink-600" style={{ width: `${(rec.breakdown.foodFun / total) * 100}%` }} />
        </div>
        <p className="mt-2 flex flex-wrap gap-x-4 text-sm text-stone-600">
          <span><span className="text-teal-600">●</span> Travel {formatINR(rec.breakdown.travel)}</span>
          <span><span className="text-orange-500">●</span> Stay {formatINR(rec.breakdown.stay)}</span>
          <span><span className="text-pink-600">●</span> Food &amp; fun {formatINR(rec.breakdown.foodFun)}</span>
        </p>
      </div>

      <p className="text-lg leading-relaxed text-stone-800">{rec.pitch}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-emerald-50 p-4">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-emerald-800">Pros</p>
          <ul className="space-y-1 text-sm text-emerald-950">{rec.pros.map((x, i) => <li key={i}>+ {x}</li>)}</ul>
        </div>
        <div className="rounded-2xl bg-rose-50 p-4">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-rose-800">Cons</p>
          <ul className="space-y-1 text-sm text-rose-950">{rec.cons.map((x, i) => <li key={i}>− {x}</li>)}</ul>
        </div>
      </div>

      <div className="rounded-2xl bg-orange-50/60 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-stone-600">Where everyone stands</p>
        <ul className="divide-y divide-orange-100">
          {rec.people.map((p) => <PersonRow key={p.memberId} tripId={tripId} p={p} />)}
        </ul>
      </div>

      {rec.biggestCompromise && (
        <p className="text-stone-700">
          <strong>Biggest compromise: {rec.biggestCompromise.name}.</strong> {rec.biggestCompromise.reason}
        </p>
      )}

      {rec.plans.length > 0 && (
        <div className="space-y-3">
          <div>
            <h4 className="font-display text-lg font-bold">🤝 Make it work for everyone</h4>
            <p className="text-sm text-stone-600">Ways to bring the people who miss out along, if the rest of you are OK with it.</p>
          </div>
          <ul className="space-y-3">
            {rec.plans.map((pl) => (
              <PlanCard key={pl.id} tripId={tripId} plan={pl} votes={votes} members={members} chosen={isLocked && lockedPlanId === pl.id} />
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-stone-100 pt-4">
        <p className="mb-2 text-sm font-semibold text-stone-700">Would you go on this one?</p>
        <VoteBar tripId={tripId} targetId={rec.id} yes={inVotes.yes} no={inVotes.no} total={members.length} yesLabel="I'm in" noLabel="Not this one" />
      </div>
      {adminSlot}
    </article>
  );
}

export function Sources({ sources }: { sources: Source[] }) {
  if (sources.length === 0) return null;
  return (
    <details className="rounded-2xl border border-stone-200 bg-white px-5 py-4 text-sm">
      <summary className="cursor-pointer font-semibold text-stone-700">🔎 Prices & travel times researched on Google ({sources.length} sources)</summary>
      <p className="mt-2 text-stone-500">Numbers are estimates from current listings. Check before you book.</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {sources.map((s) => (
          <li key={s.url}>
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="rounded-full bg-stone-100 px-3 py-1 text-stone-700 hover:bg-stone-200">{s.title}</a>
          </li>
        ))}
      </ul>
    </details>
  );
}
