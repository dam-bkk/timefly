import Link from "next/link";
import { db, schema } from "@timefly/db";
import { addDays, formatHours, startOfWeek, utilisation } from "@timefly/core";
import { sql } from "drizzle-orm";
import { requireManager, todayISO } from "@/lib/auth";
import { reports, teamsList } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { cn, pct, ROLE_LABEL } from "@/lib/utils";
import { Topbar } from "@/components/shell/topbar";
import { Avatar } from "@/components/ui/avatar";
import { Empty } from "@/components/ui/empty";

export const metadata = { title: "People" };

export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ team?: string; q?: string }> }) {
  const sp = await searchParams;
  const me = await requireManager();
  const settings = await getSettings();
  const today = todayISO();
  const teamId = sp.team ? Number(sp.team) : null;
  const q = (sp.q ?? "").trim().toLowerCase();
  const [ppl, teams] = await Promise.all([reports(me, teamId), teamsList()]);
  const list = ppl.filter((p) => !q || `${p.displayName} ${p.jobTitle ?? ""}`.toLowerCase().includes(q));
  const thisWeek = startOfWeek(today, settings.weekStartsOn);
  const fourWeeksAgo = addDays(thisWeek, -28);
  const stats = list.length
    ? ((await db.execute(sql`select person_id as id,
        coalesce(sum(hours) filter (where date >= ${thisWeek}), 0)::float as week,
        coalesce(sum(hours) filter (where date >= ${fourWeeksAgo} and date < ${thisWeek}), 0)::float as four
        from time_entries where person_id in ${list.map((p) => p.id)} and date >= ${fourWeeksAgo} group by person_id`)) as unknown as { id: number; week: number; four: number }[])
    : [];
  const managers = Object.fromEntries((await db.select({ id: schema.people.id, name: schema.people.displayName }).from(schema.people)).map((m) => [m.id, m.name]));
  const teamName = Object.fromEntries(teams.map((t) => [t.id, t.name]));
  const fmt = (h: number) => formatHours(h, settings.hoursFormat, { zero: "–" });

  return (
    <>
      <Topbar crumbs={[{ label: "People" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1240px] space-y-3 px-6 py-4 rise">
          <form className="flex flex-wrap items-center gap-2">
            {me.role === "admin" && (
              <select name="team" defaultValue={teamId ?? ""} className="h-8 rounded-md bg-surface px-2 text-[13px] hairline">
                <option value="">All teams</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
            <input name="q" defaultValue={q} placeholder="Search name or title…" className="h-8 w-56 rounded-md bg-surface px-2.5 text-[13px] hairline focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--accent)]" />
            <button className="h-8 rounded-md px-2.5 text-[12.5px] font-medium text-ink-2 hairline hover:bg-surface-2">Apply</button>
            <span className="ml-auto text-[12.5px] text-ink-3">{list.length} people · utilisation = logged ÷ contracted hours, last 4 full weeks</span>
          </form>
          {list.length === 0 ? (
            <div className="panel">
              <Empty title="No one matches" />
            </div>
          ) : (
            <div className="panel overflow-hidden">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-ink-3">
                    <th className="px-4 py-2.5 font-medium hairline-b">Person</th>
                    <th className="px-3 py-2.5 font-medium hairline-b">Team</th>
                    <th className="px-3 py-2.5 font-medium hairline-b">Manager</th>
                    <th className="px-3 py-2.5 font-medium hairline-b">Role</th>
                    <th className="px-3 py-2.5 text-right font-medium hairline-b">Hours / wk</th>
                    <th className="px-3 py-2.5 text-right font-medium hairline-b">This week</th>
                    <th className="w-[200px] px-3 py-2.5 font-medium hairline-b">Utilisation (4 wk)</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((p) => {
                    const s = stats.find((x) => x.id === p.id);
                    const u = utilisation(s?.four ?? 0, p.weeklyHours * 4);
                    return (
                      <tr key={p.id} className="row hairline-b">
                        <td className="px-4 py-2">
                          <Link href={`/people/${p.id}`} className="flex items-center gap-2.5">
                            <Avatar name={p.displayName} size={26} />
                            <span className="min-w-0">
                              <span className="block truncate font-medium hover:underline">{p.displayName}</span>
                              <span className="block truncate text-[12px] text-ink-3">{p.jobTitle}</span>
                            </span>
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-ink-2">{p.teamId ? teamName[p.teamId] : "—"}</td>
                        <td className="px-3 py-2 text-ink-2">{p.managerId ? managers[p.managerId] : "—"}</td>
                        <td className="px-3 py-2 text-ink-2">{ROLE_LABEL[p.role]}</td>
                        <td className="tnum px-3 py-2 text-right">{p.weeklyHours}</td>
                        <td className="tnum px-3 py-2 text-right font-medium">{fmt(s?.week ?? 0)}</td>
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-2">
                            <span className="bar w-24">
                              <i style={{ width: `${Math.min(100, Math.round(u * 100))}%`, background: u < 0.7 ? "var(--warn)" : u > 1.15 ? "var(--info)" : "var(--accent)" }} />
                            </span>
                            <span className={cn("tnum text-[12px]", u < 0.7 ? "text-warn" : "text-ink-2")}>{pct(u)}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
