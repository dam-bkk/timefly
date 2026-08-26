import { toCsv } from "@timefly/core";
import { getPrincipal } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { DIMENSIONS, parseParams, runReport } from "@/lib/report";

/** The pivot table as CSV — same params as /reports. */
export async function GET(req: Request) {
  const me = await getPrincipal();
  if (!me) return new Response("Unauthorized", { status: 401 });
  const p = parseParams(Object.fromEntries(new URL(req.url).searchParams));
  const { table } = await runReport(me, p);
  const rowLabel = DIMENSIONS.find(([k]) => k === p.rows)?.[1] ?? p.rows;
  const cols = p.cols === "none" ? [] : table.cols;
  const csv = toCsv([rowLabel, ...cols, "Total"], [...table.rows.map((r) => [r, ...cols.map((c) => table.cell(r, c)), table.rowTotal(r)]), ["Total", ...cols.map((c) => table.colTotal(c)), table.grand]]);
  await logActivity(me, { action: "report.export", category: "report", after: { ...p, rows: table.rows.length } });
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="hours-${p.rows}-by-${p.cols}-${p.from}-${p.to}.csv"` } });
}
