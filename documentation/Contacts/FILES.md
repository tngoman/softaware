# Contacts — File Inventory

## Backend Files

### `/var/opt/backend/src/routes/contacts.ts` (464 LOC)
**Purpose**: Authenticated CRUD for contacts plus per-contact invoice, quotation, and expense listing.

| Section | Lines | Description |
|---------|-------|-------------|
| Imports | 1–6 | Express Router, Zod, `db`, `requireAuth`, `httpErrors`, `Contact` type |
| `createContactSchema` | 8–19 | Zod: `company_name` (required), `contact_person?`, `email?`, `phone?`, `fax?`, `website?`, `location?`, `contact_code?`, `remarks?`, `active` (default 1) |
| `updateContactSchema` | 21 | `createContactSchema.partial()` |
| `CONTACT_SELECT` | 23–35 | SQL alias fragment: maps DB columns → frontend interface names. Also adds hardcoded `contact_type = 1`. |
| `GET /contacts` | 37–72 | List contacts with pagination (`page`, `limit`, `search`). Filters `active = 1`. Searches `company_name`, `contact_person`, `email`. Returns `{ data, pagination }`. |
| `GET /contacts/:id` | 74–88 | Single contact by ID. Returns 404 if not found. |
| `POST /contacts` | 90–112 | Create contact. Zod-validates, uses `db.insertOne()`, returns created record. |
| `PUT /contacts/:id` | 114–140 | Update contact. Partial validation, checks existence, updates with timestamp. |
| `DELETE /contacts/:id` | 142–164 | Soft delete: sets `active = 0`, updates timestamp. |
| `GET /contacts/:id/quotations` | 166–196 | All quotations for contact. Joins `quotations` + `contacts`. Calculates `valid_until` as `quotation_date + 30 days`. |
| `GET /contacts/:id/invoices` | 198–240 | All invoices for contact. Joins `invoices` + `contacts`. Returns payment status and related fields. |
| `GET /contacts/:id/expenses` | 409–464 | All expense transactions for a supplier contact. Looks up `company_name`, queries `transactions_vat` where `party_name` matches. JOINs `tb_expense_categories` for category names. Returns expenses array + summary (total_expenses, total_vat, total_exclusive, count). |

---

### `/var/opt/backend/src/routes/adminClientManager.ts` (451 LOC)
**Purpose**: Admin-only overview API returning aggregated stats and full entity lists for the 5-tab Contacts hub, plus per-client detail for ContactDetails.

| Section | Lines | Description |
|---------|-------|-------------|
| Imports | 1–18 | Express, Zod, `db`, `requireAuth`, `requireAdmin`, `signAccessToken`, `buildFrontendUser`, `getAllEndpoints` (SQLite) |
| Validation schemas | 27–40 | `statusSchema` (active/suspended/demo_expired), `updateAccountStatusSchema`, `updateAssistantStatusSchema`, `updateWidgetStatusSchema` |
| `GET /overview` | 45–130 | **Main overview endpoint**: queries users, assistants (with `knowledge_categories`, `knowledge_source_count`, `knowledge_chunk_count` subqueries), widgets, landing pages (with `logo_url`, `hero_image_url`, `about_us`, `services`, `has_html`, `html_size`), enterprise endpoints (SQLite). Computes aggregate stats. Uses `COLLATE utf8mb4_0900_ai_ci` on assistant_knowledge subqueries. |
| `GET /:userId` | 155–207 | **Per-client detail**: enriched assistant data (personality, primary_goal, business_type, website, lead_capture_email, knowledge_categories, knowledge_source_count, knowledge_chunk_count) + landing pages (logo, hero, about, services, FTP details, has_html, html_size). No widgets. Used by ContactDetails.tsx. |
| `PATCH /:userId/status` | 209–240 | Master kill switch: update user's `account_status` |
| `PATCH /assistants/:assistantId/status` | 242–275 | Update individual assistant status |
| `PATCH /widgets/:widgetId/status` | 277–310 | Update individual widget status |
| Enterprise endpoint routes | 310–451 | CRUD for enterprise endpoints: create, update, delete, status toggle, logs |

