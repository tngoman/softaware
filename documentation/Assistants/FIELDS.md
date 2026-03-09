# Assistants Module — Database Schema

**Version:** 1.9.0  
**Last Updated:** 2026-03-08

---

## 1. Overview

| Metric | Value |
|--------|-------|
| **MySQL tables** | 4 core (assistants, ingestion_jobs, mobile_conversations, staff_software_tokens) + 1 legacy (assistant_knowledge) |
| **sqlite-vec tables** | 2 (knowledge_chunks, knowledge_vectors) |
| **Vector dimensions** | 768 (nomic-embed-text float32) |
| **sqlite-vec DB path** | `/var/opt/backend/data/vectors.db` |

---

## 2. MySQL Tables

### 2.1 `assistants` — Assistant Configuration

**Purpose:** Stores assistant identity, personality, business config, knowledge checklist, tier, tool settings, and status. Central entity of the module.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(255) | PK | Format: `assistant-{timestamp}` |
| userId | VARCHAR(36) | NULLABLE, INDEXED | Owner user ID (not yet enforced) |
| name | VARCHAR(255) | NOT NULL | Display name |
| description | TEXT | NULLABLE | Business description |
| business_type | VARCHAR(255) | NULLABLE | Persona template key (e.g., "saas", "restaurant") |
| personality | VARCHAR(50) | NULLABLE | One of: `professional`, `friendly`, `expert`, `casual` |
| primary_goal | TEXT | NULLABLE | Primary objective (used in system prompt) |
| website | VARCHAR(512) | NULLABLE | Business website URL |
| data | JSON | NULLABLE | Full assistant config as camelCase JSON (redundant with columns) |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last modification |
| tier | ENUM('free','paid') | NOT NULL, DEFAULT 'free' | Subscription tier |
| pages_indexed | INT | NOT NULL, DEFAULT 0 | Cached count of completed ingestion jobs |
| knowledge_categories | JSON | NULLABLE | Dynamic checklist: `{"checklist": [ChecklistItem...]}` |
| lead_capture_email | VARCHAR(255) | NULLABLE | Email for lead capture tool |
| webhook_url | VARCHAR(512) | NULLABLE | Webhook for tool integrations |
| enabled_tools | JSON | NULLABLE | JSON array of enabled tool names |
| status | ENUM('active','suspended','demo_expired') | NOT NULL, DEFAULT 'active' | Checked by statusCheck middleware |
| core_instructions | TEXT | NULLABLE | System-level rules hidden from GUI — managed by code/superadmin only |
| personality_flare | TEXT | NULLABLE | User-editable personality & tone text — shown in staff assistant GUI |
| is_staff_agent | TINYINT(1) | NOT NULL, DEFAULT 0 | 1 = internal staff sandbox assistant |
| custom_greeting | TEXT | NULLABLE | Custom greeting message for the assistant |
| voice_style | VARCHAR(50) | NULLABLE | Preferred TTS voice style hint for mobile |
| preferred_model | VARCHAR(100) | NULLABLE | Override Ollama model for this assistant |
| is_primary | TINYINT(1) | NOT NULL, DEFAULT 0 | 1 = default mobile assistant for this user |

**Indexes:**

| Index | Columns | Type |
|-------|---------|------|
| PRIMARY | id | PK |
| idx_created | created_at | B-Tree |
| idx_userId | userId | B-Tree |
| idx_staff_agent | userId, is_staff_agent | Composite |
| idx_user_primary | userId, is_primary | Composite |

**Relationships:**
- `ingestion_jobs.assistant_id → assistants.id` — Job association (no FK constraint)
- `assistant_knowledge.assistant_id → assistants.id` — Legacy MySQL knowledge chunks
- `knowledge_chunks.assistant_id → assistants.id` — sqlite-vec knowledge chunks (separate DB)

**Business Rules:**
- ID generated as `"assistant-" + Date.now()` for client assistants, `"staff-assistant-" + Date.now()` for staff agents
- On creation, `knowledge_categories` populated with persona-based checklist from `personaTemplates.ts`
- `data` JSON column mirrors the individual columns in camelCase — `parseAssistantRow()` reads JSON first, falls back to columns
- `pages_indexed` synced from `COUNT(*) FROM ingestion_jobs WHERE status='completed'` during ingestion
- On DELETE: `ingestion_jobs` for this assistant are also deleted; sqlite-vec vectors optionally cleared via `clearKnowledge` query param
- **Staff agents** (`is_staff_agent = 1`): Max 1 per user. `core_instructions` hidden from GUI (superadmin-only). `personality_flare` editable by staff. Tier forced to `paid`. Tools injected dynamically by role at runtime.
- **Prompt stitching at runtime:** `core_instructions` (hidden core) + `personality_flare` (editable tone) concatenated in `buildStitchedPrompt()`. If no `personality_flare` set, falls back to legacy `personality` column mapping.
- **`preferred_model`:** Overrides the default `ASSISTANT_OLLAMA_MODEL` for this assistant's conversations.

