"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDateRange, formatINR } from "@/lib/format";
import { parseMe, readJson, saveMe, useMeRaw, type Me } from "@/lib/me";
import {
  DEALBREAKERS,
  DESTINATION_TYPES,
  HOME_CITIES,
  PACES,
  STAYS,
  TRAVEL_CAPS,
  VIBES,
  type Dealbreaker,
  type DestinationType,
  type MemberPrefs,
} from "@/lib/types";

interface Props {
  tripId: string;
  tripName: string;
  windowStart: string;
  windowEnd: string;
}

const BUDGET_PRESETS = [
  { label: "Under ₹10k", min: 3000, max: 10000 },
  { label: "₹10k–15k", min: 10000, max: 15000 },
  { label: "₹15k–25k", min: 15000, max: 25000 },
  { label: "₹25k+", min: 25000, max: 50000 },
];
const STRETCH = [0, 2000, 5000, 10000];
const FLEX = [
  { v: 0, label: "No, fixed" },
  { v: 1, label: "1 day" },
  { v: 2, label: "2 days" },
];

const STEPS = [
  { title: "Who are you?", sub: "Name and where you'd start from" },
  { title: "When are you free?", sub: "Add every stretch that works" },
  { title: "Money & travel", sub: "All-in budget per person, and how far you'll go" },
  { title: "Dealbreakers", sub: "Hard no's. We'll never recommend these for you." },
  { title: "What do you love?", sub: "Tap types in order of love" },
  { title: "Anything else?", sub: "Optional, but it helps a lot" },
];

const defaultPrefs = (windowStart: string, windowEnd: string): MemberPrefs => ({
  homeCity: "",
  dateRanges: [{ from: windowStart, to: windowEnd }],
  lengthMin: 3,
  lengthMax: 5,
  budgetMin: 10000,
  budgetMax: 15000,
  budgetStretch: 0,
  dateFlex: 0,
  maxTravelHours: 8,
  dealbreakers: [],
  dealbreakerOther: "",
  destinationTypes: [],
  vibe: null,
  pace: null,
  stay: null,
  wishlist: "",
  notes: "",
});

/** Remounts when this device's saved answers change, so the form starts from them. */
export function JoinWizard(props: Props) {
  const raw = useMeRaw(props.tripId);
  return <Wizard key={raw ?? "new"} {...props} me={parseMe(raw)} />;
}

