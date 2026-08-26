"use server";

import { db, schema } from "@timefly/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function createProject(formData: FormData) {
  const me = await requireManager();
  const kind = (["project", "work_request", "internal"].includes(str(formData, "kind")) ? str(formData, "kind") : "project") as "project" | "work_request" | "internal";
  let code = str(formData, "code").toUpperCase();
  if (!code) {
    const prefix = kind === "work_request" ? "WR" : kind === "internal" ? "INT" : "PRJ";
    const [n] = (await db.execute(`select count(*)::int as n from projects where kind = '${kind}'`)) as unknown as { n: number }[];
    code = `${prefix}-${new Date().getFullYear()}-${String((n?.n ?? 0) + 1).padStart(2, "0")}`;
  }
  const name = str(formData, "name");
  if (!name) throw new Error("Name is required");
  const budget = Number(str(formData, "budgetHours"));
  const [row] = await db
    .insert(schema.projects)
    .values({ code, name, kind, status: "active", teamId: str(formData, "teamId") ? Number(str(formData, "teamId")) : me.teamId, ownerId: str(formData, "ownerId") ? Number(str(formData, "ownerId")) : me.id, clientName: str(formData, "clientName") || null, budgetHours: budget > 0 ? budget : null, startsOn: str(formData, "startsOn") || null, endsOn: str(formData, "endsOn") || null, ticketRef: str(formData, "ticketRef") || null, notes: str(formData, "notes") || null })
    .returning({ id: schema.projects.id });
  await logActivity(me, { action: "project.create", category: "project", targetType: "project", targetId: row!.id, after: { code, name, kind } });
  const assignees = formData.getAll("assignee").map(Number).filter(Boolean);
  if (assignees.length) {
    await db.insert(schema.assignments).values(assignees.map((personId) => ({ projectId: row!.id, personId, assignedById: me.id }))).onConflictDoNothing();
    await logActivity(me, { action: "assignment.add", category: "project", targetType: "project", targetId: row!.id, after: { people: assignees } });
  }
  revalidatePath("/projects");
  redirect(`/projects/${row!.id}`);
}

export async function updateProject(id: number, formData: FormData) {
  const me = await requireManager();
  const [before] = await db.select().from(schema.projects).where(eq(schema.projects.id, id)).limit(1);
  if (!before) return;
  const status = str(formData, "status") as "active" | "on_hold" | "completed" | "archived";
  const budget = Number(str(formData, "budgetHours"));
  const patch = { name: str(formData, "name") || before.name, status: ["active", "on_hold", "completed", "archived"].includes(status) ? status : before.status, budgetHours: budget > 0 ? budget : null, clientName: str(formData, "clientName") || null, startsOn: str(formData, "startsOn") || null, endsOn: str(formData, "endsOn") || null, ticketRef: str(formData, "ticketRef") || null, teamId: str(formData, "teamId") ? Number(str(formData, "teamId")) : null, ownerId: str(formData, "ownerId") ? Number(str(formData, "ownerId")) : null, notes: str(formData, "notes") || null, updatedAt: new Date() };
  await db.update(schema.projects).set(patch).where(eq(schema.projects.id, id));
  const changed: Record<string, unknown> = {};
  const prev: Record<string, unknown> = {};
  for (const k of Object.keys(patch) as (keyof typeof patch)[]) if (k !== "updatedAt" && String(patch[k] ?? "") !== String(before[k] ?? "")) (changed[k] = patch[k]), (prev[k] = before[k]);
  if (Object.keys(changed).length) await logActivity(me, { action: "project.update", category: "project", targetType: "project", targetId: id, before: prev, after: changed });
  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
}

export async function addAssignment(projectId: number, personId: number) {
  const me = await requireManager();
  await db.insert(schema.assignments).values({ projectId, personId, assignedById: me.id }).onConflictDoNothing();
  await logActivity(me, { action: "assignment.add", category: "project", targetType: "project", targetId: projectId, after: { personId } });
  const [p] = await db.select({ code: schema.projects.code, name: schema.projects.name }).from(schema.projects).where(eq(schema.projects.id, projectId)).limit(1);
  if (p) await db.insert(schema.notifications).values({ personId, kind: "assigned", title: `Assigned to ${p.code} · ${p.name}`, body: `${me.displayName} added you. It now appears in your timesheet picker.`, href: `/projects/${projectId}` });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/time");
}

export async function removeAssignment(projectId: number, personId: number) {
  const me = await requireManager();
  await db.delete(schema.assignments).where(and(eq(schema.assignments.projectId, projectId), eq(schema.assignments.personId, personId)));
  await logActivity(me, { action: "assignment.remove", category: "project", targetType: "project", targetId: projectId, before: { personId } });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/time");
}
