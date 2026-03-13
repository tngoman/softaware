# Admin Module — API Routes

**Version:** 1.2.0  
**Last Updated:** 2026-03-05

---

## 1. Overview

| Metric | Value |
|--------|-------|
| **Total endpoints** | 116 |
| **Base URL** | `https://api.softaware.net.za` |
| **Authentication** | Bearer JWT token (admin role required) |
| **Authorization** | requireAuth + requireAdmin middleware on all routes |
| **Content-Type** | application/json |

---

## 2. Endpoint Directory

| # | Method | Path | Purpose |
|---|--------|------|---------|
| **CORE ADMIN** (admin.ts) |||
| 1 | GET | /api/admin/stats | Device & team statistics |
| 2 | GET | /api/admin/clients | List device activations |
| 3 | GET | /api/admin/clients/:deviceId/agents | Agents for a device |
| 4 | GET | /api/admin/activation-keys | List activation keys |
| 5 | POST | /api/admin/activation-keys | Create activation key |
| 6 | DELETE | /api/admin/activation-keys/:id | Revoke activation key |
| 7 | GET | /api/admin/teams | List all teams |
| 8 | GET | /api/admin/leads | List captured leads |
| 9 | POST | /api/admin/leads/:id/convert | Convert a lead |
| **DASHBOARD** (adminDashboard.ts) |||
| 10 | GET | /api/admin/dashboard | Comprehensive system dashboard |
| **CLIENT MANAGER** (adminClientManager.ts) |||
| 11 | GET | /api/admin/clients/overview | List all clients with assets |
| 12 | GET | /api/admin/clients/:userId | Get single client detail |
| 13 | PATCH | /api/admin/clients/:userId/status | Update account status (master kill switch) |
| 14 | POST | /api/admin/clients/:userId/suspend-all | Suspend account + all assets |
| 15 | POST | /api/admin/clients/:userId/reactivate-all | Reactivate account + all assets |
| 16 | POST | /api/admin/clients/:userId/masquerade | Login as user |
| 17 | PATCH | /api/admin/clients/assistants/:id/status | Update assistant status |
| 18 | PATCH | /api/admin/clients/widgets/:id/status | Update widget status |
| **ENTERPRISE ENDPOINTS** (adminEnterpriseEndpoints.ts) |||
| 19 | GET | /api/admin/enterprise-endpoints | List all endpoints |
| 20 | GET | /api/admin/enterprise-endpoints/:id | Get endpoint detail |
| 21 | POST | /api/admin/enterprise-endpoints | Create endpoint |
| 22 | PUT | /api/admin/enterprise-endpoints/:id | Update endpoint |
| 23 | PATCH | /api/admin/enterprise-endpoints/:id/status | Toggle endpoint status |
| 24 | DELETE | /api/admin/enterprise-endpoints/:id | Delete endpoint |
| 25 | GET | /api/admin/enterprise-endpoints/:id/logs | Get request logs |
| **CREDITS** (adminCredits.ts) |||
| 26 | GET | /api/admin/credits/packages | List credit packages |
| 27 | POST | /api/admin/credits/packages | Create credit package |
| 28 | PUT | /api/admin/credits/packages/:id | Update credit package |
| 29 | DELETE | /api/admin/credits/packages/:id | Deactivate package |
| 30 | POST | /api/admin/credits/packages/seed | Seed default packages |
| 31 | GET | /api/admin/credits/pricing | View pricing configuration |
| 32 | GET | /api/admin/credits/balances | List all team balances |
| 33 | GET | /api/admin/credits/balances/:teamId | Get team balance |
| 34 | POST | /api/admin/credits/balances/:teamId/adjust | Adjust team credits |
| 35 | GET | /api/admin/credits/transactions | List all transactions |
| 36 | GET | /api/admin/credits/balances/:teamId/transactions | List team transactions |
| **CONFIG** (adminConfig.ts) |||
| 37 | GET | /api/admin/config/payment-gateways | Payment gateway status |
| 38 | POST | /api/admin/config/payment-gateways/test | Test gateway connection |
| 39 | GET | /api/admin/config/ai-providers | AI provider configuration |
| 40 | POST | /api/admin/config/ai-providers/test | Test AI provider connection |
| 41 | GET | /api/admin/config/system | General system configuration |
| **CASES** (adminCases.ts) |||
| 42 | GET | /api/admin/cases | List all cases with filters |
| 43 | GET | /api/admin/cases/analytics | Case analytics dashboard |
| 44 | POST | /api/admin/cases/bulk-assign | Bulk assign cases |
| 45 | POST | /api/admin/cases/bulk-update-status | Bulk status update |
| 46 | GET | /api/admin/cases/health | System health status |
| 47 | POST | /api/admin/cases/health/run-checks | Trigger health checks |
| 48 | GET | /api/admin/cases/team-performance | Team performance metrics |
| 49 | POST | /api/admin/cases/bulk-delete | Bulk delete cases |
| 50 | DELETE | /api/admin/cases/:id | Delete single case |
| **SYSTEM SETTINGS** (settings.ts) |||
| 51 | GET | /api/settings/public | Public settings key-value map (no auth) |
| 52 | GET | /api/settings/key/:key | Get setting by key name |
| 53 | GET | /api/settings | List all settings |
| 54 | GET | /api/settings/:id | Get setting by ID |
| 55 | POST | /api/settings | Create setting (admin) |
| 56 | PUT | /api/settings/:id | Update setting (admin) |
| 57 | DELETE | /api/settings/:id | Delete setting (admin) |
| **SYSTEM USERS** (systemUsers.ts) |||
| 58 | GET | /api/users | List all users with roles |
| 59 | GET | /api/users/:id | Get user detail with roles |
| 60 | POST | /api/users | Create user |
| 61 | PUT | /api/users/:id | Update user |
| 62 | DELETE | /api/users/:id | Delete user (cascade 14 tables) |
| **SYSTEM ROLES** (systemRoles.ts) |||
| 63 | GET | /api/roles | List roles with permission count |
| 64 | GET | /api/roles/:id | Get role with permissions |
| 65 | POST | /api/roles | Create role |
| 66 | PUT | /api/roles/:id | Update role |
| 67 | DELETE | /api/roles/:id | Delete role (cascade) |
| 68 | POST | /api/roles/:id/assign | Assign role to user |
| 69 | POST | /api/roles/:id/remove | Remove role from user |
| **SYSTEM PERMISSIONS** (systemPermissions.ts) |||
| 70 | GET | /api/permissions | List all permissions |
| 71 | GET | /api/permissions/user | Current user's permissions (admin gets wildcard) |
| 72 | GET | /api/permissions/:id | Get permission by ID |
| 73 | POST | /api/permissions | Create permission |
| 74 | PUT | /api/permissions/:id | Update permission |
| 75 | DELETE | /api/permissions/:id | Delete permission (cascade) |
| 76 | POST | /api/permissions/:id/assign | Assign permission to role |
| 77 | POST | /api/permissions/:id/remove | Remove permission from role |
| **SYSTEM CREDENTIALS** (systemCredentials.ts) |||
| 78 | GET | /api/credentials | List credentials (values masked) |
| 79 | GET | /api/credentials/search | Search credentials by term |
| 80 | GET | /api/credentials/service/:name | Get credentials by service name |
| 81 | GET | /api/credentials/expired | List expired credentials |
| 82 | GET | /api/credentials/expiring | List credentials expiring in 30 days |
| 83 | GET | /api/credentials/:id | Get credential by ID |
| 84 | POST | /api/credentials | Create credential (AES-256-GCM encrypted) |
| 85 | PUT | /api/credentials/:id | Update credential (re-encrypts, clears cache) |
| 86 | DELETE | /api/credentials/:id | Delete credential |
| 87 | POST | /api/credentials/:id/deactivate | Soft-deactivate credential |
| 88 | POST | /api/credentials/:id/rotate | Rotate credential value |
| 89 | POST | /api/credentials/:id/test | Test credential validity |
| **EMAIL / SMTP** (email.ts) |||
| 90 | POST | /api/email/test | Send test email (admin) |
| 91 | POST | /api/email/send | Send email (auth) |
| 92 | GET | /api/email/config | Get SMTP config — password masked (admin) |
| 93 | PUT | /api/email/config | Update SMTP config (admin) |
| 94 | GET | /api/email/logs | Paginated email send log (admin) |
| **SMS** (sms.ts) |||
| 95 | POST | /api/sms/send | Send single SMS (admin) |
| 96 | POST | /api/sms/send-bulk | Bulk SMS up to 500 recipients (admin) |
| 97 | GET | /api/sms/balance | Query SMSPortal credit balance (admin) |
| 98 | GET | /api/sms/normalise/:phone | Normalise SA phone to E.164 |
| **TWO-FACTOR AUTH** (twoFactor.ts) |||
| 99 | GET | /api/auth/2fa/status | Check 2FA enabled status + method |
| 100 | POST | /api/auth/2fa/setup | Start 2FA setup (TOTP→QR / email-SMS→OTP) |
| 101 | POST | /api/auth/2fa/setup/verify | Confirm setup code → enable 2FA → return backup codes |
| 102 | POST | /api/auth/2fa/verify | Verify 2FA code during login (temp_token) |
| 103 | POST | /api/auth/2fa/resend | Resend OTP during login (email/SMS; temp_token) |
| 104 | POST | /api/auth/2fa/disable | Disable 2FA — password required (blocked for staff/admin) |
| 105 | PUT | /api/auth/2fa/method | Change 2FA method — password + re-verify required |
| 106 | POST | /api/auth/2fa/backup-codes | Regenerate backup codes — password required |
| **MY ASSISTANT** (myAssistant.ts) |||
| 107 | GET | /api/v1/mobile/my-assistant | List user's assistants |
| 108 | GET | /api/v1/mobile/my-assistant/:id | Get assistant (owner-verified) |
| 109 | POST | /api/v1/mobile/my-assistant | Create assistant |
| 110 | PUT | /api/v1/mobile/my-assistant/:id | Update assistant |
| 111 | PUT | /api/v1/mobile/my-assistant/:id/set-primary | Set as primary assistant |
| 112 | DELETE | /api/v1/mobile/my-assistant/:id | Delete assistant (auto-promotes next) |
| 113 | POST | /api/v1/mobile/my-assistant/core-instructions | Set core_instructions (super-admin only) |
| 114 | GET | /api/v1/mobile/my-assistant/software-tokens | List software tokens (staff only) |
| 115 | POST | /api/v1/mobile/my-assistant/software-tokens | Store software token (staff only) |
| 116 | DELETE | /api/v1/mobile/my-assistant/software-tokens/:id | Delete software token (staff only) |

