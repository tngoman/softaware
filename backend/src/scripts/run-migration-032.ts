import { up } from '../db/migrations/032_package_limits_catalog.js';

(async () => {
  try {
    console.log('Running migration 032 — package limits catalog...');
    await up();
    console.log('Migration 032 completed successfully.');
    process.exit(0);
  } catch (error: any) {
    console.error('Migration 032 failed:', error?.message || error);
    process.exit(1);
  }
})();
