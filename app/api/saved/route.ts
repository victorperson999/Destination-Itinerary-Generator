export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

import { getRedis } from "@/lib/redis";
import { AwardIcon } from "lucide-react";

async function requireUserId() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return null;
  return userId
}

function savedCacheKey(userId: string){
  return `saved:v1:user:${userId}`;
}

const SAVED_TTL_SECONDS = 60;// can be tweaked later


export async function GET() {
  const userId = await requireUserId();
  if (!userId){
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = savedCacheKey(userId);
  // redis lookup:
  // redis lookup:
try {
  const r = await getRedis();
  if (r) {
    const cached = await r.get(key);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return NextResponse.json(parsed, { headers: { "x-cache": "HIT" } });
      } catch {
        // cache is corrupted / old format: delete and fall through to DB
        await r.del(key);
      }
    }
  }
} catch {
  // ignore and fall through to DB
}

  // DB query (MISS)
  const saved = await prisma.savedPlace.findMany({
    where: { savedById: userId },
    include: { place: true },
    orderBy: { createdAt: "desc" },
  });

  const payload = 
    saved.map((s) => ({
      placeId: s.placeId,
      savedId: s.id,
      provider: s.place.provider,
      providerId: s.place.providerId,
      name: s.place.name,
      address: s.place.address,
      category: s.place.category,
      lat: s.place.lat,
      lon: s.place.lon,
      createdAt: s.createdAt,
  }));

  // write to cache
  try {
    const r = await getRedis();
    if (r){
      await r.set(key, JSON.stringify(payload), { EX: SAVED_TTL_SECONDS });
    }
  } catch{
    // ignore cache fails for now...:(
  }
  return NextResponse.json(payload, { headers: {"x-cache": "MISS"}});
}

export async function POST(req: Request) {
  const userId = await requireUserId();

  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { provider, providerId, name, address, category, lat, lon } = body ?? {};

  if (!provider || !providerId || !name) {
    return NextResponse.json(
      { error: "provider, providerId, name required" },
      { status: 400 }
    );
  }

  const latNum = typeof lat === "number" ? lat : (typeof lat === "string" ? Number(lat) : null);
  const lonNum = typeof lon === "number" ? lon : (typeof lon === "string" ? Number(lon) : null);

  const place = await prisma.place.upsert({
    where: { provider_providerId: { provider, providerId } },
    update: { 
      name, 
      address: address ?? null, 
      category: category ?? null, 
      lat: Number.isFinite(latNum as number) ? (latNum as number) : null,
      lon: Number.isFinite(lonNum as number) ? (lonNum as number) : null,
    },
    create: {
      provider,
      providerId,
      name,
      address: address ?? null,
      category: category ?? null,
      lat: Number.isFinite(latNum as number) ? (latNum as number) : null,
      lon: Number.isFinite(lonNum as number) ? (lonNum as number) : null,
    },
  });

  await prisma.savedPlace.upsert({
    where: { savedById_placeId: { savedById: userId, placeId: place.id } },
    update: {},
    create: { savedById: userId, placeId: place.id },
  });
  // invalidate cache
  try {
    const r = await getRedis();
    if (r){
      await r.del(savedCacheKey(userId));
    }
  } catch {
    //...
  }
  return NextResponse.json({ ok: true, placeId: place.id });
}

export async function DELETE(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  type DeleteBody = { placeId?: string; all?: boolean };
  let body: DeleteBody = {};

  try {
    body = (await req.json()) as DeleteBody;
  } catch {
    body = {};
  }

  if (body.all) {
    const deleted = await prisma.savedPlace.deleteMany({
      where: { savedById: userId },
    });
    
    try{
      const r = await getRedis();
      if (r){
        await r.del(savedCacheKey(userId));
      }
    }catch{}
  return NextResponse.json({ ok: true, deleted: deleted.count });
  }

  const placeId = body.placeId;
  if (!placeId) {
    return NextResponse.json({ error: "placeId required" }, { status: 400 });
  }

  await prisma.savedPlace.delete({
    where: { savedById_placeId: { savedById: userId, placeId } },
  });

  try {
    const r = await getRedis();
    if (r){
      await r.del(savedCacheKey(userId));
    }
  }catch{}

  return NextResponse.json({ ok: true });
}
