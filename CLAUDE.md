# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow Rules

- **Plan before code**: For every coding task, present a written plan (files to change, approach, edge cases) and wait for explicit user approval before writing any code.
- **Show your changes**: After writing code, summarize every file that was modified and what changed in each.

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
- `REDIS_URL` (optional) — Redis URL (e.g. `redis://localhost:6379`); caching is silently skipped if unset

## Architecture

### Overview
Single-page Next.js 15 (App Router) app. The entire UI is one large `SearchPanel` client component at `components/ui/explorer/search-panel.tsx`. Auth uses NextAuth v4 with GitHub OAuth and database sessions persisted via Prisma.

### Data Sources
- **Places**: OpenStreetMap data fetched at search time via Nominatim (geocoding) + Overpass API (POIs). No API key required. Multiple Overpass mirror endpoints are tried in sequence with radius fallback (5000m → 2500m → 1500m).
- **Places cache**: Overpass results are cached in Postgres (`PlacesQueryCache`) with a 6-hour TTL to avoid hammering OSM endpoints.

### Caching Layers
Two independent layers:
1. **Postgres** (`PlacesQueryCache` model) — caches raw Overpass query results. Key format: `places:v1:{query}:limit={n}:radius={r}`.
2. **Redis** (`lib/redis.ts`) — optional; caches per-user API responses. Keys:
   - `saved:v1:user:{userId}` (60s TTL)
   - `itineraries:v1:user:{userId}` (60s TTL)
   - `itineraryItems:v1:user={userId}:itinerary={id}` (5min TTL)
   
   `getRedis()` returns `null` if `REDIS_URL` is unset or Redis is unreachable — all callers must handle `null` gracefully. Redis cache is invalidated on any write mutation to the corresponding resource.

### API Routes
All routes under `app/api/` use `export const runtime = "nodejs"` and require authentication except `/api/places` (public search) and `/api/auth/[...nextauth]`.

| Route | Methods | Description |
|---|---|---|
| `/api/places` | GET | Search POIs via OSM; query param `q` (city/neighbourhood), optional `limit` (max 25) |
| `/api/saved` | GET, POST, DELETE | User's saved places; DELETE accepts `{ placeId }` or `{ all: true }` |
| `/api/itineraries` | GET, POST | List/create itineraries; title unique per user (P2002 → 409) |
| `/api/itineraries/[id]/items` | GET, POST, DELETE | Items for a specific itinerary |
| `/api/itineraries/[id]/generate` | POST | Auto-generate schedule from saved places (see below) |

### Itinerary Generation Algorithm (`app/api/itineraries/[id]/generate/route.ts`)
1. Loads user's saved places (optionally filtered to selected `placeIds`).
2. Only places with lat/lon are eligible.
3. Assigns places to days:
   - If ≥2 places have coords: sort by polar angle around the centroid (geographic sweep), then round-robin across days.
   - Otherwise: sort by category then name, round-robin.
4. Orders places within each day using nearest-neighbour greedy on Euclidean distance.
5. Body params: `mode` (`"replace"` | `"append"`), `perDay` (1–8, default 3), `shuffle` (bool), `placeIds` (optional string array).

### Database Schema (Prisma / PostgreSQL)
Key models:
- `User`, `Account`, `Session`, `VerificationToken` — standard NextAuth models
- `Place` — OSM POI; unique on `(provider, providerId)`
- `SavedPlace` — join table between `User` and `Place`; unique on `(savedById, placeId)`
- `Itinerary` — named trip; unique on `(userId, title)`
- `ItineraryItem` — indexed on `(itineraryId, dayIndex, order)`
- `PlacesQueryCache` — Overpass result cache; indexed on `expiresAt`

### Auth Pattern
All protected API routes call `getServerSession(authOptions)` and extract `(session.user as any).id`. The `id` is injected in `lib/auth.ts` via the `session` callback. Auth provider: GitHub only.

### UI Component Structure
- `app/page.tsx` — renders `<SearchPanel />`
- `app/providers.tsx` — wraps app in `<SessionProvider>`
- `app/layout.tsx` — root layout (not listed, but implied)
- `components/ui/explorer/search-panel.tsx` — all application state and UI
- `components/explorer/auth-button.tsx` — sign in/out button
- `components/ui/` — shadcn/ui primitives (Badge, Button, Card, Input, Separator)
