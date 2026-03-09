# Admin Module — Overview

**Version:** 1.2.0  
**Last Updated:** 2026-03-05

---

## 1. Module Overview

### Purpose

The Admin module provides comprehensive administrative control over the entire Soft Aware platform. It serves as the central command center for managing AI services, client accounts, enterprise endpoints, credit systems, and platform-wide operations. This module enables super-admin users to monitor system health, enforce kill switches, configure AI infrastructure, and maintain platform integrity.

### Business Value

- **Centralized Control**: Single pane of glass for all platform operations
- **Kill Switch System**: Granular control to suspend accounts, assistants, and widgets at multiple levels
- **Revenue Operations**: Credit package management, balance tracking, and transaction monitoring
- **Enterprise Management**: Dynamic webhook endpoint configuration with LLM routing
- **System Monitoring**: Real-time statistics and health metrics across all services
- **Client Lifecycle Management**: Full CRUD operations on user accounts with masquerade capability
- **Financial Oversight**: Complete visibility into AI credit usage and billing

### Key Statistics

| Metric | Value |
|--------|-------|
| Frontend page files | 10 |
| Backend route files | 16 |
| Frontend LOC | ~6,012 |
| Backend LOC | ~3,568 |
| Total LOC | ~9,580 |
| API endpoints | 116 |
| MySQL tables | 25+ (users, roles, permissions, role_permissions, user_roles, user_two_factor, credentials, sys_settings, email_log, sms_log, staff_software_tokens, assistants, widget_clients, credit_packages, credit_balances, credit_transactions, teams, device_activations, client_agents, activation_keys, subscriptions, update_software, update_modules, update_releases, update_clients, generated_sites, lead_captures, cases, case_comments, case_activity) |
| JSON storage files | 1 (enterprise_endpoints.json) |
| Protected routes | All (requireAuth + requireAdmin) |

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                                 │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Admin Pages (/admin/*)                                         │    │
│  │                                                                  │    │
│  │  AIOverview.tsx              — AI system dashboard & metrics        │    │
│  │  Dashboard.tsx               — Software tasks & project management  │    │
│  │  ClientManager.tsx           — User accounts & kill switches        │    │
│  │  AICredits.tsx               — Credit packages & balances           │    │
│  │  EnterpriseEndpoints.tsx     — Dynamic webhook configuration        │    │
│  │  AdminCaseManagement.tsx     — Case triage, bulk ops & analytics    │    │
│  │  SystemSettings.tsx          — System settings (KV) & SMTP config  │    │
│  │  Users.tsx                   — System user management & roles       │    │
│  │  Roles.tsx                   — Role management & permissions        │    │
│  │  Permissions.tsx             — Permission management                │    │
│  └──────────────────────────┬───────────────────────────────────────┘    │
│                             │                                            │
│                             ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  AdminAIModels.ts — Admin API client layer                     │    │
│  │  • AdminConfigModel  — System stats & AI config                 │    │
│  │  • AdminClientModel  — Client CRUD & masquerade                 │    │
│  │  • AdminEnterpriseModel — Enterprise endpoints CRUD             │    │
│  │  • AdminCreditsModel — Credit packages & balances               │    │
│  │  SystemModels.ts — System API client layer                      │    │
│  │  • SystemSettingModel — sys_settings CRUD                       │    │
│  │  • UserModel         — User CRUD + role assignment              │    │
│  │  • RoleModel         — Role CRUD + user assignment              │    │
│  │  • PermissionModel   — Permission CRUD + role assignment        │    │
│  └──────────────────────────┬───────────────────────────────────────┘    │
│                             │                                            │
└─────────────────────────────┼─────────────────────────────────────────────┘
                              │ HTTPS (Authorization: Bearer <admin-token>)
                              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         BACKEND (Express)                                │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Authentication Middleware                                       │    │
│  │  requireAuth → requireAdmin → route handlers                     │    │
│  │  (validates JWT + checks user.role in admin roles)               │    │
│  └──────────────────────────┬───────────────────────────────────────┘    │
│                             │                                            │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  /api/admin/* Routes                                            │    │
│  │                                                                  │    │
│  │  admin.ts                   /admin/*  (core routes)             │    │
│  │    → GET /stats             — Device & team stats               │    │
│  │    → GET /clients           — Device activations list           │    │
│  │    → GET /clients/:deviceId/agents — Agents for device          │    │
│  │    → GET /activation-keys   — List activation keys              │    │
│  │    → POST /activation-keys  — Create activation key             │    │
│  │    → DELETE /activation-keys/:id — Revoke key                   │    │
│  │    → GET /teams             — List all teams                    │    │
│  │    → GET /leads             — List captured leads               │    │
│  │    → POST /leads/:id/convert — Convert lead                     │    │
│  │                                                                  │    │
│  │  adminDashboard.ts          GET /admin/dashboard                │    │
│  │    → Comprehensive stats: workspaces, users, subscriptions,     │    │
│  │      software, connected clients, AI, websites, leads,          │    │
│  │      activation keys, system health, recent activity            │    │
│  │                                                                  │    │
│  │  adminClientManager.ts      /admin/clients/*                    │    │
│  │    → GET /overview          — All clients with assets           │    │
│  │    → GET /:userId           — Single client detail              │    │
│  │    → PATCH /:userId/status  — Master kill switch                │    │
│  │    → POST /:userId/suspend-all — Suspend account + all assets   │    │
│  │    → POST /:userId/reactivate-all — Reactivate all              │    │
│  │    → POST /:userId/masquerade — Login as user                   │    │
│  │    → PATCH /assistants/:id/status — Toggle assistant            │    │
│  │    → PATCH /widgets/:id/status — Toggle widget                  │    │
│  │                                                                  │    │
│  │  adminEnterpriseEndpoints.ts /admin/enterprise-endpoints/*      │    │
│  │    → GET /                  — List all endpoints                │    │
│  │    → POST /                 — Create endpoint                   │    │
│  │    → GET /:id               — Get endpoint detail               │    │
│  │    → PUT /:id               — Update endpoint                   │    │
│  │    → DELETE /:id            — Delete endpoint                   │    │
│  │    → PATCH /:id/status      — Status kill switch                │    │
│  │    → GET /:id/logs          — Request logs                      │    │
│  │                                                                  │    │
│  │  adminCredits.ts            /admin/credits/*                    │    │
│  │    → GET /packages          — List credit packages              │    │
│  │    → POST /packages         — Create package                    │    │
│  │    → PUT /packages/:id      — Update package                    │    │
│  │    → DELETE /packages/:id   — Deactivate package                │    │
│  │    → POST /packages/seed    — Seed default packages             │    │
│  │    → GET /balances          — All team balances                 │    │
│  │    → GET /balances/:teamId  — Single team balance               │    │
│  │    → POST /balances/:teamId/adjust — Adjust team credits        │    │
│  │    → GET /transactions      — All transactions                  │    │
│  │    → GET /balances/:teamId/transactions — Team transactions     │    │
│  │    → GET /pricing           — View pricing config               │    │
│  │                                                                  │    │
│  │  adminConfig.ts             /admin/config/*                     │    │
│  │    → GET /payment-gateways  — Payment gateway status            │    │
│  │    → POST /payment-gateways/test — Test gateway connection      │    │
│  │    → GET /ai-providers      — AI provider configuration         │    │
│  │    → POST /ai-providers/test — Test AI provider                 │    │
│  │    → GET /system            — General system configuration      │    │
│  │                                                                  │    │
│  │  adminCases.ts              /admin/cases/*                      │    │
│  │    → GET /                  — List all cases with filters       │    │
│  │    → GET /analytics         — Case analytics dashboard          │    │
│  │    → POST /bulk-assign      — Bulk assign cases                 │    │
│  │    → POST /bulk-update-status — Bulk status update              │    │
│  │    → GET /health            — System health status              │    │
│  │    → POST /health/run-checks — Trigger health checks            │    │
│  │    → GET /team-performance  — Team performance metrics          │    │
│  │    → POST /bulk-delete      — Bulk delete cases                 │    │
│  │    → DELETE /:id            — Delete single case                │    │
│  │                                                                  │    │
│  │  settings.ts                /settings/*                         │    │
│  │    → GET /public, GET /key/:key, GET /, GET /:id               │    │
│  │    → POST /, PUT /:id, DELETE /:id (admin only)                 │    │
│  │                                                                  │    │
│  │  systemUsers.ts + systemRoles.ts + systemPermissions.ts         │    │
│  │    → Full RBAC CRUD under /users, /roles, /permissions          │    │
│  │                                                                  │    │
│  │  systemCredentials.ts       /credentials/*                      │    │
│  │    → Encrypted credential vault — 12 endpoints                  │    │
│  │                                                                  │    │
│  │  email.ts                   /email/*                            │    │
│  │    → SMTP config, test, send, logs (5 endpoints)                │    │
│  │                                                                  │    │
│  │  sms.ts                     /sms/*                              │    │
│  │    → SMS send, bulk, balance, normalise (4 endpoints)           │    │
│  │                                                                  │    │
│  │  twoFactor.ts               /auth/2fa/*                         │    │
│  │    → Multi-method 2FA TOTP/email/SMS (8 endpoints)              │    │
│  │                                                                  │    │
│  │  myAssistant.ts             /v1/mobile/my-assistant/*           │    │
│  │    → Unified assistant CRUD for all roles (10 endpoints)        │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  STORAGE LAYER                                                  │    │
│  │                                                                  │    │
│  │  MySQL Database:                                                │    │
│  │    • users — account_status, role linkage                       │    │
│  │    • roles / permissions / role_permissions / user_roles        │    │
│  │    • user_two_factor — 2FA method, TOTP secret, OTP state       │    │
│  │    • credentials — AES-256-GCM encrypted service credentials    │    │
│  │    • sys_settings — key/value system configuration              │    │
│  │    • email_log — SMTP send audit trail                          │    │
│  │    • sms_log — SMS send audit trail                             │    │
│  │    • staff_software_tokens — staff tokens for task proxy        │    │
│  │    • assistants — status, tier, pages_indexed                   │    │
│  │    • widget_clients — status, subscription_tier                 │    │
│  │    • credit_packages — pricing, bonus credits                   │    │
│  │    • credit_balances — team balances, thresholds                │    │
│  │    • credit_transactions — audit trail, payment tracking        │    │
│  │    • teams / team_members — credit owners, membership           │    │
│  │    • device_activations — desktop client activations            │    │
│  │    • client_agents — agents per device                          │    │
│  │    • activation_keys — license key management                   │    │
│  │    • subscriptions — plan status tracking                       │    │
│  │    • update_software / update_modules / update_releases         │    │
│  │    • update_clients — connected desktop heartbeats              │    │
│  │    • generated_sites — site builder deployments                 │    │
│  │    • lead_captures — inbound lead tracking                      │    │
│  │    • cases / case_comments / case_activity                      │    │
│  │                                                                  │    │
│  │  JSON File Storage:                                             │    │
│  │    • enterprise_endpoints.json — in-memory endpoint config      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Features

### 3.1 AI Overview Dashboard

**Purpose:** Real-time monitoring and analytics for all AI services across the platform.

**Components:**
- **Hero Stats**: 4 gradient cards showing assistants, requests, credits, endpoints
- **Usage Analytics**: Area chart showing AI request trends by type
- **Endpoint Health**: Status distribution with pie chart (active/paused/disabled)
- **Top Clients**: Widget showing highest-usage customers by assistant count

**Data Sources:**
- `AdminConfigModel.getSystemStats()` — Overall AI statistics
- `AdminClientModel.getOverview()` — Client and assistant counts
- `AdminEnterpriseModel.getAll()` — Endpoint status distribution

**Note:** The main admin dashboard endpoint (`GET /admin/dashboard`, served by `adminDashboard.ts`) provides comprehensive stats from all system tables, not just AI metrics. The response includes sections for: workspaces, users, subscriptions, software products, connected clients (desktops), AI & assistants, credit stats, websites/site builder, leads, activation keys, system health, and recent activity.

**Visual Design:**
- Gradient hero cards with backdrop blur effects
- Recharts for data visualization (AreaChart, PieChart)
- Responsive grid layout (2 columns mobile → 4 columns desktop)
- Dark mode support throughout

**Key Metrics Displayed:**
- Total assistants count
- Total AI requests processed
- Credits used vs credits balance
- Active endpoints count
- Issues count (paused + disabled endpoints)

---

### 3.2 Client Manager

**Purpose:** Comprehensive user account management with granular kill switches for accounts, assistants, and widgets.

**Capabilities:**

#### Account Operations
- View all client accounts with stats (assistant count, widget count)
- Filter/search by email or name
- View detailed client profile with all associated assets
- Suspend/reactivate entire accounts (master kill switch)
- **Nuclear suspend-all**: Suspend account + all assistants + all widgets in one call
- **Reactivate-all**: Reactivate account + all assistants + all widgets in one call
- Set account status: `active`, `suspended`, `demo_expired`

#### Assistant Kill Switches
- View all assistants per client
- Toggle assistant status individually
- Status options: `active`, `suspended`, `demo_expired`
- Cascading impact: suspended account blocks all assistants

#### Widget Kill Switches
- View all widget clients per account
- Toggle widget status individually
- Status options: `active`, `suspended`, `demo_expired`, `upgraded`
- Monitors message counts and page ingestion limits

#### Masquerade Feature
- **Purpose**: Login as any user to troubleshoot issues or view their experience
- **Process**:
  1. Admin clicks "Login as User" on client profile
  2. Backend generates temporary masquerade token
  3. Frontend stores original admin session for restoration
  4. User is logged in as target client with full permissions
  5. Banner appears at top of all pages with "Return to Admin" button
  6. Admin can switch back instantly without re-authentication

**Security:**
- All routes protected by `requireAuth + requireAdmin`
- Admin restore token stored securely in AuthModel
- Audit trail logs masquerade events

**UI Features:**
- Real-time status badges with icons (CheckCircle, NoSymbol, ExclamationTriangle)
- Tabbed interface switching between user list and detailed views
- Stats summary cards showing active vs suspended counts
- Quick-action buttons for common operations

---

### 3.3 AI Credits Management

**Purpose:** Full lifecycle management of credit packages, team balances, and transaction history.

**Credit Packages Tab:**
- View all credit packages with pricing and bonus credits
- Create new packages with custom pricing
- Edit existing packages (name, credits, price, bonus, description)
- Deactivate packages (soft delete)
- Featured package flagging for UI prominence

**Package Fields:**
```typescript
{
  id: string (UUID)
  name: string (max 50 chars)
  description: string (optional, max 200 chars)
  credits: number (base credits purchased)
  bonusCredits: number (additional credits included)
  totalCredits: number (computed: credits + bonusCredits)
  price: number (in cents, e.g., 1000 = R10.00)
  formattedPrice: string (e.g., "R10.00")
  discountPercent: number (computed volume discount)
  featured: boolean
  isActive: boolean
  createdAt: datetime
  updatedAt: datetime
}
```

**Team Balances Tab:**
- View all team credit balances with team names
- Formatted balance display
- Team creation dates
- Quick balance adjustment with reason tracking

**Credit Adjustment:**
- Manually add or subtract credits from any team
- **Required fields**: team_id, amount (positive/negative integer), reason (audit trail)
- Creates transaction record with type `'ADJUSTMENT'`
- Use cases: refunds, promotional credits, error corrections

**Transactions Tab:**
- Complete audit trail of all credit activity
- Transaction types:
  - `PURCHASE` — Package purchases
  - `USAGE` — API requests consuming credits
  - `ADJUSTMENT` — Manual admin adjustments
  - `BONUS` — Promotional/signup bonuses
- Filterable by team (optional)
- Shows: amount, type, description, timestamp

**Pricing Configuration:**
- View current AI request pricing (read-only for now)
- Credit costs per request type:
  - `TEXT_CHAT` — Full AI chat with token pricing
  - `TEXT_SIMPLE` — Simple text requests
  - `AI_BROKER` — External provider proxying fee
  - `CODE_AGENT_EXECUTE` — Code agent with file editing
  - `FILE_OPERATION` — File operations
  - `MCP_TOOL` — MCP tool calls

---

### 3.4 Enterprise Endpoints

**Purpose:** Dynamic webhook endpoint management for enterprise clients with custom LLM routing and API integration.

**What are Enterprise Endpoints?**
Enterprise endpoints are custom webhook URLs (`/api/v1/webhook/:endpointId`) that act as intelligent AI routers. When external systems (WhatsApp, Slack, custom apps) send requests to these webhooks, the platform:
1. Receives the inbound payload
2. Routes it to configured LLM provider (Ollama, OpenRouter, OpenAI)
3. Processes the AI response
4. Optionally calls target API with structured data
5. Returns formatted response to caller
6. Logs everything for monitoring

**Endpoint Configuration:**

```typescript
{
  // Identity
  id: string (auto-generated: ep-{timestamp})
  client_id: string (client identifier)
  client_name: string (display name)
  status: 'active' | 'paused' | 'disabled'
  
  // Inbound Config
  inbound_provider: 'whatsapp' | 'slack' | 'custom_rest' | 'sms' | 'email' | 'web'
  inbound_auth_type?: 'bearer' | 'apikey' | 'none' (planned)
  
  // LLM Config
  llm_provider: 'ollama' | 'openrouter' | 'openai'
  llm_model: string (e.g., "qwen2.5-coder:32b")
  llm_system_prompt: string (defines AI behavior)
  llm_temperature: number (0-2, default: 0.3)
  llm_max_tokens: number (1-16384, default: 1024)
  llm_tools_config?: string (JSON array of tool definitions)
  llm_knowledge_base?: string (planned: assistant ID for RAG)
  
  // Target API Config (optional downstream routing)
  target_api_url?: string
  target_api_auth_type?: 'bearer' | 'basic' | 'custom' | 'none'
  target_api_auth_value?: string (token or credentials)
  target_api_headers?: string (JSON object)
  
  // Metadata
  created_at: datetime
  updated_at: datetime
  last_request_at?: datetime
  total_requests: number
}
```

**CRUD Operations:**
- **Create**: Define new endpoint with full configuration
- **Read**: List all endpoints or get single endpoint detail
- **Update**: Modify any configuration field
- **Delete**: Permanently remove endpoint
- **Status Toggle**: Quick kill switch (active ↔ paused)

**Request Logs:**
- View last N requests per endpoint (default 50, configurable)
- Log fields:
  - `id` — Log entry UUID
  - `endpoint_id` — Parent endpoint
  - `timestamp` — Request time
  - `inbound_payload` — Original request body (JSON string)
  - `ai_response` — LLM output (JSON string)
  - `duration_ms` — Processing time
  - `status` — Success/error indicator
  - `error_message` — Error details if failed

**UI Features:**
- Expandable row details showing full configuration
- Status badges with quick toggle
- JSON editor for tools config
- Copy webhook URL to clipboard
- Test endpoint functionality (planned)
- Log viewer with syntax highlighting

**Use Cases:**
1. **WhatsApp Business API Integration**: Route customer messages to AI, return responses
2. **Slack Bot Backend**: Process slash commands with LLM intelligence
3. **Custom CRM Webhook**: Enrich lead data with AI analysis before saving
4. **SMS Chatbot**: Handle Twilio webhooks with conversational AI
5. **Email Support Router**: Classify and respond to support emails

---

### 3.5 System Dashboard (Tasks)

**Purpose:** Software project management dashboard for internal development teams.

**Note:** This page (`Dashboard.tsx`) is distinct from the AI-focused admin pages. It provides task management for software projects rather than AI service administration.

**Features:**
- Multi-software project selector
- Task filtering by workflow phase, status, and module
- Role-based task visibility (developer, QA, client manager, etc.)
- Unbilled hours tracking
- Phase progress visualization
- Task list with priority indicators

**Workflow Phases:**
1. `intake` — New task submission (Client Manager role)
2. `quality_review` — Requirements validation (QA Specialist role)
3. `development` — Implementation (Developer role)
4. `verification` — Testing & review
5. `resolution` — Deployment & closure

**Integration:**
- Connects to external software API endpoints
- Requires software token authentication
- Uses `useSoftware()` and `useTasks()` hooks
- Stores selected software in localStorage

---

### 3.6 Core Admin (admin.ts)

**Purpose:** Cross-cutting admin endpoints for device activations, activation keys, teams, and lead capture management.

**Capabilities:**

#### Dashboard Stats
- Total/active device activations, agent count, team count

#### Device Client Management
- View all device activations with tier, activity timestamps, agent counts
- Drill into agents for a specific device (`GET /clients/:deviceId/agents`)
- Queries `device_activations` and `client_agents` tables

#### Activation Key Management
- List all activation keys with tier, permissions, and status
- Generate new keys (tier: `PERSONAL`, `TEAM`, `ENTERPRISE`) with optional permissions (`cloudSyncAllowed`, `vaultAllowed`, `maxAgents`, `maxUsers`)
- Auto-generated codes: `SA-{random_hex}`
- Revoke keys (soft delete via `isActive = false`)

#### Teams
- List all teams with member count and agent count (from `team_members` and `agents_config` tables)

#### Lead Capture
- List up to 500 captured leads with full detail (company, contact, use case, score, message count)
- Convert leads: update status to `CONVERTED` with optional conversion note appended to requirements

---

### 3.7 Admin Configuration (adminConfig.ts)

**Purpose:** Read-only configuration inspection for payment gateways, AI providers, and system settings.

**Payment Gateways:**
- View status of PayFast, Yoco, and Manual payment providers
- Shows configuration status, masked credentials, test mode flags
- Test gateway connectivity (Yoco: API OPTIONS request; PayFast: credential check)

**AI Providers:**
- View GLM (ZhipuAI) and Ollama configuration
- Shows API key status, default models, base URLs, default provider flag
- Test provider connectivity (Ollama: `/api/tags`; GLM: minimal chat completion)
- Returns available model lists on successful test

**System Configuration:**
- View runtime config: `NODE_ENV`, `PORT`, `CORS_ORIGIN`, `JWT_EXPIRES_IN`
- Feature flags: `MCP_ENABLED`, `CODE_AGENT_ENABLED`
- SMTP configuration status

**Note:** All config endpoints are read-only. Settings are managed via environment variables.

---

### 3.8 Admin Case Management (adminCases.ts)

**Purpose:** Comprehensive admin interface for managing all cases (user-reported and auto-detected) with bulk operations, analytics, and health monitoring.

**Frontend:** `AdminCaseManagement.tsx` (881 LOC)

**Capabilities:**

#### Case Listing & Filtering
- List all cases with optional filters: `status`, `severity`, `type`, `assigned_to`, `search`
- Returns cases with reporter/assignee names, comment counts, and summary stats
- Full-text search across title, description, and case number

#### Analytics Dashboard
- Core metrics: total cases, open, resolved, avg resolution time
- Breakdowns by severity, category, and status
- 14-day trend chart data

#### Bulk Operations
- **Bulk Assign**: Assign multiple cases to a team member with notification
- **Bulk Status Update**: Change status of multiple cases at once (with `resolved_at`/`resolved_by` tracking)
- **Bulk Delete**: Delete multiple cases and related records (comments, activity)
- Single case delete with cascade cleanup and reporter notification

#### Health Monitoring
- View system health status via `getHealthStatus()`
- Manually trigger health checks via `runHealthChecks()`

#### Team Performance
- Per-team-member metrics: total assigned, resolved, in-progress, avg resolution hours, avg rating
- Scoped to admin/developer/QA roles

---

### 3.9 System Users, Roles & Permissions

**Purpose:** Full lifecycle management of the system's user accounts, roles, and permissions. These pages live under `/system/` in the frontend and power the entire RBAC system used by the platform.

**Frontend Pages:**
- `Users.tsx` (508 LOC) — Full CRUD for system users; role assignment; password management
- `Roles.tsx` (589 LOC) — Role CRUD; add/remove permissions from roles; view users
- `Permissions.tsx` (210 LOC) — Permission CRUD; assign/remove from roles

**Backend Routes:**
- `systemUsers.ts` (`/users`) — 5 endpoints: list, get, create, update, delete
- `systemRoles.ts` (`/roles`) — 7 endpoints: list, get, create, update, delete, assign/remove user
- `systemPermissions.ts` (`/permissions`) — 8 endpoints: list, /user, get, create, update, delete, assign/remove role

**User Management:**
- Create users with email, password (bcrypt 12 rounds), name, phone
- Assign roles during creation or update
- Delete cascades through 14 foreign key tables (`user_roles`, `team_members`, `fcm_tokens`, `api_keys`, `device_activations`, `activation_keys`, `agents_config`, `vault_credentials`, `user_two_factor`, `group_members`, `group_messages`, `widget_clients`, `generated_sites`, `notifications`)
- `is_admin` and `is_staff` flags derived from role slugs at read time

**RBAC Design:**
- Roles: `admin`, `super_admin`, `staff`, or custom slugs
- Permissions: grouped by `permission_group` for UI display
- Admin always receives wildcard `*` permission via `GET /permissions/user`
- Frontend `<Can permission="...">` component checks permissions via `usePermissions()` hook

**Tables:** `users`, `roles`, `permissions`, `role_permissions`, `user_roles`

---

### 3.10 System Credentials Manager

**Purpose:** Admin CRUD for the encrypted credential vault. All external API keys, SMTP passwords, SMS credentials, and payment gateway keys are stored here with AES-256-GCM encryption.

**Backend Route:** `systemCredentials.ts` (`/credentials`) — 12 endpoints

**Key Features:**
- All values encrypted with `encryptPassword()` on write (`iv:authTag:ciphertext` format)
- Values decrypted only on explicit `?decrypt=true` query param or internal vault reads
- Cache invalidation via `invalidateCache(serviceName)` on every update/delete
- Expiry tracking with `expires_at` field; `GET /expiring` lists credentials due in 30 days
- Soft-deactivate (`is_active=0`) without deleting
- Rotate: update `credential_value` without touching other fields
- Test: validates credential is active, not expired, and has a non-empty value

**Credential Types:** `api_key`, `password`, `oauth`, `certificate`, `token`, `other`

**Active Service Keys:** `SMTP`, `OPENROUTER`, `GLM`, `FIREBASE`, `PAYFAST`, `YOCO`, `SMS`

**Table:** `credentials`

---

### 3.11 Email / SMTP Admin

**Purpose:** Configure SMTP outbound mail server and send/test emails from the admin panel.

**Backend Route:** `email.ts` (`/email`) — 5 endpoints  
**Frontend:** `SystemSettings.tsx` → SMTP tab

**SMTP Configuration Storage:**
- SMTP config lives in `credentials` table (service_name = `SMTP`)
- Password stored in `credential_value`; other settings (`host`, `port`, `username`, `from_name`, `from_email`, `encryption`) stored in `additional_data` JSON column
- Config read returns `password_set: boolean` — the actual password is never returned
- After a save, `invalidateTransporter()` clears the cached nodemailer instance so the next send picks up new credentials

**Endpoints:**
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | /email/test | Admin | Send test email to verify SMTP config |
| POST | /email/send | Auth | Send email (to, subject, text/html, replyTo) |
| GET | /email/config | Admin | Get SMTP config (password masked) |
| PUT | /email/config | Admin | Update SMTP config |
| GET | /email/logs | Admin | Paginated send log (limit/offset) |

**Tables:** `credentials` (SMTP row), `email_log`

---

### 3.12 SMS Admin

**Purpose:** Send SMS messages and check credit balance via SMSPortal. Admin-only.

**Backend Route:** `sms.ts` (`/sms`) — 4 endpoints

**Key Features:**
- Single SMS with optional `testMode`, `campaignName`, and `scheduledDelivery`
- Bulk send: up to 500 messages per request
- Balance: live query to SMSPortal prepaid balance API
- Phone normalisation: converts any SA format to E.164 (`+27XXXXXXXXX`)

**Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| POST | /sms/send | Send single SMS |
| POST | /sms/send-bulk | Send to up to 500 recipients |
| GET | /sms/balance | Query SMSPortal credit balance |
| GET | /sms/normalise/:phone | Normalise SA phone number |

**Credentials:** Reads from `credentials` table (service_name = `SMS`) — AES-256-GCM encrypted  
**Table:** `sms_log` (auto-created lazily on first send)

---

### 3.13 Two-Factor Authentication

**Purpose:** Multi-method 2FA for all platform users. Staff and admin have 2FA **mandatory**.

**Backend Route:** `twoFactor.ts` (`/auth/2fa`) — 8 endpoints

**Supported Methods:**

| Method | Description | Available to |
|--------|-------------|-------------|
| `totp` | Time-based OTP (Google Authenticator, Authy) | All users |
| `email` | 6-digit OTP via SMTP email | All users |
| `sms` | 6-digit OTP via SMSPortal | Staff + Admin only |

**Enforcement Rules:**
- Staff/admin: **mandatory** — cannot disable 2FA, can only change method
- Clients: optional — TOTP or email only (no SMS)
- SMS requires a phone number on the user profile

**Login Flow with 2FA:**
1. `POST /auth/login` — Returns `{ temp_token, requires_2fa: true, method }` if 2FA is enabled
2. `POST /auth/2fa/verify` — Accepts code + `temp_token` → returns real JWT on success
3. `POST /auth/2fa/resend` — Re-sends OTP for email/SMS methods

**Backup Codes:** 10 random hex codes, SHA-256 hashed in DB, each single-use. Shown once at setup.

**OTP Expiry:** 5 minutes for email/SMS OTPs

**Endpoints:**
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | /auth/2fa/status | requireAuth | Check 2FA status + method |
| POST | /auth/2fa/setup | requireAuth | Start setup (TOTP→QR, email/SMS→sends OTP) |
| POST | /auth/2fa/setup/verify | requireAuth | Confirm setup → enable 2FA + return backup codes |
| POST | /auth/2fa/verify | temp_token | Verify 2FA during login → issue real JWT |
| POST | /auth/2fa/resend | temp_token | Resend OTP (email/SMS only) |
| POST | /auth/2fa/disable | requireAuth | Disable 2FA (password required; blocked for staff/admin) |
| PUT | /auth/2fa/method | requireAuth | Change 2FA method (password + re-verification required) |
| POST | /auth/2fa/backup-codes | requireAuth | Regenerate backup codes (password required) |

**Table:** `user_two_factor`

---

### 3.14 My Assistant (Unified Mobile Assistant CRUD)

**Purpose:** Unified endpoint for creating and managing AI assistants for both staff and client roles. Replaces the deprecated `staffAssistant.ts` route.

**Backend Route:** `myAssistant.ts` (`/v1/mobile/my-assistant`) — 10 endpoints

**Role Differences:**

| Feature | Staff | Client |
|---------|-------|--------|
| Max assistants | 1 | Unlimited |
| is_staff_agent flag | 1 | 0 |
| Auto-primary | Always | First one only |
| core_instructions | Super-admin only (hidden from GUI) | N/A |
| Software tokens | Accessible | Not accessible |

**Editable Fields:** `name`, `description`, `personality`, `personality_flare`, `primary_goal`, `custom_greeting`, `voice_style`, `preferred_model`, `business_type`, `website`

**Protected Fields:** `core_instructions` — backend/superadmin only, never user-editable (prompt stitching guardrail)

**Software Tokens:** Staff members store per-instance tokens for the external update portal API (used by the `create_task` / `list_tasks` mobile AI tools).

**Tables:** `assistants`, `staff_software_tokens`

---

### 3.15 System Settings

**Purpose:** Key-value system settings stored in `sys_settings` table. Supports both internal config (maintenance mode, session timeouts) and public settings accessible without authentication.

**Backend Route:** `settings.ts` (`/settings`) — 7 endpoints  
**Frontend:** `SystemSettings.tsx` → Settings tab (DataTable with full CRUD)

**Setting Types:** `string`, `integer`, `float`, `boolean`, `json`

**Public Settings:** Settings with `is_public=true` are exposed at `GET /settings/public` (no auth required) as a flat `key → value` object with automatic type casting (integers as numbers, booleans as booleans, JSON as objects).

**Default Settings:**

| Key | Default | Type | Public |
|-----|---------|------|--------|
| site_name | API Application | string | false |
| site_description | A powerful REST API | string | false |
| maintenance_mode | 0 | boolean | false |
| max_login_attempts | 5 | integer | false |
| session_timeout | 3600 | integer | false |
| items_per_page | 20 | integer | true |
| updates_url | https://updates.softaware.co.za | string | false |
| software_key | 20251111SA | string | false |
| app_version | 1.0.1 | string | true |

**Table:** `sys_settings`

---

## 4. Kill Switch System

The Admin module implements a **three-tier kill switch architecture**:

### Level 1: Account Master Kill Switch
- **Location**: `ClientManager.tsx` → Account status PATCH
- **Scope**: Entire user account
- **Effect**: Blocks ALL account activity (auth, API access, services)
- **Status**: `active` | `suspended` | `demo_expired`
- **Enforcement**: Checked in `statusCheck` middleware on every request

### Level 2: Assistant Kill Switch
- **Location**: `ClientManager.tsx` → Assistant status PATCH
- **Scope**: Individual assistant only
- **Effect**: Blocks assistant chat, widget embedding, knowledge ingestion
- **Status**: `active` | `suspended` | `demo_expired`
- **Enforcement**: Checked in assistant routes before processing

### Level 3: Widget Kill Switch
- **Location**: `ClientManager.tsx` → Widget status PATCH
- **Scope**: Individual widget client only
- **Effect**: Blocks widget API access, chat, ingestion
- **Status**: `active` | `suspended` | `demo_expired` | `upgraded`
- **Enforcement**: Checked in widget routes before serving

### Level 4: Enterprise Endpoint Kill Switch
- **Location**: `EnterpriseEndpoints.tsx` → Status toggle
- **Scope**: Individual webhook endpoint
- **Effect**: Returns 503 Service Unavailable to callers
- **Status**: `active` | `paused` | `disabled`
- **Enforcement**: Checked at webhook entry point before LLM call

**Cascading Behavior:**
```
Account SUSPENDED
  └─ Blocks ALL child resources regardless of their individual status
     ├─ All assistants blocked (even if marked 'active')
     ├─ All widgets blocked (even if marked 'active')
     └─ All enterprise endpoints unaffected (separate auth system)
```

**Use Cases:**
- **Payment failure**: Suspend account → all services paused instantly
- **Policy violation**: Suspend specific assistant → others remain active
- **Demo expiration**: Set status to `demo_expired` → prompt upgrade message
- **Enterprise maintenance**: Pause endpoint → webhook returns 503 → no billing charged

---

## 5. Security & Authorization

### Authentication Flow
1. User logs in via `/api/auth/login`
2. JWT token issued with embedded user role
3. Token stored in localStorage + sent as `Authorization: Bearer <token>` header
4. Backend validates token on every request with `requireAuth` middleware
5. Admin routes additionally check role with `requireAdmin` middleware

### Admin Role Check
```typescript
// requireAdmin.ts
export function requireAdmin(req, res, next) {
  const user = (req as AuthRequest).user;
  const adminRoles = ['admin', 'super_admin'];
  
  if (!user || !adminRoles.includes(user.role?.slug)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
}
```

### Protected Routes
- **ALL** admin routes are protected with both middlewares
- Pattern: `router.use(requireAuth, requireAdmin)`
- Frontend redirects non-admins attempting to access `/admin/*` routes

### Masquerade Security
- **Admin restore token**: Separate JWT stored alongside masquerade token
- **Session isolation**: Original admin session preserved in AuthModel
- **Audit trail**: All masquerade events logged to database
- **Permission inheritance**: Masqueraded user has their actual permissions (admin doesn't gain extra privileges as user)
- **Restoration**: Single-click return to admin session without re-login

---

## 6. Data Flow Examples

### Example 1: Suspend Client Account

**Trigger**: Admin clicks "Suspend" button on client profile

```
┌──────────────┐
│ Admin UI     │ PATCH /admin/clients/12345/status
│ ClientManager│ Body: { status: "suspended" }
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────────────────┐
│ Backend: adminClientManager.ts                       │
│ 1. requireAuth → validate JWT                        │
│ 2. requireAdmin → check role in [admin, super_admin] │
│ 3. Parse & validate status with Zod                  │
│ 4. Execute: UPDATE users SET account_status =        │
│    'suspended' WHERE id = '12345'                    │
│ 5. Return success response                           │
└──────┬───────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────┐
│ Immediate Effect (statusCheck middleware)            │
│ • User's next API request hits statusCheck           │
│ • Middleware queries: SELECT account_status FROM     │
│   users WHERE id = '12345'                           │
│ • Returns 403: "Account suspended"                   │
│ • Blocks: auth endpoints, assistants, widgets, chat  │
└──────────────────────────────────────────────────────┘
```

---

### Example 2: Create Credit Package

**Trigger**: Admin submits credit package form

```
┌──────────────┐
│ Admin UI     │ POST /admin/credits/packages
│ AICredits    │ Body: {
└──────┬───────┘   name: "Starter Pack",
       │           credits: 1000,
       │           price: 9900,  // R99.00
       │           bonusCredits: 100,
       │           description: "Perfect for small teams"
       │         }
       ▼
┌──────────────────────────────────────────────────────┐
│ Backend: adminCredits.ts                             │
│ 1. Validate with CreatePackageSchema (Zod)           │
│ 2. Generate UUID for package ID                      │
│ 3. Insert into credit_packages table                 │
│ 4. Query back the created package                    │
│ 5. Return formatted response with:                   │
│    • totalCredits: 1100 (1000 + 100)                 │
│    • formattedPrice: "R99.00"                        │
│    • discountPercent: computed value                 │
└──────┬───────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────┐
│ Public API: /api/credits/packages                    │
│ • Package now appears in checkout flow               │
│ • Users can purchase via Stripe/PayFast              │
│ • On purchase success: credits added to team balance │
└──────────────────────────────────────────────────────┘
```

---

### Example 3: Masquerade as User

**Trigger**: Admin clicks "Login as User" on client profile

```
┌──────────────┐
│ Admin UI     │ POST /admin/clients/12345/masquerade
│ ClientManager│ Headers: { Authorization: Bearer <admin-token> }
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────────────────┐
│ Backend: adminClientManager.ts                       │
│ 1. Validate admin authentication                     │
│ 2. Fetch target user (id: 12345)                     │
│ 3. Generate new JWT for target user                  │
│ 4. Generate adminRestoreToken (includes admin ID)    │
│ 5. Fetch target user's permissions                   │
│ 6. Return masquerade response:                       │
│    {                                                 │
│      token: "<masquerade-jwt>",                      │
│      user: { ...targetUserData },                    │
│      adminRestoreToken: "<restore-jwt>",             │
│      adminId: "67890",                               │
│      masquerading: true                              │
│    }                                                 │
└──────┬───────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────┐
│ Frontend: AuthModel + useAppStore                    │
│ 1. AuthModel.startMasquerade() called:               │
│    • Store original admin token in memory            │
│    • Store adminRestoreToken in localStorage         │
│    • Store adminId for audit trail                   │
│ 2. Switch to masquerade token for all API calls      │
│ 3. Update app store with target user data            │
│ 4. Navigate to /dashboard (as masqueraded user)      │
│ 5. Show banner: "Viewing as [user email] | Return"  │
└──────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────┐
│ User clicks "Return to Admin"                        │
│ 1. AuthModel.endMasquerade() called                  │
│ 2. Restore original admin token from memory          │
│ 3. Clear masquerade state from localStorage          │
│ 4. Re-fetch admin user data                          │
│ 5. Navigate back to /admin/client-manager            │
└──────────────────────────────────────────────────────┘
```

---

## 7. Database Schema

### users
```sql
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  password_hash VARCHAR(255),
  account_status ENUM('active', 'suspended', 'demo_expired') DEFAULT 'active',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_status (account_status)
);
```

### assistants
```sql
CREATE TABLE assistants (
  id VARCHAR(255) PRIMARY KEY,  -- Format: assistant-{timestamp}
  userId VARCHAR(36),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status ENUM('active', 'suspended', 'demo_expired') DEFAULT 'active',
  tier ENUM('free', 'paid') DEFAULT 'free',
  pages_indexed INT DEFAULT 0,
  knowledge_categories JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_userId (userId),
  INDEX idx_status (status)
);
```

### widget_clients
```sql
CREATE TABLE widget_clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36),
  website_url VARCHAR(512),
  status ENUM('active', 'suspended', 'demo_expired', 'upgraded') DEFAULT 'active',
  subscription_tier ENUM('free', 'starter', 'pro', 'enterprise') DEFAULT 'free',
  message_count INT DEFAULT 0,
  max_messages INT DEFAULT 100,
  pages_ingested INT DEFAULT 0,
  max_pages INT DEFAULT 10,
  monthly_price DECIMAL(10,2) DEFAULT 0.00,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_active DATETIME,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status)
);
```

### credit_packages
```sql
CREATE TABLE credit_packages (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  description VARCHAR(200),
  credits INT NOT NULL,
  bonusCredits INT DEFAULT 0,
  price INT NOT NULL,  -- In cents
  featured BOOLEAN DEFAULT FALSE,
  isActive BOOLEAN DEFAULT TRUE,
  displayOrder INT DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_active (isActive),
  INDEX idx_featured (featured)
);
```

### credit_balances
```sql
CREATE TABLE credit_balances (
  id VARCHAR(36) PRIMARY KEY,
  teamId VARCHAR(36) NOT NULL UNIQUE,
  balance INT DEFAULT 0,
  totalPurchased INT DEFAULT 0,
  totalUsed INT DEFAULT 0,
  lowBalanceThreshold INT DEFAULT 100,
  lowBalanceAlertSent BOOLEAN DEFAULT FALSE,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (teamId) REFERENCES teams(id),
  INDEX idx_teamId (teamId)
);
```

### credit_transactions
```sql
CREATE TABLE credit_transactions (
  id VARCHAR(36) PRIMARY KEY,
  creditBalanceId VARCHAR(36) NOT NULL,
  amount INT NOT NULL,  -- Positive for credits added, negative for usage
  balanceAfter INT NOT NULL,
  type ENUM('PURCHASE', 'USAGE', 'ADJUSTMENT', 'BONUS') NOT NULL,
  requestType VARCHAR(50),  -- TEXT_CHAT, CODE_AGENT_EXECUTE, etc.
  description TEXT,
  paymentProvider VARCHAR(50),  -- PAYFAST, YOCO, etc.
  externalPaymentId VARCHAR(255),
  metadata JSON,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creditBalanceId) REFERENCES credit_balances(id),
  INDEX idx_creditBalanceId (creditBalanceId),
  INDEX idx_type (type),
  INDEX idx_createdAt (createdAt)
);
```

### teams
```sql
CREATE TABLE teams (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  ownerId VARCHAR(36),
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (ownerId) REFERENCES users(id),
  INDEX idx_ownerId (ownerId)
);
```

---

## 8. Configuration Files

### enterprise_endpoints.json
**Location**: `/var/opt/backend/data/enterprise_endpoints.json`

**Purpose**: Persistent storage for dynamic enterprise webhook configurations. Loaded into memory on server start, mutated via admin API, persisted on changes.

**Structure**:
```json
{
  "ep-1709400000000": {
    "id": "ep-1709400000000",
    "client_id": "acme-corp",
    "client_name": "Acme Corporation",
    "status": "active",
    "inbound_provider": "whatsapp",
    "llm_provider": "ollama",
    "llm_model": "qwen2.5-coder:32b",
    "llm_system_prompt": "You are a helpful assistant...",
    "llm_temperature": 0.3,
    "llm_max_tokens": 1024,
    "target_api_url": "https://acme.com/api/webhook",
    "target_api_auth_type": "bearer",
    "target_api_auth_value": "secret_token_here",
    "created_at": "2026-03-01T10:00:00.000Z",
    "updated_at": "2026-03-04T15:30:00.000Z",
    "total_requests": 1250
  }
}
```

**Access Pattern**:
- Loaded via `enterpriseEndpoints.ts` service on startup
- CRUD operations modify in-memory Map + persist to file
- Fast reads (no DB query), atomic writes

---

## 9. Testing & Development

### Manual Testing Checklist

#### Client Manager
- [ ] Load client overview shows all users with stats
- [ ] Search filters clients by email/name
- [ ] Click client opens detail view
- [ ] Suspend account updates status in DB
- [ ] Reactivate account restores access
- [ ] Toggle assistant status blocks/allows chat
- [ ] Toggle widget status blocks/allows embedding
- [ ] Masquerade login switches session correctly
- [ ] Return from masquerade restores admin session
- [ ] Kill switch verified with test API call

#### AI Credits
- [ ] Credit packages list loads
- [ ] Create package with validation errors handled
- [ ] Edit package updates correctly
- [ ] Delete package soft-deletes (isActive=false)
- [ ] Balance adjustments create transaction records
- [ ] Transaction history shows all types correctly
- [ ] Formatted prices display properly (R10.00)

#### Enterprise Endpoints
- [ ] Endpoint list loads with request counts
- [ ] Create endpoint generates valid webhook URL
- [ ] Update endpoint saves all fields
- [ ] Status toggle pauses/resumes instantly
- [ ] Delete endpoint removes from JSON file
- [ ] Request logs load with pagination
- [ ] Webhook URL copy-to-clipboard works

#### AI Overview
- [ ] Dashboard loads stats from multiple sources
- [ ] Charts render with real data
- [ ] Gradient cards display correctly
- [ ] Refresh button reloads data
- [ ] Dark mode styling applies

### API Testing with curl

```bash
# Login as admin
TOKEN=$(curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@softaware.net.za","password":"admin123"}' \
  | jq -r '.token')

# Get client overview
curl http://localhost:3001/api/admin/clients/overview \
  -H "Authorization: Bearer $TOKEN"

# Suspend account
curl -X PATCH http://localhost:3001/api/admin/clients/12345/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"suspended"}'

# Create credit package
curl -X POST http://localhost:3001/api/admin/credits/packages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Pack",
    "credits": 500,
    "price": 4900,
    "bonusCredits": 50
  }'

# Create enterprise endpoint
curl -X POST http://localhost:3001/api/admin/enterprise-endpoints \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "test-client",
    "client_name": "Test Client",
    "inbound_provider": "custom_rest",
    "llm_provider": "ollama",
    "llm_model": "llama2",
    "llm_system_prompt": "You are a test assistant"
  }'
```

---

## 10. Future Enhancements

### Planned Features
1. **Analytics Dashboard**: Deep-dive metrics with time-series charts
2. **Automated Alerts**: Email notifications for credit depletion, endpoint failures
3. **Bulk Operations**: Multi-select suspend/reactivate clients
4. **Role-Based Dashboard Views**: Customized stats per admin role
5. **Audit Log Viewer**: Full history of admin actions
6. **Credit Usage Forecasting**: Predict when teams will run out of credits
7. **Enterprise Endpoint Testing**: In-UI webhook test tool
8. **Real-time Monitoring**: WebSocket updates for live statistics
9. **Export Capabilities**: CSV export for transactions, logs, clients
10. **Advanced Filtering**: Date ranges, multi-status filters, saved filters

### Technical Debt
- Move enterprise endpoints from JSON file to MySQL
- Implement database-driven pricing configuration
- Add Redis caching for frequently accessed stats
- Optimize SQL queries with better indexes
- Implement rate limiting per admin user
- Add comprehensive error boundary components
- Improve TypeScript type coverage (eliminate `any` types)

---

## 11. Related Documentation

- [Assistants Module](../Assistants/README.md) — Client-facing AI assistant management
- [Authentication Module](../Authentication/README.md) — JWT auth & role system
- [Credits System](../Credits/README.md) — Detailed credit architecture (if exists)
- [Database Schema](../Database/README.md) — Full schema documentation
- [API Reference](../API/README.md) — Complete endpoint documentation

---

## 12. Support & Contact

For questions about the Admin module:
- **Technical Lead**: Development Team
- **Product Owner**: Platform Management
- **Security Concerns**: security@softaware.net.za
- **Documentation Issues**: Open GitHub issue or PR

---

**Document Status**: ✅ Complete  
**Review Cycle**: Quarterly  
**Next Review**: 2026-06-04
