# Plan Pakka: group trip planner

Everyone fills in one link. The group gets the 3 trips that work best for all of them, where each person stands on each one, and concrete plans to bring along anyone who'd miss out.

See [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) for the design and the brainstorm behind it.

## How it works

1. **The coordinator creates a trip** (`/`) with a name, the window it could happen in, a rough group size and any places already floating around. They land on a private coordinator page with an invite message ready for WhatsApp.
2. **Everyone joins** (`/t/[id]/join`) through a 6-step, ~3-minute form:
   - home city
   - date ranges and trip length
   - budget range, plus **how much they'd stretch**
   - **whether they could join late**
   - max travel time
   - dealbreakers
   - ranked destination types, vibe, pace and stay style
   - wishlist and notes
3. **Recommendations update after every response** (once 2+ people have joined):
   - **Code** computes the group snapshot: best dates, the budget that works for most, trip length and dealbreakers (`src/lib/analysis.ts`).
   - **Gemini + Google Search** researches real destinations, trains, fares, stays and weather (`src/lib/ai.ts`).
   - **Gemini** turns that into 3 recommendations: cost breakdown, pros and cons, a 0–100 score and reason for every person, and **"make it work for everyone" plans**.
   - **Code re-checks everything:** each person's dates, budget + stretch and travel limit, and whether each plan actually works for the whole group.
4. **The group decides** (`/t/[id]`). Each person taps *I'm in* on options and *I'm OK with this* on plans. The coordinator locks in the final choice, and everyone sees "Plan pakka 🎉".

## Run locally

```bash
npm install
cp .env.example .env.local   # add GEMINI_API_KEY
npm run dev
```

Without Supabase variables, data is stored in `.data/db.json`. Without `GEMINI_API_KEY`, the snapshot still works but no recommendations are generated.

## Deploy (Vercel + Supabase)

1. Create a free Supabase project, open **SQL editor**, and run `supabase/schema.sql`.
2. From **Project Settings → API**, copy the Project URL and the `service_role` key.
3. Deploy: `npx vercel` (log in when asked), then add these env vars in the Vercel dashboard, or with `npx vercel env add`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only)
   - `GEMINI_API_KEY`
   - optionally `GEMINI_MODEL` (default `gemini-3.8-flash`)
4. `npx vercel --prod`

Recommendations run in the background after each response. The API routes set `maxDuration = 300` so the AI step has time to finish.
