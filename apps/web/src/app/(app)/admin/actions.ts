"use server";

import { db, schema, type Settings } from "@timefly/db";
import { asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { DEFAULT_SETTINGS, getSettings } from "@/lib/settings";

export async function updateSettings(formData: FormData) {
  const me = await requireAdmin();
  const before = await getSettings();
  const workingDays = formData.getAll("workingDays").map(Number).filter((d) => d >= 0 && d <= 6);
  const next: Settings = {
    weekStartsOn: formData.get("weekStartsOn") === "0" ? 0 : 1,
    dayTarget: Math.min(24, Math.max(1, Number(formData.get("dayTarget")) || DEFAULT_SETTINGS.dayTarget)),
    workingDays: workingDays.length ? workingDays.sort() : DEFAULT_SETTINGS.workingDays,
    approvals: formData.get("approvals") === "on",
    hoursFormat: formData.get("hoursFormat") === "clock" ? "clock" : "decimal",
    roundTo: [0, 0.05, 0.1, 0.25, 0.5].includes(Number(formData.get("roundTo"))) ? Number(formData.get("roundTo")) : DEFAULT_SETTINGS.roundTo,
    reminderHour: Math.min(23, Math.max(0, Number(formData.get("reminderHour")) || DEFAULT_SETTINGS.reminderHour)),
    lockAfterDays: Math.max(0, Number(formData.get("lockAfterDays")) || 0),
    holidays: String(formData.get("holidays") ?? "")
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s))
      .sort(),
  };
  await db.insert(schema.settings).values({ key: "timesheets", value: next }).onConflictDoUpdate({ target: schema.settings.key, set: { value: next, updatedAt: new Date() } });
  const changed: Record<string, unknown> = {};
  const prev: Record<string, unknown> = {};
  for (const k of Object.keys(next) as (keyof Settings)[]) if (JSON.stringify(next[k]) !== JSON.stringify(before[k])) (changed[k] = next[k]), (prev[k] = before[k]);
  if (Object.keys(changed).length) await logActivity(me, { action: "settings.update", category: "settings", targetType: "settings", targetId: "timesheets", before: prev, after: changed });
  revalidatePath("/", "layout");
}

export async function saveTask(formData: FormData) {
  const me = await requireAdmin();
  const id = Number(formData.get("id")) || null;
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!name) return;
  if (id) {
    const [before] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, id)).limit(1);
    await db.update(schema.tasks).set({ name, description }).where(eq(schema.tasks.id, id));
    await logActivity(me, { action: "task.update", category: "settings", targetType: "task", targetId: id, before: { name: before?.name, description: before?.description }, after: { name, description } });
  } else {
    const [max] = await db.select({ n: sql<number>`coalesce(max(sort_order), 0)::int` }).from(schema.tasks);
    const [row] = await db.insert(schema.tasks).values({ name, description, sortOrder: (max?.n ?? 0) + 1 }).returning({ id: schema.tasks.id });
    await logActivity(me, { action: "task.create", category: "settings", targetType: "task", targetId: row!.id, after: { name, description } });
  }
  revalidatePath("/admin/tasks");
  revalidatePath("/time");
}

export async function toggleTask(id: number) {
  const me = await requireAdmin();
  const [t] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, id)).limit(1);
  if (!t) return;
  await db.update(schema.tasks).set({ active: !t.active }).where(eq(schema.tasks.id, id));
  await logActivity(me, { action: t.active ? "task.retire" : "task.reactivate", category: "settings", targetType: "task", targetId: id, before: { active: t.active }, after: { active: !t.active } });
  revalidatePath("/admin/tasks");
  revalidatePath("/time");
}

export async function moveTask(id: number, dir: -1 | 1) {
  const me = await requireAdmin();
  const all = await db.select().from(schema.tasks).orderBy(asc(schema.tasks.sortOrder), asc(schema.tasks.id));
  const i = all.findIndex((t) => t.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= all.length) return;
  const a = all[i]!;
  const b = all[j]!;
  await db.update(schema.tasks).set({ sortOrder: j }).where(eq(schema.tasks.id, a.id));
  await db.update(schema.tasks).set({ sortOrder: i }).where(eq(schema.tasks.id, b.id));
  await logActivity(me, { action: "task.reorder", category: "settings", targetType: "task", targetId: id, after: { position: j } });
  revalidatePath("/admin/tasks");
}

export async function saveTeam(formData: FormData) {
  const me = await requireAdmin();
  const id = Number(formData.get("id")) || null;
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const leadId = Number(formData.get("leadId")) || null;
  if (!name) return;
  if (id) {
    await db.update(schema.teams).set({ name, description, leadId }).where(eq(schema.teams.id, id));
    await logActivity(me, { action: "team.update", category: "settings", targetType: "team", targetId: id, after: { name, description, leadId } });
  } else {
    const [row] = await db.insert(schema.teams).values({ name, description, leadId }).returning({ id: schema.teams.id });
    await logActivity(me, { action: "team.create", category: "settings", targetType: "team", targetId: row!.id, after: { name, description, leadId } });
  }
  revalidatePath("/admin/teams");
  revalidatePath("/people");
}
