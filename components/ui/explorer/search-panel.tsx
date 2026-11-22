"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { useSession, signIn } from "next-auth/react";
import AuthButton from "@/components/auth-button";
import ThemeToggle from "@/components/theme-toggle";
import { ChevronLeft, ChevronRight, MapPin, Bookmark, CalendarDays } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SavedItem = {
  placeId: string;
  provider: string;
  providerId: string;
  name: string;
  address: string | null;
  category: string | null;
  lat: number | null;
  lon: number | null;
};

export type Itinerary = {
  id: string;
  title: string;
  daysCount: number;
  startDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ItineraryItem = {
  id: string;
  itineraryId: string;
  placeId: string;
  dayIndex: number;
  order: number;
  note: string | null;
  createdAt: string;
  place: {
    id: string;
    name: string;
    address: string | null;
    category: string | null;
    lat: number | null;
    lon: number | null;
  };
};

export type SearchPanelProps = {
  initialUserId?: string | null;
  initialSaved?: SavedItem[];
  initialItineraries?: Itinerary[];
  initialItineraryId?: string | null;
  initialItineraryItems?: ItineraryItem[];
  initialQuery?: string;
};

type PlaceResult = {
  provider: "mock" | "osm";
  providerId: string;
  name: string;
  address: string;
  category?: string;
  lat?: number;
  lon?: number;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
};

type ChatSideEffect =
  | { type: "search"; query: string }
  | { type: "refresh_itineraries"; selectId?: string }
  | { type: "generate"; itineraryId: string; perDay: number; shuffle: boolean; useSelected: boolean };

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchPlaces(q: string, signal: AbortSignal): Promise<PlaceResult[]> {
  const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`, {
    cache: "no-store",
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to fetch places: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
  }
  return (await res.json()) as PlaceResult[];
}

async function fetchSaved(): Promise<SavedItem[]> {
  const res = await fetch("/api/saved", { cache: "no-store" });
  if (res.status === 401) return [];
  if (!res.ok) throw new Error("Failed to load saved places");
  return res.json();
}

async function savePlace(p: PlaceResult) {
  const res = await fetch("/api/saved", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: p.provider,
      providerId: p.providerId,
      name: p.name,
      address: p.address,
      category: p.category,
      lat: p.lat ?? null,
      lon: p.lon ?? null,
    }),
  });
  if (!res.ok) throw new Error("Failed to save place");
}

async function removePlace(placeId: string) {
  const res = await fetch("/api/saved", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ placeId }),
  });
  if (!res.ok) throw new Error("Failed to remove place");
}

async function removeAllSaved() {
  const res = await fetch("/api/saved", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ all: true }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to remove all saved: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function fetchItineraries(): Promise<Itinerary[]> {
  const res = await fetch("/api/itineraries", { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to load itineraries: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
  }
  return (await res.json()) as Itinerary[];
}

async function createItinerary(title: string, daysCount: number): Promise<Itinerary> {
  const res = await fetch("/api/itineraries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ title, daysCount }),
  });

  if (res.status === 409) {
    const data = await res.json().catch(() => null);
    const msg =
      typeof data?.error === "string"
        ? data.error
        : "Itinerary with this name already exists";
    throw Object.assign(new Error(msg), { status: 409, code: "DUPLICATE_ITINERARY" });
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to create itinerary: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
  }
  return (await res.json()) as Itinerary;
}

async function fetchItineraryItems(id: string): Promise<ItineraryItem[]> {
  const res = await fetch(`/api/itineraries/${encodeURIComponent(id)}/items`, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to load itinerary items: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
  }
  return (await res.json()) as ItineraryItem[];
}

async function generateItinerary(
  id: string,
  body?: unknown
): Promise<{ ok: boolean; count: number; items: ItineraryItem[] }> {
  const res = await fetch(`/api/itineraries/${encodeURIComponent(id)}/generate`, {
    method: "POST",
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to generate itinerary: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
  }
  return (await res.json()) as { ok: boolean; count: number; items: ItineraryItem[] };
}

// ── CategoryBadge ─────────────────────────────────────────────────────────────

// Full literal class strings (light + dark) so Tailwind's scanner includes them.
const CATEGORY_BADGE_CLASSES: Record<string, string> = {
  museums: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-900",
  historic: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
  architecture: "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-900",
  cultural: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900",
  natural: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
  amusements: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-900",
  religion: "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-900",
  foods: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900",
};

const CATEGORY_FALLBACK_CLASS =
  "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";

function CategoryBadge({ category, className }: { category?: string | null; className?: string }) {
  if (!category) return null;
  const colors = CATEGORY_BADGE_CLASSES[category.toLowerCase()] ?? CATEGORY_FALLBACK_CLASS;
  return (
    <Badge variant="outline" className={[colors, className].filter(Boolean).join(" ")}>
      {category}
    </Badge>
  );
}

// ── SearchResultsList ─────────────────────────────────────────────────────────

type SearchResultsListProps = {
  results: PlaceResult[];
  savedKeys: Set<string>;
  savingKey: string | null;
  query: string;
  onSave: (r: PlaceResult) => Promise<void>;
};

function SearchResultsList({ results, savedKeys, savingKey, query, onSave }: SearchResultsListProps) {
  const [pagination, setPagination] = useState<{ forResults: PlaceResult[]; count: number }>({
    forResults: results,
    count: 10,
  });
  const visibleCount = pagination.forResults === results ? pagination.count : 10;

  if (results.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Search for a city to see its nearby attractions.
      </p>
    );
  }

  const visible = results.slice(0, visibleCount);
  const hasMore = visibleCount < results.length;

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Showing {visible.length} of {results.length} for{" "}
        <span className="font-medium">{query.trim()}</span>
      </p>

      <div className="max-h-96 overflow-y-auto rounded-lg border">
        <ul className="divide-y">
          {visible.map((r) => {
            const key = `${r.provider}:${r.providerId}`;
            const isSaved = savedKeys.has(key);
            return (
              <li key={r.providerId} className="p-3 transition-colors hover:bg-accent/30">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{r.name}</p>
                    <p className="text-sm text-muted-foreground">{r.address}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <CategoryBadge category={r.category} />
                    <Button
                      type="button"
                      size="sm"
                      variant={isSaved ? "secondary" : "default"}
                      disabled={isSaved || savingKey === key}
                      onClick={() => void onSave(r)}
                    >
                      {isSaved ? "Saved" : "Save"}
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {hasMore && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() =>
            setPagination((p) => ({
              forResults: results,
              count: (p.forResults === results ? p.count : 10) + 10,
            }))
          }
        >
          Show more results ({results.length - visibleCount} remaining)
        </Button>
      )}
    </div>
  );
}

// ── ChatPanel ────────────────────────────────────────────────────────────────

type ChatPanelProps = {
  messages: ChatMessage[];
  input: string;
  loading: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
};

function ChatPanel({ messages, input, loading, onInputChange, onSend }: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  return (
    <div className="flex h-full flex-col">
      <p className="mb-2 text-sm font-medium">Your AI Assistant</p>
      <Separator />

      {/* Message list */}
      <div className="my-3 flex h-72 flex-col gap-2 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Describe your trip — e.g. &ldquo;4 day trip to Toronto&rdquo; — and I&apos;ll build your itinerary.
          </p>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                m.role === "user"
                  ? "self-end bg-primary text-primary-foreground"
                  : "self-start bg-muted text-foreground"
              }`}
            >
              {m.content}
            </div>
          ))
        )}

        {loading && (
          <div className="self-start rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            …
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <Separator />

      {/* Input row */}
      <div className="mt-3 flex gap-2">
        <Input
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="Type a message…"
          className="text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          disabled={!input.trim() || loading}
          onClick={onSend}
        >
          Send
        </Button>
      </div>
    </div>
  );
}

