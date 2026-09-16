/**
 * Restores a backup produced by backup.ts. DESTRUCTIVE: overwrites the
 * current database, uploads/, and whatsapp-auth/ with the backup's contents.
 *
 * Usage: npm run db:restore -- <path-to-backup-folder> --yes
 * The --yes flag is required so this can never run by accident.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import unzipper from 'unzipper';
import 'dotenv/config';

const REPO_ROOT = path.join(__dirname, '../../..');
const SERVER_ROOT = path.join(__dirname, '../..');

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'inherit', 'pipe'] });
    let stderr = '';
    child.stderr?.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new Error(`"${cmd}" not found on PATH. Install the Postgres client tools and try again.`));
      } else {
        reject(err);
      }
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}: ${stderr.trim()}`));
    });
  });
}

async function unzipTo(zipPath: string, destDir: string) {
  if (!fs.existsSync(zipPath)) return;
  fs.rmSync(destDir, { recursive: true, force: true });
  fs.mkdirSync(destDir, { recursive: true });
  await fs.createReadStream(zipPath).pipe(unzipper.Extract({ path: destDir })).promise();
}

async function main() {
  const args = process.argv.slice(2);
  const confirmed = args.includes('--yes');
  const dir = args.find((a) => !a.startsWith('--'));

  if (!dir) {
    console.error('Usage: npm run db:restore -- <path-to-backup-folder> --yes');
    process.exit(1);
  }
  if (!fs.existsSync(dir)) {
    console.error(`Backup folder not found: ${dir}`);
    process.exit(1);
  }
  if (!confirmed) {
    console.error(`This OVERWRITES the current database, uploads/, and whatsapp-auth/ with the contents of:\n  ${dir}\nRe-run with --yes to actually do this.`);
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL is not set');

  const dbDumpGz = path.join(dir, 'db.sql.gz');
  const dbDump = path.join(dir, 'db.sql');
  let sqlPath: string;
  let isTemp = false;
  if (fs.existsSync(dbDumpGz)) {
    sqlPath = path.join(dir, '.restore-db.sql');
    fs.writeFileSync(sqlPath, zlib.gunzipSync(fs.readFileSync(dbDumpGz)));
    isTemp = true;
  } else if (fs.existsSync(dbDump)) {
    sqlPath = dbDump;
  } else {
    throw new Error('No db.sql or db.sql.gz found in backup folder');
  }

  console.log('[restore] restoring database...');
  await run('psql', [dbUrl, '--file', sqlPath]);
  if (isTemp) fs.unlinkSync(sqlPath);

  console.log('[restore] restoring uploads/...');
  await unzipTo(path.join(dir, 'uploads.zip'), path.join(SERVER_ROOT, 'uploads'));

  console.log('[restore] restoring whatsapp-auth/...');
  await unzipTo(path.join(dir, 'whatsapp-auth.zip'), path.join(REPO_ROOT, 'whatsapp-auth'));

  console.log('[restore] done. Restart the server.');
}

main().catch((err) => {
  console.error('[restore] FAILED:', err.message ?? err);
  process.exit(1);
});
