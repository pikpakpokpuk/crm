import 'dotenv/config';
import { runBackup } from '../services/backup.service';

runBackup()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[backup] FAILED:', err.message ?? err);
    process.exit(1);
  });
