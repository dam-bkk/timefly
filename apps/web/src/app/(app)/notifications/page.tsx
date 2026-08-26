import Link from "next/link";
import { db, schema } from "@timefly/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import { BellRing, Check, CheckCheck, RotateCcw, Send, UserPlus } from "lucide-react";
import { requirePrincipal } from "@/lib/auth";
import { cn, relTime } from "@/lib/utils";
import { Topbar } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { markAllRead, markRead } from "./actions";

export const metadata = { title: "Notifications" };

const ICON: Record<string, React.ReactNode> = { reminder: <BellRing className="size-4 text-warn" />, approved: <Check className="size-4 text-ok" />, reopened: <RotateCcw className="size-4 text-warn" />, submitted: <Send className="size-4 text-info" />, assigned: <UserPlus className="size-4 text-accent-ink" /> };

export default async function NotificationsPage() {
  const me = await requirePrincipal();
  const rows = await db.select().from(schema.notifications).where(eq(schema.notifications.personId, me.id)).orderBy(desc(schema.notifications.createdAt)).limit(100);
  const unread = rows.filter((r) => !r.readAt).length;
  void and;
  void isNull;
  return (
    <>
      <Topbar
        crumbs={[{ label: "Notifications" }]}
        actions={
          unread > 0 ? (
            <form action={markAllRead}>
              <Button size="sm" type="submit">
                <CheckCheck className="size-3.5" /> Mark all read
              </Button>
            </form>
          ) : undefined
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[760px] px-6 py-4 rise">
          {rows.length === 0 ? (
            <div className="panel">
              <Empty title="Nothing yet" hint="Reminders, approvals and assignments land here." />
            </div>
          ) : (
            <ul className="panel divide-y divide-line overflow-hidden">
              {rows.map((n) => (
                <li key={n.id} className={cn("flex items-start gap-3 px-4 py-3", !n.readAt && "bg-accent-soft/30")}>
                  <span className="mt-0.5">{ICON[n.kind] ?? <BellRing className="size-4 text-ink-3" />}</span>
                  <span className="min-w-0 flex-1">
                    <Link href={n.href ?? "#"} className="block text-[13.5px] font-medium hover:underline">
                      {n.title}
                    </Link>
                    {n.body && <span className="block text-[12.5px] text-ink-2">{n.body}</span>}
                    <span className="block text-[11.5px] text-ink-3">{relTime(n.createdAt)}</span>
                  </span>
                  {!n.readAt && (
                    <form action={markRead.bind(null, n.id)}>
                      <button className="inline-flex size-7 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink" title="Mark read">
                        <Check className="size-4" />
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
