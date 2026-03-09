# Dashboard — Routes & API Reference

## Backend Routes

### Financial Dashboard Routes (`dashboard.ts`)

#### `GET /api/dashboard/metrics`
**Auth**: `requireAuth` (JWT)  
**Purpose**: Portal usage metrics (AI assistants, messages, pages indexed)

| Param | Location | Required | Description |
|-------|----------|----------|-------------|
| — | — | — | No parameters — scoped to authenticated user |

**Response** `200`:
```json
{
  "messages": { "used": 12, "limit": 500 },
  "pagesIndexed": { "used": 3, "limit": 50 },
  "assistants": { "count": 2, "limit": 5 },
  "tier": "free"
}
```

**Error behavior**: Returns safe defaults instead of 500:
```json
{
  "messages": { "used": 0, "limit": 500 },
  "pagesIndexed": { "used": 0, "limit": 50 },
  "assistants": { "count": 0, "limit": 5 },
  "tier": "free"
}
```

**Flow**:
1. Get userId from JWT
2. Look up `team_members` for teamId
3. Query `subscriptions` + `subscription_plans` for tier/limits
4. Count `assistants` WHERE userId
5. Count `ingestion_jobs` WHERE assistant_id IN (user's assistants) AND status='completed'
6. Return aggregated metrics

---

#### `GET /api/dashboard/stats`
**Auth**: `requireAuth` (JWT)  
**Purpose**: Financial/billing dashboard — revenue, invoices, quotations, aging

| Param | Location | Required | Default | Description |
|-------|----------|----------|---------|-------------|
| `period` | Query | No | `'month'` | Time filter: `today`, `week`, `month`, `quarter`, `year`, `all` |

**Response** `200`:
```json
{
  "revenue": {
    "collected": 15000.00,
    "total_invoiced": 25000.00,
    "outstanding": 10000.00,
    "collection_rate": 60
  },
  "profit": {
    "profit": 8000.00,
    "expenses": 7000.00,
    "profit_margin": 53
  },
  "invoices": {
    "total_count": 45,
    "total_amount": 25000.00,
    "paid_count": 30,
    "unpaid_count": 15,
    "partial_count": 0
  },
  "quotations": { "total_count": 12, "accepted_count": 0 },
  "customers": { "customer_count": 38, "supplier_count": 0 },
  "payments": { "total_count": 30, "average_amount": 500.00 },
  "outstanding": {
    "current": 3000.00,
    "30_days": 4000.00,
    "60_days": 2000.00,
    "90_plus_days": 1000.00,
    "total": 10000.00
  },
  "recent_invoices": [
    {
      "invoice_id": 1,
      "invoice_number": "INV-001",
      "invoice_total": 1500.00,
      "invoice_payment_status": 0,
      "invoice_date": "2024-01-15",
      "contact_name": "Acme Corp",
      "amount_paid": 0,
      "outstanding": 1500.00
    }
  ],
  "recent_quotations": [
    {
      "quotation_id": 1,
      "quotation_number": "QUO-001",
      "quotation_total": 5000.00,
      "quotation_date": "2024-01-10",
      "contact_name": "Widget Inc"
    }
  ]
}
```

**Period date filters**:
| Period | SQL Filter |
|--------|------------|
| `today` | `invoice_date = CURDATE()` |
| `week` | `invoice_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)` |
| `month` | `invoice_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)` |
| `quarter` | `invoice_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)` |
| `year` | `invoice_date >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)` |
| `all` | No filter |

**Error behavior**: Passes to Express `next(err)` error handler.

---

### Admin Dashboard Routes (`adminDashboard.ts`)

#### `GET /api/admin/dashboard`
**Auth**: `requireAuth` (JWT)  
**Purpose**: System-wide admin statistics across all tables

| Param | Location | Required | Description |
|-------|----------|----------|-------------|
| — | — | — | No parameters |

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "workspaces": { "total": 10, "active": 10, "inactive": 0, "newThisMonth": 3 },
    "users": { "total": 50 },
    "subscriptions": { "total": 15, "active": 8, "trial": 5, "expired": 1, "pastDue": 1 },
    "software": { "total": 3, "withIntegration": 2, "modules": 12, "releases": 45 },
    "clients": { "total": 20, "online": 5, "offline": 14, "blocked": 1 },
    "ai": {
      "assistants": 8,
      "apiKeys": 4,
      "configurations": 3,
      "creditsUsed": 1500.00,
      "creditsBalance": 3500.00,
      "totalRequests": 250,
      "usageByType": [
        { "type": "chat", "count": 200, "credits": 1000.00 },
        { "type": "embedding", "count": 50, "credits": 500.00 }
      ]
    },
    "websites": { "total": 5, "deployed": 3, "draft": 2, "widgets": 4, "activeWidgets": 3 },
    "leads": { "total": 100, "new": 15, "thisMonth": 25 },
    "activationKeys": { "total": 50, "active": 40, "revoked": 10 },
    "system": { "status": "healthy", "uptime": "5d 3h 42m", "version": "0.2.0" },
    "recentActivity": [
      {
        "id": "usr_123",
        "type": "user_registered",
        "description": "User \"john@example.com\" registered",
        "actor": "john@example.com",
        "time": "2h ago"
      }
    ]
  }
}
```

**Error behavior**: Passes to Express `next(err)` error handler.

---

## Frontend Routes

| Route Path | Component | Dashboard Type |
|------------|-----------|----------------|
| `/dashboard` | `Dashboard.tsx` | Financial/billing |
| `/financial-dashboard` | `FinancialDashboard.tsx` | Financial (duplicate) |
| `/admin/dashboard` | `admin/Dashboard.tsx` | Admin task management |
| `/portal/dashboard` | `portal/Dashboard.tsx` | Portal (AI assistants) |

---

## External API Calls (Admin Dashboard)

The admin dashboard connects to **external software APIs** for task data:

| Hook | Endpoint | Description |
|------|----------|-------------|
| `useTasks({ apiUrl })` | `{software.external_live_url \| external_test_url}/tasks` | Fetches task list from external system |
| `useModules(softwareId)` | Internal `/modules?softwareId=X` | Module metadata for the software |

**Note**: The `apiUrl` is derived from the selected software's `external_mode`:
- `'live'` → `external_live_url`
- Other → `external_test_url`

---

## Portal Dashboard API Calls

| Call | Endpoint | Method | Description |
|------|----------|--------|-------------|
| Metrics | `GET /dashboard/metrics` | GET | Usage quotas |
| Assistants | `GET /assistants` | GET | User's assistant list |
| Chat | `POST /assistants/chat` | POST (SSE) | Send message, receive streaming response |

### Chat Request
```json
{
  "assistantId": "uuid",
  "message": "Hello, how can you help me?"
}
```

### Chat Response
SSE stream (`text/event-stream`):
```
data: {"token":"Hello"}
data: {"token":" there"}
data: {"token":"!"}
data: [DONE]
```

Fallback JSON:
```json
{
  "response": "Hello there!"
}
```
