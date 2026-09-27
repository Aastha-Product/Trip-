import { promises as fs } from "fs";
import path from "path";
import type { Member, Trip, TripResult, Vote } from "../types";
import { DuplicateNameError, STALE_GENERATION_MS, type Store } from "./types";

/**
 * Dev-only JSON-file store so the app runs without Supabase credentials.
 * Vercel's filesystem is read-only, so production must use Supabase.
 */
interface Db {
  trips: Trip[];
  members: Member[];
  results: TripResult[];
  votes: Vote[];
}

const DB_PATH = path.join(process.cwd(), ".data", "db.json");

let queue: Promise<unknown> = Promise.resolve();

async function load(): Promise<Db> {
  try {
    return JSON.parse(await fs.readFile(DB_PATH, "utf8")) as Db;
  } catch {
    return { trips: [], members: [], results: [], votes: [] };
  }
}

async function save(db: Db) {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
}

/** Serialises read-modify-write cycles so concurrent requests don't clobber each other. */
function mutate<T>(fn: (db: Db) => T): Promise<T> {
  const run = queue.then(async () => {
    const db = await load();
    const out = fn(db);
    await save(db);
    return out;
  });
  queue = run.catch(() => undefined);
  return run;
}

async function read<T>(fn: (db: Db) => T): Promise<T> {
  await queue.catch(() => undefined);
  return fn(await load());
}

const nameTaken = (db: Db, m: Member) =>
  db.members.some((x) => x.tripId === m.tripId && x.id !== m.id && x.name.toLowerCase() === m.name.toLowerCase());

export const localStore: Store = {
  createTrip: (trip) => mutate((db) => void db.trips.push(trip)),

  getTrip: (id) => read((db) => db.trips.find((t) => t.id === id) ?? null),

  getLatestTripId: () =>
    read((db) => [...db.trips].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.id ?? null),

  updateTrip: (id, patch) =>
    mutate((db) => {
      const t = db.trips.find((x) => x.id === id);
      if (t) Object.assign(t, patch);
    }),

  claimGeneration: (id) =>
    mutate((db) => {
      const t = db.trips.find((x) => x.id === id);
      if (!t) return false;
      const stale = t.genStartedAt && Date.now() - Date.parse(t.genStartedAt) > STALE_GENERATION_MS;
      if (t.genState === "running" && !stale) {
        t.genDirty = true;
        return false;
      }
      t.genState = "running";
      t.genDirty = false;
      t.genStartedAt = new Date().toISOString();
      return true;
    }),

  finishGeneration: (id, error) =>
    mutate((db) => {
      const t = db.trips.find((x) => x.id === id);
      if (!t) return false;
      t.genState = "idle";
      t.genError = error;
      t.genStartedAt = null;
      return t.genDirty;
    }),

  listMembers: (tripId) =>
    read((db) => db.members.filter((m) => m.tripId === tripId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))),

  addMember: (member) =>
    mutate((db) => {
      if (nameTaken(db, member)) throw new DuplicateNameError(member.name);
      db.members.push(member);
    }),

  updateMember: (member) =>
    mutate((db) => {
      const i = db.members.findIndex(
        (m) => m.id === member.id && m.tripId === member.tripId && m.editKey === member.editKey,
      );
      if (i === -1) return false;
      if (nameTaken(db, member)) throw new DuplicateNameError(member.name);
      db.members[i] = { ...db.members[i], name: member.name, prefs: member.prefs, updatedAt: member.updatedAt };
      return true;
    }),

  getResult: (tripId) => read((db) => db.results.find((r) => r.tripId === tripId) ?? null),

  saveResult: (result) =>
    mutate((db) => {
      db.results = db.results.filter((r) => r.tripId !== result.tripId);
      db.results.push(result);
    }),

  listVotes: (tripId) => read((db) => db.votes.filter((v) => v.tripId === tripId)),

  setVote: (vote) =>
    mutate((db) => {
      db.votes = db.votes.filter(
        (v) => !(v.tripId === vote.tripId && v.targetId === vote.targetId && v.memberId === vote.memberId),
      );
      db.votes.push(vote);
    }),

  clearVote: (tripId, targetId, memberId) =>
    mutate((db) => {
      db.votes = db.votes.filter((v) => !(v.tripId === tripId && v.targetId === targetId && v.memberId === memberId));
    }),
};
