# Contacts Module

## Purpose
Central admin hub for managing the entire client ecosystem — customers, suppliers, AI assistants, landing pages, and enterprise endpoints. Also includes a public contact form router for website lead capture with email forwarding. Acts as the primary CRM entity that connects to invoices, quotations, payments, and statements.

## Module Scope
- **Contact CRUD**: Create, read, update, soft-delete contacts. Contacts are classified as customers (type 1) or suppliers (type 2).
- **Admin Overview Dashboard**: Aggregated stats and detailed lists for all client assets via `GET /admin/clients/overview`.
- **5-Tab Interface**:
  - **Clients** — Paginated customer list with search, CRUD form, DataTable
  - **Suppliers** — Paginated supplier list with same functionality
  - **Assistants** — Rich card grid with personality, primary goal, business type, Knowledge Health Score (progress bar + category checklist), Knowledge Base stats, streaming chat modal, embed modal, and copy-link
  - **Landing Pages** — Rich card grid with hero image thumbnails, HTML size/services/deployment stats, preview button (with JWT auth), live site link
  - **Enterprise Endpoints** — Rich card grid with LLM config, request stats, webhook URL, expandable system prompt, logs modal with payload viewer, status toggle (pause/activate)
- **Contact Details**: Rich detail view with 6-tab interface — overview (financial summary), invoices, quotations, statement (aging + PDF), assistants (rich cards with Knowledge Health Score, streaming chat, embed modal), and landing pages (rich cards with hero image, preview, live site). Same rich card pattern as the admin hub, filtered by the individual contact's linked user.
- **Contact Form / Leads**: Public endpoint for website contact form submissions — validates, rate-limits, looks up site owner, and emails the submission via SMTP.

## Key Files (summary)

| Layer | File | LOC | Role |
|-------|------|-----|------|
| Backend Route | `src/routes/contacts.ts` | 240 | Contact CRUD + per-contact invoices/quotations |
| Backend Route | `src/routes/contactFormRouter.ts` | 215 | Public contact form submission + email |
| Backend Route | `src/routes/adminClientManager.ts` | 451 | Admin overview API + per-client detail: users, assistants (with knowledge stats), landing pages, enterprise endpoints |
| Backend Route | `src/routes/siteBuilder.ts` | 1341 | Site CRUD, preview (admin bypass), generation, deployment |
| Backend Service | `src/services/enterpriseEndpoints.ts` | — | SQLite-based enterprise endpoint storage |
| Frontend Page | `pages/contacts/Contacts.tsx` | 1431 | 5-tab admin hub: Clients, Suppliers, Assistants, Landing Pages, Enterprise Endpoints |
| Frontend Page | `pages/contacts/ContactDetails.tsx` | 1322 | Contact detail with 6 tabs: overview, invoices, quotations, statement, assistants (rich cards + chat/embed), landing pages (rich cards + preview) |
| Frontend Page | `pages/admin/EnterpriseEndpoints.tsx` | 642 | Original standalone enterprise endpoints page (still exists, functionality now embedded in Contacts tab) |
| Frontend Model | `models/ContactModel.ts` | 79 | API wrapper for contact endpoints |
| Frontend Model | `models/AdminClientModel.ts` | — | API wrapper for admin overview endpoint |
| Frontend Model | `models/AdminEnterpriseModel.ts` | — | API wrapper for enterprise endpoint CRUD, status, and logs |

**Total**: 11+ files, ~5,000+ LOC

## Dependencies
- **Backend**: Express Router, Zod validation, `requireAuth` + `requireAdmin` middleware, `db` (MySQL), `httpErrors`, `nodemailer`, `jwt` (jsonwebtoken), SQLite (`enterpriseEndpoints.ts`), `businessTypes.ts`
- **Frontend**: React 18, React Router DOM 6, TanStack React Table, Zustand store (`customers`/`suppliers`), Heroicons, SweetAlert2, UI component library (Input, Select, Textarea, Button, Card, DataTable, BackButton), Can (permissions), `API_BASE_URL` from services/api
- **Frontend Models**: `ContactModel`, `AdminClientModel`, `AdminEnterpriseModel`, `InvoiceModel`, `QuotationModel`
- **Frontend Components**: `PaymentStatusBadge`, `QuotationStatusBadge`, `StatusBadge` (inline)

