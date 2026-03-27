# Source Control — Data Shapes & Constants

> **Module**: Source Control (Git Operations UI)  
> **Note**: This module does not introduce any database schema changes.  
> All data is sourced from live `git` CLI output and shaped into JSON
> by the backend.  This document catalogues those shapes, frontend
> interfaces, and the constants used throughout.

---

## Table of Contents

1. [Constants](#1-constants)  
2. [Backend Response Shapes](#2-backend-response-shapes)  
3. [Frontend TypeScript Interfaces](#3-frontend-typescript-interfaces)  
4. [File Type Metadata Map](#4-file-type-metadata-map)  
5. [Quick Action Definitions](#5-quick-action-definitions)  
6. [Status Codes & Meanings](#6-status-codes--meanings)  

---

## 1. Constants

### Backend Constants (`git.ts`)

| Constant          | Value                          | Purpose                                     |
|-------------------|--------------------------------|---------------------------------------------|
| `GIT_DIR`         | `/var/opt/softaware.net.za`    | Repository root used as `cwd` for all git commands |
| `ALLOWED_BRANCH`  | `'Bugfix'`                     | Only branch where write operations are permitted |
| `EXEC_TIMEOUT`    | `10000` (10 s)                 | Timeout for local git commands              |
| `NETWORK_TIMEOUT` | `30000` (30 s)                 | Timeout for network git commands (push/pull/fetch) |
| `maxBuffer`       | `1024 * 1024 * 10` (10 MB)     | Maximum stdout/stderr buffer for `execAsync` |

### Frontend Constants (`SourceControl.tsx`)

| Constant / Variable      | Type                        | Purpose                                |
|---------------------------|-----------------------------|----------------------------------------|
| `FILE_TYPE_META`          | `Record<string, FileMeta>`  | Maps file extensions to icons and labels |
| `quickActions`            | `QuickAction[]`             | Pre-built AI prompt buttons            |
| `INITIAL_LOG_COUNT`       | `30`                        | Number of commits to load initially    |

---

## 2. Backend Response Shapes

### GET /git/config

```jsonc
{
  "success": true,
  "currentBranch": "Bugfix",
  "allowedBranch": "Bugfix",
  "isOnAllowedBranch": true,
  "ahead": 0,
  "behind": 2,
  "remote": "origin",
  "lastFetch": "2026-03-17T09:00:00.000Z"
}
```

### GET /git/status

```jsonc
{
  "success": true,
  "clean": false,
  "files": [
    {
      "path": "src/routes/git.ts",
      "status": "M",       // git status short code
      "staged": false,
      "working": "M"
    }
  ],
  "staged": [
    {
      "path": "src/models/User.ts",
      "status": "M",
      "staged": true,
      "working": " "
    }
  ],
  "branch": "Bugfix",
  "tracking": "origin/Bugfix",
  "ahead": 1,
  "behind": 0
}
```

### GET /git/log?count=N

```jsonc
{
  "success": true,
  "commits": [
    {
      "hash": "a1b2c3d",
      "author": "developer@example.com",
      "date": "2026-03-17",
      "message": "fix: resolve login timeout"
    }
  ]
}
```

### GET /git/branches

```jsonc
{
  "success": true,
  "branches": [
    {
      "name": "Bugfix",
      "current": true,
      "remote": "origin/Bugfix"
    },
    {
      "name": "main",
      "current": false,
      "remote": "origin/main"
    }
  ]
}
```

### GET /git/diff?file=path

```jsonc
{
  "success": true,
  "diff": "diff --git a/file.ts b/file.ts\n--- a/file.ts\n+++ b/file.ts\n@@ -1,3 +1,4 @@\n line1\n+new line\n line2"
}
```

### GET /git/commit/:hash

```jsonc
{
  "success": true,
  "hash": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
  "author": "developer@example.com",
  "date": "2026-03-17T10:30:00+02:00",
  "message": "fix: resolve login timeout\n\nLong description here.",
  "files": [
    { "path": "src/routes/auth.ts", "status": "M" }
  ]
}
```

### GET /git/tags

```jsonc
{
  "success": true,
  "tags": ["v1.0.0", "v1.1.0", "v2.0.0"]
}
```

### GET /git/stash/list

```jsonc
{
  "success": true,
  "stashes": [
    {
      "index": 0,
      "message": "WIP on Bugfix: a1b2c3d fix: resolve login"
    }
  ]
}
```

### GET /git/file-content?file=path&ref=HEAD

```jsonc
{
  "success": true,
  "content": "import express from 'express';\n..."
}
```

### Error Response (all endpoints)

```jsonc
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable description of the error."
}
```

### Conflict Response

```jsonc
{
  "success": false,
  "error": "MERGE_CONFLICT",
  "conflictFiles": ["src/routes/auth.ts", "src/models/User.ts"],
  "message": "Merge conflicts detected in 2 files."
}
```

---

## 3. Frontend TypeScript Interfaces

### GitFile

```typescript
interface GitFile {
  path: string;       // Relative path from repo root
  status: string;     // Short status code: M, A, D, R, U, ?, !
  staged: boolean;    // Whether the file is in the staging area
  working: string;    // Working tree status character
}
```

### CommitInfo

```typescript
interface CommitInfo {
  hash: string;       // Abbreviated (7-char) or full (40-char) SHA
  author: string;     // Author email
  date: string;       // ISO date string
  message: string;    // First line of commit message
}
```

### BranchInfo

```typescript
interface BranchInfo {
  name: string;       // Branch name
  current: boolean;   // Whether this is the checked-out branch
  remote: string;     // Tracking remote reference (e.g., "origin/Bugfix")
}
```

### AiMessage

```typescript
interface AiMessage {
  role: 'user' | 'assistant';
  content: string;    // Markdown-formatted text
}
```

### GitConfig (derived from /git/config response)

```typescript
interface GitConfig {
  currentBranch: string;
  allowedBranch: string;
  isOnAllowedBranch: boolean;
  ahead: number;
  behind: number;
  remote: string;
  lastFetch: string;
}
```

### StashEntry

```typescript
interface StashEntry {
  index: number;      // Stash index (0 = most recent)
  message: string;    // Stash description from git
}
```

---

## 4. File Type Metadata Map

The `FILE_TYPE_META` constant maps file extensions to display metadata
for the file list.  Each entry provides an emoji icon and a human-readable
type label.

| Extension     | Icon | Label        |
|---------------|------|--------------|
| `.ts`         | 📘   | TypeScript   |
| `.tsx`        | ⚛️   | React TSX    |
| `.js`         | 📒   | JavaScript   |
| `.jsx`        | ⚛️   | React JSX    |
| `.json`       | 📋   | JSON         |
| `.css`        | 🎨   | CSS          |
| `.scss`       | 🎨   | SCSS         |
| `.html`       | 🌐   | HTML         |
| `.md`         | 📝   | Markdown     |
| `.sql`        | 🗄️   | SQL          |
| `.sh`         | 🐚   | Shell        |
| `.env`        | 🔒   | Environment  |
| `.yml`        | ⚙️   | YAML         |
| `.yaml`       | ⚙️   | YAML         |
| `.php`        | 🐘   | PHP          |
| `.py`         | 🐍   | Python       |
| `.png`        | 🖼️   | Image        |
| `.jpg`        | 🖼️   | Image        |
| `.svg`        | 🖼️   | SVG          |
| `.lock`       | 🔐   | Lock File    |
| *(default)*   | 📄   | File         |

---

## 5. Quick Action Definitions

| Label                       | Pre-built Prompt Summary                                                |
|-----------------------------|-------------------------------------------------------------------------|
| 📥 Pull latest changes      | Pull from remote, handle conflicts if any                               |
| 📊 Explain current status   | Run `git status` and explain in plain language                          |
| 💾 Commit my changes        | Stage all, generate descriptive commit message, commit                  |
| 🚀 Push to remote           | Push commits, explain issues if any                                     |
| 🧹 Clean up conflicts       | List conflict files, explain each conflict, suggest safest resolution   |

---

## 6. Status Codes & Meanings

Git short-format status codes as used in `GitFile.status` and
`GitFile.working`:

| Code | Meaning              | Display Colour | Icon   |
|------|----------------------|----------------|--------|
| `M`  | Modified             | Amber          | ✏️     |
| `A`  | Added (new file)     | Green          | ➕     |
| `D`  | Deleted              | Red            | 🗑️     |
| `R`  | Renamed              | Blue           | ➡️     |
| `U`  | Unmerged (conflict)  | Red            | ⚠️     |
| `?`  | Untracked            | Grey           | ❓     |
| `!`  | Ignored              | Grey           | 🚫     |
| ` `  | Unmodified           | —              | —      |

The `staged` field determines whether the status applies to the index
(staging area) or the working tree.

---

*Document generated from the Source Control module implementation.*
