"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { parseMe, readJson, useMeRaw } from "@/lib/me";

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

const waLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

/** Two big buttons: send the link on WhatsApp, or copy it. `{link}` in the message becomes the URL. */
export function ShareButtons({ path, message, dark = false }: { path: string; message: string; dark?: boolean }) {
  const origin = useOrigin();
  const url = `${origin}${path}`;
  return (
    <div className="grid grid-cols-2 gap-2">
      <a
        className={`btn ${dark ? "bg-white text-indigo-900 hover:bg-violet-50" : "bg-[#25D366] text-white hover:brightness-95"}`}
        href={waLink(message.replaceAll("{link}", url))}
        target="_blank"
        rel="noopener noreferrer"
      >
        💬 Share on WhatsApp
      </a>
      <CopyButton
        text={url}
        label="🔗 Copy link"
        className={`btn ${dark ? "border border-white/30 bg-white/10 text-white hover:bg-white/20" : "border border-violet-200 bg-white text-violet-800 hover:bg-violet-50"}`}
      />
    </div>
  );
}

/** A WhatsApp-ready summary with copy + open-in-WhatsApp. */
export function ShareMessage({ template, path, title, sub }: { template: string; path: string; title: string; sub?: string }) {
  const origin = useOrigin();
  const text = template.replaceAll("{link}", `${origin}${path}`);
  return (
    <section className="card space-y-3">
      <div>
        <h2 className="font-display text-xl font-bold">{title}</h2>
        {sub && <p className="text-sm text-stone-500">{sub}</p>}
      </div>
      <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-2xl bg-stone-50 p-4 font-sans text-sm text-stone-700">{text}</pre>
      <div className="grid grid-cols-2 gap-2">
        <a className="btn bg-[#25D366] text-white hover:brightness-95" href={waLink(text)} target="_blank" rel="noopener noreferrer">
          💬 Send on WhatsApp
        </a>
        <CopyButton text={text} label="📋 Copy message" />
      </div>
    </section>
  );
}

export function YouBadge({ tripId, memberId }: { tripId: string; memberId: string }) {
  const me = parseMe(useMeRaw(tripId));
  if (me?.memberId !== memberId) return null;
  return <span className="ml-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-violet-700">you</span>;
}

interface VoteProps {
  tripId: string;
  targetId: string;
  yes: { id: string; name: string }[];
  no: { id: string; name: string }[];
  total: number;
  yesLabel: string;
  noLabel: string;
}

export function VoteBar({ tripId, targetId, yes, no, total, yesLabel, noLabel }: VoteProps) {
  const router = useRouter();
  const me = parseMe(useMeRaw(tripId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mine = me ? (yes.some((v) => v.id === me.memberId) ? "yes" : no.some((v) => v.id === me.memberId) ? "no" : null) : null;

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
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error ?? "Couldn't save your vote");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your vote");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {me ? (
          <>
            <button
              type="button"
              disabled={busy}
              aria-pressed={mine === "yes"}
              onClick={() => vote("yes")}
              className={`btn rounded-full px-4 py-2 text-sm ${mine === "yes" ? "bg-emerald-600 text-white" : "border border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-50"}`}
            >
              👍 {yesLabel}
            </button>
            <button
              type="button"
              disabled={busy}
              aria-pressed={mine === "no"}
              onClick={() => vote("no")}
              className={`btn rounded-full px-4 py-2 text-sm ${mine === "no" ? "bg-stone-700 text-white" : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"}`}
            >
              {noLabel}
            </button>
          </>
        ) : (
          <a href="#prefs" className="text-sm font-semibold text-violet-700 underline">Add your preferences to vote</a>
        )}
        <span className="text-sm text-stone-500">
          <strong className="text-emerald-700">{yes.length}</strong>/{total} agree
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
            const data = await readJson(res);
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
