import { after } from "next/server";
import { requestGeneration } from "@/lib/generate";
import { isUuid, newId, newSecret } from "@/lib/ids";
import { DuplicateNameError, getStore } from "@/lib/store";
import type { Member } from "@/lib/types";
import { firstIssue, memberInput } from "@/lib/validation";

// The AI run happens in after(); give it room on Vercel.
export const maxDuration = 300;

/** Join the plan (or, with memberId + editKey, update your answers). */
export async function POST(request: Request, ctx: RouteContext<"/api/trips/[id]/members">) {
  const { id: tripId } = await ctx.params;
  const store = getStore();
  const trip = isUuid(tripId) ? await store.getTrip(tripId) : null;
  if (!trip) return Response.json({ error: "Trip not found" }, { status: 404 });

  const parsed = memberInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: firstIssue(parsed.error) }, { status: 400 });
  const { name, prefs, memberId, editKey } = parsed.data;

  for (const r of prefs.dateRanges) {
    if (r.to < trip.windowStart || r.from > trip.windowEnd) {
      return Response.json({ error: "Each date range must overlap the trip window" }, { status: 400 });
    }
  }

  const now = new Date().toISOString();
  const isUpdate = Boolean(memberId && editKey);
  const member: Member = {
    id: isUpdate ? memberId! : newId(),
    tripId,
    name,
    editKey: isUpdate ? editKey! : newSecret(),
    prefs,
    createdAt: now,
    updatedAt: now,
  };

  try {
    if (isUpdate) {
      if (!(await store.updateMember(member))) {
        return Response.json({ error: "Couldn't find your earlier answers to edit." }, { status: 404 });
      }
    } else {
      await store.addMember(member);
    }
  } catch (err) {
    if (err instanceof DuplicateNameError) return Response.json({ error: err.message }, { status: 409 });
    throw err;
  }

  after(() => requestGeneration(tripId));

  return Response.json({ memberId: member.id, editKey: member.editKey }, { status: isUpdate ? 200 : 201 });
}
