"use client";

import { type RefObject, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { signIn, signOut } from "next-auth/react";
import {
  ChevronsUpDown,
  HelpCircle,
  LogIn,
  LogOut,
  Settings,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { SettingsDialogTab, SidebarUser } from "./types";

type AccountDockProps = {
  user: SidebarUser | null;
  authLoading: boolean;
  isMobile: boolean;
  isCompact: boolean;
  mobileOpen: boolean;
  settingsOpen: boolean;
  desktopTriggerRef?: RefObject<HTMLButtonElement | null>;
  onBeforeOpenMenu: () => void;
  onOpenSettings: (tab: SettingsDialogTab, fromMobile: boolean) => void;
};

type PopoverPos = {
  left: number;
  bottom: number;
  width: number;
};

function getDisplayName(user: SidebarUser): string {
  return user.name?.trim() || user.email?.trim() || "Account";
}

function getInitials(label: string): string {
  const parts = label
    .replace(/@.*/, "")
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function computeDesktopPopoverPos(
  trigger: HTMLButtonElement | null,
  isCompact: boolean
): PopoverPos | null {
  if (!trigger) return null;
  const rect = trigger.getBoundingClientRect();
  const asideRect = trigger.closest("aside")?.getBoundingClientRect();
  const width = isCompact ? 240 : Math.max(236, Math.round(rect.width));
  if (isCompact) {
    const railRight = Math.max(asideRect?.right ?? 56, 56);
    return {
      left: Math.min(railRight + 8, window.innerWidth - width - 8),
      bottom: Math.max(8, window.innerHeight - rect.bottom),
      width,
    };
  }
  return {
    left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
    bottom: Math.max(8, window.innerHeight - rect.top + 8),
    width,
  };
}

export function UserAvatar({
  user,
  size = "md",
}: {
  user: SidebarUser;
  size?: "sm" | "md";
}) {
  const [failedImgSrc, setFailedImgSrc] = useState<string | null>(null);
  const displayName = getDisplayName(user);
  const showImage = Boolean(user.image) && failedImgSrc !== user.image;
  const dimClass = size === "sm" ? "h-7 w-7 text-[11px]" : "h-8 w-8 text-xs";

  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-sidebar-primary font-semibold text-sidebar-primary-foreground ring-1 ring-sidebar-border ${dimClass}`}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.image!}
          alt={displayName}
          referrerPolicy="no-referrer"
          onError={() => setFailedImgSrc(user.image)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{getInitials(displayName)}</span>
      )}
    </span>
  );
}

export function AccountDock({
  user,
  authLoading,
  isMobile,
  isCompact,
  mobileOpen,
  settingsOpen,
  desktopTriggerRef,
  onBeforeOpenMenu,
  onOpenSettings,
}: AccountDockProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<PopoverPos | null>(null);

  const localTriggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  const effectiveMenuOpen = menuOpen && Boolean(user) && (!isMobile || mobileOpen);

  function setTriggerNode(el: HTMLButtonElement | null) {
    localTriggerRef.current = el;
    if (!isMobile && desktopTriggerRef) {
      desktopTriggerRef.current = el;
    }
  }

  function toggleMenu() {
    if (!user) return;
    if (effectiveMenuOpen) {
      setMenuOpen(false);
      return;
    }
    onBeforeOpenMenu();
    if (!isMobile) {
      setPopoverPos(computeDesktopPopoverPos(localTriggerRef.current, isCompact));
    }
    setMenuOpen(true);
  }

  // Close menu cleanly when sidebar collapses/expands, mobile drawer closes, user signs out, or window resizes.
  useEffect(() => {
    if (!menuOpen) return;
    if (!user || (isMobile && !mobileOpen)) {
      const rafId = requestAnimationFrame(() => setMenuOpen(false));
      return () => cancelAnimationFrame(rafId);
    }
  }, [menuOpen, user, isMobile, mobileOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const rafId = requestAnimationFrame(() => setMenuOpen(false));
    return () => cancelAnimationFrame(rafId);
    // Close whenever desktop compact state changes so popover never floats detached.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompact]);

  // Focus first menuitem on open.
  useEffect(() => {
    if (!effectiveMenuOpen) return;
    const rafId = requestAnimationFrame(() => {
      const first = popoverRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
      first?.focus();
    });
    return () => cancelAnimationFrame(rafId);
  }, [effectiveMenuOpen]);

  // Outside click, resize close, and capture-phase Escape handling.
  useEffect(() => {
    if (!effectiveMenuOpen) return;

    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      if (localTriggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setMenuOpen(false);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (settingsOpen) return;
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        setMenuOpen(false);
        localTriggerRef.current?.focus();
      }
    }

    function onResize() {
      setMenuOpen(false);
    }

    const asideEl = !isMobile ? localTriggerRef.current?.closest("aside") : null;
    function onAsideTransitionEnd() {
      const nextPos = computeDesktopPopoverPos(localTriggerRef.current, isCompact);
      if (nextPos) setPopoverPos(nextPos);
    }

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("resize", onResize);
    asideEl?.addEventListener("transitionend", onAsideTransitionEnd);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("resize", onResize);
      asideEl?.removeEventListener("transitionend", onAsideTransitionEnd);
    };
  }, [effectiveMenuOpen, settingsOpen, isMobile, isCompact]);

  function handleMenuKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])')
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
      setMenuOpen(false);
      localTriggerRef.current?.focus();
    }
  }

  function handleSelectItem(action: () => void) {
    setMenuOpen(false);
    action();
  }

  // Signed-out or loading footer
  if (!user) {
    if (authLoading) {
      return (
        <div
          className={`mt-auto shrink-0 border-t border-sidebar-border ${
            isCompact ? "flex justify-center p-2" : "p-2.5"
          }`}
        >
          {isCompact ? (
            <div className="h-8 w-8 animate-pulse rounded-full bg-sidebar-accent" />
          ) : (
            <div className="flex items-center gap-2.5 px-1 py-1">
              <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-sidebar-accent" />
              <div className="h-3.5 flex-1 animate-pulse rounded bg-sidebar-accent" />
            </div>
          )}
        </div>
      );
    }

    if (isCompact) {
      return (
        <div className="mt-auto flex shrink-0 justify-center border-t border-sidebar-border p-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-9 w-9 rounded-full"
            onClick={() => void signIn("github")}
            aria-label="Sign in with GitHub"
            title="Sign in"
          >
            <LogIn size={16} />
          </Button>
        </div>
      );
    }

    return (
      <div className="mt-auto shrink-0 border-t border-sidebar-border p-2.5">
        <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-muted-foreground">
            <User size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-sidebar-foreground">Guest</p>
            <p className="truncate text-[11px] text-muted-foreground">Not signed in</p>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-7 shrink-0 px-2.5 text-xs"
            onClick={() => void signIn("github")}
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  const displayName = getDisplayName(user);
  const email = user.email?.trim() || null;

  const menuContent = (
    <div
      ref={popoverRef}
      id={menuId}
      role="menu"
      aria-label="Account menu"
      onKeyDown={handleMenuKeyDown}
      style={
        !isMobile && popoverPos
          ? {
              position: "fixed",
              left: `${popoverPos.left}px`,
              bottom: `${popoverPos.bottom}px`,
              width: `${popoverPos.width}px`,
            }
          : undefined
      }
      className={
        isMobile
          ? "absolute inset-x-2 bottom-full z-10 mb-2 overflow-hidden rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl"
          : "z-[60] overflow-hidden rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl"
      }
    >
      <div className="flex items-center gap-2.5 px-2.5 py-2">
        <UserAvatar user={user} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-popover-foreground">{displayName}</p>
          {email && email !== displayName ? (
            <p className="truncate text-[11px] text-muted-foreground">{email}</p>
          ) : null}
        </div>
      </div>

      <Separator className="my-1" />

      <button
        type="button"
        role="menuitem"
        onClick={() => handleSelectItem(() => onOpenSettings("preferences", isMobile))}
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-popover-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none"
      >
        <Settings size={15} className="shrink-0 text-muted-foreground" />
        <span>Settings</span>
      </button>

      <button
        type="button"
        role="menuitem"
        onClick={() => handleSelectItem(() => onOpenSettings("help", isMobile))}
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-popover-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none"
      >
        <HelpCircle size={15} className="shrink-0 text-muted-foreground" />
        <span>Help &amp; shortcuts</span>
      </button>

      <Separator className="my-1" />

      <button
        type="button"
        role="menuitem"
        onClick={() => handleSelectItem(() => void signOut())}
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10 focus-visible:bg-destructive/10 focus-visible:outline-none"
      >
        <LogOut size={15} className="shrink-0" />
        <span>Log out</span>
      </button>
    </div>
  );

  return (
    <div
      className={`relative mt-auto shrink-0 border-t border-sidebar-border ${
        isCompact ? "flex justify-center p-2" : "p-2"
      }`}
    >
      <button
        ref={setTriggerNode}
        type="button"
        onClick={toggleMenu}
        aria-haspopup="menu"
        aria-expanded={effectiveMenuOpen}
        aria-controls={effectiveMenuOpen ? menuId : undefined}
        aria-label={isCompact ? `${displayName} account menu` : undefined}
        title={isCompact ? displayName : undefined}
        className={`flex items-center rounded-lg text-left transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring ${
          isCompact
            ? "justify-center rounded-full p-0.5"
            : "w-full gap-2.5 px-2 py-1.5"
        }`}
      >
        <UserAvatar user={user} />
        {!isCompact ? (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-tight text-sidebar-foreground">
                {displayName}
              </p>
              {email && email !== displayName ? (
                <p className="truncate text-[11px] text-muted-foreground">{email}</p>
              ) : null}
            </div>
            <ChevronsUpDown size={14} className="shrink-0 text-muted-foreground" />
          </>
        ) : null}
      </button>

      {effectiveMenuOpen
        ? isMobile
          ? menuContent
          : typeof document !== "undefined" && popoverPos
          ? createPortal(menuContent, document.body)
          : null
        : null}
    </div>
  );
}
