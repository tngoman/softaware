/**
 * Runner for Migration 017 — Drop legacy team_chats tables.
 *
 * Usage:
 *   npx ts-node scripts/run_migration_017.ts
 *   -- or --
 *   npx tsx scripts/run_migration_017.ts
 */
import { up } from '../src/db/migrations/017_drop_old_team_chats.js';

(async () => {
  try {
    await up();
    console.log('\nDone. You can now restart the backend.');
    process.exit(0);
  } catch (err) {
    console.error('Migration 017 failed:', err);
    process.exit(1);
  }
})();
