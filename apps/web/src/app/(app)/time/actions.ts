"use server";

import { db, schema } from "@timefly/db";
import { addDays, canApprove, canEditEntries, canReopen, canSubmit, canTransition, dayStates, roundHours, startOfWeek, weekDays, type TimesheetStatus } from "@timefly/core";
import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { canSee, requirePrincipal, todayISO, type Principal } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { dayTargetFor, personById, timesheetFor } from "@/lib/queries";

export type SavedCell = { id: number; hours: number; notes: string | null; timerStartedAt: string | null } | null;

async function guard(me: Principal, personId: number, date: string) {
  const target = await personById(personId);
  if (!target || !canSee(me, target)) throw new Error("Not allowed");
  const settings = await getSettings();
  const weekStart = startOfWeek(date, settings.weekStartsOn);
  const sheet = await timesheetFor(personId, weekStart);
  if (!canEditEntries(sheet.status, me.role, me.id === personId)) throw new Error(`Timesheet is ${sheet.status}`);
  return { sheet, weekStart, settings, target };
}

function revalidate(personId: number) {
  revalidatePath("/time");
  revalidatePath("/team");
  revalidatePath(`/people/${personId}`);
}

/**
 * Upsert one grid cell. The grid works on one entry per (person, project, task, date); imported duplicates are
 * merged into the first one on the first edit. Empty hours + empty notes deletes the entry.
 */
export async function saveCell(input: { personId: number; projectId: number; taskId: number; date: string; hours: number | null; notes?: string | null }): Promise<SavedCell> {
  const me = await requirePrincipal();
  const { settings } = await guard(me, input.personId, input.date);
  const key = and(eq(schema.timeEntries.personId, input.personId), eq(schema.timeEntries.projectId, input.projectId), eq(schema.timeEntries.taskId, input.taskId), eq(schema.timeEntries.date, input.date));
  const existing = await db.select().from(schema.timeEntries).where(key).orderBy(asc(schema.timeEntries.id));
  const first = existing[0];
  const hours = input.hours === null ? null : roundHours(Math.max(0, input.hours), settings.roundTo);
  const notes = input.notes === undefined ? (first ? existing.map((e) => e.notes).filter(Boolean).join(" · ") || null : null) : (input.notes?.trim() || null);
  if (existing.length > 1) await db.delete(schema.timeEntries).where(inArray(schema.timeEntries.id, existing.slice(1).map((e) => e.id)));
  if ((hours === null || hours === 0) && !notes) {
    if (first) {
      await db.delete(schema.timeEntries).where(eq(schema.timeEntries.id, first.id));
      await logActivity(me, { action: "entry.delete", category: "timesheet", targetType: "time_entry", targetId: first.id, before: { hours: first.hours, notes: first.notes, date: input.date, personId: input.personId } });
    }
    revalidate(input.personId);
    return null;
  }
  if (first) {
    const before = { hours: existing.reduce((a, e) => a + e.hours, 0), notes: first.notes };
    const h = hours ?? before.hours;
    await db.update(schema.timeEntries).set({ hours: h, notes, updatedAt: new Date() }).where(eq(schema.timeEntries.id, first.id));
    if (before.hours !== h || before.notes !== notes) await logActivity(me, { action: "entry.update", category: "timesheet", targetType: "time_entry", targetId: first.id, before, after: { hours: h, notes, date: input.date, personId: input.personId } });
    revalidate(input.personId);
    return { id: first.id, hours: h, notes, timerStartedAt: first.timerStartedAt?.toISOString() ?? null };
  }
  const [row] = await db.insert(schema.timeEntries).values({ personId: input.personId, projectId: input.projectId, taskId: input.taskId, date: input.date, hours: hours ?? 0, notes }).returning();
  await logActivity(me, { action: "entry.create", category: "timesheet", targetType: "time_entry", targetId: row!.id, after: { hours: hours ?? 0, notes, date: input.date, personId: input.personId, projectId: input.projectId, taskId: input.taskId } });
  revalidate(input.personId);
  return { id: row!.id, hours: row!.hours, notes: row!.notes, timerStartedAt: null };
}

/** Remove every entry of a grid row for the week. */
export async function deleteRow(input: { personId: number; weekStart: string; projectId: number; taskId: number }) {
  const me = await requirePrincipal();
  await guard(me, input.personId, input.weekStart);
  const rows = await db.delete(schema.timeEntries).where(and(eq(schema.timeEntries.personId, input.personId), eq(schema.timeEntries.projectId, input.projectId), eq(schema.timeEntries.taskId, input.taskId), gte(schema.timeEntries.date, input.weekStart), lte(schema.timeEntries.date, addDays(input.weekStart, 6)))).returning({ id: schema.timeEntries.id, hours: schema.timeEntries.hours });
  if (rows.length) await logActivity(me, { action: "entry.delete_row", category: "timesheet", targetType: "time_entry", before: { ids: rows.map((r) => r.id), hours: rows.reduce((a, r) => a + r.hours, 0), personId: input.personId, weekStart: input.weekStart } });
  revalidate(input.personId);
}

