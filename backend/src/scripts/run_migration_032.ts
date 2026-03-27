/**
 * Run Migration 032 — Payroll System
 * Usage: cd /var/opt/backend && npx tsx src/scripts/run_migration_032.ts
 */
import { up } from '../db/migrations/032_payroll_system.js';

(async () => {
  try {
    await up();
    console.log('Migration 032 completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Migration 032 failed:', err);
    process.exit(1);
  }
})();
