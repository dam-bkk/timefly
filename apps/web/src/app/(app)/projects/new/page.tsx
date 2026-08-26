import { db, schema } from "@timefly/db";
import { asc, eq } from "drizzle-orm";
import { requireManager } from "@/lib/auth";
import { teamsList } from "@/lib/queries";
import { Topbar } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/record";
import { createProject } from "../actions";

export const metadata = { title: "New project" };

export default async function NewProject({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams;
  const me = await requireManager();
  const teams = await teamsList();
  const people = await db.select({ id: schema.people.id, displayName: schema.people.displayName, team: schema.teams.name }).from(schema.people).leftJoin(schema.teams, eq(schema.teams.id, schema.people.teamId)).where(eq(schema.people.status, "active")).orderBy(asc(schema.people.displayName));
  return (
    <>
      <Topbar crumbs={[{ label: "Projects", href: "/projects" }, { label: "New" }]} />
      <div className="flex-1 overflow-y-auto">
        <PageHeader title="New project or work request" eyebrow={<span>Leave the code empty to number it automatically. Work requests usually take their Service Desk reference (SR-…).</span>} />
        <form action={createProject} className="mx-auto max-w-[880px] space-y-4 px-6 pb-8 rise">
          <div className="panel grid gap-4 p-5 md:grid-cols-3">
            <Field label="Type">
              <Select name="kind" defaultValue={kind === "work_request" || kind === "internal" ? kind : "project"}>
                <option value="project">Project</option>
                <option value="work_request">Work request</option>
                <option value="internal">Internal category</option>
              </Select>
            </Field>
            <Field label="Code" help="PRJ-2026-18, SR-229310…">
              <Input name="code" placeholder="auto" />
            </Field>
            <Field label="Service Desk ref">
              <Input name="ticketRef" placeholder="SR-229310" />
            </Field>
            <Field label="Name" required className="md:col-span-3">
              <Input name="name" required placeholder="What is it, in one line" />
            </Field>
            <Field label="Team">
              <Select name="teamId" defaultValue={me.teamId ?? ""}>
                <option value="">—</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Owner">
              <Select name="ownerId" defaultValue={me.id}>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Client / business unit">
              <Input name="clientName" placeholder="QNET, QI Group, IT internal" />
            </Field>
            <Field label="Budget (hours)">
              <Input name="budgetHours" type="number" min="0" step="1" />
            </Field>
            <Field label="Starts">
              <Input name="startsOn" type="date" />
            </Field>
            <Field label="Ends">
              <Input name="endsOn" type="date" />
            </Field>
            <Field label="Notes" className="md:col-span-3">
              <Textarea name="notes" placeholder="Scope, links, anything the team should know" />
            </Field>
          </div>
          <div className="panel p-5">
            <p className="text-[13px] font-medium">Assign people now</p>
            <p className="text-[12px] text-ink-3">They get a notification and the item shows up in their timesheet picker. You can change this later.</p>
            <div className="mt-3 grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
              {people.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-surface-2">
                  <input type="checkbox" name="assignee" value={p.id} className="accent-[var(--accent)]" />
                  <span className="truncate">
                    {p.displayName} <span className="text-ink-3">{p.team ? `· ${p.team}` : ""}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <Button variant="primary" size="lg" type="submit">
            Create
          </Button>
        </form>
      </div>
    </>
  );
}
