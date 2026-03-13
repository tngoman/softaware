# Enterprise Endpoints Module — Database Schema

**Version:** 1.2.0  
**Last Updated:** 2026-03-11

---

## 1. Overview

| Metric | Value |
|--------|-------|
| **Database engine** | SQLite 3 via `better-sqlite3` |
| **Database path** | `/var/opt/backend/data/enterprise_endpoints.db` |
| **Journal mode** | WAL (Write-Ahead Logging) |
| **Foreign keys** | Enabled (`PRAGMA foreign_keys = ON`) |
| **Tables** | 2 (`enterprise_endpoints`, `endpoint_requests`) |
| **Indexes** | 3 custom + 2 primary keys |

> **Why SQLite?** Enterprise endpoints are self-contained with no joins to MySQL tables at runtime. SQLite provides fast reads, zero MySQL dependency for webhook processing, file-based portability, and WAL mode for concurrent reads during webhook bursts. MySQL is only used during endpoint *creation* via mobile AI (to verify the client exists in the `users` table).

---

## 2. Tables

### 2.1 `enterprise_endpoints` — Endpoint Configuration

**Purpose:** Stores all configuration for each enterprise webhook endpoint, including inbound channel, LLM settings, system prompt, tools, and outbound action forwarding.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `id` | TEXT | PRIMARY KEY | — | Auto-generated: `ep_{client_id}_{randomBytes(4).hex}` |
| `client_id` | TEXT | NOT NULL | — | Client identifier (e.g., `silulumanzi`, user ID) |
| `client_name` | TEXT | NOT NULL | — | Human-readable display name |
| `status` | TEXT | CHECK(IN 'active','paused','disabled') | `'active'` | Kill switch state |
| `inbound_provider` | TEXT | NOT NULL | — | `whatsapp` \| `slack` \| `custom_rest` \| `sms` \| `email` \| `web` |
| `inbound_auth_type` | TEXT | — | NULL | `api_key` \| `bearer` \| `basic` \| `none` |
| `inbound_auth_value` | TEXT | — | NULL | Encrypted auth credential |
| `llm_provider` | TEXT | NOT NULL | — | `ollama` \| `openrouter` \| `openai` |
| `llm_model` | TEXT | NOT NULL | — | Model name (e.g., `openai/gpt-4o-mini`, `qwen2.5:3b`) |
| `llm_temperature` | REAL | — | `0.3` | Temperature for LLM inference |
| `llm_max_tokens` | INTEGER | — | `1024` | Max tokens for LLM response |
| `llm_system_prompt` | TEXT | NOT NULL | — | Custom system prompt per endpoint |
| `llm_tools_config` | TEXT | — | NULL | JSON array of OpenAI-format tool definitions |
| `llm_knowledge_base` | TEXT | — | NULL | Optional plain-text knowledge base |
| `target_api_url` | TEXT | — | NULL | Outbound action forwarding URL |
| `target_api_auth_type` | TEXT | — | NULL | `bearer` \| `basic` \| `custom` \| `none` |
| `target_api_auth_value` | TEXT | — | NULL | Encrypted auth credential for target API |
| `target_api_headers` | TEXT | — | NULL | JSON object of custom headers for target API |
| `created_at` | TEXT | NOT NULL | — | ISO 8601 timestamp |
| `updated_at` | TEXT | NOT NULL | — | ISO 8601 timestamp |
| `last_request_at` | TEXT | — | NULL | ISO 8601 — updated on each webhook request |
| `total_requests` | INTEGER | — | `0` | Auto-incremented counter per request |
| `contact_id` | INTEGER | — | NULL | Links to MySQL `contacts.id` for package billing (added v1.2.0) |

**Indexes:**
| Index Name | Column(s) | Purpose |
|------------|-----------|---------|
| PRIMARY | `id` | Primary key |
| `idx_client_id` | `client_id` | Fast lookup by client |
| `idx_status` | `status` | Filter active/paused/disabled |

**Example Data:**
```sql
INSERT INTO enterprise_endpoints VALUES (
  'ep_silulumanzi_91374147',
  'silulumanzi',
  'Silulumanzi Water Services',
  'active',
  'custom_rest',
  NULL,
  NULL,
  'openrouter',
  'openai/gpt-4o-mini',
  0.3,
  1024,
  'You are a helpful assistant for Silulumanzi Water Services...',
  '[{"type":"function","function":{"name":"log_query","description":"Log a customer query",...}}]',
  NULL,
  'https://softaware.net.za/AiClient.php',
  'bearer',
  '<encrypted-token>',
  NULL,
  '2026-03-06T10:00:00.000Z',
  '2026-03-08T14:30:00.000Z',
  '2026-03-10T09:15:22.000Z',
  2
);
```

