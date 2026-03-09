# AI Module Database Fields

## Overview

This document details the database schema for the AI module.

**Version:** 2.9.0  
**Last Updated:** March 2026

---

## Tables

### `assistants`

**Purpose:** Store assistant configurations and metadata

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | VARCHAR(36) | PRIMARY KEY | UUID |
| `user_id` | VARCHAR(36) | NOT NULL, FK→users.id | Owner |
| `name` | VARCHAR(255) | NOT NULL | Assistant name |
| `description` | TEXT | NULL | Description |
| `business_type` | VARCHAR(100) | NULL | Business category |
| `personality` | VARCHAR(50) | NULL | professional/friendly/expert/casual |
| `primary_goal` | TEXT | NULL | Main objective |
| `website` | VARCHAR(500) | NULL | Website to index |
| `tier` | ENUM('free','paid') | DEFAULT 'free' | Feature tier |
| `status` | VARCHAR(50) | DEFAULT 'indexing' | indexing/ready/error |
| `pages_indexed` | INT | DEFAULT 0 | Number of pages indexed |
| `lead_capture_email` | VARCHAR(255) | NULL | Email for leads |
| `webhook_url` | VARCHAR(500) | NULL | Webhook endpoint |
| `enabled_tools` | TEXT | NULL | JSON array of enabled tools |
| `data` | JSON | NULL | Additional config |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation time |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | Last update |

**Indexes:**
- PRIMARY: `id`
- INDEX: `user_id`
- INDEX: `status`

**Example Data:**
```sql
INSERT INTO assistants VALUES (
  'a1b2c3d4-...',
  'u9876543-...',
  'Tech Support Bot',
  'Helps with technical issues',
  'Technology',
  'professional',
  'Provide quick solutions',
  'https://example.com',
  'paid',
  'ready',
  45,
  'leads@example.com',
  'https://example.com/webhook',
  '["web_search","email"]',
  '{"theme":"blue","avatar":"bot.png"}',
  '2026-01-15 10:30:00',
  '2026-03-01 14:20:00'
);
```

---

### `assistant_knowledge`

**Purpose:** Store indexed knowledge base documents

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | VARCHAR(36) | PRIMARY KEY | UUID |
| `assistant_id` | VARCHAR(36) | NOT NULL, FK→assistants.id | Parent assistant |
| `content` | TEXT | NOT NULL | Document content |
| `url` | VARCHAR(1000) | NULL | Source URL |
| `title` | VARCHAR(500) | NULL | Document title |
| `category` | VARCHAR(100) | NULL | Auto-categorized topic |
| `metadata` | JSON | NULL | Additional metadata |
| `embedding` | BLOB | NULL | Vector embedding |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Indexed time |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | Last update |

**Indexes:**
- PRIMARY: `id`
- INDEX: `assistant_id`
- INDEX: `category`
- FULLTEXT: `content`, `title`

**Example Data:**
```sql
INSERT INTO assistant_knowledge VALUES (
  'k1234567-...',
  'a1b2c3d4-...',
  'Our pricing starts at $99/month...',
  'https://example.com/pricing',
  'Pricing Information',
  'pricing',
  '{"section":"pricing","importance":"high"}',
  x'0a1b2c3d...',  -- Binary embedding
  '2026-01-15 11:00:00',
  '2026-01-15 11:00:00'
);
```

---

### `ai_model_config`

**Purpose:** Team-level AI provider and model preferences

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | VARCHAR(36) | PRIMARY KEY | UUID |
| `teamId` | VARCHAR(36) | NOT NULL, UNIQUE, FK→teams.id | Team |
| `defaultTextProvider` | VARCHAR(50) | DEFAULT 'softaware' | Text chat provider |
| `defaultTextModel` | VARCHAR(100) | DEFAULT 'glm-4-plus' | Text model |
| `visionProvider` | VARCHAR(50) | DEFAULT 'glm' | Vision provider |
| `visionModel` | VARCHAR(100) | DEFAULT 'glm-4v-plus' | Vision model |
| `codeProvider` | VARCHAR(50) | DEFAULT 'softaware' | Code generation provider |
| `codeModel` | VARCHAR(100) | DEFAULT 'glm-4-plus' | Code model |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation time |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | Last update |

**Indexes:**
- PRIMARY: `id`
- UNIQUE: `teamId`

**Example Data:**
```sql
INSERT INTO ai_model_config VALUES (
  'c9876543-...',
  't1234567-...',
  'openai',
  'gpt-4',
  'openai',
  'gpt-4-vision-preview',
  'anthropic',
  'claude-3-opus',
  '2026-02-01 09:00:00',
  '2026-02-15 10:30:00'
);
```

---

### `ai_conversations` (Planned)

**Purpose:** Store persistent conversation history

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | VARCHAR(36) | PRIMARY KEY | UUID |
| `user_id` | VARCHAR(36) | NOT NULL, FK→users.id | Owner |
| `assistant_id` | VARCHAR(36) | NULL, FK→assistants.id | Associated assistant |
| `title` | VARCHAR(255) | NULL | Conversation title |
| `model` | VARCHAR(100) | NULL | Model used |
| `provider` | VARCHAR(50) | NULL | Provider used |
| `system_prompt` | TEXT | NULL | System prompt |
| `metadata` | JSON | NULL | Additional data |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Start time |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | Last message time |

**Status:** Not yet implemented

---

### `ai_messages` (Planned)

**Purpose:** Store individual messages in conversations

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | VARCHAR(36) | PRIMARY KEY | UUID |
| `conversation_id` | VARCHAR(36) | NOT NULL, FK→ai_conversations.id | Parent conversation |
| `role` | ENUM('system','user','assistant') | NOT NULL | Message role |
| `content` | TEXT | NOT NULL | Message content |
| `images` | JSON | NULL | Image attachments |
| `metadata` | JSON | NULL | Usage stats, etc |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Message time |

