/**
 * Calendar maths on ISO date strings (YYYY-MM-DD). Everything here is timezone-free on purpose:
 * a timesheet day is a civil date, whatever office the person sits in.
 */

export type ISODate = string;

const DAY_MS = 86_400_000;

export function toISODate(d: Date): ISODate {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function parseISODate(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) throw new Error(`Invalid date: ${s}`);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (toISODate(d) !== s.trim()) throw new Error(`Invalid date: ${s}`);
  return d;
}

export function isISODate(s: unknown): s is ISODate {
  if (typeof s !== "string") return false;
  try {
    parseISODate(s);
    return true;
  } catch {
    return false;
  }
}

export function addDays(s: ISODate, n: number): ISODate {
  return toISODate(new Date(parseISODate(s).getTime() + n * DAY_MS));
}

/** 0 = Sunday ... 6 = Saturday (JS convention). */
export function dayOfWeek(s: ISODate): number {
  return parseISODate(s).getUTCDay();
}

/** First day of the week containing `s`. `weekStartsOn` uses JS convention (1 = Monday, 0 = Sunday). */
export function startOfWeek(s: ISODate, weekStartsOn = 1): ISODate {
  const diff = (dayOfWeek(s) - weekStartsOn + 7) % 7;
  return addDays(s, -diff);
}

export function weekDays(start: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function isWeekend(s: ISODate): boolean {
  const d = dayOfWeek(s);
  return d === 0 || d === 6;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function shortDay(s: ISODate): string {
  return DAYS[dayOfWeek(s)]!;
}

/** "24 Aug" */
export function shortDate(s: ISODate): string {
  const d = parseISODate(s);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "Mon 24 Aug 2026" */
export function longDate(s: ISODate): string {
  const d = parseISODate(s);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const DASH = " – ";

/** "24 – 30 Aug 2026", "31 Aug – 6 Sep 2026", "29 Dec 2025 – 4 Jan 2026". */
export function weekLabel(start: ISODate): string {
  const a = parseISODate(start);
  const b = parseISODate(addDays(start, 6));
  const sameMonth = a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear();
  const sameYear = a.getUTCFullYear() === b.getUTCFullYear();
  if (sameMonth) return `${a.getUTCDate()}${DASH}${b.getUTCDate()} ${MONTHS[a.getUTCMonth()]} ${a.getUTCFullYear()}`;
  if (sameYear) return `${a.getUTCDate()} ${MONTHS[a.getUTCMonth()]}${DASH}${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]} ${a.getUTCFullYear()}`;
  return `${a.getUTCDate()} ${MONTHS[a.getUTCMonth()]} ${a.getUTCFullYear()}${DASH}${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]} ${b.getUTCFullYear()}`;
}

/** ISO-8601 week number (weeks start Monday, week 1 contains 4 January). */
export function isoWeekNumber(s: ISODate): number {
  const d = parseISODate(s);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const diff = (d.getTime() - firstThursday.getTime()) / DAY_MS;
  return 1 + Math.round((diff - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

export function monthBounds(s: ISODate): { from: ISODate; to: ISODate } {
  const d = parseISODate(s);
  const from = toISODate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
  const to = toISODate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
  return { from, to };
}

/** "Aug 2026" */
export function monthLabel(s: ISODate): string {
  const d = parseISODate(s);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Inclusive list of dates between two ISO dates (from <= to). */
export function eachDay(from: ISODate, to: ISODate): ISODate[] {
  const a = parseISODate(from).getTime();
  const b = parseISODate(to).getTime();
  if (b < a) return [];
  const out: ISODate[] = [];
  for (let t = a; t <= b; t += DAY_MS) out.push(toISODate(new Date(t)));
  return out;
}
