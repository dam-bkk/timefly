import { boolean, date, doublePrecision, index, integer, jsonb, pgEnum, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Timesheets domain. Deliberately close to Harvest's shape (client/project/task/time entry) so the
 * one-off import is a straight mapping, with `harvest_id` kept on every imported row.
 */

export const personRole = pgEnum("person_role", ["member", "manager", "admin"]);
export const personStatus = pgEnum("person_status", ["active", "left"]);
export const projectKind = pgEnum("project_kind", ["project", "work_request", "internal"]);
export const projectStatus = pgEnum("project_status", ["active", "on_hold", "completed", "archived"]);
export const timesheetStatus = pgEnum("timesheet_status", ["open", "submitted", "approved", "reopened"]);

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  leadId: integer("lead_id"),
});

export const people = pgTable(
  "people",
  {
    id: serial("id").primaryKey(),
    entraId: text("entra_id"),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    jobTitle: text("job_title"),
    teamId: integer("team_id"),
    managerId: integer("manager_id"),
    role: personRole("role").notNull().default("member"),
    status: personStatus("status").notNull().default("active"),
    /** Contracted hours per week; the day target = weeklyHours / working days. */
    weeklyHours: doublePrecision("weekly_hours").notNull().default(40),
    harvestId: integer("harvest_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("people_email_idx").on(t.email), index("people_team_idx").on(t.teamId)],
);

/** Harvest "tasks" = the kind of work: Development, Code review, Meetings… Global list, any project. */
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  harvestId: integer("harvest_id"),
});

export const projects = pgTable(
  "projects",
  {
    id: serial("id").primaryKey(),
    /** PRJ-2026-03, SR-229241, INT-MEET… what people search for. */
    code: text("code").notNull(),
    name: text("name").notNull(),
    kind: projectKind("kind").notNull().default("project"),
    status: projectStatus("status").notNull().default("active"),
    teamId: integer("team_id"),
    ownerId: integer("owner_id"),
    /** Harvest client — kept for the import; for an internal IT team it is the business unit. */
    clientName: text("client_name"),
    budgetHours: doublePrecision("budget_hours"),
    startsOn: date("starts_on"),
    endsOn: date("ends_on"),
    /** Service Desk reference when the work item came from a ticket (SR-/INC-). */
    ticketRef: text("ticket_ref"),
    harvestId: integer("harvest_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("projects_code_idx").on(t.code), index("projects_status_idx").on(t.status)],
);

/** Who is assigned to which project / work request: these become the default rows on their timesheet. */
export const assignments = pgTable(
  "assignments",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id").notNull(),
    personId: integer("person_id").notNull(),
    assignedById: integer("assigned_by_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("assignments_unique_idx").on(t.projectId, t.personId), index("assignments_person_idx").on(t.personId)],
);

export const timeEntries = pgTable(
  "time_entries",
  {
    id: serial("id").primaryKey(),
    personId: integer("person_id").notNull(),
    projectId: integer("project_id").notNull(),
    taskId: integer("task_id").notNull(),
    date: date("date").notNull(),
    hours: doublePrecision("hours").notNull().default(0),
    notes: text("notes"),
    /** Set while a timer is running on this entry; hours accumulate on stop. */
    timerStartedAt: timestamp("timer_started_at", { withTimezone: true }),
    harvestId: integer("harvest_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("time_entries_person_date_idx").on(t.personId, t.date), index("time_entries_project_date_idx").on(t.projectId, t.date), index("time_entries_date_idx").on(t.date)],
);

export const timesheets = pgTable(
  "timesheets",
  {
    id: serial("id").primaryKey(),
    personId: integer("person_id").notNull(),
    weekStart: date("week_start").notNull(),
    status: timesheetStatus("status").notNull().default("open"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    approvedById: integer("approved_by_id"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    reopenedAt: timestamp("reopened_at", { withTimezone: true }),
    note: text("note"),
  },
  (t) => [uniqueIndex("timesheets_person_week_idx").on(t.personId, t.weekStart), index("timesheets_week_idx").on(t.weekStart)],
);

export type ReportParams = { from: string; to: string; rows: string; cols: string; teamId?: number | null; projectId?: number | null; personId?: number | null; kind?: string | null };

export const savedReports = pgTable("saved_reports", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").notNull(),
  name: text("name").notNull(),
  params: jsonb("params").$type<ReportParams>().notNull(),
  shared: boolean("shared").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    personId: integer("person_id").notNull(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_person_idx").on(t.personId, t.readAt)],
);

export type Settings = {
  weekStartsOn: 0 | 1;
  dayTarget: number;
  workingDays: number[];
  approvals: boolean;
  /** Approve a submitted week automatically when every working day has hours and the total is within contract. */
  autoApproveClean: boolean;
  hoursFormat: "decimal" | "clock";
  roundTo: number;
  reminderHour: number;
  lockAfterDays: number;
  holidays: string[];
};

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const activityLog = pgTable(
  "activity_log",
  {
    id: serial("id").primaryKey(),
    ts: timestamp("ts", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
    actorId: integer("actor_id"),
    actorName: text("actor_name").notNull(),
    actorType: text("actor_type").notNull().default("user"),
    action: text("action").notNull(),
    category: text("category").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    requestId: text("request_id"),
    release: text("release"),
  },
  (t) => [index("activity_log_ts_idx").on(t.ts), index("activity_log_category_idx").on(t.category)],
);

export const releases = pgTable("releases", {
  id: serial("id").primaryKey(),
  version: text("version").notNull(),
  bump: text("bump").notNull(),
  environment: text("environment").notNull().default("dev"),
  commitSha: text("commit_sha"),
  releasedAt: timestamp("released_at", { withTimezone: true }).notNull().defaultNow(),
  notes: text("notes"),
  changes: jsonb("changes").$type<{ type: string; scope?: string; subject: string }[]>().notNull().default([]),
});

export const systemJobs = pgTable("system_jobs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  schedule: text("schedule").notNull(),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  lastStatus: text("last_status").notNull().default("never"),
  lastDurationMs: integer("last_duration_ms"),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  detail: text("detail"),
});
