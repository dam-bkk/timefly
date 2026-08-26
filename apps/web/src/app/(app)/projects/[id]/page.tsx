import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@timefly/db";
import { addDays, budgetBurn, formatHours, longDate, monthBounds, startOfWeek, weekLabel } from "@timefly/core";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { requirePrincipal, todayISO } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { teamsList } from "@/lib/queries";
import { cn, KIND_LABEL, pct } from "@/lib/utils";
import { Topbar } from "@/components/shell/topbar";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { KindTag, ProjectStatusPill, Tag } from "@/components/ui/pills";
import { Bars } from "@/components/ui/sparkline";
import { Block, PageHeader, Prop, Stat } from "@/components/ui/record";
import { Assign } from "./assign";
import { updateProject } from "../actions";

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }> }) {
  const { id: idStr } = await params;
  const { edit } = await searchParams;
  const id = Number(idStr);
  const me = await requirePrincipal();
  const settings = await getSettings();
  const today = todayISO();
  const [p] = await db.select().from(schema.projects).where(eq(schema.projects.id, id)).limit(1);
  if (!p) notFound();
  const [team] = p.teamId ? await db.select().from(schema.teams).where(eq(schema.teams.id, p.teamId)).limit(1) : [];
  const [owner] = p.ownerId ? await db.select({ id: schema.people.id, displayName: schema.people.displayName }).from(schema.people).where(eq(schema.people.id, p.ownerId)).limit(1) : [];
  const { from: mFrom, to: mTo } = monthBounds(today);
  const [k] = (await db.execute(sql`select coalesce(sum(hours),0)::float as hours, coalesce(sum(hours) filter (where date between ${mFrom} and ${mTo}),0)::float as month, count(distinct person_id)::int as people, min(date)::text as first, max(date)::text as last from time_entries where project_id = ${id}`)) as unknown as { hours: number; month: number; people: number; first: string | null; last: string | null }[];
  const byPerson = (await db.execute(sql`select p.id, p.display_name as name, p.job_title as title, sum(e.hours)::float as hours from time_entries e join people p on p.id = e.person_id where e.project_id = ${id} group by p.id, p.display_name, p.job_title order by hours desc`)) as unknown as { id: number; name: string; title: string | null; hours: number }[];
  const byTask = (await db.execute(sql`select t.name, sum(e.hours)::float as hours from time_entries e join tasks t on t.id = e.task_id where e.project_id = ${id} group by t.name order by hours desc`)) as unknown as { name: string; hours: number }[];
  const thisWeek = startOfWeek(today, settings.weekStartsOn);
  const weeks = Array.from({ length: 12 }, (_, i) => addDays(thisWeek, -7 * (11 - i)));
  const weekly = (await db.execute(sql`select (date_trunc('week', date::timestamp)::date)::text as w, sum(hours)::float as hours from time_entries where project_id = ${id} and date >= ${weeks[0]} group by 1 order by 1`)) as unknown as { w: string; hours: number }[];
  const series = weeks.map((w) => weekly.find((x) => x.w === w)?.hours ?? 0);
  const recent = await db
    .select({ id: schema.timeEntries.id, date: schema.timeEntries.date, hours: schema.timeEntries.hours, notes: schema.timeEntries.notes, person: schema.people.displayName, personId: schema.people.id, task: schema.tasks.name })
    .from(schema.timeEntries)
    .innerJoin(schema.people, eq(schema.people.id, schema.timeEntries.personId))
    .innerJoin(schema.tasks, eq(schema.tasks.id, schema.timeEntries.taskId))
    .where(and(eq(schema.timeEntries.projectId, id), gte(schema.timeEntries.date, addDays(today, -21))))
    .orderBy(desc(schema.timeEntries.date), desc(schema.timeEntries.id))
    .limit(40);
  const assignedIds = (await db.select({ personId: schema.assignments.personId }).from(schema.assignments).where(eq(schema.assignments.projectId, id))).map((a) => a.personId);
  const everyone = await db.select({ id: schema.people.id, displayName: schema.people.displayName, jobTitle: schema.people.jobTitle, team: schema.teams.name }).from(schema.people).leftJoin(schema.teams, eq(schema.teams.id, schema.people.teamId)).where(eq(schema.people.status, "active")).orderBy(asc(schema.people.displayName));
  const assigned = everyone.filter((x) => assignedIds.includes(x.id));
  const candidates = everyone.filter((x) => !assignedIds.includes(x.id));
  const hoursByPerson = Object.fromEntries(byPerson.map((r) => [r.id, Math.round(r.hours * 100) / 100]));
  const burn = budgetBurn(k?.hours ?? 0, p.budgetHours);
  const canEdit = me.role !== "member";
  const fmt = (h: number) => formatHours(h, settings.hoursFormat, { zero: "0" });
  const teams = canEdit ? await teamsList() : [];
  const owners = canEdit ? everyone.filter((x) => x.id === p.ownerId || inArray) : [];
  void owners;

  return (
    <>
      <Topbar crumbs={[{ label: "Projects", href: `/projects?kind=${p.kind}` }, { label: p.code }]} />
      <div className="flex-1 overflow-y-auto">
        <PageHeader
          eyebrow={
            <>
              <span className="font-mono">{p.code}</span>
              {p.ticketRef && p.ticketRef !== p.code && (
                <>
                  <span>·</span>
                  <span className="font-mono">{p.ticketRef}</span>
                </>
              )}
              {p.harvestId && <Tag>Imported from Harvest</Tag>}
            </>
          }
          title={p.name}
          chips={
            <span className="flex items-center gap-1.5">
              <KindTag kind={p.kind} />
              <ProjectStatusPill status={p.status} />
            </span>
          }
          actions={canEdit ? <Link href={edit ? `/projects/${id}` : `/projects/${id}?edit=1`} className="h-8 rounded-md px-3 text-[13px] font-medium leading-8 text-ink hairline hover:bg-surface-2">{edit ? "Close" : "Edit"}</Link> : undefined}
        />
        <div className="mx-auto max-w-[1280px] space-y-3 px-6 pb-6 rise">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Hours logged" value={fmt(k?.hours ?? 0)} sub={k?.first ? `${k.first} → ${k.last}` : "nothing yet"} />
            <Stat label="This month" value={fmt(k?.month ?? 0)} sub={`${k?.people ?? 0} people ever logged`} />
            <Stat label="Budget" value={burn.budget ? `${pct(burn.ratio ?? 0)}` : "—"} sub={burn.budget ? `${fmt(burn.used)} of ${burn.budget} h` : "no budget set"} tone={burn.state === "over" ? "crit" : burn.state === "warn" ? "warn" : undefined} />
            <Stat label="Assigned" value={String(assigned.length)} sub="people who see it in their picker" />
          </div>

          {edit && canEdit && (
            <form action={updateProject.bind(null, id)} className="panel grid gap-4 p-5 md:grid-cols-3">
              <Field label="Name" className="md:col-span-3">
                <Input name="name" defaultValue={p.name} required />
              </Field>
              <Field label="Status">
                <Select name="status" defaultValue={p.status}>
                  <option value="active">Active</option>
                  <option value="on_hold">On hold</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
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
              <Field label="Owner">
                <Select name="ownerId" defaultValue={p.ownerId ?? ""}>
                  <option value="">—</option>
                  {everyone.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.displayName}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Client / business unit">
                <Input name="clientName" defaultValue={p.clientName ?? ""} />
              </Field>
              <Field label="Budget (hours)">
                <Input name="budgetHours" type="number" step="1" min="0" defaultValue={p.budgetHours ?? ""} />
              </Field>
              <Field label="Service Desk ref">
                <Input name="ticketRef" defaultValue={p.ticketRef ?? ""} placeholder="SR-229241" />
              </Field>
              <Field label="Starts">
                <Input name="startsOn" type="date" defaultValue={p.startsOn ?? ""} />
              </Field>
              <Field label="Ends">
                <Input name="endsOn" type="date" defaultValue={p.endsOn ?? ""} />
              </Field>
              <Field label="Notes" className="md:col-span-3">
                <Textarea name="notes" defaultValue={p.notes ?? ""} />
              </Field>
              <div className="md:col-span-3">
                <Button variant="primary" type="submit">
                  Save changes
                </Button>
              </div>
            </form>
          )}

          <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
            <div className="space-y-3">
              <Block title="Hours per week — last 12 weeks">
                <Bars data={series} labels={weeks.map((w) => weekLabel(w).split(" ").slice(0, 3).join(" "))} height={120} />
              </Block>
              <div className="grid gap-3 md:grid-cols-2">
                <Block title="By person" flush>
                  <table className="w-full text-[13px]">
                    <tbody>
                      {byPerson.length === 0 && (
                        <tr>
                          <td className="px-4 py-3 text-ink-3">No hours yet.</td>
                        </tr>
                      )}
                      {byPerson.map((r) => (
                        <tr key={r.id} className="row hairline-b">
                          <td className="px-4 py-2">
                            <Link href={me.role === "member" ? "#" : `/people/${r.id}`} className="flex items-center gap-2">
                              <Avatar name={r.name} size={22} />
                              <span className="min-w-0">
                                <span className="block truncate font-medium">{r.name}</span>
                                <span className="block truncate text-[11.5px] text-ink-3">{r.title}</span>
                              </span>
                            </Link>
                          </td>
                          <td className="tnum px-4 py-2 text-right font-medium">{fmt(r.hours)}</td>
                          <td className="w-24 px-4 py-2">
                            <span className="bar">
                              <i style={{ width: `${Math.round((r.hours / (byPerson[0]?.hours || 1)) * 100)}%` }} />
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Block>
                <Block title="By task" flush>
                  <table className="w-full text-[13px]">
                    <tbody>
                      {byTask.length === 0 && (
                        <tr>
                          <td className="px-4 py-3 text-ink-3">No hours yet.</td>
                        </tr>
                      )}
                      {byTask.map((r) => (
                        <tr key={r.name} className="row hairline-b">
                          <td className="px-4 py-2 font-medium">{r.name}</td>
                          <td className="tnum px-4 py-2 text-right">{fmt(r.hours)}</td>
                          <td className="tnum w-16 px-4 py-2 text-right text-ink-3">{pct(r.hours / ((k?.hours ?? 0) || 1))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Block>
              </div>
              <Block title="Recent work — last three weeks, with notes" flush>
                <ul className="divide-y divide-line">
                  {recent.length === 0 && <li className="px-4 py-3 text-[12.5px] text-ink-3">Nothing logged in the last three weeks.</li>}
                  {recent.map((e) => (
                    <li key={e.id} className="flex items-start gap-3 px-4 py-2 text-[13px]">
                      <span className="tnum w-24 shrink-0 text-ink-3">{longDate(e.date).replace(/ \d{4}$/, "")}</span>
                      <Avatar name={e.person} size={20} className="mt-0.5" />
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">{e.person}</span>
                        <span className="text-ink-3"> · {e.task}</span>
                        {e.notes && <span className="block truncate text-ink-2">{e.notes}</span>}
                      </span>
                      <span className="tnum shrink-0 font-medium">{fmt(e.hours)}</span>
                    </li>
                  ))}
                </ul>
              </Block>
            </div>
            <div className="space-y-3">
              <Block title="Details">
                <div className="space-y-2">
                  <Prop label="Type">{KIND_LABEL[p.kind]}</Prop>
                  <Prop label="Team">{team?.name ?? "—"}</Prop>
                  <Prop label="Owner">{owner?.displayName ?? "—"}</Prop>
                  <Prop label="Client">{p.clientName ?? "—"}</Prop>
                  <Prop label="Dates">
                    {p.startsOn ?? "—"} → {p.endsOn ?? "open"}
                  </Prop>
                  <Prop label="Budget">{p.budgetHours ? `${p.budgetHours} h` : "—"}</Prop>
                  {p.notes && (
                    <Prop label="Notes">
                      <span className={cn("font-normal text-ink-2")}>{p.notes}</span>
                    </Prop>
                  )}
                </div>
              </Block>
              <Block title="Assigned people">
                <Assign projectId={id} assigned={assigned} candidates={candidates} canEdit={canEdit} hours={hoursByPerson} />
              </Block>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
