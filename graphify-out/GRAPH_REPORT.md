# Graph Report - C:\Users\victo\local-explorer-itinerary  (2026-06-09)

## Corpus Check
- 48 files · ~13,881 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 155 nodes · 188 edges · 21 communities (16 shown, 5 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.9)
- Token cost: 63,024 input · 5,572 output

## Community Hubs (Navigation)
- [[_COMMUNITY_API Routes & Chat Backend|API Routes & Chat Backend]]
- [[_COMMUNITY_SearchPanel Code Symbols|SearchPanel Code Symbols]]
- [[_COMMUNITY_SearchPanel UI Components|SearchPanel UI Components]]
- [[_COMMUNITY_Database Schema (Prisma)|Database Schema (Prisma)]]
- [[_COMMUNITY_Itinerary Generation Algorithm|Itinerary Generation Algorithm]]
- [[_COMMUNITY_shadcnui Primitives|shadcn/ui Primitives]]
- [[_COMMUNITY_Generate Route Symbols|Generate Route Symbols]]
- [[_COMMUNITY_App Shell & Framework Config|App Shell & Framework Config]]
- [[_COMMUNITY_Places Search Pipeline|Places Search Pipeline]]
- [[_COMMUNITY_ESLint Config|ESLint Config]]
- [[_COMMUNITY_Prisma Config|Prisma Config]]
- [[_COMMUNITY_README & Env Setup|README & Env Setup]]
- [[_COMMUNITY_Claude Settings|Claude Settings]]
- [[_COMMUNITY_Page Entry Wiring|Page Entry Wiring]]
- [[_COMMUNITY_Places Cache Migration|Places Cache Migration]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]

## God Nodes (most connected - your core abstractions)
1. `/api/chat route` - 10 edges
2. `lib/db.ts (prisma client)` - 10 edges
3. `/api/saved route` - 9 edges
4. `lib/auth.ts (authOptions)` - 9 edges
5. `lib/utils.ts (cn helper)` - 9 edges
6. `POST /api/itineraries/[id]/generate handler` - 9 edges
7. `SearchPanel component (root UI state)` - 9 edges
8. `/api/itineraries/[id]/items route` - 8 edges
9. `/api/itineraries route` - 7 edges
10. `/api/places route` - 7 edges

## Surprising Connections (you probably didn't know these)
- `lib/db.ts (prisma client)` --references--> `Postgres DB service (docker-compose)`  [INFERRED]
  lib/db.ts → docker-compose.yml
- `Itinerary Generation Algorithm (documented)` --conceptually_related_to--> `Contiguous Angle-Sweep Geographic Clustering`  [INFERRED]
  CLAUDE.md → app/api/itineraries/[id]/generate/route.ts
- `Itinerary Generation Algorithm (documented)` --conceptually_related_to--> `Order-Preserving Random Trim (sampleInOrder)`  [INFERRED]
  CLAUDE.md → app/api/itineraries/[id]/generate/route.ts
- `Chat Side-Effect Contract (documented)` --references--> `handleChatSend (chat round-trip + side-effect applier)`  [INFERRED]
  CLAUDE.md → components/ui/explorer/search-panel.tsx
- `Itinerary Generation Algorithm (documented)` --references--> `orderWithinDay (nearest-neighbour day ordering)`  [INFERRED]
  CLAUDE.md → app/api/itineraries/[id]/generate/route.ts

## Hyperedges (group relationships)
- **Shuffle-aware randomness pipeline (rotation + in-order trim + random NN start)** — generate_POST, generate_assignDays, generate_sampleInOrder, generate_orderWithinDay, generate_eligible_preshuffle [EXTRACTED 1.00]
- **Chat side-effect generate flow (LLM effect -> client apply -> generate route)** — search_panel_handleChatSend, search_panel_ChatSideEffect, search_panel_generateItinerary, generate_POST, claude_md_chat_side_effect_contract [INFERRED 0.95]

## Communities (21 total, 5 thin omitted)

