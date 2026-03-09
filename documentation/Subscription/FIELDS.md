# Subscription — Field Definitions

## Database Tables

### subscription_plans
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | VARCHAR (UUID) | NO | — | Primary key |
| tier | ENUM | NO | — | `PERSONAL`, `TEAM`, `ENTERPRISE` |
| name | VARCHAR | NO | — | Display name |
| description | TEXT | YES | NULL | Plan description |
| priceMonthly | INT | NO | — | Monthly price in ZAR cents |
| priceAnnually | INT | YES | NULL | Annual price in ZAR cents |
| maxUsers | INT | NO | — | Max team members (null = unlimited) |
| maxAgents | INT | YES | NULL | Max AI agents |
| maxDevices | INT | NO | — | Max connected devices |
| cloudSyncAllowed | BOOLEAN | NO | — | Cloud sync feature flag |
| vaultAllowed | BOOLEAN | NO | — | Vault feature flag |
| prioritySupport | BOOLEAN | NO | — | Priority support flag |
| trialDays | INT | NO | — | Trial period length |
| isActive | BOOLEAN | NO | — | Plan availability |
| displayOrder | INT | NO | — | Sort order |
| createdAt | DATETIME | NO | — | — |
| updatedAt | DATETIME | NO | — | — |

**Plan Pricing (ZAR cents)**:
| Tier | Monthly | Annually | Max Users | Max Devices | Trial Days |
|------|---------|----------|-----------|-------------|------------|
| PERSONAL | 25,000 (R250) | 250,000 (R2,500) | 1 | 1 | 14 |
| TEAM | 150,000 (R1,500) | 1,500,000 (R15,000) | 5 | 5 | 14 |
| ENTERPRISE | 500,000 (R5,000) | 5,000,000 (R50,000) | unlimited | unlimited | 30 |

### subscriptions
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | VARCHAR (UUID) | NO | — | Primary key |
| teamId | VARCHAR (UUID) | NO | — | FK → teams.id *(legacy: teams table retained only for credit/subscription scoping — not multi-tenant)* |
| planId | VARCHAR (UUID) | NO | — | FK → subscription_plans.id |
| status | ENUM | NO | — | `TRIAL`, `ACTIVE`, `PAST_DUE`, `CANCELLED`, `EXPIRED` |
| billingCycle | VARCHAR | NO | — | `monthly` or `annually` |
| trialEndsAt | DATETIME | YES | NULL | Trial expiration |
| currentPeriodStart | DATETIME | NO | — | Current billing period start |
| currentPeriodEnd | DATETIME | NO | — | Current billing period end |
| cancelledAt | DATETIME | YES | NULL | When cancellation was requested |
| paymentProvider | ENUM | YES | NULL | `PAYFAST`, `YOCO`, `MANUAL` |
| externalCustomerId | VARCHAR | YES | NULL | Gateway customer reference |
| externalSubscriptionId | VARCHAR | YES | NULL | Gateway subscription reference |
| createdAt | DATETIME | NO | — | — |
| updatedAt | DATETIME | NO | — | — |

### billing_invoices
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | VARCHAR (UUID) | NO | — | Primary key |
| subscriptionId | VARCHAR (UUID) | NO | — | FK → subscriptions.id |
| invoiceNumber | VARCHAR | NO | — | Human-readable invoice number |
| description | VARCHAR | NO | — | Invoice line description |
| subtotal | INT | NO | — | Amount in cents (ex VAT) |
| vatAmount | INT | NO | — | VAT in cents |
| total | INT | NO | — | Total in cents (incl VAT) |
| periodStart | DATE | NO | — | Billing period start |
| periodEnd | DATE | NO | — | Billing period end |
| dueDate | DATE | NO | — | Payment due date |
| paidAt | DATETIME | YES | NULL | When payment received |
| pdfUrl | VARCHAR | YES | NULL | URL to generated PDF |
| createdAt | DATETIME | NO | — | — |

### credit_packages
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | VARCHAR (UUID) | NO | — | Primary key |
| name | VARCHAR(50) | NO | — | Package name |
| description | VARCHAR(200) | YES | NULL | Description |
| credits | INT | NO | — | Base credits |
| price | INT | NO | — | Price in ZAR cents |
| bonusCredits | INT | NO | 0 | Bonus credits on top |
| isActive | BOOLEAN | NO | — | Availability flag |
| featured | BOOLEAN | NO | false | Highlighted in UI |
| displayOrder | INT | NO | 0 | Sort order |
| createdAt | DATETIME | NO | — | — |
| updatedAt | DATETIME | NO | — | — |

**Default Packages (ZAR cents)**:
| Package | Credits | Bonus | Total | Price | Price/Credit |
|---------|---------|-------|-------|-------|-------------|
| Starter | 1,000 | 0 | 1,000 | 1,000 (R10) | R0.01 |
| Standard | 5,000 | 250 | 5,250 | 4,750 (R47.50) | R0.009 |
| Professional | 10,000 | 1,000 | 11,000 | 9,000 (R90) | R0.008 |
| Business | 25,000 | 3,750 | 28,750 | 21,250 (R212.50) | R0.007 |
| Enterprise | 100,000 | 25,000 | 125,000 | 75,000 (R750) | R0.006 |

