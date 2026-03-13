# Widgets Module — API Routes

**Version:** 1.0.0  
**Last Updated:** 2026-03-10

---

## 1. Overview

| Metric | Value |
|--------|-------|
| **Total endpoints** | 7 |
| **Base URL** | `https://api.softaware.net.za` |
| **Widget chat router mount** | `/api/v1` |
| **Widget ingest router mount** | `/api/v1/ingest` |
| **Default auth** | None (public API — rate-limited via `enforceMessageLimit`) |
| **Status gate** | `checkWidgetStatus` middleware on all routes |

---

## 2. Endpoint Directory

### 2.1 Widget Chat (public, rate-limited)

| # | Method | Path | Auth | Middleware | Purpose |
|---|--------|------|------|-----------|---------|
| 1 | POST | /api/v1/chat | None | checkWidgetStatus, enforceMessageLimit | RAG-powered chat with tier-based routing |
| 2 | GET | /api/v1/client/:clientId/status | None | — | Widget client status + usage stats |

### 2.2 Widget Ingest (public)

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 3 | POST | /api/v1/ingest/url | None | Crawl + ingest URL into knowledge base |
| 4 | POST | /api/v1/ingest/file | None | Upload + ingest file (PDF, TXT, DOC) |
| 5 | GET | /api/v1/ingest/sources/:clientId | None | List all ingested sources |
| 6 | DELETE | /api/v1/ingest/source | None | Delete a specific source |
| 7 | DELETE | /api/v1/ingest/all/:clientId | None | Delete all documents for client |

---

## 3. Endpoints — Widget Chat

### 3.1 POST /api/v1/chat

**Purpose:** Send a chat message to the widget AI assistant. Uses RAG retrieval from the client's knowledge base, tier-based AI model routing, tone control for Advanced/Enterprise tiers, and lead capture detection.

**Middleware Pipeline:** `checkWidgetStatus` → `enforceMessageLimit`

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| clientId | string | ✅ | Widget client UUID |
| message | string | ✅ | User's message text |
| conversationHistory | Array<{role, content}> | ❌ | Previous messages for context |

**curl Example:**

```bash
curl -X POST https://api.softaware.net.za/api/v1/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "clientId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "message": "What are your pricing plans?",
    "conversationHistory": [
      { "role": "assistant", "content": "Hi! How can I help you today?" }
    ]
  }'
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "We offer three pricing tiers: Starter at R299/month, Advanced at R899/month, and Enterprise with custom pricing. The Starter plan includes 5,000 messages per month, while Advanced adds lead capture and tone customization.",
  "relevantDocsFound": 3,
  "model": "glm-4.6",
  "tier": "free",
  "poweredBy": "Soft Aware"
}
```

**Success Response — Paid Tier (200):**

```json
{
  "success": true,
  "message": "Based on our pricing page, the Advanced plan at R899/month would be perfect for your business. It includes lead capture, custom tone settings, and 15,000 messages per month.",
  "relevantDocsFound": 5,
  "model": "gpt-4o-mini",
  "tier": "advanced"
}
```

**Success Response — Lead Captured (200):**

```json
{
  "success": true,
  "message": "Perfect, thank you John! I'll have someone send you a detailed consultation package within the hour.",
  "relevantDocsFound": 4,
  "model": "gpt-4o-mini",
  "tier": "advanced",
  "leadCaptured": true,
  "confirmation": "Thank you! We've received your information and will be in touch shortly."
}
```

**Error — Missing Fields (400):**

```json
{
  "error": "clientId and message are required"
}
```

**Error — Client Not Found (404):**

```json
{
  "error": "Widget client not found"
}
```

**Error — Message Limit Exceeded (429):**

```json
{
  "error": "Message limit exceeded",
  "message": "You've reached your free tier limit of 500 messages per month.",
  "details": {
    "tier": "free",
    "usage": 500,
    "limit": 500,
    "resetDate": "2026/03/31"
  },
  "upgrade": {
    "message": "Upgrade to Starter (R299/month) for 5,000 messages and no branding.",
    "url": "https://portal.softaware.net.za/billing"
  }
}
```

**Error — Widget Suspended (403):**

```json
{
  "error": "Account suspended",
  "message": "This resource has been suspended. Please contact support."
}
```

**Error — Server Error (500):**

```json
{
  "error": "Failed to process chat message",
  "details": "Connection refused"
}
```

---

### 3.2 GET /api/v1/client/:clientId/status

**Purpose:** Get widget client status and current usage statistics. Used by the portal to display widget health and limits.

**Path Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| clientId | string | Widget client UUID |

**curl Example:**

```bash
curl https://api.softaware.net.za/api/v1/client/a1b2c3d4-e5f6-7890-abcd-ef1234567890/status
```

**Success Response (200):**

```json
{
  "success": true,
  "client": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "websiteUrl": "https://example.com",
    "widgetColor": "#0044cc",
    "status": "active"
  },
  "usage": {
    "messageCount": 142,
    "maxMessages": 500,
    "pagesIngested": 12,
    "maxPages": 50,
    "messagePercentage": 28.4,
    "pagesPercentage": 24.0
  },
  "limits": {
    "messages": 500,
    "pages": 50
  }
}
```

**Error — Client Not Found (404):**

```json
{
  "error": "Widget client not found"
}
```

