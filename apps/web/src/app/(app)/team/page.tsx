import Link from "next/link";
import { addDays, formatHours, shortDate, shortDay, weekLabel } from "@timefly/core";
import { Download } from "lucide-react";
import { requireManager } from "@/lib/auth";
import { dayTargetFor, teamWeek, teamsList, weekContext } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Topbar } from "@/components/shell/topbar";
import { WeekNav } from "@/components/shell/week-nav";
import { Avatar } from "@/components/ui/avatar";
import { Empty } from "@/components/ui/empty";
import { DAY_TONE, SheetPill } from "@/components/ui/pills";
import { Stat } from "@/components/ui/record";
import { BulkBar } from "./bulk-bar";
import { RowActions } from "./row-actions";

export const metadata = { title: "Team" };

type Filter = "all" | "nudge" | "awaiting" | "ok";
const FILTERS: [Filter, string][] = [["all", "Everyone"], ["nudge", "Needs a nudge"], ["awaiting", "Awaiting approval"], ["ok", "On track"]];

/**
 * The manager's screen, built around what needs a decision. Rows sort by attention (gaps first, then unsubmitted),
 * the tiles are filters, and the bulk bar acts on the whole filtered list — remind or approve everyone in one click.
 * Row buttons only appear when there is something to do.
 */
