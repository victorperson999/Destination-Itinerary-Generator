export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const OPENTRIPMAP_KEY = process.env.OPENTRIPMAP_API_KEY ?? "";

// 15 km radius covers major metropolitan districts (e.g. Asakusa, Shibuya, Shinjuku,
// Tsukiji, and Imperial Palace in Tokyo) instead of only the immediate city-center block.
const DEFAULT_RADIUS_METERS = 15000;

// Focused visitor-attraction kinds — intentionally excludes catch-all `interesting_places`
// (which drags in railway stations, viaduct segments, and industrial facilities) and keeps
// `foods` in a separate capped query so eateries never crowd out major sights.
const LANDMARK_KINDS = [
  "cultural",
  "historic",
  "museums",
  "natural",
  "amusements",
  "religion",
  "gardens_and_parks",
  "view_points",
  "palaces",
  "castles",
  "monuments",
  "historic_architecture",
  "marketplaces",
].join(",");

const FOOD_KINDS = "foods";

const HIGH_SIGNAL_VISITOR_KINDS = new Set([
  "marketplaces",
  "museums",
  "religion",
  "gardens_and_parks",
  "natural",
  "amusements",
  "view_points",
  "castles",
  "palaces",
  "cultural",
]);

// Attraction kinds strong enough to rescue a POI housed inside a transit or industrial building
// (e.g. "Tokyo Station Gallery" museum), while still filtering raw stations tagged with `view_points`/`foods`.
const RESCUE_ATTRACTION_KINDS = new Set([
  "marketplaces",
  "museums",
  "religion",
  "castles",
  "palaces",
  "amusements",
  "cultural",
]);

const NOISE_KINDS = new Set([
  "railway_stations",
  "industrial_facilities",
  "transport",
  "metro",
]);

const SKIP_FALLBACK_KINDS = new Set([
  "interesting_places",
  "tourist_facilities",
  "other",
  "unclassified_objects",
  "railway_stations",
  "industrial_facilities",
  "transport",
  "metro",
  "destroyed_objects",
  "urban_environment",
  "other_buildings_and_structures",
]);

const KIND_TO_CATEGORY: ReadonlyArray<[string, string]> = [
  ["marketplaces", "Markets"],
  ["museums", "Museums"],
  ["religion", "Religion"],
  ["gardens_and_parks", "Natural"],
  ["natural", "Natural"],
  ["view_points", "Viewpoints"],
  ["amusements", "Amusements"],
  ["castles", "Historic"],
  ["palaces", "Historic"],
  ["monuments", "Historic"],
  ["historic", "Historic"],
  ["historic_architecture", "Architecture"],
  ["architecture", "Architecture"],
  ["cultural", "Cultural"],
  ["foods", "Foods"],
];

type Place = {
  provider: "osm";
  providerId: string;
  name: string;
  address: string;
  category?: string;
  lat?: number;
  lon?: number;
};

type NominatimAddress = {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  island?: string;
  archipelago?: string;
  county?: string;
  state_district?: string;
  state?: string;
  province?: string;
  region?: string;
  country?: string;
};

type NominatimResult = {
  lat: string;
  lon: string;
  display_name?: string;
  address?: NominatimAddress;
};

type OtmPlace = {
  xid: string;
  name: string;
  dist: number;
  rate: number;
  kinds: string;
  point: { lon: number; lat: number };
};

type OtmFetchResult =
  | { ok: true; data: OtmPlace[] }
  | { ok: false; status: 502 | 504; error: string; details?: string };

function locationContextFromNominatim(result: NominatimResult, fallbackQuery: string): string {
  const addr = result.address;
  const locality = (
    addr?.city ||
    addr?.town ||
    addr?.village ||
    addr?.municipality ||
    addr?.island ||
    addr?.archipelago ||
    addr?.county ||
    ""
  ).trim();
  const region = (
    addr?.state ||
    addr?.province ||
    addr?.region ||
    addr?.state_district ||
    ""
  ).trim();
  const country = (addr?.country || "").trim();

  if (locality || region) {
    const segments: string[] = [];
    for (const part of [locality, region, country]) {
      if (part && !segments.some((s) => s.toLowerCase() === part.toLowerCase())) {
        segments.push(part);
      }
    }
    if (segments.length > 0) return segments.join(", ");
  }

  const parts = (result.display_name ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0];
    const last = parts[parts.length - 1];
    return first.toLowerCase() === last.toLowerCase() ? first : `${first}, ${last}`;
  }
  return parts[0] || country || fallbackQuery.trim();
}

