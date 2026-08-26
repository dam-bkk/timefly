import "server-only";
import { db, schema } from "@timefly/db";
import { addDays, dayStates, isISODate, startOfWeek, weekDays, type DayState, type ISODate } from "@timefly/core";
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { todayISO, type Principal } from "./auth";
import { getSettings } from "./settings";

/** Resolve `?week=` (any date inside the week) to the week's first day, days and today. */
export async function weekContext(weekParam?: string | string[]) {
  const settings = await getSettings();
  const today = todayISO();
  const raw = Array.isArray(weekParam) ? weekParam[0] : weekParam;
  const anchor = raw && isISODate(raw) ? raw : today;
  const weekStart = startOfWeek(anchor, settings.weekStartsOn);
  return { settings, today, weekStart, days: weekDays(weekStart), prev: addDays(weekStart, -7), next: addDays(weekStart, 7), isCurrent: weekStart === startOfWeek(today, settings.weekStartsOn) };
}

export type EntryRow = {
  id: number;
  personId: number;
  projectId: number;
  taskId: number;
  date: string;
  hours: number;
  notes: string | null;
  timerStartedAt: Date | null;
  projectCode: string;
  projectName: string;
  projectKind: "project" | "work_request" | "internal";
  taskName: string;
};

export async function entriesForWeek(personId: number, weekStart: ISODate): Promise<EntryRow[]> {
  const end = addDays(weekStart, 6);
  return db
    .select({
      id: schema.timeEntries.id,
      personId: schema.timeEntries.personId,
      projectId: schema.timeEntries.projectId,
      taskId: schema.timeEntries.taskId,
      date: schema.timeEntries.date,
      hours: schema.timeEntries.hours,
      notes: schema.timeEntries.notes,
      timerStartedAt: schema.timeEntries.timerStartedAt,
      projectCode: schema.projects.code,
      projectName: schema.projects.name,
      projectKind: schema.projects.kind,
      taskName: schema.tasks.name,
    })
    .from(schema.timeEntries)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.timeEntries.projectId))
    .innerJoin(schema.tasks, eq(schema.tasks.id, schema.timeEntries.taskId))
    .where(and(eq(schema.timeEntries.personId, personId), gte(schema.timeEntries.date, weekStart), lte(schema.timeEntries.date, end)))
    .orderBy(asc(schema.timeEntries.id));
}

/** Get-or-create the timesheet row for a person × week. */
export async function timesheetFor(personId: number, weekStart: ISODate) {
  const [existing] = await db.select().from(schema.timesheets).where(and(eq(schema.timesheets.personId, personId), eq(schema.timesheets.weekStart, weekStart))).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(schema.timesheets).values({ personId, weekStart, status: "open" }).onConflictDoNothing().returning();
  if (created) return created;
  const [again] = await db.select().from(schema.timesheets).where(and(eq(schema.timesheets.personId, personId), eq(schema.timesheets.weekStart, weekStart))).limit(1);
  return again!;
}

export type ProjectOption = { id: number; code: string; name: string; kind: "project" | "work_request" | "internal"; status: string; assigned: boolean };

/** Projects a person may log against: their assignments (any status, so history stays editable) + every active project/internal item. */
export async function projectOptions(personId: number): Promise<ProjectOption[]> {
  const assigned = new Set((await db.select({ p: schema.assignments.projectId }).from(schema.assignments).where(eq(schema.assignments.personId, personId))).map((x) => x.p));
  const rows = await db.select({ id: schema.projects.id, code: schema.projects.code, name: schema.projects.name, kind: schema.projects.kind, status: schema.projects.status }).from(schema.projects).where(inArray(schema.projects.status, ["active", "on_hold", "completed"])).orderBy(asc(schema.projects.kind), asc(schema.projects.code));
  return rows
    .filter((r) => assigned.has(r.id) || r.status === "active")
    .map((r) => ({ ...r, assigned: assigned.has(r.id) }))
    .sort((a, b) => Number(b.assigned) - Number(a.assigned) || (a.kind === "internal" ? 1 : 0) - (b.kind === "internal" ? 1 : 0) || a.code.localeCompare(b.code));
}