export default async function TeamPage({ searchParams }: { searchParams: Promise<{ week?: string; team?: string; f?: string }> }) {
  const sp = await searchParams;
  const me = await requireManager();
  const { settings, today, weekStart, days, prev, next, isCurrent } = await weekContext(sp.week);
  const teamId = sp.team ? Number(sp.team) : null;
  const filter: Filter = FILTERS.some(([k]) => k === sp.f) ? (sp.f as Filter) : "all";
  const [all, teams] = await Promise.all([teamWeek(me, weekStart, teamId), me.role === "admin" ? teamsList() : Promise.resolve([])]);
  const fmt = (h: number) => formatHours(h, settings.hoursFormat, { zero: "–" });

  // Classification: a person "needs a nudge" when past working days are empty, or the week is over and not submitted.
  const enriched = all.map((r) => {
    const pastMissing = r.missingDays.filter((d) => d < today);
    const status = r.sheet?.status ?? "open";
    const unsubmitted = !isCurrent && (status === "open" || status === "reopened");
    const needsNudge = status !== "approved" && (pastMissing.length > 0 || unsubmitted);
    const awaiting = status === "submitted";
    return { ...r, pastMissing, status, needsNudge, awaiting, onTrack: !needsNudge && !awaiting };
  });
  const rank = (r: (typeof enriched)[number]) => (r.needsNudge ? 0 : r.awaiting ? 1 : 2);
  enriched.sort((a, b) => rank(a) - rank(b) || b.pastMissing.length - a.pastMissing.length || a.person.displayName.localeCompare(b.person.displayName));
  const rows = enriched.filter((r) => (filter === "nudge" ? r.needsNudge : filter === "awaiting" ? r.awaiting : filter === "ok" ? r.onTrack : true));
  const counts = { nudge: enriched.filter((r) => r.needsNudge).length, awaiting: enriched.filter((r) => r.awaiting).length, ok: enriched.filter((r) => r.onTrack).length };
  const total = Math.round(enriched.reduce((a, r) => a + r.total, 0) * 100) / 100;
  const capacity = enriched.reduce((a, r) => a + r.person.weeklyHours, 0);
  const nudgeIds = rows.filter((r) => r.needsNudge && !(r.remindedAt && Date.now() - r.remindedAt.getTime() < 24 * 3_600_000)).map((r) => r.person.id);
  const approveIds = settings.approvals ? rows.filter((r) => r.awaiting && r.sheet).map((r) => r.sheet!.id) : [];
  // On the current week, last week is usually where the decisions are. One line, one click.
  const lastWeek = addDays(weekStart, -7);
  const prevRows = isCurrent ? await teamWeek(me, lastWeek, teamId) : [];
  const prevNudge = prevRows.filter((r) => r.sheet?.status !== "approved" && (r.missingDays.length > 0 || !r.sheet || r.sheet.status === "open" || r.sheet.status === "reopened")).length;
  const prevAwaiting = prevRows.filter((r) => r.sheet?.status === "submitted").length;
  const href = (f: Filter) => `/team?week=${weekStart}${teamId ? `&team=${teamId}` : ""}${f === "all" ? "" : `&f=${f}`}`;

  return (
    <>
      <Topbar
        crumbs={[{ label: "Team" }]}
        actions={
          <>
            <a href={`/api/entries.csv?from=${weekStart}&to=${addDays(weekStart, 6)}${teamId ? `&team=${teamId}` : ""}`} title="Every entry of this week, with notes" className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium text-ink hairline hover:bg-surface-2">
              <Download className="size-3.5" /> Export week
            </a>
            <WeekNav weekStart={weekStart} prev={prev} next={next} isCurrent={isCurrent} />
          </>
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1280px] space-y-3 px-6 py-4 rise">
          <div className="flex flex-wrap items-center gap-3 text-[12.5px] text-ink-3">
            <span>
              {enriched.length} {enriched.length === 1 ? "person" : "people"}
              {me.role === "admin" ? (teamId ? ` · ${teams.find((t) => t.id === teamId)?.name}` : " · all teams") : " · my team"}
              {isCurrent ? " · week in progress" : ""}
            </span>
            {me.role === "admin" && teams.length > 0 && (
              <form className="ml-auto flex items-center gap-2">
                <input type="hidden" name="week" value={weekStart} />
                {filter !== "all" && <input type="hidden" name="f" value={filter} />}
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

          {isCurrent && (prevNudge > 0 || prevAwaiting > 0) && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg bg-warn-soft px-4 py-2.5 text-[13px] text-warn">
              <span>
                <strong className="font-medium">Last week ({weekLabel(lastWeek)}):</strong> {prevNudge > 0 ? `${prevNudge} not submitted or with gaps` : ""}
                {prevNudge > 0 && prevAwaiting > 0 ? " · " : ""}
                {prevAwaiting > 0 ? `${prevAwaiting} awaiting your approval` : ""}
              </span>
              <span className="ml-auto flex gap-3">
                {prevNudge > 0 && (
                  <Link href={`/team?week=${lastWeek}&f=nudge${teamId ? `&team=${teamId}` : ""}`} className="font-medium underline-offset-2 hover:underline">
                    Nudge them
                  </Link>
                )}
                {prevAwaiting > 0 && (
                  <Link href={`/team?week=${lastWeek}&f=awaiting${teamId ? `&team=${teamId}` : ""}`} className="font-medium underline-offset-2 hover:underline">
                    Review approvals
                  </Link>
                )}
              </span>
            </div>
          )}

          {/* Tiles are filters: click one to see only those people; the bulk bar follows. */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FilterTile active={filter === "nudge"} href={href("nudge")} label="Needs a nudge" value={counts.nudge} sub={isCurrent ? "past days with nothing logged" : "gaps or not submitted"} tone={counts.nudge ? "crit" : "ok"} />
            <FilterTile active={filter === "awaiting"} href={href("awaiting")} label="Awaiting approval" value={counts.awaiting} sub={settings.approvals ? "submitted, not yet approved" : "approvals are off"} tone={counts.awaiting ? "warn" : undefined} />
            <FilterTile active={filter === "ok"} href={href("ok")} label="On track" value={counts.ok} sub={isCurrent ? "no gaps so far" : "submitted or approved"} tone="ok" />
            <Stat label="Hours logged" value={fmt(total)} sub={`of ${formatHours(capacity, settings.hoursFormat)} h capacity`} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-lg bg-surface-2 p-0.5">
              {FILTERS.map(([k, label]) => (
                <Link key={k} href={href(k)} className={cn("inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium", filter === k ? "bg-surface text-ink shadow-1" : "text-ink-2 hover:text-ink")}>
                  {label}
                  <span className="tnum text-[11px] text-ink-3">{k === "all" ? enriched.length : counts[k]}</span>
                </Link>
              ))}
            </div>
            <div className="ml-auto">
              <BulkBar weekStart={weekStart} nudgeIds={nudgeIds} approveIds={approveIds} label={filter === "all" ? "Everyone listed:" : `${FILTERS.find(([k]) => k === filter)?.[1]}:`} />
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="panel">
              <Empty title={filter === "all" ? "No one reports to you yet" : "Nobody in this group"} hint={filter === "all" ? "People appear here when their manager or team is set to you." : "Nothing to do here — try another filter."} />
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
                      <th className="w-[190px] px-3 py-2.5 hairline-b" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const target = dayTargetFor(r.person.weeklyHours, settings.workingDays);
                      return (
                        <tr key={r.person.id} className={cn("row hairline-b", r.needsNudge && "bg-crit-soft/20")}>
                          <td className="px-4 py-2">
                            <Link href={`/time?person=${r.person.id}&week=${weekStart}`} className="flex items-center gap-2.5">
                              <Avatar name={r.person.displayName} size={26} />
                              <span className="min-w-0">
                                <span className="block truncate font-medium hover:underline">{r.person.displayName}</span>
                                <span className="block truncate text-[12px] text-ink-3">
                                  {r.pastMissing.length > 0 ? <span className="text-crit">{r.pastMissing.length} missing {r.pastMissing.length === 1 ? "day" : "days"}</span> : r.person.jobTitle}
                                </span>
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
                            <SheetPill status={r.status} />
                          </td>
                          <td className="px-3 py-2">
                            <RowActions personId={r.person.id} weekStart={weekStart} timesheetId={r.sheet?.id ?? null} status={r.status} missingDays={r.pastMissing} needsNudge={r.needsNudge} remindedAt={r.remindedAt?.toISOString() ?? null} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <p className="text-[12px] text-ink-3">Sorted by attention: gaps first, then awaiting approval. Click a name to open their week — edits on their behalf are logged under your name. A reminder is sent at most once a day per person.</p>
        </div>
      </div>
    </>
  );
}

function FilterTile({ active, href, label, value, sub, tone }: { active: boolean; href: string; label: string; value: number; sub: string; tone?: "ok" | "warn" | "crit" }) {
  return (
    <Link href={href} className={cn("panel block p-4 transition-shadow hover:shadow-2", active && "shadow-[inset_0_0_0_2px_var(--accent)]")}>
      <p className="label">{label}</p>
      <p className={cn("mt-2 text-[22px] font-semibold leading-none tracking-[-0.02em] tnum", tone === "crit" && "text-crit", tone === "warn" && "text-warn", tone === "ok" && "text-ok")}>{value}</p>
      <p className="mt-1.5 truncate text-[11.5px] text-ink-3">{sub}</p>
    </Link>
  );
}
