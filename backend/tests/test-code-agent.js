#!/usr/bin/env node

// Test the Code Agent API
// First, you need to get an auth token. For testing, we'll skip auth.
// In production, use proper JWT token from /auth/login

const BASE_URL = 'http://localhost:8787';

// Test 1: Check available AI providers
async function testProviders() {
  console.log('\n=== Testing AI Providers ===');
  const response = await fetch(`${BASE_URL}/code-agent/provider`, {
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with real token
    }
  });
  const data = await response.json();
  console.log('Available providers:', JSON.stringify(data, null, 2));
}

// Test 2: List files in directory
async function testListFiles() {
  console.log('\n=== Listing Files ===');
  const response = await fetch(`${BASE_URL}/code-agent/list-files`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with real token
    },
    body: JSON.stringify({
      directory: '/var/www/code/app_one'
    })
  });
  const data = await response.json();
  console.log('Files:', JSON.stringify(data, null, 2));
}

// Test 3: Execute code editing instruction
async function testCodeEdit() {
  console.log('\n=== Testing Code Edit ===');
  const response = await fetch(`${BASE_URL}/code-agent/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with real token
    },
    body: JSON.stringify({
      directory: '/var/www/code/app_one',
      instruction: 'Create a simple Express.js server that listens on port 3000 and has a /hello endpoint',
      provider: 'glm',
      files: ['index.js'] // Include context
    })
  });
  const data = await response.json();
  console.log('Result:', JSON.stringify(data, null, 2));
}

// Run tests
async function main() {
  console.log('Code Agent API Test');
  console.log('===================');
  console.log('\nNote: You need to set a valid JWT token in the Authorization header');
  console.log('Get token by calling: POST /auth/login with your credentials\n');
  
  // Uncomment to run tests when you have a token:
  // await testProviders();
  // await testListFiles();
  // await testCodeEdit();
}

main().catch(console.error);
