import type { Metadata } from "next";
import { JoinCta, TripCode } from "@/components/client";
import { TripBody } from "@/components/TripBody";
import { formatDateRange } from "@/lib/format";
import { loadTrip } from "@/lib/trip-data";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/t/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const { trip } = await loadTrip(id);
  return { title: `${trip.name} · Plan Pakka`, referrer: "no-referrer" };
}

/** The one link everyone opens: join, see where you stand, vote. */
export default async function TripPage(props: PageProps<"/t/[id]">) {
  const { id } = await props.params;
  const { joined } = await props.searchParams;
  const data = await loadTrip(id);
  const { trip } = data;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-stone-900">{trip.name}</h1>
        <p className="text-stone-600">
          Organised by {trip.coordinator} · anytime {formatDateRange(trip.windowStart, trip.windowEnd)}
        </p>
        {joined && (
          <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-900" role="status">
            🎉 You&apos;re in! The recommendations update for your answers in about a minute.
          </p>
        )}
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <JoinCta tripId={trip.id} full />
          <TripCode path={`/t/${trip.id}`} />
        </div>
      </section>

      <TripBody data={data} />
    </div>
  );
}
