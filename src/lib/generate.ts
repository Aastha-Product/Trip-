import "server-only";
import { recommend } from "./ai";
import { changeNote, computeSnapshot } from "./analysis";
import { getStore } from "./store";

/** Recommendations need at least this many people to be meaningful. */
export const MIN_MEMBERS = 2;

async function generateOnce(tripId: string) {
  const store = getStore();
  const trip = await store.getTrip(tripId);
  if (!trip) return;
  const members = await store.listMembers(tripId);
  if (members.length < MIN_MEMBERS) return;

  const snapshot = computeSnapshot(trip, members);
  const prev = await store.getResult(tripId);
  const { recommendations, sources } = await recommend(trip, members, snapshot);
  await store.saveResult({
    tripId,
    createdAt: new Date().toISOString(),
    memberIds: members.map((m) => m.id),
    snapshot,
    recommendations,
    sources,
    changeNote: changeNote(prev, recommendations, members),
  });
}

/**
 * Regenerates recommendations in the background. Safe to call on every submission:
 * if a run is already going, it marks the trip dirty and that run goes again when
 * it finishes, so a burst of five submissions costs two runs, not five.
 */
export async function requestGeneration(tripId: string) {
  const store = getStore();
  while (await store.claimGeneration(tripId)) {
    let error: string | null = null;
    try {
      await generateOnce(tripId);
    } catch (err) {
      console.error("[generate] failed:", err);
      error = err instanceof Error ? err.message.slice(0, 300) : "Unknown error";
    }
    const dirty = await store.finishGeneration(tripId, error);
    if (!dirty) break;
  }
}
