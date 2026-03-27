/**
 * Run Migration 029 — Client Custom Data (Generic CMS + Storage Ledger)
 * Usage: cd /var/opt/backend && npx tsx src/scripts/run_migration_029.ts
 */
import { up } from '../db/migrations/029_client_custom_data.js';

(async () => {
  try {
    await up();
    console.log('Migration 029 completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Migration 029 failed:', err);
    process.exit(1);
  }
})();
