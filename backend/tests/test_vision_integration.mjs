#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const API_URL = 'http://localhost:8787/ai/chat';
const IMAGE_PATH = '/var/www/code/silulumanzi/portal/images/Silulumanzi.jpg';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXItMSIsImlhdCI6MTc2ODQ1MDM2NSwiZXhwIjoxNzY4NTM2NzY1fQ.A_O3HdkR-xN_R8cjLGtYgZz9jJMumTbjymrl6rJnUZY';

async function testVision() {
  try {
    // Read and encode image
    const imageBuffer = fs.readFileSync(IMAGE_PATH);
    const base64Image = imageBuffer.toString('base64');

    // Prepare request
    const payload = {
      messages: [
        {
          role: "user",
          content: "What text do you see in this file? Be concise.",
          files: [
            {
              mimeType: "image/jpeg",
              dataBase64: base64Image
            }
          ]
        }
      ],
      provider: "softaware"
    };

    console.log('Sending vision request to backend...');
    console.log('Image size:', (base64Image.length / 1024).toFixed(2), 'KB (base64)');
    
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
    
    console.log('\n✓ Success!');
    console.log('Model:', result.model);
    console.log('Response:', result.choices?.[0]?.message?.content || result.content);
    console.log('\nFull result:', JSON.stringify(result, null, 2));
    console.log('\n' + '='.repeat(60));
    
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    process.exit(1);
  }
}

testVision();
