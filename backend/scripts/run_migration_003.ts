import { up } from '../src/db/migrations/003_subscription_tiers.js';

console.log('Running migration 003_subscription_tiers...');
console.log('');

try {
  await up();
  console.log('');
  console.log('✅ Migration completed successfully!');
  process.exit(0);
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
}