**Key queries**:
- Users: excludes admin/staff roles via `NOT IN` subquery on `user_roles`
- Assistants (overview): `LEFT JOIN users`, includes `personality`, `primary_goal`, `business_type`, `knowledge_categories`, plus subqueries for `COUNT(DISTINCT ak.source)` and `COUNT(*)` from `assistant_knowledge`
- Assistants (per-client `GET /:userId`): same enriched fields + `website`, `lead_capture_email`, `knowledge_source_count`, `knowledge_chunk_count` (with COLLATE). No widgets returned.
- Landing pages: includes `logo_url`, `hero_image_url`, `about_us`, `services`, `last_deployed_at`, `generated_html IS NOT NULL AS has_html`, `LENGTH(generated_html) AS html_size`, `ftp_server`, `ftp_directory`, `ftp_protocol`
- Contact stats: `COALESCE(contact_type, 1) = 1` for customers, `contact_type = 2` for suppliers

---

### `/var/opt/backend/src/routes/siteBuilder.ts` (1341 LOC) — Preview endpoint
**Purpose**: Full site builder with generation, deployment, and preview. Relevant to Contacts module for the **admin preview bypass**.

| Section | Lines | Description |
|---------|-------|-------------|
| `GET /:siteId/preview` | 218–260 | Serves generated HTML. Auth via header or `?token=` query param. **Admin bypass**: if `site.user_id !== userId`, checks `user_roles` for admin/super_admin role before returning 403. Removes CSP and X-Frame-Options headers for preview rendering. |

---

### `/var/opt/backend/src/routes/contactFormRouter.ts` (215 LOC)
**Purpose**: Public (no auth) endpoint for website contact form submissions with rate limiting and email forwarding.

| Section | Lines | Description |
|---------|-------|-------------|
| Imports | 1–4 | Express, `db`, `env`, `nodemailer` |
| Rate limit setup | 6–30 | In-memory `Map<IP, timestamps[]>`. 5 requests/minute per IP. |
| `POST /v1/leads/submit` | 32–185 | Full contact form handler: rate limit → honeypot → validation → email regex → site owner lookup cascade → SMTP send → success. |
| `GET /v1/leads/test` | 187–215 | Health check endpoint. |

---

## Frontend Files

### `/var/opt/frontend/src/pages/contacts/Contacts.tsx` (1431 LOC)
**Purpose**: 5-tab admin hub — the central management interface for all client assets.

| Section | Lines (approx) | Description |
|---------|-------|-------------|
| Imports | 1–20 | React, Router, Heroicons (24+ icons), TanStack Table, models (Contact, AdminClient, AdminEnterprise), store, types, UI components, SweetAlert2, `API_BASE_URL` |
| Type & StatusBadge | 22–45 | `TabKey` union type, inline `StatusBadge` component with icon/color map for active/deployed/paused/suspended/generating/failed |
| State declarations | 46–95 | `activeTab`, `showForm`, `editingContact`, pagination, search, `overviewData`, chat modal state (messages, input, streaming, refs), embed modal state, endpoint logs state, expanded endpoint state |
| `loadContacts()` | ~96–120 | Server-side paginated contacts via `ContactModel.getAll()` |
| `loadOverviewData()` | ~121–135 | Calls `AdminClientModel.getOverview()`, sets `overviewData` |
| `handleSubmit()` | ~136–160 | Contact create/update via `ContactModel` |
| `handleDelete()` | ~161–180 | Contact soft-delete with SweetAlert confirmation |
| Table columns | ~181–450 | TanStack column defs for customer/supplier DataTable |
| Enterprise helpers | ~451–475 | `copyWebhookUrl()`, `handleEndpointStatusToggle()` |
| Tab definitions | ~476–485 | 5 tabs with icons and counts from overview stats |
| **`renderAssistants()`** | ~486–660 | Rich card grid: parses `knowledge_categories` JSON, calculates health score, renders 2×2 info grid (Personality/Primary Goal/Business Type/Pages Indexed), Knowledge Health Score with progress bar + checklist, Knowledge Base stats (Sources/Pages/Chunks), owner info, Chat/Embed/Link buttons |
| **`renderLandingPages()`** | ~661–830 | Rich card grid: hero image with gradient overlay (or theme color fallback), status + theme swatch, tagline, stats row (HTML size/services/deployed), info grid (contact/phone/deployment), Preview button (JWT-authenticated), Live Site link, ID copy |
| **`renderEndpoints()`** | ~831–1050 | Rich card grid: LLM config grid (provider/model/temp/tokens), stats row (requests/target API/tools), webhook URL box, expandable system prompt, action buttons (Webhook copy/Logs/Pause-Activate/More-Less), **logs modal** with payload viewer |
| Contact form view | ~1051–1170 | 3-column CRUD form for contacts |
| Main list view | ~1171–1431 | Gradient header, search bar, 5 tab navigation with counts, conditional tab content rendering |

