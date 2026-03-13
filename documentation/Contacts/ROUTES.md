# Contacts — Route & API Reference

## Route Registration

**Backend mount points**:
```
src/routes/contacts.ts           → /v1/contacts       (authMiddleware)
src/routes/contactFormRouter.ts  → /v1/leads           (NO auth)
src/routes/adminClientManager.ts → /admin/clients      (authMiddleware + requireAdmin)
src/routes/siteBuilder.ts        → /v1/sites           (authMiddleware) — preview endpoint relevant
```

---

## Authenticated Routes (contacts.ts)

All routes require valid JWT via `authMiddleware`.

### 1. GET `/v1/contacts`
**Purpose**: List contacts with pagination and search  
**Auth**: JWT required  
**Permissions**: Frontend gates with `contacts.view`; backend has no check  
**Query params**: `page` (default 1), `limit` (default 50), `search` (partial match)

**Flow**:
1. Extract `page`, `limit`, `search` from `req.query`
2. Build `COUNT(*)` query; if `search`, apply `LIKE` on `company_name`, `contact_person`, `email`
3. Execute paginated `SELECT` using `CONTACT_SELECT` alias fragment, `WHERE active = 1`, `ORDER BY company_name ASC`
4. Return `{ success, data, pagination: { page, limit, total } }`

**SQL**:
```sql
SELECT {CONTACT_SELECT} FROM contacts
WHERE active = 1 [AND (company_name LIKE ? OR contact_person LIKE ? OR email LIKE ?)]
ORDER BY company_name ASC
LIMIT ? OFFSET ?
```

---

### 2. GET `/v1/contacts/:id`
**Purpose**: Get single contact by ID  
**Auth**: JWT required  
**Params**: `id` (route param)

**Flow**:
1. `SELECT {CONTACT_SELECT} FROM contacts WHERE id = ? AND active = 1`
2. If not found → `404 { success: false, message: 'Contact not found' }`
3. Return `{ success: true, data: contact }`

---

### 3. POST `/v1/contacts`
**Purpose**: Create a new contact  
**Auth**: JWT required  
**Permissions**: Frontend gates with `contacts.create`; backend has no check  
**Body**: Validated with `createContactSchema` (Zod)

**Flow**:
1. Validate `req.body` against `createContactSchema`
2. On validation failure → `400 { success: false, errors: zodErrors }`
3. `INSERT INTO contacts SET ?` with validated data
4. Fetch newly created contact using `insertId`
5. Return `201 { success: true, data: newContact }`

---

### 4. PUT `/v1/contacts/:id`
**Purpose**: Update an existing contact  
**Auth**: JWT required  
**Permissions**: Frontend gates with `contacts.edit`; backend has no check  
**Params**: `id` (route param)  
**Body**: Validated with `updateContactSchema` (partial)

**Flow**:
1. Validate `req.body` against `updateContactSchema`
2. On validation failure → `400`
3. `UPDATE contacts SET ? WHERE id = ?`
4. Fetch updated contact
5. Return `200 { success: true, data: updatedContact }`

---

### 5. DELETE `/v1/contacts/:id`
**Purpose**: Soft-delete a contact (set `active = 0`)  
**Auth**: JWT required  
**Permissions**: Frontend gates with `contacts.delete`; backend has no check  
**Params**: `id` (route param)

**Flow**:
1. `UPDATE contacts SET active = 0 WHERE id = ?`
2. Return `200 { success: true, message: 'Contact deleted' }`

---

### 6. GET `/v1/contacts/:id/quotations`
**Purpose**: List quotations linked to a contact  
**Auth**: JWT required  
**Params**: `id` (route param)

