# Dashboard — Field & Data Dictionary

## API Response: `/api/dashboard/metrics` (Portal)

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `messages.used` | `number` | `ingestion_jobs` COUNT | Proxy for message usage (counts ingestion jobs, capped at limit) |
| `messages.limit` | `number` | Tier-based | 500 (FREE), 5000 (TEAM), 50000 (ENTERPRISE) |
| `pagesIndexed.used` | `number` | `ingestion_jobs` WHERE status='completed' | Total completed ingestion jobs across user's assistants |
| `pagesIndexed.limit` | `number` | Tier-based | 50 (FREE), 500 (TEAM), 5000 (ENTERPRISE) |
| `assistants.count` | `number` | `assistants` COUNT | Number of assistants owned by user |
| `assistants.limit` | `number` | `subscription_plans.maxAgents` | Plan limit (default 5) |
| `tier` | `string` | `subscription_plans.tier` | Lowercase tier name: 'free', 'team', 'enterprise' |

### Database Queries (Metrics)
```
team_members     → userId → teamId (user's team lookup)
subscriptions    → teamId → planId, status IN ('TRIAL','ACTIVE')
subscription_plans → planId → tier, maxAgents, maxUsers
assistants       → userId → COUNT (assistant inventory)
ingestion_jobs   → assistant_id IN (...) → COUNT (pages/messages)
```

---

## API Response: `/api/dashboard/stats?period=` (Financial)

### Revenue Object
| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `revenue.collected` | `number` | `SUM(payments.payment_amount)` | Total cash collected |
| `revenue.total_invoiced` | `number` | `SUM(invoices.invoice_amount)` | Total billed |
| `revenue.outstanding` | `number` | `total_invoiced - paid_total` | Unpaid balance |
| `revenue.collection_rate` | `number` | `(collected/total_invoiced)*100` | Percentage collected (0–100) |

### Profit Object
| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `profit.profit` | `number` | `collected - expenses` | Net profit |
| `profit.expenses` | `number` | `SUM(transactions.debit_amount)` | Total expenses from ledger |
| `profit.profit_margin` | `number` | `(profit/collected)*100` | Margin percentage (0–100) |

### Invoices Object
| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `invoices.total_count` | `number` | `COUNT(invoices)` | Total invoices in period |
| `invoices.total_amount` | `number` | `SUM(invoice_amount)` | Sum of all invoice amounts |
| `invoices.paid_count` | `number` | `SUM(CASE paid=1)` | Fully paid invoices |
| `invoices.unpaid_count` | `number` | `SUM(CASE paid=0)` | Unpaid invoices |
| `invoices.partial_count` | `number` | Always `0` | ⚠️ Hardcoded — partial payment not tracked |

### Quotations Object
| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `quotations.total_count` | `number` | `COUNT(quotations)` | Total quotes in period |
| `quotations.accepted_count` | `number` | Always `0` | ⚠️ Hardcoded — acceptance not tracked |

### Customers Object
| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `customers.customer_count` | `number` | `COUNT(contacts)` WHERE active=1 | Active contacts |
| `customers.supplier_count` | `number` | Always `0` | ⚠️ Hardcoded — supplier distinction not implemented |

### Payments Object
| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `payments.total_count` | `number` | `COUNT(payments)` | Payment records in period |
| `payments.average_amount` | `number` | `AVG(payment_amount)` | Average payment value |

### Outstanding Aging Object
| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `outstanding.current` | `number` | Due date not yet passed | Not overdue |
| `outstanding.30_days` | `number` | 1–30 days overdue | |
| `outstanding.60_days` | `number` | 31–60 days overdue | |
| `outstanding.90_plus_days` | `number` | 90+ days overdue | ⚠️ Gap: 61-89 days not captured |
| `outstanding.total` | `number` | Sum of all unpaid | |

### Recent Invoices Array (last 5)
| Field | Type | Source |
|-------|------|--------|
| `invoice_id` | `number` | `invoices.id` |
| `invoice_number` | `string` | `invoices.invoice_number` |
| `invoice_total` | `number` | `invoices.invoice_amount` |
| `invoice_payment_status` | `number` | `invoices.paid` (0=unpaid, 1=paid) |
| `invoice_date` | `string` | `invoices.invoice_date` |
| `contact_name` | `string` | `contacts.company_name` |
| `amount_paid` | `number` | `SUM(payments.payment_amount)` |
| `outstanding` | `number` | `invoice_amount - paid_total` |

### Recent Quotations Array (last 5)
| Field | Type | Source |
|-------|------|--------|
| `quotation_id` | `number` | `quotations.id` |
| `quotation_number` | `string` | `quotations.quotation_number` |
| `quotation_total` | `number` | `quotations.quotation_amount` |
| `quotation_date` | `string` | `quotations.quotation_date` |
| `contact_name` | `string` | `contacts.company_name` |

---

## API Response: `/api/admin/dashboard` (Admin)

### Workspaces
| Field | Type | Source |
|-------|------|--------|
| `workspaces.total` | `number` | `COUNT(teams)` |
| `workspaces.active` | `number` | Same as total (⚠️ no active flag) |
| `workspaces.inactive` | `number` | Always `0` |
| `workspaces.newThisMonth` | `number` | `COUNT(teams)` WHERE createdAt >= 30 days ago |

