/* Deterministic seed: a 72-seat IT department logging daily work, ten weeks of history. Re-runnable (truncates first). */
import { sql } from "drizzle-orm";
import { addDays, eachDay, isWeekend, startOfWeek, weekDays } from "@timefly/core";
import { db, schema } from "./index";

// Mulberry32 — deterministic RNG so screenshots and tests are reproducible.
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20260826);
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)] as T;
const chance = (p: number) => rand() < p;
const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
const quarter = (a: number, b: number) => Math.round((a + rand() * (b - a)) * 4) / 4;

const TODAY = "2026-08-26"; // Wednesday
const NOW = new Date("2026-08-26T11:20:00+08:00");
const FIRST_DAY = "2026-06-15"; // Monday, ten full weeks before the current one
const HARVEST_CUTOVER = "2026-08-01"; // entries before this date carry a harvest_id (imported)
const at = (iso: string, h: number, m = 0) => new Date(`${iso}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+08:00`);
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

const FIRST = ["Aisha", "Wei", "Priya", "Marcus", "Siti", "Daniel", "Mei Lin", "Rahul", "Sofia", "Kenji", "Nadia", "Omar", "Grace", "Farah", "Jun", "Elena", "Hafiz", "Chloe", "Arjun", "Yuki", "Leila", "Tomas", "Ananya", "Kai", "Zara", "Ravi", "Hana", "Ibrahim", "Ling", "Noor", "Adrian", "Sakura", "Dev", "Maya", "Ken", "Amira", "Lucas", "Ines", "Tariq", "Suki", "Bao", "Carlos", "Dara", "Emil", "Fatima", "Gopal", "Hiro", "Irene", "Jomar", "Kavya", "Liam", "Mika", "Nabil", "Ola", "Paulo", "Qi", "Rosa", "Samir", "Thanh", "Uma", "Vikram", "Wan", "Xin", "Yara", "Zain"];
const LAST = ["Rahman", "Chen", "Sharma", "Tan", "Abdullah", "Lim", "Wong", "Patel", "Costa", "Nakamura", "Hussain", "Khan", "Lee", "Ismail", "Park", "Petrova", "Osman", "Dubois", "Mehta", "Sato", "Haddad", "Novak", "Iyer", "Ho", "Malik", "Nair", "Kim", "Farouk", "Zhang", "Aziz", "Reyes", "Santos", "Gupta", "Nguyen", "Yusof", "Cruz", "Chan", "Das", "Bautista", "Rao"];

type TeamSpec = { name: string; description: string; lead: string; leadTitle: string; size: number; titles: string[] };
const TEAMS: TeamSpec[] = [
  { name: "Development", description: "Web, e-commerce and back-office applications", lead: "Wei Chen", leadTitle: "Development Manager", size: 22, titles: ["Senior Developer", "Developer", "Full-stack Developer", "Backend Developer", "Frontend Developer", "Tech Lead"] },
  { name: "QA & Testing", description: "Manual and automated testing", lead: "Priya Sharma", leadTitle: "QA Manager", size: 10, titles: ["QA Engineer", "Test Automation Engineer", "Senior QA Engineer"] },
  { name: "DevOps & Infrastructure", description: "Cloud, identity, endpoints and release pipelines", lead: "Omar Khan", leadTitle: "DevOps Manager", size: 10, titles: ["DevOps Engineer", "Cloud Engineer", "Systems Engineer", "Site Reliability Engineer"] },
  { name: "Data & BI", description: "Warehouse, pipelines and reporting", lead: "Mei Lin Wong", leadTitle: "Data & BI Manager", size: 8, titles: ["Data Engineer", "BI Developer", "Data Analyst"] },
  { name: "UX & Design", description: "Product and web design", lead: "Sofia Costa", leadTitle: "UX Manager", size: 6, titles: ["UX Designer", "UI Designer", "Product Designer"] },
  { name: "PMO & Business Analysis", description: "Delivery, analysis and coordination", lead: "Marcus Tan", leadTitle: "PMO Manager", size: 8, titles: ["Business Analyst", "Project Coordinator", "Scrum Master", "Project Manager"] },
];

