/**
 * Run migration 023 — Packages System
 * Usage: cd /var/opt/backend && npx tsx src/scripts/run-migration-023.ts
 */
import { up } from '../db/migrations/023_packages_system.js';
import { pool } from '../db/mysql.js';
async function main() {
    try {
        console.log('Running migration 023 — Packages System...');
        await up();
        console.log('Migration 023 completed successfully.');
    }
    catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    }
    finally {
        await pool.end();
    }
}
main();
