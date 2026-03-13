# Bugs Module - Database Fields

**Version:** 1.3.0  
**Last Updated:** 2026-03-11

---

## 1. Overview

The Bugs module operates on three dedicated tables created by migration 024. No FK relationships to the `users` table exist — user references are stored as denormalised IDs and names.

| Table | Module Role | Operations |
|-------|------------|------------|
| `bugs` | Primary | CRUD |
| `bug_comments` | Child (CASCADE) | Create / Read / Delete |
| `bug_attachments` | Child (CASCADE) | Create / Read / Delete |
| `local_tasks` | Related | Read / Create (on convert) |
| `update_software` | Related | Read (software dropdown) |
| `users` + `user_roles` + `roles` | Related | Read (admin lookup for notifications) |
| `notifications` | Related | Create (via notificationService) |

---

## 2. Primary Table: `bugs`

```sql
CREATE TABLE bugs (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  -- Core fields
  title               VARCHAR(500)    NOT NULL,
  description         TEXT            NULL,
  current_behaviour   TEXT            NULL,
  expected_behaviour  TEXT            NULL,
  reporter_name       VARCHAR(200)    NOT NULL,

  -- Software association
  software_id         INT UNSIGNED    NULL,
  software_name       VARCHAR(200)    NULL,

  -- Status & workflow
  status              VARCHAR(50)     NOT NULL DEFAULT 'open',
  severity            VARCHAR(30)     NOT NULL DEFAULT 'medium',
  workflow_phase      VARCHAR(100)    NOT NULL DEFAULT 'intake',

  -- Assignment
  assigned_to         INT UNSIGNED    NULL,
  assigned_to_name    VARCHAR(200)    NULL,
  created_by          VARCHAR(36)     NULL,
  created_by_name     VARCHAR(200)    NULL,

  -- Task association
  linked_task_id      BIGINT UNSIGNED NULL,
  converted_from_task TINYINT(1)      NOT NULL DEFAULT 0,
  converted_to_task   BIGINT UNSIGNED NULL,

  -- Resolution
  resolution_notes    TEXT            NULL,
  resolved_at         DATETIME        NULL,
  resolved_by         VARCHAR(200)    NULL,

  -- Timestamps
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Indexes
  KEY idx_bugs_status (status),
  KEY idx_bugs_severity (severity),
  KEY idx_bugs_workflow (workflow_phase),
  KEY idx_bugs_software (software_id),
  KEY idx_bugs_assigned (assigned_to),
  KEY idx_bugs_linked_task (linked_task_id),
  KEY idx_bugs_created (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Column Details

| Column | Type | Constraints | Module Usage |
|--------|------|-------------|-------------|
| `id` | BIGINT UNSIGNED | PK, AUTO_INCREMENT | Lookup key, referenced by comments & attachments |
| `title` | VARCHAR(500) | NOT NULL | Display in list + detail, required on create |
| `description` | TEXT | NULL | Rich-text, displayed in detail dialog |
| `current_behaviour` | TEXT | NULL | "What happens now" field in bug form |
| `expected_behaviour` | TEXT | NULL | "What should happen" field in bug form |
| `reporter_name` | VARCHAR(200) | NOT NULL | Free-text name (not a FK). If email-shaped, used for email notifications |
| `software_id` | INT UNSIGNED | NULL | FK to `update_software.id` — filters bugs by software |
| `software_name` | VARCHAR(200) | NULL | Denormalised for display without JOIN |
| `status` | VARCHAR(50) | NOT NULL, DEFAULT 'open' | `open` \| `in-progress` \| `pending-qa` \| `resolved` \| `closed` \| `reopened` |
| `severity` | VARCHAR(30) | NOT NULL, DEFAULT 'medium' | `critical` \| `high` \| `medium` \| `low` |
| `workflow_phase` | VARCHAR(100) | NOT NULL, DEFAULT 'intake' | `intake` \| `qa` \| `development` |
| `assigned_to` | INT UNSIGNED | NULL | User ID of assignee — used for notifications |
| `assigned_to_name` | VARCHAR(200) | NULL | Denormalised display name |
| `created_by` | VARCHAR(36) | NULL | User ID from JWT (null if unauthenticated) — used for notifications |
| `created_by_name` | VARCHAR(200) | NULL | Denormalised creator name |
| `linked_task_id` | BIGINT UNSIGNED | NULL | FK to `local_tasks.id` — optional task link |
| `converted_from_task` | TINYINT(1) | NOT NULL, DEFAULT 0 | `1` if created via "Convert Task → Bug" |
| `converted_to_task` | BIGINT UNSIGNED | NULL | `local_tasks.id` if converted via "Convert Bug → Task" |
| `resolution_notes` | TEXT | NULL | Notes added when bug is resolved |
| `resolved_at` | DATETIME | NULL | Timestamp when status set to resolved |
| `resolved_by` | VARCHAR(200) | NULL | Name of person who resolved |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| `updated_at` | DATETIME | NOT NULL, AUTO UPDATE | Last modification timestamp |

### Status Values

| Value | Colour (Frontend) | Meaning |
|-------|-------------------|---------|
| `open` | Blue | Newly reported, untriaged |
| `in-progress` | Amber | Actively being worked on |
| `pending-qa` | Indigo | Awaiting QA/QS verification |
| `resolved` | Emerald | Fix confirmed |
| `closed` | Gray | Done, archived |
| `reopened` | Purple | Issue recurred after closure |

### Severity Values

| Value | Colour (Frontend) | Meaning |
|-------|-------------------|---------|
| `critical` | Red | System down / data loss |
| `high` | Orange | Major feature broken |
| `medium` | Yellow | Non-critical issue |
| `low` | Green | Cosmetic / minor |

### Workflow Phase Values

| Value | Label | Auto-Status |
|-------|-------|-------------|
| `intake` | Intake | `open` |
| `qa` | QA | `in-progress` |
| `development` | Development | `in-progress` |

---

## 3. Child Table: `bug_comments`

```sql
CREATE TABLE bug_comments (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  bug_id              BIGINT UNSIGNED NOT NULL,
  author_name         VARCHAR(200)    NOT NULL,
  author_id           VARCHAR(36)     NULL,
  content             TEXT            NOT NULL,
  is_internal         TINYINT(1)      NOT NULL DEFAULT 0,
  comment_type        VARCHAR(50)     NOT NULL DEFAULT 'comment',

  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (bug_id) REFERENCES bugs(id) ON DELETE CASCADE,
  KEY idx_bugcomments_bug (bug_id),
  KEY idx_bugcomments_created (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

| Column | Type | Constraints | Module Usage |
|--------|------|-------------|-------------|
| `id` | BIGINT UNSIGNED | PK, AUTO_INCREMENT | Lookup key |
| `bug_id` | BIGINT UNSIGNED | FK → bugs(id) CASCADE | Parent bug reference |
| `author_name` | VARCHAR(200) | NOT NULL | Display name of commenter |
| `author_id` | VARCHAR(36) | NULL | User ID from JWT (null if unauthenticated) |
| `content` | TEXT | NOT NULL | Comment body (supports HTML) |
| `is_internal` | TINYINT(1) | NOT NULL, DEFAULT 0 | `1` = team-only note, `0` = visible to reporter |
| `comment_type` | VARCHAR(50) | NOT NULL, DEFAULT 'comment' | `comment` \| `workflow_change` \| `status_change` \| `resolution` |
| `created_at` | DATETIME | NOT NULL | Creation timestamp |
| `updated_at` | DATETIME | NOT NULL | Last edit timestamp |

### Comment Types

| Type | Source | When Created |
|------|--------|-------------|
| `comment` | User-entered | Manual comment via dialog |
| `workflow_change` | System auto-generated | Phase transition (e.g., "Workflow phase changed: intake → qa") |
| `status_change` | System auto-generated | Bug creation, assignment change |
| `resolution` | System auto-generated | Bug resolved/closed |

---

## 4. Child Table: `bug_attachments`

```sql
CREATE TABLE bug_attachments (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  bug_id              BIGINT UNSIGNED NOT NULL,
  filename            VARCHAR(500)    NOT NULL,
  original_name       VARCHAR(500)    NOT NULL,
  mime_type           VARCHAR(100)    NULL,
  file_size           INT UNSIGNED    NULL,
  file_path           VARCHAR(1000)   NOT NULL,
  uploaded_by         VARCHAR(200)    NULL,
  uploaded_by_id      VARCHAR(36)     NULL,

  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (bug_id) REFERENCES bugs(id) ON DELETE CASCADE,
  KEY idx_bugattachments_bug (bug_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

| Column | Type | Constraints | Module Usage |
|--------|------|-------------|-------------|
| `id` | BIGINT UNSIGNED | PK, AUTO_INCREMENT | Lookup key, used in download URL |
| `bug_id` | BIGINT UNSIGNED | FK → bugs(id) CASCADE | Parent bug reference |
| `filename` | VARCHAR(500) | NOT NULL | Stored filename on disk (e.g., `bug-1710234567-123456789.png`) |
| `original_name` | VARCHAR(500) | NOT NULL | User's original filename (used in download Content-Disposition) |
| `mime_type` | VARCHAR(100) | NULL | MIME type (e.g., `image/png`, `application/pdf`) |
| `file_size` | INT UNSIGNED | NULL | Size in bytes |
| `file_path` | VARCHAR(1000) | NOT NULL | Relative path (e.g., `uploads/bugs/bug-1710234567-123456789.png`) |
| `uploaded_by` | VARCHAR(200) | NULL | Uploader display name |
| `uploaded_by_id` | VARCHAR(36) | NULL | Uploader user ID from JWT |
| `created_at` | DATETIME | NOT NULL | Upload timestamp |

**File storage:** Attachments are stored on disk at `backend/uploads/bugs/`. The `file_path` column stores the relative path from the backend root. On bug deletion, CASCADE removes the DB row and the route handler deletes files from disk.

---

## 5. Frontend ↔ Backend Field Mapping

| Frontend (Bug interface) | Backend DB Column | Notes |
|--------------------------|-------------------|-------|
| `id` | `id` | Direct |
| `title` | `title` | Direct |
| `description` | `description` | Direct (nullable) |
| `current_behaviour` | `current_behaviour` | Direct (nullable) |
| `expected_behaviour` | `expected_behaviour` | Direct (nullable) |
| `reporter_name` | `reporter_name` | Free text, not a FK |
| `software_id` | `software_id` | Direct (nullable) |
| `software_name` | `software_name` | Denormalised |
| `status` | `status` | 6-value enum string |
| `severity` | `severity` | 4-value enum string |
| `workflow_phase` | `workflow_phase` | 3-value enum string |
| `assigned_to` | `assigned_to` | User ID (nullable) |
| `assigned_to_name` | `assigned_to_name` | Denormalised |
| `created_by` | `created_by` | User ID from JWT |
| `created_by_name` | `created_by_name` | Denormalised |
| `comment_count` | Computed subquery | `(SELECT COUNT(*) FROM bug_comments WHERE bug_id = b.id)` |
| `attachment_count` | Computed subquery | `(SELECT COUNT(*) FROM bug_attachments WHERE bug_id = b.id)` |
| `last_comment` | Computed subquery | Latest comment content |
| `comments[]` | Separate query | Only on detail (`GET /:id`) |
| `attachments[]` | Separate query | Only on detail (`GET /:id`) |
| `linked_task` | Separate query | Only on detail, fetched from `local_tasks` |

---

## 6. Indexes

| Index Name | Column(s) | Purpose |
|------------|-----------|---------|
| `idx_bugs_status` | `status` | Filter by status |
| `idx_bugs_severity` | `severity` | Filter by severity |
| `idx_bugs_workflow` | `workflow_phase` | Filter by phase |
| `idx_bugs_software` | `software_id` | Filter by software |
| `idx_bugs_assigned` | `assigned_to` | Filter by assignee |
| `idx_bugs_linked_task` | `linked_task_id` | Task association lookup |
| `idx_bugs_created` | `created_at DESC` | Default sort order |
| `idx_bugcomments_bug` | `bug_id` | Comment list per bug |
| `idx_bugcomments_created` | `created_at DESC` | Comment ordering |
| `idx_bugattachments_bug` | `bug_id` | Attachment list per bug |
