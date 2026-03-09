import { up } from '../src/db/migrations/014_chat_system.js';

console.log('Running migration 014_chat_system...');
console.log('');

try {
  await up();
  console.log('');
  console.log('✅ Migration 014_chat_system completed successfully!');
  process.exit(0);
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
}
