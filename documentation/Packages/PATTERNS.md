# Packages — Architectural Patterns

## Pattern 1: Contact-Scoped Billing (vs Team-Scoped)

The legacy system attached credits to teams. Packages replace this with **contact-scoped billing** — each contact (company) owns package subscriptions and credit balances.

```
Legacy:    User → Team → Credits
Packages:  User → user_contact_link → Contact → contact_packages → Credits
```

**Why**: A single company can have multiple users. Billing is per-company, not per-user or per-team. The `user_contact_link` table maps users to their company.

---

## Pattern 2: Middleware Chain (Verify → Execute → Deduct)

Credit deduction follows a 3-phase pattern:

1. **Pre-request**: `requirePackage` resolves user → contact → subscription
2. **Pre-request**: `requireCredits` checks balance ≥ estimated cost; rejects if insufficient
3. **Post-response**: `deductCreditsAfterResponse` calculates actual cost from response metadata and deducts

```
Request → requirePackage → requireCredits → routeHandler → Response
                                                                ↓
                                              deductCreditsAfterResponse
```

**Why**: Actual token usage is only known after the AI response completes. Estimated cost acts as a floor check; actual cost is computed from `req.tokenUsage` or defaults to estimated.

---

## Pattern 3: Multi-Package Deduction Strategy

A contact may have multiple subscriptions (e.g., a base package + add-on credits). The deduction logic in `packages.ts` service iterates subscriptions in this order:

1. ACTIVE subscriptions first, then TRIAL
2. Within each status, ordered by `created_at ASC` (oldest first)
3. Deduct as much as possible from the first subscription, carry remainder to next

```sql
SELECT * FROM contact_packages
WHERE contact_id = ? AND status IN ('ACTIVE', 'TRIAL')
ORDER BY FIELD(status, 'ACTIVE', 'TRIAL'), created_at ASC
```

**Why**: Ensures primary package credits are consumed before bonus add-ons, and paid credits are used before trial credits.

---

## Pattern 4: Request Type Detection

The middleware (`detectRequestType`) inspects the Express request to classify it:

| Detection Logic | Request Type |
|----------------|--------------|
| Path contains `/chat` and body has `messages` | `TEXT_CHAT` |
| Path contains `/simple` | `TEXT_SIMPLE` |
| Path contains `/broker` | `AI_BROKER` |
| Path contains `/execute` | `CODE_AGENT_EXECUTE` |
| Path contains `/file` | `FILE_OPERATION` |
| Path contains `/mcp` or `/tool` | `MCP_TOOL` |
| Default fallback | `TEXT_CHAT` |

Each type maps to `REQUEST_PRICING` in `config/credits.ts` which defines `baseCost`, `perToken`, and `perMultiplier`.

---

## Pattern 5: Seed-on-Migrate with ON DUPLICATE KEY UPDATE

Migration 023 both creates tables and seeds data in a single migration:

```sql
INSERT INTO packages (id, slug, name, ...)
VALUES (1, 'free', 'Free', ...)
ON DUPLICATE KEY UPDATE name=VALUES(name), ...
```

**Why**: Makes the migration idempotent. Running it twice won't fail or create duplicates. It also seeds the Soft Aware contact assignment:

```sql
INSERT INTO contact_packages (contact_id, package_id, status, credits_balance, ...)
VALUES (1, 7, 'ACTIVE', 100000, ...)
ON DUPLICATE KEY UPDATE credits_balance=VALUES(credits_balance)
```

This links contact ID 1 (Soft Aware) to package ID 7 (Staff) with 100,000 credits.

---

## Pattern 6: Public Pricing with Fallback

The `GET /packages/pricing` endpoint serves public-facing pricing data:

1. Queries `packages WHERE is_active = 1 AND is_public = 1`
2. Ordered by `display_order ASC`
3. Parses `features` JSON column into arrays
4. Falls back to hardcoded pricing if the query fails

```typescript
// Fallback in LandingPage.tsx and routes/packages.ts
const FALLBACK_TIERS = [
  { name: 'Free', price: 'R0', credits: '500 credits/month', ... },
  { name: 'Starter', price: 'R199/mo', credits: '5,000 credits/month', ... },
  ...
];
```

**Why**: The landing page must always render pricing even if the database is down.

---

## Pattern 7: Contact Type Enumeration

The `contacts` table now has a `contact_type` column:

| Value | Meaning |
|-------|---------|
| `0` | Standard external company |
| `1` | Individual / sole proprietor |
| `2` | Partner / reseller |
| `3` | Internal / provider (Soft Aware) |

Contact type `3` is used for Soft Aware (ID 1) as the internal provider account.

---

## Pattern 8: Admin Tab Interface

The frontend `AIPackages.tsx` organizes package management into tabs:

| Tab | Content |
|-----|---------|
| **Packages** | CRUD for package definitions |
| **Subscriptions** | View/manage contact-package subscriptions |
| **Transactions** | Credit transaction history and adjustments |
| **User Links** | user_contact_link management |

Each tab has its own data source, loaded independently. Tabs share a common search bar and filter set.

---

## Pattern 9: Currency as Integers

All monetary values are stored as integers in **ZAR cents**:

- `price_monthly = 19900` → R199.00
- `price_annually = 199900` → R1,999.00
- `credits_balance = 5000` → 5,000 credits

**Why**: Avoids floating-point precision issues. All arithmetic is integer-based. Display formatting (`toLocaleString`, `÷ 100`) happens only at the presentation layer.

---

## Anti-Patterns to Avoid

### ❌ Don't bypass middleware for AI routes
All AI endpoints must go through `requirePackage` → `requireCredits`. Never call AI services directly without credit verification.

### ❌ Don't deduct credits before the response
The actual cost depends on token usage. Always use `deductCreditsAfterResponse` as post-response middleware.

### ❌ Don't query user_contact_link directly for billing
Use `PackageService.getContactSubscriptions()` which handles multi-package resolution and status filtering.

### ❌ Don't hardcode package limits
Limits come from the `packages` table (max_users, max_agents, etc.). Admin can change them via the UI.

### ❌ Don't assume one subscription per contact
The system supports multiple subscriptions (base + add-on). Always handle arrays of `contact_packages` rows.
