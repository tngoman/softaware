# Assistants Module — API Routes

**Version:** 1.9.0  
**Last Updated:** 2026-03-08

---

## 1. Overview

| Metric | Value |
|--------|-------|
| **Total endpoints** | 42 (+ 8 deprecated) |
| **Base URL** | `https://api.softaware.net.za` |
| **Assistants router mount** | `/api/assistants` |
| **Ingest router mount** | `/api/assistants/:assistantId/ingest` |
| **My assistant router mount** | `/api/v1/mobile/my-assistant` |
| **Staff assistant router mount** | `/api/v1/mobile/staff-assistant` *(deprecated — use my-assistant)* |
| **Mobile intent router mount** | `/api/v1/mobile` |
| **Widget chat router mount** | `/api/v1` |
| **Widget ingest router mount** | `/api/v1/ingest` |
| **Contact form router mount** | `/api/v1/leads` |
| **Public lead assistant mount** | `/api/public/leads` |
| **Default auth (assistants)** | None (public API — assistant ownership not yet enforced) |
| **Default auth (my-assistant/mobile)** | JWT Bearer token (requireAuth) |
| **Default auth (widget/leads)** | None (public API — rate-limited) |

---

## 2. Endpoint Directory

### 2.1 Assistant CRUD & Knowledge (no auth)

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 1 | GET | /api/assistants | None | List all assistants |
| 2 | POST | /api/assistants/create | None | Create a new assistant |
| 3 | PUT | /api/assistants/:assistantId/update | None | Update assistant config |
| 4 | GET | /api/assistants/:assistantId | None | Get single assistant |
| 5 | DELETE | /api/assistants/:assistantId | None | Delete assistant + optional KB clear |
| 6 | GET | /api/assistants/:assistantId/knowledge-health | None | Knowledge health score + checklist |
| 7 | POST | /api/assistants/:assistantId/recategorize | None | Force re-categorization of content |
| 8 | POST | /api/assistants/:assistantId/checklist/add | None | Add custom checklist item (paid) |
| 9 | POST | /api/assistants/chat | None | SSE streaming chat with RAG |
| 10 | GET | /api/assistants/widget.js | None | Embeddable chat widget script |
| 11 | GET | /api/assistants/templates | None | Persona templates for creation UI |
| 12 | POST | /api/assistants/admin/unload-model | None | Unload chat model from RAM |
| 13 | GET | /api/assistants/admin/model-status | None | Check loaded Ollama models |
| 14 | POST | /api/assistants/:assistantId/ingest/url | None | Enqueue URL for scraping |
| 15 | POST | /api/assistants/:assistantId/ingest/file | None | Upload + enqueue file ingestion |
| 16 | GET | /api/assistants/:assistantId/ingest/status | None | Jobs list + indexed page count |
| 17 | DELETE | /api/assistants/:assistantId/ingest/job/:jobId | None | Delete job + its knowledge chunks |

### 2.2 My Assistant — Unified CRUD (JWT required) ⭐ NEW (v1.5.0)

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 18 | GET | /api/v1/mobile/my-assistant | JWT | List all of user's assistants |
| 19 | GET | /api/v1/mobile/my-assistant/:id | JWT | Get single assistant |
| 20 | POST | /api/v1/mobile/my-assistant | JWT | Create assistant |
| 21 | PUT | /api/v1/mobile/my-assistant/:id | JWT | Update assistant |
| 22 | PUT | /api/v1/mobile/my-assistant/:id/set-primary | JWT | Set as primary assistant |
| 23 | DELETE | /api/v1/mobile/my-assistant/:id | JWT | Delete assistant |
| 24 | POST | /api/v1/mobile/my-assistant/core-instructions | JWT + SuperAdmin | Set hidden core_instructions |
| 25 | GET | /api/v1/mobile/my-assistant/software-tokens | JWT + Staff | List stored software tokens |
| 26 | POST | /api/v1/mobile/my-assistant/software-tokens | JWT + Staff | Store/update software token |
| 27 | DELETE | /api/v1/mobile/my-assistant/software-tokens/:id | JWT | Delete software token |

### 2.2b Staff Sandbox Assistants — DEPRECATED (use 2.2 above)

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| — | GET | /api/v1/mobile/staff-assistant | JWT + Staff | Get current user's staff assistant |
| — | POST | /api/v1/mobile/staff-assistant | JWT + Staff | Create staff assistant (max 1) |
| — | PUT | /api/v1/mobile/staff-assistant | JWT + Staff | Update staff assistant |
| — | DELETE | /api/v1/mobile/staff-assistant | JWT + Staff | Delete staff assistant |
| — | POST | /api/v1/mobile/staff-assistant/core-instructions | JWT + SuperAdmin | Set hidden core_instructions |
| — | GET | /api/v1/mobile/staff-assistant/software-tokens | JWT + Staff | List stored software tokens |
| — | POST | /api/v1/mobile/staff-assistant/software-tokens | JWT + Staff | Store/update software token |
| — | DELETE | /api/v1/mobile/staff-assistant/software-tokens/:id | JWT | Delete software token |

### 2.3 Mobile AI Intent (JWT required) ⭐ UPDATED (v1.5.0)

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 28 | POST | /api/v1/mobile/intent | JWT | Process voice intent through AI |
| 29 | GET | /api/v1/mobile/assistants | JWT | List available assistants for selection |
| 30 | GET | /api/v1/mobile/conversations | JWT | List conversation history |
| 31 | GET | /api/v1/mobile/conversations/:id/messages | JWT | Get conversation messages |
| 32 | DELETE | /api/v1/mobile/conversations/:id | JWT | Delete conversation |

### 2.4 Widget Chat (public, rate-limited) ⭐ NEW

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 33 | POST | /api/v1/chat | None | RAG-powered widget chat with tier-based routing |
| 34 | GET | /api/v1/client/:clientId/status | None | Widget client status + usage stats |

### 2.5 Widget Ingest (public) ⭐ NEW

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 35 | POST | /api/v1/ingest/url | None | Add URL to widget crawl queue |
| 36 | POST | /api/v1/ingest/file | None | Upload + ingest file for widget KB |
| 37 | GET | /api/v1/ingest/sources/:clientId | None | List all ingested sources for widget |
| 38 | DELETE | /api/v1/ingest/source | None | Delete specific widget source |
| 39 | DELETE | /api/v1/ingest/all/:clientId | None | Delete all widget documents |

