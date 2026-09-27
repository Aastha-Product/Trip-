"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDateRange } from "@/lib/format";
import { parseMe, readJson, saveMe, useMeRaw, type Me } from "@/lib/me";
import {
  DEALBREAKERS,
  DESTINATION_TYPES,
  HOME_CITIES,
  type Dealbreaker,
  type DestinationType,
  type MemberPrefs,
} from "@/lib/types";

interface Props {
  tripId: string;
  coordinator: string;
  windowStart: string;
  windowEnd: string;
}

const LENGTHS = [
  { label: "Weekend (2–3 days)", min: 2, max: 3 },
  { label: "3–5 days", min: 3, max: 5 },
  { label: "A week", min: 5, max: 7 },
];
const BUDGETS = [
  { label: "Under ₹10k", min: 3000, max: 10000 },
  { label: "₹10k – 15k", min: 10000, max: 15000 },
  { label: "₹15k – 25k", min: 15000, max: 25000 },
  { label: "₹25k+", min: 25000, max: 50000 },
];
const STRETCH = [
  { v: 0, label: "That's my max" },
  { v: 2000, label: "+₹2k if needed" },
  { v: 5000, label: "+₹5k if needed" },
];

const STEPS = ["About you", "When & budget", "Your vibe"];

const blank = (windowStart: string, windowEnd: string): MemberPrefs => ({
  homeCity: "",
  dateRanges: [{ from: windowStart, to: windowEnd }],
  lengthMin: 3,
  lengthMax: 5,
  budgetMin: 10000,
  budgetMax: 15000,
  budgetStretch: 0,
  dateFlex: 0,
  maxTravelHours: null,
  dealbreakers: [],
  dealbreakerOther: "",
  destinationTypes: [],
  vibe: null,
  pace: null,
  stay: null,
  wishlist: "",
  notes: "",
});

/**
 * The one thing a friend does on the shared link: add (or edit) their preferences.
 * New visitors see the form straight away; people who already answered see a
 * compact "you're in" bar with an edit option.
 */
export function PrefsSection(props: Props) {
  const raw = useMeRaw(props.tripId);
  const me = parseMe(raw);
  const [editing, setEditing] = useState(false);

  if (me && !editing) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 animate-pop">
        <p className="text-emerald-900">
          <span aria-hidden>✅</span> <strong>{me.name}</strong>, your preferences are in.
        </p>
        <button type="button" className="shrink-0 text-sm font-semibold text-emerald-800 underline" onClick={() => setEditing(true)}>
          Edit
        </button>
      </div>
    );
  }
  return <Form key={raw ?? "new"} {...props} me={me} onDone={() => setEditing(false)} />;
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className="chip">
      {children}
    </button>
  );
}

