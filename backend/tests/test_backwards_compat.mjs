#!/usr/bin/env node

import fs from 'fs';

const API_URL = 'http://localhost:8787/ai/chat';
const IMAGE_PATH = '/var/www/code/silulumanzi/portal/images/Silulumanzi.jpg';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXItMSIsImlhdCI6MTc2ODQ1MDM2NSwiZXhwIjoxNzY4NTM2NzY1fQ.A_O3HdkR-xN_R8cjLGtYgZz9jJMumTbjymrl6rJnUZY';

async function testBackwardsCompatibility() {
  try {
    const imageBuffer = fs.readFileSync(IMAGE_PATH);
    const base64Image = imageBuffer.toString('base64');

    console.log('Testing backwards compatibility with "images" field...');
    
    const payload = {
      messages: [
        {
          role: "user",
          content: "Extract text from this image.",
          images: [  // Using old "images" field
            {
              mimeType: "image/jpeg",
              dataBase64: base64Image
            }
          ]
        }
      ],
      provider: "softaware"
    };

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Backend error: ${response.status} - ${error}`);
    }

    const result = await response.json();
    
    console.log('\n✓ Backwards compatibility works!');
    console.log('Response:', result.choices?.[0]?.message?.content);
    
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    process.exit(1);
  }
}

testBackwardsCompatibility();
