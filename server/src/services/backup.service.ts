/**
 * Backs up the Postgres database, the WhatsApp session, and uploaded
 * templates into a single timestamped folder under BACKUP_DIR (default:
 * <repo>/backups).
 *
 * Requires the Postgres client tools (pg_dump) to be installed and on
 * PATH — standard alongside any Postgres install, but on a bare app
 * server you may need `apt install postgresql-client` or equivalent.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { ZipArchive } from 'archiver';

const REPO_ROOT = path.join(__dirname, '../../..');
const SERVER_ROOT = path.join(__dirname, '../..');
const BACKUP_ROOT = process.env.BACKUP_DIR ?? path.join(REPO_ROOT, 'backups');
const RETENTION_COUNT = parseInt(process.env.BACKUP_RETENTION_COUNT ?? '14', 10);

function timestamp(): string {
  return new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'inherit', 'pipe'] });
    let stderr = '';
    child.stderr?.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new Error(`"${cmd}" not found on PATH. Install the Postgres client tools (they ship pg_dump) and try again.`));
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

function zipDirectory(sourceDir: string, outFile: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(sourceDir)) { resolve(); return; }
    const output = fs.createWriteStream(outFile);
    const archive = new ZipArchive({ zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

function pruneOldBackups() {
  if (!fs.existsSync(BACKUP_ROOT)) return;
  const entries = fs.readdirSync(BACKUP_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort(); // ISO timestamps sort chronologically as strings
  const excess = entries.length - RETENTION_COUNT;
  if (excess <= 0) return;
  for (const name of entries.slice(0, excess)) {
    fs.rmSync(path.join(BACKUP_ROOT, name), { recursive: true, force: true });
    console.log(`[backup] pruned old backup ${name}`);
  }
}

export async function runBackup(): Promise<string> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL is not set');

  const dir = path.join(BACKUP_ROOT, timestamp());
  fs.mkdirSync(dir, { recursive: true });
  console.log(`[backup] writing to ${dir}`);

  const dbDumpPath = path.join(dir, 'db.sql');
  await run('pg_dump', ['--format=plain', '--no-owner', '--no-privileges', '--dbname', dbUrl, '--file', dbDumpPath]);

  const gz = zlib.gzipSync(fs.readFileSync(dbDumpPath));
  fs.writeFileSync(`${dbDumpPath}.gz`, gz);
  fs.unlinkSync(dbDumpPath);
  console.log(`[backup] database dump: ${(fs.statSync(`${dbDumpPath}.gz`).size / 1024).toFixed(1)} KB`);

  await zipDirectory(path.join(SERVER_ROOT, 'uploads'), path.join(dir, 'uploads.zip'));
  await zipDirectory(path.join(REPO_ROOT, 'whatsapp-auth'), path.join(dir, 'whatsapp-auth.zip'));

  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
    createdAt: new Date().toISOString(),
    database: fs.existsSync(`${dbDumpPath}.gz`),
    uploads: fs.existsSync(path.join(dir, 'uploads.zip')),
    whatsappAuth: fs.existsSync(path.join(dir, 'whatsapp-auth.zip')),
  }, null, 2));

  pruneOldBackups();
  console.log('[backup] done');
  return dir;
}
