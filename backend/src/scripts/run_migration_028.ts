/**
 * Run Migration 028 — Yoco Payment Gateway
 * Usage: cd /var/opt/backend && npx tsx src/scripts/run_migration_028.ts
 */
import { up } from '../db/migrations/028_yoco_gateway.js';

(async () => {
  try {
    await up();
    console.log('Migration 028 completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Migration 028 failed:', err);
    process.exit(1);
  }
})();
