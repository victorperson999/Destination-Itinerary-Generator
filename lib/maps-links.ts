export type MapsPlaceInput = {
  name: string;
  address?: string | null;
  lat?: number | null;
  lon?: number | null;
  cityHint?: string | null;
};

export type DayRouteLink = {
  url: string;
  truncated: boolean;
  totalStops: number;
  includedStops: number;
};

const MAX_GOOGLE_MAPS_WAYPOINTS = 9;
export const MAX_GOOGLE_MAPS_ROUTE_STOPS = MAX_GOOGLE_MAPS_WAYPOINTS + 2;

function isValidCoord(lat: number | null | undefined, lon: number | null | undefined): boolean {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function startsWithWholeSegment(haystack: string, needle: string): boolean {
  const escaped = escapeRegExp(needle);
  return new RegExp(`^${escaped}(?:$|\\s*,)`, "i").test(haystack);
}

function containsWholePhrase(haystack: string, needle: string): boolean {
  const escaped = escapeRegExp(needle);
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu").test(haystack);
}

function buildTextQuery(place: MapsPlaceInput): string | null {
  const name = place.name.trim();
  const address = place.address?.trim() || "";
  const cityHint = place.cityHint?.trim() || "";

  if (name && address) {
    return startsWithWholeSegment(address, name)
      ? address
      : `${name}, ${address}`;
  }

  if (name && cityHint) {
    return containsWholePhrase(name, cityHint)
      ? name
      : `${name}, ${cityHint}`;
  }

  if (name) return name;
  if (address) return address;
  return null;
}

/**
 * Builds an official Google Maps URLs v1 (`?api=1&query=`) word-search link for a place.
 * Always prefers a human-readable name (+ address or city context) so Google Maps opens
 * the landmark's place card (photos, hours, reviews) and avoids WGS-84/GCJ-02 coordinate
 * drift in regions like China. Falls back to `lat,lon` only when no name/address exists.
 */
export function buildGoogleMapsPlaceUrl(place: MapsPlaceInput): string | null {
  const textQuery = buildTextQuery(place);
  if (textQuery) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(textQuery)}`;
  }

  if (isValidCoord(place.lat, place.lon)) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${place.lat!.toFixed(6)},${place.lon!.toFixed(6)}`
    )}`;
  }

  return null;
}

function encodeRouteStop(stop: MapsPlaceInput): string | null {
  const textQuery = buildTextQuery(stop);
  if (textQuery) {
    const sanitized = textQuery
      .replace(/\|/g, " ")
      .replace(/\s+/g, " ")
      .replace(/^,\s*/, "")
      .trim();
    if (sanitized) return sanitized;
  }

  if (isValidCoord(stop.lat, stop.lon)) {
    return `${stop.lat!.toFixed(6)},${stop.lon!.toFixed(6)}`;
  }

  return null;
}

/**
 * Builds a multi-stop Google Maps Directions URL (`?api=1`) for a single itinerary day.
 * Prefers human-readable place names (+ city/address) over raw coordinates.
 * Returns null when fewer than 2 routable stops are present.
 */
export function buildGoogleMapsDayRouteUrl(stops: MapsPlaceInput[]): DayRouteLink | null {
  const encoded = stops
    .map(encodeRouteStop)
    .filter((s): s is string => Boolean(s));

  if (encoded.length < 2) return null;

  const origin = encoded[0];
  const destination = encoded[encoded.length - 1];
  const rawWaypoints = encoded.slice(1, -1);
  const waypoints = rawWaypoints.slice(0, MAX_GOOGLE_MAPS_WAYPOINTS);
  const truncated = rawWaypoints.length > MAX_GOOGLE_MAPS_WAYPOINTS;

  const params = new URLSearchParams({
    api: "1",
    origin,
    destination,
  });
  if (waypoints.length > 0) {
    params.set("waypoints", waypoints.join("|"));
  }

  return {
    url: `https://www.google.com/maps/dir/?${params.toString()}`,
    truncated,
    totalStops: encoded.length,
    includedStops: waypoints.length + 2,
  };
}
