import { withErrors } from "@/lib/api";
import { after } from "next/server";
import { MIN_MEMBERS, requestGeneration } from "@/lib/generate";
import { isUuid, safeEqual } from "@/lib/ids";
import { getStore } from "@/lib/store";
import { adminInput, firstIssue } from "@/lib/validation";

export const maxDuration = 300;

/** Coordinator-only actions: regenerate, lock the decision, unlock. */
export const POST = withErrors(async (request: Request, ctx: RouteContext<"/api/trips/[id]/admin">) => {
  const { id: tripId } = await ctx.params;
  const store = getStore();
  const trip = isUuid(tripId) ? await store.getTrip(tripId) : null;
  if (!trip || !safeEqual(request.headers.get("x-admin-key") ?? "", trip.adminKey)) {
    return Response.json({ error: "Not allowed" }, { status: 403 });
  }

  const parsed = adminInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: firstIssue(parsed.error) }, { status: 400 });
  const input = parsed.data;

  if (input.action === "regenerate") {
    if ((await store.listMembers(tripId)).length < MIN_MEMBERS) {
      return Response.json({ error: `Need at least ${MIN_MEMBERS} people first.` }, { status: 409 });
    }
    after(() => requestGeneration(tripId));
    return Response.json({ ok: true });
  }

  if (input.action === "unlock") {
    await store.updateTrip(tripId, { locked: null });
    return Response.json({ ok: true });
  }

  const result = await store.getResult(tripId);
  const rec = result?.recommendations.find((r) => r.id === input.recId);
  if (!rec || (input.planId && !rec.plans.some((p) => p.id === input.planId))) {
    return Response.json({ error: "That option is no longer on the table." }, { status: 404 });
  }
  await store.updateTrip(tripId, { locked: { recId: rec.id, planId: input.planId, at: new Date().toISOString() } });
  return Response.json({ ok: true });
});