---

## 3. Core Admin Routes

### 3.0 Source File: `admin.ts` (215 LOC)

Mounted at `/admin` — provides stats, device client management, activation keys, teams, and lead capture.

### 3.1 GET /api/admin/stats

**Purpose:** Quick summary stats for device activations, agents, and teams.

**Authentication:** Required (Admin role)

**Request:**
```bash
curl https://api.softaware.net.za/api/admin/stats \
  -H "Authorization: Bearer <admin-token>"
```

**Success Response (200):**
```json
{
  "totalClients": 42,
  "activeClients": 38,
  "totalAgents": 156,
  "totalTeams": 12
}
```

---

### 3.2 GET /api/admin/clients

**Purpose:** List all device activations with agent counts.

**Authentication:** Required (Admin role)

**Success Response (200):**
```json
{
  "clients": [
    {
      "deviceId": "device-uuid-123",
      "appVersion": "1.2.0",
      "isActive": true,
      "tier": "TEAM",
      "lastSeenAt": "2026-03-04T12:00:00.000Z",
      "createdAt": "2026-01-10T10:00:00.000Z",
      "agentCount": 5
    }
  ]
}
```

---

### 3.3 GET /api/admin/clients/:deviceId/agents

**Purpose:** Get all agents registered to a specific device.

**URL Parameters:**
- `deviceId` (string, required) — Device activation ID

**Success Response (200):**
```json
{
  "deviceId": "device-uuid-123",
  "agents": [
    {
      "deviceId": "device-uuid-123",
      "agentId": "agent-001",
      "name": "Code Assistant",
      "version": "2.1.0",
      "region": "za-east",
      "compliance": "standard",
      "blueprint": "default",
      "createdAt": "2026-02-01T12:00:00.000Z",
      "updatedAt": "2026-03-04T10:00:00.000Z"
    }
  ]
}
```

---

### 3.4 GET /api/admin/activation-keys

**Purpose:** List all activation keys with tier and permission info.

**Success Response (200):**
```json
{
  "keys": [
    {
      "id": "key-uuid-123",
      "code": "SA-A1B2C3D4E5F6A1B2C3D4E5F6",
      "tier": "TEAM",
      "isActive": true,
      "cloudSyncAllowed": true,
      "vaultAllowed": false,
      "maxAgents": 10,
      "maxUsers": 5,
      "createdAt": "2026-02-15T10:00:00.000Z"
    }
  ]
}
```

---

### 3.5 POST /api/admin/activation-keys

**Purpose:** Generate a new activation key.

**Request Body:**
```json
{
  "tier": "ENTERPRISE",
  "cloudSyncAllowed": true,
  "vaultAllowed": true,
  "maxAgents": 50,
  "maxUsers": 20
}
```

**Field Definitions:**

| Field | Type | Required | Valid Values | Description |
|-------|------|----------|--------------|-------------|
| tier | enum | Yes | PERSONAL, TEAM, ENTERPRISE | License tier |
| cloudSyncAllowed | boolean | No | - | Enable cloud sync (default: false) |
| vaultAllowed | boolean | No | - | Enable vault access (default: false) |
| maxAgents | number | No | Positive integer | Agent limit |
| maxUsers | number | No | Positive integer | User limit |

**Success Response (201):** Returns the created key object.

---

### 3.6 DELETE /api/admin/activation-keys/:id

**Purpose:** Revoke an activation key (soft delete — sets `isActive = false`).

**URL Parameters:**
- `id` (string, required) — Key UUID

**Success Response:** 204 No Content

---

### 3.7 GET /api/admin/teams

**Purpose:** List all teams with member and agent counts.

**Success Response (200):**
```json
{
  "teams": [
    {
      "id": "team-uuid-456",
      "name": "Acme Corp",
      "memberCount": 8,
      "agentCount": 12,
      "createdAt": "2026-01-10T10:00:00.000Z"
    }
  ]
}
```

---

### 3.8 GET /api/admin/leads

**Purpose:** List up to 500 captured leads ordered by most recent update.

**Success Response (200):**
```json
{
  "leads": [
    {
      "id": "lead-uuid-789",
      "sessionId": "sess-abc",
      "sourcePage": "/pricing",
      "companyName": "Beta Corp",
      "contactName": "Jane Smith",
      "email": "jane@beta.com",
      "phone": "+27123456789",
      "useCase": "Customer support automation",
      "requirements": "Need WhatsApp integration",
      "budgetRange": "R5000-R10000/mo",
      "timeline": "Q2 2026",
      "status": "NEW",
      "score": 85,
      "messageCount": 4,
      "lastMessage": "Can we schedule a demo?",
      "createdAt": "2026-03-04T11:00:00.000Z",
      "updatedAt": "2026-03-04T11:30:00.000Z"
    }
  ]
}
```

---

### 3.9 POST /api/admin/leads/:id/convert

**Purpose:** Mark a lead as converted with optional conversion note.

**URL Parameters:**
- `id` (string, required) — Lead UUID

**Request Body:**
```json
{
  "note": "Signed annual contract — onboarding scheduled"
}
```

**Success Response (200):**
```json
{
  "lead": {
    "id": "lead-uuid-789",
    "status": "CONVERTED",
    "requirements": "Need WhatsApp integration\n[CONVERSION_NOTE] Signed annual contract — onboarding scheduled"
  }
}
```

---

## 4. Dashboard & Statistics

### 4.1 GET /api/admin/dashboard

**Purpose:** Comprehensive system dashboard with real stats from all key tables. This is the main admin dashboard, not limited to AI metrics.

**Authentication:** Required (Admin role)

**Request:**
```bash
curl https://api.softaware.net.za/api/admin/dashboard \
  -H "Authorization: Bearer <admin-token>"
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "workspaces": {
      "total": 12,
      "active": 12,
      "inactive": 0,
      "newThisMonth": 3
    },
    "users": {
      "total": 156
    },
    "subscriptions": {
      "total": 85,
      "active": 67,
      "trial": 10,
      "expired": 6,
      "pastDue": 2
    },
    "software": {
      "total": 4,
      "withIntegration": 2,
      "modules": 18,
      "releases": 35
    },
    "clients": {
      "total": 42,
      "online": 15,
      "offline": 25,
      "blocked": 2
    },
    "ai": {
      "assistants": 45,
      "apiKeys": 8,
      "configurations": 3,
      "creditsUsed": 8500,
      "creditsBalance": 15000,
      "totalRequests": 12450,
      "usageByType": [
        { "type": "TEXT_CHAT", "count": 8200, "credits": 6500 },
        { "type": "CODE_AGENT_EXECUTE", "count": 450, "credits": 1800 },
        { "type": "FILE_OPERATION", "count": 3800, "credits": 200 }
      ]
    },
    "websites": {
      "total": 28,
      "deployed": 20,
      "draft": 8,
      "widgets": 89,
      "activeWidgets": 78
    },
    "leads": {
      "total": 34,
      "new": 12,
      "thisMonth": 8
    },
    "activationKeys": {
      "total": 25,
      "active": 20,
      "revoked": 5
    },
    "system": {
      "status": "healthy",
      "uptime": "5d 12h 30m",
      "version": "0.2.0"
    },
    "recentActivity": [
      {
        "id": "ws_team-uuid-456",
        "type": "workspace_created",
        "description": "Workspace \"Acme Corp\" created",
        "actor": "system",
        "time": "2d ago"
      },
      {
        "id": "usr_user-uuid-123",
        "type": "user_registered",
        "description": "User \"John Doe\" registered",
        "actor": "john@acme.com",
        "time": "3d ago"
      },
      {
        "id": "client_42",
        "type": "client_heartbeat",
        "description": "Client \"DESKTOP-ABC\" checked in",
        "actor": "192.168.1.100",
        "time": "5m ago"
      }
    ]
  }
}
```

**Response Sections:**

| Section | Source Table | Description |
|---------|------------|-------------|
| workspaces | teams | Workspace (team) counts and new-this-month |
| users | users | Total user count |
| subscriptions | subscriptions | Breakdown by status (ACTIVE, TRIAL, EXPIRED, PAST_DUE) |
| software | update_software, update_modules, update_releases | Product counts, integrations, modules, releases |
| clients | update_clients | Connected desktop client counts (online/offline/blocked) |
| ai | assistants, api_keys, ai_model_config, credit_transactions, credit_balances | AI system overview with usage breakdown by request type |
| websites | generated_sites, widget_clients | Site builder and widget deployment stats |
| leads | lead_captures | Lead capture pipeline stats |
| activationKeys | activation_keys | License key distribution |
| system | process | Node.js uptime, version, health status |
| recentActivity | teams, users, update_clients, lead_captures | Last 10 activities across all tables |

