"use client";

import { useSyncExternalStore } from "react";
import type { UserPreferences } from "@/components/ui/explorer/types";
import { isTripSortOption } from "@/lib/itinerary-sort";

const PREFS_STORAGE_KEY = "local-explorer:preferences";
const PREFS_CHANGE_EVENT = "local-explorer:preferences-change";

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  defaultDays: 3,
  defaultPerDay: 3,
  tripSort: "newest",
};

let cachedRaw: string | null | undefined;
let cachedValue: UserPreferences = DEFAULT_USER_PREFERENCES;
let storageFailed = false;

function clampInt(val: unknown, min: number, max: number, fallback: number): number {
  if (val === null || val === undefined || val === "" || typeof val === "boolean") {
    return fallback;
  }
  const n = typeof val === "number" ? val : Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function parsePreferences(raw: string | null): UserPreferences {
  if (!raw) return DEFAULT_USER_PREFERENCES;
  try {
    const parsed = JSON.parse(raw) as Partial<UserPreferences> | null;
    if (!parsed || typeof parsed !== "object") return DEFAULT_USER_PREFERENCES;
    return {
      defaultDays: clampInt(parsed.defaultDays, 1, 14, DEFAULT_USER_PREFERENCES.defaultDays),
      defaultPerDay: clampInt(parsed.defaultPerDay, 1, 8, DEFAULT_USER_PREFERENCES.defaultPerDay),
      tripSort: isTripSortOption(parsed.tripSort)
        ? parsed.tripSort
        : DEFAULT_USER_PREFERENCES.tripSort,
    };
  } catch {
    return DEFAULT_USER_PREFERENCES;
  }
}

function getPreferencesSnapshot(): UserPreferences {
  if (storageFailed) return cachedValue;
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (raw === cachedRaw) return cachedValue;
    cachedRaw = raw;
    cachedValue = parsePreferences(raw);
    return cachedValue;
  } catch {
    return cachedValue;
  }
}

function getPreferencesServerSnapshot(): UserPreferences {
  return DEFAULT_USER_PREFERENCES;
}

function subscribePreferences(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === PREFS_STORAGE_KEY) {
      storageFailed = false;
      cachedRaw = undefined;
      callback();
    }
  };
  const onCustom = () => callback();
  window.addEventListener("storage", onStorage);
  window.addEventListener(PREFS_CHANGE_EVENT, onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(PREFS_CHANGE_EVENT, onCustom);
  };
}

export function updateUserPreferences(patch: Partial<UserPreferences>): UserPreferences {
  const current = getPreferencesSnapshot();
  const next: UserPreferences = {
    defaultDays:
      patch.defaultDays !== undefined
        ? clampInt(patch.defaultDays, 1, 14, current.defaultDays)
        : current.defaultDays,
    defaultPerDay:
      patch.defaultPerDay !== undefined
        ? clampInt(patch.defaultPerDay, 1, 8, current.defaultPerDay)
        : current.defaultPerDay,
    tripSort:
      patch.tripSort !== undefined && isTripSortOption(patch.tripSort)
        ? patch.tripSort
        : current.tripSort,
  };
  const serialized = JSON.stringify(next);
  cachedRaw = serialized;
  cachedValue = next;
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, serialized);
    storageFailed = false;
  } catch {
    storageFailed = true;
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PREFS_CHANGE_EVENT));
  }
  return next;
}

export function useUserPreferences(): UserPreferences {
  return useSyncExternalStore(
    subscribePreferences,
    getPreferencesSnapshot,
    getPreferencesServerSnapshot
  );
}
