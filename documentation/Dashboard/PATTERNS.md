# Dashboard — Architecture Patterns

## Design Patterns

### 1. Three-Dashboard Architecture
The module implements three completely separate dashboards for distinct personas:

```
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│  Financial Dashboard │  │   Admin Dashboard    │  │  Portal Dashboard   │
│  (Billing Users)     │  │  (System Admins)     │  │  (AI Portal Users)  │
├─────────────────────┤  ├─────────────────────┤  ├─────────────────────┤
│ /api/dashboard/stats │  │ /api/admin/dashboard │  │ /api/dashboard/     │
│                      │  │                      │  │     metrics         │
│ Tables: invoices,    │  │ Tables: 15+ system   │  │ Tables: assistants, │
│ payments, quotations │  │ tables (teams, users, │  │ ingestion_jobs,     │
│ contacts,            │  │ subscriptions,       │  │ subscriptions       │
│ transactions         │  │ clients, leads...)   │  │                     │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
```

**Rationale**: Each dashboard has completely different data needs and access patterns. No shared components between them.

### 2. Period-Filtered Aggregation (Financial)
The financial dashboard uses a single-endpoint pattern with a `period` query parameter that dynamically builds date filter clauses:

```
period=month → AND invoice_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                → txDateFilter = AND transaction_date >= ...
                → payDateFilter = AND payment_date >= ...
                → quoDateFilter = AND quotation_date >= ...
```

**Pattern**: String replacement (`dateFilter.replace(/invoice_date/g, 'column_name')`) adapts filters across tables with different date column names.

### 3. Safe Default Response (Portal Metrics)
The `/metrics` endpoint never returns 500 errors. Both "no membership found" and catch blocks return safe defaults:

```typescript
// No membership → defaults
return res.json({ messages: { used: 0, limit: 500 }, ... tier: 'free' });

// Catch block → same defaults
catch (err) {
  res.json({ messages: { used: 0, limit: 500 }, ... tier: 'free' });
}
```

**Rationale**: Portal dashboards should always render, even if the backend has transient issues.

### 4. Independent Query Pattern (Admin)
The admin dashboard executes 15+ independent queries sequentially — no JOINs between sections:

```typescript
const wsTotal = await db.queryOne('SELECT COUNT(*) AS cnt FROM teams');
const wsNew = await db.queryOne('SELECT COUNT(*) FROM teams WHERE ...');
const userTotal = await db.queryOne('SELECT COUNT(*) AS cnt FROM users');
// ... 12+ more independent queries
```

**Trade-off**: Simple and maintainable, but ~15 sequential round-trips to MySQL per request.

### 5. Cross-Table Activity Feed (Admin)
Recent activity is assembled from 4 different tables, sorted by timestamp, then truncated:

```
teams (last 3)         → { type: 'workspace_created', ... }
users (last 3)         → { type: 'user_registered', ... }
update_clients (last 3) → { type: 'client_heartbeat', ... }
lead_captures (last 2)  → { type: 'lead_captured', ... }

→ merge all → sort by timestamp DESC → take first 10 → strip Date objects
```

### 6. Role-Based Dashboard Adaptation (Admin Frontend)
The admin dashboard adapts its display based on the user's role:

```typescript
const ROLE_META = {
  admin:          { focusPhase: 'all', greeting: 'Full system overview' },
  developer:      { focusPhase: 'development', greeting: 'Your development queue' },
  client_manager: { focusPhase: 'intake', greeting: 'Client intake pipeline' },
  qa_specialist:  { focusPhase: 'quality_review', greeting: 'Quality review queue' },
};
```

Tasks are filtered by `PHASE_TO_ROLE` mapping — each role sees only tasks in their workflow phases.

### 7. External API Integration (Admin Frontend)
The admin dashboard uniquely fetches data from **external software APIs**, not the local backend:

```
selectedSoftware → external_mode → apiUrl (live/test)
useTasks({ apiUrl }) → external system → Task[]
```

Software selection persists in `localStorage`. Handles 401 errors with auth dialog.

### 8. SSE Streaming Chat (Portal)
The portal dashboard includes inline chat with SSE streaming:

