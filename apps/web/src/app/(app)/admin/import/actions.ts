"use server";

import { db, schema } from "@timefly/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { harvestEnv, importFromHarvest } from "@/lib/harvest";

export async function runHarvestImport(formData: FormData) {
  const me = await requireAdmin();
  const env = harvestEnv();
  if (!env) redirect("/admin/import?error=Harvest+is+not+configured");
  const updatedSince = String(formData.get("updatedSince") ?? "").trim() || undefined;
  const started = Date.now();
  try {
    const r = await importFromHarvest(env, { updatedSince });
    await logActivity(me, { action: "harvest.import", category: "integration", targetType: "harvest", targetId: env.accountId, after: { ...r, updatedSince: updatedSince ?? null, ms: Date.now() - started } });
    await db.update(schema.systemJobs).set({ lastRunAt: new Date(), lastStatus: "ok", lastDurationMs: Date.now() - started, detail: `${r.entries.toLocaleString()} entries · ${r.users} users · ${r.projects} projects${r.skipped ? ` · ${r.skipped} skipped` : ""}` }).where(eq(schema.systemJobs.name, "harvest-sync"));
    revalidatePath("/", "layout");
    redirect(`/admin/import?done=${encodeURIComponent(`${r.entries} entries, ${r.users} users, ${r.projects} projects, ${r.tasks} tasks${r.skipped ? `, ${r.skipped} skipped` : ""}`)}`);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e; // Next redirect
    const msg = e instanceof Error ? e.message : String(e);
    await logActivity(me, { action: "harvest.import.failed", category: "integration", targetType: "harvest", targetId: env.accountId, after: { error: msg } });
    await db.update(schema.systemJobs).set({ lastRunAt: new Date(), lastStatus: "error", lastDurationMs: Date.now() - started, detail: msg.slice(0, 200) }).where(eq(schema.systemJobs.name, "harvest-sync"));
    redirect(`/admin/import?error=${encodeURIComponent(msg.slice(0, 200))}`);
  }
}
