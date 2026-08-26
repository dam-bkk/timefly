/**
 * Hours as people type them. A timesheet cell must accept whatever the developer writes:
 * "1.5", "1,5", "1:30", "1h30", "1h", "90m", "0.25", ".5", "8". Empty -> null (clears the cell).
 */

export function parseHours(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const s = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (!s) return null;
  let h: number | null = null;
  let m: RegExpExecArray | null;
  if ((m = /^(\d{1,2}):([0-5]?\d)$/.exec(s))) h = Number(m[1]) + Number(m[2]) / 60;
  else if ((m = /^(\d{1,2})h(?:([0-5]?\d)m?)?$/.exec(s))) h = Number(m[1]) + Number(m[2] ?? 0) / 60;
  else if ((m = /^(\d{1,3})m$/.exec(s))) h = Number(m[1]) / 60;
  else if ((m = /^(\d{0,2})(?:[.,](\d{1,2}))?$/.exec(s)) && (m[1] || m[2])) h = Number(`${m[1] || "0"}.${m[2] ?? "0"}`);
  if (h === null) return null;
  if (h > 24) return 24;
  return Math.round(h * 100) / 100;
}

/** Round to the nearest step (default quarter hour). */
export function roundHours(h: number, step = 0.25): number {
  if (step <= 0) return h;
  return Math.round(Math.round(h / step) * step * 100) / 100;
}

export type HoursFormat = "decimal" | "clock";

/** 1.5 -> "1.5" (decimal) or "1:30" (clock). Zero renders as "" so empty cells stay quiet. */
export function formatHours(h: number | null | undefined, format: HoursFormat = "decimal", opts: { zero?: string } = {}): string {
  const zero = opts.zero ?? "";
  if (h === null || h === undefined || h === 0) return zero;
  if (format === "clock") {
    const total = Math.round(h * 60);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }
  const fixed = (Math.round(h * 100) / 100).toFixed(2);
  return fixed.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

/** Sum with float noise removed. */
export function sumHours(values: (number | null | undefined)[]): number {
  return Math.round(values.reduce<number>((a, v) => a + (v ?? 0), 0) * 100) / 100;
}