const TASKS: [string, string][] = [
  ["Development", "Writing and reviewing application code"],
  ["Code review", "Reviewing pull requests"],
  ["Testing & QA", "Manual and automated testing"],
  ["Bug fixing", "Defects and hotfixes"],
  ["Analysis & design", "Requirements, architecture, UX design"],
  ["Meetings", "Stand-ups, planning, reviews, vendor calls"],
  ["Deployment & release", "Builds, releases, change execution"],
  ["Support & on-call", "Incidents, tickets, user support"],
  ["Documentation", "Runbooks, specs, knowledge base"],
  ["Training", "Learning, certifications, onboarding others"],
  ["Leave & holiday", "Annual leave, sick leave, public holidays"],
];

type ProjSpec = { code: string; name: string; team: number; budget: number; client: string; starts: string; ends: string; status?: "active" | "on_hold" | "completed" };
const PROJECTS: ProjSpec[] = [
  { code: "PRJ-2026-01", name: "QNET eStore Revamp", team: 0, budget: 7200, client: "QNET", starts: "2026-03-02", ends: "2026-12-18" },
  { code: "PRJ-2026-02", name: "Lisa Analytics Platform", team: 3, budget: 2700, client: "QNET", starts: "2026-04-13", ends: "2026-10-30" },
  { code: "PRJ-2026-03", name: "WEB360 Web Estate", team: 0, budget: 3600, client: "QI Group", starts: "2026-05-04", ends: "2026-11-27" },
  { code: "PRJ-2026-04", name: "QNET Verify Anti-fraud", team: 0, budget: 1800, client: "QNET", starts: "2026-06-01", ends: "2026-09-30" },
  { code: "PRJ-2026-05", name: "Translation Platform", team: 0, budget: 4800, client: "QI Group", starts: "2026-02-16", ends: "2026-10-16" },
  { code: "PRJ-2026-06", name: "Newsroom on WP Engine", team: 4, budget: 1500, client: "QNET", starts: "2026-07-06", ends: "2026-10-30" },
  { code: "PRJ-2026-07", name: "Service Desk (Freshservice replacement)", team: 0, budget: 3000, client: "IT internal", starts: "2026-08-03", ends: "2027-01-29" },
  { code: "PRJ-2026-08", name: "Intune & Autopilot Rollout", team: 2, budget: 2100, client: "IT internal", starts: "2026-05-18", ends: "2026-09-25" },
  { code: "PRJ-2026-09", name: "Entra SSO Migration", team: 2, budget: 1350, client: "IT internal", starts: "2026-06-08", ends: "2026-09-11" },
  { code: "PRJ-2026-10", name: "Data Warehouse Phase 2", team: 3, budget: 3300, client: "QI Group", starts: "2026-04-01", ends: "2026-12-11" },
  { code: "PRJ-2026-11", name: "Mobile App v3", team: 0, budget: 5400, client: "QNET", starts: "2026-05-11", ends: "2027-02-26" },
  { code: "PRJ-2026-12", name: "Payment Gateway Upgrade", team: 0, budget: 1650, client: "QNET", starts: "2026-06-22", ends: "2026-09-18" },
  { code: "PRJ-2026-13", name: "Regional Sites Replication", team: 4, budget: 1200, client: "QNET", starts: "2026-07-13", ends: "2026-10-09" },
  { code: "PRJ-2026-14", name: "Test Automation Framework", team: 1, budget: 1800, client: "IT internal", starts: "2026-04-20", ends: "2026-10-30" },
  { code: "PRJ-2026-15", name: "Azure Landing Zone", team: 2, budget: 2400, client: "IT internal", starts: "2026-03-16", ends: "2026-08-14", status: "completed" },
  { code: "PRJ-2026-16", name: "Finance Reporting Cube", team: 3, budget: 1500, client: "QI Group", starts: "2026-07-20", ends: "2026-11-13" },
  { code: "PRJ-2026-17", name: "Delivery Governance & Reporting", team: 5, budget: 1800, client: "IT internal", starts: "2026-01-12", ends: "2026-12-18" },
];