function Chip({
  on,
  onClick,
  children,
  badge,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
  badge?: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[15px] transition ${
        on
          ? "border-orange-500 bg-orange-500 font-semibold text-white shadow-sm"
          : "border-stone-200 bg-white text-stone-800 hover:border-orange-300"
      }`}
    >
      {badge != null && (
        <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-xs font-bold text-orange-600">{badge}</span>
      )}
      {children}
    </button>
  );
}

function Stepper({ label, value, set, min, max }: { label: string; value: number; set: (n: number) => void; min: number; max: number }) {
  return (
    <div className="rounded-2xl bg-white p-3">
      <p className="mb-2 text-sm text-stone-600">{label}</p>
      <div className="flex items-center justify-between">
        <button type="button" aria-label={`Decrease ${label}`} className="grid h-10 w-10 place-items-center rounded-full bg-orange-100 text-xl font-bold text-orange-800 disabled:opacity-40" onClick={() => set(value - 1)} disabled={value <= min}>−</button>
        <span className="text-2xl font-bold tabular-nums">{value}</span>
        <button type="button" aria-label={`Increase ${label}`} className="grid h-10 w-10 place-items-center rounded-full bg-orange-100 text-xl font-bold text-orange-800 disabled:opacity-40" onClick={() => set(value + 1)} disabled={value >= max}>+</button>
      </div>
    </div>
  );
}

function Wizard({ tripId, tripName, windowStart, windowEnd, me }: Props & { me: Me | null }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(me?.name ?? "");
  const [p, setP] = useState<MemberPrefs>(me?.prefs ?? defaultPrefs(windowStart, windowEnd));
  const [otherCity, setOtherCity] = useState(
    me && !(HOME_CITIES as readonly string[]).includes(me.prefs.homeCity) ? me.prefs.homeCity : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (patch: Partial<MemberPrefs>) => setP((x) => ({ ...x, ...patch }));
  const cityIsOther = p.homeCity === "__other" || (p.homeCity !== "" && !(HOME_CITIES as readonly string[]).includes(p.homeCity));
  const city = cityIsOther ? otherCity.trim() : p.homeCity;

  function validate(i: number): string | null {
    if (i === 0) {
      if (!name.trim()) return "Add your name";
      if (!city) return "Pick your home city";
    }
    if (i === 1) {
      for (const r of p.dateRanges) {
        if (!r.from || !r.to) return "Fill in both dates for each range";
        if (r.from > r.to) return "Each range must end after it starts";
      }
    }
    if (i === 2 && p.budgetMin > p.budgetMax) return "Minimum budget can't be above maximum";
    return null;
  }

  function next() {
    const err = validate(step);
    setError(err);
    if (!err) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function submit() {
    for (let i = 0; i < STEPS.length; i++) {
      const err = validate(i);
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
      router.push(`/t/${tripId}?joined=1`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  const rankedToggle = (t: DestinationType) =>
    set({
      destinationTypes: p.destinationTypes.includes(t)
        ? p.destinationTypes.filter((x) => x !== t)
        : [...p.destinationTypes, t],
    });
  const dbToggle = (d: Dealbreaker) =>
    set({ dealbreakers: p.dealbreakers.includes(d) ? p.dealbreakers.filter((x) => x !== d) : [...p.dealbreakers, d] });

  const last = step === STEPS.length - 1;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-lg flex-col">
      <div className="space-y-3 pb-4">
        <div className="flex items-center justify-between text-sm text-stone-600">
          <span>
            Step {step + 1} of {STEPS.length} · {last ? "almost done!" : `~${Math.max(1, 3 - step)} min left`}
          </span>
          <Link href={`/t/${tripId}`} aria-label="Close" className="text-xl leading-none text-stone-500 hover:text-stone-900">✕</Link>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-orange-100">
          <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold text-stone-900">{STEPS[step].title}</h1>
          <p className="text-stone-600">{STEPS[step].sub}</p>
        </div>
      </div>

      <div className="flex-1 space-y-6 border-t border-orange-100 pt-5">
        {step === 0 && (
          <>
            <div>
              <label className="label" htmlFor="w-name">Your name</label>
              <input id="w-name" className="input text-lg" placeholder="e.g. Karan" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus />
            </div>
            <div>
              <label className="label" htmlFor="w-city">Home city</label>
              <select
                id="w-city"
                className="input text-lg"
                value={cityIsOther ? "__other" : p.homeCity}
                onChange={(e) => set({ homeCity: e.target.value })}
              >
                <option value="">Select…</option>
                {HOME_CITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value="__other">Other…</option>
              </select>
              {cityIsOther && (
                <input className="input mt-2" placeholder="Your city" value={otherCity} onChange={(e) => setOtherCity(e.target.value)} maxLength={60} aria-label="Your city" />
              )}
            </div>
            <p className="text-sm text-stone-500">Joining <strong>{tripName}</strong>.</p>
          </>
        )}

        {step === 1 && (
          <>
            <p className="text-stone-600">Trip window: {formatDateRange(windowStart, windowEnd)}</p>
            <div className="space-y-3">
              {p.dateRanges.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 rounded-2xl bg-white p-3">
                  <div>
                    <label className="text-xs text-stone-600" htmlFor={`r-from-${i}`}>From</label>
                    <input id={`r-from-${i}`} className="input" type="date" min={windowStart} max={windowEnd} value={r.from}
                      onChange={(e) => set({ dateRanges: p.dateRanges.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)) })} />
                  </div>
                  <div>
                    <label className="text-xs text-stone-600" htmlFor={`r-to-${i}`}>To</label>
                    <input id={`r-to-${i}`} className="input" type="date" min={r.from || windowStart} max={windowEnd} value={r.to}
                      onChange={(e) => set({ dateRanges: p.dateRanges.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)) })} />
                  </div>
                  <button type="button" aria-label="Remove range" disabled={p.dateRanges.length === 1}
                    className="mb-1 h-9 w-9 rounded-full text-stone-400 hover:bg-stone-100 hover:text-rose-600 disabled:invisible"
                    onClick={() => set({ dateRanges: p.dateRanges.filter((_, j) => j !== i) })}>✕</button>
                </div>
              ))}
              {p.dateRanges.length < 5 && (
                <button type="button" className="w-full rounded-2xl bg-orange-100/70 py-3 font-semibold text-stone-800 hover:bg-orange-100"
                  onClick={() => set({ dateRanges: [...p.dateRanges, { from: windowStart, to: windowEnd }] })}>
                  + Add another range
                </button>
              )}
            </div>
            <div>
              <p className="label">Trip length</p>
              <div className="grid grid-cols-2 gap-3">
                <Stepper label="Min days" value={p.lengthMin} min={1} max={p.lengthMax} set={(n) => set({ lengthMin: n })} />
                <Stepper label="Max days" value={p.lengthMax} min={p.lengthMin} max={21} set={(n) => set({ lengthMax: n })} />
              </div>
            </div>
            <div>
              <p className="label">If it gets everyone there, could you join late or leave early?</p>
              <div className="flex flex-wrap gap-2">
                {FLEX.map((f) => (
                  <Chip key={f.v} on={p.dateFlex === f.v} onClick={() => set({ dateFlex: f.v })}>{f.label}</Chip>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <p className="label mb-0">Budget per person, all-in</p>
                <p className="font-bold text-orange-600">{formatINR(p.budgetMin)} – {formatINR(p.budgetMax)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {BUDGET_PRESETS.map((b) => (
                  <Chip key={b.label} on={p.budgetMin === b.min && p.budgetMax === b.max} onClick={() => set({ budgetMin: b.min, budgetMax: b.max })}>{b.label}</Chip>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-stone-600" htmlFor="b-min">Minimum (₹)</label>
                  <input id="b-min" className="input" type="number" min={0} step={500} value={p.budgetMin} onChange={(e) => set({ budgetMin: Number(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="text-xs text-stone-600" htmlFor="b-max">Maximum (₹)</label>
                  <input id="b-max" className="input" type="number" min={0} step={500} value={p.budgetMax} onChange={(e) => set({ budgetMax: Number(e.target.value) || 0 })} />
                </div>
              </div>
              <p className="mt-2 text-sm text-stone-500">Travel + stay + food + activities. Be honest: the plan only works if the numbers are real.</p>
            </div>
            <div>
              <p className="label">If it gets the whole group there, you could stretch by…</p>
              <div className="flex flex-wrap gap-2">
                {STRETCH.map((s) => (
                  <Chip key={s} on={p.budgetStretch === s} onClick={() => set({ budgetStretch: s })}>{s === 0 ? "Not a rupee more" : `+${formatINR(s)}`}</Chip>
                ))}
              </div>
            </div>
            <div>
              <p className="label">Max one-way travel time</p>
              <div className="flex flex-wrap gap-2">
                {TRAVEL_CAPS.map((h) => (
                  <Chip key={h} on={p.maxTravelHours === h} onClick={() => set({ maxTravelHours: h })}>Up to {h}h</Chip>
                ))}
                <Chip on={p.maxTravelHours === null} onClick={() => set({ maxTravelHours: null })}>Any, chalega</Chip>
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(DEALBREAKERS) as Dealbreaker[]).map((d) => (
                <Chip key={d} on={p.dealbreakers.includes(d)} onClick={() => dbToggle(d)}>{DEALBREAKERS[d]}</Chip>
              ))}
            </div>
            <div>
              <label className="label" htmlFor="db-other">Anything else that&apos;s a hard no?</label>
              <input id="db-other" className="input" placeholder="e.g. no long road trips, no camping" value={p.dealbreakerOther} onChange={(e) => set({ dealbreakerOther: e.target.value })} maxLength={200} />
            </div>
            <p className="text-sm text-stone-500">{p.dealbreakers.length} selected.</p>
          </>
        )}

        {step === 4 && (
          <>
            <div>
              <p className="label mb-0">Destination types, ranked</p>
              <p className="mb-2 text-sm text-stone-500">First tap = favourite. Tap again to remove.</p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(DESTINATION_TYPES) as DestinationType[]).map((t) => {
                  const rank = p.destinationTypes.indexOf(t);
                  return (
                    <Chip key={t} on={rank >= 0} badge={rank >= 0 ? rank + 1 : undefined} onClick={() => rankedToggle(t)}>{DESTINATION_TYPES[t]}</Chip>
                  );
                })}
              </div>
            </div>
            {(
              [
                ["Vibe", VIBES, "vibe"],
                ["Pace", PACES, "pace"],
                ["Stay style", STAYS, "stay"],
              ] as const
            ).map(([label, options, field]) => (
              <div key={field}>
                <p className="label">{label}</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(options).map(([k, v]) => (
                    <Chip key={k} on={p[field] === k} onClick={() => set({ [field]: p[field] === k ? null : k } as Partial<MemberPrefs>)}>{v}</Chip>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {step === 5 && (
          <>
            <div>
              <label className="label" htmlFor="w-wish">Places you&apos;d love to go</label>
              <textarea id="w-wish" className="input min-h-24" placeholder="Gokarna, Spiti, that café in Kasol…" value={p.wishlist} onChange={(e) => set({ wishlist: e.target.value })} maxLength={500} />
            </div>
            <div>
              <label className="label" htmlFor="w-notes">Anything else</label>
              <textarea id="w-notes" className="input min-h-24" placeholder="Allergies, a wedding on the 15th, I get motion sick…" value={p.notes} onChange={(e) => set({ notes: e.target.value })} maxLength={500} />
            </div>
          </>
        )}

        {error && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      </div>

      <div className="sticky bottom-0 -mx-4 mt-6 flex gap-3 border-t border-orange-100 bg-background/95 px-4 py-4 backdrop-blur">
        {step > 0 && (
          <button type="button" className="btn-secondary px-6 py-3 text-base" onClick={() => { setError(null); setStep(step - 1); }}>← Back</button>
        )}
        {last ? (
          <button type="button" className="btn-primary flex-1 py-3 text-base" onClick={submit} disabled={busy}>
            {busy ? "Saving…" : me ? "Save my changes ✓" : "Done, count me in! 🎉"}
          </button>
        ) : (
          <button type="button" className="btn-primary flex-1 py-3 text-base" onClick={next}>Next →</button>
        )}
      </div>
    </div>
  );
}
