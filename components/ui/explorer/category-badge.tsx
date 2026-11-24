"use client";

import { Badge } from "@/components/ui/badge";

// Full literal class strings (light + dark) so Tailwind's scanner includes them.
const CATEGORY_BADGE_CLASSES: Record<string, string> = {
  museums:
    "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-900",
  historic:
    "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
  architecture:
    "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-900",
  cultural:
    "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900",
  natural:
    "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
  amusements:
    "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-900",
  religion:
    "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-900",
  foods:
    "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900",
};

const CATEGORY_FALLBACK_CLASS =
  "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";

export function CategoryBadge({
  category,
  className,
}: {
  category?: string | null;
  className?: string;
}) {
  if (!category) return null;
  const colors = CATEGORY_BADGE_CLASSES[category.toLowerCase()] ?? CATEGORY_FALLBACK_CLASS;
  return (
    <Badge variant="outline" className={[colors, className].filter(Boolean).join(" ")}>
      {category}
    </Badge>
  );
}