**knowledge_categories JSON Structure:**

```json
{
  "checklist": [
    {
      "key": "pricing_plans",
      "label": "Pricing Plans",
      "satisfied": true,
      "type": "url",
      "custom": false
    },
    {
      "key": "api_docs",
      "label": "API Documentation",
      "satisfied": false,
      "type": "url",
      "custom": true
    }
  ]
}
```

**Legacy Format Migration:** The `parseStoredChecklist()` function in `knowledgeCategorizer.ts` handles three formats:
1. **New:** `{"checklist": ChecklistItem[]}` — used as-is
2. **Array:** `ChecklistItem[]` — used as-is
3. **Old booleans:** `{"has_pricing": true, "has_contact_info": false, ...}` — migrated on-the-fly using `OLD_KEY_MAP`

**Example Data:**

```sql
SELECT id, name, business_type, personality, tier, pages_indexed, status FROM assistants LIMIT 2;
-- 'assistant-1709000000000', 'Acme Support', 'saas', 'professional', 'free', 5, 'active'
-- 'assistant-1709100000000', 'Joe Pizza', 'restaurant', 'friendly', 'paid', 12, 'active'
```

---

### 2.2 `ingestion_jobs` — Knowledge Ingestion Queue

**Purpose:** Tracks URL/file ingestion jobs through the pipeline: pending → processing → completed/failed. Used by the background worker for queue management.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) | PK | UUID (crypto.randomUUID) |
| assistant_id | VARCHAR(255) | NOT NULL, INDEXED | Parent assistant |
| job_type | ENUM('url','file') | NOT NULL | Ingestion source type |
| source | VARCHAR(1024) | NOT NULL | URL or original filename |
| file_content | LONGTEXT | NULLABLE | Extracted text for file jobs (cleared after processing) |
| original_content | LONGTEXT | NULLABLE | **NEW:** Original text for editing (text files only) |
| tier | ENUM('free','paid') | NOT NULL, DEFAULT 'free' | Determines queue priority |
| status | ENUM('pending','processing','completed','failed') | NOT NULL, DEFAULT 'pending' | Current pipeline stage |
| queue_position | INT | NULLABLE | Calculated position at enqueue time |
| chunks_created | INT | NOT NULL, DEFAULT 0 | Number of chunks stored on completion |
| error_message | TEXT | NULLABLE | Error details on failure |
| retry_count | INT | NOT NULL, DEFAULT 0 | Incremented on each processing attempt |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Enqueue timestamp |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last state change |

**Indexes:**

| Index | Columns | Type |
|-------|---------|------|
| PRIMARY | id | PK |
| idx_status_tier_created | status, tier, created_at | Composite (worker dequeue) |
| idx_assistant_id | assistant_id | B-Tree |

**Business Rules:**
- Worker dequeues with: `ORDER BY CASE tier WHEN 'paid' THEN 0 ELSE 1 END ASC, created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED`
- Paid jobs always process before free jobs
- Maximum 3 retry attempts — after that, status → `failed`
- `file_content` set to NULL after successful processing (saves storage)
- **`original_content` persists for editing:** Text files (no extension or .txt) save raw content here for edit modal pre-filling
- On assistant DELETE: all `ingestion_jobs` for that assistant are deleted
- `queue_position` is a snapshot at enqueue time — not dynamically updated

**original_content Usage:**
- **Populated:** For files detected as plain text (mimetype === 'text/plain' || !filename.match(/\.(pdf|docx?)$/i))
- **Null:** For URLs and binary files (PDFs, DOCs)
- **Purpose:** Enables "Edit Text" button in frontend — pre-fills modal textarea with existing content
- **Lifecycle:** Persists permanently (not cleared like file_content)

**State Transitions:**

```
pending → processing → completed
                    ↘ failed (if error or timeout)
                    ↗ pending (if retry_count < MAX_RETRIES)
```

**Example Data:**

```sql
SELECT id, assistant_id, job_type, source, tier, status, chunks_created, retry_count FROM ingestion_jobs LIMIT 3;
-- 'f47ac10b-...', 'assistant-1709000000000', 'url', 'https://acme.com/pricing', 'free', 'completed', 8, 1
-- 'a1b2c3d4-...', 'assistant-1709000000000', 'file', 'product-guide.pdf', 'free', 'completed', 15, 1
-- 'b2c3d4e5-...', 'assistant-1709100000000', 'url', 'https://joepizza.com', 'paid', 'pending', 0, 0
```