---

## 5. Client Manager Routes

### 5.1 GET /api/admin/clients/overview

**Purpose:** Get complete overview of all client accounts with their assistants and widgets.

**Authentication:** Required (Admin role)

**Request:**
```bash
curl https://api.softaware.net.za/api/admin/clients/overview \
  -H "Authorization: Bearer <admin-token>"
```

**Success Response (200):**
```json
{
  "success": true,
  "stats": {
    "totalClients": 156,
    "activeClients": 142,
    "suspendedClients": 12,
    "demoExpiredClients": 2,
    "totalAssistants": 45,
    "activeAssistants": 38,
    "totalWidgets": 89,
    "activeWidgets": 78
  },
  "clients": [
    {
      "id": "user-uuid-123",
      "email": "john@acme.com",
      "name": "John Doe",
      "account_status": "active",
      "createdAt": "2026-01-15T10:00:00.000Z",
      "assistant_count": 2,
      "widget_count": 3
    }
  ],
  "assistants": [
    {
      "id": "assistant-1709000000000",
      "name": "Acme Support Bot",
      "description": "Customer support assistant",
      "status": "active",
      "tier": "paid",
      "userId": "user-uuid-123",
      "pages_indexed": 45,
      "created_at": "2026-02-01T12:00:00.000Z",
      "updated_at": "2026-03-04T10:00:00.000Z",
      "owner_email": "john@acme.com",
      "owner_name": "John Doe",
      "owner_account_status": "active"
    }
  ],
  "widgets": [
    {
      "id": 101,
      "user_id": "user-uuid-123",
      "website_url": "https://acme.com",
      "status": "active",
      "subscription_tier": "pro",
      "message_count": 1250,
      "max_messages": 5000,
      "pages_ingested": 30,
      "max_pages": 100,
      "monthly_price": 49.99,
      "created_at": "2026-01-20T14:00:00.000Z",
      "last_active": "2026-03-04T09:30:00.000Z",
      "owner_email": "john@acme.com",
      "owner_name": "John Doe",
      "owner_account_status": "active"
    }
  ]
}
```

---

### 5.2 GET /api/admin/clients/:userId

**Purpose:** Get detailed information for a single client.

**Authentication:** Required (Admin role)

**URL Parameters:**
- `userId` (string, required) — User UUID

**Request:**
```bash
curl https://api.softaware.net.za/api/admin/clients/user-uuid-123 \
  -H "Authorization: Bearer <admin-token>"
```

**Success Response (200):**
```json
{
  "success": true,
  "client": {
    "id": "user-uuid-123",
    "email": "john@acme.com",
    "name": "John Doe",
    "account_status": "active",
    "createdAt": "2026-01-15T10:00:00.000Z",
    "updatedAt": "2026-03-04T09:00:00.000Z"
  },
  "assistants": [
    {
      "id": "assistant-1709000000000",
      "name": "Acme Support Bot",
      "description": "Customer support assistant",
      "status": "active",
      "tier": "paid",
      "pages_indexed": 45,
      "created_at": "2026-02-01T12:00:00.000Z",
      "updated_at": "2026-03-04T10:00:00.000Z"
    }
  ],
  "widgets": [
    {
      "id": 101,
      "website_url": "https://acme.com",
      "status": "active",
      "subscription_tier": "pro",
      "message_count": 1250,
      "max_messages": 5000,
      "pages_ingested": 30,
      "max_pages": 100,
      "monthly_price": 49.99,
      "created_at": "2026-01-20T14:00:00.000Z",
      "last_active": "2026-03-04T09:30:00.000Z"
    }
  ]
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "User not found"
}
```

---

### 5.3 PATCH /api/admin/clients/:userId/status

**Purpose:** Update account status (master kill switch for entire account).

**Authentication:** Required (Admin role)

**URL Parameters:**
- `userId` (string, required) — User UUID

**Request Body:**
```json
{
  "status": "suspended"
}
```

**Valid Status Values:**
- `active` — Account fully operational
- `suspended` — Account blocked (all services disabled)
- `demo_expired` — Demo period ended (prompt upgrade)

**Request:**
```bash
curl -X PATCH https://api.softaware.net.za/api/admin/clients/user-uuid-123/status \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "suspended"}'
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Account status updated to suspended",
  "userId": "user-uuid-123",
  "status": "suspended"
}
```

**Error Responses:**

*Validation Error (400):*
```json
{
  "success": false,
  "error": "Invalid status value",
  "details": [
    {
      "code": "invalid_enum_value",
      "expected": ["active", "suspended", "demo_expired"],
      "received": "invalid_status",
      "path": ["status"]
    }
  ]
}
```

*Not Found (404):*
```json
{
  "success": false,
  "error": "User not found"
}
```

---

### 5.4 POST /api/admin/clients/:userId/suspend-all

**Purpose:** Nuclear option — suspend account + all assistants + all widgets in one call.

**Authentication:** Required (Admin role)

**URL Parameters:**
- `userId` (string, required) — User UUID

**Request:**
```bash
curl -X POST https://api.softaware.net.za/api/admin/clients/user-uuid-123/suspend-all \
  -H "Authorization: Bearer <admin-token>"
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Account and all assets suspended",
  "userId": "user-uuid-123",
  "assistantsSuspended": 3,
  "widgetsSuspended": 2
}
```

---

### 5.5 POST /api/admin/clients/:userId/reactivate-all

**Purpose:** Reactivate account + all assistants + all widgets in one call.

**Authentication:** Required (Admin role)

**URL Parameters:**
- `userId` (string, required) — User UUID

**Request:**
```bash
curl -X POST https://api.softaware.net.za/api/admin/clients/user-uuid-123/reactivate-all \
  -H "Authorization: Bearer <admin-token>"
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Account and all assets reactivated",
  "userId": "user-uuid-123",
  "assistantsReactivated": 3,
  "widgetsReactivated": 2
}
```

---

### 5.6 POST /api/admin/clients/:userId/masquerade

**Purpose:** Login as a user to view their experience and troubleshoot issues.

**Authentication:** Required (Admin role)

**URL Parameters:**
- `userId` (string, required) — User UUID to masquerade as

**Request:**
```bash
curl -X POST https://api.softaware.net.za/api/admin/clients/user-uuid-123/masquerade \
  -H "Authorization: Bearer <admin-token>"
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Masquerading as john@acme.com",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user-uuid-123",
      "email": "john@acme.com",
      "name": "John Doe",
      "role": {
        "id": "role-uuid",
        "slug": "client",
        "name": "Client"
      },
      "permissions": ["view_dashboard", "manage_assistants"]
    },
    "adminRestoreToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "masquerading": true,
    "adminId": "admin-uuid-456",
    "targetUser": {
      "id": "user-uuid-123",
      "email": "john@acme.com",
      "name": "John Doe"
    }
  }
}
```

**Frontend Usage:**
1. Store `adminRestoreToken` in `localStorage` with key `adminRestoreToken`
2. Store `adminId` with key `masqueradeAdminId`
3. Replace current auth token with `token` from response
4. Update app state with `user` object
5. Show masquerade banner with "Return to Admin" button
6. To restore: retrieve `adminRestoreToken`, fetch admin user, switch back

---

### 5.7 PATCH /api/admin/clients/assistants/:assistantId/status

**Purpose:** Update individual assistant status (assistant-level kill switch).

**Authentication:** Required (Admin role)

**URL Parameters:**
- `assistantId` (string, required) — Assistant ID (format: assistant-{timestamp})

**Request Body:**
```json
{
  "status": "suspended"
}
```

**Valid Status Values:** `active` | `suspended` | `demo_expired`

**Request:**
```bash
curl -X PATCH https://api.softaware.net.za/api/admin/clients/assistants/assistant-1709000000000/status \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "suspended"}'
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Assistant status updated to suspended",
  "assistantId": "assistant-1709000000000",
  "status": "suspended"
}
```

---

### 5.8 PATCH /api/admin/clients/widgets/:widgetId/status

**Purpose:** Update individual widget status (widget-level kill switch).

**Authentication:** Required (Admin role)

**URL Parameters:**
- `widgetId` (number, required) — Widget client ID

**Request Body:**
```json
{
  "status": "suspended"
}
```

**Valid Status Values:** `active` | `suspended` | `demo_expired` | `upgraded`

**Request:**
```bash
curl -X PATCH https://api.softaware.net.za/api/admin/clients/widgets/101/status \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "suspended"}'
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Widget status updated to suspended",
  "widgetId": 101,
  "status": "suspended"
}
```

---

## 6. Enterprise Endpoints Routes

### 6.1 GET /api/admin/enterprise-endpoints

**Purpose:** List all enterprise webhook endpoints with configuration and stats.

**Authentication:** Required (Admin role)

