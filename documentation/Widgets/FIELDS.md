# Widgets Module — Database Schema

**Version:** 1.0.0  
**Last Updated:** 2026-03-10

---

## 1. Overview

| Metric | Value |
|--------|-------|
| **MySQL tables** | 7 data tables + 1 config table |
| **Embedding storage** | MySQL JSON column (`document_embeddings.embedding`) |
| **Vector dimensions** | 768 (nomic-embed-text float32) |
| **Embedding model** | `nomic-embed-text` (local Ollama) |

> **Note:** Unlike the Assistants module (which uses sqlite-vec for vector search), the Widgets module stores embeddings as JSON in MySQL and performs cosine similarity in application code. This is a simpler but less performant approach.

---

## 2. MySQL Tables

### 2.1 `widget_clients` — Widget Client Configuration

**Purpose:** Stores widget client identity, subscription tier, billing cycle, usage counters, tone/branding settings, lead capture config, and external API credentials. Central entity of the Widgets module.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) | PK | UUID v4 |
| user_id | VARCHAR(36) | NULLABLE, INDEXED | Owner user ID (links to `users.id`) |
| website_url | VARCHAR(512) | NOT NULL | Client's website URL |
| message_count | INT | DEFAULT 0 | Lifetime message counter |
| max_messages | INT | DEFAULT 500 | Legacy per-client message limit |
| max_pages | INT | DEFAULT 50 | Maximum pages that can be ingested |
| pages_ingested | INT | DEFAULT 0 | Current count of ingested pages |
| widget_color | VARCHAR(7) | DEFAULT '#0044cc' | Widget primary color (hex) |
| status | ENUM('active','suspended','demo_expired','upgraded') | NOT NULL, DEFAULT 'active', INDEXED | Widget operational status |
| subscription_tier | ENUM('free','starter','advanced','enterprise') | DEFAULT 'free', INDEXED | Current subscription tier |
| monthly_price | DECIMAL(10,2) | DEFAULT 0.00 | Monthly subscription price in ZAR |
| billing_cycle_start | DATE | NULLABLE, INDEXED | Current billing cycle start date |
| billing_cycle_end | DATE | NULLABLE | Current billing cycle end date |
| messages_this_cycle | INT | DEFAULT 0 | Messages used in current billing cycle |
| branding_enabled | TINYINT(1) | DEFAULT 1 | 1 = show "Powered by Soft Aware" footer |
| tone_preset | VARCHAR(50) | DEFAULT 'professional' | Active tone preset name |
| custom_tone_instructions | TEXT | NULLABLE | Free-form tone override (Advanced/Enterprise) |
| lead_capture_enabled | TINYINT(1) | DEFAULT 0 | 1 = enable AI lead detection |
| lead_notification_email | VARCHAR(255) | NULLABLE | Email for lead notifications (overrides user email) |
| preferred_model | VARCHAR(50) | DEFAULT 'qwen2.5:3b' | Preferred Ollama model for this client |
| external_api_provider | VARCHAR(50) | NULLABLE | External LLM provider ('gemini', 'claude') |
| external_api_key_encrypted | TEXT | NULLABLE | Encrypted API key for external provider |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| last_active | DATETIME | DEFAULT CURRENT_TIMESTAMP, INDEXED | Last chat activity |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last modification |

**Indexes:**

| Index | Columns | Type |
|-------|---------|------|
| PRIMARY | id | PK |
| idx_user_id | user_id | B-Tree |
| idx_status | status | B-Tree |
| idx_subscription_tier | subscription_tier | B-Tree |
| idx_billing_cycle_start | billing_cycle_start | B-Tree |
| idx_last_active | last_active | B-Tree |

**Relationships:**
- `widget_clients.user_id → users.id` — Owner association
- `document_metadata.client_id → widget_clients.id` — Ingested content
- `document_embeddings.document_id → document_metadata.id` — Vector embeddings
- `crawl_queue.client_id → widget_clients.id` — Crawl jobs
- `chat_messages.client_id → widget_clients.id` — Chat history
- `widget_leads_captured.client_id → widget_clients.id` — Captured leads
- `widget_usage_logs.client_id → widget_clients.id` — Usage metrics
- `generated_sites.widget_client_id → widget_clients.id` — Site Builder association

**Business Rules:**
- ID generated as UUID v4 via `crypto.randomUUID()`
- `pages_ingested` incremented on successful URL crawl or file upload, decremented on source deletion
- `messages_this_cycle` reset to 0 when `billing_cycle_end < CURDATE()`
- `external_api_key_encrypted` encrypted via `cryptoUtils.encryptPassword()`; decrypted only in-memory during API calls
- `status = 'suspended'` blocks all chat and ingest operations via `checkWidgetStatus` middleware
- `branding_enabled` controls "Powered by Soft Aware" footer visibility on widget (free = 1, paid = 0)
- Tone control (`tone_preset` + `custom_tone_instructions`) only injected into system prompt for Advanced/Enterprise tiers