function parseKinds(kinds: string | undefined): string[] {
  if (!kinds) return [];
  return kinds
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
}

function categoryFromKinds(kinds: string): string | undefined {
  const list = parseKinds(kinds);
  const set = new Set(list);
  for (const [kind, label] of KIND_TO_CATEGORY) {
    if (set.has(kind)) return label;
  }
  const fallback = list.find((k) => !SKIP_FALLBACK_KINDS.has(k));
  return fallback ? fallback.charAt(0).toUpperCase() + fallback.slice(1) : undefined;
}

function normalizeName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function safeRate(p: OtmPlace): number {
  return typeof p.rate === "number" && Number.isFinite(p.rate) ? p.rate : 0;
}

function safeDist(p: OtmPlace): number {
  return typeof p.dist === "number" && Number.isFinite(p.dist)
    ? p.dist
    : Number.POSITIVE_INFINITY;
}

function isNoisyPoi(p: OtmPlace, isFoodPool = false): boolean {
  const norm = normalizeName(p.name ?? "");
  if (!norm) return true;

  const list = parseKinds(p.kinds);
  const hasNoiseKind = list.some((k) => NOISE_KINDS.has(k));
  if (hasNoiseKind) {
    if (isFoodPool) return true;
    return !list.some((k) => RESCUE_ATTRACTION_KINDS.has(k));
  }

  // Some metro/rail stops are tagged with `foods` in OSM without `railway_stations`
  if (isFoodPool && /\bstation\b$/i.test(norm)) {
    return true;
  }

  return false;
}

function landmarkTierScore(p: OtmPlace): number {
  const list = parseKinds(p.kinds);
  const isHighSignal = list.some((k) => HIGH_SIGNAL_VISITOR_KINDS.has(k));
  const isGenericBuilding = list.includes("other_buildings_and_structures");
  const rate = safeRate(p);

  if (isHighSignal && rate >= 7) return 6;
  if (isHighSignal && rate >= 3) return 5;
  if (!isGenericBuilding && rate >= 7) return 4;
  if (!isGenericBuilding && rate >= 3) return 3;
  if (isHighSignal) return 2;
  if (!isGenericBuilding) return 1;
  return 0;
}

function dedupeAndSort(
  items: OtmPlace[],
  compare: (a: OtmPlace, b: OtmPlace) => number,
  options?: {
    isFoodPool?: boolean;
    excludeXids?: Set<string>;
    excludeNames?: Set<string>;
  }
): OtmPlace[] {
  const isFoodPool = options?.isFoodPool ?? false;
  const sorted = items
    .filter((p) => !isNoisyPoi(p, isFoodPool))
    .sort(compare);

  const seenXids = new Set<string>(options?.excludeXids);
  const seenNames = new Set<string>(options?.excludeNames);
  const out: OtmPlace[] = [];

  for (const p of sorted) {
    if (!p.xid || seenXids.has(p.xid)) continue;
    const norm = normalizeName(p.name);
    if (!norm || seenNames.has(norm)) continue;
    seenXids.add(p.xid);
    seenNames.add(norm);
    out.push(p);
  }
  return out;
}

async function fetchOtmRadius(params: {
  lat: number;
  lon: number;
  radius: number;
  kinds: string;
  limit: number;
  rate: "3h" | "3" | "2" | "1";
}): Promise<OtmFetchResult> {
  // Note: kinds must use literal commas — URLSearchParams encodes them as %2C which OTM rejects
  const otmUrl =
    `https://api.opentripmap.com/0.1/en/places/radius` +
    `?apikey=${encodeURIComponent(OPENTRIPMAP_KEY)}` +
    `&radius=${params.radius}` +
    `&lon=${params.lon}` +
    `&lat=${params.lat}` +
    `&kinds=${params.kinds}` +
    `&limit=${params.limit}` +
    `&rate=${params.rate}` +
    `&format=json` +
    `&lang=en`;

  try {
    const otmRes = await fetch(otmUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!otmRes.ok) {
      const text = await otmRes.text().catch(() => "");
      return {
        ok: false,
        status: 502,
        error: "Places query failed",
        details: text.slice(0, 200),
      };
    }
    const parsed = (await otmRes.json()) as unknown;
    if (!Array.isArray(parsed)) {
      return { ok: false, status: 502, error: "Places query returned invalid data" };
    }
    return { ok: true, data: parsed as OtmPlace[] };
  } catch (e) {
    const isTimeout = e instanceof Error && e.name === "TimeoutError";
    return {
      ok: false,
      status: isTimeout ? 504 : 502,
      error: isTimeout ? "Places query timed out" : "Places query failed",
    };
  }
}

