# AI Assistant Capabilities — Comprehensive Wiring Plan

**Version:** 2.1.0  
**Created:** 2026-03-06  
**Updated:** 2026-03-07  
**Scope:** Rich client assistant (leads, email follow-up, site editing), staff module tools, custom webhook system

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Architecture Overview](#3-architecture-overview)
4. [Phase 1 — Staff/Admin AI Capabilities Discovery Panel](#4-phase-1--staffadmin-ai-capabilities-discovery-panel)
5. [Phase 2 — New Staff AI Tool Definitions (Backend)](#5-phase-2--new-staff-ai-tool-definitions-backend)
6. [Phase 3 — New Staff AI Tool Executors (Backend)](#6-phase-3--new-staff-ai-tool-executors-backend)
7. [Phase 4 — Client AI Capabilities (Free + Paid)](#7-phase-4--client-ai-capabilities-free--paid) ★
8. [Phase 5 — Paid Client Webhook System](#8-phase-5--paid-client-webhook-system)
9. [Phase 6 — Staff/Admin Internal Webhook Configuration](#9-phase-6--staffadmin-internal-webhook-configuration)
10. [Phase 7 — Profile Page Frontend Changes](#10-phase-7--profile-page-frontend-changes)
11. [Database Migrations](#11-database-migrations)
12. [API Route Summary](#12-api-route-summary)
13. [Security Model](#13-security-model)
14. [File Inventory](#14-file-inventory)
15. [Implementation Checklist](#15-implementation-checklist)
16. [Rollback Plan](#16-rollback-plan)

---

## 1. Executive Summary

### Problem

The staff assistant profile tab currently shows only basic personality/voice configuration. It does **not** tell the user what their AI assistant can actually **do** — which modules it can interact with, what commands are available, or how to use it.

More critically, **client assistants are severely underserved**. A free-tier client gets a generated landing page with a contact form, but:
- Form submissions are emailed and then **lost** — they are not stored anywhere the assistant can access
- The client cannot ask their assistant "who enquired today?" or "show me the message from John"
- The client cannot say "send a follow-up email to that person" — the assistant has no email capability
- The client cannot say "update my phone number on the site" — the assistant can't edit site content
- The assistant has zero business value beyond basic chatbot admin tasks

Paid clients additionally need a way to provide their own API specifications so the assistant can interact with external systems via custom webhooks. Staff/admin need a similar internal webhook config UI.

### Solution

A three-tier approach where **even free clients get genuinely useful business tools**:

| Tier | Role | Assistant Capabilities |
|------|------|----------------------|
| **Staff/Admin** | Internal users | All 9 internal modules (Cases, Chat, Scheduling, Contacts, Pricing, Quotations, Invoices, Tasks, External Groups) + internal webhook configuration |
| **Client (Paid)** | Paid subscribers | Leads + Email Follow-up + SiteBuilder + Assistants + custom webhook integration |
| **Client (Free)** | Free subscribers | Leads + Email Follow-up + SiteBuilder (content edits + deploy) + Assistants (the full landing page business loop) |

### Implementation Status (as of 2026-03-07)

| Deliverable | Status | Notes |
|-------------|--------|-------|
| Lead Management System | ✅ **DONE** | `form_submissions` table created (migration 019), `contactFormRouter.ts` stores submissions, 4 lead tools implemented |
| Email Follow-up | ✅ **DONE** | `send_followup_email` + `send_info_email` tools working |
| SiteBuilder Content Editing | ✅ **DONE** | 6 tools: list/get/update/regenerate/deploy/history all implemented |
| Capabilities Discovery Panel | ❌ Not started | Frontend only — no code written yet |
| Staff AI tools | 🔶 **PARTIAL** | 16 of 31 planned tools implemented (see breakdown below) |
| Client AI tools | 🔶 **PARTIAL** | 12 of 13 planned tools implemented (missing `submit_lead_from_chat`) |
| Client webhook UI | ❌ Not started | Tables not created, no service/routes |
| Staff webhook UI | ❌ Not started | Same — blocked on webhook infrastructure |
| Webhook tool generator | ❌ Not started | `webhookToolGenerator.ts` not created |

### Key Deliverables

1. **Lead Management System** — ✅ New `form_submissions` table stores every contact form enquiry. Clients can discuss leads with their assistant, review enquiry details, and track follow-up status.
2. **Email Follow-up via Assistant** — ✅ Assistant can send branded follow-up emails to enquirers on command, and push conversation-gathered information back through the leads API.
3. **SiteBuilder Content Editing** — ✅ Assistant can make targeted page edits (phone number, email, tagline, about text, services) and trigger redeployment.
4. **Capabilities Discovery Panel** — ❌ New section in Profile → AI Assistant tab showing all available tools grouped by module, with usage examples.
5. **31 new staff AI tools** — 🔶 16 of 31 implemented. Covering Cases (4/6), Contacts (3/4), Quotations (2/5), Invoices (2/5), Pricing (1/3), Chat (2/3), Scheduling (2/3), External Groups (0/2).
6. **13 new client AI tools** — 🔶 12 of 13 implemented. Covering Leads (4/5), Email (2/2), SiteBuilder (6/6). Missing: `submit_lead_from_chat`.
7. **Client webhook UI (paid)** — ❌ Paid clients can provide API specs to wire their assistant to external APIs.
8. **Staff webhook UI** — ❌ Internal staff get a similar UI to configure connections to internal/external services.
9. **Webhook tool generator** — ❌ Backend dynamically generates tool definitions from user-provided API specs.

---

## 2. Current State Analysis

> **Updated 2026-03-07:** Many tools from this plan have now been implemented. This section reflects the actual current state.

### Implemented Staff Tools (in `mobileTools.ts` — 1,211 LOC)

| Tool | Module | Status | Description |
|------|--------|--------|-------------|
| `list_tasks` | Tasks | ✅ | List tasks from external software API |
| `create_task` | Tasks | ✅ | Create a task on external software API |
| `update_task` | Tasks | ✅ | Update task status/assignee/hours |
| `add_task_comment` | Tasks | ✅ | Add comment to a task |
| `search_clients` | Admin | ✅ | Search clients by name/email |
| `suspend_client_account` | Admin | ✅ | Suspend/reactivate client account |
| `check_client_health` | Admin | ✅ | View client's assistant health scores |
| `generate_enterprise_endpoint` | Admin | ✅ | Create webhook endpoint for client |
| `list_cases` | Cases | ✅ | List/search support cases |
| `get_case_details` | Cases | ✅ | Get full case details by ID |
| `update_case` | Cases | ✅ | Update case status/severity/assignment |
| `add_case_comment` | Cases | ✅ | Add comment to a case |
| `list_contacts` | CRM | ✅ | Search/list contacts |
| `get_contact_details` | CRM | ✅ | Get full contact details |
| `create_contact` | CRM | ✅ | Create a new contact |
| `list_quotations` | Finance | ✅ | List/search quotations |
| `get_quotation_details` | Finance | ✅ | Get quotation with line items |
| `list_invoices` | Finance | ✅ | List/search invoices |
| `get_invoice_details` | Finance | ✅ | Get invoice with line items + payments |
| `search_pricing` | Finance | ✅ | Search pricing items |
| `list_scheduled_calls` | Scheduling | ✅ | List upcoming scheduled calls |
| `create_scheduled_call` | Scheduling | ✅ | Schedule a new call |
| `list_conversations` | Chat | ✅ | List user's conversations |
| `send_chat_message` | Chat | ✅ | Send a message to a conversation |

### Implemented Client Tools

| Tool | Module | Status | Description |
|------|--------|--------|-------------|
| `list_my_assistants` | Assistants | ✅ | List user's AI assistants |
| `toggle_assistant_status` | Assistants | ✅ | Enable/disable an assistant |
| `get_usage_stats` | Assistants | ✅ | View usage statistics |
| `list_failed_jobs` | Assistants | ✅ | Check failed ingestion jobs |
| `retry_failed_ingestion` | Assistants | ✅ | Retry a failed job |
| `list_leads` | Leads | ✅ | List contact form enquiries |
| `get_lead_details` | Leads | ✅ | Get full lead details |
| `update_lead_status` | Leads | ✅ | Mark lead as contacted/converted/spam |
| `get_lead_stats` | Leads | ✅ | Lead pipeline summary |
| `send_followup_email` | Email | ✅ | Send follow-up to an enquirer |
| `send_info_email` | Email | ✅ | Send email to any address |
| `list_my_sites` | SiteBuilder | ✅ | List user's websites |
| `get_site_details` | SiteBuilder | ✅ | Get full site configuration |
| `update_site_field` | SiteBuilder | ✅ | Update a content field on the site |
| `regenerate_site` | SiteBuilder | ✅ | Rebuild HTML/CSS from current data |
| `deploy_site` | SiteBuilder | ✅ | Deploy via FTP/SFTP |
| `get_site_deployments` | SiteBuilder | ✅ | View deployment history |

### Current Tool Counts (Actual)

| Category | Count |
|----------|-------|
| Client tools (all tiers) | **17** (5 core + 4 leads + 2 email + 6 site) |
| Staff-only tools | **24** (8 admin/tasks + 4 cases + 3 CRM + 5 finance + 2 scheduling + 2 chat) |
| **Staff total (client + staff)** | **41** |
| **Grand total** | **41 tools** |

### Still Missing (Planned but Not Yet Implemented)

**Staff tools still to build (15 remaining):**
- Cases: `create_case`, `get_case_stats` (2 missing)
- Contacts: `get_contact_statement` (1 missing)
- Quotations: `create_quotation`, `convert_to_invoice`, `email_quotation` (3 missing)
- Invoices: `create_invoice`, `record_payment`, `email_invoice` (3 missing)
- Pricing: `create_pricing_item`, `update_pricing_item` (2 missing)
- Chat: `search_chat_messages` (1 missing)
- Scheduling: `cancel_scheduled_call` (1 missing)
- External Groups: `list_external_groups`, `send_external_group_message` (2 missing — entire module)

**Client tools still to build (1 remaining):**
- Leads: `submit_lead_from_chat` (1 missing)

**Infrastructure not yet built:**
- Webhook system (tables, service, routes, frontend) — entire Phase 5/6
- Capabilities Discovery Panel frontend — entire Phase 2
- Profile page sub-tabs (Config | Capabilities | Webhooks) — Phase 7

### Existing Infrastructure

| Component | Status | Location | LOC |
|-----------|--------|----------|-----|
| `mobileTools.ts` | ✅ 41 tools | Tool definitions + `getToolsForRole()` | 1,211 |
| `mobileActionExecutor.ts` | ✅ 41 executors | Tool executors + `executeMobileAction()` switch | 2,127 |
| `mobileAIProcessor.ts` | ✅ Working | Ollama conversation loop, `TOOLS_OLLAMA_MODEL`, keep_alive fix | 384 |
| `myAssistant.ts` route | ✅ Exists | Assistant CRUD for staff+clients | — |
| `staffAssistant.ts` route | ✅ Deprecated | Legacy (use myAssistant.ts) | — |
| `enterpriseEndpoints.ts` | ✅ Exists | Dynamic webhook service (SQLite) | — |
| `contactFormRouter.ts` | ✅ **Updated** | `POST /v1/leads/submit` — now **stores** submissions in `form_submissions` AND emails | — |
| `emailService.ts` service | ✅ Exists | Shared SMTP email sender with logging to `email_log` table | — |
| `siteBuilder.ts` route | ✅ Exists | Full CRUD + generate + deploy + AI generation | 593 |
| `siteBuilderService.ts` | ✅ Exists | Site generation, static files, FTP deploy | 590 |
| `019_assistant_capabilities.ts` | ✅ **Migrated** | Creates `form_submissions` table + `tool_preferences` column | 72 |
| Profile.tsx assistant tab | ✅ Working | Personality/voice config + chat persistence + AI flare | 1,695 |

---

## 3. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           PROFILE → AI ASSISTANT TAB                             │
│                                                                                  │
│  ┌────────────────────┐  ┌──────────────────────┐  ┌──────────────────────────┐ │
│  │ Personality Config  │  │ Capabilities Panel    │  │ Webhook Config           │ │
│  │ (existing)          │  │ (NEW)                 │  │ (NEW — paid/staff)       │ │
│  │ • Name, greeting    │  │ • Module grid         │  │ • API spec upload        │ │
│  │ • Voice style       │  │ • Tool cards          │  │ • Manual endpoint def    │ │
│  │ • Preferred model   │  │ • Usage examples      │  │ • Auth configuration     │ │
│  │ • Personality flare │  │ • Enable/disable      │  │ • Test connection        │ │
│  └────────────────────┘  └──────────────────────┘  └──────────────────────────┘ │
│                                                                                  │
│  Staff/Admin: ALL modules + internal webhook config                              │
│  Client (Paid): Leads + Email + SiteBuilder + Assistants + webhook config        │
│  Client (Free): Leads + Email + SiteBuilder + Assistants (full business loop)    │
└──────────────────────────┬───────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                      BACKEND — TOOL INFRASTRUCTURE                               │
│                                                                                  │
│  mobileTools.ts                    mobileActionExecutor.ts                       │
│  ┌────────────────────────┐       ┌──────────────────────────────┐               │
│  │ getToolsForRole(role)  │       │ executeMobileAction(call,ctx)│               │
│  │                        │       │                              │               │
│  │ Staff: 24 implemented  │       │ switch(name) {               │               │
│  │      + 15 remaining    │       │   case 'list_leads': ...     │               │
│  │      + N webhook tools │       │   case 'send_followup': ...  │               │
│  │                        │       │   case 'update_site': ...    │               │
│  │ Client: 17 implemented │       │   case 'list_cases': ...     │               │
│  │       + 1 remaining    │       │   case 'webhook_*': ...      │               │
│  │       + N webhook tools│       │ }                            │               │
│  └────────────────────────┘       └──────────────────────────────┘               │
│                                                                                  │
│  ┌─── CLIENT BUSINESS LOOP (Free Tier) ──────────────────────────────────────┐  │
│  │                                                                            │  │
│  │   Landing Page ──POST──▶ /v1/leads/submit ──▶ form_submissions table      │  │
│  │        ▲                                           │                       │  │
│  │        │                                           ▼                       │  │
│  │   update_site_field ◀── AI ──▶ list_leads / get_lead_details              │  │
│  │   deploy_site               │                                              │  │
│  │                              ▼                                              │  │
│  │                     send_followup_email ──▶ emailService ──▶ enquirer      │  │
│  │                     submit_lead_from_chat ──▶ form_submissions (AI-gen)    │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  webhookToolGenerator.ts (NEW — paid/staff only)                                 │
│  ┌──────────────────────────────────────────────────────────────┐                │
│  │ generateToolsFromSpec(apiSpec) → ToolDefinition[]             │                │
│  │ executeWebhookTool(endpoint, method, params) → ToolResult    │                │
│  │ parseOpenAPISpec(json) → NormalizedEndpoint[]                 │                │
│  │ parseManualEndpoints(entries) → NormalizedEndpoint[]          │                │
│  └──────────────────────────────────────────────────────────────┘                │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Phase 1 — Staff/Admin AI Capabilities Discovery Panel

### Purpose

Replace the bare-bones assistant config with a rich panel that shows staff/admin users exactly what their AI can do, grouped by module.

### Module Capability Cards

Each module card shows:
- **Module icon + name** (color-coded)
- **Tool count** ("6 voice commands available")
- **Example phrases** (what to say to trigger each tool)
- **Status badge** (Active / Coming Soon)
- **Enable/disable toggle** (stored per-assistant in `tool_preferences` JSON column)

### Staff/Admin Module Grid

| Module | Icon | Color | Tools | Example Phrases |
|--------|------|-------|-------|----------------|
| **Cases** | 🐛 BugAntIcon | Red | 6 | "Show open cases", "Create a bug report", "Assign case 42 to John" |
| **Contacts** | 👤 UserGroupIcon | Blue | 4 | "Find customer Acme", "Add new supplier", "Show contact details for John" |
| **Quotations** | 📄 DocumentTextIcon | Purple | 5 | "Create a quotation for Acme", "List pending quotes", "Convert quote 110 to invoice" |
| **Invoices** | 💰 BanknotesIcon | Green | 5 | "Show unpaid invoices", "Record payment on INV-00042", "Email invoice to client" |
| **Pricing** | 🏷️ TagIcon | Amber | 3 | "Search for tiling prices", "Add a new pricing item", "Update price for item 55" |
| **Tasks** | ✅ ClipboardDocumentCheckIcon | Indigo | 4 | "Show my tasks", "Create a bug-fix task", "Mark task 12 as completed" |
| **Chat** | 💬 ChatBubbleLeftRightIcon | Teal | 3 | "Send message to John", "Show unread conversations", "List my recent chats" |
| **Scheduling** | 📅 CalendarDaysIcon | Orange | 3 | "Schedule a call with the team", "Show upcoming meetings", "Cancel tomorrow's call" |
| **External Groups** | 🌐 GlobeAltIcon | Cyan | 2 | "Show my groups", "Send message to WhatsApp group" |

### Client Module Grid (Free + Paid)

| Module | Icon | Color | Tools | Example Phrases |
|--------|------|-------|-------|----------------|
| **Leads & Enquiries** | 📬 InboxIcon | Rose | 5 | "Show today's enquiries", "What did John ask about?", "Mark that lead as contacted" |
| **Email Follow-up** | ✉️ EnvelopeIcon | Sky | 2 | "Send a follow-up to John with our pricing", "Email that enquirer back thanking them" |
| **Website Builder** | 🌐 GlobeAltIcon | Emerald | 6 | "Update my phone number to 082 555 1234", "Change the about section", "Deploy my site" |
| **AI Assistants** | ✨ SparklesIcon | Blue | 5 | "Show my bots", "Turn off my assistant", "What's my usage?" |
| **Webhooks** *(paid only)* | 🔗 LinkIcon | Violet | N | "Call my store API for orders", "Check inventory" |

### Frontend Component: `AssistantCapabilitiesPanel.tsx`

```typescript
// NEW FILE: src/components/profile/AssistantCapabilitiesPanel.tsx
// ~280 LOC

interface ModuleCapability {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  color: string;             // Tailwind color class
  description: string;
  tools: ToolCapability[];
  status: 'active' | 'coming_soon';
}

interface ToolCapability {
  name: string;              // Tool function name
  label: string;             // Human-readable label
  description: string;       // What it does
  examplePhrases: string[];  // Voice/text trigger examples
  enabled: boolean;          // User toggle
}

// Renders a responsive grid of module cards
// Each card expands on click to show tools + examples
// Toggle switches stored in assistant.tool_preferences
```

### Data Source

Tool capability metadata is defined in a **static config** on the frontend. The backend enforces which tools are actually available based on role — the frontend config is purely for UI display.

```typescript
// NEW FILE: src/config/assistantCapabilities.ts
// ~200 LOC — Static module/tool metadata for the capabilities panel

export const STAFF_CAPABILITIES: ModuleCapability[] = [
  {
    id: 'cases',
    name: 'Cases & Issues',
    icon: BugAntIcon,
    color: 'red',
    description: 'Create, manage, and resolve support cases and bug reports',
    status: 'active',
    tools: [
      {
        name: 'list_cases',
        label: 'List Cases',
        description: 'View open cases filtered by status, severity, or assignee',
        examplePhrases: ['Show open cases', 'List critical bugs', 'What cases are assigned to me?'],
        enabled: true,
      },
      // ... more tools
    ],
  },
  // ... more modules
];

export const CLIENT_CAPABILITIES: ModuleCapability[] = [
  {
    id: 'assistants',
    name: 'AI Assistants',
    icon: SparklesIcon,
    color: 'blue',
    // ...
  },
  {
    id: 'site_builder',
    name: 'Website Builder',
    icon: GlobeAltIcon,
    color: 'emerald',
    // ...
  },
];
```

---

## 5. Phase 2 — New Staff AI Tool Definitions (Backend)

### New tools to add to `mobileTools.ts`

All new tools follow the existing OpenAI-compatible function-calling format.

### 5.1 Cases Module Tools (6 tools)

```typescript
// list_cases — List/search cases with filters
{
  name: 'list_cases',
  parameters: {
    status: { enum: ['open','in_progress','waiting','resolved','closed','wont_fix'] },
    severity: { enum: ['low','medium','high','critical'] },
    assigned_to_me: { enum: ['true','false'] },
    limit: { type: 'string', description: 'Max results (default 10)' },
  },
  required: [],
}

// get_case — Get full case details by ID
{
  name: 'get_case',
  parameters: {
    case_id: { type: 'string', description: 'Case ID number' },
  },
  required: ['case_id'],
}

// create_case — Create a new case
{
  name: 'create_case',
  parameters: {
    title: { type: 'string' },
    description: { type: 'string' },
    severity: { enum: ['low','medium','high','critical'] },
    category: { enum: ['bug','performance','ui_issue','data_issue','security','feature_request','other'] },
  },
  required: ['title', 'severity', 'category'],
}

// update_case — Update case status/severity/assignment
{
  name: 'update_case',
  parameters: {
    case_id: { type: 'string' },
    status: { enum: ['open','in_progress','waiting','resolved','closed','wont_fix'] },
    severity: { enum: ['low','medium','high','critical'] },
    assigned_to: { type: 'string', description: 'User ID to assign to' },
  },
  required: ['case_id'],
}

// add_case_comment — Add a comment (public or internal)
{
  name: 'add_case_comment',
  parameters: {
    case_id: { type: 'string' },
    content: { type: 'string' },
    is_internal: { enum: ['true','false'], description: 'Internal = staff-only' },
  },
  required: ['case_id', 'content'],
}

// get_case_stats — Get case analytics summary
{
  name: 'get_case_stats',
  parameters: {},
  required: [],
}
```

### 5.2 Contacts Module Tools (4 tools)

```typescript
// list_contacts — Search/list contacts
{
  name: 'list_contacts',
  parameters: {
    search: { type: 'string', description: 'Search by name, email, or company' },
    type: { enum: ['customer','supplier','all'] },
    limit: { type: 'string' },
  },
  required: [],
}

// get_contact — Get full contact details
{
  name: 'get_contact',
  parameters: {
    contact_id: { type: 'string' },
  },
  required: ['contact_id'],
}

// create_contact — Create a new contact
{
  name: 'create_contact',
  parameters: {
    company_name: { type: 'string' },
    contact_person: { type: 'string' },
    email: { type: 'string' },
    phone: { type: 'string' },
    contact_type: { enum: ['1','2'], description: '1=customer, 2=supplier' },
  },
  required: ['company_name', 'contact_type'],
}

// get_contact_statement — Get financial statement for contact
{
  name: 'get_contact_statement',
  parameters: {
    contact_id: { type: 'string' },
  },
  required: ['contact_id'],
}
```

### 5.3 Quotations Module Tools (5 tools)

```typescript
// list_quotations — List/search quotations
{
  name: 'list_quotations',
  parameters: {
    search: { type: 'string' },
    status: { enum: ['draft','sent','accepted'] },
    limit: { type: 'string' },
  },
  required: [],
}

// get_quotation — Get quotation details with line items
{
  name: 'get_quotation',
  parameters: {
    quotation_id: { type: 'string' },
  },
  required: ['quotation_id'],
}

// create_quotation — Create a new quotation
{
  name: 'create_quotation',
  parameters: {
    contact_id: { type: 'string', description: 'Customer contact ID' },
    remarks: { type: 'string' },
    items: { type: 'string', description: 'JSON array of {item_name, quantity, unit_price, description}' },
  },
  required: ['contact_id'],
}

// convert_to_invoice — Convert accepted quotation to invoice
{
  name: 'convert_to_invoice',
  parameters: {
    quotation_id: { type: 'string' },
  },
  required: ['quotation_id'],
}

// email_quotation — Email quotation PDF to customer
{
  name: 'email_quotation',
  parameters: {
    quotation_id: { type: 'string' },
    email: { type: 'string', description: 'Override recipient email (optional)' },
  },
  required: ['quotation_id'],
}
```

### 5.4 Invoices Module Tools (5 tools)

```typescript
// list_invoices — List/search invoices
{
  name: 'list_invoices',
  parameters: {
    search: { type: 'string' },
    status: { enum: ['unpaid','partial','paid'] },
    limit: { type: 'string' },
  },
  required: [],
}

// get_invoice — Get invoice details with line items and payments
{
  name: 'get_invoice',
  parameters: {
    invoice_id: { type: 'string' },
  },
  required: ['invoice_id'],
}

// create_invoice — Create a new invoice
{
  name: 'create_invoice',
  parameters: {
    contact_id: { type: 'string', description: 'Customer contact ID' },
    remarks: { type: 'string' },
    items: { type: 'string', description: 'JSON array of {item_name, quantity, unit_price, description}' },
  },
  required: ['contact_id'],
}

// record_payment — Record a payment on an invoice
{
  name: 'record_payment',
  parameters: {
    invoice_id: { type: 'string' },
    amount: { type: 'string', description: 'Payment amount in ZAR' },
    payment_method: { type: 'string', description: 'e.g. EFT, Cash, Card' },
    reference: { type: 'string', description: 'Payment reference number' },
  },
  required: ['invoice_id', 'amount'],
}

// email_invoice — Email invoice PDF to customer
{
  name: 'email_invoice',
  parameters: {
    invoice_id: { type: 'string' },
    email: { type: 'string', description: 'Override recipient email (optional)' },
  },
  required: ['invoice_id'],
}
```

### 5.5 Pricing Module Tools (3 tools)

```typescript
// search_pricing — Search pricing items
{
  name: 'search_pricing',
  parameters: {
    search: { type: 'string', description: 'Search by item name or description' },
    category: { type: 'string', description: 'Filter by category name' },
    limit: { type: 'string' },
  },
  required: [],
}

// create_pricing_item — Add a new pricing item
{
  name: 'create_pricing_item',
  parameters: {
    item_name: { type: 'string' },
    unit_price: { type: 'string', description: 'Price in ZAR' },
    unit: { type: 'string', description: 'e.g. m², each, per hour' },
    category: { type: 'string' },
    notes: { type: 'string' },
  },
  required: ['item_name', 'unit_price'],
}

// update_pricing_item — Update an existing pricing item
{
  name: 'update_pricing_item',
  parameters: {
    item_id: { type: 'string' },
    item_name: { type: 'string' },
    unit_price: { type: 'string' },
    unit: { type: 'string' },
    notes: { type: 'string' },
  },
  required: ['item_id'],
}
```

### 5.6 Chat Module Tools (3 tools)

```typescript
// list_conversations — List user's recent conversations
{
  name: 'list_conversations',
  parameters: {
    type: { enum: ['direct','group','all'] },
    limit: { type: 'string' },
  },
  required: [],
}

// send_chat_message — Send a message to a conversation
{
  name: 'send_chat_message',
  parameters: {
    conversation_id: { type: 'string', description: 'Conversation ID. Use list_conversations first.' },
    content: { type: 'string', description: 'The message text' },
  },
  required: ['conversation_id', 'content'],
}

// search_chat_messages — Search across chat history
{
  name: 'search_chat_messages',
  parameters: {
    query: { type: 'string', description: 'Text to search for' },
    limit: { type: 'string' },
  },
  required: ['query'],
}
```

### 5.7 Scheduling Module Tools (3 tools)

```typescript
// list_scheduled_calls — List upcoming scheduled calls
{
  name: 'list_scheduled_calls',
  parameters: {
    status: { enum: ['upcoming','scheduled','active','completed','cancelled','all'] },
  },
  required: [],
}

// create_scheduled_call — Schedule a new call
{
  name: 'create_scheduled_call',
  parameters: {
    conversation_id: { type: 'string' },
    title: { type: 'string' },
    scheduled_at: { type: 'string', description: 'ISO datetime e.g. 2026-03-10T14:00:00Z' },
    call_type: { enum: ['voice','video'] },
    duration_minutes: { type: 'string' },
    recurrence: { enum: ['none','daily','weekly','biweekly','monthly'] },
  },
  required: ['conversation_id', 'title', 'scheduled_at', 'call_type'],
}

// cancel_scheduled_call — Cancel a scheduled call
{
  name: 'cancel_scheduled_call',
  parameters: {
    call_id: { type: 'string' },
  },
  required: ['call_id'],
}
```

### 5.8 External Groups Module Tools (2 tools)

```typescript
// list_external_groups — List available external WhatsApp groups
{
  name: 'list_external_groups',
  parameters: {},
  required: [],
}

// send_external_group_message — Send message to an external group
{
  name: 'send_external_group_message',
  parameters: {
    group_id: { type: 'string', description: 'External group ID' },
    message: { type: 'string' },
  },
  required: ['group_id', 'message'],
}
```

### Tool Count Summary

> **Updated 2026-03-07:** Shows planned vs actually implemented.

| Category | Planned | Implemented | Remaining |
|----------|---------|-------------|----------|
| Staff: Admin | 4 | 4 | 0 |
| Staff: Tasks | 4 | 4 | 0 |
| Staff: Cases | **6** | 4 | 2 (`create_case`, `get_case_stats`) |
| Staff: Contacts | **4** | 3 | 1 (`get_contact_statement`) |
| Staff: Quotations | **5** | 2 | 3 (`create_quotation`, `convert_to_invoice`, `email_quotation`) |
| Staff: Invoices | **5** | 2 | 3 (`create_invoice`, `record_payment`, `email_invoice`) |
| Staff: Pricing | **3** | 1 | 2 (`create_pricing_item`, `update_pricing_item`) |
| Staff: Chat | **3** | 2 | 1 (`search_chat_messages`) |
| Staff: Scheduling | **3** | 2 | 1 (`cancel_scheduled_call`) |
| Staff: External Groups | **2** | 0 | 2 (entire module) |
| **Staff Total** | **39** | **24** | **15** |
| Client: Assistants | 5 | 5 | 0 |
| Client: SiteBuilder | **4** | **6** | 0 (expanded from plan) |
| Client: Webhook (paid) | **dynamic** | 0 | N |
| **Client Total** | **9+N** | **17** | **1+N** |

---

## 6. Phase 3 — New Staff AI Tool Executors (Backend)

### Executor Pattern

Every executor follows the existing pattern in `mobileActionExecutor.ts`:

```typescript
async function execListCases(args: Record<string, any>, ctx: MobileExecutionContext): Promise<ToolResult> {
  // 1. Parse args
  const status = args.status || null;
  const severity = args.severity || null;
  const limit = parseInt(args.limit || '10', 10);
  
  // 2. Query database
  let sql = 'SELECT c.*, u.username as assignee_name FROM cases c LEFT JOIN users u ON c.assigned_to = u.id WHERE 1=1';
  const params: any[] = [];
  if (status) { sql += ' AND c.status = ?'; params.push(status); }
  if (severity) { sql += ' AND c.severity = ?'; params.push(severity); }
  if (args.assigned_to_me === 'true') { sql += ' AND c.assigned_to = ?'; params.push(ctx.userId); }
  sql += ' ORDER BY c.created_at DESC LIMIT ?';
  params.push(limit);
  
  const cases = await db.query(sql, params);
  
  // 3. Format result
  if (cases.length === 0) return { success: true, message: 'No cases found matching your criteria.' };
  
  const lines = cases.map((c: any) =>
    `#${c.id} [${c.severity}/${c.status}] ${c.title} — assigned to ${c.assignee_name || 'unassigned'}`
  );
  return { success: true, message: `Found ${cases.length} cases:\n${lines.join('\n')}` };
}
```

### Executor Registration in `switch` Block

Add all new cases to the `executeMobileAction` dispatcher:

```typescript
// Cases
case 'list_cases':       return requireStaff(ctx, () => execListCases(args, ctx));
case 'get_case':         return requireStaff(ctx, () => execGetCase(args));
case 'create_case':      return requireStaff(ctx, () => execCreateCase(args, ctx));
case 'update_case':      return requireStaff(ctx, () => execUpdateCase(args, ctx));
case 'add_case_comment': return requireStaff(ctx, () => execAddCaseComment(args, ctx));
case 'get_case_stats':   return requireStaff(ctx, () => execGetCaseStats());

// Contacts
case 'list_contacts':          return requireStaff(ctx, () => execListContacts(args));
case 'get_contact':            return requireStaff(ctx, () => execGetContact(args));
case 'create_contact':         return requireStaff(ctx, () => execCreateContact(args));
case 'get_contact_statement':  return requireStaff(ctx, () => execGetContactStatement(args));

// Quotations
case 'list_quotations':        return requireStaff(ctx, () => execListQuotations(args));
case 'get_quotation':          return requireStaff(ctx, () => execGetQuotation(args));
case 'create_quotation':       return requireStaff(ctx, () => execCreateQuotation(args, ctx));
case 'convert_to_invoice':     return requireStaff(ctx, () => execConvertToInvoice(args));
case 'email_quotation':        return requireStaff(ctx, () => execEmailQuotation(args));

// Invoices
case 'list_invoices':          return requireStaff(ctx, () => execListInvoices(args));
case 'get_invoice':            return requireStaff(ctx, () => execGetInvoice(args));
case 'create_invoice':         return requireStaff(ctx, () => execCreateInvoice(args, ctx));
case 'record_payment':         return requireStaff(ctx, () => execRecordPayment(args));
case 'email_invoice':          return requireStaff(ctx, () => execEmailInvoice(args));

// Pricing
case 'search_pricing':         return requireStaff(ctx, () => execSearchPricing(args));
case 'create_pricing_item':    return requireStaff(ctx, () => execCreatePricingItem(args));
case 'update_pricing_item':    return requireStaff(ctx, () => execUpdatePricingItem(args));

// Chat
case 'list_conversations':     return requireStaff(ctx, () => execListConversations(args, ctx));
case 'send_chat_message':      return requireStaff(ctx, () => execSendChatMessage(args, ctx));
case 'search_chat_messages':   return requireStaff(ctx, () => execSearchChatMessages(args, ctx));

// Scheduling
case 'list_scheduled_calls':   return requireStaff(ctx, () => execListScheduledCalls(args, ctx));
case 'create_scheduled_call':  return requireStaff(ctx, () => execCreateScheduledCall(args, ctx));
case 'cancel_scheduled_call':  return requireStaff(ctx, () => execCancelScheduledCall(args, ctx));

// External Groups (no direct DB — proxy approach)
case 'list_external_groups':         return requireStaff(ctx, () => execListExternalGroups(ctx));
case 'send_external_group_message':  return requireStaff(ctx, () => execSendExternalGroupMessage(args, ctx));

// Dynamic webhook tools
default:
  if (name.startsWith('webhook_')) {
    return await execWebhookTool(name, args, ctx);
  }
  return { success: false, message: `Unknown tool: ${name}` };
```

### External Groups Special Case

External Groups has **no backend routes** — it connects directly via Socket.IO to a remote server. The tool executors will:
1. Read the webhook URL from `sys_settings` (key: `silulumanzi_chat_url`)
2. Make an HTTP request to the remote server's REST API (if available) or emit a Socket.IO event server-side
3. Return the result

If the remote server has no REST API, these tools will return a message directing the user to use the web UI instead.

---

## 7. Phase 4 — Client AI Capabilities (Free + Paid)

### Design Philosophy

The **free tier must deliver real business value**. A client creates a landing page with a contact form. From that point, the full lifecycle should be AI-assisted:

1. **Someone fills out the contact form** → submission is stored + emailed to owner
2. **Client asks assistant** "who enquired today?" → sees all leads with details
3. **Client discusses the lead** with the assistant, gathers context
4. **Client says** "send them a follow-up email thanking them and attaching our pricing" → assistant sends email
5. **Client says** "update my phone number to 082 555 1234 and redeploy" → assistant edits the page and deploys

This is the **Client Business Loop** — all available on free tier.

### 7.1 Prerequisite — Store Contact Form Submissions (✅ IMPLEMENTED)

**Problem:** `POST /v1/leads/submit` in `contactFormRouter.ts` previously emailed the submission to the site owner and discarded the data. The assistant had nothing to query.

**Fix (DONE):** Created `form_submissions` table (migration 019) and modified `contactFormRouter.ts` to INSERT before emailing.

```sql
-- Actual schema (differs slightly from original plan)
CREATE TABLE form_submissions (
  id              VARCHAR(36) PRIMARY KEY,
  site_id         VARCHAR(36) NOT NULL,
  sender_name     VARCHAR(255) NOT NULL,
  sender_email    VARCHAR(255) NOT NULL,
  sender_phone    VARCHAR(50),
  message         TEXT NOT NULL,
  source_page     VARCHAR(500),
  ip_address      VARCHAR(45),
  honeypot_triggered TINYINT(1) DEFAULT 0,
  status          ENUM('new','contacted','converted','spam') DEFAULT 'new',
  notes           TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_fs_site_id    (site_id),
  INDEX idx_fs_status     (status),
  INDEX idx_fs_created_at (created_at),
  INDEX idx_fs_email      (sender_email)
);
```

**Actual changes to `contactFormRouter.ts` (done):**
- Both the plain leads route and widget-client leads route now INSERT into `form_submissions` before sending the notification email
- Honeypot field (`website`) is detected and stored as `honeypot_triggered = 1`
- Ownership is derived via `site_id → generated_sites.user_id` (no `user_id` column on `form_submissions`)

### 7.2 Lead Management Tools (5 tools) — Free Tier

```typescript
// list_leads — List recent form submissions / enquiries
{
  name: 'list_leads',
  description: 'List contact form enquiries from your website. Shows who enquired, when, and their message. Use when the user asks "who enquired today", "show me my leads", "any new messages from my site", etc.',
  parameters: {
    status: { enum: ['new','contacted','qualified','closed','all'], description: 'Filter by lead status. Default: all' },
    search: { type: 'string', description: 'Search by name, email, or message content' },
    days: { type: 'string', description: 'Show leads from the last N days (default: 30)' },
    limit: { type: 'string', description: 'Max results (default: 15)' },
  },
  required: [],
}

// get_lead_details — Get full details of a specific enquiry
{
  name: 'get_lead_details',
  description: 'Get the full details of a specific contact form submission — name, email, phone, their message, follow-up history, and any notes. Use when the user says "tell me more about that enquiry", "what did John ask about", etc.',
  parameters: {
    lead_id: { type: 'string', description: 'The submission ID. Use list_leads first if needed.' },
  },
  required: ['lead_id'],
}

// update_lead_status — Mark a lead as contacted/qualified/closed
{
  name: 'update_lead_status',
  description: 'Update the status of a lead. Use when the user says "mark that as contacted", "close that lead", "qualify that enquiry", etc.',
  parameters: {
    lead_id: { type: 'string' },
    status: { enum: ['new','contacted','qualified','closed'] },
    notes: { type: 'string', description: 'Optional note about the status change' },
  },
  required: ['lead_id', 'status'],
}

// submit_lead_from_chat — Create a lead entry from information gathered in conversation
{
  name: 'submit_lead_from_chat',
  description: 'Save information gathered during this conversation as a new lead. Use when the assistant has collected contact details (name, email, phone, interest) from the AI chat and the user wants to store it as a formal enquiry.',
  parameters: {
    name: { type: 'string', description: 'Contact person name' },
    email: { type: 'string', description: 'Email address' },
    phone: { type: 'string', description: 'Phone number (optional)' },
    message: { type: 'string', description: 'Summary of what they enquired about' },
    site_id: { type: 'string', description: 'Site ID to associate with (optional — uses default site)' },
  },
  required: ['name', 'email', 'message'],
}

// get_lead_stats — Quick summary of lead pipeline
{
  name: 'get_lead_stats',
  description: 'Get a summary of your leads pipeline: how many new, contacted, qualified, closed. Use when the user asks "how are my leads doing", "give me a summary", "how many enquiries this month", etc.',
  parameters: {
    days: { type: 'string', description: 'Look-back period in days (default: 30)' },
  },
  required: [],
}
```

### 7.3 Email Follow-up Tools (2 tools) — Free Tier

These use the shared `emailService.ts` (which loads SMTP config from `sys_settings` → env fallback, with logging to `email_log`).

```typescript
// send_followup_email — Send a follow-up email to an enquirer
{
  name: 'send_followup_email',
  description: 'Send a follow-up email to someone who submitted a contact form enquiry. The assistant composes the email based on the conversation context. Use when the user says "send them a follow-up", "email John back", "thank that person and send our pricing info", etc.',
  parameters: {
    lead_id: { type: 'string', description: 'The submission/lead ID to follow up on. Use list_leads first if needed.' },
    subject: { type: 'string', description: 'Email subject line' },
    body: { type: 'string', description: 'Email body (plain text). The assistant should compose this based on the conversation.' },
    reply_to: { type: 'string', description: 'Override reply-to email (optional — defaults to site owner email)' },
  },
  required: ['lead_id', 'subject', 'body'],
}

// send_info_email — Send an email to any address (not tied to a lead)
{
  name: 'send_info_email',
  description: 'Send an email to any address. Use when the user wants to send information gathered from the conversation to someone specific, or send a general business email.',
  parameters: {
    to_email: { type: 'string', description: 'Recipient email address' },
    to_name: { type: 'string', description: 'Recipient name (for greeting)' },
    subject: { type: 'string', description: 'Email subject line' },
    body: { type: 'string', description: 'Email body (plain text)' },
  },
  required: ['to_email', 'subject', 'body'],
}
```

**Executor logic for `send_followup_email`:**
```typescript
async function execSendFollowupEmail(args: Record<string, any>, ctx: MobileExecutionContext): Promise<ToolResult> {
  const leadId = String(args.lead_id || '');
  if (!leadId) return { success: false, message: 'Please provide the lead ID.' };

  // 1. Look up the lead + verify ownership
  const lead = await db.queryOne(
    'SELECT * FROM form_submissions WHERE id = ? AND user_id = ?',
    [leadId, ctx.userId]
  );
  if (!lead) return { success: false, message: 'Lead not found or you don\'t own it.' };

  // 2. Get the site owner's details for "from" name
  const owner = await db.queryOne('SELECT name, email FROM users WHERE id = ?', [ctx.userId]);

  // 3. Get the site name for branding
  const site = await db.queryOne('SELECT business_name, contact_email FROM generated_sites WHERE id = ?', [lead.site_id]);

  // 4. Send via shared emailService
  const fromName = site?.business_name || owner?.name || 'Support';
  const replyTo = args.reply_to || site?.contact_email || owner?.email;

  await sendEmail({
    to: lead.submitter_email,
    subject: String(args.subject),
    text: String(args.body),
    from: `"${fromName}" <noreply@softaware.net.za>`,
    replyTo,
  });

  // 5. Update lead tracking
  await db.execute(
    `UPDATE form_submissions SET status = 'contacted', follow_up_count = follow_up_count + 1, last_followed_up_at = NOW() WHERE id = ?`,
    [leadId]
  );

  return {
    success: true,
    message: `✉️ Follow-up email sent to **${lead.submitter_name || lead.submitter_email}**.\nSubject: ${args.subject}\n\nLead status updated to "contacted".`,
  };
}
```

### 7.4 SiteBuilder Tools (6 tools) — Free Tier

The previous plan had 4 superficial tools. This version gives the assistant **actual content editing power**.

```typescript
// list_my_sites — List user's generated websites
{
  name: 'list_my_sites',
  description: 'List your generated websites with their status, business name, and deployment info. Use when the user asks "show my sites", "what websites do I have", etc.',
  parameters: {},
  required: [],
}

// get_site_details — Get full site configuration
{
  name: 'get_site_details',
  description: 'Get the full details of a specific website: business name, tagline, about text, services, contact info, theme, and deployment status. Use before making edits so you know the current values.',
  parameters: {
    site_id: { type: 'string', description: 'Site ID. Use list_my_sites first if needed.' },
  },
  required: ['site_id'],
}

// update_site_field — Update a specific field on the site
{
  name: 'update_site_field',
  description: 'Update a content field on your website. Can change phone number, email, tagline, about us text, services list, business name, or theme color. Use when the user says "change my phone number", "update the about section", "change my tagline to ...", etc.',
  parameters: {
    site_id: { type: 'string', description: 'Site ID' },
    field: {
      type: 'string',
      enum: ['business_name','tagline','about_us','services','contact_email','contact_phone','theme_color'],
      description: 'Which field to update',
    },
    value: { type: 'string', description: 'The new value for the field' },
  },
  required: ['site_id', 'field', 'value'],
}

// regenerate_site — Regenerate the static HTML/CSS files with current content
{
  name: 'regenerate_site',
  description: 'Regenerate the static website files after content changes. This rebuilds the HTML/CSS from the current site data. Use after update_site_field before deploying.',
  parameters: {
    site_id: { type: 'string' },
  },
  required: ['site_id'],
}

// deploy_site — Deploy the site via SFTP to the configured server
{
  name: 'deploy_site',
  description: 'Deploy your website to the live server via SFTP. Run this after regenerate_site to push changes live. Use when the user says "deploy my site", "publish the changes", "push it live", etc.',
  parameters: {
    site_id: { type: 'string' },
  },
  required: ['site_id'],
}

// get_site_deployments — View deployment history
{
  name: 'get_site_deployments',
  description: 'View the deployment history for a site — when it was last deployed, how many files were uploaded, and whether it succeeded. Use when the user asks "when was my site last deployed", "show deploy history", etc.',
  parameters: {
    site_id: { type: 'string' },
    limit: { type: 'string', description: 'Max results (default: 5)' },
  },
  required: ['site_id'],
}
```

**Executor logic for `update_site_field`:**
```typescript
async function execUpdateSiteField(args: Record<string, any>, ctx: MobileExecutionContext): Promise<ToolResult> {
  const siteId = String(args.site_id || '');
  const field = String(args.field || '');
  const value = String(args.value || '');

  if (!siteId || !field || !value) return { success: false, message: 'site_id, field, and value are all required.' };

  // Allowed fields (whitelist — prevents SQL injection via field name)
  const ALLOWED_FIELDS = ['business_name','tagline','about_us','services','contact_email','contact_phone','theme_color'];
  if (!ALLOWED_FIELDS.includes(field)) {
    return { success: false, message: `Cannot update "${field}". Allowed fields: ${ALLOWED_FIELDS.join(', ')}` };
  }

  // Verify site ownership
  const site = await db.queryOne('SELECT id, user_id, business_name FROM generated_sites WHERE id = ?', [siteId]);
  if (!site) return { success: false, message: 'Site not found.' };
  if (site.user_id !== ctx.userId) return { success: false, message: 'You don\'t own this site.' };

  // Update the field
  await db.execute(`UPDATE generated_sites SET ${field} = ?, updated_at = NOW() WHERE id = ?`, [value, siteId]);

  return {
    success: true,
    message: `✅ Updated **${field.replace(/_/g, ' ')}** to: "${value.slice(0, 100)}"\n\nRun \`regenerate_site\` then \`deploy_site\` to push the change live.`,
  };
}
```

### 7.5 Updated Tool Count Summary

> **Updated 2026-03-07:** Reflects actual implementation.

| Category | Planned | Implemented | Status |
|----------|---------|-------------|--------|
| **CLIENT TOOLS** | | | |
| Client: Assistants | 5 | 5 | ✅ Complete |
| Client: Leads & Enquiries | 5 | 4 | 🔶 Missing `submit_lead_from_chat` |
| Client: Email Follow-up | 2 | 2 | ✅ Complete |
| Client: SiteBuilder | 6 | 6 | ✅ Complete |
| Client: Webhook (paid only) | dynamic | 0 | ❌ Not started |
| **Client Total** | **18+N** | **17** | |
| | | | |
| **STAFF TOOLS** | | | |
| Staff: Admin | 4 | 4 | ✅ Complete |
| Staff: Tasks | 4 | 4 | ✅ Complete |
| Staff: Cases | 6 | 4 | 🔶 Missing 2 |
| Staff: Contacts | 4 | 3 | 🔶 Missing 1 |
| Staff: Quotations | 5 | 2 | 🔶 Missing 3 |
| Staff: Invoices | 5 | 2 | 🔶 Missing 3 |
| Staff: Pricing | 3 | 1 | 🔶 Missing 2 |
| Staff: Chat | 3 | 2 | 🔶 Missing 1 |
| Staff: Scheduling | 3 | 2 | 🔶 Missing 1 |
| Staff: External Groups | 2 | 0 | ❌ Not started |
| **Staff Total** | **39** | **24** | |
| | | | |
| **GRAND TOTAL** | **57+N** | **41** | 41 implemented, 16+N remaining |

### 7.6 Updated `getToolsForRole()` Logic

> **Updated 2026-03-07:** Below shows the *actual* implementation. Note: `getToolsForRole()` currently takes only `role` (no `tier` param yet — webhook/tier logic not implemented).

```typescript
export function getToolsForRole(role: MobileRole): ToolDefinition[] {
  // ── Core client tools (assistant management) ──
  const clientCoreTools = [
    LIST_MY_ASSISTANTS, TOGGLE_ASSISTANT_STATUS, GET_USAGE_STATS,
    LIST_FAILED_JOBS, RETRY_FAILED_INGESTION,
  ];

  // ── Client lead management tools ──
  const clientLeadTools = [
    LIST_LEADS, GET_LEAD_DETAILS, UPDATE_LEAD_STATUS, GET_LEAD_STATS,
  ];

  // ── Client email tools ──
  const clientEmailTools = [SEND_FOLLOWUP_EMAIL, SEND_INFO_EMAIL];

  // ── Client site builder tools ──
  const clientSiteTools = [
    LIST_MY_SITES, GET_SITE_DETAILS, UPDATE_SITE_FIELD,
    REGENERATE_SITE, DEPLOY_SITE, GET_SITE_DEPLOYMENTS,
  ];

  const allClientTools = [
    ...clientCoreTools,     // 5 tools
    ...clientLeadTools,     // 4 tools
    ...clientEmailTools,    // 2 tools
    ...clientSiteTools,     // 6 tools
  ]; // Total: 17 client tools

  // Staff tools grouped by module
  const staffAdminTools = [LIST_TASKS, CREATE_TASK, UPDATE_TASK, ADD_TASK_COMMENT,
    SEARCH_CLIENTS, SUSPEND_CLIENT_ACCOUNT, CHECK_CLIENT_HEALTH, GENERATE_ENTERPRISE_ENDPOINT];
  const staffCaseTools = [LIST_CASES, GET_CASE_DETAILS, UPDATE_CASE, ADD_CASE_COMMENT];
  const staffCrmTools = [LIST_CONTACTS, GET_CONTACT_DETAILS, CREATE_CONTACT];
  const staffFinanceTools = [LIST_QUOTATIONS, GET_QUOTATION_DETAILS, LIST_INVOICES, GET_INVOICE_DETAILS, SEARCH_PRICING];
  const staffSchedulingTools = [LIST_SCHEDULED_CALLS, CREATE_SCHEDULED_CALL];
  const staffChatTools = [LIST_CONVERSATIONS, SEND_CHAT_MESSAGE];

  if (role === 'staff') {
    return [
      ...allClientTools,        // 17 client tools
      ...staffAdminTools,       // 8 tools
      ...staffCaseTools,        // 4 tools
      ...staffCrmTools,         // 3 tools
      ...staffFinanceTools,     // 5 tools
      ...staffSchedulingTools,  // 2 tools
      ...staffChatTools,        // 2 tools
    ]; // Total: 41 tools
  }

  return allClientTools; // 17 tools
}
```

### 7.7 The Complete Client Business Loop

This diagram shows how a free-tier client's business runs entirely through the assistant:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                   THE CLIENT BUSINESS LOOP (Free Tier)                          │
│                                                                                 │
│   ┌─────────────┐     POST /v1/leads/submit      ┌──────────────────────┐      │
│   │  LANDING     │ ────────────────────────────▶  │  form_submissions    │      │
│   │  PAGE        │     (contact form)             │  table               │      │
│   │  (generated) │                                │  + email to owner    │      │
│   └──────┬───────┘                                └──────────┬───────────┘      │
│          │                                                   │                  │
│          │  update_site_field                                 │                  │
│          │  regenerate_site                          list_leads                  │
│          │  deploy_site                              get_lead_details            │
│          │                                           update_lead_status          │
│          │                                                   │                  │
│          ▼                                                   ▼                  │
│   ┌──────────────────────────────────────────────────────────────────────┐      │
│   │                        AI ASSISTANT                                   │      │
│   │                                                                       │      │
│   │  "Show me today's enquiries"        → list_leads                     │      │
│   │  "What did John want?"              → get_lead_details               │      │
│   │  "Send him a thank you email        → send_followup_email            │      │
│   │   with our pricing attached"                                          │      │
│   │  "Mark that as contacted"           → update_lead_status             │      │
│   │  "Update my phone to 082 555 1234"  → update_site_field              │      │
│   │  "Redeploy the site"               → regenerate_site + deploy_site   │      │
│   │  "Save this enquiry from our chat"  → submit_lead_from_chat          │      │
│   │  "How many leads this month?"       → get_lead_stats                 │      │
│   │  "Email info@acme.com about our     → send_info_email                │      │
│   │   services"                                                           │      │
│   └──────────────────────────────────────────────────────────────────────┘      │
│                                                                                 │
│   Result: Client's website generates leads → assistant manages the pipeline     │
│           → assistant sends follow-ups → assistant updates the site → repeat    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Phase 5 — Paid Client Webhook System

### Concept

Paid clients can connect their AI assistant to **their own external APIs** by providing an API specification. The system dynamically generates AI tools from the spec, allowing the assistant to call the client's endpoints on their behalf.

### How It Works

```
┌───────────────────────────────────────────────────────────────────────┐
│                    PAID CLIENT WEBHOOK FLOW                           │
│                                                                       │
│  1. Client provides API spec (OpenAPI JSON or manual endpoint list)   │
│  2. Backend parses spec → generates tool definitions                  │
│  3. Tools are stored in assistant_webhooks table                      │
│  4. On each AI request, webhook tools are merged into the tool set    │
│  5. When AI calls a webhook tool, backend proxies to client's API     │
│  6. Result is formatted and returned to the AI for summarization      │
└───────────────────────────────────────────────────────────────────────┘
```

### API Specification Input Methods

**Method A — OpenAPI/Swagger JSON Upload**

```json
{
  "openapi": "3.0.0",
  "info": { "title": "My Store API", "version": "1.0.0" },
  "servers": [{ "url": "https://mystore.example.com/api" }],
  "paths": {
    "/products": {
      "get": {
        "operationId": "listProducts",
        "summary": "List all products",
        "parameters": [
          { "name": "category", "in": "query", "schema": { "type": "string" } },
          { "name": "limit", "in": "query", "schema": { "type": "integer" } }
        ]
      },
      "post": {
        "operationId": "createProduct",
        "summary": "Create a new product",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "name": { "type": "string" },
                  "price": { "type": "number" },
                  "category": { "type": "string" }
                },
                "required": ["name", "price"]
              }
            }
          }
        }
      }
    },
    "/orders/{orderId}": {
      "get": {
        "operationId": "getOrder",
        "summary": "Get order details",
        "parameters": [
          { "name": "orderId", "in": "path", "required": true, "schema": { "type": "string" } }
        ]
      }
    }
  }
}
```

**Method B — Manual Endpoint Definition UI**

For clients who don't have an OpenAPI spec, a form-based UI:

| Field | Type | Description |
|-------|------|-------------|
| Endpoint Name | text | Human-readable name (e.g. "List Products") |
| Tool Name | text (auto-generated) | AI function name (e.g. `webhook_list_products`) |
| Method | select | GET, POST, PUT, DELETE |
| Path | text | URL path (e.g. `/api/products`) |
| Description | text | What this endpoint does (used in AI prompt) |
| Parameters | repeater | Name, type (string/number/boolean), required, description, in (query/path/body) |

### Webhook Configuration Storage

```sql
-- New table: assistant_webhooks
CREATE TABLE assistant_webhooks (
  id              VARCHAR(36) PRIMARY KEY,
  assistant_id    VARCHAR(100) NOT NULL,
  user_id         VARCHAR(36) NOT NULL,
  
  -- Connection config
  base_url        VARCHAR(500) NOT NULL,         -- e.g. https://mystore.example.com/api
  auth_type       ENUM('none','bearer','api_key','basic') DEFAULT 'none',
  auth_header     VARCHAR(100) DEFAULT 'Authorization',  -- Header name
  auth_value      TEXT,                          -- Encrypted token/key value
  custom_headers  JSON,                          -- Additional headers (JSON object)
  
  -- Spec storage
  spec_type       ENUM('openapi','manual') NOT NULL,
  spec_json       LONGTEXT,                     -- Full OpenAPI JSON (if openapi)
  
  -- Generated tools
  generated_tools JSON,                         -- Parsed tool definitions (cached)
  
  -- Metadata
  status          ENUM('active','disabled','error') DEFAULT 'active',
  last_tested_at  DATETIME,
  last_test_result JSON,                        -- { success, status_code, error }
  total_calls     INT DEFAULT 0,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_assistant (assistant_id),
  INDEX idx_user (user_id),
  FOREIGN KEY (assistant_id) REFERENCES assistants(id) ON DELETE CASCADE
);

-- Manual endpoint definitions (when spec_type = 'manual')
CREATE TABLE webhook_endpoints (
  id              VARCHAR(36) PRIMARY KEY,
  webhook_id      VARCHAR(36) NOT NULL,
  
  -- Endpoint definition
  tool_name       VARCHAR(100) NOT NULL,         -- e.g. webhook_list_products
  display_name    VARCHAR(200) NOT NULL,         -- e.g. List Products
  description     TEXT NOT NULL,                 -- AI prompt description
  http_method     ENUM('GET','POST','PUT','PATCH','DELETE') NOT NULL,
  path            VARCHAR(500) NOT NULL,         -- e.g. /products
  
  -- Parameters (JSON array)
  parameters      JSON,                          -- [{name, type, required, description, in}]
  
  -- Response parsing
  response_path   VARCHAR(200),                  -- JSONPath to extract data (e.g. $.data.items)
  
  enabled         BOOLEAN DEFAULT TRUE,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_webhook (webhook_id),
  FOREIGN KEY (webhook_id) REFERENCES assistant_webhooks(id) ON DELETE CASCADE
);
```

### Webhook Tool Generator Service

```typescript
// NEW FILE: src/services/webhookToolGenerator.ts
// ~350 LOC

interface NormalizedEndpoint {
  toolName: string;          // webhook_{operationId}
  displayName: string;
  description: string;
  method: string;
  path: string;
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
    in: 'query' | 'path' | 'body';
  }>;
  responsePath?: string;
}

/**
 * Parse an OpenAPI 3.0 spec into normalized endpoints.
 */
export function parseOpenAPISpec(specJson: string): NormalizedEndpoint[] {
  const spec = JSON.parse(specJson);
  const endpoints: NormalizedEndpoint[] = [];
  
  for (const [path, methods] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(methods as any)) {
      if (!['get','post','put','patch','delete'].includes(method)) continue;
      
      const op = operation as any;
      const toolName = `webhook_${op.operationId || method}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`;
      
      endpoints.push({
        toolName: toolName.toLowerCase().replace(/_+/g, '_').replace(/_$/, ''),
        displayName: op.summary || `${method.toUpperCase()} ${path}`,
        description: op.description || op.summary || `Call ${method.toUpperCase()} ${path}`,
        method: method.toUpperCase(),
        path,
        parameters: extractParameters(op),
      });
    }
  }
  
  return endpoints;
}

/**
 * Convert normalized endpoints into ToolDefinition objects.
 */
export function generateToolDefinitions(endpoints: NormalizedEndpoint[]): ToolDefinition[] {
  return endpoints.map(ep => ({
    type: 'function' as const,
    function: {
      name: ep.toolName,
      description: ep.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          ep.parameters.map(p => [p.name, {
            type: p.type,
            description: p.description,
          }])
        ),
        required: ep.parameters.filter(p => p.required).map(p => p.name),
      },
    },
  }));
}

/**
 * Execute a webhook tool call by proxying to the client's API.
 */
export async function executeWebhookCall(
  webhook: AssistantWebhook,
  endpoint: NormalizedEndpoint,
  args: Record<string, any>,
): Promise<ToolResult> {
  // Build URL from base_url + path (replace {param} placeholders)
  let url = webhook.base_url.replace(/\/$/, '') + endpoint.path;
  for (const p of endpoint.parameters.filter(p => p.in === 'path')) {
    url = url.replace(`{${p.name}}`, encodeURIComponent(args[p.name] || ''));
  }
  
  // Build query string
  const queryParams = endpoint.parameters.filter(p => p.in === 'query');
  const searchParams = new URLSearchParams();
  for (const p of queryParams) {
    if (args[p.name] !== undefined) searchParams.set(p.name, String(args[p.name]));
  }
  if (searchParams.toString()) url += `?${searchParams}`;
  
  // Build body
  const bodyParams = endpoint.parameters.filter(p => p.in === 'body');
  const body = bodyParams.length > 0
    ? JSON.stringify(Object.fromEntries(bodyParams.map(p => [p.name, args[p.name]])))
    : undefined;
  
  // Build headers
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (webhook.auth_type !== 'none') {
    headers[webhook.auth_header] = webhook.auth_type === 'bearer'
      ? `Bearer ${decrypt(webhook.auth_value)}`
      : decrypt(webhook.auth_value);
  }
  if (webhook.custom_headers) {
    Object.assign(headers, JSON.parse(webhook.custom_headers));
  }
  
  // Execute
  const response = await fetch(url, {
    method: endpoint.method,
    headers,
    body: ['GET', 'DELETE'].includes(endpoint.method) ? undefined : body,
    signal: AbortSignal.timeout(30_000), // 30s timeout
  });
  
  const responseText = await response.text();
  
  // Update call count
  await db.execute(
    'UPDATE assistant_webhooks SET total_calls = total_calls + 1 WHERE id = ?',
    [webhook.id]
  );
  
  if (!response.ok) {
    return { success: false, message: `API returned ${response.status}: ${responseText.slice(0, 500)}` };
  }
  
  // Parse and format result
  try {
    const data = JSON.parse(responseText);
    const extracted = endpoint.responsePath ? extractJsonPath(data, endpoint.responsePath) : data;
    return { success: true, message: JSON.stringify(extracted, null, 2).slice(0, 2000) };
  } catch {
    return { success: true, message: responseText.slice(0, 2000) };
  }
}
```

### Webhook API Endpoints (New Route File)

```typescript
// NEW FILE: src/routes/assistantWebhooks.ts
// Mount: /api/v1/mobile/my-assistant/:assistantId/webhooks

// GET    /                    → List webhooks for assistant
// POST   /                    → Create webhook config
// PUT    /:webhookId          → Update webhook config
// DELETE /:webhookId          → Delete webhook
// POST   /:webhookId/test     → Test webhook connection
// GET    /:webhookId/endpoints → List manual endpoints
// POST   /:webhookId/endpoints → Add manual endpoint
// PUT    /:webhookId/endpoints/:endpointId → Update endpoint
// DELETE /:webhookId/endpoints/:endpointId → Delete endpoint
// POST   /:webhookId/parse-spec → Parse OpenAPI spec → preview tools
```

### Tier Enforcement

```typescript
// In the webhook routes:
const tier = await getUserTier(userId);
if (tier === 'free') {
  throw new HttpError(403, 'FORBIDDEN', 'Webhook integration requires a paid subscription.');
}
```

---

## 9. Phase 6 — Staff/Admin Internal Webhook Configuration

### Purpose

Staff/admin get the same webhook UI as paid clients, but:
1. Pre-configured for **internal services** (the Softaware platform's own APIs)
2. Can also configure **external service connections** (same as client webhooks)
3. Their webhook tools are added to the staff tool set alongside the built-in module tools

### Implementation

Staff webhooks use the **exact same tables and infrastructure** as client webhooks (`assistant_webhooks`, `webhook_endpoints`, `webhookToolGenerator.ts`). The only differences:

| Aspect | Staff | Paid Client |
|--------|-------|-------------|
| Table | `assistant_webhooks` | `assistant_webhooks` |
| Tool prefix | `webhook_` | `webhook_` |
| Auth | JWT + staff role | JWT + paid tier check |
| Pre-built templates | Yes (internal APIs) | No |
| Max webhooks | Unlimited | 3 (per assistant) |
| Max endpoints per webhook | 50 | 20 |

### Pre-Built Webhook Templates for Staff

Staff can one-click add pre-configured webhook connections:

| Template | Base URL | Endpoints | Description |
|----------|----------|-----------|-------------|
| Softaware Internal | `https://api.softaware.net.za` | Auto-generated from internal routes | Full platform API access |
| Silulumanzi Portal | Configurable | Task management, user lookup | External software integration |
| Custom | User-defined | Manual endpoint definition | Any REST API |

### Staff Webhook UI in Profile Tab

The staff assistant tab gets a new sub-section:

```
┌──────────────────────────────────────────────────┐
│ AI Assistant Configuration                        │
│                                                    │
│ ┌─── Personality ───┐ ┌── Capabilities ──┐        │
│ │ Name, voice,      │ │ Module grid with │        │
│ │ greeting, model   │ │ tool cards       │        │
│ └───────────────────┘ └──────────────────┘        │
│                                                    │
│ ┌──────────── Webhook Integrations ─────────────┐ │
│ │ [+ Add Webhook] [Templates ▾]                  │ │
│ │                                                 │ │
│ │ ┌─── Silulumanzi Portal ──────────────────┐   │ │
│ │ │ ✅ Active  •  12 endpoints  •  847 calls │   │ │
│ │ │ [Edit] [Test] [Disable]                  │   │ │
│ │ └─────────────────────────────────────────┘   │ │
│ │                                                 │ │
│ │ ┌─── Custom API ──────────────────────────┐   │ │
│ │ │ ⚠️ Error  •  3 endpoints  •  0 calls     │   │ │
│ │ │ [Edit] [Test] [Delete]                   │   │ │
│ │ └─────────────────────────────────────────┘   │ │
│ └─────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────┘
```

---

## 10. Phase 7 — Profile Page Frontend Changes

### Updated Tab Structure

```typescript
type ProfileTab = 'profile' | 'assistant' | 'mailboxes';
// assistant tab gets internal sub-navigation:
type AssistantSubTab = 'config' | 'capabilities' | 'webhooks';
```

### StaffAssistantTab Redesign

The existing `StaffAssistantTab` component is refactored to include sub-tabs:

```
┌──────────────────────────────────────────────────────────────────┐
│ AI Assistant                                                      │
│                                                                    │
│ ┌─ Configuration ─┐ ┌─ Capabilities ─┐ ┌─ Webhooks ─┐           │
│ │ (existing form)  │ │ (NEW panel)    │ │ (NEW panel)│           │
│ └──────────────────┘ └────────────────┘ └────────────┘           │
│                                                                    │
│ [Current sub-tab content renders here]                            │
└──────────────────────────────────────────────────────────────────┘
```

### New Frontend Files

| File | LOC (est) | Purpose |
|------|-----------|---------|
| `src/config/assistantCapabilities.ts` | ~250 | Static capability metadata for all modules |
| `src/components/profile/AssistantCapabilitiesPanel.tsx` | ~300 | Module grid with expandable tool cards |
| `src/components/profile/WebhookConfigPanel.tsx` | ~450 | Webhook CRUD + endpoint management |
| `src/components/profile/WebhookEndpointForm.tsx` | ~200 | Form for manual endpoint definition |
| `src/components/profile/OpenAPISpecUploader.tsx` | ~150 | OpenAPI JSON upload + parse preview |
| `src/components/profile/WebhookTestButton.tsx` | ~80 | Connection test with result display |
| `src/models/WebhookModel.ts` | ~120 | API client for webhook CRUD endpoints |

### Client Profile Changes

For client users (non-staff), the profile page currently shows no tabs. With this change:

- **Free clients**: See a read-only "AI Capabilities" section showing Assistants + SiteBuilder tools with upgrade prompts
- **Paid clients**: See the full assistant tab with Config + Capabilities + Webhooks sub-tabs

```typescript
// Updated tab visibility logic:
const isStaffOrAdmin = user?.is_staff || user?.is_admin;
const isPaidClient = !isStaffOrAdmin && userTier !== 'free';
const showAssistantTab = isStaffOrAdmin || isPaidClient;
const showWebhooksSubTab = isStaffOrAdmin || isPaidClient;
```

---

## 11. Database Migrations

### Migration: `019_assistant_capabilities.ts` (✅ IMPLEMENTED)

> **Note:** The actual migration differs from the original plan. Only `form_submissions` + `tool_preferences` were created. Webhook tables (`assistant_webhooks`, `webhook_endpoints`) were deferred to a future migration.

```typescript
// Actual migration (019_assistant_capabilities.ts — 72 LOC)
export async function up(): Promise<void> {
  // 1. form_submissions table — stores contact form enquiries for AI access
  await db.execute(`
    CREATE TABLE IF NOT EXISTS form_submissions (
      id              VARCHAR(36)     NOT NULL PRIMARY KEY,
      site_id         VARCHAR(36)     NOT NULL,
      sender_name     VARCHAR(255)    NOT NULL,
      sender_email    VARCHAR(255)    NOT NULL,
      sender_phone    VARCHAR(50)     NULL,
      message         TEXT            NOT NULL,
      source_page     VARCHAR(500)    NULL,
      ip_address      VARCHAR(45)     NULL,
      honeypot_triggered TINYINT(1)   NOT NULL DEFAULT 0,
      status          ENUM('new','contacted','converted','spam') NOT NULL DEFAULT 'new',
      notes           TEXT            NULL,
      created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_fs_site_id    (site_id),
      INDEX idx_fs_status     (status),
      INDEX idx_fs_created_at (created_at),
      INDEX idx_fs_email      (sender_email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 2. Add tool_preferences column to assistants table
  await db.execute(`
    ALTER TABLE assistants
      ADD COLUMN tool_preferences JSON NULL AFTER personality_flare
  `);
}
```

**Key differences from original plan:**
- Column names use `sender_name`/`sender_email` (not `submitter_name`/`submitter_email`)
- Status enum uses `'new','contacted','converted','spam'` (not `'new','contacted','qualified','closed'`)
- Adds `honeypot_triggered` flag for spam detection
- No `user_id` column (ownership derived via site_id → generated_sites.user_id)
- No `follow_up_count` or `last_followed_up_at` columns
- Webhook tables **not included** — deferred to future migration

### Future Migration: Webhook Tables (NOT YET CREATED)

The following tables from the original plan still need to be created:
      id              VARCHAR(36) PRIMARY KEY,
      assistant_id    VARCHAR(100) NOT NULL,
      user_id         VARCHAR(36) NOT NULL,
      name            VARCHAR(200) NOT NULL,
      base_url        VARCHAR(500) NOT NULL,
      auth_type       ENUM('none','bearer','api_key','basic') DEFAULT 'none',
      auth_header     VARCHAR(100) DEFAULT 'Authorization',
      auth_value      TEXT,
      custom_headers  JSON,
      spec_type       ENUM('openapi','manual') NOT NULL DEFAULT 'manual',
      spec_json       LONGTEXT,
      generated_tools JSON,
      status          ENUM('active','disabled','error') DEFAULT 'active',
      last_tested_at  DATETIME,
      last_test_result JSON,
      total_calls     INT DEFAULT 0,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_assistant_webhooks_assistant (assistant_id),
      INDEX idx_assistant_webhooks_user (user_id)
    )
  `);

  // 2. webhook_endpoints table (for manual spec type)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS webhook_endpoints (
      id              VARCHAR(36) PRIMARY KEY,
      webhook_id      VARCHAR(36) NOT NULL,
      tool_name       VARCHAR(100) NOT NULL,
      display_name    VARCHAR(200) NOT NULL,
      description     TEXT NOT NULL,
      http_method     ENUM('GET','POST','PUT','PATCH','DELETE') NOT NULL,
      path            VARCHAR(500) NOT NULL,
      parameters      JSON,
      response_path   VARCHAR(200),
      enabled         BOOLEAN DEFAULT TRUE,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_webhook_endpoints_webhook (webhook_id),
      FOREIGN KEY (webhook_id) REFERENCES assistant_webhooks(id) ON DELETE CASCADE
    )
  `);

  // 3. Add tool_preferences column to assistants table
  await db.execute(`
    ALTER TABLE assistants
    ADD COLUMN tool_preferences JSON DEFAULT NULL
    COMMENT 'Per-module tool enable/disable preferences'
  `);
}

export async function down(db: any): Promise<void> {
  await db.execute('DROP TABLE IF EXISTS webhook_endpoints');
  await db.execute('DROP TABLE IF EXISTS assistant_webhooks');
  await db.execute('DROP TABLE IF EXISTS form_submissions');
  await db.execute('ALTER TABLE assistants DROP COLUMN IF EXISTS tool_preferences');
}
```

---

## 12. API Route Summary

### New Routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| — | **Lead/Form Submission Routes** | — | — |
| `GET` | `/api/v1/mobile/my-leads` | JWT | List user's form submissions (AI tool: `list_leads`) |
| `GET` | `/api/v1/mobile/my-leads/:id` | JWT | Get lead details (AI tool: `get_lead_details`) |
| `PUT` | `/api/v1/mobile/my-leads/:id/status` | JWT | Update lead status (AI tool: `update_lead_status`) |
| `POST` | `/api/v1/mobile/my-leads` | JWT | Create lead from chat (AI tool: `submit_lead_from_chat`) |
| `GET` | `/api/v1/mobile/my-leads/stats` | JWT | Lead pipeline stats (AI tool: `get_lead_stats`) |
| — | **Webhook Routes (paid/staff)** | — | — |
| GET | `/api/v1/mobile/my-assistant/:id/webhooks` | JWT | List webhooks |
| POST | `/api/v1/mobile/my-assistant/:id/webhooks` | JWT + Paid/Staff | Create webhook |
| PUT | `/api/v1/mobile/my-assistant/:id/webhooks/:wid` | JWT | Update webhook |
| DELETE | `/api/v1/mobile/my-assistant/:id/webhooks/:wid` | JWT | Delete webhook |
| POST | `/api/v1/mobile/my-assistant/:id/webhooks/:wid/test` | JWT | Test connection |
| GET | `/api/v1/mobile/my-assistant/:id/webhooks/:wid/endpoints` | JWT | List manual endpoints |
| POST | `/api/v1/mobile/my-assistant/:id/webhooks/:wid/endpoints` | JWT | Create endpoint |
| PUT | `/api/v1/mobile/my-assistant/:id/webhooks/:wid/endpoints/:eid` | JWT | Update endpoint |
| DELETE | `/api/v1/mobile/my-assistant/:id/webhooks/:wid/endpoints/:eid` | JWT | Delete endpoint |
| POST | `/api/v1/mobile/my-assistant/:id/webhooks/parse-spec` | JWT | Parse OpenAPI spec |
| GET | `/api/v1/mobile/my-assistant/:id/capabilities` | JWT | Get capabilities + preferences |
| PUT | `/api/v1/mobile/my-assistant/:id/capabilities` | JWT | Update tool preferences |

### Modified Routes

| Route | Change |
|-------|--------|
| `POST /v1/leads/submit` | **Store submission** in `form_submissions` table before emailing to owner |
| `POST /api/v1/mobile/intent` | Load webhook tools at runtime, merge with built-in tools |

---

## 13. Security Model

### Authentication & Authorization

| Action | Auth Required |
|--------|---------------|
| View capabilities | JWT (any role) |
| Toggle tool preferences | JWT (must own assistant) |
| List/read leads | JWT (only sees own user_id leads) |
| Send follow-up email | JWT + lead ownership check (user_id must match) |
| Send info email | JWT (rate-limited: 20/hour) |
| Update site field | JWT + site ownership check |
| Deploy site | JWT + site ownership check |
| Create webhook | JWT + (staff OR paid tier) |
| Webhook tool execution | JWT + ownership check + webhook status = active |
| Parse OpenAPI spec | JWT + (staff OR paid tier) |
| Test webhook connection | JWT + ownership check |

### Webhook Security

| Concern | Mitigation |
|---------|-----------|
| Credential storage | `auth_value` encrypted at rest using AES-256-GCM via `credentialVault` |
| SSRF prevention | Block private IPs (127.0.0.1, 10.x, 172.16-31.x, 192.168.x) in webhook `base_url` |
| Rate limiting | Max 100 webhook calls per user per hour |
| Timeout | 30-second timeout on all webhook requests |
| Response size | Truncate response to 2KB before passing to AI |
| Tool injection | `tool_name` prefixed with `webhook_` — cannot collide with built-in tools |
| Max webhooks | Staff: unlimited, Paid clients: 3 per assistant |
| Max endpoints | Staff: 50 per webhook, Paid clients: 20 per webhook |

### Tier Enforcement

```typescript
// Tier check utility (used in routes):
async function getUserTier(userId: string): Promise<'free' | 'paid' | 'staff'> {
  const role = await resolveUserRole(userId);
  if (role === 'staff') return 'staff';
  
  const sub = await db.queryOne(
    'SELECT tier FROM subscription_tiers WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
    [userId]
  );
  return sub?.tier === 'free' ? 'free' : 'paid';
}
```

---

## 14. File Inventory

### New Backend Files

| File | LOC (est) | Purpose | Status |
|------|-----------|---------|--------|
| `src/services/webhookToolGenerator.ts` | ~350 | Parse specs, generate tools, execute calls | ❌ Not created |
| `src/routes/assistantWebhooks.ts` | ~400 | CRUD + test + parse-spec endpoints | ❌ Not created |
| `src/db/migrations/019_assistant_capabilities.ts` | 72 | `form_submissions` + `tool_preferences` | ✅ Done |
| `src/db/migrations/0XX_webhooks.ts` | ~70 | `assistant_webhooks` + `webhook_endpoints` | ❌ Not created |

### Modified Backend Files

| File | Changes | Status |
|------|---------|--------|
| `src/services/mobileTools.ts` | Added 28 new tool defs (12 client + 16 staff); updated `getToolsForRole()` | ✅ Done (1,211 LOC) |
| `src/services/mobileActionExecutor.ts` | Added 28 new executors + dispatcher cases | ✅ Done (2,127 LOC) |
| `src/services/mobileAIProcessor.ts` | Uses `TOOLS_OLLAMA_MODEL`, keep_alive fix | ✅ Done (384 LOC) |
| `src/routes/contactFormRouter.ts` | Stores submissions in `form_submissions` before emailing | ✅ Done |
| `src/routes/myAssistant.ts` | Needs `/capabilities` GET/PUT endpoints | ❌ Not done |
| `src/app.ts` | Needs `assistantWebhooks` router mounted | ❌ Not done |

### New Frontend Files

| File | LOC (est) | Purpose | Status |
|------|-----------|---------|--------|
| `src/config/assistantCapabilities.ts` | ~250 | Static module/tool metadata | ❌ Not created |
| `src/components/profile/AssistantCapabilitiesPanel.tsx` | ~300 | Module grid UI | ❌ Not created |
| `src/components/profile/WebhookConfigPanel.tsx` | ~450 | Webhook management UI | ❌ Not created |
| `src/components/profile/WebhookEndpointForm.tsx` | ~200 | Manual endpoint form | ❌ Not created |
| `src/components/profile/OpenAPISpecUploader.tsx` | ~150 | Spec upload + preview | ❌ Not created |
| `src/components/profile/WebhookTestButton.tsx` | ~80 | Test connection button | ❌ Not created |
| `src/models/WebhookModel.ts` | ~120 | API client for webhook routes | ❌ Not created |

### Modified Frontend Files

| File | Changes | Status |
|------|---------|--------|
| `src/pages/general/Profile.tsx` | Needs sub-tabs + capabilities panel + webhooks | ❌ Not done (1,695 LOC) |
| `src/models/SystemModels.ts` | Needs webhook interfaces + capabilities API | ❌ Not done |

### Estimated Total New Code

| Layer | Planned LOC | Implemented LOC | Remaining LOC |
|-------|-------------|-----------------|---------------|
| Backend (new files) | ~850 | ~72 (migration) | ~780 (webhook service + routes) |
| Backend (modifications) | ~1,200 | ~2,500 (tools + executors + contactForm) | ~200 (remaining tools + executors) |
| Frontend (new) | ~1,550 | 0 | ~1,550 |
| Frontend (modifications) | ~200 | 0 | ~200 |
| **Total** | **~3,800** | **~2,572** | **~2,730** |

---

## 15. Implementation Checklist

### Phase 1 — Client Business Loop: Leads + Email + Site Editing (Backend, ~3 days) ★ HIGHEST PRIORITY

> **Status: 🔶 MOSTLY COMPLETE (2026-03-07)** — 12 of 13 tools implemented and tested.

This is the most impactful change — gives every free client a useful assistant.

- [x] Create migration `019_form_submissions_and_webhooks.ts` and run it (created as `019_assistant_capabilities.ts`)
- [x] Modify `contactForm.ts` to INSERT into `form_submissions` before emailing (done in `contactFormRouter.ts`)
- [x] Add 4 Lead tools to `mobileTools.ts` (list_leads, get_lead_details, update_lead_status, get_lead_stats)
- [ ] Add `submit_lead_from_chat` tool (5th lead tool — still missing)
- [x] Add 2 Email tools (send_followup_email, send_info_email)
- [x] Add 6 SiteBuilder tools (list_my_sites, get_site_details, update_site_field, regenerate_site, deploy_site, get_site_deployments)
- [x] Implement 4 Lead executor functions (DB queries on form_submissions)
- [ ] Implement `submit_lead_from_chat` executor
- [x] Implement 2 Email executor functions (using shared emailService + lead tracking)
- [x] Implement 6 SiteBuilder executor functions (DB update + call siteBuilderService)
- [x] Register all 12 client executors in the dispatcher (13th pending)
- [x] Update `getToolsForRole()` to include lead/email/site tools for all client tiers
- [ ] Test end-to-end: submit form → list_leads → send_followup_email → update_site_field → deploy

### Phase 2 — Capabilities Panel (Frontend, ~2 days)

> **Status: ❌ NOT STARTED (2026-03-07)**

- [ ] Create `src/config/assistantCapabilities.ts` with module/tool metadata
- [ ] Create `AssistantCapabilitiesPanel.tsx` component
- [ ] Add sub-tabs to `StaffAssistantTab` (Config | Capabilities | Webhooks)
- [ ] Wire capabilities panel into assistant tab
- [ ] Add read-only capabilities view for free clients
- [ ] Test module grid rendering and expand/collapse

### Phase 3 — New Staff Tools (Backend, ~4 days)

> **Status: 🔶 PARTIAL (2026-03-07)** — 16 of 31 staff-only tools defined in mobileTools.ts.

- [x] Add 4 Cases tools to `mobileTools.ts` (list_cases, get_case_details, update_case, add_case_comment)
- [ ] Add remaining 2 Cases tools (create_case, get_case_stats)
- [x] Add 3 Contacts tools (list_contacts, get_contact_details, create_contact)
- [ ] Add remaining 1 Contacts tool (get_contact_statement)
- [x] Add 2 Quotations tools (list_quotations, get_quotation_details)
- [ ] Add remaining 3 Quotations tools (create_quotation, convert_to_invoice, email_quotation)
- [x] Add 2 Invoices tools (list_invoices, get_invoice_details)
- [ ] Add remaining 3 Invoices tools (create_invoice, record_payment, email_invoice)
- [x] Add 1 Pricing tool (search_pricing)
- [ ] Add remaining 2 Pricing tools (create_pricing_item, update_pricing_item)
- [x] Add 2 Chat tools (list_conversations, send_chat_message)
- [ ] Add remaining 1 Chat tool (search_chat_messages)
- [x] Add 2 Scheduling tools (list_scheduled_calls, create_scheduled_call)
- [ ] Add remaining 1 Scheduling tool (cancel_scheduled_call)
- [ ] Add 2 External Groups tools (entire module not started)
- [x] Update `getToolsForRole()` to include all new tools
- [ ] Update system prompt to handle 39+ tools efficiently

### Phase 4 — New Staff Executors (Backend, ~5 days)

> **Status: 🔶 PARTIAL (2026-03-07)** — 16 of 31 executors implemented in mobileActionExecutor.ts (2,127 LOC).

- [x] Implement 4 Cases executor functions (list_cases, get_case_details, update_case, add_case_comment)
- [ ] Implement remaining 2 Cases executors (create_case, get_case_stats)
- [x] Implement 3 Contacts executor functions (list_contacts, get_contact_details, create_contact)
- [ ] Implement remaining 1 Contacts executor (get_contact_statement)
- [x] Implement 2 Quotations executor functions (list_quotations, get_quotation_details)
- [ ] Implement remaining 3 Quotations executors (create_quotation, convert_to_invoice, email_quotation)
- [x] Implement 2 Invoices executor functions (list_invoices, get_invoice_details)
- [ ] Implement remaining 3 Invoices executors (create_invoice, record_payment, email_invoice)
- [x] Implement 1 Pricing executor function (search_pricing)
- [ ] Implement remaining 2 Pricing executors (create_pricing_item, update_pricing_item)
- [x] Implement 2 Chat executor functions (list_conversations, send_chat_message)
- [ ] Implement remaining 1 Chat executor (search_chat_messages)
- [x] Implement 2 Scheduling executor functions (list_scheduled_calls, create_scheduled_call)
- [ ] Implement remaining 1 Scheduling executor (cancel_scheduled_call)
- [ ] Implement 2 External Groups executor functions (entire module)
- [x] Register all implemented staff executors in the `switch` dispatcher
- [ ] Test each remaining executor independently via curl

### Phase 5 — Webhook Infrastructure (Backend, ~3 days)

> **Status: ❌ NOT STARTED (2026-03-07)** — No webhook tables, service, or routes created.
> Note: Migration 019 only created `form_submissions` + `tool_preferences`. Webhook tables (`assistant_webhooks`, `webhook_endpoints`) need a separate migration.

- [ ] Create migration for `assistant_webhooks` + `webhook_endpoints` tables
- [ ] Run migration
- [ ] Create `webhookToolGenerator.ts` service
- [ ] Create `assistantWebhooks.ts` route file
- [ ] Mount webhook routes in `app.ts`
- [ ] Add SSRF protection (private IP blocking)
- [ ] Add rate limiting (100 calls/user/hour)
- [ ] Add credential encryption via `credentialVault`
- [ ] Integrate webhook tool loading into `mobileAIProcessor.ts`
- [ ] Test OpenAPI spec parsing with sample specs
- [ ] Test manual endpoint definition CRUD
- [ ] Test webhook tool execution end-to-end

### Phase 6 — Webhook UI (Frontend, ~3 days)

> **Status: ❌ NOT STARTED (2026-03-07)**

- [ ] Create `WebhookModel.ts` API client
- [ ] Create `WebhookConfigPanel.tsx` with CRUD
- [ ] Create `WebhookEndpointForm.tsx` for manual definitions
- [ ] Create `OpenAPISpecUploader.tsx` with preview
- [ ] Create `WebhookTestButton.tsx`
- [ ] Wire webhook panel into staff assistant tab
- [ ] Wire webhook panel into paid client profile
- [ ] Add tier enforcement (hide for free clients, show upgrade prompt)
- [ ] Test full webhook flow: create → define endpoints → test → use via AI

### Phase 7 — Polish & Testing (~2 days)

- [ ] Test client business loop: form submit → list_leads → get_lead_details → send_followup_email → update_lead_status
- [ ] Test site editing loop: get_site_details → update_site_field → regenerate_site → deploy_site
- [ ] Test submit_lead_from_chat and send_info_email
- [ ] Test all 39 staff tools via mobile AI conversation
- [ ] Test all 18 client tools
- [ ] Test webhook tool generation from OpenAPI spec
- [ ] Test webhook tool generation from manual endpoints
- [ ] Test tier enforcement (free vs paid)
- [ ] Test tool preferences toggle
- [ ] Verify no prompt injection via webhook tool names
- [ ] Performance test with 39 tools in prompt (ensure Ollama handles it)
- [ ] Update documentation

### Total Estimated Effort: **~22 days** (~10 days remaining)

> **Progress as of 2026-03-07:** ~55% complete. Phase 1 (client business loop) is nearly done, Phase 3/4 (staff tools) are ~50% done, Phases 2/5/6/7 are not started.

---

## 16. Rollback Plan

### If Phase 2-3 (New Tools) Fail

The existing 13 tools continue to work. New tools can be disabled by reverting `mobileTools.ts` and `mobileActionExecutor.ts` — no migration rollback needed.

### If Phase 4-5 (Webhooks) Fail

1. Run `down()` migration to drop webhook tables
2. Revert `mobileAIProcessor.ts` to skip webhook tool loading
3. Remove webhook route from `app.ts`
4. Frontend webhook panel gracefully handles missing API (shows "coming soon")

### Feature Flags

Consider adding a `sys_settings` key for gradual rollout:

| Key | Default | Description |
|-----|---------|-------------|
| `assistant_client_business_loop` | `true` | Enable lead/email/site-edit tools for all clients |
| `assistant_new_staff_tools_enabled` | `true` | Enable 31 new staff module tools |
| `assistant_webhooks_enabled` | `false` | Enable webhook system (flip when ready) |
| `assistant_max_webhook_tools` | `20` | Max dynamic tools per assistant (prompt size guard) |

---

*End of Wiring Plan*
