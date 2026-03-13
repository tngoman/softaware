# Tests

This directory contains all test scripts for the backend.

## Test Files

### Task Tool Unit Tests (v2.1.0) ⭐
- **task-tools.test.ts** - 80 unit tests for the 22 staff AI assistant task tool executors
  - Role guard tests (22 tools × client rejection)
  - Core CRUD: list_tasks, get_task, create_task, update_task, delete_task
  - Comments: get_task_comments, add_task_comment
  - Local enhancements: bookmark_task, set_task_priority, set_task_color, set_task_tags
  - Workflow actions: start_task, complete_task, approve_task
  - Stats & queries: get_task_stats, get_pending_approvals, get_task_tags
  - Sync: sync_tasks, get_sync_status
  - Invoice staging: stage_tasks_for_invoice, get_staged_invoices, process_staged_invoices

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
# Run all vitest tests
npm test

# Run tests in watch mode
npm run test:watch

# Run a specific test file
npx vitest run tests/task-tools.test.ts

# Run legacy tests (tsx/node)
tsx tests/test-glm.ts
node tests/generate_test_token.mjs
```