### 2.6 Contact Form (public, rate-limited) ⭐ NEW

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 40 | POST | /api/v1/leads/submit | None | Submit contact form from generated site |
| 41 | GET | /api/v1/leads/test | None | Health check for contact form service |

### 2.7 Public Lead Assistant (public, rate-limited) ⭐ NEW

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 42 | POST | /api/public/leads/assistant | None | Conversational lead qualification AI |

---

## 3. Endpoints — Assistant CRUD

### 3.1 GET /api/assistants

**Purpose:** List all assistants ordered by creation date (newest first).

**curl Example:**

```bash
curl https://api.softaware.net.za/api/assistants
```

**Success Response (200):**

```json
{
  "success": true,
  "assistants": [
    {
      "id": "assistant-1709000000000",
      "name": "Acme Support Bot",
      "description": "Customer support for Acme Corp",
      "businessType": "saas",
      "personality": "professional",
      "primaryGoal": "Help customers troubleshoot issues",
      "website": "https://acme.com",
      "createdAt": "2026-03-01T10:00:00.000Z",
      "status": "active",
      "embedCode": "<script src=\"https://softaware.net.za/api/assistants/widget.js\" data-assistant-id=\"assistant-1709000000000\"></script>",
      "chatUrl": "https://softaware.net.za/chat/assistant-1709000000000"
    }
  ]
}
```

---

### 3.2 POST /api/assistants/create

**Purpose:** Create a new AI assistant with persona-based knowledge checklist.

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| name | string | ✅ | Min 1 char |
| description | string | ✅ | Min 1 char |
| businessType | string | ✅ | Min 1 char (e.g., "saas", "restaurant", "healthcare") |
| personality | string | ✅ | One of: `professional`, `friendly`, `expert`, `casual` |
| primaryGoal | string | ✅ | Min 1 char |
| website | string | ❌ | Valid URL |

**curl Example:**

```bash
curl -X POST https://api.softaware.net.za/api/assistants/create \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Acme Support Bot",
    "description": "Customer support for Acme Corp",
    "businessType": "saas",
    "personality": "professional",
    "primaryGoal": "Help customers troubleshoot issues",
    "website": "https://acme.com"
  }'
```

**Success Response (200):**

```json
{
  "success": true,
  "assistantId": "assistant-1709000000000",
  "assistant": {
    "id": "assistant-1709000000000",
    "name": "Acme Support Bot",
    "description": "Customer support for Acme Corp",
    "businessType": "saas",
    "personality": "professional",
    "primaryGoal": "Help customers troubleshoot issues",
    "website": "https://acme.com"
  }
}
```

**Side Effects:**
- Generates default knowledge checklist from `personaTemplates.ts` based on `businessType`
- Stores checklist in `knowledge_categories` JSON column

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 400 | Zod validation error | Missing or invalid fields |
| 500 | `Failed to create assistant` | Database error |

---

### 3.3 PUT /api/assistants/:assistantId/update

**Purpose:** Update an existing assistant's configuration.

**Path Params:** `assistantId` — the assistant ID (e.g., `assistant-1709000000000`)

**Request Body:** Same as create (all fields required — full replacement).

**curl Example:**

```bash
curl -X PUT https://api.softaware.net.za/api/assistants/assistant-1709000000000/update \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Acme Support Bot v2",
    "description": "Updated description",
    "businessType": "saas",
    "personality": "friendly",
    "primaryGoal": "Delight customers",
    "website": "https://acme.com"
  }'
```

**Success Response (200):**

```json
{
  "success": true,
  "assistantId": "assistant-1709000000000",
  "assistant": { ... }
}
```

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 400 | Zod validation error | Missing or invalid fields |
| 404 | `Assistant not found` | ID doesn't exist |
| 500 | `Failed to update assistant` | Database error |

---

### 3.4 GET /api/assistants/:assistantId

**Purpose:** Retrieve a single assistant's configuration.

**curl Example:**

```bash
curl https://api.softaware.net.za/api/assistants/assistant-1709000000000
```

**Success Response (200):**

```json
{
  "success": true,
  "assistant": {
    "id": "assistant-1709000000000",
    "name": "Acme Support Bot",
    "description": "Customer support for Acme Corp",
    "businessType": "saas",
    "personality": "professional",
    "primaryGoal": "Help customers troubleshoot issues",
    "website": "https://acme.com"
  }
}
```

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 404 | `Assistant not found` | ID doesn't exist |

---

### 3.5 DELETE /api/assistants/:assistantId ⭐ RECENTLY MODIFIED

**Purpose:** Delete an assistant from MySQL with optional knowledge base cleanup from sqlite-vec.

**Query Params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| clearKnowledge | string | `"true"` | `"true"` = also delete sqlite-vec vectors; `"false"` = keep KB data |

**curl Examples:**

```bash
# Delete assistant AND its knowledge base (default)
curl -X DELETE https://api.softaware.net.za/api/assistants/assistant-1709000000000

# Delete assistant but KEEP knowledge base data
curl -X DELETE "https://api.softaware.net.za/api/assistants/assistant-1709000000000?clearKnowledge=false"
```

**Success Response (200):**

```json
{
  "success": true,
  "knowledgeCleared": true
}
```

**Cleanup Steps (in order):**

1. `DELETE FROM assistants WHERE id = ?` — remove assistant record
2. `DELETE FROM ingestion_jobs WHERE assistant_id = ?` — clean up job history
3. If `clearKnowledge !== 'false'`:
   - `vectorStore.deleteByAssistant(id)` — removes all `knowledge_chunks` + `knowledge_vectors` rows from sqlite-vec

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 404 | `Assistant not found` | ID doesn't exist or already deleted |
| 500 | `Failed to delete assistant` | Database error |

**Notes:**
- Ingestion job cleanup and sqlite-vec cleanup are wrapped in try/catch — failures are logged but don't block the response
- The `knowledgeCleared` response field tells the frontend whether KB was actually cleared

---

## 4. Endpoints — Knowledge Health

### 4.1 GET /api/assistants/:assistantId/knowledge-health

