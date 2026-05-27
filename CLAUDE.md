# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow Rules

- **Plan before code**: For every coding task, present a written plan (files to change, approach, edge cases) and wait for explicit user approval before writing any code.
- **Show your changes**: After writing code, summarize every file that was modified and what changed in each.
- **Log this session**: When the user says "log this session", append a new dated entry to the top of the `## Changelog` section below, summarizing what was implemented in the session as bullet points per file changed (matching the existing entry format). This builds a running reference of prior work for future sessions.

## Commands

```bash
pnpm dev          # start Next.js dev server (http://localhost:3000)
pnpm build        # production build
pnpm lint         # run ESLint

# Database
docker compose up -d                  # start Postgres (port 5432)
pnpm prisma migrate dev               # run pending migrations
pnpm prisma generate                  # regenerate Prisma client after schema changes
pnpm prisma studio                    # open Prisma data browser

# Redis (optional caching layer — run separately from docker-compose)
docker run -d -p 6379:6379 redis:7    # start Redis for local dev
```

## Environment Variables

Required in `.env.local`:
- `DATABASE_URL` — PostgreSQL connection string (e.g. `postgresql://postgres:postgres@localhost:5432/local_explorer`)
- `GITHUB_ID`, `GITHUB_SECRET` — GitHub OAuth app credentials
- `NEXTAUTH_URL` — callback URL (e.g. `http://localhost:3000`)
- `NEXTAUTH_SECRET` — random secret for session signing
- `OPENTRIPMAP_API_KEY` — OpenTripMap API key; used by `/api/places` for POI lookup
- `GOOGLE_GENERATIVE_AI_KEY` — Google Generative AI key (Gemini 2.5 Flash Lite); powers `/api/chat`
- `REDIS_URL` (optional) — Redis URL (e.g. `redis://localhost:6379`); caching is silently skipped if unset

## Architecture

### Overview
Single-page Next.js 15 (App Router) app. The entire UI is one large `SearchPanel` client component at `components/ui/explorer/search-panel.tsx`. Auth uses NextAuth v4 with GitHub OAuth and database sessions persisted via Prisma.

### Data Sources
- **Places**: POIs fetched at search time via Nominatim (free OSM geocoding to resolve `q` → lat/lon) + OpenTripMap (`OPENTRIPMAP_API_KEY`, returns nearby attractions in a fixed 5000m radius, filtered to a curated set of touristy `kinds` — `interesting_places, cultural, historic, museums, architecture, natural, amusements, religion, foods`). The display category is derived from OpenTripMap's `kinds` string via a priority list (`museums` > `historic` > `architecture` > `cultural` > `natural` > `amusements` > `religion` > `foods`).
- **Places cache**: OpenTripMap results are cached in Postgres (`PlacesQueryCache`) with a 6-hour TTL.

### Caching Layers
Two independent layers:
1. **Postgres** (`PlacesQueryCache` model) — caches OpenTripMap query results. Key format: `places:otm:v1:{q}:limit={n}:radius={r}` (radius currently fixed at 5000).
2. **Redis** (`lib/redis.ts`) — optional; caches per-user API responses. Keys:
   - `saved:v1:user:{userId}` (60s TTL)
   - `itineraries:v1:user:{userId}` (60s TTL)
   - `itineraryItems:v1:user={userId}:itinerary={id}` (5min TTL)
   
   `getRedis()` returns `null` if `REDIS_URL` is unset or Redis is unreachable — all callers must handle `null` gracefully. Redis cache is invalidated on any write mutation to the corresponding resource.

### API Routes
All routes under `app/api/` use `export const runtime = "nodejs"` and require authentication except `/api/places` (public search) and `/api/auth/[...nextauth]`. `/api/chat` allows unauthenticated requests but only exposes the `search_city` tool to the LLM in that case.

