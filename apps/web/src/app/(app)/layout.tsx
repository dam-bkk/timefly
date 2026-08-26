import { cookies } from "next/headers";
import { APP_ENV, APP_VERSION, requirePrincipal } from "@/lib/auth";
import { missingFor, teamWeek, weekContext } from "@/lib/queries";
import { Sidebar } from "@/components/shell/sidebar";
import { ViewAsBar } from "@/components/shell/view-as";
import { viewAsContext } from "@/lib/view-as";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requirePrincipal();
  const { weekStart } = await weekContext();
  const missing = await missingFor(me.id, me.weeklyHours, weekStart);
  const team = me.role === "member" ? [] : await teamWeek(me, weekStart);
  const teamOpen = team.filter((r) => r.missing > 0 || (r.sheet && r.sheet.status === "submitted")).length;
  const va = await viewAsContext(me);
  const lockedInitial = (await cookies()).get("tl_sidebar")?.value === "locked";
  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar me={me} counts={{ missing: missing.length, team: teamOpen }} version={APP_VERSION} env={APP_ENV} lockedInitial={lockedInitial} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      {va && <ViewAsBar people={va.people} viewing={va.viewing} />}
    </div>
  );
}
