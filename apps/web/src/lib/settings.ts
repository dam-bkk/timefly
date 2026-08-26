import "server-only";
import { db, schema, type Settings } from "@timefly/db";
import { eq } from "drizzle-orm";

export const DEFAULT_SETTINGS: Settings = { weekStartsOn: 1, dayTarget: 8, workingDays: [1, 2, 3, 4, 5], approvals: true, autoApproveClean: true, hoursFormat: "decimal", roundTo: 0.25, reminderHour: 17, lockAfterDays: 14, holidays: [] };

export async function getSettings(): Promise<Settings> {
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, "timesheets")).limit(1);
  return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<Settings>) ?? {}) };
}

export type HarvestState = { accountId: string | null; lastImportAt: string | null; imported: { users: number; projects: number; tasks: number; entries: number } | null };

export async function getHarvestState(): Promise<HarvestState> {
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, "harvest")).limit(1);
  return { accountId: null, lastImportAt: null, imported: null, ...((row?.value as Partial<HarvestState>) ?? {}) };
}