**Request:**
```bash
curl https://api.softaware.net.za/api/admin/enterprise-endpoints \
  -H "Authorization: Bearer <admin-token>"
```

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "ep-1709000000000",
      "client_id": "acme-corp",
      "client_name": "Acme Corporation",
      "status": "active",
      "inbound_provider": "whatsapp",
      "llm_provider": "ollama",
      "llm_model": "qwen2.5-coder:32b",
      "llm_system_prompt": "You are a helpful assistant for Acme Corp...",
      "llm_temperature": 0.3,
      "llm_max_tokens": 1024,
      "target_api_url": "https://acme.com/api/webhook",
      "target_api_auth_type": "bearer",
      "created_at": "2026-02-15T10:00:00.000Z",
      "updated_at": "2026-03-04T12:00:00.000Z",
      "last_request_at": "2026-03-04T11:45:00.000Z",
      "total_requests": 1250
    }
  ]
}
```

---

### 6.2 GET /api/admin/enterprise-endpoints/:id

**Purpose:** Get full configuration for a single endpoint.

**Authentication:** Required (Admin role)

**URL Parameters:**
- `id` (string, required) — Endpoint ID (format: ep-{timestamp})

**Request:**
```bash
curl https://api.softaware.net.za/api/admin/enterprise-endpoints/ep-1709000000000 \
  -H "Authorization: Bearer <admin-token>"
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "ep-1709000000000",
    "client_id": "acme-corp",
    "client_name": "Acme Corporation",
    "status": "active",
    "inbound_provider": "whatsapp",
    "llm_provider": "ollama",
    "llm_model": "qwen2.5-coder:32b",
    "llm_system_prompt": "You are a helpful assistant...",
    "llm_tools_config": "[{\"name\":\"search\",\"description\":\"Search knowledge base\"}]",
    "llm_temperature": 0.3,
    "llm_max_tokens": 1024,
    "target_api_url": "https://acme.com/api/webhook",
    "target_api_auth_type": "bearer",
    "target_api_auth_value": "secret_token_redacted",
    "target_api_headers": "{\"X-Custom-Header\":\"value\"}",
    "created_at": "2026-02-15T10:00:00.000Z",
    "updated_at": "2026-03-04T12:00:00.000Z",
    "last_request_at": "2026-03-04T11:45:00.000Z",
    "total_requests": 1250
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "Endpoint not found"
}
```

---

### 6.3 POST /api/admin/enterprise-endpoints

**Purpose:** Create a new enterprise webhook endpoint.

**Authentication:** Required (Admin role)

**Request Body:**
```json
{
  "client_id": "acme-corp",
  "client_name": "Acme Corporation",
  "inbound_provider": "whatsapp",
  "llm_provider": "ollama",
  "llm_model": "qwen2.5-coder:32b",
  "llm_system_prompt": "You are a helpful assistant for Acme Corp customers. Be professional and concise.",
  "llm_tools_config": "[{\"name\":\"search\",\"description\":\"Search knowledge base\"}]",
  "llm_temperature": 0.3,
  "llm_max_tokens": 1024,
  "target_api_url": "https://acme.com/api/webhook",
  "target_api_auth_type": "bearer",
  "target_api_auth_value": "secret_token_here",
  "target_api_headers": "{\"X-Custom-Header\":\"value\"}"
}
```

**Field Definitions:**

| Field | Type | Required | Valid Values | Description |
|-------|------|----------|--------------|-------------|
| client_id | string | Yes | 1-100 chars | Unique client identifier |
| client_name | string | Yes | 1-255 chars | Display name |
| inbound_provider | enum | Yes | whatsapp, slack, custom_rest, sms, email, web | Inbound message source |
| llm_provider | enum | Yes | ollama, openrouter, openai | LLM service provider |
| llm_model | string | Yes | 1+ chars | Model identifier (e.g., "qwen2.5-coder:32b") |
| llm_system_prompt | string | Yes | 1+ chars | System prompt defining AI behavior |
| llm_tools_config | string | No | Valid JSON array | Tool definitions for LLM function calling |
| llm_temperature | number | No | 0-2 | Response randomness (default: 0.3) |
| llm_max_tokens | number | No | 1-16384 | Max response length (default: 1024) |
| target_api_url | string | No | Valid URL or empty | Downstream API to call with structured data |
| target_api_auth_type | enum | No | bearer, basic, custom, none | Auth method for target API |
| target_api_auth_value | string | No | - | Token or credentials for target API |
| target_api_headers | string | No | Valid JSON object | Custom headers for target API |

**Request:**
```bash
curl -X POST https://api.softaware.net.za/api/admin/enterprise-endpoints \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "acme-corp",
    "client_name": "Acme Corporation",
    "inbound_provider": "whatsapp",
    "llm_provider": "ollama",
    "llm_model": "qwen2.5-coder:32b",
    "llm_system_prompt": "You are a helpful assistant."
  }'
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "ep-1709400000000",
    "client_id": "acme-corp",
    "client_name": "Acme Corporation",
    "status": "active",
    "inbound_provider": "whatsapp",
    "llm_provider": "ollama",
    "llm_model": "qwen2.5-coder:32b",
    "llm_system_prompt": "You are a helpful assistant.",
    "llm_temperature": 0.3,
    "llm_max_tokens": 1024,
    "created_at": "2026-03-04T15:00:00.000Z",
    "updated_at": "2026-03-04T15:00:00.000Z",
    "total_requests": 0
  }
}
```

**Webhook URL:** The created endpoint is accessible at:
```
https://api.softaware.net.za/api/v1/webhook/ep-1709400000000
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "code": "invalid_enum_value",
      "expected": ["ollama", "openrouter", "openai"],
      "received": "invalid_provider",
      "path": ["llm_provider"],
      "message": "Invalid enum value. Expected 'ollama' | 'openrouter' | 'openai', received 'invalid_provider'"
    }
  ]
}
```

---

### 6.4 PUT /api/admin/enterprise-endpoints/:id

**Purpose:** Update an existing endpoint configuration.

**Authentication:** Required (Admin role)

**URL Parameters:**
- `id` (string, required) — Endpoint ID

**Request Body:** (All fields optional, partial update supported)
```json
{
  "client_name": "Acme Corp (Updated)",
  "llm_temperature": 0.5,
  "status": "paused"
}
```

**Request:**
```bash
curl -X PUT https://api.softaware.net.za/api/admin/enterprise-endpoints/ep-1709000000000 \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"llm_temperature": 0.5}'
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "ep-1709000000000",
    "client_id": "acme-corp",
    "client_name": "Acme Corp (Updated)",
    "status": "active",
    "llm_temperature": 0.5,
    "updated_at": "2026-03-04T15:30:00.000Z"
  }
}
```

---

### 6.5 PATCH /api/admin/enterprise-endpoints/:id/status

**Purpose:** Quick status toggle (kill switch for endpoint).

**Authentication:** Required (Admin role)

**URL Parameters:**
- `id` (string, required) — Endpoint ID

**Request Body:**
```json
{
  "status": "paused"
}
```

**Valid Status Values:**
- `active` — Endpoint processes requests normally
- `paused` — Endpoint returns 503 Service Unavailable
- `disabled` — Endpoint returns 503 (same as paused, semantic difference for UI)

**Request:**
```bash
curl -X PATCH https://api.softaware.net.za/api/admin/enterprise-endpoints/ep-1709000000000/status \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "paused"}'
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Endpoint ep-1709000000000 set to paused"
}
```

---

### 6.6 DELETE /api/admin/enterprise-endpoints/:id

**Purpose:** Permanently delete an endpoint.

**Authentication:** Required (Admin role)

**URL Parameters:**
- `id` (string, required) — Endpoint ID

**Request:**
```bash
curl -X DELETE https://api.softaware.net.za/api/admin/enterprise-endpoints/ep-1709000000000 \
  -H "Authorization: Bearer <admin-token>"
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Endpoint ep-1709000000000 deleted"
}
```

**Warning:** This action is irreversible. The webhook URL will immediately return 404.

---

### 6.7 GET /api/admin/enterprise-endpoints/:id/logs

**Purpose:** Retrieve request logs for an endpoint.

**Authentication:** Required (Admin role)

**URL Parameters:**
- `id` (string, required) — Endpoint ID

**Query Parameters:**
- `limit` (number, optional) — Max logs to return (default: 50, max: 500)
- `offset` (number, optional) — Skip first N logs (default: 0)

**Request:**
```bash
curl "https://api.softaware.net.za/api/admin/enterprise-endpoints/ep-1709000000000/logs?limit=20&offset=0" \
  -H "Authorization: Bearer <admin-token>"
```

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "log-uuid-123",
      "endpoint_id": "ep-1709000000000",
      "timestamp": "2026-03-04T11:45:23.456Z",
      "inbound_payload": "{\"message\":\"Hello, I need help\",\"sender\":\"user@example.com\"}",
      "ai_response": "{\"reply\":\"Hello! I'm here to help. What can I assist you with?\"}",
      "duration_ms": 850,
      "status": "success",
      "error_message": null
    },
    {
      "id": "log-uuid-124",
      "endpoint_id": "ep-1709000000000",
      "timestamp": "2026-03-04T11:40:12.789Z",
      "inbound_payload": "{\"message\":\"What are your business hours?\"}",
      "ai_response": null,
      "duration_ms": 1200,
      "status": "error",
      "error_message": "Ollama service timeout after 30s"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0
  }
}
```

---

## 7. Credits Routes

### 7.1 GET /api/admin/credits/packages

**Purpose:** List all credit packages (active and inactive).

**Authentication:** Required (Admin role)

**Request:**
```bash
curl https://api.softaware.net.za/api/admin/credits/packages \
  -H "Authorization: Bearer <admin-token>"
```

**Success Response (200):**
```json
{
  "success": true,
  "packages": [
    {
      "id": "pkg-uuid-123",
      "name": "Starter Pack",
      "description": "Perfect for small teams",
      "credits": 1000,
      "bonusCredits": 100,
      "totalCredits": 1100,
      "price": 9900,
      "formattedPrice": "R99.00",
      "discountPercent": 10,
      "featured": false,
      "isActive": true,
      "createdAt": "2026-02-01T10:00:00.000Z",
      "updatedAt": "2026-03-04T12:00:00.000Z"
    },
    {
      "id": "pkg-uuid-124",
      "name": "Pro Pack",
      "description": "For growing businesses",
      "credits": 5000,
      "bonusCredits": 1000,
      "totalCredits": 6000,
      "price": 39900,
      "formattedPrice": "R399.00",
      "discountPercent": 33,
      "featured": true,
      "isActive": true,
      "createdAt": "2026-02-01T10:00:00.000Z",
      "updatedAt": "2026-03-04T12:00:00.000Z"
    }
  ]
}
```

