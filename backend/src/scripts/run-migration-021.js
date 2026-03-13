/**
 * Run migration 021 — Local Tasks Storage
 * Usage: npx tsx src/scripts/run-migration-021.ts
 */
import { up } from '../db/migrations/021_local_tasks.js';
import { pool } from '../db/mysql.js';
async function main() {
    try {
        console.log('Running migration 021...');
        await up();
        console.log('Migration 021 completed successfully.');
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
