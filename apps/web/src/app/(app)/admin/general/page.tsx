import { getSettings } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Toggle } from "@/components/ui/input";
import { updateSettings } from "../actions";

export const metadata = { title: "Timesheet rules" };

const DAYS: [number, string][] = [[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [0, "Sun"]];

export default async function GeneralSettings() {
  const s = await getSettings();
  return (
    <div className="max-w-2xl">
      <h1 className="text-[20px] font-semibold tracking-[-0.01em]">Timesheet rules</h1>
      <p className="text-[13px] text-ink-3">These shape every grid, signal and reminder. Changes apply immediately and are logged.</p>
      <form action={updateSettings} className="mt-6 space-y-5">
        <div className="panel grid gap-4 p-5 md:grid-cols-2">
          <Field label="Week starts on">
            <Select name="weekStartsOn" defaultValue={String(s.weekStartsOn)}>
              <option value="1">Monday</option>
              <option value="0">Sunday</option>
            </Select>
          </Field>
          <Field label="Day target (hours)" help="Contracted weekly hours ÷ working days override this per person.">
            <Input name="dayTarget" type="number" step="0.5" min="1" max="24" defaultValue={s.dayTarget} />
          </Field>
          <div className="md:col-span-2">
            <p className="mb-1.5 text-[13px] font-medium">Working days</p>
            <div className="flex flex-wrap gap-2">
              {DAYS.map(([d, l]) => (
                <label key={d} className="flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] hairline">
                  <input type="checkbox" name="workingDays" value={d} defaultChecked={s.workingDays.includes(d)} className="accent-[var(--accent)]" /> {l}
                </label>
              ))}
            </div>
          </div>
          <Field label="Hours display">
            <Select name="hoursFormat" defaultValue={s.hoursFormat}>
              <option value="decimal">Decimal (1.5)</option>
              <option value="clock">Clock (1:30)</option>
            </Select>
          </Field>
          <Field label="Round entries to">
            <Select name="roundTo" defaultValue={String(s.roundTo)}>
              <option value="0">No rounding</option>
              <option value="0.05">3 minutes</option>
              <option value="0.1">6 minutes</option>
              <option value="0.25">15 minutes</option>
              <option value="0.5">30 minutes</option>
            </Select>
          </Field>
        </div>
        <div className="panel space-y-3 p-5">
          <Toggle name="approvals" label="Managers approve submitted weeks" defaultChecked={s.approvals} />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Reminder time" help="Weekday reminder for anyone with nothing logged yesterday (worker job).">
              <Input name="reminderHour" type="number" min="0" max="23" defaultValue={s.reminderHour} />
            </Field>
            <Field label="Lock open weeks after (days)" help="0 = never lock automatically.">
              <Input name="lockAfterDays" type="number" min="0" max="90" defaultValue={s.lockAfterDays} />
            </Field>
          </div>
          <Field label="Public holidays" help="One ISO date per line or comma-separated. Shown as non-working days, no missing-day signal.">
            <textarea name="holidays" defaultValue={s.holidays.join("\n")} className="min-h-24 w-full rounded-md bg-surface px-3 py-2 font-mono text-[12.5px] hairline focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--accent)]" placeholder="2026-08-31" />
          </Field>
        </div>
        <Button variant="primary" type="submit">
          Save rules
        </Button>
      </form>
    </div>
  );
}