**Purpose:** Get the knowledge health score, dynamic checklist, missing categories, and recommendations. Used by both `KnowledgeHealthBadge` (dashboard) and `KnowledgeHealthScore` (detail page).

**curl Example:**

```bash
curl https://api.softaware.net.za/api/assistants/assistant-1709000000000/knowledge-health
```

**Success Response (200):**

```json
{
  "success": true,
  "score": 67,
  "checklist": [
    { "key": "pricing_plans", "label": "Pricing Plans", "satisfied": true, "type": "url" },
    { "key": "contact_details", "label": "Contact Details", "satisfied": true, "type": "url" },
    { "key": "services_offered", "label": "Services Offered", "satisfied": false, "type": "url" },
    { "key": "about_company", "label": "About Company", "satisfied": false, "type": "url" },
    { "key": "faq", "label": "FAQ", "satisfied": true, "type": "url" },
    { "key": "onboarding_docs", "label": "Onboarding Docs", "satisfied": false, "type": "file" }
  ],
  "missing": ["Services Offered", "About Company", "Onboarding Docs"],
  "recommendations": [
    { "key": "services_offered", "label": "Services Offered", "action": "Add your services offered page URL", "type": "url" },
    { "key": "about_company", "label": "About Company", "action": "Add your about company page URL", "type": "url" },
    { "key": "onboarding_docs", "label": "Onboarding Docs", "action": "Upload a document with onboarding docs", "type": "file" }
  ],
  "pagesIndexed": 5,
  "tier": "free",
  "pageLimit": 50,
  "storageFull": false,
  "pointsPerItem": 17
}
```

**Score Calculation:** `Math.round((satisfied / total) * 100)` — each checklist item has equal weight.

---

### 4.2 POST /api/assistants/:assistantId/recategorize

**Purpose:** Force re-analysis of all indexed content against the assistant's checklist. Useful after manual knowledge base changes.

**curl Example:**

```bash
curl -X POST https://api.softaware.net.za/api/assistants/assistant-1709000000000/recategorize
```

**Success Response (200):**

```json
{
  "success": true,
  "checklist": [
    { "key": "pricing_plans", "label": "Pricing Plans", "satisfied": true, "type": "url" },
    ...
  ]
}
```

**Side Effects:**
- Reads up to 50 most recent `assistant_knowledge` chunks
- Sends combined content to `qwen2.5:3b-instruct` for evaluation
- Overwrites all checklist satisfaction values (not OR-merged)

---

### 4.3 POST /api/assistants/:assistantId/checklist/add

**Purpose:** Add a custom knowledge requirement to the assistant's checklist. Paid tier only.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| key | string | ✅ | Unique snake_case identifier |
| label | string | ✅ | Human-readable label |
| type | string | ❌ | `"url"` (default) or `"file"` |

**curl Example:**

```bash
curl -X POST https://api.softaware.net.za/api/assistants/assistant-1709000000000/checklist/add \
  -H 'Content-Type: application/json' \
  -d '{"key": "api_docs", "label": "API Documentation", "type": "url"}'
```

**Success Response (200):**

```json
{
  "success": true,
  "checklist": [ ... ]
}
```

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 400 | `key and label are required` | Missing required fields |
| 403 | `Custom checklist items require a paid plan` | Free tier |
| 404 | `Assistant not found` | ID doesn't exist |
| 409 | `Checklist item with this key already exists` | Duplicate key |

---

## 5. Endpoints — Chat

### 5.1 POST /api/assistants/chat

**Purpose:** Stream an AI chat response as Server-Sent Events (SSE). Uses RAG retrieval from sqlite-vec and Ollama for generation.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| assistantId | string | ✅ | Assistant ID |
| message | string | ✅ | User's message |
| conversationHistory | array | ❌ | Previous `{role, content}` pairs (max 10 used) |

**curl Example:**

```bash
curl -N -X POST https://api.softaware.net.za/api/assistants/chat \
  -H 'Content-Type: application/json' \
  -d '{"assistantId": "assistant-1709000000000", "message": "What are your prices?"}'
```

**Response:** `Content-Type: text/event-stream`

```
data: {"token":"Our"}

data: {"token":" pricing"}

data: {"token":" starts"}

data: {"token":" at"}

data: {"token":"..."}

data: {"done":true,"model":"qwen2.5:1.5b-instruct"}
```

**Optional tool call event:**

```
data: {"toolCall":{"name":"captureEmail","success":true,"message":"Email captured"}}
```

**RAG Pipeline:**
1. User message embedded via `nomic-embed-text` (768-dim)
2. sqlite-vec KNN search for top 5 closest chunks (filtered by `assistant_id`)
3. Results injected into system prompt as `KNOWLEDGE BASE` section
4. Ollama generates response using the augmented context

**Personality → Temperature Mapping:**

| Personality | Temperature | Behavior |
|-------------|-------------|----------|
| professional | 0.3 | Focused, consistent |
| friendly | 0.7 | Creative, varied |
| expert | 0.2 | Very precise |
| casual | 0.8 | Most conversational |

---

## 6. Endpoints — Widget & Templates

### 6.1 GET /api/assistants/widget.js

**Purpose:** Serve the embeddable chat widget script. Returns JavaScript that creates a branded floating chat widget with Soft Aware branding and iframe.

**Headers Set:**
- `Content-Type: application/javascript; charset=utf-8`
- `Access-Control-Allow-Origin: *`
- `Cache-Control: public, max-age=3600`

**Usage:**

```html
<script src="https://softaware.net.za/api/assistants/widget.js" data-assistant-id="assistant-123"></script>
```

Also available as a static file at the site root:

```html
<script src="https://softaware.net.za/widget.js" data-assistant-id="assistant-123"></script>
```

**Behavior:**
- Reads `data-assistant-id` from the script tag
- Derives the brand origin from the script `src` URL (falls back to `https://softaware.net.za`)
- Creates a fixed-position FAB button (bottom-right) with the **Soft Aware favicon** (`/images/favicon.png`) instead of a generic emoji
- Button toggles between brand icon (closed) and ✕ close icon (open)
- Chat container includes a **branded header bar** with favicon + "Soft Aware Assistant" title + close button
- Chat iframe fills the middle of the container
- **"Powered by Soft Aware"** footer with small favicon at the bottom
- Auto-detects `http` vs `https` to avoid mixed content errors

