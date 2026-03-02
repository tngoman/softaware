#!/usr/bin/env node

/**
 * Generate a test JWT token for API testing
 * Usage: node generate-test-token.mjs [userId]
 */

import jwt from 'jsonwebtoken';
import 'dotenv/config';

const JWT_SECRET = process.env.JWT_SECRET;
const userId = process.argv[2] || 'test-user-123';

if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET not found in environment');
  console.error('   Make sure .env file exists with JWT_SECRET');
  process.exit(1);
}

const token = jwt.sign(
  { userId },
  JWT_SECRET,
  { expiresIn: '24h' }
);

console.log('✅ Test JWT Token Generated');
console.log('   User ID:', userId);
console.log('   Expires: 24 hours\n');
console.log('Token:');
console.log(token);
console.log('\nUsage:');
console.log(`curl -H "Authorization: Bearer ${token}" http://localhost:8787/api/v1/sites`);
