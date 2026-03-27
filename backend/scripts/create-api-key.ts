import { db } from './src/db/mysql.js';
import crypto from 'crypto';

async function createApiKey() {
  // Get first user
  const user: any = await db.queryOne('SELECT id, email FROM users LIMIT 1');
  
  if (!user) {
    console.log('No users found. Please create a user first.');
    process.exit(1);
  }
  
  // Generate API key
  const apiKey = crypto.randomBytes(32).toString('hex');
  const id = crypto.randomUUID();
  const now = new Date();
  
  // Create API key in database
  await db.execute(
    `INSERT INTO api_keys (id, name, \`key\`, userId, isActive, createdAt)
     VALUES (?, ?, ?, ?, 1, ?)`,
    [id, 'Desktop App - Auto Generated', apiKey, user.id, now]
  );
  
  console.log('');
  console.log('='.repeat(60));
  console.log('API Key Created Successfully!');
  console.log('='.repeat(60));
  console.log('');
  console.log('API Key:', apiKey);
  console.log('User:', user.email);
  console.log('Key ID:', id);
  console.log('');
  console.log('Use this in your desktop app with X-API-Key header');
  console.log('');
}

createApiKey().catch(console.error);
