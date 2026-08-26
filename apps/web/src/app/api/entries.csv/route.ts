import { toCsv } from "@timefly/core";
import { getPrincipal } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { parseParams, reportRows } from "@/lib/report";

/** Every entry in the period with its note — the "what did we do on that request" export. */
export async function GET(req: Request) {
  const me = await getPrincipal();
  if (!me) return new Response("Unauthorized", { status: 401 });
  const p = parseParams(Object.fromEntries(new URL(req.url).searchParams));
  const rows = await reportRows(me, p);
  const csv = toCsv(
    ["date", "person", "team", "code", "project", "type", "task", "hours", "notes"],
    rows.map((r) => [r.date, r.person, r.team, r.code, r.project, r.kind, r.task, r.hours, r.notes]),
  );
  await logActivity(me, { action: "entries.export", category: "report", after: { ...p, rows: rows.length } });
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="entries-${p.from}-${p.to}.csv"` } });
}
