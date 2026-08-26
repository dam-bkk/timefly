"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const PAGES: [string, string, string][] = [
  ["/admin", "Overview", "What is on and what needs attention"],
  ["/admin/general", "Timesheet rules", "Week start, day target, rounding, approvals, reminders"],
  ["/admin/tasks", "Tasks", "The kinds of work people can log"],
  ["/admin/teams", "Teams", "Groups and their leads"],
  ["/admin/import", "Harvest import", "Bring the history across, then cut over"],
  ["/admin/activity", "Activity log", "Every write, who, when, before/after"],
  ["/admin/releases", "Releases", "What changed in each build"],
  ["/admin/status", "System status", "Jobs, backup age, data counts"],
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="w-[248px] shrink-0 overflow-y-auto bg-surface px-3 py-4 hairline-r">
      <p className="label mb-2 px-1">Admin</p>
      {PAGES.map(([href, label, hint]) => (
        <Link key={href} href={href} className={cn("block rounded-md px-2 py-1.5 text-[13px] text-ink-2 hover:bg-surface-2 hover:text-ink", path === href && "bg-accent-soft font-medium text-accent-ink hover:bg-accent-soft hover:text-accent-ink")}>
          {label}
          <span className={cn("block text-[11px] font-normal leading-snug text-ink-3", path === href && "text-accent-ink/70")}>{hint}</span>
        </Link>
      ))}
      <p className="mt-6 px-2 text-[11px] leading-relaxed text-ink-3">People and roles live under <Link href="/people" className="text-accent-ink hover:underline">People</Link>. Production identity comes from Entra ID; roles map from app roles.</p>
    </nav>
  );
}
