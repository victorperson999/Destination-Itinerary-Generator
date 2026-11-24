# Local Explorer — Itinerary Planner

A web app for discovering local points of interest and building day-by-day travel itineraries. Search any city for museums, historic sites, parks, restaurants, and more — save places, organize trips, and optionally let a Gemini-powered assistant plan and generate schedules for you.

---

## What It Does

1. **Search** — enter a city or neighbourhood name to pull nearby points of interest via Nominatim (geocoding) and OpenTripMap.
2. **Save** — bookmark places to your personal saved list, select specific subsets, and resize the saved panel.
3. **Plan** — create named itineraries (e.g. "Tokyo Trip, 5 days") and manage stops across days.
4. **Auto-generate** — cluster saved (or selected) places geographically into contiguous day arcs and build a per-day route using cosine-latitude-adjusted nearest-neighbour ordering refined with open-path 2-opt local search, with optional shuffling.
5. **AI assistant** — a collapsible chat panel powered by Google Gemini 2.5 Flash Lite can search destinations, create itineraries, and trigger schedule generation via structured function calling.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) + React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com/) (light/dark mode) |
| Database | PostgreSQL via [Prisma](https://www.prisma.io/) |
| Cache | PostgreSQL (`PlacesQueryCache`, 6h TTL) + Redis (optional, short TTL) |
| Auth | [NextAuth.js v4](https://next-auth.js.org/) — GitHub OAuth (database sessions) |
| Place data | OpenStreetMap Nominatim (geocoding) + [OpenTripMap](https://opentripmap.io/) (POIs) |
| AI chat | Google Gemini 2.5 Flash Lite (`@google/generative-ai`) |
| Package manager | [pnpm](https://pnpm.io/) |

---

## Prerequisites

- Node.js 20.9+
- pnpm (`npm install -g pnpm`)
- Docker (for PostgreSQL, and optionally Redis)
- A [GitHub OAuth App](https://github.com/settings/developers) for authentication
- An [OpenTripMap API key](https://opentripmap.io/product) for POI search
- A [Google Gemini API key](https://aistudio.google.com/app/apikey) for the AI chat assistant

---

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url>
cd local-explorer-itinerary
pnpm install
```

### 2. Set up environment variables

Create a `.env.local` file in the project root:

```env
# PostgreSQL
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/local_explorer

# GitHub OAuth (create an app at github.com/settings/developers)
GITHUB_ID=your_github_client_id
GITHUB_SECRET=your_github_client_secret

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=any_random_string_here

# OpenTripMap (for POI search)
OPENTRIPMAP_API_KEY=your_opentripmap_api_key

# Google Gemini (for the AI chat assistant)
GOOGLE_GENERATIVE_AI_KEY=your_gemini_api_key

# Redis — optional; caching is silently skipped if unset or unreachable
# REDIS_URL=redis://localhost:6379
```

### 3. Start the database (and optional Redis)

```bash
docker compose up -d

# Optional: local Redis for per-user API caching
docker run -d -p 6379:6379 redis:7
```

### 4. Run database migrations

```bash
pnpm prisma migrate dev
```

### 5. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## API Routes

All routes under `app/api/` run on the Node.js runtime (`export const runtime = "nodejs"`). Protected endpoints require a GitHub NextAuth session; `/api/places` is public, and `/api/chat` exposes only `search_city` when signed out.

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/auth/[...nextauth]` | `GET`, `POST` | NextAuth GitHub OAuth handler |
| `/api/places` | `GET` | Geocode `q` via Nominatim and query OpenTripMap POIs (`limit` 1–50, 5000m radius) |
| `/api/saved` | `GET`, `POST`, `DELETE` | List, save, or remove saved places (`{ placeId }` or `{ all: true }`) |
| `/api/itineraries` | `GET`, `POST` | List or create user itineraries (unique title per user) |
| `/api/itineraries/[id]` | `GET`, `PATCH`, `DELETE` | Fetch, update (`title`, `daysCount`, `startDate`), or delete a specific itinerary |
| `/api/itineraries/[id]/items` | `GET`, `POST`, `PATCH`, `DELETE` | List, add, move/reorder/annotate, or remove items for a specific itinerary |
| `/api/itineraries/[id]/generate` | `POST` | Auto-generate a day-by-day schedule (`mode`: `replace` \| `append`, `perDay` 1–8, `shuffle`, optional `placeIds`) |
| `/api/chat` | `POST` | Gemini chat assistant with tool calling; returns `{ message, sideEffects[] }` |

---

## Project Structure

```text
app/
  api/
    auth/[...nextauth]/         ← NextAuth GitHub OAuth route
    chat/                       ← AI assistant endpoint (Gemini function calling)
    places/                     ← Nominatim + OpenTripMap POI search (public)
    saved/                      ← User's saved places (CRUD)
    itineraries/
      route.ts                  ← List / create itineraries
      [id]/route.ts             ← Fetch, update, or delete an itinerary
      [id]/items/               ← Itinerary item management (add, move/reorder/note, remove)
      [id]/generate/            ← Geographic clustering & day-by-day schedule generator
  layout.tsx                    ← Root layout + no-flash theme script
  page.tsx                      ← Entry point — renders <SearchPanel>
  providers.tsx                 ← NextAuth <SessionProvider>
components/
  theme-toggle.tsx              ← Light/dark theme toggle (synced with lib/theme.ts)
  ui/                           ← shadcn/ui primitives (Badge, Button, Card, Input, Separator)
  ui/explorer/
    app-sidebar.tsx             ← Collapsible left sidebar (section nav, trips switcher, & account dock)
    account-dock.tsx            ← Bottom-left account profile avatar, sign-in dock, & floating popover menu
    brand-logo.tsx              ← Minimalist Waypoint Route SVG brand mark
    settings-dialog.tsx         ← Preferences modal (appearance, default trip days/stops) & Help/Shortcuts
    search-panel.tsx            ← Main workspace orchestrator & client state
    search-section.tsx          ← Discover places search, category filter chips, & results
    saved-section.tsx           ← Saved shortlist, two-step Remove All confirm, & drag-resize
    itinerary-section.tsx       ← Trip creation, day filter chips, & bounded scrollable day timeline
    chat-panel.tsx              ← Slide-over Gemini Assistant drawer & starter prompt chips
    category-badge.tsx          ← Category color badges (light + dark)
    types.ts                    ← Shared explorer TypeScript types
lib/
  auth.ts                       ← NextAuth config (GitHub provider + Prisma adapter)
  db.ts                         ← Prisma client singleton
  itinerary-routing.ts          ← Geographic clustering, nearest-neighbour, & 2-opt path optimizer
  maps-links.ts                 ← Zero-API-key Google Maps place & multi-stop day route URL builders
  preferences.ts                ← LocalStorage-backed user preferences store (useSyncExternalStore)
  redis.ts                      ← Optional Redis client (2s connect timeout, graceful fallback)
  theme.ts                      ← Shared light/dark/system theme store & live OS preference sync
types/
  next-auth.d.ts                ← NextAuth Session user.id type augmentation
prisma/
  schema.prisma                 ← PostgreSQL schema
```

---

## Key Design Notes

- **Two-level caching.** OpenTripMap POI queries are cached in PostgreSQL (`PlacesQueryCache`) for 6 hours. Per-user reads (`/api/saved`, `/api/itineraries`, `/api/itineraries/[id]/items`) are optionally cached in Redis (60s–5min TTL) and invalidated on writes; if Redis is unset or unreachable, requests fall back cleanly to Postgres.
- **Geographic itinerary generation.** Places with coordinates are sorted by polar angle around their centroid (with `cos(lat)` scaling) and sliced into contiguous geographic arcs per day, trimmed to `perDay`, then ordered within each day via nearest-neighbour search refined with open-path 2-opt local search (true Euclidean `cos(lat)`-scaled distance). Enabling `shuffle` rotates the sweep start angle, samples oversized day buckets randomly while preserving arc order, and randomizes path starting/direction variation without introducing backtracking.
- **AI chat side-effect contract.** `/api/chat` does not mutate client state directly — Gemini invokes `search_city`, `create_itinerary`, and `generate_itinerary`, and the endpoint returns a `sideEffects[]` array that the client executes against the UI and APIs.
- **Single-page workspace.** Search, saved places, itinerary planning, and the AI assistant share state inside `SearchPanel` so actions in one panel (or from the chat assistant) update the rest of the workspace immediately.

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server at http://localhost:3000 |
| `pnpm build` | Production build |
| `pnpm lint` | Run ESLint |
| `pnpm prisma migrate dev` | Apply pending DB migrations |
| `pnpm prisma studio` | Open visual DB browser |
