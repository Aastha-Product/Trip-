import { avatarColor, formatDateRange, formatINR, initials, MOOD_META } from "@/lib/format";
import type { GroupSnapshot, InclusionPlan, PublicMember, Recommendation, Source, Trip, Vote } from "@/lib/types";
import { ShareButtons, VoteBar, YouBadge } from "./client";

const MEDALS = ["🥇", "🥈", "🥉"];

export function Avatar({ id, name, size = "h-9 w-9 text-sm", ring = "" }: { id: string; name: string; size?: string; ring?: string }) {
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center rounded-full font-bold text-white ${size} ${ring} ${avatarColor(id)}`}>
      {initials(name)}
    </span>
  );
}

/** Top of the trip page: whose trip, who's in, share. */
export function TripHero({ trip, members }: { trip: Omit<Trip, "adminKey">; members: PublicMember[] }) {
  const expected = trip.expectedSize;
  const done = members.length;
  const pct = expected ? Math.min(100, (done / expected) * 100) : 100;
  const invite = `✈️ ${trip.coordinator} is planning *${trip.name}*!\nAdd your preferences (1 min) and see which trips fit all of us:\n{link}`;
  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-700 via-indigo-700 to-indigo-900 p-6 text-white shadow-xl shadow-indigo-900/20">
      <div aria-hidden className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-fuchsia-400/30 blur-2xl" />
      <p className="relative text-sm font-medium text-violet-200">{trip.coordinator} is planning</p>
      <h1 className="relative font-display text-4xl font-extrabold leading-tight">{trip.name}</h1>
      <p className="relative mt-1 text-violet-100">📅 Sometime {formatDateRange(trip.windowStart, trip.windowEnd)}</p>

      <div className="relative mt-5 flex items-center gap-3">
        <div className="flex -space-x-2">
          {members.slice(0, 8).map((m) => (
            <span key={m.id} title={m.name}>
              <Avatar id={m.id} name={m.name} ring="ring-2 ring-indigo-800" />
            </span>
          ))}
          {expected &&
            Array.from({ length: Math.max(0, Math.min(8, expected) - Math.min(8, done)) }, (_, i) => (
              <span key={i} aria-hidden className="grid h-9 w-9 place-items-center rounded-full border-2 border-dashed border-white/40 text-xs text-white/60">?</span>
            ))}
        </div>
        <p className="text-sm">
          <strong className="text-lg">{done}</strong>
          {expected ? ` of ${expected}` : ""} {expected || done !== 1 ? "friends" : "friend"} in
        </p>
      </div>
      {expected && (
        <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-300 to-sky-300 transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
      <div className="relative mt-5">
        <ShareButtons path={`/t/${trip.id}`} message={invite} dark />
      </div>
    </section>
  );
}

function Stat({ icon, label, value, note, ok }: { icon: string; label: string; value: string; note: string; ok: boolean }) {
  return (
    <div className="rounded-2xl bg-stone-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{icon} {label}</p>
      <p className="mt-1 font-display text-lg font-bold text-stone-900">{value}</p>
      <p className={`text-xs ${ok ? "text-emerald-700" : "text-amber-700"}`}>{ok ? "✓ " : "⚠ "}{note}</p>
    </div>
  );
}

export function SnapshotCard({ s }: { s: GroupSnapshot }) {
  return (
    <section className="card space-y-4">
      <h2 className="font-display text-xl font-bold">The group at a glance</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {s.bestWindow && (
          <Stat icon="📅" label="Best dates" value={formatDateRange(s.bestWindow.from, s.bestWindow.to)}
            ok={s.bestWindow.missing.length === 0}
            note={s.bestWindow.missing.length ? `${s.bestWindow.missing.join(", ")} can't make it` : "Everyone's free"} />
        )}
        {s.budgetBand && (
          <Stat icon="💰" label="Budget for most" value={`${formatINR(s.budgetBand.min)}–${formatINR(s.budgetBand.max)}`}
            ok={s.budgetBand.outside.length === 0}
            note={s.budgetBand.outside.length ? `Outside it: ${s.budgetBand.outside.join(", ")}` : "Works for everyone"} />
        )}
        {s.tripLength && (
          <Stat icon="⏱" label="Trip length" value={`${s.tripLength.min === s.tripLength.max ? s.tripLength.min : `${s.tripLength.min}–${s.tripLength.max}`} days`}
            ok={s.tripLength.worksFor === s.memberCount}
            note={s.tripLength.worksFor === s.memberCount ? "Suits everyone" : `Suits ${s.tripLength.worksFor} of ${s.memberCount}`} />
        )}
      </div>
      {s.dealbreakers.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">🚫 Hard no&apos;s we&apos;re avoiding</p>
          <ul className="flex flex-wrap gap-2">
            {s.dealbreakers.map((d) => (
              <li key={d.key} className="rounded-full bg-rose-50 px-3 py-1 text-sm text-rose-900">
                {d.label} <span className="text-rose-700/70">· {d.names.join(", ")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function votersFor(targetId: string, votes: Vote[], members: PublicMember[]) {
  const byId = new Map(members.map((m) => [m.id, m.name]));
  const pick = (v: Vote["value"]) =>
    votes
      .filter((x) => x.targetId === targetId && x.value === v && byId.has(x.memberId))
      .map((x) => ({ id: x.memberId, name: byId.get(x.memberId)! }));
  return { yes: pick("yes"), no: pick("no") };
}

const PLAN_ICONS: Record<InclusionPlan["kind"], string> = {
  "shift-dates": "📅",
  "join-late": "🕒",
  budget: "💸",
  travel: "🚆",
  swap: "🔁",
  other: "💡",
};

function PlanCard({ tripId, plan, votes, members, chosen }: { tripId: string; plan: InclusionPlan; votes: Vote[]; members: PublicMember[]; chosen: boolean }) {
  const v = votersFor(plan.id, votes, members);
  const ok = plan.check && plan.check.hurts.length === 0 && plan.check.worksFor > 0;
  return (
    <li className={`rounded-2xl border p-4 ${chosen ? "border-emerald-400 bg-emerald-50" : "border-violet-200 bg-gradient-to-br from-violet-50 to-white"}`}>
      <div className="flex gap-3">
        <span className="text-2xl" aria-hidden>{PLAN_ICONS[plan.kind]}</span>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-semibold text-stone-900">
            {plan.title}
            {chosen && <span className="ml-2 rounded-full bg-emerald-600 px-2 py-0.5 text-xs text-white">Locked in</span>}
          </p>
          <p className="text-sm text-stone-700"><span className="font-semibold">If everyone&apos;s OK with:</span> {plan.askOfGroup}</p>
          {plan.check && (
            <p className={`text-sm font-medium ${ok ? "text-emerald-700" : "text-amber-700"}`}>{ok ? "✓" : "⚠"} {plan.check.note}</p>
          )}
          <details className="text-sm text-stone-600">
            <summary className="cursor-pointer font-medium text-violet-700">How it works</summary>
            <p className="mt-1">{plan.details}</p>
            <p className="mt-1 flex flex-wrap gap-2 text-xs">
              {plan.newStartDate && plan.newEndDate && <span className="rounded-full bg-white px-2 py-1">📅 {formatDateRange(plan.newStartDate, plan.newEndDate)}</span>}
              {plan.newCostPerPerson != null && <span className="rounded-full bg-white px-2 py-1">💰 {formatINR(plan.newCostPerPerson)}/person</span>}
              {plan.costForThem != null && <span className="rounded-full bg-white px-2 py-1">💰 {formatINR(plan.costForThem)} for {plan.forNames.join(", ")}</span>}
              <span className="rounded-full bg-white px-2 py-1">{plan.costImpact}</span>
            </p>
          </details>
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
  const out = rec.people.filter((p) => !p.canJoin);
  const inVotes = votersFor(rec.id, votes, members);
  const total = rec.breakdown.travel + rec.breakdown.stay + rec.breakdown.foodFun || 1;

  return (
    <article className={`card space-y-4 animate-pop ${isLocked ? "ring-4 ring-emerald-200" : rank === 0 ? "ring-2 ring-violet-300" : ""}`}>
      <header className="flex items-start gap-3">
        <span className="text-4xl leading-none" aria-hidden>{MEDALS[rank] ?? "•"}</span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-2xl font-extrabold leading-tight text-stone-900">{rec.destination}</h3>
          <p className="text-sm text-stone-500">{rec.region} · {formatDateRange(rec.startDate, rec.endDate)} · {rec.days} days</p>
        </div>
        <div className="text-right">
          <p className="font-display text-xl font-bold">{formatINR(rec.costPerPerson)}</p>
          <p className="text-xs text-stone-500">per person</p>
        </div>
      </header>

      <p className="text-stone-700">{rec.pitch}</p>

      <div>
        <p className="mb-2 text-sm font-semibold text-stone-700">
          {out.length === 0 ? `🎉 All ${rec.people.length} can go` : `${rec.canJoinCount} of ${rec.people.length} can go`}
        </p>
        <ul className="flex flex-wrap gap-2">
          {rec.people.map((p) => (
            <li key={p.memberId} className={`flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-sm ${p.canJoin ? "bg-stone-50" : "bg-rose-50"}`} title={p.reason}>
              <Avatar id={p.memberId} name={p.name} size="h-6 w-6 text-[11px]" />
              <span className="font-medium">{p.name}</span>
              <YouBadge tripId={tripId} memberId={p.memberId} />
              <span aria-label={MOOD_META[p.mood].label}>{MOOD_META[p.mood].emoji}</span>
            </li>
          ))}
        </ul>
      </div>

      {rec.plans.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-display text-lg font-bold">🤝 Bring everyone along</h4>
          <ul className="space-y-2">
            {rec.plans.map((pl) => (
              <PlanCard key={pl.id} tripId={tripId} plan={pl} votes={votes} members={members} chosen={isLocked && lockedPlanId === pl.id} />
            ))}
          </ul>
        </div>
      )}

      <details className="group rounded-2xl bg-stone-50 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-violet-700">See why · pros, cons &amp; each person</summary>
        <div className="mt-3 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <ul className="space-y-1 text-sm text-emerald-900">{rec.pros.map((x, i) => <li key={i}>👍 {x}</li>)}</ul>
            <ul className="space-y-1 text-sm text-rose-900">{rec.cons.map((x, i) => <li key={i}>👎 {x}</li>)}</ul>
          </div>
          <div>
            <div className="flex h-2 overflow-hidden rounded-full" aria-hidden>
              <div className="bg-teal-500" style={{ width: `${(rec.breakdown.travel / total) * 100}%` }} />
              <div className="bg-violet-500" style={{ width: `${(rec.breakdown.stay / total) * 100}%` }} />
              <div className="bg-pink-500" style={{ width: `${(rec.breakdown.foodFun / total) * 100}%` }} />
            </div>
            <p className="mt-1 flex flex-wrap gap-x-4 text-xs text-stone-600">
              <span><span className="text-teal-500">●</span> Travel {formatINR(rec.breakdown.travel)}</span>
              <span><span className="text-violet-500">●</span> Stay {formatINR(rec.breakdown.stay)}</span>
              <span><span className="text-pink-500">●</span> Food &amp; fun {formatINR(rec.breakdown.foodFun)}</span>
            </p>
          </div>
          <ul className="space-y-3">
            {rec.people.map((p) => {
              const m = MOOD_META[p.mood];
              return (
                <li key={p.memberId}>
                  <div className="flex items-center gap-2">
                    <span className="w-24 truncate text-sm font-semibold">{p.name}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200" role="meter" aria-valuenow={p.score} aria-valuemin={0} aria-valuemax={100} aria-label={`${p.name}: ${p.score} out of 100`}>
                      <div className={`h-full rounded-full ${m.bar}`} style={{ width: `${p.score}%` }} />
                    </div>
                    <span className={`w-8 text-right text-sm font-bold tabular-nums ${m.text}`}>{p.score}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-stone-600">{p.reason}</p>
                  {p.issues.length > 0 && (
                    <p className="mt-1 flex flex-wrap gap-1">
                      {p.issues.map((i, k) => (
                        <span key={k} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${i.blocker ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}`}>{i.label}</span>
                      ))}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </details>

      <div className="border-t border-stone-100 pt-4">
        <VoteBar tripId={tripId} targetId={rec.id} yes={inVotes.yes} no={inVotes.no} total={members.length} yesLabel="I'm in!" noLabel="Not this one" />
      </div>
      {adminSlot}
    </article>
  );
}

export function Sources({ sources }: { sources: Source[] }) {
  if (sources.length === 0) return null;
  return (
    <details className="rounded-2xl px-2 text-sm text-stone-500">
      <summary className="cursor-pointer">🔎 Prices & travel checked on Google ({sources.length} sources)</summary>
      <ul className="mt-2 flex flex-wrap gap-2">
        {sources.map((s) => (
          <li key={s.url}>
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="rounded-full bg-white px-3 py-1 text-stone-700 shadow-sm hover:bg-violet-50">{s.title}</a>
          </li>
        ))}
      </ul>
    </details>
  );
}