---

## 4. Endpoints — Widget Ingest

### 4.1 POST /api/v1/ingest/url

**Purpose:** Crawl a website URL, extract text content, chunk it, generate embeddings, and store in the knowledge base.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| clientId | string | ✅ | Widget client UUID |
| url | string | ✅ | Target URL to crawl (must be valid URL) |

**curl Example:**

```bash
curl -X POST https://api.softaware.net.za/api/v1/ingest/url \
  -H 'Content-Type: application/json' \
  -d '{
    "clientId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "url": "https://example.com/pricing"
  }'
```

**Success Response (200):**

```json
{
  "success": true,
  "jobId": "f1e2d3c4-b5a6-7890-1234-567890abcdef",
  "chunksCreated": 8
}
```

**Error — Invalid URL (400):**

```json
{
  "error": "Invalid URL format"
}
```

**Error — Page Limit Reached (429):**

```json
{
  "error": "Page limit reached",
  "limit": 50,
  "current": 50
}
```

**Error — Client Not Found (404):**

```json
{
  "error": "Widget client not found"
}
```

**Error — Crawl Failed (200 with error):**

```json
{
  "success": false,
  "jobId": "f1e2d3c4-b5a6-7890-1234-567890abcdef",
  "chunksCreated": 0,
  "error": "Failed to fetch URL: HTTP 404"
}
```

---

### 4.2 POST /api/v1/ingest/file

**Purpose:** Upload and ingest a document file (PDF, TXT, DOC, DOCX). Content is extracted, chunked, embedded, and stored.

**Request:** Multipart form data

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| clientId | string | ✅ | Widget client UUID (form field) |
| file | File | ✅ | Document file (max 10MB, PDF/TXT/DOC/DOCX) |

**curl Example:**

```bash
curl -X POST https://api.softaware.net.za/api/v1/ingest/file \
  -F "clientId=a1b2c3d4-e5f6-7890-abcd-ef1234567890" \
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

**Error — PDF Disabled (400):**

```json
{
  "error": "PDF support temporarily disabled. Please use plain text files."
}
```

**Error — DOC/DOCX Not Supported (400):**

```json
{
  "error": "DOC/DOCX support coming soon"
}
```

**Error — Content Too Short (400):**

```json
{
  "error": "File content too short or unreadable"
}
```

**Error — Invalid File Type (multer error):**

```json
{
  "error": "Invalid file type. Only PDF, TXT, DOC, DOCX allowed"
}
```

**Error — Page Limit Reached (429):**

```json
{
  "error": "Page limit reached",
  "limit": 50,
  "current": 50
}
```

---

### 4.3 GET /api/v1/ingest/sources/:clientId

**Purpose:** List all ingested knowledge base sources for a widget client, grouped by source URL/filename with chunk counts and total character sizes.

**Path Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| clientId | string | Widget client UUID |

**curl Example:**

```bash
curl https://api.softaware.net.za/api/v1/ingest/sources/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

**Success Response (200):**

```json
{
  "success": true,
  "sources": [
    {
      "sourceUrl": "https://example.com/pricing",
      "sourceType": "website",
      "chunkCount": 8,
      "totalChars": 6420
    },
    {
      "sourceUrl": "faq.txt",
      "sourceType": "txt",
      "chunkCount": 3,
      "totalChars": 2100
    }
  ]
}
```

---

### 4.4 DELETE /api/v1/ingest/source

**Purpose:** Delete a specific ingested source and all its document chunks. Decrements the client's `pages_ingested` counter.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| clientId | string | ✅ | Widget client UUID |
| sourceUrl | string | ✅ | Source URL or filename to delete |

**curl Example:**

```bash
curl -X DELETE https://api.softaware.net.za/api/v1/ingest/source \
  -H 'Content-Type: application/json' \
  -d '{
    "clientId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "sourceUrl": "https://example.com/old-page"
  }'
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Source deleted successfully"
}
```

---

### 4.5 DELETE /api/v1/ingest/all/:clientId

**Purpose:** Delete all ingested documents for a widget client and reset `pages_ingested` to 0. This is a destructive operation that clears the entire knowledge base.

**Path Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| clientId | string | Widget client UUID |

**curl Example:**

```bash
curl -X DELETE https://api.softaware.net.za/api/v1/ingest/all/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "All documents deleted successfully"
}
```

---

## 5. Response Shape Reference

### 5.1 Chat Response Fields

| Field | Type | Present | Description |
|-------|------|---------|-------------|
| success | boolean | Always | Request succeeded |
| message | string | On success | AI response text |
| relevantDocsFound | number | On success | Number of RAG chunks used |
| model | string | On success | AI model that generated the response |
| tier | string | On success | Client's subscription tier |
| poweredBy | string | Free tier only | "Soft Aware" branding marker |
| leadCaptured | boolean | On lead capture | Lead was detected and stored |
| confirmation | string | On lead capture | Lead capture confirmation message |

### 5.2 Error Response Shape

All error responses follow a consistent shape:

```json
{
  "error": "Short error identifier",
  "message": "Human-readable description (optional)",
  "details": { },
  "upgrade": {
    "message": "Upgrade CTA text",
    "url": "https://portal.softaware.net.za/billing"
  }
}
```

The `details` and `upgrade` fields are only present on 429 (rate limit) responses.
