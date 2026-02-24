export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

import { getRedis } from "@/lib/redis";

function itinerariesCacheKey(userId: string){
  return `itineraries:v1:user:${userId}`;
}
const ITINERARIES_TTL_SECONDS = 60;

async function requireUserId() {
  const session = await getServerSession(authOptions);
  const id = (session?.user as any)?.id as string | undefined;
  return id ?? null;
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = itinerariesCacheKey(userId);
  const r = await getRedis();
  // cache lookup
  if (r){
    try{
    const hit = await r.get(key);
    if (hit){
      const parsed = JSON.parse(hit);
      return NextResponse.json(parsed, { headers: { "x-cache": "HIT"}});
    }
    }catch{
      // ignore and fall to DB
    }
  }

  // DB lookup
  const itineraries = await prisma.itinerary.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  //write to cache
  if (r) {
    r.set(key, JSON.stringify(itineraries), { EX: ITINERARIES_TTL_SECONDS }).catch(() => {});
  }

  return NextResponse.json(itineraries, {
    headers: { "x-cache": r ? "MISS" : "BYPASS" },
  });
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const title = String(body?.title ?? "My Trip");
  const daysCount = Math.max(1, Math.min(Number(body?.daysCount ?? 3), 30));
  const startDate = body?.startDate ? new Date(body.startDate) : null;

  try {
    const created = await prisma.itinerary.create({
      data: { userId, title, daysCount, startDate },
    });

    const r = await getRedis();
    if (r){
      r.del(itinerariesCacheKey(userId)).catch(() => {});
    }
    
    return NextResponse.json(created);

  } catch (e: any){
      if (e?.code === "P2002") {
      return NextResponse.json(
        { error: "Itinerary with this name already exists" },
        { status: 409 }
      );
    }
    throw e;
  }

}

