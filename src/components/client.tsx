"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { parseMe, useMeRaw } from "@/lib/me";

const noopSubscribe = () => () => {};

/** Re-fetches server data on an interval (faster while the AI is working). */
export function AutoRefresh({ every }: { every: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), every);
    return () => clearInterval(id);
  }, [router, every]);
  return null;
}

export function useOrigin() {
  return useSyncExternalStore(noopSubscribe, () => window.location.origin, () => "");
}

export function CopyButton({ text, label, className = "btn-secondary" }: { text: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {}
      }}
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}

/** A WhatsApp-ready message with copy + open-in-WhatsApp. `{link}` is replaced with the absolute URL. */
export function ShareMessage({ template, path, title, sub }: { template: string; path: string; title: string; sub?: string }) {
  const origin = useOrigin();
  const text = template.replaceAll("{link}", `${origin}${path}`);
  return (
    <div className="card space-y-3 border-emerald-200">
      <div>
        <h2 className="font-display text-xl font-bold">{title}</h2>
        {sub && <p className="text-sm text-stone-600">{sub}</p>}
      </div>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-2xl bg-emerald-50 p-4 font-sans text-sm text-stone-800">{text}</pre>
      <div className="grid grid-cols-2 gap-3">
        <CopyButton text={text} label="📋 Copy message" className="btn-secondary py-3" />
        <a
          className="btn py-3 bg-[#25D366] text-white hover:brightness-95"
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open in WhatsApp
        </a>
      </div>
    </div>
  );
}

export function TripCode({ path }: { path: string }) {
  const origin = useOrigin();
  return <CopyButton text={`${origin}${path}`} label="🔗 Copy link" className="btn-secondary py-3 text-base" />;
}

/** "Join the plan" for newcomers, "Edit my answers" for people who joined on this device. */
export function JoinCta({ tripId, full = false }: { tripId: string; full?: boolean }) {
  const me = parseMe(useMeRaw(tripId));
  return (
    <Link href={`/t/${tripId}/join`} className={`btn-primary py-3 text-base ${full ? "w-full" : ""}`}>
      {me ? `✏️ Edit my answers (${me.name})` : "➕ Join the plan"}
    </Link>
  );
}

export function YouBadge({ tripId, memberId }: { tripId: string; memberId: string }) {
  const me = parseMe(useMeRaw(tripId));
  if (me?.memberId !== memberId) return null;
  return <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-orange-700">you</span>;
}

interface VoteProps {
  tripId: string;
  targetId: string;
  yes: { id: string; name: string }[];
  no: { id: string; name: string }[];
  total: number;
  yesLabel: string;
  noLabel: string;
  /** Names of people this is about, e.g. the person a plan includes. */
  compact?: boolean;
}

export function VoteBar({ tripId, targetId, yes, no, total, yesLabel, noLabel, compact }: VoteProps) {
  const router = useRouter();
  const me = parseMe(useMeRaw(tripId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mine = me ? (yes.some((v) => v.id === me.memberId) ? "yes" : no.some((v) => v.id === me.memberId) ? "no" : null) : null;
  const waiting = total - yes.length - no.length;

  async function vote(value: "yes" | "no") {
    if (!me) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/votes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId: me.memberId, editKey: me.editKey, targetId, value: mine === value ? "clear" : value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save your vote");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your vote");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : ""}`}>
        {me ? (
          <>
            <button
              type="button"
              disabled={busy}
              aria-pressed={mine === "yes"}
              onClick={() => vote("yes")}
              className={`btn rounded-full px-4 ${mine === "yes" ? "bg-emerald-600 text-white" : "border border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-50"}`}
            >
              👍 {yesLabel}
            </button>
            <button
              type="button"
              disabled={busy}
              aria-pressed={mine === "no"}
              onClick={() => vote("no")}
              className={`btn rounded-full px-4 ${mine === "no" ? "bg-stone-700 text-white" : "border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"}`}
            >
              {noLabel}
            </button>
          </>
        ) : (
          <Link href={`/t/${tripId}/join`} className="text-sm font-semibold text-orange-700 underline">
            Join the plan to vote
          </Link>
        )}
        <span className="text-sm text-stone-600">
          <strong className="text-emerald-700">{yes.length}</strong> of {total} OK
          {no.length > 0 && <> · {no.length} not</>}
          {waiting > 0 && <> · waiting on {waiting}</>}
        </span>
      </div>
      {(yes.length > 0 || no.length > 0) && (
        <p className="text-xs text-stone-500">
          {yes.length > 0 && <>👍 {yes.map((v) => v.name).join(", ")}</>}
          {yes.length > 0 && no.length > 0 && " · "}
          {no.length > 0 && <>✋ {no.map((v) => v.name).join(", ")}</>}
        </p>
      )}
      {error && <p className="text-sm text-rose-700">{error}</p>}
    </div>
  );
}

export function AdminButton({
  tripId,
  adminKey,
  body,
  label,
  className = "btn-secondary",
  confirm,
}: {
  tripId: string;
  adminKey: string;
  body: Record<string, unknown>;
  label: string;
  className?: string;
  confirm?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        className={className}
        disabled={busy}
        onClick={async () => {
          if (confirm && !window.confirm(confirm)) return;
          setBusy(true);
          setError(null);
          try {
            const res = await fetch(`/api/trips/${tripId}/admin`, {
              method: "POST",
              headers: { "content-type": "application/json", "x-admin-key": adminKey },
              body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Something went wrong");
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Working…" : label}
      </button>
      {error && <span className="text-xs text-rose-700">{error}</span>}
    </span>
  );
}
