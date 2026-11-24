"use client";

import { useSyncExternalStore } from "react";

export type ThemePreference = "light" | "dark" | "system";
export type ThemePalette = "coastal" | "terracotta" | "twilight";

export const THEME_PALETTES: ReadonlyArray<{
  value: ThemePalette;
  label: string;
  lightSwatch: string;
  accentSwatch: string;
}> = [
  {
    value: "coastal",
    label: "Coastal",
    lightSwatch: "oklch(0.24 0.025 225)",
    accentSwatch: "oklch(0.66 0.125 195)",
  },
  {
    value: "terracotta",
    label: "Terracotta",
    lightSwatch: "oklch(0.25 0.022 48)",
    accentSwatch: "oklch(0.66 0.15 40)",
  },
  {
    value: "twilight",
    label: "Twilight",
    lightSwatch: "oklch(0.23 0.03 275)",
    accentSwatch: "oklch(0.65 0.16 272)",
  },
];

const THEME_STORAGE_KEY = "theme";
const PALETTE_STORAGE_KEY = "theme-palette";
const THEME_CHANGE_EVENT = "local-explorer:theme-change";
const PALETTE_CHANGE_EVENT = "local-explorer:palette-change";

let memoryPreference: ThemePreference | null = null;
let preferenceStorageFailed = false;

let memoryPalette: ThemePalette | null = null;
let paletteStorageFailed = false;

function isValidPalette(raw: string | null): raw is ThemePalette {
  return raw === "coastal" || raw === "terracotta" || raw === "twilight";
}

function readStoredPreference(): ThemePreference {
  if (preferenceStorageFailed) {
    return memoryPreference ?? "system";
  }
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "dark" || raw === "light") return raw;
    return "system";
  } catch {
    return memoryPreference ?? "system";
  }
}

function readStoredPalette(): ThemePalette {
  if (paletteStorageFailed) {
    return memoryPalette ?? "coastal";
  }
  try {
    const raw = localStorage.getItem(PALETTE_STORAGE_KEY);
    return isValidPalette(raw) ? raw : "coastal";
  } catch {
    return memoryPalette ?? "coastal";
  }
}

function getSystemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyThemePreference(pref: ThemePreference): void {
  if (typeof document === "undefined") return;
  const isDark = pref === "dark" || (pref === "system" && getSystemPrefersDark());
  document.documentElement.classList.toggle("dark", isDark);
}

export function applyThemePalette(palette: ThemePalette): void {
  if (typeof document === "undefined") return;
  if (palette === "coastal") {
    delete document.documentElement.dataset.palette;
  } else {
    document.documentElement.dataset.palette = palette;
  }
}

export function setThemePreference(pref: ThemePreference): void {
  memoryPreference = pref;
  try {
    if (pref === "system") {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      localStorage.setItem(THEME_STORAGE_KEY, pref);
    }
    preferenceStorageFailed = false;
  } catch {
    preferenceStorageFailed = true;
  }
  applyThemePreference(pref);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }
}

export function setThemePalette(palette: ThemePalette): void {
  memoryPalette = palette;
  try {
    if (palette === "coastal") {
      localStorage.removeItem(PALETTE_STORAGE_KEY);
    } else {
      localStorage.setItem(PALETTE_STORAGE_KEY, palette);
    }
    paletteStorageFailed = false;
  } catch {
    paletteStorageFailed = true;
  }
  applyThemePalette(palette);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PALETTE_CHANGE_EVENT));
  }
}

function subscribeTheme(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onMediaChange = () => {
    if (readStoredPreference() === "system") {
      applyThemePreference("system");
    }
    callback();
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === THEME_STORAGE_KEY) {
      preferenceStorageFailed = false;
      memoryPreference = null;
      applyThemePreference(readStoredPreference());
      callback();
    }
  };
  const onCustom = () => callback();

  mq.addEventListener("change", onMediaChange);
  window.addEventListener("storage", onStorage);
  window.addEventListener(THEME_CHANGE_EVENT, onCustom);

  return () => {
    mq.removeEventListener("change", onMediaChange);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(THEME_CHANGE_EVENT, onCustom);
  };
}

function subscribePalette(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === PALETTE_STORAGE_KEY) {
      paletteStorageFailed = false;
      memoryPalette = null;
      applyThemePalette(readStoredPalette());
      callback();
    }
  };
  const onCustom = () => callback();

  window.addEventListener("storage", onStorage);
  window.addEventListener(PALETTE_CHANGE_EVENT, onCustom);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(PALETTE_CHANGE_EVENT, onCustom);
  };
}

function getPreferenceSnapshot(): ThemePreference {
  return readStoredPreference();
}

function getPreferenceServerSnapshot(): ThemePreference {
  return "system";
}

function getPaletteSnapshot(): ThemePalette {
  return readStoredPalette();
}

function getPaletteServerSnapshot(): ThemePalette {
  return "coastal";
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(
    subscribeTheme,
    getPreferenceSnapshot,
    getPreferenceServerSnapshot
  );
}

export function useThemePalette(): ThemePalette {
  return useSyncExternalStore(
    subscribePalette,
    getPaletteSnapshot,
    getPaletteServerSnapshot
  );
}