---

### 2.2 `document_metadata` — Knowledge Base Chunks

**Purpose:** Stores chunked text content from crawled URLs and uploaded files. Each chunk is independently searchable via its associated embedding.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) | PK | UUID v4 |
| client_id | VARCHAR(36) | NOT NULL, INDEXED | Widget client reference |
| content | TEXT | NOT NULL | Chunk text content |
| source_url | VARCHAR(1024) | NULLABLE, INDEXED | Source URL or filename |
| source_type | ENUM('website','pdf','txt','doc') | NOT NULL, INDEXED | Content origin type |
| chunk_index | INT | NOT NULL | Position within source (0-based) |
| char_count | INT | NOT NULL | Character count of chunk |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Chunk creation time |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last update |

**Indexes:**

| Index | Columns | Type |
|-------|---------|------|
| PRIMARY | id | PK |
| idx_client_id | client_id | B-Tree |
| idx_source_url | source_url | B-Tree |
| idx_source_type | source_type | B-Tree |

**Business Rules:**
- Chunks are typically 1000 chars with 200-char overlap
- Minimum chunk size is 50 chars (smaller chunks filtered out)
- Chunks from same source are ordered by `chunk_index`
- Cascade deleted when source is deleted via `deleteDocumentsBySource()`

---

### 2.3 `document_embeddings` — Vector Embeddings

**Purpose:** Stores 768-dimensional vector embeddings for each document chunk, used for cosine similarity search during RAG retrieval.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) | PK | UUID v4 |
| document_id | VARCHAR(36) | NOT NULL, INDEXED | FK to `document_metadata.id` |
| embedding | JSON | NOT NULL | 768-dim float32 vector as JSON array |
| embedding_model | VARCHAR(64) | DEFAULT 'nomic-embed-text' | Model used for embedding |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Generation time |

**Indexes:**

| Index | Columns | Type |
|-------|---------|------|
| PRIMARY | id | PK |
| idx_document_id | document_id | B-Tree |

**Business Rules:**
- One embedding per document chunk (1:1 with `document_metadata`)
- Generated via local Ollama `nomic-embed-text` model
- Stored as JSON array (not binary) — parsed in application code for similarity calculation
- Cascade deleted with their associated document chunk

---

### 2.4 `crawl_queue` — URL Crawl Jobs

**Purpose:** Persistent queue for URL crawl jobs with retry tracking and status management.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) | PK | UUID v4 |
| client_id | VARCHAR(36) | NOT NULL, INDEXED | Widget client reference |
| url | VARCHAR(1024) | NOT NULL | Target URL to crawl |
| status | ENUM('pending','processing','completed','failed') | DEFAULT 'pending', INDEXED | Job status |
| priority | INT | DEFAULT 0, INDEXED | Queue priority (higher = sooner) |
| retry_count | INT | DEFAULT 0 | Current retry attempt |
| max_retries | INT | DEFAULT 3 | Maximum allowed retries |
| error_message | TEXT | NULLABLE | Error details on failure |
| started_at | DATETIME | NULLABLE | Processing start time |
| completed_at | DATETIME | NULLABLE | Completion time |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP, INDEXED | Enqueue time |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last status change |

**Indexes:**

| Index | Columns | Type |
|-------|---------|------|
| PRIMARY | id | PK |
| idx_client_id | client_id | B-Tree |
| idx_status | status | B-Tree |
| idx_priority | priority | B-Tree |
| idx_created_at | created_at | B-Tree |

**Business Rules:**
- Jobs dequeue by `created_at ASC` where `status = 'pending'` and `retries < 3`
- Failed jobs increment `retry_count`; stop retrying at `max_retries`
- `reEnqueueCompleted()` resets completed jobs to pending (for daily recrawl feature)
- Currently processed synchronously (no background worker) — crawl happens inline during POST

---

### 2.5 `chat_messages` — Chat History

**Purpose:** Stores all chat messages exchanged between visitors and widget AI assistants.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) | PK | UUID v4 |
| client_id | VARCHAR(36) | NOT NULL, INDEXED | Widget client reference |
| session_id | VARCHAR(64) | NULLABLE, INDEXED | Browser session identifier |
| role | ENUM('user','assistant') | NOT NULL | Message author |
| content | TEXT | NOT NULL | Message text |
| model | VARCHAR(64) | NULLABLE | AI model used for response |
| tokens_used | INT | NULLABLE | Token count for response |
| response_time_ms | INT | NULLABLE | Response latency in ms |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP, INDEXED | Message timestamp |

