# Silulumanzi AI Chat Endpoint

> **Full technical reference for the `/silulumanzi` customer service endpoint.**

---

## Overview

The `/silulumanzi` endpoint is an AI-powered customer service assistant for **Silulumanzi**, a water services provider in Mpumalanga, South Africa. It handles customer queries via WhatsApp, web chat, SMS, and email — looking up accounts, checking outages, reporting faults, and answering general service questions.

**Stack:** Node.js · Express · TypeScript · OpenRouter (GPT-4o-mini) · SSE streaming

---

## Architecture

```
Client (WhatsApp / Web Chat)
  │
  ▼
POST /silulumanzi
  │
  ├─ API Key validation (MySQL)
  ├─ Customer lookup (AiClient PHP)
  ├─ System prompt construction (+ knowledge base)
  ├─ LLM call via OpenRouter (with tool definitions)
  │     │
  │     ├─ Tool call? → Execute via AiClient PHP → feed result back to LLM
  │     └─ Loop up to 5 iterations
  │
  └─ SSE stream response tokens back to client
```

---

## Request

```
POST /silulumanzi
Host: mcp.softaware.net.za
Content-Type: application/json
X-API-Key: <api_key>
```

### Body

| Field          | Type     | Required | Description                                      |
|----------------|----------|----------|--------------------------------------------------|
| `phone_number` | string   | Yes      | Customer phone number (e.g. `"0832691437"`)      |
| `channel`      | enum     | No       | `whatsapp` \| `web` \| `sms` \| `email` (default: `web`) |
| `message`      | string   | Yes      | The customer's message                           |
| `timestamp`    | string   | No       | ISO timestamp of the message                     |
| `history`      | array    | No       | Previous conversation turns                      |

**History item:**
```json
{ "role": "user" | "assistant", "content": "..." }
```

### Example

```json
{
  "phone_number": "0832691437",
  "channel": "whatsapp",
  "message": "I have no water at my house",
  "history": [
    { "role": "user", "content": "Hello" },
    { "role": "assistant", "content": "Hello Mr Metiso! How can I help?" }
  ]
}
```

---

## Response (SSE Stream)

The response is a **Server-Sent Events** stream (`text/event-stream`). Each event is a JSON object on a `data:` line.

### Event Types

| Type     | Description                                | Fields                                      |
|----------|--------------------------------------------|---------------------------------------------|
| `status` | Progress indicator while processing        | `text` — human-readable status message      |
| `token`  | A chunk of the AI response text            | `text` — word or whitespace fragment         |
| `done`   | Final event, stream ends after this        | `response`, `action`, `language`             |

### Stream Sequence

```
data: {"type":"status","text":"Thinking..."}

data: {"type":"status","text":"Checking outages in your area..."}

data: {"type":"token","text":"There"}
data: {"type":"token","text":" "}
data: {"type":"token","text":"are"}
data: {"type":"token","text":" "}
data: {"type":"token","text":"no"}
...

data: {"type":"done","response":"There are no reported outages...","action":"reply","language":"en"}
```

### `done` Event Fields

| Field      | Type   | Values                                         |
|------------|--------|-------------------------------------------------|
| `response` | string | Complete AI response text                       |
| `action`   | enum   | `reply` · `escalate` · `end_session`            |
| `language` | enum   | `en` · `zu` · `xh` · `af`                      |

**Action detection:**
- `escalate` — AI mentions transferring to a human agent
- `end_session` — AI says goodbye / no further assistance needed
- `reply` — default, normal conversation continues

**Language detection:**
- isiZulu (`zu`), isiXhosa (`xh`), Afrikaans (`af`), English (`en` — default)

---

## Authentication

### API Key

Every request must include an `X-API-Key` header. Keys are validated against the `ApiKey` table in MySQL:

- Key must exist, be active (`isActive = 1`), and not expired
- `lastUsedAt` is updated on each use
- Invalid/missing key returns `401`; inactive/expired returns `403`

---

## Request Processing Flow

### 1. Customer Lookup

On every request, the endpoint calls `getCustomerContext` with the customer's phone number to fetch their account data from the Silulumanzi billing system.

