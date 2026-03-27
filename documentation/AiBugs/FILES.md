# AI Bug Resolution — File Reference

> **Module**: AI-Assisted Bug Fixing  

---

## Table of Contents

1. [Overview](#overview)  
2. [Backend Files](#backend-files)  
3. [Frontend Files](#frontend-files)  
4. [Route Handlers](#route-handlers)  
5. [Internal Helpers](#internal-helpers)  
6. [Constants & Exports](#constants--exports)  

---

## Overview

| Metric                   | Value         |
|--------------------------|---------------|
| Total files touched      | 13            |
| New files created        | 2             |
| Existing files modified  | 11            |
| Backend files            | 8             |
| Frontend files           | 5             |
| Estimated new LOC        | ~600          |

---

## Backend Files

### New Files

#### debugTools.ts

| Property     | Value                                                |
|--------------|------------------------------------------------------|
| **Path**     | `backend/src/services/debugTools.ts`                 |
| **LOC**      | ~110                                                 |
| **Purpose**  | Defines the 7 AI developer tool definitions for LLM  |
| **Exports**  | `AI_DEBUG_TOOLS: ToolDefinition[]`                   |
| **Dependencies** | `actionRouter.ts` (ToolDefinition type)          |

**Tool Definitions:**

| Tool Name               | Parameters                                        | Description                          |
|--------------------------|---------------------------------------------------|--------------------------------------|
| `list_codebase_files`    | `softwareId`, `directoryPath`                     | List directory contents (filtered)   |
| `read_codebase_file`     | `softwareId`, `filePath`, `startLine?`, `endLine?`| Read file with line numbers & ranges |
| `search_codebase`        | `softwareId`, `searchPattern`, `filePattern?`, `maxResults?` | Grep-based pattern search |
| `modify_codebase`        | `softwareId`, `filePath`, `content`               | Write file + generate before/after diff |
| `run_dev_server`         | `softwareId`                                      | Start `npm run dev` in background    |
| `commit_and_push_bugfix` | `softwareId`, `commitMessage`                     | Git add + commit + push              |
| `run_migrations`         | `softwareId`, `migrationsDir`                     | List/run migration files             |

**Tool Ordering**: Read-only tools are listed first in the array so the LLM
encounters them before write tools, reinforcing the explore-first workflow.

---

#### debugExecutor.ts

| Property     | Value                                                |
|--------------|------------------------------------------------------|
| **Path**     | `backend/src/services/debugExecutor.ts`              |
| **LOC**      | ~270                                                 |
| **Purpose**  | Executes debug tool calls via child_process / fs      |
| **Exports**  | `execListCodebaseFiles`, `execReadCodebaseFile`, `execSearchCodebase`, `execModifyCodebase`, `execRunDevServer`, `execCommitAndPushBugfix`, `execRunMigrations` |
| **Dependencies** | `mysql.ts` (db), `mobileActionExecutor.ts` (MobileExecutionContext), `actionRouter.ts` (ToolResult), `child_process`, `path`, `fs` |

**Internal Helpers:**

| Function           | Visibility | Purpose                                                     |
|--------------------|------------|-------------------------------------------------------------|
| `getCodebasePath`  | Private    | Validates softwareId, resolves `linked_codebase`, enforces `/var/www/code/` prefix |

**Read-Only Executors (v2.0.0):**

| Function                 | Tool                  | Description                                             |
|--------------------------|-----------------------|---------------------------------------------------------|
| `execListCodebaseFiles`  | `list_codebase_files` | `fs.readdirSync` with filtering (.git, node_modules, vendor); shows 📁/📄 icons + file sizes |
| `execReadCodebaseFile`   | `read_codebase_file`  | Reads file, applies optional line range, adds line numbers, truncates at 500 lines, includes language hint |
| `execSearchCodebase`     | `search_codebase`     | `grep -rn` with `--exclude-dir` safety; escapes shell chars; max 100 results; handles exit code 1 |

**Write Executors:**

| Function                    | Tool                    | Description                                          |
|-----------------------------|-------------------------|------------------------------------------------------|
| `execModifyCodebase`        | `modify_codebase`       | Captures old content, writes new, generates unified diff via `diff -u`, returns +/- line counts |
| `execRunDevServer`          | `run_dev_server`        | Runs `npm run dev &` in background                   |
| `execCommitAndPushBugfix`   | `commit_and_push_bugfix`| `git add . && git commit && git push`                |
| `execRunMigrations`         | `run_migrations`        | Lists migration directory contents                   |

---

### Modified Files

#### mobileAIProcessor.ts

| Property     | Value                                                |
|--------------|------------------------------------------------------|
| **Path**     | `backend/src/services/mobileAIProcessor.ts`          |
| **LOC**      | ~457 (total file)                                    |
| **Purpose**  | Core AI processing — prompt building, LLM calls, tool-call loop |
| **Changes**  | Added `ai_developer_tools_granted` query + `isDev` variable; pass to `getToolsForRole()` and `buildStitchedPrompt()`; null-safe `saveMessage()`; fallback chain for `toolResultMsg`; developer workflow + formatting rules injection |

**Key Modifications:**

| Area              | Before                        | After                                              |
|-------------------|-------------------------------|----------------------------------------------------|
| Tool gating       | Not checked                   | Queries `users.ai_developer_tools_granted`, passes to `getToolsForRole()` |
| `saveMessage()`   | Crash on `null` content       | Accepts `null | undefined`, uses placeholder       |
| `toolResultMsg`   | `result.message` only         | `result.message \|\| (result as any).error \|\| '[No result message]'` |
| `buildStitchedPrompt()` | 3 params (assistant, tools, role) | 4 params — added `isDev: boolean = false` |
| Dev system prompt | None                          | Injects DEVELOPER WORKFLOW + FORMATTING RULES when `isDev=true` |

---

#### mobileTools.ts

| Property     | Value                                                |
|--------------|------------------------------------------------------|
| **Path**     | `backend/src/services/mobileTools.ts`                |
| **LOC**      | ~1874 (total file)                                   |
| **Purpose**  | Aggregates all tool definitions by user role          |
| **Changes**  | Added conditional include of `AI_DEBUG_TOOLS` at line ~1828 |

**Key Modification:**

```
...(ai_developer_tools_granted ? AI_DEBUG_TOOLS : [])
```

Added as the last spread in the staff tools array.

---

#### mobileActionExecutor.ts

| Property     | Value                                                |
|--------------|------------------------------------------------------|
| **Path**     | `backend/src/services/mobileActionExecutor.ts`       |
| **LOC**      | ~3242 (total file)                                   |
| **Purpose**  | Routes tool calls to appropriate executor functions   |
| **Changes**  | Added 7 `case` entries for debug tools (lines ~277-290) |

**Added Cases:**

| Case                    | Executor                   | Guard           |
|-------------------------|----------------------------|-----------------|
| `list_codebase_files`   | `execListCodebaseFiles`    | `requireStaff`  |
| `read_codebase_file`    | `execReadCodebaseFile`     | `requireStaff`  |
| `search_codebase`       | `execSearchCodebase`       | `requireStaff`  |
| `modify_codebase`       | `execModifyCodebase`       | `requireStaff`  |
| `run_dev_server`        | `execRunDevServer`         | `requireStaff`  |
| `commit_and_push_bugfix`| `execCommitAndPushBugfix`  | `requireStaff`  |
| `run_migrations`        | `execRunMigrations`        | `requireStaff`  |

---

#### auth.ts

| Property     | Value                                                |
|--------------|------------------------------------------------------|
| **Path**     | `backend/src/routes/auth.ts`                         |
| **Changes**  | `buildFrontendUser()` SELECT includes `ai_developer_tools_granted`; return object includes the field |

---

#### systemUsers.ts

| Property     | Value                                                |
|--------------|------------------------------------------------------|
| **Path**     | `backend/src/routes/systemUsers.ts`                  |
| **Changes**  | All 4 SELECT queries include `ai_developer_tools_granted`; PUT handler reads and persists the field |

**Modified Queries:**

| Endpoint        | Line(s) | Change                                        |
|-----------------|---------|-----------------------------------------------|
| `GET /`         | ~46     | Added `ai_developer_tools_granted` to SELECT  |
| `GET /:id`      | ~77     | Added `ai_developer_tools_granted` to SELECT  |
| `PUT /:id`      | ~132    | Added to SELECT; ~154: destructured from body; ~172: conditional UPDATE |
| `POST /`        | ~195    | Added `ai_developer_tools_granted` to SELECT  |

---

## Frontend Files

#### Bugs.tsx

| Property     | Value                                                |
|--------------|------------------------------------------------------|
| **Path**     | `frontend/src/pages/general/Bugs.tsx`                |
| **LOC**      | ~1928 (total file)                                   |
| **Purpose**  | Bug tracking page with BugDetailDialog               |
| **Changes**  | Added AI Resolution tab (4th tab) to BugDetailDialog with 3-state UI, chat interface, session management; added `AiMarkdown` component for rendering AI messages with code blocks, diffs, and prose styling |

**Key Components / Functions Added:**

| Name               | Type       | Purpose                                        |
|--------------------|------------|-------------------------------------------------|
| `AiMarkdown`       | Component  | ReactMarkdown renderer for AI messages with custom code block, diff, table, heading, and prose styling (~90 LOC) |
| AI Resolution tab  | JSX Tab    | 4th tab in BugDetailDialog TabsList             |
| `startAiSession()` | Function   | Sends initial bug context to AI, creates session|
| `sendAiMessage()`  | Function   | POSTs user message to `/v1/mobile/intent`       |
| `assistant` state  | State      | Loaded assistant or null                        |
| `conversationId`   | State      | Active conversation UUID                        |
| `messages` state   | State      | Array of chat messages for display              |

**New Dependencies:**

| Package          | Version  | Purpose                              |
|------------------|----------|--------------------------------------|
| `react-markdown` | `^9.1.0` | Renders markdown in AI chat messages |
| `remark-gfm`     | `^4.0.1` | GFM tables, strikethrough, etc.      |

**AiMarkdown Rendering Features:**

| Element     | Rendering                                                  |
|-------------|------------------------------------------------------------|
| Code blocks | Dark bg (`#0f172a`), monospace, language label header      |
| `diff` blocks | Line-level coloring: green `+`, red `-`, cyan `@@`       |
| Inline code | Rose pill (`bg-slate-200/80 text-rose-600`)                |
| Tables      | Bordered, compact, responsive with `overflow-x-auto`       |
| Headings    | `h1`–`h3` with proper sizes and spacing                    |
| Lists       | Styled `ul`/`ol` with proper indentation                   |
| Blockquotes | Emerald left border, italic                                |

---

#### Users.tsx

| Property     | Value                                                |
|--------------|------------------------------------------------------|
| **Path**     | `frontend/src/pages/system/Users.tsx`                |
| **Changes**  | Added "AI Developer Tools" checkbox in user edit form |

---

#### SoftwareManagement.tsx

| Property     | Value                                                |
|--------------|------------------------------------------------------|
| **Path**     | `frontend/src/pages/general/SoftwareManagement.tsx`  |
| **Changes**  | Added "Linked Codebase" dropdown in software edit form|

---

#### SystemModels.ts / types/index.ts

| Property     | Value                                                |
|--------------|------------------------------------------------------|
| **Path**     | `frontend/src/models/SystemModels.ts`, `frontend/src/types/index.ts` |
| **Changes**  | `User` interface includes `ai_developer_tools_granted`; `MyAssistantModel` class available; `Bug` and `Software` interfaces have relevant fields |

---

## Route Handlers

| File                  | Method | Route                        | Purpose                         |
|-----------------------|--------|------------------------------|---------------------------------|
| `mobileIntent.ts`    | POST   | `/v1/mobile/intent`          | Process AI chat message         |
| `myAssistant.ts`     | GET    | `/v1/mobile/my-assistant`    | List user's assistants          |
| `systemUsers.ts`     | GET    | `/v1/system/users`           | List users (incl. AI grant)     |
| `systemUsers.ts`     | GET    | `/v1/system/users/:id`       | Get user (incl. AI grant)       |
| `systemUsers.ts`     | PUT    | `/v1/system/users/:id`       | Update user (incl. AI grant)    |
| `auth.ts`            | POST   | `/v1/auth/login`             | Login (returns AI grant in user)|

---

## Internal Helpers

| Function                 | File                        | Visibility | Description                              |
|--------------------------|-----------------------------|------------|------------------------------------------|
| `getCodebasePath()`      | `debugExecutor.ts`          | Private    | Validate & resolve codebase path         |
| `saveMessage()`          | `mobileAIProcessor.ts`     | Private    | Null-safe message persistence            |
| `loadAssistantPromptData()` | `mobileAIProcessor.ts`  | Private    | Load assistant prompt for stitching      |
| `getToolsForRole()`      | `mobileTools.ts`            | Exported   | Build tool array by role + grant flag    |
| `getMobileToolsSystemPrompt()` | `mobileTools.ts`       | Exported   | Format tools as LLM system prompt        |
| `requireStaff()`         | `mobileActionExecutor.ts`  | Private    | Guard: reject if user is not staff       |

---

## Constants & Exports

| Constant / Export       | File                   | Type                 | Description                          |
|-------------------------|------------------------|----------------------|--------------------------------------|
| `AI_DEBUG_TOOLS`        | `debugTools.ts`        | `ToolDefinition[]`   | Array of 7 debug tool definitions    |
| `execListCodebaseFiles` | `debugExecutor.ts`     | `Function`           | List directory contents (filtered)   |
| `execReadCodebaseFile`  | `debugExecutor.ts`     | `Function`           | Read file with line numbers & ranges |
| `execSearchCodebase`    | `debugExecutor.ts`     | `Function`           | Grep-based pattern search            |
| `execModifyCodebase`    | `debugExecutor.ts`     | `Function`           | Modify file + generate unified diff  |
| `execRunDevServer`      | `debugExecutor.ts`     | `Function`           | Start dev server                     |
| `execCommitAndPushBugfix` | `debugExecutor.ts`   | `Function`           | Git commit & push                    |
| `execRunMigrations`     | `debugExecutor.ts`     | `Function`           | Run/list migrations                  |
| `AiMarkdown`            | `Bugs.tsx`             | `React.FC`           | Markdown renderer for AI messages    |
| `MAX_TOOL_ROUNDS`       | `mobileAIProcessor.ts` | `number`            | Max tool-call iterations per request |

---

*Document generated from the AI Bug Resolution subsystem implementation.*
