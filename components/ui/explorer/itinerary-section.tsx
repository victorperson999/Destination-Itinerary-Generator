"use client";

import { type RefObject, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "./category-badge";
import type { Itinerary, ItineraryItem } from "./types";

type ItinerarySectionProps = {
  authed: boolean;
  itineraries: Itinerary[];
  itineraryId: string | null;
  selectedItinerary: Itinerary | null;
  itineraryItems: ItineraryItem[];
  itemsByDay: Map<number, ItineraryItem[]>;
  itinLoading: boolean;
  itinError: string | null;
  itemsLoading: boolean;
  itemsError: string | null;
  creatingItin: boolean;
  generating: boolean;
  newItinTitle: string;
  newDaysInput: string;
  newItinTitleError: string | null;
  genShuffle: boolean;
  selectedSavedCount: number;
  newTitleInputRef?: RefObject<HTMLInputElement | null>;
  onNewTitleChange: (value: string) => void;
  onNewDaysChange: (value: string) => void;
  onNewDaysBlur: () => void;
  onCreateItinerary: () => Promise<void>;
  onSelectItinerary: (id: string) => void;
  onToggleShuffle: (checked: boolean) => void;
  onGenerateAll: () => Promise<void>;
  onGenerateSelected: () => Promise<void>;
};

export function ItinerarySection({
  authed,
  itineraries,
  itineraryId,
  selectedItinerary,
  itineraryItems,
  itemsByDay,
  itinLoading,
  itinError,
  itemsLoading,
  itemsError,
  creatingItin,
  generating,
  newItinTitle,
  newDaysInput,
  newItinTitleError,
  genShuffle,
  selectedSavedCount,
  newTitleInputRef,
  onNewTitleChange,
  onNewDaysChange,
  onNewDaysBlur,
  onCreateItinerary,
  onSelectItinerary,
  onToggleShuffle,
  onGenerateAll,
  onGenerateSelected,
}: ItinerarySectionProps) {
  const [dayFilter, setDayFilter] = useState<{
    forItineraryId: string | null;
    day: number | "all";
  }>({ forItineraryId: null, day: "all" });
  const dayListScrollRef = useRef<HTMLDivElement | null>(null);

  const daysCount = selectedItinerary?.daysCount ?? 0;
  const activeDay: number | "all" =
    dayFilter.forItineraryId === itineraryId &&
    (dayFilter.day === "all" || (dayFilter.day >= 0 && dayFilter.day < daysCount))
      ? dayFilter.day
      : "all";

  const visibleDays =
    activeDay === "all"
      ? Array.from({ length: daysCount }, (_, i) => i)
      : [activeDay];

  function handleSelectDay(day: number | "all") {
    setDayFilter({ forItineraryId: itineraryId, day });
    if (dayListScrollRef.current) {
      dayListScrollRef.current.scrollTop = 0;
    }
  }

  return (
    <Card id="itinerary" className="flex min-w-0 scroll-mt-6 flex-col gap-4 py-5 xl:col-span-7">
      <CardHeader className="px-5">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays size={16} className="text-primary" />
            Itinerary
          </CardTitle>
          {itinLoading ? <span className="text-xs text-muted-foreground">Syncing…</span> : null}
        </div>
      </CardHeader>

      <CardContent className="flex min-w-0 flex-1 flex-col space-y-4 px-5">
        {!authed ? (
          <div className="rounded-lg border border-dashed px-4 py-8 text-center">
            <p className="text-sm font-medium text-foreground/80">
              Sign in to create and generate itineraries
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Save attractions and organize them into geographically clustered day-by-day plans.
            </p>
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col space-y-4">
            {itinError ? (
              <div
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {itinError}
              </div>
            ) : null}

            {/* Create itinerary bar */}
            <div className="space-y-1.5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  ref={newTitleInputRef}
                  value={newItinTitle}
                  onChange={(e) => onNewTitleChange(e.target.value)}
                  placeholder="e.g. Tokyo Trip"
                  aria-invalid={Boolean(newItinTitleError)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newItinTitle.trim() && !creatingItin) {
                      void onCreateItinerary();
                    }
                  }}
                />
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="new-itinerary-days"
                    className="whitespace-nowrap text-xs font-medium text-muted-foreground"
                  >
                    Days
                  </label>
                  <Input
                    id="new-itinerary-days"
                    type="number"
                    min={1}
                    max={14}
                    value={newDaysInput}
                    onChange={(e) => onNewDaysChange(e.target.value)}
                    onBlur={onNewDaysBlur}
                    className="w-20"
                    aria-label="Number of days"
                  />
                  <Button
                    type="button"
                    disabled={creatingItin || !newItinTitle.trim()}
                    onClick={() => void onCreateItinerary()}
                  >
                    {creatingItin ? "Creating…" : "New itinerary"}
                  </Button>
                </div>
              </div>
              {newItinTitleError ? (
                <p role="alert" className="text-xs text-destructive">
                  {newItinTitleError}
                </p>
              ) : null}
            </div>

            {/* Pick + Generate toolbar */}
            {itineraries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No itineraries yet. Create your first trip above.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2.5">
                <select
                  aria-label="Active itinerary"
                  className="h-9 min-w-44 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  value={itineraryId ?? ""}
                  onChange={(e) => {
                    onSelectItinerary(e.target.value);
                    if (dayListScrollRef.current) {
                      dayListScrollRef.current.scrollTop = 0;
                    }
                  }}
                >
                  {itineraries.map((it) => (
                    <option
                      key={it.id}
                      value={it.id}
                      className="bg-background text-foreground"
                    >
                      {it.title} ({it.daysCount} {it.daysCount === 1 ? "day" : "days"})
                    </option>
                  ))}
                </select>

                <label className="flex cursor-pointer items-center gap-1.5 px-1 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer rounded accent-primary"
                    checked={genShuffle}
                    onChange={(e) => onToggleShuffle(e.target.checked)}
                  />
                  Shuffle
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!itineraryId || generating}
                    onClick={() => void onGenerateAll()}
                  >
                    {generating ? "Generating…" : "Generate (all saved)"}
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    disabled={!itineraryId || generating || selectedSavedCount === 0}
                    onClick={() => void onGenerateSelected()}
                  >
                    Generate (selected)
                  </Button>
                </div>
              </div>
            )}

            {/* Day cards */}
            {itemsLoading ? (
              <div className="space-y-3" aria-label="Loading itinerary items">
                {Array.from({ length: 2 }, (_, i) => (
                  <div key={i} className="overflow-hidden rounded-lg border">
                    <div className="border-b bg-accent/30 px-3 py-2">
                      <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                    </div>
                    <div className="space-y-3 p-3">
                      <div className="h-4 w-3/5 animate-pulse rounded bg-muted" />
                      <div className="h-4 w-2/5 animate-pulse rounded bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            ) : itemsError ? (
              <div
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {itemsError}
              </div>
            ) : !selectedItinerary ? (
              itineraries.length > 0 ? (
                <p className="text-sm text-muted-foreground">Select an itinerary to view stops.</p>
              ) : null
            ) : itineraryItems.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-8 text-center">
                <p className="text-sm font-medium text-foreground/80">No stops scheduled yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Click <span className="font-medium text-foreground">Generate (all saved)</span> or{" "}
                  <span className="font-medium text-foreground">Generate (selected)</span> to build your schedule.
                </p>
              </div>
            ) : (
              <div className="flex min-w-0 flex-1 flex-col space-y-3">
                {daysCount > 1 ? (
                  <div
                    role="group"
                    aria-label="Filter itinerary by day"
                    className="flex items-center gap-1.5 overflow-x-auto pb-0.5"
                  >
                    <button
                      type="button"
                      aria-pressed={activeDay === "all"}
                      onClick={() => handleSelectDay("all")}
                      className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        activeDay === "all"
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      All days ({itineraryItems.length})
                    </button>
                    {Array.from({ length: daysCount }, (_, day) => {
                      const count = (itemsByDay.get(day) ?? []).length;
                      const selected = activeDay === day;
                      return (
                        <button
                          key={day}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => handleSelectDay(day)}
                          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                          }`}
                        >
                          <span>Day {day + 1}</span>
                          {count > 0 ? (
                            <span
                              className={`ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
                                selected
                                  ? "bg-primary-foreground/20 text-primary-foreground"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {count}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                <div
                  ref={dayListScrollRef}
                  className="max-h-[420px] space-y-3 overflow-y-auto pr-1"
                >
                  {visibleDays.map((day) => {
                    const dayItems = itemsByDay.get(day) ?? [];
                    return (
                      <div key={day} className="overflow-hidden rounded-lg border">
                        <div className="flex items-center gap-2 border-b bg-accent/40 px-3.5 py-2 text-sm font-semibold">
                          <CalendarDays size={14} className="text-primary" />
                          <span>Day {day + 1}</span>
                          <span className="ml-auto text-xs font-normal text-muted-foreground">
                            {dayItems.length} {dayItems.length === 1 ? "stop" : "stops"}
                          </span>
                        </div>
                        <div className="p-3.5">
                          {dayItems.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No stops planned for this day.</p>
                          ) : (
                            <ul>
                              {dayItems.map((it, idx) => {
                                const address = it.place.address?.trim();
                                const isLast = idx === dayItems.length - 1;
                                return (
                                  <li
                                    key={it.id}
                                    className="relative flex items-start justify-between gap-3 pb-3.5 last:pb-0"
                                  >
                                    {!isLast ? (
                                      <span
                                        aria-hidden="true"
                                        className="absolute top-6 bottom-0 left-3 w-px -translate-x-1/2 bg-border"
                                      />
                                    ) : null}
                                    <div className="flex min-w-0 items-start gap-3">
                                      <span className="relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground shadow-xs">
                                        {idx + 1}
                                      </span>
                                      <div className="min-w-0">
                                        <p className="font-medium leading-snug">{it.place.name}</p>
                                        {address ? (
                                          <p className="text-xs text-muted-foreground">{address}</p>
                                        ) : null}
                                        {it.note ? (
                                          <p className="mt-0.5 text-xs italic text-muted-foreground">
                                            {it.note}
                                          </p>
                                        ) : null}
                                      </div>
                                    </div>
                                    <CategoryBadge category={it.place.category} className="shrink-0" />
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