**Branding Elements:**

| Element | Detail |
|---------|--------|
| FAB button icon | `<img>` of `/images/favicon.png` (32×32, rounded) |
| Header bar | Gradient `#667eea → #764ba2`, favicon (28×28) + "Soft Aware Assistant" |
| Footer | Light gray bar with "Powered by Soft Aware" + mini favicon (14×14) |
| Close state | FAB shows favicon; chat container hidden |
| Open state | FAB shows ✕; branded chat container visible |

**Static Copies:**

| File | Location |
|------|----------|
| `widget.js` | `/var/opt/softaware.net.za/public_html/widget.js` |
| `chat-widget.js` | `/var/opt/softaware.net.za/public_html/chat-widget.js` |
| `embed.js` | `/var/opt/softaware.net.za/public_html/embed.js` |

---

### 6.2 GET /api/assistants/templates

**Purpose:** Return all persona templates for the assistant creation UI.

**curl Example:**

```bash
curl https://api.softaware.net.za/api/assistants/templates
```

**Success Response (200):**

```json
{
  "success": true,
  "templates": {
    "saas": { "label": "SaaS / Software", "checklist": [...] },
    "restaurant": { "label": "Restaurant", "checklist": [...] },
    "healthcare": { "label": "Healthcare", "checklist": [...] },
    ...
  }
}
```

---

## 7. Endpoints — Admin

### 7.1 POST /api/assistants/admin/unload-model

**Purpose:** Explicitly unload the chat model from Ollama RAM. Use before server maintenance to free ~10–15 GB.

**curl Example:**

```bash
curl -X POST https://api.softaware.net.za/api/assistants/admin/unload-model
```

**Success Response (200):**

```json
{ "success": true, "message": "Model qwen2.5:1.5b-instruct unloaded from RAM" }
```

---

### 7.2 GET /api/assistants/admin/model-status

**Purpose:** Check which models are currently loaded in Ollama memory.

**curl Example:**

```bash
curl https://api.softaware.net.za/api/assistants/admin/model-status
```

**Success Response (200):**

```json
{
  "success": true,
  "models": [...],
  "activeModel": "qwen2.5:1.5b-instruct"
}
```

---

## 8. Endpoints — Ingestion

### 8.1 POST /api/assistants/:assistantId/ingest/url

**Purpose:** Enqueue a URL for scraping and knowledge embedding.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| url | string | ✅ | Valid URL to crawl |
| tier | string | ❌ | `"free"` (default) or `"paid"` |

**curl Example:**

```bash
curl -X POST https://api.softaware.net.za/api/assistants/assistant-123/ingest/url \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://acme.com/pricing", "tier": "free"}'
```

**Success Response (200):**

```json
{
  "success": true,
  "jobId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "queuePosition": 3,
  "tier": "free",
  "message": "Queued at position 4. Upgrade to paid for instant processing."
}
```

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 400 | `url is required` | Missing URL |
| 400 | `Invalid URL format` | Unparseable URL |
| 404 | `Assistant not found` | ID doesn't exist |

---

### 8.2 POST /api/assistants/:assistantId/ingest/file

**Purpose:** Upload a file for knowledge extraction and embedding.

**Form Data:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | ✅ | PDF, TXT, DOC, or DOCX (max 10 MB) |
| tier | string | ❌ | `"free"` (default) or `"paid"` |

**curl Example:**

```bash
curl -X POST https://api.softaware.net.za/api/assistants/assistant-123/ingest/file \
  -F "file=@/path/to/document.pdf" \
  -F "tier=free"
```

**Success Response (200):**

```json
{
  "success": true,
  "jobId": "a1b2c3d4-...",
  "filename": "document.pdf",
  "queuePosition": 0,
  "tier": "paid",
  "contentLength": 12500,
  "message": "Your file is being processed immediately (paid tier)."
}
```

