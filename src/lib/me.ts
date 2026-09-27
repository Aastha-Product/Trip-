"use client";

import { useSyncExternalStore } from "react";
import type { MemberPrefs } from "./types";

/** This device's identity in a trip: lets people edit their answers and vote. */
export interface Me {
  memberId: string;
  editKey: string;
  name: string;
  prefs: MemberPrefs;
}

const key = (tripId: string) => `pp-member:${tripId}`;
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function readRaw(tripId: string): string | null {
  try {
    return localStorage.getItem(key(tripId));
  } catch {
    return null;
  }
}

export function saveMe(tripId: string, me: Me) {
  try {
    localStorage.setItem(key(tripId), JSON.stringify(me));
  } catch {}
  listeners.forEach((l) => l());
}

export function parseMe(raw: string | null): Me | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Me;
  } catch {
    return null;
  }
}

/** Returns the raw string (stable for useSyncExternalStore); parse with parseMe. */
export function useMeRaw(tripId: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => readRaw(tripId),
    () => null,
  );
}
