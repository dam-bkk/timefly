import Link from "next/link";
import { formatHours, shortDate, shortDay } from "@timefly/core";
import { requireManager } from "@/lib/auth";
import { dayTargetFor, teamWeek, teamsList, weekContext } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Topbar } from "@/components/shell/topbar";
import { WeekNav } from "@/components/shell/week-nav";
import { Avatar } from "@/components/ui/avatar";
import { Empty } from "@/components/ui/empty";
import { DAY_TONE, SheetPill } from "@/components/ui/pills";
import { Stat } from "@/components/ui/record";
import { RowActions } from "./row-actions";

export const metadata = { title: "Team" };

/**
 * The manager's screen: everyone I'm responsible for × the days of the week. The colour of a number is the
 * signal (red = nothing logged, amber = short); the right-hand column is the state of the week itself.
 */
export default async function TeamPage({ searchParams }: { searchParams: Promise<{ week?: string; team?: string }> }) {
  const sp = await searchParams;
  const me = await requireManager();
  const { settings, today, weekStart, days, prev, next, isCurrent } = await weekContext(sp.week);
  const teamId = sp.team ? Number(sp.team) : null;
  const [rows, teams] = await Promise.all([teamWeek(me, weekStart, teamId), me.role === "admin" ? teamsList() : Promise.resolve([])]);
  const notSubmitted = rows.filter((r) => !r.sheet || r.sheet.status === "open" || r.sheet.status === "reopened").length;
  const awaiting = rows.filter((r) => r.sheet?.status === "submitted").length;
  const gaps = rows.reduce((a, r) => a + days.filter((d) => r.states[d] === "missing" && d < today).length, 0);
  const total = Math.round(rows.reduce((a, r) => a + r.total, 0) * 100) / 100;
  const capacity = rows.reduce((a, r) => a + r.person.weeklyHours, 0);
  const fmt = (h: number) => formatHours(h, settings.hoursFormat, { zero: "–" });

  return (
    <>
      <Topbar crumbs={[{ label: "Team" }]} actions={<WeekNav weekStart={weekStart} prev={prev} next={next} isCurrent={isCurrent} />} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1280px] space-y-3 px-6 py-4 rise">
          <div className="flex flex-wrap items-center gap-3 text-[12.5px] text-ink-3">
            <span>
              {rows.length} {rows.length === 1 ? "person" : "people"}
              {me.role === "admin" ? " · all teams" : " · my team"}
            </span>
            {me.role === "admin" && teams.length > 0 && (
              <form className="ml-auto flex items-center gap-2">
                <input type="hidden" name="week" value={weekStart} />
                <select name="team" defaultValue={teamId ?? ""} className="h-8 rounded-md bg-surface px-2 text-[13px] text-ink hairline">
                  <option value="">All teams</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <button className="h-8 rounded-md px-2.5 text-[12.5px] font-medium text-ink-2 hairline hover:bg-surface-2">Filter</button>
              </form>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Missing days" value={String(gaps)} sub="working days with nothing logged" tone={gaps ? "crit" : "ok"} />
            <Stat label="Not submitted" value={String(notSubmitted)} sub={isCurrent ? "week still open" : "past the week end"} tone={!isCurrent && notSubmitted ? "warn" : undefined} />
            <Stat label="Awaiting approval" value={String(awaiting)} sub={settings.approvals ? "submitted, not yet approved" : "approvals are off"} tone={awaiting ? "warn" : undefined} />
            <Stat label="Hours logged" value={fmt(total)} sub={`of ${formatHours(capacity, settings.hoursFormat)} h capacity`} />
          </div>

          {rows.length === 0 ? (
            <div className="panel">
              <Empty title="No one reports to you yet" hint="People appear here when their manager or team is set to you." />
            </div>
          ) : (
            <div className="panel overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-[13px]">
                  <thead>
                    <tr className="text-left">
                      <th className="px-4 py-2.5 font-medium text-ink-3 hairline-b">Person</th>
                      {days.map((d) => (
                        <th key={d} className={cn("w-[74px] px-2 py-2 text-center font-medium hairline-b", d === today && "bg-accent-soft/50")}>
                          <span className="flex flex-col leading-tight">
                            <span className={cn("text-[11px] uppercase tracking-[0.04em]", d === today ? "text-accent-ink" : "text-ink-3")}>{shortDay(d)}</span>
                            <span className={cn("text-[12.5px]", d === today && "font-semibold text-accent-ink")}>{shortDate(d)}</span>
                          </span>
                        </th>
                      ))}
                      <th className="w-[84px] px-3 py-2.5 text-right font-medium text-ink-3 hairline-b">Total</th>
                      <th className="w-[130px] px-3 py-2.5 font-medium text-ink-3 hairline-b">Week</th>
                      <th className="w-[170px] px-3 py-2.5 hairline-b" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const missing = days.filter((d) => r.states[d] === "missing" && d < today);
                      const target = dayTargetFor(r.person.weeklyHours, settings.workingDays);
                      return (
                        <tr key={r.person.id} className="row hairline-b">
                          <td className="px-4 py-2">
                            <Link href={`/time?person=${r.person.id}&week=${weekStart}`} className="flex items-center gap-2.5">
                              <Avatar name={r.person.displayName} size={26} />
                              <span className="min-w-0">
                                <span className="block truncate font-medium hover:underline">{r.person.displayName}</span>
                                <span className="block truncate text-[12px] text-ink-3">{r.person.jobTitle}</span>
                              </span>
                            </Link>
                          </td>
                          {days.map((d) => {
                            const s = r.states[d]!;
                            const h = r.byDay[d] ?? 0;
                            return (
                              <td key={d} className={cn("tnum px-2 py-2 text-center", d === today && "bg-accent-soft/30", s === "off" && "bg-surface-2/60")} title={`${DAY_TONE[s].label}${h ? ` · ${h} h` : ""}`}>
                                <span className={cn("font-medium", s === "off" || s === "future" ? "text-ink-4" : DAY_TONE[s].text)}>{s === "missing" ? "·" : fmt(h)}</span>
                              </td>
                            );
                          })}
                          <td className="tnum px-3 py-2 text-right font-semibold">
                            {fmt(r.total)}
                            <span className="block text-[11px] font-normal text-ink-3">/ {formatHours(target * settings.workingDays.length, settings.hoursFormat)}</span>
                          </td>
                          <td className="px-3 py-2">
                            <SheetPill status={r.sheet?.status ?? "open"} />
                          </td>
                          <td className="px-3 py-2">
                            <RowActions personId={r.person.id} weekStart={weekStart} timesheetId={r.sheet?.id ?? null} status={r.sheet?.status ?? null} missingDays={missing} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <p className="text-[12px] text-ink-3">Click a name to open their week — you can fix entries on their behalf; every edit is logged under your name.</p>
        </div>
      </div>
    </>
  );
}