**Supported MIME Types:**
- `application/pdf` → parsed via `pdf-parse`
- `text/plain` → UTF-8 read
- `application/msword` → parsed via `mammoth`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document` → parsed via `mammoth`

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 400 | `file is required` | No file attached |
| 400 | `Only PDF, TXT, DOC, DOCX allowed` | Wrong MIME type |
| 400 | `File content too short or unreadable` | Extracted text < 20 chars |
| 404 | `Assistant not found` | ID doesn't exist |

---

### 8.3 GET /api/assistants/:assistantId/ingest/status

**Purpose:** Get all ingestion jobs and indexed page count for an assistant. **Updated in v1.3.0** to include `original_content` field for text editing.

**curl Example:**

```bash
curl https://api.softaware.net.za/api/assistants/assistant-123/ingest/status
```

**Success Response (200):**

```json
{
  "success": true,
  "pagesIndexed": 5,
  "tier": "free",
  "jobs": [
    {
      "id": "f47ac10b-...",
      "job_type": "url",
      "source": "https://acme.com/pricing",
      "tier": "free",
      "status": "completed",
      "queue_position": null,
      "chunks_created": 8,
      "error_message": null,
      "original_content": null,
      "created_at": "2026-03-01T10:00:00.000Z"
    },
    {
      "id": "a1b2c3d4-...",
      "job_type": "file",
      "source": "Company About.txt",
      "tier": "free",
      "status": "completed",
      "queue_position": null,
      "chunks_created": 3,
      "error_message": null,
      "original_content": "We are a company that does things...",
      "created_at": "2026-03-02T15:30:00.000Z"
    }
  ],
  "pendingCount": 0
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| pagesIndexed | number | Total chunks across all completed jobs |
| tier | string | Assistant's subscription tier |
| jobs | array | All ingestion jobs for this assistant |
| jobs[].original_content | string\|null | **NEW:** Original text content (only for text files, null for URLs/PDFs) |
| pendingCount | number | Count of pending jobs |

**Usage:**
- Frontend uses `original_content` to pre-fill edit modal for text sources
- URLs and binary files (PDFs, DOCs) have `original_content = null`
```

---

### 8.4 DELETE /api/assistants/:assistantId/ingest/job/:jobId

**Purpose:** Delete a specific ingestion job and its associated knowledge chunks from both MySQL and sqlite-vec.

**curl Example:**

```bash
curl -X DELETE https://api.softaware.net.za/api/assistants/assistant-123/ingest/job/f47ac10b-58cc-4372-a567-0e02b2c3d479
```

**Success Response (200):**

```json
{ "success": true }
```

**Cleanup Steps:**
1. Verify job belongs to the assistant
2. `DELETE FROM assistant_knowledge WHERE job_id = ?`
3. `vectorStore.deleteByJob(jobId)` — remove from sqlite-vec
4. If job was `completed`, decrement `assistants.pages_indexed` (clamped to 0)
5. `DELETE FROM ingestion_jobs WHERE id = ?`

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 404 | `Job not found` | Job ID doesn't exist or doesn't belong to assistant |

---

## 9. Endpoints — Staff Sandbox Assistants ⭐ NEW (v1.4.0)

All staff assistant endpoints require JWT authentication and staff role (`admin`, `super_admin`, `developer`, `client_manager`, `qa_specialist`, `deployer`).

### 9.1 GET /api/v1/mobile/staff-assistant

**Purpose:** Get the current staff member's assistant (each staff gets max 1). Returns `null` if no assistant exists.

**curl Example:**

```bash
curl -H 'Authorization: Bearer <jwt>' \
  https://api.softaware.net.za/api/v1/mobile/staff-assistant
```

**Success Response (200):**

```json
{
  "success": true,
  "assistant": {
    "id": "staff-assistant-1709000000000",
    "name": "My Admin Bot",
    "description": "Personal admin assistant",
    "personality": "professional",
    "personality_flare": "Respond concisely and professionally. Use bullet points for lists.",
    "primary_goal": "Help manage tasks and client accounts",
    "custom_greeting": "Hey boss, what do you need?",
    "voice_style": "calm",
    "preferred_model": null,
    "status": "active",
    "tier": "paid",
    "pages_indexed": 0,
    "business_type": "Internal",
    "website": null,
    "knowledge_categories": null,
    "created_at": "2026-03-05T10:00:00.000Z",
    "updated_at": "2026-03-05T10:00:00.000Z"
  }
}
```

**When no assistant exists:**

```json
{ "success": true, "assistant": null }
```

---

### 9.2 POST /api/v1/mobile/staff-assistant

**Purpose:** Create a staff assistant. Enforces max 1 per staff member. Tier is forced to `paid`. ID format: `staff-assistant-{timestamp}`.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | ✅ | Display name (min 1 char) |
| description | string | ❌ | Business description |
| personality | string | ❌ | `professional` (default), `friendly`, `expert`, `casual` |
| personality_flare | string | ❌ | Custom tone/style instructions (GUI-editable) |
| primary_goal | string | ❌ | Primary objective for the assistant |
| custom_greeting | string | ❌ | Custom greeting message |
| voice_style | string | ❌ | TTS voice style hint (e.g., "calm", "energetic") |
| preferred_model | string | ❌ | Override Ollama model (e.g., "deepseek-coder-v2:16b-lite-instruct-q4_K_M") |
| business_type | string | ❌ | Defaults to "Internal" |
| website | string | ❌ | Website URL |

**curl Example:**

```bash
curl -X POST -H 'Authorization: Bearer <jwt>' \
  -H 'Content-Type: application/json' \
  https://api.softaware.net.za/api/v1/mobile/staff-assistant \
  -d '{
    "name": "My Admin Bot",
    "personality_flare": "Be concise and professional. Use bullet points.",
    "primary_goal": "Help me manage tasks and client accounts"
  }'
```

**Success Response (201):**

```json
{
  "success": true,
  "assistant": { "id": "staff-assistant-1709000000000", "name": "My Admin Bot", ... }
}
```

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 400 | `Assistant name is required` | Missing or empty name |
| 400 | `You already have a staff assistant` | Max 1 per user |
| 403 | `Only staff members can manage staff assistants` | Non-staff role |

---

### 9.3 PUT /api/v1/mobile/staff-assistant

**Purpose:** Update the staff assistant's editable fields. **Cannot modify `core_instructions`** — that field is backend-only.

**Request Body:** Same as create (all optional). Allowed fields: `name`, `description`, `personality`, `personality_flare`, `primary_goal`, `custom_greeting`, `voice_style`, `preferred_model`, `business_type`, `website`.

**curl Example:**

```bash
curl -X PUT -H 'Authorization: Bearer <jwt>' \
  -H 'Content-Type: application/json' \
  https://api.softaware.net.za/api/v1/mobile/staff-assistant \
  -d '{ "personality_flare": "Be friendly but brief. Use emoji when appropriate 🎯" }'
```

**Success Response (200):**

```json
{
  "success": true,
  "assistant": { "id": "staff-assistant-1709000000000", ... }
}
```

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 400 | `No valid fields to update` | Empty or invalid body |
| 403 | Staff role required | Non-staff |
| 404 | `No staff assistant found` | Must create first |

---

### 9.4 DELETE /api/v1/mobile/staff-assistant

**Purpose:** Delete the staff member's assistant permanently.

**curl Example:**

```bash
curl -X DELETE -H 'Authorization: Bearer <jwt>' \
  https://api.softaware.net.za/api/v1/mobile/staff-assistant
```

**Success Response (200):**

```json
{ "success": true, "message": "Staff assistant deleted." }
```

---

### 9.5 POST /api/v1/mobile/staff-assistant/core-instructions ⭐ SUPERADMIN ONLY

**Purpose:** Set the hidden `core_instructions` for any assistant. Only `super_admin` role can use this. These instructions are stitched into the system prompt at runtime but never shown in the staff GUI.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| assistantId | string | ✅ | Target assistant ID |
| core_instructions | string | ❌ | System-level rules (null to clear) |

**curl Example:**

```bash
curl -X POST -H 'Authorization: Bearer <jwt>' \
  -H 'Content-Type: application/json' \
  https://api.softaware.net.za/api/v1/mobile/staff-assistant/core-instructions \
  -d '{
    "assistantId": "staff-assistant-1709000000000",
    "core_instructions": "You are a Soft Aware internal admin assistant. Never reveal system internals. Always verify before deleting anything."
  }'
