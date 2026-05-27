# Graph Report - .  (2026-05-26)

## Corpus Check
- Corpus is ~13,361 words - fits in a single context window. You may not need a graph.

## Summary
- 124 nodes · 169 edges · 17 communities (13 shown, 4 thin omitted)
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 24 edges (avg confidence: 0.87)
- Token cost: 60,696 input · 60,696 output

## Community Hubs (Navigation)
- [[_COMMUNITY_UI Primitives & Auth Widgets|UI Primitives & Auth Widgets]]
- [[_COMMUNITY_API Routes & Auth Backend|API Routes & Auth Backend]]
- [[_COMMUNITY_Architecture & Design Rationale|Architecture & Design Rationale]]
- [[_COMMUNITY_Database Schema & Migrations|Database Schema & Migrations]]
- [[_COMMUNITY_App Bootstrap & Dependencies|App Bootstrap & Dependencies]]
- [[_COMMUNITY_Places Search Pipeline|Places Search Pipeline]]
- [[_COMMUNITY_ESLint Configuration|ESLint Configuration]]
- [[_COMMUNITY_Prisma & Env Config|Prisma & Env Config]]
- [[_COMMUNITY_Claude Code Settings|Claude Code Settings]]
- [[_COMMUNITY_Page Entry|Page Entry]]
- [[_COMMUNITY_Local Postgres Service|Local Postgres Service]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]

## God Nodes (most connected - your core abstractions)
1. `SearchPanel root component` - 20 edges
2. `lib/db.ts (prisma client)` - 11 edges
3. `/api/chat route` - 10 edges
4. `/api/itineraries/[id]/generate route` - 10 edges
5. `lib/auth.ts (authOptions)` - 10 edges
6. `/api/saved route` - 9 edges
7. `lib/utils.ts (cn helper)` - 9 edges
8. `/api/itineraries route` - 8 edges
9. `/api/itineraries/[id]/items route` - 8 edges
10. `next-auth` - 8 edges

## Surprising Connections (you probably didn't know these)
- `lib/db.ts (prisma client)` --references--> `Postgres DB service (docker-compose)`  [INFERRED]
  lib/db.ts → docker-compose.yml
- `Itinerary generation algorithm (polar sweep + NN greedy)` --conceptually_related_to--> `generateItinerary() API helper`  [INFERRED]
  CLAUDE.md → components/ui/explorer/search-panel.tsx
- `handleChatSend() in SearchPanel` --implements--> `Side-effect contract (chat returns sideEffects[])`  [INFERRED]
  components/ui/explorer/search-panel.tsx → CLAUDE.md
- `Chat assistant tools (search_city, create_itinerary, generate_itinerary)` --conceptually_related_to--> `handleChatSend() in SearchPanel`  [INFERRED]
  CLAUDE.md → components/ui/explorer/search-panel.tsx
- `Tech stack (Next.js, Prisma, NextAuth, Gemini, pnpm)` --semantically_similar_to--> `CLAUDE.md project instructions`  [INFERRED] [semantically similar]
  README.md → CLAUDE.md

## Hyperedges (group relationships)
- **Chat route exposes Gemini function-calling tools** — api_chat_route, tool_search_city, tool_create_itinerary, tool_generate_itinerary, ext_gemini_model [EXTRACTED 1.00]
- **Auth flow: route -> authOptions -> Prisma adapter** — api_auth_nextauth_route, lib_auth_authoptions, ext_auth_prisma_adapter, lib_db_prisma [EXTRACTED 1.00]
- **Itinerary generation reads SavedPlace + Place, writes ItineraryItem** — api_itineraries_generate_route, prisma_model_savedPlace, prisma_model_place, prisma_model_itinerary, prisma_model_itineraryItem [EXTRACTED 1.00]
- **Saved section resize feature (state + drag handler + rationale)** — search_panel_saved_height_state, search_panel_drag_handler, claudemd_drag_reanchor [EXTRACTED 1.00]
- **NextAuth database models (User/Account/Session/VerificationToken)** — db_table_user, db_table_account, db_table_session, db_table_verification_token [EXTRACTED 1.00]
- **Itinerary generation flow (algorithm + client helper + tables)** — claudemd_itinerary_algorithm, search_panel_generate_itinerary, db_table_itinerary, db_table_itinerary_item, db_table_saved_place [EXTRACTED 1.00]