- **Found:** The AI addresses the customer by name, has their account number, balance, address, connection status, and recent faults.
- **Not found:** The AI provides general assistance only and advises them to register their phone number at a service center.

### 2. System Prompt Construction

The system prompt is built dynamically per request:

1. **Base identity** — "You are the Silulumanzi customer service assistant"
2. **Customer data** — Full account JSON (if found), or a notice that no account was linked
3. **Registered property** — Extracted from `registered_property` field or `PROPERTY_ID` + `UA_ADRESS` fields
4. **Rules** — Conciseness, professionalism, language matching, information security
5. **Fault reporting procedure** — Property confirmation flow (see below)
6. **Knowledge base** — Official Silulumanzi notices (payment methods, bank details, contact info, office hours, etc.) extracted from images via OCR at startup
7. **Channel** — `whatsapp`, `web`, etc.

### 3. LLM Tool-Calling Loop

The AI can call tools up to **5 iterations**. Each iteration:

1. Send messages + tool definitions to OpenRouter
2. If the LLM returns tool calls → execute them in parallel via the AiClient PHP API
3. Feed tool results back to the LLM as `tool` messages
4. Repeat until the LLM returns a text-only response (no tool calls)

Tool calls always have `phone_number` auto-injected from the original request so the PHP backend always receives it.

### 4. SSE Streaming

Once the final text response is ready:
1. Split into word/whitespace tokens
2. Stream each as a `{"type":"token","text":"..."}` event
3. End with `{"type":"done",...}` containing the full response, action, and language

---

## Tools (AiClient API)

All tools call `https://softaware.net.za/AiClient.php?action=<name>` with a POST body. Authentication is via a daily rotating SHA-256 token: `SHA256(shared_secret + YYYY-MM-DD)`.

| Tool                      | Purpose                                    | Key Parameters                                                   |
|---------------------------|--------------------------------------------|------------------------------------------------------------------|
| `getCustomerContext`      | Fetch customer account data by phone       | `phone_number`                                                   |
| `checkAreaOutages`        | Check water outages in an area             | `area`                                                           |
| `reportFault`             | Report a water fault                       | `description`, `phone_number`, `faultType`, `address`, `property_id`, `location` |
| `getFaultStatus`          | Check status of a reported fault           | `faultReference`                                                 |
| `getFinancials`           | Get balance and payment history            | `accountNumber`                                                  |
| `getStatements`           | Get recent statements                      | `accountNumber`                                                  |
| `getStatementLink`        | Get a downloadable statement link          | `accountNumber`, `statementDate`                                 |
| `getMaintenanceActivities`| Get scheduled maintenance in an area       | `area`                                                           |
| `getVacancies`            | List current job vacancies                 | *(none)*                                                         |
| `addCustomerNote`         | Add a note to customer account             | `accountNumber`, `note`                                          |

### Status Messages

While tools execute, the client receives status events:

| Tool                       | Status Message                          |
|----------------------------|-----------------------------------------|
| `getCustomerContext`       | "Checking your customer profile..."     |
| `checkAreaOutages`         | "Checking outages in your area..."      |
| `reportFault`              | "Reporting your fault..."               |
| `getFaultStatus`           | "Checking fault status..."              |
| `getFinancials`            | "Checking your account balance..."      |
| `getStatements`            | "Fetching your statements..."           |
| `getMaintenanceActivities` | "Checking maintenance activities..."    |
| `getStatementLink`         | "Generating your statement link..."     |
| `getVacancies`             | "Checking available vacancies..."       |

---

## Fault Reporting Flow

### When the customer has a registered property

```
Customer: "I want to report a leak"
AI:       "Is this issue at your registered property — Stand 26A, Mataffin, 1205?"
Customer: "Yes"
AI:       → calls reportFault with property_id (links to OPER_APPLICATIONS)
          "Your fault has been reported. Reference number: 21815112"
```

### When the customer says no or has no registered property

```
Customer: "I want to report no water"
AI:       "Could you please provide the address?"
Customer: "15 Bester Street, Sonheuwel"
AI:       → calls reportFault with address only (system auto-resolves from CONN_DTL)
          "Your fault has been reported. Reference number: 21815113"
```

### reportFault Payload