---

### 7.2 POST /api/admin/credits/packages

**Purpose:** Create a new credit package.

**Authentication:** Required (Admin role)

**Request Body:**
```json
{
  "name": "Enterprise Pack",
  "description": "Unlimited power for large teams",
  "credits": 50000,
  "bonusCredits": 10000,
  "price": 299900,
  "featured": true
}
```

**Field Definitions:**

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| name | string | Yes | 1-50 chars | Package display name |
| description | string | No | max 200 chars | Marketing description |
| credits | number | Yes | Positive integer | Base credits included |
| price | number | Yes | Positive integer | Price in cents (e.g., 9900 = R99.00) |
| bonusCredits | number | No | Non-negative integer | Free bonus credits (default: 0) |
| featured | boolean | No | - | Show prominently in UI (default: false) |

**Request:**
```bash
curl -X POST https://api.softaware.net.za/api/admin/credits/packages \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Enterprise Pack",
    "credits": 50000,
    "price": 299900,
    "bonusCredits": 10000
  }'
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Credit package created successfully",
  "package": {
    "id": "pkg-uuid-125",
    "name": "Enterprise Pack",
    "description": null,
    "credits": 50000,
    "bonusCredits": 10000,
    "totalCredits": 60000,
    "price": 299900,
    "formattedPrice": "R2,999.00",
    "featured": false,
    "isActive": true
  }
}
```

---

### 7.3 PUT /api/admin/credits/packages/:id

**Purpose:** Update an existing credit package.

**Authentication:** Required (Admin role)

**URL Parameters:**
- `id` (string, required) — Package UUID

**Request Body:** (All fields optional, partial update supported)
```json
{
  "name": "Enterprise Pack (Updated)",
  "price": 279900,
  "featured": true
}
```

**Request:**
```bash
curl -X PUT https://api.softaware.net.za/api/admin/credits/packages/pkg-uuid-125 \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"price": 279900}'
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Credit package updated successfully",
  "package": {
    "id": "pkg-uuid-125",
    "name": "Enterprise Pack (Updated)",
    "credits": 50000,
    "price": 279900,
    "formattedPrice": "R2,799.00",
    "featured": true,
    "isActive": true
  }
}
```

---

### 7.4 DELETE /api/admin/credits/packages/:id

**Purpose:** Deactivate a credit package (soft delete).

**Authentication:** Required (Admin role)

**URL Parameters:**
- `id` (string, required) — Package UUID

**Request:**
```bash
curl -X DELETE https://api.softaware.net.za/api/admin/credits/packages/pkg-uuid-125 \
  -H "Authorization: Bearer <admin-token>"
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Credit package deactivated successfully"
}
```

**Note:** Package is set to `isActive=false`, not deleted from database. It will no longer appear in public package listings but existing purchases remain valid.

---

### 7.5 GET /api/admin/credits/balances

**Purpose:** List all team credit balances.

**Authentication:** Required (Admin role)

**Request:**
```bash
curl https://api.softaware.net.za/api/admin/credits/balances \
  -H "Authorization: Bearer <admin-token>"
```

**Success Response (200):**
```json
{
  "success": true,
  "balances": [
    {
      "id": "balance-uuid-123",
      "teamId": "team-uuid-456",
      "team": {
        "id": "team-uuid-456",
        "name": "Acme Corp Team",
        "ownerId": "user-uuid-789",
        "createdAt": "2026-01-10T10:00:00.000Z"
      },
      "balance": 5430,
      "formattedBalance": "5,430 credits",
      "createdAt": "2026-01-10T10:30:00.000Z",
      "updatedAt": "2026-03-04T11:00:00.000Z"
    }
  ]
}
```

---

### 7.6 POST /api/admin/credits/balances/:teamId/adjust

**Purpose:** Manually adjust team credit balance (add or subtract credits).

**Authentication:** Required (Admin role)

**URL Parameters:**
- `teamId` (string, required) — Team UUID

**Request Body:**
```json
{
  "amount": 1000,
  "description": "Promotional bonus for annual subscription",
  "type": "ADJUSTMENT"
}
```

**Field Definitions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| amount | number | Yes | Credits to add (positive) or subtract (negative) |
| description | string | Yes | Audit trail description (max 200 chars) |
| type | enum | No | ADJUSTMENT (default), BONUS, or REFUND |

**Request:**
```bash
curl -X POST https://api.softaware.net.za/api/admin/credits/balances/team-uuid-456/adjust \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "description": "Promotional bonus"
  }'
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Successfully added 1000 credits",
  "balance": {
    "id": "balance-uuid-123",
    "teamId": "team-uuid-456",
    "balance": 6430
  }
}
```

**Effect:**
1. Updates `credit_balances.balance` (adds/subtracts amount)
2. Creates transaction record in `credit_transactions` with the specified type
3. Records `description` prefixed with `[Admin]` in transaction for audit trail

---

### 7.7 GET /api/admin/credits/transactions

**Purpose:** List all credit transactions across all teams.

**Authentication:** Required (Admin role)

**Query Parameters:**
- `limit` (number, optional) — Max transactions to return (default: 100)
- `offset` (number, optional) — Skip first N transactions (default: 0)

**Request:**
```bash
curl "https://api.softaware.net.za/api/admin/credits/transactions?limit=50&offset=0" \
  -H "Authorization: Bearer <admin-token>"
```

**Success Response (200):**
```json
{
  "success": true,
  "transactions": [
    {
      "id": "txn-uuid-789",
      "team": { "id": "team-uuid-456", "name": "Acme Corp Team" },
      "type": "ADJUSTMENT",
      "amount": 1000,
      "formattedAmount": "R10.00",
      "balanceAfter": 6430,
      "formattedBalance": "R64.30",
      "requestType": null,
      "description": "[Admin] Promotional bonus for annual subscription",
      "paymentProvider": null,
      "externalPaymentId": null,
      "createdAt": "2026-03-04T12:00:00.000Z"
    },
    {
      "id": "txn-uuid-788",
      "team": { "id": "team-uuid-456", "name": "Acme Corp Team" },
      "type": "USAGE",
      "amount": -50,
      "formattedAmount": "R0.50",
      "balanceAfter": 5430,
      "formattedBalance": "R54.30",
      "requestType": "TEXT_CHAT",
      "description": "AI chat request (TEXT_CHAT)",
      "paymentProvider": null,
      "externalPaymentId": null,
      "createdAt": "2026-03-04T11:45:00.000Z"
    }
  ],
  "pagination": {
    "total": 850,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

**Transaction Types:**
- `PURCHASE` — Credits purchased via payment
- `USAGE` — Credits consumed by API requests
- `ADJUSTMENT` — Manual admin adjustment
- `BONUS` — Signup bonuses, referrals, promotions

---

### 7.8 GET /api/admin/credits/balances/:teamId/transactions

**Purpose:** List transactions for a specific team.

**Authentication:** Required (Admin role)

**URL Parameters:**
- `teamId` (string, required) — Team UUID

**Query Parameters:**
- `limit` (number, optional) — Max transactions (default: 50)
- `offset` (number, optional) — Skip first N (default: 0)

**Request:**
```bash
curl "https://api.softaware.net.za/api/admin/credits/balances/team-uuid-456/transactions" \
  -H "Authorization: Bearer <admin-token>"
