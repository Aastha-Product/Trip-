import "server-only";
import { notFound } from "next/navigation";
import { computeSnapshot } from "./analysis";
import { isUuid } from "./ids";
import { getStore } from "./store";
import type { PublicMember } from "./types";

/** Loads everything the trip pages need, with secrets stripped. */
export async function loadTrip(id: string) {
  if (!isUuid(id)) notFound();
  const store = getStore();
  const trip = await store.getTrip(id);
  if (!trip) notFound();
  const [members, result, votes] = await Promise.all([
    store.listMembers(id),
    store.getResult(id),
    store.listVotes(id),
  ]);
  const publicMembers: PublicMember[] = members.map(({ editKey: _k, ...m }) => m);
  const { adminKey: _a, ...publicTrip } = trip;
  return {
    trip: publicTrip,
    adminKey: trip.adminKey,
    members: publicMembers,
    result,
    votes,
    snapshot: computeSnapshot(trip, members),
  };
}

export type TripData = Awaited<ReturnType<typeof loadTrip>>;
