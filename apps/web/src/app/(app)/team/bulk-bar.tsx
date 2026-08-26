"use client";

import { BellRing, CheckCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { approveMany, remindMany } from "../time/actions";
import { cn } from "@/lib/utils";

/**
 * One click for the whole list: remind everyone who needs a nudge, approve everything submitted.
 * The counts follow the active filter, so "Needs a nudge → Remind all 17" is two clicks, not seventeen.
 */
export function BulkBar({ weekStart, nudgeIds, approveIds, label }: { weekStart: string; nudgeIds: number[]; approveIds: number[]; label: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  if (!nudgeIds.length && !approveIds.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface px-3 py-2 hairline">
      <span className="text-[12.5px] text-ink-3">{label}</span>
      {nudgeIds.length > 0 && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await remindMany({ personIds: nudgeIds, weekStart });
              setMsg(`${r.sent} reminded${r.skipped ? ` · ${r.skipped} already reminded today` : ""}`);
            })
          }
          className={cn("inline-flex h-8 items-center gap-1.5 rounded-md bg-warn-soft px-3 text-[12.5px] font-medium text-warn hover:brightness-95 disabled:opacity-50")}
        >
          <BellRing className="size-3.5" /> Remind all {nudgeIds.length}
        </button>
      )}
      {approveIds.length > 0 && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await approveMany(approveIds);
              setMsg(`${r.approved} approved`);
            })
          }
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-ok-soft px-3 text-[12.5px] font-medium text-ok hover:brightness-95 disabled:opacity-50"
        >
          <CheckCheck className="size-3.5" /> Approve all {approveIds.length}
        </button>
      )}
      {msg && <span className="text-[12.5px] text-ink-2">{msg}</span>}
      {pending && <span className="text-[12.5px] text-ink-3">Working…</span>}
    </div>
  );
}