function Form({ tripId, coordinator, windowStart, windowEnd, me, onDone }: Props & { me: Me | null; onDone: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(me?.name ?? "");
  const [p, setP] = useState<MemberPrefs>(me?.prefs ?? blank(windowStart, windowEnd));
  const [otherCity, setOtherCity] = useState(
    me && !(HOME_CITIES as readonly string[]).includes(me.prefs.homeCity) ? me.prefs.homeCity : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (patch: Partial<MemberPrefs>) => setP((x) => ({ ...x, ...patch }));
  const isOther = p.homeCity === "__other" || (p.homeCity !== "" && !(HOME_CITIES as readonly string[]).includes(p.homeCity));
  const city = isOther ? otherCity.trim() : p.homeCity;
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  function check(i: number): string | null {
    if (i === 0 && !name.trim()) return "What should we call you?";
    if (i === 0 && !city) return "Pick the city you'd travel from";
    if (i === 1) {
      for (const r of p.dateRanges) {
        if (!r.from || !r.to) return "Fill in both dates";
        if (r.from > r.to) return "The end date should be after the start date";
      }
    }
    return null;
  }

  function next() {
    const err = check(step);
    setError(err);
    if (!err) setStep((s) => s + 1);
  }

  async function submit() {
    for (let i = 0; i < STEPS.length; i++) {
      const err = check(i);
      if (err) {
        setStep(i);
        setError(err);
        return;
      }
    }
    setBusy(true);
    setError(null);
    const prefs = { ...p, homeCity: city };
    try {
      const res = await fetch(`/api/trips/${tripId}/members`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), prefs, ...(me ? { memberId: me.memberId, editKey: me.editKey } : {}) }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      saveMe(tripId, { memberId: data.memberId, editKey: data.editKey, name: name.trim(), prefs });
      onDone();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  const last = step === STEPS.length - 1;

  return (
    <section className="card space-y-6 animate-pop" aria-labelledby="prefs-title">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="prefs-title" className="font-display text-2xl font-bold">
            {me ? "Update your preferences" : "Add your preferences"}
          </h2>
          <span className="text-sm font-medium text-stone-500">
            {step + 1} / {STEPS.length}
          </span>
        </div>
        <ol className="grid grid-cols-3 gap-2" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s}>
              <div className={`h-1.5 rounded-full ${i <= step ? "bg-gradient-to-r from-violet-600 to-indigo-600" : "bg-stone-200"}`} />
              <p className={`mt-1 text-xs ${i === step ? "font-semibold text-violet-700" : "text-stone-400"}`}>{s}</p>
            </li>
          ))}
        </ol>
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="p-name">Your name</label>
            <input id="p-name" className="input" placeholder="e.g. Karan" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          </div>
          <div>
            <label className="label" htmlFor="p-city">You&apos;d travel from</label>
            <select id="p-city" className="input" value={isOther ? "__other" : p.homeCity} onChange={(e) => set({ homeCity: e.target.value })}>
              <option value="">Choose your city…</option>
              {HOME_CITIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="__other">Somewhere else…</option>
            </select>
            {isOther && (
              <input className="input mt-2" placeholder="Your city" aria-label="Your city" value={otherCity} onChange={(e) => setOtherCity(e.target.value)} maxLength={60} />
            )}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <div>
            <p className="label">When are you free?</p>
            <p className="-mt-1 mb-2 text-sm text-stone-500">{coordinator} is thinking {formatDateRange(windowStart, windowEnd)}</p>
            <div className="space-y-2">
              {p.dateRanges.map((r, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-1.5">
                  <input aria-label="Free from" className="input min-w-0 px-2.5 text-sm" type="date" min={windowStart} max={windowEnd} value={r.from}
                    onChange={(e) => set({ dateRanges: p.dateRanges.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)) })} />
                  <span className="text-stone-400">→</span>
                  <input aria-label="Free until" className="input min-w-0 px-2.5 text-sm" type="date" min={r.from || windowStart} max={windowEnd} value={r.to}
                    onChange={(e) => set({ dateRanges: p.dateRanges.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)) })} />
                  <button type="button" aria-label="Remove dates" disabled={p.dateRanges.length === 1} className="px-1 text-stone-400 hover:text-rose-600 disabled:invisible" onClick={() => set({ dateRanges: p.dateRanges.filter((_, j) => j !== i) })}>✕</button>
                </div>
              ))}
            </div>
            {p.dateRanges.length < 4 && (
              <button type="button" className="mt-2 text-sm font-semibold text-violet-700" onClick={() => set({ dateRanges: [...p.dateRanges, { from: windowStart, to: windowEnd }] })}>
                + Add another free stretch
              </button>
            )}
          </div>
          <div>
            <p className="label">How long?</p>
            <div className="flex flex-wrap gap-2">
              {LENGTHS.map((l) => (
                <Chip key={l.label} on={p.lengthMin === l.min && p.lengthMax === l.max} onClick={() => set({ lengthMin: l.min, lengthMax: l.max })}>{l.label}</Chip>
              ))}
            </div>
          </div>
          <div>
            <p className="label">Budget per person, everything included</p>
            <div className="flex flex-wrap gap-2">
              {BUDGETS.map((b) => (
                <Chip key={b.label} on={p.budgetMin === b.min && p.budgetMax === b.max} onClick={() => set({ budgetMin: b.min, budgetMax: b.max })}>{b.label}</Chip>
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-violet-50 p-4">
            <p className="text-sm font-semibold text-violet-900">🤝 To get the whole group there, could you…</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {STRETCH.map((s) => (
                <Chip key={s.v} on={p.budgetStretch === s.v} onClick={() => set({ budgetStretch: s.v })}>{s.label}</Chip>
              ))}
              <Chip on={p.dateFlex > 0} onClick={() => set({ dateFlex: p.dateFlex > 0 ? 0 : 1 })}>Join a day late / leave early</Chip>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <div>
            <p className="label">What sounds fun? <span className="font-normal text-stone-400">(pick any)</span></p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(DESTINATION_TYPES) as DestinationType[]).map((t) => (
                <Chip key={t} on={p.destinationTypes.includes(t)} onClick={() => set({ destinationTypes: toggle(p.destinationTypes, t) })}>{DESTINATION_TYPES[t]}</Chip>
              ))}
            </div>
          </div>
          <div>
            <p className="label">Hard no&apos;s? <span className="font-normal text-stone-400">(we&apos;ll avoid these for you)</span></p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(DEALBREAKERS) as Dealbreaker[]).map((d) => (
                <Chip key={d} on={p.dealbreakers.includes(d)} onClick={() => set({ dealbreakers: toggle(p.dealbreakers, d) })}>{DEALBREAKERS[d]}</Chip>
              ))}
            </div>
          </div>
          <div>
            <label className="label" htmlFor="p-notes">Anything else? <span className="font-normal text-stone-400">(optional)</span></label>
            <textarea id="p-notes" className="input min-h-20" placeholder="Dream place, a wedding on the 15th, I get motion sick…" value={p.notes} onChange={(e) => set({ notes: e.target.value })} maxLength={500} />
          </div>
        </div>
      )}

      {error && <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      <div className="flex gap-3">
        {step > 0 && (
          <button type="button" className="btn-secondary" onClick={() => { setError(null); setStep(step - 1); }}>← Back</button>
        )}
        {last ? (
          <button type="button" className="btn-primary flex-1" onClick={submit} disabled={busy}>
            {busy ? "Saving…" : me ? "Save changes ✓" : "Add my preferences 🎉"}
          </button>
        ) : (
          <button type="button" className="btn-primary flex-1" onClick={next}>Next →</button>
        )}
      </div>
    </section>
  );
}
