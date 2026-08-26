/**
 * Worker: the three scheduled jobs, in one long-running process (Container Apps job / compose service).
 *  - json-backup  daily 03:00   every table → gzip JSON in BACKUP_DIR (mounted volume → blob/rsync offsite)
 *  - reminders    weekdays HH   notify anyone with nothing logged on the previous working day
 *  - week-lock    Mondays 06:00 submit-and-lock open timesheets older than lockAfterDays (0 = off)
 * Run once with `--once <job>` for a manual trigger.
 */
import { createWriteStream, mkdirSync } from "node:fs";
import { createGzip } from "node:zlib";
import { addDays, isWeekend, startOfWeek, toISODate } from "@timefly/core";
import { db, schema } from "@timefly/db";
import { and, eq, gte, lte, sql } from "drizzle-orm";

const TZ = process.env.APP_TZ ?? "Asia/Kuala_Lumpur";
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const hourNow = () => Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(new Date()));

async function settings() {
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, "timesheets")).limit(1);
  return { weekStartsOn: 1 as 0 | 1, dayTarget: 8, workingDays: [1, 2, 3, 4, 5], approvals: true, reminderHour: 17, lockAfterDays: 14, holidays: [] as string[], ...((row?.value as object) ?? {}) };
}

async function ran(name: string, fn: () => Promise<string>) {
  const started = Date.now();
  try {
    const detail = await fn();
    await db.update(schema.systemJobs).set({ lastRunAt: new Date(), lastStatus: "ok", lastDurationMs: Date.now() - started, detail }).where(eq(schema.systemJobs.name, name));
    console.log(`[${name}] ok · ${detail}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.update(schema.systemJobs).set({ lastRunAt: new Date(), lastStatus: "error", lastDurationMs: Date.now() - started, detail: msg.slice(0, 200) }).where(eq(schema.systemJobs.name, name));
    console.error(`[${name}] error · ${msg}`);
  }
  await db.insert(schema.activityLog).values({ actorName: "worker", actorType: "system", action: `job.${name}`, category: "system", release: process.env.APP_VERSION ?? "dev" });
}

export async function jsonBackup(): Promise<string> {
  const dir = process.env.BACKUP_DIR ?? "./backups";
  mkdirSync(dir, { recursive: true });
  const file = `${dir}/timefly-${new Date().toISOString().replace(/[:.]/g, "-")}.json.gz`;
  const gz = createGzip();
  const out = createWriteStream(file);
  gz.pipe(out);
  const tables = ["teams", "people", "tasks", "projects", "assignments", "time_entries", "timesheets", "saved_reports", "notifications", "settings", "activity_log", "releases", "system_jobs"];
  let rows = 0;
  gz.write("{");
  for (let i = 0; i < tables.length; i++) {
    const t = tables[i]!;
    const data = (await db.execute(sql.raw(`select * from ${t}`))) as unknown as unknown[];
    rows += data.length;
    gz.write(`${i ? "," : ""}${JSON.stringify(t)}:${JSON.stringify(data)}`);
  }
  gz.write("}");
  await new Promise<void>((res, rej) => {
    out.on("finish", () => res());
    out.on("error", rej);
    gz.end();
  });
  return `${rows.toLocaleString()} rows → ${file}`;
}

export async function reminders(): Promise<string> {
  const s = await settings();
  const d = today();
  let prev = addDays(d, -1);
  while (isWeekend(prev) || s.holidays.includes(prev) || !s.workingDays.includes(new Date(prev).getUTCDay())) prev = addDays(prev, -1);
  const people = await db.select({ id: schema.people.id }).from(schema.people).where(eq(schema.people.status, "active"));
  const logged = new Set(((await db.execute(sql`select distinct person_id from time_entries where date = ${prev}`)) as unknown as { person_id: number }[]).map((r) => r.person_id));
  const already = new Set(((await db.execute(sql`select person_id from notifications where kind = 'reminder' and created_at::date = current_date`)) as unknown as { person_id: number }[]).map((r) => r.person_id));
  const targets = people.filter((p) => !logged.has(p.id) && !already.has(p.id));
  if (targets.length) await db.insert(schema.notifications).values(targets.map((p) => ({ personId: p.id, kind: "reminder", title: `Nothing logged for ${prev}`, body: "Add yesterday's hours before your manager reviews the week.", href: `/time?week=${startOfWeek(prev, s.weekStartsOn)}` })));
  return `${targets.length} reminders for ${prev}`;
}

export async function weekLock(): Promise<string> {
  const s = await settings();
  if (!s.lockAfterDays) return "disabled (lockAfterDays = 0)";
  const cutoff = addDays(startOfWeek(today(), s.weekStartsOn), -s.lockAfterDays);
  const rows = await db.update(schema.timesheets).set({ status: "submitted", submittedAt: new Date(), note: "Auto-submitted by week-lock" }).where(and(lte(schema.timesheets.weekStart, cutoff), sql`status in ('open','reopened')`)).returning({ id: schema.timesheets.id });
  void gte;
  return `${rows.length} timesheets locked (weeks ≤ ${cutoff})`;
}

const JOBS: Record<string, () => Promise<string>> = { "json-backup": jsonBackup, reminders, "week-lock": weekLock };

async function main() {
  const once = process.argv.indexOf("--once");
  if (once >= 0) {
    const name = process.argv[once + 1] ?? "";
    if (!JOBS[name]) throw new Error(`Unknown job ${name}. One of: ${Object.keys(JOBS).join(", ")}`);
    await ran(name, JOBS[name]!);
    process.exit(0);
  }
  console.log(`worker up · tz ${TZ}`);
  const last: Record<string, string> = {};
  for (;;) {
    const d = today();
    const h = hourNow();
    const s = await settings();
    const key = (name: string) => `${name}:${d}`;
    if (h === 3 && last["json-backup"] !== key("json-backup")) (last["json-backup"] = key("json-backup")), await ran("json-backup", jsonBackup);
    if (h === s.reminderHour && !isWeekend(d) && last.reminders !== key("reminders")) (last.reminders = key("reminders")), await ran("reminders", reminders);
    if (h === 6 && new Date(d).getUTCDay() === s.weekStartsOn && last["week-lock"] !== key("week-lock")) (last["week-lock"] = key("week-lock")), await ran("week-lock", weekLock);
    await new Promise((r) => setTimeout(r, 5 * 60_000));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
void toISODate;
