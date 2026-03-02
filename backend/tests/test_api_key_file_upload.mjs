#!/usr/bin/env node

import fs from 'fs';

const API_URL = 'http://localhost:8787/ai/api/chat';
const API_KEY = '0174e6487f5ea034e1cddbcbac8d9d89093638a274cf3c2e73a13231b24683f5';
const PDF_PATH = process.argv[2] || '/var/Tshivhidzo stanley C-VITAE.pdf';

async function testFileUpload() {
  try {
    console.log('Testing file upload with API key authentication...');
    console.log('File:', PDF_PATH);
    
    // Read and encode file
    const fileBuffer = fs.readFileSync(PDF_PATH);
    const base64File = fileBuffer.toString('base64');
    console.log('File size:', (fileBuffer.length / 1024).toFixed(2), 'KB');
    console.log('Base64 size:', (base64File.length / 1024).toFixed(2), 'KB');

    // Prepare request exactly as web app sends it
    const payload = {
      messages: [{
        role: "user",
        content: "Extract the name and email from this CV.",
        files: [{
          mimeType: "application/pdf",
          dataBase64: base64File
        }]
      }],
      temperature: 0.1,
      max_tokens: 500
    };

    console.log('\nSending request to:', API_URL);
    console.log('Payload structure:', {
      messagesCount: payload.messages.length,
      hasFiles: payload.messages[0].files?.length > 0,
      filesCount: payload.messages[0].files?.length
    });

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify(payload)
    });

    console.log('\nResponse status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('\n❌ ERROR Response:', errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('\n✅ Success!');
    console.log('Result:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
    process.exit(1);
  }
}

testFileUpload();
