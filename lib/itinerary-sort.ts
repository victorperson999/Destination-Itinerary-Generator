import type { Itinerary, TripSortOption } from "@/components/ui/explorer/types";

export const TRIP_SORT_OPTIONS: ReadonlyArray<{
  value: TripSortOption;
  label: string;
}> = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "alpha-asc", label: "Name (A–Z)" },
  { value: "alpha-desc", label: "Name (Z–A)" },
];

export function isTripSortOption(val: unknown): val is TripSortOption {
  return (
    val === "newest" ||
    val === "oldest" ||
    val === "alpha-asc" ||
    val === "alpha-desc"
  );
}

export function getTripSortLabel(sortBy: TripSortOption): string {
  return TRIP_SORT_OPTIONS.find((opt) => opt.value === sortBy)?.label ?? "Newest first";
}

function safeTimestamp(iso: string, invalidFallback: number): number {
  const ts = Date.parse(iso);
  return Number.isFinite(ts) ? ts : invalidFallback;
}

function compareCreatedDesc(a: Itinerary, b: Itinerary): number {
  const ta = safeTimestamp(a.createdAt, Number.NEGATIVE_INFINITY);
  const tb = safeTimestamp(b.createdAt, Number.NEGATIVE_INFINITY);
  if (ta === tb) return 0;
  return tb > ta ? 1 : -1;
}

function compareCreatedAsc(a: Itinerary, b: Itinerary): number {
  const ta = safeTimestamp(a.createdAt, Number.POSITIVE_INFINITY);
  const tb = safeTimestamp(b.createdAt, Number.POSITIVE_INFINITY);
  if (ta === tb) return 0;
  return ta > tb ? 1 : -1;
}

function compareTitleAsc(a: Itinerary, b: Itinerary): number {
  return a.title.localeCompare(b.title, undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

function compareId(a: Itinerary, b: Itinerary): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Returns a new sorted array of itineraries without mutating the input.
 * Ties always break deterministically by newest createdAt, then id.
 */
export function sortItineraries(
  list: ReadonlyArray<Itinerary>,
  sortBy: TripSortOption
): Itinerary[] {
  return [...list].sort((a, b) => {
    switch (sortBy) {
      case "oldest":
        return compareCreatedAsc(a, b) || compareId(a, b);
      case "alpha-asc":
        return compareTitleAsc(a, b) || compareCreatedDesc(a, b) || compareId(a, b);
      case "alpha-desc":
        return compareTitleAsc(b, a) || compareCreatedDesc(a, b) || compareId(a, b);
      case "newest":
      default:
        return compareCreatedDesc(a, b) || compareId(a, b);
    }
  });
}
