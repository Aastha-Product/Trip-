import { redirect } from "next/navigation";
import { isUuid } from "@/lib/ids";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * The site's main link is for one group: it opens that group's trip (the
 * preferences page) directly. MAIN_TRIP_ID pins a specific trip; otherwise it's
 * the most recently created one. Starting another trip lives at /new.
 */
export default async function Home() {
  let tripId: string | null = null;
  try {
    const pinned = process.env.MAIN_TRIP_ID?.trim();
    tripId = pinned && isUuid(pinned) && (await getStore().getTrip(pinned)) ? pinned : await getStore().getLatestTripId();
  } catch (err) {
    console.error("[home] couldn't find the main trip:", err);
  }
  redirect(tripId ? `/t/${tripId}` : "/new");
}
