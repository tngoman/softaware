# Dashboard Module

## Purpose
Provides real-time analytics dashboards for three distinct user personas: **financial/billing users** (revenue, invoices, quotations, aging analysis), **platform administrators** (system-wide health, workspaces, subscriptions, AI usage, clients), and **portal users** (AI assistant metrics, usage quotas, quick actions, live chat testing).

## Module Scope
- **Financial Dashboard** — Revenue collected, profit/loss, outstanding aging (current/30/60/90+ days), invoice & quotation summaries, recent activity tables. Period-filtered (today/week/month/quarter/year/all).
- **Admin Dashboard** — System-wide counts for workspaces, users, subscriptions, software products, connected desktop clients, AI assistants, credit consumption, websites, leads, activation keys, process uptime, and recent cross-table activity feed.
- **Portal Dashboard** — Per-user AI assistant inventory, message/page usage vs plan limits, subscription tier display, quick-action cards, assistant test-chat modal with SSE streaming, knowledge health score.

## Key Files (summary)

| Layer | File | LOC | Role |
|-------|------|-----|------|
| Backend | `src/routes/dashboard.ts` | 288 | `/api/dashboard/metrics` + `/api/dashboard/stats` |
| Backend | `src/routes/adminDashboard.ts` | 225 | `/api/admin/dashboard` — system-wide stats |
| Frontend | `pages/Dashboard.tsx` | 260 | Financial dashboard (billing users) |
| Frontend | `pages/FinancialDashboard.tsx` | 260 | Dedicated financial dashboard (mirrors Dashboard.tsx) |
| Frontend | `pages/admin/Dashboard.tsx` | 596 | Admin task-management dashboard |
| Frontend | `pages/portal/Dashboard.tsx` | 508 | Portal dashboard (AI assistants + chat) |
| Frontend | `models/OtherModels.ts` | 6† | `DashboardModel.getStats()` API wrapper |

† Only the DashboardModel class excerpt; file is 320 LOC total with other models.

## Dependencies
- **Backend**: Express Router, `requireAuth` + `AuthRequest` middleware, `db` (mysql2/promise), `team_members` type
- **Frontend**: React 18, React Router DOM 6, Zustand (`useAppStore`), Axios (`api` service), Heroicons, Tailwind CSS
- **Frontend (Admin)**: `useSoftware`, `useTasks`, `useModules` custom hooks; `Software`, `Task` types
- **Frontend (Portal)**: `api` + `API_BASE_URL` from services, `KnowledgeHealthScore` component
- **Shared model**: `DashboardModel` in `OtherModels.ts`

## Database Tables Referenced

| Table | Dashboard | Usage |
|-------|-----------|-------|
| `team_members` | Financial, Portal | Map user → team for scoped queries |
| `subscriptions` | Financial, Admin, Portal | Tier, limits, status counts |
| `subscription_plans` | Financial, Portal | Plan metadata (maxAgents, maxUsers, tier) |
| `assistants` | Financial, Portal, Admin | Count per user, total count |
| `ingestion_jobs` | Financial, Portal | Pages indexed, message proxy |
| `invoices` | Financial | Revenue, outstanding, aging, recent list |
| `payments` | Financial | Collected revenue, payment counts |
| `transactions` | Financial | Expenses (debit_amount) |
| `quotations` | Financial | Quotation counts, recent list |
| `contacts` | Financial | Customer/supplier counts, names on invoices |
| `teams` | Admin | Workspace counts, recent teams |
| `users` | Admin | Total user count, recent registrations |
| `update_software` | Admin | Software product count |
| `update_modules` | Admin | Module count |
| `update_releases` | Admin | Release count |
| `update_clients` | Admin | Connected desktop clients, online/blocked |
| `ai_model_config` | Admin | AI configuration count |
| `api_keys` | Admin | API key count |
| `credit_transactions` | Admin | Usage/purchase credits, by request type |
| `credit_balances` | Admin | Total credit balance |
| `generated_sites` | Admin | Website counts (deployed/draft) |
| `widget_clients` | Admin | Chat widget deployment counts |
| `lead_captures` | Admin | Lead counts (total/new/this month) |
| `activation_keys` | Admin | Key counts (active/revoked) |

## Architecture Notes
1. **Three separate dashboards** serve completely different personas — they share no components and have separate backend routes.
2. **Financial dashboard** uses `DashboardModel.getStats(period)` which calls `/api/dashboard/stats` — all data comes from a single large SQL aggregation endpoint.
3. **Admin dashboard** queries 15+ tables individually (no joins) — each section is an independent COUNT/SUM query. Returns a unified `{ success, data }` envelope.
4. **Portal dashboard** calls two endpoints in parallel: `/dashboard/metrics` (usage quotas) and `/assistants` (assistant list). Includes a full SSE chat modal.
5. **Admin task dashboard** is unique — it connects to *external* software APIs via `useTasks({ apiUrl })`, not the local database. Tasks come from third-party systems.
6. All backends catch errors and either call `next(err)` or return safe JSON defaults (no crash on failure).
