"use client";

import { type RefObject, useRef, useState } from "react";
import { ArrowUpRight, CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { buildGoogleMapsDayRouteUrl, buildGoogleMapsPlaceUrl } from "@/lib/maps-links";
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
    <section
      id="itinerary"
      className="flex min-w-0 scroll-mt-6 flex-col gap-3.5 @min-[900px]/workspace:col-span-7 @min-[900px]/workspace:border-l @min-[900px]/workspace:border-border/60 @min-[900px]/workspace:pl-6"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[13px] font-medium tracking-tight text-foreground">
          <CalendarDays size={15} strokeWidth={1.5} className="text-muted-foreground" />
          Itinerary
        </h2>
        {itinLoading ? <span className="text-xs text-muted-foreground">Syncing…</span> : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col space-y-4">
        {!authed ? (
          <div className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center">
            <p className="text-sm font-medium text-foreground/85">
              Sign in to create and generate itineraries
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Save attractions and organize them into geographically clustered day-by-day plans.
            </p>
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col space-y-3.5">
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
              <div className="flex flex-col gap-2 @min-[520px]/workspace:flex-row @min-[520px]/workspace:items-center">
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
                <div className="flex shrink-0 items-center gap-2">
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
                    className="w-18"
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

            {/* Flat Pick + Generate toolbar */}
            {itineraries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No itineraries yet. Create your first trip above.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2 border-b border-border/50 pb-3">
                <select
                  aria-label="Active itinerary"
                  className="h-8 min-w-44 flex-1 rounded-md border border-input bg-background px-2.5 text-[13px] text-foreground outline-none transition-[color,border-color] focus-visible:border-ring/80"
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

                <label className="flex cursor-pointer items-center gap-1.5 px-1 text-xs text-muted-foreground hover:text-foreground">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 cursor-pointer rounded accent-primary"
                    checked={genShuffle}
                    onChange={(e) => onToggleShuffle(e.target.checked)}
                  />
                  Shuffle
                </label>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 border-border/70 text-xs"
                    disabled={!itineraryId || generating}
                    onClick={() => void onGenerateAll()}
                  >
                    {generating ? "Generating…" : "Generate (all saved)"}
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={!itineraryId || generating || selectedSavedCount === 0}
                    onClick={() => void onGenerateSelected()}
                  >
                    Generate (selected)
                  </Button>
                </div>
              </div>
            )}

            {/* Day timeline */}
            {itemsLoading ? (
              <div className="space-y-4" aria-label="Loading itinerary items">
                {Array.from({ length: 2 }, (_, i) => (
                  <div key={i} className="space-y-2.5 border-b border-border/50 pb-4 last:border-b-0">
                    <div className="h-3.5 w-20 animate-pulse rounded bg-muted/70" />
                    <div className="space-y-2 pl-2">
                      <div className="h-3.5 w-3/5 animate-pulse rounded bg-muted/70" />
                      <div className="h-3.5 w-2/5 animate-pulse rounded bg-muted/50" />
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
              <div className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center">
                <p className="text-sm font-medium text-foreground/85">No stops scheduled yet</p>
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
                    className="flex items-center gap-1 overflow-x-auto pb-0.5"
                  >
                    <button
                      type="button"
                      aria-pressed={activeDay === "all"}
                      onClick={() => handleSelectDay("all")}
                      className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        activeDay === "all"
                          ? "bg-sidebar-accent/90 text-foreground ring-1 ring-inset ring-border/70"
                          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      }`}
                    >
                      All days
                      <span
                        className={`ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums ${
                          activeDay === "all"
                            ? "bg-foreground/10 text-foreground"
                            : "bg-muted/80 text-muted-foreground"
                        }`}
                      >
                        {itineraryItems.length}
                      </span>
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
                          className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                            selected
                              ? "bg-sidebar-accent/90 text-foreground ring-1 ring-inset ring-border/70"
                              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                          }`}
                        >
                          <span>Day {day + 1}</span>
                          {count > 0 ? (
                            <span
                              className={`ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums ${
                                selected
                                  ? "bg-foreground/10 text-foreground"
                                  : "bg-muted/80 text-muted-foreground"
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
                  className="max-h-[420px] space-y-4 overflow-y-auto pt-0.5 pr-1"
                >
                  {visibleDays.map((day) => {
                    const dayItems = itemsByDay.get(day) ?? [];
                    const dayRoute = buildGoogleMapsDayRouteUrl(
                      dayItems.map((it) => ({
                        name: it.place.name,
                        address: it.place.address,
                        lat: it.place.lat,
                        lon: it.place.lon,
                      }))
                    );
                    const routeLabel = dayRoute?.truncated
                      ? `Open Day ${day + 1} route in Google Maps (capped at ${dayRoute.includedStops} of ${dayRoute.totalStops} stops)`
                      : `Open Day ${day + 1} route in Google Maps`;
                    return (
                      <div key={day} className="space-y-2.5">
                        <div className="flex items-center gap-2 border-b border-border/50 pb-1.5 text-xs font-medium text-foreground">
                          <CalendarDays size={13} strokeWidth={1.5} className="text-muted-foreground" />
                          <span>Day {day + 1}</span>
                          <div className="ml-auto flex items-center gap-2.5">
                            {dayRoute ? (
                              <a
                                href={dayRoute.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`${routeLabel} (opens in a new tab)`}
                                title={routeLabel}
                                className="inline-flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-primary hover:underline focus-visible:rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                Route
                                <ArrowUpRight size={11} strokeWidth={1.5} aria-hidden="true" />
                              </a>
                            ) : null}
                            <span className="font-normal tabular-nums text-muted-foreground">
                              {dayItems.length} {dayItems.length === 1 ? "stop" : "stops"}
                            </span>
                          </div>
                        </div>
                        <div className="pl-0.5">
                          {dayItems.length === 0 ? (
                            <p className="py-1 text-xs text-muted-foreground">
                              No stops planned for this day.
                            </p>
                          ) : (
                            <ul>
                              {dayItems.map((it, idx) => {
                                const address = it.place.address?.trim();
                                const isLast = idx === dayItems.length - 1;
                                const mapsUrl = buildGoogleMapsPlaceUrl({
                                  name: it.place.name,
                                  address,
                                  lat: it.place.lat,
                                  lon: it.place.lon,
                                });
                                return (
                                  <li
                                    key={it.id}
                                    className="relative flex items-start justify-between gap-3 pb-3.5 last:pb-0"
                                  >
                                    {!isLast ? (
                                      <span
                                        aria-hidden="true"
                                        className="absolute top-[26px] bottom-0 left-3 w-px -translate-x-1/2 bg-border/70"
                                      />
                                    ) : null}
                                    <div className="flex min-w-0 items-start gap-3">
                                      <span className="relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-medium tabular-nums text-foreground ring-1 ring-inset ring-primary/30">
                                        {idx + 1}
                                      </span>
                                      <div className="min-w-0">
                                        {mapsUrl ? (
                                          <a
                                            href={mapsUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title={`Open ${it.place.name} in Google Maps`}
                                            aria-label={`${it.place.name} — open in Google Maps (opens in a new tab)`}
                                            className="group/link inline-flex max-w-full items-start gap-1 text-sm font-medium leading-snug text-foreground underline-offset-2 transition-colors hover:text-primary hover:underline focus-visible:rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                          >
                                            <span>{it.place.name}</span>
                                            <ArrowUpRight
                                              size={12}
                                              strokeWidth={1.5}
                                              aria-hidden="true"
                                              className="mt-1 shrink-0 text-muted-foreground/60 transition-colors group-hover/link:text-primary"
                                            />
                                          </a>
                                        ) : (
                                          <p className="text-sm font-medium leading-snug text-foreground">
                                            {it.place.name}
                                          </p>
                                        )}
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
      </div>
    </section>
  );
}
