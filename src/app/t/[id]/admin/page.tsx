import type { Metadata } from "next";
import Link from "next/link";
import { AdminButton } from "@/components/client";
import { TripBody } from "@/components/TripBody";
import { safeEqual } from "@/lib/ids";
import { storageMode } from "@/lib/store";
import { loadTrip } from "@/lib/trip-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your trip · Plan Pakka",
  referrer: "no-referrer",
  robots: { index: false },
};

/** The organiser's copy of the trip page, plus a few extra buttons. */
export default async function AdminPage(props: PageProps<"/t/[id]/admin">) {
  const { id } = await props.params;
  const { key } = await props.searchParams;
  const data = await loadTrip(id);
  const { trip, adminKey } = data;

  if (typeof key !== "string" || !safeEqual(key, adminKey)) {
    return (
      <div className="card mx-auto max-w-md space-y-3 text-center">
        <h1 className="font-display text-xl font-bold">This is the organiser&apos;s link</h1>
        <p className="text-sm text-stone-600">Open the trip page to add your preferences.</p>
        <Link href={`/t/${trip.id}`} className="btn-primary">Go to the trip</Link>
      </div>
    );
  }

  const tools = (
    <section className="card space-y-3 border-violet-200">
      <div>
        <p className="font-display text-lg font-bold">👋 {trip.coordinator}, this is your organiser page</p>
        <p className="text-sm text-stone-600">
          Bookmark it. Share the link above in your WhatsApp group, add your own preferences below, and lock in the
          final trip when you&apos;re ready.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <AdminButton tripId={trip.id} adminKey={adminKey} body={{ action: "regenerate" }} label="🔄 Refresh trip ideas" />
        {trip.locked && <AdminButton tripId={trip.id} adminKey={adminKey} body={{ action: "unlock" }} label="Undo decision" />}
      </div>
      {storageMode() === "local" && <p className="text-xs text-amber-700">Dev mode: data saved to .data/db.json.</p>}
    </section>
  );

  return (
    <TripBody
      data={data}
      coordinatorTools={tools}
      adminSlot={(rec) => (
        <div className="flex flex-wrap gap-2 rounded-2xl border border-dashed border-violet-200 p-3">
          <span className="w-full text-xs font-semibold uppercase tracking-wide text-violet-700">Organiser only</span>
          <AdminButton
            tripId={trip.id}
            adminKey={adminKey}
            body={{ action: "lock", recId: rec.id, planId: null }}
            label={`🔒 Lock in ${rec.destination}`}
            className="btn-primary py-2 text-sm"
            confirm={`Lock in ${rec.destination} as the final trip?`}
          />
          {rec.plans.map((pl) => (
            <AdminButton
              key={pl.id}
              tripId={trip.id}
              adminKey={adminKey}
              body={{ action: "lock", recId: rec.id, planId: pl.id }}
              label={`🔒 Lock in with “${pl.title}”`}
              className="btn-secondary py-2 text-sm"
              confirm={`Lock in ${rec.destination} with “${pl.title}”?`}
            />
          ))}
        </div>
      )}
    />
  );
}
