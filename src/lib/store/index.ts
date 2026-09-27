import "server-only";
import { localStore } from "./local";
import { createSupabaseStore } from "./supabase";
import type { Store } from "./types";

export { DuplicateNameError } from "./types";
export type { Store } from "./types";

let store: Store | undefined;

export function getStore(): Store {
  if (store) return store;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    store = createSupabaseStore(url, key);
  } else if (process.env.VERCEL) {
    throw new Error("Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  } else {
    store = localStore;
  }
  return store;
}

export const storageMode = () =>
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? "supabase" : "local";
