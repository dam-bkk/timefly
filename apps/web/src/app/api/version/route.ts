import { db } from "@timefly/db";
import { sql } from "drizzle-orm";
import { APP_ENV, APP_VERSION } from "@/lib/auth";

/** Health + version — what the reverse proxy and the status page poll. */
export async function GET() {
  const started = Date.now();
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, version: APP_VERSION, env: APP_ENV, sha: process.env.GIT_SHA ?? "local", dbMs: Date.now() - started });
  } catch (e) {
    return Response.json({ ok: false, version: APP_VERSION, env: APP_ENV, error: e instanceof Error ? e.message : String(e) }, { status: 503 });
  }
}
