import { requireAdmin } from "@/lib/auth";
import { Topbar } from "@/components/shell/topbar";
import { AdminNav } from "./nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <>
      <Topbar crumbs={[{ label: "Admin" }]} />
      <div className="flex min-h-0 flex-1">
        <AdminNav />
        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1040px] px-8 py-7 rise">{children}</div>
        </div>
      </div>
    </>
  );
}
