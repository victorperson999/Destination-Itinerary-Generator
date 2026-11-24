"use client";

import { cn } from "@/lib/utils";

const CATEGORY_ALIASES: Record<string, string> = {
  view_points: "Viewpoints",
  unclassified_objects: "Unclassified Objects",
  interesting_places: "Interesting Places",
  other_buildings_and_structures: "Buildings & Structures",
  urban_environment: "Urban",
  natural: "Nature",
  foods: "Food & Drink",
};

// Full literal dot color classes (light + dark) so Tailwind's scanner includes them.
const CATEGORY_DOT_CLASSES: Record<string, string> = {
  museums: "bg-violet-500 dark:bg-violet-400",
  historic: "bg-amber-500 dark:bg-amber-400",
  architecture: "bg-cyan-500 dark:bg-cyan-400",
  cultural: "bg-rose-500 dark:bg-rose-400",
  natural: "bg-emerald-500 dark:bg-emerald-400",
  amusements: "bg-orange-500 dark:bg-orange-400",
  religion: "bg-indigo-500 dark:bg-indigo-400",
  markets: "bg-teal-500 dark:bg-teal-400",
  viewpoints: "bg-teal-500 dark:bg-teal-400",
  foods: "bg-red-500 dark:bg-red-400",
  restaurant: "bg-red-500 dark:bg-red-400",
  attraction: "bg-teal-500 dark:bg-teal-400",
};

const CATEGORY_FALLBACK_DOT = "bg-slate-400 dark:bg-slate-500";

export function formatCategoryLabel(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const key = trimmed.toLowerCase();
  if (CATEGORY_ALIASES[key]) return CATEGORY_ALIASES[key];
  return trimmed
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function CategoryBadge({
  category,
  className,
}: {
  category?: string | null;
  className?: string;
}) {
  if (!category?.trim()) return null;
  const label = formatCategoryLabel(category);
  const dotClass =
    CATEGORY_DOT_CLASSES[category.trim().toLowerCase()] ?? CATEGORY_FALLBACK_DOT;

  return (
    <span
      title={label}
      className={cn(
        "inline-flex max-w-[136px] items-center gap-1.5 rounded-md bg-muted/45 px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-inset ring-border/50",
        className
      )}
    >
      <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClass)} />
      <span className="truncate">{label}</span>
    </span>
  );
}