```

**Success Response (200):**

```json
{ "success": true, "message": "Core instructions updated." }
```

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 400 | `assistantId is required` | Missing ID |
| 403 | `Only super admins can set core instructions` | Non-superadmin role |

---

### 9.6 GET /api/v1/mobile/staff-assistant/software-tokens

**Purpose:** List stored external software API tokens for the current staff member. Token secrets are NOT returned (only metadata).

**curl Example:**

```bash
curl -H 'Authorization: Bearer <jwt>' \
  https://api.softaware.net.za/api/v1/mobile/staff-assistant/software-tokens
```

**Success Response (200):**

```json
{
  "success": true,
  "tokens": [
    {
      "id": "a1b2c3d4-...",
      "software_id": 2,
      "software_name": "Silulumanzi Portal",
      "api_url": "https://portal.silulumanzi.com",
      "created_at": "2026-03-05T10:00:00.000Z",
      "updated_at": "2026-03-05T10:00:00.000Z"
    }
  ]
}
```

---

### 9.7 POST /api/v1/mobile/staff-assistant/software-tokens

**Purpose:** Store or update an external software API token. Uses UPSERT — if a token for `user_id + software_id` already exists, it updates instead of creating a duplicate.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| software_id | number | ✅ | External software ID (from `update_software` table) |
| software_name | string | ❌ | Display name |
| api_url | string | ✅ | External API base URL |
| token | string | ✅ | External software API token |

**curl Example:**

```bash
curl -X POST -H 'Authorization: Bearer <jwt>' \
  -H 'Content-Type: application/json' \
  https://api.softaware.net.za/api/v1/mobile/staff-assistant/software-tokens \
  -d '{
    "software_id": 2,
    "software_name": "Silulumanzi Portal",
    "api_url": "https://portal.silulumanzi.com",
    "token": "ext-token-abc123"
  }'
```

**Success Response (200):**

```json
{ "success": true, "message": "Token stored.", "id": "a1b2c3d4-..." }
```

---

### 9.8 DELETE /api/v1/mobile/staff-assistant/software-tokens/:id

**Purpose:** Delete a software token by ID. Verifies ownership (user_id match).

**curl Example:**

```bash
curl -X DELETE -H 'Authorization: Bearer <jwt>' \
  https://api.softaware.net.za/api/v1/mobile/staff-assistant/software-tokens/a1b2c3d4-...
```

**Success Response (200):**

```json
{ "success": true, "message": "Token deleted." }
```

---

## 10. Endpoints — Mobile AI Intent (updated v1.4.0)

### 10.1 POST /api/v1/mobile/intent

**Purpose:** Process a voice-transcribed text through the AI assistant with function calling. Now supports optional `assistantId` for assistant selection.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| text | string | ✅ | Transcribed voice input (max 2000 chars) |
| conversationId | string | ❌ | Resume an existing conversation |
| assistantId | string | ❌ | **NEW (v1.4.0):** Use a specific assistant's prompt & model |
| language | string | ❌ | Language hint (e.g., "en", "af") |

**curl Example:**

```bash
curl -X POST -H 'Authorization: Bearer <jwt>' \
  -H 'Content-Type: application/json' \
  https://api.softaware.net.za/api/v1/mobile/intent \
  -d '{
    "text": "Show me all pending tasks assigned to me",
    "assistantId": "staff-assistant-1709000000000"
  }'
```

**Success Response (200):**

```json
{
  "reply": "Here are your 3 pending tasks:\n\n1. **Fix login bug** - Due: Mar 10\n2. **Update docs** - Due: Mar 12\n3. **Review PR #45** - Due: Mar 8",
  "conversationId": "conv-uuid",
  "toolsUsed": ["list_tasks"],
  "data": { "tasks": [...] }
}
```

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 400 | `Missing or empty "text" field` | No text |
| 400 | `Text exceeds maximum length` | >2000 chars |
| 401 | `Authentication required` | No JWT |
| 403 | `Account is suspended` | Inactive account |
| 404 | `User account not found` | Invalid userId |

---

### 10.2 GET /api/v1/mobile/assistants ⭐ NEW (v1.4.0)

**Purpose:** List active assistants the user can select for mobile conversations. Returns own assistants (staff) plus all staff agents.

**curl Example:**

```bash
curl -H 'Authorization: Bearer <jwt>' \
  https://api.softaware.net.za/api/v1/mobile/assistants
```

**Success Response (200):**

```json
{
  "success": true,
  "assistants": [
    {
      "id": "staff-assistant-1709000000000",
      "name": "My Admin Bot",
      "description": "Personal admin assistant",
      "personality": "professional"
    }
  ]
}
```

---

### 10.3 GET /api/v1/mobile/conversations

**Purpose:** List the authenticated user's conversation history, ordered by most recent first. Returns up to 50 conversations. Includes `assistant_id` and `preview` (first user message) for each conversation. ⭐ Updated v1.9.0

**curl Example:**

```bash
curl -H 'Authorization: Bearer <jwt>' \
  https://api.softaware.net.za/api/v1/mobile/conversations
```

**Success Response (200):**

```json
{
  "success": true,
  "conversations": [
    {
      "id": "conv-uuid-1",
      "assistant_id": "staff-assistant-1741234567890",
      "role": "user",
      "created_at": "2026-03-05T10:00:00.000Z",
      "updated_at": "2026-03-05T12:30:00.000Z",
      "preview": "Hi, can you help me with my tasks?"
    }
  ]
}
```

**Notes:**
- `preview` is the content of the first `role='user'` message in the conversation (via SQL subquery). Returns `null` if no user messages exist.
- `assistant_id` allows the frontend to filter conversations by assistant.

---

### 10.4 GET /api/v1/mobile/conversations/:id/messages

**Purpose:** Get all messages for a specific conversation. Verifies ownership (user_id match). Messages ordered chronologically (oldest first).

**curl Example:**

```bash
curl -H 'Authorization: Bearer <jwt>' \
  https://api.softaware.net.za/api/v1/mobile/conversations/conv-uuid-1/messages