### credit_balances
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | VARCHAR (UUID) | NO | — | Primary key |
| teamId | VARCHAR (UUID) | NO | — | FK → teams.id (unique) *(legacy: teams table retained only for credit balance grouping)* |
| balance | INT | NO | — | Current credit balance |
| totalPurchased | INT | NO | 0 | Lifetime credits purchased |
| totalUsed | INT | NO | 0 | Lifetime credits consumed |
| lowBalanceThreshold | INT | NO | 5000 | Alert threshold |
| lowBalanceAlertSent | BOOLEAN | NO | false | Alert already sent flag |
| createdAt | DATETIME | NO | — | — |
| updatedAt | DATETIME | NO | — | — |

### credit_transactions
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | VARCHAR (UUID) | NO | — | Primary key |
| creditBalanceId | VARCHAR (UUID) | NO | — | FK → credit_balances.id |
| type | ENUM | NO | — | `PURCHASE`, `USAGE`, `REFUND`, `BONUS`, `ADJUSTMENT` |
| amount | INT | NO | — | Positive = add, negative = deduct |
| requestType | VARCHAR | YES | NULL | `TEXT_CHAT`, `CODE_AGENT_EXECUTE`, etc. |
| requestMetadata | JSON | YES | NULL | Token counts, multipliers, etc. |
| paymentProvider | ENUM | YES | NULL | `PAYFAST`, `YOCO`, `MANUAL` |
| externalPaymentId | VARCHAR | YES | NULL | Gateway transaction ID (idempotency key) |
| description | VARCHAR | YES | NULL | Human-readable description |
| balanceAfter | INT | NO | — | Balance snapshot after this transaction |
| createdAt | DATETIME | NO | — | — |

### subscription_tier_limits (Widget Tiers)
| Column | Type | Description |
|--------|------|-------------|
| tier | VARCHAR | `free`, `starter`, `advanced`, `enterprise` |
| max_pages | INT | Max crawled pages |
| max_messages_per_month | INT | Monthly message limit |
| lead_capture | BOOLEAN | Lead capture enabled |
| tone_control | BOOLEAN | Tone customization enabled |
| daily_recrawl | BOOLEAN | Daily content refresh |
| document_uploads | BOOLEAN | Document upload support |

---

## Credit Pricing Configuration

### Request Types & Costs
| Type | Base Cost (credits) | Per-Token Cost | Description |
|------|-------------------|----------------|-------------|
| `TEXT_CHAT` | 10 | 0.01 | Full AI chat with token pricing |
| `TEXT_SIMPLE` | 5 | 0.005 | Simple text requests |
| `AI_BROKER` | 1 | — | External provider proxy (minimal) |
| `CODE_AGENT_EXECUTE` | 20 | 0.02 | Code agent with file editing |
| `FILE_OPERATION` | 1 | — | File read/write |
| `MCP_TOOL` | 5 | — | MCP tool calls (× complexity multiplier) |

### Cost Calculation
```typescript
cost = baseCost + (tokens × perTokenCost) × complexityMultiplier
// Minimum cost: 1 credit
```

### Balance Thresholds
| Level | Threshold | Action |
|-------|-----------|--------|
| WARNING | 5,000 credits | Console log alert |
| CRITICAL | 1,000 credits | Console log alert |
| EMPTY | 0 credits | Request rejected (402) |

### Constants
| Constant | Value | Description |
|----------|-------|-------------|
| `SIGNUP_BONUS_CREDITS` | 100 | Free credits on team creation |
| `REFERRAL_BONUS_CREDITS` | 500 | Credits for referrals |

---

## Zod Validation Schemas

### StartTrialSchema
```typescript
{ tier: z.enum(['PERSONAL', 'TEAM', 'ENTERPRISE']).optional().default('PERSONAL') }
```

### ChangePlanSchema
```typescript
{ tier: z.enum(['PERSONAL', 'TEAM', 'ENTERPRISE']),
  billingCycle: z.enum(['monthly', 'annually']).optional().default('monthly') }
```

### PurchaseCreditsSchema
```typescript
{ packageId: z.string(),
  paymentMethod: z.enum(['PAYFAST', 'YOCO', 'MANUAL']),
  returnUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional() }
```

### CreatePackageSchema (Admin)
```typescript
{ name: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
  credits: z.number().int().positive(),
  price: z.number().int().positive(),
  bonusCredits: z.number().int().nonnegative().default(0),
  featured: z.boolean().default(false) }
```

### AdjustCreditsSchema (Admin)
```typescript
{ amount: z.number().int(),
  description: z.string().min(1).max(200),
  type: z.enum(['ADJUSTMENT', 'BONUS', 'REFUND']).default('ADJUSTMENT') }
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PAYFAST_MERCHANT_ID` | For PayFast | PayFast merchant ID |
| `PAYFAST_MERCHANT_KEY` | For PayFast | PayFast merchant key |
| `PAYFAST_PASSPHRASE` | For PayFast | PayFast passphrase for signature |
| `YOCO_SECRET_KEY` | For Yoco | Yoco API secret key |
| `YOCO_WEBHOOK_SECRET` | For Yoco | Yoco webhook HMAC secret |
| `PAYMENT_RETURN_URL` | Optional | Default return URL after payment |
| `PAYMENT_CANCEL_URL` | Optional | Default cancel URL |
