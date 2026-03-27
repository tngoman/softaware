# Source Control — File Reference

> **Module**: Source Control (Git Operations UI)  

---

## Table of Contents

1. [Overview](#overview)  
2. [Backend Files](#backend-files)  
3. [Frontend Files](#frontend-files)  
4. [Shared Components](#shared-components)  
5. [Routing & Navigation](#routing--navigation)  
6. [Internal Helpers](#internal-helpers)  
7. [Constants & Exports](#constants--exports)  

---

## Overview

| Metric                   | Value         |
|--------------------------|---------------|
| Total files touched      | 6             |
| New files created        | 3             |
| Existing files modified  | 3             |
| Backend files            | 1             |
| Frontend files           | 5             |
| Estimated new LOC        | ~2,500        |

---

## Backend Files

### Modified Files

#### git.ts

| Property     | Value                                                |
|--------------|------------------------------------------------------|
| **Path**     | `backend/src/routes/git.ts`                          |
| **LOC**      | ~1,153                                               |
| **Purpose**  | Complete git API — all read and write operations      |
| **Exports**  | `gitRouter` (Express Router)                         |
| **Dependencies** | `express`, `child_process`, `util`, `apiKey` middleware |

**Constants:**

| Constant         | Value                          | Purpose                         |
|------------------|--------------------------------|---------------------------------|
| `GIT_DIR`        | `/var/www/code/silulumanzi`    | Repository path                 |
| `ALLOWED_BRANCH` | `Bugfix`                       | Branch write restriction        |
| `EXEC_TIMEOUT`   | `10000`                        | Timeout for local git commands  |
| `NETWORK_TIMEOUT`| `30000`                        | Timeout for network git commands|

**Helper Functions:**

| Function           | Visibility | Purpose                                                  |
|--------------------|------------|----------------------------------------------------------|
| `execGit()`        | Private    | Execute git command with timeout + maxBuffer (10MB)      |
| `getCurrentBranch()`| Private   | `git rev-parse --abbrev-ref HEAD`                        |
| `enforceBranch()`  | Private    | Returns 403 if not on Bugfix; returns `false` to halt    |
| `sanitizeHash()`   | Private    | Validates commit SHA matches `[a-f0-9]{7,40}`            |
| `sanitizePath()`   | Private    | Blocks `..` traversal and leading `/`                    |

**Read Endpoints (11):**

| Method | Route              | Purpose                                    | Response Shape |
|--------|--------------------|--------------------------------------------|----------------|
| GET    | `/branches`        | List local + remote branches with tracking | `{ current, local[], remote[], total }` |
| GET    | `/status`          | Working tree status with file list          | `{ branch, ahead, behind, clean, files[], summary }` |
| GET    | `/info`            | Repo overview (branch, last commit, remote) | `{ branch, lastCommit, remote, totalCommits, status }` |
| GET    | `/log`             | Commit history (paginated, filterable)      | `{ commits[], limit, path, hasMore }` |
| GET    | `/commit/:hash`    | Detailed commit info (files, stats)         | `{ hash, message, author, files[], stats }` |
| GET    | `/history`         | File-specific commit history (`--follow`)   | `{ path, commits[] }` |
| GET    | `/diff`            | Unified diff (staged or unstaged)           | `{ diff, staged, file, hasChanges }` |
| GET    | `/tags`            | List all tags                               | `{ tags[], total }` |
| GET    | `/stash/list`      | List stash entries                          | `{ entries[], total }` |
| GET    | `/file-content`    | File content at specific ref                | `{ path, ref, content }` |
| GET    | `/config`          | Branch restriction config                   | `{ allowedBranch, currentBranch, isOnAllowedBranch, repositoryPath }` |

**Write Endpoints (13) — all enforce Bugfix branch via `enforceBranch()`:**

| Method | Route               | Body                              | Purpose                          | Guard           |
|--------|---------------------|-----------------------------------|----------------------------------|-----------------|
| POST   | `/checkout`         | `{ branch }`                      | Switch to Bugfix branch only     | Branch=Bugfix   |
| POST   | `/fetch`            | —                                 | `git fetch origin --prune`       | —               |
| POST   | `/pull`             | —                                 | Pull from `origin/Bugfix`        | `enforceBranch` |
| POST   | `/stage`            | `{ files?: string[] }`            | Stage files or all (`git add -A`)| `enforceBranch` |
| POST   | `/unstage`          | `{ files?: string[] }`            | Unstage files (`git reset HEAD`) | `enforceBranch` |
| POST   | `/commit`           | `{ message }`                     | Commit staged changes            | `enforceBranch` |
| POST   | `/push`             | —                                 | Push to `origin/Bugfix`          | `enforceBranch` |
| POST   | `/stash`            | `{ message?: string }`            | Stash uncommitted changes        | —               |
| POST   | `/stash/pop`        | —                                 | Pop most recent stash            | —               |
| POST   | `/discard`          | `{ files?: string[] }`            | Discard changes (`git checkout --`)| `enforceBranch`|
| POST   | `/reset`            | `{ target?, mode? }`              | Reset (soft/mixed/hard)          | `enforceBranch` |
| POST   | `/resolve-conflicts`| `{ strategy, files? }`            | Resolve via ours/theirs          | `enforceBranch` |
| POST   | `/abort-merge`      | —                                 | Abort in-progress merge          | —               |

**Key Modifications from Previous Version:**

| Area                  | Before (v0.x)                    | After (v1.0.0)                              |
|-----------------------|----------------------------------|---------------------------------------------|
| Endpoints             | 2 write (pull, checkout)         | 11 read + 13 write = 24 total               |
| Branch restriction    | None                             | `ALLOWED_BRANCH = 'Bugfix'` + `enforceBranch()` |
| Timeout strategy      | Default                          | Dual: `EXEC_TIMEOUT` (10s) + `NETWORK_TIMEOUT` (30s) |
| Path validation       | None                             | `sanitizePath()` + `sanitizeHash()`          |
| Conflict detection    | None                             | Detects in pull, stash pop; returns 409      |
| Checkout restriction  | Any branch allowed               | Only `Bugfix` accepted                       |
| Push/Pull target      | Any remote/branch                | Hardcoded `origin/Bugfix`                    |

---

## Frontend Files

### New Files

#### GitModel.ts

| Property     | Value                                                |
|--------------|------------------------------------------------------|
| **Path**     | `frontend/src/models/GitModel.ts`                    |
| **LOC**      | ~161                                                 |
| **Purpose**  | Frontend model wrapping all git API endpoints         |
| **Exports**  | `GitModel` (named export, object with async methods) |
| **Dependencies** | `services/api` (Axios instance)                  |

**Methods (24):**

| Category    | Method              | HTTP Method | Endpoint                    | Parameters                        |
|-------------|---------------------|-------------|-----------------------------|-----------------------------------|
| **Read**    | `getConfig()`       | GET         | `/code/git/config`          | —                                 |
|             | `getInfo()`         | GET         | `/code/git/info`            | —                                 |
|             | `getStatus()`       | GET         | `/code/git/status`          | —                                 |
|             | `getBranches()`     | GET         | `/code/git/branches`        | —                                 |
|             | `getLog()`          | GET         | `/code/git/log`             | `limit?, path?`                   |
|             | `getCommit()`       | GET         | `/code/git/commit/:hash`    | `hash`                            |
|             | `getDiff()`         | GET         | `/code/git/diff`            | `staged?, file?`                  |
|             | `getTags()`         | GET         | `/code/git/tags`            | —                                 |
|             | `getStashList()`    | GET         | `/code/git/stash/list`      | —                                 |
|             | `getHistory()`      | GET         | `/code/git/history`         | `path`                            |
|             | `getFileContent()`  | GET         | `/code/git/file-content`    | `path, ref?`                      |
| **Write**   | `checkout()`        | POST        | `/code/git/checkout`        | `branch`                          |
|             | `fetch()`           | POST        | `/code/git/fetch`           | —                                 |
|             | `pull()`            | POST        | `/code/git/pull`            | —                                 |
|             | `stage()`           | POST        | `/code/git/stage`           | `files?`                          |
|             | `unstage()`         | POST        | `/code/git/unstage`         | `files?`                          |
|             | `commit()`          | POST        | `/code/git/commit`          | `message`                         |
|             | `push()`            | POST        | `/code/git/push`            | —                                 |
|             | `stash()`           | POST        | `/code/git/stash`           | `message?`                        |
|             | `stashPop()`        | POST        | `/code/git/stash/pop`       | —                                 |
|             | `discard()`         | POST        | `/code/git/discard`         | `files?`                          |
|             | `reset()`           | POST        | `/code/git/reset`           | `target?, mode?`                  |
|             | `resolveConflicts()`| POST        | `/code/git/resolve-conflicts`| `strategy, files?`               |
|             | `abortMerge()`      | POST        | `/code/git/abort-merge`     | —                                 |

---

#### SourceControl.tsx

| Property     | Value                                                |
|--------------|------------------------------------------------------|
| **Path**     | `frontend/src/pages/general/SourceControl.tsx`       |
| **LOC**      | ~1,270                                               |
| **Purpose**  | Full-page source control UI with AI integration      |
| **Exports**  | `SourceControlPage` (default export)                 |
| **Dependencies** | `GitModel`, `AiMarkdown`, `api`, `useAppStore`, `Swal`, `notify`, `@heroicons/react` |

**TypeScript Interfaces:**

| Interface      | Fields                                                     |
|----------------|------------------------------------------------------------|
| `GitFile`      | `path, type, staged, unstaged, status`                     |
| `CommitInfo`   | `hash, shortHash, message, author, email, date, timestamp` |
| `BranchInfo`   | `name, hash, current, upstream, ahead, behind`             |
| `AiMessage`    | `role ('user' \| 'assistant' \| 'system'), content`        |

**Sub-Components (6):**

| Component          | Lines  | Props                                                    | Purpose                                      |
|--------------------|--------|----------------------------------------------------------|----------------------------------------------|
| `BranchBanner`     | ~50    | `currentBranch, allowedBranch, isOnAllowed, ahead, behind, onCheckout` | Branch status + switch button |
| `StatusHealthCard` | ~45    | `clean, totalChanges, stagedCount, unstagedCount, untrackedCount, hasConflicts` | Green/amber/red health indicator |
| `FileListItem`     | ~70    | `file, selected, onToggle, onStage?, onUnstage?, onDiscard?, onViewDiff?, isStaged, disabled?` | Individual file with actions |
| `CommitItem`       | ~20    | `commit, isLatest, onClick`                              | Commit in history list                       |
| `DiffViewer`       | ~30    | `diff, file?, onClose`                                   | Modal with color-coded diff                  |
| `AiGitPanel`       | ~180   | `onRefreshStatus`                                        | Full AI chat with quick actions              |

**Utility Functions:**

| Function        | Purpose                                     |
|-----------------|---------------------------------------------|
| `getFileName()` | Extract filename from path                  |
| `getFileDir()`  | Extract directory from path                 |
| `relativeTime()`| Convert ISO date to "Xm/Xh/Xd ago" format  |

**File Type Metadata (`FILE_TYPE_META`):**

| Key         | Label     | Color Class        | Icon                   |
|-------------|-----------|--------------------|------------------------|
| `modified`  | Modified  | `text-amber-600`   | `DocumentDuplicateIcon`|
| `added`     | New       | `text-emerald-600` | `PlusIcon`             |
| `deleted`   | Deleted   | `text-red-600`     | `MinusIcon`            |
| `renamed`   | Renamed   | `text-blue-600`    | `ArrowPathIcon`        |
| `untracked` | New File  | `text-purple-600`  | `PlusIcon`             |
| `copied`    | Copied    | `text-cyan-600`    | `DocumentDuplicateIcon`|
| `unknown`   | Changed   | `text-gray-600`    | `DocumentTextIcon`     |

**Main Page State:**

| State Variable      | Type                          | Purpose                          |
|---------------------|-------------------------------|----------------------------------|
| `loading`           | `boolean`                     | Initial load spinner             |
| `refreshing`        | `boolean`                     | Silent refresh indicator         |
| `config`            | `object \| null`              | Branch config from `/config`     |
| `statusData`        | `object \| null`              | Working tree status from `/status`|
| `commits`           | `CommitInfo[]`                | Recent commit history            |
| `selectedCommit`    | `any \| null`                 | Commit detail modal data         |
| `selectedFiles`     | `Set<string>`                 | Multi-select for batch staging   |
| `commitMessage`     | `string`                      | Commit message textarea value    |
| `committing`        | `boolean`                     | Commit in progress               |
| `pushing`           | `boolean`                     | Push in progress                 |
| `pulling`           | `boolean`                     | Pull in progress                 |
| `diffData`          | `{ diff, file? } \| null`    | Diff viewer modal data           |
| `stashes`           | `any[]`                       | Stash entries list               |
| `hasConflicts`      | `boolean`                     | Merge conflict state             |
| `showAiPanel`       | `boolean`                     | AI panel visibility toggle       |
| `expandedSections`  | `{ staged, unstaged, history}`| Collapsible section state        |

**Action Handlers (14):**

| Handler                | Git Operation                 | Error Handling                       |
|------------------------|-------------------------------|--------------------------------------|
| `handleCheckout()`     | `GitModel.checkout()`         | Detects `UNCOMMITTED_CHANGES`        |
| `handleStage()`        | `GitModel.stage(files?)`      | Generic error toast                  |
| `handleUnstage()`      | `GitModel.unstage(files?)`    | Generic error toast                  |
| `handleDiscard()`      | `GitModel.discard(files?)`    | SweetAlert2 confirmation first       |
| `handleCommit()`       | `GitModel.commit(message)`    | Detects `NOTHING_STAGED`, `BRANCH_RESTRICTED` |
| `handlePush()`         | `GitModel.push()`             | Generic error toast                  |
| `handlePull()`         | `GitModel.pull()`             | Detects `MERGE_CONFLICT` (200 + 409) |
| `handleStash()`        | `GitModel.stash()`            | Generic error toast                  |
| `handleStashPop()`     | `GitModel.stashPop()`         | Detects conflicts (409)              |
| `handleViewDiff()`     | `GitModel.getDiff()`          | Falls back to staged diff            |
| `handleViewCommit()`   | `GitModel.getCommit(hash)`    | Generic error toast                  |
| `handleResolveConflicts()` | `GitModel.resolveConflicts()` | SweetAlert2 confirmation first   |
| `handleAbortMerge()`   | `GitModel.abortMerge()`       | SweetAlert2 confirmation first       |
| `handleFetch()`        | `GitModel.fetch()`            | Generic error toast                  |

---

### Modified Files

#### Bugs.tsx

| Property     | Value                                                |
|--------------|------------------------------------------------------|
| **Path**     | `frontend/src/pages/general/Bugs.tsx`                |
| **Changes**  | Removed inline `AiMarkdown`, added shared import; removed git text references |

**Key Modifications:**

| Area                   | Before                                          | After                                              |
|------------------------|-------------------------------------------------|----------------------------------------------------|
| `AiMarkdown` component | Inline definition (~90 lines)                   | Imported from `../../components/AI/AiMarkdown`     |
| `ReactMarkdown` import | Direct import                                   | Removed (handled by shared component)              |
| `remarkGfm` import     | Direct import                                   | Removed (handled by shared component)              |
| AI pipeline description | Mentioned "commit code"                        | Removed git reference                              |
| Available tools list   | Included "Commit & Push — Stage, commit…"       | Removed git reference                              |

---

## Shared Components

#### AiMarkdown.tsx

| Property     | Value                                                |
|--------------|------------------------------------------------------|
| **Path**     | `frontend/src/components/AI/AiMarkdown.tsx`          |
| **LOC**      | ~106                                                 |
| **Purpose**  | Shared markdown renderer for all AI chat interfaces  |
| **Exports**  | `AiMarkdown` (default export)                        |
| **Dependencies** | `react-markdown`, `remark-gfm`                  |

**Props:**

| Prop      | Type     | Required | Description                       |
|-----------|----------|----------|-----------------------------------|
| `content` | `string` | Yes      | Markdown text to render           |

**Custom Renderers:**

| Element       | Rendering                                                            |
|---------------|----------------------------------------------------------------------|
| `pre`         | Dark bg (`#0f172a`), monospace, overflow-x-auto, transparent child `<code>` |
| `code` (diff) | Line-level coloring: green `+`, red `-`, cyan `@@`                   |
| `code` (lang) | Language label header with border separator                          |
| `code` (inline)| Rose pill (`bg-slate-200/80 text-rose-600`) + dark mode variant     |
| `table`       | Full-width, bordered, responsive with `overflow-x-auto`             |
| `th`          | Gray background, semibold, 11px text                                 |
| `td`          | Bordered, 11px text                                                  |
| `h1`–`h3`    | Sized headings with proper spacing                                   |
| `ul`/`ol`     | Disc/decimal lists with left margin + spacing                        |
| `li`          | Relaxed leading, 14px text                                           |
| `p`           | 14px text with vertical spacing                                      |
| `strong`      | Semibold with gray-900 / gray-100 dark mode                          |
| `blockquote`  | Emerald left border, italic, muted text                              |
| `hr`          | Gray horizontal rule with spacing                                    |
| `a`           | Emerald underlined link, opens in new tab                            |

**Used By:**

| Module          | Component                    | Usage                              |
|-----------------|------------------------------|------------------------------------|
| Source Control  | `AiGitPanel`                 | Renders AI assistant messages      |
| Bugs            | AI Resolution tab            | Renders AI bug resolution messages |

---

## Routing & Navigation

#### Layout.tsx

| Property     | Value                                                |
|--------------|------------------------------------------------------|
| **Path**     | `frontend/src/components/Layout/Layout.tsx`          |
| **Changes**  | Added `CommandLineIcon` import; added Source Control nav item |

**Nav Item Added:**

```typescript
{
  name: 'Source Control',
  href: '/source-control',
  icon: CommandLineIcon,
  permission: 'settings.view',
  roleSlug: 'developer'
}
```

**Position**: Development section, between Error Reports and Database.

---

#### App.tsx

| Property     | Value                                                |
|--------------|------------------------------------------------------|
| **Path**     | `frontend/src/App.tsx`                               |
| **Changes**  | Added `SourceControl` import; added route definition  |

**Import Added:**

```typescript
import SourceControl from './pages/general/SourceControl';
```

**Route Added:**

```tsx
<Route
  path="/source-control"
  element={
    <DeveloperRoute>
      <Layout>
        <SourceControl />
      </Layout>
    </DeveloperRoute>
  }
/>
```

**Position**: After `/database` route, within the Software/Tasks/Updates block.

---

## Internal Helpers

| Function              | File                     | Visibility | Description                              |
|-----------------------|--------------------------|------------|------------------------------------------|
| `execGit()`           | `git.ts`                 | Private    | Execute git command with timeout/buffer  |
| `getCurrentBranch()`  | `git.ts`                 | Private    | Get current branch name                  |
| `enforceBranch()`     | `git.ts`                 | Private    | Block writes if not on Bugfix            |
| `sanitizeHash()`      | `git.ts`                 | Private    | Validate commit SHA format               |
| `sanitizePath()`      | `git.ts`                 | Private    | Block path traversal                     |
| `getFileName()`       | `SourceControl.tsx`      | Private    | Extract filename from path               |
| `getFileDir()`        | `SourceControl.tsx`      | Private    | Extract directory from path              |
| `relativeTime()`      | `SourceControl.tsx`      | Private    | ISO date → relative time string          |

---

## Constants & Exports

| Constant / Export     | File                    | Type                 | Description                            |
|-----------------------|-------------------------|----------------------|----------------------------------------|
| `GIT_DIR`             | `git.ts`                | `string`             | Repository path                        |
| `ALLOWED_BRANCH`      | `git.ts`                | `string`             | Branch write restriction (`Bugfix`)    |
| `EXEC_TIMEOUT`        | `git.ts`                | `number`             | Local command timeout (10s)            |
| `NETWORK_TIMEOUT`     | `git.ts`                | `number`             | Network command timeout (30s)          |
| `gitRouter`           | `git.ts`                | `Router`             | Express router export                  |
| `GitModel`            | `GitModel.ts`           | `object`             | Frontend API model (24 methods)        |
| `SourceControlPage`   | `SourceControl.tsx`     | `React.FC`           | Main page component (default export)   |
| `AiMarkdown`          | `AiMarkdown.tsx`        | `React.FC`           | Shared markdown renderer               |
| `FILE_TYPE_META`      | `SourceControl.tsx`     | `Record<string, …>`  | File type display metadata             |

---

*Document generated from the Source Control module implementation.*
