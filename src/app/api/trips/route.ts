import { newId, newSecret } from "@/lib/ids";
import { getStore } from "@/lib/store";
import type { Trip } from "@/lib/types";
import { createTripInput, firstIssue } from "@/lib/validation";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createTripInput.safeParse(body);
  if (!parsed.success) return Response.json({ error: firstIssue(parsed.error) }, { status: 400 });

  const input = parsed.data;
  const trip: Trip = {
    id: newId(),
    name: input.name,
    coordinator: input.coordinator,
    adminKey: newSecret(),
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    expectedSize: input.expectedSize ?? null,
    ideas: input.ideas,
    genState: "idle",
    genDirty: false,
    genStartedAt: null,
    genError: null,
    locked: null,
    createdAt: new Date().toISOString(),
  };
  await getStore().createTrip(trip);
  return Response.json({ id: trip.id, adminKey: trip.adminKey }, { status: 201 });
}
