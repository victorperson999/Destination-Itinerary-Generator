"use client";

import { type RefObject, useEffect, useRef, useState } from "react";
import {
  Bookmark,
  CalendarDays,
  Compass,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AccountDock } from "./account-dock";
import { BrandLogo } from "./brand-logo";
import type { Itinerary, SettingsDialogTab, SidebarUser } from "./types";

type SectionId = "discover" | "saved" | "itinerary";
type SidebarSurface = "desktop" | "mobile";

type AppSidebarProps = {
  authed: boolean;
  authLoading: boolean;
  user: SidebarUser | null;
  itineraries: Itinerary[];
  itineraryId: string | null;
  savedCount: number;
  itineraryItemCount: number | null;
  deletingItinId: string | null;
  sidebarError: string | null;
  collapsed: boolean;
  mobileOpen: boolean;
  settingsOpen: boolean;
  desktopAccountTriggerRef: RefObject<HTMLButtonElement | null>;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
  onDismissSidebarError: () => void;
  onNavigateSection: (section: SectionId) => void;
  onSelectItinerary: (id: string) => void;
  onNewTrip: () => void;
  onDeleteItinerary: (id: string) => Promise<void>;
  onOpenSettings: (tab: SettingsDialogTab, fromMobile: boolean) => void;
};

type SidebarBodyProps = {
  isMobile: boolean;
  collapsed: boolean;
  authed: boolean;
  authLoading: boolean;
  user: SidebarUser | null;
  itineraries: Itinerary[];
  itineraryId: string | null;
  savedCount: number;
  itineraryItemCount: number | null;
  deletingItinId: string | null;
  sidebarError: string | null;
  confirmingDeleteId: string | null;
  mobileOpen: boolean;
  settingsOpen: boolean;
  restoreFocusOnCancelRef: RefObject<boolean>;
  mobileCloseBtnRef?: RefObject<HTMLButtonElement | null>;
  desktopAccountTriggerRef?: RefObject<HTMLButtonElement | null>;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
  onDismissSidebarError: () => void;
  onNavigateSection: (section: SectionId) => void;
  onSelectItinerary: (id: string) => void;
  onNewTrip: () => void;
  onStartDeleteConfirm: (id: string, surface: SidebarSurface) => void;
  onCancelDeleteConfirm: (options?: { restoreFocus?: boolean }) => void;
  onPauseConfirmTimer: () => void;
  onResumeConfirmTimer: () => void;
  onConfirmDelete: (id: string) => Promise<void>;
  onOpenSettings: (tab: SettingsDialogTab, fromMobile: boolean) => void;
};