**Chat Modal** (embedded in component): SSE streaming via `fetch()` to `/v1/assistants/:id/chat`, conversation history persisted in `chatHistoryRef`, auto-scroll, message rendering with user/assistant avatars.

**Embed Modal** (embedded in component): Generates `<script>` embed code and direct chat URL.

**Endpoint Logs Modal** (embedded in component): Fetches logs via `AdminEnterpriseModel.getLogs()`, displays timestamp/duration/status per log entry, expandable JSON payload viewer.

---

### `/var/opt/frontend/src/pages/contacts/ContactDetails.tsx` (1956 LOC)
**Purpose**: Rich contact detail page with type-aware tab interface — customers get 6 tabs (financial overview, invoices, quotations, statement, AI assistants, landing pages); suppliers get 3 tabs (expense overview, expenses DataTable, documentation).

| Section | Lines (approx) | Description |
|---------|-------|-------------|
| Imports | 1–46 | React (useState, useEffect, useRef), Router, Heroicons (30+ icons), models (Contact, Invoice, Quotation, AdminClient, Auth), store, types, UI components, formatters, `API_BASE_URL`, SweetAlert2 |
| Interfaces | 48–72 | `Transaction`, `StatementData` (with aging analysis) |
| StatusBadge component | 74–88 | Inline status badge with icon/color map for active/suspended/demo_expired |
| State declarations | 90–115 | `contact`, `statementData`, `invoices`, `quotations`, `loading`, `activeTab` (6-tab union), `clientDetail`, `linkedUserId`, chat modal state (messages/input/streaming/refs), embed modal state |
| Data loading | 117–200 | Loads contact + invoices + quotations + statement + linked user lookup (`users.contact_id`) + `AdminClientModel.getClient(userId)` for enriched AI data |
| Chat/embed helpers | 200–340 | `sendChatMessage()` (SSE streaming via fetch), `handleChatKeyDown()`, `getEmbedCode()`, `copyToClipboard()`, `parseKnowledgeCategories()`, `formatSize()` |
| Financial calculations | 340–400 | `calculateTotals()` for overview stats |
| Header | 515–600 | Gradient banner with contact info, user avatar, company details |
| Tab navigation | 630–690 | 6-tab bar: Overview, Invoices, Quotations, Statement, Assistants (count badge), Landing Pages (count badge) |
| Overview tab | 700–780 | Financial summary cards + recent invoices table |
| Invoices tab | 780–830 | Full invoices DataTable |
| Quotations tab | 830–860 | Full quotations DataTable |
| **Assistants tab** | 860–1030 | Rich card grid: 2×2 info grid (Personality/Primary Goal/Business Type/Pages Indexed), Knowledge Health Score (progress bar + checklist), Knowledge Base stats (Sources/Pages/Chunks), meta info (website, lead capture email, timestamps), status dropdown, Chat/Embed/Link action buttons |
| **Landing Pages tab** | 1032–1185 | Rich card grid: hero image with gradient overlay (or theme color fallback), status badges + theme swatch, tagline/about, stats grid (HTML size/services/deployed), info grid (contact/phone/FTP deployment), Preview/Live Site/ID action buttons |
| Supplier state | 138–139 | `supplierExpenses` (any[]), `supplierExpenseSummary` ({ total_expenses, total_vat, total_exclusive, count }) |
| `loadSupplierExpenses()` | 288–297 | Calls `ContactModel.getExpenses(id)`, sets `supplierExpenses` and `supplierExpenseSummary` |
| `expenseColumns` | 600–680 | 7-column TanStack Table definition: Date, Invoice #, Category, Excl. Amount, VAT, Total, VAT Type (with color-coded badges for Standard/Zero-rated/Exempt) |
| **Supplier Overview tab** | 1500–1615 | 3-tab navigation (Overview/Expenses/Documentation) + summary cards (Total Expenses, Excl. Amount, VAT, Transaction Count) + recent expenses list (top 5) |
| **Supplier Expenses tab** | 1620–1635 | Full DataTable with `expenseColumns` and `supplierExpenses` data |
| **Supplier Documentation tab** | 1636–1660 | Markdown renderer for supplier documentation |
| **Chat Modal** | 1192–1275 | Full SSE streaming chat: conversation history, auto-scroll, typing indicators, clear button, message bubbles with user/assistant avatars |
| **Embed Modal** | 1277–1317 | Embed code snippet (`<script>` tag), direct chat URL, copy button |

