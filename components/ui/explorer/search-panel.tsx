"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { MapPin, PanelLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/theme-toggle";
import { updateUserPreferences, useUserPreferences } from "@/lib/preferences";
import { AppSidebar } from "./app-sidebar";
import { SettingsDialog } from "./settings-dialog";
import { SearchSection } from "./search-section";
import { SavedSection } from "./saved-section";
import { ItinerarySection } from "./itinerary-section";
import { ChatPanel } from "./chat-panel";
import type {
  ChatMessage,
  ChatSideEffect,
  Itinerary,
  ItineraryItem,
  PlaceResult,
  SavedItem,
  SearchPanelProps,
  SettingsDialogTab,
  SidebarUser,
} from "./types";

export type { SavedItem, Itinerary, ItineraryItem, SearchPanelProps } from "./types";

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

async function deleteItineraryApi(id: string): Promise<void> {
  const res = await fetch(`/api/itineraries/${encodeURIComponent(id)}`, {
    method: "DELETE",
    cache: "no-store",
  });
  if (res.status === 404) return;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to delete itinerary: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
  }
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

// ── SearchPanel (Workspace Orchestrator) ──────────────────────────────────────

export default function SearchPanel({
  initialUserId = null,
  initialUser = null,
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
  const [deletingItinId, setDeletingItinId] = useState<string | null>(null);
  const [sidebarError, setSidebarError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const preferences = useUserPreferences();

  const [newItinTitle, setNewItinTitle] = useState("");
  const [newDaysOverride, setNewDaysOverride] = useState<string | null>(null);
  const [newItinTitleError, setNewItinTitleError] = useState<string | null>(null);
  const newDaysInput = newDaysOverride ?? String(preferences.defaultDays);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [settingsDialogTab, setSettingsDialogTab] = useState<SettingsDialogTab | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const newTitleInputRef = useRef<HTMLInputElement | null>(null);
  const mobileSidebarTriggerRef = useRef<HTMLButtonElement | null>(null);
  const desktopAccountTriggerRef = useRef<HTMLButtonElement | null>(null);
  const prevMobileSidebarOpenRef = useRef(false);
  const skipMobileFocusRestoreRef = useRef(false);
  const activeUserIdRef = useRef<string | null>(initialUserId);
  const itinerariesRef = useRef<Itinerary[]>(initialItineraries);
  const itineraryIdRef = useRef<string | null>(initialItineraryId);
  const searchAbortRef = useRef<AbortController | null>(null);
  const newItinErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const activeUser: SidebarUser | null =
    status === "loading"
      ? initialUser
      : status === "authenticated" && sessionData?.user?.id
      ? {
          id: sessionData.user.id,
          name: sessionData.user.name ?? null,
          email: sessionData.user.email ?? null,
          image: sessionData.user.image ?? null,
        }
      : null;
  const authed = Boolean(activeUserId);
  const activeItemsKey =
    activeUserId && itineraryId ? `${activeUserId}:${itineraryId}` : null;

  function clearTitleErrorTimer() {
    if (newItinErrorTimerRef.current) {
      clearTimeout(newItinErrorTimerRef.current);
      newItinErrorTimerRef.current = null;
    }
  }

  function showTitleError(msg: string) {
    clearTitleErrorTimer();
    setNewItinTitleError(msg);
    newItinErrorTimerRef.current = setTimeout(() => {
      newItinErrorTimerRef.current = null;
      setNewItinTitleError(null);
    }, 2500);
  }

  useEffect(() => {
    activeUserIdRef.current = activeUserId;
  }, [activeUserId]);

  useEffect(() => {
    activeItemsKeyRef.current = activeItemsKey;
  }, [activeItemsKey]);

  useEffect(() => {
    itinerariesRef.current = itineraries;
  }, [itineraries]);

  useEffect(() => {
    itineraryIdRef.current = itineraryId;
  }, [itineraryId]);

  useEffect(() => {
    const wasOpen = prevMobileSidebarOpenRef.current;
    prevMobileSidebarOpenRef.current = mobileSidebarOpen;
    if (wasOpen && !mobileSidebarOpen) {
      if (skipMobileFocusRestoreRef.current) {
        skipMobileFocusRestoreRef.current = false;
      } else if (window.innerWidth < 1024) {
        mobileSidebarTriggerRef.current?.focus({ preventScroll: true });
      }
    }
  }, [mobileSidebarOpen]);

  useEffect(() => {
    return () => {
      searchAbortRef.current?.abort();
      clearTitleErrorTimer();
    };
  }, []);

  useEffect(() => {
    if (settingsDialogTab !== null) return;
    if (!chatOpen && !mobileSidebarOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (chatOpen) setChatOpen(false);
      else if (mobileSidebarOpen) setMobileSidebarOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [chatOpen, mobileSidebarOpen, settingsDialogTab]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    function handleChange(e: MediaQueryListEvent) {
      if (e.matches) setMobileSidebarOpen(false);
    }
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
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
        itinerariesRef.current = [];
        itineraryIdRef.current = null;
        setItineraries([]);
        setItineraryId(null);
        setItineraryItems([]);
        setItinError(null);
        setSidebarError(null);
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
        itinerariesRef.current = list;
        setItineraries(list);
        const currId = itineraryIdRef.current;
        const resolvedId =
          currId && list.some((i) => i.id === currId)
            ? currId
            : urlItinId && list.some((i) => i.id === urlItinId)
            ? urlItinId
            : list[0]?.id ?? null;
        itineraryIdRef.current = resolvedId;
        setItineraryId(resolvedId);
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
    } catch (e) {
      setSavedError(e instanceof Error ? e.message : "Failed to load saved places");
    } finally {
      setSavedLoading(false);
    }
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

  function handleSearch() {
    const q = query.trim();
    if (!q) {
      searchAbortRef.current?.abort();
      searchAbortRef.current = null;
      setLoading(false);
      setSearchedQuery("");
      setError("Enter a city or neighbourhood name (e.g. Toronto).");
      setResults([]);
      return;
    }
    void performSearch(q);
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

  async function handleRemovePlace(placeId: string) {
    if (!authed) {
      void signIn("github");
      return;
    }
    try {
      setSavingKey(`remove:${placeId}`);
      setSavedError(null);
      await removePlace(placeId);
      setSelectedSavedIds((prev) => {
        const next = new Set(prev);
        next.delete(placeId);
        return next;
      });
      await refreshSaved();
    } catch (e) {
      setSavedError(e instanceof Error ? e.message : "Failed to remove place");
    } finally {
      setSavingKey(null);
    }
  }

  async function handleRemoveAllSaved() {
    if (!authed) {
      void signIn("github");
      return;
    }
    try {
      setSavingKey("remove-all");
      setSavedError(null);
      await removeAllSaved();
      setSelectedSavedIds(new Set());
      await refreshSaved();
    } catch (e) {
      setSavedError(e instanceof Error ? e.message : "Failed to remove all saved places");
    } finally {
      setSavingKey(null);
    }
  }

  function parseClampedDays(raw: string): number {
    const n = Number(raw);
    if (!raw.trim() || !Number.isFinite(n)) return preferences.defaultDays;
    return Math.max(1, Math.min(Math.trunc(n), 14));
  }

  async function handleCreateItinerary() {
    if (!authed) {
      void signIn("github");
      return;
    }
    const trimmed = newItinTitle.trim();
    if (!trimmed) return;

    if (titleAlreadyExists) {
      showTitleError("An itinerary with this name already exists — enter a different name.");
      return;
    }

    const daysCount = parseClampedDays(newDaysInput);
    setNewDaysOverride(daysCount === preferences.defaultDays ? null : String(daysCount));

    try {
      setCreatingItin(true);
      setItinError(null);

      const created = await createItinerary(trimmed, daysCount);
      const list = await fetchItineraries();
      itinerariesRef.current = list;
      setItineraries(list);
      itineraryIdRef.current = created.id;
      setItineraryId(created.id);
      setNewItinTitle("");
      setNewDaysOverride(null);
      clearTitleErrorTimer();
      setNewItinTitleError(null);
    } catch (e: unknown) {
      const err = e as { code?: string; status?: number; message?: string };
      if (err?.code === "DUPLICATE_ITINERARY" || err?.status === 409) {
        showTitleError(
          err?.message || "An itinerary with this name already exists — enter a different name."
        );
        return;
      }
      setItinError(e instanceof Error ? e.message : "Failed to create itinerary");
    } finally {
      setCreatingItin(false);
    }
  }

  async function handleDeleteItinerary(id: string) {
    if (!authed || !activeUserId || deletingItinId !== null) return;
    const requestUserId = activeUserId;
    const deletedKey = `${requestUserId}:${id}`;

    try {
      setDeletingItinId(id);
      setSidebarError(null);
      await deleteItineraryApi(id);
      if (activeUserIdRef.current !== requestUserId) return;

      const nextList = itinerariesRef.current.filter((it) => it.id !== id);
      itinerariesRef.current = nextList;
      setItineraries(nextList);

      if (loadedItemsKeyRef.current === deletedKey) {
        loadedItemsKeyRef.current = null;
      }

      if (itineraryIdRef.current === id) {
        const nextId = nextList[0]?.id ?? null;
        itemsFetchReqIdRef.current++;
        itineraryIdRef.current = nextId;
        setItineraryId(nextId);
      }
    } catch (e) {
      if (activeUserIdRef.current === requestUserId) {
        setSidebarError(e instanceof Error ? e.message : "Failed to delete trip");
      }
    } finally {
      setDeletingItinId(null);
    }
  }

  function handleNavigateSection(section: "discover" | "saved" | "itinerary") {
    const el = document.getElementById(section);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleNewTrip() {
    if (mobileSidebarOpen) {
      skipMobileFocusRestoreRef.current = true;
      setMobileSidebarOpen(false);
    }
    handleNavigateSection("itinerary");
    requestAnimationFrame(() => {
      newTitleInputRef.current?.focus({ preventScroll: true });
    });
  }

  function handleToggleChat() {
    const next = !chatOpen;
    setChatOpen(next);
    if (next) setMobileSidebarOpen(false);
  }

  function handleOpenMobileSidebar() {
    setChatOpen(false);
    setMobileSidebarOpen(true);
  }

  function handleOpenSettings(tab: SettingsDialogTab, fromMobile: boolean) {
    if (fromMobile && mobileSidebarOpen) {
      skipMobileFocusRestoreRef.current = true;
      setMobileSidebarOpen(false);
    }
    setSettingsDialogTab(tab);
  }

  function handleCloseSettings() {
    setSettingsDialogTab(null);
    requestAnimationFrame(() => {
      if (window.innerWidth < 1024) {
        mobileSidebarTriggerRef.current?.focus();
      } else {
        desktopAccountTriggerRef.current?.focus();
      }
    });
  }

  async function handleGenerate(useSelected: boolean) {
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
        perDay: preferences.defaultPerDay,
        shuffle: genShuffle,
        ...(useSelected ? { placeIds: selectedSavedIdArray } : {}),
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
  }

  async function handleChatSend(overrideText?: string) {
    const text = (overrideText ?? chatInput).trim();
    if (!text || chatLoading) return;

    const newMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    const apiMessages = newMessages
      .filter((m) => !m.isError)
      .map(({ role, content }) => ({ role, content }));
    setMessages(newMessages);
    if (overrideText === undefined) setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          context: {
            savedCount: saved.length,
            selectedSavedCount,
            itineraryCount: itineraries.length,
            activeItineraryId: itineraryId ?? undefined,
            activeItineraryTitle: selectedItinerary?.title,
            defaultDays: preferences.defaultDays,
            defaultPerDay: preferences.defaultPerDay,
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
          itinerariesRef.current = list;
          setItineraries(list);
          if (effect.selectId) {
            if (generatedIds.has(effect.selectId)) {
              deferredSelectId = effect.selectId;
            } else {
              itineraryIdRef.current = effect.selectId;
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
            itineraryIdRef.current = effect.itineraryId;
            setItineraryId(effect.itineraryId);
            if (deferredSelectId === effect.itineraryId) {
              deferredSelectId = null;
            }
          } catch (e) {
            genError = e instanceof Error ? e.message : "Generation failed";
            if (deferredSelectId) {
              itineraryIdRef.current = deferredSelectId;
              setItineraryId(deferredSelectId);
              deferredSelectId = null;
            }
          }
        }
      }

      if (deferredSelectId) {
        itineraryIdRef.current = deferredSelectId;
        setItineraryId(deferredSelectId);
      }

      const assistantText = genError ? `Generation failed: ${genError}` : data.message;

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
          content:
            err?.status === 401
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

  return (
    <>
      <div className="flex min-h-screen" inert={settingsDialogTab !== null}>
        <AppSidebar
          authed={authed}
          authLoading={status === "loading"}
          user={activeUser}
          itineraries={itineraries}
          itineraryId={itineraryId}
          savedCount={saved.length}
          itineraryItemCount={itemsLoading || itemsError ? null : itineraryItems.length}
          deletingItinId={deletingItinId}
          sidebarError={sidebarError}
          collapsed={sidebarCollapsed}
          mobileOpen={mobileSidebarOpen}
          settingsOpen={settingsDialogTab !== null}
          desktopAccountTriggerRef={desktopAccountTriggerRef}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          onCloseMobile={() => setMobileSidebarOpen(false)}
          onDismissSidebarError={() => setSidebarError(null)}
          onNavigateSection={handleNavigateSection}
          onSelectItinerary={(id) => {
            setSidebarError(null);
            itineraryIdRef.current = id;
            setItineraryId(id);
          }}
          onNewTrip={handleNewTrip}
          onDeleteItinerary={handleDeleteItinerary}
          onOpenSettings={handleOpenSettings}
        />

      <main inert={mobileSidebarOpen} className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-7">
        <div className="mx-auto w-full max-w-6xl space-y-5">
          {/* Top Workspace Bar */}
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2.5">
              <Button
                ref={mobileSidebarTriggerRef}
                type="button"
                variant="outline"
                size="icon-sm"
                className="lg:hidden"
                onClick={handleOpenMobileSidebar}
                aria-label="Open navigation sidebar"
                aria-expanded={mobileSidebarOpen}
                aria-controls="mobile-sidebar"
              >
                <PanelLeft size={16} />
              </Button>

              {/* Brand lockup shown on mobile (< lg); desktop brand lives in the sidebar */}
              <div className="flex min-w-0 items-center gap-2.5 lg:hidden">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
                  <MapPin size={18} />
                </span>
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-semibold tracking-tight">Local Explorer</h1>
                  <p className="truncate text-xs text-muted-foreground">
                    Discover attractions and plan itineraries.
                  </p>
                </div>
              </div>

              {/* Desktop context heading */}
              <div className="hidden min-w-0 lg:block">
                <h1 className="truncate text-xl font-semibold tracking-tight">
                  {selectedItinerary ? selectedItinerary.title : "Explore & Plan"}
                </h1>
                <p className="truncate text-xs text-muted-foreground">
                  {selectedItinerary
                    ? `${selectedItinerary.daysCount} ${selectedItinerary.daysCount === 1 ? "day" : "days"} · Discover attractions and organize your schedule.`
                    : "Discover attractions and build day-by-day itineraries."}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
              <Button
                type="button"
                variant={chatOpen ? "default" : "outline"}
                size="sm"
                onClick={handleToggleChat}
                aria-expanded={chatOpen}
                aria-controls="assistant-drawer"
              >
                <Sparkles size={14} />
                Assistant
              </Button>
              <ThemeToggle />
              {!authed && status !== "loading" ? (
                <Button
                  type="button"
                  size="sm"
                  className="lg:hidden"
                  onClick={() => void signIn("github")}
                >
                  Sign in
                </Button>
              ) : null}
            </div>
          </header>

          {/* Row 1: Full-width Discover Places */}
          <SearchSection
            query={query}
            searchedQuery={searchedQuery}
            loading={loading}
            canSearch={canSearch}
            error={error}
            results={results}
            savedKeys={savedKeys}
            savingKey={savingKey}
            onQueryChange={setQuery}
            onSearch={handleSearch}
            onSave={handleSavePlace}
          />

          {/* Row 2: Matched-height Saved (left) + Itinerary (right) */}
          <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-12">
            <SavedSection
              authed={authed}
              saved={saved}
              savedLoading={savedLoading}
              savedError={savedError}
              activeSelectedSavedIds={activeSelectedSavedIds}
              selectedSavedCount={selectedSavedCount}
              savingKey={savingKey}
              onToggleSelect={toggleSavedSelection}
              onSelectAll={selectAllSaved}
              onClearSelected={clearSelectedSaved}
              onRemoveOne={handleRemovePlace}
              onRemoveAll={handleRemoveAllSaved}
            />

            <ItinerarySection
              authed={authed}
              itineraries={itineraries}
              itineraryId={itineraryId}
              selectedItinerary={selectedItinerary}
              itineraryItems={itineraryItems}
              itemsByDay={itemsByDay}
              itinLoading={itinLoading}
              itinError={itinError}
              itemsLoading={itemsLoading}
              itemsError={itemsError}
              creatingItin={creatingItin}
              generating={generating}
              newItinTitle={newItinTitle}
              newDaysInput={newDaysInput}
              newItinTitleError={newItinTitleError}
              genShuffle={genShuffle}
              selectedSavedCount={selectedSavedCount}
              newTitleInputRef={newTitleInputRef}
              onNewTitleChange={(val) => {
                setNewItinTitle(val);
                if (newItinTitleError) {
                  clearTitleErrorTimer();
                  setNewItinTitleError(null);
                }
              }}
              onNewDaysChange={setNewDaysOverride}
              onNewDaysBlur={() => {
                const clamped = parseClampedDays(newDaysInput);
                setNewDaysOverride(clamped === preferences.defaultDays ? null : String(clamped));
              }}
              onCreateItinerary={handleCreateItinerary}
              onSelectItinerary={(id) => {
                setSidebarError(null);
                itineraryIdRef.current = id;
                setItineraryId(id);
              }}
              onToggleShuffle={setGenShuffle}
              onGenerateAll={() => handleGenerate(false)}
              onGenerateSelected={() => handleGenerate(true)}
            />
          </div>
        </div>
      </main>

      {/* Mobile backdrop when Assistant drawer is open */}
      {chatOpen ? (
        <div
          aria-hidden="true"
          onClick={() => setChatOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 sm:hidden"
        />
      ) : null}

      {/* Non-blocking right slide-over Assistant drawer */}
      <aside
        id="assistant-drawer"
        aria-label="AI Assistant"
        inert={!chatOpen}
        aria-hidden={!chatOpen}
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-sm border-l bg-card p-4 shadow-2xl transition-transform duration-200 ease-out ${
          chatOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <ChatPanel
          messages={messages}
          input={chatInput}
          loading={chatLoading}
          authed={authed}
          savedCount={saved.length}
          hasActiveItinerary={Boolean(itineraryId)}
          onInputChange={setChatInput}
          onSend={(text) => void handleChatSend(text)}
          onClose={() => setChatOpen(false)}
        />
      </aside>
      </div>

      <SettingsDialog
        openTab={settingsDialogTab}
        user={authed ? activeUser : null}
        preferences={preferences}
        onTabChange={setSettingsDialogTab}
        onUpdatePreferences={(patch) => {
          updateUserPreferences(patch);
        }}
        onClose={handleCloseSettings}
      />
    </>
  );
}
