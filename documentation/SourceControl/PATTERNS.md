# Source Control — Architecture Patterns

> **Module**: Source Control (Git Operations UI)  

---

## Table of Contents

1. [Branch Enforcement Pattern](#1-branch-enforcement-pattern)  
2. [Dual Timeout Strategy](#2-dual-timeout-strategy)  
3. [Input Sanitisation Layers](#3-input-sanitisation-layers)  
4. [Conflict Detection & Recovery](#4-conflict-detection--recovery)  
5. [Status Health Indicator](#5-status-health-indicator)  
6. [File Staging Pipeline](#6-file-staging-pipeline)  
7. [AI Chat Integration Pattern](#7-ai-chat-integration-pattern)  
8. [Quick Action Prompts](#8-quick-action-prompts)  
9. [Responsive Column Layout](#9-responsive-column-layout)  
10. [Destructive Action Confirmation](#10-destructive-action-confirmation)  
11. [Shared Component Extraction](#11-shared-component-extraction)  
12. [Silent Refresh Pattern](#12-silent-refresh-pattern)  

---

## 1. Branch Enforcement Pattern

### Context

Non-developer staff should only interact with a single designated branch
(`Bugfix`) to prevent accidental modifications to production or development
branches.  All write operations must be gated.

### Implementation

```typescript
// git.ts — Constants
const ALLOWED_BRANCH = 'Bugfix';

// git.ts — enforceBranch() middleware
async function enforceBranch(res: Response): Promise<boolean> {
  const current = await getCurrentBranch();
  if (current !== ALLOWED_BRANCH) {
    res.status(403).json({
      success: false,
      error: 'BRANCH_RESTRICTED',
      message: `Write operations are only allowed on the "${ALLOWED_BRANCH}" branch.`,
      currentBranch: current,
      allowedBranch: ALLOWED_BRANCH,
    });
    return false;
  }
  return true;
}

// Usage in every write endpoint
router.post('/stage', async (req, res) => {
  if (!(await enforceBranch(res))) return;
  // ... staging logic
});
```

Additionally, the `POST /checkout` endpoint has a **double gate** —
`enforceBranch()` is implicit because checkout itself only accepts
`Bugfix` as a target:

```typescript
if (branch !== ALLOWED_BRANCH) {
  return res.status(403).json({ error: 'BRANCH_RESTRICTED' });
}
```

### Frontend Enforcement

The `BranchBanner` component visually warns users when they are not on
the allowed branch and disables write operations via `isOnAllowed`:

```tsx
// SourceControl.tsx
const isOnAllowed = config?.isOnAllowedBranch ?? false;

<button disabled={!isOnAllowed}>Push</button>
<button disabled={!isOnAllowed}>Pull</button>
```

### Benefits

- **Triple Layer**: Backend `enforceBranch()` + checkout validation +
  frontend `isOnAllowed` disable.
- **Clear Error Messages**: The 403 response includes both the current
  and allowed branch names.
- **No Branch Creation**: `POST /checkout` will not create branches,
  only switch to an existing `Bugfix`.

### Drawbacks

- Hardcoded branch name — changing requires a code update to `git.ts`.
- No support for feature branches or temporary branching.
- `enforceBranch()` must be manually called in each write endpoint
  (not Express middleware applied globally).

---

## 2. Dual Timeout Strategy

### Context

Git operations have vastly different execution times — local reads (status,
diff, log) are near-instant while network operations (fetch, pull, push)
can take 10-30+ seconds depending on repository size and connection.

### Implementation

```typescript
// git.ts
const EXEC_TIMEOUT = 10000;    // 10s — local operations
const NETWORK_TIMEOUT = 30000;  // 30s — network operations

async function execGit(command: string, timeout = EXEC_TIMEOUT): Promise<string> {
  const { stdout } = await execAsync(command, {
    cwd: GIT_DIR,
    timeout,
    maxBuffer: 1024 * 1024 * 10  // 10MB
  });
  return stdout.trim();
}

// Network operations explicitly pass the longer timeout
router.post('/pull', async (req, res) => {
  const { stdout, stderr } = await execAsync(`git pull ${remote} ${branch}`, {
    cwd: GIT_DIR,
    timeout: NETWORK_TIMEOUT,
    maxBuffer: 1024 * 1024 * 10
  });
});
```

### Benefits

- **Fast Feedback**: Local operations fail quickly if something is wrong
  (10s), rather than waiting the full 30s.
- **Network Tolerance**: Push/pull/fetch get enough time for large repos
  or slow connections without timing out prematurely.
- **Configurable**: Both constants can be adjusted without changing logic.

### Drawbacks

- 30s may still be insufficient for very large repositories.
- No streaming or progress indication — the frontend shows a spinner
  until the operation completes or times out.
- The 10MB `maxBuffer` is shared across both tiers.

---

## 3. Input Sanitisation Layers

### Context

Git commands are constructed via string interpolation and executed via
`child_process.exec`.  Untrusted user input (file paths, commit hashes,
commit messages) must be validated to prevent command injection and
path traversal.

### Implementation

**Path Sanitisation:**

```typescript
function sanitizePath(filePath: string): string {
  if (!filePath) return '';
  if (filePath.includes('..') || filePath.startsWith('/')) {
    throw new Error('INVALID_PATH');
  }
  return filePath;
}
```

**Hash Validation:**

```typescript
function sanitizeHash(hash: string): string {
  if (!/^[a-f0-9]{7,40}$/i.test(hash)) {
    throw new Error('INVALID_HASH');
  }
  return hash;
}
```

**Commit Message Escaping:**

```typescript
const sanitized = message.trim().replace(/"/g, '\\"');
const { stdout } = await execAsync(`git commit -m "${sanitized}"`, { ... });
```

**Branch Name Validation:**

```typescript
if (!/^[a-zA-Z0-9._/-]+$/.test(branch)) {
  return res.status(400).json({ error: 'INVALID_BRANCH_NAME' });
}
```

### Benefits

- **Defence in Depth**: 4 separate validation functions for different
  input types.
- **Early Rejection**: Validation happens before shell execution.
- **Clear Error Codes**: Each validation returns a specific error code
  (`INVALID_PATH`, `INVALID_HASH`, `INVALID_BRANCH_NAME`) for debugging.

### Drawbacks

- `sanitizePath()` does not resolve symlinks — a symlink could bypass
  the traversal check.
- Commit message escaping only handles double quotes — backticks, `$()`,
  and other shell metacharacters could potentially be injected.
- No use of `execFile()` or parameterised arguments — all commands use
  string concatenation with `exec()`.

---

## 4. Conflict Detection & Recovery

### Context

Merge conflicts can arise from `git pull` or `git stash pop` and must
be detected, communicated, and resolved without requiring command-line
knowledge.

### Implementation

**Backend Detection (git.ts):**

```typescript
// In pull handler — checks both stdout and stderr
const hasConflicts = stderr?.includes('CONFLICT') || stdout?.includes('CONFLICT');
if (hasConflicts) {
  const conflictFiles = await execGit('git diff --name-only --diff-filter=U');
  return res.json({
    error: 'MERGE_CONFLICT',
    conflictFiles: conflictFiles.split('\n').filter(Boolean),
  });
}

// In stash pop error handler
if (error.stderr?.includes('CONFLICT')) {
  return res.status(409).json({ error: 'MERGE_CONFLICT' });
}
```

**Frontend Detection (SourceControl.tsx):**

```typescript
// In status polling — checks for unmerged files (status contains 'U')
const conflictFiles = (statusRes?.files || []).filter(
  (f: GitFile) => f.status?.includes('U')
);
setHasConflicts(conflictFiles.length > 0);

// In pull handler — dual response handling
if (res.error === 'MERGE_CONFLICT') {
  setHasConflicts(true);
} else if (err.response?.status === 409) {
  setHasConflicts(true);
}
```

**Resolution Options:**

```typescript
// Resolve via strategy
for (const file of targets) {
  await execGit(`git checkout --${strategy} "${file}"`);
  await execGit(`git add "${file}"`);
}

// Or abort the merge entirely
await execGit('git merge --abort');
```

### Benefits

- **Multiple Detection Points**: Conflicts are caught in pull responses,
  stash pop responses, and status polling.
- **User-Friendly Labels**: "Keep Mine" / "Use Theirs" instead of
  `--ours` / `--theirs`.
- **AI Fallback**: If the user doesn't understand the options, they can
  click "Ask AI" to get intelligent conflict analysis.
- **Remaining Conflict Tracking**: Resolution response reports if any
  conflicts remain unresolved.

### Drawbacks

- Conflict detection relies on string matching (`CONFLICT` in output)
  rather than git exit codes.
- No per-file conflict viewing (3-way merge view) — user must choose
  blanket ours/theirs or use AI.
- `MERGE_CONFLICT` may return either 200 or 409 depending on where
  the conflict is detected (stdout vs. error handler).

---

## 5. Status Health Indicator

### Context

Non-developer users need a quick visual cue about repository health
without understanding git status output.

### Implementation

```tsx
const StatusHealthCard: React.FC<{
  clean: boolean;
  totalChanges: number;
  stagedCount: number;
  unstagedCount: number;
  untrackedCount: number;
  hasConflicts: boolean;
}> = ({ clean, totalChanges, stagedCount, unstagedCount, untrackedCount, hasConflicts }) => {
  if (hasConflicts) {
    return <Card color="red" icon="🛑" title="Merge Conflicts Detected" />;
  }
  if (clean) {
    return <Card color="green" icon="✅" title="All Clean!" />;
  }
  return <Card color="amber" icon="⚠️" title={`${totalChanges} Uncommitted Changes`} />;
};
```

### Benefits

- **Traffic Light System**: Green/amber/red is universally understood.
- **Glanceable**: Shows the most important information without scrolling.
- **Detailed Breakdown**: Amber state includes staged/unstaged/untracked
  counts for users who want more detail.

### Drawbacks

- Only 3 states — doesn't differentiate between "1 change" and "100 changes"
  in terms of urgency.
- No indication of ahead/behind status (this is shown in the branch banner).

---

## 6. File Staging Pipeline

### Context

Users need to stage specific files, stage all files, or batch-stage
selected files.  The interface must support all three workflows without
being overwhelming.

### Implementation

```tsx
// Individual file staging (click + icon on FileListItem)
<button onClick={() => handleStage([file.path])}>Stage</button>

// Batch staging (select checkboxes + Stage Selected)
const stageSelected = () => {
  if (selectedFiles.size === 0) { notify.error('Select files'); return; }
  handleStage(Array.from(selectedFiles));
  setSelectedFiles(new Set());
};

// Stage all (Stage All button in section header)
<button onClick={() => handleStage()}>Stage All</button>
```

The backend handles all three via a single endpoint:

```typescript
router.post('/stage', async (req, res) => {
  const files = req.body?.files;
  if (files && files.length > 0) {
    const quoted = files.map(f => `"${f}"`).join(' ');
    await execGit(`git add ${quoted}`);
  } else {
    await execGit('git add -A');
  }
});
```

### Benefits

- **Progressive Complexity**: Stage All for quick operations, checkboxes
  for selective staging.
- **Single Endpoint**: Backend handles individual, batch, and all staging
  through one route.
- **Visual Feedback**: Staged files move from "Changed Files" to
  "Ready to Commit" section.

### Drawbacks

- Selection state (`selectedFiles`) is cleared after staging — if staging
  fails for some files, the user must re-select.
- No drag-and-drop between staged/unstaged sections.

---

## 7. AI Chat Integration Pattern

### Context

The AI assistant must integrate with git operations seamlessly — the user
types a natural-language request, the AI processes it through the mobile
pipeline, and the page automatically refreshes to show results.

### Implementation

```tsx
const AiGitPanel: React.FC<{ onRefreshStatus: () => void }> = ({ onRefreshStatus }) => {
  // Load assistant on mount
  useEffect(() => {
    api.get('/v1/mobile/my-assistant')
      .then(res => setAssistant(res.data?.assistant))
      .catch(() => {});
  }, []);

  // Send message through mobile intent pipeline
  const sendMessage = async (text?: string) => {
    const res = await api.post('/v1/mobile/intent', {
      text: msg,
      conversationId,
      assistantId: assistant.id,
    });
    setMessages(prev => [...prev, { role: 'assistant', content: res.data.reply }]);

    // AUTO-REFRESH after every AI response
    onRefreshStatus();
  };
};

// In SourceControlPage:
<AiGitPanel onRefreshStatus={() => loadAll(true)} />
```

### Benefits

- **Auto-Refresh**: The page automatically re-fetches git status after
  every AI response, so users see the results of AI operations immediately.
- **Conversation Persistence**: Uses `conversationId` for multi-turn
  conversations — the AI remembers context from previous messages.
- **Reuses Mobile Pipeline**: No new backend endpoints needed — the
  existing `/v1/mobile/intent` handles everything.

### Drawbacks

- AI responses are not streamed — the user sees a "Thinking…" animation
  until the full response is ready.
- The AI uses the general mobile pipeline, not a git-specific one — it
  may not have direct access to git tools unless `ai_developer_tools_granted`
  is enabled.
- Auto-refresh runs on every AI response, even for informational queries
  that don't modify the repository.

---

## 8. Quick Action Prompts

### Context

Non-developer users may not know what to ask the AI.  Pre-written prompts
with emoji labels reduce friction and guide users toward common operations.

### Implementation

```tsx
const quickActions = [
  {
    label: '📥 Pull latest changes',
    prompt: 'Pull the latest changes from the remote repository. If there are conflicts, explain what happened and help me resolve them.'
  },
  {
    label: '📊 Explain current status',
    prompt: 'Check the git status and explain what changed files mean in simple terms. Tell me if anything needs attention.'
  },
  {
    label: '💾 Commit my changes',
    prompt: 'Look at the current changes, stage all modified files, and create a descriptive commit message based on what was changed. Then commit.'
  },
  {
    label: '🚀 Push to remote',
    prompt: 'Push the current commits to the remote repository. If there are issues, explain them clearly.'
  },
  {
    label: '🧹 Clean up conflicts',
    prompt: 'Check for any merge conflicts. If found, show me the conflicted files and help me understand what each conflict is about. Suggest the safest resolution.'
  },
];

// Rendered as buttons that call sendMessage() directly
<button onClick={() => sendMessage(action.prompt)}>{action.label}</button>
```

### Benefits

- **Zero Knowledge Required**: Users can perform complex git operations
  without typing a single command or knowing git terminology.
- **Contextual Prompts**: Each prompt is crafted to handle both the happy
  path and error cases (e.g., "If there are conflicts, explain…").
- **Emoji Labels**: Visual cues make buttons instantly recognisable.
- **Disappear After Use**: Quick actions only show when the chat is empty
  (no previous messages).

### Drawbacks

- Fixed set of 5 actions — not customisable per user or project.
- Prompts are hardcoded in the frontend — changing them requires a code
  update.
- The AI may not have the tools to execute the requested operation
  (depends on `ai_developer_tools_granted`).

---

## 9. Responsive Column Layout

### Context

The page must work well on both large screens (showing changes and AI
side by side) and smaller screens (stacking vertically).

### Implementation

```tsx
<div className={`grid gap-4 ${
  showAiPanel
    ? 'grid-cols-1 lg:grid-cols-5'
    : 'grid-cols-1 lg:grid-cols-3'
}`}>
  {/* Left: Changes + Commit */}
  <div className={showAiPanel ? 'lg:col-span-3' : 'lg:col-span-2'}>
    ...
  </div>

  {/* Right: AI Panel or History */}
  <div className={showAiPanel ? 'lg:col-span-2' : 'lg:col-span-1'}>
    {showAiPanel ? <AiGitPanel /> : <CommitHistory />}
  </div>
</div>
```

| AI Panel State | Grid Columns | Left Span | Right Span | Right Content   |
|----------------|-------------|-----------|------------|-----------------|
| Closed         | 3           | 2         | 1          | Commit history  |
| Open           | 5           | 3         | 2          | AI chat panel   |

### Benefits

- **Contextual Layout**: AI panel gets more space when active because
  chat conversations need width.
- **Mobile First**: `grid-cols-1` base means everything stacks on mobile.
- **Content Switching**: Right column shows either history or AI — never
  both — keeping the interface uncluttered.

### Drawbacks

- No breakpoint between mobile and `lg` (1024px) — medium-sized screens
  get the mobile stack layout.
- AI panel has a fixed height (`h-[calc(100vh-240px)]`) which may not
  work well on all viewports.

---

## 10. Destructive Action Confirmation

### Context

Destructive git operations (discard, resolve conflicts, abort merge)
cannot be undone.  Users must explicitly confirm before proceeding.

### Implementation

```tsx
const handleDiscard = async (files?: string[]) => {
  const result = await Swal.fire({
    title: 'Discard Changes?',
    text: files
      ? `Discard changes to ${files.length} file(s)? This cannot be undone.`
      : 'Discard ALL uncommitted changes? This cannot be undone.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    confirmButtonText: 'Discard',
  });
  if (!result.isConfirmed) return;

  await GitModel.discard(files);
};
```

**Actions That Require Confirmation:**

| Action              | Dialog Title           | Icon      | Confirm Button     |
|---------------------|------------------------|-----------|---------------------|
| Discard changes     | "Discard Changes?"     | `warning` | Red "Discard"       |
| Resolve conflicts   | "Resolve All Conflicts"| `question`| "Use [strategy]"    |
| Abort merge         | "Abort Merge?"         | `warning` | Red "Abort Merge"   |

**Actions That Don't Require Confirmation:**

| Action    | Reason                                           |
|-----------|--------------------------------------------------|
| Stage     | Non-destructive, easily reversible (unstage)     |
| Unstage   | Non-destructive, easily reversible (stage)       |
| Commit    | Reversible via reset; requires explicit message  |
| Push      | Non-destructive on the server; shows badge count |
| Pull      | Conflicts trigger separate resolution flow       |
| Fetch     | Read-only, no local changes                      |
| Stash     | Changes are preserved, not deleted               |

### Benefits

- **Irreversibility Awareness**: Red button color and "cannot be undone"
  text make consequences clear.
- **SweetAlert2 Integration**: Matches the dialog style used across the
  rest of the application.
- **Cancel-Safe**: All confirmation dialogs have a cancel button.

### Drawbacks

- No "Don't show this again" option for experienced users.
- Bulk discard shows file count but not individual file names.

---

## 11. Shared Component Extraction

### Context

The `AiMarkdown` component was originally defined inline in `Bugs.tsx`
(~90 lines).  The new Source Control page also needs markdown rendering
for AI chat messages.  Duplicating the component would create maintenance
burden.

### Implementation

```
BEFORE:
  Bugs.tsx ─── contains inline AiMarkdown component
                └── uses ReactMarkdown + remarkGfm

AFTER:
  components/AI/AiMarkdown.tsx ─── shared component
  Bugs.tsx ─── imports from shared component
  SourceControl.tsx ─── imports from shared component
```

```tsx
// components/AI/AiMarkdown.tsx
const AiMarkdown: React.FC<{ content: string }> = ({ content }) => (
  <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ ... }}>
    {content}
  </ReactMarkdown>
);
export default AiMarkdown;

// Both consumers:
import AiMarkdown from '../../components/AI/AiMarkdown';
```

**Dark mode additions**: The shared component adds `dark:` Tailwind
variants that were not present in the original Bugs.tsx inline version:
- `dark:bg-slate-700/80` for inline code
- `dark:text-rose-400` for inline code text
- `dark:bg-gray-700` for table headers
- `dark:border-gray-600` for table borders
- `dark:text-gray-200` for headings
- `dark:text-gray-100` for strong text
- `dark:text-gray-400` for blockquotes

### Benefits

- **Single Source of Truth**: Changes to markdown rendering apply everywhere.
- **Dark Mode Improvement**: Shared version includes dark mode variants
  not present in the original.
- **Clean Import Path**: `components/AI/` establishes a directory for
  future shared AI components.

### Drawbacks

- Two consumers now depend on the same component — changes must be tested
  in both Bugs and Source Control.
- No customisation hooks (e.g., theme override props) — both consumers
  get identical rendering.

---

## 12. Silent Refresh Pattern

### Context

After performing git operations (stage, commit, push, etc.), the page
must re-fetch the current status without showing a full loading spinner
that would disrupt the user's workflow.

### Implementation

```tsx
const loadAll = useCallback(async (silent = false) => {
  if (!silent) setLoading(true);    // Full spinner
  else setRefreshing(true);         // Subtle indicator

  const [configRes, statusRes, logRes] = await Promise.all([
    GitModel.getConfig(),
    GitModel.getStatus(),
    GitModel.getLog(30),
  ]);
  // ... update state

  setLoading(false);
  setRefreshing(false);
}, []);

// Initial load — full spinner
useEffect(() => { loadAll(); }, [loadAll]);

// After operations — silent refresh
const handleStage = async (files?: string[]) => {
  await GitModel.stage(files);
  loadAll(true);  // ← silent
};

// Manual refresh button
<button onClick={() => loadAll(true)}>
  <ArrowPathIcon className={refreshing ? 'animate-spin' : ''} />
</button>
```

### Benefits

- **Non-Disruptive**: Users continue seeing their current work while
  data refreshes in the background.
- **Visual Feedback**: The refresh button spinner indicates something
  is happening without blocking the UI.
- **Parallel Fetching**: Config, status, and log are fetched in parallel
  (`Promise.all`) for speed.

### Drawbacks

- Three API calls on every refresh — could be combined into a single
  endpoint for efficiency.
- No optimistic updates — the UI waits for the refresh to complete
  before showing the new state.
- Stash list is fetched separately (not in `Promise.all`) to avoid
  blocking the main refresh.

---

*Document generated from the Source Control module implementation.*
