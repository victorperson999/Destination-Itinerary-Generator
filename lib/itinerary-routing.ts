export type RoutePlace = {
  id: string;
  lat?: number | null;
  lon?: number | null;
  category?: string | null;
  name: string;
};

export type CoordPoint = {
  lat: number;
  lon: number;
};

export function hasCoords<T extends { lat?: number | null; lon?: number | null }>(
  p: T
): p is T & CoordPoint {
  return (
    typeof p.lat === "number" &&
    Number.isFinite(p.lat) &&
    typeof p.lon === "number" &&
    Number.isFinite(p.lon)
  );
}

export function dist2(a: CoordPoint, b: CoordPoint, cosLat: number): number {
  const dLat = a.lat - b.lat;
  const dLon = (a.lon - b.lon) * cosLat;
  return dLat * dLat + dLon * dLon;
}

export function dist(a: CoordPoint, b: CoordPoint, cosLat: number): number {
  return Math.sqrt(dist2(a, b, cosLat));
}

// Keep at most k items; when shuffling, keep a random subset but preserve
// the original (angle-sweep) order so the day still reads as one arc.
export function sampleInOrder<T>(arr: T[], k: number, shuffle: boolean): T[] {
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

// 1) If >= 2 places have coordinates, sweep polar angle around centroid and chunk into contiguous day arcs.
// 2) Otherwise, distribute round-robin (sorted by category then name unless shuffled).
export function assignDays<T extends RoutePlace>(
  places: readonly T[],
  daysCount: number,
  shuffle: boolean
): T[][] {
  const withCoords = places.filter(hasCoords);
  const buckets: T[][] = Array.from({ length: daysCount }, () => []);

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
      const day = Math.min(Math.floor((i * daysCount) / sorted.length), daysCount - 1);
      buckets[day].push(p);
    });

    const noCoords = places.filter((p) => !hasCoords(p));
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

function reverseSegment<T>(arr: T[], i: number, j: number): void {
  let lo = i;
  let hi = j;
  while (lo < hi) {
    const tmp = arr[lo];
    arr[lo] = arr[hi];
    arr[hi] = tmp;
    lo++;
    hi--;
  }
}

// Open-path 2-opt local search using true Euclidean distance (not squared).
// Always returns a shallow copy; never mutates `ordered`.
export function twoOptOpenPath<T extends CoordPoint>(
  ordered: readonly T[],
  cosLat: number
): T[] {
  const path = [...ordered];
  const n = path.length;
  if (n <= 2) return path;

  const maxPasses = Math.max(10, n * n);
  for (let pass = 0; pass < maxPasses; pass++) {
    let improved = false;

    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        // Reversing the entire open path produces identical total length.
        if (i === 0 && j === n - 1) continue;

        const before =
          (i > 0 ? dist(path[i - 1], path[i], cosLat) : 0) +
          (j + 1 < n ? dist(path[j], path[j + 1], cosLat) : 0);
        const after =
          (i > 0 ? dist(path[i - 1], path[j], cosLat) : 0) +
          (j + 1 < n ? dist(path[i], path[j + 1], cosLat) : 0);

        if (after + 1e-12 < before) {
          reverseSegment(path, i, j);
          improved = true;
        }
      }
    }

    if (!improved) break;
  }

  return path;
}

export function orderWithinDay<T extends RoutePlace>(
  day: readonly T[],
  shuffle: boolean
): T[] {
  const pts = day.filter(hasCoords);
  const rest = day.filter((p) => !hasCoords(p));

  if (pts.length <= 1) {
    return [...pts, ...rest];
  }

  if (pts.length === 2) {
    const pair = [...pts];
    if (shuffle && Math.random() < 0.5) pair.reverse();
    return [...pair, ...rest];
  }

  const meanLat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const cosLat = Math.cos((meanLat * Math.PI) / 180);

  // Greedy nearest-neighbour seed
  const remaining = new Set(pts.map((p) => p.id));
  const byId = new Map(pts.map((p) => [p.id, p]));
  const ordered: Array<T & CoordPoint> = [];

  let current = pts[shuffle ? Math.floor(Math.random() * pts.length) : 0];
  ordered.push(current);
  remaining.delete(current.id);

  while (remaining.size) {
    let bestId: string | null = null;
    let bestD = Infinity;

    for (const id of remaining) {
      const cand = byId.get(id)!;
      const d = dist2(current, cand, cosLat);
      if (d < bestD) {
        bestD = d;
        bestId = id;
      }
    }
    current = byId.get(bestId!)!;
    ordered.push(current);
    remaining.delete(current.id);
  }

  const improved = twoOptOpenPath(ordered, cosLat);
  if (shuffle && Math.random() < 0.5) {
    improved.reverse();
  }

  return [...improved, ...rest];
}
