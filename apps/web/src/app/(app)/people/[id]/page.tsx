import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@timefly/db";
import { addDays, formatHours, startOfWeek, utilisation, weekLabel } from "@timefly/core";
import { asc, desc, eq, sql } from "drizzle-orm";
import { canSee, requirePrincipal, todayISO } from "@/lib/auth";
import { teamsList } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { pct, ROLE_LABEL } from "@/lib/utils";
import { Topbar } from "@/components/shell/topbar";
import { Avatar } from "@/components/ui/avatar";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { KindTag, SheetPill } from "@/components/ui/pills";
import { Bars } from "@/components/ui/sparkline";
import { Block, PageHeader, Prop, Stat } from "@/components/ui/record";
import { updatePerson } from "../actions";

export default async function PersonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }> }) {
  const { id: idStr } = await params;
  const { edit } = await searchParams;
  const id = Number(idStr);
  const me = await requirePrincipal();
  const settings = await getSettings();
  const today = todayISO();
  const [p] = await db.select().from(schema.people).where(eq(schema.people.id, id)).limit(1);
  if (!p || !canSee(me, p)) notFound();
  const [team] = p.teamId ? await db.select().from(schema.teams).where(eq(schema.teams.id, p.teamId)).limit(1) : [];
  const [manager] = p.managerId ? await db.select({ displayName: schema.people.displayName }).from(schema.people).where(eq(schema.people.id, p.managerId)).limit(1) : [];
  const thisWeek = startOfWeek(today, settings.weekStartsOn);
  const weeks = Array.from({ length: 12 }, (_, i) => addDays(thisWeek, -7 * (11 - i)));
  const weekly = (await db.execute(sql`select (date_trunc('week', date::timestamp)::date)::text as w, sum(hours)::float as hours from time_entries where person_id = ${id} and date >= ${weeks[0]} group by 1 order by 1`)) as unknown as { w: string; hours: number }[];
  const series = weeks.map((w) => weekly.find((x) => x.w === w)?.hours ?? 0);
  const fourWeeks = series.slice(7, 11).reduce((a, b) => a + b, 0);
  const u = utilisation(fourWeeks, p.weeklyHours * 4);
  const byProject = (await db.execute(sql`select pr.id, pr.code, pr.name, pr.kind, sum(e.hours)::float as hours from time_entries e join projects pr on pr.id = e.project_id where e.person_id = ${id} and e.date >= ${addDays(today, -90)} group by pr.id, pr.code, pr.name, pr.kind order by hours desc limit 12`)) as unknown as { id: number; code: string; name: string; kind: string; hours: number }[];
  const assignments = await db.select({ id: schema.projects.id, code: schema.projects.code, name: schema.projects.name, kind: schema.projects.kind, status: schema.projects.status }).from(schema.assignments).innerJoin(schema.projects, eq(schema.projects.id, schema.assignments.projectId)).where(eq(schema.assignments.personId, id)).orderBy(asc(schema.projects.code));
  const sheets = await db.select().from(schema.timesheets).where(eq(schema.timesheets.personId, id)).orderBy(desc(schema.timesheets.weekStart)).limit(8);
  const teams = me.role === "admin" ? await teamsList() : [];
  const managers = me.role === "admin" ? await db.select({ id: schema.people.id, displayName: schema.people.displayName }).from(schema.people).where(sql`role <> 'member' and status = 'active'`).orderBy(asc(schema.people.displayName)) : [];
  const fmt = (h: number) => formatHours(h, settings.hoursFormat, { zero: "0" });

  return (
    <>
      <Topbar crumbs={[{ label: "People", href: "/people" }, { label: p.displayName }]} />
      <div className="flex-1 overflow-y-auto">
        <PageHeader
          eyebrow={
            <span className="flex items-center gap-2">
              <Avatar name={p.displayName} size={28} />
              <span>
                {p.jobTitle}
                {team ? ` · ${team.name}` : ""}
              </span>
            </span>
          }
          title={p.displayName}
          chips={<span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-ink-2">{ROLE_LABEL[p.role]}</span>}
          actions={
            <>
              <ButtonLink href={`/time?person=${p.id}`} size="sm" variant="primary">
                Open timesheet
              </ButtonLink>
              {me.role === "admin" && (
                <ButtonLink href={edit ? `/people/${id}` : `/people/${id}?edit=1`} size="sm">
                  {edit ? "Close" : "Edit"}
                </ButtonLink>
              )}
            </>
          }
        />
        <div className="mx-auto max-w-[1240px] space-y-3 px-6 pb-6 rise">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="This week" value={fmt(series[11] ?? 0)} sub={weekLabel(thisWeek)} />
            <Stat label="Last week" value={fmt(series[10] ?? 0)} sub={weekLabel(addDays(thisWeek, -7))} />
            <Stat label="Utilisation" value={pct(u)} sub="last 4 full weeks vs contracted" tone={u < 0.7 ? "warn" : undefined} />
            <Stat label="Contracted" value={`${p.weeklyHours} h`} sub="per week" />
          </div>

          {edit && me.role === "admin" && (
            <form action={updatePerson.bind(null, id)} className="panel grid gap-4 p-5 md:grid-cols-3">
              <Field label="Job title">
                <Input name="jobTitle" defaultValue={p.jobTitle ?? ""} />
              </Field>
              <Field label="Role">
                <Select name="role" defaultValue={p.role}>
                  <option value="member">Member</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </Select>
              </Field>
              <Field label="Status">
                <Select name="status" defaultValue={p.status}>
                  <option value="active">Active</option>
                  <option value="left">Left</option>
                </Select>
              </Field>
              <Field label="Team">
                <Select name="teamId" defaultValue={p.teamId ?? ""}>
                  <option value="">—</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Manager">
                <Select name="managerId" defaultValue={p.managerId ?? ""}>
                  <option value="">—</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Contracted hours / week">
                <Input name="weeklyHours" type="number" step="0.5" min="1" max="60" defaultValue={p.weeklyHours} />
              </Field>
              <div className="md:col-span-3">
                <Button variant="primary" type="submit">
                  Save
                </Button>
              </div>
            </form>
          )}

          <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
            <div className="space-y-3">
              <Block title="Hours per week — last 12 weeks">
                <Bars data={series} labels={weeks.map((w) => weekLabel(w).split(" ").slice(0, 3).join(" "))} height={120} />
              </Block>
              <Block title="Where the time went — last 90 days" flush>
                <table className="w-full text-[13px]">
                  <tbody>
                    {byProject.map((r) => (
                      <tr key={r.id} className="row hairline-b">
                        <td className="px-4 py-2">
                          <Link href={`/projects/${r.id}`} className="flex items-center gap-2">
                            <KindTag kind={r.kind} />
                            <span className="truncate font-medium hover:underline">{r.name}</span>
                            <span className="font-mono text-[11px] text-ink-3">{r.code}</span>
                          </Link>
                        </td>
                        <td className="tnum px-4 py-2 text-right font-medium">{fmt(r.hours)}</td>
                        <td className="w-28 px-4 py-2">
                          <span className="bar">
                            <i style={{ width: `${Math.round((r.hours / (byProject[0]?.hours || 1)) * 100)}%` }} />
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Block>
            </div>
            <div className="space-y-3">
              <Block title="Details">
                <div className="space-y-2">
                  <Prop label="Email">
                    <span className="font-normal text-ink-2">{p.email}</span>
                  </Prop>
                  <Prop label="Team">{team?.name ?? "—"}</Prop>
                  <Prop label="Manager">{manager?.displayName ?? "—"}</Prop>
                  <Prop label="Status">{p.status}</Prop>
                  {p.harvestId && <Prop label="Harvest">imported · #{p.harvestId}</Prop>}
                </div>
              </Block>
              <Block title="Assigned work" flush>
                <ul className="divide-y divide-line">
                  {assignments.length === 0 && <li className="px-4 py-3 text-[12.5px] text-ink-3">Nothing assigned.</li>}
                  {assignments.map((a) => (
                    <li key={a.id} className="flex items-center gap-2 px-4 py-2 text-[13px]">
                      <KindTag kind={a.kind} />
                      <Link href={`/projects/${a.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                        {a.name}
                      </Link>
                      <span className="font-mono text-[11px] text-ink-3">{a.code}</span>
                    </li>
                  ))}
                </ul>
              </Block>
              <Block title="Recent weeks" flush>
                <ul className="divide-y divide-line">
                  {sheets.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 px-4 py-2 text-[13px]">
                      <Link href={`/time?person=${p.id}&week=${s.weekStart}`} className="flex-1 hover:underline">
                        {weekLabel(s.weekStart)}
                      </Link>
                      <SheetPill status={s.status} />
                    </li>
                  ))}
                </ul>
              </Block>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
