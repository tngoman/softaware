# Contacts — Field & Data Dictionary

## Database Schema: `contacts` Table

| Column | Type | Nullable | Default | Frontend Alias | Description |
|--------|------|----------|---------|----------------|-------------|
| `id` | `INT` (PK) | No | AUTO_INCREMENT | `contact_id` | Primary key |
| `company_name` | `VARCHAR` | No | — | `contact_name` | Company or person name |
| `contact_person` | `VARCHAR` | Yes | `NULL` | `contact_person` | Individual contact person at company |
| `email` | `VARCHAR` | Yes | `NULL` | `contact_email` | Primary email |
| `phone` | `VARCHAR` | Yes | `NULL` | `contact_phone` | Primary phone |
| `fax` | `VARCHAR` | Yes | `NULL` | `contact_alt_phone` | Fax / alternative phone |
| `website` | `VARCHAR` | Yes | `NULL` | `website` | Website URL |
| `location` | `TEXT` | Yes | `NULL` | `contact_address` | Physical address |
| `contact_code` | `VARCHAR` | Yes | `NULL` | `contact_code` | Internal reference code |
| `remarks` | `TEXT` | Yes | `NULL` | `contact_notes` | Free-text notes |
| `active` | `TINYINT` | No | `1` | `active` | 1=active, 0=soft-deleted |
| `created_at` | `DATETIME` | Yes | — | — | Creation timestamp |
| `updated_at` | `DATETIME` | Yes | — | — | Last update timestamp |

### Column Aliasing (SQL → Frontend)
The backend uses a `CONTACT_SELECT` fragment to alias columns:
```sql
id            AS contact_id,
company_name  AS contact_name,
contact_person,
location      AS contact_address,
email         AS contact_email,
phone         AS contact_phone,
fax           AS contact_alt_phone,
remarks       AS contact_notes,
website,
contact_code,
active,
1             AS contact_type    -- ⚠️ Hardcoded to 1 (customer)
```

---

## Zod Validation Schemas

### `createContactSchema`
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `company_name` | `string` | Yes | `min(1)` |
| `contact_person` | `string` | No | — |
| `email` | `string` | No | `email()` format |
| `phone` | `string` | No | — |
| `fax` | `string` | No | — |
| `website` | `string` | No | — |
| `location` | `string` | No | — |
| `contact_code` | `string` | No | — |
| `remarks` | `string` | No | — |
| `active` | `number` | No | Default `1` |

### `updateContactSchema`
All fields from `createContactSchema` are optional (`.partial()`).

---

## API Request/Response Schemas

### `GET /contacts` — List Contacts
**Query params**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | `number` | `1` | Page number |
| `limit` | `number` | `50` | Items per page |
| `search` | `string` | `''` | Search company_name, contact_person, email |

**Response** `200`:
```json
{
  "success": true,
  "data": [
    {
      "contact_id": 1,
      "contact_name": "Acme Corp",
      "contact_person": "John Doe",
      "contact_address": "123 Main St",
      "contact_email": "john@acme.com",
      "contact_phone": "+27 11 123 4567",
      "contact_alt_phone": null,
      "contact_notes": "Key client",
      "website": "https://acme.com",
      "contact_code": "ACM001",
      "active": 1,
      "contact_type": 1
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 42 }
}
```

### `GET /contacts/:id` — Single Contact
**Response** `200`:
```json
{ "success": true, "data": { /* same fields as above */ } }
```

### `POST /contacts` — Create Contact
**Request body**: Validated against `createContactSchema`
**Response** `201`:
```json
{ "success": true, "data": { /* created contact with all aliased fields */ } }
```

### `PUT /contacts/:id` — Update Contact
**Request body**: Partial fields from `updateContactSchema`
**Response** `200`:
```json
{ "success": true, "data": { /* updated contact */ } }
```

### `DELETE /contacts/:id` — Soft Delete
**Response** `200`:
```json
{ "success": true, "message": "Contact deleted" }
```

