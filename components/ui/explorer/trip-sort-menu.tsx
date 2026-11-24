"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUpDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTripSortLabel, TRIP_SORT_OPTIONS } from "@/lib/itinerary-sort";
import type { TripSortOption } from "./types";

type OpenMode = "closed" | "hover" | "click";

type MenuPos = {
  left: number;
  top: number;
  width: number;
};

type TripSortMenuProps = {
  value: TripSortOption;
  isMobile: boolean;
  mobileOpen: boolean;
  settingsOpen: boolean;
  hasPendingDelete: boolean;
  onBeforeExplicitOpen: () => void;
  onChange: (next: TripSortOption) => void;
};

const MENU_WIDTH = 176;
const MENU_ESTIMATED_HEIGHT = 164;
const HOVER_CLOSE_DELAY_MS = 160;

function computeDesktopMenuPos(trigger: HTMLButtonElement | null): MenuPos | null {
  if (!trigger) return null;
  const rect = trigger.getBoundingClientRect();
  const left = Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
  const fitsBelow = rect.bottom + 6 + MENU_ESTIMATED_HEIGHT <= window.innerHeight - 8;
  const top = fitsBelow
    ? rect.bottom + 6
    : Math.max(8, rect.top - MENU_ESTIMATED_HEIGHT - 6);
  return { left, top, width: MENU_WIDTH };
}

