import { db, schema } from "@timefly/db";
import { toCsv } from "@timefly/core";
import { desc, eq } from "drizzle-orm";
import { getPrincipal } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function GET(req: Request) {
  const me = await getPrincipal();
  if (!me || me.role !== "admin") return new Response("Forbidden", { status: 403 });
  const category = new URL(req.url).searchParams.get("category") || undefined;
  const rows = await db
    .select()
    .from(schema.activityLog)
    .where(category ? eq(schema.activityLog.category, category) : undefined)
    .orderBy(desc(schema.activityLog.ts))
    .limit(20_000);
  await logActivity(me, { action: "activity.export", category: "settings", after: { rows: rows.length, category: category ?? null } });
  const csv = toCsv(
    ["ts", "actor", "actor_type", "action", "category", "target_type", "target_id", "before", "after", "ip", "user_agent", "request_id", "release"],
    rows.map((r) => [r.ts.toISOString(), r.actorName, r.actorType, r.action, r.category, r.targetType, r.targetId, r.before ? JSON.stringify(r.before) : "", r.after ? JSON.stringify(r.after) : "", r.ip, r.userAgent, r.requestId, r.release]),
  );
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="activity-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
