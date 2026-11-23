export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getRedis } from "@/lib/redis";
import {
    assignDays,
    hasCoords,
    orderWithinDay,
    sampleInOrder,
} from "@/lib/itinerary-routing";

function itemsCacheKey(userId: string, itineraryId: string) {
  return `itineraryItems:v1:user=${userId}:itinerary=${itineraryId}`;
}

async function requireUserId() {
    const session = await getServerSession(authOptions);
    return session?.user?.id ?? null;
}

type GenerateBody = {
    placeIds?: string[];
    mode?: "replace" | "append";
    perDay?: number;
    shuffle?: boolean;
};

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
    const userId = await requireUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await ctx.params;

    const itinerary = await prisma.itinerary.findFirst({ where: { id, userId } });
    if (!itinerary) return NextResponse.json({ error: "Not found" }, { status: 404 });

    let body: GenerateBody = {};

    try{
        body = (await req.json()) as GenerateBody;
    } catch {
        body = {};
    }

    const mode: "replace" | "append" = body.mode === "append" ? "append" : "replace";
    const rawPerDay = Number(body.perDay ?? 3);
    const perDay = Number.isFinite(rawPerDay)
        ? Math.max(1, Math.min(Math.trunc(rawPerDay), 8))
        : 3;
    const shuffle = Boolean(body.shuffle);

    const placeIds = Array.isArray(body.placeIds) 
        ? body.placeIds
            .filter((x): x is string => typeof x == 'string')
            .map((x) => x.trim())
            .filter((x) => x.length > 0)
        : null;

    const saved = await prisma.savedPlace.findMany({
        where: { 
            savedById: userId,
            ...(placeIds ? { placeId: { in: placeIds }}: {}),
        },
        include: { place: true },
        orderBy: { createdAt: "desc" },
    });
    // if no saved places at all, bail early with a clear message
    if (saved.length === 0){
        return NextResponse.json(
            { error: placeIds ? "No selected places found in your saved list." : "You have no saved places. Search for a destination and save some places first." },
            { status: 400 }
        );
    }

    const baseEligible = saved
        .map((s) => s.place)
        .filter(hasCoords);

    if (baseEligible.length === 0) {
        return NextResponse.json(
            { error: "None of your saved places have location coordinates and cannot be scheduled." },
            { status: 400 }
        );
    }

    const txResult = await prisma.$transaction(async (tx) => {
        const nextOrderByDay = Array.from({ length: itinerary.daysCount }, () => 0);
        let eligible = baseEligible;

        if (mode === "replace") {
            await tx.itineraryItem.deleteMany({ where: { itineraryId: id } });
        } else {
            const existing = await tx.itineraryItem.findMany({
                where: { itineraryId: id },
                select: { placeId: true, dayIndex: true, order: true },
            });
            const existingPlaceIds = new Set(existing.map((it) => it.placeId));
            eligible = baseEligible.filter((p) => !existingPlaceIds.has(p.id));
            if (eligible.length === 0) {
                return { emptyAppend: true as const };
            }
            for (const it of existing) {
                const d = it.dayIndex;
                if (d >= 0 && d < nextOrderByDay.length) {
                    nextOrderByDay[d] = Math.max(nextOrderByDay[d], it.order + 1);
                }
            }
        }

        // This pre-shuffle alone can't vary the output — assignDays re-sorts by
        // angle. It only randomizes angle-sort ties (co-located places) and the
        // no-coords round-robin; the real variation comes from the shuffle-aware
        // rotation, trim, and path start below.
        if (shuffle) {
            eligible = eligible
                .map((p) => ({ p, r: Math.random() }))
                .sort((a, b) => a.r - b.r)
                .map((x) => x.p);
        }

        // 1) Distribute every eligible place across days via angle sweep
        // 2) Trim each day to at most `perDay` places (preserves clustering;
        //    a global cap would just drop the tail of createdAt order)
        // 3) Order each day via nearest-neighbour for a sensible walking path
        const buckets = assignDays(eligible, itinerary.daysCount, shuffle);
        const orderedByDay = buckets.map((b) =>
            orderWithinDay(sampleInOrder(b, perDay, shuffle), shuffle)
        );
        const totalChosen = orderedByDay.reduce((s, d) => s + d.length, 0);

        const rows: Array<{
            itineraryId: string;
            placeId: string;
            dayIndex: number;
            order: number;
            note: null;
        }> = [];
        for (let dayIndex = 0; dayIndex < orderedByDay.length; dayIndex++) {
            for (const place of orderedByDay[dayIndex]) {
                const order = nextOrderByDay[dayIndex]++;
                rows.push({
                    itineraryId: id,
                    placeId: place.id,
                    dayIndex,
                    order,
                    note: null,
                });
            }
        }

        if (rows.length > 0) {
            await tx.itineraryItem.createMany({ data: rows });
        }

        const items = await tx.itineraryItem.findMany({
            where: { itineraryId: id },
            include: { place: true },
            orderBy: [{ dayIndex: "asc" }, { order: "asc" }],
        });

        return {
            emptyAppend: false as const,
            items,
            eligibleCount: eligible.length,
            totalChosen,
        };
    });

    if (txResult.emptyAppend) {
        return NextResponse.json(
            { error: "All eligible saved places are already in this itinerary." },
            { status: 400 }
        );
    }

    const { items: created, eligibleCount, totalChosen } = txResult;

    try {
        const r = await getRedis();
        if (r) await r.del(itemsCacheKey(userId, id));
    } catch {}

    return NextResponse.json({
        ok: true,
        count: totalChosen,
        items: created,
        debug: {
            savedCount: saved.length,
            eligibleCount,
            chosenCount: totalChosen,
            selectedCount: placeIds?.length ?? null,
            mode,
            perDay,
            shuffle,
        },
    });
}