**Flow**:
1. Query `quotations` table joined with `contacts`:
```sql
SELECT q.id AS quotation_id, q.contact_id AS quotation_contact_id,
       q.quotation_number, q.total AS quotation_total,
       q.date AS quotation_date, q.valid_until AS quotation_valid_until,
       q.notes AS quotation_notes, q.status AS quotation_status,
       c.company_name AS contact_name
FROM quotations q
LEFT JOIN contacts c ON q.contact_id = c.id
WHERE q.contact_id = ? AND q.active = 1
ORDER BY q.date DESC
```
2. Return `{ success: true, data: quotations }`

---

### 7. GET `/v1/contacts/:id/invoices`
**Purpose**: List invoices linked to a contact  
**Auth**: JWT required  
**Params**: `id` (route param)

**Flow**:
1. Query `invoices` table joined with `contacts`:
```sql
SELECT i.id AS invoice_id, i.contact_id AS invoice_contact_id,
       i.invoice_number, i.total AS invoice_total,
       i.date AS invoice_date, i.due_date AS invoice_due_date,
       i.payment_status AS invoice_payment_status,
       i.notes AS invoice_notes, i.active,
       i.quote_id AS invoice_quote_id,
       c.company_name AS contact_name
FROM invoices i
LEFT JOIN contacts c ON i.contact_id = c.id
WHERE i.contact_id = ? AND i.active = 1
ORDER BY i.date DESC
```
2. Return `{ success: true, data: invoices }`

---

## Admin Routes (adminClientManager.ts)

All routes require `requireAuth` + `requireAdmin`.

### 8. GET `/admin/clients/overview`
**Purpose**: Aggregated stats + full entity lists for the 5-tab Contacts hub  
**Auth**: JWT + admin role required

**Flow**:
1. Query `users` excluding admin/staff via `NOT IN` subquery on `user_roles`
2. Query `assistants` with `LEFT JOIN users`, include `personality`, `primary_goal`, `business_type`, `knowledge_categories`, plus subqueries:
   - `knowledge_source_count`: `SELECT COUNT(DISTINCT ak.source) FROM assistant_knowledge ak WHERE ak.assistant_id = a.id COLLATE utf8mb4_0900_ai_ci`
   - `knowledge_chunk_count`: `SELECT COUNT(*) FROM assistant_knowledge ak WHERE ak.assistant_id = a.id COLLATE utf8mb4_0900_ai_ci`
3. Query `widget_clients` with `LEFT JOIN users`
4. Query `generated_sites` with `LEFT JOIN users`, include `logo_url`, `hero_image_url`, `about_us`, `services`, `last_deployed_at`, `generated_html IS NOT NULL AS has_html`, `LENGTH(generated_html) AS html_size`
5. Query enterprise endpoints from SQLite via `getAllEndpoints()`
6. Compute aggregate stats (totals, active counts, contact counts with `COALESCE(contact_type, 1)`)
7. Return `{ success: true, data: { stats, clients, assistants, widgets, landingPages, enterpriseEndpoints } }`

**Collation note**: Subqueries on `assistant_knowledge` must use `a.id COLLATE utf8mb4_0900_ai_ci` because `assistants.id` is `utf8mb4_unicode_ci` while `assistant_knowledge.assistant_id` is `utf8mb4_0900_ai_ci`.

---

### 9. GET `/admin/clients/:userId`
**Purpose**: Single client detail with enriched assistant and landing page data — used by ContactDetails.tsx  
**Auth**: JWT + admin role required

**Flow**:
1. Query `users` table for the specified `userId`
2. If not found → `404 { success: false, error: 'User not found' }`
3. Query `assistants` with enriched fields:
   - `name`, `description`, `status`, `tier`, `pages_indexed`
   - `business_type`, `personality`, `primary_goal`, `website`, `lead_capture_email`
   - `knowledge_categories` (JSON)
   - `knowledge_source_count`: `SELECT COUNT(DISTINCT ak.source) FROM assistant_knowledge ak WHERE ak.assistant_id = a.id COLLATE utf8mb4_0900_ai_ci`
   - `knowledge_chunk_count`: `SELECT COUNT(*) FROM assistant_knowledge ak WHERE ak.assistant_id = a.id COLLATE utf8mb4_0900_ai_ci`
