# Kone Solutions — Enterprise Client Profile

**Contact ID:** 71  
**Endpoint ID:** `ep_kone_solutions_cv`  
**Package:** Bring Your Own Endpoint (id=4)  
**Status:** ✅ Active  
**Last Updated:** 2026-03-13

---

## 1. Client Overview

**Kone Solutions** provides CV/document reading services powered by AI through Soft Aware. They are focused on extracting structured candidate data from CVs — both scanned images and pasted text — and require detailed per-request cost reporting in South African Rand.

| Field | Value |
|-------|-------|
| Company | Kone Solutions |
| Contact Person | Kone Admin |
| Email | info@konesolutions.co.za |
| Phone | +27 11 000 0000 |
| Location | Johannesburg, Gauteng |
| MySQL Contact ID | 71 |
| Contact Type | 1 (Customer) |
| Active | Yes |

---

## 2. Endpoint Configuration

| Setting | Value |
|---------|-------|
| Endpoint ID | `ep_kone_solutions_cv` |
| Webhook URL | `POST /api/v1/webhook/ep_kone_solutions_cv` |
| Inbound Provider | `custom_rest` |
| Inbound Auth | `api_key` (to be provisioned) |
| LLM Provider | `openrouter` (configured, but see §5 — routing is dynamic) |
| LLM Model | `openai/gpt-4o-mini` (configured, but see §5) |
| Temperature | 0.2 |
| Max Tokens | 4096 |
| Target API URL | *(none — no external API)* |
| Tools | *(none — pure AI text/vision processing)* |
| Total Requests | Tracked in SQLite |

---

## 3. Package & Billing

| Field | Value |
|-------|-------|
| Package | Bring Your Own Endpoint (BYOE) |
| Package ID | 4 |
| Contact Package ID | 3 |
| Status | ACTIVE |
| Billing Cycle | MONTHLY |
| Credits Included | 50,000 / month |
| Payment Provider | MANUAL |

### Credit Pricing (ZAR-Based)

Kone Solutions uses **custom per-request pricing** instead of the standard 10-credit flat rate:

| Request Type | Cost (ZAR) | Credits | Transaction Type |
|-------------|-----------|---------|-----------------|
| Vision (image CV) | R0.20 | 20 | `KONE_VISION_CV` |
| Text (pasted CV) | R0.05 | 5 | `KONE_TEXT_CV` |

**Credit-to-ZAR mapping:** 1 credit = R0.01

At 50,000 credits/month, Kone can process:
- **2,500 vision requests** (50,000 ÷ 20), or
- **10,000 text requests** (50,000 ÷ 5), or
- Any mix thereof

### Transaction Metadata

Every credit deduction includes:

```json
{
  "endpoint_id": "ep_kone_solutions_cv",
  "provider": "ollama-vision",
  "model": "qwen2.5-vl:7b",
  "cost_zar": 0.20,
  "file_count": 1,
  "routing": "off-peak-ollama-vision"
}
```

---

## 4. What Makes This a Custom Webhook

Unlike standard enterprise endpoints that return a simple `{ response, action, language }` payload, Kone Solutions receives a **rich reporting envelope** with every response. This is implemented as client-specific logic in `enterpriseWebhook.ts` gated on `client_id === 'kone_solutions'`.

### Custom Response Format

```json
{
  "success": true,
  "data": { "...structured CV data..." },
  "_kone_meta": {
    "request_type": "VISION_CV",
    "files_processed": 1,
    "cost": {
      "amount_zar": 0.20,
      "formatted": "R0.20",
      "credits_deducted": 20
    },
    "processing": {
      "provider": "openrouter",
      "model": "openai/gpt-4o",
      "routing": "paid-vision-cascade",
      "duration_ms": 3842
    },
    "timestamp": "2026-03-13T14:32:01.000+02:00"
  }
}
```

### Custom Features

| Feature | Standard Endpoints | Kone Solutions |
|---------|-------------------|----------------|
| Response format | `{ response, action, language }` | `{ success, data, _kone_meta }` |
| Cost tracking | Flat 10 credits | R0.20 vision / R0.05 text |
| Transaction types | `ENTERPRISE_WEBHOOK` | `KONE_VISION_CV` / `KONE_TEXT_CV` |
| Vision support | No | Yes — images routed to vision models |
| Time-based routing | No | Yes — Ollama off-peak, cloud business hours |
| JSON data parsing | No | Yes — AI response parsed as JSON if valid |
| Cost in response | No | Yes — `_kone_meta.cost` block |