---

### 2.3 `staff_software_tokens` — External Software API Tokens ⭐ NEW (v1.4.0)

**Purpose:** Stores external software API tokens per staff member, enabling the mobile AI assistant to proxy task operations to external software portals (e.g., Silulumanzi Portal) on behalf of the staff user.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) | PK | UUID (crypto.randomUUID) |
| user_id | VARCHAR(36) | NOT NULL, INDEXED | Staff user ID |
| software_id | INT | NOT NULL | References `update_software.id` |
| software_name | VARCHAR(255) | NULLABLE | Display name (e.g., "Silulumanzi Portal") |
| api_url | VARCHAR(1000) | NOT NULL | Base URL for the external API (e.g., `https://portal.silulumanzi.com`) |
| token | TEXT | NOT NULL | External software API token (for `X-Software-Token` header) |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last modification |

**Indexes:**

| Index | Columns | Type |
|-------|---------|------|
| PRIMARY | id | PK |
| idx_sst_user_software | user_id, software_id | UNIQUE Composite |
| idx_sst_user | user_id | B-Tree |

**Business Rules:**
- One token per software per staff user (UNIQUE constraint on `user_id + software_id`)
- UPSERT pattern: POST endpoint updates existing token if `user_id + software_id` match
- Token used by `mobileActionExecutor.ts` → `getStaffSoftwareToken()` for task proxy calls
- Deletion cascades only to this table — does not affect assistant or conversation data
- No FK constraint to `update_software` — software_id is a soft reference

**Example Data:**

```sql
SELECT id, user_id, software_name, api_url FROM staff_software_tokens LIMIT 1;
-- 'a1b2c3d4-...', 'user-uuid', 'Silulumanzi Portal', 'https://portal.silulumanzi.com'
```

---

### 2.4 `mobile_conversations` — Mobile AI Conversation Sessions (updated v1.4.0)

**Purpose:** Persists multi-turn conversation sessions for the mobile AI assistant. Updated in v1.4.0 to track which assistant is being used in each conversation.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) | PK | UUID (crypto.randomUUID) |
| user_id | VARCHAR(36) | NOT NULL, INDEXED | Conversation owner |
| assistant_id | VARCHAR(255) | NULLABLE | **NEW (v1.4.0):** Selected assistant for this conversation |
| title | VARCHAR(255) | NOT NULL | Auto-generated from first message |
| last_message_at | DATETIME | NOT NULL | Last activity timestamp |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Session start |

**Notes:**
- `assistant_id` is NULL for conversations before v1.4.0 (uses system defaults)
- When `assistant_id` is set, the AI processor loads that assistant's `core_instructions` + `personality_flare` for prompt stitching
- Conversation messages stored in `mobile_messages` (same DB, separate table)

---

### 2.5 `assistant_knowledge` — Legacy MySQL Knowledge Chunks

**Purpose:** Stores ingested content chunks in MySQL alongside their embeddings (as JSON). Used by recategorization. The primary search path uses sqlite-vec (below), not this table.

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR(36) | PK, UUID |
| assistant_id | VARCHAR(255) | Parent assistant |
| job_id | VARCHAR(36) | Parent ingestion job |
| content | TEXT | Chunk text content |
| source | VARCHAR(1024) | URL or filename |
| source_type | VARCHAR(10) | `url` or `file` |
| chunk_index | INT | Position within source (0-based) |
| char_count | INT | Character count of chunk |
| embedding | JSON | 768-dim float32 vector as JSON array |
| created_at | DATETIME | Ingestion timestamp |