## Database Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `contacts` | Customer/supplier master data | `id`, `company_name`, `contact_person`, `email`, `phone`, `fax`, `website`, `location`, `contact_code`, `remarks`, `active`, `contact_type` (0=standard, 1=individual, 2=partner, 3=internal) |
| `users` | User accounts linked to contacts | `id`, `email`, `name`, `account_status`, `contact_id` |
| `user_contact_link` | Maps users to contacts (companies) | `id`, `user_id`, `contact_id`, `role` (OWNER/ADMIN/MEMBER/STAFF), `created_at` — see [Packages](../Packages/FIELDS.md) |
| `contact_packages` | Package subscriptions per contact | `id`, `contact_id`, `package_id`, `status`, `credits_balance`, `credits_used` — see [Packages](../Packages/FIELDS.md) |
| `package_transactions` | Credit transaction audit trail | `id`, `contact_package_id`, `contact_id`, `type`, `amount`, `balance_after` — see [Packages](../Packages/FIELDS.md) |
| `assistants` | AI assistants per user | `id`, `name`, `description`, `status`, `tier`, `personality`, `primary_goal`, `business_type`, `pages_indexed`, `knowledge_categories` (JSON), `website`, `lead_capture_email` |
| `assistant_knowledge` | Knowledge sources (RAG chunks) | `id`, `assistant_id`, `source`, `source_type`, `content`, `chunk_index`, `embedding` |
| `widget_clients` | Widget subscription records | `id`, `user_id`, `website_url`, `status`, `subscription_tier`, `message_count`, `max_messages` |
| `generated_sites` | Landing page sites | `id`, `user_id`, `business_name`, `tagline`, `status`, `theme_color`, `logo_url`, `hero_image_url`, `about_us`, `services`, `generated_html`, `ftp_server`, `last_deployed_at` |
| `enterprise_endpoints` | Enterprise webhook config (SQLite) | `id`, `client_id`, `client_name`, `status`, `llm_provider`, `llm_model`, `llm_system_prompt`, `total_requests`, `last_request_at` |
| `invoices` | Related invoices (via `contact_id`) | Read for contact detail + statement |
| `quotations` | Related quotations (via `contact_id`) | Read for contact detail |
| `payments` | Related payments (via invoice) | Read for statement data |

## Architecture Notes
1. **5-tab admin hub**: Contacts.tsx serves as the central management interface. Clients/Suppliers tabs use server-side pagination via the contacts API. Assistants/Landing Pages/Enterprise Endpoints tabs load data from the admin overview API.
2. **Admin overview API**: `GET /admin/clients/overview` returns aggregated stats + full lists for all entity types in a single request. Includes subqueries for knowledge source counts per assistant (with `COLLATE utf8mb4_0900_ai_ci` to handle mixed collations).
3. **Per-client detail API**: `GET /admin/clients/:userId` returns enriched assistant data (personality, primary goal, business type, knowledge stats) and landing pages (hero image, HTML size, FTP details) for a single user. Used by ContactDetails.tsx to power the per-contact Assistants and Landing Pages tabs.
4. **Rich card pattern**: Assistants, Landing Pages, and Enterprise Endpoints all use a consistent card grid layout with: header section, info grid, stats row, meta details, and action buttons bar. This pattern is used in both the admin hub (Contacts.tsx) and individual contact detail (ContactDetails.tsx).
5. **Streaming chat**: Assistant cards include a Chat button that opens a modal with SSE-based streaming responses, conversation history (persisted in a ref across modal open/close), and auto-scroll. Available in both the admin hub and individual contact detail view.
6. **Admin preview bypass**: The site preview endpoint (`GET /v1/sites/:siteId/preview`) checks JWT auth. If the requesting user is not the site owner, it falls through to an admin role check (queries `user_roles` + `roles` tables). Admins can preview any user's site.
7. **Knowledge Health Score**: Calculated client-side from the `knowledge_categories` JSON field. The checklist array has `{key, label, type, satisfied}` items. Score = `(satisfied count / total) * 100`.
8. **Column aliasing**: Backend uses a `CONTACT_SELECT` SQL fragment that aliases DB columns to frontend-expected names (e.g., `company_name → contact_name`).
9. **Soft delete only**: Contacts are never hard-deleted — `active` is set to 0.
10. **Customer/Supplier/Internal split**: `contact_type` values: 0=standard, 1=individual/customer (default), 2=supplier, 3=internal/provider. With `COALESCE(contact_type, 1) = 1` for customers (handles NULL defaults). Contact ID 1 (Soft Aware) uses `contact_type = 3` as the internal provider account for the [Packages system](../Packages/README.md).
11. **Contact form is public**: `contactFormRouter.ts` has no auth middleware. Has in-memory rate limiting (5 req/min/IP) and honeypot bot detection.
12. **Collation handling**: The `assistants` table uses `utf8mb4_unicode_ci` while `assistant_knowledge` uses `utf8mb4_0900_ai_ci`. Subqueries use explicit `COLLATE` to avoid "Illegal mix of collations" errors.
13. **Enterprise endpoints in SQLite**: Unlike other entities stored in MySQL, enterprise endpoints use a separate SQLite database at `/var/opt/backend/data/enterprise_endpoints.db`, accessed via `getAllEndpoints()`.
14. **Contact→User linkage**: ContactDetails.tsx resolves the contact's linked user via `users.contact_id`. If a linked user is found, `AdminClientModel.getClient(userId)` fetches enriched assistant and landing page data for the Assistants and Landing Pages tabs.
15. **Package billing is contact-scoped**: The new Packages system (see [Packages module](../Packages/README.md)) bills per-contact, not per-user or per-team. The `user_contact_link` table maps multiple users to one contact, and `contact_packages` holds the subscription + credit balance. All AI credit deductions flow through `contact_packages`.