```json
{
  "phone_number": "0832691437",
  "description": "Water leak at the property",
  "faultType": "leak",
  "accountNumber": "92135908",
  "address": "Stand 26A, Mataffin, 1205",
  "property_id": 4821,
  "location": { "latitude": -26.195246, "longitude": 28.034088 }
}
```

- `property_id` — only included when the fault is at the registered property
- `location` — only included if the customer shares GPS coordinates
- `address` — always included (either from registered property or customer-provided)

---

## Knowledge Base

At startup, the endpoint loads `/var/opt/backend/images/extracted/_knowledge_base.txt` — text extracted via Tesseract OCR from official Silulumanzi notice images. This gives the AI grounded answers for:

- **Payment methods** — EFT, debit order, cash at offices, Pick n Pay, Shoprite, etc.
- **Bank details** — ABSA, Account 4053446784, Branch 632005
- **Contact info** — 013 752 6839, enquiries@silulumanzi.com, WhatsApp 083 269 1456
- **Office hours** — 07:30–15:30 Mon–Fri, Riverside Saturdays 08:00–13:00
- **Office locations** — Mbombela City (Riverside), KaNyamazane, Matsulu
- **Payment deadline** — 7th of each month
- **Debit order setup** — process, benefits, tips
- **Avoiding estimated billing** — photograph meter, email with account number
- **Blue Drop certification** — only provider in Mpumalanga with this status

---

## Information Security Rules

The AI is instructed to **never share** with customers:

- Job card numbers (internal tracking only)
- Internal IDs: `property_id`, `CUSTOMER_ID`, `CUSTKEY`
- System field names: `CONN_DTL`, `OPER_APPLICATIONS`, etc.
- Internal reference numbers from outage/fault data

The AI **may share:**
- Fault reference numbers returned after a successful `reportFault` call (customer-facing)
- Account number, balance, and payment info from the customer's own account
- General service information from the knowledge base

---

## LLM Provider

| Setting              | Value                                |
|----------------------|--------------------------------------|
| Provider             | OpenRouter                           |
| Model                | `openai/gpt-4o-mini` (configurable)  |
| Temperature          | 0.3                                  |
| Max tokens           | 1024                                 |
| Timeout              | 30 seconds                           |
| Tool calling         | OpenAI-compatible function calling    |

### Environment Variables

| Variable               | Purpose                          | Default                          |
|------------------------|----------------------------------|----------------------------------|
| `OPENROUTER_API_KEY`   | OpenRouter API key               | *(required)*                     |
| `OPENROUTER_BASE_URL`  | API base URL                     | `https://openrouter.ai/api/v1`  |
| `OPENROUTER_MODEL`     | Model ID                         | `openai/gpt-4o-mini`            |

---

## Error Handling

| Scenario                     | Behavior                                                         |
|------------------------------|------------------------------------------------------------------|
| LLM returns HTTP error       | Stream emits a generic `done` event with fallback message        |
| Tool call fails              | Returns `{"success": false, "error": "..."}` — LLM handles gracefully |
| Customer lookup fails        | AI operates in "no account found" mode                           |
| Stream already started       | Error is logged server-side; `done` event sent with fallback     |
| Stream not started           | Error is passed to Express error handler (JSON error response)   |

---

## File Map

```
src/routes/chat.ts          ← Endpoint logic, tools, LLM loop, SSE streaming
src/config/env.ts            ← Environment variable schema (Zod)
src/middleware/apiKey.ts      ← API key validation middleware (MySQL)
images/extracted/             ← OCR-extracted text from Silulumanzi notice images
  _knowledge_base.txt         ← Combined knowledge base loaded at startup
  *.txt                       ← Individual image extractions
images/*.jpg                  ← Source images (official Silulumanzi notices)
```

---

## Deployment

- **Runtime:** Node.js 18, TypeScript compiled to ESM
- **Process manager:** PM2 (`pm2 restart 0 --update-env`)
- **Port:** 8787 (localhost)
- **Public URL:** `https://mcp.softaware.net.za/silulumanzi`
- **Build:** `npx tsc` → outputs to `dist/`
- **DNS resolution:** Forced IPv4 (`dns.setDefaultResultOrder('ipv4first')`) to prevent fetch timeouts