**Chat Modal**: SSE streaming via `fetch()` to `/v1/assistants/:id/chat`, conversation history persisted in `chatHistoryRef`, auto-scroll, message rendering with user/assistant avatars.

**Embed Modal**: Generates `<script>` embed code and direct chat URL.

**Data flow**: Contact → `users.contact_id` → `linkedUserId` → `AdminClientModel.getClient(userId)` → `{ client, assistants, landingPages }`

---

### `/var/opt/frontend/src/pages/admin/EnterpriseEndpoints.tsx` (642 LOC)
**Purpose**: Original standalone enterprise endpoints management page. Full functionality now also available as the Enterprise Endpoints tab in Contacts.tsx.

| Section | Lines | Description |
|---------|-------|-------------|
| StatusBadge | 24–42 | Inline status badge (active/paused/disabled) |
| State & CRUD | 60–215 | Endpoints list, create/edit form state, save/delete/status toggle handlers |
| Endpoints table | 216–370 | Professional table with expandable detail rows (system prompt, target API, auth, tools, webhook URL) |
| Create/Edit modal | 371–580 | Full form: client info (ID/name/linked contact), provider config, LLM config (model/temp/tokens), system prompt, tools config (JSON), target API config |
| Logs modal | 581–642 | Request logs with timestamp, duration, status, error message, expandable payload |

---

### `/var/opt/frontend/src/models/ContactModel.ts` (98 LOC)
**Purpose**: Static API wrapper class for contact endpoints.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `getAll(type?, params?)` | `GET /contacts` | List contacts with pagination |
| `getById(id)` | `GET /contacts/:id` | Single contact |
| `create(contact)` | `POST /contacts` | Create contact |
| `update(id, contact)` | `PUT /contacts/:id` | Update contact |
| `delete(id)` | `DELETE /contacts/:id` | Soft delete |
| `getStatementData(id)` | `GET /contacts/:id/statement-data` | Statement transactions + aging |
| `downloadStatement(id)` | `GET /contacts/:id/statement` | PDF generation |
| `getExpenses(id)` | `GET /contacts/:id/expenses` | Supplier expense transactions + summary |
