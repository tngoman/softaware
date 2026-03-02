# Soft Aware Backend API Specification
## For Frontend & Mobile App Developers

**Base URL**: `http://localhost:8787` (development) | `https://api.softaware.net.za` (production)

**Last Updated**: February 28, 2026

---

## Table of Contents
1. [Authentication](#authentication)
2. [Public Endpoints](#public-endpoints)
3. [Profile / Self-Service (Mobile)](#profile--self-service-mobile)
4. [Protected Endpoints](#protected-endpoints)
5. [Admin Endpoints](#admin-endpoints)
6. [Updates System](#updates-system)
7. [Error Handling](#error-handling)
8. [Rate Limiting](#rate-limiting)
9. [Mobile App Integration Guide](#mobile-app-integration-guide)

---

## Authentication

### JWT Token Authentication
Most endpoints require authentication via JWT token in the `Authorization` header:

```http
Authorization: Bearer <jwt_token>
```

**Token Lifetimes:**
| Context | Expiry | How to get |
|---------|--------|------------|
| Web (default) | 1 hour | `POST /auth/login` |
| Mobile (remember me) | 30 days | `POST /auth/login` with `"rememberMe": true` |

Tokens can be refreshed before expiry via `POST /auth/refresh`.

### API Key Authentication
Some endpoints (AI, MCP, credit balance) use API key authentication:

```http
X-API-Key: <api_key>
```

API keys are created and managed from `GET /profile/api-keys` or `POST /api-keys`.

---

## Public Endpoints

### 1. Lead Assistant (No Auth Required)

#### POST `/public/leads/assistant`
Conversational AI for lead qualification on landing page.

**Request Body:**
```json
{
  "sessionId": "string (8-128 chars)",
  "page": "string (1-64 chars, default: 'landing')",
  "message": "string (1-600 chars)",
  "history": [
    {
      "role": "user | assistant",
      "content": "string (1-600 chars)"
    }
  ]
}
```

**Response:**
```json
{
  "reply": "string - assistant's response",
  "readyToContact": "boolean - whether lead is qualified",
  "leadCaptured": "boolean - whether lead was saved to DB",
  "leadId": "string? - UUID if captured",
  "guarded": "boolean? - true if abuse detected"
}
```

**Rate Limiting:**
- 25 requests per IP per 15-minute window
- 30-minute block on violation

**Error Responses:**
```json
// 400 - Invalid Request
{
  "error": "INVALID_REQUEST",
  "details": { /* zod validation errors */ }
}

// 429 - Rate Limited
{
  "error": "RATE_LIMITED",
  "message": "Too many requests. Please try again later.",
  "retryAfterSeconds": 1800
}

// 502 - Ollama Unavailable
{
  "error": "ASSISTANT_UNAVAILABLE",
  "message": "Lead assistant is temporarily unavailable."
}
```

**Example:**
```typescript
const response = await fetch('/public/leads/assistant', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: localStorage.getItem('session_id'),
    page: 'landing',
    message: 'I need a chatbot for customer support',
    history: [
      { role: 'assistant', content: 'Hi, how can I help?' },
      { role: 'user', content: 'I need a chatbot' }
    ]
  })
});
```

---

### 2. Authentication

#### POST `/auth/login`
Login with email and password.

**Request Body:**
```json
{
  "email": "string",
  "password": "string",
  "rememberMe": "boolean? (default: false) — set true for mobile to get 30-day token"
}
```

**Response:**
```json
{
  "accessToken": "string - JWT token",
  "token": "string - JWT token (alias)",
  "expiresIn": "string - e.g. '1h' or '30d'",
  "user": {
    "id": "string",
    "email": "string",
    "name": "string?",
    "phone": "string?",
    "role": "admin | client"
  },
  "team": {
    "id": "string",
    "name": "string",
    "role": "ADMIN | ARCHITECT | OPERATOR | AUDITOR"
  }
}
```

**Error:**
```json
{
  "error": "BAD_REQUEST",
  "message": "Invalid email or password"
}
```

---

#### POST `/auth/register`
Register new user account.

**Request Body:**
```json
{
  "email": "string",
  "password": "string (min 8 chars)",
  "name": "string?"
}
```

**Response:**
```json
{
  "token": "string - JWT token",
  "user": {
    "id": "string",
    "email": "string",
    "role": "client",
    "name": "string?"
  }
}
```

---

### 3. Health Check

#### GET `/healthz`
Check if backend is running.

**Response:**
```json
{
  "ok": true
}
```

---

## Profile / Self-Service (Mobile)
**Authentication Required**: JWT token. These endpoints are designed for the mobile app used by both **staff** (ADMIN) and **clients** (OPERATOR/AUDITOR).

### GET `/profile`
Get the authenticated user's complete profile including team, subscription and credit summary. This is the primary "home screen" data source for the mobile app.

**Response:**
```json
{
  "user": {
    "id": "string",
    "email": "string",
    "name": "string?",
    "phone": "string?",
    "avatarUrl": "string?",
    "createdAt": "ISO date string"
  },
  "team": {
    "id": "string",
    "name": "string",
    "role": "ADMIN | ARCHITECT | OPERATOR | AUDITOR"
  },
  "subscription": {
    "id": "string",
    "status": "TRIAL | ACTIVE | PAST_DUE | CANCELLED | EXPIRED",
    "tier": "PERSONAL | TEAM | ENTERPRISE",
    "planName": "string",
    "trialEndsAt": "ISO date string?",
    "currentPeriodEnd": "ISO date string"
  },
  "credits": {
    "balance": "number",
    "totalPurchased": "number",
    "totalUsed": "number"
  }
}
```

---

### PUT `/profile`
Update the authenticated user's profile information.

**Request Body (all fields optional):**
```json
{
  "name": "string (1–255 chars)",
  "phone": "string (1–50 chars)",
  "avatarUrl": "string (valid URL, max 512 chars)"
}
```

**Response:**
```json
{
  "message": "Profile updated",
  "user": {
    "id": "string",
    "email": "string",
    "name": "string",
    "phone": "string",
    "avatarUrl": "string?",
    "updatedAt": "ISO date string"
  }
}
```

---

### POST `/profile/change-password`
Change the authenticated user's password. Requires the current password for verification.

**Request Body:**
```json
{
  "currentPassword": "string",
  "newPassword": "string (min 8 chars)"
}
```

**Response:**
```json
{
  "message": "Password changed successfully"
}
```

**Error (wrong current password):**
```json
{
  "error": "BAD_REQUEST",
  "message": "Current password is incorrect"
}
```

---

### GET `/profile/team`
Get the user's team details and all members. Useful for the "Team" screen in the mobile app.

**Response:**
```json
{
  "team": {
    "id": "string",
    "name": "string",
    "createdAt": "ISO date string"
  },
  "members": [
    {
      "userId": "string",
      "email": "string",
      "name": "string?",
      "role": "ADMIN | ARCHITECT | OPERATOR | AUDITOR",
      "joinedAt": "ISO date string"
    }
  ],
  "myRole": "ADMIN | ARCHITECT | OPERATOR | AUDITOR"
}
```

---

### GET `/profile/api-keys`
List the authenticated user's API keys (key values are masked).

**Response:**
```json
{
  "apiKeys": [
    {
      "id": "string",
      "name": "string",
      "keyPreview": "****abcd1234",
      "isActive": "boolean",
      "lastUsedAt": "ISO date string?",
      "createdAt": "ISO date string",
      "expiresAt": "ISO date string?"
    }
  ]
}
```

---

### GET `/profile/invoices`
List the team's invoices for the billing screen.

**Response:**
```json
{
  "invoices": [
    {
      "id": "string",
      "invoiceNumber": "string",
      "description": "string",
      "subtotal": "number (cents)",
      "subtotalDisplay": "string - e.g., 'R500.00'",
      "vatAmount": "number (cents)",
      "vatDisplay": "string",
      "total": "number (cents)",
      "totalDisplay": "string",
      "periodStart": "ISO date string",
      "periodEnd": "ISO date string",
      "dueDate": "ISO date string",
      "paidAt": "ISO date string?",
      "status": "PAID | PENDING | OVERDUE",
      "pdfUrl": "string?"
    }
  ]
}
```

---

## Protected Endpoints
**Authentication Required**: All endpoints below require JWT token.

### Subscriptions

#### GET `/subscriptions/plans`
Get all active subscription plans.

**Response:**
```json
{
  "plans": [
    {
      "id": "string",
      "tier": "PERSONAL | TEAM | ENTERPRISE",
      "name": "string",
      "description": "string?",
      "priceMonthly": "number - in cents",
      "priceAnnually": "number - in cents",
      "trialDays": "number",
      "features": {
        "maxUsers": "number",
        "maxAgents": "number",
        "maxDevices": "number",
        "cloudSync": "boolean",
        "vault": "boolean",
        "prioritySupport": "boolean"
      },
      "isActive": "boolean"
    }
  ]
}
```

---

#### GET `/subscriptions/current`
Get current user's subscription.

**Response:**
```json
{
  "subscription": {
    "id": "string",
    "status": "TRIAL | ACTIVE | PAST_DUE | CANCELLED | EXPIRED",
    "currentPeriodStart": "ISO date string",
    "currentPeriodEnd": "ISO date string",
    "trialEndsAt": "ISO date string?",
    "cancelledAt": "ISO date string?",
    "plan": { /* SubscriptionPlan object */ }
  }
}
```

**404 Response**: No active subscription
```json
null
```

---

#### POST `/subscriptions/start-trial`
Start a trial subscription.

**Request Body:**
```json
{
  "planTier": "PERSONAL | TEAM | ENTERPRISE"
}
```

**Response:**
```json
{
  "subscription": { /* Subscription object */ }
}
```

---

### Credits

#### GET `/credits/balance`
Get current team's credit balance.

**Response:**
```json
{
  "balance": {
    "id": "string",
    "teamId": "string",
    "balance": "number",
    "totalPurchased": "number",
    "totalUsed": "number",
    "formattedBalance": "string - e.g., 'R 1,250.00'",
    "updatedAt": "ISO date string"
  }
}
```

---

#### GET `/credits/transactions`
Get credit transaction history.

**Query Params:**
- `limit`: number (default: 50)
- `offset`: number (default: 0)

**Response:**
```json
{
  "transactions": [
    {
      "id": "string",
      "type": "PURCHASE | USAGE | REFUND | BONUS | ADJUSTMENT",
      "amount": "number - credits (negative for usage)",
      "balanceAfter": "number",
      "requestType": "TEXT_CHAT | TEXT_SIMPLE | CODE_AGENT_EXECUTE?",
      "description": "string?",
      "formattedAmount": "string",
      "formattedBalance": "string",
      "createdAt": "ISO date string"
    }
  ],
  "total": "number",
  "pagination": {
    "limit": "number",
    "offset": "number",
    "hasMore": "boolean"
  }
}
```

---

#### GET `/credits/packages`
Get available credit packages for purchase.

**Response:**
```json
{
  "packages": [
    {
      "id": "string",
      "name": "string",
      "description": "string?",
      "credits": "number",
      "bonusCredits": "number",
      "totalCredits": "number - credits + bonusCredits",
      "price": "number - in cents",
      "formattedPrice": "string - e.g., 'R 500'",
      "featured": "boolean"
    }
  ]
}
```

---

### AI Services

#### POST `/ai/chat`
Send chat request to AI (supports multiple providers).

**Headers:**
```http
X-API-Key: <api_key>
```

**Request Body:**
```json
{
  "messages": [
    {
      "role": "system | user | assistant",
      "content": "string",
      "files": [
        {
          "mimeType": "string",
          "dataBase64": "string"
        }
      ]
    }
  ],
  "model": "string?",
  "temperature": "number? (0-2)",
  "max_tokens": "number?",
  "provider": "softaware | openai | azure-openai | gemini | groq | ollama?",
  "providerConfig": "object?"
}
```

**Response:**
```json
{
  "content": "string - AI response",
  "model": "string",
  "usage": {
    "promptTokens": "number",
    "completionTokens": "number",
    "totalTokens": "number"
  }
}
```

---

#### POST `/ai/simple`
Simplified AI chat (single prompt).

**Headers:**
```http
X-API-Key: <api_key>
```

**Request Body:**
```json
{
  "prompt": "string",
  "systemPrompt": "string?",
  "provider": "softaware | openai | ollama?",
  "model": "string?",
  "temperature": "number? (0-2)"
}
```

**Response:**
```json
{
  "content": "string - AI response"
}
```

---

### Portal AI Configuration

#### GET `/ai-config`
Get team's AI model preferences.

**Response:**
```json
{
  "defaultTextProvider": "glm | ollama",
  "defaultTextModel": "string",
  "visionProvider": "glm | ollama",
  "visionModel": "string",
  "codeProvider": "glm | ollama",
  "codeModel": "string"
}
```

---

#### PUT `/ai-config`
Update team's AI model preferences.

**Request Body:**
```json
{
  "defaultTextProvider": "glm | ollama",
  "defaultTextModel": "string",
  "visionProvider": "glm | ollama",
  "visionModel": "string",
  "codeProvider": "glm | ollama",
  "codeModel": "string"
}
```

**Response:**
```json
{
  "config": { /* Updated AIModelConfig */ }
}
```

---

## Admin Endpoints
**Authentication Required**: JWT token with `role: "admin"`

### Admin - Clients/Workspaces

#### GET `/admin/clients`
Get all connected workspaces (devices).

**Response:**
```json
{
  "clients": [
    {
      "deviceId": "string",
      "appVersion": "string?",
      "isActive": "boolean",
      "tier": "PERSONAL | TEAM | ENTERPRISE",
      "lastSeenAt": "ISO date string",
      "createdAt": "ISO date string",
      "agentCount": "number"
    }
  ]
}
```

---

#### GET `/admin/clients/:deviceId/agents`
Get all endpoints for a specific workspace.

**Response:**
```json
{
  "agents": [
    {
      "deviceId": "string",
      "agentId": "string",
      "name": "string",
      "version": "string",
      "region": "string",
      "compliance": "object",
      "blueprint": "object",
      "createdAt": "ISO date string",
      "updatedAt": "ISO date string"
    }
  ]
}
```

---

### Admin - Activation Keys

#### GET `/admin/activation-keys`
Get all activation keys.

**Response:**
```json
{
  "keys": [
    {
      "id": "string",
      "code": "string",
      "tier": "PERSONAL | TEAM | ENTERPRISE",
      "isActive": "boolean",
      "cloudSyncAllowed": "boolean",
      "vaultAllowed": "boolean",
      "maxAgents": "number?",
      "maxUsers": "number?",
      "createdAt": "ISO date string"
    }
  ]
}
```

---

#### POST `/admin/activation-keys`
Create new activation key.

**Request Body:**
```json
{
  "tier": "PERSONAL | TEAM | ENTERPRISE",
  "cloudSyncAllowed": "boolean",
  "vaultAllowed": "boolean",
  "maxAgents": "number?",
  "maxUsers": "number?"
}
```

**Response:**
```json
{
  "key": { /* ActivationKey object */ }
}
```

---

#### DELETE `/admin/activation-keys/:id`
Revoke an activation key.

**Response:**
```json
{
  "success": true
}
```

---

### Admin - Credits

#### GET `/admin/credits/balances/:teamId`
Get credit balance for specific team.

**Response:**
```json
{
  "balance": {
    "id": "string",
    "teamId": "string",
    "balance": "number",
    "totalPurchased": "number",
    "totalUsed": "number",
    "formattedBalance": "string",
    "team": {
      "id": "string",
      "name": "string"
    }
  }
}
```

---

#### GET `/admin/credits/balances/:teamId/transactions`
Get transaction history for team.

**Query Params:**
- `limit`: number
- `offset`: number

**Response:**
```json
{
  "transactions": [ /* Array of CreditTransaction */ ],
  "total": "number",
  "pagination": {
    "limit": "number",
    "offset": "number",
    "hasMore": "boolean"
  }
}
```

---

#### POST `/admin/credits/balances/:teamId/adjust`
Manually adjust team credits.

**Request Body:**
```json
{
  "amount": "number - positive or negative",
  "description": "string",
  "type": "ADJUSTMENT | BONUS | REFUND?"
}
```

**Response:**
```json
{
  "balance": { /* Updated CreditBalance */ }
}
```

---

### Admin - Subscriptions

#### GET `/admin/subscriptions`
Get all subscriptions (paginated).

**Query Params:**
- `status`: `TRIAL | ACTIVE | PAST_DUE | CANCELLED | EXPIRED?`
- `tier`: `PERSONAL | TEAM | ENTERPRISE?`
- `limit`: number (default: 50)
- `offset`: number (default: 0)

**Response:**
```json
{
  "subscriptions": [
    {
      "id": "string",
      "status": "string",
      "currentPeriodStart": "ISO date string",
      "currentPeriodEnd": "ISO date string",
      "trialEndsAt": "ISO date string?",
      "plan": { /* SubscriptionPlan */ },
      "team": {
        "id": "string",
        "name": "string"
      }
    }
  ],
  "total": "number",
  "pagination": {
    "limit": "number",
    "offset": "number",
    "hasMore": "boolean"
  }
}
```

---

### Admin - Dashboard Stats

#### GET `/admin/stats`
Get dashboard statistics.

**Response:**
```json
{
  "totalClients": "number",
  "activeClients": "number",
  "totalAgents": "number",
  "totalTeams": "number"
}
```

---

## Updates System

The Updates system (previously a separate PHP API at `updates.softaware.co.za`) has been absorbed into this backend. All endpoints are mounted under `/updates/`.

### Database Tables

| Table | Description |
|-------|-------------|
| `upd_software` | Software product registry (name, key, external integration) |
| `upd_updates` | Versioned update packages (file, version, migration info) |
| `upd_clients` | Client heartbeat tracking (hostname, OS, version, remote control) |
| `upd_modules` | Software modules per product |
| `upd_user_modules` | Developer ↔ module assignments |
| `upd_installed_updates` | Installed updates tracker |
| `upd_password_reset_tokens` | OTP-based password reset tokens |

### Endpoint Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/updates/info` | Public | API metadata |
| `GET` | `/updates/dashboard` | JWT | Dashboard stats |
| `GET` | `/updates/api_status` | Public | System health |
| `GET/POST/PUT/DELETE` | `/updates/software` | Public read / Admin write | Software CRUD |
| `GET/POST/PUT/DELETE` | `/updates/updates` | Public read / Admin write | Update packages CRUD |
| `POST` | `/updates/upload` | API Key (`X-API-Key`) | File upload (multipart) |
| `GET` | `/updates/download?update_id=` | Public (`X-Software-Key`) | File download |
| `POST` | `/updates/heartbeat` | Public (`software_key`) | Client presence + update check |
| `GET/PUT/DELETE` | `/updates/clients` | Admin | Client management + remote control |
| `GET/POST/PUT/DELETE` | `/updates/modules` | JWT read / Admin write | Module CRUD |
| `GET/POST/DELETE` | `/updates/modules/:id/developers` | JWT read / Admin write | Developer assignments |
| `GET` | `/updates/installed` | Public | Installed updates list |
| `GET` | `/updates/schema?id=` | Public | Schema file content |
| `POST` | `/updates/password_reset` | Public | Request OTP |
| `POST` | `/updates/verify_otp` | Public | Verify OTP |
| `POST` | `/updates/reset_password` | Public | Execute password reset |

### Key Differences from Legacy PHP API

1. **Authentication**: JWT tokens (not Base64-encoded credentials)
2. **User IDs**: UUID strings (not auto-increment integers)
3. **Users**: Shared `User` table with the main platform
4. **Upload API Key**: Still uses `X-API-Key` header for backward compatibility

See [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for full endpoint details with request/response examples.

---

## Business API (Contacts, Invoicing, Quotations, Accounting)

The Business API provides endpoints for managing contacts, quotations, invoices, and accounting transactions. This was absorbed from the legacy PHP API (`desilope_softaware`) and integrated into the Node.js backend.

### Authentication
All Business API endpoints require JWT authentication via the `Authorization: Bearer <token>` header.

### Contacts Endpoints

#### List Contacts
```http
GET /contacts
Authorization: Bearer <token>
```

**Query Parameters:**
- `search` (optional): Search by company name or contact person
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Results per page (default: 50)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "company_name": "Rely Precisions",
      "contact_person": "Muzi",
      "email": "muzis@rely.co.za",
      "phone": "+27 11 914 1640",
      "fax": null,
      "website": null,
      "location": "Commissioner Street Boksburg",
      "contact_code": "4780275113",
      "remarks": null,
      "active": 1,
      "created_at": "2025-01-01T10:00:00.000Z",
      "updated_at": "2025-01-01T10:00:00.000Z"
    }
  ]
}
```

#### Get Single Contact
```http
GET /contacts/:id
Authorization: Bearer <token>
```

#### Create Contact
```http
POST /contacts
Authorization: Bearer <token>
Content-Type: application/json

{
  "company_name": "New Company",
  "contact_person": "John Doe",
  "email": "john@example.com",
  "phone": "+27 10 000 0000",
  "location": "Johannesburg"
}
```

**Required fields:** `company_name`

#### Update Contact
```http
PUT /contacts/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "newemail@example.com",
  "phone": "+27 11 111 1111"
}
```

Partial updates supported.

#### Delete Contact (Soft Delete)
```http
DELETE /contacts/:id
Authorization: Bearer <token>
```

#### Get Contact's Quotations
```http
GET /contacts/:id/quotations
Authorization: Bearer <token>
```

#### Get Contact's Invoices
```http
GET /contacts/:id/invoices
Authorization: Bearer <token>
```

### Quotations Endpoints

#### List Quotations (Paginated)
```http
GET /quotations?page=1&limit=50
Authorization: Bearer <token>
```

#### Get Single Quotation with Items
```http
GET /quotations/:id
Authorization: Bearer <token>
```

Returns quotation header and all line items.

#### Create Quotation
```http
POST /quotations
Authorization: Bearer <token>
Content-Type: application/json

{
  "quotation_number": "QT-001",
  "contact_id": 1,
  "quotation_amount": 5000.00,
  "quotation_date": "2025-02-28",
  "remarks": "For client review"
}
```

**Required fields:** `quotation_number`, `contact_id`

#### Update Quotation
```http
PUT /quotations/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "remarks": "Updated remarks"
}
```

Partial updates supported.

#### Delete Quotation
```http
DELETE /quotations/:id
Authorization: Bearer <token>
```

#### Add Line Item to Quotation
```http
POST /quotations/:id/items
Authorization: Bearer <token>
Content-Type: application/json

{
  "item_description": "Safety Equipment",
  "item_price": 1000.00,
  "item_quantity": 5,
  "item_discount": 0.00
}
```

`line_total` is auto-calculated as: `(item_price * item_quantity) - item_discount`

#### Remove Line Item from Quotation
```http
DELETE /quotations/:id/items/:itemId
Authorization: Bearer <token>
```

#### Convert Quotation to Invoice
```http
POST /quotations/:id/convert-to-invoice
Authorization: Bearer <token>
Content-Type: application/json

{
  "invoice_number": "INV-001",
  "invoice_date": "2025-02-28",
  "due_date": "2025-03-28"
}
```

Creates invoice with all quotation line items copied over. Returns the new invoice.

### Invoices Endpoints

#### List Invoices (Paginated)
```http
GET /invoices?page=1&limit=50&paid=0
Authorization: Bearer <token>
```

**Query Parameters:**
- `paid` (optional): Filter by payment status (0=unpaid, 1=paid)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 50)

#### Get Single Invoice with Items and Payments
```http
GET /invoices/:id
Authorization: Bearer <token>
```

#### Create Invoice
```http
POST /invoices
Authorization: Bearer <token>
Content-Type: application/json

{
  "invoice_number": "INV-002",
  "contact_id": 2,
  "invoice_amount": 3500.00,
  "invoice_date": "2025-02-28",
  "due_date": "2025-03-31"
}
```

**Required fields:** `invoice_number`, `contact_id`, `invoice_amount`

#### Update Invoice
```http
PUT /invoices/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "due_date": "2025-04-15"
}
```

Partial updates supported.

#### Delete Invoice
```http
DELETE /invoices/:id
Authorization: Bearer <token>
```

#### Add Line Item to Invoice
```http
POST /invoices/:id/items
Authorization: Bearer <token>
Content-Type: application/json

{
  "item_description": "Consulting Services",
  "item_price": 500.00,
  "item_quantity": 7,
  "item_discount": 0.00
}
```

#### Remove Line Item from Invoice
```http
DELETE /invoices/:id/items/:itemId
Authorization: Bearer <token>
```

#### Record Payment
```http
POST /invoices/:id/payments
Authorization: Bearer <token>
Content-Type: application/json

{
  "payment_date": "2025-02-28",
  "payment_amount": 1000.00,
  "payment_method": "Bank Transfer",
  "reference_number": "TXN12345"
}
```

When total paid >= invoice_amount, invoice is automatically marked as `paid = 1`.

#### Get Invoice Payments
```http
GET /invoices/:id/payments
Authorization: Bearer <token>
```

### Accounting Endpoints

#### Chart of Accounts

**List Accounts**
```http
GET /accounting/accounts?type=asset
Authorization: Bearer <token>
```

**Query Parameters:**
- `type` (optional): Filter by account type (asset, liability, equity, income, expense)

**Get Single Account**
```http
GET /accounting/accounts/:id
Authorization: Bearer <token>
```

**Create Account**
```http
POST /accounting/accounts
Authorization: Bearer <token>
Content-Type: application/json

{
  "account_code": "1000",
  "account_name": "Bank Account",
  "account_type": "asset"
}
```

**Required fields:** `account_code`, `account_name`, `account_type`

**Update Account**
```http
PUT /accounting/accounts/:id
Authorization: Bearer <token>
Content-Type: application/json
```

#### Transactions

**List Transactions**
```http
GET /accounting/transactions?page=1&limit=50&account_id=1
Authorization: Bearer <token>
```

**Create Transaction**
```http
POST /accounting/transactions
Authorization: Bearer <token>
Content-Type: application/json

{
  "transaction_date": "2025-02-28",
  "account_id": 1,
  "debit_amount": 1000.00,
  "credit_amount": 0.00,
  "description": "Cash in",
  "reference_number": "DEP123"
}
```

**Required fields:** `transaction_date`, `account_id`, and at least one of (`debit_amount`, `credit_amount`)

#### Ledger

**Get Ledger Entries**
```http
GET /accounting/ledger?account_id=1&page=1&limit=50
Authorization: Bearer <token>
```

**Get Account Balance**
```http
GET /accounting/accounts/:id/balance
Authorization: Bearer <token>
```

Returns current account balance from latest ledger entry.

#### Tax Rates

**List Tax Rates**
```http
GET /accounting/tax-rates
Authorization: Bearer <token>
```

**Create Tax Rate**
```http
POST /accounting/tax-rates
Authorization: Bearer <token>
Content-Type: application/json

{
  "tax_name": "VAT",
  "tax_percentage": 15.00,
  "description": "Value Added Tax"
}
```

**Update Tax Rate**
```http
PUT /accounting/tax-rates/:id
Authorization: Bearer <token>
```

### Business Database Schema

Business tables use consistent `snake_case` naming (no `tb_` or other prefixes):

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `contacts` | Customer/supplier contact information | company_name, contact_person, email, phone, location |
| `contact_groups` | Contact grouping/categorization | group_name |
| `categories` | Product/service categories | category_name, category_code |
| `pricing` | Pricing list items | pricing_name, pricing_price |
| `quotations` | Quotation headers | quotation_number, contact_id, quotation_amount |
| `quote_items` | Quotation line items | quotation_id, item_description, item_price, item_quantity, line_total |
| `invoices` | Invoice headers | invoice_number, contact_id, invoice_amount, paid |
| `invoice_items` | Invoice line items | invoice_id, item_description, item_price, item_quantity, line_total |
| `payments` | Payment records | invoice_id, payment_date, payment_amount |
| `accounts` | Chart of accounts | account_code, account_name, account_type |
| `transactions` | Accounting transactions | account_id, transaction_date, debit_amount, credit_amount |
| `ledger` | Account ledger (running balance) | account_id, transaction_id, balance |
| `tax_rates` | Tax rate definitions | tax_name, tax_percentage |
| `expense_categories` | Expense categorization | category_name |
| `app_settings` | Application configuration | setting_key, setting_value |

### Data Type Notes

- **Amounts**: `DECIMAL(15,4)` for currency values (4 decimal places)
- **Discounts**: `DECIMAL(10,4)` for percentage or fixed discounts
- **Dates**: `DATE` format (YYYY-MM-DD)
- **Timestamps**: `TIMESTAMP` with ISO 8601 format strings
- **User IDs**: `VARCHAR(36)` (UUID format)  
- **Soft Deletes**: `active` column (TINYINT, 1=active, 0=deleted)

### Common Business API Response Codes

| Status | Meaning |
|--------|---------|
| 200 | Success (GET, PUT) |
| 201 | Created (POST successful insert) |
| 400 | Bad Request (invalid data, contact not found, etc.) |
| 401 | Unauthorized (missing/invalid token) |
| 404 | Not Found (resource doesn't exist) |
| 500 | Server Error |

---

## Error Handling

### Standard Error Response Format
```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description"
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `INVALID_REQUEST` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Missing or invalid auth token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `ASSISTANT_UNAVAILABLE` | 502 | Ollama/AI service unavailable |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limiting

### Lead Assistant Endpoint
- **Limit**: 25 requests per IP per 15-minute window
- **Block Duration**: 30 minutes on violation
- **Response**: HTTP 429 with `retryAfterSeconds`

### Other Endpoints
- No explicit rate limiting (relies on credit deduction)
- AI endpoints deduct credits per request
- Zero-balance teams cannot make AI requests

---

## Credit Costs

| Request Type | Base Cost (credits) | Description |
|--------------|---------------------|-------------|
| `TEXT_SIMPLE` | 10 | Simple AI prompt |
| `TEXT_CHAT` | 20 | Conversational AI (with history) |
| `CODE_AGENT_EXECUTE` | 50 | Code generation/execution |
| `FILE_OPERATION` | 5 | File read/write via MCP |
| `MCP_TOOL` | 15 | MCP tool invocation |
| `AI_BROKER` | 5 | External provider routing fee |

**Note**: Costs subject to change. Query `/admin/credits/pricing` for current rates.

---

## CORS Configuration

**Allowed Origins**: `*` (all origins)  
**Allowed Methods**: `GET, POST, PUT, DELETE, OPTIONS`  
**Allowed Headers**: `Content-Type, Authorization, X-API-Key`

---

## WebSocket Support

Not currently implemented. All communication is HTTP/REST.

---

## Content Type

All requests with body data must use:
```http
Content-Type: application/json
```

---

## Example Integration (TypeScript)

```typescript
class SoftAwareAPI {
  private baseUrl = 'http://localhost:8787';
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || error.error || 'Request failed');
    }

    return response.json();
  }

  async login(email: string, password: string) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.token);
    return data.user;
  }

  async getSubscriptionPlans() {
    const data = await this.request('/subscriptions/plans');
    return data.plans;
  }

  async getCreditBalance() {
    const data = await this.request('/credits/balance');
    return data.balance;
  }

  async sendLeadMessage(sessionId: string, message: string, history = []) {
    return this.request('/public/leads/assistant', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        page: 'landing',
        message,
        history,
      }),
    });
  }
}

export const api = new SoftAwareAPI();
```

---

## Mobile App Integration Guide

### Overview
The Soft Aware API is fully accessible from external mobile applications (iOS, Android, React Native, Flutter, etc.). All communication is JSON over HTTPS with JWT-based authentication.

### Authentication Flow (Mobile)

```
┌─────────────┐          ┌───────────────────┐
│  Mobile App  │          │  Soft Aware API    │
│              │          │  api.softaware.net.za │
└──────┬───────┘          └─────────┬─────────┘
       │                            │
       │ POST /auth/login           │
       │ { email, password,         │
       │   rememberMe: true }       │
       │ ──────────────────────────>│
       │                            │
       │ { accessToken (30d),       │
       │   user, team }             │
       │ <──────────────────────────│
       │                            │
       │ Store token securely       │
       │ (Keychain / EncryptedPrefs)│
       │                            │
       │ GET /profile               │
       │ Authorization: Bearer xxx  │
       │ ──────────────────────────>│
       │                            │
       │ { user, team, subscription,│
       │   credits }                │
       │ <──────────────────────────│
       │                            │
       │  ...use other endpoints... │
```

### Recommended Mobile App Screens → API Mapping

| Screen | Endpoint(s) | Role |
|--------|-------------|------|
| **Login** | `POST /auth/login` | All |
| **Register** | `POST /auth/register` | All |
| **Home / Dashboard** | `GET /profile` | All |
| **Edit Profile** | `PUT /profile` | All |
| **Change Password** | `POST /profile/change-password` | All |
| **My Team** | `GET /profile/team` | All |
| **Invite Member** | `POST /teams/:id/invite` | Admin |
| **Subscription** | `GET /subscriptions/current` | All |
| **Start Trial** | `POST /subscriptions/start-trial` | Admin |
| **Change Plan** | `POST /subscriptions/change-plan` | Admin |
| **Cancel Plan** | `POST /subscriptions/cancel` | Admin |
| **Credit Balance** | `GET /credits/balance` (API key) | All |
| **Buy Credits** | `GET /credits/packages` → `POST /credits/purchase` | Admin |
| **Transaction History** | `GET /credits/transactions` (API key) | All |
| **Invoices / Billing** | `GET /profile/invoices` | All |
| **API Keys** | `GET /profile/api-keys`, `POST /api-keys`, `DELETE /api-keys/:id` | All |
| **AI Chat** | `POST /ai/chat` (API key) | All |
| **Admin – All Clients** | `GET /admin/clients` | Admin only |
| **Admin – All Subscriptions** | `GET /admin/subscriptions` | Admin only |
| **Admin – Adjust Credits** | `POST /admin/credits/balances/:teamId/adjust` | Admin only |
| **Admin – Dashboard Stats** | `GET /admin/stats` | Admin only |

### User Roles

| Role | Level | Description |
|------|-------|-------------|
| **ADMIN** | Staff / Owner | Full access. Can manage team, billing, subscriptions, and admin panel. |
| **ARCHITECT** | Staff | Can configure AI models, manage agents and integrations. |
| **OPERATOR** | Client | Standard access. Can use AI services, view dashboard, manage own profile. |
| **AUDITOR** | Client | Read-only. Can view transactions, invoices, and team info. |

The `role` field returned in `/auth/login` and `/profile` tells the mobile app which UI sections to show.

### Security Recommendations for Mobile

1. **Store tokens securely** — iOS Keychain / Android EncryptedSharedPreferences.
2. **Use `rememberMe: true`** at login for 30-day tokens; refresh before expiry with `POST /auth/refresh`.
3. **Pin TLS certificates** for production (`api.softaware.net.za`).
4. **Send all requests over HTTPS** in production.
5. **Handle 401 responses** by redirecting to the login screen.
6. **Handle 403 responses** by showing a "permission denied" message (role mismatch).

### CORS
The API allows all origins (`Access-Control-Allow-Origin: *`), so mobile apps using WebViews or HTTP clients will have no cross-origin issues.

### Example: React Native / Expo Integration

```typescript
import * as SecureStore from 'expo-secure-store';

const API_BASE = 'https://api.softaware.net.za';

class SoftAwareAPI {
  private token: string | null = null;

  async init() {
    this.token = await SecureStore.getItemAsync('accessToken');
  }

  private async request(path: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (res.status === 401) {
      // Token expired → redirect to login
      await SecureStore.deleteItemAsync('accessToken');
      this.token = null;
      throw new Error('SESSION_EXPIRED');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || 'Request failed');
    }

    return res.json();
  }

  async login(email: string, password: string) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, rememberMe: true }),
    });
    this.token = data.accessToken;
    await SecureStore.setItemAsync('accessToken', data.accessToken);
    return data;
  }

  async logout() {
    this.token = null;
    await SecureStore.deleteItemAsync('accessToken');
  }

  async refreshToken() {
    if (!this.token) throw new Error('No token');
    const data = await this.request('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ accessToken: this.token }),
    });
    this.token = data.accessToken;
    await SecureStore.setItemAsync('accessToken', data.accessToken);
    return data;
  }

  // ─── Profile ────────────────────────────────────
  getProfile()                            { return this.request('/profile'); }
  updateProfile(body: object)             { return this.request('/profile', { method: 'PUT', body: JSON.stringify(body) }); }
  changePassword(current: string, next: string) {
    return this.request('/profile/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
  }
  getTeam()                               { return this.request('/profile/team'); }
  getApiKeys()                            { return this.request('/profile/api-keys'); }
  getInvoices()                           { return this.request('/profile/invoices'); }

  // ─── Subscriptions ──────────────────────────────
  getPlans()                              { return this.request('/subscriptions/plans'); }
  getCurrentSubscription()                { return this.request('/subscriptions/current'); }
  startTrial(tier = 'PERSONAL')           { return this.request('/subscriptions/start-trial', { method: 'POST', body: JSON.stringify({ tier }) }); }
  changePlan(tier: string, cycle = 'monthly') {
    return this.request('/subscriptions/change-plan', { method: 'POST', body: JSON.stringify({ tier, billingCycle: cycle }) });
  }
  cancelSubscription()                    { return this.request('/subscriptions/cancel', { method: 'POST' }); }

  // ─── Credits ────────────────────────────────────
  getCreditPackages()                     { return this.request('/credits/packages'); }
  purchaseCredits(packageId: string, method: string) {
    return this.request('/credits/purchase', { method: 'POST', body: JSON.stringify({ packageId, paymentMethod: method }) });
  }
}

export const api = new SoftAwareAPI();
```

### Example: Flutter / Dart Integration

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SoftAwareAPI {
  static const _base = 'https://api.softaware.net.za';
  final _storage = const FlutterSecureStorage();
  String? _token;

  Future<void> init() async {
    _token = await _storage.read(key: 'accessToken');
  }

  Future<Map<String, dynamic>> _request(String path, {String method = 'GET', Map<String, dynamic>? body}) async {
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (_token != null) headers['Authorization'] = 'Bearer $_token';

    final uri = Uri.parse('$_base$path');
    late http.Response res;

    switch (method) {
      case 'POST': res = await http.post(uri, headers: headers, body: body != null ? jsonEncode(body) : null); break;
      case 'PUT':  res = await http.put(uri, headers: headers, body: body != null ? jsonEncode(body) : null); break;
      default:     res = await http.get(uri, headers: headers);
    }

    if (res.statusCode == 401) {
      await _storage.delete(key: 'accessToken');
      _token = null;
      throw Exception('SESSION_EXPIRED');
    }

    return jsonDecode(res.body);
  }

  Future<Map<String, dynamic>> login(String email, String password) async {
    final data = await _request('/auth/login', method: 'POST', body: {
      'email': email, 'password': password, 'rememberMe': true,
    });
    _token = data['accessToken'];
    await _storage.write(key: 'accessToken', value: _token);
    return data;
  }

  Future<Map<String, dynamic>> getProfile() => _request('/profile');
  Future<Map<String, dynamic>> updateProfile(Map<String, dynamic> body) => _request('/profile', method: 'PUT', body: body);
  Future<Map<String, dynamic>> getTeam() => _request('/profile/team');
  Future<Map<String, dynamic>> getPlans() => _request('/subscriptions/plans');
}
```

---

## Changelog

**February 2026**
- Added `/profile` self-service endpoints for mobile app (GET, PUT, change-password, team, api-keys, invoices)
- Added `rememberMe` flag to `/auth/login` for 30-day mobile tokens
- Added `phone`, `name`, `avatarUrl` fields to User model
- Enhanced login response with team info and token expiry
- Added Mobile App Integration Guide with React Native & Flutter examples
- Added `/public/leads/assistant` endpoint
- Added `LEADS_OLLAMA_MODEL` configuration
- Implemented IP-based rate limiting for lead assistant

**January 2026**
- Initial API documentation
- Credits system implementation
- Multi-provider AI routing

