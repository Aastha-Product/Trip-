import { shareText } from "@/lib/ai";
import { formatDateRange } from "@/lib/format";
import { MIN_MEMBERS } from "@/lib/generate";
import type { TripData } from "@/lib/trip-data";
import type { Recommendation } from "@/lib/types";
import { AutoRefresh, ShareMessage } from "./client";
import { MemberList, RecCard, SnapshotCard, Sources } from "./views";

/** The shared body of the trip hub and the coordinator view. */
export function TripBody({
  data,
  adminSlot,
}: {
  data: TripData;
  adminSlot?: (rec: Recommendation) => React.ReactNode;
}) {
  const { trip, members, result, votes, snapshot } = data;
  const running = trip.genState === "running";
  const recs = result?.recommendations ?? [];
  const lockedRec = trip.locked ? recs.find((r) => r.id === trip.locked!.recId) : undefined;
  const lockedPlan = lockedRec?.plans.find((p) => p.id === trip.locked!.planId);
  const stale = result && members.some((m) => !result.memberIds.includes(m.id) || m.updatedAt > result.createdAt);

  return (
    <>
      <AutoRefresh every={running ? 4000 : 15000} />

      <MemberList tripId={trip.id} members={members} expected={trip.expectedSize} />

      {lockedRec && (
        <section className="rounded-3xl bg-emerald-600 p-6 text-white shadow-lg">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-100">Plan pakka 🎉</p>
          <p className="font-display text-3xl font-extrabold">{lockedRec.destination}</p>
          <p className="text-emerald-50">
            {formatDateRange(lockedPlan?.newStartDate ?? lockedRec.startDate, lockedPlan?.newEndDate ?? lockedRec.endDate)} · {trip.coordinator} locked it in
            {lockedPlan && <> with the plan: “{lockedPlan.title}”</>}
          </p>
        </section>
      )}

      {members.length < MIN_MEMBERS ? (
        <p className="rounded-3xl border border-dashed border-orange-300 bg-white/60 p-5 text-center text-stone-600">
          Recommendations appear as soon as {MIN_MEMBERS} people have joined. Share the link! 👇
        </p>
      ) : running ? (
        <div className="flex items-center gap-4 rounded-3xl bg-white p-5 shadow-sm" role="status">
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-500" aria-hidden />
          <div>
            <p className="font-semibold">Crunching everyone&apos;s answers…</p>
            <p className="text-sm text-stone-600">Searching prices, trains and weather. Takes about a minute.</p>
          </div>
        </div>
      ) : trip.genError ? (
        <p className="rounded-3xl bg-rose-50 p-5 text-rose-800">
          Couldn&apos;t refresh the recommendations ({trip.genError}). It retries on the next response, or {trip.coordinator} can
          retry from the coordinator page.
        </p>
      ) : stale ? (
        <p className="text-sm text-stone-500">Updating for the latest answers…</p>
      ) : null}

      {result?.changeNote && (
        <p className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <strong>What changed:</strong> {result.changeNote}
        </p>
      )}

      {recs.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="font-display text-2xl font-extrabold">Top {recs.length} for the group</h2>
            <p className="text-sm text-stone-600">Ranked by how many can go, then how happy everyone is. Tap to vote.</p>
          </div>
          {recs.map((rec, i) => (
            <RecCard
              key={rec.id}
              tripId={trip.id}
              rec={rec}
              rank={i}
              votes={votes}
              members={members}
              isLocked={lockedRec?.id === rec.id}
              lockedPlanId={trip.locked?.planId ?? null}
              adminSlot={adminSlot?.(rec)}
            />
          ))}
        </section>
      )}

      {members.length > 0 && <SnapshotCard s={snapshot} />}

      {result && <Sources sources={result.sources} />}

      {recs.length > 0 && (
        <ShareMessage
          title="Share with the group"
          sub="Nothing is sent until you paste it or tap send yourself."
          path={`/t/${trip.id}`}
          template={shareText({ ...trip, adminKey: "" }, recs, snapshot, "{link}", members.map((m) => m.name))}
        />
      )}
    </>
  );
}
