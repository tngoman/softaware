# Soft Aware — Internal Enterprise Endpoints

**Contact ID:** 1  
**Package:** Staff (id=7)  
**Status:** ✅ Active  
**Last Updated:** 2026-03-12

---

## 1. Overview

Soft Aware is the platform operator. Two enterprise endpoints exist for internal testing and development purposes.

| Field | Value |
|-------|-------|
| Company | Soft Aware |
| Contact Person | System |
| Email | admin@softaware.net.za |
| MySQL Contact ID | 1 |
| Contact Type | 3 (Staff/Internal) |
| Package | Staff (100,000 credits) |

---

## 2. Endpoints

| Endpoint ID | Status | Provider | Tools | Target API |
|-------------|--------|----------|-------|------------|
| `ep_admin-softaware-001_1982b216` | active | openrouter / gpt-4o-mini | 0 | ✗ None |
| `ep_admin-softaware-001_693b2d88` | active | openrouter / gpt-4o-mini | 0 | ✗ None |

These are general-purpose test endpoints with no tool calling or target API configured.

---

## 3. Staff/Admin Assistant Tools

Staff and admin assistants have access to the following tool categories via the mobile AI assistant. Tools are injected dynamically based on JWT role — staff members cannot see or edit tool definitions from the GUI.

### 3.1 Tool Summary

| Category | Tools | Description |
|----------|-------|-------------|
| Tasks | 22 | Full task lifecycle: list, get, create, update, delete, comments, bookmarks, priority, color, tags, start, complete, approve, stats, pending approvals, tag list, sync, sync status, stage for invoice, get staged, process staged |
| Admin | 4 | search_clients, suspend_client_account, check_client_health, generate_enterprise_endpoint |
| Cases | 4 | list_cases, get_case_details, update_case, add_case_comment |
| CRM | 3 | list_contacts, get_contact_details, create_contact |
| Finance | 5 | list_quotations, get_quotation_details, list_invoices, get_invoice_details, search_pricing |
| Scheduling | 2 | list_scheduled_calls, create_scheduled_call |
| Chat | 2 | list_conversations, send_chat_message |
| **Bug Tracking** | **8** | **list_bugs, get_bug_details, create_bug, update_bug, add_bug_comment, update_bug_workflow, get_bug_stats** |
| Client (inherited) | 17 | Assistant management, leads, email, site builder |
| **Total** | **67** | |

### 3.2 Bug Tracking Tools (New)

These tools provide full bug tracking capability through the AI assistant, wired to the `bugs`, `bug_comments`, and `bug_attachments` MySQL tables.

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_bugs` | List/filter bug reports by status, severity, phase, software, assignee, or search term | status, severity, workflow_phase, software_id, assigned_to, search, limit |
| `get_bug_details` | Full bug detail with comments, attachment count, resolution info | bugId |
| `create_bug` | Report a new bug (starts in `open` / `intake`) | title (req), reporter_name (req), description, severity, software_id, assigned_to |
| `update_bug` | Change status, severity, assignment, or add resolution notes | bugId (req), status, severity, assigned_to, resolution_notes, title, description |
| `add_bug_comment` | Add an internal or public comment to a bug | bugId (req), content (req), is_internal |
| `update_bug_workflow` | Move bug between workflow phases (Intake → QA → Development) | bugId (req), workflow_phase (req) |
| `get_bug_stats` | Bug statistics by status, severity, phase, and software | (none) |

**Bug Documentation:** See [Bugs Module](../../../Bugs/README.md) for full architecture, API routes, database schema, and known issues.

---

## 4. Package & Billing

| Field | Value |
|-------|-------|
| Package | Staff |
| Package ID | 7 |
| Contact Package ID | 1 |
| Status | ACTIVE |
| Billing Cycle | NONE |
| Credits Included | 100,000 |
| Payment Provider | MANUAL |

---

## 5. Mobile Voice / TTS Pipeline

The mobile AI assistant voice flow is:

1. Device records audio → transcribes to text (on-device STT)
2. `POST /api/v1/mobile/intent` — sends text, receives response
3. Response now includes **two text fields**:
   - `reply` — full markdown-formatted response (for display in chat UI)
   - `tts_text` — **markdown-stripped plain text** (for TTS / read-aloud)
4. `POST /api/v1/mobile/tts` — optional server-side TTS via OpenAI. This endpoint also strips markdown before sending to OpenAI's TTS engine.

### 5.1 Intent Response Schema

```json
{
  "success": true,
  "reply": "Here are your **3 open tasks**:\n\n1. Fix login bug\n2. Deploy v2.1\n3. Update docs",
  "tts_text": "Here are your 3 open tasks: Fix login bug. Deploy v2.1. Update docs.",
  "conversationId": "uuid",
  "toolsUsed": ["list_tasks"],
  "data": null
}
```

### 5.2 Mobile App Integration Notes

| Scenario | Use |
|----------|-----|
| Display in chat bubble | `reply` (render markdown) |
| Local device TTS (iOS AVSpeechSynthesizer / Android TextToSpeech) | `tts_text` |
| Server TTS (`POST /tts`) | Either field — server strips markdown automatically |

**Changed:** 2026-03-12 — Added `tts_text` field and server-side markdown stripping to fix TTS reading asterisks/hashes literally.

---

## Related Documentation

- [Enterprise Module README](../../README.md)
- [Clients Directory](../README.md)
- [Bugs Module](../../../Bugs/README.md)
- [Bugs API Routes](../../../Bugs/ROUTES.md)
- [Bugs Database Fields](../../../Bugs/FIELDS.md)
