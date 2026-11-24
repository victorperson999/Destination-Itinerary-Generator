"use client";

import { useEffect, useId, useRef } from "react";
import { signOut } from "next-auth/react";
import { HelpCircle, LogOut, Monitor, Moon, Settings, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  setThemePreference,
  type ThemePreference,
  useThemePreference,
} from "@/lib/theme";
import { UserAvatar } from "./account-dock";
import type { SettingsDialogTab, SidebarUser, UserPreferences } from "./types";

type SettingsDialogProps = {
  openTab: SettingsDialogTab | null;
  user: SidebarUser | null;
  preferences: UserPreferences;
  onTabChange: (tab: SettingsDialogTab) => void;
  onUpdatePreferences: (patch: Partial<UserPreferences>) => void;
  onClose: () => void;
};

const THEME_OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  icon: typeof Sun;
}> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function SettingsDialog({
  openTab,
  user,
  preferences,
  onTabChange,
  onUpdatePreferences,
  onClose,
}: SettingsDialogProps) {
  const themePreference = useThemePreference();
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const isOpen = openTab !== null;

  useEffect(() => {
    if (!isOpen) return;
    const rafId = requestAnimationFrame(() => {
      closeBtnRef.current?.focus();
    });
    return () => cancelAnimationFrame(rafId);
  }, [isOpen]);

  // Capture-phase Escape gives SettingsDialog top priority over menus/drawers/confirmations.
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      onClose();
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const displayName = user?.name?.trim() || user?.email?.trim() || "Account";
  const email = user?.email?.trim() || null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold tracking-tight">
            {openTab === "preferences" ? "Settings" : "Help & Shortcuts"}
          </h2>
          <Button
            ref={closeBtnRef}
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={16} />
          </Button>
        </div>

        {/* Section switcher */}
        <div className="border-b border-border px-5 py-2.5">
          <div
            role="group"
            aria-label="Settings sections"
            className="grid grid-cols-2 gap-1 rounded-lg bg-muted/60 p-1"
          >
            <button
              type="button"
              aria-pressed={openTab === "preferences"}
              onClick={() => onTabChange("preferences")}
              className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                openTab === "preferences"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Settings size={13} />
              Preferences
            </button>
            <button
              type="button"
              aria-pressed={openTab === "help"}
              onClick={() => onTabChange("help")}
              className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                openTab === "help"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <HelpCircle size={13} />
              Help &amp; shortcuts
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] space-y-5 overflow-y-auto px-5 py-4">
          {openTab === "preferences" ? (
            <>
              {/* Appearance */}
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-medium">Appearance</p>
                  <p className="text-xs text-muted-foreground">
                    Choose light, dark, or follow your system preference.
                  </p>
                </div>
                <div
                  role="group"
                  aria-label="Appearance theme"
                  className="grid grid-cols-3 gap-2"
                >
                  {THEME_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const active = themePreference === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setThemePreference(opt.value)}
                        className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        }`}
                      >
                        <Icon size={14} />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Trip Defaults */}
              <div className="space-y-3.5">
                <div>
                  <p className="text-sm font-medium">Itinerary defaults</p>
                  <p className="text-xs text-muted-foreground">
                    Saved locally in this browser for new trips and schedule generation.
                  </p>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Default trip length</p>
                    <p className="text-xs text-muted-foreground">1–14 days for new itineraries</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      disabled={preferences.defaultDays <= 1}
                      onClick={() =>
                        onUpdatePreferences({ defaultDays: preferences.defaultDays - 1 })
                      }
                      aria-label="Decrease default trip length"
                    >
                      −
                    </Button>
                    <span className="w-12 text-center text-sm font-medium tabular-nums">
                      {preferences.defaultDays}d
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      disabled={preferences.defaultDays >= 14}
                      onClick={() =>
                        onUpdatePreferences({ defaultDays: preferences.defaultDays + 1 })
                      }
                      aria-label="Increase default trip length"
                    >
                      +
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Stops per day</p>
                    <p className="text-xs text-muted-foreground">
                      1–8 stops for Generate &amp; Assistant
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      disabled={preferences.defaultPerDay <= 1}
                      onClick={() =>
                        onUpdatePreferences({ defaultPerDay: preferences.defaultPerDay - 1 })
                      }
                      aria-label="Decrease default stops per day"
                    >
                      −
                    </Button>
                    <span className="w-12 text-center text-sm font-medium tabular-nums">
                      {preferences.defaultPerDay}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      disabled={preferences.defaultPerDay >= 8}
                      onClick={() =>
                        onUpdatePreferences({ defaultPerDay: preferences.defaultPerDay + 1 })
                      }
                      aria-label="Increase default stops per day"
                    >
                      +
                    </Button>
                  </div>
                </div>
              </div>

              {user ? (
                <>
                  <Separator />
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <UserAvatar user={user} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{displayName}</p>
                        {email && email !== displayName ? (
                          <p className="truncate text-xs text-muted-foreground">{email}</p>
                        ) : null}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void signOut()}
                      className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <LogOut size={14} />
                      Log out
                    </Button>
                  </div>
                </>
              ) : null}
            </>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="space-y-2">
                <p className="font-medium">How Local Explorer works</p>
                <ol className="list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-muted-foreground">
                  <li>Search any city or neighbourhood in Discover Places and filter by category.</li>
                  <li>Save places you like, then check specific items or use your full Saved list.</li>
                  <li>
                    Create or pick a trip from the left sidebar, then click{" "}
                    <span className="font-medium text-foreground">Generate</span> to cluster stops
                    geographically by day.
                  </li>
                  <li>
                    Use the <span className="font-medium text-foreground">Assistant</span> drawer
                    to search destinations, create trips, or shuffle schedules in natural language.
                  </li>
                </ol>
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="font-medium">Keyboard shortcuts</p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
                    <span className="text-muted-foreground">Close modal, menu, or drawer</span>
                    <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                      Esc
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
                    <span className="text-muted-foreground">Run search / create trip / send chat</span>
                    <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                      Enter
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
                    <span className="text-muted-foreground">Navigate account menu items</span>
                    <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                      ↑ / ↓
                    </kbd>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