**Live Data (as of 2026-03-11):**

| ID | Client Name | Status | Provider | LLM | Contact ID | Package | Requests |
|----|-------------|--------|----------|-----|-----------|---------|----------|
| `ep_silulumanzi_91374147` | Silulumanzi Water Services | active | custom_rest | openrouter/gpt-4o-mini | 68 | BYOE (50K credits) | 5+ |
| `ep_admin-softaware-001_1982b216` | Soft Aware Administrator | active | custom_rest | openrouter/gpt-4o-mini | 1 | Staff (100K credits) | 0 |
| `ep_admin-softaware-001_693b2d88` | Soft Aware Administrator | active | custom_rest | openrouter/gpt-4o-mini | 1 | Staff (100K credits) | 0 |

---

### 2.2 `endpoint_requests` — Request Audit Log

**Purpose:** Stores every inbound webhook request with full payload, AI response, timing, and error information.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `id` | TEXT | PRIMARY KEY | — | Auto-generated: `req_{randomBytes(8).hex}` |
| `endpoint_id` | TEXT | NOT NULL, FK → `enterprise_endpoints.id` ON DELETE CASCADE | — | Parent endpoint |
| `timestamp` | TEXT | NOT NULL | — | ISO 8601 timestamp |
| `inbound_payload` | TEXT | — | NULL | JSON-stringified inbound request body |
| `ai_response` | TEXT | — | NULL | JSON-stringified formatted response |
| `duration_ms` | INTEGER | — | NULL | Total processing time in milliseconds |
| `status` | TEXT | — | NULL | `'success'` or `'error'` |
| `error_message` | TEXT | — | NULL | Error description (only when status='error') |

**Indexes:**
| Index Name | Column(s) | Purpose |
|------------|-----------|---------|
| PRIMARY | `id` | Primary key |
| `idx_endpoint_requests` | `endpoint_id`, `timestamp` | Fast log retrieval by endpoint + time ordering |

**Foreign Key Cascade:**
```sql
FOREIGN KEY (endpoint_id) REFERENCES enterprise_endpoints(id) ON DELETE CASCADE
```
When an endpoint is deleted, all its request logs are automatically deleted.

**Example Data:**
```sql
INSERT INTO endpoint_requests VALUES (
  'req_a1b2c3d4e5f6g7h8',
  'ep_silulumanzi_91374147',
  '2026-03-10T09:15:22.000Z',
  '{"message":"What are your hours?","phone_number":"+27821234567"}',
  '{"response":"Our hours are Monday to Friday, 8am to 5pm.","action":"reply","language":"en"}',
  2340,
  'success',
  NULL
);
```

---

## 3. ID Generation

### Endpoint IDs

Format: `ep_{client_id}_{random_hex}`

```typescript
const randomSuffix = randomBytes(4).toString('hex');  // 8 hex chars
const id = `ep_${input.client_id}_${randomSuffix}`;
// Example: ep_silulumanzi_91374147
```

**Properties:**
- Deterministic prefix (`ep_` + client ID) for easy visual identification
- Random suffix (4 bytes = 8 hex chars = 4.3 billion possibilities) for uniqueness
- Human-readable — can identify the client from the ID alone

### Request Log IDs

Format: `req_{random_hex}`

```typescript
const id = `req_${randomBytes(8).toString('hex')}`;  // 16 hex chars
// Example: req_a1b2c3d4e5f6g7h8
```

---

## 4. Schema Creation

The schema is created idempotently on first database access:

```sql
CREATE TABLE IF NOT EXISTS enterprise_endpoints (
  id                      TEXT PRIMARY KEY,
  client_id               TEXT NOT NULL,
  client_name             TEXT NOT NULL,
  status                  TEXT DEFAULT 'active' CHECK(status IN ('active', 'paused', 'disabled')),
  
  inbound_provider        TEXT NOT NULL,
  inbound_auth_type       TEXT,
  inbound_auth_value      TEXT,
  
  llm_provider            TEXT NOT NULL,
  llm_model               TEXT NOT NULL,
  llm_temperature         REAL DEFAULT 0.3,
  llm_max_tokens          INTEGER DEFAULT 1024,
  llm_system_prompt       TEXT NOT NULL,
  llm_tools_config        TEXT,
  llm_knowledge_base      TEXT,
  
  target_api_url          TEXT,
  target_api_auth_type    TEXT,
  target_api_auth_value   TEXT,
  target_api_headers      TEXT,
  
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  last_request_at         TEXT,
  total_requests          INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_client_id ON enterprise_endpoints(client_id);
CREATE INDEX IF NOT EXISTS idx_status ON enterprise_endpoints(status);

CREATE TABLE IF NOT EXISTS endpoint_requests (
  id                TEXT PRIMARY KEY,
  endpoint_id       TEXT NOT NULL,
  timestamp         TEXT NOT NULL,
  inbound_payload   TEXT,
  ai_response       TEXT,
  duration_ms       INTEGER,
  status            TEXT,
  error_message     TEXT,
  FOREIGN KEY (endpoint_id) REFERENCES enterprise_endpoints(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_endpoint_requests ON endpoint_requests(endpoint_id, timestamp);
```