**Notes:**
- This table is a legacy dual-write destination — the ingestion worker writes here AND to sqlite-vec
- `embedding` stored as JSON string (not efficient for search — that's what sqlite-vec is for)
- `updateAssistantCategories()` reads from this table (up to 50 chunks) for recategorization
- Job deletion endpoint also cleans up `assistant_knowledge` rows

---

## 3. sqlite-vec Tables

Located at `/var/opt/backend/data/vectors.db`. Managed by `vectorStore.ts`.

### 3.1 `knowledge_chunks` — Chunk Metadata

**Purpose:** Stores chunk metadata alongside the vector table. Indexed by `assistant_id` and `job_id` for efficient filtering and deletion.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PK | UUID (same as MySQL assistant_knowledge.id) |
| assistant_id | TEXT | NOT NULL, INDEXED | Parent assistant |
| job_id | TEXT | NOT NULL, INDEXED | Parent ingestion job |
| content | TEXT | NOT NULL | Chunk text content |
| source | TEXT | NULLABLE | URL or filename |
| source_type | TEXT | NOT NULL | `url` or `file` |
| chunk_index | INTEGER | DEFAULT 0 | Position within source |
| char_count | INTEGER | DEFAULT 0 | Character count |
| created_at | TEXT | NOT NULL | ISO datetime string |

**Indexes:**

| Index | Column |
|-------|--------|
| idx_kc_assistant | assistant_id |
| idx_kc_job | job_id |

---

### 3.2 `knowledge_vectors` — vec0 Virtual Table

**Purpose:** Stores 768-dimensional float32 embeddings for semantic similarity search. Virtual table using sqlite-vec's `vec0` module.

| Column | Type | Description |
|--------|------|-------------|
| chunk_id | TEXT | PK, matches `knowledge_chunks.id` |
| embedding | float[768] | 768-dimensional float32 vector (nomic-embed-text) |

**Search Query (KNN):**

```sql
SELECT
  kv.chunk_id,
  kv.distance,
  kc.content,
  kc.source
FROM knowledge_vectors kv
JOIN knowledge_chunks kc ON kc.id = kv.chunk_id
WHERE kv.embedding MATCH ?      -- float32 buffer of query embedding
  AND kc.assistant_id = ?        -- filter to specific assistant
  AND k = ?                      -- top-K results
ORDER BY kv.distance ASC
```

**Notes:**
- Distance metric: L2 (Euclidean) — lower = more similar
- Query embedding passed as raw `Float32Array` buffer
- The `MATCH` + `k` syntax is sqlite-vec's KNN operator
- Filtering by `assistant_id` is done via JOIN with `knowledge_chunks` (not partition — sqlite-vec doesn't support partitions)

**Insertion:**

```typescript
// Embedding stored as raw Float32Array buffer
const buf = new Float32Array(embedding).buffer;
insertVec.run(chunkId, Buffer.from(buf));
```

---

## 4. Cross-Storage Relationships

```
MySQL                                sqlite-vec
┌───────────────┐                   ┌───────────────────┐
│  assistants   │                   │ knowledge_chunks   │
│  id ──────────┼───────────────────┼→ assistant_id      │
│               │                   │  id ───────────────┼──┐
└───────┬───────┘                   └───────────────────┘  │
        │                                                    │
        │ 1:N                                               │ 1:1
        ▼                                                    ▼
┌───────────────┐                   ┌───────────────────┐
│ingestion_jobs │                   │knowledge_vectors   │
│ assistant_id  │                   │ chunk_id ──────────┘
│ id ───────────┼───── (job_id) ───→│                    
└───────────────┘                   └───────────────────┘
        │
        │ 1:N (legacy)
        ▼
┌───────────────────┐
│assistant_knowledge │
│ (MySQL, dual-write)│
└───────────────────┘
```

---

## 5. Deletion Behavior

### 5.1 Delete Assistant (with `clearKnowledge=true`)

| Step | Table | Query |
|------|-------|-------|
| 1 | assistants | `DELETE FROM assistants WHERE id = ?` |
| 2 | ingestion_jobs | `DELETE FROM ingestion_jobs WHERE assistant_id = ?` |
| 3 | knowledge_chunks | `DELETE FROM knowledge_chunks WHERE id = ?` (per chunk via transaction) |
| 4 | knowledge_vectors | `DELETE FROM knowledge_vectors WHERE chunk_id = ?` (per chunk via transaction) |

### 5.2 Delete Assistant (with `clearKnowledge=false`)

| Step | Table | Query |
|------|-------|-------|
| 1 | assistants | `DELETE FROM assistants WHERE id = ?` |
| 2 | ingestion_jobs | `DELETE FROM ingestion_jobs WHERE assistant_id = ?` |
| — | knowledge_chunks | **NOT deleted** — orphaned but retrievable |
| — | knowledge_vectors | **NOT deleted** — orphaned but retrievable |

### 5.3 Delete Ingestion Job

| Step | Table | Query |
|------|-------|-------|
| 1 | assistant_knowledge | `DELETE FROM assistant_knowledge WHERE job_id = ?` |
| 2 | knowledge_chunks + knowledge_vectors | `vectorStore.deleteByJob(jobId)` |
| 3 | assistants | `UPDATE pages_indexed = GREATEST(0, pages_indexed - 1)` (if job was completed) |
| 4 | ingestion_jobs | `DELETE FROM ingestion_jobs WHERE id = ?` |
