import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { canApprove, canEditEntries, canReopen, canSubmit, formatHours, longDate, weekSummary } from "@timefly/core";
import { canSee, requirePrincipal } from "@/lib/auth";
import { dayTargetFor, entriesForWeek, personById, projectOptions, taskOptions, timesheetFor, weekContext } from "@/lib/queries";
import { cn, pct } from "@/lib/utils";
import { Topbar } from "@/components/shell/topbar";
import { WeekNav } from "@/components/shell/week-nav";
import { Avatar } from "@/components/ui/avatar";
import { SheetPill } from "@/components/ui/pills";
import { WeekGrid, type GridRow } from "./grid";
import { SheetControls } from "./sheet-controls";

export const metadata = { title: "My timesheet" };

export default async function TimePage({ searchParams }: { searchParams: Promise<{ week?: string; person?: string }> }) {
  const sp = await searchParams;
  const me = await requirePrincipal();
  const personId = sp.person ? Number(sp.person) : me.id;
  const person = personId === me.id ? { id: me.id, displayName: me.displayName, jobTitle: me.jobTitle, managerId: me.managerId, teamId: me.teamId, weeklyHours: me.weeklyHours } : await personById(personId);
  if (!person || !canSee(me, person)) notFound();
  const self = person.id === me.id;
  const { settings, today, weekStart, days, prev, next, isCurrent } = await weekContext(sp.week);
  const [entries, sheet, projects, tasks] = await Promise.all([entriesForWeek(person.id, weekStart), timesheetFor(person.id, weekStart), projectOptions(person.id), taskOptions()]);

  // Group entries into grid rows (project × task); duplicates on a day are shown summed and merged on first edit.
  const rowMap = new Map<string, GridRow>();
  for (const e of entries) {
    const key = `${e.projectId}:${e.taskId}`;
    const row = rowMap.get(key) ?? { projectId: e.projectId, taskId: e.taskId, projectCode: e.projectCode, projectName: e.projectName, projectKind: e.projectKind, taskName: e.taskName, cells: {} };
    const c = row.cells[e.date];
    row.cells[e.date] = c ? { id: c.id, hours: Math.round((c.hours + e.hours) * 100) / 100, notes: [c.notes, e.notes].filter(Boolean).join(" · ") || null, timerStartedAt: c.timerStartedAt ?? e.timerStartedAt?.toISOString() ?? null } : { id: e.id, hours: e.hours, notes: e.notes, timerStartedAt: e.timerStartedAt?.toISOString() ?? null };
    rowMap.set(key, row);
  }
  const rows = [...rowMap.values()].sort((a, b) => (a.projectKind === "internal" ? 1 : 0) - (b.projectKind === "internal" ? 1 : 0) || a.projectCode.localeCompare(b.projectCode) || a.taskName.localeCompare(b.taskName));
  const dayTarget = dayTargetFor(person.weeklyHours, settings.workingDays);
  const summary = weekSummary(days, entries, { today, target: dayTarget, holidays: settings.holidays });
  const editable = canEditEntries(sheet.status, me.role, self);
  const submit = canSubmit(sheet.status, me.role, self) && (isCurrent ? weekStart <= today : true);
  const approve = settings.approvals && canApprove(sheet.status, me.role, self);
  const reopen = canReopen(sheet.status, me.role) && !self;
  const pastMissing = summary.missing.filter((d) => d < today);

  return (
    <>
      <Topbar crumbs={self ? [{ label: "My timesheet" }] : [{ label: "Team", href: "/team" }, { label: person.displayName }]} actions={<WeekNav weekStart={weekStart} prev={prev} next={next} isCurrent={isCurrent} />} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1280px] space-y-3 px-6 py-4 rise">
          {!self && (
            <div className="flex items-center gap-3 rounded-lg bg-accent-soft/60 px-4 py-2.5 text-[13px]">
              <Avatar name={person.displayName} size={24} />
              <span>
                Viewing <strong className="font-medium">{person.displayName}</strong>
                {person.jobTitle ? <span className="text-ink-2"> · {person.jobTitle}</span> : null}
                {editable && <span className="text-ink-2"> · your edits are logged under your name</span>}
              </span>
              <Link href="/team" className="ml-auto text-accent-ink hover:underline">
                Back to team
              </Link>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="flex items-baseline gap-2">
              <span className="tnum text-[26px] font-semibold leading-none tracking-[-0.02em]">{formatHours(summary.total, settings.hoursFormat, { zero: "0" })}</span>
              <span className="text-[13px] text-ink-3">
                of {formatHours(summary.target, settings.hoursFormat)} h · {pct(summary.completion)} of the week so far
              </span>
            </div>
            <div className="bar w-40">
              <i style={{ width: `${Math.round(summary.completion * 100)}%` }} />
            </div>
            <SheetPill status={sheet.status} />
            {sheet.status === "reopened" && sheet.note && <span className="text-[12.5px] text-warn">“{sheet.note}”</span>}
            <div className="ml-auto">
              <SheetControls personId={person.id} weekStart={weekStart} timesheetId={sheet.id} status={sheet.status} canSubmit={submit} canApprove={approve} canReopen={reopen} />
            </div>
          </div>

          {pastMissing.length > 0 && sheet.status !== "approved" && (
            <div className={cn("flex items-center gap-2 rounded-lg px-4 py-2 text-[13px]", "bg-crit-soft text-crit")}>
              <AlertCircle className="size-4 shrink-0" />
              <span>
                Nothing logged for {pastMissing.map((d) => longDate(d).replace(/ \d{4}$/, "")).join(", ")}.{editable ? " Fill it in before submitting." : ""}
              </span>
            </div>
          )}

          <WeekGrid personId={person.id} self={self} weekStart={weekStart} days={days} today={today} rows={rows} projects={projects} tasks={tasks} canEdit={editable} hoursFormat={settings.hoursFormat} dayTarget={dayTarget} holidays={settings.holidays} />

          <p className="text-[12px] text-ink-3">
            {sheet.status === "approved" && sheet.approvedAt ? `Approved ${sheet.approvedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}. ` : sheet.status === "submitted" && sheet.submittedAt ? `Submitted ${sheet.submittedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}. ` : ""}
            Day target {formatHours(dayTarget, settings.hoursFormat)} h · hours round to the nearest {settings.roundTo * 60} min · every edit is in the activity log.
          </p>
        </div>
      </div>
    </>
  );
}
