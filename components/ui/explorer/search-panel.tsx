"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { useSession, signIn } from "next-auth/react";
import AuthButton from "@/components/auth-button";

type SavedItem = {
  placeId: string;
  provider: string;
  providerId: string;
  name: string;
  address: string | null;
  category: string | null;
  lat: number | null;
  lon: number | null;
};

type Itinerary = {
  id: string;
  title: string;
  daysCount: number;
  startDate: string | null;
  createdAt: string;
  updatedAt: string;
};

type ItineraryItem = {
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

async function fetchSaved(): Promise<SavedItem[]> {
  const res = await fetch("/api/saved", { cache: "no-store" });
  if (res.status === 401) return []; // not signed in yet
  if(!res.ok){
    throw new Error("Failed to load saved places")
  }
  return res.json();
}

async function savePlace(p: PlaceResult) {
  const res = await fetch("/api/saved", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
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
  if(!res.ok){
    throw new Error("Failed to save place");
  }
}

async function removePlace(placeId: string) {
  const res = await fetch("/api/saved", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ placeId }),
  });
  if(!res.ok){
    throw new Error("Failed to remove place");
  }
}

async function removeAllSaved(){
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

type PlaceResult = {
    provider: "mock" | "osm";
    providerId: string;
    name: string;
    address: string;
    category?: string;
    lat?: number;
    lon?: number;
};


export default function SearchPanel() {
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<PlaceResult[]>([]);

    const [saved, setSaved] = useState<SavedItem[]>([]);
    const [savingKey, setSavingKey] = useState<string | null>(null);

    const [savedLoading, setSavedLoading] = useState(true);
    const [savedError, setSavedError] = useState<string | null>(null);

    const [selectedSavedIds, setSelectedSavedIds] = useState<Set<string>>(new Set());
    const [genShuffle, setGenShuffle] = useState(false);

    const [itineraries, setItineraries] = useState<Itinerary[]>([]);
    const [itineraryId, setItineraryId] = useState<string | null>(null);

    const [itineraryItems, setItineraryItems] = useState<ItineraryItem[]>([]);
    const [itinLoading, setItinLoading] = useState(false);
    const [itinError, setItinError] = useState<string | null>(null);

    const [itemsLoading, setItemsLoading] = useState(false);
    const [itemsError, setItemsError] = useState<string | null>(null);

    const [creatingItin, setCreatingItin] = useState(false);
    const [generating, setGenerating] = useState(false);

    const [newItinTitle, setNewItinTitle] = useState("My Trip");
    const [newDaysCount, setNewDaysCount] = useState(3);
    const [newItinTitleError, setNewItinTitleError] = useState<string | null>(null);



    const { status } = useSession();
    const authed = status === "authenticated";

    const canSearch = useMemo(() => query.trim().length > 0 && !loading, [query, loading] );

    const selectedSavedCount = selectedSavedIds.size;

    const selectedSavedIdArray = useMemo(
      () => Array.from(selectedSavedIds),
      [selectedSavedIds]
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
      // if saved list changes (remove/refresh), drop ids that no longer exist
      setSelectedSavedIds((prev) => {
        const allowed = new Set(saved.map((s) => s.placeId));
        const next = new Set<string>();
        for (const id of prev) if (allowed.has(id)) next.add(id);
        return next;
      });
    }, [saved]);

    useEffect(() => {
      let cancelled = false;

      async function loadItins() {
        if (!authed) {
          setItineraries([]);
          setItineraryId(null);
          setItineraryItems([]);
          setItinError(null);
          setItemsError(null);
          setItinLoading(false);
          setItemsLoading(false);
          return;
        }

        try {
          setItinLoading(true);
          setItinError(null);
          const list = await fetchItineraries();
          if (cancelled) return;

          setItineraries(list);

          // pick first itinerary if none selected
          if (!itineraryId && list.length > 0) {
            setItineraryId(list[0].id);
          }
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
      // IMPORTANT: include itineraryId so we don't overwrite user selection incorrectly
    }, [authed, itineraryId]);

    useEffect(() => {
      let cancelled = false;

      async function loadItems() {
        if (!authed || !itineraryId) {
          setItineraryItems([]);
          setItemsError(null);
          setItemsLoading(false);
          return;
        }

        try {
          setItemsLoading(true);
          setItemsError(null);
          const items = await fetchItineraryItems(itineraryId);
          if (!cancelled) setItineraryItems(items);
        } catch (e) {
          if (!cancelled) {
            setItemsError(e instanceof Error ? e.message : "Failed to load itinerary items");
          }
        } finally {
          if (!cancelled) setItemsLoading(false);
        }
      }

      void loadItems();
      return () => {
        cancelled = true;
      };
    }, [authed, itineraryId]);

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
        setSaved(await fetchSaved());
      } catch (e){
        setSavedError(e instanceof Error? e.message: "Failed to load saved places");
      } finally {
        setSavedLoading(false);
      }
      
    }

    async function onSearch() {
        const q = query.trim();

        if (!q) {
            setError("Enter a city or name of neighbourhood (e.g. Toronto)");
            setResults([]);
            return;
        }
        setError(null);
        setLoading(true);
        setResults([]);


        try {
          const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`, {
            cache: "no-store",
          });

          if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(`Failed to fetch places: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
          }

          const data = (await res.json()) as PlaceResult[];
          setResults(data);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Search failed");
          setResults([]);
        } finally {
          setLoading(false);
        }

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

      // Handle duplicate name from backend
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

    async function generateItinerary(id: string, body?: unknown) {
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

      return res.json();
    }

    async function removeItineraryItem(itinId: string, itemId: string) {
      const res = await fetch(`/api/itineraries/${encodeURIComponent(itinId)}/items`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ itemId }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Failed to remove item: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
      }

      return res.json();
    }

    return (
    <Card className="w-full">

      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-2xl">Local Explorer</CardTitle>
            <CardDescription>
              Search for a City to discover its attractions and build a travel/sightseeing Itinerary!
            </CardDescription>
          </div>
          <AuthButton />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
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

        <Separator />

        <div className="space-y-2">
          
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">
            Saved{" "}
            <span className="text-xs text-muted-foreground">
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

                  // clear selection immediately + refresh list
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
            <ul className="space-y-2">
              {saved.map((s) => (
                <li key={s.placeId} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{s.name}</p>
                      {s.address ? (
                        <p className="text-sm text-muted-foreground">{s.address}</p>
                      ) : null}
                    </div>
                    
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4"
                          checked={selectedSavedIds.has(s.placeId)}
                          onChange={() => toggleSavedSelection(s.placeId)}
                          disabled={!authed}
                          aria-label={`Select ${s.name}`}
                        />

                        <div>
                          <p className="font-medium">{s.name}</p>
                          {s.address ? (
                            <p className="text-sm text-muted-foreground">{s.address}</p>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {s.category ? <Badge variant="secondary">{s.category}</Badge> : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!authed || savingKey === `remove:${s.placeId}`}
                          onClick={async () => {
                            if (!authed) {
                              void signIn("github");
                              return;
                            }

                            try {
                              setSavingKey(`remove:${s.placeId}`);
                              await removePlace(s.placeId);

                              // also drop it from selection immediately
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

                    
                  </div>
                </li>
              ))}
            </ul>
          )}

          <Separator />
        </div>
        
        

        {/* === Itinerary section (inserted here) === */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Itinerary</p>
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
                    if (newItinTitle) {
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
                    
                    const title = newItinTitle.trim();
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
                    } catch (e: any) {
                      // backend duplicate safeguard (409)
                      if (e?.code === "DUPLICATE_ITINERARY" || e?.status === 409) {
                        setNewItinTitleError(
                          e?.message || "Itinerary with this name already exists, enter a different name"
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

                  {/* generate using ALL saved */}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!itineraryId || generating}
                    onClick={async () => {
                      if (!authed) {
                        void signIn("github");
                        return;
                      }
                      if (!itineraryId) return;

                      try {
                        setGenerating(true);
                        setItemsError(null);

                        await generateItinerary(itineraryId, {
                          mode: "replace",
                          perDay: 3,          // <- fixed now
                          shuffle: genShuffle,
                        });

                        const items = await fetchItineraryItems(itineraryId);
                        setItineraryItems(items);
                      } catch (e) {
                        setItemsError(e instanceof Error ? e.message : "Failed to generate itinerary");
                      } finally {
                        setGenerating(false);
                      }
                    }}
                  >
                    {generating ? "Generating..." : "Generate (all saved)"}
                  </Button>

                  {/* generate using SELECTED saved */}
                  <Button
                    type="button"
                    disabled={!itineraryId || generating || selectedSavedCount === 0}
                    onClick={async () => {
                      if (!authed) {
                        void signIn("github");
                        return;
                      }
                      if (!itineraryId) return;

                      try {
                        setGenerating(true);
                        setItemsError(null);

                        await generateItinerary(itineraryId, {
                          mode: "replace",
                          perDay: 3,          // <- fixed now
                          shuffle: genShuffle,
                          placeIds: selectedSavedIdArray,
                        });

                        const items = await fetchItineraryItems(itineraryId);
                        setItineraryItems(items);
                      } catch (e) {
                        setItemsError(e instanceof Error ? e.message : "Failed to generate itinerary");
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
                  No items yet. Click <span className="font-medium">Generate (replace)</span>.
                </p>
              ) : (
                <div className="space-y-3">
                  {Array.from({ length: selectedItinerary.daysCount }, (_, day) => {
                    const dayItems = itemsByDay.get(day) ?? [];
                    return (
                      <div key={day} className="rounded-lg border p-3">
                        <p className="text-sm font-medium">Day {day + 1}</p>

                        {dayItems.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No items.</p>
                        ) : (
                          <ul className="mt-2 space-y-2">
                            {dayItems.map((it) => (
                              <li key={it.id} className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium">{it.place.name}</p>
                                  {it.place.address ? (
                                    <p className="text-sm text-muted-foreground">{it.place.address}</p>
                                  ) : null}
                                </div>
                                {it.place.category ? <Badge variant="secondary">{it.place.category}</Badge> : null}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <Separator />



        {results.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            search for a city to see its nearby attractions.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Showing {results.length} results for <span className="font-medium">{query.trim()}</span>
            </p>

            <ul className="space-y-2">
              {results.map((r) => (
                <li key={r.providerId} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3"> 
                    <div>
                      <p className="font-medium">{r.name}</p>
                      <p className="text-sm text-muted-foreground">{r.address}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {r.category ? <Badge variant="secondary">{r.category}</Badge> : null}

                      <Button
                        type="button"
                        size="sm"
                        variant={savedKeys.has(`${r.provider}:${r.providerId}`) ? "secondary" : "default"}
                        disabled={savingKey === `${r.provider}:${r.providerId}`}

                        onClick={async () => {
                          if (!authed){
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
                        }}
                      >
                        {savedKeys.has(`${r.provider}:${r.providerId}`) ? "Saved" : "Save"}
                      </Button>
                    </div>
                  </div>

                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}