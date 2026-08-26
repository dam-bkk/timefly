"use client";

import { Plus, X } from "lucide-react";
import { useState, useTransition } from "react";
import { addAssignment, removeAssignment } from "../actions";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

type P = { id: number; displayName: string; jobTitle: string | null; team: string | null };

export function Assign({ projectId, assigned, candidates, canEdit, hours }: { projectId: number; assigned: P[]; candidates: P[]; canEdit: boolean; hours: Record<number, number> }) {
  const [pending, start] = useTransition();
  const [sel, setSel] = useState<number | "">("");
  return (
    <div>
      <ul className="divide-y divide-line">
        {assigned.length === 0 && <li className="py-3 text-[12.5px] text-ink-3">No one assigned yet.</li>}
        {assigned.map((p) => (
          <li key={p.id} className="flex items-center gap-2.5 py-2">
            <Avatar name={p.displayName} size={24} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">{p.displayName}</span>
              <span className="block truncate text-[11.5px] text-ink-3">
                {p.jobTitle}
                {p.team ? ` · ${p.team}` : ""}
              </span>
            </span>
            <span className="tnum text-[12.5px] text-ink-2">{hours[p.id] ? `${hours[p.id]} h` : ""}</span>
            {canEdit && (
              <button type="button" disabled={pending} onClick={() => start(() => removeAssignment(projectId, p.id))} title="Remove" className="inline-flex size-6 items-center justify-center rounded text-ink-4 hover:bg-crit-soft hover:text-crit">
                <X className="size-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (sel === "") return;
            start(async () => {
              await addAssignment(projectId, sel);
              setSel("");
            });
          }}
        >
          <select value={sel} onChange={(e) => setSel(e.target.value ? Number(e.target.value) : "")} className="h-8 flex-1 rounded-md bg-surface px-2 text-[13px] hairline">
            <option value="">Add someone…</option>
            {candidates.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
                {p.team ? ` — ${p.team}` : ""}
              </option>
            ))}
          </select>
          <Button size="sm" type="submit" disabled={pending || sel === ""}>
            <Plus className="size-3.5" /> Assign
          </Button>
        </form>
      )}
    </div>
  );
}
