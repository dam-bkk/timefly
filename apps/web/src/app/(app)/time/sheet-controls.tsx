"use client";

import { Check, RotateCcw, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { approveWeek, reopenWeek, submitWeek } from "./actions";

/** Submit (owner) / Approve / Reopen (manager) — the three verbs of a timesheet week. */
export function SheetControls({ personId, weekStart, timesheetId, status, canSubmit, canApprove, canReopen, next }: { personId: number; weekStart: string; timesheetId: number; status: string; canSubmit: boolean; canApprove: boolean; canReopen: boolean; next?: { personId: number; left: number } | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [reopen, setReopen] = useState(false);
  const [note, setNote] = useState("");
  return (
    <div className="flex items-center gap-1.5">
      {canSubmit && (
        <Button size="sm" variant="primary" disabled={pending} onClick={() => start(() => submitWeek({ personId, weekStart }))}>
          <Send className="size-3.5" /> Submit week
        </Button>
      )}
      {canApprove && (
        <Button
          size="sm"
          variant="primary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await approveWeek(timesheetId);
              if (next) router.push(`/time?person=${next.personId}&week=${weekStart}`);
            })
          }
          title={next ? `${next.left} more awaiting approval` : undefined}
        >
          <Check className="size-3.5" /> {next ? `Approve & next (${next.left} left)` : "Approve"}
        </Button>
      )}
      {canReopen && !reopen && (
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => setReopen(true)}>
          <RotateCcw className="size-3.5" /> Reopen
        </Button>
      )}
      {reopen && (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              await reopenWeek(timesheetId, note);
              setReopen(false);
              setNote("");
            });
          }}
        >
          <input autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why? (sent to the person)" className="h-8 w-64 rounded-md bg-surface px-2.5 text-[13px] hairline focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--accent)]" />
          <Button size="sm" variant="primary" type="submit" disabled={pending}>
            Reopen
          </Button>
          <Button size="sm" variant="ghost" type="button" onClick={() => setReopen(false)}>
            Cancel
          </Button>
        </form>
      )}
      {!canSubmit && !canApprove && !canReopen && status === "submitted" && <span className="text-[12.5px] text-ink-3">Awaiting approval</span>}
    </div>
  );
}
