/**
 * Run migration 019 — Assistant Capabilities: Form Submissions
 *
 * Usage: npx tsx src/scripts/run_migration_019.ts
 */
import { up } from '../db/migrations/019_assistant_capabilities.js';

(async () => {
  try {
    await up();
    console.log('Migration 019 complete.');
    process.exit(0);
  } catch (err) {
    console.error('Migration 019 failed:', err);
    process.exit(1);
  }
})();
