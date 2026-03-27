# Source Control — Module Documentation

> **Version**: 1.0.0  
> **Last Updated**: 2026-03-17  
> **Module**: Source Control (Git Operations UI)  
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

The **Source Control** module provides a dedicated page for performing
git operations on the Silulumanzi codebase directly from the admin panel.
It is designed for non-developer users who need to manage code changes —
pulling updates, committing, pushing, resolving conflicts — without
requiring command-line knowledge.

The module is **completely independent** from the Bugs module.  Git
operations were previously embedded as text references inside the Bugs
AI Resolution tab; those references have been removed and all git
functionality now lives in this dedicated page.

The page features tight integration with the **Personal AI Assistant**
(`/v1/mobile/intent` pipeline) — users can ask the AI to pull, commit,
push, explain status, and resolve conflicts using natural language.

**Target Audience**: Staff users with developer access who may not be
command-line proficient.  All git operations are presented with plain
language labels, visual status indicators, and confirmation dialogs.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (React)                               │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    SourceControlPage                               │  │
│  │  ┌──────────────────────────────────────────────────────────────┐ │  │
│  │  │ Header (Fetch · Pull · Push · AI Assistant · Refresh)        │ │  │
│  │  └──────────────────────────────────────────────────────────────┘ │  │
│  │  ┌──────────────────────────────────────────────────────────────┐ │  │
│  │  │ BranchBanner — shows current branch + ahead/behind counts    │ │  │
│  │  │ ⚠ Warning if NOT on Bugfix branch                           │ │  │
│  │  └──────────────────────────────────────────────────────────────┘ │  │
│  │  ┌────────────────────────────┐ ┌──────────────────────────────┐ │  │
│  │  │ LEFT COLUMN                │ │ RIGHT COLUMN                 │ │  │
│  │  │ • StatusHealthCard         │ │ AI Panel (when toggled ON)   │ │  │
│  │  │ • Conflict Resolution      │ │ ├─ AiGitPanel                │ │  │
│  │  │ • Staged Files (staged)    │ │ │  ├─ Quick Actions          │ │  │
│  │  │ • Changed Files (unstaged) │ │ │  ├─ Chat Messages          │ │  │
│  │  │ • Commit Message Box       │ │ │  └─ Input Field            │ │  │
│  │  │ • Quick Actions Bar        │ │ │                            │ │  │
│  │  │   (Stash · Pop · Discard)  │ │ — OR —                      │ │  │
│  │  │                            │ │ Recent Commits (when OFF)    │ │  │
│  │  │                            │ │ └─ CommitItem list           │ │  │
│  │  └────────────────────────────┘ └──────────────────────────────┘ │  │
│  │  ┌──────────────────────────────────────────────────────────────┐ │  │
│  │  │ DiffViewer Modal — color-coded diff overlay                  │ │  │
│  │  │ Commit Detail Modal — files, stats, message                  │ │  │
│  │  └──────────────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                │                                        │
│       GitModel.ts ─────────────┤──→ GET/POST /code/git/*               │
│       api.ts ──────────────────┤──→ GET  /v1/mobile/my-assistant       │
│                                │──→ POST /v1/mobile/intent             │
└────────────────────────────────┼────────────────────────────────────────┘
                                 │
┌────────────────────────────────┼────────────────────────────────────────┐
│                          BACKEND (Express)                              │
│                                │                                        │
│  ┌─────────────────────────────▼──────────────────────────────────────┐│
│  │                       git.ts Router                                ││
│  │                                                                    ││
│  │  Constants:                                                        ││
│  │    GIT_DIR         = /var/www/code/silulumanzi                      ││
│  │    ALLOWED_BRANCH  = "Bugfix"                                      ││
│  │    EXEC_TIMEOUT    = 10000  (reads)                                ││
│  │    NETWORK_TIMEOUT = 30000  (fetch/pull/push)                      ││
│  │                                                                    ││
│  │  Helpers:                                                          ││
│  │    execGit()        — promisified exec with timeout + maxBuffer    ││
│  │    getCurrentBranch()— git rev-parse --abbrev-ref HEAD             ││
│  │    enforceBranch()  — returns 403 if not on Bugfix                 ││
│  │    sanitizeHash()   — validates hex pattern [a-f0-9]{7,40}         ││
│  │    sanitizePath()   — blocks ".." and leading "/"                  ││
│  │                                                                    ││
│  │  READ endpoints (7):                                               ││
│  │    GET /branches · /status · /info · /log · /commit/:hash          ││
│  │    GET /history · /diff · /tags · /stash/list · /file-content      ││
│  │    GET /config                                                     ││
│  │                                                                    ││
│  │  WRITE endpoints (11) — all enforce Bugfix branch:                 ││
│  │    POST /checkout · /fetch · /pull · /stage · /unstage             ││
│  │    POST /commit · /push · /stash · /stash/pop · /discard           ││
│  │    POST /reset · /resolve-conflicts · /abort-merge                 ││
│  │                                                                    ││
│  │  Middleware: requireApiKey                                         ││
│  └────────────────────────────────────────────────────────────────────┘│
│                                │                                        │
│  ┌─────────────────────────────▼──────────────────────────────────────┐│
│  │                   AI Pipeline (reused)                              ││
│  │  mobileIntent.ts → mobileAIProcessor.ts → mobileTools.ts          ││
│  │  (POST /v1/mobile/intent receives natural-language git requests)   ││
│  └────────────────────────────────────────────────────────────────────┘│
└───────────────────────────────────────────────────────────────────────┘ 
                                 │
┌────────────────────────────────▼────────────────────────────────────────┐
│                        GIT REPOSITORY                                   │
│                                                                         │
│  Path:   /var/www/code/silulumanzi                                      │
│  Branch: Bugfix (write-locked)                                          │
│  Remote: origin                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Key Concepts

### 1. Bugfix Branch Enforcement

All write operations are locked to the `Bugfix` branch.  The constant
`ALLOWED_BRANCH = 'Bugfix'` is defined in `git.ts` and enforced by the
`enforceBranch()` middleware which runs before every write endpoint.

| Gate            | Where Enforced                 | Response on Failure               |
|-----------------|--------------------------------|-----------------------------------|
| Branch check    | `enforceBranch()` in `git.ts`  | HTTP 403 `BRANCH_RESTRICTED`      |
| Checkout target | `POST /checkout` handler       | HTTP 403 `BRANCH_RESTRICTED`      |
| Push target     | Hardcoded `origin Bugfix`      | Only pushes to `origin/Bugfix`    |
| Pull source     | Hardcoded `origin Bugfix`      | Only pulls from `origin/Bugfix`   |

**Why**: The Silulumanzi codebase uses branch-based release management.
Non-developer staff should only modify the `Bugfix` branch to prevent
accidental changes to production or development branches.

### 2. Dual Timeout Strategy

Git commands use two timeout tiers:

| Tier            | Timeout | Used By                               |
|-----------------|---------|---------------------------------------|
| `EXEC_TIMEOUT`  | 10s     | Local reads: status, log, diff, etc.  |
| `NETWORK_TIMEOUT`| 30s    | Network ops: fetch, pull, push        |

### 3. Path Sanitisation

All file path parameters are validated by `sanitizePath()`:
- Blocks `..` (directory traversal)
- Blocks leading `/` (absolute paths)
- Empty paths default to repository root

Commit hashes are validated by `sanitizeHash()`:
- Must match `[a-f0-9]{7,40}` (short or full SHA)

### 4. AI Assistant Integration

The Source Control page integrates the **Mobile AI Pipeline** for
intelligent git assistance.  The `AiGitPanel` component:

1. Loads the user's personal assistant via `GET /v1/mobile/my-assistant`
2. Provides 5 quick action buttons with pre-written prompts
3. Sends messages via `POST /v1/mobile/intent`
4. Auto-refreshes the git status after every AI response

| Quick Action              | Pre-written Prompt Summary                         |
|---------------------------|----------------------------------------------------|
| 📥 Pull latest changes    | Pull from remote, explain conflicts if any         |
| 📊 Explain current status | Check git status, explain changes in simple terms  |
| 💾 Commit my changes      | Stage modified files, create descriptive commit     |
| 🚀 Push to remote         | Push commits, explain issues if any                |
| 🧹 Clean up conflicts     | Find conflicts, explain each, suggest resolution   |

### 5. Status Health Card

A visual indicator shows repository health at a glance:

| Status                | Visual                                      | Condition                    |
|-----------------------|---------------------------------------------|------------------------------|
| All Clean             | ✅ Green card                                | `clean === true`             |
| X Uncommitted Changes | ⚠️ Amber card with staged/unstaged/untracked| `totalChanges > 0`          |
| Merge Conflicts       | 🛑 Red card with warning icon               | `hasConflicts === true`      |

### 6. Two-Column Responsive Layout

The page uses a responsive grid that adapts based on the AI panel state:

| AI Panel State | Left Column       | Right Column        |
|----------------|-------------------|---------------------|
| Closed         | 2/3 width (lg)    | 1/3 — commit history|
| Open           | 3/5 width (lg)    | 2/5 — AI chat panel |

### 7. File Operations Flow

Files move through a clear staging pipeline:

```
Unstaged Changes ──(Stage)──→ Staged/Ready to Commit ──(Commit)──→ Local Commit ──(Push)──→ Remote
         │                            │
         │                            └──(Unstage)──→ back to Unstaged
         │
         └──(Discard)──→ Changes removed permanently
```

### 8. Conflict Resolution

When merge conflicts are detected (after pull or stash pop), the page
displays a dedicated conflict resolution panel with three options:

| Action        | Button Label | Git Command                                    |
|---------------|-------------|------------------------------------------------|
| Keep Mine     | Keep Mine   | `git checkout --ours <file>` + `git add <file>` |
| Use Theirs    | Use Theirs  | `git checkout --theirs <file>` + `git add <file>`|
| Abort Merge   | Abort Merge | `git merge --abort`                             |
| Ask AI        | Ask AI      | Opens AI panel with conflict resolution prompt  |

### 9. Shared AiMarkdown Component

The `AiMarkdown` component was extracted from `Bugs.tsx` into a shared
component at `components/AI/AiMarkdown.tsx`.  Both the Source Control page
and the Bugs AI Resolution tab now import from this shared location.

---

## User Guide

### Prerequisites

1. User must have **Developer** role access (route is wrapped in
   `DeveloperRoute`).
2. A **Personal AI Assistant** must be configured for AI features.

### Accessing Source Control

1. Navigate to the **Development** section in the sidebar.
2. Click **Source Control** (between Error Reports and Database).

### Understanding the Status

- **Green "All Clean!"** — No uncommitted changes.  Everything is synced.
- **Amber "X Uncommitted Changes"** — Files have been modified.  Review
  them and commit when ready.
- **Red "Merge Conflicts Detected"** — A pull or stash pop caused
  conflicts.  Resolve them before continuing.

### Common Workflows

#### Pull Latest Changes

1. Click **Fetch** to check for remote updates (safe — no merge).
2. Click **Pull** to merge remote changes into your branch.
3. If conflicts appear, use **Keep Mine**, **Use Theirs**, or **Ask AI**.

#### Stage, Commit, and Push

1. Review **Changed Files** — click the eye icon to view a diff.
2. Click **Stage All** or select individual files and click **Stage Selected**.
3. Write a **commit message** in the text area.
4. Click **Commit**.
5. Click **Push** to send commits to the remote.

#### Using the AI Assistant

1. Click the **AI Assistant** button in the header.
2. Use a **quick action** (e.g., "Pull latest changes") or type a question.
3. The AI will perform operations and explain results in plain language.
4. The page automatically refreshes after each AI response.

#### Stash and Restore

1. Click **Stash Changes** to temporarily save uncommitted work.
2. The stash count badge shows how many stashes are saved.
3. Click **Pop Stash** to restore the most recent stash.

---

## Features

| Feature                      | Description                                                | Status |
|------------------------------|------------------------------------------------------------|--------|
| Branch Status Banner         | Shows current branch with ahead/behind counts              | ✅     |
| Branch Enforcement (Bugfix)  | All write ops restricted to Bugfix branch                  | ✅     |
| Visual Status Health Card    | Green/amber/red status indicator at a glance               | ✅     |
| File Staging & Unstaging     | Stage/unstage individual files or all at once              | ✅     |
| File Selection Checkboxes    | Multi-select files for batch staging                       | ✅     |
| Commit with Message          | Write commit message, commit staged files                  | ✅     |
| Push to Remote               | Push commits to `origin/Bugfix`                            | ✅     |
| Pull from Remote             | Pull from `origin/Bugfix` with conflict detection          | ✅     |
| Fetch (no merge)             | Fetch latest refs without merging                          | ✅     |
| Diff Viewer Modal            | Color-coded unified diff for any file                      | ✅     |
| Commit History               | Scrollable list of recent commits (up to 30)               | ✅     |
| Commit Detail Modal          | View files changed, additions/deletions per commit         | ✅     |
| Merge Conflict Detection     | Auto-detects conflicts after pull or stash pop             | ✅     |
| Conflict Resolution (ours)   | Resolve all conflicts using local version                  | ✅     |
| Conflict Resolution (theirs) | Resolve all conflicts using remote version                 | ✅     |
| Abort Merge                  | Cancel in-progress merge, restore previous state           | ✅     |
| Stash Changes                | Save uncommitted work to git stash                         | ✅     |
| Pop Stash                    | Restore most recent stash with conflict handling           | ✅     |
| Discard Changes              | Permanently discard file changes (with confirmation)       | ✅     |
| AI Assistant Panel           | Full AI chat integrated with git operations                | ✅     |
| AI Quick Actions             | 5 pre-written prompts for common operations                | ✅     |
| AI Auto-Refresh              | Status refreshes after every AI response                   | ✅     |
| Shared AiMarkdown Component  | Markdown renderer shared between Bugs and Source Control   | ✅     |
| Dark Mode Support            | Full dark mode styling for all components                  | ✅     |
| Responsive Grid Layout       | Adapts column layout based on AI panel visibility          | ✅     |
| Destructive Action Dialogs   | SweetAlert2 confirmation for discard, resolve, abort       | ✅     |
| Loading & Refresh Indicators | Animated spinners, bounce effects on buttons               | ✅     |

---

## Security

| Control                      | Implementation                                        |
|------------------------------|-------------------------------------------------------|
| Authentication               | JWT token required (API key middleware on backend)    |
| Route Guard                  | `DeveloperRoute` wrapper on `/source-control` route   |
| Branch Restriction           | `enforceBranch()` blocks writes on non-Bugfix branches|
| Path Sanitisation            | `sanitizePath()` blocks `..` and absolute paths       |
| Hash Validation              | `sanitizeHash()` validates commit SHA format          |
| Commit Message Escaping      | Double quotes escaped in commit messages              |
| Destructive Confirmation     | SweetAlert2 dialogs for discard, resolve, abort merge |
| No Branch Creation           | Checkout restricted to existing `Bugfix` branch only  |
| Push Target Hardcoded        | Always pushes to `origin Bugfix`, cannot be overridden|
| Command Injection Prevention | Path parameters validated before shell interpolation  |

---

## Configuration

| Setting                    | Location                       | Default                        |
|----------------------------|--------------------------------|--------------------------------|
| Git repository path        | `git.ts` → `GIT_DIR`          | `/var/www/code/silulumanzi`    |
| Allowed branch             | `git.ts` → `ALLOWED_BRANCH`   | `Bugfix`                       |
| Read timeout               | `git.ts` → `EXEC_TIMEOUT`     | `10000` (10s)                  |
| Network timeout            | `git.ts` → `NETWORK_TIMEOUT`  | `30000` (30s)                  |
| Max buffer                 | `git.ts` → `execGit()`        | `10 MB`                        |
| Commit log limit           | `GET /log` default             | `20` (max `100`)               |
| Navigation permission      | `Layout.tsx` nav item          | `settings.view` + `developer`  |
| Route guard                | `App.tsx` route                | `DeveloperRoute`               |

---

## Troubleshooting

| Symptom                                     | Cause                                           | Fix                                                      |
|---------------------------------------------|-------------------------------------------------|----------------------------------------------------------|
| Page shows "Loading source control…" forever| Backend not restarted after git.ts changes       | Restart PM2: `pm2 restart softaware-backend`             |
| "Write operations only allowed on Bugfix"   | Currently on a different branch                  | Click the "Switch to Bugfix" button in the branch banner |
| Pull button disabled                        | Not on Bugfix branch, or `isOnAllowed` is false  | Switch to Bugfix branch first                            |
| Push button disabled with no badge          | No local commits ahead of remote                 | Make and commit changes first; push badge shows count    |
| "Repository has uncommitted changes" on pull| Unstaged/staged changes exist                    | Commit or stash changes before pulling                   |
| Diff viewer shows "No changes to show"      | File changes are only staged (or only unstaged)  | Component tries both staged and unstaged diff             |
| Conflicts detected after pull               | Remote changes conflict with local changes       | Use Keep Mine / Use Theirs / Ask AI / Abort Merge        |
| Stash pop causes conflicts                  | Stashed changes conflict with current state      | Resolve conflicts or abort and discard stash manually     |
| AI panel shows "No AI Assistant Available"   | User has no personal assistant configured         | Set up assistant in AI section                           |
| AI quick actions don't work                 | No assistant loaded, or intent endpoint failing   | Check `/v1/mobile/my-assistant` returns an assistant      |
| Status not updating after operations         | `loadAll(true)` not triggering                   | Click the manual Refresh button                          |
| "Invalid file path provided"                | File path contains `..` or starts with `/`       | Use relative paths from repository root                  |
| "Invalid commit hash format"                | Hash doesn't match `[a-f0-9]{7,40}`              | Use valid short (7+) or full (40) commit SHA             |
| Page not appearing in navigation             | `CommandLineIcon` import missing in Layout.tsx   | Verify import from `@heroicons/react/24/outline`         |
| 404 on `/source-control`                    | Route not added to App.tsx                       | Verify `<Route path="/source-control" …>` exists         |
| Network timeout on push/pull                | Slow network or large repository                  | Increase `NETWORK_TIMEOUT` in `git.ts`                   |

---

## Related Modules

| Module              | Relationship                                                |
|---------------------|-------------------------------------------------------------|
| AI Bugs             | Previously contained git text references (now removed)      |
| Mobile AI Pipeline  | Reused for AI assistant chat (intent, assistant loading)     |
| Personal Assistants | Provides assistant identity for AI Git Panel                |
| Layout              | Contains Source Control navigation item in Development section|
| AiMarkdown          | Shared component used by both Source Control and Bugs        |
| Authentication      | Provides JWT for API key–protected git endpoints             |

---

*Document generated from the Source Control module implementation.*
