import { shareText } from "@/lib/ai";
import { formatDateRange } from "@/lib/format";
import { MIN_MEMBERS } from "@/lib/generate";
import type { TripData } from "@/lib/trip-data";
import type { Recommendation } from "@/lib/types";
import { AutoRefresh, ShareMessage } from "./client";
import { PrefsSection } from "./PrefsForm";
import { RecCard, SnapshotCard, Sources, TripHero } from "./views";

/** Only short, known phrases are ever shown; anything else is replaced (raw errors can leak secrets). */
const SAFE_REASON = /^the AI [a-z '’]{3,40}$/i;

/** The single trip page everyone sees. The coordinator view passes extra tools. */
export function TripBody({
  data,
  coordinatorTools,
  adminSlot,
}: {
  data: TripData;
  coordinatorTools?: React.ReactNode;
  adminSlot?: (rec: Recommendation) => React.ReactNode;
}) {
  const { trip, members, result, votes, snapshot } = data;
  const running = trip.genState === "running";
  const recs = result?.recommendations ?? [];
  const lockedRec = trip.locked ? recs.find((r) => r.id === trip.locked!.recId) : undefined;
  const lockedPlan = lockedRec?.plans.find((p) => p.id === trip.locked!.planId);
  const reason = trip.genError && SAFE_REASON.test(trip.genError) ? trip.genError : "the AI hit a temporary problem";

  return (
    <div className="space-y-5">
      <AutoRefresh every={running ? 4000 : 15000} />

      <TripHero trip={trip} members={members} />

      {coordinatorTools}

      {lockedRec && (
        <section className="rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-white shadow-lg animate-pop">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-50">It&apos;s decided 🎉</p>
          <p className="font-display text-3xl font-extrabold">{lockedRec.destination}</p>
          <p className="text-emerald-50">
            {formatDateRange(lockedPlan?.newStartDate ?? lockedRec.startDate, lockedPlan?.newEndDate ?? lockedRec.endDate)}
            {lockedPlan && <> · with “{lockedPlan.title}”</>}
          </p>
        </section>
      )}

      <div id="prefs" className="scroll-mt-4">
        <PrefsSection tripId={trip.id} coordinator={trip.coordinator} windowStart={trip.windowStart} windowEnd={trip.windowEnd} />
      </div>

      {members.length < MIN_MEMBERS ? (
        <p className="rounded-3xl border-2 border-dashed border-violet-200 bg-white/60 p-6 text-center text-stone-600">
          ✨ Trip ideas appear here once {MIN_MEMBERS} people have added their preferences.
        </p>
      ) : running ? (
        <div className="card flex items-center gap-4" role="status">
          <span className="h-9 w-9 shrink-0 animate-spin rounded-full border-4 border-violet-100 border-t-violet-600" aria-hidden />
          <div>
            <p className="font-semibold">Finding trips that fit everyone…</p>
            <p className="text-sm text-stone-500">Checking trains, prices and weather on Google. About a minute.</p>
          </div>
        </div>
      ) : trip.genError ? (
        <p className="rounded-3xl bg-rose-50 p-5 text-sm text-rose-800">
          Couldn&apos;t update the trip ideas ({reason}). It tries again with the next response{recs.length ? ", and the ideas below are from the last update." : "."}
        </p>
      ) : null}

      {recs.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-2">
            <h2 className="font-display text-2xl font-extrabold">Trips that fit your group</h2>
            {result?.changeNote && <p className="hidden text-right text-xs text-stone-500 sm:block">{result.changeNote}</p>}
          </div>
          {result?.changeNote && <p className="-mt-2 text-xs text-stone-500 sm:hidden">{result.changeNote}</p>}
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

      {members.length >= MIN_MEMBERS && <SnapshotCard s={snapshot} />}

      {recs.length > 0 && (
        <ShareMessage
          title="Send the results to the group"
          sub="Nothing is sent until you tap send."
          path={`/t/${trip.id}`}
          template={shareText({ ...trip, adminKey: "" }, recs, snapshot, "{link}", members.map((m) => m.name))}
        />
      )}

      {result && <Sources sources={result.sources} />}
    </div>
  );
}
