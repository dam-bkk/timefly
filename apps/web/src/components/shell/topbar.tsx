import Link from "next/link";
import { Bell, ChevronRight } from "lucide-react";
import { CommandPalette } from "./command-palette";
import { cn } from "@/lib/utils";
import { getPrincipal } from "@/lib/auth";
import { unreadCount } from "@/lib/queries";

export async function Topbar({ crumbs, actions, className }: { crumbs: { label: string; href?: string }[]; actions?: React.ReactNode; className?: string }) {
  const me = await getPrincipal();
  const unread = me ? await unreadCount(me.id) : 0;
  return (
    <header className={cn("flex h-12 shrink-0 items-center gap-3 bg-surface px-4 hairline-b", className)}>
      <nav className="flex min-w-0 items-center gap-1 text-[13px]">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="size-3.5 text-ink-3" />}
            {c.href ? (
              <Link href={c.href} className="rounded text-ink-2 hover:text-ink">
                {c.label}
              </Link>
            ) : (
              <span className="truncate font-medium text-ink">{c.label}</span>
            )}
          </span>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <CommandPalette manager={!!me && me.role !== "member"} />
        <Link href="/notifications" aria-label="Notifications" className="relative inline-flex size-8 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink">
          <Bell className="size-4" />
          {unread > 0 && <span className="tnum absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-crit px-1 text-center text-[10px] font-semibold leading-4 text-white">{unread}</span>}
        </Link>
        {actions}
      </div>
    </header>
  );
}
