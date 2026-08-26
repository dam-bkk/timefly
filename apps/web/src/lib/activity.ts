import "server-only";
import { db, schema } from "@timefly/db";
import { APP_VERSION, requestMeta, type Principal } from "./auth";

/** Every write in the app goes through here. Append-only by convention and by DB grants in prod. */
export async function logActivity(
  actor: Principal | null,
  entry: {
    action: string;
    category: "timesheet" | "project" | "person" | "settings" | "auth" | "integration" | "system" | "report";
    targetType?: string;
    targetId?: string | number;
    before?: unknown;
    after?: unknown;
  },
) {
  const meta = await requestMeta();
  await db.insert(schema.activityLog).values({
    actorId: actor?.actor?.id ?? actor?.id ?? null,
    actorName: actor?.actor ? `${actor.actor.displayName} (viewing as ${actor.displayName})` : (actor?.displayName ?? "system"),
    actorType: actor ? (actor.actor ? "admin-view-as" : "user") : "system",
    action: entry.action,
    category: entry.category,
    targetType: entry.targetType,
    targetId: entry.targetId === undefined ? null : String(entry.targetId),
    before: entry.before ?? null,
    after: entry.after ?? null,
    ip: meta.ip,
    userAgent: meta.userAgent,
    requestId: meta.requestId,
    release: APP_VERSION,
  });
}
