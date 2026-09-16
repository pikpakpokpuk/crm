import cron from 'node-cron';
import { runBackup } from './backup.service';

// Runs a full backup daily at 03:00 server-local time by default.
// Disable with DISABLE_AUTO_BACKUP=true (e.g. for local dev); change the
// time with BACKUP_CRON (standard 5-field cron syntax).
export function startBackupScheduler() {
  if (process.env.DISABLE_AUTO_BACKUP === 'true') {
    console.log('[backup] automatic backups disabled (DISABLE_AUTO_BACKUP=true)');
    return;
  }
  const schedule = process.env.BACKUP_CRON ?? '0 3 * * *';
  cron.schedule(schedule, () => {
    console.log('[backup] starting scheduled backup...');
    runBackup().catch((err) => console.error('[backup] scheduled backup failed:', err.message ?? err));
  });
  console.log(`[backup] scheduled with cron "${schedule}"`);
}
