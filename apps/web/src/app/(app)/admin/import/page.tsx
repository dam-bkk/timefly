import { db, schema } from "@timefly/db";
import { sql } from "drizzle-orm";
import { getHarvestState } from "@/lib/settings";
import { harvestEnv } from "@/lib/harvest";
import { relTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Tone } from "@/components/ui/pills";
import { Stat } from "@/components/ui/record";
import { runHarvestImport } from "./actions";

export const metadata = { title: "Harvest import" };

const MAPPING: [string, string, string][] = [
  ["Users", "people", "matched on email (Entra identity), weekly_capacity → contracted hours"],
  ["Clients", "projects.client_name", "folded into the project — an internal team has no invoicing"],
  ["Projects", "projects", "code SR-/INC- → work request; 'internal/leave/meeting' → internal; is_active → status"],
  ["Tasks", "tasks", "same list, same names; retired ones stay for history"],
  ["User assignments", "assignments", "active ones only — they become the default rows on a timesheet"],
  ["Time entries", "time_entries", "spent_date, hours, notes, harvest_id — re-runs update in place"],
  ["Invoices, expenses, estimates", "—", "not imported: never used"],
];

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ done?: string; error?: string }> }) {
  const sp = await searchParams;
  const state = await getHarvestState();
  const env = harvestEnv();
  const [counts] = (await db.execute(sql`select
    (select count(*) from people where harvest_id is not null)::int as people,
    (select count(*) from projects where harvest_id is not null)::int as projects,
    (select count(*) from tasks where harvest_id is not null)::int as tasks,
    (select count(*) from time_entries where harvest_id is not null)::int as entries,
    (select min(date)::text from time_entries where harvest_id is not null) as first,
    (select max(date)::text from time_entries where harvest_id is not null) as last`)) as unknown as { people: number; projects: number; tasks: number; entries: number; first: string | null; last: string | null }[];
  void schema;
  return (
    <div className="max-w-3xl">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[20px] font-semibold tracking-[-0.01em]">Harvest import</h1>
          <p className="text-[13px] text-ink-3">Read-only against Harvest API v2. Run the full import once, then a delta with “updated since” on cut-over day.</p>
        </div>
        <Tone tone={env ? "ok" : "warn"}>{env ? `Connected · account ${env.accountId}` : "Not configured"}</Tone>
      </div>
      {sp.done && <p className="mt-4 rounded-lg bg-ok-soft px-4 py-2 text-[13px] text-ok">Import finished: {sp.done}</p>}
      {sp.error && <p className="mt-4 rounded-lg bg-crit-soft px-4 py-2 text-[13px] text-crit">{sp.error}</p>}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="People" value={String(counts?.people ?? 0)} sub="with a Harvest id" />
        <Stat label="Projects" value={String(counts?.projects ?? 0)} sub="incl. work requests" />
        <Stat label="Entries" value={(counts?.entries ?? 0).toLocaleString()} sub={counts?.first ? `${counts.first} → ${counts.last}` : "none yet"} />
        <Stat label="Last import" value={state.lastImportAt ? relTime(state.lastImportAt) : "—"} sub={state.imported ? `${state.imported.entries.toLocaleString()} entries that run` : ""} />
      </div>
      <section className="panel mt-6 overflow-hidden">
        <div className="px-4 py-3 hairline-b">
          <h2 className="text-[14px] font-semibold">Mapping</h2>
        </div>
        <table className="w-full text-[13px]">
          <tbody>
            {MAPPING.map(([from, to, how]) => (
              <tr key={from} className="hairline-t align-top">
                <td className="w-40 px-4 py-2.5 font-medium">{from}</td>
                <td className="w-40 px-2 py-2.5 font-mono text-[12px] text-ink-2">{to}</td>
                <td className="px-4 py-2.5 text-ink-2">{how}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="panel mt-4 p-5">
        <h2 className="text-[14px] font-semibold">Run</h2>
        {env ? (
          <form action={runHarvestImport} className="mt-3 flex flex-wrap items-end gap-3">
            <Field label="Only entries updated since (optional)" help="ISO date-time, e.g. 2026-11-30T00:00:00Z — leave empty for the full history.">
              <Input name="updatedSince" placeholder="2026-11-30T00:00:00Z" className="w-72" />
            </Field>
            <Button variant="primary" type="submit" className="h-9">
              Import now
            </Button>
          </form>
        ) : (
          <div className="mt-2 text-[13px] text-ink-2">
            <p>
              Set two environment variables on the web container and restart it: <code className="rounded bg-surface-2 px-1 font-mono text-[12px]">HARVEST_ACCOUNT_ID</code> and <code className="rounded bg-surface-2 px-1 font-mono text-[12px]">HARVEST_TOKEN</code> (a personal access token from Harvest → Developers, read-only is enough).
            </p>
            <p className="mt-2 text-ink-3">The demo data on this environment was seeded to look like an import — entries before 1 Aug 2026 carry a Harvest id.</p>
          </div>
        )}
      </section>
      <section className="panel mt-4 p-5 text-[13px] text-ink-2">
        <h2 className="text-[14px] font-semibold text-ink">Cut-over plan</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Full import into this environment; check the counts above against Harvest → Reports → Detailed time.</li>
          <li>Run both tools in parallel for a week; devs log in Harvest, delta import nightly with “updated since”.</li>
          <li>Cut-over Monday: last delta, Harvest read-only, people log here. Cancel the Harvest plan before its monthly renewal.</li>
        </ol>
      </section>
    </div>
  );
}