```

**Success Response (200):**

```json
{
  "success": true,
  "messages": [
    {
      "id": "msg-uuid-1",
      "role": "user",
      "content": "Show me all pending tasks",
      "tool_name": null,
      "created_at": "2026-03-05T10:00:00.000Z"
    },
    {
      "id": "msg-uuid-2",
      "role": "assistant",
      "content": "Here are your 3 pending tasks...",
      "tool_name": "list_tasks",
      "created_at": "2026-03-05T10:00:01.000Z"
    }
  ]
}
```

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 401 | `Authentication required` | No JWT |
| 404 | `Conversation not found` | ID doesn't exist or not owned by user |

---

### 10.5 DELETE /api/v1/mobile/conversations/:id

**Purpose:** Delete a conversation and all its messages. Verifies ownership before deletion.

**curl Example:**

```bash
curl -X DELETE -H 'Authorization: Bearer <jwt>' \
  https://api.softaware.net.za/api/v1/mobile/conversations/conv-uuid-1
```

**Success Response (200):**

```json
{ "success": true, "message": "Conversation deleted." }
```

**Cleanup Steps:**
1. Verify `user_id` owns the conversation
2. `DELETE FROM mobile_messages WHERE conversation_id = ?`
3. `DELETE FROM mobile_conversations WHERE id = ?`

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 401 | `Authentication required` | No JWT |
| 404 | `Conversation not found` | ID doesn't exist or not owned by user |

---

## 11. Endpoints — Widget Chat ⭐ NEW

### 11.1 POST /api/v1/chat

**Purpose:** RAG-powered widget chat with tier-based model routing. Searches the widget's knowledge base (via embeddings), builds a contextual system prompt, and routes to the appropriate model based on subscription tier.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| clientId | string | ✅ | Widget client ID |
| message | string | ✅ | User's question |
| conversationHistory | array | ❌ | Previous `{role, content}` pairs |

**curl Example:**

```bash
curl -X POST https://api.softaware.net.za/api/v1/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "clientId": "widget-client-123",
    "message": "What are your prices?"
  }'
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Our pricing starts at R5,000/month for the Bring Your Own Engine tier...",
  "relevantDocsFound": 3,
  "model": "qwen2.5:3b-instruct",
  "tier": "free",
  "poweredBy": "Soft Aware"
}
```

**Tier-Based Model Routing:**

| Tier | Model | Notes |
|------|-------|-------|
| free / starter | `qwen2.5:3b-instruct` | Local, fast |
| advanced | `qwen2.5:7b-instruct` (or `preferred_model`) | Local, smarter; or external API |
| enterprise | Custom routing | Loopback API access; external LLM providers |

**Tone Presets (Advanced/Enterprise only):**

| Preset | Description |
|--------|-------------|
| professional | Clear and direct business tone |
| friendly | Warm, conversational, approachable |
| technical | Precise technical language |
| sales | Enthusiastic, benefit-focused |
| legal | Formal, precise terminology |
| medical | Empathetic, patient-friendly |
| luxury | Sophisticated, premium feel |

**Lead Capture:** For Advanced/Enterprise tiers with `lead_capture_enabled`, the system prompt includes lead extraction instructions. Captured leads are stored and email notifications sent to the site owner.

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 400 | `clientId and message are required` | Missing fields |
| 404 | `Widget client not found` | Invalid clientId |
| 429 | Message limit exceeded | Usage tracking limit hit |

---

### 11.2 GET /api/v1/client/:clientId/status

**Purpose:** Get widget client status and usage statistics.

**curl Example:**

```bash
curl https://api.softaware.net.za/api/v1/client/widget-client-123/status
```

**Success Response (200):**

```json
{
  "success": true,
  "client": {
    "id": "widget-client-123",
    "websiteUrl": "https://acme.com",
    "status": "active",
    "subscriptionTier": "free"
  },
  "usage": {
    "messagesThisMonth": 42,
    "pagesIngested": 5
  }
}
```

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 404 | `Widget client not found` | Invalid clientId |

---

## 12. Endpoints — Widget Ingest ⭐ NEW

### 12.1 POST /api/v1/ingest/url

**Purpose:** Add a URL to the widget's crawl queue. Immediately crawls and indexes the page content into the vector store.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| clientId | string | ✅ | Widget client ID |
| url | string | ✅ | Valid URL to crawl |

**curl Example:**

```bash
curl -X POST https://api.softaware.net.za/api/v1/ingest/url \
  -H 'Content-Type: application/json' \
  -d '{"clientId": "widget-client-123", "url": "https://acme.com/pricing"}'
```

**Success Response (200):**

```json
{
  "success": true,
  "jobId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "chunksCreated": 8
}
```

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 400 | `clientId and url are required` | Missing fields |
| 400 | `Invalid URL format` | Unparseable URL |
| 404 | `Widget client not found` | Invalid clientId |
| 429 | `Page limit reached` | ≥50 pages ingested |

---

### 12.2 POST /api/v1/ingest/file

**Purpose:** Upload a file (PDF, TXT, DOC, DOCX) and ingest its content into the widget's knowledge base.

**Form Data:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| clientId | string | ✅ | Widget client ID |
| file | File | ✅ | PDF, TXT, DOC, or DOCX (max 10 MB) |

**curl Example:**

```bash
curl -X POST https://api.softaware.net.za/api/v1/ingest/file \
  -F "clientId=widget-client-123" \
  -F "file=@/path/to/document.txt"
```

**Success Response (200):**

```json
{
  "success": true,
  "chunksCreated": 5,
  "filename": "document.txt"
}
```

**Supported MIME Types:**
- `text/plain` → UTF-8 read ✅
- `application/pdf` → **Temporarily disabled** (module resolution issues)
- `application/msword` / `application/vnd.openxmlformats-officedocument.wordprocessingml.document` → **Coming soon**

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 400 | `clientId and file are required` | Missing fields |
| 400 | `Invalid file type` | Unsupported MIME |
| 400 | `File content too short or unreadable` | Extracted text < 100 chars |
| 404 | `Widget client not found` | Invalid clientId |
| 429 | `Page limit reached` | ≥50 pages ingested |

---

### 12.3 GET /api/v1/ingest/sources/:clientId

**Purpose:** List all ingested sources (URLs and files) for a widget client.

**curl Example:**

```bash
curl https://api.softaware.net.za/api/v1/ingest/sources/widget-client-123
```

**Success Response (200):**

```json
{
  "success": true,
  "sources": [
    {
      "url": "https://acme.com/pricing",
      "type": "url",
      "chunksCreated": 8,
      "ingestedAt": "2026-03-01T10:00:00.000Z"
    },
    {
      "url": "document.txt",
      "type": "file",
      "chunksCreated": 5,
      "ingestedAt": "2026-03-02T15:30:00.000Z"
    }
  ]
}
```

---

### 12.4 DELETE /api/v1/ingest/source

**Purpose:** Delete a specific ingested source and its associated knowledge chunks.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| clientId | string | ✅ | Widget client ID |
| sourceUrl | string | ✅ | URL or filename of source to delete |

**curl Example:**

```bash
curl -X DELETE https://api.softaware.net.za/api/v1/ingest/source \
  -H 'Content-Type: application/json' \
  -d '{"clientId": "widget-client-123", "sourceUrl": "https://acme.com/pricing"}'
