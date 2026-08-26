"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, FolderKanban, Settings, ShieldCheck, Users, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { QiMark } from "@/components/ui/logo";
import { Avatar } from "@/components/ui/avatar";
import { PersonaMenu } from "./persona-menu";

type Leaf = { href: string; label: string; icon: React.ReactNode; badge?: number; tone?: "warn" | "crit" };

/** Responsive contract: full 220px rail at ≥1200px; below that an icon-only 48px rail (labels via `title`, badges kept). */
export function Sidebar({ me, counts, version, env }: { me: { displayName: string; jobTitle: string | null; role: string }; counts: { missing: number; team: number }; version: string; env: string }) {
  const path = usePathname();
  const manager = me.role !== "member";
  const items: Leaf[] = [
    { href: "/time", label: "My timesheet", icon: <CalendarDays className="size-4" />, badge: counts.missing, tone: "crit" },
    ...(manager ? [{ href: "/team", label: "Team", icon: <UsersRound className="size-4" />, badge: counts.team, tone: "warn" as const }] : []),
    { href: "/projects", label: "Projects", icon: <FolderKanban className="size-4" /> },
    { href: "/reports", label: "Reports", icon: <BarChart3 className="size-4" /> },
    ...(manager ? [{ href: "/people", label: "People", icon: <Users className="size-4" /> }] : []),
    ...(me.role === "admin" ? [{ href: "/admin", label: "Admin", icon: <Settings className="size-4" /> }] : []),
  ];
  return (
    <aside className={cn("flex h-full w-12 shrink-0 flex-col bg-surface hairline-r", "min-[1200px]:w-[220px]")}>
      <div className={cn("flex h-12 items-center justify-center", "min-[1200px]:justify-start min-[1200px]:px-4")}>
        <Link href="/time" title="Timesheets" className="inline-flex items-center gap-2 rounded-md leading-none">
          <QiMark size={20} />
          <span className={cn("hidden text-[13.5px] font-medium tracking-[-0.01em] text-ink", "min-[1200px]:inline")}>Timesheets</span>
        </Link>
      </div>
      <nav className={cn("flex-1 overflow-y-auto px-1 pb-2 pt-1", "min-[1200px]:px-2")}>
        <ul className="space-y-px">
          {items.map((l) => {
            const on = path === l.href || path.startsWith(l.href + "/");
            const tint = l.tone === "crit" ? "bg-crit-soft text-crit" : l.tone === "warn" ? "bg-warn-soft text-warn" : "bg-surface-2 text-ink-3";
            return (
              <li key={l.href}>
                <Link href={l.href} title={l.label} className={cn("group relative flex h-8 items-center justify-center gap-2.5 rounded-md text-[13.5px] font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink", "min-[1200px]:justify-start min-[1200px]:px-2", on && "bg-accent-soft text-accent-ink hover:bg-accent-soft hover:text-accent-ink")}>
                  <span className={cn("text-ink-3 group-hover:text-ink", on && "text-accent-ink group-hover:text-accent-ink")}>{l.icon}</span>
                  <span className={cn("hidden flex-1 truncate", "min-[1200px]:block")}>{l.label}</span>
                  {l.badge ? (
                    <>
                      <span className={cn("tnum hidden rounded px-1.5 text-[11px] font-medium", tint, "min-[1200px]:inline")}>{l.badge}</span>
                      <span className={cn("tnum absolute -right-0.5 -top-0.5 rounded px-1 text-[11px] font-medium leading-4", tint, "min-[1200px]:hidden")}>{l.badge}</span>
                    </>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {/* pb-12 reserves the bottom-left zone that dev overlays (Next indicator, View-as bar) sit over. */}
      <div className="p-2 pb-12 hairline-t">
        <PersonaMenu me={me}>
          <button title={`${me.displayName} · ${me.jobTitle ?? me.role}`} className={cn("flex w-full items-center justify-center gap-2.5 rounded-md px-1 py-2 text-left transition-colors hover:bg-surface-2", "min-[1200px]:justify-start min-[1200px]:px-2")}>
            <Avatar name={me.displayName} size={26} />
            <span className={cn("hidden min-w-0 flex-1", "min-[1200px]:block")}>
              <span className="block truncate text-[12.5px] font-medium">{me.displayName}</span>
              <span className="block truncate text-[11px] text-ink-3">{me.jobTitle ?? me.role}</span>
            </span>
          </button>
        </PersonaMenu>
        <p className={cn("mt-1 hidden items-center gap-1.5 px-2 font-mono text-[11px] text-ink-3", "min-[1200px]:flex")}>
          <ShieldCheck className="size-3" /> v{version} · {env}
        </p>
      </div>
    </aside>
  );
}
