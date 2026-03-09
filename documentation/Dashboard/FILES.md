# Dashboard — File Inventory

## Backend Files

### `/var/opt/backend/src/routes/dashboard.ts` (288 LOC)
**Purpose**: Two authenticated endpoints for the billing/financial dashboard and portal usage metrics.

| Section | Lines | Description |
|---------|-------|-------------|
| Imports & router | 1–5 | Express Router, `requireAuth`, `AuthRequest`, `db`, `team_members` type |
| `GET /metrics` | 7–125 | Portal usage metrics: messages used/limit, pages indexed, assistant count, subscription tier. Returns safe defaults for no-membership or error cases. |
| `GET /stats` | 127–288 | Financial dashboard stats: revenue (collected/outstanding/invoiced), profit (expenses via transactions), invoice counts, quotation counts, customer counts, payment counts, outstanding aging (current/30/60/90+), recent invoices (last 5), recent quotations (last 5). Supports `?period=` filter (today/week/month/quarter/year/all). |

**Key patterns**:
- `/metrics` maps user → team via `team_members`, then looks up subscription tier for limit scaling
- `/stats` uses string replacement to adapt date filters across different column names (`invoice_date` → `transaction_date`, `payment_date`, `quotation_date`)
- Error handler on `/metrics` returns safe defaults (no 500); `/stats` passes to `next(err)`

---

### `/var/opt/backend/src/routes/adminDashboard.ts` (225 LOC)
**Purpose**: Single admin endpoint returning system-wide health and statistics.

| Section | Lines | Description |
|---------|-------|-------------|
| Imports & router | 1–5 | Express Router, `requireAuth`, `AuthRequest`, `db` |
| `GET /` | 7–205 | Queries 15+ tables for: workspace counts (total/new this month), user count, subscription breakdown (active/trial/expired/past_due), software products (total/integrated/modules/releases), connected clients (total/online/blocked), AI stats (assistants/apiKeys/configs/credits/usage by type), websites (total/deployed/draft/widgets), leads (total/new/this month), activation keys (active/revoked), system health (uptime/version), recent activity feed (last 10 events from teams, users, clients, leads). |
| `formatTimeAgo()` | 207–225 | Helper: converts Date to relative time string (just now, Xm ago, Xh ago, Xd ago, Xw ago, or locale date). |

**Key patterns**:
- All queries are independent COUNTs/SUMs — no joins between sections
- Recent activity merges rows from 4 tables, sorts by timestamp, strips Date objects before response
- System uptime uses `process.uptime()` (Node.js runtime)
- Returns `{ success: true, data: { ... } }` envelope

---

## Frontend Files

### `/var/opt/frontend/src/pages/Dashboard.tsx` (260 LOC)
**Purpose**: Main financial/billing dashboard for authenticated users.

| Section | Lines | Description |
|---------|-------|-------------|
| Imports | 1–12 | React, `DashboardModel`, `Can` component, Heroicons |
| State & effects | 14–28 | `loading`, `period` (default 'month'), `stats` — reloads on period change |
| Helpers | 30–50 | `formatCurrency()` (ZAR locale), `getPaymentStatusBadge()` (Unpaid/Partial/Paid) |
| Loading spinner | 52–58 | Animated border spinner |
| Header | 60–82 | Gradient banner with period selector dropdown |
| `<Can permission="dashboard.view">` | 84–100 | Permission gate with lock fallback |
| Financial KPI row | 102–150 | 4 cards: Revenue Collected, Profit, Outstanding, Total Invoiced |
| Business stats row | 152–198 | 4 cards: Payments Received, Quotations, Customers, Expenses |
| Aging analysis | 200–225 | 5-column grid: Current, 1-30 Days, 31-60 Days, 90+ Days, Total |
| Recent activity | 227–260 | 2-column: Recent Invoices (last 5), Recent Quotations (last 5) |

---

### `/var/opt/frontend/src/pages/FinancialDashboard.tsx` (260 LOC)
**Purpose**: Dedicated financial dashboard — structurally identical to `Dashboard.tsx` with "Financial Dashboard" header text.

**Note**: This appears to be a duplicate/variant of Dashboard.tsx, likely mounted at a different route.

---