```

**Success Response (200):**

```json
{ "success": true, "message": "Source deleted successfully" }
```

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 400 | `clientId and sourceUrl are required` | Missing fields |

---

### 12.5 DELETE /api/v1/ingest/all/:clientId

**Purpose:** Delete all ingested documents for a widget client. Full knowledge base wipe.

**curl Example:**

```bash
curl -X DELETE https://api.softaware.net.za/api/v1/ingest/all/widget-client-123
```

**Success Response (200):**

```json
{ "success": true, "message": "All documents deleted successfully" }
```

---

## 13. Endpoints — Contact Form ⭐ NEW

### 13.1 POST /api/v1/leads/submit

**Purpose:** Handle contact form submissions from generated websites. Stores the submission in `form_submissions` table, looks up the site owner's email, and sends a notification email via `emailService`.

**Rate Limit:** 5 requests per minute per IP.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| client_id | string | ✅ | Site ID or widget client ID |
| name | string | ✅ | Sender's name |
| email | string | ✅ | Sender's email (validated) |
| message | string | ✅ | Message body |
| phone | string | ❌ | Sender's phone number |
| source_page | string | ❌ | Page where form was submitted |
| honeypot | any | ❌ | Bot detection field — must be empty |

**curl Example:**

```bash
curl -X POST https://api.softaware.net.za/api/v1/leads/submit \
  -H 'Content-Type: application/json' \
  -d '{
    "client_id": "site-uuid-123",
    "name": "John Doe",
    "email": "john@example.com",
    "message": "I would like a quote for your services."
  }'
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Thank you for your message. We will get back to you soon."
}
```

**Side Effects:**
1. Stores submission in `form_submissions` (id, site_id, sender_name, sender_email, sender_phone, message, source_page, ip_address, honeypot_triggered, status, created_at, updated_at)
2. Looks up owner email via `generated_sites.contact_email` → fallback to `users.email` via `user_id` → fallback to `widget_clients.user_id`
3. Sends HTML + text email to owner with reply-to set to sender's email

**Honeypot Behavior:**
- If `honeypot` field is non-empty, the request is silently stored as `status: 'spam'` and a fake success response is returned

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 400 | `Missing required fields: client_id, name, email, message` | Missing required fields |
| 400 | `Invalid email format` | Failed regex validation |
| 404 | `Website configuration error` | No owner email found for client_id |
| 429 | `Too many requests` | Rate limit exceeded |

---

### 13.2 GET /api/v1/leads/test

**Purpose:** Health check endpoint for the contact form service.

**curl Example:**

```bash
curl https://api.softaware.net.za/api/v1/leads/test
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Contact form router is operational",
  "rateLimit": {
    "maxRequestsPerMinute": 5,
    "windowMs": 60000
  }
}
```

---

## 14. Endpoints — Public Lead Assistant ⭐ NEW

### 14.1 POST /api/public/leads/assistant

**Purpose:** Conversational lead qualification AI for the Soft Aware landing page. Uses a sales-focused system prompt that guides visitors through tier qualification (Bring Your Own Engine vs Fully Managed vs Custom). Extracts lead data, upserts into `lead_captures` table, and assigns a qualification score.

**Rate Limit:** 25 requests per 15-minute window per IP. Blocked for 30 minutes after exceeding.

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| sessionId | string | ✅ | 8–128 chars |
| page | string | ❌ | 1–64 chars, default `"landing"` |
| message | string | ✅ | 1–600 chars |
| history | array | ❌ | Max 12 items of `{role, content}` |

**curl Example:**

```bash
curl -X POST https://api.softaware.net.za/api/public/leads/assistant \
  -H 'Content-Type: application/json' \
  -d '{
    "sessionId": "sess-abc12345",
    "page": "landing",
    "message": "We need to connect our legacy ERP to an AI chatbot"
  }'
```

**Success Response (200):**

```json
{
  "reply": "Great use case! To recommend the right tier, could you share: 1) Do you have an existing AI subscription (Copilot Studio, OpenAI, etc.)? 2) Do you have IT staff who can wire API endpoints?",
  "readyToContact": false,
  "leadCaptured": true,
  "leadId": "uuid-abc123"
}
```

**Lead Qualification Flow:**
1. Message validated via Zod (`LeadMessageSchema`)
2. Malicious prompt detection (jailbreak, flood, etc.) → guarded response
3. History + message sent to Ollama with sales qualification system prompt
4. Model returns JSON: `{ assistantReply, lead, readyToContact, abuseScore }`
5. `abuseScore ≥ 85` → guarded response
6. Lead data sanitized and upserted into `lead_captures` (sessionId-based dedup)
7. Score: 80 if `readyToContact`, else 40

**Lead Capture Fields:**

| Field | Type | Description |
|-------|------|-------------|
| companyName | string | Extracted company name |
| contactName | string | Contact person |
| email | string | Email address |
| phone | string | Phone number |
| useCase | string | AI use case description |
| requirements | string | Technical requirements |
| budgetRange | string | Budget range |
| timeline | string | Implementation timeline |

**Status Values:** `NEW` → `QUALIFIED` (set when `readyToContact = true`, i.e., at least name + email/phone + use case collected)

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 400 | `INVALID_REQUEST` | Zod validation failure |
| 429 | `RATE_LIMITED` | 25+ requests in 15 min window |