function SidebarBody({
  isMobile,
  collapsed,
  authed,
  authLoading,
  user,
  itineraries,
  itineraryId,
  savedCount,
  itineraryItemCount,
  deletingItinId,
  sidebarError,
  confirmingDeleteId,
  mobileOpen,
  settingsOpen,
  restoreFocusOnCancelRef,
  mobileCloseBtnRef,
  desktopAccountTriggerRef,
  onToggleCollapse,
  onCloseMobile,
  onDismissSidebarError,
  onNavigateSection,
  onSelectItinerary,
  onNewTrip,
  onStartDeleteConfirm,
  onCancelDeleteConfirm,
  onPauseConfirmTimer,
  onResumeConfirmTimer,
  onConfirmDelete,
  onOpenSettings,
}: SidebarBodyProps) {
  const isCompact = !isMobile && collapsed;
  const surface: SidebarSurface = isMobile ? "mobile" : "desktop";

  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);
  const trashBtnMapRef = useRef<Map<string, HTMLButtonElement | null>>(new Map());
  const prevConfirmIdRef = useRef<string | null>(null);

  useEffect(() => {
    const prevId = prevConfirmIdRef.current;
    prevConfirmIdRef.current = confirmingDeleteId;

    if (confirmingDeleteId) {
      cancelBtnRef.current?.focus();
    } else if (prevId && restoreFocusOnCancelRef.current) {
      restoreFocusOnCancelRef.current = false;
      trashBtnMapRef.current.get(prevId)?.focus();
    }
  }, [confirmingDeleteId, restoreFocusOnCancelRef]);

  const navItems: Array<{
    id: SectionId;
    label: string;
    icon: typeof Compass;
    badge?: number | null;
  }> = [
    { id: "discover", label: "Discover", icon: Compass },
    { id: "saved", label: "Saved", icon: Bookmark, badge: authed ? savedCount : null },
    { id: "itinerary", label: "Itinerary", icon: CalendarDays, badge: authed ? itineraryItemCount : null },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Brand + Collapse/Close header */}
      <div
        className={`flex h-13 shrink-0 items-center border-b border-sidebar-border/70 px-3 ${
          isCompact ? "justify-center" : "justify-between gap-2"
        }`}
      >
        {!isCompact ? (
          <div className="flex min-w-0 items-center gap-2.5 pl-0.5">
            <BrandLogo size={18} className="text-sidebar-primary" />
            <span className="truncate text-[13.5px] font-semibold tracking-tight text-sidebar-foreground">
              Local <span className="font-normal text-muted-foreground">Explorer</span>
            </span>
          </div>
        ) : null}

        {isMobile ? (
          <Button
            ref={mobileCloseBtnRef}
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-sidebar-foreground"
            onClick={onCloseMobile}
            aria-label="Close navigation sidebar"
          >
            <X size={15} strokeWidth={1.5} />
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-sidebar-foreground"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen size={15} strokeWidth={1.5} />
            ) : (
              <PanelLeftClose size={15} strokeWidth={1.5} />
            )}
          </Button>
        )}
      </div>

      {/* Primary Section Navigation */}
      <nav aria-label="Workspace sections" className="shrink-0 space-y-0.5 p-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              title={isCompact ? item.label : undefined}
              aria-label={isCompact ? item.label : undefined}
              onClick={() => {
                onNavigateSection(item.id);
                if (isMobile) onCloseMobile();
              }}
              className={`group flex w-full items-center rounded-lg text-[13px] text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground ${
                isCompact ? "justify-center p-2" : "gap-2.5 px-2.5 py-1.5"
              }`}
            >
              <Icon
                size={15}
                strokeWidth={1.5}
                className="shrink-0 text-muted-foreground transition-colors group-hover:text-sidebar-primary"
              />
              {!isCompact ? (
                <>
                  <span className="truncate">{item.label}</span>
                  {item.badge !== null && item.badge !== undefined ? (
                    <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
                      {item.badge}
                    </span>
                  ) : null}
                </>
              ) : null}
            </button>
          );
        })}
      </nav>

      <Separator className="shrink-0 bg-sidebar-border/70" />

      {/* Trips section */}
      {isCompact ? (
        authed ? (
          <div className="flex shrink-0 justify-center p-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-sidebar-foreground"
              onClick={onNewTrip}
              aria-label="New trip"
              title="New trip"
            >
              <Plus size={15} strokeWidth={1.5} />
            </Button>
          </div>
        ) : null
      ) : (
        <div className="flex min-h-0 flex-1 flex-col p-2.5">
          <div className="mb-1.5 flex items-center justify-between px-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">
              Trips
            </span>
            {authed ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="h-6 w-6 text-muted-foreground hover:text-sidebar-foreground"
                onClick={onNewTrip}
                aria-label="New trip"
                title="New trip"
              >
                <Plus size={14} strokeWidth={1.5} />
              </Button>
            ) : null}
          </div>

          {authed && sidebarError ? (
            <div
              role="alert"
              className="mb-2 flex items-start justify-between gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive"
            >
              <span className="min-w-0 flex-1 break-words">{sidebarError}</span>
              <button
                type="button"
                onClick={onDismissSidebarError}
                aria-label="Dismiss error"
                className="mt-0.5 shrink-0 rounded-sm p-0.5 opacity-80 hover:opacity-100"
              >
                <X size={12} strokeWidth={1.5} />
              </button>
            </div>
          ) : null}

          {!authed ? (
            <p className="rounded-lg border border-dashed border-sidebar-border/80 px-3 py-3 text-xs leading-relaxed text-muted-foreground">
              Sign in to save places and switch between your trips.
            </p>
          ) : itineraries.length === 0 ? (
            <p className="px-1.5 py-2 text-xs text-muted-foreground">
              No trips yet. Click <span className="font-medium text-sidebar-foreground">+</span> to create one.
            </p>
          ) : (
            <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1" aria-label="Your trips">
              {itineraries.map((it) => {
                const isActive = it.id === itineraryId;
                const isConfirming = confirmingDeleteId === it.id && deletingItinId === null;
                const isDeleting = deletingItinId === it.id;

                if (isConfirming) {
                  return (
                    <li
                      key={it.id}
                      onFocusCapture={onPauseConfirmTimer}
                      onBlurCapture={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                          onResumeConfirmTimer();
                        }
                      }}
                      className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2"
                    >
                      <p className="truncate text-xs font-medium text-destructive">
                        Delete &ldquo;{it.title}&rdquo;?
                      </p>
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="h-6 flex-1 px-2 text-xs"
                          onClick={() => void onConfirmDelete(it.id)}
                        >
                          Delete
                        </Button>
                        <Button
                          ref={cancelBtnRef}
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 flex-1 px-2 text-xs"
                          onClick={() => onCancelDeleteConfirm({ restoreFocus: true })}
                        >
                          Cancel
                        </Button>
                      </div>
                    </li>
                  );
                }

                return (
                  <li
                    key={it.id}
                    className={`group flex items-center gap-1 rounded-lg transition-colors ${
                      isActive
                        ? "bg-sidebar-accent/85 text-sidebar-accent-foreground ring-1 ring-inset ring-sidebar-border/70"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                    }`}
                  >
                    <button
                      type="button"
                      aria-current={isActive ? "true" : undefined}
                      disabled={isDeleting}
                      onClick={() => {
                        onSelectItinerary(it.id);
                        onNavigateSection("itinerary");
                        if (isMobile) onCloseMobile();
                      }}
                      className="flex min-w-0 flex-1 items-center justify-between gap-2 px-2.5 py-1.5 text-left text-[13px]"
                    >
                      <span className={`truncate ${isActive ? "font-medium" : ""}`}>
                        {isDeleting ? "Deleting…" : it.title}
                      </span>
                      <span
                        className={`shrink-0 text-[11px] tabular-nums ${
                          isActive ? "text-sidebar-accent-foreground/75" : "text-muted-foreground/80"
                        }`}
                      >
                        {it.daysCount}d
                      </span>
                    </button>

                    <button
                      ref={(el) => {
                        if (el) trashBtnMapRef.current.set(it.id, el);
                        else trashBtnMapRef.current.delete(it.id);
                      }}
                      type="button"
                      disabled={deletingItinId !== null}
                      onClick={() => onStartDeleteConfirm(it.id, surface)}
                      aria-label={`Delete ${it.title}`}
                      title={`Delete ${it.title}`}
                      className="mr-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-70 transition-opacity hover:bg-destructive/15 hover:text-destructive focus-visible:opacity-100 disabled:pointer-events-none disabled:opacity-30 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"
                    >
                      <Trash2 size={13} strokeWidth={1.5} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Pinned bottom Account Dock */}
      <AccountDock
        user={authed ? user : null}
        authLoading={authLoading}
        isMobile={isMobile}
        isCompact={isCompact}
        mobileOpen={mobileOpen}
        settingsOpen={settingsOpen}
        desktopTriggerRef={desktopAccountTriggerRef}
        onBeforeOpenMenu={() => onCancelDeleteConfirm({ restoreFocus: false })}
        onOpenSettings={onOpenSettings}
      />
    </div>
  );
}

export function AppSidebar({
  authed,
  authLoading,
  user,
  itineraries,
  itineraryId,
  savedCount,
  itineraryItemCount,
  deletingItinId,
  sidebarError,
  collapsed,
  mobileOpen,
  settingsOpen,
  desktopAccountTriggerRef,
  onToggleCollapse,
  onCloseMobile,
  onDismissSidebarError,
  onNavigateSection,
  onSelectItinerary,
  onNewTrip,
  onDeleteItinerary,
  onOpenSettings,
}: AppSidebarProps) {
  const [confirmingDelete, setConfirmingDelete] = useState<{
    id: string;
    surface: SidebarSurface;
  } | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoreFocusOnCancelRef = useRef(false);
  const mobileCloseBtnRef = useRef<HTMLButtonElement | null>(null);
  const prevMobileOpenRef = useRef(mobileOpen);

  function clearConfirmTimer() {
    if (confirmTimerRef.current) {
      clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = null;
    }
  }

  function scheduleConfirmAutoCancel() {
    clearConfirmTimer();
    confirmTimerRef.current = setTimeout(() => {
      confirmTimerRef.current = null;
      restoreFocusOnCancelRef.current = false;
      setConfirmingDelete(null);
    }, 4000);
  }

  function startDeleteConfirm(id: string, surface: SidebarSurface) {
    restoreFocusOnCancelRef.current = false;
    setConfirmingDelete({ id, surface });
    scheduleConfirmAutoCancel();
  }

  function cancelDeleteConfirm(options?: { restoreFocus?: boolean }) {
    clearConfirmTimer();
    restoreFocusOnCancelRef.current = Boolean(options?.restoreFocus);
    setConfirmingDelete(null);
  }

  async function confirmDelete(id: string) {
    clearConfirmTimer();
    restoreFocusOnCancelRef.current = false;
    setConfirmingDelete(null);
    await onDeleteItinerary(id);
  }

  useEffect(() => {
    return () => clearConfirmTimer();
  }, []);

  // Intercept Escape in capture phase so it cancels delete confirmation before closing drawers,
  // while yielding to higher-priority SettingsDialog when open.
  useEffect(() => {
    if (!confirmingDelete || settingsOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      clearConfirmTimer();
      restoreFocusOnCancelRef.current = true;
      setConfirmingDelete(null);
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [confirmingDelete, settingsOpen]);

  // Clear pending delete confirmation when user signs out, desktop sidebar collapses, or Settings opens.
  useEffect(() => {
    if (!authed || collapsed || settingsOpen) {
      const rafId = requestAnimationFrame(() => {
        clearConfirmTimer();
        restoreFocusOnCancelRef.current = false;
        setConfirmingDelete(null);
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [authed, collapsed, settingsOpen]);

  // Move focus into mobile drawer on open; clear any stale delete confirm on external close.
  useEffect(() => {
    const wasOpen = prevMobileOpenRef.current;
    prevMobileOpenRef.current = mobileOpen;

    if (!wasOpen && mobileOpen) {
      const rafId = requestAnimationFrame(() => {
        mobileCloseBtnRef.current?.focus();
      });
      return () => cancelAnimationFrame(rafId);
    }

    if (wasOpen && !mobileOpen) {
      const rafId = requestAnimationFrame(() => {
        clearConfirmTimer();
        restoreFocusOnCancelRef.current = false;
        setConfirmingDelete(null);
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [mobileOpen]);

  function handleCloseMobile() {
    cancelDeleteConfirm({ restoreFocus: false });
    onCloseMobile();
  }

  const sharedProps = {
    authed,
    authLoading,
    user,
    itineraries,
    itineraryId,
    savedCount,
    itineraryItemCount,
    deletingItinId,
    sidebarError,
    mobileOpen,
    settingsOpen,
    restoreFocusOnCancelRef,
    onToggleCollapse,
    onCloseMobile: handleCloseMobile,
    onDismissSidebarError,
    onNavigateSection,
    onSelectItinerary,
    onNewTrip,
    onStartDeleteConfirm: startDeleteConfirm,
    onCancelDeleteConfirm: cancelDeleteConfirm,
    onPauseConfirmTimer: clearConfirmTimer,
    onResumeConfirmTimer: scheduleConfirmAutoCancel,
    onConfirmDelete: confirmDelete,
    onOpenSettings,
  };

  return (
    <>
      {/* Desktop sticky sidebar */}
      <aside
        aria-label="Sidebar navigation"
        className={`sticky top-0 hidden h-dvh shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:flex ${
          collapsed ? "w-14" : "w-64"
        }`}
      >
        <SidebarBody
          {...sharedProps}
          isMobile={false}
          collapsed={collapsed}
          desktopAccountTriggerRef={desktopAccountTriggerRef}
          confirmingDeleteId={
            confirmingDelete?.surface === "desktop" ? confirmingDelete.id : null
          }
        />
      </aside>

      {/* Mobile off-canvas backdrop */}
      {mobileOpen ? (
        <div
          aria-hidden="true"
          onClick={handleCloseMobile}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      ) : null}

      {/* Mobile off-canvas drawer */}
      <aside
        id="mobile-sidebar"
        role={mobileOpen ? "dialog" : undefined}
        aria-modal={mobileOpen ? true : undefined}
        aria-label="Mobile navigation"
        inert={!mobileOpen}
        aria-hidden={!mobileOpen}
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl transition-transform duration-200 ease-out lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarBody
          {...sharedProps}
          isMobile={true}
          collapsed={false}
          mobileCloseBtnRef={mobileCloseBtnRef}
          confirmingDeleteId={
            confirmingDelete?.surface === "mobile" ? confirmingDelete.id : null
          }
        />
      </aside>
    </>
  );
}
