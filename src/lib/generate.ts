import "server-only";
import { recommend } from "./ai";
import { changeNote, computeSnapshot } from "./analysis";
import { getStore } from "./store";

/** Recommendations need at least this many people to be meaningful. */
export const MIN_MEMBERS = 2;

/**
 * A short, safe reason to show on the trip page. Raw errors can contain request
 * headers (API keys!), so they only ever go to the server log.
 */
function publicReason(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/API_KEY missing/.test(msg)) return "the AI key isn't set up";
  if (/credit|insufficient_quota|billing/i.test(msg)) return "the AI account has no credits";
  if (/API key|header|401|403|PERMISSION/i.test(msg)) return "the AI key was rejected";
  if (/429|quota|RESOURCE_EXHAUSTED/i.test(msg)) return "the AI is busy right now";
  if (/timeout|timed out|ETIMEDOUT|aborted/i.test(msg)) return "the AI took too long";
  return "the AI hit a temporary problem";
}

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
      error = publicReason(err);
    }
    const dirty = await store.finishGeneration(tripId, error);
    if (!dirty) break;
  }
}
