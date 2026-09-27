import type { PersonFit } from "./types";

export const formatINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

/** ₹10k, ₹12.5k, ₹1.2L */
export function formatShortINR(n: number) {
  if (n >= 100_000) return `₹${+(n / 100_000).toFixed(1)}L`;
  if (n >= 1000) return `₹${+(n / 1000).toFixed(1)}k`;
  return `₹${n}`;
}

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

export const formatDate = (d: string) => dateFmt.format(new Date(`${d}T00:00:00Z`));

export function formatDateRange(from: string | null, to: string | null): string {
  const f = from ? formatDate(from) : null;
  const t = to ? formatDate(to) : null;
  if (f && t) return f === t ? f : `${f} – ${t}`;
  return f ?? t ?? "Dates flexible";
}

export const MOOD_META: Record<PersonFit["mood"], { emoji: string; label: string; bar: string; text: string }> = {
  love: { emoji: "😍", label: "Loves it", bar: "bg-emerald-500", text: "text-emerald-700" },
  happy: { emoji: "🙂", label: "Happy", bar: "bg-amber-400", text: "text-amber-700" },
  meh: { emoji: "😐", label: "Compromising", bar: "bg-orange-400", text: "text-orange-700" },
  out: { emoji: "🚫", label: "Can't go as planned", bar: "bg-rose-400", text: "text-rose-700" },
};

export const initials = (name: string) => name.trim().charAt(0).toUpperCase() || "?";

const AVATAR_COLORS = [
  "bg-orange-500",
  "bg-teal-600",
  "bg-pink-600",
  "bg-violet-600",
  "bg-sky-600",
  "bg-amber-600",
  "bg-emerald-600",
  "bg-rose-600",
];

export function avatarColor(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
