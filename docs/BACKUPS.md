# Backups & Restore

## What's backed up

Every run of the backup produces one timestamped folder under `backups/`
(repo root, gitignored) containing:

- `db.sql.gz` — full Postgres dump (`pg_dump`, plain SQL, gzipped)
- `uploads.zip` — everything in `server/uploads/` (document templates)
- `whatsapp-auth.zip` — the linked WhatsApp session (`whatsapp-auth/`),
  so a restore doesn't require rescanning the QR code
- `manifest.json` — which of the above were present

Old backups are pruned automatically, keeping the most recent
`BACKUP_RETENTION_COUNT` (default 14).

## Requirements

The **Postgres client tools** must be installed and on `PATH` — specifically
`pg_dump` (backup) and `psql` (restore). These ship alongside any Postgres
install; on a bare app server: `apt install postgresql-client` (Debian/Ubuntu)
or equivalent.

## Automatic backups

The server schedules a daily backup at 03:00 (server-local time) by default,
as soon as `npm run dev` / the production process starts — no extra setup.
Configure via env vars (all optional, see `.env.example`):

- `BACKUP_CRON` — cron schedule (default `0 3 * * *`)
- `BACKUP_DIR` — where backups are written (default `<repo>/backups`)
- `BACKUP_RETENTION_COUNT` — how many to keep (default 14)
- `DISABLE_AUTO_BACKUP=true` — turn it off (e.g. for local dev)

## Manual backup

```
cd server
npm run db:backup
```

## Restoring

**Destructive** — overwrites the current database, `uploads/`, and
`whatsapp-auth/`. Double-check the folder before running this for real.

```
cd server
npm run db:restore -- ../backups/<timestamp> --yes
```

The `--yes` flag is required; without it the command just prints what it
would do and exits.

## Offsite copies — not automated

This backs up to **local disk only**. If the machine's disk fails, these
backups are lost too. For real disaster-recovery coverage, sync the
`backups/` folder to somewhere else — S3, Google Drive, Backblaze, another
server via `rclone`/`rsync`, whatever the company already has. That sync step
isn't wired up here since it needs a destination and credentials only the
business can provide; once you have a target, a simple cron line like

```
0 4 * * * rclone sync /path/to/crm/backups remote:crm-backups
```

(scheduled an hour after the 03:00 backup so it has something to copy) closes
the loop.
