import "server-only";
import { db, schema } from "@timefly/db";
import { eq, sql } from "drizzle-orm";

/**
 * Harvest API v2 importer. Read-only against Harvest; idempotent here (matches on harvest_id).
 * Needs a personal access token + account id (Harvest → Developers). Rate limit: 100 req / 15 s — we page slowly.
 * Docs: https://help.getharvest.com/api-v2/
 */
type Env = { accountId: string; token: string };

const BASE = "https://api.harvestapp.com/v2";

async function* pages<T>(env: Env, path: string, key: string, params: Record<string, string> = {}): AsyncGenerator<T[]> {
  let page = 1;
  for (;;) {
    const q = new URLSearchParams({ ...params, page: String(page), per_page: "100" });
    const res = await fetch(`${BASE}${path}?${q}`, { headers: { Authorization: `Bearer ${env.token}`, "Harvest-Account-Id": env.accountId, "User-Agent": "TimeFly importer (it@qi.example)" } });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 15_000));
      continue;
    }
    if (!res.ok) throw new Error(`Harvest ${path} → ${res.status} ${await res.text()}`);
    const body = (await res.json()) as Record<string, unknown> & { total_pages: number };
    yield body[key] as T[];
    if (page >= body.total_pages) return;
    page++;
    await new Promise((r) => setTimeout(r, 200));
  }
}

type HUser = { id: number; first_name: string; last_name: string; email: string; is_active: boolean; weekly_capacity: number; roles: string[] };
type HClient = { id: number; name: string };
type HProject = { id: number; name: string; code: string | null; is_active: boolean; budget: number | null; starts_on: string | null; ends_on: string | null; notes: string | null; client: { id: number; name: string } };
type HTask = { id: number; name: string; is_active: boolean };
type HEntry = { id: number; spent_date: string; hours: number; notes: string | null; is_running: boolean; user: { id: number }; project: { id: number }; task: { id: number }; updated_at: string };

export type ImportResult = { users: number; projects: number; tasks: number; entries: number; skipped: number };

export function harvestEnv(): Env | null {
  const accountId = process.env.HARVEST_ACCOUNT_ID;
  const token = process.env.HARVEST_TOKEN;
  return accountId && token ? { accountId, token } : null;
}

