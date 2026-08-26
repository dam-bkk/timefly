import Link from "next/link";
import { Download } from "lucide-react";
import { recentActivity } from "@/lib/queries";
import { cn, longTime } from "@/lib/utils";

export const metadata = { title: "Activity log" };

const CATS = ["", "timesheet", "project", "person", "settings", "auth", "integration", "report", "system"];

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const rows = await recentActivity(300, category || undefined);
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold tracking-[-0.01em]">Activity log</h1>
          <p className="text-[13px] text-ink-3">Every write: who, what, from where, before/after, and the release it ran on. Append-only.</p>
        </div>
        <a href={`/api/activity.csv${category ? `?category=${category}` : ""}`} className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium text-ink hairline hover:bg-surface-2">
          <Download className="size-3.5" /> Export CSV
        </a>
      </div>
      <div className="mt-4 flex flex-wrap gap-1">
        {CATS.map((c) => (
          <Link key={c} href={c ? `/admin/activity?category=${c}` : "/admin/activity"} className={cn("rounded-md px-2.5 py-1 text-[12.5px] font-medium hairline hover:bg-surface-2", (category ?? "") === c && "bg-accent-soft text-accent-ink")}>
            {c || "All"}
          </Link>
        ))}
      </div>
      <section className="panel mt-4 overflow-hidden">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-left text-ink-3">
              <th className="px-4 py-2.5 font-medium hairline-b">When</th>
              <th className="px-3 py-2.5 font-medium hairline-b">Who</th>
              <th className="px-3 py-2.5 font-medium hairline-b">Action</th>
              <th className="px-3 py-2.5 font-medium hairline-b">Target</th>
              <th className="px-3 py-2.5 font-medium hairline-b">Change</th>
              <th className="px-3 py-2.5 font-medium hairline-b">IP</th>
              <th className="px-3 py-2.5 font-medium hairline-b">Rel.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="hairline-b align-top">
                <td className="tnum whitespace-nowrap px-4 py-2 text-ink-2">{longTime(a.ts)}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  <span className="font-medium">{a.actorName}</span>
                  {a.actorType !== "user" && <span className="block text-[11px] text-ink-3">{a.actorType}</span>}
                </td>
                <td className="px-3 py-2 font-mono text-[12px]">{a.action}</td>
                <td className="px-3 py-2 text-ink-2">
                  {a.targetType} {a.targetId}
                </td>
                <td className="max-w-[320px] px-3 py-2 font-mono text-[11px] text-ink-2">
                  {a.before ? <span className="block truncate text-crit/80">− {JSON.stringify(a.before)}</span> : null}
                  {a.after ? <span className="block truncate text-ok/90">+ {JSON.stringify(a.after)}</span> : null}
                </td>
                <td className="tnum px-3 py-2 text-ink-3">{a.ip}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-ink-3">{a.release}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
