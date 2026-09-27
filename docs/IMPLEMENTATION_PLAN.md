# Plan Pakka: Group Trip Planner (v2)

Sources: `pm.pdf` (problem statement), `L2_Assessment_PartB_Section_A.docx`, the components map, and screenshots of the reference build ("Ab Toh Chalna Padega").

> Riya's ask: "Build me a tool where everyone submits their preferences through one link, and it gives us our best trip options with everything we need to decide, including where each person stands on each option."

## What changed from v1

v1 had Riya add the options by hand (our original Check 03 cut: no live price data). The reference build shows a better answer to Check 03. **The AI proposes the destinations itself and grounds costs, travel and weather with Google Search**, showing its sources and labelling the numbers as estimates. Riya can still seed ideas, and everyone's wishlist feeds in.

## What the reference does well (keep)

- A 6-step mobile form that takes about 3 minutes: name and home city · date ranges and trip length · budget range and max travel time · dealbreaker chips · ranked destination types, vibe, pace, stay style · wishlist and notes
- Top 3 destinations with cost per person, a travel/stay/food breakdown, and a pitch
- A score for every person on every option, each with a one-line reason
- "Biggest compromise": who loses out on each option
- A group summary: budget that works for most, best dates, trip length, dealbreakers with names
- A ready-made WhatsApp message and live updates

## Where we go further

1. **"Make it work for everyone" plans.** When someone can't make an option, or is compromising, the AI proposes concrete, searched fixes:
   - shift the dates
   - they join a day late or leave early
   - a cheaper stay or a daytime train so they fit the budget
   - a route that avoids their dealbreaker

   Each plan says **what changes for everyone else**, with the cost impact and source links.
2. **Plans are checked in code, not trusted blindly.** A date shift is re-checked against every person's calendar ("works for all 9 ✓" or "fixes Saurabh, but Akashdeep can't make the new dates"). Budget plans are checked against everyone's budget plus stretch.
3. **Group consent on each plan.** "If all of you are okay, Saurabh can join" becomes real buttons: everyone taps *I'm OK with this* or *Not for me*, and the plan shows "6 of 9 OK · waiting on Pawan, Dheeraj…".
4. **A flexibility question in the form:** "How much could you stretch?" (₹ extra, days late or early). Plans are built on what people said they'd accept, not guesses.
5. **Hard facts computed in code:** best date window (overlap sweep), the budget band that works for most, trip length and dealbreakers. The AI never does the date or money arithmetic we can check ourselves.
6. **An honest "can they actually go" check** for each person on each option (dates, budget, travel time, dealbreakers), shown as tags such as "Dates ✕" or "+₹2,000 over".
7. **"I'm in" votes and a coordinator lock.** The group ends at *one decision*, not a 201st conversation. Once locked, everyone sees "Plan pakka 🎉".
8. **A nudge message** for people who haven't filled it in ("7 of 9 done, 3 mins, here's the link"). This targets the "3 of 5 filled the Google Form" failure.
9. **"What changed" after each new response or edit.** This stops the "poll collapsed when two people changed their minds" failure: changes are visible, not chaotic.
10. **No guessed pronouns.** The AI refers to people by name or "they".

## Later (not tonight)

Calendar invite (.ics), cost-split tracker, prefilled search links for booking (IRCTC or flights), reminders before a response deadline, and a packing list for the locked destination.

## Stack

Next.js 16 (App Router) on Vercel · Supabase (Postgres, service-role key server-side, RLS on) · Gemini `gemini-3.8-flash`.

## AI pipeline

1. **Snapshot (code):** best windows, budget band, trip length, dealbreakers, who's outside each.
2. **Research (Gemini + Google Search, text):** pick about 5 candidate destinations, then search travel from each home city, stay and food costs, weather in the window, and inclusion fixes. Returns notes plus source URLs.
3. **Structure (Gemini, JSON schema):** 3 recommendations, each with a person-by-person score and reason, pros and cons, the biggest compromise, and 1–3 inclusion plans.
4. **Verify (code):** re-check dates, budget and travel caps for every person; re-check plans; rank by (who can go, average happiness); build the "what changed" note.

Generation runs in the background once 2 or more people have joined. It re-runs after every new response or edit, and a dirty flag coalesces bursts of submissions.

## Routes

- `/`: create a trip (name, trip window, expected group size, optional ideas)
- `/t/[id]`: the trip hub, with who's in, the snapshot, the top 3, plans and votes, and the share message
- `/t/[id]/join`: the 6-step form (it also edits your answers from the same device)
- `/t/[id]/admin?key=…`: the coordinator view, with the nudge message, lock or unlock, and regenerate
- APIs: `POST /api/trips`, `POST /api/trips/[id]/members`, `POST /api/trips/[id]/votes`, `POST /api/trips/[id]/admin`
