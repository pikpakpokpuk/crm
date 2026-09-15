# Prompt: Google Sheets Import / Export

Paste this whole file as the task prompt for an implementation session.

## Goal

Import and export Jobs, Employees, Customers, and Inventory to/from Google
Sheets.

## Approach: service account, not per-user OAuth

Don't build an OAuth consent flow — it's overkill for a small internal tool
and adds a token-refresh maintenance burden. Use a **Google service account**:

1. Admin creates a Google Cloud service account (one-time, outside this
   codebase — document the steps in the Settings UI, don't automate GCP
   project creation), downloads its JSON key, and pastes it into a
   server-side config field.
2. Admin creates (or reuses) a Google Sheet with 4 tabs named `Jobs`,
   `Employees`, `Customers`, `Inventory`, and shares that sheet with the
   service account's email (Editor access) — same as sharing a doc with a
   coworker.
3. Server talks to the Sheets API as that service account via the
   `googleapis` npm package. No end-user ever authenticates to Google.

This is admin-only for the same reason the WhatsApp link is admin-only: it's
a single shared external-account connection for the whole CRM, not a
per-user credential. Follow the same gating pattern used for WhatsApp
([server/src/routes/whatsapp.routes.ts](server/src/routes/whatsapp.routes.ts))
— `requireAdmin` on anything that reads/writes the service account JSON or
sheet ID; import/export actions themselves can be admin-only too, since a bad
import can corrupt data (this one has real teeth, unlike viewing a chat).

## Schema changes

```prisma
model IntegrationSettings {
  id                     String  @id @default("google_sheets") // singleton row
  sheetId                String?
  serviceAccountJson     String? // stored server-side only, never sent to client
  updatedAt              DateTime @updatedAt

  @@map("integration_settings")
}
```

Singleton pattern: always `findUnique({ where: { id: 'google_sheets' } })`,
`upsert` on save. Never return `serviceAccountJson` in any API response —
the config GET endpoint should return only `{ connected: boolean, sheetId }`.

## Column mappings

Each entity gets a fixed header row. Import/export must agree on these
exactly (write a shared `const` per entity, used by both directions):

- **Customers** (sheet tab `Customers`): `id, name, email, phone, address,
  taxNumber, notes` — match existing rows by `id` if present, else by `email`
  if present, else create new.
- **Employees** (sheet tab `Employees`): `id, name, email, role, active` —
  **never** export/import `passwordHash`. New employees created via import
  need a way to get credentials — either generate a random password and
  require reset on first login, or skip employee creation via import
  entirely and only support export + updating `active`/`role`/`name` on
  existing rows (matched by `id` or `email`). Pick the safer option (the
  latter) unless the user asks for full employee creation via import.
- **Inventory** (sheet tab `Inventory`): `id, name, sku, category, quantity,
  unit, unitPrice, costPrice, minStock, notes` — match by `id` if present,
  else by `sku` if present, else create new.
- **Jobs** (sheet tab `Jobs`): `id, customerEmail, customerPhone,
  description, damageType, priority, status, estimatedPrice, finalPrice,
  notes, scheduledStart, scheduledEnd, vehicleMake, vehicleModel,
  vehicleYear, vehiclePlate, vehicleVin, vehicleColor, vehicleMileage,
  assignedToEmail` — match by `id` if present, else create new. Resolve
  `customerEmail`/`customerPhone` to a `Customer` (create the customer if no
  match and enough info is given — name + phone at minimum — otherwise skip
  the row with an error); resolve `assignedToEmail` to a `User` the same way
  but never auto-create a user from a job import.

## Backend

New `server/src/services/sheets.service.ts`:
- `getClient()` — builds an authenticated `googleapis` Sheets client from the
  stored `serviceAccountJson` (throw a clear error if not configured).
- `exportEntity(entity: 'customers'|'employees'|'inventory'|'jobs')` —
  fetches all rows from Prisma, maps to the fixed columns above, writes via
  `spreadsheets.values.update` (clear + overwrite the whole tab, starting at
  `A1` with the header row — simplest correct behavior, avoids stale rows).
- `importEntity(entity)` — reads the tab via `spreadsheets.values.get`, maps
  each row back, and for each row: validate, then upsert. Collect a result
  per row: `{ row: 2, action: 'created'|'updated'|'skipped', error?: string }`.
  **Never throw on a single bad row** — skip it, record the error, continue.
  Return `{ created, updated, skipped, errors: [{row, message}] }`.

New `server/src/controllers/sheets.controller.ts` + `sheets.routes.ts`,
mounted at `/api/integrations/google-sheets`, `requireAdmin` on all routes:

- `GET /config` — `{ connected: boolean, sheetId: string | null }`.
- `PUT /config` — body `{ sheetId, serviceAccountJson }`, upserts
  `IntegrationSettings`. Validate the JSON parses and the Sheets API accepts
  it (e.g. try a harmless `spreadsheets.get` call) before saving, so a typo'd
  key fails fast with a clear error instead of silently breaking later.
- `POST /export/:entity` — runs `exportEntity`, returns row count written.
- `POST /import/:entity` — runs `importEntity`, returns the result summary
  above.

## Frontend

New card in [client/src/pages/SettingsPage.tsx](client/src/pages/SettingsPage.tsx),
admin-only (same `isAdmin` pattern already used for the WhatsApp section —
non-admins shouldn't even see the config fields):

- Connection status + a form to paste the Sheet ID and service account JSON
  (a `<textarea>`, not a file input — keep it simple), with the sharing
  instructions ("share your sheet with `<service-account-email>` as
  Editor") shown once a JSON key is pasted (parse `client_email` out of it
  client-side just for display, don't validate it client-side).
- Once connected: four rows (Jobs / Employees / Customers / Inventory), each
  with an **Export** and an **Import** button.
- Import shows a result modal/toast: "12 created, 3 updated, 1 skipped" with
  an expandable list of row errors if any.

## Acceptance check

- Paste a bad service account JSON → config save fails with a clear error,
  nothing is persisted.
- Export Customers → sheet's `Customers` tab is fully overwritten with
  current DB rows, headers intact.
- Edit a row in the sheet (change a phone number), re-import → that
  customer's phone updates in the DB, row reported as `updated`.
- Add a new row to the sheet with a blank `id` → a new record is created,
  row reported as `created`.
- Add a Jobs row referencing a `customerEmail` that doesn't exist and gives
  no name/phone to create one → that row is `skipped` with a specific error
  message, and the rest of the import still completes.
