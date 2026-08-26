# TimeFly — "Timesheets"

Daily work log for IT QI Group: every developer records, per day, the hours spent on the projects and work requests
assigned to them. Replaces Harvest (72 seats, ~$15–20k/yr, most of it a usage fee on the number of work requests).

Sibling of [TicketFly / Service Desk](https://github.com/dam-bkk/ticketfly): same stack, same design system, same
standards — so the two can share identity and, later, time-on-ticket.

## What it does

- **My timesheet** — weekly grid (project × task rows, days as columns). Type `1:30`, `1.5` or `90m`; Enter moves down;
  notes live behind a bubble in each cell; a timer on today's cells; copy last week's rows; submit the week.
- **Team** — the manager's view: people × days, red = nothing logged, amber = short; approve / reopen / remind.
- **Projects & work requests** — hours logged, this month, budget burn, who worked on it, and the notes ("effort per
  request"). Assignments become the default rows on a timesheet.
- **Reports** — pivot any two of person / project / task / team / type / week / month / day, filters, saved views,
  CSV (table and raw entries with notes).
- **Admin** — timesheet rules (week start, day target, rounding, approvals, reminders, holidays), tasks, teams,
  Harvest import, activity log (every write, before/after, CSV), releases, system status (jobs + backup age).
- **Harvest import** — API v2, idempotent on `harvest_id`; full history then a delta with `updated_since` on cut-over.

## Layout (concentric)

```
packages/core   pure domain logic, zero I/O, 100 % line coverage (week maths, hours parsing, timesheet state machine, pivot, csv, semver)
packages/db     Drizzle schema + Postgres client + deterministic seed (72 people, 6 teams, 61 projects/requests, 10 weeks of entries)
apps/web        Next.js 16 App Router — UI + server actions; every write goes through the activity log
apps/worker     same image, different entry — json-backup (daily), reminders (weekdays), week-lock (Mondays)
deploy/oci      docker compose for the demo VM · Dockerfile is distroless, one image for web + worker
```

## Run locally

```
createdb timefly              # Postgres.app / local Postgres 16+
pnpm install
pnpm db:push && pnpm db:seed
pnpm dev                      # http://localhost:3027 → /login, pick a persona
```

`DATABASE_URL` defaults to `postgres://localhost:5432/timefly`. Dev auth is a persona cookie; production swaps in
Entra ID (OIDC) without touching call sites.

## Quality gates

- `pnpm test` — Vitest; `packages/core` enforces 100 % line coverage.
- `pnpm typecheck` — strict TS with `noUncheckedIndexedAccess`.
- Versions derive from Conventional Commits (`scripts/version.mjs`).

## Deploy (demo, OCI VM)

```
ssh ubuntu@<vm> 'cd /opt/apps/timefly && git pull --ff-only && export APP_VERSION=$(node scripts/version.mjs) GIT_SHA=$(git rev-parse --short HEAD) && sudo -E docker compose -f deploy/oci/compose.yml up --build -d web worker'
# first run: sudo docker compose -f deploy/oci/compose.yml --profile seed run --rm seed
```

Web listens on `172.18.0.1:3026`; the reverse proxy maps `timefly.damien.asia` to it. Production target: Azure
Container Apps + Postgres Flexible Server, same image (see TicketFly's `infra/`).

## Env

| var | purpose |
|---|---|
| `DATABASE_URL` | Postgres |
| `APP_ENV`, `APP_VERSION`, `GIT_SHA` | shown in the shell + status page |
| `APP_TZ` | organisation timezone for "today" (default `Asia/Kuala_Lumpur`) |
| `BACKUP_DIR` | where the worker writes gzip JSON backups |
| `HARVEST_ACCOUNT_ID`, `HARVEST_TOKEN` | enables Admin → Harvest import |