### Community 0 - "API Routes & Chat Backend"
Cohesion: 0.12
Nodes (29): /api/auth/[...nextauth] route, /api/chat route, /api/itineraries/[id]/items route, /api/itineraries route, /api/saved route, docker-compose.yml (Postgres service), @auth/prisma-adapter, Gemini 2.5 Flash Lite model (+21 more)

### Community 1 - "SearchPanel Code Symbols"
Cohesion: 0.09
Nodes (9): CATEGORY_BADGE_CLASSES, ChatMessage, ChatPanelProps, ChatSideEffect, Itinerary, ItineraryItem, PlaceResult, SavedItem (+1 more)

### Community 2 - "SearchPanel UI Components"
Cohesion: 0.18
Nodes (15): Chat Side-Effect Contract (documented), Drag Re-Anchor Pattern, CategoryBadge component, ChatPanel component, ChatSideEffect type (search | refresh_itineraries | generate), SearchPanel component (root UI state), SearchResultsList component, createItinerary API helper (409 duplicate handling) (+7 more)

### Community 3 - "Database Schema (Prisma)"
Cohesion: 0.20
Nodes (14): Account table, Itinerary table, ItineraryItem table, Place table, SavedPlace table, Session table, User table, VerificationToken table (+6 more)

### Community 4 - "Itinerary Generation Algorithm"
Cohesion: 0.24
Nodes (13): Itinerary Generation Algorithm (documented), POST /api/itineraries/[id]/generate handler, Contiguous Angle-Sweep Geographic Clustering, assignDays (angle-sweep day distribution), dist2 (squared Euclidean distance), Pre-Shuffle Limitation of Eligible Places, itemsCacheKey (Redis itinerary-items cache key), orderWithinDay (nearest-neighbour day ordering) (+5 more)

### Community 5 - "shadcn/ui Primitives"
Cohesion: 0.15
Nodes (13): AuthButton component, Badge UI primitive, badgeVariants (cva), Button UI primitive, buttonVariants (cva), Card UI primitives, clsx, tailwind-merge (+5 more)

### Community 6 - "Generate Route Symbols"
Cohesion: 0.29
Nodes (8): assignDays(), dist2(), GenerateBody, itemsCacheKey(), orderWithinDay(), P, POST(), requireUserId()

### Community 7 - "App Shell & Framework Config"
Cohesion: 0.22
Nodes (9): shadcn/ui components.json, app/globals.css, lucide-react, next (framework), next-auth/react (SessionProvider), next/font/google (Geist), app/layout.tsx (RootLayout), Next.js Config (+1 more)

### Community 8 - "Places Search Pipeline"
Cohesion: 0.33
Nodes (6): /api/places route, Nominatim (OSM geocoder), OpenTripMap API, Prisma model: PlacesQueryCache, ChatSideEffect: search, LLM tool: search_city

### Community 9 - "ESLint Config"
Cohesion: 0.50
Nodes (4): ESLint Config, eslint/config, eslint-config-next/typescript, eslint-config-next/core-web-vitals

### Community 10 - "Prisma Config"
Cohesion: 0.67
Nodes (3): dotenv/config, prisma/config, Prisma Config

## Knowledge Gaps
- **56 isolated node(s):** `Next.js Config`, `payload.json (test fixture)`, `PostCSS Config`, `TypeScript Config`, `app/page.tsx (Home)` (+51 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `/api/saved route` connect `API Routes & Chat Backend` to `Places Search Pipeline`, `App Shell & Framework Config`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Why does `shadcn/ui components.json` connect `App Shell & Framework Config` to `shadcn/ui Primitives`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Why does `lib/utils.ts (cn helper)` connect `shadcn/ui Primitives` to `App Shell & Framework Config`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **What connects `Next.js Config`, `payload.json (test fixture)`, `PostCSS Config` to the rest of the system?**
  _60 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `API Routes & Chat Backend` be split into smaller, more focused modules?**
  _Cohesion score 0.11954022988505747 - nodes in this community are weakly interconnected._
- **Should `SearchPanel Code Symbols` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._