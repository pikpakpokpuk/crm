# Prompt: Employee-Colored Job Calendar

Paste this whole file as the task prompt for an implementation session.

## Goal

Add a calendar view to the CRM. Every employee has a distinct color. Users can
filter the calendar by employee. Jobs automatically appear on the calendar
using their scheduled timeframe and assigned crew; users can also create
free-standing manual calendar entries (e.g. "pick up parts", "team meeting")
that aren't tied to any job.

## Current state (context)

- `Job` has a single `assignedToId` (one owner) and a single `scheduledAt`
  (one date, no end time). No multi-employee assignment exists.
- `User` has no color field.
- No calendar model or page exists yet. Nav is in
  [client/src/components/Layout.tsx](client/src/components/Layout.tsx).
- Schema: [server/prisma/schema.prisma](server/prisma/schema.prisma).
- Pattern to follow for new domains: `*.service.ts` (Prisma logic) →
  `*.controller.ts` (thin HTTP glue) → `*.routes.ts` (`authenticate` on all,
  `requireAdmin` where needed) → registered in
  [server/src/routes/index.ts](server/src/routes/index.ts). See
  `jobs.service.ts` / `jobs.controller.ts` / `jobs.routes.ts` as the reference
  triplet.

## Schema changes

```prisma
model User {
  // ...existing fields...
  calendarColor String @default("#3b82f6")
  jobsAssigned  JobEmployee[]
}

model Job {
  // ...existing fields...
  scheduledStart DateTime?
  scheduledEnd   DateTime?
  crew           JobEmployee[]
  // keep existing `scheduledAt` and `assignedToId` as-is for backward compat;
  // migrate any existing scheduledAt value into scheduledStart in the
  // migration (data migration, not just schema).
}

model JobEmployee {
  id     String @id @default(uuid())
  jobId  String
  userId String

  job  Job  @relation(fields: [jobId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([jobId, userId])
  @@map("job_employees")
}

model CalendarEvent {
  id          String   @id @default(uuid())
  title       String
  description String?
  startAt     DateTime
  endAt       DateTime
  allDay      Boolean  @default(false)
  userId      String?  // whose color to render this under; null = neutral/gray
  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user      User? @relation(fields: [userId], references: [id], onDelete: SetNull)
  createdBy User  @relation("CalendarEventCreator", fields: [createdById], references: [id])

  @@map("calendar_events")
}
```

Run `prisma migrate dev --name add_calendar` and write the data migration for
`scheduledAt → scheduledStart` in the generated SQL (or a follow-up script) so
existing jobs don't lose their date.

## Backend

New `server/src/services/calendar.service.ts` + controller + routes mounted
at `/api/calendar` (auth required, no admin restriction — any employee can
view/add):

- `GET /calendar/events?start=&end=&userIds=id1,id2` — returns a merged,
  unified list combining:
  - Jobs whose `scheduledStart`/`scheduledEnd` overlap the range, each
    exploded into one calendar entry **per crew member** (so a job with 2
    employees shows on both their colors), shape:
    `{ type: 'job', jobId, title: job.description, start, end, userId, userName, color }`
  - `CalendarEvent` rows in range, shape:
    `{ type: 'manual', id, title, description, start, end, allDay, userId, userName, color }`
  - When `userIds` is passed, filter both sources to only those employees
    (manual events with `userId: null` always show, since they're
    unassigned/company-wide).
- `POST /calendar/events` — create manual event (`title`, `description?`,
  `startAt`, `endAt`, `allDay?`, `userId?`).
- `PUT /calendar/events/:id` — edit manual event.
- `DELETE /calendar/events/:id` — delete manual event. Allow deleting only
  your own created events, or any if the requester is `ADMIN`.

Update `jobs.service.ts`:
- `create` / `update` should accept an optional `crewUserIds: string[]` and
  `scheduledStart` / `scheduledEnd` in the payload, and sync the `JobEmployee`
  join rows (delete-then-recreate is fine, same pattern already used for
  `updateLineItems`).
- Log an activity entry (`logActivity`) when crew or schedule changes, same
  pattern as existing `JOB_UPDATED` / `LINE_ITEMS_UPDATED` entries.

## Frontend

Add a dependency: `react-big-calendar` + `date-fns` (both MIT-licensed, no
API key needed — this is a real npm app, not a sandboxed artifact, so this is
fine).

New `client/src/pages/CalendarPage.tsx`:
- Month/week/day toggle (react-big-calendar supports this out of the box).
- Left sidebar: checkbox list of employees, each with a colored dot
  (`user.calendarColor`) — toggling filters the fetched events. Default: all
  checked.
- Each calendar event renders in its employee's color (manual events with no
  `userId` render gray).
- Clicking a `type: 'job'` event navigates to `/jobs/:jobId`.
- Clicking a `type: 'manual'` event opens an edit/delete modal.
- "+ Add Event" button opens a create modal (title, description, start, end,
  all-day toggle, optional employee assignment).
- Add `{ to: '/calendar', label: 'Calendar', icon: '📅' }` to `NAV` in
  [client/src/components/Layout.tsx](client/src/components/Layout.tsx), and
  register the route in [client/src/App.tsx](client/src/App.tsx).

Update [client/src/pages/JobDetailPage.tsx](client/src/pages/JobDetailPage.tsx)
Overview tab: replace the single "Scheduled Date" field with a start/end
datetime-local pair, and add a multi-select (checkboxes or a tag-style
multi-select) for crew members, wired into the existing `save()` call.

Update [client/src/pages/EmployeesPage.tsx](client/src/pages/EmployeesPage.tsx)
(or wherever employees are created/edited) to let an admin pick each
employee's `calendarColor` (a simple `<input type="color">` is enough).

## Acceptance check

- Create a job with a start/end timeframe and two crew members → both
  employees' colors show the job on the calendar at the right time.
- Uncheck one employee in the sidebar → their events (job and manual) hide,
  the other employee's stay.
- Add a manual event with no employee → shows in gray, visible regardless of
  filter.
- Edit a job's timeframe from the job detail page → calendar reflects the
  change without a server restart.