---

## 5. SQLite vs MySQL — Cross-Database Boundaries

| Operation | Database | Table | Why |
|-----------|----------|-------|-----|
| Endpoint config CRUD | **SQLite** | `enterprise_endpoints` | Self-contained, fast reads for webhooks |
| Request logging | **SQLite** | `endpoint_requests` | Co-located with config for simple analytics |
| Client verification (mobile creation) | **MySQL** | `users` | User data lives in main DB |
| Health check records | **MySQL** | `system_health_checks` | Part of main health monitoring system |
| Auto-created cases on failure | **MySQL** | `cases` | Part of case management system |
| Admin user notifications | **MySQL** | `users` + push service | Part of notification system |

> **Important:** At webhook processing time, the enterprise endpoint system is **entirely SQLite** — no MySQL queries are made. MySQL is only touched during endpoint creation via mobile AI (to verify the client exists) and by the health monitor (to record check results and create cases).

---

## 6. Zod Validation Schemas

### Create Schema (Admin API)

```typescript
const createSchema = z.object({
  client_id:            z.string().min(1).max(100),
  client_name:          z.string().min(1).max(255),
  inbound_provider:     z.enum(['whatsapp', 'slack', 'custom_rest', 'sms', 'email', 'web']),
  llm_provider:         z.enum(['ollama', 'openrouter', 'openai']),
  llm_model:            z.string().min(1),
  llm_system_prompt:    z.string().min(1),
  llm_tools_config:     z.string().optional(),
  llm_temperature:      z.number().min(0).max(2).optional(),
  llm_max_tokens:       z.number().min(1).max(16384).optional(),
  target_api_url:       z.string().url().optional().or(z.literal('')),
  target_api_auth_type: z.enum(['bearer', 'basic', 'custom', 'none']).optional(),
  target_api_auth_value: z.string().optional(),
  target_api_headers:   z.string().optional(),
});
```

### Update Schema (Admin API)

```typescript
const updateSchema = createSchema.partial().extend({
  status: z.enum(['active', 'paused', 'disabled']).optional(),
});
```

### Status Schema (Kill Switch)

```typescript
const statusSchema = z.object({
  status: z.enum(['active', 'paused', 'disabled']),
});
```

---

## 7. TypeScript Interfaces

### Backend: `EnterpriseEndpoint`

```typescript
export interface EnterpriseEndpoint {
  id: string;
  client_id: string;
  client_name: string;
  status: 'active' | 'paused' | 'disabled';
  inbound_provider: 'whatsapp' | 'slack' | 'custom_rest' | 'sms' | 'email' | 'web';
  inbound_auth_type?: 'api_key' | 'bearer' | 'basic' | 'none';
  inbound_auth_value?: string;
  llm_provider: 'ollama' | 'openrouter' | 'openai';
  llm_model: string;
  llm_temperature?: number;
  llm_max_tokens?: number;
  llm_system_prompt: string;
  llm_tools_config?: string;
  llm_knowledge_base?: string;
  target_api_url?: string;
  target_api_auth_type?: 'bearer' | 'basic' | 'custom' | 'none';
  target_api_auth_value?: string;
  target_api_headers?: string;
  created_at: string;
  updated_at: string;
  last_request_at?: string;
  total_requests: number;
}
```

### Backend: `EndpointCreateInput`

```typescript
export interface EndpointCreateInput {
  client_id: string;
  client_name: string;
  inbound_provider: string;
  llm_provider: string;
  llm_model: string;
  llm_system_prompt: string;
  llm_tools_config?: string;
  target_api_url?: string;
  target_api_auth_type?: string;
  target_api_auth_value?: string;
}
```

### Frontend: `RequestLog`

```typescript
export interface RequestLog {
  id: string;
  endpoint_id: string;
  timestamp: string;
  inbound_payload: string;
  ai_response: string;
  duration_ms: number;
  status: string;
  error_message?: string;
}
```

### Payload Normalizer Interfaces

```typescript
export interface NormalizedInbound {
  text: string;
  sender_id?: string;
  channel: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export interface FormattedOutbound {
  body: any;
  contentType: string;
}
```