/** Full or delta (`updatedSince`) import. Everything lands with its harvest_id so re-runs update in place. */
export async function importFromHarvest(env: Env, opts: { updatedSince?: string; log?: (s: string) => void } = {}): Promise<ImportResult> {
  const log = opts.log ?? (() => {});
  const result: ImportResult = { users: 0, projects: 0, tasks: 0, entries: 0, skipped: 0 };

  // People — matched by email first (Entra identity), then created.
  const userMap = new Map<number, number>();
  for await (const batch of pages<HUser>(env, "/users", "users", { is_active: "true" })) {
    for (const u of batch) {
      const email = u.email.toLowerCase();
      const [existing] = await db.select({ id: schema.people.id }).from(schema.people).where(sql`lower(email) = ${email} or harvest_id = ${u.id}`).limit(1);
      const role = u.roles?.some((r) => /manager|lead|head/i.test(r)) ? "manager" : "member";
      const weeklyHours = u.weekly_capacity ? Math.round((u.weekly_capacity / 3600) * 10) / 10 : 40;
      if (existing) {
        await db.update(schema.people).set({ harvestId: u.id, weeklyHours }).where(eq(schema.people.id, existing.id));
        userMap.set(u.id, existing.id);
      } else {
        const [row] = await db.insert(schema.people).values({ email, displayName: `${u.first_name} ${u.last_name}`.trim(), role, weeklyHours, harvestId: u.id, status: u.is_active ? "active" : "left" }).returning({ id: schema.people.id });
        userMap.set(u.id, row!.id);
      }
      result.users++;
    }
    log(`users: ${result.users}`);
  }

  // Tasks
  const taskMap = new Map<number, number>();
  for await (const batch of pages<HTask>(env, "/tasks", "tasks")) {
    for (const t of batch) {
      const [existing] = await db.select({ id: schema.tasks.id }).from(schema.tasks).where(sql`harvest_id = ${t.id} or lower(name) = ${t.name.toLowerCase()}`).limit(1);
      if (existing) {
        await db.update(schema.tasks).set({ harvestId: t.id, active: t.is_active }).where(eq(schema.tasks.id, existing.id));
        taskMap.set(t.id, existing.id);
      } else {
        const [row] = await db.insert(schema.tasks).values({ name: t.name, active: t.is_active, harvestId: t.id, sortOrder: 100 + result.tasks }).returning({ id: schema.tasks.id });
        taskMap.set(t.id, row!.id);
      }
      result.tasks++;
    }
  }

  // Clients are folded into projects.client_name
  const clients = new Map<number, string>();
  for await (const batch of pages<HClient>(env, "/clients", "clients")) for (const c of batch) clients.set(c.id, c.name);

  // Projects → kind guessed from the code (SR-/INC- = work request), status from is_active
  const projectMap = new Map<number, number>();
  for await (const batch of pages<HProject>(env, "/projects", "projects")) {
    for (const p of batch) {
      const code = (p.code?.trim() || `HV-${p.id}`).toUpperCase();
      const kind = /^(SR|INC|WR)-/.test(code) ? "work_request" : /^INT-|internal|leave|meeting/i.test(`${code} ${p.name}`) ? "internal" : "project";
      const values = { code, name: p.name, kind: kind as "project" | "work_request" | "internal", status: (p.is_active ? "active" : "completed") as "active" | "completed", clientName: clients.get(p.client.id) ?? p.client.name, budgetHours: p.budget ?? null, startsOn: p.starts_on, endsOn: p.ends_on, notes: p.notes, harvestId: p.id, ticketRef: /^(SR|INC)-/.test(code) ? code : null, updatedAt: new Date() };
      const [existing] = await db.select({ id: schema.projects.id }).from(schema.projects).where(sql`harvest_id = ${p.id} or code = ${code}`).limit(1);
      if (existing) {
        await db.update(schema.projects).set(values).where(eq(schema.projects.id, existing.id));
        projectMap.set(p.id, existing.id);
      } else {
        const [row] = await db.insert(schema.projects).values(values).returning({ id: schema.projects.id });
        projectMap.set(p.id, row!.id);
      }
      result.projects++;
    }
    log(`projects: ${result.projects}`);
  }

  // User assignments → assignments
  for (const [hid, pid] of projectMap) {
    for await (const batch of pages<{ user: { id: number }; is_active: boolean }>(env, `/projects/${hid}/user_assignments`, "user_assignments")) {
      const rows = batch.filter((a) => a.is_active && userMap.has(a.user.id)).map((a) => ({ projectId: pid, personId: userMap.get(a.user.id)! }));
      if (rows.length) await db.insert(schema.assignments).values(rows).onConflictDoNothing();
    }
  }

  // Time entries — the bulk. updated_since gives the delta on the cut-over day.
  for await (const batch of pages<HEntry>(env, "/time_entries", "time_entries", opts.updatedSince ? { updated_since: opts.updatedSince } : {})) {
    const values = batch
      .map((e) => {
        const personId = userMap.get(e.user.id);
        const projectId = projectMap.get(e.project.id);
        const taskId = taskMap.get(e.task.id);
        if (!personId || !projectId || !taskId) {
          result.skipped++;
          return null;
        }
        return { personId, projectId, taskId, date: e.spent_date, hours: e.hours, notes: e.notes, harvestId: e.id, updatedAt: new Date(e.updated_at) };
      })
      .filter((v): v is NonNullable<typeof v> => !!v);
    if (values.length) {
      await db
        .insert(schema.timeEntries)
        .values(values)
        .onConflictDoNothing();
      // Re-runs: update rows that already exist (harvest_id is not unique-indexed to keep imports cheap; do it in SQL).
      for (const v of values) await db.execute(sql`update time_entries set hours = ${v.hours}, notes = ${v.notes}, date = ${v.date} where harvest_id = ${v.harvestId} and (hours <> ${v.hours} or coalesce(notes,'') <> coalesce(${v.notes},'') or date <> ${v.date})`);
      result.entries += values.length;
    }
    log(`entries: ${result.entries}`);
  }

  await db
    .insert(schema.settings)
    .values({ key: "harvest", value: { accountId: env.accountId, lastImportAt: new Date().toISOString(), imported: { users: result.users, projects: result.projects, tasks: result.tasks, entries: result.entries } } })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value: { accountId: env.accountId, lastImportAt: new Date().toISOString(), imported: { users: result.users, projects: result.projects, tasks: result.tasks, entries: result.entries } }, updatedAt: new Date() } });
  return result;
}