### `GET /contacts/:id/quotations` — Contact Quotations
**Response** `200`:
```json
{
  "success": true,
  "data": [
    {
      "quotation_id": 1,
      "quotation_contact_id": 5,
      "quotation_number": "QUO-001",
      "quotation_total": 5000.00,
      "quotation_date": "2024-01-15",
      "quotation_valid_until": "2024-02-14",
      "quotation_notes": "...",
      "quotation_status": 1,
      "contact_name": "Acme Corp"
    }
  ]
}
```

### `GET /contacts/:id/invoices` — Contact Invoices
**Response** `200`:
```json
{
  "success": true,
  "data": [
    {
      "invoice_id": 1,
      "invoice_contact_id": 5,
      "invoice_number": "INV-001",
      "invoice_total": 1500.00,
      "invoice_date": "2024-01-20",
      "invoice_due_date": "2024-02-20",
      "invoice_payment_status": 0,
      "invoice_notes": "...",
      "active": 1,
      "invoice_quote_id": 1,
      "contact_name": "Acme Corp"
    }
  ]
}
```

### `GET /contacts/:id/expenses` — Supplier Expenses
**Response** `200`:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "transaction_date": "2024-03-15",
      "invoice_number": "EXP-001",
      "party_name": "Office Supplies Inc",
      "exclusive_amount": 1000.00,
      "vat_amount": 150.00,
      "total_amount": 1150.00,
      "transaction_type": "expense",
      "vat_type": "standard",
      "expense_category_id": 3,
      "category_name": "Office Supplies",
      "description": "Monthly office supplies"
    }
  ],
  "summary": {
    "total_expenses": 5750.00,
    "total_vat": 750.00,
    "total_exclusive": 5000.00,
    "count": 5
  }
}
```

**Notes**:
- `data` contains all fields from `transactions_vat` row plus `category_name` from `tb_expense_categories` JOIN
- `summary` is server-calculated from all matching expenses
- Matches supplier by `party_name` = contact's `company_name` in the `contacts` table
- Only returns rows where `transaction_type = 'expense'`
- `vat_type` values: `"standard"`, `"zero-rated"`, `"exempt"`

---

## Contact Form (Public)

### `POST /v1/leads/submit`
**No authentication required.**

**Request body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `client_id` | `string` | Yes | Site or widget client ID |
| `name` | `string` | Yes | Submitter's name |
| `email` | `string` | Yes | Submitter's email (validated with regex) |
| `message` | `string` | Yes | Message body |
| `honeypot` | `string` | No | If filled, submission is silently dropped (bot) |

**Response** `200`:
```json
{ "success": true, "message": "Thank you for your message. We will get back to you soon." }
```

**Error responses**:
- `429`: Rate limit exceeded (5 req/min/IP)
- `400`: Missing required fields or invalid email
- `404`: Could not find site owner email
- `500`: SMTP send failure

---

## Frontend TypeScript Types

### `Contact` (from `types/index.ts`)
```typescript
interface Contact {
  contact_id?: number;
  contact_name: string;
  contact_type: number;        // 1=customer, 2=supplier
  contact_person?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_alt_phone?: string;
  contact_address?: string;
  contact_vat?: string;
  contact_notes?: string;
  active?: number;
}
```

### `StatementData` (inline in ContactDetails.tsx)
```typescript
interface StatementData {
  contact: Contact;
  transactions: Transaction[];
  closing_balance: number;
  aging: {
    current: number;
    '30_days': number;
    '60_days': number;
    '90_days': number;
    total: number;
  };
}