/** The rows (project × task) used in the most recent week that has entries — added to the grid empty. */
export async function rowsFromLastWeek(input: { personId: number; weekStart: string }): Promise<{ projectId: number; taskId: number }[]> {
  const me = await requirePrincipal();
  const target = await personById(input.personId);
  if (!target || !canSee(me, target)) throw new Error("Not allowed");
  for (let back = 1; back <= 4; back++) {
    const ws = addDays(input.weekStart, -7 * back);
    const rows = await db.selectDistinct({ projectId: schema.timeEntries.projectId, taskId: schema.timeEntries.taskId }).from(schema.timeEntries).where(and(eq(schema.timeEntries.personId, input.personId), gte(schema.timeEntries.date, ws), lte(schema.timeEntries.date, addDays(ws, 6))));
    if (rows.length) return rows;
  }
  return [];
}

export async function submitWeek(input: { personId: number; weekStart: string }) {
  const me = await requirePrincipal();
  const target = await personById(input.personId);
  if (!target || !canSee(me, target)) throw new Error("Not allowed");
  const sheet = await timesheetFor(input.personId, input.weekStart);
  if (!canSubmit(sheet.status, me.role, me.id === input.personId) || !canTransition(sheet.status, "submitted")) throw new Error("Cannot submit");
  const settings = await getSettings();
  await db.update(schema.timesheets).set({ status: "submitted", submittedAt: new Date() }).where(eq(schema.timesheets.id, sheet.id));
  await logActivity(me, { action: "timesheet.submit", category: "timesheet", targetType: "timesheet", targetId: sheet.id, before: { status: sheet.status }, after: { status: "submitted", weekStart: input.weekStart, personId: input.personId } });
  // Clean week → approved without a manager click (setting). Clean = every working day has hours, total within contract +15%.
  if (settings.approvals && settings.autoApproveClean) {
    const days = weekDays(input.weekStart);
    const rows = await db.select({ date: schema.timeEntries.date, hours: schema.timeEntries.hours }).from(schema.timeEntries).where(and(eq(schema.timeEntries.personId, input.personId), gte(schema.timeEntries.date, input.weekStart), lte(schema.timeEntries.date, addDays(input.weekStart, 6))));
    const states = dayStates(days, rows, { today: addDays(input.weekStart, 7), target: dayTargetFor(target.weeklyHours, settings.workingDays), holidays: settings.holidays });
    const gaps = days.filter((d) => states[d] === "missing").length;
    const total = rows.reduce((a, r) => a + r.hours, 0);
    if (gaps === 0 && total <= target.weeklyHours * 1.15) {
      await db.update(schema.timesheets).set({ status: "approved", approvedAt: new Date(), approvedById: null, note: "Auto-approved: every working day logged, total within contract" }).where(eq(schema.timesheets.id, sheet.id));
      await logActivity(null, { action: "timesheet.auto_approve", category: "timesheet", targetType: "timesheet", targetId: sheet.id, after: { weekStart: input.weekStart, personId: input.personId, total } });
      await db.insert(schema.notifications).values({ personId: input.personId, kind: "approved", title: `Timesheet for w/c ${input.weekStart} approved automatically`, body: "Complete week, no gaps — nothing for your manager to do.", href: `/time?week=${input.weekStart}` });
      revalidate(input.personId);
      return;
    }
  }
  if (settings.approvals && target.managerId) await db.insert(schema.notifications).values({ personId: target.managerId, kind: "submitted", title: `${target.displayName} submitted w/c ${input.weekStart}`, href: `/time?person=${target.id}&week=${input.weekStart}` });
  revalidate(input.personId);
}

async function transition(me: Principal, timesheetId: number, to: TimesheetStatus, note?: string) {
  const [sheet] = await db.select().from(schema.timesheets).where(eq(schema.timesheets.id, timesheetId)).limit(1);
  if (!sheet) throw new Error("Not found");
  const target = await personById(sheet.personId);
  if (!target || !canSee(me, target)) throw new Error("Not allowed");
  const owner = me.id === sheet.personId;
  if (to === "approved" && !canApprove(sheet.status, me.role, owner)) throw new Error("Cannot approve");
  if (to === "reopened" && !canReopen(sheet.status, me.role)) throw new Error("Cannot reopen");
  if (!canTransition(sheet.status, to)) throw new Error(`Cannot move ${sheet.status} → ${to}`);
  await db
    .update(schema.timesheets)
    .set(to === "approved" ? { status: "approved", approvedById: me.actor?.id ?? me.id, approvedAt: new Date() } : { status: "reopened", reopenedAt: new Date(), note: note?.trim() || null, approvedAt: null, approvedById: null })
    .where(eq(schema.timesheets.id, sheet.id));
  await logActivity(me, { action: `timesheet.${to === "approved" ? "approve" : "reopen"}`, category: "timesheet", targetType: "timesheet", targetId: sheet.id, before: { status: sheet.status }, after: { status: to, weekStart: sheet.weekStart, person: target.displayName, note } });
  await db.insert(schema.notifications).values({ personId: sheet.personId, kind: to, title: `Timesheet for w/c ${sheet.weekStart} ${to}`, body: note?.trim() || null, href: `/time?week=${sheet.weekStart}` });
  revalidate(sheet.personId);
}