---

## 5. Intelligent Routing

Kone requests are routed based on **request type** (vision vs text) and **time of day** (SAST) to optimise costs:

```
Business Hours (06:00–18:00 SAST)
├── Vision: gpt-4o → gemini-2.0-flash → Ollama qwen2.5-vl
└── Text:   GLM-4.6 → OpenRouter gpt-4o-mini → Ollama

Off-Peak (18:00–06:00 SAST)
├── Vision: Ollama qwen2.5-vl (free, local)
└── Text:   Ollama (free, local) → GLM → OpenRouter
```

### Routing Reasons (returned in `_kone_meta.processing.routing`)

| Reason | Meaning | Cost Impact |
|--------|---------|-------------|
| `off-peak-ollama-vision` | Ollama vision, evening/night | Free inference |
| `off-peak-ollama-text` | Ollama text, evening/night | Free inference |
| `paid-vision-cascade` | Cloud vision cascade (business hours) | Per-token cloud cost |
| `glm-primary` | GLM responded first (text, business hours) | GLM cost |
| `openrouter-fallback` | OpenRouter after GLM failure | OpenRouter cost |
| `ollama-last-resort` | All cloud providers failed | Free inference |

**Cost optimisation tip:** Kone can schedule batch CV processing during off-peak hours (after 18:00 SAST) to avoid cloud inference costs entirely.

---

## 6. System Prompt

The AI is instructed to:
- Extract structured JSON from CVs (text or image)
- Return a defined schema: `personal_info`, `skills`, `experience`, `education`, `certifications`, `total_years_experience`, `seniority_level`
- Use `null` for undetermined fields
- Reject non-CV input with `{ "error": "NOT_A_CV" }`
- Be thorough with image-based CVs
- Always respond with valid JSON

---

## 7. Vision Request Detection

A request is classified as **vision** if:
1. The payload contains a `files` array
2. At least one file has `mimeType` starting with `image/`
3. The file has a non-empty `dataBase64` field

```json
{
  "message": "Extract all information from this CV",
  "files": [
    { "mimeType": "image/jpeg", "dataBase64": "/9j/4AAQ..." }
  ]
}
```

Supported image types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/bmp`

---

## 8. Kill Switches

| Layer | Action | Effect | How |
|-------|--------|--------|-----|
| **Endpoint** | Set status → `disabled` | 403 Forbidden | Admin UI → Endpoint card |
| **Endpoint** | Set status → `paused` | 503 Service Unavailable | Admin UI → Endpoint card |
| **Package** | Set subscription → `SUSPENDED` | 403 NO_ACTIVE_PACKAGE | Admin UI → Packages |
| **Credits** | Balance reaches 0 | 402 INSUFFICIENT_CREDITS | Natural usage |
| **Contact** | Set contact → inactive | Indirect (no package found) | Database update |
| **IP restriction** | Configure `allowed_ips` | 403 IP_RESTRICTED | Admin UI → Endpoint config |

---

## 9. Provisioning History

### v1 — Initial Setup (2026-03-13)

- MySQL contact created (id=71)
- BYOE enterprise package assigned (contact_package_id=3, 50,000 credits)
- SQLite endpoint created: `ep_kone_solutions_cv`
- Custom webhook logic added to `enterpriseWebhook.ts`:
  - Vision detection (files array with image MIME types)
  - ZAR-based pricing (R0.20 vision, R0.05 text)
  - Time-based intelligent routing (Ollama off-peak)
  - Rich `_kone_meta` reporting response
  - Custom transaction types (`KONE_VISION_CV`, `KONE_TEXT_CV`)
- API integration guide created: [Api.md](Api.md)
- [WEB_APP_INTEGRATION.md](/var/WEB_APP_INTEGRATION.md) rewritten with Kone as reference client

---

## 10. Related Documentation

- [API Integration Guide](Api.md) — Client-facing API documentation
- [Enterprise Module README](../../README.md) — Module overview
- [Clients Directory](../README.md) — All enterprise clients
- [WEB_APP_INTEGRATION.md](/var/WEB_APP_INTEGRATION.md) — Web integration guide (uses Kone as example)
- [Packages README](../../../Packages/README.md) — Package system
