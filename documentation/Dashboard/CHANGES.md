# Dashboard — Known Issues & Change Log

## Known Issues

### 🔴 Critical — Security

| ID | Issue | File | Line(s) | Impact |
|----|-------|------|---------|--------|
| DASH-001 | **Financial stats lack RBAC** — `/api/dashboard/stats` queries invoices, payments, quotations, contacts, and transactions with no permission check beyond JWT authentication. Any authenticated user sees all financial data regardless of role. | `dashboard.ts` | 127–288 | All financial data exposed to any logged-in user |
| DASH-002 | **Admin dashboard lacks role check** — `/api/admin/dashboard` only requires `requireAuth`, not `requireAdmin`. Any authenticated user can view system-wide stats (user counts, credit balances, activation keys). | `adminDashboard.ts` | 13 | System-wide stats accessible to all users |

### 🔴 Critical — Data Integrity

| ID | Issue | File | Line(s) | Impact |
|----|-------|------|---------|--------|
| DASH-003 | **Messages metric is a proxy, not real** — `used` message count is derived from `COUNT(ingestion_jobs)` not actual chat messages. Portal users see inaccurate usage data. | `dashboard.ts` | 97–110 | Users may hit "limits" that don't reflect real usage |

### 🟡 Moderate

| ID | Issue | File | Line(s) | Impact |
|----|-------|------|---------|--------|
| DASH-004 | **Aging analysis has 61-89 day gap** — Outstanding aging jumps from "31-60 days" to "90+ days". Invoices 61-89 days overdue are only counted in the total, not displayed in any bucket. | `dashboard.ts` | 226–234 | Misleading aging breakdown |
| DASH-005 | **Hardcoded zero fields** — `partial_count: 0`, `accepted_count: 0`, `supplier_count: 0` are always zero. UI renders them but they provide no information. | `dashboard.ts` | 197, 208, 215 | Dead UI elements |
| DASH-006 | **Tier limits hardcoded in route** — Free/Team/Enterprise message and page limits are hardcoded instead of sourced from `subscription_plans` table. | `dashboard.ts` | 57–68 | Adding tiers requires code changes |
| DASH-007 | **Duplicate dashboard files** — `Dashboard.tsx` and `FinancialDashboard.tsx` are nearly identical. Two files to maintain for one feature. | `Dashboard.tsx`, `FinancialDashboard.tsx` | — | Maintenance burden |
| DASH-008 | **No query parallelization** — Admin dashboard executes 15+ sequential queries. Could be ~5x faster with `Promise.all()`. | `adminDashboard.ts` | 18–160 | Slow admin dashboard load (~200-300ms) |
| DASH-009 | **No response caching** — All three dashboard endpoints query the database fresh on every request. | All backends | — | Unnecessary DB load |
| DASH-010 | **System health is hardcoded** — `system.status` always returns `'healthy'` with no actual health checks. | `adminDashboard.ts` | 167 | Admins can't detect real system issues |
| DASH-011 | **workspace active/inactive always total/0** — `workspaces.active` equals total, `inactive` always 0 because no active flag exists on `teams` table. | `adminDashboard.ts` | 178–179 | Misleading workspace stats |

### 🟢 Minor

| ID | Issue | File | Line(s) | Impact |
|----|-------|------|---------|--------|
| DASH-012 | **Chat modal embedded in Dashboard** — 130+ lines of chat modal code inside `portal/Dashboard.tsx` should be a separate component. | `portal/Dashboard.tsx` | 380–508 | Component too large |
| DASH-013 | **localStorage for software selection** — Admin dashboard persists selected software in localStorage instead of URL state. | `admin/Dashboard.tsx` | 100–105 | Can't share/bookmark dashboard state |
| DASH-014 | **No TypeScript types on backend responses** — All response objects are `any` typed. | All backends | — | No compile-time safety |
| DASH-015 | **Invoice display uses padStart** — `INV-{String(inv.invoice_id).padStart(5, '0')}` ignores actual `invoice_number` field. | `Dashboard.tsx` | 229 | Displays generated number, not stored number |

---

## Migration Notes

### Adding RBAC to Dashboard (DASH-001 Fix)
```typescript
// Before (current — NO PERMISSION CHECK):
const revenueRow = await db.queryOne(`SELECT ... FROM invoices i ... WHERE i.active = 1 ${dateFilter}`);

// After (add permission middleware):
// In router: dashboardRouter.get('/stats', requireAuth, permissionMiddleware('dashboard.view'), ...);
// This ensures only users with dashboard.view permission can access financial stats
```

### Adding Admin Role Check (DASH-002 Fix)
```typescript
// Before:
adminDashboardRouter.get('/', requireAuth, async (req, res, next) => { ... });

// After:
import { requireAdmin } from '../middleware/requireAdmin.js';
adminDashboardRouter.get('/', requireAuth, requireAdmin, async (req, res, next) => { ... });
```

### Parallelizing Admin Queries (DASH-008 Fix)
```typescript
// Before: sequential
const wsTotal = await db.queryOne('SELECT COUNT(*) AS cnt FROM teams');
const userTotal = await db.queryOne('SELECT COUNT(*) AS cnt FROM users');
// ... 13 more awaits

// After: parallel
const [wsTotal, wsNew, userTotal, subStats, ...] = await Promise.all([
  db.queryOne('SELECT COUNT(*) AS cnt FROM teams'),
  db.queryOne('SELECT COUNT(*) AS cnt FROM teams WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)'),
  db.queryOne('SELECT COUNT(*) AS cnt FROM users'),
  db.queryOne('SELECT ... FROM subscriptions'),
  // ... rest
]);
```

### Fixing Aging Gap (DASH-004 Fix)
Add a `days_90` bucket for 61-90 days:
```sql
COALESCE(SUM(CASE WHEN DATEDIFF(CURDATE(), i.due_date) BETWEEN 61 AND 90
  THEN i.invoice_amount - COALESCE(ip.paid_total, 0) ELSE 0 END), 0) AS days_90
```

---

## Future Enhancements

### Priority 1 — Security
- [ ] Add RBAC permission check to `/api/dashboard/stats` (DASH-001)
- [ ] Add `requireAdmin` to admin dashboard route (DASH-002)
- [ ] Implement proper message tracking table (DASH-003)

### Priority 2 — Performance
- [ ] Parallelize admin dashboard queries (DASH-008)
- [ ] Add Redis/memory caching with 30s TTL (DASH-009)

### Priority 3 — Data Quality
- [ ] Fix aging analysis to cover 61-89 day range (DASH-004)
- [ ] Read tier limits from `subscription_plans` instead of hardcoding (DASH-006)
- [ ] Implement partial payment tracking for invoices (DASH-005)
- [ ] Add real system health checks (DASH-010)

### Priority 4 — Code Quality
- [ ] Consolidate `Dashboard.tsx` and `FinancialDashboard.tsx` (DASH-007)
- [ ] Extract chat modal to `ChatModal.tsx` component (DASH-012)
- [ ] Add TypeScript interfaces for all response shapes (DASH-014)
- [ ] Move software selection to URL params or Zustand (DASH-013)

### Priority 5 — Features
- [ ] Add dashboard data export (CSV/PDF)
- [ ] Add date range picker (custom start/end dates)
- [ ] Add revenue/expense trend charts (line/bar graphs over time)
- [ ] Add real-time WebSocket updates for admin dashboard
- [ ] Add workspace-level filtering on admin dashboard
