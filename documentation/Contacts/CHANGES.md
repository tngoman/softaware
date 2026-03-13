# Contacts — Changelog & Pending Changes

## Recent Changes (Latest First)

### 2025-06 — Package System Integration (contact_type + user_contact_link)
- **Added `contact_type` column** to `contacts` table via migration 023:
  - `0` = Standard external company
  - `1` = Individual / sole proprietor
  - `2` = Partner / reseller
  - `3` = Internal / provider (Soft Aware)
- **Created `user_contact_link` table** — maps users to contacts (companies) with roles (OWNER, ADMIN, MEMBER, STAFF)
  - Unique constraint: `(user_id, contact_id)` — one link per user per contact
  - Roles determine billing and access scope within the Packages system
- **Contact ID 1 (Soft Aware)** designated as internal provider account (`contact_type = 3`)
  - Assigned Staff package (ID 7) with 100,000 credits
  - All Soft Aware staff users linked via `user_contact_link` with `role = 'STAFF'`
- **Package associations**: Contacts now have `contact_packages` subscriptions with credit balances
  - `contact_packages` table: `contact_id → packages.id` with credit tracking
  - `package_transactions` table: full credit transaction audit trail per contact
- **Cross-reference**: See [Packages documentation](../Packages/README.md) for full system details
- **CONT-005 partially resolved**: `contact_type` now stored in DB (values 0–3) instead of hardcoded to 1. The `CONTACT_SELECT` fragment still needs updating to select `contact_type` dynamically.

### 2025-06 — ContactDetails.tsx Overhaul (Rich Cards + Widgets Removal)
- **Widgets tab removed** entirely — nav button, tab content, `handleWidgetStatus` handler, `ShieldCheckIcon` import all deleted
- Tabs reduced from 7 to 6: Overview, Invoices, Quotations, Statement, Assistants, Landing Pages
- `activeTab` type updated: removed `'widgets'` from union
- **Assistants tab** replaced with rich card grid (same pattern as admin hub):
  - 2×2 info grid: Personality, Primary Goal, Business Type, Pages Indexed
  - Knowledge Health Score: progress bar + checklist from `knowledge_categories` JSON
  - Knowledge Base stats: Sources, Pages, Chunks
  - Meta info: website, lead capture email, created/updated timestamps
  - Status dropdown for active/suspended toggle
  - Action buttons: Chat (SSE streaming modal), Embed (code snippet modal), Link (copy URL)
- **Landing Pages tab** replaced placeholder with rich card grid:
  - Hero image with gradient overlay (or theme color fallback)
  - Status badges + theme color swatch
  - Tagline/about preview
  - Stats grid: HTML size (KB), services count, deployment status
  - Info grid: contact email, phone, FTP deployment path
  - Action buttons: Preview (JWT-authenticated), Live Site link, ID copy
- **Chat Modal** added: SSE streaming via `fetch()` to `/v1/assistants/:id/chat`, conversation history persisted in `chatHistoryRef` per assistant, auto-scroll, clear chat button
- **Embed Modal** added: `<script>` embed code snippet + direct chat URL with copy button
- New helper functions: `parseKnowledgeCategories()`, `formatSize()`, `sendChatMessage()`, `handleChatKeyDown()`, `getEmbedCode()`, `copyToClipboard()`
- New state: `chatModal`, `chatMessages`, `chatInput`, `chatStreaming`, `chatEndRef`, `chatInputRef`, `chatHistoryRef`, `prevChatIdRef`, `embedModal`, `embedCopied`
- New imports: `useRef`, ~15 Heroicons (SparklesIcon, RocketLaunchIcon, PauseCircleIcon, ClipboardDocumentIcon, XMarkIcon, PaperAirplaneIcon, UserCircleIcon, CodeBracketIcon, CheckIcon, TrashIcon, EyeIcon, DocumentMagnifyingGlassIcon)

### 2025-06 — GET /admin/clients/:userId Enrichment
- **Assistants query enriched** to match overview endpoint:
  - Added: `personality`, `primary_goal`, `business_type`, `website`, `lead_capture_email`, `knowledge_categories` (JSON)
  - Added subqueries: `knowledge_source_count` (`COUNT(DISTINCT ak.source)`), `knowledge_chunk_count` (`COUNT(*)`)
  - COLLATE fix applied: `a.id COLLATE utf8mb4_0900_ai_ci` on assistant_knowledge subqueries
