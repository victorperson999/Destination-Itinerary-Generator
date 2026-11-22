export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getRedis } from "@/lib/redis";

function itemsCacheKey(userId: string, itineraryId: string) {
  return `itineraryItems:v1:user=${userId}:itinerary=${itineraryId}`;
}

async function requireUserId() {
    const session = await getServerSession(authOptions);
    return session?.user?.id ?? null;
}

type P = {
    id: string;
    lat?: number | null;
    lon?: number | null;
    category?: string | null;
    name: string
};

type GenerateBody = {
    placeIds?: string[];
    mode?: "replace" | "append";
    perDay?: number;
    shuffle?: boolean;
}

function dist2(
    a: { lat: number; lon: number },
    b: { lat: number; lon: number },
    cosLat: number
){
    const dLat = a.lat - b.lat;
    const dLon = (a.lon - b.lon) * cosLat;
    return (dLat * dLat) + (dLon * dLon);
}

// Keep at most k items; when shuffling, keep a random subset but preserve
// the original (angle-sweep) order so the day still reads as one arc.
function sampleInOrder<T>(arr: T[], k: number, shuffle: boolean): T[] {
    if (arr.length <= k) return arr;
    if (!shuffle) return arr.slice(0, k);

    const picked = arr
        .map((_, i) => ({ i, r: Math.random() }))
        .sort((a, b) => a.r - b.r)
        .slice(0, k)
        .map((x) => x.i)
        .sort((a, b) => a - b);

    return picked.map((i) => arr[i]);
}
// 1) if we have the coordinates, sweep cluster angle around the center, then chunk into days
// 2) if no coordiates, distribute by category name

function assignDays(places: P[], daysCount: number, shuffle: boolean): P[][] {
    const withCoords = places.filter(
        (p): p is P & { lat: number; lon: number } =>
            typeof p.lat === "number" && typeof p.lon === "number"
    );

    const buckets: P[][] = Array.from({ length: daysCount }, () => []);

    if (withCoords.length >= 2) {
        const meanLat = withCoords.reduce((s, p) => s + p.lat, 0) / withCoords.length;
        const meanLon = withCoords.reduce((s, p) => s + p.lon, 0) / withCoords.length;
        const cosLat = Math.cos((meanLat * Math.PI) / 180);

        const sorted = [...withCoords].sort((a, b) => {
            const aa = Math.atan2(a.lat - meanLat, (a.lon - meanLon) * cosLat);
            const bb = Math.atan2(b.lat - meanLat, (b.lon - meanLon) * cosLat);
            return aa - bb;
        });

        // The angle sort is deterministic, so without this rotation a shuffled
        // input produces the exact same arcs every run. Starting the sweep at a
        // random angle changes where arc boundaries fall while keeping each day
        // a contiguous slice of the circle.
        const offset = shuffle ? Math.floor(Math.random() * sorted.length) : 0;
        const rotated = sorted.slice(offset).concat(sorted.slice(0, offset));

        // Contiguous angle slices: Day 0 = first arc, Day 1 = next arc, etc.
        // Round-robin (i % daysCount) would interleave clusters and defeat the sweep.
        rotated.forEach((p, i) => {
            const day = Math.min(
                Math.floor((i * daysCount) / sorted.length),
                daysCount - 1
            );
            buckets[day].push(p);
        });

        const noCoords = places.filter(
            (p) => !(typeof p.lat === "number" && typeof p.lon === "number")
        );
        noCoords.forEach((p, i) => buckets[i % daysCount].push(p));

        return buckets;
    }

        const sorted = shuffle 
        ? [...places] 
        : [...places].sort((a, b) => {
            const ca = a.category ?? "";
            const cb = b.category ?? "";
            if (ca !== cb) return ca.localeCompare(cb);
            return a.name.localeCompare(b.name);
        });

    sorted.forEach((p, i) => buckets[i % daysCount].push(p));
    return buckets;
}

function orderWithinDay(day: P[], shuffle: boolean): P[]{
    const pts = day.filter(
        (p) => typeof p.lat === "number" && typeof p.lon === "number") as Array<P & { lat: number; lon: number }>;
    const rest = day.filter((p) => !(typeof p.lat === "number" && typeof p.lon === "number"));

    if (pts.length <= 2){
        return [...pts, ...rest];
    }
    const meanLat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
    const cosLat = Math.cos((meanLat * Math.PI) / 180);

    // nearest neighbouring order
    const remaining = new Set(pts.map((p)=>p.id));
    const byId = new Map(pts.map((p)=>[p.id, p]));
    const ordered: P[] = [];
    //start at arbitrary point (random when shuffling, so the walking path varies)
    let current = pts[shuffle ? Math.floor(Math.random() * pts.length) : 0];
    ordered.push(current);
    remaining.delete(current.id);

    while (remaining.size){
        let bestId: string | null = null;
        let bestD = Infinity;

        for (const id of remaining){
            const cand = byId.get(id)!;
            const d = dist2(current, cand, cosLat);
            if (d < bestD){
                bestD = d;
                bestId = id;
            }
        }
        current = byId.get(bestId!)!;
        ordered.push(current);
        remaining.delete(current.id);
    }
    return [...ordered, ...rest];
}

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
        .filter((p) => typeof p.lat === "number" && typeof p.lon === "number");

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