interface Transaction {
  type: 'invoice' | 'payment';
  date: string;
  due_date?: string;
  description: string;
  invoice_id?: number;
  amount: number;
  balance: number;
  payment_status?: number;
  days_overdue?: number;
}
```

## Admin Overview API

### `GET /admin/clients/overview` — Full Overview
**Requires**: `requireAuth` + `requireAdmin`

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalClients": 15,
      "activeClients": 12,
      "totalAssistants": 8,
      "activeAssistants": 6,
      "totalWidgets": 10,
      "activeWidgets": 9,
      "totalLandingPages": 5,
      "deployedLandingPages": 3,
      "totalEndpoints": 4,
      "activeEndpoints": 3,
      "totalCustomers": 42,
      "totalSuppliers": 7
    },
    "clients": [
      {
        "id": "uuid",
        "username": "john",
        "email": "john@example.com",
        "account_status": "active",
        "created_at": "2024-01-01T00:00:00Z"
      }
    ],
    "assistants": [
      {
        "id": "uuid",
        "name": "My Bot",
        "status": "active",
        "personality": "Friendly",
        "primary_goal": "Information",
        "business_type": "Service",
        "knowledge_categories": "{\"checklist\":[{\"key\":\"products\",\"label\":\"Products/Services\",\"type\":\"business\",\"satisfied\":true},{\"key\":\"faqs\",\"label\":\"FAQs\",\"type\":\"support\",\"satisfied\":false}]}",
        "knowledge_source_count": 2,
        "knowledge_chunk_count": 145,
        "owner_name": "john",
        "owner_email": "john@example.com",
        "created_at": "2024-01-15T00:00:00Z"
      }
    ],
    "widgets": [
      {
        "id": "uuid",
        "name": "Website Widget",
        "status": "active",
        "assistant_id": "uuid",
        "owner_name": "john",
        "created_at": "2024-02-01T00:00:00Z"
      }
    ],
    "landingPages": [
      {
        "id": "uuid",
        "business_name": "Sakhile and Sons",
        "tagline": "Quality service",
        "status": "generated",
        "theme_color": "#2563eb",
        "logo_url": "https://...",
        "hero_image_url": "https://...",
        "about_us": "We are a ...",
        "services": "[\"Plumbing\",\"Electrical\"]",
        "last_deployed_at": "2024-03-01T00:00:00Z",
        "has_html": 1,
        "html_size": 10752,
        "owner_name": "john",
        "owner_email": "john@example.com",
        "created_at": "2024-02-15T00:00:00Z"
      }
    ],
    "enterpriseEndpoints": [
      {
        "id": "uuid",
        "client_id": "uuid",
        "client_name": "Enterprise Corp",
        "status": "active",
        "provider": "openai",
        "model": "gpt-4o",
        "temperature": 0.7,
        "max_tokens": 4096,
        "system_prompt": "You are a helpful assistant...",
        "tools_config": "[{...}]",
        "target_api_url": "https://api.client.com/webhook",
        "webhook_url": "https://mcp.softaware.net.za/v1/enterprise/...",
        "total_requests": 156,
        "created_at": "2024-03-01T00:00:00Z"
      }
    ]
  }
}
```

### `GET /admin/clients/:userId` — Per-Client Detail
**Requires**: `requireAuth` + `requireAdmin`

**Response** `200`:
```json
{
  "success": true,
  "client": {
    "id": "uuid",
    "email": "john@example.com",
    "name": "john",
    "account_status": "active",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-06-01T00:00:00Z"
  },
  "assistants": [
    {
      "id": "uuid",
      "name": "My Bot",
      "description": "Customer support assistant",
      "status": "active",
      "tier": "pro",
      "pages_indexed": 12,
      "business_type": "Service",
      "personality": "Friendly",
      "primary_goal": "Information",
      "website": "https://example.com",
      "lead_capture_email": "leads@example.com",
      "knowledge_categories": "{\"checklist\":[...]}",
      "knowledge_source_count": 3,
      "knowledge_chunk_count": 145,
      "created_at": "2024-01-15T00:00:00Z",
      "updated_at": "2024-06-01T00:00:00Z"
    }
  ],
  "landingPages": [
    {
      "id": "uuid",
      "widget_client_id": "uuid",
      "business_name": "Acme Corp",
      "tagline": "Quality service",
      "contact_email": "info@acme.com",
      "contact_phone": "+27 11 123 4567",
      "status": "deployed",
      "theme_color": "#2563eb",
      "logo_url": "https://...",
      "hero_image_url": "https://...",
      "about_us": "We are a ...",
      "services": "[\"Plumbing\",\"Electrical\"]",
      "ftp_server": "ftp.example.com",
      "ftp_directory": "/public_html",
      "ftp_protocol": "sftp",
      "last_deployed_at": "2024-03-01T00:00:00Z",
      "has_html": 1,
      "html_size": 10752,
      "created_at": "2024-02-15T00:00:00Z",
      "updated_at": "2024-06-01T00:00:00Z"
    }
  ]
}
```

