import { db, schema } from "@timefly/db";
import { asc, eq, sql } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { saveTeam } from "../actions";

export const metadata = { title: "Teams" };

export default async function TeamsAdmin() {
  const teams = await db.select().from(schema.teams).orderBy(asc(schema.teams.id));
  const leads = await db.select({ id: schema.people.id, displayName: schema.people.displayName }).from(schema.people).where(sql`role <> 'member' and status = 'active'`).orderBy(asc(schema.people.displayName));
  const sizes = (await db.select({ teamId: schema.people.teamId, n: sql<number>`count(*)::int` }).from(schema.people).where(eq(schema.people.status, "active")).groupBy(schema.people.teamId)) as { teamId: number | null; n: number }[];
  return (
    <div className="max-w-3xl">
      <h1 className="text-[20px] font-semibold tracking-[-0.01em]">Teams</h1>
      <p className="text-[13px] text-ink-3">A manager sees their direct reports and everyone in their team. Move people between teams from their profile.</p>
      <section className="mt-6 space-y-2">
        {teams.map((t) => (
          <form key={t.id} action={saveTeam} className="panel grid gap-3 p-4 md:grid-cols-[1fr_1.4fr_1fr_auto_auto] md:items-end">
            <input type="hidden" name="id" value={t.id} />
            <Field label="Name">
              <Input name="name" defaultValue={t.name} />
            </Field>
            <Field label="Description">
              <Input name="description" defaultValue={t.description ?? ""} />
            </Field>
            <Field label="Lead">
              <Select name="leadId" defaultValue={t.leadId ?? ""}>
                <option value="">—</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.displayName}
                  </option>
                ))}
              </Select>
            </Field>
            <span className="tnum pb-2 text-[12.5px] text-ink-3">{sizes.find((s) => s.teamId === t.id)?.n ?? 0} people</span>
            <Button size="md" type="submit" className="h-9">
              Save
            </Button>
          </form>
        ))}
      </section>
      <form action={saveTeam} className="panel mt-4 grid gap-3 p-4 md:grid-cols-[1fr_1.4fr_1fr_auto] md:items-end">
        <Field label="New team">
          <Input name="name" required placeholder="e.g. Security" />
        </Field>
        <Field label="Description">
          <Input name="description" />
        </Field>
        <Field label="Lead">
          <Select name="leadId" defaultValue="">
            <option value="">—</option>
            {leads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.displayName}
              </option>
            ))}
          </Select>
        </Field>
        <Button variant="primary" type="submit" className="h-9">
          Add
        </Button>
      </form>
    </div>
  );
}
