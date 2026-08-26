"use server";

import { db, schema, type ReportParams } from "@timefly/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requirePrincipal } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function saveReport(params: ReportParams, formData: FormData) {
  const me = await requirePrincipal();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const shared = formData.get("shared") === "on" && me.role !== "member";
  const [row] = await db.insert(schema.savedReports).values({ ownerId: me.id, name, params, shared }).returning({ id: schema.savedReports.id });
  await logActivity(me, { action: "report.save", category: "report", targetType: "saved_report", targetId: row!.id, after: { name, shared, params } });
  revalidatePath("/reports");
}

export async function deleteReport(id: number) {
  const me = await requirePrincipal();
  await db.delete(schema.savedReports).where(and(eq(schema.savedReports.id, id), me.role === "admin" ? undefined : eq(schema.savedReports.ownerId, me.id)));
  await logActivity(me, { action: "report.delete", category: "report", targetType: "saved_report", targetId: id });
  revalidatePath("/reports");
}
