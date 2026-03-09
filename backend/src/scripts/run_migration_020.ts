/**
 * Run Migration 020 — Calendar Events
 * Usage: cd /var/opt/backend && npx tsx src/scripts/run_migration_020.ts
 */
import { up } from '../db/migrations/020_calendar_events.js';

(async () => {
  try {
    await up();
    console.log('Migration 020 completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Migration 020 failed:', err);
    process.exit(1);
  }
})();
