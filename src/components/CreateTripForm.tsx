"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { readJson } from "@/lib/me";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const inDays = (n: number) => iso(new Date(Date.now() + n * 86_400_000));

export function CreateTripForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [coordinator, setCoordinator] = useState("");
  const [windowStart, setWindowStart] = useState(inDays(7));
  const [windowEnd, setWindowEnd] = useState(inDays(97));
  const [expectedSize, setExpectedSize] = useState("5");
  const [ideas, setIdeas] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, coordinator, windowStart, windowEnd, expectedSize, ideas }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      try {
        localStorage.setItem(`pp-admin:${data.id}`, data.adminKey);
      } catch {}
      router.push(`/t/${data.id}/admin?key=${encodeURIComponent(data.adminKey)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-5">
      <div>
        <h2 className="font-display text-2xl font-bold">Start a trip</h2>
        <p className="text-sm text-stone-500">Takes 30 seconds. You&apos;ll get a link to share.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="t-name">What&apos;s the trip?</label>
          <input id="t-name" className="input" placeholder="College gang reunion 🎒" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
        </div>
        <div>
          <label className="label" htmlFor="t-coord">Your name</label>
          <input id="t-coord" className="input" placeholder="Dia" value={coordinator} onChange={(e) => setCoordinator(e.target.value)} required maxLength={40} />
        </div>
        <div>
          <label className="label" htmlFor="t-size">How many going?</label>
          <input id="t-size" className="input" type="number" min={2} max={30} value={expectedSize} onChange={(e) => setExpectedSize(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="t-from">Sometime between</label>
          <input id="t-from" className="input" type="date" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="t-to">and</label>
          <input id="t-to" className="input" type="date" min={windowStart} value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} required />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="t-ideas">Any places in mind? <span className="font-normal text-stone-400">(optional)</span></label>
          <input id="t-ideas" className="input" placeholder="Goa, Rishikesh…" value={ideas} onChange={(e) => setIdeas(e.target.value)} maxLength={500} />
        </div>
      </div>
      {error && <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      <button type="submit" className="btn-primary w-full text-base" disabled={busy}>
        {busy ? "Creating…" : "Create trip & get link →"}
      </button>
    </form>
  );
}
