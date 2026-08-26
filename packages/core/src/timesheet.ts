import { isWeekend, type ISODate } from "./week";
import { sumHours } from "./hours";

/**
 * A timesheet is one person x one week. Entries are edited freely while it is open; submitting locks it for the
 * owner, a manager approves or reopens it. Approval can be switched off - then "submitted" is the final state.
 */
export type TimesheetStatus = "open" | "submitted" | "approved" | "reopened";

export const TIMESHEET_TRANSITIONS: Record<TimesheetStatus, TimesheetStatus[]> = {
  open: ["submitted"],
  reopened: ["submitted"],
  submitted: ["approved", "reopened"],
  approved: ["reopened"],
};

export function canTransition(from: TimesheetStatus, to: TimesheetStatus): boolean {
  return TIMESHEET_TRANSITIONS[from].includes(to);
}

export type Role = "member" | "manager" | "admin";

/** Who may change entries: owners while open/reopened; managers and admins always (their edits are logged). */
export function canEditEntries(status: TimesheetStatus, role: Role, isOwner: boolean): boolean {
  if (role === "admin" || role === "manager") return true;
  return isOwner && (status === "open" || status === "reopened");
}

export function canSubmit(status: TimesheetStatus, role: Role, isOwner: boolean): boolean {
  return (isOwner || role === "admin") && (status === "open" || status === "reopened");
}

export function canApprove(status: TimesheetStatus, role: Role, isOwner: boolean): boolean {
  return !isOwner && (role === "manager" || role === "admin") && status === "submitted";
}

export function canReopen(status: TimesheetStatus, role: Role): boolean {
  return (role === "manager" || role === "admin") && (status === "submitted" || status === "approved");
}

export type EntryLike = { date: ISODate; hours: number };

export function dailyTotals(entries: EntryLike[]): Record<ISODate, number> {
  const out: Record<ISODate, number> = {};
  for (const e of entries) out[e.date] = Math.round(((out[e.date] ?? 0) + e.hours) * 100) / 100;
  return out;
}

export type DayState = "missing" | "short" | "ok" | "over" | "off" | "future";

/**
 * Classify each day of a week for the "did you log?" signals.
 * off = weekend or listed holiday; future = after today; missing = nothing on a working day;
 * short = under minHours (default half the target); over = above target x 1.5.
 */
export function dayStates(days: ISODate[], entries: EntryLike[], opts: { today: ISODate; target: number; minHours?: number; holidays?: ISODate[] }): Record<ISODate, DayState> {
  const totals = dailyTotals(entries);
  const min = opts.minHours ?? opts.target / 2;
  const holidays = new Set(opts.holidays ?? []);
  const out: Record<ISODate, DayState> = {};
  for (const d of days) {
    const h = totals[d] ?? 0;
    if (isWeekend(d) || holidays.has(d)) out[d] = "off";
    else if (d > opts.today) out[d] = "future";
    else if (h === 0) out[d] = "missing";
    else if (h < min) out[d] = "short";
    else if (h > opts.target * 1.5) out[d] = "over";
    else out[d] = "ok";
  }
  return out;
}

export function missingDays(days: ISODate[], entries: EntryLike[], opts: { today: ISODate; target: number; minHours?: number; holidays?: ISODate[] }): ISODate[] {
  const states = dayStates(days, entries, opts);
  return days.filter((d) => states[d] === "missing");
}

export type WeekSummary = { total: number; target: number; workingDays: number; byDay: Record<ISODate, number>; missing: ISODate[]; completion: number };

export function weekSummary(days: ISODate[], entries: EntryLike[], opts: { today: ISODate; target: number; holidays?: ISODate[] }): WeekSummary {
  const states = dayStates(days, entries, opts);
  const byDay = dailyTotals(entries);
  const working = days.filter((d) => states[d] !== "off");
  const elapsed = working.filter((d) => states[d] !== "future");
  const total = sumHours(days.map((d) => byDay[d]));
  const target = working.length * opts.target;
  const elapsedTarget = elapsed.length * opts.target;
  return { total, target, workingDays: working.length, byDay, missing: days.filter((d) => states[d] === "missing"), completion: elapsedTarget ? Math.min(1, Math.round((total / elapsedTarget) * 100) / 100) : 0 };
}
