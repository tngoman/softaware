# Source Control — Change Log

> **Module**: Source Control (Git Operations UI)

---

## Version History

| Version | Date       | Type    | Summary                        |
|---------|------------|---------|--------------------------------|
| 1.0.0   | 2026-03-17 | Initial | Full Source Control module      |

---

## v1.0.0 — Initial Release (2026-03-17)

### Overview

First release of the Source Control module.  Provides a full-featured Git
operations dashboard accessible to non-developer staff, with AI assistant
integration, branch enforcement, conflict resolution, and responsive UI.

### Added

#### Backend — `backend/src/routes/git.ts` (new file, ~1 153 LOC)

- **Constants & Helpers**
  - `GIT_DIR`, `ALLOWED_BRANCH`, `EXEC_TIMEOUT`, `NETWORK_TIMEOUT`
  - `execGit()` — parameterised git command runner with configurable timeout
  - `getCurrentBranch()` — utility to read current HEAD
  - `enforceBranch()` — write-operation gate for branch safety
  - `sanitizePath()` — path traversal prevention
  - `sanitizeHash()` — commit hash validation (7-40 hex chars)

- **Read Endpoints (11)**
  - `GET /git/status` — working tree and index status
  - `GET /git/branches` — local and remote branch listing
  - `GET /git/log` — commit history with configurable count
  - `GET /git/diff` — file-level diff output
  - `GET /git/info` — repository metadata (origin URL, HEAD, remotes)
  - `GET /git/config` — branch config, ahead/behind, allowed branch check
  - `GET /git/tags` — tag listing
  - `GET /git/stash/list` — stash entries
  - `GET /git/commit/:hash` — single commit detail with file list
  - `GET /git/file-content` — file content at any ref
  - `GET /git/history` — file-level commit history

- **Write Endpoints (13)**
  - `POST /git/checkout` — branch switching (Bugfix only)
  - `POST /git/pull` — pull with conflict detection
  - `POST /git/fetch` — fetch from remote
  - `POST /git/stage` — stage individual, batch, or all files
  - `POST /git/unstage` — unstage individual or all files
  - `POST /git/commit` — commit with sanitised message
  - `POST /git/push` — push to remote
  - `POST /git/stash` — stash current changes
  - `POST /git/stash/pop` — pop stash with conflict detection
  - `POST /git/discard` — discard working tree changes (irreversible)
  - `POST /git/reset` — soft/hard reset to commit
  - `POST /git/resolve-conflicts` — resolve via ours/theirs strategy
  - `POST /git/abort-merge` — abort in-progress merge

#### Frontend — `frontend/src/models/GitModel.ts` (new file, ~161 LOC)

- 24 static methods mapping 1-to-1 with backend endpoints
- Consistent error handling with `try/catch` returning `null` on failure
- Typed request parameters and optional fields

#### Frontend — `frontend/src/pages/general/SourceControl.tsx` (new file, ~1 270 LOC)

- **Sub-Components**
  - `BranchBanner` — current branch display with ahead/behind badges
  - `StatusHealthCard` — green/amber/red health indicator
  - `FileListItem` — individual file row with actions
  - `CommitSection` — staged files with commit message input
  - `AiGitPanel` — integrated AI chat with quick actions
  - `CommitHistory` — scrollable recent commit list

- **Features**
  - File staging pipeline (individual, batch, all)
  - Diff viewer modal
  - Stash management (save, pop, list)
  - Tag listing
  - Search/filter across changed files
  - Select-all / deselect-all for batch operations
  - SweetAlert2 confirmation for destructive actions
  - Dark mode support throughout
  - Responsive two-column layout with AI panel toggle

#### Shared — `frontend/src/components/AI/AiMarkdown.tsx` (new file, ~106 LOC)

- Extracted from `Bugs.tsx` inline component
- ReactMarkdown with `remarkGfm` plugin
- Tailwind-styled HTML element overrides
- Full dark mode variant support

### Modified

#### `frontend/src/pages/ai-bugs/Bugs.tsx`

- Removed inline `AiMarkdown` component (~90 lines)
- Added import of shared `AiMarkdown` from `components/AI/AiMarkdown`
- No functional changes

#### `frontend/src/components/Layout.tsx`

- Added `CodeBracketIcon` import from `@heroicons/react/24/outline`
- Added "Source Control" navigation item in sidebar with route `/source-control`
- Navigation item appears after existing entries

#### `frontend/src/App.tsx`

- Added lazy import for `SourceControl` page component
- Added `<Route path="/source-control" element={<SourceControl />} />`

---

### Known Issues

| ID  | Severity | Description                                                  |
|-----|----------|--------------------------------------------------------------|
| K-1 | Low      | `sanitizePath()` does not resolve symlinks                   |
| K-2 | Low      | Commit message escaping only handles `"` — not `` ` `` or `$()` |
| K-3 | Medium   | `MERGE_CONFLICT` returns 200 from pull but 409 from stash pop |
| K-4 | Low      | No streaming for AI responses — full response or timeout     |
| K-5 | Low      | 3 parallel API calls on every silent refresh                 |
| K-6 | Low      | Quick actions and FILE_TYPE_META are hardcoded, not configurable |

---

### Migration Notes

After deploying this version:

1. **Backend**  
   ```bash
   pm2 restart softaware-backend
   ```
   The backend automatically registers the new `/git/*` routes on startup.

2. **Frontend**  
   ```bash
   cd /var/opt/frontend && npm run build
   cp -r build/* /var/opt/html/
   ```
   The new route `/source-control` is available after rebuild.

3. **No database migrations required** — this module does not modify the
   database schema.

4. **Permissions** — Ensure the Node.js process user has read/write access
   to the repository at `/var/opt/softaware.net.za`.

5. **Git Configuration** — The `Bugfix` branch must exist on the remote
   before users can interact with Source Control.  Create it if it doesn't
   exist:
   ```bash
   cd /var/opt/softaware.net.za
   git checkout -b Bugfix
   git push -u origin Bugfix
   ```

---

### Future Enhancements

| Priority | Enhancement                                                    |
|----------|----------------------------------------------------------------|
| High     | Streaming AI responses for real-time output                    |
| High     | Per-file 3-way conflict merge viewer                           |
| Medium   | Combined `/git/refresh` endpoint to reduce parallel calls      |
| Medium   | `execFile()` with argument arrays instead of string `exec()`  |
| Medium   | Configurable `ALLOWED_BRANCH` via environment variable         |
| Low      | Branch comparison view (diff between branches)                 |
| Low      | Git blame integration for file-level author tracking           |
| Low      | Customisable quick actions per user role                       |
| Low      | Drag-and-drop file staging between sections                    |

---

*Document generated from the Source Control module implementation.*
