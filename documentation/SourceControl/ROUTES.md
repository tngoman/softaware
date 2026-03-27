# Source Control — Route Reference

> **Module**: Source Control (Git Operations UI)  

---

## Table of Contents

1. [Route Summary](#route-summary)  
2. [Read Endpoints](#read-endpoints)  
3. [Write Endpoints](#write-endpoints)  
4. [AI Integration Endpoints](#ai-integration-endpoints)  
5. [Error Codes](#error-codes)  
6. [Conflict Detection Flow](#conflict-detection-flow)  

---

## Route Summary

All git endpoints are mounted under `/api/code/git/` and require API key
authentication via the `requireApiKey` middleware.

### Read Endpoints

| Method | Route                        | Auth    | Purpose                           |
|--------|------------------------------|---------|-----------------------------------|
| GET    | `/code/git/config`           | API Key | Branch restriction configuration  |
| GET    | `/code/git/status`           | API Key | Working tree status               |
| GET    | `/code/git/info`             | API Key | Repository overview               |
| GET    | `/code/git/branches`         | API Key | List all branches                 |
| GET    | `/code/git/log`              | API Key | Commit history                    |
| GET    | `/code/git/commit/:hash`     | API Key | Commit details                    |
| GET    | `/code/git/history`          | API Key | File-specific history             |
| GET    | `/code/git/diff`             | API Key | Unified diff                      |
| GET    | `/code/git/tags`             | API Key | List tags                         |
| GET    | `/code/git/stash/list`       | API Key | List stash entries                |
| GET    | `/code/git/file-content`     | API Key | File content at ref               |

### Write Endpoints

| Method | Route                             | Auth    | Branch Guard | Purpose                    |
|--------|-----------------------------------|---------|--------------|----------------------------|
| POST   | `/code/git/checkout`              | API Key | Bugfix only  | Switch branch              |
| POST   | `/code/git/fetch`                 | API Key | —            | Fetch from remote          |
| POST   | `/code/git/pull`                  | API Key | `enforceBranch` | Pull from origin/Bugfix |
| POST   | `/code/git/stage`                 | API Key | `enforceBranch` | Stage files              |
| POST   | `/code/git/unstage`               | API Key | `enforceBranch` | Unstage files            |
| POST   | `/code/git/commit`                | API Key | `enforceBranch` | Commit staged changes    |
| POST   | `/code/git/push`                  | API Key | `enforceBranch` | Push to origin/Bugfix    |
| POST   | `/code/git/stash`                 | API Key | —            | Stash changes              |
| POST   | `/code/git/stash/pop`             | API Key | —            | Pop stash                  |
| POST   | `/code/git/discard`               | API Key | `enforceBranch` | Discard changes          |
| POST   | `/code/git/reset`                 | API Key | `enforceBranch` | Reset to commit          |
| POST   | `/code/git/resolve-conflicts`     | API Key | `enforceBranch` | Resolve conflicts        |
| POST   | `/code/git/abort-merge`           | API Key | —            | Abort merge                |

---

## Read Endpoints

### GET /code/git/config

Get branch restriction configuration and current repository state.

#### Request

```bash
curl -X GET https://example.com/api/code/git/config \
  -H "x-api-key: <API_KEY>"
```

#### Response — Success (200)

```json
{
  "allowedBranch": "Bugfix",
  "currentBranch": "Bugfix",
  "isOnAllowedBranch": true,
  "repositoryPath": "/var/www/code/silulumanzi"
}
```

#### Notes

- This is the first endpoint called by the frontend on page load.
- Used by `BranchBanner` to determine whether to show a warning.

---

### GET /code/git/status

Get detailed working tree status with file list and summary counts.

#### Request

```bash
curl -X GET https://example.com/api/code/git/status \
  -H "x-api-key: <API_KEY>"
```

#### Response — Clean (200)

```json
{
  "branch": "Bugfix",
  "ahead": 0,
  "behind": 0,
  "clean": true,
  "files": [],
  "summary": {
    "total": 0,
    "staged": 0,
    "unstaged": 0,
    "untracked": 0
  }
}
```

#### Response — With Changes (200)

```json
{
  "branch": "Bugfix",
  "ahead": 2,
  "behind": 0,
  "clean": false,
  "files": [
    {
      "path": "src/components/Widget.tsx",
      "type": "modified",
      "staged": true,
      "unstaged": false,
      "status": "M "
    },
    {
      "path": "src/pages/NewPage.tsx",
      "type": "untracked",
      "staged": false,
      "unstaged": true,
      "status": "??"
    }
  ],
  "summary": {
    "total": 2,
    "staged": 1,
    "unstaged": 1,
    "untracked": 1
  }
}
```

#### File Type Mapping

| Git Status Code | `type` Value  |
|-----------------|---------------|
| `M`             | `modified`    |
| `A`             | `added`       |
| `D`             | `deleted`     |
| `R`             | `renamed`     |
| `C`             | `copied`      |
| `??`            | `untracked`   |
| Other           | `unknown`     |

#### Notes

- Uses `git status --porcelain=v1` for machine-readable output.
- `ahead` and `behind` are relative to the upstream tracking branch.
- Parsing handles both staged (`status[0]`) and unstaged (`status[1]`).

---

### GET /code/git/info

Get basic repository overview.

#### Response — Success (200)

```json
{
  "branch": "Bugfix",
  "lastCommit": {
    "hash": "abc123def456...",
    "shortHash": "abc123d",
    "message": "fix: resolve login issue",
    "author": "John Doe",
    "email": "john@example.com",
    "date": "2026-03-17T10:30:00+02:00",
    "timestamp": 1773993000
  },
  "remote": "git@github.com:org/silulumanzi.git",
  "totalCommits": 1234,
  "status": "clean"
}
```

---

### GET /code/git/branches

List all local and remote branches with tracking information.

#### Response — Success (200)

```json
{
  "current": "Bugfix",
  "local": [
    {
      "name": "Bugfix",
      "hash": "abc123d",
      "current": true,
      "upstream": "origin/Bugfix",
      "ahead": 2,
      "behind": 0
    },
    {
      "name": "main",
      "hash": "def456a",
      "current": false,
      "upstream": "origin/main",
      "ahead": 0,
      "behind": 5
    }
  ],
  "remote": [
    { "name": "origin/Bugfix", "hash": "abc123d" },
    { "name": "origin/main", "hash": "def456a" }
  ],
  "total": { "local": 2, "remote": 2 }
}
```

---

### GET /code/git/log

Get commit history with optional path filtering and pagination.

#### Query Parameters

| Parameter | Type     | Default | Max  | Description                    |
|-----------|----------|---------|------|--------------------------------|
| `limit`   | `number` | `20`    | `100`| Max commits to return          |
| `path`    | `string` | —       | —    | Filter by file path (optional) |

#### Response — Success (200)

```json
{
  "commits": [
    {
      "hash": "abc123def456...",
      "shortHash": "abc123d",
      "message": "fix: resolve login issue",
      "author": "John Doe",
      "email": "john@example.com",
      "date": "2026-03-17T10:30:00+02:00",
      "timestamp": 1773993000
    }
  ],
  "limit": 20,
  "path": null,
  "hasMore": true
}
```

---

### GET /code/git/commit/:hash

Get detailed information for a specific commit.

#### URL Parameters

| Parameter | Type     | Required | Validation                    |
|-----------|----------|----------|-------------------------------|
| `hash`    | `string` | Yes      | `[a-f0-9]{7,40}` (sanitized) |

#### Response — Success (200)

```json
{
  "hash": "abc123def456789...",
  "shortHash": "abc123d",
  "message": "fix: resolve login issue\n\nAdded missing preventDefault call.",
  "author": "John Doe",
  "email": "john@example.com",
  "date": "2026-03-17T10:30:00+02:00",
  "timestamp": 1773993000,
  "files": [
    { "path": "src/components/Login.tsx", "status": "modified" },
    { "path": "src/utils/auth.ts", "status": "added" }
  ],
  "stats": {
    "filesChanged": 2,
    "additions": 15,
    "deletions": 3
  }
}
```

---

### GET /code/git/diff

Get unified diff for working tree changes.

#### Query Parameters

| Parameter | Type      | Default  | Description                        |
|-----------|-----------|----------|------------------------------------|
| `staged`  | `string`  | `false`  | `"true"` for staged, `"false"` for unstaged |
| `file`    | `string`  | —        | Filter to specific file (optional) |

#### Response — Success (200)

```json
{
  "diff": "--- a/src/Login.tsx\n+++ b/src/Login.tsx\n@@ -10,6 +10,7 @@\n...",
  "staged": false,
  "file": "src/Login.tsx",
  "hasChanges": true
}
```

---

### GET /code/git/history

Get commit history for a specific file (follows renames).

#### Query Parameters

| Parameter | Type     | Required | Description            |
|-----------|----------|----------|------------------------|
| `path`    | `string` | Yes      | File path to query     |

#### Response — Success (200)

```json
{
  "path": "src/Login.tsx",
  "commits": [
    {
      "hash": "abc123...",
      "shortHash": "abc123d",
      "message": "fix: login handler",
      "author": "John Doe",
      "email": "john@example.com",
      "date": "2026-03-17T10:30:00+02:00",
      "timestamp": 1773993000
    }
  ]
}
```

---

### GET /code/git/tags

List all tags.

#### Response — Success (200)

```json
{
  "tags": [
    {
      "name": "v1.2.3",
      "hash": "abc123d",
      "date": "2026-03-15T08:00:00+02:00",
      "message": "Release v1.2.3"
    }
  ],
  "total": 1
}
```

---

### GET /code/git/stash/list

List stash entries.

#### Response — Success (200)

```json
{
  "entries": [
    {
      "ref": "stash@{0}",
      "message": "WIP on Bugfix: abc123d fix login",
      "date": "2026-03-17 10:30:00 +0200"
    }
  ],
  "total": 1
}
```

---

### GET /code/git/file-content

Read file content at a specific git ref.

#### Query Parameters

| Parameter | Type     | Default | Description                      |
|-----------|----------|---------|----------------------------------|
| `path`    | `string` | —       | File path (required)             |
| `ref`     | `string` | `HEAD`  | Git ref (commit hash or `HEAD`)  |

#### Response — Success (200)

```json
{
  "path": "src/Login.tsx",
  "ref": "HEAD",
  "content": "import React from 'react';\n..."
}
```

---

## Write Endpoints

### POST /code/git/checkout

Switch to the Bugfix branch.

#### Request Body

| Field    | Type     | Required | Validation               |
|----------|----------|----------|--------------------------|
| `branch` | `string` | Yes      | Must equal `"Bugfix"`    |

#### Response — Success (200)

```json
{
  "success": true,
  "branch": "Bugfix",
  "message": "Switched to branch 'Bugfix'"
}
```

#### Response — Branch Restricted (403)

```json
{
  "success": false,
  "error": "BRANCH_RESTRICTED",
  "message": "You can only switch to the \"Bugfix\" branch. Requested: \"main\"",
  "allowedBranch": "Bugfix"
}
```

#### Response — Uncommitted Changes (400)

```json
{
  "success": false,
  "error": "UNCOMMITTED_CHANGES",
  "message": "Repository has uncommitted changes. Stash or commit them first."
}
```

#### Notes

- Only the `Bugfix` branch is allowed as a checkout target.
- Will not create new branches.
- Checks for uncommitted changes before switching.
- Branch name is validated against `[a-zA-Z0-9._/-]+`.

---

### POST /code/git/fetch

Fetch latest refs from remote (no merge).

#### Request Body

None.

#### Response — Success (200)

```json
{
  "success": true,
  "message": "Fetch complete",
  "output": ""
}
```

#### Notes

- Runs `git fetch origin --prune`.
- Uses `NETWORK_TIMEOUT` (30s).
- Safe operation — does not modify the working tree.

---

### POST /code/git/pull

Pull latest changes from `origin/Bugfix`.

#### Request Body

None.

#### Response — Success (200)

```json
{
  "success": true,
  "filesChanged": 3,
  "insertions": 25,
  "deletions": 10,
  "message": "Pull successful",
  "output": "Updating abc123d..def456a\nFast-forward\n..."
}
```

#### Response — Already Up-to-Date (200)

```json
{
  "success": true,
  "filesChanged": 0,
  "insertions": 0,
  "deletions": 0,
  "message": "Already up to date.",
  "output": "Already up to date."
}
```

#### Response — Merge Conflict (200 or 409)

```json
{
  "success": false,
  "error": "MERGE_CONFLICT",
  "message": "Pull resulted in merge conflicts that need to be resolved.",
  "conflictFiles": ["src/Login.tsx", "src/utils/auth.ts"],
  "output": "CONFLICT (content): Merge conflict in src/Login.tsx"
}
```

#### Notes

- **Branch Guard**: `enforceBranch()` runs first — 403 if not on Bugfix.
- **Clean Check**: Rejects if uncommitted changes exist (400).
- **Conflict Detection**: Checks both `stdout` and `stderr` for `CONFLICT`.
  Conflicts may return 200 (detected from stdout) or 409 (caught in
  error handler).
- Always pulls from `origin Bugfix` — hardcoded.
- Uses `NETWORK_TIMEOUT` (30s).

---

### POST /code/git/stage

Stage files for commit.

#### Request Body

| Field   | Type       | Required | Description                              |
|---------|------------|----------|------------------------------------------|
| `files` | `string[]` | No       | File paths to stage; omit for `git add -A`|

#### Response — Success (200)

```json
{
  "success": true,
  "message": "Staged 3 file(s)",
  "stagedCount": 3
}
```

#### Notes

- **Branch Guard**: `enforceBranch()` runs first.
- If `files` is omitted or empty, runs `git add -A` (stage everything).
- Each file path is validated by `sanitizePath()`.

---

### POST /code/git/unstage

Unstage files (move back to working tree).

#### Request Body

| Field   | Type       | Required | Description                                 |
|---------|------------|----------|---------------------------------------------|
| `files` | `string[]` | No       | File paths to unstage; omit for unstage all  |

#### Response — Success (200)

```json
{
  "success": true,
  "message": "Files unstaged"
}
```

---

### POST /code/git/commit

Commit staged changes with a message.

#### Request Body

| Field     | Type     | Required | Validation                  |
|-----------|----------|----------|-----------------------------|
| `message` | `string` | Yes      | Must be non-empty string    |

#### Response — Success (200)

```json
{
  "success": true,
  "hash": "abc123d",
  "message": "Committed: fix login handler",
  "output": "[Bugfix abc123d] fix login handler\n 2 files changed, 15 insertions(+), 3 deletions(-)"
}
```

#### Response — Nothing Staged (400)

```json
{
  "success": false,
  "error": "NOTHING_STAGED",
  "message": "No changes are staged for commit. Stage some files first."
}
```

#### Response — No Message (400)

```json
{
  "success": false,
  "error": "MESSAGE_REQUIRED",
  "message": "A commit message is required"
}
```

#### Notes

- **Branch Guard**: `enforceBranch()` runs first.
- Validates staged changes exist via `git diff --cached --name-only`.
- Double quotes in the message are escaped (`\"`) before passing to shell.

---

### POST /code/git/push

Push commits to remote.

#### Request Body

None.

#### Response — Success (200)

```json
{
  "success": true,
  "message": "Push successful",
  "output": "To github.com:org/silulumanzi.git\n   abc123d..def456a  Bugfix -> Bugfix"
}
```

#### Response — Everything Up-to-Date (200)

```json
{
  "success": true,
  "message": "Everything up-to-date",
  "output": "Everything up-to-date"
}
```

#### Notes

- Always pushes to `origin Bugfix` — hardcoded.
- Uses `NETWORK_TIMEOUT` (30s).

---

### POST /code/git/stash

Stash uncommitted changes.

#### Request Body

| Field     | Type     | Required | Description              |
|-----------|----------|----------|--------------------------|
| `message` | `string` | No       | Optional stash message   |

#### Response — Success (200)

```json
{
  "success": true,
  "message": "Changes stashed",
  "output": "Saved working directory and index state WIP on Bugfix: abc123d fix login"
}
```

---

### POST /code/git/stash/pop

Pop the most recent stash entry.

#### Response — Success (200)

```json
{
  "success": true,
  "message": "Stash applied and removed",
  "output": "..."
}
```

#### Response — Conflict (409)

```json
{
  "success": false,
  "error": "MERGE_CONFLICT",
  "message": "Stash pop resulted in conflicts",
  "output": "CONFLICT (content): Merge conflict in src/Login.tsx"
}
```

---

### POST /code/git/discard

Discard uncommitted changes (destructive — confirmation required on frontend).

#### Request Body

| Field   | Type       | Required | Description                               |
|---------|------------|----------|-------------------------------------------|
| `files` | `string[]` | No       | File paths to discard; omit for discard all|

#### Response — Success (200)

```json
{
  "success": true,
  "message": "Changes discarded"
}
```

#### Notes

- Runs `git checkout -- <files>` + `git clean -fd <files>`.
- For discard all: `git checkout -- .` + `git clean -fd`.
- The `clean -fd` removes untracked files and directories.
- Frontend shows SweetAlert2 confirmation before calling.

---

### POST /code/git/reset

Reset the repository to a specific commit.

#### Request Body

| Field    | Type     | Default   | Validation                         |
|----------|----------|-----------|------------------------------------|
| `target` | `string` | `HEAD`    | Commit hash or `HEAD`              |
| `mode`   | `string` | `mixed`   | `soft`, `mixed`, or `hard`         |

#### Response — Success (200)

```json
{
  "success": true,
  "message": "Reset (mixed) to HEAD"
}
```

---

### POST /code/git/resolve-conflicts

Resolve merge conflicts using ours or theirs strategy.

#### Request Body

| Field      | Type       | Required | Validation                  |
|------------|------------|----------|-----------------------------|
| `strategy` | `string`   | Yes      | `"ours"` or `"theirs"`      |
| `files`    | `string[]` | No       | Specific files; omit for all|

#### Response — Success (200)

```json
{
  "success": true,
  "message": "Resolved 3 file(s) using \"theirs\" strategy",
  "resolved": ["src/Login.tsx", "src/utils/auth.ts", "package.json"],
  "remainingConflicts": []
}
```

#### Notes

- For each conflicted file: `git checkout --<strategy> <file>` then `git add <file>`.
- Reports remaining conflicts after resolution.
- If `files` is provided, only resolves the intersection of provided files
  and actually conflicted files.

---

### POST /code/git/abort-merge

Abort an in-progress merge operation.

#### Response — Success (200)

```json
{
  "success": true,
  "message": "Merge aborted"
}
```

---

## AI Integration Endpoints

The Source Control page also uses these existing endpoints for AI chat:

| Method | Route                       | Purpose                           | File              |
|--------|-----------------------------|-----------------------------------|--------------------|
| GET    | `/v1/mobile/my-assistant`   | Load user's personal assistant    | `myAssistant.ts`   |
| POST   | `/v1/mobile/intent`         | Send message to AI pipeline       | `mobileIntent.ts`  |

See [AiBugs/ROUTES.md](../AiBugs/ROUTES.md) for detailed documentation
of these endpoints.

---

## Error Codes

All error responses include an `error` code and human-readable `message`.

| Error Code             | HTTP Status | Endpoint(s)        | Description                                |
|------------------------|-------------|--------------------|--------------------------------------------|
| `BRANCH_RESTRICTED`    | 403         | All write endpoints| Not on Bugfix branch                       |
| `UNCOMMITTED_CHANGES`  | 400         | checkout, pull     | Working tree has uncommitted changes       |
| `INVALID_BRANCH`       | 400         | checkout           | Branch name missing or invalid format      |
| `INVALID_BRANCH_NAME`  | 400         | checkout           | Branch name contains invalid characters    |
| `NOT_A_GIT_REPO`       | 500         | Any                | GIT_DIR is not a git repository            |
| `BRANCH_LIST_FAILED`   | 500         | branches           | Git branch command failed                  |
| `STATUS_FAILED`        | 500         | status             | Git status command failed                  |
| `CHECKOUT_FAILED`      | 500         | checkout           | Git checkout command failed                |
| `GIT_ERROR`            | 500         | info, log, commit  | Generic git command failure                |
| `INVALID_HASH`         | 400         | commit/:hash       | Commit hash doesn't match `[a-f0-9]{7,40}`|
| `COMMIT_NOT_FOUND`     | 404         | commit/:hash       | Commit doesn't exist in history            |
| `INVALID_PATH`         | 400         | log, history, diff | Path contains `..` or starts with `/`      |
| `PATH_REQUIRED`        | 400         | history, file-content | Path parameter missing                  |
| `DIFF_FAILED`          | 500         | diff               | Git diff command failed                    |
| `TAG_LIST_FAILED`      | 500         | tags               | Git tag command failed                     |
| `MERGE_CONFLICT`       | 200/409     | pull, stash/pop    | Merge resulted in conflicts                |
| `PULL_FAILED`          | 500         | pull               | Git pull command failed                    |
| `FETCH_FAILED`         | 500         | fetch              | Git fetch command failed                   |
| `STAGE_FAILED`         | 500         | stage              | Git add command failed                     |
| `UNSTAGE_FAILED`       | 500         | unstage            | Git reset HEAD failed                      |
| `MESSAGE_REQUIRED`     | 400         | commit             | Commit message missing or empty            |
| `NOTHING_STAGED`       | 400         | commit             | No staged changes to commit                |
| `COMMIT_FAILED`        | 500         | commit             | Git commit command failed                  |
| `PUSH_FAILED`          | 500         | push               | Git push command failed                    |
| `STASH_FAILED`         | 500         | stash              | Git stash command failed                   |
| `STASH_LIST_FAILED`    | 500         | stash/list         | Git stash list failed                      |
| `STASH_POP_FAILED`     | 500         | stash/pop          | Git stash pop failed                       |
| `DISCARD_FAILED`       | 500         | discard            | Git checkout/clean failed                  |
| `INVALID_MODE`         | 400         | reset              | Mode not `soft`, `mixed`, or `hard`        |
| `RESET_FAILED`         | 500         | reset              | Git reset command failed                   |
| `INVALID_STRATEGY`     | 400         | resolve-conflicts  | Strategy not `ours` or `theirs`            |
| `RESOLVE_FAILED`       | 500         | resolve-conflicts  | Conflict resolution failed                 |
| `ABORT_FAILED`         | 500         | abort-merge        | Git merge --abort failed                   |
| `FILE_CONTENT_FAILED`  | 500         | file-content       | Git show command failed                    |
| `CONFIG_FAILED`        | 500         | config             | Config retrieval failed                    |

---

## Conflict Detection Flow

```
POST /code/git/pull
  │
  ├── enforceBranch() → 403 if not Bugfix
  ├── Check uncommitted changes → 400 if dirty
  │
  ├── git pull origin Bugfix
  │     │
  │     ├── Success (no conflicts):
  │     │     └── 200 { success: true, filesChanged, insertions, deletions }
  │     │
  │     ├── Success but CONFLICT in stdout:
  │     │     ├── git diff --name-only --diff-filter=U (list conflicted files)
  │     │     └── 200 { success: false, error: 'MERGE_CONFLICT', conflictFiles[] }
  │     │
  │     └── Error with CONFLICT in stderr:
  │           ├── git diff --name-only --diff-filter=U (list conflicted files)
  │           └── 409 { success: false, error: 'MERGE_CONFLICT', conflictFiles[] }
  │
  ▼ Frontend (SourceControl.tsx)
  │
  ├── 200 + error='MERGE_CONFLICT':
  │     ├── setHasConflicts(true)
  │     ├── notify.error('Merge conflicts detected — see the AI assistant')
  │     └── loadAll(true) → re-fetch status
  │
  ├── 409:
  │     ├── setHasConflicts(true)
  │     ├── notify.error('Merge conflicts! Use the AI assistant…')
  │     └── loadAll(true)
  │
  └── hasConflicts=true triggers:
        ├── Red StatusHealthCard
        ├── Conflict Resolution Panel with buttons:
        │     ├── Keep Mine → POST /resolve-conflicts { strategy: 'ours' }
        │     ├── Use Theirs → POST /resolve-conflicts { strategy: 'theirs' }
        │     ├── Abort Merge → POST /abort-merge
        │     └── Ask AI → opens AiGitPanel
        └── "Clean up conflicts" quick action in AI panel
```

---

*Document generated from the Source Control module implementation.*
