import Link from "next/link";
import { db, schema } from "@timefly/db";
import { addDays, formatHours, monthBounds, startOfWeek } from "@timefly/core";
import { asc, desc, eq, or, sql } from "drizzle-orm";
import { Download, Trash2 } from "lucide-react";
import { requirePrincipal, todayISO } from "@/lib/auth";
import { DIMENSIONS, parseParams, runReport, toQuery } from "@/lib/report";
import { teamsList } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Topbar } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { Toggle } from "@/components/ui/input";
import { deleteReport, saveReport } from "./actions";

export const metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const me = await requirePrincipal();
  const p = parseParams(sp);
  const today = todayISO();
  const { rows, table, settings } = await runReport(me, p);
  const fmt = (h: number) => formatHours(h, settings.hoursFormat, { zero: "–" });
  const [teams, projects, people, saved] = await Promise.all([
    teamsList(),
    db.select({ id: schema.projects.id, code: schema.projects.code, name: schema.projects.name }).from(schema.projects).orderBy(asc(schema.projects.code)),
    me.role === "member" ? Promise.resolve([]) : db.select({ id: schema.people.id, displayName: schema.people.displayName }).from(schema.people).where(eq(schema.people.status, "active")).orderBy(asc(schema.people.displayName)),
    db.select().from(schema.savedReports).where(or(eq(schema.savedReports.ownerId, me.id), eq(schema.savedReports.shared, true))).orderBy(desc(schema.savedReports.createdAt)),
  ]);
  const thisWeek = startOfWeek(today, settings.weekStartsOn);
  const month = monthBounds(today);
  const lastMonth = monthBounds(addDays(month.from, -1));
  const presets: [string, string, string][] = [
    ["This week", thisWeek, addDays(thisWeek, 6)],
    ["Last week", addDays(thisWeek, -7), addDays(thisWeek, -1)],
    ["This month", month.from, month.to],
    ["Last month", lastMonth.from, lastMonth.to],
    ["Last 90 days", addDays(today, -89), today],
  ];
  const query = toQuery(p);
  const distinctPeople = new Set(rows.map((r) => r.personId)).size;
  const capacity = await capacityFor(me, p, settings.workingDays.length);
  void sql;

  return (
    <>
      <Topbar
        crumbs={[{ label: "Reports" }]}
        actions={
          <>
            <a href={`/api/report.csv?${query}`} className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium text-ink hairline hover:bg-surface-2">
              <Download className="size-3.5" /> Table CSV
            </a>
            <a href={`/api/entries.csv?${query}`} className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium text-ink hairline hover:bg-surface-2">
              <Download className="size-3.5" /> Entries CSV
            </a>
          </>
        }
      />
      <div className="flex min-h-0 flex-1">
        <aside className="w-[260px] shrink-0 overflow-y-auto bg-surface px-4 py-4 hairline-r">
          <form className="space-y-3" method="get">
            <p className="label">Period</p>
            <div className="flex flex-wrap gap-1">
              {presets.map(([label, from, to]) => (
                <Link key={label} href={`/reports?${toQuery({ ...p, from, to })}`} className={cn("rounded-md px-2 py-1 text-[12px] font-medium hairline hover:bg-surface-2", p.from === from && p.to === to && "bg-accent-soft text-accent-ink")}>
                  {label}
                </Link>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" name="from" defaultValue={p.from} className="h-8 rounded-md bg-surface px-2 text-[12.5px] hairline" />
              <input type="date" name="to" defaultValue={p.to} className="h-8 rounded-md bg-surface px-2 text-[12.5px] hairline" />
            </div>
            <p className="label pt-2">Rows</p>
            <select name="rows" defaultValue={p.rows} className="h-8 w-full rounded-md bg-surface px-2 text-[13px] hairline">
              {DIMENSIONS.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
            <p className="label pt-2">Columns</p>
            <select name="cols" defaultValue={p.cols} className="h-8 w-full rounded-md bg-surface px-2 text-[13px] hairline">
              <option value="none">Just totals</option>
              {DIMENSIONS.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
            <p className="label pt-2">Filters</p>
            {me.role !== "member" && (
              <select name="team" defaultValue={p.teamId ?? ""} className="h-8 w-full rounded-md bg-surface px-2 text-[13px] hairline">
                <option value="">Any team</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
            <select name="project" defaultValue={p.projectId ?? ""} className="h-8 w-full rounded-md bg-surface px-2 text-[13px] hairline">
              <option value="">Any project / request</option>
              {projects.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.code} · {x.name}
                </option>
              ))}
            </select>
            {me.role !== "member" && (
              <select name="person" defaultValue={p.personId ?? ""} className="h-8 w-full rounded-md bg-surface px-2 text-[13px] hairline">
                <option value="">Anyone</option>
                {people.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.displayName}
                  </option>
                ))}
              </select>
            )}
            <select name="kind" defaultValue={p.kind ?? ""} className="h-8 w-full rounded-md bg-surface px-2 text-[13px] hairline">
              <option value="">Any type</option>
              <option value="project">Projects</option>
              <option value="work_request">Work requests</option>
              <option value="internal">Internal</option>
            </select>
            <Button type="submit" variant="primary" className="w-full">
              Run report
            </Button>
          </form>

          <div className="mt-6">
            <p className="label">Saved views</p>
            <ul className="mt-2 space-y-0.5">
              {saved.length === 0 && <li className="text-[12px] text-ink-3">Save the current report below to get back to it in one click.</li>}
              {saved.map((s) => (
                <li key={s.id} className="group flex items-center gap-1">
                  <Link href={`/reports?${toQuery(s.params)}`} className="min-w-0 flex-1 truncate rounded-md px-2 py-1 text-[13px] hover:bg-surface-2">
                    {s.name}
                    {s.shared && <span className="ml-1 text-[10.5px] text-ink-3">shared</span>}
                  </Link>
                  {(s.ownerId === me.id || me.role === "admin") && (
                    <form action={deleteReport.bind(null, s.id)}>
                      <button className="inline-flex size-6 items-center justify-center rounded text-ink-4 opacity-0 hover:bg-crit-soft hover:text-crit group-hover:opacity-100" title="Delete">
                        <Trash2 className="size-3.5" />
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
            <form action={saveReport.bind(null, p)} className="mt-3 space-y-2">
              <input name="name" placeholder="Name this view…" className="h-8 w-full rounded-md bg-surface px-2.5 text-[13px] hairline focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--accent)]" required />
              {me.role !== "member" && <Toggle name="shared" label="Share with everyone" />}
              <Button type="submit" size="sm" className="w-full">
                Save view
              </Button>
            </form>
          </div>
        </aside>

        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1240px] space-y-3 px-6 py-4 rise">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px]">
              <span className="text-[26px] font-semibold leading-none tracking-[-0.02em] tnum">{formatHours(table.grand, settings.hoursFormat, { zero: "0" })} h</span>
              <span className="text-ink-3">
                {rows.length.toLocaleString()} entries · {distinctPeople} {distinctPeople === 1 ? "person" : "people"} · {p.from} → {p.to}
              </span>
              {capacity > 0 && (
                <span className="text-ink-3">
                  · {Math.round((table.grand / capacity) * 100)}% of {formatHours(capacity, settings.hoursFormat)} h capacity
                </span>
              )}
            </div>
            {table.rows.length === 0 ? (
              <div className="panel">
                <Empty title="No hours in this period" hint="Widen the dates or loosen the filters." />
              </div>
            ) : (
              <div className="panel overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-left text-ink-3">
                        <th className="sticky left-0 z-10 bg-surface px-4 py-2.5 font-medium hairline-b">{DIMENSIONS.find(([k]) => k === p.rows)?.[1]}</th>
                        {p.cols !== "none" &&
                          table.cols.map((c) => (
                            <th key={c} className="max-w-[160px] truncate px-3 py-2.5 text-right font-medium hairline-b" title={c}>
                              {c}
                            </th>
                          ))}
                        <th className="px-4 py-2.5 text-right font-medium hairline-b">Total</th>
                        <th className="w-28 px-4 py-2.5 hairline-b" />
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.map((r) => (
                        <tr key={r} className="row hairline-b">
                          <td className="sticky left-0 z-10 max-w-[280px] truncate bg-surface px-4 py-2 font-medium" title={r}>
                            {r}
                          </td>
                          {p.cols !== "none" &&
                            table.cols.map((c) => (
                              <td key={c} className={cn("tnum px-3 py-2 text-right", table.cell(r, c) === 0 && "text-ink-4")}>
                                {fmt(table.cell(r, c))}
                              </td>
                            ))}
                          <td className="tnum px-4 py-2 text-right font-semibold">{fmt(table.rowTotal(r))}</td>
                          <td className="px-4 py-2">
                            <span className="bar">
                              <i style={{ width: `${Math.round((table.rowTotal(r) / (table.grand || 1)) * 100)}%` }} />
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="font-semibold">
                        <td className="sticky left-0 z-10 bg-surface px-4 py-2.5">Total</td>
                        {p.cols !== "none" &&
                          table.cols.map((c) => (
                            <td key={c} className="tnum px-3 py-2.5 text-right">
                              {fmt(table.colTotal(c))}
                            </td>
                          ))}
                        <td className="tnum px-4 py-2.5 text-right">{fmt(table.grand)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
            <p className="text-[12px] text-ink-3">
              {me.role === "member" ? "You see your own hours. " : me.role === "manager" ? "You see your team. " : ""}
              Entries CSV includes every note — the audit-ready version of “what did we do on that request”.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

/** Capacity for the period: working days × day target, summed over the visible people (for the utilisation line). */
async function capacityFor(me: { id: number; role: string; teamId: number | null }, p: { from: string; to: string; teamId?: number | null; personId?: number | null }, workingDays: number) {
  const [r] = (await db.execute(sql`select coalesce(sum(weekly_hours),0)::float as h from people where status = 'active'
    ${me.role === "member" ? sql`and id = ${me.id}` : me.role === "manager" ? sql`and (manager_id = ${me.id} or team_id = ${me.teamId ?? -1} or id = ${me.id})` : sql``}
    ${p.teamId ? sql`and team_id = ${p.teamId}` : sql``} ${p.personId ? sql`and id = ${p.personId}` : sql``}`)) as unknown as { h: number }[];
  const [d] = (await db.execute(sql`select count(*)::int as n from generate_series(${p.from}::date, ${p.to}::date, '1 day') g where extract(isodow from g) <= 5`)) as unknown as { n: number }[];
  return Math.round(((r?.h ?? 0) / workingDays) * (d?.n ?? 0));
}