4. Query `generated_sites` with:
   - `business_name`, `tagline`, `contact_email`, `contact_phone`, `status`, `theme_color`
   - `logo_url`, `hero_image_url`, `about_us`, `services`
   - `ftp_server`, `ftp_directory`, `ftp_protocol`, `last_deployed_at`
   - `has_html` (boolean), `html_size` (bytes)
5. Return `{ success: true, client, assistants, landingPages }`

**Note**: This endpoint does NOT return widgets (removed). Replaces older version that only returned basic assistant data + widgets.

---

### 10. PATCH `/admin/clients/:userId/status`
**Purpose**: Master kill switch — update user account status  
**Auth**: JWT + admin role required  
**Body**: `{ status: 'active' | 'suspended' | 'demo_expired' }`

---

### 11. PATCH `/admin/clients/assistants/:assistantId/status`
**Purpose**: Update individual assistant status  
**Auth**: JWT + admin role required

---

### 12. PATCH `/admin/clients/widgets/:widgetId/status`
**Purpose**: Update individual widget status  
**Auth**: JWT + admin role required

---

### Enterprise Endpoint Admin Routes (in adminClientManager.ts)

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/admin/clients/endpoints` | Create new enterprise endpoint |
| `PUT` | `/admin/clients/endpoints/:id` | Update endpoint config |
| `DELETE` | `/admin/clients/endpoints/:id` | Delete endpoint |
| `PATCH` | `/admin/clients/endpoints/:id/status` | Toggle endpoint status (active/paused) |
| `GET` | `/admin/clients/endpoints/:id/logs` | Fetch request logs for endpoint |

---

## Site Preview Route (siteBuilder.ts)

### 13. GET `/v1/sites/:siteId/preview`
**Purpose**: Serve generated HTML for landing page preview  
**Auth**: JWT required (via header OR `?token=` query param)

**Flow**:
1. Extract JWT from `Authorization` header or `req.query.token`
2. Verify token, extract `userId`
3. Query `generated_sites` for `siteId`
4. **Owner check**:
   - If `site.user_id === userId` → allowed
   - Else: query `user_roles` + `roles` tables for admin/super_admin role
   - If admin → allowed
   - Else → `403 { error: 'Access denied' }`
5. Remove CSP and X-Frame-Options headers (required for iframe preview)
6. Return `200` with `generated_html` content, `Content-Type: text/html`

---

## Public Routes (contactFormRouter.ts)

### 14. POST `/v1/leads/submit`
**Purpose**: Public contact form submission  
**Auth**: NONE  
**Rate limit**: 5 requests/minute per IP (in-memory Map)

**Flow**:
1. **Rate limit check**: Track `{ count, firstRequest }` per `req.ip` in `Map<string, RateLimitEntry>`. If `count ≥ 5` within 60 seconds → `429` response.
2. **Honeypot check**: If `req.body.honeypot` has a truthy value → silently return `200` success (bot detected).
3. **Validate fields**: `client_id`, `name`, `email`, `message` must be present → `400` if missing.
4. **Email format check**: Regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` → `400` if invalid.
5. **Owner email lookup cascade**:
   ```
   generated_sites (WHERE client_id = ?) → get owner email
   ↓ if not found
   widget_clients (WHERE client_id = ?) → get email
   ↓ if not found
   users (WHERE id = ?) → get email
   ↓ if all fail → 404
   ```
6. **Send email via SMTP** (nodemailer):
   - From: `process.env.SMTP_FROM`
   - To: resolved owner email
   - Subject: `"New Contact Form Submission from {name}"`
   - HTML body with formatted message
7. Return `200 { success: true, message: "Thank you..." }`

---

### 15. GET `/v1/leads/test`
**Purpose**: Health check endpoint  
**Auth**: NONE  
**Response**: `200 { success: true, message: 'Contact form router is working' }`