const WORK_REQUESTS: [string, number][] = [
  ["SendGrid bounce webhook for eStore emails", 0],
  ["Add MY SST field to checkout", 0],
  ["Power BI dataset refresh for Finance month-end", 3],
  ["Fix SSO redirect loop on partner portal", 2],
  ["Bulk product import from Excel", 0],
  ["Regression run for release 4.12", 1],
  ["Conditional access policy for contractors", 2],
  ["Landing page for VMalaysia 2026", 4],
  ["Order export to SAP nightly job failing", 0],
  ["Load test for flash-sale weekend", 1],
  ["Migrate DNS zones for regional sites", 2],
  ["Referral tracking dashboard", 3],
  ["Accessibility audit fixes on eStore", 4],
  ["Customer care macros for new ticket categories", 5],
  ["Rebuild staging environment for Mobile App", 2],
  ["Archive 2019–2021 orders to cold storage", 3],
  ["Coupon engine edge cases (stacked discounts)", 0],
  ["Automate certificate renewal", 2],
  ["Translate checkout strings for TR and AE", 0],
  ["User research interviews — distributor app", 4],
  ["Log Analytics alerts for payment errors", 2],
  ["Data quality checks on distributor master", 3],
  ["Refactor cart service for multi-currency", 0],
  ["Pen-test findings remediation batch 3", 2],
  ["Test plan for Payment Gateway cutover", 1],
  ["Weekly leadership KPI pack automation", 3],
  ["Email template redesign (transactional)", 4],
  ["Sprint metrics in delivery dashboard", 5],
  ["Wishlist sharing feature", 0],
  ["API rate limiting for partner integrations", 0],
  ["Postgres upgrade 15 → 16 on campaign tracker", 2],
  ["Mobile push notification opt-in flow", 0],
  ["Smoke tests in release pipeline", 1],
  ["Distributor genealogy report performance", 3],
  ["Design system tokens for Newsroom", 4],
  ["Vendor evaluation — observability platform", 5],
  ["Fix timezone bug in order timestamps", 0],
  ["Backfill missing SKU images", 0],
  ["Offboarding automation for leavers", 2],
  ["Quarterly capacity report", 5],
];

const INTERNAL: [string, string, string][] = [
  ["INT-MEET", "Meetings & admin", "Stand-ups, planning, 1:1s, town halls, admin"],
  ["INT-SUPPORT", "Support & on-call", "Ad-hoc support, incidents, service desk tickets"],
  ["INT-TRAIN", "Learning & training", "Courses, certifications, knowledge sharing"],
  ["INT-LEAVE", "Leave & public holidays", "Annual leave, sick leave, public holidays"],
];

const NOTES: Record<string, string[]> = {
  Development: ["Implement {x}", "Wire up {x} endpoint", "Pagination and filters for {x}", "Refactor {x} module", "Feature flag for {x}", "Migration script for {x}"],
  "Code review": ["Review PRs for {x}", "Pair review on {x}", "Address review comments on {x}"],
  "Testing & QA": ["Regression on {x}", "Test cases for {x}", "Exploratory testing {x}", "Automate {x} scenarios"],
  "Bug fixing": ["Fix null pointer in {x}", "Hotfix {x} after release", "Reproduce and fix {x}", "Race condition in {x}"],
  "Analysis & design": ["Wireframes for {x}", "Spec for {x}", "Data model for {x}", "Estimate {x}"],
  Meetings: ["Daily stand-up", "Sprint planning", "Backlog refinement", "Vendor call", "1:1 with manager", "Retro", "Release go/no-go"],
  "Deployment & release": ["Deploy {x} to staging", "Production release {x}", "Rollback rehearsal for {x}"],
  "Support & on-call": ["Ticket triage", "On-call: alert investigation", "User support — access issue", "Incident follow-up"],
  Documentation: ["Runbook for {x}", "Update wiki — {x}", "Release notes {x}"],
  Training: ["Azure certification prep", "Security awareness training", "Onboarding new joiner"],
  "Leave & holiday": ["Annual leave", "Sick leave", "Public holiday"],
};
const FEATURES = ["checkout", "cart", "product search", "order history", "distributor login", "coupon flow", "payment callback", "address book", "wishlist", "notifications", "reporting API", "import job", "auth middleware", "admin console", "sync worker"];

