"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, CalendarDays, FolderKanban, PanelLeft, PanelLeftClose, Settings, Users, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { QiMark } from "@/components/ui/logo";
import { Avatar } from "@/components/ui/avatar";
import { PersonaMenu } from "./persona-menu";

type Leaf = { href: string; label: string; icon: React.ReactNode; badge?: number; tone?: "warn" | "crit" };

const KEY = "sidebar:locked";

/**
 * Icon rail (WEB360 pattern): 56px of icons, expands to 208px on hover as an overlay, and a lock button pins it
 * open in the flow. The choice persists in localStorage + a cookie (so the server renders the right width).
 */
export function Sidebar({ me, counts, version, env, lockedInitial }: { me: { displayName: string; jobTitle: string | null; role: string }; counts: { missing: number; team: number }; version: string; env: string; lockedInitial: boolean }) {
  const rawPath = usePathname();
  const params = useSearchParams();
  // Reviewing someone else's week from Team is a Team activity, not "my timesheet".
  const path = rawPath === "/time" && params.get("person") ? "/team" : rawPath;
  const [locked, setLocked] = useState(lockedInitial);
  useEffect(() => {
    const v = localStorage.getItem(KEY);
    if (v !== null) setLocked(v === "1");
  }, []);
  useEffect(() => {
    document.documentElement.dataset.sidebar = locked ? "locked" : "rail";
  }, [locked]);
  const toggle = () =>
    setLocked((v) => {
      const next = !v;
      localStorage.setItem(KEY, next ? "1" : "0");
      document.cookie = `tl_sidebar=${next ? "locked" : "rail"}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });

  const manager = me.role !== "member";
  const items: Leaf[] = [
    { href: "/time", label: "My timesheet", icon: <CalendarDays className="size-[18px]" />, badge: counts.missing, tone: "crit" },
    ...(manager ? [{ href: "/team", label: "Team", icon: <UsersRound className="size-[18px]" />, badge: counts.team, tone: "warn" as const }] : []),
    { href: "/projects", label: "Projects", icon: <FolderKanban className="size-[18px]" /> },
    { href: "/reports", label: "Reports", icon: <BarChart3 className="size-[18px]" /> },
    ...(manager ? [{ href: "/people", label: "People", icon: <Users className="size-[18px]" /> }] : []),
    ...(me.role === "admin" ? [{ href: "/admin", label: "Admin", icon: <Settings className="size-[18px]" /> }] : []),
  ];

  return (
    <aside className={cn("relative z-40 h-full shrink-0 transition-[width] duration-200 ease-out", locked ? "w-[208px]" : "w-14")} aria-label="Primary navigation">
      <div className={cn("group/rail absolute inset-y-0 left-0 flex w-14 flex-col overflow-hidden bg-surface hairline-r transition-[width,box-shadow] duration-200 ease-out", locked ? "w-[208px]" : "hover:w-[208px] hover:shadow-3")}>
        <Link href="/time" title="Timesheets" className="flex h-12 shrink-0 items-center gap-3 px-[18px]">
          <QiMark size={20} className="shrink-0" />
          <span className={cn("whitespace-nowrap text-[13.5px] font-medium tracking-[-0.01em] text-ink transition-opacity", locked ? "opacity-100" : "opacity-0 group-hover/rail:opacity-100")}>Timesheets</span>
        </Link>
        <nav className="flex-1 px-2 pt-1">
          <ul className="space-y-0.5">
            {items.map((l) => {
              const on = path === l.href || path.startsWith(l.href + "/");
              const tint = l.tone === "crit" ? "bg-crit text-white" : l.tone === "warn" ? "bg-warn text-white" : "bg-surface-3 text-ink-2";
              return (
                <li key={l.href}>
                  <Link href={l.href} title={locked ? undefined : l.label} className={cn("group relative flex h-10 items-center gap-3 rounded-md px-[11px] text-[13.5px] font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink", on && "bg-accent-soft text-accent-ink hover:bg-accent-soft hover:text-accent-ink")}>
                    <span className={cn("relative shrink-0 text-ink-3 group-hover:text-ink", on && "text-accent-ink group-hover:text-accent-ink")}>
                      {l.icon}
                      {l.badge ? <span className={cn("tnum absolute -right-2 -top-1.5 min-w-[16px] rounded-full px-1 text-center text-[10px] font-semibold leading-4", tint, locked ? "hidden" : "group-hover/rail:hidden")}>{l.badge}</span> : null}
                    </span>
                    <span className={cn("flex-1 truncate whitespace-nowrap transition-opacity", locked ? "opacity-100" : "opacity-0 group-hover/rail:opacity-100")}>{l.label}</span>
                    {l.badge ? <span className={cn("tnum rounded-full px-1.5 text-[11px] font-semibold leading-4", tint, locked ? "" : "opacity-0 group-hover/rail:opacity-100")}>{l.badge}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        {/* pb-12 reserves the bottom-left zone that dev overlays (Next indicator, View-as bar) sit over. */}
        <div className="shrink-0 space-y-0.5 px-2 pb-12 pt-2 hairline-t">
          <button type="button" onClick={toggle} aria-pressed={locked} title={locked ? "Unlock sidebar" : "Lock sidebar open"} className="flex h-9 w-full items-center gap-3 rounded-md px-[11px] text-[12.5px] text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink">
            <span className="shrink-0">{locked ? <PanelLeftClose className="size-[18px]" /> : <PanelLeft className="size-[18px]" />}</span>
            <span className={cn("whitespace-nowrap transition-opacity", locked ? "opacity-100" : "opacity-0 group-hover/rail:opacity-100")}>{locked ? "Unlock" : "Lock open"}</span>
          </button>
          <PersonaMenu me={me}>
            <button title={`${me.displayName} · ${me.jobTitle ?? me.role}`} className="flex h-11 w-full items-center gap-3 rounded-md px-[8px] text-left transition-colors hover:bg-surface-2">
              <Avatar name={me.displayName} size={24} className="shrink-0" />
              <span className={cn("min-w-0 flex-1 transition-opacity", locked ? "opacity-100" : "opacity-0 group-hover/rail:opacity-100")}>
                <span className="block truncate text-[12.5px] font-medium">{me.displayName}</span>
                <span className="block truncate text-[11px] text-ink-3">{me.jobTitle ?? me.role}</span>
              </span>
            </button>
          </PersonaMenu>
          <p className={cn("truncate whitespace-nowrap px-[11px] font-mono text-[10.5px] text-ink-4 transition-opacity", locked ? "opacity-100" : "opacity-0 group-hover/rail:opacity-100")}>
            v{version} · {env}
          </p>
        </div>
      </div>
    </aside>
  );
}
