/**
 * Run migration 018 — Scheduled Calls
 *
 * Usage: npx tsx src/scripts/run_migration_018.ts
 */
import { up } from '../db/migrations/018_scheduled_calls.js';
(async () => {
    try {
        await up();
        console.log('Migration 018 complete.');
        process.exit(0);
    }
    catch (err) {
        console.error('Migration 018 failed:', err);
        process.exit(1);
    }
})();
