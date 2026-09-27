import type { Metadata } from "next";
import { JoinWizard } from "@/components/JoinWizard";
import { loadTrip } from "@/lib/trip-data";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/t/[id]/join">): Promise<Metadata> {
  const { id } = await props.params;
  const { trip } = await loadTrip(id);
  return { title: `Join ${trip.name} · Plan Pakka`, referrer: "no-referrer" };
}

export default async function JoinPage(props: PageProps<"/t/[id]/join">) {
  const { id } = await props.params;
  const { trip } = await loadTrip(id);
  return <JoinWizard tripId={trip.id} tripName={trip.name} windowStart={trip.windowStart} windowEnd={trip.windowEnd} />;
}