**Status:** Not yet implemented

---

## Relationships

```
users (1) ──→ (N) assistants
assistants (1) ──→ (N) assistant_knowledge
teams (1) ──→ (1) ai_model_config
users (1) ──→ (N) ai_conversations [planned]
assistants (1) ──→ (N) ai_conversations [planned]
ai_conversations (1) ──→ (N) ai_messages [planned]
```

---

## Schema Migrations

### v2.4.0 - Assistant Platform

```sql
-- Create assistants table
CREATE TABLE assistants (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  business_type VARCHAR(100),
  personality VARCHAR(50),
  primary_goal TEXT,
  website VARCHAR(500),
  tier ENUM('free', 'paid') DEFAULT 'free',
  status VARCHAR(50) DEFAULT 'indexing',
  pages_indexed INT DEFAULT 0,
  lead_capture_email VARCHAR(255),
  webhook_url VARCHAR(500),
  enabled_tools TEXT,
  data JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status)
);

-- Create knowledge table
CREATE TABLE assistant_knowledge (
  id VARCHAR(36) PRIMARY KEY,
  assistant_id VARCHAR(36) NOT NULL,
  content TEXT NOT NULL,
  url VARCHAR(1000),
  title VARCHAR(500),
  category VARCHAR(100),
  metadata JSON,
  embedding BLOB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (assistant_id) REFERENCES assistants(id) ON DELETE CASCADE,
  INDEX idx_assistant_id (assistant_id),
  INDEX idx_category (category),
  FULLTEXT idx_content_title (content, title)
);
```

### v2.3.0 - AI Configuration

```sql
-- Create config table
CREATE TABLE ai_model_config (
  id VARCHAR(36) PRIMARY KEY,
  teamId VARCHAR(36) NOT NULL UNIQUE,
  defaultTextProvider VARCHAR(50) DEFAULT 'softaware',
  defaultTextModel VARCHAR(100) DEFAULT 'glm-4-plus',
  visionProvider VARCHAR(50) DEFAULT 'glm',
  visionModel VARCHAR(100) DEFAULT 'glm-4v-plus',
  codeProvider VARCHAR(50) DEFAULT 'softaware',
  codeModel VARCHAR(100) DEFAULT 'glm-4-plus',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (teamId) REFERENCES teams(id) ON DELETE CASCADE
);
```

---

## Vector Store (SQLite)

**Separate database:** `/var/opt/backend/data/vectors.db`

### `documents` table

```sql
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  assistant_id TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata TEXT, -- JSON string
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_assistant ON documents(assistant_id);
```

### `embeddings` table (using sqlite-vec)

```sql
CREATE VIRTUAL TABLE embeddings USING vec0(
  document_id TEXT PRIMARY KEY,
  embedding FLOAT[1536]  -- OpenAI embedding dimension
);
```

**Queries:**
```sql
-- Insert embedding
INSERT INTO embeddings (document_id, embedding) 
VALUES (?, vec_f32(?));

-- Search similar
SELECT d.*, vec_distance_cosine(e.embedding, vec_f32(?)) as distance
FROM documents d
JOIN embeddings e ON d.id = e.document_id
WHERE d.assistant_id = ?
ORDER BY distance ASC
LIMIT 10;
```

---

## Data Types

### Personality Types
- `professional` - Formal and business-like
- `friendly` - Warm and conversational
- `expert` - Technical and detailed
- `casual` - Relaxed and informal

### Status Types
- `indexing` - Currently scraping website
- `ready` - Ready to chat
- `error` - Indexing failed
- `paused` - Temporarily disabled

### Tier Types
- `free` - Limited features
- `paid` - Full features

---

## Data Constraints

| Constraint | Rule |
|-----------|------|
| Assistant name | 1-255 characters |
| Description | Max 5000 characters |
| Website URL | Valid URL, max 500 chars |
| Knowledge content | Max 50,000 chars per document |
| Enabled tools | Valid JSON array |
| Embedding dimension | 1536 floats (OpenAI) |

---

## Sample Queries

### Get assistant with knowledge count
```sql
SELECT 
  a.*,
  COUNT(k.id) as knowledge_count
FROM assistants a
LEFT JOIN assistant_knowledge k ON a.id = k.assistant_id
WHERE a.user_id = ?
GROUP BY a.id;
```

### Search knowledge base
```sql
SELECT * FROM assistant_knowledge
WHERE assistant_id = ?
  AND MATCH(content, title) AGAINST(? IN NATURAL LANGUAGE MODE)
LIMIT 10;
```

### Get team AI config with fallback
```sql
SELECT 
  COALESCE(c.defaultTextProvider, 'softaware') as provider,
  COALESCE(c.defaultTextModel, 'glm-4-plus') as model
FROM teams t
LEFT JOIN ai_model_config c ON t.id = c.teamId
WHERE t.id = ?;
```

---

## Known Issues

### 🟡 WARNING
- **Embedding storage:** BLOBs in MySQL can be inefficient for large volumes
  - **Mitigation:** Using separate SQLite vector store
  - **Future:** Consider dedicated vector DB (Pinecone, Weaviate)

### 🟡 WARNING  
- **Knowledge base size:** No hard limit on documents per assistant
  - **Risk:** Performance degradation with >10,000 documents
  - **Mitigation:** Pagination in queries, archiving old docs

### ✅ OK
- Foreign key constraints properly enforce referential integrity
- Indexes optimize common query patterns
- Timestamps track all changes
