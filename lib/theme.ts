"use client";

import { useSyncExternalStore } from "react";

export type ThemePreference = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "theme";
const THEME_CHANGE_EVENT = "local-explorer:theme-change";

let memoryPreference: ThemePreference | null = null;
let storageFailed = false;

function readStoredPreference(): ThemePreference {
  if (storageFailed) {
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

function getSystemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyThemePreference(pref: ThemePreference): void {
  if (typeof document === "undefined") return;
  const isDark = pref === "dark" || (pref === "system" && getSystemPrefersDark());
  document.documentElement.classList.toggle("dark", isDark);
}

export function setThemePreference(pref: ThemePreference): void {
  memoryPreference = pref;
  try {
    if (pref === "system") {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      localStorage.setItem(THEME_STORAGE_KEY, pref);
    }
    storageFailed = false;
  } catch {
    storageFailed = true;
  }
  applyThemePreference(pref);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
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
      storageFailed = false;
      memoryPreference = null;
      applyThemePreference(readStoredPreference());
      callback();
    }
  };
  const onCustom = () => callback();

  mq.addEventListener("change", onMediaChange);
  window.addEventListener("storage", onStorage);
  window.addEventListener(THEME_CHANGE_EVENT, onCustom);

  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });

  return () => {
    mq.removeEventListener("change", onMediaChange);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(THEME_CHANGE_EVENT, onCustom);
    observer.disconnect();
  };
}

function getPreferenceSnapshot(): ThemePreference {
  return readStoredPreference();
}

function getPreferenceServerSnapshot(): ThemePreference {
  return "system";
}

function getIsDarkSnapshot(): boolean {
  return document.documentElement.classList.contains("dark");
}

function getIsDarkServerSnapshot(): boolean {
  return false;
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(
    subscribeTheme,
    getPreferenceSnapshot,
    getPreferenceServerSnapshot
  );
}

export function useIsDarkTheme(): boolean {
  return useSyncExternalStore(
    subscribeTheme,
    getIsDarkSnapshot,
    getIsDarkServerSnapshot
  );
}