> **Note**: This endpoint does NOT return widgets. Widgets tab was removed from ContactDetails.

### `knowledge_categories` JSON Structure
Stored as JSON string in `assistants.knowledge_categories`:
```json
{
  "checklist": [
    {
      "key": "products",
      "label": "Products/Services",
      "type": "business",
      "satisfied": true
    },
    {
      "key": "faqs",
      "label": "FAQs",
      "type": "support",
      "satisfied": false
    },
    {
      "key": "policies",
      "label": "Policies & Procedures",
      "type": "compliance",
      "satisfied": true
    },
    {
      "key": "contact_info",
      "label": "Contact Information",
      "type": "general",
      "satisfied": true
    }
  ]
}
```
**Health score calculation** (frontend): `satisfied count / total count × 100`

---

## Database Schema: `assistant_knowledge` Table

| Column | Type | Collation | Description |
|--------|------|-----------|-------------|
| `id` | `INT` (PK) | — | Primary key |
| `assistant_id` | `VARCHAR` | `utf8mb4_0900_ai_ci` | FK → `assistants.id` (⚠️ different collation) |
| `source` | `VARCHAR` | — | Knowledge source identifier |
| `content` | `TEXT` | — | Chunk content |
| `embedding` | `BLOB` | — | Vector embedding |
| `created_at` | `DATETIME` | — | Timestamp |

> **Collation note**: `assistants.id` uses `utf8mb4_unicode_ci` while `assistant_knowledge.assistant_id` uses `utf8mb4_0900_ai_ci`. Subqueries joining these must use explicit `COLLATE utf8mb4_0900_ai_ci` on `assistants.id`.

---

## Database Schema: `generated_sites` Table (Key Fields)

| Column | Type | Description |
|--------|------|-------------|
| `id` | `VARCHAR` (PK) | UUID |
| `user_id` | `VARCHAR` | FK → `users.id` |
| `business_name` | `VARCHAR` | Business display name |
| `tagline` | `VARCHAR` | Site tagline |
| `status` | `ENUM` | `draft`, `generating`, `generated`, `deployed`, `failed` |
| `theme_color` | `VARCHAR` | Hex color code |
| `logo_url` | `VARCHAR` | Logo image URL |
| `hero_image_url` | `VARCHAR` | Hero/banner image URL |
| `about_us` | `TEXT` | About section content |
| `services` | `JSON` | Array of service names |
| `contact_email` | `VARCHAR` | Site contact email |
| `contact_phone` | `VARCHAR` | Site contact phone |
| `generated_html` | `LONGTEXT` | Full generated HTML |
| `ftp_server` | `VARCHAR` | FTP deployment server |
| `ftp_protocol` | `VARCHAR` | FTP protocol (ftp/sftp) |
| `last_deployed_at` | `DATETIME` | Last deployment timestamp |
| `created_at` | `DATETIME` | Creation timestamp |
| `updated_at` | `DATETIME` | Last update timestamp |

---

## Database Schema: `enterprise_endpoints` Table (SQLite)

Stored in `/var/opt/backend/data/enterprise_endpoints.db`.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `TEXT` (PK) | UUID |
| `client_id` | `TEXT` | Client user ID |
| `client_name` | `TEXT` | Client display name |
| `status` | `TEXT` | `active`, `paused`, `disabled` |
| `provider` | `TEXT` | LLM provider (openai, anthropic, etc.) |
| `model` | `TEXT` | Model name (gpt-4o, claude-3, etc.) |
| `temperature` | `REAL` | Sampling temperature |
| `max_tokens` | `INTEGER` | Max response tokens |
| `system_prompt` | `TEXT` | System prompt content |
| `tools_config` | `TEXT` | JSON array of tool definitions |
| `target_api_url` | `TEXT` | Client's webhook/API URL |
| `webhook_url` | `TEXT` | Auto-generated MCP webhook URL |
| `total_requests` | `INTEGER` | Lifetime request count |
| `created_at` | `TEXT` | ISO timestamp |
| `updated_at` | `TEXT` | ISO timestamp |

