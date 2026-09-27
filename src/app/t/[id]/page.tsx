import type { Metadata } from "next";
import { TripBody } from "@/components/TripBody";
import { loadTrip } from "@/lib/trip-data";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/t/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const { trip } = await loadTrip(id);
  return {
    title: `${trip.name} · ${trip.coordinator} is planning a trip`,
    description: "Add your preferences in a minute and see which trips work for the whole group.",
    referrer: "no-referrer",
  };
}

/** The one link everyone gets: add your preferences, see the trips, vote. */
export default async function TripPage(props: PageProps<"/t/[id]">) {
  const { id } = await props.params;
  return <TripBody data={await loadTrip(id)} />;
}