async function main() {
  console.log("Seeding timefly…");
  await db.execute(sql`truncate teams, people, tasks, projects, assignments, time_entries, timesheets, saved_reports, notifications, settings, activity_log, releases, system_jobs restart identity cascade`);

  // Teams (lead ids patched after people exist)
  const teamRows = await db.insert(schema.teams).values(TEAMS.map((t) => ({ name: t.name, description: t.description }))).returning({ id: schema.teams.id });
  const teamId = (i: number) => teamRows[i]!.id;

  // People
  const used = new Set<string>();
  const uniqueName = () => {
    for (;;) {
      const n = `${pick(FIRST)} ${pick(LAST)}`;
      if (!used.has(n)) {
        used.add(n);
        return n;
      }
    }
  };
  const email = (n: string) => `${n.toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, ".")}@qi.example`;
  type P = typeof schema.people.$inferInsert;
  const admins: P[] = [
    { displayName: "Nada Haddad", email: email("Nada Haddad"), jobTitle: "Head of IT Applications", role: "admin", weeklyHours: 40 },
    { displayName: "Aisha Rahman", email: email("Aisha Rahman"), jobTitle: "IT Operations Manager", role: "admin", weeklyHours: 40 },
  ];
  admins.forEach((a) => used.add(a.displayName));
  TEAMS.forEach((t) => used.add(t.lead));
  ["Siti Abdullah", "Rahul Sharma", "Farah Ismail"].forEach((n) => used.add(n));
  const adminRows = await db.insert(schema.people).values(admins).returning({ id: schema.people.id });
  const headId = adminRows[0]!.id;
  const managerRows = await db
    .insert(schema.people)
    .values(TEAMS.map((t, i) => ({ displayName: t.lead, email: email(t.lead), jobTitle: t.leadTitle, role: "manager" as const, teamId: teamId(i), managerId: headId, weeklyHours: 40, harvestId: 3000 + i })))
    .returning({ id: schema.people.id });
  for (let i = 0; i < TEAMS.length; i++) await db.update(schema.teams).set({ leadId: managerRows[i]!.id }).where(sql`id = ${teamId(i)}`);
  const memberSpecs: (P & { team: number })[] = [];
  TEAMS.forEach((t, ti) => {
    for (let k = 0; k < t.size; k++) {
      const n = uniqueName();
      memberSpecs.push({ displayName: n, email: email(n), jobTitle: pick(t.titles), role: "member", teamId: teamId(ti), managerId: managerRows[ti]!.id, weeklyHours: chance(0.06) ? 32 : 40, harvestId: 3100 + memberSpecs.length, team: ti });
    }
  });
  // A few named personas for the login screen sit in Development / QA.
  memberSpecs[0]!.displayName = "Siti Abdullah";
  memberSpecs[0]!.email = email("Siti Abdullah");
  memberSpecs[0]!.jobTitle = "Senior Developer";
  memberSpecs[1]!.displayName = "Rahul Sharma";
  memberSpecs[1]!.email = email("Rahul Sharma");
  memberSpecs[1]!.jobTitle = "Developer";
  memberSpecs[22]!.displayName = "Farah Ismail";
  memberSpecs[22]!.email = email("Farah Ismail");
  memberSpecs[22]!.jobTitle = "QA Engineer";
  const memberRows = await db.insert(schema.people).values(memberSpecs.map(({ team: _t, ...p }) => p)).returning({ id: schema.people.id });
  type Person = { id: number; team: number | null; role: "member" | "manager" | "admin"; name: string; managerId: number | null; weeklyHours: number };
  const people: Person[] = [
    ...adminRows.map((r, i) => ({ id: r.id, team: null, role: "admin" as const, name: admins[i]!.displayName, managerId: null, weeklyHours: 40 })),
    ...managerRows.map((r, i) => ({ id: r.id, team: i, role: "manager" as const, name: TEAMS[i]!.lead, managerId: headId, weeklyHours: 40 })),
    ...memberRows.map((r, i) => ({ id: r.id, team: memberSpecs[i]!.team, role: "member" as const, name: memberSpecs[i]!.displayName, managerId: memberSpecs[i]!.managerId ?? null, weeklyHours: memberSpecs[i]!.weeklyHours ?? 40 })),
  ];
  const byTeam = (ti: number) => people.filter((p) => p.team === ti);

  // Tasks
  const taskRows = await db.insert(schema.tasks).values(TASKS.map(([name, description], i) => ({ name, description, sortOrder: i, harvestId: 5000 + i }))).returning({ id: schema.tasks.id, name: schema.tasks.name });
  const task = (name: string) => taskRows.find((t) => t.name === name)!.id;

  // Projects
  const projRows = await db
    .insert(schema.projects)
    .values(PROJECTS.map((p, i) => ({ code: p.code, name: p.name, kind: "project" as const, status: p.status ?? "active", teamId: teamId(p.team), ownerId: managerRows[p.team]!.id, clientName: p.client, budgetHours: p.budget, startsOn: p.starts, endsOn: p.ends, harvestId: 7000 + i, createdAt: at(p.starts, 9), updatedAt: hoursAgo(between(2, 200)) })))
    .returning({ id: schema.projects.id });
  const wrRows = await db
    .insert(schema.projects)
    .values(
      WORK_REQUESTS.map(([name, team], i) => {
        const ref = `SR-${229102 + i * 3 + between(0, 2)}`;
        const created = addDays(FIRST_DAY, between(-20, 55));
        const done = chance(0.35);
        return { code: ref, name, kind: "work_request" as const, status: done ? ("completed" as const) : ("active" as const), teamId: teamId(team), ownerId: managerRows[team]!.id, clientName: pick(["QNET", "QI Group", "IT internal"]), budgetHours: chance(0.5) ? between(2, 12) * 5 : null, startsOn: created, endsOn: done ? addDays(created, between(5, 30)) : null, ticketRef: ref, harvestId: i < 30 ? 7100 + i : null, createdAt: at(created, 10), updatedAt: hoursAgo(between(1, 300)) };
      }),
    )
    .returning({ id: schema.projects.id, status: schema.projects.status, teamId: schema.projects.teamId, name: schema.projects.name, code: schema.projects.code });
  const intRows = await db.insert(schema.projects).values(INTERNAL.map(([code, name, notes], i) => ({ code, name, kind: "internal" as const, clientName: "IT internal", notes, harvestId: 7200 + i }))).returning({ id: schema.projects.id, code: schema.projects.code });
  const internal = (code: string) => intRows.find((r) => r.code === code)!.id;
  const projectsOfTeam = (ti: number) => PROJECTS.map((p, i) => ({ ...p, id: projRows[i]!.id })).filter((p) => p.team === ti);
  const wrOfTeam = (ti: number) => wrRows.filter((w) => w.teamId === teamId(ti));

  // Assignments
  type A = { projectId: number; personId: number; assignedById: number | null; createdAt: Date };
  const assignments: A[] = [];
  const assigned = new Map<number, { projects: { id: number; name: string; code: string; status: string }[]; wrs: typeof wrRows }>();
  for (const p of people) {
    const own = p.team === null ? [] : projectsOfTeam(p.team);
    const own2 = own.filter((x) => (x.status ?? "active") === "active");
    const pool = own2.length ? own2 : PROJECTS.map((x, i) => ({ ...x, id: projRows[i]!.id }));
    const nProj = p.role === "admin" ? 1 : p.role === "manager" ? Math.min(3, pool.length) : Math.min(between(1, 2), pool.length);
    const chosen = [...pool].sort(() => rand() - 0.5).slice(0, nProj);
    if (p.role === "member" && chance(0.25)) {
      const other = PROJECTS.map((x, i) => ({ ...x, id: projRows[i]!.id })).filter((x) => x.team !== p.team && (x.status ?? "active") === "active");
      chosen.push(pick(other));
    }
    const wrs = p.team === null ? [] : [...wrOfTeam(p.team)].sort(() => rand() - 0.5).slice(0, p.role === "member" ? between(1, 3) : 1);
    for (const c of chosen) assignments.push({ projectId: c.id, personId: p.id, assignedById: p.managerId ?? headId, createdAt: at(addDays(FIRST_DAY, -between(3, 40)), 9) });
    for (const w of wrs) assignments.push({ projectId: w.id, personId: p.id, assignedById: p.managerId ?? headId, createdAt: hoursAgo(between(24, 1200)) });
    assigned.set(p.id, { projects: chosen.map((c) => ({ id: c.id, name: c.name, code: c.code, status: c.status ?? "active" })), wrs });
  }
  await db.insert(schema.assignments).values(assignments);

  // Time entries
  type E = typeof schema.timeEntries.$inferInsert;
  const entries: E[] = [];
  const note = (taskName: string, ctx?: string) => pick(NOTES[taskName] ?? ["Work on {x}"]).replace("{x}", ctx ?? pick(FEATURES));
  const days = eachDay(FIRST_DAY, TODAY).filter((d) => !isWeekend(d));
  const TEAM_TASKS: Record<number, string[]> = { 0: ["Development", "Development", "Code review", "Bug fixing", "Analysis & design", "Deployment & release"], 1: ["Testing & QA", "Testing & QA", "Bug fixing", "Documentation", "Analysis & design"], 2: ["Deployment & release", "Support & on-call", "Development", "Analysis & design", "Documentation"], 3: ["Development", "Analysis & design", "Testing & QA", "Documentation", "Support & on-call"], 4: ["Analysis & design", "Analysis & design", "Development", "Documentation"], 5: ["Analysis & design", "Meetings", "Documentation", "Support & on-call"] };
  for (const p of people) {
    const a = assigned.get(p.id)!;
    const dayTarget = p.weeklyHours / 5;
    for (const d of days) {
      const isToday = d === TODAY;
      if (isToday && chance(0.45)) continue; // not everyone has logged today yet
      if (!isToday && chance(0.035)) continue; // a missed day now and then
      if (!isToday && chance(0.03)) {
        entries.push({ personId: p.id, projectId: internal("INT-LEAVE"), taskId: task("Leave & holiday"), date: d, hours: dayTarget, notes: pick(["Annual leave", "Sick leave"]), createdAt: at(d, 8), updatedAt: at(d, 8) });
        continue;
      }
      const stamp = (h: number) => at(d, h, between(0, 59));
      let left = isToday ? quarter(1.5, 5) : quarter(dayTarget - 1, dayTarget + 0.75);
      const push = (projectId: number, taskName: string, hours: number, ctx?: string, withNote = chance(0.65)) => {
        if (hours <= 0) return;
        entries.push({ personId: p.id, projectId, taskId: task(taskName), date: d, hours, notes: withNote ? note(taskName, ctx) : null, createdAt: stamp(between(9, 18)), updatedAt: stamp(between(9, 18)) });
        left = Math.round((left - hours) * 4) / 4;
      };
      if (p.role === "admin") {
        push(internal("INT-MEET"), "Meetings", quarter(2, 4), undefined, true);
        if (a.projects[0]) push(a.projects[0].id, "Analysis & design", Math.max(0, Math.min(left, quarter(1, 3))));
        push(internal("INT-SUPPORT"), "Support & on-call", Math.max(0, left));
        continue;
      }
      if (p.role === "manager") {
        push(internal("INT-MEET"), "Meetings", quarter(1.5, 3.5), undefined, true);
        const pr = pick(a.projects);
        push(pr.id, pick(["Analysis & design", "Code review", "Meetings"]), Math.min(left, quarter(1.5, 3)), pr.name);
        if (a.wrs[0] && chance(0.5)) push(a.wrs[0].id, "Analysis & design", Math.min(left, quarter(0.5, 1.5)), a.wrs[0].name);
        push(internal("INT-SUPPORT"), "Support & on-call", Math.max(0, left));
        continue;
      }
      const teamTasks = TEAM_TASKS[p.team ?? 0]!;
      const main = a.projects[0] ?? a.projects[Math.floor(rand() * a.projects.length)]!;
      push(main.id, pick(teamTasks), Math.min(left, quarter(2.5, 5)), main.name);
      if (chance(0.7)) push(internal("INT-MEET"), "Meetings", Math.min(left, quarter(0.5, 1.5)), undefined, true);
      const wr = a.wrs.find((w) => w.status === "active") ?? a.wrs[0];
      if (wr && chance(0.7) && left > 0) push(wr.id, pick(teamTasks), Math.min(left, quarter(1, 3)), wr.name, true);
      if (a.projects[1] && chance(0.5) && left > 0) push(a.projects[1].id, pick(teamTasks), Math.min(left, quarter(0.5, 2)), a.projects[1].name);
      if (chance(0.2) && left > 0) push(internal("INT-SUPPORT"), "Support & on-call", Math.min(left, quarter(0.5, 1.5)));
      if (left > 0 && !isToday) push(main.id, pick(teamTasks), left, main.name, false);
    }
  }
  // Imported history carries the Harvest id.
  let hid = 900_000;
  for (const e of entries) if (e.date < HARVEST_CUTOVER) e.harvestId = hid++;
  for (let i = 0; i < entries.length; i += 1000) await db.insert(schema.timeEntries).values(entries.slice(i, i + 1000));

  // Timesheets: past weeks mostly submitted and approved; last week has stragglers; this week is open.
  type T = typeof schema.timesheets.$inferInsert;
  const sheets: T[] = [];
  const thisWeek = startOfWeek(TODAY);
  const lastWeek = addDays(thisWeek, -7);
  for (const p of people) {
    for (let w = FIRST_DAY; w <= thisWeek; w = addDays(w, 7)) {
      if (w === thisWeek) {
        sheets.push({ personId: p.id, weekStart: w, status: "open" });
        continue;
      }
      const notSubmitted = w === lastWeek ? chance(0.2) : chance(0.06);
      if (notSubmitted) {
        sheets.push({ personId: p.id, weekStart: w, status: "open" });
        continue;
      }
      const fri = addDays(w, 4);
      const submittedAt = chance(0.7) ? at(fri, between(16, 18), between(0, 59)) : at(addDays(w, 7), between(8, 11), between(0, 59));
      const approved = p.managerId !== null && (w === lastWeek ? chance(0.5) : chance(0.85));
      const reopened = !approved && chance(0.04);
      sheets.push({ personId: p.id, weekStart: w, status: approved ? "approved" : reopened ? "reopened" : "submitted", submittedAt, approvedById: approved ? p.managerId : null, approvedAt: approved ? new Date(submittedAt.getTime() + between(2, 60) * 3_600_000) : null, reopenedAt: reopened ? new Date(submittedAt.getTime() + between(2, 30) * 3_600_000) : null, note: reopened ? "Please split the eStore hours between development and bug fixing." : null });
    }
  }
  await db.insert(schema.timesheets).values(sheets);

  // Notifications: reminders for yesterday's gaps, approvals for last week.
  const yesterday = addDays(TODAY, -1);
  const loggedYesterday = new Set(entries.filter((e) => e.date === yesterday).map((e) => e.personId));
  const notifs: (typeof schema.notifications.$inferInsert)[] = [];
  for (const p of people) {
    if (!loggedYesterday.has(p.id)) notifs.push({ personId: p.id, kind: "reminder", title: "Nothing logged for Tue 25 Aug", body: "Add yesterday's hours before your manager reviews the week.", href: `/time?week=${thisWeek}`, createdAt: at(yesterday, 17, 30) });
    const s = sheets.find((x) => x.personId === p.id && x.weekStart === lastWeek);
    if (s?.status === "approved" && s.approvedAt) notifs.push({ personId: p.id, kind: "approved", title: `Timesheet for w/c ${lastWeek} approved`, href: `/time?week=${lastWeek}`, readAt: chance(0.6) ? new Date(s.approvedAt.getTime() + 3_600_000) : null, createdAt: s.approvedAt });
    if (s?.status === "reopened" && s.reopenedAt) notifs.push({ personId: p.id, kind: "reopened", title: `Timesheet for w/c ${lastWeek} reopened`, body: s.note ?? null, href: `/time?week=${lastWeek}`, createdAt: s.reopenedAt });
  }
  await db.insert(schema.notifications).values(notifs);

  // Settings
  const settings: schema.Settings = { weekStartsOn: 1, dayTarget: 8, workingDays: [1, 2, 3, 4, 5], approvals: true, autoApproveClean: true, hoursFormat: "decimal", roundTo: 0.25, reminderHour: 17, lockAfterDays: 14, holidays: [] };
  await db.insert(schema.settings).values([{ key: "timesheets", value: settings }, { key: "harvest", value: { accountId: null, lastImportAt: "2026-08-01T02:10:00+08:00", imported: { users: 72, projects: 51, tasks: 11, entries: entries.filter((e) => e.harvestId).length } } }]);

  // Activity log
  const acts: (typeof schema.activityLog.$inferInsert)[] = [];
  const person = () => pick(people);
  for (let i = 0; i < 260; i++) {
    const p = person();
    const ts = hoursAgo(rand() * 24 * 30);
    const kind = rand();
    const e = pick(entries);
    if (kind < 0.35) acts.push({ ts, actorId: p.id, actorName: p.name, action: "entry.save", category: "timesheet", targetType: "time_entry", targetId: String(between(1, entries.length)), before: { hours: e.hours ?? 0 }, after: { hours: (e.hours ?? 0) + 0.5 }, ip: "10.20.4." + between(2, 250), release: "0.1.0" });
    else if (kind < 0.55) acts.push({ ts, actorId: p.id, actorName: p.name, action: "auth.login", category: "auth", targetType: "person", targetId: String(p.id), ip: "10.20.4." + between(2, 250), release: "0.1.0" });
    else if (kind < 0.75) acts.push({ ts, actorId: p.id, actorName: p.name, action: "timesheet.submit", category: "timesheet", targetType: "timesheet", targetId: String(between(1, sheets.length)), after: { weekStart: lastWeek }, ip: "10.20.4." + between(2, 250), release: "0.1.0" });
    else if (kind < 0.88) {
      const m = pick(people.filter((x) => x.role !== "member"));
      acts.push({ ts, actorId: m.id, actorName: m.name, action: "timesheet.approve", category: "timesheet", targetType: "timesheet", targetId: String(between(1, sheets.length)), after: { weekStart: lastWeek, person: p.name }, ip: "10.20.4." + between(2, 250), release: "0.1.0" });
    } else if (kind < 0.95) {
      const m = pick(people.filter((x) => x.role !== "member"));
      const w = pick(wrRows);
      acts.push({ ts, actorId: m.id, actorName: m.name, action: "assignment.add", category: "project", targetType: "project", targetId: String(w.id), after: { person: p.name, project: w.code }, ip: "10.20.4." + between(2, 250), release: "0.1.0" });
    } else acts.push({ ts, actorId: headId, actorName: "Nada Haddad", action: "settings.update", category: "settings", targetType: "settings", targetId: "timesheets", before: { dayTarget: 7.5 }, after: { dayTarget: 8 }, ip: "10.20.4.12", release: "0.1.0" });
  }
  acts.push({ ts: at(HARVEST_CUTOVER, 2, 10), actorId: null, actorName: "system", actorType: "system", action: "harvest.import", category: "integration", targetType: "harvest", targetId: "v2", after: { users: 72, projects: 51, tasks: 11, entries: entries.filter((e) => e.harvestId).length } });
  acts.sort((a, b) => (a.ts as Date).getTime() - (b.ts as Date).getTime());
  await db.insert(schema.activityLog).values(acts);

  // Releases + jobs
  await db.insert(schema.releases).values([
    { version: "0.1.0", bump: "minor", environment: "dev", commitSha: "a1f9c02", releasedAt: hoursAgo(96), notes: "First cut: weekly grid, team view, projects, reports, Harvest import.", changes: [{ type: "feat", scope: "time", subject: "weekly timesheet grid with inline notes and timer" }, { type: "feat", scope: "team", subject: "manager week view with missing-day signals" }, { type: "feat", scope: "reports", subject: "pivot by person / project / task with CSV export" }, { type: "feat", scope: "import", subject: "Harvest v2 importer (users, projects, tasks, entries)" }] },
  ]);
  await db.insert(schema.systemJobs).values([
    { name: "json-backup", description: "Offsite JSON export of every table", schedule: "daily 03:00", lastRunAt: at(TODAY, 3, 0), lastStatus: "ok", lastDurationMs: 4210, nextRunAt: at(addDays(TODAY, 1), 3, 0), detail: `${entries.length.toLocaleString()} entries · 2.4 MB → blob` },
    { name: "reminders", description: "Nudge people with nothing logged for the previous working day", schedule: "weekdays 17:30", lastRunAt: at(yesterday, 17, 30), lastStatus: "ok", lastDurationMs: 380, nextRunAt: at(TODAY, 17, 30), detail: `${notifs.filter((n) => n.kind === "reminder").length} reminders sent` },
    { name: "submit-nudge", description: "Friday afternoon + Monday morning: ask anyone who has not submitted to submit", schedule: "Fri 16:00 · Mon 09:00", lastRunAt: at(addDays(thisWeek, -3), 16, 0), lastStatus: "ok", lastDurationMs: 210, nextRunAt: at(addDays(thisWeek, 4), 16, 0), detail: "9 nudges sent" },
    { name: "week-lock", description: "Lock open timesheets older than the grace period", schedule: "Mondays 06:00", lastRunAt: at(thisWeek, 6, 0), lastStatus: "ok", lastDurationMs: 120, nextRunAt: at(addDays(thisWeek, 7), 6, 0), detail: "0 timesheets locked" },
    { name: "harvest-sync", description: "Delta import from Harvest until the cut-over", schedule: "manual", lastRunAt: at(HARVEST_CUTOVER, 2, 10), lastStatus: "warning", lastDurationMs: 61_000, detail: "Read-only token expired — set HARVEST_ACCOUNT_ID + HARVEST_TOKEN to re-run" },
  ]);

  console.log(`Seeded: ${people.length} people, ${TEAMS.length} teams, ${taskRows.length} tasks, ${projRows.length + wrRows.length + intRows.length} projects, ${assignments.length} assignments, ${entries.length} entries, ${sheets.length} timesheets, ${notifs.length} notifications, ${acts.length} activity rows.`);
  void weekDays;
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