### Users
| Field | Type | Source |
|-------|------|--------|
| `users.total` | `number` | `COUNT(users)` |

### Subscriptions
| Field | Type | Source |
|-------|------|--------|
| `subscriptions.total` | `number` | `COUNT(subscriptions)` |
| `subscriptions.active` | `number` | status='ACTIVE' |
| `subscriptions.trial` | `number` | status='TRIAL' |
| `subscriptions.expired` | `number` | status='EXPIRED' |
| `subscriptions.pastDue` | `number` | status='PAST_DUE' |

### Software
| Field | Type | Source |
|-------|------|--------|
| `software.total` | `number` | `COUNT(update_software)` |
| `software.withIntegration` | `number` | `has_external_integration=1` |
| `software.modules` | `number` | `COUNT(update_modules)` |
| `software.releases` | `number` | `COUNT(update_releases)` |

### Clients (Desktop)
| Field | Type | Source |
|-------|------|--------|
| `clients.total` | `number` | `COUNT(update_clients)` |
| `clients.online` | `number` | `last_heartbeat >= NOW() - 5 MIN` |
| `clients.offline` | `number` | `total - online - blocked` |
| `clients.blocked` | `number` | `is_blocked=1` |

### AI
| Field | Type | Source |
|-------|------|--------|
| `ai.assistants` | `number` | `COUNT(assistants)` |
| `ai.apiKeys` | `number` | `COUNT(api_keys)` |
| `ai.configurations` | `number` | `COUNT(ai_model_config)` |
| `ai.creditsUsed` | `number` | `SUM(ABS(amount))` WHERE type='USAGE' |
| `ai.creditsBalance` | `number` | `SUM(balance)` from `credit_balances` |
| `ai.totalRequests` | `number` | `COUNT` WHERE type='USAGE' |
| `ai.usageByType[]` | `array` | Grouped by `requestType`: { type, count, credits } |

### Websites
| Field | Type | Source |
|-------|------|--------|
| `websites.total` | `number` | `COUNT(generated_sites)` |
| `websites.deployed` | `number` | status='deployed' |
| `websites.draft` | `number` | status='draft' |
| `websites.widgets` | `number` | `COUNT(widget_clients)` |
| `websites.activeWidgets` | `number` | status='active' |

### Leads
| Field | Type | Source |
|-------|------|--------|
| `leads.total` | `number` | `COUNT(lead_captures)` |
| `leads.new` | `number` | status='NEW' |
| `leads.thisMonth` | `number` | createdAt >= 30 days ago |

### Activation Keys
| Field | Type | Source |
|-------|------|--------|
| `activationKeys.total` | `number` | `COUNT(activation_keys)` |
| `activationKeys.active` | `number` | isActive=1 |
| `activationKeys.revoked` | `number` | isActive=0 |

### System
| Field | Type | Source |
|-------|------|--------|
| `system.status` | `'healthy'` | Hardcoded |
| `system.uptime` | `string` | `process.uptime()` formatted as "Xd Xh Xm" |
| `system.version` | `string` | `process.env.npm_package_version` or '0.2.0' |

### Recent Activity Array (last 10)
| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Prefixed: `ws_`, `usr_`, `client_`, `lead_` |
| `type` | `string` | `workspace_created`, `user_registered`, `client_heartbeat`, `lead_captured` |
| `description` | `string` | Human-readable description |
| `actor` | `string` | Email, IP, or 'system' |
| `time` | `string` | Relative time string from `formatTimeAgo()` |

---

## Frontend State

### Dashboard.tsx (Financial)
| State | Type | Default | Description |
|-------|------|---------|-------------|
| `loading` | `boolean` | `true` | Data fetch in progress |
| `period` | `string` | `'month'` | Time filter: today/week/month/quarter/year/all |
| `stats` | `any` | `null` | Full `/dashboard/stats` response |

### Admin Dashboard.tsx
| State | Type | Default | Description |
|-------|------|---------|-------------|
| `selectedSoftware` | `Software \| null` | `null` | Currently selected software product |
| `authDialogOpen` | `boolean` | `false` | 401 auth dialog trigger |
| Derived `apiUrl` | `string \| null` | — | Live or test URL from selected software |
| `tasks` | `Task[]` | `[]` | From `useTasks({ apiUrl })` hook |
| `loading` | `boolean` | — | From `useTasks` hook |
| `error` | `string` | — | From `useTasks` hook |
| `modules` | `Module[]` | `[]` | From `useModules(softwareId)` hook |

### Portal Dashboard.tsx
| State | Type | Default | Description |
|-------|------|---------|-------------|
| `metrics` | `DashboardMetrics \| null` | `null` | Usage quotas from `/dashboard/metrics` |
| `assistants` | `AssistantSummary[]` | `[]` | User's AI assistants |
| `loading` | `boolean` | `true` | Initial data fetch |
| `chatModal` | `AssistantSummary \| null` | `null` | Currently open chat assistant |
| `messages` | `ChatMessage[]` | `[]` | Chat conversation history |
| `chatInput` | `string` | `''` | Current chat input text |
| `streaming` | `boolean` | `false` | SSE streaming in progress |