function cacheKeyForPlaces(q: string, limit: number, radius: number) {
  const nq = q.trim().toLowerCase();
  return `places:otm:v5:${nq}:limit=${limit}:radius=${radius}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const rawLimit = Number(searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(rawLimit)
    ? Math.max(1, Math.min(Math.trunc(rawLimit), 50))
    : 50;

  if (!q) return NextResponse.json([]);

  if (!OPENTRIPMAP_KEY) {
    return NextResponse.json(
      { error: "OpenTripMap API key not configured" },
      { status: 500 }
    );
  }

  const radius = DEFAULT_RADIUS_METERS;
  const key = cacheKeyForPlaces(q, limit, radius);

  // Cache lookup
  const cached = await prisma.placesQueryCache.findUnique({ where: { key } });
  if (cached && cached.expiresAt.getTime() > Date.now()) {
    if (!Array.isArray(cached.results)) {
      await prisma.placesQueryCache.delete({ where: { key } });
    } else {
      return NextResponse.json(cached.results as unknown as Place[], {
        headers: { "x-cache": "HIT" },
      });
    }
  }

  // 1. Geocode with Nominatim
  const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&accept-language=en&limit=1&q=${encodeURIComponent(q)}`;
  let geo: NominatimResult[];
  try {
    const geoRes = await fetch(geoUrl, {
      headers: { "User-Agent": "local-explorer-itinerary-planner (dev)" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!geoRes.ok) {
      return NextResponse.json({ error: "Geocoding failed" }, { status: 502 });
    }
    const parsed = (await geoRes.json()) as unknown;
    if (!Array.isArray(parsed)) {
      return NextResponse.json({ error: "Geocoding returned invalid data" }, { status: 502 });
    }
    geo = parsed as NominatimResult[];
  } catch (e) {
    const isTimeout = e instanceof Error && e.name === "TimeoutError";
    return NextResponse.json(
      { error: isTimeout ? "Geocoding request timed out" : "Geocoding request failed" },
      { status: isTimeout ? 504 : 502 }
    );
  }

  if (!geo.length) return NextResponse.json([]);

  const lat = Number(geo[0].lat);
  const lon = Number(geo[0].lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "Geocoding returned invalid coordinates" }, { status: 502 });
  }
  const locationContext = locationContextFromNominatim(geo[0], q);

  // 2. Fetch high-prominence landmarks (heritage 3h across full 15 km + popular rate 3)
  //    plus notable rate=3 food spots in parallel so eateries never crowd out major sights.
  const [heritageRes, popularRes, foodsRes] = await Promise.all([
    fetchOtmRadius({ lat, lon, radius, kinds: LANDMARK_KINDS, limit: 150, rate: "3h" }),
    fetchOtmRadius({ lat, lon, radius, kinds: LANDMARK_KINDS, limit: 150, rate: "3" }),
    fetchOtmRadius({ lat, lon, radius, kinds: FOOD_KINDS, limit: 40, rate: "3" }),
  ]);

  // If both landmark fetches fail, surface the upstream error instead of falling back to low-rate or foods-only results.
  if (!heritageRes.ok && !popularRes.ok) {
    const err = popularRes;
    return NextResponse.json(
      { error: err.error, ...(err.details ? { details: err.details } : {}) },
      { status: err.status }
    );
  }

  let hadPartialFailure = !heritageRes.ok || !popularRes.ok || !foodsRes.ok;

  const rawLandmarks: OtmPlace[] = [
    ...(heritageRes.ok ? heritageRes.data : []),
    ...(popularRes.ok ? popularRes.data : []),
  ];
  const rawFoods: OtmPlace[] = foodsRes.ok ? foodsRes.data : [];

  const compareLandmarks = (a: OtmPlace, b: OtmPlace) =>
    landmarkTierScore(b) - landmarkTierScore(a) ||
    safeRate(b) - safeRate(a) ||
    safeDist(a) - safeDist(b);
  const compareFoods = (a: OtmPlace, b: OtmPlace) =>
    safeRate(b) - safeRate(a) || safeDist(a) - safeDist(b);

  let landmarks = dedupeAndSort(rawLandmarks, compareLandmarks);

  // Graceful fallback for smaller towns where fewer than 15 landmarks reach rate=3 prominence
  if (landmarks.length < Math.min(15, limit)) {
    const tier2 = await fetchOtmRadius({
      lat,
      lon,
      radius,
      kinds: LANDMARK_KINDS,
      limit: 100,
      rate: "2",
    });
    if (!tier2.ok) {
      hadPartialFailure = true;
    } else if (tier2.data.length > 0) {
      landmarks = dedupeAndSort([...rawLandmarks, ...tier2.data], compareLandmarks);
    }
    if (landmarks.length < Math.min(8, limit)) {
      const tier1 = await fetchOtmRadius({
        lat,
        lon,
        radius,
        kinds: LANDMARK_KINDS,
        limit: 100,
        rate: "1",
      });
      if (!tier1.ok) {
        hadPartialFailure = true;
      } else if (tier1.data.length > 0) {
        landmarks = dedupeAndSort([...landmarks, ...tier1.data], compareLandmarks);
      }
    }
  }

  // Reserve up to 20% of slots (max 10) for notable Food & Drink spots, giving the rest to landmarks.
  const maxFoodSlots = limit >= 5 ? Math.min(10, Math.floor(limit * 0.2)) : 0;
  const landmarkTarget = Math.max(limit - maxFoodSlots, limit - rawFoods.length);
  const pickedLandmarks = landmarks.slice(0, landmarkTarget);

  const usedXids = new Set(pickedLandmarks.map((p) => p.xid));
  const usedNames = new Set(pickedLandmarks.map((p) => normalizeName(p.name)));

  const dedupedFoods = dedupeAndSort(rawFoods, compareFoods, {
    isFoodPool: true,
    excludeXids: usedXids,
    excludeNames: usedNames,
  });

  const remainingForFood = Math.max(0, limit - pickedLandmarks.length);
  const pickedFoods = dedupedFoods.slice(0, remainingForFood);

  for (const f of pickedFoods) {
    usedXids.add(f.xid);
    usedNames.add(normalizeName(f.name));
  }

  // If fewer food spots existed than reserved, top up with additional unique landmarks up to `limit`
  const extraLandmarksNeeded = Math.max(
    0,
    limit - pickedLandmarks.length - pickedFoods.length
  );
  const extraLandmarks =
    extraLandmarksNeeded > 0
      ? landmarks
          .slice(pickedLandmarks.length)
          .filter((p) => !usedXids.has(p.xid) && !usedNames.has(normalizeName(p.name)))
          .slice(0, extraLandmarksNeeded)
      : [];

  const toPlace = (p: OtmPlace, forcedCategory?: string): Place => {
    const category = forcedCategory ?? categoryFromKinds(p.kinds);
    return {
      provider: "osm",
      providerId: p.xid,
      name: p.name.trim(),
      address: locationContext,
      ...(category ? { category } : {}),
      ...(typeof p.point?.lat === "number" ? { lat: p.point.lat } : {}),
      ...(typeof p.point?.lon === "number" ? { lon: p.point.lon } : {}),
    };
  };

  const results: Place[] = [
    ...pickedLandmarks.map((p) => toPlace(p)),
    ...extraLandmarks.map((p) => toPlace(p)),
    ...pickedFoods.map((p) => toPlace(p, "Foods")),
  ];

  // Backfill empty addresses on previously saved places matched by this search
  if (locationContext && results.length > 0) {
    await prisma.place.updateMany({
      where: {
        provider: "osm",
        providerId: { in: results.map((r) => r.providerId) },
        OR: [{ address: null }, { address: "" }],
      },
      data: { address: locationContext },
    });
  }

  // Only cache complete responses — never poison the 6-hour cache with partial upstream failures
  if (!hadPartialFailure) {
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 6);
    await prisma.placesQueryCache.upsert({
      where: { key },
      update: { results, expiresAt, lat, long: lon, limit, radius, q: q.trim().toLowerCase() },
      create: { key, q: q.trim().toLowerCase(), limit, radius, lat, long: lon, results, expiresAt },
    });
  }

  return NextResponse.json(results, {
    headers: { "x-cache": hadPartialFailure ? "BYPASS" : "MISS" },
  });
}
