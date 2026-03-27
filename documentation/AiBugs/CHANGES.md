# AI Bug Resolution — Change Log

> **Module**: AI-Assisted Bug Fixing  
> **Current Version**: 2.0.0  

---

## Version History

| Version | Date       | Summary                                                        |
|---------|------------|----------------------------------------------------------------|
| 2.0.0   | 2026-03-15 | Read-only tools, markdown rendering, before/after diffs, dev workflow prompt |
| 1.0.0   | 2026-03-15 | Initial release — full AI chat in Bug Detail, 4 debug tools    |
| 0.4.0   | 2026-03-14 | Null-safe `saveMessage()`, ToolResult contract enforcement      |
| 0.3.0   | 2026-03-13 | Codebase context injection at session start                    |
| 0.2.0   | 2026-03-12 | Double `/api` prefix fix, assistant fetch correction           |
| 0.1.0   | 2026-03-11 | Initial wiring — DB schema, backend tools, frontend forms      |

---

## Detailed Changes

### v2.0.0 — Read-Only Tools, Markdown Rendering & Developer Workflow (2026-03-15)

**Root Cause**: The AI assistant had no ability to *read* code — only write.
When asked to fix bugs, it immediately called `modify_codebase` and fabricated
entire files from scratch without reading existing code.  AI responses
containing code rendered as plain text (jumbled, unreadable).

**New Tools (3 read-only):**
- **`list_codebase_files`**: Lists directory contents with `fs.readdirSync`,
  filters hidden files/`node_modules`/`vendor`, shows 📁/📄 icons with file
  sizes.  Parameters: `softwareId`, `directoryPath`.
- **`read_codebase_file`**: Reads file with line numbers, optional
  `startLine`/`endLine` range, truncation at 500 lines.  Returns language
  hint based on file extension.  Parameters: `softwareId`, `filePath`,
  `startLine?`, `endLine?`.
- **`search_codebase`**: Grep-based pattern search with `--exclude-dir`
  safety.  Parameters: `softwareId`, `searchPattern`, `filePattern?`,
  `maxResults?`.

**Modified Tool — `modify_codebase` (before/after diffs):**
- Now captures **original file content** before writing
- Generates **unified diff** via `diff -u` command
- Returns line counts (`+N added, -N removed`) and full diff
- Handles new files, unchanged files, and truncation for large diffs
- Instructs AI to present **Before** / **After** sections in code blocks

**Frontend — Markdown Chat Rendering:**
- **New**: `AiMarkdown` component in `Bugs.tsx` using `ReactMarkdown` +
  `remarkGfm` (both already in `package.json`)
- Code blocks render with dark background (`#0f172a`), monospace font,
  language label header
- `diff` blocks get line-level coloring: green `+`, red `-`, cyan `@@`
- Inline code styled as pill with rose text
- Tables, headings, lists, blockquotes, links all render properly
- User messages remain plain text

**Backend — Developer Workflow Prompt:**
- `buildStitchedPrompt()` now accepts `isDev: boolean` parameter
- When `isDev === true`, injects **DEVELOPER WORKFLOW — CRITICAL RULES**
  block enforcing 6-step process: EXPLORE → SEARCH → READ → ANALYSE →
  MODIFY → VERIFY
- Includes **FORMATTING RULES** requiring fenced code blocks with language
  identifiers, Before/After comparisons, headings, bold, inline code
- Overrides the voice-only `STAFF_CORE_DEFAULT` with text-based chat
  instructions for the dev context

**Files Changed:**

| File | Change |
|------|--------|
| `debugTools.ts` | Added 3 read-only tool definitions (4→7 tools total); hardened `modify_codebase` description |
| `debugExecutor.ts` | Added 3 executor functions (~120 lines); rewrote `execModifyCodebase` with diff generation (~50 lines) |
| `mobileActionExecutor.ts` | Added 3 new case entries + import for read-only executors |
| `mobileAIProcessor.ts` | Added `isDev` param to `buildStitchedPrompt()` call + function; injected dev workflow + formatting rules |
| `Bugs.tsx` | Added `ReactMarkdown`/`remarkGfm` imports; added `AiMarkdown` component (~90 lines); updated info panel |

