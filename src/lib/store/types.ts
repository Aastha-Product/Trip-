import type { Member, Trip, TripResult, Vote } from "../types";

export class DuplicateNameError extends Error {
  constructor(name: string) {
    super(`Someone already joined as "${name}". Use a different name, or edit from the device you joined on.`);
  }
}

/** A generation that has been "running" longer than this is assumed dead and can be reclaimed. */
export const STALE_GENERATION_MS = 5 * 60_000;

export type TripPatch = Partial<Pick<Trip, "genError" | "locked" | "genDirty">>;

export interface Store {
  createTrip(trip: Trip): Promise<void>;
  getTrip(id: string): Promise<Trip | null>;
  /** The most recently created trip's id, if any. */
  getLatestTripId(): Promise<string | null>;
  updateTrip(id: string, patch: TripPatch): Promise<void>;

  /** Atomically idle (or stale) → running, clearing the dirty flag. True if this caller won. */
  claimGeneration(id: string): Promise<boolean>;
  /** running → idle. Returns whether new input arrived meanwhile (dirty), so the caller should go again. */
  finishGeneration(id: string, error: string | null): Promise<boolean>;

  listMembers(tripId: string): Promise<Member[]>;
  /** Throws DuplicateNameError if the name is taken in this trip (case-insensitive). */
  addMember(member: Member): Promise<void>;
  /** Updates name + prefs when id and editKey match. Returns false if nothing matched. */
  updateMember(member: Member): Promise<boolean>;

  getResult(tripId: string): Promise<TripResult | null>;
  saveResult(result: TripResult): Promise<void>;

  listVotes(tripId: string): Promise<Vote[]>;
  setVote(vote: Vote): Promise<void>;
  clearVote(tripId: string, targetId: string, memberId: string): Promise<void>;
}