| Route | Methods | Description |
|---|---|---|
| `/api/places` | GET | Search POIs via Nominatim + OpenTripMap; query param `q` (city/neighbourhood), optional `limit` (default 50, max 50) |
| `/api/saved` | GET, POST, DELETE | User's saved places; DELETE accepts `{ placeId }` or `{ all: true }` |
| `/api/itineraries` | GET, POST | List/create itineraries; title unique per user (P2002 → 409) |
| `/api/itineraries/[id]/items` | GET, POST, DELETE | Items for a specific itinerary |
| `/api/itineraries/[id]/generate` | POST | Auto-generate schedule from saved places (see below) |
| `/api/chat` | POST | Gemini-backed chat assistant; returns `{ message, sideEffects[] }` for the client to apply |

### Itinerary Generation Algorithm (`app/api/itineraries/[id]/generate/route.ts`)
1. Loads user's saved places (optionally filtered to selected `placeIds`).
2. Only places with lat/lon are eligible — request fails with 400 if none qualify.
3. (Optional) shuffles the eligible list when `shuffle: true`.
4. Distributes eligible places across days (`assignDays`):
   - If ≥2 places have coords: sort by polar angle around the centroid (geographic sweep), then chunk into **contiguous arcs** across days (Day 0 = first arc, Day 1 = next arc, …) so each day clusters geographically. Computed via `Math.floor((i * daysCount) / sorted.length)`.
   - Otherwise: sort by category then name, round-robin across days.
5. Trims each day's bucket to at most `perDay` places. The cap is applied **after** day assignment to preserve spatial clusters (a global pre-trim would just drop the tail in `createdAt` order).
6. Orders places within each day using nearest-neighbour greedy on squared Euclidean distance (`dist2`); short days (≤2 places) skip the greedy pass.
7. Body params: `mode` (`"replace"` | `"append"`), `perDay` (1–8, default 3), `shuffle` (bool), `placeIds` (optional string array). Response includes a `debug` block with `savedCount`, `eligibleCount`, `chosenCount` (post-trim total), `selectedCount`, `mode`, `perDay`, `shuffle`.

### Chat Assistant (`app/api/chat/route.ts`)
Backed by Google Gemini 2.5 Flash Lite (`GOOGLE_GENERATIVE_AI_KEY`). The handler accepts `{ messages, context }` from the client and returns `{ message, sideEffects[] }`.

- **Tools exposed to the LLM** (function calling, max 5-iteration loop): `search_city`, `create_itinerary`, `generate_itinerary`. Unauthenticated callers see only `search_city`.
- **Context fields** sent by the client: `savedCount`, `selectedSavedCount`, `itineraryCount`, `activeItineraryId`, `activeItineraryTitle`. The system prompt embeds these and uses them to steer behavior.
- **Itinerary-intent decision rule** in the system prompt:
  - **PATH A — fill active**: when the user references the active itinerary ("fill it", "regenerate", "use my selections", "add to my trip"), call `generate_itinerary` with `itineraryId = activeItineraryId`. Do not create a new one.
  - **PATH B — new itinerary**: when the user wants something new ("new trip", "another city", different title), call `create_itinerary` then immediately `generate_itinerary` with the id RETURNED by step 1 (with selections), or `create_itinerary` only (without selections).
- **Pre-validation** in `executeFunction` for `generate_itinerary`: checks ownership, `savedCount > 0`, **and** that at least one saved place has both `lat` and `lon`. Failures return `{ error }` and the LLM is instructed to relay the error string verbatim — no side effect is emitted.
- **Side-effect contract**: the chat route does not perform side-effect work itself; it returns a `sideEffects[]` array which the client applies:
  - `{ type: "search", query }` → client triggers `/api/places`.
  - `{ type: "refresh_itineraries", selectId? }` → client refetches `/api/itineraries` and may switch active id.
  - `{ type: "generate", itineraryId, perDay, shuffle, useSelected }` → client calls `/api/itineraries/[id]/generate`. If that POST throws, the client surfaces the real error as `"Generation failed: <msg>"` instead of the LLM's optimistic message.