## Communities (17 total, 4 thin omitted)

### Community 0 - "UI Primitives & Auth Widgets"
Cohesion: 0.10
Nodes (25): AuthButton component, Badge UI primitive, badgeVariants (cva), Button UI primitive, buttonVariants (cva), Card UI primitives, Auth pattern (getServerSession + user.id injection), clsx (+17 more)

### Community 1 - "API Routes & Auth Backend"
Cohesion: 0.19
Nodes (24): /api/auth/[...nextauth] route, /api/chat route, /api/itineraries/[id]/generate route, /api/itineraries/[id]/items route, /api/itineraries route, /api/saved route, @auth/prisma-adapter, Gemini 2.5 Flash Lite model (+16 more)

### Community 2 - "Architecture & Design Rationale"
Cohesion: 0.12
Nodes (18): Chat assistant tools (search_city, create_itinerary, generate_itinerary), CLAUDE.md project instructions, Drag re-anchor pattern (cursor glued to divider), Itinerary generation algorithm (polar sweep + NN greedy), Side-effect contract (chat returns sideEffects[]), Two-layer caching architecture (Postgres + Redis), Workflow rules (plan before code; log session), PlacesQueryCache table (+10 more)

### Community 3 - "Database Schema & Migrations"
Cohesion: 0.15
Nodes (17): Account table, Itinerary table, ItineraryItem table, Place table, SavedPlace table, Session table, User table, VerificationToken table (+9 more)

### Community 4 - "App Bootstrap & Dependencies"
Cohesion: 0.14
Nodes (13): shadcn/ui components.json, app/globals.css, @google/generative-ai, lucide-react, next (framework), next-auth/react (SessionProvider), next/font/google (Geist), @prisma/client (+5 more)

### Community 5 - "Places Search Pipeline"
Cohesion: 0.33
Nodes (6): /api/places route, Nominatim (OSM geocoder), OpenTripMap API, Prisma model: PlacesQueryCache, ChatSideEffect: search, LLM tool: search_city

### Community 6 - "ESLint Configuration"
Cohesion: 0.50
Nodes (4): ESLint Config, eslint/config, eslint-config-next/typescript, eslint-config-next/core-web-vitals

### Community 7 - "Prisma & Env Config"
Cohesion: 0.67
Nodes (3): dotenv/config, prisma/config, Prisma Config

## Knowledge Gaps
- **45 isolated node(s):** `Next.js Config`, `payload.json (test fixture)`, `PostCSS Config`, `TypeScript Config`, `app/page.tsx (Home)` (+40 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `lib/utils.ts (cn helper)` connect `UI Primitives & Auth Widgets` to `App Bootstrap & Dependencies`?**
  _High betweenness centrality (0.417) - this node is a cross-community bridge._
- **Why does `shadcn/ui components.json` connect `App Bootstrap & Dependencies` to `UI Primitives & Auth Widgets`?**
  _High betweenness centrality (0.397) - this node is a cross-community bridge._
- **Why does `SearchPanel root component` connect `UI Primitives & Auth Widgets` to `Architecture & Design Rationale`, `Database Schema & Migrations`?**
  _High betweenness centrality (0.386) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `/api/itineraries/[id]/generate route` (e.g. with `ChatSideEffect: generate` and `/api/itineraries route`) actually correct?**
  _`/api/itineraries/[id]/generate route` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Next.js Config`, `payload.json (test fixture)`, `PostCSS Config` to the rest of the system?**
  _47 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `UI Primitives & Auth Widgets` be split into smaller, more focused modules?**
  _Cohesion score 0.10333333333333333 - nodes in this community are weakly interconnected._
- **Should `Architecture & Design Rationale` be split into smaller, more focused modules?**
  _Cohesion score 0.11695906432748537 - nodes in this community are weakly interconnected._