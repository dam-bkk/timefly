import Link from "next/link";
import { Plus } from "lucide-react";
import { budgetBurn, formatHours, monthBounds, monthLabel } from "@timefly/core";
import { requirePrincipal, todayISO } from "@/lib/auth";
import { projectList } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { cn, pct } from "@/lib/utils";
import { Topbar } from "@/components/shell/topbar";
import { ButtonLink } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { ProjectStatusPill } from "@/components/ui/pills";

export const metadata = { title: "Projects" };

const TABS: [string, string][] = [["project", "Projects"], ["work_request", "Work requests"], ["internal", "Internal"]];

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ kind?: string; status?: string; q?: string }> }) {
  const sp = await searchParams;
  const me = await requirePrincipal();
  const settings = await getSettings();
  const today = todayISO();
  const { from, to } = monthBounds(today);
  const kind = TABS.some(([k]) => k === sp.kind) ? sp.kind! : "project";
  const status = sp.status ?? "active";
  const q = (sp.q ?? "").trim().toLowerCase();
  const all = await projectList(from, to);
  const rows = all.filter((p) => p.kind === kind && (status === "all" || p.status === status) && (!q || `${p.code} ${p.name} ${p.ticketRef ?? ""} ${p.teamName ?? ""} ${p.ownerName ?? ""}`.toLowerCase().includes(q)));
  const counts = Object.fromEntries(TABS.map(([k]) => [k, all.filter((p) => p.kind === k && (status === "all" || p.status === status)).length]));
  const fmt = (h: number) => formatHours(h, settings.hoursFormat, { zero: "–" });

  return (
    <>
      <Topbar crumbs={[{ label: "Projects" }]} actions={me.role !== "member" ? <ButtonLink href="/projects/new" size="sm" variant="primary"><Plus className="size-3.5" /> New</ButtonLink> : undefined} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1280px] space-y-3 px-6 py-4 rise">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-lg bg-surface-2 p-0.5">
              {TABS.map(([k, label]) => (
                <Link key={k} href={`/projects?kind=${k}&status=${status}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={cn("inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium", kind === k ? "bg-surface text-ink shadow-1" : "text-ink-2 hover:text-ink")}>
                  {label}
                  <span className="tnum text-[11px] text-ink-3">{counts[k]}</span>
                </Link>
              ))}
            </div>
            <form className="ml-auto flex items-center gap-2">
              <input type="hidden" name="kind" value={kind} />
              <select name="status" defaultValue={status} className="h-8 rounded-md bg-surface px-2 text-[13px] hairline">
                <option value="active">Active</option>
                <option value="on_hold">On hold</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
                <option value="all">All statuses</option>
              </select>
              <input name="q" defaultValue={q} placeholder="Search code, name, SR ref…" className="h-8 w-56 rounded-md bg-surface px-2.5 text-[13px] hairline focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--accent)]" />
              <button className="h-8 rounded-md px-2.5 text-[12.5px] font-medium text-ink-2 hairline hover:bg-surface-2">Apply</button>
            </form>
          </div>

          {rows.length === 0 ? (
            <div className="panel">
              <Empty title="Nothing here" hint="Try another status, or create the first one." action={me.role !== "member" ? <ButtonLink href="/projects/new" size="sm">New project</ButtonLink> : undefined} />
            </div>
          ) : (
            <div className="panel overflow-hidden">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-ink-3">
                    <th className="px-4 py-2.5 font-medium hairline-b">{kind === "work_request" ? "Work request" : kind === "internal" ? "Category" : "Project"}</th>
                    <th className="px-3 py-2.5 font-medium hairline-b">Team</th>
                    <th className="px-3 py-2.5 font-medium hairline-b">Owner</th>
                    <th className="px-3 py-2.5 text-right font-medium hairline-b">People</th>
                    <th className="px-3 py-2.5 text-right font-medium hairline-b">{monthLabel(today)}</th>
                    <th className="px-3 py-2.5 text-right font-medium hairline-b">All time</th>
                    <th className="w-[200px] px-3 py-2.5 font-medium hairline-b">Budget</th>
                    <th className="px-3 py-2.5 font-medium hairline-b">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const burn = budgetBurn(p.hours, p.budgetHours);
                    return (
                      <tr key={p.id} className="row hairline-b">
                        <td className="px-4 py-2">
                          <Link href={`/projects/${p.id}`} className="block min-w-0">
                            <span className="flex items-center gap-2">
                              <span className="truncate font-medium hover:underline">{p.name}</span>
                              
                            </span>
                            <span className="block font-mono text-[11px] text-ink-3">
                              {p.code}
                              {p.clientName ? <span className="font-sans"> · {p.clientName}</span> : null}
                            </span>
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-ink-2">{p.teamName ?? "—"}</td>
                        <td className="px-3 py-2 text-ink-2">{p.ownerName ?? "—"}</td>
                        <td className="tnum px-3 py-2 text-right">{p.people}</td>
                        <td className="tnum px-3 py-2 text-right">{fmt(p.hoursMonth)}</td>
                        <td className="tnum px-3 py-2 text-right font-medium">{fmt(p.hours)}</td>
                        <td className="px-3 py-2">
                          {burn.state === "none" ? (
                            <span className="text-[12px] text-ink-4">No budget</span>
                          ) : (
                            <span className="flex items-center gap-2">
                              <span className="bar w-20">
                                <i style={{ width: `${Math.min(100, Math.round((burn.ratio ?? 0) * 100))}%`, background: burn.state === "over" ? "var(--crit)" : burn.state === "warn" ? "var(--warn)" : "var(--accent)" }} />
                              </span>
                              <span className={cn("tnum whitespace-nowrap text-[12px]", burn.state === "over" ? "text-crit" : burn.state === "warn" ? "text-warn" : "text-ink-2")}>
                                {pct(burn.ratio ?? 0)} of {burn.budget}
                              </span>
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <ProjectStatusPill status={p.status} />
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