```
POST /assistants/chat → Content-Type: text/event-stream
  ├── data: {"token":"Hello"}
  ├── data: {"token":" world"}
  ├── data: [DONE]
  └── (fallback: JSON response if content-type differs)
```

Uses `ReadableStream` reader with `TextDecoder`, parses `data:` lines, accumulates tokens into React state.

### 9. Permission Gating (Financial)
The financial dashboard wraps its content in `<Can permission="dashboard.view">`:

```tsx
<Can 
  permission="dashboard.view" 
  fallback={<LockClosedIcon ... />}
>
  {/* All dashboard content */}
</Can>
```

Only the financial dashboard uses permission gating. Admin and portal dashboards rely solely on route-level auth.

### 10. Tier-Based Limit Scaling (Portal)
Usage limits scale based on subscription tier with hardcoded values:

```typescript
switch (tier) {
  case 'FREE':       messageLimitMonthly = 500;   pageLimit = 50;   break;
  case 'TEAM':       messageLimitMonthly = 5000;  pageLimit = 500;  break;
  case 'ENTERPRISE': messageLimitMonthly = 50000; pageLimit = 5000; break;
}
```

---

## Anti-Patterns & Technical Debt

### 🔴 Critical

1. **No RBAC on financial stats** — `/api/dashboard/stats` queries `invoices`, `payments`, etc. without any permission check beyond JWT authentication. **Every authenticated user sees all financial data regardless of their role.** This is a major authorization bug. Add `permissionMiddleware('dashboard.view')` to the route.

2. **No admin role check on admin dashboard** — `/api/admin/dashboard` only requires `requireAuth` (JWT), not `requireAdmin`. Any authenticated user can access system-wide stats including user counts, credit balances, and activation keys.

3. **15+ sequential queries without parallelization** — The admin dashboard makes ~15 sequential `await db.queryOne()` calls. These could be parallelized with `Promise.all()` to reduce response time significantly.

4. **Messages counted via ingestion_jobs proxy** — The `/metrics` endpoint uses `COUNT(ingestion_jobs)` as a proxy for "messages used" with a TODO comment: *"Add proper message tracking when chat functionality is implemented"*. This metric is misleading.

### 🟡 Moderate

5. **Hardcoded zeros in financial stats** — `partial_count`, `accepted_count`, and `supplier_count` are all hardcoded to `0`. The UI displays them but they never have real data.

6. **Aging gap: 61-89 days missing** — The outstanding aging analysis jumps from "31-60 days" directly to "90+ days", missing the 61-89 day range entirely.

7. **Duplicate Dashboard.tsx / FinancialDashboard.tsx** — Two nearly identical files exist for the same financial dashboard. Likely a copy-paste that should be consolidated.

8. **No caching** — All dashboard endpoints query the database on every request. For admin stats especially, these could be cached for 30-60 seconds.

9. **System health is fake** — `system.status` is hardcoded to `'healthy'`. There are no actual health checks (DB connectivity, memory, disk).

10. **Tier limits hardcoded in route** — Message and page limits are hardcoded in the route handler instead of stored in `subscription_plans` table. Adding a new tier requires code changes.

### 🟢 Minor

11. **No TypeScript interfaces for responses** — Backend returns `any` typed objects. Frontend uses `any` for stats state.

12. **Chat modal lives inside Dashboard** — The 130-line chat modal in PortalDashboard should be extracted to a separate component.

13. **localStorage for software selection** — Admin dashboard stores selected software in localStorage. Should consider URL params or Zustand store for better UX.

---

## Performance Characteristics

| Dashboard | Queries | Est. Response | Caching |
|-----------|---------|---------------|---------|
| `/metrics` | 4-6 | ~50ms | None |
| `/stats` | 8 | ~100ms | None |
| `/admin/dashboard` | 15+ | ~200-300ms | None |
| Admin frontend | External API | Variable | None |
| Portal frontend | 2 parallel | ~100ms | None |

**Recommendation**: Add Redis/memory caching for admin dashboard (15+ queries) with 30s TTL.
