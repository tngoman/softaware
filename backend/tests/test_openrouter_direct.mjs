#!/usr/bin/env node

const OPENROUTER_API_KEY = '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';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function testOpenRouter() {
  console.log('Testing OpenRouter API...');
  console.log('API Key:', OPENROUTER_API_KEY.substring(0, 20) + '...');
  console.log('Endpoint:', OPENROUTER_URL);
  
  try {
    // Test 1: Simple text-only request
    console.log('\n--- Test 1: Text-only request ---');
    const textResponse = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://softaware.net.za',
        'X-Title': 'Softaware Test'
      },
      body: JSON.stringify({
        model: 'qwen/qwen-2-vl-7b-instruct:free',
        messages: [
          { role: 'user', content: 'Say hello in 3 words' }
        ]
      }),
      signal: AbortSignal.timeout(10000)
    });

    console.log('Status:', textResponse.status);
    const textData = await textResponse.json();
    console.log('Response:', JSON.stringify(textData, null, 2));

    if (!textResponse.ok) {
      throw new Error(`OpenRouter error: ${textResponse.status}`);
    }

    console.log('✅ Text request PASSED');

    // Test 2: Vision request with image
    console.log('\n--- Test 2: Vision request with small base64 image ---');
    
    // Tiny 1x1 red pixel PNG
    const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
    
    const visionResponse = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://softaware.net.za',
        'X-Title': 'Softaware Test'
      },
      body: JSON.stringify({
        model: 'qwen/qwen-2-vl-7b-instruct:free',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What color is this image?' },
              { 
                type: 'image_url',
                image_url: { url: `data:image/png;base64,${tinyPng}` }
              }
            ]
          }
        ]
      }),
      signal: AbortSignal.timeout(30000)
    });

    console.log('Status:', visionResponse.status);
    const visionData = await visionResponse.json();
    console.log('Response:', JSON.stringify(visionData, null, 2));

    if (!visionResponse.ok) {
      throw new Error(`OpenRouter vision error: ${visionResponse.status}`);
    }

    console.log('✅ Vision request PASSED');

  } catch (error) {
    console.error('\n❌ OpenRouter test FAILED');
    console.error('Error:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
    process.exit(1);
  }
}

testOpenRouter();
