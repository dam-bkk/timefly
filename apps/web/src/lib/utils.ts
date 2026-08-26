import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNowStrict, format, isToday, isYesterday, differenceInCalendarDays } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")).toUpperCase();
}

/** Stable hue from a string, used for avatar tints. */
export function hueFor(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

export function relTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return formatDistanceToNowStrict(date, { addSuffix: true }).replace("minutes", "min").replace("minute", "min").replace("seconds", "s").replace("second", "s");
}

export function shortTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isToday(date)) return format(date, "HH:mm");
  if (isYesterday(date)) return `Yesterday ${format(date, "HH:mm")}`;
  if (differenceInCalendarDays(new Date(), date) < 180) return format(date, "d MMM, HH:mm");
  return format(date, "d MMM yyyy");
}

export function longTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return format(date, "EEE d MMM yyyy, HH:mm");
}

export function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export const ROLE_LABEL: Record<string, string> = { member: "Member", manager: "Manager", admin: "Admin" };
export const KIND_LABEL: Record<string, string> = { project: "Project", work_request: "Work request", internal: "Internal" };
export const PROJECT_STATUS_LABEL: Record<string, string> = { active: "Active", on_hold: "On hold", completed: "Completed", archived: "Archived" };
export const TIMESHEET_STATUS_LABEL: Record<string, string> = { open: "Open", submitted: "Submitted", approved: "Approved", reopened: "Reopened" };
