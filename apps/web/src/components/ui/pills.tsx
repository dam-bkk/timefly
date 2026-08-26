import { cn, KIND_LABEL, PROJECT_STATUS_LABEL, TIMESHEET_STATUS_LABEL } from "@/lib/utils";
import type { DayState } from "@timefly/core";

/** One hue per timesheet status. */
const SHEET_DOT: Record<string, string> = { open: "bg-ink-4", submitted: "bg-info", approved: "bg-ok", reopened: "bg-warn" };

export function SheetPill({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-md bg-surface-2 px-2 text-[12.5px] font-medium text-ink-2", className)}>
      <span aria-hidden className={cn("inline-block size-1.5 shrink-0 rounded-full", SHEET_DOT[status] ?? "bg-ink-4")} />
      {TIMESHEET_STATUS_LABEL[status] ?? status}
    </span>
  );
}

const PROJECT_DOT: Record<string, string> = { active: "bg-ok", on_hold: "bg-warn", completed: "bg-ink-3", archived: "bg-ink-4" };

export function ProjectStatusPill({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-md bg-surface-2 px-2 text-[12.5px] font-medium text-ink-2", className)}>
      <span aria-hidden className={cn("inline-block size-1.5 shrink-0 rounded-full", PROJECT_DOT[status] ?? "bg-ink-4")} />
      {PROJECT_STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function KindTag({ kind, className }: { kind: string; className?: string }) {
  const tone = kind === "work_request" ? "text-violet bg-violet-soft" : kind === "internal" ? "text-ink-3 bg-surface-2" : "text-accent-ink bg-accent-soft";
  return <span className={cn("inline-flex h-5 items-center whitespace-nowrap rounded px-1.5 text-[11px] font-medium", tone, className)}>{KIND_LABEL[kind] ?? kind}</span>;
}

export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-md bg-surface-2 px-1.5 text-[11px] font-medium text-ink-2", className)}>{children}</span>;
}

export function Tone({ tone, children, className }: { tone: "ok" | "warn" | "crit" | "info" | "neutral" | "violet"; children: React.ReactNode; className?: string }) {
  const map = {
    ok: "text-ok bg-ok-soft",
    warn: "text-warn bg-warn-soft",
    crit: "text-crit bg-crit-soft",
    info: "text-info bg-info-soft",
    violet: "text-violet bg-violet-soft",
    neutral: "text-ink-2 bg-surface-2",
  };
  return <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium", map[tone], className)}>{children}</span>;
}

/** Day signal: the colour is the message — missing (crit), short (warn), ok, over (info), off/future (quiet). */
export const DAY_TONE: Record<DayState, { dot: string; text: string; label: string }> = {
  missing: { dot: "bg-crit", text: "text-crit", label: "Nothing logged" },
  short: { dot: "bg-warn", text: "text-warn", label: "Under half a day" },
  ok: { dot: "bg-ok", text: "text-ok", label: "Logged" },
  over: { dot: "bg-info", text: "text-info", label: "Well over target" },
  off: { dot: "bg-ink-4", text: "text-ink-4", label: "Non-working day" },
  future: { dot: "bg-surface-3", text: "text-ink-4", label: "Not yet" },
};

export function DayDot({ state, className }: { state: DayState; className?: string }) {
  return <span aria-label={DAY_TONE[state].label} title={DAY_TONE[state].label} className={cn("inline-block size-1.5 shrink-0 rounded-full", DAY_TONE[state].dot, className)} />;
}