- **Landing pages query added** (new — endpoint previously had no landing page data):
  - Fields: `business_name`, `tagline`, `contact_email`, `contact_phone`, `status`, `theme_color`, `logo_url`, `hero_image_url`, `about_us`, `services`, `ftp_server`, `ftp_directory`, `ftp_protocol`, `last_deployed_at`, `has_html`, `html_size`
- **Widgets query removed** from response — response shape changed from `{ client, assistants, widgets }` to `{ client, assistants, landingPages }`

### 2025-06 — Enterprise Endpoints Tab (Rich Cards)
- Replaced simple endpoint list with rich card grid in Contacts.tsx
- Each card shows: LLM config grid (provider/model/temperature/max tokens), stats row (requests/target API/tools count), webhook URL highlight box, expandable system prompt
- Added action buttons: Copy Webhook URL, View Logs, Pause/Activate toggle, More/Less expand
- Added **logs modal** with per-entry timestamp, duration (ms), status badge, expandable JSON payload viewer
- Inline status toggle (active ↔ paused) with immediate data refresh

### 2025-06 — Landing Pages Tab (Rich Cards + Preview)
- Replaced simple landing page list with rich card grid
- Hero image header with gradient overlay (or theme color fallback if no image)
- Stats row: HTML size (KB), services count, deployment status
- Info grid: contact email, phone, FTP deployment path
- **Preview button**: Opens site HTML in new tab via `GET /v1/sites/:siteId/preview?token=JWT`
- **Live Site link**: Direct link to deployed site URL
- ID copy button for site reference

### 2025-06 — Site Preview Admin Bypass
- Admin users can now preview any user's landing page (not just their own)
- Backend `siteBuilder.ts` preview endpoint: if `site.user_id !== userId`, checks `user_roles` + `roles` tables for admin/super_admin role
- Falls back to 403 only if user is neither owner nor admin