// ── SearchPanel ───────────────────────────────────────────────────────────────

export default function SearchPanel({
  initialUserId = null,
  initialSaved = [],
  initialItineraries = [],
  initialItineraryId = null,
  initialItineraryItems = [],
  initialQuery = "",
}: SearchPanelProps) {
  const [query, setQuery] = useState(initialQuery);
  const [searchedQuery, setSearchedQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(Boolean(initialQuery));
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<PlaceResult[]>([]);

  const [saved, setSaved] = useState<SavedItem[]>(initialSaved);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const [savedLoading, setSavedLoading] = useState(false);
  const [savedError, setSavedError] = useState<string | null>(null);

  const [selectedSavedIds, setSelectedSavedIds] = useState<Set<string>>(new Set());
  const [genShuffle, setGenShuffle] = useState(false);

  const [itineraries, setItineraries] = useState<Itinerary[]>(initialItineraries);
  const [itineraryId, setItineraryId] = useState<string | null>(initialItineraryId);

  const [itineraryItems, setItineraryItems] = useState<ItineraryItem[]>(initialItineraryItems);
  const [itinLoading, setItinLoading] = useState(false);
  const [itinError, setItinError] = useState<string | null>(null);

  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);

  const [creatingItin, setCreatingItin] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [newItinTitle, setNewItinTitle] = useState("My Trip");
  const [newDaysCount, setNewDaysCount] = useState(3);
  const [newItinTitleError, setNewItinTitleError] = useState<string | null>(null);

  const [chatOpen, setChatOpen] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const SAVED_MIN_HEIGHT = 256;
  const [savedHeight, setSavedHeight] = useState<number | null>(null);
  const [savedAtMax, setSavedAtMax] = useState(false);
  const savedScrollRef = useRef<HTMLDivElement | null>(null);
  const savedListRef = useRef<HTMLUListElement | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const savedLoadedUserIdRef = useRef<string | null>(initialUserId);
  const itinsLoadedUserIdRef = useRef<string | null>(initialUserId);
  const loadedItemsKeyRef = useRef<string | null>(
    initialUserId && initialItineraryId ? `${initialUserId}:${initialItineraryId}` : null
  );
  const activeItemsKeyRef = useRef<string | null>(
    initialUserId && initialItineraryId ? `${initialUserId}:${initialItineraryId}` : null
  );
  const itemsFetchReqIdRef = useRef(0);

  const { status, data: sessionData } = useSession();
  const activeUserId =
    status === "loading"
      ? initialUserId
      : status === "authenticated"
      ? (sessionData?.user?.id ?? null)
      : null;
  const authed = Boolean(activeUserId);
  const activeItemsKey =
    activeUserId && itineraryId ? `${activeUserId}:${itineraryId}` : null;

  useEffect(() => {
    activeItemsKeyRef.current = activeItemsKey;
  }, [activeItemsKey]);

  useEffect(() => {
    return () => {
      if (dragCleanupRef.current) dragCleanupRef.current();
      searchAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!initialQuery) return;
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    fetchPlaces(initialQuery, controller.signal)
      .then((data) => {
        if (searchAbortRef.current !== controller) return;
        setResults(data);
        setError(null);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted || searchAbortRef.current !== controller) return;
        setError(e instanceof Error ? e.message : "Search failed");
        setResults([]);
      })
      .finally(() => {
        if (searchAbortRef.current === controller) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [initialQuery]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (
      activeUserId &&
      !itinLoading &&
      (itineraryId !== null || itinsLoadedUserIdRef.current === activeUserId)
    ) {
      if (itineraryId) url.searchParams.set("itinerary", itineraryId);
      else url.searchParams.delete("itinerary");
    }

    if (searchedQuery) url.searchParams.set("q", searchedQuery);
    else url.searchParams.delete("q");

    const next = `${url.pathname}${url.search}${url.hash}`;
    const curr = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== curr) {
      window.history.replaceState(window.history.state, "", next);
    }
  }, [activeUserId, itinLoading, itineraryId, searchedQuery]);

  const canSearch = useMemo(() => query.trim().length > 0 && !loading, [query, loading]);

  const activeSelectedSavedIds = useMemo(() => {
    const allowed = new Set(saved.map((s) => s.placeId));
    const next = new Set<string>();
    for (const id of selectedSavedIds) {
      if (allowed.has(id)) next.add(id);
    }
    return next;
  }, [saved, selectedSavedIds]);

  const selectedSavedCount = activeSelectedSavedIds.size;

  const selectedSavedIdArray = useMemo(
    () => Array.from(activeSelectedSavedIds),
    [activeSelectedSavedIds]
  );

  const savedKeys = useMemo(
    () => new Set(saved.map((s) => `${s.provider}:${s.providerId}`)),
    [saved]
  );

  const selectedItinerary = useMemo(
    () => itineraries.find((i) => i.id === itineraryId) ?? null,
    [itineraries, itineraryId]
  );

  const itemsByDay = useMemo(() => {
    const map = new Map<number, ItineraryItem[]>();
    for (const item of itineraryItems) {
      const arr = map.get(item.dayIndex) ?? [];
      arr.push(item);
      map.set(item.dayIndex, arr);
    }
    for (const [day, arr] of map.entries()) {
      arr.sort((a, b) => a.order - b.order);
      map.set(day, arr);
    }
    return map;
  }, [itineraryItems]);

  const titleAlreadyExists = useMemo(() => {
    const t = newItinTitle.trim().toLowerCase();
    if (!t) return false;
    return itineraries.some((it) => it.title.trim().toLowerCase() === t);
  }, [itineraries, newItinTitle]);

  useEffect(() => {
    let cancelled = false;

    async function loadSaved() {
      if (status === "loading") return;
      if (!activeUserId) {
        savedLoadedUserIdRef.current = null;
        setSaved([]);
        setSelectedSavedIds(new Set());
        setSavedError(null);
        setSavedLoading(false);
        setSavedHeight(null);
        setSavedAtMax(false);
        return;
      }

      if (savedLoadedUserIdRef.current === activeUserId) return;

      try {
        setSavedLoading(true);
        setSavedError(null);
        setSelectedSavedIds(new Set());
        const list = await fetchSaved();
        if (!cancelled) {
          savedLoadedUserIdRef.current = activeUserId;
          setSaved(list);
        }
      } catch (e) {
        if (!cancelled) {
          setSavedError(e instanceof Error ? e.message : "Failed to load saved places");
        }
      } finally {
        if (!cancelled) setSavedLoading(false);
      }
    }

    void loadSaved();
    return () => {
      cancelled = true;
    };
  }, [status, activeUserId]);

  useEffect(() => {
    let cancelled = false;

    async function loadItins() {
      if (status === "loading") return;
      if (!activeUserId) {
        itinsLoadedUserIdRef.current = null;
        setItineraries([]);
        setItineraryId(null);
        setItineraryItems([]);
        setItinError(null);
        setItemsError(null);
        setItinLoading(false);
        setItemsLoading(false);
        return;
      }

      if (itinsLoadedUserIdRef.current === activeUserId) return;

      const urlItinId = new URLSearchParams(window.location.search).get("itinerary");
      try {
        setItinLoading(true);
        setItinError(null);
        const list = await fetchItineraries();
        if (cancelled) return;

        itinsLoadedUserIdRef.current = activeUserId;
        setItineraries(list);
        setItineraryId((prev) => {
          if (prev && list.some((i) => i.id === prev)) return prev;
          if (urlItinId && list.some((i) => i.id === urlItinId)) return urlItinId;
          return list[0]?.id ?? null;
        });
      } catch (e) {
        if (!cancelled) {
          setItinError(e instanceof Error ? e.message : "Failed to load itineraries");
        }
      } finally {
        if (!cancelled) setItinLoading(false);
      }
    }

    void loadItins();
    return () => {
      cancelled = true;
    };
  }, [status, activeUserId]);

  useEffect(() => {
    let cancelled = false;

    async function loadItems() {
      if (status === "loading") return;
      if (!activeUserId || !itineraryId) {
        loadedItemsKeyRef.current = null;
        setItineraryItems([]);
        setItemsError(null);
        setItemsLoading(false);
        return;
      }

      const itemsKey = `${activeUserId}:${itineraryId}`;
      if (loadedItemsKeyRef.current === itemsKey) {
        setItemsLoading(false);
        setItemsError(null);
        return;
      }

      const reqId = ++itemsFetchReqIdRef.current;
      try {
        setItemsLoading(true);
        setItemsError(null);
        const items = await fetchItineraryItems(itineraryId);
        if (!cancelled && itemsFetchReqIdRef.current === reqId) {
          loadedItemsKeyRef.current = itemsKey;
          setItineraryItems(items);
        }
      } catch (e) {
        if (!cancelled && itemsFetchReqIdRef.current === reqId) {
          setItemsError(e instanceof Error ? e.message : "Failed to load itinerary items");
        }
      } finally {
        if (!cancelled && itemsFetchReqIdRef.current === reqId) setItemsLoading(false);
      }
    }

    void loadItems();
    return () => {
      cancelled = true;
    };
  }, [status, activeUserId, itineraryId]);

  function toggleSavedSelection(placeId: string) {
    setSelectedSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(placeId)) next.delete(placeId);
      else next.add(placeId);
      return next;
    });
  }

  function selectAllSaved() {
    setSelectedSavedIds(new Set(saved.map((s) => s.placeId)));
  }

  function clearSelectedSaved() {
    setSelectedSavedIds(new Set());
  }

  async function refreshSaved() {
    try {
      setSavedLoading(true);
      setSavedError(null);
      const list = await fetchSaved();
      setSaved(list);
      if (list.length === 0) {
        setSavedHeight(null);
        setSavedAtMax(false);
      } else {
        requestAnimationFrame(() => {
          const listHeight = savedListRef.current?.offsetHeight ?? 0;
          if (listHeight > 0 && listHeight <= SAVED_MIN_HEIGHT) {
            setSavedHeight(null);
            setSavedAtMax(false);
          }
        });
      }
    } catch (e) {
      setSavedError(e instanceof Error ? e.message : "Failed to load saved places");
    } finally {
      setSavedLoading(false);
    }
  }

  function handleSavedDividerMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (saved.length === 0) return;
    const container = savedScrollRef.current;
    const list = savedListRef.current;
    if (!container || !list) return;

    const maxHeight = list.offsetHeight;
    if (maxHeight <= SAVED_MIN_HEIGHT) return;

    e.preventDefault();
    let lastY = e.clientY;
    let currentHeight = container.offsetHeight;
    let moved = false;

    const prevUserSelect = document.body.style.userSelect;
    const prevCursor = document.body.style.cursor;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "row-resize";

    function onMove(ev: MouseEvent) {
      const delta = ev.clientY - lastY;
      if (delta === 0) return;
      const desired = currentHeight + delta;
      const next = Math.max(SAVED_MIN_HEIGHT, Math.min(maxHeight, desired));
      const actualDelta = next - currentHeight;
      if (actualDelta === 0) return;
      moved = true;
      lastY += actualDelta;
      currentHeight = next;
      setSavedAtMax(false);
      setSavedHeight(next);
    }

    function cleanup() {
      document.body.style.userSelect = prevUserSelect;
      document.body.style.cursor = prevCursor;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      dragCleanupRef.current = null;
    }

    function onUp() {
      cleanup();
      if (!moved) return;
      const atMax = currentHeight >= maxHeight;
      setSavedAtMax(atMax);
      if (atMax) setSavedHeight(null);
    }

    dragCleanupRef.current = cleanup;
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  async function performSearch(q: string) {
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    setQuery(q);
    setSearchedQuery(q);
    setError(null);
    setLoading(true);
    setResults([]);
    try {
      const data = await fetchPlaces(q, controller.signal);
      if (searchAbortRef.current !== controller) return;
      setResults(data);
    } catch (e) {
      if (controller.signal.aborted || searchAbortRef.current !== controller) return;
      setError(e instanceof Error ? e.message : "Search failed");
      setResults([]);
    } finally {
      if (searchAbortRef.current === controller) {
        setLoading(false);
      }
    }
  }

  async function onSearch() {
    const q = query.trim();
    if (!q) {
      searchAbortRef.current?.abort();
      searchAbortRef.current = null;
      setLoading(false);
      setSearchedQuery("");
      setError("Enter a city or name of neighbourhood (e.g. Toronto)");
      setResults([]);
      return;
    }
    await performSearch(q);
  }

  async function handleChatSend() {
    const text = chatInput.trim();
    if (!text || chatLoading) return;

    const newMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    const apiMessages = newMessages
      .filter((m) => !m.isError)
      .map(({ role, content }) => ({ role, content }));
    setMessages(newMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          context: {
            savedCount: saved.length,
            selectedSavedCount: selectedSavedCount,
            itineraryCount: itineraries.length,
            activeItineraryId: itineraryId ?? undefined,
            activeItineraryTitle: selectedItinerary?.title,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = data?.error ?? `Chat request failed: ${res.status}`;
        throw Object.assign(new Error(msg), { status: res.status });
      }

      const data = (await res.json()) as { message: string; sideEffects: ChatSideEffect[] };

      let genError: string | null = null;
      const effects = data.sideEffects ?? [];
      const generatedIds = new Set(
        effects
          .filter((ef): ef is Extract<ChatSideEffect, { type: "generate" }> => ef.type === "generate")
          .map((ef) => ef.itineraryId)
      );
      let deferredSelectId: string | null = null;

      for (const effect of effects) {
        if (effect.type === "search") {
          void performSearch(effect.query);
        } else if (effect.type === "refresh_itineraries") {
          const list = await fetchItineraries();
          setItineraries(list);
          if (effect.selectId) {
            // Defer switching active itinerary if a generate effect for it follows in this batch
            // so loadItems doesn't race against generateItinerary and wipe the generated items.
            if (generatedIds.has(effect.selectId)) {
              deferredSelectId = effect.selectId;
            } else {
              setItineraryId(effect.selectId);
            }
          }
        } else if (effect.type === "generate") {
          try {
            const generated = await generateItinerary(effect.itineraryId, {
              mode: "replace",
              perDay: effect.perDay,
              shuffle: effect.shuffle,
              ...(effect.useSelected && selectedSavedIdArray.length > 0
                ? { placeIds: selectedSavedIdArray }
                : {}),
            });
            itemsFetchReqIdRef.current++;
            loadedItemsKeyRef.current = activeUserId ? `${activeUserId}:${effect.itineraryId}` : null;
            setItemsLoading(false);
            setItemsError(null);
            setItineraryItems(generated.items);
            setItineraryId(effect.itineraryId);
            if (deferredSelectId === effect.itineraryId) {
              deferredSelectId = null;
            }
          } catch (e) {
            genError = e instanceof Error ? e.message : "Generation failed";
            if (deferredSelectId) {
              setItineraryId(deferredSelectId);
              deferredSelectId = null;
            }
          }
        }
      }

      if (deferredSelectId) {
        setItineraryId(deferredSelectId);
      }

      const assistantText = genError
        ? `Generation failed: ${genError}`
        : data.message;

      if (assistantText) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: assistantText, ...(genError ? { isError: true } : {}) },
        ]);
      }
    } catch (e: unknown) {
      const err = e as { status?: number; message?: string };
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          isError: true,
          content: err?.status === 401
            ? "Please sign in to use AI planning features."
            : err?.status === 429
            ? (err.message ?? "The AI is temporarily rate-limited. Please try again.")
            : "Sorry, I couldn't reach the AI right now. Please try again.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  async function handleSavePlace(r: PlaceResult) {
    if (!authed) {
      void signIn("github");
      return;
    }
    const key = `${r.provider}:${r.providerId}`;
    try {
      setSavingKey(key);
      await savePlace(r);
      await refreshSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save place");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <MapPin size={20} />
              </span>
              Destination Itinerary Generator
            </CardTitle>
            <CardDescription className="mt-1">
              Search for a City to discover its attractions and build a travel/vacation Itinerary!
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <AuthButton />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">

        {/* Two-column area: search+results left, chat panel right */}
        <div className="flex items-start">

          {/* Left column */}
          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Try: Toronto"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void onSearch();
                }}
              />
              <Button type="button" onClick={onSearch} disabled={!canSearch}>
                {loading ? "Searching..." : "Search"}
              </Button>
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <SearchResultsList
              results={results}
              savedKeys={savedKeys}
              savingKey={savingKey}
              query={searchedQuery}
              onSave={handleSavePlace}
            />
          </div>

          {/* Right column: toggle tab + collapsible chat panel */}
          <div className="ml-3 flex flex-shrink-0 items-start">
            <button
              type="button"
              onClick={() => setChatOpen((o) => !o)}
              className="mt-1 flex h-16 w-5 items-center justify-center rounded-l-md border border-r-0 bg-muted text-muted-foreground transition-colors hover:bg-accent"
              aria-label={chatOpen ? "Collapse chat panel" : "Expand chat panel"}
            >
              {chatOpen ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
            </button>

            <div className={`overflow-hidden transition-all duration-300 ${chatOpen ? "w-80" : "w-0"}`}>
              <div className="w-80 rounded-r-lg border border-l-2 p-4 shadow-md">
                <ChatPanel
                  messages={messages}
                  input={chatInput}
                  loading={chatLoading}
                  onInputChange={setChatInput}
                  onSend={handleChatSend}
                />
              </div>
            </div>
          </div>

        </div>

        <Separator />

        {/* Saved section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-base font-semibold">
              <Bookmark size={16} className="text-primary" />
              Saved
              <span className="text-xs font-normal text-muted-foreground">
                ({selectedSavedCount} selected)
              </span>
            </p>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!authed || saved.length === 0}
                onClick={selectAllSaved}
              >
                Select all
              </Button>

              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!authed || selectedSavedCount === 0}
                onClick={clearSelectedSaved}
              >
                Clear Selected
              </Button>

              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={!authed || saved.length === 0 || savingKey === "remove-all"}
                onClick={async () => {
                  if (!authed) {
                    void signIn("github");
                    return;
                  }
                  const ok = window.confirm("Remove ALL saved places? This cannot be undone.");
                  if (!ok) return;
                  try {
                    setSavingKey("remove-all");
                    await removeAllSaved();
                    setSelectedSavedIds(new Set());
                    await refreshSaved();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Failed to remove all saved places");
                  } finally {
                    setSavingKey(null);
                  }
                }}
              >
                Remove all
              </Button>
            </div>
          </div>

          {savedLoading ? (
            <p className="text-sm text-muted-foreground">Loading saved…</p>
          ) : savedError ? (
            <p className="text-sm text-red-600">{savedError}</p>
          ) : saved.length === 0 ? (
            <p className="text-sm text-muted-foreground">No saved places yet.</p>
          ) : (
            <div
              ref={savedScrollRef}
              className={
                savedAtMax
                  ? "overflow-y-auto"
                  : savedHeight === null
                  ? "max-h-64 overflow-y-auto"
                  : "overflow-y-auto"
              }
              style={!savedAtMax && savedHeight !== null ? { maxHeight: `${savedHeight}px` } : undefined}
            >
              <ul ref={savedListRef} className="grid grid-cols-2 gap-2">
                {saved.map((s) => (
                  <li
                    key={s.placeId}
                    className={`rounded-lg border p-2 transition-colors hover:border-primary/40 hover:bg-accent/30 ${
                      activeSelectedSavedIds.has(s.placeId) ? "border-primary/60 bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 flex-shrink-0"
                          checked={activeSelectedSavedIds.has(s.placeId)}
                          onChange={() => toggleSavedSelection(s.placeId)}
                          disabled={!authed}
                          aria-label={`Select ${s.name}`}
                        />
                        <p className="line-clamp-2 text-sm font-medium leading-tight">{s.name}</p>
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        {s.category ? (
                          <CategoryBadge category={s.category} className="text-xs" />
                        ) : (
                          <span />
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs"
                          disabled={!authed || savingKey === `remove:${s.placeId}`}
                          onClick={async () => {
                            if (!authed) {
                              void signIn("github");
                              return;
                            }
                            try {
                              setSavingKey(`remove:${s.placeId}`);
                              await removePlace(s.placeId);
                              setSelectedSavedIds((prev) => {
                                const next = new Set(prev);
                                next.delete(s.placeId);
                                return next;
                              });
                              await refreshSaved();
                            } catch (e) {
                              setError(e instanceof Error ? e.message : "Failed to remove place");
                            } finally {
                              setSavingKey(null);
                            }
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {saved.length > 0 ? (
            <div
              onMouseDown={handleSavedDividerMouseDown}
              role="separator"
              aria-orientation="horizontal"
              aria-label="Resize saved section"
              className="group relative -my-1 flex h-3 cursor-row-resize items-center"
            >
              <div className="h-px w-full bg-border transition-all group-hover:h-0.5 group-hover:bg-primary/60" />
            </div>
          ) : (
            <Separator />
          )}
        </div>

        {/* Itinerary section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-base font-semibold">
              <CalendarDays size={16} className="text-primary" />
              Itinerary
            </p>
            {itinLoading ? <p className="text-xs text-muted-foreground">Loading…</p> : null}
          </div>

          {!authed ? (
            <p className="text-sm text-muted-foreground">Sign in to create and generate itineraries.</p>
          ) : itinError ? (
            <p className="text-sm text-red-600">{itinError}</p>
          ) : (
            <div className="space-y-3">
              {/* Create */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  value={newItinTitle}
                  onChange={(e) => {
                    setNewItinTitle(e.target.value);
                    if (newItinTitleError) {
                      setNewItinTitleError(null);
                    }
                  }}
                  placeholder="Trip title"
                  className={newItinTitleError ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
                {newItinTitleError ? (
                  <p className="text-sm text-red-600">{newItinTitleError}</p>
                ) : null}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap"># Days</span>
                  <Input
                    id="new-itinerary-days"
                    type="number"
                    min={1}
                    max={14}
                    value={newDaysCount}
                    onChange={(e) => setNewDaysCount(Number(e.target.value))}
                    className="sm:w-28"
                    aria-label="Number of days"
                  />
                </div>

                <Button
                  type="button"
                  disabled={creatingItin || !newItinTitle.trim()}
                  onClick={async () => {
                    if (!authed) {
                      void signIn("github");
                      return;
                    }

                    if (titleAlreadyExists) {
                      setNewItinTitleError("Itinerary with this name already exists, enter a different name");
                      setTimeout(() => setNewItinTitleError(null), 2500);
                      return;
                    }

                    try {
                      setCreatingItin(true);
                      setItinError(null);

                      const created = await createItinerary(newItinTitle.trim(), newDaysCount || 3);

                      const list = await fetchItineraries();
                      setItineraries(list);
                      setItineraryId(created.id);
                    } catch (e: unknown) {
                      const err = e as { code?: string; status?: number; message?: string };
                      if (err?.code === "DUPLICATE_ITINERARY" || err?.status === 409) {
                        setNewItinTitleError(
                          err?.message || "Itinerary with this name already exists, enter a different name"
                        );
                        setTimeout(() => setNewItinTitleError(null), 2500);
                        return;
                      }
                      setItinError(e instanceof Error ? e.message : "Failed to create itinerary");
                    } finally {
                      setCreatingItin(false);
                    }
                  }}
                >
                  {creatingItin ? "Creating..." : "New itinerary"}
                </Button>
              </div>

              {/* Pick + Generate */}
              {itineraries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No itineraries yet.</p>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <select
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                    value={itineraryId ?? ""}
                    onChange={(e) => setItineraryId(e.target.value)}
                  >
                    {itineraries.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.title} ({it.daysCount} days)
                      </option>
                    ))}
                  </select>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={genShuffle}
                      onChange={(e) => setGenShuffle(e.target.checked)}
                    />
                    Shuffle
                  </label>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={!itineraryId || generating}
                    onClick={async () => {
                      if (!authed) {
                        void signIn("github");
                        return;
                      }
                      if (!itineraryId || !activeUserId) return;
                      const targetId = itineraryId;
                      const targetKey = `${activeUserId}:${targetId}`;

                      try {
                        setGenerating(true);
                        setItemsError(null);

                        const generated = await generateItinerary(targetId, {
                          mode: "replace",
                          perDay: 3,
                          shuffle: genShuffle,
                        });

                        if (activeItemsKeyRef.current === targetKey) {
                          itemsFetchReqIdRef.current++;
                          loadedItemsKeyRef.current = targetKey;
                          setItemsLoading(false);
                          setItemsError(null);
                          setItineraryItems(generated.items);
                        } else if (loadedItemsKeyRef.current === targetKey) {
                          loadedItemsKeyRef.current = null;
                        }
                      } catch (e) {
                        if (activeItemsKeyRef.current === targetKey) {
                          setItemsError(e instanceof Error ? e.message : "Failed to generate itinerary");
                        }
                      } finally {
                        setGenerating(false);
                      }
                    }}
                  >
                    {generating ? "Generating..." : "Generate (all saved)"}
                  </Button>

                  <Button
                    type="button"
                    disabled={!itineraryId || generating || selectedSavedCount === 0}
                    onClick={async () => {
                      if (!authed) {
                        void signIn("github");
                        return;
                      }
                      if (!itineraryId || !activeUserId) return;
                      const targetId = itineraryId;
                      const targetKey = `${activeUserId}:${targetId}`;

                      try {
                        setGenerating(true);
                        setItemsError(null);

                        const generated = await generateItinerary(targetId, {
                          mode: "replace",
                          perDay: 3,
                          shuffle: genShuffle,
                          placeIds: selectedSavedIdArray,
                        });

                        if (activeItemsKeyRef.current === targetKey) {
                          itemsFetchReqIdRef.current++;
                          loadedItemsKeyRef.current = targetKey;
                          setItemsLoading(false);
                          setItemsError(null);
                          setItineraryItems(generated.items);
                        } else if (loadedItemsKeyRef.current === targetKey) {
                          loadedItemsKeyRef.current = null;
                        }
                      } catch (e) {
                        if (activeItemsKeyRef.current === targetKey) {
                          setItemsError(e instanceof Error ? e.message : "Failed to generate itinerary");
                        }
                      } finally {
                        setGenerating(false);
                      }
                    }}
                  >
                    Generate (selected)
                  </Button>
                </div>
              )}

              {/* Items */}
              {itemsLoading ? (
                <p className="text-sm text-muted-foreground">Loading itinerary items…</p>
              ) : itemsError ? (
                <p className="text-sm text-red-600">{itemsError}</p>
              ) : !selectedItinerary ? (
                <p className="text-sm text-muted-foreground">Select an itinerary to see items.</p>
              ) : itineraryItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No items yet. Click <span className="font-medium">Generate (all saved)</span> or{" "}
                  <span className="font-medium">Generate (selected)</span>.
                </p>
              ) : (
                <div className="max-h-[28rem] overflow-y-auto space-y-3 pr-1">
                  {Array.from({ length: selectedItinerary.daysCount }, (_, day) => {
                    const dayItems = itemsByDay.get(day) ?? [];
                    return (
                      <div key={day} className="overflow-hidden rounded-lg border">
                        <p className="flex items-center gap-2 border-b bg-accent/40 px-3 py-2 text-sm font-semibold">
                          <CalendarDays size={14} className="text-primary" />
                          Day {day + 1}
                          <span className="ml-auto text-xs font-normal text-muted-foreground">
                            {dayItems.length} {dayItems.length === 1 ? "stop" : "stops"}
                          </span>
                        </p>
                        <div className="p-3">
                        {dayItems.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No items.</p>
                        ) : (
                          <ul className="space-y-2">
                            {dayItems.map((it, idx) => (
                              <li key={it.id} className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3">
                                  <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                                    {idx + 1}
                                  </span>
                                  <div>
                                    <p className="font-medium">{it.place.name}</p>
                                    {it.place.address ? (
                                      <p className="text-sm text-muted-foreground">{it.place.address}</p>
                                    ) : null}
                                  </div>
                                </div>
                                <CategoryBadge category={it.place.category} />
                              </li>
                            ))}
                          </ul>
                        )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

      </CardContent>
    </Card>
  );
}
