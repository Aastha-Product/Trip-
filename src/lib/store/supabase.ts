import { createClient } from "@supabase/supabase-js";
import type { Member, MemberPrefs, Trip, TripResult, Vote } from "../types";
import { DuplicateNameError, STALE_GENERATION_MS, type Store } from "./types";

/* Row shapes as stored in Postgres (see supabase/schema.sql). */
interface TripRow {
  id: string;
  name: string;
  coordinator: string;
  admin_key: string;
  window_start: string;
  window_end: string;
  expected_size: number | null;
  ideas: string;
  gen_state: Trip["genState"];
  gen_dirty: boolean;
  gen_started_at: string | null;
  gen_error: string | null;
  locked: Trip["locked"];
  created_at: string;
}
interface MemberRow {
  id: string;
  trip_id: string;
  name: string;
  edit_key: string;
  prefs: MemberPrefs;
  created_at: string;
  updated_at: string;
}
interface ResultRow {
  trip_id: string;
  payload: TripResult;
  created_at: string;
}
interface VoteRow {
  trip_id: string;
  target_id: string;
  member_id: string;
  value: Vote["value"];
  updated_at: string;
}

const UNIQUE_VIOLATION = "23505";

const toTrip = (r: TripRow): Trip => ({
  id: r.id,
  name: r.name,
  coordinator: r.coordinator,
  adminKey: r.admin_key,
  windowStart: r.window_start,
  windowEnd: r.window_end,
  expectedSize: r.expected_size,
  ideas: r.ideas,
  genState: r.gen_state,
  genDirty: r.gen_dirty,
  genStartedAt: r.gen_started_at,
  genError: r.gen_error,
  locked: r.locked,
  createdAt: r.created_at,
});

const toMember = (r: MemberRow): Member => ({
  id: r.id,
  tripId: r.trip_id,
  name: r.name,
  editKey: r.edit_key,
  prefs: r.prefs,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  return res.data;
}

export function createSupabaseStore(url: string, serviceKey: string): Store {
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  return {
    async createTrip(t) {
      check(
        await db.from("trips").insert({
          id: t.id,
          name: t.name,
          coordinator: t.coordinator,
          admin_key: t.adminKey,
          window_start: t.windowStart,
          window_end: t.windowEnd,
          expected_size: t.expectedSize,
          ideas: t.ideas,
          gen_state: t.genState,
          gen_dirty: t.genDirty,
          gen_started_at: t.genStartedAt,
          gen_error: t.genError,
          locked: t.locked,
          created_at: t.createdAt,
        } satisfies TripRow),
      );
    },

    async getTrip(id) {
      const row = check(await db.from("trips").select("*").eq("id", id).maybeSingle<TripRow>());
      return row ? toTrip(row) : null;
    },

    async updateTrip(id, patch) {
      const row: Partial<TripRow> = {};
      if ("genError" in patch) row.gen_error = patch.genError ?? null;
      if ("locked" in patch) row.locked = patch.locked ?? null;
      if ("genDirty" in patch) row.gen_dirty = Boolean(patch.genDirty);
      check(await db.from("trips").update(row).eq("id", id));
    },

    async claimGeneration(id) {
      const staleBefore = new Date(Date.now() - STALE_GENERATION_MS).toISOString();
      const won = check(
        await db
          .from("trips")
          .update({ gen_state: "running", gen_dirty: false, gen_started_at: new Date().toISOString() })
          .eq("id", id)
          .or(`gen_state.eq.idle,gen_started_at.lt.${staleBefore}`)
          .select("id"),
      );
      if (won && won.length > 0) return true;
      // Someone else is generating: leave a note so they go again with the new input.
      check(await db.from("trips").update({ gen_dirty: true }).eq("id", id));
      return false;
    },

    async finishGeneration(id, error) {
      const rows = check(
        await db
          .from("trips")
          .update({ gen_state: "idle", gen_error: error, gen_started_at: null })
          .eq("id", id)
          .select("gen_dirty"),
      );
      return Boolean(rows?.[0]?.gen_dirty);
    },

    async listMembers(tripId) {
      const rows = check(
        await db.from("members").select("*").eq("trip_id", tripId).order("created_at").returns<MemberRow[]>(),
      );
      return (rows ?? []).map(toMember);
    },

    async addMember(m) {
      const res = await db.from("members").insert({
        id: m.id,
        trip_id: m.tripId,
        name: m.name,
        edit_key: m.editKey,
        prefs: m.prefs,
        created_at: m.createdAt,
        updated_at: m.updatedAt,
      } satisfies MemberRow);
      if (res.error?.code === UNIQUE_VIOLATION) throw new DuplicateNameError(m.name);
      check(res);
    },

    async updateMember(m) {
      const res = await db
        .from("members")
        .update({ name: m.name, prefs: m.prefs, updated_at: m.updatedAt })
        .eq("id", m.id)
        .eq("trip_id", m.tripId)
        .eq("edit_key", m.editKey)
        .select("id");
      if (res.error?.code === UNIQUE_VIOLATION) throw new DuplicateNameError(m.name);
      return (check(res) ?? []).length > 0;
    },

    async getResult(tripId) {
      const row = check(await db.from("results").select("*").eq("trip_id", tripId).maybeSingle<ResultRow>());
      return row ? row.payload : null;
    },

    async saveResult(result) {
      check(
        await db
          .from("results")
          .upsert({ trip_id: result.tripId, payload: result, created_at: result.createdAt } satisfies ResultRow),
      );
    },

    async listVotes(tripId) {
      const rows = check(await db.from("votes").select("*").eq("trip_id", tripId).returns<VoteRow[]>());
      return (rows ?? []).map((r) => ({
        tripId: r.trip_id,
        targetId: r.target_id,
        memberId: r.member_id,
        value: r.value,
        updatedAt: r.updated_at,
      }));
    },

    async setVote(v) {
      check(
        await db.from("votes").upsert({
          trip_id: v.tripId,
          target_id: v.targetId,
          member_id: v.memberId,
          value: v.value,
          updated_at: v.updatedAt,
        } satisfies VoteRow),
      );
    },

    async clearVote(tripId, targetId, memberId) {
      check(
        await db.from("votes").delete().eq("trip_id", tripId).eq("target_id", targetId).eq("member_id", memberId),
      );
    },
  };
}
