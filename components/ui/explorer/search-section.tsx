"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Check, Compass, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { buildGoogleMapsPlaceUrl } from "@/lib/maps-links";
import { CategoryBadge, formatCategoryLabel } from "./category-badge";
import type { PlaceResult } from "./types";

type SearchSectionProps = {
  query: string;
  searchedQuery: string;
  loading: boolean;
  canSearch: boolean;
  error: string | null;
  results: PlaceResult[];
  savedKeys: Set<string>;
  savingKey: string | null;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onSave: (r: PlaceResult) => Promise<void>;
};

const PAGE_SIZE = 10;

export function SearchSection({
  query,
  searchedQuery,
  loading,
  canSearch,
  error,
  results,
  savedKeys,
  savingKey,
  onQueryChange,
  onSearch,
  onSave,
}: SearchSectionProps) {
  const [viewState, setViewState] = useState<{
    forResults: PlaceResult[];
    category: string;
    count: number;
  }>({
    forResults: results,
    category: "all",
    count: PAGE_SIZE,
  });

  const activeCategory = viewState.forResults === results ? viewState.category : "all";
  const visibleCount = viewState.forResults === results ? viewState.count : PAGE_SIZE;

  const categories = useMemo(() => {
    const map = new Map<string, { key: string; label: string; count: number }>();
    let uncategorizedCount = 0;

    for (const r of results) {
      const raw = r.category?.trim();
      if (!raw) {
        uncategorizedCount++;
        continue;
      }
      const key = raw.toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.count++;
      } else {
        map.set(key, { key, label: formatCategoryLabel(raw), count: 1 });
      }
    }

    const list = Array.from(map.values()).sort(
      (a, b) => b.count - a.count || a.label.localeCompare(b.label)
    );
    if (uncategorizedCount > 0 && list.length > 0) {
      list.push({ key: "__other__", label: "Other", count: uncategorizedCount });
    }
    return list;
  }, [results]);

  const filtered = useMemo(() => {
    if (activeCategory === "all") return results;
    if (activeCategory === "__other__") {
      return results.filter((r) => !r.category?.trim());
    }
    return results.filter((r) => r.category?.trim().toLowerCase() === activeCategory);
  }, [results, activeCategory]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  function selectCategory(key: string) {
    setViewState({ forResults: results, category: key, count: PAGE_SIZE });
  }

  return (
    <section id="discover" className="min-w-0 scroll-mt-6 space-y-3.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[13px] font-medium tracking-tight text-foreground">
          <Compass size={15} strokeWidth={1.5} className="text-muted-foreground" />
          Discover Places
        </h2>
        {results.length > 0 && !loading ? (
          <span className="text-xs text-muted-foreground">
            Showing {visible.length} of {filtered.length}
            {activeCategory !== "all" ? ` (${results.length} total)` : ""} for{" "}
            <span className="font-medium text-foreground">{searchedQuery.trim()}</span>
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 @min-[480px]/workspace:flex-row">
        <div className="relative flex-1">
          <Search
            size={14}
            strokeWidth={1.5}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search a city or neighbourhood (e.g. Toronto, Kyoto)"
            className="pl-9"
            onKeyDown={(e) => {
              if (e.key === "Enter") onSearch();
            }}
          />
        </div>
        <Button type="button" onClick={onSearch} disabled={!canSearch}>
          {loading ? "Searching…" : "Search"}
        </Button>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-2" aria-label="Loading search results">
          <div className="h-3.5 w-40 animate-pulse rounded bg-muted/70" />
          <div className="divide-y divide-border/50 border-y border-border/50">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="h-3.5 w-2/5 animate-pulse rounded bg-muted/70" />
                  <div className="h-3 w-1/4 animate-pulse rounded bg-muted/50" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-5 w-16 animate-pulse rounded-md bg-muted/70" />
                  <div className="h-7 w-14 animate-pulse rounded-md bg-muted/70" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : results.length === 0 ? (
        error ? null : searchedQuery ? (
          <div className="rounded-lg border border-dashed border-border/70 px-4 py-7 text-center">
            <p className="text-sm font-medium">
              No attractions found for &ldquo;{searchedQuery.trim()}&rdquo;
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Try a nearby major city or a broader neighbourhood name.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border/70 px-4 py-7 text-center">
            <p className="text-sm font-medium text-foreground/85">
              Search for a city to discover nearby attractions
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Save the places you like, then generate a day-by-day itinerary.
            </p>
          </div>
        )
      ) : (
        <div className="space-y-2.5">
          {categories.length > 1 ? (
            <div
              className="flex flex-wrap items-center gap-1"
              role="group"
              aria-label="Filter by category"
            >
              <button
                type="button"
                onClick={() => selectCategory("all")}
                aria-pressed={activeCategory === "all"}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  activeCategory === "all"
                    ? "bg-sidebar-accent/90 text-foreground ring-1 ring-inset ring-border/70"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                All
                <span className="ml-1 text-[11px] tabular-nums opacity-75">{results.length}</span>
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => selectCategory(cat.key)}
                  aria-pressed={activeCategory === cat.key}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    activeCategory === cat.key
                      ? "bg-sidebar-accent/90 text-foreground ring-1 ring-inset ring-border/70"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  }`}
                >
                  {cat.label}
                  <span className="ml-1 text-[11px] tabular-nums opacity-75">{cat.count}</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="max-h-[24rem] overflow-y-auto border-y border-border/50 pr-1">
            <ul className="divide-y divide-border/50">
              {visible.map((r) => {
                const key = `${r.provider}:${r.providerId}`;
                const isSaved = savedKeys.has(key);
                const address = r.address?.trim();
                const mapsUrl = buildGoogleMapsPlaceUrl({
                  name: r.name,
                  address,
                  lat: r.lat,
                  lon: r.lon,
                  cityHint: searchedQuery,
                });
                return (
                  <li
                    key={r.providerId}
                    className="px-0.5 py-2.5 transition-colors hover:bg-accent/25 @min-[480px]/workspace:px-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {mapsUrl ? (
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Open ${r.name} in Google Maps`}
                            aria-label={`${r.name} — open in Google Maps (opens in a new tab)`}
                            className="group/link inline-flex max-w-full items-center gap-1 text-sm font-medium text-foreground underline-offset-2 transition-colors hover:text-primary hover:underline focus-visible:rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <span className="truncate">{r.name}</span>
                            <ArrowUpRight
                              size={12}
                              strokeWidth={1.5}
                              aria-hidden="true"
                              className="shrink-0 text-muted-foreground/60 transition-colors group-hover/link:text-primary"
                            />
                          </a>
                        ) : (
                          <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
                        )}
                        {r.category ? (
                          <div className="mt-1 @min-[480px]/workspace:hidden">
                            <CategoryBadge category={r.category} />
                          </div>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <CategoryBadge
                          category={r.category}
                          className="hidden @min-[480px]/workspace:inline-flex"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant={isSaved ? "ghost" : "outline"}
                          disabled={isSaved || savingKey === key}
                          onClick={() => void onSave(r)}
                          className={
                            isSaved
                              ? "h-7 gap-1 px-2 text-xs text-muted-foreground"
                              : "h-7 gap-1 border-border/70 px-2.5 text-xs"
                          }
                        >
                          {isSaved ? (
                            <>
                              <Check size={13} strokeWidth={1.5} />
                              Saved
                            </>
                          ) : savingKey === key ? (
                            "Saving…"
                          ) : (
                            <>
                              <Plus size={13} strokeWidth={1.5} />
                              Save
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {hasMore ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="w-full text-xs text-muted-foreground hover:text-foreground"
              onClick={() =>
                setViewState((prev) => ({
                  forResults: results,
                  category: prev.forResults === results ? prev.category : "all",
                  count: (prev.forResults === results ? prev.count : PAGE_SIZE) + PAGE_SIZE,
                }))
              }
            >
              Show more results ({filtered.length - visibleCount} remaining)
            </Button>
          ) : null}
        </div>
      )}
    </section>
  );
}