---

## Frontend State (Contacts.tsx)

| State | Type | Default | Description |
|-------|------|---------|-------------|
| `activeTab` | `TabKey` | `'customers'` | Current tab (customers/suppliers/assistants/landingPages/enterpriseEndpoints) |
| `showForm` | `boolean` | `false` | Show CRUD form |
| `editingContact` | `Contact \| null` | `null` | Contact being edited |
| `loading` | `boolean` | `false` | API call in progress |
| `pagination` | `{ page, limit, total }` | `{ 0, 10, 0 }` | Server-side pagination |
| `search` | `string` | `''` | Search query |
| `formData` | `Partial<Contact>` | Empty contact | Form field values |
| `overviewData` | `object \| null` | `null` | Full overview API response (stats + all entities) |
| `chatModal` | `{ open, assistantId, assistantName }` | closed | Streaming chat modal state |
| `chatMessages` | `Array<{role, content}>` | `[]` | Chat conversation history |
| `chatInput` | `string` | `''` | Current chat input |
| `chatStreaming` | `boolean` | `false` | SSE stream in progress |
| `chatHistoryRef` | `Ref<Array>` | `[]` | Persisted conversation for API context |
| `embedModal` | `{ open, assistantId, assistantName }` | closed | Embed code modal state |
| `expandedEndpoint` | `string \| null` | `null` | Currently expanded endpoint card ID |
| `endpointLogs` | `Array` | `[]` | Loaded logs for endpoint |
| `endpointLogsId` | `string \| null` | `null` | Endpoint ID whose logs modal is open |

## Frontend State (ContactDetails.tsx)

| State | Type | Default | Description |
|-------|------|---------|-------------|
| `activeTab` | `union` | `'overview'` | Current tab — customers: overview/invoices/quotations/statement/assistants/landing-pages; suppliers: overview/expenses/documentation |
| `contact` | `Contact \| null` | `null` | Loaded contact data |
| `statementData` | `StatementData \| null` | `null` | Statement with aging analysis |
| `invoices` | `Invoice[]` | `[]` | Contact's invoices |
| `quotations` | `Quotation[]` | `[]` | Contact's quotations |
| `loading` | `boolean` | `false` | API call in progress |
| `clientDetail` | `any \| null` | `null` | Enriched client data from `AdminClientModel.getClient()` |
| `linkedUserId` | `string \| null` | `null` | User ID linked to this contact via `users.contact_id` |
| `supplierExpenses` | `any[]` | `[]` | Expense transactions for supplier contacts (from `transactions_vat`) |
| `supplierExpenseSummary` | `{ total_expenses, total_vat, total_exclusive, count }` | `{ 0, 0, 0, 0 }` | Aggregated expense summary for supplier contacts |
| `chatModal` | `{ id, name } \| null` | `null` | Open chat modal for assistant |
| `chatMessages` | `Array<{id, role, content}>` | `[]` | Chat conversation messages |
| `chatInput` | `string` | `''` | Current chat input text |
| `chatStreaming` | `boolean` | `false` | SSE stream in progress |
| `chatEndRef` | `Ref<HTMLDivElement>` | — | Auto-scroll target |
| `chatInputRef` | `Ref<HTMLTextAreaElement>` | — | Chat input focus ref |
| `chatHistoryRef` | `Ref<Record<string, Array>>` | `{}` | Persisted conversation history per assistant |
| `prevChatIdRef` | `Ref<string>` | — | Tracks previous chat modal assistant ID |
| `embedModal` | `{ id, name } \| null` | `null` | Open embed code modal |
| `embedCopied` | `boolean` | `false` | Embed code copied to clipboard |

## Zustand Store Fields
| Field | Type | Description |
|-------|------|-------------|
| `customers` | `Contact[]` | Current page of customer contacts |
| `suppliers` | `Contact[]` | Current page of supplier contacts |
| `setCustomers` | `function` | Update customers array |
| `setSuppliers` | `function` | Update suppliers array |