### `/var/opt/frontend/src/pages/admin/Dashboard.tsx` (596 LOC)
**Purpose**: Admin task-management dashboard showing role-based task analytics from external software APIs.

| Section | Lines | Description |
|---------|-------|-------------|
| Imports | 1–28 | React, React Router, Zustand store, `useSoftware`/`useTasks`/`useModules` hooks, types, Heroicons |
| Helpers | 30–55 | `timeToDecimal()` (HH:MM:SS → hours), `relativeDate()`, `STATUS_COLORS`, `TYPE_ICONS` |
| `ROLE_META` | 57–75 | Role configuration: label, color, greeting, focusPhase, icon for admin/developer/client_manager/qa_specialist/deployer/viewer |
| `PHASE_ORDER` | 77 | `['intake', 'quality_review', 'development', 'verification', 'resolution']` |
| Component state | 80–95 | `selectedSoftware`, `authDialogOpen`, derived `apiUrl` (live vs test URL) |
| Effects | 97–125 | Restore selected software from localStorage, load tasks on apiUrl change, detect 401 errors |
| Derived stats (useMemo) | 127–210 | Computes: roleTasks (filtered by PHASE_TO_ROLE mapping), phaseTasks, byStatus, byPhase, byModule, totalHours (unbilled), completedUnbilled, bugTasks, oldestBug/age, recent 8 |
| Header bar | 212–250 | Role badge, greeting, software selector dropdown, refresh button |
| Body states | 252–280 | No software → prompt; 401 → auth required; loading → spinner |
| KPI cards row | 282–340 | 4 cards: Oldest Bug (days), Phase Queue, Unbilled Hours, Completed Unbilled |
| Middle row | 342–430 | 3 panels: By Status (progress bars), Active Bugs (scrollable list), Workflow Pipeline (phase counts) |
| Bottom row | 432–596 | 2 panels: Role Tasks (scrollable, up to 12), Right side: Modules (tag cloud) + Recent Activity |

---

### `/var/opt/frontend/src/pages/portal/Dashboard.tsx` (508 LOC)
**Purpose**: Portal dashboard for AI assistant users — usage metrics, quick actions, assistant cards, live chat modal.

| Section | Lines | Description |
|---------|-------|-------------|
| Imports | 1–14 | React, React Router, Heroicons, `api`/`API_BASE_URL`, `KnowledgeHealthScore` |
| Interfaces | 16–35 | `DashboardMetrics`, `AssistantSummary`, `ChatMessage` |
| State | 37–50 | `metrics`, `assistants`, `loading`, chat modal state (`chatModal`, `messages`, `chatInput`, `streaming`) |
| Effects | 52–70 | Load data on mount, reset chat on modal open, auto-scroll messages |
| `sendMessage()` | 72–135 | SSE streaming chat: POST to `/assistants/chat`, parse `text/event-stream` chunks (data: lines), fallback to JSON response, error handling |
| `loadData()` | 140–155 | Parallel fetch: `GET /dashboard/metrics` + `GET /assistants` |
| Usage helpers | 157–162 | `usagePercent()`, `barColor()` (green/amber/red based on threshold) |
| Loading skeleton | 164–175 | Animated pulse placeholders |
| Tier + Usage strip | 177–195 | Welcome header with plan tier badge, "New Assistant" CTA |
| Stat cards | 197–260 | 4 cards: AI Assistants (count/limit), Messages (bar), Pages Indexed (bar), Current Plan (with manage link) |
| Quick actions | 262–300 | 3 dashed-border cards: New AI Assistant, Create Landing Page, Train Knowledge Base |
| Assistant grid | 302–370 | Cards with name, status, description, "Test Chat" + "Edit" buttons |
| Knowledge health | 372–378 | `<KnowledgeHealthScore>` for first assistant |
| Chat modal | 380–508 | Full modal: header, scrollable messages, textarea input, send button, streaming indicator |

---

### `/var/opt/frontend/src/models/OtherModels.ts` — DashboardModel (6 LOC within 320 LOC file)
**Purpose**: API wrapper for the financial dashboard stats endpoint.

```typescript
export class DashboardModel {
  static async getStats(period) {
    const response = await api.get('/dashboard/stats', { params: { period } });
    return response.data;
  }
}
```

**Used by**: `Dashboard.tsx`, `FinancialDashboard.tsx`
