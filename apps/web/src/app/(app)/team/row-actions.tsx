"use client";

import { BellRing, Check } from "lucide-react";
import { useState, useTransition } from "react";
import { approveWeek, remind } from "../time/actions";
import { cn } from "@/lib/utils";

export function RowActions({ personId, weekStart, timesheetId, status, missingDays }: { personId: number; weekStart: string; timesheetId: number | null; status: string | null; missingDays: string[] }) {
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);
  const btn = "inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-medium transition-colors disabled:opacity-50";
  return (
    <span className="flex items-center justify-end gap-1">
      {status === "submitted" && timesheetId && (
        <button type="button" disabled={pending} onClick={() => start(() => approveWeek(timesheetId))} className={cn(btn, "bg-ok-soft text-ok hover:brightness-95")}>
          <Check className="size-3.5" /> Approve
        </button>
      )}
      {(missingDays.length > 0 || status === "open" || status === "reopened" || status === null) && (
        <button
          type="button"
          disabled={pending || sent}
          onClick={() =>
            start(async () => {
              await remind({ personId, weekStart, days: missingDays });
              setSent(true);
            })
          }
          className={cn(btn, sent ? "text-ink-3" : "text-ink-2 hover:bg-surface-2 hover:text-ink")}
          title={missingDays.length ? `Nudge about ${missingDays.length} missing day(s)` : "Nudge to submit"}
        >
          <BellRing className="size-3.5" /> {sent ? "Sent" : "Remind"}
        </button>
      )}
    </span>
  );
}
