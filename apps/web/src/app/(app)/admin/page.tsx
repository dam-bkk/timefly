import Link from "next/link";
import { db, schema } from "@timefly/db";
import { addDays, startOfWeek } from "@timefly/core";
import { desc, sql } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import { APP_ENV, APP_VERSION, todayISO } from "@/lib/auth";
import { dbStats, listJobs } from "@/lib/queries";
import { getHarvestState, getSettings } from "@/lib/settings";
import { relTime } from "@/lib/utils";
import { Stat } from "@/components/ui/record";

export const metadata = { title: "Admin" };

export default async function AdminHome() {
  const [settings, harvest, jobs, stats] = await Promise.all([getSettings(), getHarvestState(), listJobs(), dbStats()]);
  const today = todayISO();
  const lastWeek = addDays(startOfWeek(today, settings.weekStartsOn), -7);
  const [open] = (await db.execute(sql`select count(*)::int as n from timesheets where week_start = ${lastWeek} and status in ('open','reopened')`)) as unknown as { n: number }[];
  const [awaiting] = (await db.execute(sql`select count(*)::int as n from timesheets where status = 'submitted'`)) as unknown as { n: number }[];
  const backup = jobs.find((j) => j.name === "json-backup");
  const last = await db.select().from(schema.activityLog).orderBy(desc(schema.activityLog.ts)).limit(6);
  const cards: [string, string, string][] = [
    ["/admin/general", "Timesheet rules", `Week starts ${settings.weekStartsOn === 1 ? "Monday" : "Sunday"} · ${settings.dayTarget} h/day · approvals ${settings.approvals ? "on" : "off"} · rounds to ${settings.roundTo * 60} min`],
    ["/admin/tasks", "Tasks", "The list people pick from when adding a row"],
    ["/admin/teams", "Teams", "Groups, leads and who reports to whom"],
    ["/admin/import", "Harvest import", harvest.lastImportAt ? `Last import ${relTime(harvest.lastImportAt)} · ${harvest.imported?.entries.toLocaleString() ?? 0} entries` : "Not run yet"],
    ["/admin/activity", "Activity log", `${stats.activity.toLocaleString()} rows, append-only, CSV export`],
    ["/admin/status", "System status", backup?.lastRunAt ? `Backup ${relTime(backup.lastRunAt)}` : "No backup yet"],
  ];
  return (
    <div>
      <h1 className="text-[20px] font-semibold tracking-[-0.01em]">Admin</h1>
      <p className="text-[13px] text-ink-3">
        v{APP_VERSION} · {APP_ENV} · every setting change is logged.
      </p>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Last week not submitted" value={String(open?.n ?? 0)} sub="timesheets still open" tone={open?.n ? "warn" : "ok"} href={`/team?week=${lastWeek}`} />
        <Stat label="Awaiting approval" value={String(awaiting?.n ?? 0)} sub="across all weeks" href="/team" />
        <Stat label="Active people" value={String(stats.people)} sub={`${stats.projects} projects & requests`} href="/people" />
        <Stat label="Offsite backup" value={backup?.lastRunAt ? relTime(backup.lastRunAt) : "—"} sub={backup?.detail ?? ""} tone={backup?.lastRunAt && Date.now() - backup.lastRunAt.getTime() > 26 * 3_600_000 ? "crit" : "ok"} href="/admin/status" />
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {cards.map(([href, title, sub]) => (
          <Link key={href} href={href} className="panel flex items-center gap-3 p-4 transition-shadow hover:shadow-2">
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-medium">{title}</span>
              <span className="block truncate text-[12px] text-ink-3">{sub}</span>
            </span>
            <ArrowRight className="size-4 text-ink-3" />
          </Link>
        ))}
      </div>
      <section className="panel mt-6 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 hairline-b">
          <h2 className="text-[13px] font-semibold">Latest activity</h2>
          <Link href="/admin/activity" className="text-[12.5px] text-accent-ink hover:underline">
            All activity
          </Link>
        </div>
        <ul className="divide-y divide-line">
          {last.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-2 text-[13px]">
              <span className="tnum w-24 shrink-0 text-ink-3">{relTime(a.ts)}</span>
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{a.actorName}</span> <span className="font-mono text-[12px] text-ink-2">{a.action}</span>
                {a.targetType && <span className="text-ink-3"> · {a.targetType} {a.targetId}</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