```

**Success Response (200):**
```json
{
  "success": true,
  "transactions": [
    {
      "id": "txn-uuid-789",
      "team": { "id": "team-uuid-456", "name": "Acme Corp Team" },
      "type": "ADJUSTMENT",
      "amount": 1000,
      "formattedAmount": "R10.00",
      "balanceAfter": 6430,
      "formattedBalance": "R64.30",
      "requestType": null,
      "description": "Promotional bonus",
      "paymentProvider": null,
      "externalPaymentId": null,
      "createdAt": "2026-03-04T12:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 42,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

---

### 7.9 GET /api/admin/credits/pricing

**Purpose:** View current AI request pricing configuration.

**Authentication:** Required (Admin role)

**Request:**
```bash
curl https://api.softaware.net.za/api/admin/credits/pricing \
  -H "Authorization: Bearer <admin-token>"
```

**Success Response (200):**
```json
{
  "success": true,
  "pricing": [
    {
      "type": "TEXT_CHAT",
      "baseCost": 5,
      "perTokenCost": 0,
      "perMultiplier": 1000,
      "description": "Full AI chat with token-based pricing",
      "formattedBaseCost": "R0.0500"
    },
    {
      "type": "TEXT_SIMPLE",
      "baseCost": 1,
      "perTokenCost": 0,
      "perMultiplier": 1,
      "description": "Simple text requests",
      "formattedBaseCost": "R0.0100"
    },
    {
      "type": "CODE_AGENT_EXECUTE",
      "baseCost": 10,
      "perTokenCost": 0,
      "perMultiplier": 1,
      "description": "Code agent execution with file editing",
      "formattedBaseCost": "R0.1000"
    },
    {
      "type": "AI_BROKER",
      "baseCost": 1,
      "perTokenCost": 0,
      "perMultiplier": 1,
      "description": "Minimal processing fee for external provider proxying",
      "formattedBaseCost": "R0.0100"
    }
  ],
  "note": "Pricing is currently configured in code. Database-driven pricing coming soon."
}
```

**Note:** This is read-only for now. Pricing configuration is in `/var/opt/backend/src/config/credits.ts`.

---

## 8. Configuration Routes

### 8.1 GET /api/admin/config/payment-gateways

**Purpose:** Get payment gateway configuration status. Shows which gateways are configured and enabled.

**Authentication:** Required (Admin role)

**Request:**
```bash
curl https://api.softaware.net.za/api/admin/config/payment-gateways \
  -H "Authorization: Bearer <admin-token>"
```

**Success Response (200):**
```json
{
  "success": true,
  "gateways": [
    {
      "provider": "PAYFAST",
      "name": "PayFast",
      "enabled": true,
      "configured": true,
      "settings": {
        "merchantId": "***1234",
        "hasMerchantKey": true,
        "hasPassphrase": true,
        "testMode": false
      }
    },
    {
      "provider": "YOCO",
      "name": "Yoco",
      "enabled": true,
      "configured": true,
      "settings": {
        "hasSecretKey": true,
        "hasPublicKey": true,
        "hasWebhookSecret": true,
        "testMode": false
      }
    },
    {
      "provider": "MANUAL",
      "name": "Manual Payment",
      "enabled": true,
      "configured": true,
      "settings": {
        "note": "Always available for manual admin processing"
      }
    }
  ],
  "note": "Payment gateway credentials are configured via environment variables. Update .env file to change settings."
}
```

---

### 8.2 POST /api/admin/config/payment-gateways/test

**Purpose:** Test payment gateway connection.

**Authentication:** Required (Admin role)

**Request Body:**
```json
{
  "provider": "YOCO"
}
```

**Valid Providers:** `PAYFAST` | `YOCO`

**Success Response (200):**
```json
{
  "success": true,
  "provider": "YOCO",
  "message": "Yoco API connection successful",
  "error": ""
}
```

---

### 8.3 GET /api/admin/config/ai-providers

**Purpose:** Get AI provider configuration and default settings.

**Authentication:** Required (Admin role)

**Success Response (200):**
```json
{
  "success": true,
  "providers": [
    {
      "provider": "glm",
      "name": "GLM (ZhipuAI)",
      "enabled": true,
      "configured": true,
      "settings": {
        "hasApiKey": true,
        "apiKeyPreview": "***abcd",
        "defaultTextModel": "glm-4-plus",
        "defaultVisionModel": "glm-4v-plus",
        "baseUrl": "https://open.bigmodel.cn/api/paas/v4/chat/completions"
      },
      "isDefault": true
    },
    {
      "provider": "ollama",
      "name": "Ollama (Local)",
      "enabled": true,
      "configured": true,
      "settings": {
        "baseUrl": "http://localhost:11434",
        "defaultTextModel": "qwen2.5-coder:32b",
        "defaultVisionModel": "llava:7b"
      },
      "isDefault": false
    }
  ],
  "defaultProvider": "glm",
  "visionProvider": "glm",
  "note": "AI provider settings are configured via environment variables."
}
```

---

### 8.4 POST /api/admin/config/ai-providers/test

**Purpose:** Test AI provider connection. Returns available models on success.

**Authentication:** Required (Admin role)

**Request Body:**
```json
{
  "provider": "ollama"
}
```

**Valid Providers:** `glm` | `ollama`

**Success Response (200):**
```json
{
  "success": true,
  "provider": "ollama",
  "message": "Ollama connected successfully at http://localhost:11434",
  "error": "",
  "models": ["qwen2.5-coder:32b", "llava:7b", "nomic-embed-text"]
}
```

---

### 8.5 GET /api/admin/config/system

**Purpose:** Get general system configuration (read-only).

**Authentication:** Required (Admin role)

**Success Response (200):**
```json
{
  "success": true,
  "config": {
    "nodeEnv": "production",
    "port": 3001,
    "corsOrigin": "https://app.softaware.net.za",
    "jwtExpiresIn": "24h",
    "mcpEnabled": true,
    "codeAgentEnabled": true,
    "defaultAIProvider": "glm",
    "smtp": {
      "configured": true,
      "host": "smtp.example.com",
      "port": 587,
      "secure": false,
      "from": "noreply@softaware.net.za"
    }
  }
}
```

---

## 9. Admin Cases Routes

### 9.1 GET /api/admin/cases

**Purpose:** List all cases with optional filters. Returns cases with reporter/assignee names and summary stats.

**Authentication:** Required (Admin role)

**Query Parameters:**
- `status` (string, optional) — Filter by status
- `severity` (string, optional) — Filter by severity
- `type` (string, optional) — Filter by type
- `assigned_to` (string, optional) — Filter by assignee UUID
- `search` (string, optional) — Full-text search (title, description, case_number)

**Success Response (200):**
```json
{
  "success": true,
  "cases": [
    {
      "id": "case-uuid-123",
      "case_number": "CAS-001",
      "title": "Login page broken on mobile",
      "description": "Cannot submit login form on iOS Safari",
      "status": "open",
      "severity": "high",
      "category": "bug",
      "source": "user_report",
      "reported_by_name": "John Doe",
      "reported_by_email": "john@acme.com",
      "assigned_to_name": "Dev Team Lead",
      "comment_count": 3,
      "tags": ["mobile", "auth"],
      "metadata": {},
      "created_at": "2026-03-04T10:00:00.000Z"
    }
  ],
  "stats": {
    "total": 150,
    "open": 42,
    "in_progress": 28,
    "resolved": 68,
    "critical": 5,
    "auto_detected": 12,
    "avg_rating": 4.2
  }
}
```

---

### 9.2 GET /api/admin/cases/analytics

**Purpose:** Case analytics dashboard with breakdowns and trends.

**Success Response (200):**
```json
{
  "success": true,
  "totalCases": 150,
  "openCases": 42,
  "resolvedCases": 68,
  "avgResolutionTime": "2d",
  "bySeverity": [
    { "severity": "critical", "count": 5 },
    { "severity": "high", "count": 25 }
  ],
  "byCategory": [
    { "category": "bug", "count": 60 },
    { "category": "feature_request", "count": 30 }
  ],
  "byStatus": [
    { "status": "open", "count": 42 },
    { "status": "in_progress", "count": 28 }
  ],
  "recentTrend": [
    { "date": "2026-03-01", "count": 8 },
    { "date": "2026-03-02", "count": 12 }
  ]
}
```

---

### 9.3 POST /api/admin/cases/bulk-assign

**Purpose:** Assign multiple cases to a team member. Sends notifications to the assignee.

**Request Body:**
```json
{
  "case_ids": ["case-uuid-1", "case-uuid-2", "case-uuid-3"],
  "assigned_to": "user-uuid-dev"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "3 cases assigned successfully"
}
```

---

### 9.4 POST /api/admin/cases/bulk-update-status

**Purpose:** Update the status of multiple cases. Notifies reporters and assignees. Sets `resolved_at`/`resolved_by` for resolved/closed statuses.

**Request Body:**
```json
{
  "case_ids": ["case-uuid-1", "case-uuid-2"],
  "status": "resolved"
}
```

**Valid Statuses:** `open` | `in_progress` | `resolved` | `closed` | `wont_fix`

**Success Response (200):**
```json
{
  "success": true,
  "message": "2 cases updated successfully"
}
```

---

### 9.5 GET /api/admin/cases/health

**Purpose:** Get system health status from the health monitor service.

**Success Response (200):**
```json
{
  "success": true,
  "health": { }
}
```

---

### 9.6 POST /api/admin/cases/health/run-checks

**Purpose:** Manually trigger a health check run (fire-and-forget).

**Success Response (200):**
```json
{
  "success": true,
  "message": "Health checks triggered"
}
```

---

### 9.7 GET /api/admin/cases/team-performance

**Purpose:** Per-team-member performance metrics for case resolution.

**Success Response (200):**
```json
{
  "success": true,
  "performance": [
    {
      "id": "user-uuid-dev",
      "name": "Dev Team Lead",
      "email": "dev@softaware.net.za",
      "total_assigned": 45,
      "resolved": 38,
      "in_progress": 5,
      "avg_resolution_hours": 18.5,
      "avg_rating": 4.6
    }
  ]
}
```

---

### 9.8 POST /api/admin/cases/bulk-delete

**Purpose:** Delete multiple cases and all related records (comments, activity).

**Request Body:**
```json
{
  "case_ids": ["case-uuid-1", "case-uuid-2"]
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "2 case(s) deleted"
}
```

---

### 9.9 DELETE /api/admin/cases/:id

**Purpose:** Delete a single case and all related records. Notifies the reporter if different from the deleting admin.

**URL Parameters:**
- `id` (string, required) — Case UUID

**Success Response (200):**
```json
{
  "success": true,
  "message": "Case deleted successfully"
}
```

---

## 10. Authentication Headers

All admin routes require two headers:

```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

### Example Token Acquisition

```bash
# 1. Login as admin
LOGIN_RESPONSE=$(curl -X POST https://api.softaware.net.za/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@softaware.net.za",
    "password": "your-secure-password"
  }')

# 2. Extract token
TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')

# 3. Use token in subsequent requests
curl https://api.softaware.net.za/api/admin/clients/overview \
  -H "Authorization: Bearer $TOKEN"
```

---

## 11. Error Response Formats

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Unauthorized: Invalid or expired token"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": "Admin access required"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Resource not found"
}
```

### 400 Bad Request (Validation Error)
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "code": "invalid_type",
      "expected": "string",
      "received": "undefined",
      "path": ["client_name"],
      "message": "Required"
    }
  ]
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal server error",
  "message": "Database connection failed"
}
```

---

## 12. Rate Limiting

**Current Status:** Not implemented for admin routes

**Planned:**
- 1000 requests per hour per admin user
- Burst allowance: 100 requests per minute
- Custom limits for bulk operations

---

## 13. Webhooks

### Enterprise Endpoint Webhook Format

When external systems call generated webhook URLs (`/api/v1/webhook/:endpointId`), they should send:

**Request:**
```
POST /api/v1/webhook/ep-1709000000000
Content-Type: application/json