export async function taskOptions() {
  return db.select({ id: schema.tasks.id, name: schema.tasks.name, active: schema.tasks.active }).from(schema.tasks).orderBy(asc(schema.tasks.sortOrder));
}

export async function personById(id: number) {
  const [p] = await db.select().from(schema.people).where(eq(schema.people.id, id)).limit(1);
  return p ?? null;
}

export function dayTargetFor(weeklyHours: number, workingDays: number[]): number {
  return Math.round((weeklyHours / Math.max(1, workingDays.length)) * 100) / 100;
}

/** The people a principal manages (admins: everyone active). */
export async function reports(me: Principal, teamId?: number | null) {
  const where = me.role === "admin" ? (teamId ? eq(schema.people.teamId, teamId) : undefined) : sql`(${schema.people.managerId} = ${me.id} or ${schema.people.teamId} = ${me.teamId ?? -1}) and ${schema.people.id} <> ${me.id}`;
  return db
    .select({ id: schema.people.id, displayName: schema.people.displayName, jobTitle: schema.people.jobTitle, role: schema.people.role, teamId: schema.people.teamId, managerId: schema.people.managerId, weeklyHours: schema.people.weeklyHours, status: schema.people.status })
    .from(schema.people)
    .where(where ? and(eq(schema.people.status, "active"), where) : eq(schema.people.status, "active"))
    .orderBy(asc(schema.people.displayName));
}

export type TeamWeekRow = { person: { id: number; displayName: string; jobTitle: string | null; teamId: number | null; weeklyHours: number }; byDay: Record<string, number>; total: number; states: Record<string, DayState>; missing: number; missingDays: string[]; remindedAt: Date | null; sheet: { id: number; status: "open" | "submitted" | "approved" | "reopened"; submittedAt: Date | null; approvedAt: Date | null } | null };

/** One row per person for the manager's week view. */
export async function teamWeek(me: Principal, weekStart: ISODate, teamId?: number | null): Promise<TeamWeekRow[]> {
  const settings = await getSettings();
  const today = todayISO();
  const days = weekDays(weekStart);
  const ppl = await reports(me, teamId);
  if (!ppl.length) return [];
  const ids = ppl.map((p) => p.id);
  const totals = (await db.execute(sql`select person_id, date::text as date, sum(hours)::float as hours from time_entries where person_id in ${ids} and date between ${weekStart} and ${addDays(weekStart, 6)} group by person_id, date`)) as unknown as { person_id: number; date: string; hours: number }[];
  const sheets = await db.select({ id: schema.timesheets.id, personId: schema.timesheets.personId, status: schema.timesheets.status, submittedAt: schema.timesheets.submittedAt, approvedAt: schema.timesheets.approvedAt }).from(schema.timesheets).where(and(inArray(schema.timesheets.personId, ids), eq(schema.timesheets.weekStart, weekStart)));
  const reminded = (await db.execute(sql`select person_id, max(created_at) as at from notifications where kind = 'reminder' and person_id in ${ids} and href like ${`%week=${weekStart}%`} group by person_id`)) as unknown as { person_id: number; at: Date }[];
  return ppl.map((p) => {
    const mine = totals.filter((t) => t.person_id === p.id);
    const byDay: Record<string, number> = {};
    for (const t of mine) byDay[t.date] = Math.round(t.hours * 100) / 100;
    const entries = mine.map((t) => ({ date: t.date, hours: t.hours }));
    const states = dayStates(days, entries, { today, target: dayTargetFor(p.weeklyHours, settings.workingDays), holidays: settings.holidays });
    const sheet = sheets.find((s) => s.personId === p.id) ?? null;
    return { person: { id: p.id, displayName: p.displayName, jobTitle: p.jobTitle, teamId: p.teamId, weeklyHours: p.weeklyHours }, byDay, total: Math.round(mine.reduce((a, t) => a + t.hours, 0) * 100) / 100, states, missing: days.filter((d) => states[d] === "missing").length, missingDays: days.filter((d) => states[d] === "missing"), remindedAt: (() => { const r = reminded.find((x) => x.person_id === p.id); return r ? new Date(r.at) : null; })(), sheet: sheet ? { id: sheet.id, status: sheet.status, submittedAt: sheet.submittedAt, approvedAt: sheet.approvedAt } : null };
  });
}

