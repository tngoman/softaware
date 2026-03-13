# Silulumanzi Water Services — API Integration Guide

> **Version:** 2.0.0  
> **Last Updated:** 2026-03-13  
> **Status:** ✅ Active  
> **Support:** api-support@softaware.net.za

---

## Overview

This document describes the AI-powered customer service API that SoftAware provides for Silulumanzi Water Services. The API enables your systems (WhatsApp bots, web chat, IVR, mobile apps) to send customer messages to an AI assistant that understands your business, can look up customer data, report faults, check outages, and more.

The AI assistant is configured specifically for Silulumanzi with:
- Knowledge of your office hours, payment methods, bank details, locations, and policies
- Access to your internal API for live customer data, fault reporting, and maintenance schedules
- Multi-language support (English, isiZulu, isiXhosa, Afrikaans)

---

## Quick Start

### Base URL

```
https://api.softaware.net.za/api/v1/webhook/ep_silulumanzi_91374147
```

### Send a Message

```bash
curl -X POST https://api.softaware.net.za/api/v1/webhook/ep_silulumanzi_91374147 \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What are your office hours?",
    "phone_number": "0831234567"
  }'
```

### Response

```json
{
  "response": "Our customer care offices are open Monday to Friday, 07:30 – 16:30...",
  "action": "reply",
  "language": "en",
  "phone_number": "0831234567"
}
```

---

## Authentication

The webhook endpoint uses **endpoint ID authentication** — the unique endpoint ID (`ep_silulumanzi_91374147`) in the URL acts as the access token. Only systems with knowledge of this endpoint ID can send requests.

> **Important:** Keep this endpoint ID confidential. Do not expose it in client-side code, public repositories, or unencrypted communications.

For additional security layers (IP whitelisting, API key headers), contact SoftAware support.

---

## Request Format

### Endpoint

```
POST /api/v1/webhook/ep_silulumanzi_91374147
```

### Headers

| Header | Value | Required |
|--------|-------|----------|
| `Content-Type` | `application/json` | Yes |

### Body Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `message` | string | **Yes** | The customer's message text |
| `phone_number` | string | No | Customer's phone number. Used for identification and account lookup. If omitted, the customer is treated as anonymous — they can still report faults, check outages, and ask general questions. |
| `session_id` | string | No | Optional session identifier for conversation tracking |
| `language` | string | No | Preferred language code (`en`, `zu`, `xh`, `af`). Auto-detected if omitted. |
| `metadata` | object | No | Additional context to pass through (e.g., channel, device) |

### Example Request

```json
{
  "message": "I want to report a burst pipe at 45 Mandela Drive, Kabokweni",
  "phone_number": "0761234567",
  "session_id": "whatsapp_0761234567_20260312",
  "language": "en"
}
```

---

## Response Format

### Success Response (200)

| Field | Type | Description |
|-------|------|-------------|
| `response` | string | The AI assistant's reply text |
| `action` | string | Action type — typically `"reply"` |
| `language` | string | Language code of the response |
| `phone_number` | string | Echo of the customer's phone number |

### Example Response

```json
{
  "response": "I've reported the burst pipe at 45 Mandela Drive, Kabokweni. Your fault reference number is FLT-2026-03-0847. Our team will investigate within 24 hours. For emergencies, please call our 24-hour line at 013 759 2000.",
  "action": "reply",
  "language": "en",
  "phone_number": "0761234567"
}
```

### Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `VALIDATION_ERROR` | Missing required fields (`message`, `phone_number`) |
| 402 | `INSUFFICIENT_CREDITS` | API credit balance exhausted — contact SoftAware |
| 403 | `ENDPOINT_DISABLED` | Endpoint has been temporarily disabled |
| 404 | `ENDPOINT_NOT_FOUND` | Invalid endpoint ID |
| 429 | `RATE_LIMITED` | Too many requests — slow down |
| 500 | `INTERNAL_ERROR` | Server error — retry after a moment |
| 502 | `LLM_ERROR` | AI model temporarily unavailable |
| 503 | `ENDPOINT_PAUSED` | Endpoint maintenance in progress |

---

## AI Capabilities

The assistant has access to **11 tools** that query your EDAMS and internal systems in real-time:

### Customer Lookup

| Tool | Description | Input |
|------|-------------|-------|
| `getCustomerContext` | Fetch customer account information, property details (address, GPS, PROP_REF), balances, and recent faults | `phone_number` (optional) |

The assistant automatically calls this when a customer first interacts. If `phone_number` is provided, their full account profile is loaded including property details with GIS coordinates. If omitted, the customer is treated as anonymous.

### Outage & Maintenance

| Tool | Description | Input |
|------|-------------|-------|
| `checkAreaOutages` | Check for active water outages and reported faults in a specific area | `area` (suburb/town name) |
| `getMaintenanceActivities` | Get the full list of EDAMS maintenance activity codes (200+ activities). Used to map fault descriptions to `mactivity_no` for `reportFault`. | *(none)* |
| `getApplicationTypes` | Get all EDAMS application types (e.g. Maintenance=830, Customer Complaints=282). Informational — `reportFault` defaults to 830. | *(none)* |

