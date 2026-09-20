#!/usr/bin/env bash
# Routine update on the server: run as the `crm` user from anywhere.
# Takes a backup first, so a bad migration can be rolled back with db:restore.
set -euo pipefail

cd /srv/crm

echo "==> Backup before update"
(cd server && npm run db:backup)

echo "==> Pull latest code"
git pull --ff-only

echo "==> Server: install, migrate, build"
(cd server && npm ci && npx prisma generate && npx prisma migrate deploy && npm run build)

echo "==> Client: install, build"
(cd client && npm ci && npm run build)

echo "==> Reload app"
pm2 reload crm-server --update-env

echo "==> Done. Health check:"
sleep 3
curl -fsS http://localhost:5000/api/health && echo
