export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getRedis } from "@/lib/redis";

function itinerariesCacheKey(userId: string) {
  return `itineraries:v1:user:${userId}`;
}

function itemsCacheKey(userId: string, itineraryId: string) {
  return `itineraryItems:v1:user=${userId}:itinerary=${itineraryId}`;
}

async function requireUserId() {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const itinerary = await prisma.itinerary.findFirst({ where: { id, userId } });
  if (!itinerary) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(itinerary);
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!isPlainObject(rawBody)) {
    return NextResponse.json({ error: "JSON object required" }, { status: 400 });
  }

  const data: { title?: string; daysCount?: number; startDate?: Date | null } = {};

  if ("title" in rawBody) {
    if (typeof rawBody.title !== "string" || !rawBody.title.trim()) {
      return NextResponse.json({ error: "Title must be a non-empty string" }, { status: 400 });
    }
    data.title = rawBody.title.trim();
  }

  if ("daysCount" in rawBody) {
    if (
      typeof rawBody.daysCount !== "number" ||
      !Number.isInteger(rawBody.daysCount) ||
      rawBody.daysCount < 1 ||
      rawBody.daysCount > 30
    ) {
      return NextResponse.json(
        { error: "daysCount must be an integer between 1 and 30" },
        { status: 400 }
      );
    }
    data.daysCount = rawBody.daysCount;
  }

  if ("startDate" in rawBody) {
    if (rawBody.startDate === null || rawBody.startDate === "") {
      data.startDate = null;
    } else if (typeof rawBody.startDate === "string") {
      const parsed = new Date(rawBody.startDate);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "Invalid startDate" }, { status: 400 });
      }
      data.startDate = parsed;
    } else {
      return NextResponse.json({ error: "Invalid startDate" }, { status: 400 });
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.itinerary.findFirst({ where: { id, userId } });
      if (!existing) return { notFound: true as const };

      const updated = await tx.itinerary.update({
        where: { id },
        data,
      });

      let itemsMoved = false;
      if (data.daysCount !== undefined) {
        const overflow = await tx.itineraryItem.findMany({
          where: { itineraryId: id, dayIndex: { gte: data.daysCount } },
          orderBy: [
            { dayIndex: "asc" },
            { order: "asc" },
            { createdAt: "asc" },
            { id: "asc" },
          ],
          select: { id: true },
        });

        if (overflow.length > 0) {
          itemsMoved = true;
          const lastDay = data.daysCount - 1;
          const lastOnTarget = await tx.itineraryItem.findFirst({
            where: { itineraryId: id, dayIndex: lastDay },
            orderBy: { order: "desc" },
            select: { order: true },
          });
          let nextOrder = (lastOnTarget?.order ?? -1) + 1;

          for (const row of overflow) {
            await tx.itineraryItem.update({
              where: { id: row.id },
              data: { dayIndex: lastDay, order: nextOrder++ },
            });
          }
        }
      }

      return { notFound: false as const, updated, itemsMoved };
    });

    if (result.notFound) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    try {
      const r = await getRedis();
      if (r) {
        const keys = [itinerariesCacheKey(userId)];
        if (result.itemsMoved) keys.push(itemsCacheKey(userId, id));
        await r.del(keys);
      }
    } catch {}

    return NextResponse.json(result.updated);
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "P2002") {
      return NextResponse.json(
        { error: "Itinerary with this name already exists" },
        { status: 409 }
      );
    }
    if (code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw e;
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  const deleted = await prisma.itinerary.deleteMany({
    where: { id, userId },
  });
  if (deleted.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const r = await getRedis();
    if (r) {
      await r.del([itinerariesCacheKey(userId), itemsCacheKey(userId, id)]);
    }
  } catch {}

  return NextResponse.json({ ok: true });
}
