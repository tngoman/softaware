import 'dotenv/config';
import { glmService } from './src/services/glmService.js';

async function test() {
  console.log('Testing GLM API...');
  
  try {
    // Test 1: Simple chat
    console.log('\n--- Test 1: Simple Chat ---');
    const response1 = await glmService.simpleChat(
      'Say "Hello! GLM API is working correctly." in a single sentence.'
    );
    console.log('Response:', response1);

    // Test 2: Chat with system prompt
    console.log('\n--- Test 2: Chat with System Prompt ---');
    const response2 = await glmService.simpleChat(
      'What is 2+2?',
      'You are a helpful math tutor. Always explain your answers.'
    );
    console.log('Response:', response2);

    // Test 3: Full chat API
    console.log('\n--- Test 3: Full Chat API ---');
    const response3 = await glmService.chat({
      messages: [
        { role: 'user', content: 'Write a haiku about coding' }
      ],
      temperature: 0.8,
      max_tokens: 100,
    });
    console.log('Response:', JSON.stringify(response3, null, 2));

    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

test();