### Fault Management

| Tool | Description | Input |
|------|-------------|-------|
| `reportFault` | Report a water or sewer fault. Creates linked EDAMS records (OPER_APPLICATIONS → MAINTENANCE_REQUESTS → JOBCARDS). | `description` (required), `phone_number`, `account_number`, `address`, `mactivity_no`, `landmark_street` |
| `getFaultStatus` | Check the status of a reported fault by reference number | `reference_number` |

**`reportFault` parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `description` | string | **Yes** | Clear description of the fault |
| `phone_number` | string | No | Reporter's phone number. Omit for anonymous reports. |
| `account_number` | string | No | Customer CUSTKEY. If provided, property address and GPS are auto-resolved. |
| `address` | string | No | Fault location. Auto-resolved from account if `account_number` is provided. |
| `mactivity_no` | integer | No | Activity code from `getMaintenanceActivities` (e.g. 152=water leak, 153=no water, 154=sewer overflow). |
| `landmark_street` | string | No | Nearby landmark or cross-street for field teams. |

**`reportFault` response** includes: `reference_number`, `application_id`, `jobcard_no`, `mrequest_no`, `address`, `latitude`, `longitude`.

### Financial

| Tool | Description | Input |
|------|-------------|-------|
| `getFinancials` | Get account balance and payment history | `account_number` |
| `getStatements` | Get recent account statements | `account_number` |
| `getStatementLink` | Get a downloadable statement PDF link | `account_number` |

### Other

| Tool | Description | Input |
|------|-------------|-------|
| `getVacancies` | List current job vacancies | *(none)* |
| `addCustomerNote` | Add a note to the customer's account | `account_number`, `note` |

---

## Integration Examples

### WhatsApp Bot (Node.js)

```javascript
const axios = require('axios');

async function handleWhatsAppMessage(from, text) {
  const response = await axios.post(
    'https://api.softaware.net.za/api/v1/webhook/ep_silulumanzi_91374147',
    {
      message: text,
      phone_number: from,
      session_id: `whatsapp_${from}`,
    },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    }
  );

  // Send response.data.response back to WhatsApp
  return response.data.response;
}
```

### Python

```python
import requests

def send_message(phone_number: str, message: str) -> str:
    response = requests.post(
        "https://api.softaware.net.za/api/v1/webhook/ep_silulumanzi_91374147",
        json={
            "message": message,
            "phone_number": phone_number,
        },
        timeout=30,
    )
    response.raise_for_status()
    return response.json()["response"]
```

### PHP

```php
$ch = curl_init('https://api.softaware.net.za/api/v1/webhook/ep_silulumanzi_91374147');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode([
        'message' => $customerMessage,
        'phone_number' => $phoneNumber,
    ]),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 30,
]);

$result = json_decode(curl_exec($ch), true);
curl_close($ch);

$aiReply = $result['response'];
```

---

## Rate Limits & Usage

| Metric | Value |
|--------|-------|
| Rate Limit | 60 requests per minute |
| Timeout | 30 seconds |
| Monthly Credits | 50,000 (10 credits per request = ~5,000 messages/month) |
| Max Message Size | 4,000 characters |
| Response Format | JSON |

When your monthly credit balance is depleted, requests will return a `402 INSUFFICIENT_CREDITS` error. Contact SoftAware to top up or upgrade your plan.

---

## Conversation Flow

A typical customer interaction follows this pattern:

```
Customer: "Hi, I have no water at my house"
    ↓
AI: Calls getCustomerContext(phone_number) → loads account info
    ↓
AI: "I see you're at 12 Riverside Road, Nelspruit. Let me check for outages..."
    ↓
AI: Calls checkAreaOutages("Nelspruit") → checks for known issues
    ↓
AI: "There are no reported outages in your area. Would you like me to report a fault?"
    ↓
Customer: "Yes please, there's been no water since this morning"
    ↓
AI: Calls reportFault(...) → creates fault ticket
    ↓
AI: "I've logged fault FLT-2026-03-0847. Our team will investigate within 24 hours."
```

---

## Best Practices

1. **Include `phone_number` when available** — The AI uses this to identify the customer and load their account and property data. If omitted, the customer is treated as anonymous but can still report faults, check outages, and ask general questions.
2. **Use consistent `session_id`** — This helps the AI maintain context across a conversation
3. **Handle timeouts gracefully** — If the API takes longer than 30s, retry once, then show a fallback message
4. **Don't modify the AI's response** — The response text is ready to send directly to the customer
5. **Log responses** — Keep your own logs for audit/debugging purposes
6. **Respect rate limits** — Implement exponential backoff if you receive 429 responses

---

## Support & Contact

| | |
|---|---|
| **Technical Support** | api-support@softaware.net.za |
| **Emergency (API down)** | admin@softaware.net.za |
| **Documentation** | Available in your admin panel under the Documentation tab |
| **Status Page** | Contact SoftAware for real-time API status |

---

*This API is provided by SoftAware (Pty) Ltd under the Enterprise AI Services agreement. Usage is subject to the terms of your service contract.*
