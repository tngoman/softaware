/**
 * Run Migration 025 — Contact Documentation
 * Usage: cd /var/opt/backend && npx tsx src/scripts/run_migration_025.ts
 */
import { up } from '../db/migrations/025_contact_documentation.js';
(async () => {
    try {
        await up();
        console.log('Migration 025 completed successfully');
        process.exit(0);
    }
    catch (err) {
        console.error('Migration 025 failed:', err);
        process.exit(1);
    }
})();
