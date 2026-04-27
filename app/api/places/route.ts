export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const OPENTRIPMAP_KEY = process.env.OPENTRIPMAP_API_KEY ?? "";

// Focused tourism/travel categories — broad enough to cover major attractions,
// narrow enough to exclude irrelevant commercial POIs
const KINDS = [
  "interesting_places",
  "cultural",
  "historic",
  "museums",
  "architecture",
  "natural",
  "amusements",
  "religion",
  "foods",
].join(",");

// Priority order for picking a display category from OpenTripMap's kinds string
const CATEGORY_PRIORITY = [
  "museums",
  "historic",
  "architecture",
  "cultural",
  "natural",
  "amusements",
  "religion",
  "foods",
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

type NominatimResult = { lat: string; lon: string };

type OtmPlace = {
  xid: string;
  name: string;
  dist: number;
  rate: number;
  kinds: string;
  point: { lon: number; lat: number };
};

function categoryFromKinds(kinds: string): string | undefined {
  const list = kinds.split(",").map((k) => k.trim().toLowerCase());
  for (const p of CATEGORY_PRIORITY) {
    if (list.includes(p)) return p.charAt(0).toUpperCase() + p.slice(1);
  }
  const fallback = list.find(
    (k) => k !== "interesting_places" && k !== "tourist_facilities" && k !== "other"
  );
  return fallback ? fallback.charAt(0).toUpperCase() + fallback.slice(1) : undefined;
}

function cacheKeyForPlaces(q: string, limit: number, radius: number) {
  const nq = q.trim().toLowerCase();
  return `places:otm:v1:${nq}:limit=${limit}:radius=${radius}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 50);

  if (!q) return NextResponse.json([]);

  if (!OPENTRIPMAP_KEY) {
    return NextResponse.json(
      { error: "OpenTripMap API key not configured" },
      { status: 500 }
    );
  }

  const radius = 5000;
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
  const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
  const geoRes = await fetch(geoUrl, {
    headers: { "User-Agent": "local-explorer-itinerary-planner (dev)" },
    cache: "no-store",
  });

  if (!geoRes.ok) {
    return NextResponse.json({ error: "Geocoding failed" }, { status: 502 });
  }

  const geo = (await geoRes.json()) as NominatimResult[];
  if (!geo.length) return NextResponse.json([]);

  const lat = Number(geo[0].lat);
  const lon = Number(geo[0].lon);

  // 2. Fetch POIs from OpenTripMap
  // Note: kinds must use literal commas — URLSearchParams encodes them as %2C which OTM rejects
  const otmUrl =
    `https://api.opentripmap.com/0.1/en/places/radius` +
    `?apikey=${encodeURIComponent(OPENTRIPMAP_KEY)}` +
    `&radius=${radius}` +
    `&lon=${lon}` +
    `&lat=${lat}` +
    `&kinds=${KINDS}` +
    `&limit=${limit}` +
    `&rate=1` +
    `&format=json` +
    `&lang=en`;

  const otmRes = await fetch(otmUrl, { cache: "no-store" });

  if (!otmRes.ok) {
    const text = await otmRes.text().catch(() => "");
    return NextResponse.json(
      { error: "Places query failed", details: text.slice(0, 200) },
      { status: 502 }
    );
  }

  const otmData = (await otmRes.json()) as OtmPlace[];

  const results: Place[] = otmData
    .filter((p) => p.name && p.name.trim().length > 0)
    .sort((a, b) => b.rate - a.rate || a.dist - b.dist)
    .map((p) => {
      const category = categoryFromKinds(p.kinds);
      const out: Place = {
        provider: "osm",
        providerId: p.xid,
        name: p.name.trim(),
        address: "",
        ...(category ? { category } : {}),
        ...(typeof p.point?.lat === "number" ? { lat: p.point.lat } : {}),
        ...(typeof p.point?.lon === "number" ? { lon: p.point.lon } : {}),
      };
      return out;
    });

  // Cache write — 6 hour TTL
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 6);

  await prisma.placesQueryCache.upsert({
    where: { key },
    update: { results, expiresAt, lat, long: lon, limit, radius, q: q.trim().toLowerCase() },
    create: { key, q: q.trim().toLowerCase(), limit, radius, lat, long: lon, results, expiresAt },
  });

  return NextResponse.json(results, { headers: { "x-cache": "MISS" } });
}
