"use client";

import * as Popover from "@radix-ui/react-popover";
import { Copy, MessageSquare, Pause, Play, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { dayStates, formatHours, isWeekend, parseHours, shortDate, shortDay, sumHours, type HoursFormat } from "@timefly/core";
import { cn } from "@/lib/utils";
import { DAY_TONE, DayDot, KindTag } from "@/components/ui/pills";
import { Button } from "@/components/ui/button";
import { deleteRow, rowsFromLastWeek, saveCell, startTimer, stopTimer, type SavedCell } from "./actions";

export type Cell = { id: number | null; hours: number; notes: string | null; timerStartedAt: string | null };
export type GridRow = { projectId: number; taskId: number; projectCode: string; projectName: string; projectKind: string; taskName: string; cells: Record<string, Cell> };
export type Option = { id: number; code?: string; name: string; kind?: string; assigned?: boolean; active?: boolean };

const EMPTY: Cell = { id: null, hours: 0, notes: null, timerStartedAt: null };
const rowKey = (r: { projectId: number; taskId: number }) => `${r.projectId}:${r.taskId}`;

/**
 * The weekly grid: rows = project × task, columns = days. Type hours the way you like ("1:30", "1.5", "90m"),
 * Enter moves down, arrows move around, notes live behind the small bubble in each cell. Every change saves on blur.
 */
export function WeekGrid({ personId, self, weekStart, days, today, rows: initial, projects, tasks, canEdit, hoursFormat, dayTarget, holidays }: { personId: number; self: boolean; weekStart: string; days: string[]; today: string; rows: GridRow[]; projects: Option[]; tasks: Option[]; canEdit: boolean; hoursFormat: HoursFormat; dayTarget: number; holidays: string[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<GridRow[]>(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [addP, setAddP] = useState<number | "">("");
  const [addT, setAddT] = useState<number | "">("");
  const [now, setNow] = useState(() => Date.now());
  const gridRef = useRef<HTMLTableElement>(null);
  useEffect(() => setRows(initial), [initial]);
  const anyTimer = rows.some((r) => Object.values(r.cells).some((c) => c.timerStartedAt));
  useEffect(() => {
    if (!anyTimer) return;
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, [anyTimer]);

  const entries = useMemo(() => rows.flatMap((r) => days.map((d) => ({ date: d, hours: r.cells[d]?.hours ?? 0 }))), [rows, days]);
  const states = useMemo(() => dayStates(days, entries, { today, target: dayTarget, holidays }), [days, entries, today, dayTarget, holidays]);
  const dayTotal = (d: string) => sumHours(rows.map((r) => r.cells[d]?.hours));
  const rowTotal = (r: GridRow) => sumHours(days.map((d) => r.cells[d]?.hours));
  const weekTotal = sumHours(days.map(dayTotal));

  const apply = useCallback((key: string, date: string, saved: SavedCell) => {
    setRows((rs) => rs.map((r) => (rowKey(r) === key ? { ...r, cells: { ...r.cells, [date]: saved ? { id: saved.id, hours: saved.hours, notes: saved.notes, timerStartedAt: saved.timerStartedAt } : EMPTY } } : r)));
  }, []);

  const run = (fn: () => Promise<void>) =>
    start(async () => {
      try {
        setError(null);
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
        router.refresh();
      }
    });

  const commitHours = (r: GridRow, date: string, raw: string) => {
    const parsed = parseHours(raw);
    const current = r.cells[date] ?? EMPTY;
    if (parsed === null && raw.trim() !== "") return { ok: false as const };
    const next = parsed ?? 0;
    if (next === current.hours) return { ok: true as const };
    apply(rowKey(r), date, current.id || next ? { id: current.id ?? -1, hours: next, notes: current.notes, timerStartedAt: current.timerStartedAt } : null);
    run(async () => {
      const saved = await saveCell({ personId, projectId: r.projectId, taskId: r.taskId, date, hours: parsed });
      apply(rowKey(r), date, saved);
    });
    return { ok: true as const };
  };

  const commitNotes = (r: GridRow, date: string, notes: string) => {
    const current = r.cells[date] ?? EMPTY;
    if ((notes.trim() || null) === current.notes) return;
    run(async () => {
      const saved = await saveCell({ personId, projectId: r.projectId, taskId: r.taskId, date, hours: current.hours || null, notes });
      apply(rowKey(r), date, saved);
    });
  };

  const addRow = () => {
    if (addP === "" || addT === "") return;
    const p = projects.find((x) => x.id === addP)!;
    const t = tasks.find((x) => x.id === addT)!;
    if (rows.some((r) => r.projectId === p.id && r.taskId === t.id)) return;
    setRows((rs) => [...rs, { projectId: p.id, taskId: t.id, projectCode: p.code ?? "", projectName: p.name, projectKind: p.kind ?? "project", taskName: t.name, cells: {} }]);
    setAddP("");
    setAddT("");
    setTimeout(() => (gridRef.current?.querySelector<HTMLInputElement>(`tr:nth-last-child(1) input[data-day]`) ?? null)?.focus(), 30);
  };

  const removeRow = (r: GridRow) => {
    setRows((rs) => rs.filter((x) => rowKey(x) !== rowKey(r)));
    if (Object.values(r.cells).some((c) => c.id)) run(() => deleteRow({ personId, weekStart, projectId: r.projectId, taskId: r.taskId }));
  };

  const copyLast = () =>
    run(async () => {
      const keys = await rowsFromLastWeek({ personId, weekStart });
      setRows((rs) => {
        const have = new Set(rs.map(rowKey));
        const extra = keys
          .filter((k) => !have.has(rowKey(k)))
          .map((k) => {
            const p = projects.find((x) => x.id === k.projectId);
            const t = tasks.find((x) => x.id === k.taskId);
            return p && t ? { projectId: p.id, taskId: t.id, projectCode: p.code ?? "", projectName: p.name, projectKind: p.kind ?? "project", taskName: t.name, cells: {} } : null;
          })
          .filter((x): x is GridRow => !!x);
        return [...rs, ...extra];
      });
    });

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>, ri: number, ci: number) => {
    const move = (dr: number, dc: number) => {
      const el = gridRef.current?.querySelector<HTMLInputElement>(`input[data-r="${ri + dr}"][data-c="${ci + dc}"]`);
      if (el) {
        e.preventDefault();
        el.focus();
        el.select();
      }
    };
    if (e.key === "Enter" || e.key === "ArrowDown") move(1, 0);
    else if (e.key === "ArrowUp") move(-1, 0);
    else if (e.key === "ArrowLeft" && e.currentTarget.selectionStart === 0) move(0, -1);
    else if (e.key === "ArrowRight" && e.currentTarget.selectionEnd === e.currentTarget.value.length) move(0, 1);
    else if (e.key === "Escape") {
      e.currentTarget.value = e.currentTarget.dataset.orig ?? "";
      e.currentTarget.blur();
    }
  };

  const timerLabel = (c: Cell) => {
    if (!c.timerStartedAt) return null;
    const elapsed = (now - new Date(c.timerStartedAt).getTime()) / 3_600_000;
    return formatHours(Math.round((c.hours + elapsed) * 100) / 100, hoursFormat, { zero: "0:00" });
  };

  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table ref={gridRef} className="w-full min-w-[880px] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr className="text-left">
              <th className="sticky left-0 z-10 w-[300px] bg-surface px-4 py-2.5 font-medium text-ink-3 hairline-b">Project · task</th>
              {days.map((d) => {
                const s = states[d]!;
                const off = s === "off";
                return (
                  <th key={d} className={cn("w-[92px] px-2 py-2 text-center font-medium hairline-b", d === today && "bg-accent-soft/50", off && "text-ink-4")}>
                    <span className="flex flex-col items-center leading-tight">
                      <span className={cn("text-[11px] uppercase tracking-[0.04em]", d === today ? "text-accent-ink" : "text-ink-3")}>{shortDay(d)}</span>
                      <span className={cn("text-[12.5px]", d === today && "font-semibold text-accent-ink")}>{shortDate(d)}</span>
                      <span className="mt-1 flex h-2 items-center">{!off && s !== "future" && <DayDot state={s} />}</span>
                    </span>
                  </th>
                );
              })}
              <th className="w-[88px] px-3 py-2.5 text-right font-medium text-ink-3 hairline-b">Total</th>
              <th className="w-9 hairline-b" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={days.length + 3} className="px-4 py-10 text-center text-[13px] text-ink-3">
                  No rows yet. Add a project and task below{canEdit ? ", or copy last week's rows" : ""}.
                </td>
              </tr>
            )}
            {rows.map((r, ri) => (
              <tr key={rowKey(r)} className="group">
                <td className="sticky left-0 z-10 bg-surface px-4 py-1.5 hairline-b">
                  <div className="flex min-w-0 items-center gap-2">
                    <KindTag kind={r.projectKind} className="shrink-0" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium" title={`${r.projectCode} ${r.projectName}`}>
                        {r.projectName}
                      </span>
                      <span className="block truncate text-[12px] text-ink-3">
                        <span className="font-mono text-[11px]">{r.projectCode}</span> · {r.taskName}
                      </span>
                    </span>
                  </div>
                </td>
                {days.map((d, ci) => {
                  const c = r.cells[d] ?? EMPTY;
                  const running = !!c.timerStartedAt;
                  const off = isWeekend(d) || holidays.includes(d);
                  return (
                    <td key={d} className={cn("relative p-0 hairline-b", d === today && "bg-accent-soft/30", off && "bg-surface-2/60")}>
                      <div className="flex h-11 items-center">
                        <input
                          data-r={ri}
                          data-c={ci}
                          data-day={d}
                          data-orig={formatHours(c.hours, hoursFormat)}
                          key={`${c.id}-${c.hours}-${c.timerStartedAt}`}
                          defaultValue={running ? (timerLabel(c) ?? "") : formatHours(c.hours, hoursFormat)}
                          disabled={!canEdit || running}
                          inputMode="decimal"
                          placeholder={off ? "" : "–"}
                          aria-label={`${r.projectName} ${r.taskName} ${d}`}
                          onFocus={(e) => e.currentTarget.select()}
                          onKeyDown={(e) => onKey(e, ri, ci)}
                          onBlur={(e) => {
                            const res = commitHours(r, d, e.currentTarget.value);
                            if (!res.ok) {
                              e.currentTarget.classList.add("text-crit");
                              e.currentTarget.focus();
                            } else e.currentTarget.classList.remove("text-crit");
                          }}
                          className={cn("tnum h-full w-full bg-transparent px-2 pr-6 text-center text-[13.5px] outline-none placeholder:text-ink-4 focus:bg-surface focus:shadow-[inset_0_0_0_2px_var(--accent)] disabled:text-ink-2", running && "font-medium text-accent-ink", c.hours === 0 && !running && "text-ink-3")}
                        />
                        <span className="absolute right-1 top-1/2 flex -translate-y-1/2 flex-col items-center gap-0.5">
                          {canEdit && (
                            <NotePopover value={c.notes} onCommit={(v) => commitNotes(r, d, v)}>
                              <button type="button" tabIndex={-1} title={c.notes ?? "Add a note"} className={cn("inline-flex size-4 items-center justify-center rounded text-ink-4 hover:text-ink", c.notes && "text-accent-ink", !c.notes && "opacity-0 group-hover:opacity-100 focus:opacity-100")}>
                                <MessageSquare className="size-3" />
                              </button>
                            </NotePopover>
                          )}
                          {!canEdit && c.notes && (
                            <span title={c.notes} className="inline-flex size-4 items-center justify-center text-accent-ink">
                              <MessageSquare className="size-3" />
                            </span>
                          )}
                          {self && canEdit && d === today && (
                            <button
                              type="button"
                              tabIndex={-1}
                              title={running ? "Stop timer" : "Start timer"}
                              onClick={() =>
                                run(async () => {
                                  const saved = running && c.id ? await stopTimer(c.id) : await startTimer({ personId, projectId: r.projectId, taskId: r.taskId, date: d });
                                  apply(rowKey(r), d, saved);
                                  router.refresh();
                                })
                              }
                              className={cn("inline-flex size-4 items-center justify-center rounded text-ink-4 hover:text-ink", running ? "text-accent-ink opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100")}
                            >
                              {running ? <Pause className="size-3" /> : <Play className="size-3" />}
                            </button>
                          )}
                        </span>
                      </div>
                    </td>
                  );
                })}
                <td className="tnum px-3 text-right font-medium hairline-b">{formatHours(rowTotal(r), hoursFormat, { zero: "–" })}</td>
                <td className="hairline-b">
                  {canEdit && (
                    <button type="button" onClick={() => removeRow(r)} title="Remove row" className="inline-flex size-7 items-center justify-center rounded-md text-ink-4 opacity-0 hover:bg-crit-soft hover:text-crit group-hover:opacity-100 focus:opacity-100">
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="sticky left-0 z-10 bg-surface px-4 py-2.5 text-[12.5px] font-medium text-ink-3">Total</td>
              {days.map((d) => {
                const t = dayTotal(d);
                const s = states[d]!;
                return (
                  <td key={d} className={cn("tnum px-2 py-2.5 text-center font-semibold", t === 0 ? "text-ink-4" : DAY_TONE[s].text, d === today && "bg-accent-soft/30")}>
                    {formatHours(t, hoursFormat, { zero: "–" })}
                  </td>
                );
              })}
              <td className="tnum px-3 py-2.5 text-right text-[14px] font-semibold">{formatHours(weekTotal, hoursFormat, { zero: "0" })}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 hairline-t">
          <select value={addP} onChange={(e) => setAddP(e.target.value ? Number(e.target.value) : "")} className="h-8 max-w-[360px] rounded-md bg-surface px-2 text-[13px] hairline">
            <option value="">Project or work request…</option>
            {projects.some((p) => p.assigned) && (
              <optgroup label="Assigned to you">
                {projects.filter((p) => p.assigned).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} · {p.name}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Internal">
              {projects.filter((p) => !p.assigned && p.kind === "internal").map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="All active work">
              {projects.filter((p) => !p.assigned && p.kind !== "internal").map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.name}
                </option>
              ))}
            </optgroup>
          </select>
          <select value={addT} onChange={(e) => setAddT(e.target.value ? Number(e.target.value) : "")} className="h-8 rounded-md bg-surface px-2 text-[13px] hairline">
            <option value="">Task…</option>
            {tasks.filter((t) => t.active !== false).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <Button size="sm" variant="primary" onClick={addRow} disabled={addP === "" || addT === ""}>
            <Plus className="size-3.5" /> Add row
          </Button>
          <Button size="sm" variant="ghost" onClick={copyLast} disabled={pending}>
            <Copy className="size-3.5" /> Copy last week&apos;s rows
          </Button>
          <span className="ml-auto text-[12px] text-ink-3">{pending ? "Saving…" : error ? <span className="text-crit">{error}</span> : "Saved on blur · Enter moves down · 1:30, 1.5 or 90m all work"}</span>
        </div>
      )}
    </div>
  );
}

function NotePopover({ value, onCommit, children }: { value: string | null; onCommit: (v: string) => void; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);
  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) onCommit(draft);
      }}
    >
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="bottom" align="end" sideOffset={6} className="z-50 w-72 rounded-lg bg-surface p-2 shadow-3 hairline">
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) setOpen(false);
            }}
            placeholder="What did you work on? (SR ref, feature, outcome)"
            className="min-h-20 w-full resize-y rounded-md bg-surface-2 px-2.5 py-2 text-[13px] outline-none focus:shadow-[inset_0_0_0_1px_var(--accent)]"
          />
          <p className="mt-1 px-1 text-[11px] text-ink-3">⌘↵ to save · closes on click outside</p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
