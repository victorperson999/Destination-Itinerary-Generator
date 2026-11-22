export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

import { getRedis } from "@/lib/redis";

async function requireUserId() {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

const ITEMS_TTL_SECONDS = 60 *5;

function itemsCacheKey(userId: string, itineraryId: string){
    return `itineraryItems:v1:user=${userId}:itinerary=${itineraryId}`;
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }>}) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const key = itemsCacheKey(userId, id);
  const r1 = await getRedis();

    // cache lookup
  if (r1) {
    try {
        const hit = await r1.get(key);
        if (hit) {
        return NextResponse.json(JSON.parse(hit), { headers: { "x-cache": "HIT" } });
        }
    } catch {}
  }

  // Make sure itinerary belongs to user (miss case)
  const itinerary = await prisma.itinerary.findFirst({ where: { id, userId } });
  if (!itinerary) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const items = await prisma.itineraryItem.findMany({
    where: { itineraryId: id },
    include: { place: true },
    orderBy: [{ dayIndex: "asc" }, { order: "asc" }],
  });

  // write to cache
  const r2 = await getRedis();
  if (r2) {
    r2.set(key, JSON.stringify(items), { EX: ITEMS_TTL_SECONDS }).catch(() => {});
  }

  return NextResponse.json(items, { headers: { "x-cache": r2 ? "MISS" : "BYPASS" } });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }>}) {
    const userId = await requireUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await ctx.params;

    const itinerary = await prisma.itinerary.findFirst({ where: { id, userId } });
    if (!itinerary) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const raw = await req.text();

    let body: Record<string, unknown>;
    try {
        body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
        return NextResponse.json(
            { error: "Invalid JSON body", raw: raw.slice(0, 300) },
            { status: 400 }
        );
    }


    const placeId = typeof body?.placeId === "string" ? body.placeId.trim() : "";
    const dayIndex = Number(body?.dayIndex); // don't default yet

    if (!placeId) {
        return NextResponse.json(
            { error: "placeId required", received: body },
            { status: 400 }
        );
    }
    if (!Number.isInteger(dayIndex)) {
        return NextResponse.json({ error: "dayIndex required" }, { status: 400 });
    }
    if (dayIndex < 0 || dayIndex >= itinerary.daysCount) {
        return NextResponse.json({ error: "Invalid dayIndex" }, { status: 400 });
    }

    // append to end of that day
    const last = await prisma.itineraryItem.findFirst({
        where: { itineraryId: id, dayIndex },
        orderBy: { order: "desc" },
        select: { order: true },
    });
    const nextOrder = (last?.order ?? -1) + 1;

    const note = 
        typeof body?.note == "string" && body.note.trim().length > 0 
        ? body.note.trim() 
        : null;

    let created;
    try {
        created = await prisma.itineraryItem.create({
            data: { 
                itineraryId: id, 
                placeId, 
                dayIndex, 
                order: nextOrder, 
                note 
                },
            include: { place: true },
        });
    } catch (e: unknown) {
        if ((e as { code?: string })?.code === "P2003") {
            return NextResponse.json({ error: "Place not found" }, { status: 404 });
        }
        throw e;
    }
    try {
        const r = await getRedis();
        if (r) await r.del(itemsCacheKey(userId, id));
    } catch {}

    return NextResponse.json(created);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
    const userId = await requireUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await ctx.params;

    let rawBody: unknown;
    try {
        rawBody = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (typeof rawBody !== "object" || rawBody === null || Array.isArray(rawBody)) {
        return NextResponse.json({ error: "JSON object required" }, { status: 400 });
    }
    const body = rawBody as Record<string, unknown>;

    const itemId = typeof body.itemId === "string" ? body.itemId.trim() : "";
    if (!itemId) {
        return NextResponse.json({ error: "itemId required" }, { status: 400 });
    }

    const hasDayIndex = "dayIndex" in body;
    const hasOrder = "order" in body;
    const hasNote = "note" in body;
    if (!hasDayIndex && !hasOrder && !hasNote) {
        return NextResponse.json(
            { error: "At least one of dayIndex, order, or note is required" },
            { status: 400 }
        );
    }

    let parsedDayIndex: number | undefined;
    if (hasDayIndex) {
        if (
            typeof body.dayIndex !== "number" ||
            !Number.isInteger(body.dayIndex) ||
            body.dayIndex < 0
        ) {
            return NextResponse.json({ error: "Invalid dayIndex" }, { status: 400 });
        }
        parsedDayIndex = body.dayIndex;
    }

    let parsedOrder: number | undefined;
    if (hasOrder) {
        if (
            typeof body.order !== "number" ||
            !Number.isInteger(body.order) ||
            body.order < 0
        ) {
            return NextResponse.json({ error: "Invalid order" }, { status: 400 });
        }
        parsedOrder = body.order;
    }

    let parsedNote: string | null | undefined;
    if (hasNote) {
        if (body.note === null) {
            parsedNote = null;
        } else if (typeof body.note === "string") {
            const trimmed = body.note.trim();
            parsedNote = trimmed.length > 0 ? trimmed : null;
        } else {
            return NextResponse.json({ error: "Invalid note" }, { status: 400 });
        }
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            const itinerary = await tx.itinerary.findFirst({ where: { id, userId } });
            if (!itinerary) return { error: "Not found", status: 404 as const };

            if (parsedDayIndex !== undefined && parsedDayIndex >= itinerary.daysCount) {
                return { error: "Invalid dayIndex", status: 400 as const };
            }

            const item = await tx.itineraryItem.findFirst({
                where: { id: itemId, itineraryId: id },
                include: { place: true },
            });
            if (!item) return { error: "Item not found", status: 404 as const };

            const targetDay = parsedDayIndex ?? item.dayIndex;
            const needsMove = targetDay !== item.dayIndex || parsedOrder !== undefined;

            if (!needsMove) {
                if (hasNote && parsedNote !== item.note) {
                    const updated = await tx.itineraryItem.update({
                        where: { id: item.id },
                        data: { note: parsedNote },
                        include: { place: true },
                    });
                    return { status: 200 as const, item: updated };
                }
                return { status: 200 as const, item };
            }

            const orderBy = [
                { order: "asc" as const },
                { createdAt: "asc" as const },
                { id: "asc" as const },
            ];

            const sourceList = await tx.itineraryItem.findMany({
                where: { itineraryId: id, dayIndex: item.dayIndex },
                orderBy,
                select: { id: true, dayIndex: true, order: true, note: true },
            });

            const sourceRemaining = sourceList.filter((row) => row.id !== item.id);
            const movingRow = {
                id: item.id,
                dayIndex: item.dayIndex,
                order: item.order,
                note: item.note,
            };

            if (targetDay === item.dayIndex) {
                const insertAt = Math.min(parsedOrder!, sourceRemaining.length);
                sourceRemaining.splice(insertAt, 0, movingRow);

                for (let idx = 0; idx < sourceRemaining.length; idx++) {
                    const row = sourceRemaining[idx];
                    const nextNote = row.id === item.id && hasNote ? parsedNote! : row.note;
                    if (row.order !== idx || nextNote !== row.note) {
                        await tx.itineraryItem.update({
                            where: { id: row.id },
                            data: {
                                order: idx,
                                ...(row.id === item.id && hasNote ? { note: nextNote } : {}),
                            },
                        });
                    }
                }
            } else {
                const targetList = await tx.itineraryItem.findMany({
                    where: { itineraryId: id, dayIndex: targetDay },
                    orderBy,
                    select: { id: true, dayIndex: true, order: true, note: true },
                });

                const insertAt =
                    parsedOrder !== undefined
                        ? Math.min(parsedOrder, targetList.length)
                        : targetList.length;
                targetList.splice(insertAt, 0, movingRow);

                for (let idx = 0; idx < sourceRemaining.length; idx++) {
                    const row = sourceRemaining[idx];
                    if (row.order !== idx) {
                        await tx.itineraryItem.update({
                            where: { id: row.id },
                            data: { order: idx },
                        });
                    }
                }

                for (let idx = 0; idx < targetList.length; idx++) {
                    const row = targetList[idx];
                    const nextNote = row.id === item.id && hasNote ? parsedNote! : row.note;
                    if (row.dayIndex !== targetDay || row.order !== idx || nextNote !== row.note) {
                        await tx.itineraryItem.update({
                            where: { id: row.id },
                            data: {
                                dayIndex: targetDay,
                                order: idx,
                                ...(row.id === item.id && hasNote ? { note: nextNote } : {}),
                            },
                        });
                    }
                }
            }

            const updated = await tx.itineraryItem.findFirst({
                where: { id: item.id, itineraryId: id },
                include: { place: true },
            });
            if (!updated) return { error: "Item not found", status: 404 as const };

            return { status: 200 as const, item: updated };
        });

        if (result.status !== 200) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        try {
            const r = await getRedis();
            if (r) await r.del(itemsCacheKey(userId, id));
        } catch {}

        return NextResponse.json(result.item);
    } catch (e: unknown) {
        if ((e as { code?: string })?.code === "P2025") {
            return NextResponse.json({ error: "Item not found" }, { status: 404 });
        }
        throw e;
    }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }>}) {
    const userId = await requireUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await ctx.params;
    const itinerary = await prisma.itinerary.findFirst({ where: { id, userId } });
    if (!itinerary) return NextResponse.json({ error: "Not found" }, { status: 404 });

    let body: Record<string, unknown>;
    try {
        body = (await req.json()) as Record<string, unknown>;
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const itemId = body?.itemId as string | undefined;
    if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });

    await prisma.itineraryItem.deleteMany({
        where: { id: itemId, itineraryId: id },
    });

    try {
        const r = await getRedis();
        if (r) await r.del(itemsCacheKey(userId, id));
    } catch {}

    return NextResponse.json({ ok: true });
}
