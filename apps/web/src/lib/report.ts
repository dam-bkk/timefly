import "server-only";
import { db, schema, type ReportParams } from "@timefly/db";
import { isISODate, monthBounds, monthLabel, pivot, startOfWeek, weekLabel } from "@timefly/core";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { todayISO, type Principal } from "./auth";
import { getSettings } from "./settings";

export const DIMENSIONS: [string, string][] = [["person", "Person"], ["project", "Project / request"], ["task", "Task"], ["team", "Team"], ["kind", "Type"], ["week", "Week"], ["month", "Month"], ["date", "Day"]];

export type ReportRow = { id: number; date: string; hours: number; notes: string | null; personId: number; person: string; teamId: number | null; team: string; projectId: number; project: string; code: string; kind: string; task: string };

export function parseParams(sp: Record<string, string | undefined>): ReportParams {
  const today = todayISO();
  const { from: mf, to: mt } = monthBounds(today);
  const dims = DIMENSIONS.map(([k]) => k);
  return {
    from: sp.from && isISODate(sp.from) ? sp.from : mf,
    to: sp.to && isISODate(sp.to) ? sp.to : mt,
    rows: sp.rows && dims.includes(sp.rows) ? sp.rows : "person",
    cols: sp.cols && (dims.includes(sp.cols) || sp.cols === "none") ? sp.cols : "week",
    teamId: sp.team ? Number(sp.team) || null : null,
    projectId: sp.project ? Number(sp.project) || null : null,
    personId: sp.person ? Number(sp.person) || null : null,
    kind: sp.kind && ["project", "work_request", "internal"].includes(sp.kind) ? sp.kind : null,
  };
}

export function toQuery(p: ReportParams): string {
  const q = new URLSearchParams({ from: p.from, to: p.to, rows: p.rows, cols: p.cols });
  if (p.teamId) q.set("team", String(p.teamId));
  if (p.projectId) q.set("project", String(p.projectId));
  if (p.personId) q.set("person", String(p.personId));
  if (p.kind) q.set("kind", p.kind);
  return q.toString();
}

/** Raw rows in range with visibility applied: members see themselves, managers their team, admins everyone. */
export async function reportRows(me: Principal, p: ReportParams): Promise<ReportRow[]> {
  const conds = [gte(schema.timeEntries.date, p.from), lte(schema.timeEntries.date, p.to)];
  if (me.role === "member") conds.push(eq(schema.timeEntries.personId, me.id));
  else if (me.role === "manager") conds.push(sql`(${schema.people.managerId} = ${me.id} or ${schema.people.teamId} = ${me.teamId ?? -1} or ${schema.people.id} = ${me.id})`);
  if (p.teamId) conds.push(eq(schema.people.teamId, p.teamId));
  if (p.projectId) conds.push(eq(schema.timeEntries.projectId, p.projectId));
  if (p.personId) conds.push(eq(schema.timeEntries.personId, p.personId));
  if (p.kind) conds.push(eq(schema.projects.kind, p.kind as "project"));
  const rows = await db
    .select({ id: schema.timeEntries.id, date: schema.timeEntries.date, hours: schema.timeEntries.hours, notes: schema.timeEntries.notes, personId: schema.people.id, person: schema.people.displayName, teamId: schema.people.teamId, team: schema.teams.name, projectId: schema.projects.id, project: schema.projects.name, code: schema.projects.code, kind: schema.projects.kind, task: schema.tasks.name })
    .from(schema.timeEntries)
    .innerJoin(schema.people, eq(schema.people.id, schema.timeEntries.personId))
    .leftJoin(schema.teams, eq(schema.teams.id, schema.people.teamId))
    .innerJoin(schema.projects, eq(schema.projects.id, schema.timeEntries.projectId))
    .innerJoin(schema.tasks, eq(schema.tasks.id, schema.timeEntries.taskId))
    .where(and(...conds))
    .orderBy(schema.timeEntries.date, schema.timeEntries.id);
  return rows.map((r) => ({ ...r, team: r.team ?? "No team" }));
}

const KIND: Record<string, string> = { project: "Project", work_request: "Work request", internal: "Internal" };

export function keyOf(r: ReportRow, dim: string, weekStartsOn: 0 | 1): string {
  switch (dim) {
    case "person":
      return r.person;
    case "project":
      return `${r.code} · ${r.project}`;
    case "task":
      return r.task;
    case "team":
      return r.team;
    case "kind":
      return KIND[r.kind] ?? r.kind;
    case "week":
      return weekLabel(startOfWeek(r.date, weekStartsOn));
    case "month":
      return monthLabel(r.date);
    case "date":
      return r.date;
    default:
      return "Hours";
  }
}

const CHRONO = new Set(["week", "month", "date"]);

export async function runReport(me: Principal, p: ReportParams) {
  const settings = await getSettings();
  const rows = await reportRows(me, p);
  // Chronological dims sort by the first date seen for the key; the rest by total (pivot default) or name.
  const firstDate = new Map<string, string>();
  for (const r of rows) {
    for (const dim of [p.rows, p.cols]) {
      const k = keyOf(r, dim, settings.weekStartsOn);
      if (!firstDate.has(k) || firstDate.get(k)! > r.date) firstDate.set(k, r.date);
    }
  }
  const chrono = (a: string, b: string) => (firstDate.get(a) ?? "").localeCompare(firstDate.get(b) ?? "");
  const table = pivot(
    rows,
    (r) => keyOf(r, p.rows, settings.weekStartsOn),
    (r) => keyOf(r, p.cols, settings.weekStartsOn),
    (r) => r.hours,
    { rows: CHRONO.has(p.rows) ? chrono : undefined, cols: CHRONO.has(p.cols) ? chrono : (a, b) => a.localeCompare(b) },
  );
  return { rows, table, settings };
}
