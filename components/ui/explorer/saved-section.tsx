"use client";

import { type RefObject, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Bookmark, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildGoogleMapsPlaceUrl } from "@/lib/maps-links";
import { CategoryBadge } from "./category-badge";
import type { SavedItem } from "./types";

const SAVED_MIN_HEIGHT = 256;
const SPLIT_WORKSPACE_WIDTH = 900;

type SavedSectionProps = {
  authed: boolean;
  saved: SavedItem[];
  savedLoading: boolean;
  savedError: string | null;
  activeSelectedSavedIds: Set<string>;
  selectedSavedCount: number;
  savingKey: string | null;
  workspaceContainerRef: RefObject<HTMLDivElement | null>;
  onToggleSelect: (placeId: string) => void;
  onSelectAll: () => void;
  onClearSelected: () => void;
  onRemoveOne: (placeId: string) => Promise<void>;
  onRemoveAll: () => Promise<void>;
};

export function SavedSection({
  authed,
  saved,
  savedLoading,
  savedError,
  activeSelectedSavedIds,
  selectedSavedCount,
  savingKey,
  workspaceContainerRef,
  onToggleSelect,
  onSelectAll,
  onClearSelected,
  onRemoveOne,
  onRemoveAll,
}: SavedSectionProps) {
  const [savedHeight, setSavedHeight] = useState<number | null>(null);
  const [savedAtMax, setSavedAtMax] = useState(false);
  const [confirmingRemoveAll, setConfirmingRemoveAll] = useState(false);

  const savedScrollRef = useRef<HTMLDivElement | null>(null);
  const savedListRef = useRef<HTMLUListElement | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearConfirmTimer() {
    if (confirmTimerRef.current) {
      clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = null;
    }
  }

  // Sync drag-resize state with the unpadded @container/workspace width so crossing into
  // side-by-side mode (>= 900px) clears any stale inline height, and stacked width changes
  // clear height if the list naturally fits <= SAVED_MIN_HEIGHT.
  useEffect(() => {
    const containerEl = workspaceContainerRef.current;
    if (!containerEl || typeof ResizeObserver === "undefined") return;

    let wasWide = containerEl.getBoundingClientRect().width >= SPLIT_WORKSPACE_WIDTH;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
      const isWide = width >= SPLIT_WORKSPACE_WIDTH;

      if (!wasWide && isWide) {
        dragCleanupRef.current?.();
        setSavedHeight(null);
        setSavedAtMax(false);
      } else if (!isWide) {
        const listHeight = savedListRef.current?.offsetHeight ?? 0;
        if (listHeight > 0 && listHeight <= SAVED_MIN_HEIGHT) {
          setSavedHeight(null);
          setSavedAtMax(false);
        }
      }
      wasWide = isWide;
    });

    observer.observe(containerEl);
    return () => observer.disconnect();
  }, [workspaceContainerRef]);

  useEffect(() => {
    return () => {
      if (dragCleanupRef.current) dragCleanupRef.current();
      clearConfirmTimer();
    };
  }, []);

  // Reset custom resize & confirm state when signed out, emptied, or list naturally shrinks <= SAVED_MIN_HEIGHT.
  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      if (!authed || saved.length === 0) {
        clearConfirmTimer();
        setConfirmingRemoveAll(false);
        setSavedHeight(null);
        setSavedAtMax(false);
        return;
      }
      const listHeight = savedListRef.current?.offsetHeight ?? 0;
      if (listHeight > 0 && listHeight <= SAVED_MIN_HEIGHT) {
        setSavedHeight(null);
        setSavedAtMax(false);
      }
    });
    return () => cancelAnimationFrame(rafId);
  }, [authed, saved.length]);

  function handleSavedDividerMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    if (saved.length === 0) return;
    const container = savedScrollRef.current;
    const list = savedListRef.current;
    if (!container || !list) return;

    const maxHeight = list.offsetHeight;
    if (maxHeight <= SAVED_MIN_HEIGHT) return;

    dragCleanupRef.current?.();
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

  function startRemoveAllConfirm() {
    clearConfirmTimer();
    setConfirmingRemoveAll(true);
    confirmTimerRef.current = setTimeout(() => {
      confirmTimerRef.current = null;
      setConfirmingRemoveAll(false);
    }, 4000);
  }

  function cancelRemoveAllConfirm() {
    clearConfirmTimer();
    setConfirmingRemoveAll(false);
  }

  async function confirmRemoveAll() {
    clearConfirmTimer();
    setConfirmingRemoveAll(false);
    await onRemoveAll();
  }

  const showConfirmButtons =
    confirmingRemoveAll && authed && saved.length > 0 && savingKey !== "remove-all";

  return (
    <section
      id="saved"
      className="@container/saved flex min-w-0 scroll-mt-6 flex-col gap-3 @min-[900px]/workspace:col-span-5"
    >
      {/* Header + Toolbar */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-[13px] font-medium tracking-tight text-foreground">
            <Bookmark size={15} strokeWidth={1.5} className="text-muted-foreground" />
            Saved
            <span className="text-xs font-normal tabular-nums text-muted-foreground">
              {selectedSavedCount}/{saved.length} selected
            </span>
          </h2>
        </div>

        {authed ? (
          <div className="flex flex-wrap items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              disabled={saved.length === 0}
              onClick={onSelectAll}
            >
              Select all
            </Button>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              disabled={selectedSavedCount === 0}
              onClick={onClearSelected}
            >
              Clear
            </Button>

            {showConfirmButtons ? (
              <div className="ml-auto flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="h-7 px-2.5 text-xs"
                  onClick={() => void confirmRemoveAll()}
                >
                  Confirm?
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={cancelRemoveAllConfirm}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="ml-auto h-7 px-2 text-xs text-destructive/85 hover:bg-destructive/10 hover:text-destructive"
                disabled={saved.length === 0 || savingKey === "remove-all"}
                onClick={startRemoveAllConfirm}
              >
                {savingKey === "remove-all" ? "Removing…" : "Remove all"}
              </Button>
            )}
          </div>
        ) : null}
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col space-y-2">
        {savedError ? (
          <div
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {savedError}
          </div>
        ) : null}

        {savedLoading && saved.length === 0 ? (
          <div
            className="grid grid-cols-1 gap-2 @min-[420px]/saved:grid-cols-2"
            aria-label="Loading saved places"
          >
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="space-y-2 rounded-lg border border-border/50 p-2.5">
                <div className="h-3.5 w-3/4 animate-pulse rounded bg-muted/70" />
                <div className="flex items-center justify-between">
                  <div className="h-4 w-16 animate-pulse rounded-md bg-muted/70" />
                  <div className="h-5 w-10 animate-pulse rounded bg-muted/50" />
                </div>
              </div>
            ))}
          </div>
        ) : saved.length === 0 ? (
          <>
            <div className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground/85">
                {authed ? "No saved places yet" : "Sign in to save places"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {authed
                  ? "Click Save on any search result to build your shortlist."
                  : "Your saved places will appear here once signed in."}
              </p>
            </div>
            <div
              aria-hidden="true"
              className="mt-4 h-px w-full bg-border/60 @min-[900px]/workspace:hidden"
            />
          </>
        ) : (
          <>
            <div className="relative @min-[900px]/workspace:min-h-64 @min-[900px]/workspace:flex-1">
              <div
                ref={savedScrollRef}
                className={
                  savedAtMax
                    ? "overflow-y-auto pr-1 @min-[900px]/workspace:absolute @min-[900px]/workspace:inset-0"
                    : savedHeight === null
                    ? "max-h-64 overflow-y-auto pr-1 @min-[900px]/workspace:absolute @min-[900px]/workspace:inset-0 @min-[900px]/workspace:max-h-none"
                    : "overflow-y-auto pr-1 @min-[900px]/workspace:absolute @min-[900px]/workspace:inset-0"
                }
                style={!savedAtMax && savedHeight !== null ? { maxHeight: `${savedHeight}px` } : undefined}
              >
                <ul
                  ref={savedListRef}
                  className="grid grid-cols-1 gap-2 @min-[420px]/saved:grid-cols-2"
                >
                  {saved.map((s) => {
                    const mapsUrl = buildGoogleMapsPlaceUrl({
                      name: s.name,
                      address: s.address,
                      lat: s.lat,
                      lon: s.lon,
                    });
                    return (
                      <li
                        key={s.placeId}
                        className={`group rounded-lg border p-2.5 transition-colors ${
                          activeSelectedSavedIds.has(s.placeId)
                            ? "border-primary/50 bg-primary/5"
                            : "border-border/50 bg-transparent hover:border-border hover:bg-accent/25"
                        }`}
                      >
                        <div className="flex flex-col gap-2">
                          <div className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer rounded accent-primary"
                              checked={activeSelectedSavedIds.has(s.placeId)}
                              onChange={() => onToggleSelect(s.placeId)}
                              disabled={!authed}
                              aria-label={`Select ${s.name}`}
                            />
                            {mapsUrl ? (
                              <a
                                href={mapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`Open ${s.name} in Google Maps`}
                                aria-label={`${s.name} — open in Google Maps (opens in a new tab)`}
                                className="group/link inline-flex min-w-0 flex-1 items-start gap-1 text-[13px] font-medium leading-snug text-foreground underline-offset-2 transition-colors hover:text-primary hover:underline focus-visible:rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <span className="line-clamp-2">{s.name}</span>
                                <ArrowUpRight
                                  size={12}
                                  strokeWidth={1.5}
                                  aria-hidden="true"
                                  className="mt-0.5 shrink-0 text-muted-foreground/60 transition-colors group-hover/link:text-primary"
                                />
                              </a>
                            ) : (
                              <span className="line-clamp-2 min-w-0 flex-1 text-[13px] font-medium leading-snug text-foreground">
                                {s.name}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-1.5">
                            {s.category ? <CategoryBadge category={s.category} /> : <span />}
                            <button
                              type="button"
                              disabled={!authed || savingKey === `remove:${s.placeId}`}
                              onClick={() => void onRemoveOne(s.placeId)}
                              aria-label={`Remove ${s.name}`}
                              className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
                            >
                              <X size={12} strokeWidth={1.5} />
                              Remove
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            <div
              onMouseDown={handleSavedDividerMouseDown}
              role="separator"
              aria-orientation="horizontal"
              aria-label="Resize saved section"
              className="group relative -mb-1 flex h-3 cursor-row-resize items-center @min-[900px]/workspace:hidden"
            >
              <div className="h-px w-full bg-border/70 transition-all group-hover:h-0.5 group-hover:bg-primary/60" />
            </div>
          </>
        )}
      </div>
    </section>
  );
}