export async function approveWeek(timesheetId: number) {
  await transition(await requirePrincipal(), timesheetId, "approved");
}

/** Next person in my approval queue for this week (alphabetical), for "Approve & next". */
export async function nextAwaiting(input: { weekStart: string; afterPersonId: number }): Promise<{ personId: number; left: number } | null> {
  const me = await requirePrincipal();
  if (me.role === "member") return null;
  const rows = (await db.execute(sql`select t.person_id as id, p.display_name as name from timesheets t join people p on p.id = t.person_id
    where t.week_start = ${input.weekStart} and t.status = 'submitted' and p.status = 'active' and t.person_id <> ${input.afterPersonId}
    ${me.role === "admin" ? sql`` : sql`and (p.manager_id = ${me.id} or p.team_id = ${me.teamId ?? -1}) and p.id <> ${me.id}`}
    order by p.display_name`)) as unknown as { id: number; name: string }[];
  return rows[0] ? { personId: rows[0].id, left: rows.length } : null;
}

export async function reopenWeek(timesheetId: number, note: string) {
  await transition(await requirePrincipal(), timesheetId, "reopened", note);
}

/** Manager nudge: one notification, logged. Email/Teams delivery is the worker's job. */
export async function remind(input: { personId: number; weekStart: string; days: string[] }) {
  const me = await requirePrincipal();
  const target = await personById(input.personId);
  if (!target || !canSee(me, target) || me.role === "member") throw new Error("Not allowed");
  const what = input.days.length ? `Nothing logged for ${input.days.length} day${input.days.length > 1 ? "s" : ""} in w/c ${input.weekStart}` : `Please submit your timesheet for w/c ${input.weekStart}`;
  await db.insert(schema.notifications).values({ personId: input.personId, kind: "reminder", title: what, body: `${me.displayName} asked you to complete it.`, href: `/time?week=${input.weekStart}` });
  await logActivity(me, { action: "timesheet.remind", category: "timesheet", targetType: "person", targetId: input.personId, after: { weekStart: input.weekStart, days: input.days } });
  revalidate(input.personId);
}

/** Bulk nudge: one notification per person, one log line. Skips anyone already reminded today for this week. */
export async function remindMany(input: { personIds: number[]; weekStart: string }): Promise<{ sent: number; skipped: number }> {
  const me = await requirePrincipal();
  if (me.role === "member") throw new Error("Not allowed");
  const settings = await getSettings();
  const today = todayISO();
  const days = weekDays(input.weekStart);
  const people = (await db.select().from(schema.people).where(inArray(schema.people.id, input.personIds))).filter((p) => canSee(me, p));
  if (!people.length) return { sent: 0, skipped: 0 };
  const already = new Set(((await db.execute(sql`select person_id from notifications where kind = 'reminder' and created_at::date = current_date and href like ${`%week=${input.weekStart}%`} and person_id in ${people.map((p) => p.id)}`)) as unknown as { person_id: number }[]).map((r) => r.person_id));
  const totals = (await db.execute(sql`select person_id, date::text as date, sum(hours)::float as hours from time_entries where person_id in ${people.map((p) => p.id)} and date between ${input.weekStart} and ${addDays(input.weekStart, 6)} group by person_id, date`)) as unknown as { person_id: number; date: string; hours: number }[];
  const rows: (typeof schema.notifications.$inferInsert)[] = [];
  for (const p of people) {
    if (already.has(p.id)) continue;
    const mine = totals.filter((t) => t.person_id === p.id).map((t) => ({ date: t.date, hours: t.hours }));
    const states = dayStates(days, mine, { today, target: dayTargetFor(p.weeklyHours, settings.workingDays), holidays: settings.holidays });
    const gaps = days.filter((d) => states[d] === "missing" && d < today);
    const what = gaps.length ? `Nothing logged for ${gaps.length} day${gaps.length > 1 ? "s" : ""} in w/c ${input.weekStart}` : `Please submit your timesheet for w/c ${input.weekStart}`;
    rows.push({ personId: p.id, kind: "reminder", title: what, body: `${me.displayName} asked you to complete it.`, href: `/time?week=${input.weekStart}` });
  }
  if (rows.length) await db.insert(schema.notifications).values(rows);
  await logActivity(me, { action: "timesheet.remind_bulk", category: "timesheet", targetType: "week", targetId: input.weekStart, after: { sent: rows.map((r) => r.personId), skippedAlreadyReminded: [...already] } });
  revalidatePath("/team");
  return { sent: rows.length, skipped: already.size };
}

