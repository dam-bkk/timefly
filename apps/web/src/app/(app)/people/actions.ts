"use server";

import { db, schema } from "@timefly/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function updatePerson(id: number, formData: FormData) {
  const me = await requireAdmin();
  const [before] = await db.select().from(schema.people).where(eq(schema.people.id, id)).limit(1);
  if (!before) return;
  const role = String(formData.get("role") ?? before.role) as "member" | "manager" | "admin";
  const status = String(formData.get("status") ?? before.status) as "active" | "left";
  const teamId = String(formData.get("teamId") ?? "") ? Number(formData.get("teamId")) : null;
  const managerId = String(formData.get("managerId") ?? "") ? Number(formData.get("managerId")) : null;
  const weeklyHours = Number(formData.get("weeklyHours")) || before.weeklyHours;
  const jobTitle = String(formData.get("jobTitle") ?? "").trim() || null;
  const patch = { role, status, teamId, managerId, weeklyHours, jobTitle };
  await db.update(schema.people).set(patch).where(eq(schema.people.id, id));
  const changed: Record<string, unknown> = {};
  const prev: Record<string, unknown> = {};
  for (const k of Object.keys(patch) as (keyof typeof patch)[]) if (String(patch[k] ?? "") !== String(before[k] ?? "")) (changed[k] = patch[k]), (prev[k] = before[k]);
  if (Object.keys(changed).length) await logActivity(me, { action: "person.update", category: "person", targetType: "person", targetId: id, before: prev, after: changed });
  revalidatePath(`/people/${id}`);
  revalidatePath("/people");
}
