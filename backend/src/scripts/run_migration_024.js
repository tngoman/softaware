/**
 * Run Migration 024 — Bugs Tracking System
 * Usage: cd /var/opt/backend && npx tsx src/scripts/run_migration_024.ts
 */
import { up } from '../db/migrations/024_bugs_system.js';
(async () => {
    try {
        await up();
        console.log('Migration 024 completed successfully');
        process.exit(0);
    }
    catch (err) {
        console.error('Migration 024 failed:', err);
        process.exit(1);
    }
})();
