import { db, schema } from "@timefly/db";
import { asc, sql } from "drizzle-orm";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { moveTask, saveTask, toggleTask } from "../actions";

export const metadata = { title: "Tasks" };

export default async function TasksAdmin() {
  const tasks = await db.select().from(schema.tasks).orderBy(asc(schema.tasks.sortOrder), asc(schema.tasks.id));
  const usage = (await db.execute(sql`select task_id as id, sum(hours)::float as hours from time_entries group by task_id`)) as unknown as { id: number; hours: number }[];
  return (
    <div className="max-w-3xl">
      <h1 className="text-[20px] font-semibold tracking-[-0.01em]">Tasks</h1>
      <p className="text-[13px] text-ink-3">The kind of work on a row. Keep the list short — people pick from it every day. Retire instead of deleting so history keeps its labels.</p>
      <section className="panel mt-6 overflow-hidden">
        <table className="w-full text-[13px]">
          <tbody>
            {tasks.map((t, i) => (
              <tr key={t.id} className={cn("hairline-b", !t.active && "opacity-60")}>
                <td className="w-16 px-3 py-2">
                  <span className="flex gap-0.5">
                    <form action={moveTask.bind(null, t.id, -1)}>
                      <button disabled={i === 0} className="inline-flex size-6 items-center justify-center rounded text-ink-3 hover:bg-surface-2 disabled:opacity-30" title="Move up">
                        <ArrowUp className="size-3.5" />
                      </button>
                    </form>
                    <form action={moveTask.bind(null, t.id, 1)}>
                      <button disabled={i === tasks.length - 1} className="inline-flex size-6 items-center justify-center rounded text-ink-3 hover:bg-surface-2 disabled:opacity-30" title="Move down">
                        <ArrowDown className="size-3.5" />
                      </button>
                    </form>
                  </span>
                </td>
                <td className="px-2 py-2">
                  <form action={saveTask} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={t.id} />
                    <input name="name" defaultValue={t.name} className="h-8 w-48 rounded-md bg-surface px-2 font-medium hairline focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--accent)]" />
                    <input name="description" defaultValue={t.description ?? ""} placeholder="Description" className="h-8 flex-1 rounded-md bg-surface px-2 text-ink-2 hairline focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--accent)]" />
                    <Button size="sm" type="submit">
                      Save
                    </Button>
                  </form>
                </td>
                <td className="tnum w-24 px-3 py-2 text-right text-ink-3">{Math.round(usage.find((u) => u.id === t.id)?.hours ?? 0).toLocaleString()} h</td>
                <td className="w-24 px-3 py-2 text-right">
                  <form action={toggleTask.bind(null, t.id)}>
                    <Button size="sm" variant="ghost" type="submit">
                      {t.active ? "Retire" : "Reactivate"}
                    </Button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <form action={saveTask} className="panel mt-4 grid gap-3 p-4 md:grid-cols-[1fr_2fr_auto] md:items-end">
        <Field label="New task">
          <Input name="name" placeholder="e.g. Incident response" required />
        </Field>
        <Field label="Description">
          <Input name="description" placeholder="When to use it" />
        </Field>
        <Button variant="primary" type="submit" className="h-9">
          Add
        </Button>
      </form>
    </div>
  );
}