export function TripSortMenu({
  value,
  isMobile,
  mobileOpen,
  settingsOpen,
  hasPendingDelete,
  onBeforeExplicitOpen,
  onChange,
}: TripSortMenuProps) {
  const [openMode, setOpenMode] = useState<OpenMode>("closed");
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);

  const openModeRef = useRef<OpenMode>("closed");
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerOverTriggerRef = useRef(false);
  const suppressHoverUntilLeaveRef = useRef(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  const effectiveOpen =
    openMode !== "closed" &&
    !settingsOpen &&
    !hasPendingDelete &&
    (!isMobile || mobileOpen);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const updateOpenMode = useCallback((next: OpenMode) => {
    openModeRef.current = next;
    setOpenMode(next);
  }, []);

  const closeMenu = useCallback(
    (options?: { restoreFocus?: boolean; suppressHover?: boolean }) => {
      clearCloseTimer();
      if (options?.suppressHover && pointerOverTriggerRef.current) {
        suppressHoverUntilLeaveRef.current = true;
      }
      updateOpenMode("closed");
      if (options?.restoreFocus) {
        triggerRef.current?.focus();
      }
    },
    [clearCloseTimer, updateOpenMode]
  );

  function scheduleHoverClose() {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      if (openModeRef.current === "hover") {
        updateOpenMode("closed");
      }
    }, HOVER_CLOSE_DELAY_MS);
  }

  function handleTriggerPointerEnter(e: React.PointerEvent<HTMLButtonElement>) {
    if (isMobile || e.pointerType !== "mouse") return;
    pointerOverTriggerRef.current = true;
    if (settingsOpen || hasPendingDelete) return;
    if (suppressHoverUntilLeaveRef.current) return;
    // Do not open via hover if another top-level popover menu (e.g. AccountDock) is open
    const otherMenuOpen = Array.from(document.querySelectorAll('[role="menu"]')).some(
      (el) => el !== menuRef.current
    );
    if (otherMenuOpen) return;

    clearCloseTimer();
    if (openModeRef.current === "closed") {
      setMenuPos(computeDesktopMenuPos(triggerRef.current));
      updateOpenMode("hover");
    }
  }

  function handleTriggerPointerLeave(e: React.PointerEvent<HTMLButtonElement>) {
    if (isMobile || e.pointerType !== "mouse") return;
    pointerOverTriggerRef.current = false;
    suppressHoverUntilLeaveRef.current = false;
    if (openModeRef.current === "hover") {
      scheduleHoverClose();
    }
  }

  function handleTriggerClick() {
    clearCloseTimer();
    suppressHoverUntilLeaveRef.current = false;

    if (openModeRef.current === "click") {
      updateOpenMode("closed");
      return;
    }

    onBeforeExplicitOpen();
    if (!isMobile) {
      setMenuPos(computeDesktopMenuPos(triggerRef.current));
    }
    updateOpenMode("click");
  }

  function handleMenuPointerEnter(e: React.PointerEvent<HTMLDivElement>) {
    if (isMobile || e.pointerType !== "mouse") return;
    clearCloseTimer();
  }

  function handleMenuPointerLeave(e: React.PointerEvent<HTMLDivElement>) {
    if (isMobile || e.pointerType !== "mouse") return;
    if (openModeRef.current === "hover") {
      scheduleHoverClose();
    }
  }

  function handleSelectOption(opt: TripSortOption) {
    const wasClickOpened = openModeRef.current === "click";
    onBeforeExplicitOpen();
    onChange(opt);
    closeMenu({ restoreFocus: wasClickOpened, suppressHover: true });
  }

  useEffect(() => {
    return () => clearCloseTimer();
  }, [clearCloseTimer]);

  // Reset open state when Settings opens, delete confirm starts, or mobile drawer closes so it never reopens stale.
  useEffect(() => {
    if (openMode === "closed") return;
    if (settingsOpen || hasPendingDelete || (isMobile && !mobileOpen)) {
      const rafId = requestAnimationFrame(() => {
        clearCloseTimer();
        updateOpenMode("closed");
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [openMode, settingsOpen, hasPendingDelete, isMobile, mobileOpen, clearCloseTimer, updateOpenMode]);

  // Focus the active radio option ONLY when opened via click/keyboard (never steal focus on hover).
  useEffect(() => {
    if (!effectiveOpen || openMode !== "click") return;
    const rafId = requestAnimationFrame(() => {
      const active =
        menuRef.current?.querySelector<HTMLElement>('[role="menuitemradio"][aria-checked="true"]') ??
        menuRef.current?.querySelector<HTMLElement>('[role="menuitemradio"]');
      active?.focus();
    });
    return () => cancelAnimationFrame(rafId);
  }, [effectiveOpen, openMode]);

  // Outside click, resize, scroll, aside transition sync, and scoped Escape handling.
  useEffect(() => {
    if (!effectiveOpen) return;

    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      closeMenu();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (settingsOpen || e.key !== "Escape") return;
      const focusInside =
        menuRef.current?.contains(document.activeElement) ||
        triggerRef.current === document.activeElement;
      if (openModeRef.current !== "click" && !focusInside) return;
      e.stopImmediatePropagation();
      closeMenu({ restoreFocus: true, suppressHover: true });
    }

    function onResize() {
      closeMenu();
    }

    function onScroll(e: Event) {
      const target = e.target as Node | null;
      if (target && menuRef.current?.contains(target)) return;
      closeMenu();
    }

    const asideEl = !isMobile ? triggerRef.current?.closest("aside") : null;
    function onAsideTransitionEnd() {
      const nextPos = computeDesktopMenuPos(triggerRef.current);
      if (nextPos) setMenuPos(nextPos);
    }

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    asideEl?.addEventListener("transitionend", onAsideTransitionEnd);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
      asideEl?.removeEventListener("transitionend", onAsideTransitionEnd);
    };
  }, [effectiveOpen, settingsOpen, isMobile, closeMenu]);

  function handleMenuKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitemradio"]:not([disabled])')
    );
    if (items.length === 0) return;
    const idx = items.indexOf(document.activeElement as HTMLElement);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(idx + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === "Tab") {
      e.preventDefault();
      closeMenu({ restoreFocus: true, suppressHover: true });
    }
  }

  const isNonDefault = value !== "newest";
  const activeLabel = getTripSortLabel(value);

  const menuContent = (
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      aria-label="Sort trips"
      onPointerEnter={handleMenuPointerEnter}
      onPointerLeave={handleMenuPointerLeave}
      onFocusCapture={clearCloseTimer}
      onKeyDown={handleMenuKeyDown}
      style={
        !isMobile && menuPos
          ? {
              position: "fixed",
              left: `${menuPos.left}px`,
              top: `${menuPos.top}px`,
              width: `${menuPos.width}px`,
            }
          : undefined
      }
      className={
        isMobile
          ? "absolute top-full right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl"
          : "z-[60] overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl"
      }
    >
      <p className="px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Sort trips
      </p>
      {TRIP_SORT_OPTIONS.map((opt) => {
        const checked = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="menuitemradio"
            aria-checked={checked}
            onClick={() => handleSelectOption(opt.value)}
            className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none ${
              checked ? "font-medium text-popover-foreground" : "text-popover-foreground/85"
            }`}
          >
            <span>{opt.label}</span>
            {checked ? (
              <Check size={13} strokeWidth={1.75} className="shrink-0 text-primary" />
            ) : null}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="relative">
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-haspopup="menu"
        aria-expanded={effectiveOpen}
        aria-controls={effectiveOpen ? menuId : undefined}
        aria-label={`Sort trips (${activeLabel})`}
        title={`Sort trips: ${activeLabel}`}
        onPointerEnter={handleTriggerPointerEnter}
        onPointerLeave={handleTriggerPointerLeave}
        onClick={handleTriggerClick}
        className={`h-6 w-6 ${
          isNonDefault
            ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
            : "text-muted-foreground hover:text-sidebar-foreground"
        }`}
      >
        <ArrowUpDown size={13} strokeWidth={1.5} />
      </Button>

      {effectiveOpen
        ? isMobile
          ? menuContent
          : typeof document !== "undefined" && menuPos
          ? createPortal(menuContent, document.body)
          : null
        : null}
    </div>
  );
}