/** Bulk approve every submitted week in the list the manager is allowed to approve. */
export async function approveMany(timesheetIds: number[]): Promise<{ approved: number }> {
  const me = await requirePrincipal();
  if (me.role === "member") throw new Error("Not allowed");
  const sheets = await db.select().from(schema.timesheets).where(and(inArray(schema.timesheets.id, timesheetIds), eq(schema.timesheets.status, "submitted")));
  const people = await db.select().from(schema.people).where(inArray(schema.people.id, sheets.map((s) => s.personId)));
  const ok = sheets.filter((s) => {
    const t = people.find((p) => p.id === s.personId);
    return t && canSee(me, t) && canApprove(s.status, me.role, me.id === s.personId);
  });
  if (!ok.length) return { approved: 0 };
  const now = new Date();
  await db.update(schema.timesheets).set({ status: "approved", approvedById: me.actor?.id ?? me.id, approvedAt: now }).where(inArray(schema.timesheets.id, ok.map((s) => s.id)));
  await db.insert(schema.notifications).values(ok.map((s) => ({ personId: s.personId, kind: "approved", title: `Timesheet for w/c ${s.weekStart} approved`, href: `/time?week=${s.weekStart}` })));
  await logActivity(me, { action: "timesheet.approve_bulk", category: "timesheet", targetType: "timesheet", after: { ids: ok.map((s) => s.id), people: ok.map((s) => people.find((p) => p.id === s.personId)?.displayName) } });
  revalidatePath("/team");
  revalidatePath("/time");
  return { approved: ok.length };
}

export async function startTimer(input: { personId: number; projectId: number; taskId: number; date: string }): Promise<SavedCell> {
  const me = await requirePrincipal();
  if (me.id !== input.personId) throw new Error("Timers are personal");
  await guard(me, input.personId, input.date);
  // One running timer per person: stop any other first.
  const running = await db.select().from(schema.timeEntries).where(and(eq(schema.timeEntries.personId, me.id), eq(schema.timeEntries.date, input.date)));
  for (const r of running) if (r.timerStartedAt) await stopTimer(r.id);
  const key = and(eq(schema.timeEntries.personId, input.personId), eq(schema.timeEntries.projectId, input.projectId), eq(schema.timeEntries.taskId, input.taskId), eq(schema.timeEntries.date, input.date));
  const [existing] = await db.select().from(schema.timeEntries).where(key).orderBy(asc(schema.timeEntries.id)).limit(1);
  const now = new Date();
  const row = existing
    ? (await db.update(schema.timeEntries).set({ timerStartedAt: now }).where(eq(schema.timeEntries.id, existing.id)).returning())[0]!
    : (await db.insert(schema.timeEntries).values({ personId: input.personId, projectId: input.projectId, taskId: input.taskId, date: input.date, hours: 0, timerStartedAt: now }).returning())[0]!;
  await logActivity(me, { action: "timer.start", category: "timesheet", targetType: "time_entry", targetId: row.id });
  revalidate(input.personId);
  return { id: row.id, hours: row.hours, notes: row.notes, timerStartedAt: now.toISOString() };
}

export async function stopTimer(entryId: number): Promise<SavedCell> {
  const me = await requirePrincipal();
  const [e] = await db.select().from(schema.timeEntries).where(eq(schema.timeEntries.id, entryId)).limit(1);
  if (!e || e.personId !== me.id) throw new Error("Not allowed");
  if (!e.timerStartedAt) return { id: e.id, hours: e.hours, notes: e.notes, timerStartedAt: null };
  const settings = await getSettings();
  const elapsed = (Date.now() - e.timerStartedAt.getTime()) / 3_600_000;
  const hours = Math.min(24, Math.round((e.hours + elapsed) * 100) / 100);
  const rounded = roundHours(hours, settings.roundTo);
  const final = rounded === 0 && hours > 0 ? settings.roundTo : rounded;
  await db.update(schema.timeEntries).set({ hours: final, timerStartedAt: null, updatedAt: new Date() }).where(eq(schema.timeEntries.id, e.id));
  await logActivity(me, { action: "timer.stop", category: "timesheet", targetType: "time_entry", targetId: e.id, before: { hours: e.hours }, after: { hours: final } });
  revalidate(me.id);
  return { id: e.id, hours: final, notes: e.notes, timerStartedAt: null };
}
