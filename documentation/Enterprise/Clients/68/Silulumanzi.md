# Silulumanzi Water Services — Enterprise Client Profile

**Contact ID:** 68  
**Endpoint ID:** `ep_silulumanzi_91374147`  
**Package:** Bring Your Own Endpoint (id=4)  
**Status:** ✅ Active  
**Last Updated:** 2026-03-13

---

## 1. Client Overview

**Silulumanzi** is a water services provider in Mpumalanga, South Africa. They are the **first enterprise client** on the platform, originally served by a hardcoded `/silulumanzi` route that was later migrated to the dynamic enterprise webhook system.

| Field | Value |
|-------|-------|
| Company | Silulumanzi Water Services |
| Contact Person | Silulumanzi Admin |
| Email | info@silulumanzi.gov.za |
| MySQL Contact ID | 68 |
| Contact Type | 1 (Customer) |
| Active | Yes |

---

## 2. Endpoint Configuration

| Setting | Value |
|---------|-------|
| Endpoint ID | `ep_silulumanzi_91374147` |
| Webhook URL | `POST /api/v1/webhook/ep_silulumanzi_91374147` |
| Inbound Provider | `custom_rest` |
| LLM Provider | `openrouter` |
| LLM Model | `openai/gpt-4o-mini` |
| Temperature | 0.3 |
| Max Tokens | 1024 |
| Target API URL | `https://api.softaware.net.za/api/v1/client-api/silulumanzi` |
| Client API Config | `capi_silulumanzi_514ec203` |
| Real Target API | `https://portal.silulumanzi.com/ai` (via gateway) |
| Target API Status | ✅ Connected |
| Tools | 11 (see §4) |
| Total Requests | Active (tracked in SQLite) |

---

## 3. Package & Billing

| Field | Value |
|-------|-------|
| Package | Bring Your Own Endpoint (BYOE) |
| Package ID | 4 |
| Contact Package ID | 2 |
| Status | ACTIVE |
| Billing Cycle | MONTHLY |
| Credits Included | 50,000 / month |
| Payment Provider | MANUAL |
| Low Balance Threshold | 5,000 |

### Credit Tracking

Each webhook request deducts **10 credits** (TEXT_CHAT base cost). Transactions are logged with:
- Type: `USAGE`
- Request Type: `ENTERPRISE_WEBHOOK`
- Metadata: `{ endpoint_id, provider, model }`

---

## 4. AI Tools (Client API Gateway)

The endpoint's LLM has access to tools that call the standardized client API gateway:

```
POST https://api.softaware.net.za/api/v1/client-api/silulumanzi/{action}
```

The gateway looks up the Silulumanzi config in SQLite, validates the action against the allowed list, generates a daily rolling SHA-256 auth token (`SHA256(shared_secret + YYYY-MM-DD)`), and forwards the request to `https://portal.silulumanzi.com/api/ai/{action}`.

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `getCustomerContext` | Fetch customer account data, property details (address, GPS, PROP_REF), balances, faults | `phone_number` (optional) |
| `checkAreaOutages` | Check water outages in an area | `area` |
| `reportFault` | Report a water/sewer fault — creates EDAMS job card | `description` (required), `phone_number`, `account_number`, `address`, `mactivity_no`, `landmark_street` |
| `getFaultStatus` | Check status of a reported fault | `reference_number` |
| `getFinancials` | Get balance and payment history | `account_number` |
| `getStatements` | Get recent statements | `account_number` |
| `getStatementLink` | Get a downloadable statement link | `account_number` |
| `getMaintenanceActivities` | Full list of EDAMS maintenance activity codes (200+) | *(none)* |
| `getApplicationTypes` | All EDAMS application types (informational) | *(none)* |
| `getVacancies` | List current job vacancies | *(none)* |
| `addCustomerNote` | Add a note to customer account | `account_number`, `note` |

---

## 5. System Prompt Summary

The system prompt includes:
- **Identity:** Silulumanzi customer service assistant
- **Customer data:** Auto-fetched by phone number via `getCustomerContext`. If no phone number, customer is anonymous but can still report faults, check outages, and ask general questions. Response includes property details (address, GPS coordinates, PROP_REF) when available.
- **Knowledge base:** Payment methods, bank details (ABSA 4053446784), contact info, office hours, locations, deadlines, Blue Drop certification
- **Fault reporting flow:** Anyone can report a fault — just needs a description. Address auto-resolved from account if `account_number` provided. Uses `mactivity_no` codes from `getMaintenanceActivities` to classify faults (e.g. 152=water leak, 153=no water, 154=sewer overflow). Supports `landmark_street` for field team guidance. Anonymous reports accepted.
- **Information security:** Never share job card numbers, internal IDs, system field names
- **Languages:** English, isiZulu, isiXhosa, Afrikaans (auto-detected)
- **Channels:** WhatsApp, web chat, SMS, email

---

## 6. Migration History

### v1 — Hardcoded Route (pre 2026-03-08)

Originally served by `POST /api/silulumanzi` (640 LOC in `src/routes/chat.ts`):
- Hardcoded system prompt with dynamic customer data injection
- Full tool-calling loop (up to 5 iterations) via Anthropic-compatible API
- SSE streaming response with `status` → `token` → `done` events
- `requireApiKey` middleware (X-API-Key header)
- Knowledge base loaded from filesystem OCR extractions

### v2 — Enterprise Webhook (2026-03-08)

Migrated to `POST /api/v1/webhook/ep_silulumanzi_91374147`:
- Database-driven configuration in SQLite
- Generic webhook handler with tool-calling loop (up to 5 rounds)
- JSON response (not SSE streaming)
- No inbound authentication (public URL with endpoint ID)
- System prompt and knowledge base stored in SQLite