export async function teamsList() {
  return db.select().from(schema.teams).orderBy(asc(schema.teams.id));
}

export type ProjectListRow = { id: number; code: string; name: string; kind: "project" | "work_request" | "internal"; status: string; teamId: number | null; teamName: string | null; ownerName: string | null; clientName: string | null; budgetHours: number | null; ticketRef: string | null; people: number; hours: number; hoursMonth: number; updatedAt: Date };

export async function projectList(monthFrom: ISODate, monthTo: ISODate): Promise<ProjectListRow[]> {
  const rows = (await db.execute(sql`
    select p.id, p.code, p.name, p.kind, p.status, p.team_id as "teamId", t.name as "teamName", o.display_name as "ownerName", p.client_name as "clientName", p.budget_hours as "budgetHours", p.ticket_ref as "ticketRef", p.updated_at as "updatedAt",
      (select count(*) from assignments a where a.project_id = p.id)::int as people,
      coalesce((select sum(hours) from time_entries e where e.project_id = p.id), 0)::float as hours,
      coalesce((select sum(hours) from time_entries e where e.project_id = p.id and e.date between ${monthFrom} and ${monthTo}), 0)::float as "hoursMonth"
    from projects p left join teams t on t.id = p.team_id left join people o on o.id = p.owner_id
    order by p.kind, p.status = 'active' desc, p.code`)) as unknown as ProjectListRow[];
  return rows.map((r) => ({ ...r, hours: Math.round(r.hours * 100) / 100, hoursMonth: Math.round(r.hoursMonth * 100) / 100 }));
}

export async function listJobs() {
  return db.select().from(schema.systemJobs).orderBy(asc(schema.systemJobs.id));
}

export async function dbStats() {
  const [r] = (await db.execute(sql`select
    (select count(*) from time_entries)::int as entries,
    (select count(*) from time_entries where harvest_id is not null)::int as imported,
    (select coalesce(sum(hours),0) from time_entries)::float as hours,
    (select count(*) from people where status = 'active')::int as people,
    (select count(*) from projects)::int as projects,
    (select count(*) from timesheets)::int as timesheets,
    (select count(*) from activity_log)::int as activity,
    pg_size_pretty(pg_database_size(current_database())) as size`)) as unknown as { entries: number; imported: number; hours: number; people: number; projects: number; timesheets: number; activity: number; size: string }[];
  return r!;
}

export async function unreadCount(personId: number) {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.notifications).where(and(eq(schema.notifications.personId, personId), isNull(schema.notifications.readAt)));
  return r?.n ?? 0;
}

export async function recentActivity(limit = 200, category?: string) {
  return db
    .select()
    .from(schema.activityLog)
    .where(category ? eq(schema.activityLog.category, category) : undefined)
    .orderBy(desc(schema.activityLog.ts))
    .limit(limit);
}

/** Missing working days for one person in a week (sidebar badge, banner). */
export async function missingFor(personId: number, weeklyHours: number, weekStart: ISODate) {
  const settings = await getSettings();
  const today = todayISO();
  const days = weekDays(weekStart);
  const rows = await db.select({ date: schema.timeEntries.date, hours: schema.timeEntries.hours }).from(schema.timeEntries).where(and(eq(schema.timeEntries.personId, personId), gte(schema.timeEntries.date, weekStart), lte(schema.timeEntries.date, addDays(weekStart, 6))));
  const states = dayStates(days, rows, { today, target: dayTargetFor(weeklyHours, settings.workingDays), holidays: settings.holidays });
  return days.filter((d) => states[d] === "missing" && d < today);
}
