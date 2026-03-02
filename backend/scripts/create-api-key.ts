import { prisma } from './src/db/prisma.js';
import crypto from 'crypto';

async function createApiKey() {
  // Get first user
  const user = await prisma.user.findFirst();
  
  if (!user) {
    console.log('No users found. Please create a user first.');
    process.exit(1);
  }
  
  // Generate API key
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  // Create API key in database
  const newKey = await prisma.apiKey.create({
    data: {
      name: 'Desktop App - Auto Generated',
      key: apiKey,
      userId: user.id,
      isActive: true,
    }
  });
  
  console.log('');
  console.log('='.repeat(60));
  console.log('API Key Created Successfully!');
  console.log('='.repeat(60));
  console.log('');
  console.log('API Key:', apiKey);
  console.log('User:', user.email);
  console.log('Key ID:', newKey.id);
  console.log('');
  console.log('Use this in your desktop app with X-API-Key header');
  console.log('');
  
  await prisma.$disconnect();
}

createApiKey().catch(console.error);
