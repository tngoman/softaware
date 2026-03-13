/**
 * Run Migration 026 — AI Telemetry Consent & Analytics
 * Usage: cd /var/opt/backend && npx tsx src/scripts/run_migration_026.ts
 */
import { up } from '../db/migrations/026_ai_telemetry.js';
(async () => {
    try {
        await up();
        console.log('Migration 026 completed successfully');
        process.exit(0);
    }
    catch (err) {
        console.error('Migration 026 failed:', err);
        process.exit(1);
    }
})();
