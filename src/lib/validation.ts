import { z } from "zod";
import { DEALBREAKERS, DESTINATION_TYPES, PACES, STAYS, VIBES } from "./types";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Dates must be YYYY-MM-DD");

const money = (what: string) =>
  z.coerce
    .number({ error: `${what} must be a number` })
    .int(`${what} must be a whole number`)
    .min(0, `${what} can't be negative`)
    .max(10_000_000, `${what} looks too high`);

const text = (max: number) => z.string().trim().max(max);

const keys = <T extends Record<string, string>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

export const createTripInput = z
  .object({
    name: text(80).min(1, "Name the trip"),
    coordinator: text(40).min(1, "Add your name"),
    windowStart: isoDate,
    windowEnd: isoDate,
    expectedSize: z.coerce.number().int().min(2).max(30).nullish().or(z.literal("").transform(() => null)),
    ideas: text(500).default(""),
  })
  .refine((t) => t.windowStart <= t.windowEnd, { message: "The window must end after it starts", path: ["windowEnd"] });

export const prefsInput = z
  .object({
    homeCity: text(60).min(1, "Pick your home city"),
    dateRanges: z
      .array(
        z.object({ from: isoDate, to: isoDate }).refine((r) => r.from <= r.to, "Each date range must end after it starts"),
      )
      .min(1, "Add at least one date range when you're free")
      .max(5),
    lengthMin: z.coerce.number().int().min(1).max(30),
    lengthMax: z.coerce.number().int().min(1).max(30),
    budgetMin: money("Minimum budget"),
    budgetMax: money("Maximum budget"),
    budgetStretch: money("Budget stretch").default(0),
    dateFlex: z.coerce.number().int().min(0).max(5).default(0),
    maxTravelHours: z.coerce.number().int().min(1).max(48).nullable().default(null),
    dealbreakers: z.array(z.enum(keys(DEALBREAKERS))).max(10).default([]),
    dealbreakerOther: text(200).default(""),
    destinationTypes: z.array(z.enum(keys(DESTINATION_TYPES))).max(10).default([]),
    vibe: z.enum(keys(VIBES)).nullable().default(null),
    pace: z.enum(keys(PACES)).nullable().default(null),
    stay: z.enum(keys(STAYS)).nullable().default(null),
    wishlist: text(500).default(""),
    notes: text(500).default(""),
  })
  .refine((p) => p.lengthMin <= p.lengthMax, { message: "Min days can't be more than max days", path: ["lengthMax"] })
  .refine((p) => p.budgetMin <= p.budgetMax, { message: "Minimum budget can't be above maximum", path: ["budgetMax"] });

export const memberInput = z.object({
  name: text(40).min(1, "Add your name"),
  prefs: prefsInput,
  memberId: z.string().uuid().optional(),
  editKey: z.string().max(100).optional(),
});

export const voteInput = z.object({
  memberId: z.string().uuid(),
  editKey: z.string().min(1).max(100),
  targetId: z.string().min(1).max(200),
  value: z.enum(["yes", "no", "clear"]),
});

export const adminInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("regenerate") }),
  z.object({ action: z.literal("lock"), recId: z.string().min(1).max(200), planId: z.string().max(200).nullable().default(null) }),
  z.object({ action: z.literal("unlock") }),
]);

export type CreateTripInput = z.infer<typeof createTripInput>;
export type PrefsInput = z.infer<typeof prefsInput>;

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}
