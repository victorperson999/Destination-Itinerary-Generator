"use client";

import { useEffect, useRef, useState } from "react";
import { Bookmark } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "./category-badge";
import type { SavedItem } from "./types";

const SAVED_MIN_HEIGHT = 256;

type SavedSectionProps = {
  authed: boolean;
  saved: SavedItem[];
  savedLoading: boolean;
  savedError: string | null;
  activeSelectedSavedIds: Set<string>;
  selectedSavedCount: number;
  savingKey: string | null;
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

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    function handleChange(e: MediaQueryListEvent) {
      if (e.matches) {
        dragCleanupRef.current?.();
        setSavedHeight(null);
        setSavedAtMax(false);
      }
    }
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

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
    <Card id="saved" className="flex min-w-0 scroll-mt-6 flex-col gap-4 py-5 xl:col-span-5">
      <CardHeader className="gap-3 px-5">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bookmark size={16} className="text-primary" />
            Saved
            <span className="text-xs font-normal text-muted-foreground">
              ({selectedSavedCount}/{saved.length} selected)
            </span>
          </CardTitle>
        </div>

        {authed ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saved.length === 0}
              onClick={onSelectAll}
            >
              Select all
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
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
                  onClick={() => void confirmRemoveAll()}
                >
                  Confirm?
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={cancelRemoveAllConfirm}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="ml-auto"
                disabled={saved.length === 0 || savingKey === "remove-all"}
                onClick={startRemoveAllConfirm}
              >
                {savingKey === "remove-all" ? "Removing…" : "Remove all"}
              </Button>
            )}
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col space-y-2 px-5">
        {savedError ? (
          <div
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {savedError}
          </div>
        ) : null}

        {savedLoading && saved.length === 0 ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2" aria-label="Loading saved places">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="space-y-2 rounded-lg border p-2.5">
                <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                <div className="flex items-center justify-between">
                  <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
                  <div className="h-6 w-14 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : saved.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-8 text-center">
            <p className="text-sm font-medium text-foreground/80">
              {authed ? "No saved places yet" : "Sign in to save places"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {authed
                ? "Click Save on any search result to build your shortlist."
                : "Your saved places will appear here once signed in."}
            </p>
          </div>
        ) : (
          <>
            <div className="relative xl:min-h-40 xl:flex-1">
              <div
                ref={savedScrollRef}
                className={
                  savedAtMax
                    ? "overflow-y-auto xl:absolute xl:inset-0"
                    : savedHeight === null
                    ? "max-h-64 overflow-y-auto xl:absolute xl:inset-0 xl:max-h-none"
                    : "overflow-y-auto xl:absolute xl:inset-0"
                }
                style={!savedAtMax && savedHeight !== null ? { maxHeight: `${savedHeight}px` } : undefined}
              >
                <ul
                  ref={savedListRef}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2"
                >
                  {saved.map((s) => (
                    <li
                      key={s.placeId}
                      className={`rounded-lg border p-2.5 transition-colors hover:border-primary/40 hover:bg-accent/30 ${
                        activeSelectedSavedIds.has(s.placeId) ? "border-primary/60 bg-primary/5" : ""
                      }`}
                    >
                      <div className="flex flex-col gap-2">
                        <label className="flex cursor-pointer items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded accent-primary"
                            checked={activeSelectedSavedIds.has(s.placeId)}
                            onChange={() => onToggleSelect(s.placeId)}
                            disabled={!authed}
                            aria-label={`Select ${s.name}`}
                          />
                          <span className="line-clamp-2 text-sm font-medium leading-tight">
                            {s.name}
                          </span>
                        </label>
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
                            onClick={() => void onRemoveOne(s.placeId)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div
              onMouseDown={handleSavedDividerMouseDown}
              role="separator"
              aria-orientation="horizontal"
              aria-label="Resize saved section"
              className="group relative -mb-1 flex h-3 cursor-row-resize items-center xl:hidden"
            >
              <div className="h-px w-full bg-border transition-all group-hover:h-0.5 group-hover:bg-primary/60" />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
