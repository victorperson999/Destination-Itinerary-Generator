export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
  "https://overpass.nchc.org.tw/api/interpreter",
];

async function postOverpass(query: string, timeoutMs = 20000) {
  let lastErr: any = null;

  for (const url of OVERPASS_ENDPOINTS) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          "User-Agent": "local-explorer-itinerary-planner (dev)",
          "Accept": "application/json",
        },
        body: query,
        cache: "no-store",
        signal: ctrl.signal,
      });

      clearTimeout(t);

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        lastErr = {
          url,
          status: res.status,
          statusText: res.statusText,
          details: text.slice(0, 300),
        };
        continue; // try next endpoint
      }

      // Sometimes Overpass returns HTML even with 200; guard it
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) {
        const text = await res.text().catch(() => "");
        lastErr = { url, status: res.status, statusText: "Non-JSON response", details: text.slice(0, 300) };
        continue;
      }

      return await res.json();
    } catch (e: any) {
      clearTimeout(t);
      lastErr = { url, error: e?.name === "AbortError" ? "Timeout" : String(e) };
      continue;
    }
  }

  throw lastErr ?? new Error("All Overpass endpoints failed");
}

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

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements?: OverpassElement[];
};

function categoryFromTags(tags?: Record<string, string>): string | undefined {
  if (!tags) return undefined;
  const t = tags.tourism || tags.amenity || tags.leisure;
  if (!t) return undefined;

  const map: Record<string, string> = {
    museum: "Museum",
    attraction: "Attraction",
    gallery: "Gallery",
    park: "Park",
    cafe: "Cafe",
    restaurant: "Food",
  };

  return map[t] ?? (t.length ? t[0].toUpperCase() + t.slice(1) : undefined);
}

function addressFromTags(tags?: Record<string, string>): string {
  if (!tags) return "";
  const parts = [tags["addr:housenumber"], tags["addr:street"], tags["addr:city"]].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return tags["addr:full"] ?? "";
}

function cacheKeyForPlaces(q: string, limit: number, radius: number) {
  const nq = q.trim().toLowerCase();
  return `places:v1:${nq}:limit=${limit}:radius=${radius}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const limit = Math.min(Number(searchParams.get("limit") ?? 15), 15);

  if (!q) return NextResponse.json([]);

  const radius = 5000;
  const key = cacheKeyForPlaces(q, limit, radius);

  // cache lookup
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


  // 1) Geocode (Nominatim)
  const geoUrl =
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;

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

  // 2) Nearby POIs (Overpass) with fallback + radius shrink
  const radii = [radius, 2500, 1500];

  let data: OverpassResponse | null = null;
  let lastErr: any = null;

  let usedRadius = radius;

  for (const r of radii) {
    const overpassQuery = `
      [out:json][timeout:25];
      (
        node["name"]["tourism"~"attraction|museum|gallery"](around:${r},${lat},${lon});
        way["name"]["tourism"~"attraction|museum|gallery"](around:${r},${lat},${lon});
        relation["name"]["tourism"~"attraction|museum|gallery"](around:${r},${lat},${lon});
        node["name"]["leisure"="park"](around:${r},${lat},${lon});
      );
      out center ${limit};
      `;

      try {
        data = (await postOverpass(overpassQuery, 20000)) as OverpassResponse;
        usedRadius = r;
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        continue;
      }
    }

    if (!data) {
      return NextResponse.json(
        { error: "Places query failed", details: lastErr },
        { status: 502 }
      );
    }


  const elements = data.elements ?? [];

  const results: Place[] = elements.flatMap((el) => {
    const tags = el.tags;
    const name = tags?.name;
    if (!name) return [];

    const providerId = `${el.type}/${el.id}`;
    const cLat = typeof el.lat === "number" ? el.lat : el.center?.lat;
    const cLon = typeof el.lon === "number" ? el.lon : el.center?.lon;
    const category = categoryFromTags(tags);

    // Build with OPTIONAL fields omitted when undefined
    const out: Place = {
      provider: "osm",
      providerId,
      name,
      address: addressFromTags(tags),
      ...(category ? { category } : {}),
      ...(typeof cLat === "number" ? { lat: cLat } : {}),
      ...(typeof cLon === "number" ? { lon: cLon } : {}),
    };

    return [out];
  });
  
  // handle cache write (miss)
  const timeLimit = 1000*60*60*6;
  const expiresAt = new Date(Date.now() + timeLimit);

  await prisma.placesQueryCache.upsert({
    where: { key },
    update: { results, 
              expiresAt, 
              lat, 
              long: lon, 
              limit, 
              radius: usedRadius,
              q: q.trim().toLocaleLowerCase() 
            },
    create: { key, 
              q: q.trim().toLowerCase(), 
              limit, 
              radius: usedRadius,
              lat, 
              long: lon, 
              results,
              expiresAt
            },
  });

  return NextResponse.json(results, {
    headers: {"x-cache": "MISS"},
  });
}

