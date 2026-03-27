# AI Bug Resolution — Module Documentation

> **Version**: 2.0.0  
> **Last Updated**: 2026-03-15  
> **Module**: AI-Assisted Bug Fixing  
> **Status**: Production  

---

## Table of Contents

1. [Overview](#overview)  
2. [Architecture](#architecture)  
3. [Key Concepts](#key-concepts)  
4. [User Guide](#user-guide)  
5. [Features](#features)  
6. [Security](#security)  
7. [Configuration](#configuration)  
8. [Troubleshooting](#troubleshooting)  
9. [Related Modules](#related-modules)  

---

## Overview

The **AI Bug Resolution** subsystem extends the existing Bugs module with an
AI-powered chat interface inside the Bug Detail dialog.  Staff users who have
been granted **AI Developer Tools** can instruct a Personal Assistant to
analyse, modify, commit, and deploy bug fixes against a linked codebase —
all from within the admin panel.

The subsystem is built on top of the existing **Mobile AI Pipeline**
(`mobileAIProcessor → mobileTools → mobileActionExecutor`) and adds a
specialised executor layer (`debugTools` / `debugExecutor`) for filesystem
and git operations.

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (React)                             │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │               BugDetailDialog  (Bugs.tsx)                       │  │
│  │  ┌──────────┬───────────┬──────────────┬──────────────────┐    │  │
│  │  │ Details  │ Comments  │ Attachments  │  AI Resolution   │    │  │
│  │  └──────────┴───────────┴──────────────┴──────────────────┘    │  │
│  │                                             │                   │  │
│  │            3-State UI ─────────────────────┘                   │  │
│  │   ┌────────────────┐  ┌──────────────┐  ┌───────────────┐     │  │
│  │   │ No Assistant   │  │ Session Not  │  │ Active Chat   │     │  │
│  │   │ (CTA message)  │  │ Started      │  │ (messages +   │     │  │
│  │   │                │  │ (Start btn)  │  │  input field) │     │  │
│  │   └────────────────┘  └──────────────┘  └───────────────┘     │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                              │                                        │
│         GET /v1/mobile/my-assistant  ──→ load assistant list          │
│         POST /v1/mobile/intent       ──→ send messages                │
└──────────────────────────────┼────────────────────────────────────────┘
                               │
┌──────────────────────────────┼────────────────────────────────────────┐
│                         BACKEND (Express)                             │
│                               │                                       │
│  ┌────────────────────────────▼──────────────────────────────────┐   │
│  │                  mobileIntent.ts  (POST /intent)              │   │
│  │                  myAssistant.ts   (GET  /)                    │   │
│  └────────────────────────────┬──────────────────────────────────┘   │
│                               │                                       │
│  ┌────────────────────────────▼──────────────────────────────────┐   │
│  │              mobileAIProcessor.ts                             │   │
│  │  • Resolves user role & ai_developer_tools_granted (isDev)    │   │
│  │  • Loads assistant prompt + personality                       │   │
│  │  • buildStitchedPrompt(assistant, tools, role, isDev)         │   │
│  │    └─ isDev=true injects DEVELOPER WORKFLOW + FORMATTING RULES│   │
│  │  • Calls LLM (Ollama)                                        │   │
│  │  • Tool-call loop (up to MAX_TOOL_ROUNDS)                    │   │
│  │  • Saves messages (null-safe)                                 │   │
│  └────────────────────────────┬──────────────────────────────────┘   │
│                               │                                       │
│  ┌────────────────────────────▼──────────────────────────────────┐   │
│  │              mobileTools.ts                                   │   │
│  │  • getToolsForRole(role, ai_developer_tools_granted)          │   │
│  │  • Conditionally includes AI_DEBUG_TOOLS when granted         │   │
│  └────────────────────────────┬──────────────────────────────────┘   │
│                               │                                       │
│  ┌────────────────────────────▼──────────────────────────────────┐   │
│  │              mobileActionExecutor.ts                          │   │
│  │  • Routes tool calls: list_codebase_files,                    │   │
│  │    read_codebase_file, search_codebase, modify_codebase,      │   │
│  │    run_dev_server, commit_and_push_bugfix, run_migrations     │   │
│  │  • Wraps each in requireStaff() guard                         │   │
│  └────────────────────────────┬──────────────────────────────────┘   │
│                               │                                       │
│  ┌────────────────────────────▼──────────────────────────────────┐   │
│  │              debugExecutor.ts                                 │   │
│  │  — READ-ONLY TOOLS ——————————————————————————                 │   │
│  │  • execListCodebaseFiles  — fs.readdirSync (filtered listing) │   │
│  │  • execReadCodebaseFile   — read + line numbers + ranges      │   │
│  │  • execSearchCodebase     — grep -rn (pattern search)         │   │
│  │  — WRITE TOOLS ——————————————————————————————                 │   │
│  │  • execModifyCodebase     — fs.writeFileSync + diff output    │   │
│  │  • execRunDevServer       — npm run dev (background)          │   │
│  │  • execCommitAndPushBugfix— git add/commit/push               │   │
│  │  • execRunMigrations      — ls migrations dir                 │   │
│  └────────────────────────────┬──────────────────────────────────┘   │
│                               │                                       │
└───────────────────────────────┼───────────────────────────────────────┘
                                │
┌───────────────────────────────▼───────────────────────────────────────┐
│                          DATABASE (MySQL)                              │
│                                                                       │
│  users.ai_developer_tools_granted    ── per-user tool gate            │
│  update_software.linked_codebase     ── path to /var/www/code/*       │
│  assistants                          ── assistant identity & prompts  │
│  mobile_conversations                ── conversation threads          │
│  mobile_messages                     ── individual messages           │
│  bugs                                ── bug records (software_id FK)  │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Key Concepts

### 1. Tool Gating

AI developer tools (file modification, git operations) are **not available
by default**.  Two conditions must both be true:

| Gate                          | Where Configured                     |
|-------------------------------|--------------------------------------|
| `ai_developer_tools_granted`  | System → Users → AI Tools checkbox   |
| `linked_codebase` is set      | Software Management → Linked Codebase|

If the user has tools granted but the bug's software has no linked codebase,
the AI receives an explicit system message: *"NO CODEBASE IS LINKED. You
CANNOT use developer tools."*

### 2. Codebase Sandboxing

All filesystem operations are restricted to paths that begin with
`/var/www/code/`.  The `getCodebasePath()` function in `debugExecutor.ts`
enforces this:

1. `softwareId` must be provided (non-zero).
2. The `update_software` row must exist.
3. `linked_codebase` must be non-empty.
4. `linked_codebase` must start with `/var/www/code/`.
5. The resolved `fullPath` must still start with the codebase root (prevents
   `../` traversal).

### 3. Assistant Identity Binding

The AI Resolution tab fetches the user's Personal Assistants via
`GET /v1/mobile/my-assistant` and uses the first assistant returned.
The assistant's **core instructions** and **personality flare** are stitched
into the system prompt for the LLM, giving each user a personalised AI
experience.

### 4. 3-State UI

The AI Resolution tab in BugDetailDialog has three visual states:

| State              | Condition                              | Display                            |
|--------------------|----------------------------------------|------------------------------------|
| No Assistant       | `assistant === null`                   | CTA: "Personal Assistant Required" |
| Session Not Started| `assistant` loaded, no `conversationId`| Bug summary preview + Start button |
| Active Chat        | `conversationId` exists                | Scrollable message list + input    |

### 5. Codebase Context Injection

When a session is started (`startAiSession()`), the initial message sent to
the AI includes explicit context about whether a codebase is linked:

- **Linked**: *"A codebase IS linked to this software project
  (software_id: X). You CAN use developer tools..."*
- **Not Linked**: *"NO CODEBASE IS LINKED. You CANNOT use developer tools.
  Only provide guidance and suggestions."*

This prevents the AI from attempting tool calls that would fail.

### 6. ToolResult Contract

Every debug executor function must return a `ToolResult`:

```typescript
{ success: boolean; message: string; data?: Record<string, unknown> }
```

The `message` field is **mandatory** — returning `{ error: "..." }` instead
will cause a `Column 'content' cannot be null` crash in `saveMessage()`.

### 7. Developer Workflow Enforcement

When `isDev === true`, the system prompt injects a **DEVELOPER WORKFLOW**
block that forces the AI to follow a mandatory 6-step process:

| Step | Action | Tool Used |
|------|--------|-----------|
| 1 | **EXPLORE** the project structure | `list_codebase_files` |
| 2 | **SEARCH** for relevant patterns | `search_codebase` |
| 3 | **READ** the actual source code | `read_codebase_file` |
| 4 | **ANALYSE** and explain root cause | (text response) |
| 5 | **MODIFY** with targeted changes | `modify_codebase` |
| 6 | **VERIFY** by asking user to test | (text response) |

The prompt explicitly states: *"NEVER skip steps 1-3. NEVER fabricate code
you haven't read. NEVER rewrite entire files from scratch."*

Additionally, the prompt includes **FORMATTING RULES** requiring:
- Fenced code blocks with language identifiers (`\`\`\`php`, `\`\`\`diff`)
- **Before** / **After** comparison for all file modifications
- Headings, bullet points, bold, and inline code for structure

### 8. Markdown Chat Rendering

AI assistant messages are rendered using **ReactMarkdown** + **remarkGfm**
via the `AiMarkdown` component in `Bugs.tsx`.  This provides:

- **Code blocks**: Dark background (`#0f172a`), monospace font, language
  label header
- **Diff blocks**: Line-level coloring — green for `+` additions, red for
  `-` removals, cyan for `@@` hunks
- **Inline code**: Styled pill with rose-colored text
- **Tables, headings, lists, blockquotes**: All rendered with proper styling
- **User messages**: Remain plain text (no markdown processing)

### 9. Before/After Diff Output

The `modify_codebase` tool now captures the **original file content** before
writing changes, then generates a **unified diff** via the `diff -u` command.
The tool result includes:

- Line counts: `+N added, -N removed`
- Full unified diff in a `\`\`\`diff` block
- Instructions for the AI to present **Before** and **After** sections

New files and unchanged files are handled with appropriate messages.

---

## User Guide

### Prerequisites

1. A **Personal Assistant** must be configured (System → My Assistant).
2. The user must have **AI Developer Tools Granted** enabled by an admin.
3. The bug's software project must have a **Linked Codebase** configured.

### Using the AI Resolution Tab

1. Open a bug from the Bugs page.
2. Click the **"AI Resolution"** tab (4th tab).
3. If you see "Personal Assistant Required", create one under My Assistant.
4. Click **"Start AI Bug Resolution Session"**.
5. The AI will introduce itself and summarise the bug.
6. Type messages to discuss the bug, request analysis, or ask for fixes.
7. If a codebase is linked, the AI can:
   - **Explore** project structure (`list_codebase_files`)
   - **Read** source files (`read_codebase_file`)
   - **Search** for patterns (`search_codebase`)
   - **Modify** files — with before/after diff (`modify_codebase`)
   - Start a dev server (`run_dev_server`)
   - Commit & push changes (`commit_and_push_bugfix`)
   - Run migrations (`run_migrations`)
8. The AI will always explore, read, and search the codebase before
   proposing modifications.  Review the **Before** / **After** diff
   in the chat before approving commits.

---

## Features

| Feature                      | Description                                           | Status |
|------------------------------|-------------------------------------------------------|--------|
| AI Chat in Bug Dialog        | Full chat UI inside BugDetailDialog                   | ✅     |
| Conditional Tool Gating      | Debug tools only for granted users                    | ✅     |
| Codebase Sandboxing          | Path restricted to `/var/www/code/`                   | ✅     |
| Context-Aware Sessions       | AI told if codebase is linked at session start        | ✅     |
| **Codebase Exploration**     | List directory contents (`list_codebase_files`)       | ✅     |
| **File Reading**             | Read files with line numbers & ranges (`read_codebase_file`) | ✅ |
| **Code Search**              | Grep-based pattern search (`search_codebase`)         | ✅     |
| File Modification            | Write files to linked codebase with diff output       | ✅     |
| **Before/After Diffs**       | Unified diff generated on every file modification     | ✅     |
| Git Commit & Push            | Commit and push bug fixes                             | ✅     |
| Dev Server Start             | Launch `npm run dev` in background                    | ✅     |
| Database Migrations          | Run migration files                                   | ✅     |
| **Markdown Chat Rendering**  | ReactMarkdown with code blocks, diffs, tables, prose  | ✅     |
| **Developer Workflow Prompt**| System prompt enforces explore→read→fix workflow       | ✅     |
| Null-Safe Message Persistence| `saveMessage()` handles null/undefined content         | ✅     |
| ToolResult Validation        | Executors always return `{ message }` not `{ error }` | ✅     |
| Multi-Round Tool Calls       | LLM can call tools multiple times per conversation    | ✅     |
| Scrollable Chat History      | Auto-scrolling message list with loading indicators   | ✅     |

---

## Security

| Control                      | Implementation                                        |
|------------------------------|-------------------------------------------------------|
| Authentication               | JWT token required for all API calls                  |
| Role Gate                    | `requireStaff()` wraps every debug tool execution     |
| User-Level Gate              | `ai_developer_tools_granted` must be `1`              |
| Path Sandboxing              | `getCodebasePath()` restricts to `/var/www/code/`     |
| Path Traversal Prevention    | `fullPath.startsWith(base)` check after `path.join()` |
| Software Validation          | `softwareId` must resolve to valid `update_software`  |
| Linked Codebase Required     | `linked_codebase` column must be non-empty            |
| Input Sanitisation           | Git commit messages are parameterised (template literal)|

---

## Configuration

| Setting                          | Location                        | Default  |
|----------------------------------|---------------------------------|----------|
| AI Developer Tools per user      | `users.ai_developer_tools_granted` | `0`   |
| Linked Codebase path             | `update_software.linked_codebase`  | `NULL` |
| Allowed codebase root            | `debugExecutor.ts` (hardcoded)     | `/var/www/code/` |
| Max Tool Rounds                  | `mobileAIProcessor.ts`            | `MAX_TOOL_ROUNDS` |
| LLM Backend                      | `mobileAIProcessor.ts` (Ollama)   | Local Ollama |

---

## Troubleshooting

| Symptom                                    | Cause                                              | Fix                                                  |
|--------------------------------------------|----------------------------------------------------|------------------------------------------------------|
| "Personal Assistant Required" shown        | User has no assistant configured                   | Create one in System → My Assistant                  |
| "Personal Assistant Required" even with assistant | Double `/api` prefix in API call             | Ensure Bugs.tsx calls `/v1/mobile/my-assistant` (no leading `/api`) |
| AI says it cannot use tools                | `ai_developer_tools_granted` is `0`                | Admin enables checkbox in System → Users             |
| AI says no codebase is linked              | `update_software.linked_codebase` is NULL          | Set path in Software Management                      |
| `Column 'content' cannot be null` crash    | Debug executor returning `{ error }` instead of `{ message }` | Ensure all executors return `ToolResult` with `message` field |
| AI attempts tools without software_id      | Codebase context not injected at session start     | `startAiSession()` must include explicit linked/not-linked message |
| "Path traversal denied"                    | `filePath` argument contains `../`                 | Use relative paths from codebase root only           |
| "Linked codebase path is outside…"         | `linked_codebase` doesn't start with `/var/www/code/` | Correct path in `update_software` table          |
| Dev server doesn't start                   | No `dev` script in `package.json`                  | Add `"dev"` script to linked codebase's package.json |
| Git push fails                             | No remote configured or auth issue                 | Configure git remote and credentials in codebase dir |
| AI output looks like jumbled code          | Chat not rendering markdown — using plain text div | Ensure `AiMarkdown` component is used for assistant messages |
| AI fabricates code without reading first   | No read tools available / system prompt missing     | Ensure `isDev` is passed to `buildStitchedPrompt()`; verify 3 read-only tools exist in `debugTools.ts` |
| No before/after shown after file change    | `execModifyCodebase` not generating diff            | Verify `diff` command available on server; check executor captures old content |

---

## Related Modules

| Module              | Relationship                                          |
|---------------------|-------------------------------------------------------|
| Bugs                | Parent module — AI Resolution is a tab within Bug Detail |
| Mobile AI Pipeline  | Core infrastructure reused (processor, tools, executor) |
| Personal Assistants | Provides assistant identity and prompt stitching      |
| Software Management | Provides `linked_codebase` and `software_id`          |
| System Users        | Manages `ai_developer_tools_granted` flag             |
| Authentication      | Supplies JWT + `buildFrontendUser()` with tool grant  |

---

*Document generated from the AI Bug Resolution subsystem implementation.*