**Indexes:**

| Index | Columns | Type |
|-------|---------|------|
| PRIMARY | id | PK |
| idx_client_id | client_id | B-Tree |
| idx_session_id | session_id | B-Tree |
| idx_created_at | created_at | B-Tree |

**Business Rules:**
- Both user and assistant messages are logged for each conversation
- `session_id` can group messages into conversations (optional, visitor-generated)
- Used for analytics and conversation history retrieval
- Ordered by `created_at DESC` with LIMIT for pagination

---

### 2.6 `widget_leads_captured` — Captured Visitor Leads

**Purpose:** Stores visitor contact information detected and captured by the AI during chat conversations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) | PK | UUID v4 |
| client_id | VARCHAR(36) | NOT NULL, INDEXED | Widget client reference |
| visitor_email | VARCHAR(255) | NOT NULL | Visitor's email address |
| visitor_name | VARCHAR(255) | NULLABLE | Visitor's name (if provided) |
| visitor_message | TEXT | NULLABLE | Summary of visitor's interest |
| chat_context | TEXT | NULLABLE | Last 5 conversation messages (JSON) |
| captured_at | DATETIME | DEFAULT CURRENT_TIMESTAMP, INDEXED | Capture timestamp |
| notification_sent | TINYINT(1) | DEFAULT 0 | 1 = email notification sent |

**Indexes:**

| Index | Columns | Type |
|-------|---------|------|
| PRIMARY | id | PK |
| idx_client_id | client_id | B-Tree |
| idx_captured_at | captured_at | B-Tree |

**Business Rules:**
- Created when AI response contains `{"action": "capture_lead"}` JSON block
- `chat_context` stores stringified JSON of last 5 messages for context
- `notification_sent` updated after successful SMTP delivery
- Lead notification includes branded HTML email with "Reply to Lead" CTA
- Only captured for Advanced/Enterprise clients with `lead_capture_enabled = 1`

---

### 2.7 `widget_usage_logs` — Usage Metrics

**Purpose:** Tracks per-billing-cycle message counts for analytics and capacity planning.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) | PK | UUID v4 |
| client_id | VARCHAR(36) | NOT NULL, INDEXED | Widget client reference |
| message_count | INT | DEFAULT 1 | Messages in this log entry |
| cycle_start | DATE | NOT NULL | Billing cycle start date |
| cycle_end | DATE | NOT NULL | Billing cycle end date |
| logged_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Log timestamp |

**Indexes:**

| Index | Columns | Type |
|-------|---------|------|
| PRIMARY | id | PK |
| idx_client_id | client_id | B-Tree |

**Business Rules:**
- Uses `ON DUPLICATE KEY UPDATE message_count = message_count + 1` for atomic increments
- Grouped by `cycle_start, cycle_end` for monthly reporting
- `getUsageStats()` aggregates over configurable months window (default 3)
- Supports `active_days` metric (COUNT DISTINCT DATE)

---

### 2.8 `subscription_tier_limits` — Tier Configuration

**Purpose:** Defines feature flags and limits for each subscription tier. Referenced by usage tracking middleware.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| tier | ENUM('free','starter','advanced','enterprise') | PK | Tier identifier |
| max_pages | INT | NOT NULL | Maximum pages that can be ingested |
| max_messages_per_month | INT | NOT NULL | Monthly message limit |
| branding_removal | TINYINT(1) | DEFAULT 0 | 1 = "Powered by" footer hidden |
| lead_capture | TINYINT(1) | DEFAULT 0 | 1 = lead capture available |
| tone_control | TINYINT(1) | DEFAULT 0 | 1 = tone presets/custom instructions |
| priority_support | TINYINT(1) | DEFAULT 0 | 1 = priority support access |
| daily_recrawl | TINYINT(1) | DEFAULT 0 | 1 = automatic daily content refresh |
| document_uploads | TINYINT(1) | DEFAULT 0 | 1 = file upload ingestion |
| suggested_price_min | DECIMAL(10,2) | DEFAULT 0.00 | Minimum suggested price (ZAR) |
| suggested_price_max | DECIMAL(10,2) | DEFAULT 0.00 | Maximum suggested price (ZAR) |
| description | TEXT | NULLABLE | Human-readable tier description |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Row creation time |

**Indexes:**

| Index | Columns | Type |
|-------|---------|------|
| PRIMARY | tier | PK |

**Business Rules:**
- Queried by `enforceMessageLimit` middleware via JOIN with `widget_clients`
- Tier feature flags used for conditional feature gating in route handlers
- `suggested_price_min/max` used for pricing display in the portal
- Enterprise tier has `max_messages_per_month = 999999` (effectively unlimited)
