# AI Bug Resolution — Field Reference

> **Module**: AI-Assisted Bug Fixing  
> **Database**: MySQL (`softaware`)  

---

## Table of Contents

1. [Overview](#overview)  
2. [Schema — users (extended)](#schema--users-extended)  
3. [Schema — update_software (extended)](#schema--update_software-extended)  
4. [Schema — assistants](#schema--assistants)  
5. [Schema — mobile_conversations](#schema--mobile_conversations)  
6. [Schema — mobile_messages](#schema--mobile_messages)  
7. [Column Details](#column-details)  
8. [Enum Values](#enum-values)  
9. [Frontend ↔ Backend Mapping](#frontend--backend-mapping)  
10. [Indexes](#indexes)  

---

## Overview

The AI Bug Resolution subsystem touches six database tables.  Two existing
tables received new columns; the remaining tables are part of the
existing Mobile AI Pipeline infrastructure that is reused.

**Note**: v2.0.0 added no new schema changes.  All new functionality
(read-only tools, markdown rendering, before/after diffs, developer
workflow prompt) operates on existing tables.

| Table                 | Relationship to AI Bugs                                  | Changes Made   |
|-----------------------|----------------------------------------------------------|----------------|
| `users`               | Stores per-user `ai_developer_tools_granted` flag        | +1 column      |
| `update_software`     | Stores `linked_codebase` path for debug tools            | +1 column      |
| `assistants`          | Stores AI assistant identity (prompt, personality)       | Existing table |
| `mobile_conversations`| Stores conversation threads for AI chat sessions         | Existing table |
| `mobile_messages`     | Stores individual messages (user + AI + tool results)    | Existing table |
| `bugs`                | Provides `software_id` FK to resolve linked codebase     | No changes     |

---

## Schema — users (extended)

Column added to existing `users` table:

```sql
ALTER TABLE users
  ADD COLUMN ai_developer_tools_granted TINYINT(1) NOT NULL DEFAULT 0;
```

### Column Details — users

| Column                        | Type          | Null | Default | Description                                    |
|-------------------------------|---------------|------|---------|------------------------------------------------|
| `ai_developer_tools_granted`  | `TINYINT(1)`  | NO   | `0`     | `1` = user can access AI debug tools; `0` = no |

**Usage**:
- Read by `mobileAIProcessor.ts` → `processMobileIntent()` to decide
  whether to include `AI_DEBUG_TOOLS` in the tool set.
- Read by `auth.ts` → `buildFrontendUser()` to expose the flag to the
  frontend Zustand store.
- Read/written by `systemUsers.ts` CRUD endpoints.
- Displayed as a checkbox in `Users.tsx`.

---

## Schema — update_software (extended)

Column added to existing `update_software` table:

```sql
ALTER TABLE update_software
  ADD COLUMN linked_codebase VARCHAR(500) DEFAULT NULL;
```

### Column Details — update_software

| Column             | Type            | Null | Default | Description                                        |
|--------------------|-----------------|------|---------|----------------------------------------------------|
| `linked_codebase`  | `VARCHAR(500)`  | YES  | `NULL`  | Absolute path to codebase root, e.g. `/var/www/code/myapp` |

**Usage**:
- Read by `debugExecutor.ts` → `getCodebasePath()` to resolve the working
  directory for all filesystem and git operations.
- Written via `SoftwareManagement.tsx` dropdown.
- Must start with `/var/www/code/` (enforced by `getCodebasePath()`).

**Constraints**:
- If `NULL`, debug tools are unavailable for bugs linked to this software.
- The path must exist on the filesystem.
- No trailing slash expected.

---

## Schema — assistants

Existing table used for assistant identity binding.  Key columns referenced
by the AI Bug subsystem:

| Column               | Type            | Description                                     |
|----------------------|-----------------|-------------------------------------------------|
| `id`                 | `INT`           | Primary key                                     |
| `user_id`            | `VARCHAR(36)`   | Owner of the assistant                          |
| `name`               | `VARCHAR(255)`  | Display name                                    |
| `core_instructions`  | `TEXT`          | Base system prompt stitched into LLM context    |
| `personality_flare`  | `TEXT`          | Personality modifiers appended to system prompt  |
| `createdAt`          | `DATETIME`      | Creation timestamp                              |

**Usage**:
- Fetched by `GET /v1/mobile/my-assistant` → returned as
  `{ success: true, assistants: [...] }`
- Loaded by `mobileAIProcessor.ts` → `loadAssistantPromptData()` for
  prompt stitching.

---

## Schema — mobile_conversations

Existing table storing conversation threads:

| Column           | Type           | Description                                |
|------------------|----------------|--------------------------------------------|
| `id`             | `VARCHAR(36)`  | UUID primary key                           |
| `user_id`        | `VARCHAR(36)`  | Conversation owner                         |
| `assistant_id`   | `INT`          | FK to `assistants.id`                      |
| `title`          | `VARCHAR(255)` | Auto-generated conversation title          |
| `createdAt`      | `DATETIME`     | Creation timestamp                         |
| `updatedAt`      | `DATETIME`     | Last activity timestamp                    |

**Usage**:
- Created/retrieved by `processMobileIntent()` when handling chat from
  the AI Resolution tab.
- `conversationId` is stored in Bugs.tsx component state and sent with
  each subsequent `POST /v1/mobile/intent` request.

---

## Schema — mobile_messages

Existing table storing individual messages:

| Column            | Type           | Description                                 |
|-------------------|----------------|---------------------------------------------|
| `id`              | `VARCHAR(36)`  | UUID primary key                            |
| `conversation_id` | `VARCHAR(36)`  | FK to `mobile_conversations.id`             |
| `role`            | `VARCHAR(20)`  | `user`, `assistant`, or `tool`              |
| `content`         | `TEXT`         | Message body (null-safe since v0.4.0)       |
| `tool_name`       | `VARCHAR(100)` | Tool name if `role = tool`                  |
| `tool_call_id`    | `VARCHAR(100)` | Correlation ID for tool call/result pairs   |
| `createdAt`       | `DATETIME`     | Creation timestamp                          |

**Usage**:
- Written by `saveMessage()` in `mobileAIProcessor.ts`.
- `content` column was historically the source of `Column 'content' cannot
  be null` crashes when tool results had `undefined` message.  Now
  null-safe with fallback placeholder.

---

## Column Details

### AI-Specific Fields on Existing Tables

| Table              | Column                        | Type          | Purpose                         |
|--------------------|-------------------------------|---------------|---------------------------------|
| `users`            | `ai_developer_tools_granted`  | `TINYINT(1)`  | Per-user tool access gate       |
| `update_software`  | `linked_codebase`             | `VARCHAR(500)` | Path to codebase root          |

### Fields Read from `bugs` Table (No Changes)

| Column         | Type    | Purpose                                           |
|----------------|---------|---------------------------------------------------|
| `id`           | `INT`   | Bug ID — displayed in AI session context           |
| `title`        | `TEXT`  | Bug title — included in initial AI message         |
| `description`  | `TEXT`  | Bug description — included in initial AI message   |
| `status`       | `ENUM`  | Current bug status — shown to AI for context       |
| `severity`     | `ENUM`  | Severity level — shown to AI for prioritisation    |
| `software_id`  | `INT`   | FK to `update_software` — used to resolve codebase |

---

## Enum Values

### mobile_messages.role

| Value       | Description                                     |
|-------------|-------------------------------------------------|
| `user`      | Message from the human user                     |
| `assistant` | Response from the AI assistant                  |
| `tool`      | Result from a tool execution                    |

---

## Frontend ↔ Backend Mapping

| Frontend Field (Bugs.tsx)       | API Field                     | DB Column / Table                   |
|---------------------------------|-------------------------------|-------------------------------------|
| `assistant` (state)             | `res.data.assistants[0]`      | `assistants.*`                      |
| `conversationId` (state)        | `res.data.conversationId`     | `mobile_conversations.id`           |
| `messages` (state array)        | `res.data.reply` + local      | `mobile_messages.content`           |
| `aiSession.loading` (state)     | —                             | — (UI state only)                   |
| `bug.software_id`               | `bug.software_id`             | `bugs.software_id`                  |
| `user.ai_developer_tools_granted` | `user.ai_developer_tools_granted` | `users.ai_developer_tools_granted` |

| Frontend Field (Users.tsx)      | API Field                     | DB Column                           |
|---------------------------------|-------------------------------|-------------------------------------|
| AI Tools checkbox               | `ai_developer_tools_granted`  | `users.ai_developer_tools_granted`  |

| Frontend Field (SoftwareManagement.tsx) | API Field              | DB Column                           |
|-----------------------------------------|------------------------|-------------------------------------|
| Linked Codebase dropdown                | `linked_codebase`      | `update_software.linked_codebase`   |

---

## Indexes

| Table              | Index / Key                         | Columns                        | Purpose                  |
|--------------------|-------------------------------------|--------------------------------|--------------------------|
| `users`            | (existing PK)                       | `id`                           | User lookup              |
| `update_software`  | (existing PK)                       | `id`                           | Software lookup          |
| `assistants`       | (existing PK)                       | `id`                           | Assistant lookup         |
| `assistants`       | (existing)                          | `user_id`                      | Filter by owner          |
| `mobile_conversations` | (existing PK)                   | `id`                           | Conversation lookup      |
| `mobile_conversations` | (existing)                      | `user_id`                      | Filter by owner          |
| `mobile_messages`  | (existing PK)                       | `id`                           | Message lookup           |
| `mobile_messages`  | (existing)                          | `conversation_id`              | Load conversation history|

*No new indexes were added.  The new columns (`ai_developer_tools_granted`,
`linked_codebase`) are queried via primary key lookups on their respective
tables, so no additional indexing is needed.*

---

*Document generated from the AI Bug Resolution subsystem implementation.*
