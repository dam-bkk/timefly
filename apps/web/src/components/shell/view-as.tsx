"use client";

import { Eye, Search, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { setViewAs } from "@/app/actions";
import { cn } from "@/lib/utils";

type P = { id: number; displayName: string; role: string; jobTitle: string | null; department: string | null };
const ROLES: [string, string][] = [["admin", "Admin"], ["manager", "Manager"], ["member", "Member"]];

/**
 * "View as" — same bar as PolyQi: fixed bottom-centre pill, one button per role, red = active, × to exit.
 * Only rendered for the real signed-in admin. Picking a role views as the first person with that role; the search
 * picks a specific person.
 */
export function ViewAsBar({ people, viewing }: { people: P[]; viewing: { id: number; displayName: string; role: string } | null }) {
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const byRole = useMemo(() => Object.fromEntries(ROLES.map(([r]) => [r, people.find((p) => p.role === r)])), [people]);
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? people.filter((p) => `${p.displayName} ${p.jobTitle} ${p.department} ${p.role}`.toLowerCase().includes(t)).slice(0, 6) : [];
  }, [q, people]);
  const activeRole = viewing?.role ?? "admin";
  return (
    <div className="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2" aria-live="polite">
      {open && (
        <div className="mb-2 w-[340px] rounded-xl bg-surface p-2 shadow-3 hairline">
          <label className="flex h-8 items-center gap-2 rounded-md bg-surface-2 px-2 text-[12.5px]">
            <Search className="size-3.5 text-ink-3" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Anyone by name, role, department" className="flex-1 bg-transparent outline-none" />
          </label>
          <ul className="mt-1 max-h-56 overflow-y-auto">
            {matches.map((p) => (
              <li key={p.id}>
                <button onClick={() => start(() => setViewAs(p.id))} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] hover:bg-surface-2">
                  <span className="min-w-0 flex-1 truncate">{p.displayName} <span className="text-ink-3">· {p.jobTitle}</span></span>
                  <span className="text-[10.5px] capitalize text-ink-3">{p.role}</span>
                </button>
              </li>
            ))}
            {q && matches.length === 0 && <li className="px-2 py-2 text-[12px] text-ink-3">No one matches.</li>}
          </ul>
        </div>
      )}
      <div className={cn("flex items-center gap-2 rounded-xl px-3.5 py-2 text-white shadow-[0_4px_20px_rgba(40,58,106,.45)]", viewing ? "ring-[1.5px] ring-[#EB2A31]" : "ring-1 ring-white/15")} style={{ background: "#283A6A" }} aria-busy={pending}>
        <Eye className={cn("size-3.5 shrink-0", viewing ? "text-[#FF6B62]" : "text-white/50")} />
        <span className="whitespace-nowrap text-[11.5px] font-medium text-white/60">View as</span>
        <div className="flex gap-1">
          {ROLES.map(([role, label]) => {
            const active = activeRole === role;
            const target = byRole[role];
            return (
              <button key={role} type="button" disabled={pending || (!target && role !== "admin")} onClick={() => start(() => setViewAs(role === "admin" ? null : (target?.id ?? null)))} title={viewing && active ? viewing.displayName : target?.displayName} className={cn("rounded-[7px] px-2.5 py-1 text-[11.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60", active ? "bg-[#EB2A31] text-white" : "bg-white/10 text-white/60 hover:bg-white/15 hover:text-white")}>
                {label}
              </button>
            );
          })}
          <button type="button" onClick={() => setOpen((o) => !o)} className={cn("shrink-0 whitespace-nowrap rounded-[7px] px-2.5 py-1 text-[11.5px] font-semibold", open ? "bg-white/20 text-white" : "bg-white/10 text-white/60 hover:bg-white/15 hover:text-white")} title="Pick a specific person">
            Person…
          </button>
        </div>
        {viewing && (
          <>
            <span className="max-w-[160px] truncate text-[11.5px] text-white/70">{viewing.displayName}</span>
            <button type="button" onClick={() => start(() => setViewAs(null))} disabled={pending} aria-label="Exit view as" className="flex items-center text-white/50 hover:text-white">
              <X className="size-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
