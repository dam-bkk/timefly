"use client";

import { BellRing, Check } from "lucide-react";
import { useState, useTransition } from "react";
import { approveWeek, remind } from "../time/actions";
import { cn, relTime } from "@/lib/utils";

/**
 * Row verbs, shown only when there is something to do: Approve when submitted, Remind when the person needs a
 * nudge. If a reminder already went out today the button turns into "Reminded 2h ago" so nobody gets nagged twice.
 */
export function RowActions({ personId, weekStart, timesheetId, status, missingDays, needsNudge, remindedAt }: { personId: number; weekStart: string; timesheetId: number | null; status: string | null; missingDays: string[]; needsNudge: boolean; remindedAt: string | null }) {
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);
  const btn = "inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-medium transition-colors disabled:opacity-50";
  const remindedToday = remindedAt && Date.now() - new Date(remindedAt).getTime() < 24 * 3_600_000;
  return (
    <span className="flex items-center justify-end gap-1">
      {status === "submitted" && timesheetId && (
        <button type="button" disabled={pending} onClick={() => start(() => approveWeek(timesheetId))} className={cn(btn, "bg-ok-soft text-ok hover:brightness-95")}>
          <Check className="size-3.5" /> Approve
        </button>
      )}
      {needsNudge &&
        (sent || remindedToday ? (
          <span className="inline-flex h-7 items-center gap-1 px-2 text-[12px] text-ink-3" title="Reminder already sent">
            <BellRing className="size-3.5" /> {sent || Date.now() - new Date(remindedAt!).getTime() < 60_000 ? "Reminded" : `Reminded ${relTime(remindedAt)}`}
          </span>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await remind({ personId, weekStart, days: missingDays });
                setSent(true);
              })
            }
            className={cn(btn, "text-ink-2 hover:bg-surface-2 hover:text-ink")}
            title={missingDays.length ? `Nudge about ${missingDays.length} missing day(s)` : "Nudge to submit"}
          >
            <BellRing className="size-3.5" /> Remind
          </button>
        ))}
    </span>
  );
}
