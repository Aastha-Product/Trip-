/* ---------- Form vocabularies (shared by the form, validation and the AI prompt) ---------- */

export const HOME_CITIES = [
  "Delhi",
  "Gurugram",
  "Noida",
  "Mumbai",
  "Pune",
  "Bengaluru",
  "Hyderabad",
  "Chennai",
  "Kolkata",
  "Ahmedabad",
  "Jaipur",
  "Chandigarh",
  "Lucknow",
  "Indore",
  "Kochi",
] as const;

export const DESTINATION_TYPES = {
  beach: "🏖️ Beach",
  mountains: "🏔️ Mountains",
  valleys: "🌄 Valleys",
  city: "🌆 City",
  heritage: "🏰 Heritage",
  nature: "🐅 Nature / wildlife",
  offbeat: "🧭 Offbeat",
} as const;

export const DEALBREAKERS = {
  noFlights: "✈️ No flights",
  noOvernightBus: "🚌 No overnight buses",
  noTreks: "🥾 No treks",
  vegFood: "🥗 Needs vegetarian food",
  noParty: "🪩 No party trips",
  noCold: "🥶 No extreme cold",
  noHeat: "🥵 No extreme heat",
} as const;

export const VIBES = {
  relax: "😌 Relax",
  adventure: "🧗 Adventure",
  party: "🎉 Party",
  culture: "🛕 Culture",
  mix: "🎲 A bit of everything",
} as const;

export const PACES = { chill: "🐢 Chill", balanced: "⚖️ Balanced", packed: "⚡ Packed" } as const;

export const STAYS = { hostel: "🛏️ Hostel", hotel: "🏨 Mid-range hotel", villa: "🏡 Villa / homestay" } as const;

export const TRAVEL_CAPS = [4, 8, 12] as const; // hours one way; null = "any"

export type DestinationType = keyof typeof DESTINATION_TYPES;
export type Dealbreaker = keyof typeof DEALBREAKERS;
export type Vibe = keyof typeof VIBES;
export type Pace = keyof typeof PACES;
export type Stay = keyof typeof STAYS;

/* ---------- Stored records ---------- */

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;
}

export interface Trip {
  id: string;
  name: string;
  coordinator: string;
  adminKey: string;
  windowStart: string;
  windowEnd: string;
  expectedSize: number | null;
  /** Places the coordinator already has in mind (optional seed for the AI). */
  ideas: string;
  genState: "idle" | "running";
  genDirty: boolean;
  genStartedAt: string | null;
  genError: string | null;
  /** The decision, once the coordinator locks it in. */
  locked: { recId: string; planId: string | null; at: string } | null;
  createdAt: string;
}

export interface MemberPrefs {
  homeCity: string;
  dateRanges: DateRange[];
  lengthMin: number;
  lengthMax: number;
  budgetMin: number;
  budgetMax: number;
  /** Extra ₹ this person could stretch to if it gets the whole group there. */
  budgetStretch: number;
  /** Days they could join late or leave early. */
  dateFlex: number;
  /** One-way hours; null means "any, chalega". */
  maxTravelHours: number | null;
  dealbreakers: Dealbreaker[];
  dealbreakerOther: string;
  /** Ranked, favourite first. */
  destinationTypes: DestinationType[];
  vibe: Vibe | null;
  pace: Pace | null;
  stay: Stay | null;
  wishlist: string;
  notes: string;
}

export interface Member {
  id: string;
  tripId: string;
  name: string;
  editKey: string;
  prefs: MemberPrefs;
  createdAt: string;
  updatedAt: string;
}

export type PublicMember = Omit<Member, "editKey">;

export interface Vote {
  tripId: string;
  /** A recommendation id ("I'm in") or a plan id ("I'm OK with this"). */
  targetId: string;
  memberId: string;
  value: "yes" | "no";
  updatedAt: string;
}

/* ---------- Generated results ---------- */

export interface GroupSnapshot {
  memberCount: number;
  expectedSize: number | null;
  bestWindow: { from: string; to: string; days: number; worksFor: string[]; missing: string[] } | null;
  tripLength: { min: number; max: number; worksFor: number } | null;
  budgetBand: { min: number; max: number; worksFor: string[]; outside: string[] } | null;
  dealbreakers: { key: string; label: string; names: string[] }[];
}

export type PersonIssue = "dates" | "budget" | "travel" | "dealbreaker";

export interface PersonFit {
  memberId: string;
  name: string;
  /** 0–100 */
  score: number;
  mood: "love" | "happy" | "meh" | "out";
  reason: string;
  travelHours: number | null;
  canJoin: boolean;
  /** Code-verified problems, each with a short human label. Blockers mean they can't go as planned. */
  issues: { kind: PersonIssue; label: string; blocker: boolean }[];
}

export interface PlanCheck {
  worksFor: number;
  of: number;
  helps: string[];
  /** People who were fine before but this plan would lose. */
  hurts: string[];
  note: string;
}

export interface InclusionPlan {
  id: string;
  kind: "shift-dates" | "join-late" | "budget" | "travel" | "swap" | "other";
  title: string;
  forMemberIds: string[];
  forNames: string[];
  /** What everyone else has to accept. */
  askOfGroup: string;
  details: string;
  costImpact: string;
  newStartDate: string | null;
  newEndDate: string | null;
  newCostPerPerson: number | null;
  /** A different all-in price just for the people this plan is for (e.g. they take a hostel bed). */
  costForThem: number | null;
  check: PlanCheck | null;
}

export interface Recommendation {
  id: string;
  destination: string;
  region: string;
  startDate: string;
  endDate: string;
  days: number;
  costPerPerson: number;
  breakdown: { travel: number; stay: number; foodFun: number };
  pitch: string;
  pros: string[];
  cons: string[];
  people: PersonFit[];
  canJoinCount: number;
  avgScore: number;
  biggestCompromise: { name: string; reason: string } | null;
  plans: InclusionPlan[];
}

export interface Source {
  title: string;
  url: string;
}

export interface TripResult {
  tripId: string;
  createdAt: string;
  memberIds: string[];
  snapshot: GroupSnapshot;
  recommendations: Recommendation[];
  sources: Source[];
  changeNote: string | null;
}
