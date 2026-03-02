# Tests

This directory contains all test scripts for the backend.

## Test Files

### Authentication Tests
- **test-auth.mjs** - Authentication testing

### AI Provider Tests
- **test-glm.ts** - GLM AI provider tests
- **test-glm-connection.ts** - GLM connection tests
- **test-glm-openai.ts** - GLM OpenAI compatibility tests
- **test_openrouter_direct.mjs** - OpenRouter direct API tests
- **test_vision_integration.mjs** - Vision API integration tests

### API Tests
- **test_api_key_file_upload.mjs** - API key with file upload tests
- **test_backwards_compat.mjs** - Backwards compatibility tests

### Code Agent Tests
- **test-code-agent.js** - Code agent functionality tests

### Utilities
- **generate_test_token.mjs** - Generate JWT tokens for testing

## Running Tests

```bash
# Run a specific test
npm run dev # or tsx
tsx tests/test-glm.ts

# Generate test token
node tests/generate_test_token.mjs
```
