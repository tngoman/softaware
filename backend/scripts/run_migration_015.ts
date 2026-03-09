import { up } from '../src/db/migrations/015_chat_enhancements.js';

console.log('Running migration 015_chat_enhancements...');
console.log('');

try {
  await up();
  console.log('');
  console.log('✅ Migration 015_chat_enhancements completed successfully!');
  process.exit(0);
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
}
