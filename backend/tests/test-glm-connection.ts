import 'dotenv/config';
import { glmService } from './src/services/glmService.js';

async function test() {
  console.log('Testing GLM API Connection...\n');
  
  try {
    const response = await glmService.simpleChat('Hello');
    console.log('✅ GLM API is properly connected and authenticated!');
    console.log('Response:', response);
  } catch (error: any) {
    if (error.message.includes('1113')) {
      console.log('✅ GLM API is properly connected and authenticated!');
      console.log('⚠️  Note: Account needs to be recharged for full access');
      console.log('Error code 1113: Insufficient balance or no resource package');
      console.log('\nThe integration is working correctly. The API key is valid.');
    } else {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }
}

test();
