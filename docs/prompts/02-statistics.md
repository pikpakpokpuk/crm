# Prompt: Job Costing & Profit Statistics

Paste this whole file as the task prompt for an implementation session.

## Goal

For every job, know how much was spent on materials, how much was spent on
manpower, and the resulting profit margin. Let users filter by job type
("damage type") to see average margins. Show which employee worked on what
job and how much revenue they generated. Show a full monthly aggregate:
total profit and a spend breakdown.

## Dependency note

This feature needs per-job crew + hours (who worked on the job, how long) and
a wage rate per employee. If
[01-calendar.md](docs/prompts/01-calendar.md) has already been implemented,
it already added a `JobEmployee` join model — reuse it and just add the two
fields below. If calendar has **not** been implemented yet, add the
`JobEmployee` model yourself exactly as described there (job ↔ user join,
`@@unique([jobId, userId])`), you don't need its calendar-specific scheduling
fields, just the join + the two fields below.

## Schema changes

```prisma
model JobEmployee {
  // ...existing/new join fields (jobId, userId)...
  hours Decimal? @db.Decimal(6, 2) // hours this employee spent on the job
}

model User {
  // ...existing fields...
  hourlyRate Decimal? @db.Decimal(8, 2) // wage cost per hour, for manpower cost calc
}

model InventoryItem {
  // ...existing fields...
  costPrice Decimal? @db.Decimal(10, 2) // what we paid; unitPrice stays the sell price
}

model JobLineItem {
  // ...existing fields...
  costPrice Decimal? @db.Decimal(10, 2) // optional manual cost for ad-hoc product lines not tied to inventory
}
```

`hourlyRate` and `costPrice` are nullable because historical data won't have
them — treat null as 0 in calculations and flag jobs with incomplete cost
data in the UI (see below) rather than silently under-reporting.

Update [server/src/services/employees.service.ts](server/src/services/employees.service.ts)
and [client/src/pages/EmployeesPage.tsx](client/src/pages/EmployeesPage.tsx)
(admin only) to set `hourlyRate`. Update
[client/src/pages/InventoryPage.tsx](client/src/pages/InventoryPage.tsx) to set
`costPrice` alongside the existing `unitPrice`.

## Cost/margin formulas (per job)

Given a job with its `lineItems` (JobLineItem), `inventoryUsage`
(JobInventoryItem + InventoryItem), and `crew` (JobEmployee + User):

- `materialRevenue` = Σ line items where `type = 'product'`: `qty * unitPrice`
- `materialCost` =
  Σ `JobInventoryItem`: `quantity * item.costPrice` (0 if null)
  **+** Σ line items where `type = 'product'`: `qty * (costPrice ?? 0)`
- `manpowerRevenue` = Σ line items where `type = 'service'`: `qty * unitPrice`
- `manpowerCost` = Σ crew: `hours * (user.hourlyRate ?? 0)`
- `totalRevenue` = Σ all line items net (existing `subtotal` calc already in
  `JobDetailPage.tsx` — reuse that logic server-side too)
- `totalCost` = `materialCost + manpowerCost`
- `profit` = `totalRevenue - totalCost`
- `marginPct` = `totalRevenue > 0 ? (profit / totalRevenue) * 100 : null`
- `hasIncompleteCostData` = true if any inventory item lacks `costPrice`, or
  any crew member lacks `hourlyRate`, or any product line lacks `costPrice`
  — surface this as a small warning badge so numbers aren't trusted blindly.

Put this calculation in one place — `server/src/services/stats.service.ts`,
exported as `computeJobFinancials(job)` — so per-job, per-type, per-employee,
and monthly views all call the same function instead of re-deriving the math.

## Backend

New `server/src/services/stats.service.ts` + `stats.controller.ts` +
`stats.routes.ts`, mounted at `/api/stats` (auth required):

- `GET /jobs/:id/financials` (add to `jobs.routes.ts`/`jobs.controller.ts`
  instead, since it's job-scoped) — returns the breakdown above for one job.
- `GET /stats/jobs?jobType=&dateFrom=&dateTo=&status=` — list of jobs in
  range with their financials, plus an aggregate: `avgMarginPct`,
  `totalRevenue`, `totalProfit`, count. `jobType` filters on the existing
  `Job.damageType` field.
- `GET /stats/job-types` — distinct `damageType` values with job count and
  avg margin each, for a comparison table/chart.
- `GET /stats/employees?dateFrom=&dateTo=` — per employee (from `JobEmployee`
  crew membership, not just `assignedToId`): job count, total hours,
  revenue generated (attribute each job's `totalRevenue` split evenly across
  its crew, or fully to each crew member if you'd rather double-count for
  "how much value did this person touch" — pick the split approach, it's more
  honest for a profit report), manpower cost, jobs list (id + description).
- `GET /stats/monthly?month=YYYY-MM` — one month's aggregate: total revenue,
  total material cost, total manpower cost, total profit, job count, and a
  breakdown array `{ jobType, revenue, cost, profit }[]` for a stacked chart.

## Frontend

New `client/src/pages/StatisticsPage.tsx`, added to nav (`{ to: '/statistics',
label: 'Statistics', icon: '📊' }` in `Layout.tsx`, route in `App.tsx`).

Before writing any chart, **load the `dataviz` skill** — it governs chart
colors, form choices, and layout conventions for this codebase.

Sections:
1. **Filters bar**: date range, job type dropdown (from `/stats/job-types`),
   employee dropdown. All below sections react to these filters.
2. **KPI row**: total revenue, total cost, total profit, avg margin % —
   as stat tiles.
3. **Job type comparison**: table or bar chart, one row per `damageType`:
   job count, avg margin %, total profit.
4. **Employee leaderboard**: table sorted by revenue generated — employee
   name, job count, hours, revenue generated, manpower cost.
5. **Monthly view**: month picker + stacked bar or line chart of
   revenue/cost/profit over the selected range, using `/stats/monthly`
   (call once per month in range, or add a `GET /stats/monthly-range?from=&to=`
   if that's cleaner than N calls).
6. **Per-job table**: sortable table of jobs in range with revenue, cost,
   margin %, and the incomplete-data warning badge where applicable. Row
   click navigates to `/jobs/:id`.

Add a compact financials card to `JobDetailPage.tsx`'s Overview tab (material
cost/revenue, manpower cost/revenue, profit, margin %) using
`GET /jobs/:id/financials`.

## Acceptance check

- Set an inventory item's `costPrice`, use it on a job, set crew + hours +
  employee `hourlyRate` → job detail financials card shows non-zero material
  cost, manpower cost, and a sane margin %.
- Filter statistics page by job type → avg margin updates to just that type.
- Employee leaderboard total revenue across all employees, divided by however
  jobs were split, reconciles with the monthly aggregate revenue (no double-
  or under-counting — decide and document whichever split rule you picked).
- A job missing cost data anywhere shows the warning badge instead of a
  falsely-precise 100% margin.