---

## Frontend Route Mapping

| URL Path | Component | File |
|----------|-----------|------|
| `/contacts` | `Contacts` | `src/pages/contacts/Contacts.tsx` |
| `/contacts/:id` | `ContactDetails` | `src/pages/contacts/ContactDetails.tsx` |

---

## Frontend → Backend API Calls

| Frontend Action | Model / Method | HTTP Request | Backend Handler |
|----------------|--------------|--------------|-----------------|
| Load customer/supplier list | `ContactModel.getAll(type, page, search)` | `GET /v1/contacts?page=&search=` | `contacts.ts` GET `/` |
| View contact detail | `ContactModel.getById(id)` | `GET /v1/contacts/:id` | `contacts.ts` GET `/:id` |
| Create contact | `ContactModel.create(data)` | `POST /v1/contacts` | `contacts.ts` POST `/` |
| Edit contact | `ContactModel.update(id, data)` | `PUT /v1/contacts/:id` | `contacts.ts` PUT `/:id` |
| Delete contact | `ContactModel.delete(id)` | `DELETE /v1/contacts/:id` | `contacts.ts` DELETE `/:id` |
| Load overview data | `AdminClientModel.getOverview()` | `GET /admin/clients/overview` | `adminClientManager.ts` GET `/overview` |
| Toggle endpoint status | `AdminEnterpriseModel.updateStatus(id, status)` | `PATCH /admin/clients/endpoints/:id/status` | `adminClientManager.ts` PATCH `/endpoints/:id/status` |
| Fetch endpoint logs | `AdminEnterpriseModel.getLogs(id)` | `GET /admin/clients/endpoints/:id/logs` | `adminClientManager.ts` GET `/endpoints/:id/logs` |
| Preview landing page | Direct `window.open()` | `GET /v1/sites/:siteId/preview?token=JWT` | `siteBuilder.ts` GET `/:siteId/preview` |
| Chat with assistant | Direct `fetch()` SSE | `POST /v1/assistants/:id/chat` | `assistantRoutes.ts` |
| Load client detail (ContactDetails) | `AdminClientModel.getClient(userId)` | `GET /admin/clients/:userId` | `adminClientManager.ts` GET `/:userId` |
| Chat with assistant (ContactDetails) | Direct `fetch()` SSE | `POST /v1/assistants/:id/chat` | `assistantRoutes.ts` |
| Preview landing page (ContactDetails) | Direct `window.open()` | `GET /v1/sites/:siteId/preview?token=JWT` | `siteBuilder.ts` GET `/:siteId/preview` |
| Load statement data | `ContactModel.getStatementData(id)` | `GET /v1/contacts/:id/statement-data` | *(separate route)* |
| Download statement PDF | `ContactModel.downloadStatement(id, params)` | `GET /v1/contacts/:id/statement/download` | *(separate route)* |

---

## Permission Matrix

| Action | Permission Key | Enforcement |
|--------|---------------|-------------|
| View contacts list | `contacts.view` | Frontend `<Can>` only |
| Create contact | `contacts.create` | Frontend `<Can>` only |
| Edit contact | `contacts.edit` | Frontend `<Can>` only |
| Delete contact | `contacts.delete` | Frontend `<Can>` only |
| View contact details | `contacts.view` | Frontend `<Can>` only |
| Admin overview/tabs | Admin role | `requireAdmin` middleware |
| Site preview (own) | JWT owner | Backend `site.user_id === userId` |
| Site preview (admin) | Admin role | Backend `user_roles` + `roles` check |
| Endpoint management | Admin role | `requireAdmin` middleware |
| Submit contact form | *(none)* | Public endpoint |

> ⚠️ **Contact CRUD has no backend permission enforcement.** All authorization is frontend-only.  
> ✅ **Admin routes** enforce role via `requireAdmin` middleware.  
> ✅ **Site preview** enforces ownership OR admin role at the backend level.
