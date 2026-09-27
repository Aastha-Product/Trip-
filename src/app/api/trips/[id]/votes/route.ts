import { isUuid, safeEqual } from "@/lib/ids";
import { getStore } from "@/lib/store";
import { firstIssue, voteInput } from "@/lib/validation";

/** "I'm in" on a recommendation, or "I'm OK with this" on an inclusion plan. */
export async function POST(request: Request, ctx: RouteContext<"/api/trips/[id]/votes">) {
  const { id: tripId } = await ctx.params;
  if (!isUuid(tripId)) return Response.json({ error: "Trip not found" }, { status: 404 });

  const parsed = voteInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: firstIssue(parsed.error) }, { status: 400 });
  const { memberId, editKey, targetId, value } = parsed.data;

  const store = getStore();
  const members = await store.listMembers(tripId);
  const me = members.find((m) => m.id === memberId);
  if (!me || !safeEqual(me.editKey, editKey)) {
    return Response.json({ error: "Join the plan first to vote." }, { status: 403 });
  }

  const result = await store.getResult(tripId);
  const exists = result?.recommendations.some((r) => r.id === targetId || r.plans.some((p) => p.id === targetId));
  if (!exists) return Response.json({ error: "That option is no longer on the table." }, { status: 404 });

  if (value === "clear") await store.clearVote(tripId, targetId, memberId);
  else await store.setVote({ tripId, targetId, memberId, value, updatedAt: new Date().toISOString() });
  return Response.json({ ok: true });
}
