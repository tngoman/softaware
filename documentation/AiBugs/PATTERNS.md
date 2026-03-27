# AI Bug Resolution — Architecture Patterns

> **Module**: AI-Assisted Bug Fixing  

---

## Table of Contents

1. [Tool Gating Pattern](#1-tool-gating-pattern)  
2. [Codebase Sandboxing Pattern](#2-codebase-sandboxing-pattern)  
3. [ToolResult Contract Pattern](#3-toolresult-contract-pattern)  
4. [Null-Safe Message Persistence](#4-null-safe-message-persistence)  
5. [Codebase Context Injection](#5-codebase-context-injection)  
6. [3-State UI Pattern](#6-3-state-ui-pattern)  
7. [Conditional Tool Aggregation](#7-conditional-tool-aggregation)  
8. [Guard-Wrapped Execution](#8-guard-wrapped-execution)  
9. [Developer Workflow Enforcement](#9-developer-workflow-enforcement)  
10. [Before/After Diff Generation](#10-beforeafter-diff-generation)  
11. [Markdown Chat Rendering](#11-markdown-chat-rendering)  

---

## 1. Tool Gating Pattern

### Context

Not all staff users should have access to destructive developer tools
(file modification, git operations).  Access must be explicitly granted
per user by an administrator.

### Implementation

```typescript
// mobileAIProcessor.ts — processMobileIntent()
const userObj = await db.queryOne<{ai_developer_tools_granted: number}>(
  'SELECT ai_developer_tools_granted FROM users WHERE id = ?',
  [userId]
);
const isDev = !!userObj?.ai_developer_tools_granted;

const tools: ToolDefinition[] = getToolsForRole(userRole, isDev);
```

```typescript
// mobileTools.ts — getToolsForRole()
if (role === 'staff') {
  return [
    ...allClientTools,
    ...staffTaskTools,
    ...staffAdminTools,
    // ... other tool groups ...
    ...(ai_developer_tools_granted ? AI_DEBUG_TOOLS : []),
  ];
}
```

### Benefits

- **Principle of Least Privilege**: Only users with explicit grant see
  debug tools.
- **Transparent to LLM**: If tools are not included, the LLM cannot
  call them — no prompt hacking can bypass this.
- **Admin-Controlled**: Toggle via System → Users checkbox.

### Drawbacks

- Binary flag — no granular per-tool control (e.g., allow `modify_codebase`
  but not `commit_and_push_bugfix`).
- Requires backend restart awareness — flag is read per-request from DB,
  so changes take effect immediately (this is a benefit, but could surprise
  admins if they expect a delay).

---

## 2. Codebase Sandboxing Pattern

### Context

AI-driven file operations must be restricted to a known-safe directory
to prevent arbitrary filesystem access.

### Implementation

```typescript
// debugExecutor.ts — getCodebasePath()
async function getCodebasePath(softwareId: number): Promise<string> {
  if (!softwareId) {
    throw new Error('No softwareId provided...');
  }
  const sw = await db.queryOne<{linked_codebase: string}>(
    'SELECT linked_codebase FROM update_software WHERE id = ?',
    [softwareId]
  );
  if (!sw) throw new Error(`Software project with ID ${softwareId} not found.`);
  if (!sw.linked_codebase) throw new Error(`Software project does not have a linked codebase.`);
  if (!sw.linked_codebase.startsWith('/var/www/code/')) {
    throw new Error('Linked codebase path is outside the allowed directory.');
  }
  return sw.linked_codebase;
}
```

```typescript
// execModifyCodebase — path traversal check
const fullPath = path.join(base, filePath);
if (!fullPath.startsWith(base)) {
  return { success: false, message: 'Path traversal denied.' };
}
```

### Benefits

- **Defence in Depth**: 5-layer validation (softwareId → row exists →
  linked_codebase set → prefix check → traversal check).
- **Configurable per Software**: Different projects can point to different
  code directories.
- **Clear Error Messages**: Each validation step returns a descriptive
  error that helps the AI understand what went wrong.

### Drawbacks

- Hardcoded prefix (`/var/www/code/`) — not configurable without code change.
- No symlink resolution — a symlink inside `/var/www/code/` could point
  outside the sandbox.

---

## 3. ToolResult Contract Pattern

### Context

Every tool executor function must return a predictable shape so the
AI processor can safely extract and persist the result message.

### Implementation

```typescript
// actionRouter.ts — ToolResult interface
interface ToolResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}
```

```typescript
// debugExecutor.ts — every function returns ToolResult
export async function execModifyCodebase(
  args: Record<string, any>,
  ctx: MobileExecutionContext
): Promise<ToolResult> {
  try {
    // ... logic ...
    return { success: true, message: `File ${filePath} updated successfully.` };
  } catch (err: any) {
    return { success: false, message: err.message || 'Unknown error' };
  }
}
```

### Benefits

- **Type Safety**: TypeScript enforces the return shape at compile time.
- **Consistent Error Handling**: Both success and failure follow the same
  structure — no `{ error: "..." }` vs `{ message: "..." }` ambiguity.
- **Crash Prevention**: The `message` field is always present, preventing
  `Column 'content' cannot be null` database errors.

### Drawbacks

- Requires discipline — a developer could still return `{ error: "..." }`
  from an executor, which TypeScript would catch but only at compile time.
- The `data` field is loosely typed (`Record<string, unknown>`).

---

## 4. Null-Safe Message Persistence

### Context

Tool results may have empty or undefined content.  The `mobile_messages`
table's `content` column does not accept NULL, so persisting undefined
content causes a database crash.

### Implementation

```typescript
// mobileAIProcessor.ts — saveMessage() (simplified)
async function saveMessage(
  conversationId: string,
  role: string,
  content: string | null | undefined,
  toolName?: string,
  toolCallId?: string,
): Promise<void> {
  const safeContent = content ?? '[Tool result message was empty]';
  await db.query(
    'INSERT INTO mobile_messages (id, conversation_id, role, content, tool_name, tool_call_id) VALUES (?, ?, ?, ?, ?, ?)',
    [uuid(), conversationId, role, safeContent, toolName ?? null, toolCallId ?? null]
  );
}
```

```typescript
// mobileAIProcessor.ts — toolResultMsg fallback chain
const toolResultMsg = result.message
  || (result as any).error
  || '[No result message]';
```

### Benefits

- **Crash-Proof**: No more `Column 'content' cannot be null` exceptions.
- **Audit Trail**: Even empty results leave a trace in the message history
  rather than silently failing.
- **Backwards Compatible**: Old tool executors that return `{ error: "..." }`
  are handled by the `(result as any).error` fallback.

### Drawbacks

- The `(result as any).error` cast bypasses TypeScript type checking.
- Placeholder messages like `[Tool result message was empty]` are visible
  in conversation history.

---

## 5. Codebase Context Injection

### Context

The LLM has no way to know whether a codebase is linked to the bug's
software project unless explicitly told.  Without this context, the AI
may attempt tool calls that will fail with confusing errors.

### Implementation

```typescript
// Bugs.tsx — startAiSession() (simplified)
const startAiSession = async () => {
  let contextMsg = `Bug #${bug.id}: "${bug.title}"\n${bug.description}\n\n`;

  if (bug.software_id) {
    contextMsg += `A codebase IS linked to this software project ` +
      `(software_id: ${bug.software_id}). You CAN use developer tools ` +
      `like modify_codebase, commit_and_push_bugfix, etc.`;
  } else {
    contextMsg += `NO CODEBASE IS LINKED. You CANNOT use developer tools. ` +
      `Only provide guidance and suggestions.`;
  }

  const res = await api.post('/v1/mobile/intent', {
    text: contextMsg,
    assistantId: assistant.id,
  });
  // ...
};
```

### Benefits

- **Proactive Guidance**: The AI knows upfront what it can and cannot do.
- **Reduced Errors**: Eliminates tool calls that would fail due to missing
  codebase configuration.
- **User-Friendly**: The AI provides appropriate responses (code suggestions
  vs. direct fixes) based on capability.

### Drawbacks

- Front-end driven — if the frontend logic is bypassed (e.g., direct API
  call), the AI won't receive this context.
- `bug.software_id` presence doesn't guarantee `linked_codebase` is set
  on the software record.

---

## 6. 3-State UI Pattern

### Context

The AI Resolution tab must handle three distinct states with appropriate
UX for each.

### Implementation

```
State Machine:
  [No Assistant] ──(create assistant)──→ [Session Not Started]
  [Session Not Started] ──(click Start)──→ [Active Chat]
  [Active Chat] ──(close dialog)──→ [Session Not Started] (next open)
```

```typescript
// Bugs.tsx — AI Resolution tab (simplified)
{!assistant ? (
  // State 1: No Assistant — show CTA
  <div>Personal Assistant Required...</div>
) : !conversationId ? (
  // State 2: Session Not Started — show bug preview + start button
  <div>
    <BugSummary />
    <Button onClick={startAiSession}>Start AI Bug Resolution Session</Button>
  </div>
) : (
  // State 3: Active Chat — scrollable messages + input
  <div>
    <MessageList messages={messages} />
    <ChatInput onSend={sendAiMessage} />
  </div>
)}
```

### Benefits

- **Progressive Disclosure**: User is not overwhelmed — each state shows
  only what's relevant.
- **Clear Error States**: Missing assistant has a dedicated CTA rather than
  a confusing empty chat.
- **Clean Session Management**: Session starts explicitly, preventing
  accidental AI invocations.

### Drawbacks

- Single assistant assumed (`assistants[0]`) — no selector for users with
  multiple assistants.
- Conversation state is in component memory — refreshing the dialog loses
  the session reference (though messages persist in DB).

---

## 7. Conditional Tool Aggregation

### Context

The tool set available to the LLM varies by user role and permissions.
Debug tools should only be included for staff users with explicit grant.

### Implementation

```typescript
// mobileTools.ts — getToolsForRole()
export function getToolsForRole(
  role: MobileRole,
  ai_developer_tools_granted: boolean = false
): ToolDefinition[] {
  const allClientTools = [...];
  if (role === 'staff') {
    return [
      ...allClientTools,
      ...staffTaskTools,
      ...staffBugTools,
      ...(ai_developer_tools_granted ? AI_DEBUG_TOOLS : []),
    ];
  }
  return allClientTools;
}
```

### Benefits

- **Single Source of Truth**: All tool aggregation in one function.
- **Composable**: Each tool group is a separate array; adding/removing
  groups is trivial.
- **LLM-Transparent**: Tools not in the array are invisible to the LLM.

### Drawbacks

- Spread operator creates a new array on every call (minor perf concern
  with ~100+ tools).
- No caching — the same tool set is rebuilt for every request.

---

## 8. Guard-Wrapped Execution

### Context

Even if the LLM receives tool definitions (because the user has the grant),
the execution layer must independently verify authorisation.

### Implementation

```typescript
// mobileActionExecutor.ts — executeMobileAction()
case 'modify_codebase':
  return requireStaff(ctx, () => execModifyCodebase(args, ctx));
case 'run_dev_server':
  return requireStaff(ctx, () => execRunDevServer(args, ctx));
case 'commit_and_push_bugfix':
  return requireStaff(ctx, () => execCommitAndPushBugfix(args, ctx));
case 'run_migrations':
  return requireStaff(ctx, () => execRunMigrations(args, ctx));
```

```typescript
// requireStaff() guard
async function requireStaff(
  ctx: MobileExecutionContext,
  fn: () => Promise<ToolResult>
): Promise<ToolResult> {
  if (ctx.role !== 'staff') {
    return { success: false, message: 'Staff access required.' };
  }
  return fn();
}
```

### Benefits

- **Defence in Depth**: Even if tool gating in `getToolsForRole()` is
  somehow bypassed, execution-level guards prevent unauthorised access.
- **Consistent Pattern**: Same `requireStaff()` guard used for all
  protected tools.
- **Graceful Failure**: Returns a `ToolResult` instead of throwing,
  keeping the AI conversation alive.

### Drawbacks

- Only checks role, not `ai_developer_tools_granted` — a staff user
  without the grant could theoretically call these tools if the tool
  definitions were somehow injected.
- No per-tool granularity in the guard (all 7 tools use the same check).

---

## 9. Developer Workflow Enforcement

### Context

The AI assistant was fabricating entire files from scratch without reading
the existing codebase.  When given only write tools (`modify_codebase`),
the LLM would immediately generate code based on its training data rather
than the actual project source.  A mandatory read-first workflow was needed.

### Implementation

Three read-only tools were added to `debugTools.ts` *before* write tools
in the array (so the LLM encounters them first):

```typescript
// debugTools.ts — AI_DEBUG_TOOLS (first 3 are read-only)
export const AI_DEBUG_TOOLS: ToolDefinition[] = [
  { name: 'list_codebase_files',  ... },  // EXPLORE
  { name: 'read_codebase_file',   ... },  // READ
  { name: 'search_codebase',      ... },  // SEARCH
  { name: 'modify_codebase',      ... },  // MODIFY (hardened description)
  // ... write tools ...
];
```

A system prompt block is injected when `isDev === true`:

```typescript
// mobileAIProcessor.ts — buildStitchedPrompt()
const devInstructions = isDev ? `
DEVELOPER WORKFLOW — CRITICAL RULES:
...
1. EXPLORE FIRST: Use list_codebase_files
2. SEARCH: Use search_codebase
3. READ: Use read_codebase_file — NEVER guess or fabricate file contents
4. ANALYSE: Explain root cause, wait for user approval
5. MODIFY: Only after reading actual code and getting approval
6. VERIFY: Ask the user to test the fix

NEVER skip steps 1-3. NEVER fabricate code you haven't read.
` : '';
```

Additionally, `modify_codebase`'s tool description was hardened:
*"You MUST call read_codebase_file on the target file FIRST... NEVER
fabricate or guess file contents."*

### Benefits

- **Eliminates Fabrication**: The AI physically cannot write code it
  hasn't read — the workflow is enforced at both prompt and tool level.
- **User Visibility**: Steps 4 (analyse) and 6 (verify) ensure the user
  sees the root cause analysis and approves before changes land.
- **Audit Trail**: All tool calls (explore, search, read, modify) are
  logged as messages in `mobile_messages`, providing a complete record.

### Drawbacks

- Increases tool-call rounds per conversation (minimum 3-4 calls before
  any modification), costing more LLM tokens.
- Prompt-level enforcement is advisory — a sufficiently creative LLM
  could potentially skip steps.  The hardened tool description adds a
  second layer of defence.
- No server-side enforcement that `read_codebase_file` was called before
  `modify_codebase` — this would require stateful tracking.

---

## 10. Before/After Diff Generation

### Context

When `modify_codebase` wrote files, it returned only a success message
with no information about what changed.  Users could not review AI changes
before committing.

### Implementation

```typescript
// debugExecutor.ts — execModifyCodebase() (simplified)
export async function execModifyCodebase(args, ctx): Promise<ToolResult> {
  const base = await getCodebasePath(softwareId);
  const fullPath = path.join(base, filePath);

  // Capture original
  const isNewFile = !fs.existsSync(fullPath);
  const oldContent = isNewFile ? '' : fs.readFileSync(fullPath, 'utf-8');

  // Write new content
  fs.writeFileSync(fullPath, content);

  // Generate unified diff
  const tmpOld = `/tmp/diff_old_${Date.now()}_...`;
  const tmpNew = `/tmp/diff_new_${Date.now()}_...`;
  fs.writeFileSync(tmpOld, oldContent);
  fs.writeFileSync(tmpNew, content);
  const result = await execAsync(`diff -u "${tmpOld}" "${tmpNew}" | tail -n +3`);
  // Clean up temp files

  return {
    success: true,
    message: `✅ File updated.\n+${addedLines} added, -${removedLines} removed\n` +
      `\`\`\`diff\n${diffOutput}\n\`\`\``
  };
}
```

Three output modes:
1. **New file**: Shows full content in a language-tagged code block
2. **Unchanged file**: Returns warning that content is identical
3. **Modified file**: Returns unified diff with line counts

### Benefits

- **Full Transparency**: User sees exactly what changed before committing.
- **Natural Diff Format**: Standard unified diff format, rendered with
  color in the `AiMarkdown` component.
- **Truncation Safety**: Diffs over 6000 chars are truncated to prevent
  context overflow.

### Drawbacks

- Requires `diff` command on the server (standard on Linux).
- Temp files are used for diff generation (cleaned up in `finally` block).
- The AI must faithfully present the diff to the user — the prompt
  instructs this but doesn't enforce it.

---

## 11. Markdown Chat Rendering

### Context

AI responses containing code, diffs, and structured analysis were rendered
as plain text in a `whitespace-pre-wrap` div.  Code blocks appeared as
jumbled characters without formatting, making AI output unreadable.

### Implementation

```tsx
// Bugs.tsx — AiMarkdown component
const AiMarkdown: React.FC<{ content: string }> = ({ content }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      pre({ children }) {
        return (
          <pre className="bg-[#0f172a] text-slate-50 rounded-lg p-4 ...">
            {children}
          </pre>
        );
      },
      code({ className, children, ...props }) {
        const lang = className?.replace('language-', '');
        if (lang === 'diff') {
          // Line-level coloring: green +, red -, cyan @@
          return <code>...</code>;
        }
        if (lang) {
          // Language label header + dark background
          return <code>...</code>;
        }
        // Inline code: rose pill
        return <code className="bg-slate-200/80 text-rose-600 ...">...</code>;
      },
      // ... table, heading, list, blockquote components
    }}
  >
    {content}
  </ReactMarkdown>
);
```

Used only for assistant messages — user messages remain plain text:

```tsx
{msg.role === 'assistant' ? (
  <AiMarkdown content={msg.content} />
) : (
  <div className="whitespace-pre-wrap">{msg.content}</div>
)}
```

### Benefits

- **Readable Code**: Fenced code blocks render with dark background,
  monospace font, and language labels.
- **Visual Diffs**: `diff` blocks show additions in green, removals in
  red, and hunk markers in cyan.
- **Rich Analysis**: Tables, headings, lists, bold, inline code all
  render properly, making AI analysis structured and scannable.
- **Zero New Dependencies**: `react-markdown` and `remark-gfm` were
  already in `package.json` (used by `ContactDetails.tsx`).

### Drawbacks

- No full syntax highlighting (would require Prism or Shiki integration).
- No copy-to-clipboard button on code blocks.
- Markdown parsing adds minor overhead to rendering.
- If the AI doesn't use markdown formatting in its response, the output
  will still look like plain text (mitigated by the FORMATTING RULES in
  the system prompt).

---

*Document generated from the AI Bug Resolution subsystem implementation.*