### Database Schema (Prisma / PostgreSQL)
Key models:
- `User`, `Account`, `Session`, `VerificationToken` — standard NextAuth models
- `Place` — OSM POI; unique on `(provider, providerId)`
- `SavedPlace` — join table between `User` and `Place`; unique on `(savedById, placeId)`
- `Itinerary` — named trip; unique on `(userId, title)`
- `ItineraryItem` — indexed on `(itineraryId, dayIndex, order)`
- `PlacesQueryCache` — OpenTripMap result cache; indexed on `expiresAt`

### Auth Pattern
All protected API routes call `getServerSession(authOptions)` and extract `(session.user as any).id`. The `id` is injected in `lib/auth.ts` via the `session` callback. Auth provider: GitHub only.

### UI Component Structure
- `app/page.tsx` — renders `<SearchPanel />`
- `app/providers.tsx` — wraps app in `<SessionProvider>`
- `app/layout.tsx` — root layout (not listed, but implied)
- `components/ui/explorer/search-panel.tsx` — all application state and UI
- `components/auth-button.tsx` — sign in/out button
- `components/theme-toggle.tsx` — light/dark theme switch; toggles the `.dark` class on `<html>` and persists to `localStorage` (no `next-themes` dependency)
- `components/ui/` — shadcn/ui primitives (Badge, Button, Card, Input, Separator)

## Changelog

### 2026-05-26 — Chat panel polish + resizable Saved section
- **`components/ui/explorer/search-panel.tsx`** —
  - Renamed the right-side chat panel heading from "AI Assistant" to "Assistant".
  - Added a visible 2px left border (`border-l-2`) and `shadow-md` to the chat panel card so its edges read clearly against the toggle tab when popped out.
  - Made the Saved section vertically resizable. Replaced the static `<Separator />` between Saved and Itinerary with a 12px-tall draggable divider (1px line that thickens and tints `primary/60` on hover, `cursor-row-resize`). Added `savedHeight`, `savedAtMax` state and `savedScrollRef`, `savedListRef` refs.
  - Drag bounds: minimum = original `max-h-64` (256px) so the section can never collapse past its default; maximum = the inner `<ul>`'s natural `offsetHeight` so the user can't drag past the last item.
  - Drag uses a re-anchor pattern (`lastY` / `currentHeight` advanced only by `actualDelta`) so the cursor stays glued to the divider line in both directions, even after pushing past a bound — see [[feedback-drag-reanchor]] in memory.
  - Auto-resize effect: when items are added/removed while the user is at the natural max (`savedAtMax === true`), the height auto-fits the new content height; if it drops to ≤ 256px, reverts to the default `max-h-64` behavior. No auto-resize when at an intermediate height.
- **`CLAUDE.md`** — Added a "Log this session" workflow rule documenting that "log this session" appends a dated entry to the Changelog.

### 2026-05-19 — UI polish pass (visual only, no logic changes)
- **`app/globals.css`** — Replaced the all-grayscale theme with a travel-themed palette: teal/ocean `--primary` and warm sand `--accent`/`--secondary`, with faint cool/warm tints on backgrounds. Updated both `:root` (light) and `.dark` blocks plus matching `--ring`.
- **`app/page.tsx`** — Fixed invalid container class `max-w-2x1` → `max-w-5xl` (was leaving the panel unconstrained); added a subtle gradient background to `<main>`.
- **`app/layout.tsx`** — Added an inline no-flash theme script in `<head>` that applies the saved/preferred theme before paint; added `suppressHydrationWarning` on `<html>`.
- **`components/theme-toggle.tsx`** (new) — Sun/moon dark-mode toggle button.
- **`components/ui/explorer/search-panel.tsx`** — Added `MapPin` icon badge to the title and `ThemeToggle` in the header; promoted the Saved/Itinerary section labels to icon headings; hover states on search-result and saved-place rows; selected-place highlight; restyled itinerary day cards with accent-tinted headers and a per-day stop count.