### v3 — Package Enforcement (2026-03-11)

- Assigned "Bring Your Own Endpoint" enterprise package (50,000 credits)
- Package enforcement wired into webhook handler
- Credit deduction (10 credits per request) with transaction logging
- Kill switches: package status, endpoint status, credit balance
- Legacy `/silulumanzi` route removed from `app.ts`
- Legacy `chat.ts` archived as `_legacy_silulumanzi_chat.ts.bak`

### v4 — Client API Gateway Standardization (2026-03-12)

- Replaced legacy `AiClient.php` proxy with TypeScript client API gateway
- New standardized URL: `POST /api/v1/client-api/silulumanzi/:action`
- Gateway config stored in SQLite `client_api_configs` table
- Rolling token auth generated in TypeScript (same SHA-256 algorithm as PHP)
- Allowed actions whitelist: 10 actions validated by gateway
- Request logging in `client_api_logs` table
- Admin CRUD API at `/api/admin/client-api-configs`
- Enterprise endpoint `target_api_url` updated to use gateway
- PHP proxy archived (`/var/opt/backend/client/AiClient.php`)
- Migration 027 seeds config and updates endpoint

### v5 — Tool-Calling Loop & Prompt Fix (2026-03-12)

- **Tool-calling loop:** Webhook handler now implements a proper multi-round tool loop (up to 5 rounds). Previously single-pass — LLM would make a tool call but the result was never fed back, so the user got empty/broken responses.
- **forwardAction returns data:** Target API response is now captured and fed back to the LLM as a `tool` message, allowing the AI to generate a human-readable reply from the tool result.
- **System prompt rewrite:** Fault reporting procedure simplified — anyone can report a fault with just an address and description. Removed unnecessary property ownership confirmation that was blocking non-customer reports.
- **Conversation flow:** LLM → tool_call → execute via gateway → tool result → LLM → human reply

### v6 — API Schema Alignment (2026-03-13)

- **Tool definitions updated (7 → 11):** All 11 tools now have LLM tool definitions (previously `addCustomerNote`, `getStatementLink`, `getVacancies` were gateway-whitelisted but had no LLM definitions)
- **New tool: `getApplicationTypes`** — returns all EDAMS application types (informational, default APPLICATION_TYPE_ID=830 for faults)
- **`reportFault` rewrite:** Removed deprecated `faultType` enum and `property_id`. Added `mactivity_no` (EDAMS activity code), `landmark_street`, `account_number` (auto-resolves property/GPS). `phone_number` now optional for anonymous reports. Only `description` is required. Response enriched with `application_id`, `jobcard_no`, `mrequest_no`, `address`, `latitude`, `longitude`.
- **`getMaintenanceActivities` rewrite:** No longer takes `area` param. Returns the full MACTIVITIES table (200+ activity codes) for mapping fault descriptions to `mactivity_no`.
- **`getFaultStatus`:** Renamed `faultReference` → `reference_number`
- **`getFinancials`/`getStatements`/`getStatementLink`/`addCustomerNote`:** Renamed `accountNumber` → `account_number` to match API schema
- **`getCustomerContext`:** `phone_number` now optional — omit for anonymous context. Response includes new `property` block (address, GPS, PROP_REF)
- **System prompt updated:** `AiClient.php` reference removed. Fault procedure now uses `mactivity_no` with common mappings (152=leak, 153=no water, 19=low pressure, etc.). Anonymous users explicitly supported.
- **Allowed actions:** 10 → 11 (added `getApplicationTypes` to client API gateway whitelist)

---

## 7. Kill Switches

Multiple layers of control can disable this endpoint:

| Layer | Action | Effect | How |
|-------|--------|--------|-----|
| **Endpoint** | Set status → `disabled` | 403 Forbidden | Admin UI → Endpoint card → Pause/Disable |
| **Endpoint** | Set status → `paused` | 503 Service Unavailable | Admin UI → Endpoint card → Pause |
| **Package** | Set subscription → `SUSPENDED` | 403 NO_ACTIVE_PACKAGE | Admin UI → Packages → Subscriptions → Status |
| **Package** | Set subscription → `CANCELLED` | 403 NO_ACTIVE_PACKAGE | Admin UI → Packages → Subscriptions → Status |
| **Credits** | Balance reaches 0 | 402 INSUFFICIENT_CREDITS | Natural usage or manual adjustment |
| **Contact** | Set contact → inactive | Indirect (no package found) | Database: `UPDATE contacts SET active = 0 WHERE id = 68` |
| **Client API** | Set config → `disabled` | 403 CLIENT_API_DISABLED | Admin API → `/admin/client-api-configs/:id/status` |
| **Client API** | Set config → `paused` | 503 CLIENT_API_PAUSED | Admin API → `/admin/client-api-configs/:id/status` |

---

## 8. Testing

### Quick test (should return AI response):
```bash
curl -X POST https://api.softaware.net.za/api/v1/webhook/ep_silulumanzi_91374147 \
  -H "Content-Type: application/json" \
  -d '{"message":"What are your office hours?","phone_number":"0831234567"}'
```

### Expected response:
```json
{
  "response": "Our customer care office hours are...",
  "action": "reply",
  "language": "en",
  "phone_number": "0831234567"
}
```

---

## Related Documentation

- [Enterprise Module README](../../README.md) — Module overview
- [Client API Standards](../../CLIENT_API_STANDARDS.md) — Client API gateway architecture & standards
- [Clients Directory](../README.md) — All enterprise clients
- [SILULUMANZI_ENDPOINT.md](/var/opt/backend/documents/SILULUMANZI_ENDPOINT.md) — Original legacy endpoint spec (archived reference)
- [Packages README](../../../Packages/README.md) — Package system
