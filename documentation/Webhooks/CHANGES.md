# Webhooks — Change Log

## Current State (March 2026)

**Database**: SQLite at `data/enterprise_endpoints.db` (WAL mode)  
**Schema Version**: v1.0 (auto-created, no migration system)  
**Backend**: 4 files, ~1,078 LOC (service + routes + normalizer)  
**Frontend**: 1 page (617 LOC) + model class (~100 LOC)  
**Admin Route**: `/api/admin/enterprise-endpoints` with 7 endpoints  
**Webhook Route**: `/api/v1/webhook/:endpointId` (1 endpoint)

---

## Version History

### v1.0 — Current Production (March 2026)
**Status**: ✅ Active

**Features**:
- Dynamic webhook endpoint creation via admin UI (no code changes per client)
- 6 inbound provider adapters (WhatsApp, Slack, SMS, Email, Web, Custom REST)
- WhatsApp dual-format support (Meta Cloud API + Twilio)
- 3 LLM provider backends (Ollama local, OpenRouter cloud, OpenAI direct)
- OpenRouter tool calling with action forwarding to target APIs
- Kill switch per endpoint (active / paused / disabled)
- Request logging with duration tracking and error capture
- Admin CRUD API with Zod validation (7 endpoints)
- Full-featured admin UI with endpoint table, expandable details, create/edit modal, and logs viewer
- One-click webhook URL copy to clipboard
- SweetAlert2 confirmations for destructive actions

**Schema**:
```sql
-- SQLite (NOT MySQL) — auto-created on first access
CREATE TABLE IF NOT EXISTS enterprise_endpoints (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  client_name TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'paused', 'disabled')),
  inbound_provider TEXT NOT NULL,
  inbound_auth_type TEXT,
  inbound_auth_value TEXT,
  llm_provider TEXT NOT NULL,
  llm_model TEXT NOT NULL,
  llm_temperature REAL DEFAULT 0.3,
  llm_max_tokens INTEGER DEFAULT 1024,
  llm_system_prompt TEXT NOT NULL,
  llm_tools_config TEXT,
  llm_knowledge_base TEXT,
  target_api_url TEXT,
  target_api_auth_type TEXT,
  target_api_auth_value TEXT,
  target_api_headers TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_request_at TEXT,
  total_requests INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS endpoint_requests (
  id TEXT PRIMARY KEY,
  endpoint_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  inbound_payload TEXT,
  ai_response TEXT,
  duration_ms INTEGER,
  status TEXT,
  error_message TEXT,
  FOREIGN KEY (endpoint_id) REFERENCES enterprise_endpoints(id) ON DELETE CASCADE
);
```

**Known Issues**:
- No inbound authentication enforcement — `inbound_auth_type`/`inbound_auth_value` fields exist but are not validated in the webhook handler
- Ollama provider does not support tool calling — `llm_tools_config` is ignored for Ollama endpoints
- No pagination on admin endpoint list — all endpoints returned by `GET /api/admin/enterprise-endpoints`
- No rate limiting on public webhook endpoint
- No conversation history — each webhook request is treated as a new single-turn conversation
- Language detection (`detectLanguage()`) uses naive regex, not suitable for production multilingual use
- SQLite database has no automated backup mechanism
- No webhook retry mechanism for failed LLM calls

**Architecture Decisions**:
- **SQLite over MySQL**: Chosen for isolation from core application data, zero-config schema, and simpler deployment. Trade-off: no replication or multi-server support.
- **No migration system**: Schema auto-creates via `CREATE TABLE IF NOT EXISTS`. Trade-off: schema changes require manual ALTER or DB recreation.
- **Synchronous SQLite**: Uses `better-sqlite3` (synchronous API) rather than async. Trade-off: simpler code but blocks event loop during queries. Acceptable for low query volume.

---

## Planned Improvements

### v1.1 — Security & Rate Limiting (Planned)
**Priority**: High

**Proposed Changes**:
- Enforce `inbound_auth_type` validation in webhook handler (verify API key/bearer token on inbound requests)
- Add rate limiting per endpoint (configurable requests/minute)
- Add IP allowlist per endpoint
- Add request body size limit per endpoint

### v1.2 — Conversation History (Planned)
**Priority**: Medium

**Proposed Changes**:
- Add `endpoint_conversations` table to track multi-turn conversations
- Session management via `sender_id` + `endpoint_id` composite
- Configurable conversation TTL (e.g., 30 minutes)
- Send conversation history as message array to LLM instead of single-turn

### v1.3 — Ollama Tool Calling (Planned)
**Priority**: Low

**Proposed Changes**:
- Add tool calling support for Ollama models that support it (e.g., `qwen2.5:7b-instruct`)
- Use Ollama's native `/api/chat` tool calling format
- Unified tool call handling across all LLM providers

### v1.4 — Analytics Dashboard (Planned)
**Priority**: Low

**Proposed Changes**:
- Aggregate request statistics per endpoint (daily/weekly/monthly)
- Average response time tracking
- Error rate monitoring and alerting
- LLM token usage tracking per endpoint

---

## File Change History

### `src/services/enterpriseEndpoints.ts`
| Date | Change | LOC |
|------|--------|-----|
| Feb 2026 | Initial creation — SQLite singleton, CRUD, logging | 343 |

### `src/routes/enterpriseWebhook.ts`
| Date | Change | LOC |
|------|--------|-----|
| Feb 2026 | Initial creation — universal webhook handler, Ollama + OpenRouter | 292 |

### `src/routes/adminEnterpriseEndpoints.ts`
| Date | Change | LOC |
|------|--------|-----|
| Feb 2026 | Initial creation — 7 CRUD endpoints with Zod validation | 175 |

### `src/services/payloadNormalizer.ts`
| Date | Change | LOC |
|------|--------|-----|
| Feb 2026 | Initial creation — 6 provider adapters (inbound + outbound) | 268 |

### `src/pages/admin/EnterpriseEndpoints.tsx`
| Date | Change | LOC |
|------|--------|-----|
| Feb 2026 | Initial creation — admin table, modals, status toggle, logs viewer | 617 |

### `src/models/AdminAIModels.ts`
| Date | Change | LOC |
|------|--------|-----|
| Feb 2026 | Added `AdminEnterpriseModel` class + interfaces | +100 |

---

## Migration Notes

### Adding a New Provider
1. Add normalizer function in `payloadNormalizer.ts` (`normalizeNewProvider()`)
2. Add formatter function in `payloadNormalizer.ts` (`formatNewProvider()`)
3. Add case to `normalizeInboundPayload()` switch
4. Add case to `formatOutboundPayload()` switch
5. Add enum value to Zod `createSchema.inbound_provider`
6. Add option to frontend select in `EnterpriseEndpoints.tsx`
7. Update documentation

### Adding a New LLM Provider
1. Add caller function in `enterpriseWebhook.ts` (`callNewProvider()`)
2. Add case to provider routing in webhook handler
3. Add enum value to Zod `createSchema.llm_provider`
4. Add option to frontend select in `EnterpriseEndpoints.tsx`
5. Add required env variables to `env.ts`
6. Update documentation

### Database Schema Changes
Since there is no migration system:
1. Option A: `ALTER TABLE` on the live SQLite database
2. Option B: Delete DB file, let it auto-recreate with new schema (⚠️ loses all data)
3. Option C: Write a one-time script to migrate data from old to new schema
4. **Recommended**: Add migration support in a future version
