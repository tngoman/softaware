# SoftAware Platform — API Documentation

> **Version 3.1** · Last updated: March 2026
> Base URL: `https://api.softaware.net.za` or `https://api.softaware.net.za/api`

---

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Authentication](#authentication)
4. [Users, Roles & Permissions](#users-roles--permissions)
5. [API Endpoints](#api-endpoints)
   - [Auth](#auth)
   - [Profile](#profile)
   - [Dashboard](#dashboard)
   - [Contacts](#contacts)
   - [Quotations](#quotations)
   - [Invoices](#invoices)
   - [Payments](#payments)
   - [Accounting](#accounting)
   - [Pricing (Products)](#pricing-products)
   - [Categories](#categories)
   - [Expense Categories](#expense-categories)
   - [Financial Reports](#financial-reports)
   - [Reports](#reports)
   - [VAT Reports](#vat-reports)
   - [Software Management](#software-management)
   - [Softaware Tasks](#softaware-tasks)
   - [Updates System](#updates-system)
   - [Groups & Chat](#groups--chat)
   - [Notifications](#notifications)
   - [App Settings](#app-settings)
   - [Settings (Key-Value)](#settings-key-value)
   - [Subscriptions](#subscriptions)
   - [Credits](#credits)
   - [AI Services](#ai-services)
   - [Team Management](#team-management)
   - [System: Users](#system-users)
   - [System: Roles](#system-roles)
   - [System: Permissions](#system-permissions)
   - [System: Credentials](#system-credentials)
   - [Database Manager](#database-manager)
   - [Admin Dashboard](#admin-dashboard)
   - [Admin Operations](#admin-operations)
6. [Mobile App Integration Guide](#mobile-app-integration-guide)
7. [Error Handling](#error-handling)
8. [Rate Limits & Quotas](#rate-limits--quotas)
9. [Security Best Practices](#security-best-practices)
10. [Changelog](#changelog)
11. [Support](#support)

---

## Overview

The SoftAware Platform API provides a unified backend for:

- **Authentication & Authorization** — JWT-based auth with role-based access control (RBAC), team membership, and granular permissions.
- **Business & Billing** — Contacts, quotations, invoices, payments, accounting ledger, products/pricing, expense tracking.
- **Financial Reports** — Balance sheet, profit & loss, trial balance, VAT reports (South African tax forms: VAT201, ITR14, IRP6).
- **Software Management** — Registry of software products, module tracking, developer assignments.
- **Task Management** — Proxy to external software task APIs with per-software authentication.
- **Updates & Distribution** — Upload, version, and distribute software updates with client heartbeat monitoring and remote control.
- **Groups & Messaging** — Real-time group chat with message history.
- **AI Services** — Credit-based AI chat and prompt completions via multiple providers.
- **System Administration** — User management, role/permission CRUD, credential vault, database manager.
- **Subscriptions & Credits** — Plan management, credit purchase, usage tracking.
- **Notifications** — In-app notification system with read/unread tracking.
- **App Settings** — Global branding and configuration (logo, app name, company details).

All endpoints are available at both the root path (`/endpoint`) and under the `/api` prefix (`/api/endpoint`).

---

## Getting Started

### 1. Register an Account

```bash
curl -X POST https://api.softaware.net.za/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "you@example.com",
    "password": "securePassword123",
    "name": "Your Name"
  }'
```

Registration automatically creates a **team** with you as the **ADMIN**, and a personal subscription.

### 2. Login

```bash
curl -X POST https://api.softaware.net.za/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "you@example.com",
    "password": "securePassword123",
    "rememberMe": true
  }'
```

The response contains a JWT `token` and a full `user` object with role and permissions.

### 3. Make Authenticated Requests

Include the JWT token in every request:

```bash
curl https://api.softaware.net.za/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 4. (Optional) Create an API Key

For server-to-server integrations, generate an API key via the dashboard or profile endpoints and pass it as:

```
X-API-Key: sk_live_abc123...
```

---

## Authentication

### Authentication Methods

| Method | Header | Use Case |
|--------|--------|----------|
| **JWT Bearer Token** | `Authorization: Bearer <token>` | Web & mobile apps, user-facing sessions |
| **API Key** | `X-API-Key: <key>` | Server-to-server, scripts, CI/CD |

### JWT Token Details

| Property | Value |
|----------|-------|
| Payload | `{ userId: string }` |
| Algorithm | HS256 |
| Default Expiry | 1 hour |
| Remember Me Expiry | 30 days |
| Signed With | `JWT_SECRET` (server env) |

### Token Lifecycle

1. **Obtain** — `POST /auth/login` or `POST /auth/register` returns `{ token, user }`
2. **Use** — Send `Authorization: Bearer <token>` on every request
3. **Refresh** — `POST /auth/refresh` with current token returns a new token
4. **Validate** — `GET /auth/validate` returns `{ valid: true/false }`
5. **Expire** — After 1h (or 30d with `rememberMe`), the token becomes invalid
6. **Logout** — `POST /auth/logout` (client-side: discard the token)

---

## Users, Roles & Permissions

Understanding the user model is critical for mobile app development. The system uses **role-based resolution via `user_roles`** — there is no `is_admin` column in the database. These flags are computed at login time from the user's assigned role.

### User Identity Model

When you log in or call `GET /auth/me`, you receive the **canonical user object**:

```json
{
  "id": "uuid-string",
  "email": "user@example.com",
  "name": "John Doe",
  "phone": "+27123456789",
  "avatar": "https://...",
  "is_admin": true,
  "is_staff": false,
  "is_active": true,
  "role": {
    "id": 1,
    "name": "Administrator",
    "slug": "admin"
  },
  "permissions": [
    { "id": 1, "name": "View Dashboard", "slug": "view_dashboard" },
    { "id": 2, "name": "Manage Users", "slug": "manage_users" }
  ]
}
```

> **Note:** The `team` field is **no longer returned** in the user object. Teams/team_members are legacy tables retained only for credit balance scoping.

### How `is_admin` and `is_staff` Are Determined

These are **NOT** stored in the `users` table. They are derived from the `user_roles` → `roles` table at login:

| Field | Condition |
|-------|-----------|
| `is_admin` | User's role slug is `admin` or `super_admin` |
| `is_staff` | User's role slug is one of: `developer`, `client_manager`, `qa_specialist`, `deployer` |

Users with **neither** flag are treated as **regular users** (clients).

### The Three User Types

The platform has **three distinct user types** that determine what the user sees and can do:

| User Type | `is_admin` | `is_staff` | How Assigned | Description |
|-----------|------------|------------|--------------|-------------|
| **Admin** | `true` | `false` | Role slug: `admin` or `super_admin` | Full platform access. Can manage all resources, all users, all settings, database, credentials, and masquerade as any client. |
| **Staff** | `false` | `true` | Role slug: `developer`, `client_manager`, `qa_specialist`, or `deployer` | Functionally equivalent to Admin for permission checks. All permission checks auto-pass. Can access all admin screens. |
| **Regular User** | `false` | `false` | Role slug: `viewer`, `manager`, `accountant`, `sales`, `support`, or any other non-admin/staff slug | Access is controlled by granular permissions assigned to their role. Cannot access admin screens. Sees the **Portal** experience after login. |

> **Key insight:** Admin and Staff are **functionally equivalent** — both bypass all permission checks and see the same admin screens. The distinction exists for organizational clarity (e.g., "Staff" may be developers on your team, while "Admin" is the account owner).

### What Each User Type Sees After Login

#### Admin / Staff Experience

```
Login → Admin Dashboard (full business metrics)
├── Dashboard ............. Business KPIs, revenue, invoices, contacts overview
├── Contacts .............. Full CRUD on all contacts
├── Quotations ............ Create, edit, send, PDF quotations
├── Invoices .............. Create, edit, send, PDF invoices
├── Payments .............. Record and manage payments
├── Financial Dashboard ... Revenue, expenses, cash flow charts
├── Reports
│   ├── Balance Sheet
│   ├── Profit & Loss
│   ├── Transaction Listing
│   └── VAT Reports (VAT201, ITR14, IRP6)
├── Transactions .......... Income & expense ledger
├── Pricing ............... Product/service catalog
├── Categories ............ Income/expense categories
├── Software Management ... Software registry & modules
├── Tasks ................. Kanban/list task management
├── Updates ............... Software update distribution
├── Groups ................ Group messaging / chat
├── Notifications ......... In-app notification center
├── Settings .............. Company info, SMTP, branding, tax
├── Profile ............... Personal profile, password, 2FA, API keys
│
├── 🔒 ADMIN-ONLY SCREENS
│   ├── Admin Dashboard ... AI stats, client overview, endpoint configs
│   ├── Client Manager .... View all clients, status management, masquerade
│   ├── AI Overview ....... Enterprise AI endpoint management
│   ├── AI Credits ........ Credit packages, balance adjustments
│   ├── Database Manager .. SQL console, table browser
│   ├── Credentials ....... Secure credential vault (API keys, passwords)
│   └── Enterprise Endpoints  LLM endpoint CRUD & logs
│
└── 🔒 SYSTEM SCREENS (admin/staff)
    ├── Users ............. User CRUD, role assignment
    ├── Roles ............. Role CRUD, permission assignment
    ├── Permissions ....... View all system permissions
    └── System Settings ... Advanced key-value configuration
```

#### Regular User (Client) Experience

```
Login → Portal Dashboard (AI-focused, personal metrics)
├── Portal Dashboard ...... AI usage stats, assistant overview, quick actions
├── Assistants ............ Create/manage AI assistants, embed widgets
│   ├── Create Assistant
│   ├── Edit Assistant
│   └── Chat Interface .... Full chat UI with assistant
├── Sites ................. AI-generated websites
│   ├── Create Site
│   └── Edit Site
├── Portal Settings ....... Account, notifications, security, billing
├── Notifications ......... In-app notification center
├── Profile ............... Personal profile, password, 2FA
│
├── 📋 PERMISSION-GATED SCREENS (only visible if role grants permission)
│   ├── Financial Dashboard  (requires: view_dashboard)
│   ├── Contacts .......... (requires: view_contacts)
│   ├── Quotations ........ (requires: view_quotations)
│   ├── Invoices .......... (requires: view_invoices)
│   ├── Transactions ...... (always visible)
│   ├── Pricing ........... (requires: view_settings)
│   ├── Categories ........ (requires: view_settings)
│   ├── Reports ........... (requires: view_reports)
│   ├── VAT Reports ....... (always visible)
│   ├── Settings .......... (requires: view_settings)
│   ├── Software .......... (always visible)
│   ├── Tasks ............. (always visible)
│   ├── Updates ........... (requires: view_updates)
│   └── Groups ............ (always visible)
│
└── ❌ CANNOT ACCESS
    ├── Admin Dashboard
    ├── Client Manager
    ├── Database Manager
    ├── Credentials
    ├── AI Overview / Credits
    ├── Enterprise Endpoints
    ├── System Users / Roles / Permissions
    └── System Settings
```

### Screen Access Matrix

Quick reference showing exactly which screens each user type can access:

| Screen | Route | Admin | Staff | Regular User |
|--------|-------|:-----:|:-----:|:------------:|
| **PUBLIC (no login required)** | | | | |
| Login | `/login` | ✅ | ✅ | ✅ |
| Register | `/register` | ✅ | ✅ | ✅ |
| Forgot Password | `/forgot-password` | ✅ | ✅ | ✅ |
| Landing Page | `/landing` | ✅ | ✅ | ✅ |
| Activate Account | `/activate` | ✅ | ✅ | ✅ |
| **PORTAL (regular user default)** | | | | |
| Portal Dashboard | `/portal` | ✅ | ✅ | ✅ |
| Assistants | `/portal/assistants` | ✅ | ✅ | ✅ |
| Create Assistant | `/portal/assistants/new` | ✅ | ✅ | ✅ |
| Chat Interface | `/portal/assistants/:id/chat` | ✅ | ✅ | ✅ |
| Sites | `/portal/sites` | ✅ | ✅ | ✅ |
| Site Builder | `/portal/sites/new` | ✅ | ✅ | ✅ |
| Portal Settings | `/portal/settings` | ✅ | ✅ | ✅ |
| **BUSINESS SCREENS** | | | | |
| Dashboard | `/dashboard` | ✅ (admin view) | ✅ (admin view) | ✅ (portal view) |
| Financial Dashboard | `/financial-dashboard` | ✅ | ✅ | 🔑 `view_dashboard` |
| Contacts | `/contacts` | ✅ | ✅ | 🔑 `view_contacts` |
| Quotations | `/quotations` | ✅ | ✅ | 🔑 `view_quotations` |
| Invoices | `/invoices` | ✅ | ✅ | 🔑 `view_invoices` |
| Transactions | `/transactions` | ✅ | ✅ | ✅ |
| Add Expense | `/add-expense` | ✅ | ✅ | ✅ |
| Add Income | `/add-income` | ✅ | ✅ | ✅ |
| Pricing | `/pricing` | ✅ | ✅ | 🔑 `view_settings` |
| Categories | `/categories` | ✅ | ✅ | 🔑 `view_settings` |
| Settings | `/settings` | ✅ | ✅ | 🔑 `view_settings` |
| Balance Sheet | `/reports/balance-sheet` | ✅ | ✅ | 🔑 `view_reports` |
| Profit & Loss | `/reports/profit-loss` | ✅ | ✅ | 🔑 `view_reports` |
| Transaction Listing | `/reports/transaction-listing` | ✅ | ✅ | ✅ |
| VAT Reports | `/vat-reports` | ✅ | ✅ | ✅ |
| Software Management | `/software` | ✅ | ✅ | ✅ |
| Tasks | `/tasks` | ✅ | ✅ | ✅ |
| Updates | `/updates` | ✅ | ✅ | 🔑 `view_updates` |
| Groups / Chat | `/groups` | ✅ | ✅ | ✅ |
| Notifications | `/notifications` | ✅ | ✅ | ✅ |
| Profile | `/profile` | ✅ | ✅ | ✅ |
| Account Settings | `/account-settings` | ✅ | ✅ | ✅ |
| **ADMIN-ONLY SCREENS** | | | | |
| Admin Dashboard | `/admin/dashboard` | ✅ | ✅ | ❌ |
| Client Manager | `/admin/clients` | ✅ | ✅ | ❌ |
| AI Overview | `/admin/ai-overview` | ✅ | ✅ | ❌ |
| AI Credits | `/admin/ai-credits` | ✅ | ✅ | ❌ |
| Enterprise Endpoints | `/admin/enterprise-endpoints` | ✅ | ✅ | ❌ |
| Database Manager | `/admin/database` | ✅ | ✅ | ❌ |
| Credentials | `/credentials` | ✅ | ✅ | ❌ |
| Create Credential | `/credentials/new` | ✅ | ✅ | ❌ |
| **SYSTEM SCREENS** | | | | |
| System Users | `/system/users` | ✅ | ✅ | 🔑 `view_users` |
| System Roles | `/system/roles` | ✅ | ✅ | 🔑 `view_roles` |
| System Permissions | `/system/permissions` | ✅ | ✅ | 🔑 `view_permissions` |
| System Settings | `/system/settings` | ✅ | ✅ | 🔑 `manage_settings` |

**Legend:** ✅ = Always accessible · 🔑 = Requires specific permission · ❌ = Blocked (redirected)

### Permission Resolution

The backend resolves permissions as follows:

1. If the user's role slug is `admin` or `super_admin` → they receive a **wildcard (`*`)** — all permissions granted (`is_admin = true`).
2. If the user's role slug is `developer`, `client_manager`, `qa_specialist`, or `deployer` → wildcard (`is_staff = true`).
3. Otherwise → permissions are resolved from the `role_permissions` junction table for the user's assigned role.

### System Roles (Pre-seeded)

| ID | Name | Slug | User Type | `is_admin` | `is_staff` |
|----|------|------|-----------|:----------:|:----------:|
| 1 | Administrator | `admin` | **Admin** | ✅ | ❌ |
| 2 | Manager | `manager` | Regular User | ❌ | ❌ |
| 3 | Accountant | `accountant` | Regular User | ❌ | ❌ |
| 4 | Sales | `sales` | Regular User | ❌ | ❌ |
| 5 | Support | `support` | Regular User | ❌ | ❌ |
| 6 | Developer | `developer` | **Staff** | ❌ | ✅ |
| 7 | Viewer | `viewer` | Regular User | ❌ | ❌ |

> **New users** created via `POST /auth/register` are automatically assigned the `viewer` role (Regular User). Admins can change a user's role via the System Users screen or `PUT /system/users/:id`.

### Available Permissions (38 total)

| Group | Permissions |
|-------|------------|
| **Dashboard** | `view_dashboard`, `view_admin_dashboard` |
| **Contacts** | `view_contacts`, `create_contacts`, `edit_contacts`, `delete_contacts` |
| **Quotations** | `view_quotations`, `create_quotations`, `edit_quotations`, `delete_quotations` |
| **Invoices** | `view_invoices`, `create_invoices`, `edit_invoices`, `delete_invoices` |
| **Payments** | `view_payments`, `create_payments`, `edit_payments`, `delete_payments` |
| **Accounting** | `view_accounting`, `manage_accounting` |
| **Reports** | `view_reports`, `export_reports` |
| **Software** | `view_software`, `manage_software` |
| **Tasks** | `view_tasks`, `manage_tasks` |
| **Updates** | `view_updates`, `manage_updates` |
| **Groups** | `view_groups`, `manage_groups` |
| **Settings** | `view_settings`, `manage_settings` |
| **Users** | `view_users`, `manage_users` |
| **Roles** | `view_roles`, `manage_roles` |
| **Permissions** | `view_permissions`, `manage_permissions` |
| **Credentials** | `view_credentials`, `manage_credentials` |

### Mobile App Permission Checks

On the mobile app, after login, store the user object and use these helpers to control navigation and UI:

```javascript
// Determine user type
function getUserType(user) {
  if (user.is_admin) return 'admin';
  if (user.is_staff) return 'staff';
  return 'user';
}

// Check if user is admin or staff (both have full access)
function isAdminOrStaff(user) {
  return user.is_admin || user.is_staff;
}

// Check if user has a specific permission
function hasPermission(user, slug) {
  if (user.is_admin || user.is_staff) return true; // bypass — full access
  return user.permissions.some(p => p.slug === slug);
}

// Check multiple permissions (any match)
function hasAnyPermission(user, slugs) {
  if (user.is_admin || user.is_staff) return true;
  return slugs.some(slug => user.permissions.some(p => p.slug === slug));
}

// Usage — control screen visibility
if (hasPermission(currentUser, 'view_invoices')) {
  // Show invoices screen in navigation
}

// Usage — admin-only screens
if (isAdminOrStaff(currentUser)) {
  // Show admin dashboard, client manager, database manager, etc.
}

// Usage — conditional rendering within a screen
if (hasPermission(currentUser, 'create_invoices')) {
  // Show "New Invoice" button
}
```

### Mobile App — Role-Based Navigation Builder

```javascript
// Build the navigation menu dynamically based on user type
function buildNavigation(user) {
  const nav = [];
  const type = getUserType(user);

  // === ALWAYS VISIBLE (all authenticated users) ===
  nav.push({ name: 'Notifications', icon: 'bell', route: '/notifications' });
  nav.push({ name: 'Profile', icon: 'user', route: '/profile' });

  if (type === 'admin' || type === 'staff') {
    // === ADMIN / STAFF NAVIGATION ===
    nav.push({ name: 'Dashboard', icon: 'chart-bar', route: '/dashboard' });
    nav.push({ name: 'Contacts', icon: 'users', route: '/contacts' });
    nav.push({ name: 'Quotations', icon: 'file-text', route: '/quotations' });
    nav.push({ name: 'Invoices', icon: 'file-invoice', route: '/invoices' });
    nav.push({ name: 'Transactions', icon: 'receipt', route: '/transactions' });
    nav.push({ name: 'Financial Dashboard', icon: 'chart-pie', route: '/financial-dashboard' });
    nav.push({ name: 'Reports', icon: 'chart-line', route: '/reports' });
    nav.push({ name: 'Settings', icon: 'cog', route: '/settings' });
    nav.push({ name: 'Software', icon: 'code', route: '/software' });
    nav.push({ name: 'Tasks', icon: 'tasks', route: '/tasks' });
    nav.push({ name: 'Groups', icon: 'comments', route: '/groups' });

    // Admin-only section
    nav.push({ section: 'Administration' });
    nav.push({ name: 'Admin Dashboard', icon: 'shield', route: '/admin/dashboard' });
    nav.push({ name: 'Client Manager', icon: 'user-shield', route: '/admin/clients' });
    nav.push({ name: 'AI Overview', icon: 'brain', route: '/admin/ai-overview' });
    nav.push({ name: 'AI Credits', icon: 'coins', route: '/admin/ai-credits' });
    nav.push({ name: 'Database', icon: 'database', route: '/admin/database' });
    nav.push({ name: 'Credentials', icon: 'key', route: '/credentials' });

    // System section
    nav.push({ section: 'System' });
    nav.push({ name: 'Users', icon: 'users-cog', route: '/system/users' });
    nav.push({ name: 'Roles', icon: 'user-tag', route: '/system/roles' });
    nav.push({ name: 'Permissions', icon: 'lock', route: '/system/permissions' });
  } else {
    // === REGULAR USER (CLIENT) NAVIGATION ===
    nav.push({ name: 'Portal', icon: 'home', route: '/portal' });
    nav.push({ name: 'Assistants', icon: 'robot', route: '/portal/assistants' });
    nav.push({ name: 'Sites', icon: 'globe', route: '/portal/sites' });
    nav.push({ name: 'Portal Settings', icon: 'cog', route: '/portal/settings' });

    // Permission-gated business screens
    if (hasPermission(user, 'view_dashboard'))
      nav.push({ name: 'Financial Dashboard', icon: 'chart-pie', route: '/financial-dashboard' });
    if (hasPermission(user, 'view_contacts'))
      nav.push({ name: 'Contacts', icon: 'users', route: '/contacts' });
    if (hasPermission(user, 'view_quotations'))
      nav.push({ name: 'Quotations', icon: 'file-text', route: '/quotations' });
    if (hasPermission(user, 'view_invoices'))
      nav.push({ name: 'Invoices', icon: 'file-invoice', route: '/invoices' });
    if (hasPermission(user, 'view_reports'))
      nav.push({ name: 'Reports', icon: 'chart-line', route: '/reports' });
    if (hasPermission(user, 'view_settings'))
      nav.push({ name: 'Settings', icon: 'cog', route: '/settings' });

    // Always visible for regular users
    nav.push({ name: 'Transactions', icon: 'receipt', route: '/transactions' });
    nav.push({ name: 'Groups', icon: 'comments', route: '/groups' });
  }

  return nav;
}
```

---

## API Endpoints

### Auth

All auth endpoints are **public** (no token required) unless noted.

---

#### `POST /auth/register`

Create a new account. Assigns the `viewer` role (Regular User) by default. A legacy team record is created for credit balance scoping.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe"
}
```

**Response:** `201 Created`
```json
{
  "accessToken": "eyJhbGciOi...",
  "user": { /* canonical user object — see above */ },
  "activationKey": "USER-A3F1B2C8D4E5F6A7"
}
```

> **Mobile note:** New registrations always receive `is_admin: false`, `is_staff: false`, and role `viewer`. They will see the **Portal** experience (assistants, sites, chat). An admin must upgrade their role for them to access business or admin screens.

**Errors:**
- `400` — Missing fields, invalid email, or email already registered

---

#### `POST /auth/login`

Authenticate and receive a JWT token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "rememberMe": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User email |
| `password` | string | Yes | User password |
| `rememberMe` | boolean | No | If `true`, token expires in 30 days instead of 1 hour |

**Response:** `200 OK`
```json
{
  "token": "eyJhbGciOi...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "phone": null,
    "avatar": null,
    "is_admin": true,
    "is_staff": false,
    "is_active": true,
    "role": { "id": 1, "name": "Administrator", "slug": "admin" },
    "permissions": [
      { "id": 1, "name": "View Dashboard", "slug": "view_dashboard" }
    ]
  }
}
```

> **Mobile note:** Check `is_admin` or `is_staff` to determine which navigation stack to show. See [The Three User Types](#the-three-user-types) for details.

**Response when 2FA is enabled:** `200 OK`
```json
{
  "success": true,
  "requires_2fa": true,
  "temp_token": "eyJhbGciOi...(short-lived, 5-minute expiry)",
  "message": "Two-factor authentication required."
}
```

> **Mobile note:** When `requires_2fa` is `true`, navigate to a 2FA code entry screen. Submit the code via `POST /auth/2fa/verify` with the `temp_token`. See the [Two-Factor Authentication](#two-factor-authentication-2fa) section for details.

**Errors:**
- `401` — Invalid email or password

---

#### `POST /auth/refresh`

🔒 **Authenticated.** Exchange a valid (non-expired) token for a fresh one.

**Response:** `200 OK`
```json
{
  "token": "eyJhbGciOi...(new token)"
}
```

---

#### `GET /auth/me`

🔒 **Authenticated.** Returns the full canonical user object for the currently authenticated user.

**Response:** `200 OK`
```json
{
  "user": { /* canonical user object */ }
}
```

---

#### `GET /auth/validate`

🔒 **Authenticated.** Check whether the current token is valid.

**Response:** `200 OK`
```json
{
  "valid": true
}
```

---

#### `POST /auth/logout`

🔒 **Authenticated.** Logout (primarily for server-side session cleanup if applicable).

**Response:** `200 OK`
```json
{
  "message": "Logged out successfully"
}
```

> **Mobile note:** Always discard the stored token on logout regardless of this endpoint's response.

---

### Two-Factor Authentication (2FA)

Optional TOTP-based two-factor authentication. Compatible with Google Authenticator, Authy, Microsoft Authenticator, and any TOTP app. 2FA is **user-enabled** — it only activates when the user explicitly sets it up.

---

#### `GET /auth/2fa/status`

🔒 **Authenticated.** Check whether 2FA is enabled for the current user.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "is_enabled": false,
    "has_setup": false
  }
}
```

---

#### `POST /auth/2fa/setup`

🔒 **Authenticated.** Generate a TOTP secret and QR code for authenticator app setup. Does **not** enable 2FA — the user must verify with `/auth/2fa/verify-setup` first.

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Scan the QR code with your authenticator app, then verify with a code.",
  "data": {
    "secret": "CXQSX365M5CM63IENVNR7GM2ANRBQH34",
    "qr_code": "data:image/png;base64,iVBORw0KGgoAAAAN...",
    "otpauth_url": "otpauth://totp/SoftAware:user%40example.com?issuer=SoftAware&secret=CXQSX365M5CM63IENVNR7GM2ANRBQH34&algorithm=SHA1&digits=6&period=30"
  }
}
```

**Mobile Integration:**
- Display the `qr_code` as an image for scanning from another device
- On the **same** mobile device, use the `otpauth_url` to deep-link into the authenticator app
- Show the `secret` as a manual-entry fallback

---

#### `POST /auth/2fa/verify-setup`

🔒 **Authenticated.** Confirm TOTP setup by providing a valid 6-digit code from the authenticator app. On success, 2FA is enabled and 10 one-time backup codes are returned.

**Request Body:**
```json
{
  "code": "482901"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Two-factor authentication enabled successfully.",
  "data": {
    "backup_codes": [
      "A3F1B2C8", "D4E5F6A7", "B8C9D0E1", "F2A3B4C5", "D6E7F8A9",
      "B0C1D2E3", "F4A5B6C7", "D8E9F0A1", "B2C3D4E5", "F6A7B8C9"
    ]
  }
}
```

> ⚠️ **Critical:** Backup codes are shown **only once**. The mobile app must display them prominently and instruct the user to save them securely. Each backup code can be used exactly once as a substitute for a TOTP code.

---

#### `POST /auth/2fa/verify`

🔓 **No auth required** (uses `temp_token` from login response). Complete a login when 2FA is enabled by providing the temporary token and a TOTP code or backup code.

**Request Body:**
```json
{
  "temp_token": "eyJhbGciOiJIUzI1NiIs...",
  "code": "482901"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Login successful. Two-factor verification passed.",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": { /* full user object */ },
    "used_backup_code": false,
    "remaining_backup_codes": 10
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { /* full user object */ }
}
```

When a backup code is used:
```json
{
  "message": "Login successful. Backup code used. 9 remaining.",
  "data": {
    "used_backup_code": true,
    "remaining_backup_codes": 9
  }
}
```

> **Important:** The `temp_token` expires in **5 minutes**. If it expires, the user must log in again.

---

#### `POST /auth/2fa/disable`

🔒 **Authenticated.** Disable 2FA. Requires password confirmation.

**Request Body:**
```json
{
  "password": "currentPassword123"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Two-factor authentication has been disabled."
}
```

---

#### `POST /auth/2fa/backup-codes`

🔒 **Authenticated.** Regenerate backup codes. Previous codes become invalid. Requires password confirmation.

**Request Body:**
```json
{
  "password": "currentPassword123"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "New backup codes generated. Previous codes are now invalid.",
  "data": {
    "backup_codes": ["A3F1B2C8", "D4E5F6A7", "..."]
  }
}
```

---

#### 2FA Login Flow Diagram

```
POST /auth/login { email, password }
    │
    ├─ 2FA NOT enabled → Normal response (token + user)
    │
    └─ 2FA IS enabled → { requires_2fa: true, temp_token: "..." }
                           │
                           └─ POST /auth/2fa/verify { temp_token, code }
                                │
                                ├─ Valid TOTP code → Full login response (token + user)
                                └─ Valid backup code → Full login response + warning
```

---

### Profile

🔒 All profile endpoints require authentication.

---

#### `GET /profile`

Get the current user's profile.

**Response:** `200 OK`
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "phone": "+27123456789",
    "avatarUrl": null,
    "createdAt": "2025-01-15T10:30:00.000Z"
  }
}
```

---

#### `PUT /profile`

Update the current user's profile.

**Request:**
```json
{
  "name": "John Updated",
  "phone": "+27987654321"
}
```

**Response:** `200 OK`
```json
{
  "user": { /* updated profile */ }
}
```

---

#### `PUT /profile/change-password`

Change the current user's password.

**Request:**
```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newSecurePassword456"
}
```

**Response:** `200 OK`
```json
{
  "message": "Password updated successfully"
}
```

**Errors:**
- `401` — Current password incorrect

---

#### `GET /profile/team`

Get the current user's team details.

**Response:** `200 OK`
```json
{
  "team": {
    "id": "team-uuid",
    "name": "My Team",
    "role": "ADMIN",
    "members": [
      { "id": "member-uuid", "userId": "user-uuid", "email": "...", "name": "...", "role": "ADMIN" }
    ]
  }
}
```

---

#### `GET /profile/api-keys`

Get the current user's API keys.

**Response:** `200 OK`
```json
{
  "apiKeys": [
    {
      "id": "key-uuid",
      "name": "My API Key",
      "key": "sk_live_abc...",
      "lastUsed": "2025-06-01T...",
      "createdAt": "2025-01-15T..."
    }
  ]
}
```

---

#### `GET /profile/invoices`

Get the current user's billing invoices.

**Response:** `200 OK`
```json
{
  "invoices": [
    {
      "id": "inv-uuid",
      "amount": 50000,
      "currency": "ZAR",
      "status": "paid",
      "date": "2025-06-01T..."
    }
  ]
}
```

---

### Dashboard

🔒 **Authenticated.**

---

#### `GET /dashboard`

Returns the user's dashboard data with billing metrics.

**Response:** `200 OK`
```json
{
  "metrics": {
    "totalContacts": 45,
    "totalQuotations": 23,
    "totalInvoices": 67,
    "totalPayments": 52,
    "overdueInvoices": 3,
    "recentActivity": []
  },
  "billing": {
    "totalRevenue": 150000,
    "totalExpenses": 85000,
    "outstandingAmount": 25000,
    "monthlyRevenue": []
  }
}
```

---

### Contacts

🔒 All contacts endpoints require authentication.

---

#### `GET /contacts`

List all contacts with optional pagination.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 10 | Items per page |
| `search` | string | — | Search by name or email |

**Response:** `200 OK`
```json
{
  "contacts": [
    {
      "id": 1,
      "name": "Acme Corp",
      "email": "info@acme.com",
      "phone": "+27111234567",
      "address": "123 Main St",
      "city": "Johannesburg",
      "postal_code": "2000",
      "country": "South Africa",
      "vat_number": "4123456789",
      "created_at": "2025-01-15T..."
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "pages": 5
  }
}
```

---

#### `GET /contacts/:id`

Get a single contact.

**Response:** `200 OK`
```json
{
  "contact": { /* contact object */ }
}
```

---

#### `POST /contacts`

Create a new contact.

**Request:**
```json
{
  "name": "New Client",
  "email": "client@example.com",
  "phone": "+27111234567",
  "address": "456 Oak Ave",
  "city": "Cape Town",
  "postal_code": "8001",
  "country": "South Africa",
  "vat_number": "4987654321"
}
```

**Response:** `201 Created`
```json
{
  "contact": { /* created contact */ }
}
```

---

#### `PUT /contacts/:id`

Update a contact.

**Request:** Any of the contact fields to update.

**Response:** `200 OK`
```json
{
  "contact": { /* updated contact */ }
}
```

---

#### `DELETE /contacts/:id`

Delete a contact.

**Response:** `200 OK`
```json
{
  "message": "Contact deleted successfully"
}
```

---

#### `GET /contacts/:id/quotations`

Get all quotations for a specific contact.

**Response:** `200 OK`
```json
{
  "quotations": [ /* array of quotation objects */ ]
}
```

---

#### `GET /contacts/:id/invoices`

Get all invoices for a specific contact.

**Response:** `200 OK`
```json
{
  "invoices": [ /* array of invoice objects */ ]
}
```

---

### Quotations

🔒 All quotations endpoints require authentication.

---

#### `GET /quotations`

List all quotations with optional pagination.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 10 | Items per page |
| `status` | string | — | Filter: `draft`, `sent`, `accepted`, `declined` |
| `contact_id` | number | — | Filter by contact |

**Response:** `200 OK`
```json
{
  "quotations": [
    {
      "id": 1,
      "quotation_number": "QUO-0001",
      "contact_id": 1,
      "contact_name": "Acme Corp",
      "date": "2025-06-01",
      "due_date": "2025-06-30",
      "status": "draft",
      "subtotal": 10000,
      "vat_amount": 1500,
      "total": 11500,
      "notes": "Optional notes",
      "created_at": "2025-06-01T..."
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 23, "pages": 3 }
}
```

---

#### `GET /quotations/:id`

Get a single quotation with its line items.

**Response:** `200 OK`
```json
{
  "quotation": {
    "id": 1,
    "quotation_number": "QUO-0001",
    "contact_id": 1,
    "contact_name": "Acme Corp",
    "date": "2025-06-01",
    "due_date": "2025-06-30",
    "status": "draft",
    "subtotal": 10000,
    "vat_amount": 1500,
    "total": 11500,
    "notes": "",
    "items": [
      {
        "id": 1,
        "description": "Web Development",
        "quantity": 10,
        "unit_price": 1000,
        "amount": 10000,
        "vat_rate": 15
      }
    ]
  }
}
```

---

#### `POST /quotations`

Create a new quotation with line items.

**Request:**
```json
{
  "contact_id": 1,
  "date": "2025-06-01",
  "due_date": "2025-06-30",
  "status": "draft",
  "notes": "Terms and conditions apply",
  "items": [
    {
      "description": "Web Development",
      "quantity": 10,
      "unit_price": 1000,
      "vat_rate": 15
    }
  ]
}
```

**Response:** `201 Created`
```json
{
  "quotation": { /* created quotation with items */ }
}
```

---

#### `PUT /quotations/:id`

Update a quotation and its line items. Send the full items array — existing items are replaced.

**Request:** Same shape as POST.

**Response:** `200 OK`

---

#### `DELETE /quotations/:id`

Delete a quotation and its line items.

**Response:** `200 OK`
```json
{
  "message": "Quotation deleted successfully"
}
```

---

#### `GET /quotations/:id/pdf`

Generate and download the quotation as a PDF.

**Response:** `200 OK` — `application/pdf` binary stream.

> **Mobile:** Use a download/file viewer to handle the binary PDF response.

---

#### `POST /quotations/:id/email`

Email the quotation PDF to the contact.

**Request:**
```json
{
  "to": "client@example.com",
  "subject": "Your Quotation QUO-0001",
  "message": "Please find attached your quotation."
}
```

**Response:** `200 OK`
```json
{
  "message": "Quotation emailed successfully"
}
```

---

#### `POST /quotations/:id/convert-to-invoice`

Convert a quotation into an invoice. Creates a new invoice with the same line items.

**Response:** `201 Created`
```json
{
  "invoice": { /* newly created invoice */ }
}
```

---

### Invoices

🔒 All invoices endpoints require authentication.

---

#### `GET /invoices`

List all invoices with optional pagination.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 10 | Items per page |
| `status` | string | — | Filter: `draft`, `sent`, `paid`, `overdue`, `cancelled` |
| `contact_id` | number | — | Filter by contact |

**Response:** `200 OK`
```json
{
  "invoices": [
    {
      "id": 1,
      "invoice_number": "INV-0001",
      "contact_id": 1,
      "contact_name": "Acme Corp",
      "date": "2025-06-01",
      "due_date": "2025-06-30",
      "status": "sent",
      "subtotal": 10000,
      "vat_amount": 1500,
      "total": 11500,
      "amount_paid": 0,
      "balance_due": 11500,
      "notes": "",
      "created_at": "2025-06-01T..."
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 67, "pages": 7 }
}
```

---

#### `GET /invoices/:id`

Get a single invoice with line items and payment history.

**Response:** `200 OK`
```json
{
  "invoice": {
    "id": 1,
    "invoice_number": "INV-0001",
    "contact_id": 1,
    "contact_name": "Acme Corp",
    "date": "2025-06-01",
    "due_date": "2025-06-30",
    "status": "sent",
    "subtotal": 10000,
    "vat_amount": 1500,
    "total": 11500,
    "amount_paid": 5000,
    "balance_due": 6500,
    "items": [
      {
        "id": 1,
        "description": "Web Development",
        "quantity": 10,
        "unit_price": 1000,
        "amount": 10000,
        "vat_rate": 15
      }
    ],
    "payments": [
      {
        "id": 1,
        "amount": 5000,
        "date": "2025-06-15",
        "method": "bank_transfer",
        "reference": "REF-001"
      }
    ]
  }
}
```

---

#### `POST /invoices`

Create a new invoice with line items.

**Request:**
```json
{
  "contact_id": 1,
  "date": "2025-06-01",
  "due_date": "2025-06-30",
  "status": "draft",
  "notes": "Payment due within 30 days",
  "items": [
    {
      "description": "Web Development",
      "quantity": 10,
      "unit_price": 1000,
      "vat_rate": 15
    }
  ]
}
```

**Response:** `201 Created`

---

#### `PUT /invoices/:id`

Update an invoice and its line items.

**Response:** `200 OK`

---

#### `DELETE /invoices/:id`

Delete an invoice.

**Response:** `200 OK`

---

#### `GET /invoices/:id/pdf`

Generate and download the invoice as a PDF.

**Response:** `200 OK` — `application/pdf` binary stream.

---

#### `POST /invoices/:id/email`

Email the invoice PDF to the contact.

**Request:**
```json
{
  "to": "client@example.com",
  "subject": "Invoice INV-0001",
  "message": "Please find attached your invoice."
}
```

**Response:** `200 OK`

---

#### `POST /invoices/:id/mark-paid`

Mark an invoice as fully paid.

**Response:** `200 OK`
```json
{
  "invoice": { /* invoice with status: "paid" */ }
}
```

---

#### `POST /invoices/:id/payments`

Record a payment against an invoice.

**Request:**
```json
{
  "amount": 5000,
  "date": "2025-06-15",
  "method": "bank_transfer",
  "reference": "REF-001"
}
```

**Response:** `201 Created`

---

### Payments

🔒 All payments endpoints require authentication.

---

#### `GET /payments`

List all payments with optional pagination.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 10 | Items per page |

**Response:** `200 OK`
```json
{
  "payments": [
    {
      "id": 1,
      "invoice_id": 1,
      "invoice_number": "INV-0001",
      "contact_name": "Acme Corp",
      "amount": 5000,
      "date": "2025-06-15",
      "method": "bank_transfer",
      "reference": "REF-001",
      "status": "processed",
      "created_at": "2025-06-15T..."
    }
  ],
  "pagination": { /* ... */ }
}
```

---

#### `GET /payments/:id`

Get a single payment.

---

#### `POST /payments`

Record a new standalone payment.

**Request:**
```json
{
  "invoice_id": 1,
  "amount": 5000,
  "date": "2025-06-15",
  "method": "bank_transfer",
  "reference": "REF-001"
}
```

---

#### `PUT /payments/:id`

Update a payment.

---

#### `DELETE /payments/:id`

Delete a payment.

---

#### `GET /payments/unprocessed`

List payments that have not yet been processed into accounting transactions.

**Response:** `200 OK`
```json
{
  "payments": [ /* unprocessed payment objects */ ]
}
```

---

#### `POST /payments/:id/process`

Process a payment — creates a corresponding accounting transaction.

**Response:** `200 OK`
```json
{
  "message": "Payment processed successfully",
  "transaction": { /* created accounting transaction */ }
}
```

---

### Accounting

🔒 All accounting endpoints require authentication.

---

#### `GET /accounting/accounts`

List all chart-of-accounts entries.

**Response:** `200 OK`
```json
{
  "accounts": [
    {
      "id": 1,
      "name": "Bank Account",
      "code": "1000",
      "type": "asset",
      "balance": 150000,
      "is_active": true
    }
  ]
}
```

---

#### `POST /accounting/accounts`

Create a new account.

**Request:**
```json
{
  "name": "Petty Cash",
  "code": "1010",
  "type": "asset"
}
```

---

#### `PUT /accounting/accounts/:id`

Update an account.

---

#### `DELETE /accounting/accounts/:id`

Delete an account.

---

#### `GET /accounting/transactions`

List accounting transactions with optional filters.

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page number |
| `limit` | number | Items per page |
| `account_id` | number | Filter by account |
| `start_date` | string | Filter start (YYYY-MM-DD) |
| `end_date` | string | Filter end (YYYY-MM-DD) |

**Response:** `200 OK`
```json
{
  "transactions": [
    {
      "id": 1,
      "date": "2025-06-15",
      "description": "Payment received - INV-0001",
      "debit_account_id": 1,
      "credit_account_id": 5,
      "amount": 5000,
      "reference": "REF-001",
      "created_at": "2025-06-15T..."
    }
  ],
  "pagination": { /* ... */ }
}
```

---

#### `POST /accounting/transactions`

Create a new accounting transaction (journal entry).

**Request:**
```json
{
  "date": "2025-06-15",
  "description": "Office supplies purchase",
  "debit_account_id": 10,
  "credit_account_id": 1,
  "amount": 500,
  "reference": "EXP-001"
}
```

---

#### `PUT /accounting/transactions/:id`

Update a transaction.

---

#### `DELETE /accounting/transactions/:id`

Delete a transaction.

---

#### `GET /accounting/ledger`

Get the general ledger — all transactions organized by account.

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `start_date` | string | Filter start (YYYY-MM-DD) |
| `end_date` | string | Filter end (YYYY-MM-DD) |

**Response:** `200 OK`
```json
{
  "ledger": [
    {
      "account": { "id": 1, "name": "Bank Account", "code": "1000" },
      "transactions": [ /* ... */ ],
      "opening_balance": 100000,
      "closing_balance": 150000
    }
  ]
}
```

---

#### `GET /accounting/tax-rates`

List all tax rates.

**Response:** `200 OK`
```json
{
  "taxRates": [
    { "id": 1, "name": "Standard VAT", "rate": 15, "is_default": true },
    { "id": 2, "name": "Zero-Rated", "rate": 0, "is_default": false }
  ]
}
```

---

#### `POST /accounting/tax-rates`

Create a new tax rate.

---

#### `PUT /accounting/tax-rates/:id`

Update a tax rate.

---

#### `DELETE /accounting/tax-rates/:id`

Delete a tax rate.

---

> **Alias Routes:** The accounting endpoints are also accessible at:
> - `GET /accounts` → same as `GET /accounting/accounts`
> - `GET /transactions` → same as `GET /accounting/transactions`
> - `GET /ledger` → same as `GET /accounting/ledger`
> - `GET /tax-rates` → same as `GET /accounting/tax-rates`

---

### Pricing (Products)

🔒 All pricing endpoints require authentication.

Manages the product/service catalog used in quotation and invoice line items.

---

#### `GET /pricing`

List all products/services.

**Response:** `200 OK`
```json
{
  "products": [
    {
      "id": 1,
      "name": "Web Development",
      "description": "Per hour",
      "unit_price": 1000,
      "category_id": 1,
      "category_name": "Services",
      "is_active": true
    }
  ]
}
```

---

#### `GET /pricing/:id`

Get a single product.

---

#### `POST /pricing`

Create a new product/service.

**Request:**
```json
{
  "name": "Web Development",
  "description": "Per hour",
  "unit_price": 1000,
  "category_id": 1
}
```

---

#### `PUT /pricing/:id`

Update a product.

---

#### `DELETE /pricing/:id`

Delete a product.

---

### Categories

🔒 All categories endpoints require authentication.

Product/service categories for organizing the pricing catalog.

---

#### `GET /categories`

List all categories.

**Response:** `200 OK`
```json
{
  "categories": [
    { "id": 1, "name": "Services", "description": "Professional services" },
    { "id": 2, "name": "Products", "description": "Physical products" }
  ]
}
```

---

#### `GET /categories/:id`

Get a single category.

---

#### `POST /categories`

Create a new category.

**Request:**
```json
{
  "name": "Software Licenses",
  "description": "Software license products"
}
```

---

#### `PUT /categories/:id`

Update a category.

---

#### `DELETE /categories/:id`

Delete a category.

---

### Expense Categories

🔒 All expense category endpoints require authentication.

Categories specifically for classifying business expenses.

---

#### `GET /expense-categories`

List all expense categories.

**Response:** `200 OK`
```json
{
  "categories": [
    { "id": 1, "name": "Office Supplies", "description": "Stationery, etc." },
    { "id": 2, "name": "Travel", "description": "Business travel" }
  ]
}
```

---

#### `GET /expense-categories/:id`

Get a single expense category.

---

#### `POST /expense-categories`

Create a new expense category.

---

#### `PUT /expense-categories/:id`

Update an expense category.

---

#### `DELETE /expense-categories/:id`

Delete an expense category.

---

### Financial Reports

🔒 All financial report endpoints require authentication.

---

#### `GET /financial-reports/balance-sheet`

Get the balance sheet report.

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `as_of` | string | Date for the report (YYYY-MM-DD). Defaults to today. |

**Response:** `200 OK`
```json
{
  "report": {
    "as_of": "2025-06-30",
    "assets": [
      { "account": "Bank Account", "code": "1000", "balance": 150000 }
    ],
    "liabilities": [
      { "account": "Accounts Payable", "code": "2000", "balance": 25000 }
    ],
    "equity": [
      { "account": "Retained Earnings", "code": "3000", "balance": 125000 }
    ],
    "total_assets": 150000,
    "total_liabilities": 25000,
    "total_equity": 125000
  }
}
```

---

#### `GET /financial-reports/profit-loss`

Get the profit & loss (income statement) report.

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `start_date` | string | Period start (YYYY-MM-DD) |
| `end_date` | string | Period end (YYYY-MM-DD) |

**Response:** `200 OK`
```json
{
  "report": {
    "period": { "start": "2025-01-01", "end": "2025-06-30" },
    "income": [
      { "account": "Sales Revenue", "code": "4000", "amount": 250000 }
    ],
    "expenses": [
      { "account": "Office Supplies", "code": "5000", "amount": 15000 }
    ],
    "total_income": 250000,
    "total_expenses": 85000,
    "net_profit": 165000
  }
}
```

---

#### `GET /financial-reports/transaction-listing`

Get a detailed transaction listing report.

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `start_date` | string | Period start (YYYY-MM-DD) |
| `end_date` | string | Period end (YYYY-MM-DD) |
| `account_id` | number | Optional: filter by account |

**Response:** `200 OK`
```json
{
  "report": {
    "transactions": [
      {
        "id": 1,
        "date": "2025-06-15",
        "description": "Payment received",
        "debit_account": "Bank Account",
        "credit_account": "Accounts Receivable",
        "amount": 5000,
        "reference": "REF-001"
      }
    ],
    "total": 250000
  }
}
```

---

### Reports

🔒 All report endpoints require authentication.

---

#### `GET /reports/trial-balance`

Get the trial balance report.

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `as_of` | string | Date (YYYY-MM-DD) |

**Response:** `200 OK`
```json
{
  "report": {
    "as_of": "2025-06-30",
    "accounts": [
      { "account": "Bank Account", "code": "1000", "debit": 150000, "credit": 0 },
      { "account": "Sales Revenue", "code": "4000", "debit": 0, "credit": 250000 }
    ],
    "total_debit": 250000,
    "total_credit": 250000
  }
}
```

---

#### `GET /reports/vat`

Get the VAT summary report.

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `start_date` | string | Period start |
| `end_date` | string | Period end |

**Response:** `200 OK`
```json
{
  "report": {
    "period": { "start": "2025-01-01", "end": "2025-06-30" },
    "output_vat": 37500,
    "input_vat": 12750,
    "vat_payable": 24750
  }
}
```

---

#### `GET /reports/income-statement`

Get the income statement report (alternative to profit-loss).

**Query Parameters:** Same as profit-loss.

---

### VAT Reports

🔒 All VAT report endpoints require authentication.

South African tax-specific reports.

---

#### `GET /vat-reports/vat201`

Generate the VAT201 return data.

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `start_date` | string | Period start |
| `end_date` | string | Period end |

**Response:** `200 OK`
```json
{
  "report": {
    "period": { "start": "2025-01-01", "end": "2025-06-30" },
    "standard_rated_supplies": 250000,
    "zero_rated_supplies": 0,
    "exempt_supplies": 0,
    "output_tax": 37500,
    "input_tax": 12750,
    "vat_payable": 24750
  }
}
```

---

#### `GET /vat-reports/itr14`

Generate ITR14 (corporate income tax return) data.

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `tax_year` | string | Tax year (e.g. `2025`) |

---

#### `GET /vat-reports/irp6`

Generate IRP6 (provisional tax) data.

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `tax_year` | string | Tax year |
| `period` | number | Period (1 or 2) |

---

### Software Management

🔒 **Authenticated** (read). 🛡️ **Admin** (write).

Manages the software product registry.

---

#### `GET /softaware/software`

List all registered software products.

**Response:** `200 OK`
```json
{
  "success": true,
  "software": [
    {
      "id": 2,
      "name": "Silulumanzi Portal",
      "software_key": "20251001SILU",
      "description": "Water management portal",
      "created_by_name": "admin",
      "latest_version": "2.1.14",
      "total_updates": 1,
      "has_external_integration": 0,
      "external_api_url": null
    }
  ]
}
```

---

#### `GET /softaware/software?id=N`

Get a single software product.

---

#### `POST /softaware/software`

🛡️ **Admin.** Create a new software product.

**Request:**
```json
{
  "name": "My Application",
  "software_key": "my-unique-key",
  "description": "Application description",
  "has_external_integration": 1,
  "external_api_url": "https://api.myapp.com"
}
```

---

#### `PUT /softaware/software`

🛡️ **Admin.** Update a software product.

**Request:** Include `id` and fields to update.

---

#### `DELETE /softaware/software?id=N`

🛡️ **Admin.** Delete a software product (cascades to related records).

---

### Softaware Tasks

🔒 **Authenticated.** Tasks are proxied to external software APIs. Each software product may have its own task management system.

The tasks system uses **two tokens**:
1. **`jwt_token`** — Your SoftAware platform JWT (for authenticating with the platform)
2. **`software_token`** — A per-software token obtained by authenticating with the external software's API

---

#### `POST /softaware/tasks/authenticate`

Authenticate with an external software's task API.

**Request:**
```json
{
  "software_id": 2,
  "credentials": {
    "email": "user@example.com",
    "password": "password"
  }
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "token": "external-software-jwt-token"
}
```

> Store this `token` as the `software_token` for subsequent task requests.

---

#### `GET /softaware/tasks/:softwareId`

Get all tasks for a specific software product.

**Headers:**
```
Authorization: Bearer <jwt_token>
X-Software-Token: <software_token>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "tasks": [
    {
      "id": 1,
      "title": "Fix login bug",
      "description": "Users can't login on mobile",
      "status": "in_progress",
      "priority": "high",
      "assigned_to": "John Doe",
      "due_date": "2025-07-01",
      "created_at": "2025-06-01T..."
    }
  ]
}
```

---

#### `POST /softaware/tasks/:softwareId`

Create a new task.

**Headers:** Same as above (both tokens).

**Request:**
```json
{
  "title": "Implement feature X",
  "description": "Detailed description",
  "status": "todo",
  "priority": "medium",
  "assigned_to": "user-id"
}
```

---

#### `PUT /softaware/tasks/:softwareId/:taskId`

Update a task.

---

#### `DELETE /softaware/tasks/:softwareId/:taskId`

Delete a task.

---

#### `GET /softaware/tasks/:softwareId/:taskId/comments`

Get comments on a task.

---

#### `POST /softaware/tasks/:softwareId/:taskId/comments`

Add a comment to a task.

**Request:**
```json
{
  "content": "This is a comment on the task."
}
```

---

#### `PUT /softaware/tasks/:softwareId/reorder`

Reorder tasks (drag-and-drop support).

**Request:**
```json
{
  "taskIds": [3, 1, 2, 5, 4]
}
```

---

### Updates System

The Updates system manages software update distribution, client monitoring, and remote control.

---

#### Updates Info

```
GET /updates/info
```

**Public.** Returns API metadata.

**Response:**
```json
{
  "name": "Softaware Updates API",
  "version": "2.0.0",
  "status": "API is running",
  "endpoints": { /* ... */ }
}
```

---

#### Updates Dashboard

```
GET /updates/dashboard
```

🔒 **Authenticated.** Dashboard summary statistics.

**Response:**
```json
{
  "success": true,
  "summary": {
    "software_count": 7,
    "update_count": 3,
    "user_count": 11,
    "active_clients_24h": 4
  },
  "latest_clients": [ /* ... */ ],
  "recent_updates": [ /* ... */ ]
}
```

---

#### Software Products (Updates)

```
GET    /updates/software          — Public: list all
GET    /updates/software?id=N     — Public: single
POST   /updates/software          — Admin: create
PUT    /updates/software          — Admin: update
DELETE /updates/software?id=N     — Admin: delete (cascades)
```

**Response:**
```json
{
  "success": true,
  "software": [
    {
      "id": 2,
      "name": "Silulumanzi Portal",
      "software_key": "20251001SILU",
      "created_by_name": "admin",
      "latest_version": "2.1.14",
      "total_updates": 1,
      "has_external_integration": 0
    }
  ]
}
```

---

#### Update Packages

```
GET    /updates/updates             — Public: list all
GET    /updates/updates?id=N        — Public: single
GET    /updates/updates?limit=N     — Public: limit results
POST   /updates/updates             — Admin: create record
PUT    /updates/updates             — Admin: modify
DELETE /updates/updates?id=N        — Admin: delete + file
```

**Response:**
```json
{
  "success": true,
  "updates": [
    {
      "id": 64,
      "software_id": 2,
      "software_name": "Silulumanzi Portal",
      "version": "2.1.14",
      "description": "Release notes...",
      "file_path": "uploads/updates/2.1.14_file.zip",
      "uploaded_by_name": "admin",
      "has_migrations": 0
    }
  ]
}
```

---

#### Upload Update Package

```
POST /updates/upload
```

🔑 **API Key Required** (`X-API-Key` header). Multipart/form-data.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `updatePackage` | File | Yes | The update archive file |
| `software_id` | Number | Yes | Target software ID |
| `version` | String | Yes | Version string |
| `description` | String | Yes | Release notes |
| `has_migrations` | Number | No | `1` or `0` |
| `migration_notes` | String | No | Migration instructions |
| `update_id` | Number | No | Existing update ID (replace) |

**Response:**
```json
{
  "success": true,
  "update_id": 65,
  "file_path": "uploads/updates/2.0.0_1709123456_myapp-2.0.zip",
  "checksum": "sha256..."
}
```

---

#### Download Update

```
GET /updates/download?update_id=N
```

Public (requires `X-Software-Key` header or `?software_key=` param). Returns the file as `application/octet-stream`.

---

#### Client Heartbeat

```
POST /updates/heartbeat
```

Public (requires `software_key` in body). Client apps call this periodically to register presence, check for updates, and receive commands.

**Request:**
```json
{
  "software_key": "20251001SILU",
  "hostname": "WORKSTATION-01",
  "machine_name": "WIN-PC01",
  "os_info": "Windows 11 Pro",
  "app_version": "2.1.0",
  "user_name": "John Doe",
  "active_page": "/dashboard",
  "ai_sessions_active": 2,
  "ai_model": "gpt-4"
}
```

**Response:**
```json
{
  "success": true,
  "client_id": 15,
  "action": "updated",
  "software": "Silulumanzi Portal",
  "update_available": true,
  "latest_update": {
    "id": 64,
    "version": "2.1.14",
    "description": "...",
    "has_migrations": 0
  },
  "force_logout": false,
  "server_message": null,
  "is_blocked": false
}
```

Blocked clients receive `403` with `{ "blocked": true, "reason": "..." }`.

---

#### Client Management

```
GET    /updates/clients              — Admin: list all
GET    /updates/clients?id=N         — Admin: single client
GET    /updates/clients?software_id= — Admin: filter by software
PUT    /updates/clients              — Admin: actions
DELETE /updates/clients?id=N         — Admin: delete client
```

🛡️ **Admin only.**

**Client Status** (computed from heartbeat recency):

| Status | Condition |
|--------|----------|
| `online` | < 5 min ago |
| `recent` | < 24 hours ago |
| `inactive` | < 7 days ago |
| `offline` | ≥ 7 days ago |

**Client Actions (PUT):**
```json
{ "id": 15, "action": "block", "reason": "Unauthorized" }
{ "id": 15, "action": "unblock" }
{ "id": 15, "action": "force_logout" }
{ "id": 15, "action": "send_message", "message": "Please update" }
```

---

#### Modules

```
GET    /updates/modules                          — Authenticated: list
GET    /updates/modules?software_id=N            — Authenticated: filter
POST   /updates/modules                          — Admin: create
PUT    /updates/modules?id=N                     — Admin: update
DELETE /updates/modules?id=N                     — Admin: delete
```

**Module Developers:**
```
GET    /updates/modules/:id/developers           — Authenticated: list
POST   /updates/modules/:id/developers           — Admin: assign
DELETE /updates/modules/:id/developers?user_id=  — Admin: remove
```

---

#### Installed Updates

```
GET /updates/installed
```

Public. Returns updates that have been marked as installed.

---

#### Update Schema

```
GET /updates/schema?id=N
```

Public. Returns the SQL schema for a specific update.

---

#### Password Reset (Updates)

Three-step public flow:

```
POST /updates/password_reset    — Request OTP (email)
POST /updates/verify_otp        — Verify OTP
POST /updates/reset_password    — Execute reset with new password
```

**Step 1 — Request OTP:**
```json
{ "identifier": "admin@softaware.co.za" }
```

**Step 2 — Verify OTP:**
```json
{ "identifier": "admin@softaware.co.za", "otp": "123456" }
```

**Step 3 — Reset Password:**
```json
{ "identifier": "admin@softaware.co.za", "otp": "123456", "new_password": "newSecurePass" }
```

---

#### API Status

```
GET /updates/api_status
```

Public. Returns system health and database statistics.

```json
{
  "timestamp": "2025-06-01T...",
  "api_version": "2.0.0",
  "status": "operational",
  "database": {
    "connected": true,
    "total_users": 11,
    "tables": { "clients": 20, "software": 7, "updates": 3, "modules": 83 }
  }
}
```

---

### Groups & Chat

🔒 **Authenticated.**

Real-time group messaging system.

---

#### `GET /groups`

List all groups the current user belongs to.

**Response:** `200 OK`
```json
{
  "groups": [
    {
      "id": 1,
      "name": "Development Team",
      "description": "Dev team chat",
      "created_by": "user-uuid",
      "member_count": 5,
      "created_at": "2025-06-01T..."
    }
  ]
}
```

---

#### `GET /groups/:id`

Get a single group with its members.

**Response:** `200 OK`
```json
{
  "group": {
    "id": 1,
    "name": "Development Team",
    "description": "Dev team chat",
    "members": [
      { "id": "user-uuid", "name": "John Doe", "email": "john@example.com", "role": "admin" }
    ]
  }
}
```

---

#### `POST /groups`

Create a new group.

**Request:**
```json
{
  "name": "Project Alpha",
  "description": "Discussion for Project Alpha"
}
```

---

#### `PUT /groups/:id`

Update a group.

---

#### `DELETE /groups/:id`

Delete a group.

---

#### `POST /groups/:id/members`

Add a member to a group.

**Request:**
```json
{
  "user_id": "user-uuid"
}
```

---

#### `DELETE /groups/:id/members/:userId`

Remove a member from a group.

---

#### `GET /groups/:id/messages`

Get messages for a group.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 50 | Messages per page |

**Response:** `200 OK`
```json
{
  "messages": [
    {
      "id": 1,
      "group_id": 1,
      "user_id": "user-uuid",
      "user_name": "John Doe",
      "content": "Hello team!",
      "created_at": "2025-06-01T10:30:00.000Z"
    }
  ],
  "pagination": { /* ... */ }
}
```

---

#### `POST /groups/:id/messages`

Send a message to a group.

**Request:**
```json
{
  "content": "Hello everyone!"
}
```

**Response:** `201 Created`
```json
{
  "message": {
    "id": 2,
    "group_id": 1,
    "user_id": "user-uuid",
    "content": "Hello everyone!",
    "created_at": "2025-06-01T10:31:00.000Z"
  }
}
```

---

### Notifications

🔒 **Authenticated.**

---

#### `GET /notifications`

Get the current user's notifications.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |
| `unread` | boolean | — | Filter unread only |

**Response:** `200 OK`
```json
{
  "notifications": [
    {
      "id": 1,
      "user_id": "user-uuid",
      "title": "New Invoice Payment",
      "message": "Payment of R5,000 received for INV-0001",
      "type": "payment",
      "is_read": false,
      "created_at": "2025-06-15T..."
    }
  ],
  "pagination": { /* ... */ },
  "unread_count": 3
}
```

---

#### `GET /notifications/unread-count`

Get the count of unread notifications (useful for badge display).

**Response:** `200 OK`
```json
{
  "count": 3
}
```

---

#### `PUT /notifications/:id/read`

Mark a single notification as read.

**Response:** `200 OK`
```json
{
  "message": "Notification marked as read"
}
```

---

#### `PUT /notifications/read-all`

Mark all notifications as read.

**Response:** `200 OK`
```json
{
  "message": "All notifications marked as read"
}
```

---

#### `DELETE /notifications/:id`

Delete a notification.

---

#### `POST /notifications`

🔒 **Authenticated.** Create a notification (optionally with push notification).

**Request Body:**
```json
{
  "title": "New Update Available",
  "message": "Version 2.5.0 is ready for download",
  "type": "info",
  "user_id": "target-user-uuid",
  "send_push": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | ✅ | Notification title |
| `message` | string | ✅ | Notification body text |
| `type` | string | — | `info`, `success`, `warning`, `error`. Default: `info` |
| `user_id` | string | — | Target user. Omit to send to self |
| `send_push` | boolean | — | Also send FCM push. Default: `true` |

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Notification created"
}
```

---

#### `POST /notifications/test-push`

🔒 **Authenticated.** Send a test push notification to the current user's registered devices. Useful for verifying push notification setup.

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Test push sent. 1 delivered, 0 failed.",
  "data": {
    "sent": 1,
    "failed": 0
  }
}
```

---

### FCM Device Tokens (Push Notifications)

🔒 **Authenticated.** Manage Firebase Cloud Messaging device tokens for push notifications. Each user can have multiple devices registered.

**Supported platforms:** `android`, `ios`, `web`

---

#### `GET /fcm-tokens/status`

🔒 **Authenticated.** Check whether Firebase Cloud Messaging is configured on the server.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "fcm_enabled": true
  }
}
```

> **Mobile note:** If `fcm_enabled` is `false`, fall back to polling-based notifications.

---

#### `POST /fcm-tokens`

🔒 **Authenticated.** Register a device FCM token for push notifications.

**Request Body:**
```json
{
  "token": "firebase-device-token-string...",
  "device_name": "Pixel 8 Pro",
  "platform": "android"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `token` | string | ✅ | FCM registration token from Firebase SDK |
| `device_name` | string | — | Human-readable device name |
| `platform` | string | — | `android`, `ios`, or `web` |

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Device registered for push notifications."
}
```

> **Mobile note:** Call this endpoint after successful login and whenever the FCM token refreshes. The server automatically handles token updates via upsert.

---

#### `GET /fcm-tokens`

🔒 **Authenticated.** List all registered devices for the current user.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "token": "firebase-device-token...",
      "device_name": "Pixel 8 Pro",
      "platform": "android",
      "created_at": "2026-03-01T...",
      "updated_at": "2026-03-01T..."
    }
  ],
  "fcm_enabled": true
}
```

---

#### `DELETE /fcm-tokens/:token`

🔒 **Authenticated.** Unregister a device from push notifications. Call this on logout to stop receiving pushes on that device.

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Device unregistered from push notifications."
}
```

> **Mobile note:** URL-encode the token parameter if it contains special characters.

---

### App Settings

Public and authenticated endpoints for application branding and configuration.

---

#### `GET /app-settings/public`

**Public.** Get public branding settings (logo, app name, etc.). Useful for the login/splash screen before authentication.

**Response:** `200 OK`
```json
{
  "settings": {
    "app_name": "SoftAware",
    "logo_url": "/uploads/logo.png",
    "company_name": "Soft Aware (Pty) Ltd",
    "primary_color": "#1976d2",
    "tagline": "Smart Software Solutions"
  }
}
```

---

#### `GET /app-settings`

🔒 **Authenticated.** Get all app settings (superset of public settings).

**Response:** `200 OK`
```json
{
  "settings": {
    "app_name": "SoftAware",
    "logo_url": "/uploads/logo.png",
    "company_name": "Soft Aware (Pty) Ltd",
    "primary_color": "#1976d2",
    "tagline": "Smart Software Solutions",
    "company_address": "123 Main St, Johannesburg",
    "company_phone": "+27111234567",
    "company_email": "info@softaware.co.za",
    "company_vat_number": "4123456789",
    "invoice_prefix": "INV",
    "quotation_prefix": "QUO",
    "currency": "ZAR",
    "currency_symbol": "R",
    "tax_rate": 15
  }
}
```

---

#### `PUT /app-settings`

🛡️ **Admin.** Update app settings.

**Request:**
```json
{
  "app_name": "My Business",
  "primary_color": "#FF5722",
  "tax_rate": 15
}
```

---

### Settings (Key-Value)

🔒 **Authenticated.** A general-purpose key-value settings store.

---

#### `GET /settings`

Get all settings as key-value pairs.

**Response:** `200 OK`
```json
{
  "settings": {
    "theme": "dark",
    "language": "en",
    "notifications_enabled": "true"
  }
}
```

---

#### `GET /settings/:key`

Get a single setting value.

**Response:** `200 OK`
```json
{
  "key": "theme",
  "value": "dark"
}
```

---

#### `PUT /settings/:key`

Set or update a setting.

**Request:**
```json
{
  "value": "light"
}
```

---

### Subscriptions

🔒 **Authenticated.**

---

#### `GET /subscriptions/plans`

List available subscription plans.

**Response:** `200 OK`
```json
{
  "plans": [
    {
      "id": "plan-uuid",
      "name": "Starter",
      "slug": "starter",
      "price": 0,
      "currency": "ZAR",
      "features": ["5 contacts", "10 invoices/month"],
      "credits_per_month": 100
    },
    {
      "id": "plan-uuid",
      "name": "Professional",
      "slug": "professional",
      "price": 49900,
      "currency": "ZAR",
      "features": ["Unlimited contacts", "Unlimited invoices", "Financial reports"],
      "credits_per_month": 5000
    }
  ]
}
```

---

#### `GET /subscriptions/current`

Get the current user's active subscription.

**Response:** `200 OK`
```json
{
  "subscription": {
    "id": "sub-uuid",
    "planId": "plan-uuid",
    "plan": "professional",
    "status": "active",
    "currentPeriodStart": "2025-06-01T...",
    "currentPeriodEnd": "2025-07-01T...",
    "cancelAtPeriodEnd": false
  }
}
```

---

#### `POST /subscriptions/start-trial`

Start a trial subscription.

**Request:**
```json
{
  "planId": "plan-uuid"
}
```

---

#### `POST /subscriptions/change-plan`

Change the current subscription plan.

**Request:**
```json
{
  "planId": "new-plan-uuid"
}
```

---

#### `POST /subscriptions/cancel`

Cancel the current subscription (at period end).

---

### Credits

🔒 **Authenticated.**

---

#### `GET /credits/packages`

List available credit packages for purchase.

**Response:** `200 OK`
```json
{
  "packages": [
    { "id": "pkg-uuid", "name": "Starter Pack", "credits": 1000, "price": 9900, "currency": "ZAR" },
    { "id": "pkg-uuid", "name": "Pro Pack", "credits": 10000, "price": 79900, "currency": "ZAR" }
  ]
}
```

---

#### `GET /credits/balance`

Get the current credit balance.

**Response:** `200 OK`
```json
{
  "balance": 5000,
  "totalPurchased": 10000,
  "totalUsed": 5000
}
```

---

#### `GET /credits/transactions`

Get credit transaction history.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | 50 | Items per page |
| `offset` | number | 0 | Offset |

**Response:** `200 OK`
```json
{
  "transactions": [
    {
      "id": "tx-uuid",
      "type": "DEBIT",
      "amount": 20,
      "description": "AI Chat request",
      "createdAt": "2025-06-15T..."
    }
  ],
  "total": 150,
  "pagination": { "limit": 50, "offset": 0, "hasMore": true }
}
```

---

#### `POST /credits/purchase`

Purchase a credit package.

**Request:**
```json
{
  "packageId": "pkg-uuid"
}
```

---

### AI Services

🔒 **Authenticated.** Credit-based AI services.

---

#### `POST /ai/chat`

Full AI chat with conversation history.

**Request:**
```json
{
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "What is REST?" }
  ],
  "model": "gpt-4o-mini",
  "provider": "openai"
}
```

**Response:** `200 OK`
```json
{
  "content": "REST (Representational State Transfer) is...",
  "model": "gpt-4o-mini",
  "provider": "openai",
  "creditsUsed": 20
}
```

---

#### `POST /ai/simple`

Simple single-prompt AI completion.

**Request:**
```json
{
  "prompt": "Explain REST APIs in 3 sentences",
  "provider": "softaware"
}
```

**Response:** `200 OK`
```json
{
  "content": "REST APIs use HTTP methods...",
  "creditsUsed": 10
}
```

**Credit Costs:**

| Operation | Cost |
|-----------|------|
| Simple AI prompt | 10 credits |
| AI chat (with history) | 20 credits |
| Code generation | 50 credits |

---

### Team Management

🔒 **Authenticated.**

---

#### `POST /teams/invite`

Invite a new member to your team.

**Request:**
```json
{
  "email": "newmember@example.com",
  "role": "STAFF"
}
```

**Response:** `201 Created`
```json
{
  "member": {
    "id": "member-uuid",
    "userId": "user-uuid",
    "email": "newmember@example.com",
    "role": "STAFF"
  }
}
```

---

#### `PUT /teams/members/:memberId`

Update a team member's role.

**Request:**
```json
{
  "role": "ARCHITECT"
}
```

---

#### `DELETE /teams/members/:memberId`

Remove a team member.

---

### System: Users

🛡️ **Admin only.** Manage all users in the system.

---

#### `GET /users`

List all users.

**Response:** `200 OK`
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "phone": "+27123456789",
      "createdAt": "2025-01-15T...",
      "role": { "id": 1, "name": "Administrator", "slug": "admin" }
    }
  ]
}
```

---

#### `GET /users/:id`

Get a single user with full details.

---

#### `POST /users`

Create a new user.

**Request:**
```json
{
  "email": "newuser@example.com",
  "password": "tempPassword123",
  "name": "New User",
  "phone": "+27987654321"
}
```

---

#### `PUT /users/:id`

Update a user.

**Request:**
```json
{
  "name": "Updated Name",
  "phone": "+27111222333"
}
```

---

#### `DELETE /users/:id`

Delete a user.

---

#### `PUT /users/:id/team-role`

Change a user's team role (affects `is_admin`/`is_staff`).

**Request:**
```json
{
  "role": "STAFF"
}
```

> Changing this to `"ADMIN"` will make `is_admin: true` for the user.

---

### System: Roles

🛡️ **Admin only.** Manage roles.

---

#### `GET /roles`

List all roles.

**Response:** `200 OK`
```json
{
  "roles": [
    {
      "id": 1,
      "name": "Administrator",
      "slug": "admin",
      "description": "Full system access",
      "created_at": "2025-01-15T..."
    }
  ]
}
```

---

#### `GET /roles/:id`

Get a single role with its assigned permissions.

**Response:** `200 OK`
```json
{
  "role": {
    "id": 2,
    "name": "Manager",
    "slug": "manager",
    "description": "Management access",
    "permissions": [
      { "id": 1, "name": "View Dashboard", "slug": "view_dashboard" },
      { "id": 3, "name": "View Contacts", "slug": "view_contacts" }
    ]
  }
}
```

---

#### `POST /roles`

Create a new role.

**Request:**
```json
{
  "name": "Custom Role",
  "slug": "custom_role",
  "description": "Custom role description"
}
```

---

#### `PUT /roles/:id`

Update a role.

---

#### `DELETE /roles/:id`

Delete a role.

---

#### `POST /roles/:id/permissions`

Assign permissions to a role.

**Request:**
```json
{
  "permission_ids": [1, 2, 3, 4, 5]
}
```

---

#### `DELETE /roles/:id/permissions`

Remove permissions from a role.

**Request:**
```json
{
  "permission_ids": [4, 5]
}
```

---

#### `POST /roles/assign`

Assign a role to a user.

**Request:**
```json
{
  "user_id": "user-uuid",
  "role_id": 2
}
```

---

#### `POST /roles/remove`

Remove a role from a user.

**Request:**
```json
{
  "user_id": "user-uuid",
  "role_id": 2
}
```

---

### System: Permissions

🛡️ **Admin only.** Manage permissions.

---

#### `GET /permissions`

List all permissions.

**Response:** `200 OK`
```json
{
  "permissions": [
    {
      "id": 1,
      "name": "View Dashboard",
      "slug": "view_dashboard",
      "description": "Can view the main dashboard",
      "permission_group": "Dashboard",
      "created_at": "2025-01-15T..."
    }
  ]
}
```

---

#### `GET /permissions/:id`

Get a single permission.

---

#### `POST /permissions`

Create a new permission.

**Request:**
```json
{
  "name": "Export Data",
  "slug": "export_data",
  "description": "Can export data as CSV",
  "permission_group": "Reports"
}
```

---

#### `PUT /permissions/:id`

Update a permission.

---

#### `DELETE /permissions/:id`

Delete a permission.

---

#### `POST /permissions/:id/assign`

Assign a permission to a role.

**Request:**
```json
{
  "role_id": 2
}
```

---

#### `POST /permissions/:id/remove`

Remove a permission from a role.

**Request:**
```json
{
  "role_id": 2
}
```

---

### System: Credentials

🛡️ **Admin only.** Manages encrypted credentials (API keys, database passwords, etc.).

---

#### `GET /credentials`

List all credentials (values are masked).

**Response:** `200 OK`
```json
{
  "credentials": [
    {
      "id": 1,
      "name": "OpenAI API Key",
      "type": "api_key",
      "identifier": "sk-...abc",
      "is_active": true,
      "last_rotated": "2025-06-01T...",
      "created_at": "2025-01-15T..."
    }
  ]
}
```

---

#### `GET /credentials/:id`

Get a single credential (value masked).

---

#### `POST /credentials`

Create a new credential.

**Request:**
```json
{
  "name": "Stripe API Key",
  "type": "api_key",
  "identifier": "sk_live_...",
  "value": "the-secret-value",
  "description": "Production Stripe key"
}
```

---

#### `PUT /credentials/:id`

Update a credential.

---

#### `DELETE /credentials/:id`

Delete a credential.

---

#### `PUT /credentials/:id/deactivate`

Deactivate a credential without deleting it.

---

#### `PUT /credentials/:id/rotate`

Rotate a credential — generates or accepts a new value.

**Request:**
```json
{
  "new_value": "new-secret-value"
}
```

---

#### `POST /credentials/:id/test`

Test a credential's connectivity (e.g., make a test API call).

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Credential is valid and working"
}
```

---

### Database Manager

🛡️ **Admin only.** Direct database introspection and query execution for development purposes.

> ⚠️ **Security Warning:** This endpoint executes raw SQL. Only expose in development/admin contexts.

---

#### `POST /database/connect`

Test database connection.

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Database connection successful",
  "database": "softaware"
}
```

---

#### `GET /database/tables`

List all database tables.

**Response:** `200 OK`
```json
{
  "tables": [
    "users", "roles", "permissions", "role_permissions", "user_roles",
    "teams", "team_members", "contacts", "quotations", "invoices",
    "payments", "accounts", "transactions", "groups", "group_messages"
  ]
}
```

---

#### `GET /database/tables/:name`

Describe a table's structure (columns, types, keys).

**Response:** `200 OK`
```json
{
  "table": "users",
  "columns": [
    { "Field": "id", "Type": "varchar(36)", "Null": "NO", "Key": "PRI", "Default": null },
    { "Field": "email", "Type": "varchar(320)", "Null": "NO", "Key": "UNI", "Default": null },
    { "Field": "name", "Type": "varchar(255)", "Null": "YES", "Key": "", "Default": null },
    { "Field": "passwordHash", "Type": "varchar(255)", "Null": "NO", "Key": "", "Default": null }
  ]
}
```

---

#### `POST /database/query`

Execute a raw SQL query.

**Request:**
```json
{
  "query": "SELECT id, email, name FROM users LIMIT 10"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "rows": [
    { "id": "uuid", "email": "user@example.com", "name": "John Doe" }
  ],
  "rowCount": 1,
  "fields": ["id", "email", "name"]
}
```

---

### Admin Dashboard

🛡️ **Admin only.** System-wide statistics for the admin panel.

---

#### `GET /admin/dashboard`

**Response:** `200 OK`
```json
{
  "stats": {
    "total_users": 25,
    "total_teams": 10,
    "total_contacts": 150,
    "total_invoices": 300,
    "total_quotations": 180,
    "total_payments": 220,
    "total_revenue": 750000,
    "active_subscriptions": 8,
    "total_software": 7,
    "active_clients_24h": 4,
    "recent_registrations": [
      { "id": "uuid", "email": "recent@example.com", "createdAt": "2025-06-01T..." }
    ],
    "revenue_by_month": [
      { "month": "2025-01", "revenue": 45000 },
      { "month": "2025-02", "revenue": 52000 }
    ]
  }
}
```

---

### Admin Operations

🛡️ **Admin only.**

---

#### `GET /admin/stats`

Get system-wide statistics.

**Response:** `200 OK`
```json
{
  "stats": {
    "totalUsers": 25,
    "totalTeams": 10,
    "activeSubscriptions": 8,
    "totalCreditsUsed": 50000,
    "totalRevenue": 750000
  }
}
```

---

#### `GET /admin/subscriptions`

List all subscriptions across all teams.

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter: `active`, `cancelled`, `trial` |
| `limit` | number | Items per page |
| `offset` | number | Offset |

**Response:** `200 OK`
```json
{
  "subscriptions": [
    {
      "id": "sub-uuid",
      "teamId": "team-uuid",
      "teamName": "Acme Corp",
      "plan": "professional",
      "status": "active",
      "currentPeriodEnd": "2025-07-01T..."
    }
  ],
  "total": 10
}
```

---

#### `GET /admin/credits/transactions`

List all credit transactions system-wide.

---

#### `POST /admin/credits/balances/:teamId/adjust`

Manually adjust a team's credit balance.

**Request:**
```json
{
  "amount": 5000,
  "description": "Promotional bonus",
  "type": "BONUS"
}
```

---

## Mobile App Integration Guide

This section provides guidance specifically for mobile app developers (React Native, Flutter, Swift, Kotlin).

### Token Storage

| Platform | Storage Method |
|----------|---------------|
| **iOS** | Keychain Services (`SecItemAdd`) |
| **Android** | EncryptedSharedPreferences or Android Keystore |
| **React Native** | `react-native-keychain` or `expo-secure-store` |
| **Flutter** | `flutter_secure_storage` |

> ⚠️ **Never** store JWT tokens in `AsyncStorage`, `SharedPreferences`, or `localStorage` — these are not encrypted.

### Authentication Flow (Mobile)

```
1. App Launch (first time)
   └─ GET /app-settings/public → Display branding on login screen
   └─ User enters credentials
   └─ POST /auth/login { email, password, rememberMe: true }
       ├─ { requires_2fa: false } or no requires_2fa field:
       │   └─ Store token in secure storage
       │   └─ Store user object in app state (memory)
       │   └─ Register FCM token: POST /fcm-tokens
       │   └─ Navigate to Dashboard
       │
       └─ { requires_2fa: true, temp_token: "..." }:
           └─ Navigate to 2FA Verification Screen
           └─ User enters 6-digit code from authenticator app
           └─ POST /auth/2fa/verify { temp_token, code }
               └─ Store token in secure storage
               └─ Register FCM token: POST /fcm-tokens
               └─ Navigate to Dashboard

2. App Launch (returning user)
   └─ Read token from secure storage
   └─ GET /auth/validate
       ├─ { valid: true }  → GET /auth/me → Load user → Dashboard
       └─ { valid: false } → Clear storage → Login Screen

3. Token Refresh (proactive)
   └─ Set up a timer or intercept 401 responses
   └─ POST /auth/refresh → Update stored token

4. Logout
   └─ DELETE /fcm-tokens/:deviceToken (unregister push)
   └─ POST /auth/logout
   └─ Clear secure storage
   └─ Navigate to Login Screen

5. 2FA Management (in Settings screen)
   └─ GET /auth/2fa/status → Show toggle
   └─ Enable: POST /auth/2fa/setup → Show QR → POST /auth/2fa/verify-setup
   └─ Disable: POST /auth/2fa/disable { password }
   └─ Regenerate backup codes: POST /auth/2fa/backup-codes { password }
```

### Two-Token System (Tasks)

The task system requires **two tokens** simultaneously:

| Token | Purpose | How to Obtain | Header |
|-------|---------|---------------|--------|
| `jwt_token` | Platform auth | `POST /auth/login` | `Authorization: Bearer <token>` |
| `software_token` | Per-software task auth | `POST /softaware/tasks/authenticate` | `X-Software-Token: <token>` |

Store both tokens securely. The `software_token` is specific to each software product.

### Recommended API Service Pattern

```javascript
// Mobile API service — React Native / Expo example
import * as SecureStore from 'expo-secure-store';

class ApiService {
  constructor(baseUrl = 'https://api.softaware.net.za') {
    this.baseUrl = baseUrl;
    this.token = null;
  }

  async init() {
    this.token = await SecureStore.getItemAsync('jwt_token');
  }

  async setToken(token) {
    this.token = token;
    await SecureStore.setItemAsync('jwt_token', token);
  }

  async clearToken() {
    this.token = null;
    await SecureStore.deleteItemAsync('jwt_token');
  }

  async request(method, path, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });

    if (response.status === 401) {
      const refreshed = await this.refreshToken();
      if (refreshed) return this.request(method, path, body);
      throw new Error('SESSION_EXPIRED');
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Request failed');
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/pdf')) return response.blob();

    return response.json();
  }

  async refreshToken() {
    try {
      const res = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.token}` },
      });
      if (res.ok) {
        const { token } = await res.json();
        await this.setToken(token);
        return true;
      }
    } catch (e) {}
    return false;
  }

  // Convenience methods
  get(path) { return this.request('GET', path); }
  post(path, body) { return this.request('POST', path, body); }
  put(path, body) { return this.request('PUT', path, body); }
  del(path) { return this.request('DELETE', path); }
}

export const api = new ApiService();
```

### Handling PDF Downloads (Mobile)

```javascript
// React Native — download and open invoice/quotation PDFs
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

async function downloadAndOpenPDF(type, id) {
  const url = `${BASE_URL}/${type}/${id}/pdf`;
  const fileUri = FileSystem.documentDirectory + `${type}_${id}.pdf`;

  const result = await FileSystem.downloadAsync(url, fileUri, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  await Sharing.shareAsync(result.uri, { mimeType: 'application/pdf' });
}
```

### Push Notifications (Firebase Cloud Messaging)

```javascript
// React Native / Expo — Firebase push notification setup
import messaging from '@react-native-firebase/messaging';

// 1. Request permission (iOS)
async function requestPermission() {
  const authStatus = await messaging().requestPermission();
  return authStatus === messaging.AuthorizationStatus.AUTHORIZED
      || authStatus === messaging.AuthorizationStatus.PROVISIONAL;
}

// 2. Get FCM token and register with backend
async function registerForPush(apiToken) {
  const fcmToken = await messaging().getToken();
  await fetch(`${BASE_URL}/fcm-tokens`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`,
    },
    body: JSON.stringify({
      token: fcmToken,
      device_name: DeviceInfo.getDeviceName(),
      platform: Platform.OS, // 'android' or 'ios'
    }),
  });

  // Listen for token refresh
  messaging().onTokenRefresh(async (newToken) => {
    await fetch(`${BASE_URL}/fcm-tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`,
      },
      body: JSON.stringify({ token: newToken, platform: Platform.OS }),
    });
  });
}

// 3. Handle foreground messages
messaging().onMessage(async (remoteMessage) => {
  // Show in-app notification banner
  showNotificationBanner({
    title: remoteMessage.notification?.title,
    body: remoteMessage.notification?.body,
    data: remoteMessage.data,
  });
  // Refresh notification badge count
  refreshBadgeCount();
});

// 4. Handle background/quit notification tap
messaging().onNotificationOpenedApp((remoteMessage) => {
  navigateToScreen(remoteMessage.data?.type, remoteMessage.data?.link);
});

// 5. On logout — unregister device
async function onLogout(apiToken, fcmToken) {
  await fetch(`${BASE_URL}/fcm-tokens/${encodeURIComponent(fcmToken)}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${apiToken}` },
  });
}
```

#### Push Notification Payload Structure

Notifications sent via FCM include:

```json
{
  "notification": {
    "title": "New Invoice Payment",
    "body": "Payment of R5,000 received for INV-0001"
  },
  "data": {
    "type": "payment",
    "link": "/invoices/123"
  },
  "android": {
    "priority": "high",
    "notification": {
      "channelId": "softaware_default",
      "sound": "default"
    }
  },
  "apns": {
    "payload": { "aps": { "sound": "default", "badge": 1 } }
  }
}
```

#### Fallback: Polling (when FCM unavailable)

```javascript
// Check FCM availability first
const { data } = await api.get('/fcm-tokens/status');
if (!data.fcm_enabled) {
  // Fall back to polling every 60 seconds
  setInterval(async () => {
    const { data } = await api.get('/notifications/unread/count');
    setBadgeCount(data.count);
  }, 60000);
}
```

### Offline Considerations

| Data | Cache Strategy |
|------|---------------|
| User profile | Cache on login, refresh on app resume |
| App Settings (public) | Cache on first load, refresh daily |
| Contacts list | Cache locally, sync on pull-to-refresh |
| Invoices list | Cache list, fetch detail on demand |
| Dashboard metrics | Always fetch fresh |
| Notifications | Push via FCM, poll fallback, always fetch fresh |
| Chat messages | Cache recent, paginate older on scroll |

### Permission-Based Navigation

The mobile app should use **two completely different navigation stacks** based on user type:

```javascript
// Step 1: After login, determine which navigation stack to show
function getNavigationStack(user) {
  if (user.is_admin || user.is_staff) return 'AdminStack';
  return 'PortalStack';
}

// Step 2: Define the Admin/Staff navigation stack
const AdminStack = [
  // Always visible
  { name: 'Dashboard', route: 'Dashboard', icon: 'chart-bar' },
  { name: 'Contacts', route: 'Contacts', icon: 'users' },
  { name: 'Quotations', route: 'Quotations', icon: 'file-text' },
  { name: 'Invoices', route: 'Invoices', icon: 'file-invoice' },
  { name: 'Payments', route: 'Payments', icon: 'credit-card' },
  { name: 'Transactions', route: 'Transactions', icon: 'receipt' },
  { name: 'Financial Dashboard', route: 'FinancialDashboard', icon: 'chart-pie' },
  { name: 'Reports', route: 'Reports', icon: 'chart-line' },
  { name: 'VAT Reports', route: 'VatReports', icon: 'file-contract' },
  { name: 'Pricing', route: 'Pricing', icon: 'tags' },
  { name: 'Categories', route: 'Categories', icon: 'folder' },
  { name: 'Software', route: 'Software', icon: 'code' },
  { name: 'Tasks', route: 'Tasks', icon: 'tasks' },
  { name: 'Updates', route: 'Updates', icon: 'download' },
  { name: 'Groups', route: 'Groups', icon: 'comments' },
  { name: 'Settings', route: 'Settings', icon: 'cog' },
  { name: 'Notifications', route: 'Notifications', icon: 'bell' },
  { name: 'Profile', route: 'Profile', icon: 'user' },
  // Admin section
  { name: 'Admin Dashboard', route: 'AdminDashboard', icon: 'shield', section: 'Admin' },
  { name: 'Client Manager', route: 'ClientManager', icon: 'user-shield', section: 'Admin' },
  { name: 'AI Overview', route: 'AIOverview', icon: 'brain', section: 'Admin' },
  { name: 'AI Credits', route: 'AICredits', icon: 'coins', section: 'Admin' },
  { name: 'Database', route: 'DatabaseManager', icon: 'database', section: 'Admin' },
  { name: 'Credentials', route: 'Credentials', icon: 'key', section: 'Admin' },
  // System section
  { name: 'Users', route: 'SystemUsers', icon: 'users-cog', section: 'System' },
  { name: 'Roles', route: 'SystemRoles', icon: 'user-tag', section: 'System' },
  { name: 'Permissions', route: 'SystemPermissions', icon: 'lock', section: 'System' },
  { name: 'System Settings', route: 'SystemSettings', icon: 'sliders', section: 'System' },
];

// Step 3: Define the Portal (regular user) navigation stack
const PortalStack = [
  // Always visible for portal users
  { name: 'Portal Home', route: 'PortalDashboard', icon: 'home' },
  { name: 'Assistants', route: 'Assistants', icon: 'robot' },
  { name: 'Sites', route: 'Sites', icon: 'globe' },
  { name: 'Notifications', route: 'Notifications', icon: 'bell' },
  { name: 'Profile', route: 'Profile', icon: 'user' },
  { name: 'Portal Settings', route: 'PortalSettings', icon: 'cog' },
  // Permission-gated business screens (only show if user has permission)
  { name: 'Financial Dashboard', route: 'FinancialDashboard', permission: 'view_dashboard' },
  { name: 'Contacts', route: 'Contacts', permission: 'view_contacts' },
  { name: 'Quotations', route: 'Quotations', permission: 'view_quotations' },
  { name: 'Invoices', route: 'Invoices', permission: 'view_invoices' },
  { name: 'Reports', route: 'Reports', permission: 'view_reports' },
  { name: 'Settings', route: 'Settings', permission: 'view_settings' },
  // Always visible (no permission required)
  { name: 'Transactions', route: 'Transactions' },
  { name: 'Groups', route: 'Groups' },
];

// Step 4: Filter portal screens by permission
function getVisiblePortalScreens(user) {
  return PortalStack.filter(screen => {
    if (!screen.permission) return true; // no permission required
    return user.permissions.some(p => p.slug === screen.permission);
  });
}
```

### Smart Routing After Login

```javascript
// After successful login, route to the correct home screen
function getHomeRoute(user) {
  if (user.is_admin || user.is_staff) {
    return '/dashboard';      // → Admin Dashboard (business KPIs)
  }
  return '/portal';            // → Portal Dashboard (AI assistants, usage)
}

// The /dashboard screen itself renders differently:
// - Admin/Staff see: AdminDashboard (revenue, invoices, contacts metrics)
// - Regular users see: PortalDashboard (AI credits, assistants, quick chat)
```

---

## Error Handling

### Standard Error Format

All errors follow this structure:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error description"
}
```

### HTTP Status Codes

| Status | Meaning | Description |
|--------|---------|-------------|
| `200` | OK | Request succeeded |
| `201` | Created | Resource created successfully |
| `400` | Bad Request | Invalid request parameters |
| `401` | Unauthorized | Missing or invalid authentication |
| `403` | Forbidden | Insufficient permissions (admin required) |
| `404` | Not Found | Resource doesn't exist |
| `409` | Conflict | Resource already exists (e.g., duplicate email) |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Server error |

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `INVALID_REQUEST` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Authentication required |
| `INVALID_TOKEN` | 401 | JWT token expired or invalid |
| `INVALID_API_KEY` | 401 | API key not found or inactive |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `INSUFFICIENT_CREDITS` | 402 | Not enough credits for AI request |
| `INTERNAL_ERROR` | 500 | Server error |

### Mobile Error Handling Pattern

```javascript
async function safeApiCall(fn, navigation) {
  try {
    return { success: true, data: await fn() };
  } catch (error) {
    if (error.message === 'SESSION_EXPIRED') {
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      return { success: false, error: 'Session expired. Please log in again.' };
    }
    Alert.alert('Error', error.message || 'Something went wrong');
    return { success: false, error: error.message };
  }
}

// Usage
const result = await safeApiCall(() => api.get('/contacts'), navigation);
if (result.success) {
  setContacts(result.data.contacts);
}
```

---

## Rate Limits & Quotas

### Rate Limits

| Endpoint Category | Limit | Window |
|-------------------|-------|--------|
| Authentication | 10 requests | 1 minute |
| Profile/User | 100 requests | 1 minute |
| Business (CRUD) | 200 requests | 1 minute |
| AI Services | Credit-based | N/A |
| Admin | 1000 requests | 1 minute |
| Reports | 50 requests | 1 minute |

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1709134800
```

**Rate Limit Exceeded Response:** `429 Too Many Requests`
```json
{
  "error": "RATE_LIMITED",
  "message": "Too many requests. Please try again later.",
  "retryAfterSeconds": 60
}
```

### Credit Costs (AI Services)

| Operation | Cost (credits) |
|-----------|----------------|
| Simple AI prompt | 10 |
| AI chat (with history) | 20 |
| Code generation | 50 |
| File operation | 5 |
| MCP tool call | 15 |

When balance reaches zero:
```json
{
  "error": "INSUFFICIENT_CREDITS",
  "message": "Your credit balance is insufficient. Please purchase more credits.",
  "balance": 0
}
```

---

## Security Best Practices

### 1. Token Security (Mobile)

- ✅ Store tokens in platform-specific secure storage (Keychain / Keystore)
- ✅ Use `rememberMe: true` for mobile clients (30-day tokens)
- ✅ Implement proactive token refresh before expiry
- ✅ Clear all tokens on logout
- ❌ Never store tokens in unencrypted storage (AsyncStorage, SharedPreferences)
- ❌ Never log tokens to console or crash reports

### 2. API Key Security

- ✅ Use API keys only for server-to-server integrations
- ✅ Store keys in environment variables
- ✅ Rotate keys every 90 days via `/credentials/:id/rotate`
- ❌ Never embed API keys in mobile app binaries
- ❌ Never commit keys to version control

### 3. HTTPS Only

Always use `https://api.softaware.net.za`. HTTP requests will be rejected.

### 4. Certificate Pinning (Mobile)

For production mobile apps, implement certificate pinning to prevent MITM attacks:

```javascript
// React Native example (react-native-ssl-pinning)
import { fetch } from 'react-native-ssl-pinning';

const response = await fetch(url, {
  method: 'GET',
  sslPinning: { certs: ['softaware_cert'] },
  headers: { 'Authorization': `Bearer ${token}` },
});
```

### 5. Input Validation

Always validate user input before sending to the API:

```javascript
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitizeInput(input) {
  return String(input).trim().slice(0, 500);
}
```

### 6. Exponential Backoff

Implement retry with backoff for transient errors:

```javascript
async function fetchWithRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      if (error.status === 429 || error.status >= 500) {
        await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
        continue;
      }
      throw error; // Don't retry client errors
    }
  }
}
```

---

## Changelog

### Version 4.0 (March 2026)

**Two-Factor Authentication (2FA):**
- ✨ Optional TOTP-based 2FA (Google Authenticator, Authy, etc.)
- ✨ QR code generation for authenticator app setup
- ✨ 10 one-time backup codes with SHA-256 hashing
- ✨ Modified login flow: returns `requires_2fa` + `temp_token` when 2FA enabled
- ✨ 5-minute temporary tokens for 2FA verification
- ✨ Password-confirmed disable and backup code regeneration
- 📋 Endpoints: `/auth/2fa/status`, `/setup`, `/verify-setup`, `/verify`, `/disable`, `/backup-codes`

**Firebase Cloud Messaging (Push Notifications):**
- ✨ FCM push notification support for Android, iOS, and Web
- ✨ Multi-device token management per user
- ✨ Automatic stale token cleanup on send failure
- ✨ `createNotificationWithPush()` — unified in-app + push notification helper
- ✨ Test push endpoint for verification
- ✨ Graceful degradation when Firebase not configured
- 📋 Endpoints: `/fcm-tokens` (CRUD), `/fcm-tokens/status`, `/notifications/test-push`

**Notification System Enhancements:**
- ✨ `POST /notifications` — Create notifications with optional push delivery
- ✨ Push payload includes Android channel, iOS sound/badge, custom data

### Version 3.0 (June 2025)

**Business & Billing System:**
- ✨ Contacts CRUD with nested quotation/invoice associations
- ✨ Quotations with line items, PDF generation, email, convert-to-invoice
- ✨ Invoices with line items, payment tracking, PDF generation, email, mark-paid
- ✨ Payments with processing to accounting transactions
- ✨ Full double-entry accounting (accounts, transactions, ledger, tax rates)
- ✨ Pricing/Products catalog with categories
- ✨ Expense categories for business expense classification

**Financial Reports:**
- ✨ Balance sheet, Profit & Loss, Transaction listing
- ✨ Trial balance, Income statement
- ✨ South African tax forms: VAT201, ITR14, IRP6

**Role-Based Access Control:**
- ✨ 7 pre-seeded roles with 38 granular permissions
- ✨ System Users, Roles, Permissions CRUD endpoints
- ✨ Team-based admin/staff resolution (no is_admin column)
- ✨ Permission assignment to roles, role assignment to users

**Platform Features:**
- ✨ Groups & Chat real-time messaging system
- ✨ Notification system with unread count and badge support
- ✨ App Settings (public branding + authenticated config)
- ✨ Key-value Settings store
- ✨ Credential vault with rotation, deactivation, and connectivity testing
- ✨ Database manager for admin development
- ✨ Task management proxy to external software APIs (two-token system)
- ✨ Admin dashboard with system-wide statistics
- ✨ Mobile App Integration Guide with secure storage, offline, and permission patterns

### Version 2.0 (February 2025)

**Updates System:**
- ✨ Software registry management
- ✨ Update package distribution with file upload/download
- ✨ Client heartbeat tracking with real-time status
- ✨ Remote control: force logout, server messages, client blocking
- ✨ Module management with developer assignments
- ✨ OTP-based password reset flow

### Version 1.0 (February 2025)

**Initial Release:**
- ✨ JWT authentication with `rememberMe` support (1h default, 30d extended)
- ✨ Profile self-service endpoints
- ✨ Subscription and credit management
- ✨ AI chat and simple prompt services (credit-based)
- ✨ Team management (invite, update role, remove)
- ✨ Admin operations (stats, subscription management, credit adjustments)

---

## Support

### Documentation & Resources

- **API Base URL:** `https://api.softaware.net.za`
- **Alt Prefix:** `https://api.softaware.net.za/api`
- **Status Page:** [https://status.softaware.net.za](https://status.softaware.net.za)

### Getting Help

- **Email:** [developers@softaware.net.za](mailto:developers@softaware.net.za)
- **Discord:** [https://discord.gg/softaware](https://discord.gg/softaware)

### Reporting Issues

Found a bug or security issue? Email [security@softaware.net.za](mailto:security@softaware.net.za) with:

1. Description of the issue
2. Steps to reproduce
3. Expected vs actual behavior
4. API request/response logs (redact sensitive data)

---

**© 2025 Soft Aware. All rights reserved.**

*This documentation is versioned and maintained alongside the API codebase.*