# Deploying to a VPS

Target: one rented Linux server (Hetzner, DigitalOcean, etc.) running
**Ubuntu 24.04**, with Caddy (HTTPS + serves the web app), Node (the API, kept
alive by PM2), and Postgres, all on the same machine.

**Size:** at least 2 GB RAM, 4 GB comfortable. The WhatsApp integration runs a
full headless Chrome inside the server process.

> These steps and the files in `deploy/` were written and checked against a
> local production build (fresh-database migrations, compiled server boot,
> login), but **not run on a real VPS**. Expect to fix small things on the first
> attempt, and do the whole thing once on a throwaway server before the real one.

## 1. Domain

Point an **A record** for your chosen domain (e.g. `crm.yourcompany.hu`) at the
server's IP. Do this first; certificates can't be issued until DNS resolves.

## 2. Lock down the server (as root, first login)

```bash
# non-root user that runs the app
adduser --disabled-password --gecos "" crm
usermod -aG sudo crm
mkdir -p /home/crm/.ssh && cp ~/.ssh/authorized_keys /home/crm/.ssh/
chown -R crm:crm /home/crm/.ssh && chmod 700 /home/crm/.ssh
echo "crm ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/crm   # or set a password instead

# SSH: keys only, no root login   (confirm you can ssh in as crm BEFORE this)
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh

# firewall: only SSH + web. Postgres and the Node port stay private.
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable

# automatic security updates
apt update && apt install -y unattended-upgrades && dpkg-reconfigure -plow unattended-upgrades
```

## 3. Install software (as `crm`, with sudo)

```bash
# Node 24
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs git postgresql postgresql-client rclone
sudo npm install -g pm2

# Caddy (official repo)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

# Libraries headless Chrome needs (WhatsApp)
sudo apt install -y ca-certificates fonts-liberation libasound2t64 libatk-bridge2.0-0 \
  libatk1.0-0 libcups2 libdrm2 libgbm1 libgtk-3-0 libnspr4 libnss3 libxcomposite1 \
  libxdamage1 libxfixes3 libxkbcommon0 libxrandr2 xdg-utils
```

## 4. Database

Postgres listens on localhost only by default, keep it that way.

```bash
DBPASS=$(openssl rand -hex 24); echo "DB password: $DBPASS"   # save this for .env
sudo -u postgres psql -c "CREATE USER crm WITH PASSWORD '$DBPASS';"
sudo -u postgres psql -c "CREATE DATABASE crm_db OWNER crm;"
```

## 5. Get the code

```bash
sudo mkdir -p /srv/crm && sudo chown crm:crm /srv/crm
git clone <your-repo-url> /srv/crm      # private repo: use a deploy key or token
```

## 6. Configure

```bash
cd /srv/crm/server
cp .env.example .env && chmod 600 .env
nano .env
```

Set (see `.env.example`):

```
DATABASE_URL="postgresql://crm:<DBPASS>@localhost:5432/crm_db"
JWT_SECRET="<output of: openssl rand -hex 32>"
ENCRYPTION_KEY="<output of: openssl rand -hex 32>"
CLIENT_URL="https://crm.yourcompany.hu"
NODE_ENV="production"
PORT=5000
```

The server **refuses to start** in production if `JWT_SECRET`/`ENCRYPTION_KEY`
are missing, short, or placeholders. That's intentional.

> **Store `ENCRYPTION_KEY` in a password manager, separately from the server
> and its backups.** Without it, stored integration credentials (Google
> Sheets) can't be decrypted after a restore and must be re-entered.

## 7. Build, migrate, create the first admin, start

```bash
cd /srv/crm/server
npm ci && npx prisma generate && npx prisma migrate deploy && npm run build
cd ../client && npm ci && npm run build

cd ../server
npm run admin:create -- you@yourcompany.hu "Your Name"    # prints a one-time password
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u crm --hp /home/crm    # run the sudo command it prints
```

**Do not run `npm run db:seed` in production.** It creates demo data and an
admin with a publicly known password.

## 8. HTTPS + web

```bash
# edit the domain in deploy/Caddyfile first
sudo cp /srv/crm/deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Visit `https://your-domain`, log in, and change the generated password.

## 9. Link WhatsApp

Log in as admin, go to **Settings → WhatsApp**, and scan the QR code from the
phone whose WhatsApp you want mirrored (Linked Devices → Link a Device). The
session is stored in `/srv/crm/whatsapp-auth` and included in backups. Remember
this uses an unofficial client: there is a real chance of the number being
restricted by WhatsApp; have a plan for that day.

## 10. Backups (do not skip)

Daily backups already run at 03:00 (into `/srv/crm/backups`, keeping 14). They
contain customer data and the WhatsApp session, so lock the folder down and copy
it **off this server**:

```bash
chmod 700 /srv/crm/backups
rclone config     # create an "offsite" remote (Backblaze B2, S3, Drive, ...),
                  # then a second "crypt" remote wrapping it so files are encrypted
crontab -e        # add:
0 4 * * * rclone sync /srv/crm/backups offsite-crypt:crm-backups >> /home/crm/rclone.log 2>&1
```

Then **test a restore** (see `BACKUPS.md`) onto a scratch database before you
trust any of this. An untested backup isn't a backup.

## 11. Updating later

```bash
/srv/crm/deploy/update.sh
```

Backs up first, pulls, migrates, rebuilds, reloads with zero manual steps, and
checks health at the end.

## Useful commands

```bash
pm2 status                 # is it running
pm2 logs crm-server        # app logs
sudo journalctl -u caddy   # web/certificate logs
curl localhost:5000/api/health
```

## Known gaps before real use

- The **Company Info** card in Settings is a non-saving placeholder, and generated
  documents currently use hardcoded company details (name, address, tax number).
  Fix before issuing anything to customers.
- No password-reset flow: an admin can reset a password with
  `npm run admin:create -- <email> "<Name>"` (works on existing users too).
- No error monitoring or uptime alerts. At minimum, set up a free external
  uptime check (e.g. UptimeRobot) on `https://your-domain/api/health`.
