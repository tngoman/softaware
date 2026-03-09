/**
 * Runner for migration 016 — WebAuthn + Sessions
 * Usage: npx tsx scripts/run_migration_016.ts
 */
import { up } from '../src/db/migrations/016_webauthn_sessions.js';

async function main() {
  try {
    await up();
    console.log('\nDone.');
    process.exit(0);
  } catch (err) {
    console.error('Migration 016 failed:', err);
    process.exit(1);
  }
}

main();