{
  "message": "Hello, I need help with my order #12345",
  "sender": "user@example.com",
  "context": {
    "order_id": "12345",
    "channel": "whatsapp"
  }
}
```

**Response (Success):**
```json
{
  "success": true,
  "reply": "Hello! I'd be happy to help you with order #12345. Let me look that up for you...",
  "metadata": {
    "model_used": "qwen2.5-coder:32b",
    "processing_time_ms": 850
  }
}
```

**Response (Endpoint Paused - 503):**
```json
{
  "success": false,
  "error": "Service temporarily unavailable",
  "reason": "Endpoint is currently paused"
}
```

---

## 15. System Settings Routes — `settings.ts`

**Base path:** `/api/settings`  
**Auth:** requireAuth + requireAdmin (except `/public`)

### GET /api/settings/public
Returns all settings where `is_public = 1` as a flat key→value map. No authentication required. Values are automatically cast to their native type (integers, booleans, JSON objects).

**Response:**
```json
{
  "success": true,
  "data": {
    "items_per_page": 20,
    "app_version": "1.0.1",
    "site_name": "API Application"
  }
}
```

### GET /api/settings/key/:key
Returns a single setting by its key name.

**Response:**
```json
{ "success": true, "data": { "id": 1, "setting_key": "site_name", "setting_value": "API Application", "setting_type": "string", "is_public": 0, "description": "Application name" } }
```

### GET /api/settings
Returns all settings as an array. Optional `?public_only=1` filter.

### GET /api/settings/:id
Returns a single setting by its numeric ID.

### POST /api/settings
Creates a new setting. Requires admin.

**Body:**
```json
{ "setting_key": "my_setting", "setting_value": "some_value", "setting_type": "string", "is_public": false, "description": "Optional description" }
```

### PUT /api/settings/:id
Updates an existing setting. Requires admin.

### DELETE /api/settings/:id
Deletes a setting by ID. Requires admin.

---

## 16. System Users Routes — `systemUsers.ts`

**Base path:** `/api/users`  
**Auth:** requireAuth + requireAdmin

### GET /api/users
Lists all users with their assigned roles. Passwords are excluded from the response.

**Response shape:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "email": "admin@example.com", "name": "Admin", "is_admin": 1, "is_staff": 0, "account_status": "active", "roles": [{ "id": 1, "name": "Admin", "slug": "admin" }] }
  ]
}
```

### GET /api/users/:id
Returns a single user with roles. Returns 404 if not found.

### POST /api/users
Creates a new user. Password is hashed with bcrypt (12 rounds). Optional `role_id` assigns a role immediately.

**Body:**
```json
{ "email": "user@example.com", "password": "SecurePass123!", "name": "John Doe", "phone": "+27821234567", "role_id": 2 }
```

### PUT /api/users/:id
Updates user fields. If `password` is provided it is re-hashed. If `role_id` changes, all existing roles are cleared and the new role is assigned.

### DELETE /api/users/:id
Deletes a user. Cascades through 14 foreign key tables: `user_roles`, `team_members`, `fcm_tokens`, `api_keys`, `device_activations`, `activation_keys`, `agents_config`, `vault_credentials`, `user_two_factor`, `group_members`, `group_messages`, `widget_clients`, `generated_sites`, `notifications`.

---

## 17. System Roles Routes — `systemRoles.ts`

**Base path:** `/api/roles`  
**Auth:** requireAuth + requireAdmin

### GET /api/roles
Lists all roles with `permission_count` aggregate.

### GET /api/roles/:id
Returns a role with its full list of assigned permissions.

### POST /api/roles
Creates a new role.

**Body:**
```json
{ "name": "Support Agent", "slug": "support_agent", "description": "Can view and respond to cases" }
```

### PUT /api/roles/:id
Updates a role. Slug is typically immutable once assigned to users.

### DELETE /api/roles/:id
Deletes a role. Cascades to `role_permissions` and `user_roles`.

### POST /api/roles/:id/assign
Assigns this role to a user.

**Body:** `{ "user_id": 5 }`

### POST /api/roles/:id/remove
Removes this role from a user.

**Body:** `{ "user_id": 5 }`

---

## 18. System Permissions Routes — `systemPermissions.ts`

**Base path:** `/api/permissions`  
**Auth:** requireAuth + requireAdmin (except `/user`)

### GET /api/permissions
Lists all permissions, optionally filtered by `?group=` query param.

### GET /api/permissions/user
Returns the current authenticated user's permissions. Admin/super-admin always receive `["*"]` (wildcard). Other roles receive their full permission slug array.

### GET /api/permissions/:id
Returns a single permission by ID.

### POST /api/permissions
Creates a new permission.

**Body:**
```json
{ "name": "Manage Cases", "slug": "cases.manage", "description": "Can create, assign and close cases", "permission_group": "Cases" }
```

### PUT /api/permissions/:id
Updates a permission.

### DELETE /api/permissions/:id
Deletes a permission. Cascades to `role_permissions`.

### POST /api/permissions/:id/assign
Assigns this permission to a role.

**Body:** `{ "role_id": 3 }`

### POST /api/permissions/:id/remove
Removes this permission from a role.

**Body:** `{ "role_id": 3 }`

---

## 19. System Credentials Routes — `systemCredentials.ts`

**Base path:** `/api/credentials`  
**Auth:** requireAuth + requireAdmin

All credential values are AES-256-GCM encrypted at rest using the `encryptPassword()` utility (format: `iv:authTag:ciphertext`). Values are only decrypted for internal service usage or when `?decrypt=true` is passed by admin.

### GET /api/credentials
Lists all credentials. Default: values masked (`***`). Add `?decrypt=true` to receive plain-text values.

Optional filters: `?type=api_key`, `?environment=production`

### GET /api/credentials/search
Full-text search on `service_name`, `name`, `description`. Pass `?q=term`.

### GET /api/credentials/service/:name
Returns all credentials for a service name (e.g., `SMTP`, `SMS`, `OPENROUTER`).

### GET /api/credentials/expired
Returns credentials where `expires_at < NOW()` and `is_active = 1`.

### GET /api/credentials/expiring
Returns credentials expiring within 30 days.

### GET /api/credentials/:id
Returns a single credential. Updates `last_used_at` timestamp.

### POST /api/credentials
Creates a new credential. Value is encrypted before storage.

**Body:**
```json
{
  "service_name": "MY_API",
  "name": "My API Key",
  "credential_type": "api_key",
  "credential_value": "sk-abc123",
  "environment": "production",
  "description": "Production API key",
  "expires_at": "2027-01-01",
  "additional_data": {}
}
```

### PUT /api/credentials/:id
Updates credential fields. Value is re-encrypted if provided. Calls `invalidateCache(serviceName)` to clear the in-memory vault cache.

### DELETE /api/credentials/:id
Permanently deletes a credential. Invalidates vault cache.

### POST /api/credentials/:id/deactivate
Sets `is_active = 0` without deleting. Invalidates cache.

### POST /api/credentials/:id/rotate
Updates the `credential_value` with a new value (re-encrypted). Increments `version`.

**Body:** `{ "new_value": "sk-newkey456" }`

### POST /api/credentials/:id/test
Validates that a credential is active, not expired, and has a non-empty value.

**Response:**
```json
{ "success": true, "valid": true, "message": "Credential is valid and active" }
```

---

## 20. Email / SMTP Routes — `email.ts`

**Base path:** `/api/email`  
**Auth:** requireAuth + requireAdmin (except `/send` which uses requireAuth)

SMTP configuration is stored in the `credentials` table (service_name = `SMTP`). The nodemailer transporter is cached in-memory and invalidated after config changes.

### POST /api/email/test
Sends a test email to the requesting admin's email address to verify SMTP configuration.

**Response:**
```json
{ "success": true, "message": "Test email sent successfully", "messageId": "<abc@smtp.example.com>" }
```

### POST /api/email/send
Sends an email. Available to all authenticated users.

**Body:**
```json
{
  "to": "recipient@example.com",
  "subject": "Hello",
  "text": "Plain text body",
  "html": "<p>HTML body</p>",
  "replyTo": "noreply@example.com"
}
```

### GET /api/email/config
Returns the current SMTP configuration. Password is NOT returned — response includes `password_set: true/false` only.

**Response:**
```json
{
  "success": true,
  "data": {
    "host": "smtp.gmail.com",
    "port": 587,
    "username": "noreply@example.com",
    "from_name": "My App",
    "from_email": "noreply@example.com",
    "encryption": "tls",
    "password_set": true
  }
}
```

### PUT /api/email/config
Updates SMTP configuration. Stores host/port/username/from_name/from_email/encryption in `additional_data`, password in `credential_value`. Calls `invalidateTransporter()` to force next-send reconnect.

**Body:**
```json
{
  "host": "smtp.gmail.com",
  "port": 587,
  "username": "user@gmail.com",
  "password": "app_password_here",
  "from_name": "My App",
  "from_email": "noreply@example.com",
  "encryption": "tls"
}
```

### GET /api/email/logs
Returns paginated email send history. Query params: `limit` (default 50), `offset` (default 0).

---

## 21. SMS Routes — `sms.ts`

**Base path:** `/api/sms`  
**Auth:** requireAuth + requireAdmin