### 2025-06 — Site Preview URL Fixes
- **Double /api fix**: Preview URL was generating `/api/api/v1/sites/...` — removed extra `/api` prefix since `API_BASE_URL` already includes it
- **JWT token fix**: Preview was returning "Unauthorized" — added `?token=` query parameter with JWT from localStorage (required because preview opens in new window, can't use Authorization header)

### 2025-06 — Assistant Cards Enrichment
- Added Knowledge Health Score: progress bar + checklist from `knowledge_categories` JSON
- Health score color: green (≥70%), yellow (≥40%), red (<40%)
- Added 2×2 info grid: Personality, Primary Goal, Business Type, Pages Indexed
- Added Knowledge Base stats row: Sources count, Pages count, Chunks count
- Added **Chat button**: Opens streaming SSE chat modal with conversation history
- Added **Embed button**: Shows embed code (`<script>` tag) and direct chat URL
- Added **Link button**: Copies direct chat URL to clipboard

### 2025-06 — Assistant Knowledge Subquery (Collation Fix)
- Overview API was returning 500: "Illegal mix of collations (utf8mb4_0900_ai_ci,IMPLICIT) and (utf8mb4_unicode_ci,IMPLICIT)"
- Root cause: `assistants.id` = `utf8mb4_unicode_ci`, `assistant_knowledge.assistant_id` = `utf8mb4_0900_ai_ci`
- Fix: Added `a.id COLLATE utf8mb4_0900_ai_ci` in subqueries on `assistant_knowledge`
- Backend query now includes `knowledge_categories`, `knowledge_source_count`, `knowledge_chunk_count`

### 2025-06 — Overview API Enhancements
- Landing pages query now includes: `logo_url`, `hero_image_url`, `about_us`, `services`, `last_deployed_at`, `has_html` (boolean), `html_size` (bytes)
- Stats now include `totalCustomers` and `totalSuppliers` with `COALESCE(contact_type, 1)` for safe counting
- Enterprise endpoints loaded from SQLite via `getAllEndpoints()`

### 2025-06 — 5-Tab Admin Hub Architecture
- Restructured Contacts.tsx from 2-tab (customers/suppliers) to 5-tab admin hub
- New tabs: Assistants, Landing Pages, Enterprise Endpoints
- Each tab shows count badge from overview stats
- Tab content uses dedicated `render*()` functions with rich card grids
- `TabKey` union type: `'customers' | 'suppliers' | 'assistants' | 'landingPages' | 'enterpriseEndpoints'`

### 2025-06 — Stats Card Removal + Count Fixes
- Removed overview stats cards from header area
- Fixed contact count queries: `COALESCE(contact_type, 1) = 1` for customers, `contact_type = 2` for suppliers
- Fixed generated_sites query to use actual column names (`tagline`, `theme_color`, `ftp_server`, `ftp_protocol`)

### 2025-06 — Backend Build Step Removal
- Removed `npm run build` step — PM2 now runs `tsx src/index.ts` directly
- Deleted `dist/` directory
- Backend restart: just `pm2 restart softaware-backend`

---

## Known Issues

| ID | Severity | Component | Description | Suggested Fix |
|----|----------|-----------|-------------|---------------|
| CONT-001 | 🔴 Critical | `contacts.ts` | No backend permission enforcement — any authenticated user can CRUD all contacts | Add `permissionMiddleware('contacts.*')` to each route |
| CONT-003 | 🟠 High | `ContactDetails.tsx` | Client-side invoice/quotation filtering loads ALL records then filters in browser | Use `GET /contacts/:id/invoices` and `/quotations` endpoints |
| CONT-004 | 🟠 High | `contactFormRouter.ts` | No HTML sanitization on public contact form — email body injection risk | Escape HTML entities before embedding in SMTP body |
| CONT-005 | 🟡 Medium | `contacts.ts` | `contact_type` hardcoded to `1` in CONTACT_SELECT — supplier type never returned | Store `contact_type` in DB and select dynamically |
| CONT-006 | 🟡 Medium | `contactFormRouter.ts` | In-memory rate limit map has no cleanup — potential memory leak | Use TTL-aware structure or periodic cleanup interval |
| CONT-007 | 🟡 Medium | `ContactModel.ts` | `getStatementData` and `downloadStatement` methods reference routes not found in router | Implement or verify statement routes exist elsewhere |
| CONT-008 | 🟢 Low | `contactFormRouter.ts` | Rate limiting is in-memory — not shared across PM2 instances | Migrate to Redis-backed rate limiter |
| CONT-009 | 🟢 Low | `contacts.ts` | No endpoint to restore soft-deleted contacts | Add `PUT /contacts/:id/restore` route |
| CONT-010 | 🟡 Medium | DB schema | `assistants.id` (utf8mb4_unicode_ci) vs `assistant_knowledge.assistant_id` (utf8mb4_0900_ai_ci) collation mismatch | `ALTER TABLE` to align collations |

---

## Migration Notes

### Adding contact_type Column (CONT-005)
```sql
ALTER TABLE contacts ADD COLUMN contact_type TINYINT NOT NULL DEFAULT 1 AFTER active;
```

### Aligning Collations (CONT-010)
```sql
ALTER TABLE assistant_knowledge
  MODIFY assistant_id VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

---

## Suggested Improvements

### Short-term
1. **Backend permission middleware** (CONT-001)
2. **Replace client-side filtering** (CONT-003) — use server-side endpoints
3. **Sanitize contact form input** (CONT-004) — escape HTML entities
4. **Align collations** (CONT-010) — one-time migration

### Medium-term
5. **Dynamic contact_type** (CONT-005) — DB migration + select update
6. **Redis-backed rate limiting** (CONT-008)
7. **Statement route implementation** (CONT-007) — PDF generation

### Long-term
8. **Contact import/export** — CSV/Excel bulk operations
9. **Contact merge** — deduplicate contacts with same email/company
10. **Audit trail** — log who created/edited/deleted each contact

---

## Dependencies on Other Modules

| Module | Dependency Type | Description |
|--------|----------------|-------------|
| **Invoices** | Data | Contacts linked via `contact_id` FK in invoices table |
| **Quotations** | Data | Contacts linked via `contact_id` FK in quotations table |
| **Authentication** | Auth | JWT middleware protects all CRUD routes |
| **Roles** | RBAC | Permission keys `contacts.*` + admin role for overview |
| **SiteBuilder** | Preview | Admin preview bypass + contact form owner lookup |
| **Assistants** | Data | Overview loads assistants with knowledge stats |
| **Widgets** | Data | Overview loads widgets with status (admin hub only — removed from ContactDetails) |
| **Enterprise Endpoints** | Data | Overview loads endpoints from SQLite |
| **Packages** | Data + Billing | Contacts linked to packages via `contact_packages` table; credits billed per-contact; `user_contact_link` maps users to contacts |
| **Settings** | Config | SMTP configuration for contact form email delivery |

## Modules That Depend on Contacts

| Module | Usage |
|--------|-------|
| **Invoices** | Invoice creation requires selecting a contact |
| **Quotations** | Quotation creation requires selecting a contact |
| **Payments** | Payments linked to invoices which link to contacts |
| **FinancialReports** | Financial reports may aggregate by contact |
| **Dashboard** | Outstanding amounts counted per contact |
| **Packages** | Package subscriptions and credit balances scoped per-contact via `contact_packages` |
