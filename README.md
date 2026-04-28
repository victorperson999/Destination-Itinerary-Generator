Local Explorer — Itinerary Planner
                                                                        
  A web app for discovering local points of interest and building       
  day-by-day travel itineraries. Search any city for restaurants, parks,
   museums, and more — then save places, create trips, and let the app  
  (or an AI assistant) arrange your schedule automatically.

  ---
  What it does

  1. Search — type a city or neighbourhood name to pull live points of
  interest from OpenStreetMap. No API key required for search.
  2. Save — bookmark places to your personal saved list while browsing
  results.
  3. Plan — create named itineraries (e.g. "Tokyo Trip, 5 days") and
  assign saved places to specific days.
  4. Auto-generate — hit Generate and the app sorts your saved places
  geographically and builds an optimised day-by-day route using a
  nearest-neighbour algorithm.
  5. AI assistant — a built-in chat panel (powered by Google Gemini) can
   search destinations, create itineraries, and trigger generation on
  your behalf via natural language.

  ---
  Tech Stack

  ┌───────────────┬─────────────────────────────────────────────────┐
  │     Layer     │                   Technology                    │
  ├───────────────┼─────────────────────────────────────────────────┤
  │ Framework     │ https://nextjs.org/ (App Router) + React 19     │
  ├───────────────┼─────────────────────────────────────────────────┤
  │ Language      │ TypeScript                                      │
  ├───────────────┼─────────────────────────────────────────────────┤
  │ Styling       │ Tailwind CSS v4 + https://ui.shadcn.com/        │
  ├───────────────┼─────────────────────────────────────────────────┤
  │ Database      │ PostgreSQL via https://www.prisma.io/           │
  ├───────────────┼─────────────────────────────────────────────────┤
  │ Cache         │ Redis (optional)                                │
  ├───────────────┼─────────────────────────────────────────────────┤
  │ Auth          │ https://next-auth.js.org/ — GitHub OAuth        │
  ├───────────────┼─────────────────────────────────────────────────┤
  │ Place data    │ OpenStreetMap — Nominatim (geocoding) +         │
  │               │ Overpass API (POIs)                             │
  ├───────────────┼─────────────────────────────────────────────────┤
  │ AI chat       │ Google Gemini 2.5 Flash Lite                    │
  │               │ (@google/generative-ai)                         │
  ├───────────────┼─────────────────────────────────────────────────┤
  │ Package       │ https://pnpm.io/                                │
  │ manager       │                                                 │
  └───────────────┴─────────────────────────────────────────────────┘

  ---
  Prerequisites

  - Node.js 18+
  - pnpm (npm install -g pnpm)
  - Docker (for PostgreSQL)
  - A https://github.com/settings/developers for authentication
  - A https://aistudio.google.com/app/apikey key for the chat assistant

  ---
  Getting Started

  1. Clone and install

  git clone <repo-url>
  cd local-explorer-itinerary
  pnpm install

  2. Set up environment variables

  Create a .env.local file in the project root:

  # PostgreSQL
  DATABASE_URL=postgresql://postgres:postgres@localhost:5432/local_explo
  rer

  # GitHub OAuth (create an app at github.com/settings/developers)
  GITHUB_ID=your_github_client_id
  GITHUB_SECRET=your_github_client_secret

  # NextAuth
  NEXTAUTH_URL=http://localhost:3000
  NEXTAUTH_SECRET=any_random_string_here

  # Google Gemini (for the AI chat assistant)
  GOOGLE_GENERATIVE_AI_KEY=your_gemini_api_key

  # Redis — optional; caching is silently skipped if unset
  # REDIS_URL=redis://localhost:6379

  3. Start the database

  docker compose up -d

  4. Run database migrations

  pnpm prisma migrate dev

  5. Start the dev server

  pnpm dev

  Open http://localhost:3000.

  ---
  Project Structure

  app/
    api/
      chat/           ← AI assistant endpoint (Gemini function calling)
      places/         ← OSM place search (public, no auth required)
      saved/          ← User's saved places (CRUD)
      itineraries/    ← Itinerary management + auto-generate schedule
    page.tsx          ← Entry point — renders <SearchPanel>
  components/
    ui/explorer/
      search-panel.tsx ← Entire app UI lives here (single client
  component)
  lib/
    auth.ts           ← NextAuth config
    db.ts             ← Prisma client singleton
    redis.ts          ← Optional Redis client (returns null if
  unconfigured)
  prisma/
    schema.prisma     ← Database schema

  ---
  Key Design Notes

  - No external place API key needed. All POI data comes from
  OpenStreetMap's free Overpass API, with automatic mirror fallback and
  radius reduction on timeout.
  - Two-level caching. Overpass query results are cached in Postgres for
   6 hours. Per-user API responses are optionally cached in Redis with
  short TTLs (60s–5min).
  - AI chat uses function calling. The Gemini model can invoke
  search_city, create_itinerary, and generate_itinerary as structured
  tool calls, which trigger real side-effects in the UI (live search
  results, new itinerary created, schedule generated).
  - Auth is GitHub only. Sessions are stored in the database via the
  Prisma adapter.

  ---
  Available Scripts

  pnpm dev                    # Start dev server at
  http://localhost:3000
  pnpm build                  # Production build
  pnpm lint                   # Run ESLint
  pnpm prisma migrate dev     # Apply pending DB migrations
  pnpm prisma studio          # Open visual DB browser

  ---