SMS delivery via SMSPortal REST API. Credentials loaded from `credentials` table (service_name = `SMS`).

### POST /api/sms/send
Sends a single SMS.

**Body:**
```json
{
  "to": "+27821234567",
  "message": "Your OTP is 123456",
  "testMode": false,
  "campaignName": "optional-campaign",
  "scheduledDelivery": null
}
```

**Response:**
```json
{ "success": true, "data": { "messageId": "msg-123", "status": "queued", "cost": 0.25 } }
```

### POST /api/sms/send-bulk
Sends to up to 500 recipients. Body is an array of `{ to, message }` objects.

**Body:**
```json
{
  "messages": [
    { "to": "+27821234567", "message": "Hello Alice" },
    { "to": "+27827654321", "message": "Hello Bob" }
  ],
  "campaignName": "bulk-promo-2026"
}
```

### GET /api/sms/balance
Queries SMSPortal for current prepaid credit balance.

**Response:**
```json
{ "success": true, "data": { "balance": 1450.75, "currency": "ZAR" } }
```

### GET /api/sms/normalise/:phone
Normalises any South African phone format to E.164.

Examples: `0821234567` → `+27821234567`, `27821234567` → `+27821234567`

---

## 22. Two-Factor Authentication Routes — `twoFactor.ts`

**Base path:** `/api/auth/2fa`

| Route | Auth Required |
|-------|--------------|
| GET /status | requireAuth |
| POST /setup | requireAuth |
| POST /setup/verify | requireAuth |
| POST /verify | temp_token (JWT with `twofa_pending: true`) |
| POST /resend | temp_token |
| POST /disable | requireAuth |
| PUT /method | requireAuth |
| POST /backup-codes | requireAuth |

### Login Flow (2FA-enabled user)
```
1.  POST /auth/login          → { requires_2fa: true, temp_token, method, masked_contact }
2a. POST /auth/2fa/verify     → { success: true, token: <real JWT>, user: {...} }
2b. POST /auth/2fa/resend     → re-send OTP (email/SMS only) → 200 OK
```

### GET /api/auth/2fa/status
Returns whether 2FA is enabled and which method is configured.

**Response:**
```json
{ "enabled": true, "method": "email", "masked_contact": "j***@example.com" }
```

### POST /api/auth/2fa/setup
Starts 2FA setup for an authenticated user.

**Body:** `{ "method": "totp" | "email" | "sms" }`

- TOTP: Returns `{ qr_code: "<data-uri>", secret: "BASE32SECRET" }`
- Email/SMS: Sends a 6-digit OTP, returns `{ message: "OTP sent" }`

### POST /api/auth/2fa/setup/verify
Confirms the setup code, enables 2FA, and returns one-time backup codes.

**Body:** `{ "code": "123456" }`

**Response:**
```json
{
  "success": true,
  "message": "2FA enabled successfully",
  "backup_codes": ["abc1def2", "ghi3jkl4", "...8 more"]
}
```
> ⚠️ Backup codes are shown **once only** and are not recoverable.

### POST /api/auth/2fa/verify
Verifies a 2FA code during login. Uses `temp_token` (not real JWT). Accepts TOTP codes, email/SMS OTPs, or backup codes.

**Headers:** `Authorization: Bearer <temp_token>`  
**Body:** `{ "code": "123456" }`

**Response (success):**
```json
{ "success": true, "token": "<real JWT>", "user": { "id": 1, "email": "...", ... } }
```

### POST /api/auth/2fa/resend
Re-sends an OTP for email or SMS methods. Only valid during the 5-minute login window.

**Headers:** `Authorization: Bearer <temp_token>`

### POST /api/auth/2fa/disable
Disables 2FA for the authenticated user. Requires `current_password`. **Blocked for staff and admin users.**

**Body:** `{ "password": "current_password" }`

### PUT /api/auth/2fa/method
Changes the 2FA method. Requires current password and a verified code from the new method.

**Body:** `{ "password": "current_password", "new_method": "totp", "verification_code": "123456" }`

### POST /api/auth/2fa/backup-codes
Regenerates all 10 backup codes. Existing codes are invalidated. Requires current password.

**Body:** `{ "password": "current_password" }`

**Response:**
```json
{ "success": true, "backup_codes": ["newcode1", "newcode2", "...8 more"] }
```

---

## 23. My Assistant Routes — `myAssistant.ts`

**Base path:** `/api/v1/mobile/my-assistant`  
**Auth:** requireAuth (no requireAdmin — this route handles both staff and client roles)

This is the unified assistant management endpoint. Staff users are limited to 1 assistant (`is_staff_agent = 1`). Client users may have multiple.

### GET /api/v1/mobile/my-assistant
Lists all assistants belonging to the authenticated user.

### GET /api/v1/mobile/my-assistant/:id
Returns a single assistant. Verifies ownership (or staff/admin override).

### POST /api/v1/mobile/my-assistant
Creates a new assistant. For staff users: limited to 1, always set as primary. For clients: first assistant is auto-primary.

**Body:**
```json
{
  "name": "Alex",
  "description": "My business assistant",
  "personality": "professional",
  "personality_flare": "concise and helpful",
  "primary_goal": "Help with daily tasks",
  "custom_greeting": "Hi! How can I help?",
  "voice_style": "friendly",
  "preferred_model": "qwen2.5-coder:32b",
  "business_type": "Software",
  "website": "https://example.com"
}
```

### PUT /api/v1/mobile/my-assistant/:id
Updates an assistant. The `core_instructions` field is ignored and never user-editable.

### PUT /api/v1/mobile/my-assistant/:id/set-primary
Sets this assistant as the primary assistant. Clears `is_primary` on all others for the user.

### DELETE /api/v1/mobile/my-assistant/:id
Deletes an assistant. If the deleted assistant was primary, the next one in the list is auto-promoted.

### POST /api/v1/mobile/my-assistant/core-instructions
Sets `core_instructions` on an assistant. **Super-admin only.** This field is injected into the AI prompt as a system-level guardrail and is never visible in the regular GET responses.

**Body:** `{ "assistant_id": 5, "core_instructions": "You are a helpful assistant for Softaware..." }`

### GET /api/v1/mobile/my-assistant/software-tokens
Lists all software portal tokens for the authenticated staff user. **Staff role required.**

### POST /api/v1/mobile/my-assistant/software-tokens
Upserts (creates or updates) a software portal token for the staff user.

**Body:** `{ "software_key": "20251111SA", "api_token": "tok_abc123", "api_url": "https://updates.softaware.co.za" }`

### DELETE /api/v1/mobile/my-assistant/software-tokens/:id
Deletes a software portal token by ID. **Staff role required.**

---

## 14. Changelog

### Version 1.3.0 (2026-03-12)
- Added Admin Audit Log feature (SQLite-backed, separate from MySQL)
- New file: `adminAuditLog.ts` — 6 endpoints at `/api/admin/audit-log`
  - GET `/admin/audit-log` — Paginated, filterable log list
  - GET `/admin/audit-log/stats` — Dashboard statistics
  - GET `/admin/audit-log/filters` — Available filter values
  - POST `/admin/audit-log/trim` — Trim entries older than N days
  - DELETE `/admin/audit-log/bulk` — Delete specific entries by ID
  - DELETE `/admin/audit-log/purge` — Purge ALL entries
- New middleware: `auditLogger.ts` — Logs all admin actions automatically
- New DB module: `db/auditLog.ts` — SQLite storage with WAL mode
- Frontend: `AuditLog.tsx` page at `/admin/audit-log` with filtering, stats, and trim UI
- Total endpoints updated from 116 to 122

### Version 1.2.0 (2026-03-05)
- Added System Settings routes (settings.ts: 7 endpoints — `/api/settings`)
- Added System Users routes (systemUsers.ts: 5 endpoints — `/api/users`)
- Added System Roles routes (systemRoles.ts: 7 endpoints — `/api/roles`)
- Added System Permissions routes (systemPermissions.ts: 8 endpoints — `/api/permissions`)
- Added System Credentials routes (systemCredentials.ts: 12 endpoints — `/api/credentials`)
- Added Email/SMTP routes (email.ts: 5 endpoints — `/api/email`)
- Added SMS routes (sms.ts: 4 endpoints — `/api/sms`)
- Added Two-Factor Authentication routes (twoFactor.ts: 8 endpoints — `/api/auth/2fa`)
- Added My Assistant routes (myAssistant.ts: 10 endpoints — `/api/v1/mobile/my-assistant`)
- Total endpoints updated from 50 to 116

### Version 1.1.0 (2026-03-05)
- Added Core Admin Routes section (admin.ts: stats, device clients, activation keys, teams, leads)
- Added Configuration Routes section (adminConfig.ts: payment gateways, AI providers, system)
- Added Admin Cases Routes section (adminCases.ts: listing, analytics, bulk ops, health, performance)
- Updated credit routes: adjust moved to `/balances/:teamId/adjust`, team transactions to `/balances/:teamId/transactions`
- Updated client manager: suspend → suspend-all, reactivate → reactivate-all (nuclear options)
- Updated dashboard response to reflect comprehensive system-wide stats
- Updated transaction response shape (added formattedAmount, balanceAfter, requestType, paymentProvider, externalPaymentId)
- Total endpoints updated from 37 to 50

### Version 1.0.0 (2026-03-04)
- Initial documentation
- 37 admin endpoints documented
- Full CRUD for clients, endpoints, credits
- Masquerade functionality
- Kill switch system documented

---

**Next Steps:**
- See [FIELDS.md](./FIELDS.md) for database schema details
- See [README.md](./README.md) for architecture overview
- See [PATTERNS.md](./PATTERNS.md) for code patterns and best practices
