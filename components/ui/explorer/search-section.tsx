"use client";

import { useMemo, useState } from "react";
import { Compass, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "./category-badge";
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
        map.set(key, { key, label: raw, count: 1 });
      }
    }

    const list = Array.from(map.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
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
    <Card id="discover" className="min-w-0 flex-1 scroll-mt-6 gap-4 py-5">
      <CardHeader className="px-5">
        <CardTitle className="flex items-center gap-2 text-base">
          <Compass size={16} className="text-primary" />
          Discover Places
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4 px-5">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search
              size={15}
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
            <div className="h-4 w-44 animate-pulse rounded bg-muted" />
            <div className="divide-y rounded-lg border">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="h-4 w-2/5 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-1/4 animate-pulse rounded bg-muted/70" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
                    <div className="h-8 w-14 animate-pulse rounded-md bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : results.length === 0 ? (
          error ? null : searchedQuery ? (
            <div className="rounded-lg border border-dashed px-4 py-8 text-center">
              <p className="text-sm font-medium">
                No attractions found for &ldquo;{searchedQuery.trim()}&rdquo;
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Try a nearby major city or a broader neighbourhood name.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground/80">
                Search for a city to discover nearby attractions
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Save the places you like, then generate a day-by-day itinerary.
              </p>
            </div>
          )
        ) : (
          <div className="space-y-3">
            {categories.length > 1 ? (
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by category">
                <button
                  type="button"
                  onClick={() => selectCategory("all")}
                  aria-pressed={activeCategory === "all"}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                    activeCategory === "all"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  All ({results.length})
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => selectCategory(cat.key)}
                    aria-pressed={activeCategory === cat.key}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      activeCategory === cat.key
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    {cat.label} ({cat.count})
                  </button>
                ))}
              </div>
            ) : null}

            <p className="text-xs text-muted-foreground">
              Showing {visible.length} of {filtered.length}
              {activeCategory !== "all" ? ` (${results.length} total)` : ""} for{" "}
              <span className="font-medium text-foreground">{searchedQuery.trim()}</span>
            </p>

            <div className="max-h-[26rem] overflow-y-auto rounded-lg border">
              <ul className="divide-y">
                {visible.map((r) => {
                  const key = `${r.provider}:${r.providerId}`;
                  const isSaved = savedKeys.has(key);
                  const address = r.address?.trim();
                  return (
                    <li key={r.providerId} className="p-3 transition-colors hover:bg-accent/30">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{r.name}</p>
                          {address ? (
                            <p className="truncate text-xs text-muted-foreground">{address}</p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <CategoryBadge category={r.category} />
                          <Button
                            type="button"
                            size="sm"
                            variant={isSaved ? "secondary" : "default"}
                            disabled={isSaved || savingKey === key}
                            onClick={() => void onSave(r)}
                          >
                            {isSaved ? "Saved" : savingKey === key ? "Saving…" : "Save"}
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
                variant="outline"
                className="w-full"
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
      </CardContent>
    </Card>
  );
}
