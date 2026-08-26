"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { isoWeekNumber, weekLabel } from "@timefly/core";
import { cn } from "@/lib/utils";

/** Previous / label / next / Today. Keeps every other query param (person, team) intact. */
export function WeekNav({ weekStart, prev, next, isCurrent, className }: { weekStart: string; prev: string; next: string; isCurrent: boolean; className?: string }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const go = (week: string | null) => {
    const q = new URLSearchParams(params.toString());
    if (week) q.set("week", week);
    else q.delete("week");
    router.push(`${path}?${q.toString()}`);
  };
  const btn = "inline-flex size-7 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink";
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <button type="button" onClick={() => go(prev)} className={btn} aria-label="Previous week">
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-[190px] text-center text-[13.5px] font-medium tnum">
        {weekLabel(weekStart)} <span className="ml-1 font-normal text-ink-3">W{isoWeekNumber(weekStart)}</span>
      </span>
      <button type="button" onClick={() => go(next)} className={btn} aria-label="Next week">
        <ChevronRight className="size-4" />
      </button>
      {!isCurrent && (
        <button type="button" onClick={() => go(null)} className="ml-1 h-7 rounded-md px-2 text-[12.5px] font-medium text-accent-ink hover:bg-accent-soft">
          Today
        </button>
      )}
    </div>
  );
}