### v1.0.0 — Production Release (2026-03-15)

- Stabilised all known crash paths
- Documentation suite created (this file)
- All 4 debug tools tested and verified

### v0.4.0 — ToolResult & Null-Safety (2026-03-14)

- **Fix**: `debugExecutor.ts` — all executor functions now return
  `{ success, message }` instead of `{ success, error }`, conforming to the
  `ToolResult` interface
- **Fix**: `mobileAIProcessor.ts` — `saveMessage()` accepts
  `null | undefined` content and falls back to a descriptive placeholder:
  `"[Tool result message was empty]"`
- **Fix**: `mobileAIProcessor.ts` — `toolResultMsg` uses fallback chain:
  `result.message || (result as any).error || '[No result message]'`
- **Fix**: `debugTools.ts` — tool descriptions hardened with explicit
  warning: *"Only call this if the bug context explicitly states a codebase
  is linked and provides a valid softwareId."*

### v0.3.0 — Codebase Context Injection (2026-03-13)

- **Enhancement**: `Bugs.tsx` — `startAiSession()` injects explicit
  codebase context into the initial bug summary message sent to the AI:
  - If `bug.software_id` exists → *"A codebase IS linked"*
  - If not → *"NO CODEBASE IS LINKED. You CANNOT use developer tools."*
- Prevents the AI from attempting `modify_codebase` or
  `commit_and_push_bugfix` when no codebase is available

### v0.2.0 — API Prefix & Assistant Fetch (2026-03-12)

- **Fix**: `Bugs.tsx` — API calls changed from `/api/v1/mobile/my-assistant`
  to `/v1/mobile/my-assistant` because Axios `baseURL` already includes `/api`
- **Fix**: `Bugs.tsx` — same correction for `POST /v1/mobile/intent`
- **Fix**: Assistant response handled as array `res.data.assistants[0]`
  instead of singular

### v0.1.0 — Initial Wiring (2026-03-11)

- **DB**: Added `ai_developer_tools_granted TINYINT(1) DEFAULT 0` to `users`
- **DB**: Added `linked_codebase VARCHAR(500) DEFAULT NULL` to
  `update_software`
- **Backend**: Created `debugTools.ts` (4 tool definitions) and
  `debugExecutor.ts` (4 executor functions)
- **Backend**: Wired tools into `mobileTools.ts` (conditional include) and
  `mobileActionExecutor.ts` (case routing)
- **Backend**: Updated `auth.ts` `buildFrontendUser()` to include
  `ai_developer_tools_granted`
- **Backend**: Updated all 4 SELECTs in `systemUsers.ts`
- **Frontend**: Added AI tools checkbox to `Users.tsx`
- **Frontend**: Added linked codebase dropdown to `SoftwareManagement.tsx`
- **Frontend**: Added AI Resolution tab to BugDetailDialog in `Bugs.tsx`
  with 3-state UI, scrollable chat, auto-scroll, loading indicators

---

## Known Issues

