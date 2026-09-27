import type { Metadata } from "next";
import Link from "next/link";
import { AdminButton, JoinCta, ShareMessage } from "@/components/client";
import { TripBody } from "@/components/TripBody";
import { safeEqual } from "@/lib/ids";
import { storageMode } from "@/lib/store";
import { loadTrip } from "@/lib/trip-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Coordinator · Plan Pakka",
  referrer: "no-referrer",
  robots: { index: false },
};

/** Riya's view: invite and nudge, watch it come together, retry, lock the decision. */
export default async function AdminPage(props: PageProps<"/t/[id]/admin">) {
  const { id } = await props.params;
  const { key } = await props.searchParams;
  const data = await loadTrip(id);
  const { trip, adminKey, members } = data;

  if (typeof key !== "string" || !safeEqual(key, adminKey)) {
    return (
      <div className="card mx-auto max-w-md space-y-3 text-center">
        <h1 className="font-display text-xl font-bold">Coordinator link needed</h1>
        <p className="text-sm text-stone-600">This page needs the private link you got when you created the trip.</p>
        <Link href={`/t/${trip.id}`} className="btn-secondary">Go to the trip page</Link>
      </div>
    );
  }

  const waiting = trip.expectedSize ? Math.max(0, trip.expectedSize - members.length) : 0;
  const invite = [
    `🧳 *${trip.name}*: let's actually make this trip happen!`,
    "",
    "Fill in your budget, dates and dealbreakers (takes 3 mins). Then we all see the 3 trips that work best for everyone:",
    "{link}",
  ].join("\n");
  const nudge = [
    `⏰ ${members.length}${trip.expectedSize ? ` of ${trip.expectedSize}` : ""} of us have filled in the trip form${members.length ? ` (${members.map((m) => m.name).join(", ")})` : ""}.`,
    waiting > 0 ? `Waiting on ${waiting} more. The plan only works if everyone's in! 🙏` : "Everyone's in! Check where you stand and vote 👇",
    "{link}",
  ].join("\n");

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <p className="text-sm font-semibold text-orange-600">Coordinator view · keep this link private</p>
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-stone-900">{trip.name}</h1>
        <div className="flex flex-wrap gap-3 pt-1">
          <JoinCta tripId={trip.id} />
          <Link href={`/t/${trip.id}`} className="btn-secondary py-3 text-base">View as the group sees it</Link>
          <AdminButton tripId={trip.id} adminKey={adminKey} body={{ action: "regenerate" }} label="🔄 Refresh recommendations" className="btn-secondary py-3 text-base" />
          {trip.locked && (
            <AdminButton tripId={trip.id} adminKey={adminKey} body={{ action: "unlock" }} label="Unlock decision" className="btn-secondary py-3 text-base" />
          )}
        </div>
        {storageMode() === "local" && (
          <p className="text-xs text-amber-700">Dev mode: data is saved to .data/db.json, not Supabase.</p>
        )}
      </section>

      <ShareMessage
        title={members.length === 0 ? "1 · Invite the group" : "Nudge the group"}
        sub={members.length === 0 ? "Fill in yours too; you're part of the group." : "Paste this in the WhatsApp group to chase the last few."}
        path={`/t/${trip.id}`}
        template={members.length === 0 ? invite : nudge}
      />

      <TripBody
        data={data}
        adminSlot={(rec) => (
          <div className="flex flex-wrap gap-2 rounded-2xl bg-stone-50 p-3">
            <span className="w-full text-xs font-semibold uppercase tracking-wide text-stone-500">Coordinator</span>
            <AdminButton
              tripId={trip.id}
              adminKey={adminKey}
              body={{ action: "lock", recId: rec.id, planId: null }}
              label={`🔒 Lock in ${rec.destination}`}
              className="btn-primary"
              confirm={`Lock in ${rec.destination} as the group's decision?`}
            />
            {rec.plans.map((pl) => (
              <AdminButton
                key={pl.id}
                tripId={trip.id}
                adminKey={adminKey}
                body={{ action: "lock", recId: rec.id, planId: pl.id }}
                label={`🔒 Lock in with “${pl.title}”`}
                confirm={`Lock in ${rec.destination} with the plan “${pl.title}”?`}
              />
            ))}
          </div>
        )}
      />
    </div>
  );
}
