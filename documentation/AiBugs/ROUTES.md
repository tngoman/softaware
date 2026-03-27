# AI Bug Resolution — Route Reference

> **Module**: AI-Assisted Bug Fixing  

---

## Table of Contents

1. [Route Summary](#route-summary)  
2. [POST /v1/mobile/intent](#post-v1mobileintent)  
3. [GET /v1/mobile/my-assistant](#get-v1mobilemy-assistant)  
4. [Debug Tool Execution Flow](#debug-tool-execution-flow)  
5. [Supporting Routes](#supporting-routes)  

---

## Route Summary

| Method | Route                        | Auth     | Purpose                              | File                  |
|--------|------------------------------|----------|--------------------------------------|-----------------------|
| POST   | `/v1/mobile/intent`          | JWT      | Send message to AI assistant          | `mobileIntent.ts`    |
| GET    | `/v1/mobile/my-assistant`    | JWT      | List user's personal assistants       | `myAssistant.ts`     |
| PUT    | `/v1/system/users/:id`       | JWT+Admin| Update user (incl. AI tools grant)    | `systemUsers.ts`     |
| PUT    | (software endpoint)          | JWT+Staff| Update software (incl. linked codebase)| `SoftwareManagement` |

---

## POST /v1/mobile/intent

Process an AI chat message, optionally triggering tool calls.

### Request

```bash
curl -X POST https://example.com/api/v1/mobile/intent \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Bug #42: \"Login button broken\"\nThe login button does not respond to clicks on mobile.\n\nA codebase IS linked to this software project (software_id: 5). You CAN use developer tools.",
    "assistantId": 1,
    "conversationId": null
  }'
```

### Request Body

| Field            | Type             | Required | Description                                       |
|------------------|------------------|----------|---------------------------------------------------|
| `text`           | `string`         | Yes      | User message or initial bug context               |
| `assistantId`    | `number`         | No       | Personal assistant ID for prompt stitching         |
| `conversationId` | `string \| null` | No       | Existing conversation UUID, or null to create new  |

### Response — Success (200)

```json
{
  "reply": "I've analysed the bug. The issue appears to be in the LoginButton component. The click handler is missing a preventDefault() call. Would you like me to fix it?",
  "conversationId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "toolsUsed": [],
  "data": null
}
```

### Response — With Tool Calls (200)

When the AI decides to use tools, the response includes tool execution
results:

```json
{
  "reply": "I've updated the LoginButton component to add the missing preventDefault() call. The fix has been applied to src/components/LoginButton.tsx.",
  "conversationId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "toolsUsed": ["modify_codebase"],
  "data": {
    "modify_codebase": {
      "success": true,
      "message": "File src/components/LoginButton.tsx updated successfully."
    }
  }
}
```

### Response — Error (500)

```json
{
  "error": "Internal server error"
}
```

### Notes

- The first call from the AI Resolution tab includes the full bug context
  (title, description, severity, codebase status) in the `text` field.
- Subsequent calls send just the user's typed message.
- `conversationId` is `null` on the first call; the response returns a new
  UUID which must be sent on all subsequent calls.
- The AI may perform multiple tool rounds internally before returning the
  final response (up to `MAX_TOOL_ROUNDS`).

---

## GET /v1/mobile/my-assistant

Retrieve the authenticated user's personal assistants.

### Request

```bash
curl -X GET https://example.com/api/v1/mobile/my-assistant \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### Response — Success (200)

```json
{
  "success": true,
  "assistants": [
    {
      "id": 1,
      "name": "DevBot",
      "core_instructions": "You are a helpful developer assistant...",
      "personality_flare": "Be concise and technical.",
      "createdAt": "2026-03-10T08:00:00.000Z"
    }
  ]
}
```

### Response — No Assistants (200)

```json
{
  "success": true,
  "assistants": []
}
```

### Notes

- Returns an **array** (`assistants`), not a singular object.
- The AI Resolution tab in Bugs.tsx uses `assistants[0]` (first assistant).
- If the array is empty, the UI shows the "Personal Assistant Required" CTA.
- The frontend must call this endpoint **without** a leading `/api` prefix
  because the Axios `baseURL` already includes `/api`.

### Frontend Usage

```typescript
// Bugs.tsx — correct usage
const res = await api.get('/v1/mobile/my-assistant');
const assistants = res.data.assistants; // Array
const assistant = assistants.length > 0 ? assistants[0] : null;

// ❌ WRONG — causes double /api prefix (404)
const res = await api.get('/api/v1/mobile/my-assistant');
```

---

## Debug Tool Execution Flow

When the AI decides to call a debug tool, the following flow executes
server-side within a single `POST /v1/mobile/intent` request:

```
POST /v1/mobile/intent
  │
  ▼
mobileAIProcessor.processMobileIntent()
  │
  ├── 1. Query ai_developer_tools_granted
  ├── 2. getToolsForRole(role, isDev)
  │       └── includes AI_DEBUG_TOOLS if isDev=true
  ├── 3. Build system prompt with tool definitions
  ├── 4. Call LLM (Ollama)
  │
  ▼ LLM returns tool_call
  │
  ├── 5. Parse tool call JSON
  ├── 6. executeMobileAction(name, args, ctx)
  │       │
  │       ▼
  │   mobileActionExecutor.ts
  │       │
  │       ├── READ-ONLY TOOLS (typically called first):
  │       │   ├── case 'list_codebase_files':  → execListCodebaseFiles
  │       │   ├── case 'read_codebase_file':  → execReadCodebaseFile
  │       │   └── case 'search_codebase':     → execSearchCodebase
  │       │
  │       ├── WRITE TOOLS (called after reading):
  │       │   ├── case 'modify_codebase':       → execModifyCodebase
  │       │   │     (captures old content, writes new, generates diff)
  │       │   ├── case 'run_dev_server':        → execRunDevServer
  │       │   ├── case 'commit_and_push_bugfix': → execCommitAndPushBugfix
  │       │   └── case 'run_migrations':        → execRunMigrations
  │       │
  │       │   All cases wrapped in requireStaff(ctx, () => ...)
  │       │
  │       └── Returns ToolResult { success, message }
  │
  ├── 7. saveMessage(conversationId, 'tool', result.message)
  ├── 8. Feed tool result back to LLM
  ├── 9. LLM generates final response
  ├── 10. saveMessage(conversationId, 'assistant', reply)
  │
  ▼
Return { reply, conversationId, toolsUsed, data }
```

### Tool-Specific Parameters

#### list_codebase_files

```json
{
  "tool_call": {
    "name": "list_codebase_files",
    "arguments": {
      "softwareId": 5,
      "directoryPath": "app/Http/Controllers"
    }
  }
}
```

| Parameter       | Type     | Required | Description                              |
|-----------------|----------|----------|------------------------------------------|
| `softwareId`    | `number` | Yes      | FK to `update_software.id`               |
| `directoryPath` | `string` | No       | Relative path from codebase root (default: `.`) |

**Notes**: Filters out hidden files, `node_modules`, `vendor`, and `.git`.
Shows 📁 for directories, 📄 for files with size in KB.

---

#### read_codebase_file

```json
{
  "tool_call": {
    "name": "read_codebase_file",
    "arguments": {
      "softwareId": 5,
      "filePath": "app/Http/Controllers/TicketController.php",
      "startLine": 50,
      "endLine": 100
    }
  }
}
```

| Parameter    | Type     | Required | Description                              |
|--------------|----------|----------|------------------------------------------|
| `softwareId` | `number` | Yes      | FK to `update_software.id`               |
| `filePath`   | `string` | Yes      | Relative path from codebase root         |
| `startLine`  | `number` | No       | First line to read (1-based)             |
| `endLine`    | `number` | No       | Last line to read (1-based, inclusive)   |

**Notes**: Returns content with line numbers (`   1 | code...`).  Truncates
at 500 lines max.  Includes language hint based on file extension.

---

#### search_codebase

```json
{
  "tool_call": {
    "name": "search_codebase",
    "arguments": {
      "softwareId": 5,
      "searchPattern": "createTicket",
      "filePattern": "*.php",
      "maxResults": 20
    }
  }
}
```

| Parameter       | Type     | Required | Description                              |
|-----------------|----------|----------|------------------------------------------|
| `softwareId`    | `number` | Yes      | FK to `update_software.id`               |
| `searchPattern` | `string` | Yes      | Text/pattern to search for               |
| `filePattern`   | `string` | No       | Glob pattern for file filtering (default: `*`) |
| `maxResults`    | `number` | No       | Max results returned (default: 50, max: 100) |

**Notes**: Uses `grep -rn` with `--exclude-dir` for `node_modules`, `vendor`,
`.git`, `storage`, `bootstrap/cache`.  Shell special chars are escaped.
Grep exit code 1 (no matches) is handled gracefully.

---

#### modify_codebase

```json
{
  "tool_call": {
    "name": "modify_codebase",
    "arguments": {
      "softwareId": 5,
      "filePath": "src/components/LoginButton.tsx",
      "content": "import React from 'react';\n\nexport const LoginButton = () => {\n  const handleClick = (e: React.MouseEvent) => {\n    e.preventDefault();\n    // ... login logic\n  };\n  return <button onClick={handleClick}>Login</button>;\n};"
    }
  }
}
```

| Parameter    | Type     | Required | Description                          |
|--------------|----------|----------|--------------------------------------|
| `softwareId` | `number` | Yes      | FK to `update_software.id`           |
| `filePath`   | `string` | Yes      | Relative path from codebase root     |
| `content`    | `string` | Yes      | Full new file content                |

**Notes**: Before writing, captures the original file content.  After writing,
generates a unified diff via `diff -u`.  Returns:
- Line counts: `+N added, -N removed`
- Full unified diff in a `\`\`\`diff` block
- For new files: shows full content in a language-tagged code block
- For unchanged files: returns warning that content is identical

**Response Example (modified file):**

```json
{
  "success": true,
  "message": "✅ File src/components/LoginButton.tsx updated successfully.\n\n**Summary:** +2 lines added, -1 lines removed\n\n...diff...\n"
}

---

#### run_dev_server

```json
{
  "tool_call": {
    "name": "run_dev_server",
    "arguments": {
      "softwareId": 5
    }
  }
}
```

| Parameter    | Type     | Required | Description                          |
|--------------|----------|----------|--------------------------------------|
| `softwareId` | `number` | Yes      | FK to `update_software.id`           |

**Notes**: Runs `npm run dev` as a background process. Requires a `dev`
script in the codebase's `package.json`.

---

#### commit_and_push_bugfix

```json
{
  "tool_call": {
    "name": "commit_and_push_bugfix",
    "arguments": {
      "softwareId": 5,
      "commitMessage": "fix: add preventDefault to LoginButton click handler (#42)"
    }
  }
}
```

| Parameter       | Type     | Required | Description                       |
|-----------------|----------|----------|-----------------------------------|
| `softwareId`    | `number` | Yes      | FK to `update_software.id`        |
| `commitMessage` | `string` | Yes      | Git commit message                |

**Notes**: Executes `git add . && git commit -m "<message>" && git push`
in the codebase directory.

---

#### run_migrations

```json
{
  "tool_call": {
    "name": "run_migrations",
    "arguments": {
      "softwareId": 5,
      "migrationsDir": "db/migrations"
    }
  }
}
```

| Parameter       | Type     | Required | Description                       |
|-----------------|----------|----------|-----------------------------------|
| `softwareId`    | `number` | Yes      | FK to `update_software.id`        |
| `migrationsDir` | `string` | Yes      | Relative path to migrations dir   |

**Notes**: Currently only lists the migrations directory contents.
Actual SQL execution is not yet implemented (see Known Issue #7 in
CHANGES.md).

---

## Supporting Routes

These routes are not specific to AI Bugs but are used by the subsystem:

### PUT /v1/system/users/:id — Update AI Tools Grant

```bash
curl -X PUT https://example.com/api/v1/system/users/abc-123 \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "ai_developer_tools_granted": true
  }'
```

| Field                        | Type      | Required | Description                    |
|------------------------------|-----------|----------|--------------------------------|
| `ai_developer_tools_granted` | `boolean` | No       | Enable/disable AI debug tools  |

### Response (200)

Returns the updated user object including `ai_developer_tools_granted`.

---

### Software Update — Set Linked Codebase

```bash
curl -X PUT https://example.com/api/v1/software/:id \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "linked_codebase": "/var/www/code/myapp"
  }'
```

| Field              | Type     | Required | Description                              |
|--------------------|----------|----------|------------------------------------------|
| `linked_codebase`  | `string` | No       | Absolute path to codebase root directory  |

**Constraint**: Must start with `/var/www/code/` (enforced by
`debugExecutor.ts` at execution time, not at save time).

---

*Document generated from the AI Bug Resolution subsystem implementation.*