| #  | Severity | Status   | File                     | Description                                                   | Impact                                    | Fix / Workaround                                     | Effort |
|----|----------|----------|--------------------------|---------------------------------------------------------------|-------------------------------------------|-------------------------------------------------------|--------|
| 1  | 🔴 Crit  | ✅ Fixed | `debugExecutor.ts`       | Executors returned `{ error }` instead of `{ message }`       | `Column 'content' cannot be null` crash   | Return `ToolResult` with `message` field              | Low    |
| 2  | 🔴 Crit  | ✅ Fixed | `Bugs.tsx`               | Double `/api` prefix: `/api/api/v1/mobile/my-assistant`       | 404 on assistant fetch, shows wrong CTA   | Remove leading `/api` from API calls                  | Low    |
| 3  | 🟡 Warn  | ✅ Fixed | `auth.ts`                | `buildFrontendUser()` missing `[userId]` param in query       | Authentication broken, login crash        | Restore `[userId]` parameter                          | Low    |
| 4  | 🟡 Warn  | ✅ Fixed | `mobileAIProcessor.ts`   | `saveMessage()` crashed on `null` content                     | Tool results with empty content crash DB  | Accept `null | undefined`, use placeholder            | Low    |
| 5  | 🟡 Warn  | ✅ Fixed | `Bugs.tsx`               | AI attempted tools without knowing codebase status            | Tool calls fail with confusing errors     | Inject codebase context at session start              | Low    |
| 6  | 🟡 Warn  | Open     | `debugExecutor.ts`       | Git commit message uses template literal, not parameterised   | Potential command injection via commit msg | Sanitise or use `--message` flag with escaping        | Med    |
| 7  | 🟢 Info  | Open     | `debugExecutor.ts`       | `execRunMigrations` only lists dir, doesn't execute SQL       | Migrations are not actually applied       | Implement actual migration runner                     | High   |
| 8  | 🟢 Info  | Open     | `debugExecutor.ts`       | `execRunDevServer` uses `timeout: 5000` which may not suffice | Dev server may not fully start            | Consider WebSocket status reporting                   | Med    |
| 9  | 🟢 Info  | Open     | `Bugs.tsx`               | Only first assistant is used (`assistants[0]`)                | User cannot pick from multiple assistants | Add assistant selector dropdown                       | Low    |

---

## Migration Notes

### From v0.1.0 to v0.2.0

No schema changes. Frontend-only fix.

### From v0.2.0 to v0.3.0

No schema changes. Frontend-only enhancement.

### From v1.0.0 to v2.0.0

No schema changes.  Backend + Frontend changes only.

1. Deploy backend changes and restart PM2:
   ```bash
   pm2 restart softaware-backend
   ```
2. Rebuild and deploy frontend (contains `AiMarkdown` component).
3. Verify `react-markdown` and `remark-gfm` are in `package.json`
   (they should already be present from other modules).

### From v0.3.0 to v0.4.0

No schema changes. Backend fix — restart PM2 after deploying:

```bash
pm2 restart softaware-backend
```

### Initial Setup (v0.1.0)

```sql
-- Users table
ALTER TABLE users
  ADD COLUMN ai_developer_tools_granted TINYINT(1) NOT NULL DEFAULT 0;

-- Software table
ALTER TABLE update_software
  ADD COLUMN linked_codebase VARCHAR(500) DEFAULT NULL;
```

---

## Future Enhancements

| Enhancement                          | Priority | Effort | Description                                                | Status |
|--------------------------------------|----------|--------|------------------------------------------------------------|--------|
| Assistant Selector                   | Medium   | Low    | Let user pick which assistant to use in AI tab             | Open   |
| ~~Diff Preview~~                     | ~~High~~ | ~~Med~~| ~~Show file diffs before AI commits changes~~              | ✅ Done |
| Rollback Support                     | High     | Medium | One-click `git revert` for AI-made commits                 | Open   |
| Migration Runner                     | Medium   | High   | Actually execute SQL migration files                       | Open   |
| WebSocket Streaming                  | Medium   | High   | Stream AI responses in real-time instead of waiting         | Open   |
| Tool Approval Workflow               | High     | Medium | Require explicit user approval before destructive tools    | Open   |
| Audit Log                            | Medium   | Low    | Log all AI tool executions to a dedicated table            | Open   |
| Multi-File Diff View                 | Low      | High   | Visual side-by-side diff for multiple changed files        | Open   |
| Syntax Highlighting                  | Medium   | Medium | Full syntax highlighting (Prism/Shiki) in code blocks      | Open   |
| Copy Code Button                     | Low      | Low    | Copy-to-clipboard button on code blocks in chat            | Open   |

---

*Document generated from the AI Bug Resolution subsystem implementation.*
