# Silulumanzi Node.js Chat Server → AI Service API

**For**: Silulumanzi Node.js Chat Server developers
**Date**: February 2026

This document describes the endpoint your Node.js Chat Server must call to send customer messages to the AI Service and receive responses.

---

## Endpoint

```
POST https://mcp.softaware.net.za/silulumanzi
Content-Type: application/json
X-API-Key: 0174e6487f5ea034e1cddbcbac8d9d89093638a274cf3c2e73a13231b24683f5
```

All requests require the `X-API-Key` header. Contact SoftAware for your production key.

---

## Request

```json
{
  "user_id":   "27821234567",
  "channel":   "whatsapp",
  "message":   "My water is brown",
  "name":      "John Doe",
  "timestamp": "2026-02-22T10:30:00Z",
  "history": [
    { "role": "user",      "content": "Hi" },
    { "role": "assistant", "content": "Hello! How can I help you today?" }
  ]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `user_id` | string | ✅ | Customer phone number or account number |
| `message` | string | ✅ | The customer's current message |
| `channel` | string | ❌ | `whatsapp`, `web`, `sms`, `email` — default `web` |
| `name` | string | ❌ | Customer's display name if known |
| `timestamp` | string | ❌ | ISO 8601 timestamp of the message |
| `history` | array | ❌ | Previous conversation turns (for multi-turn sessions) |

---

## Response

```json
{
  "response": "I'm sorry to hear that, John. Please try running your cold tap for a few minutes. If it persists, I can log a fault for you.",
  "action":   "reply",
  "language": "en"
}
```

| Field | Type | Values | Description |
|---|---|---|---|
| `response` | string | — | The message to send back to the customer |
| `action` | string | `reply` | Continue the conversation |
| | | `escalate` | Hand off to a human agent |
| | | `end_session` | Conversation is complete |
| `language` | string | `en`, `zu`, `xh`, `af` | Detected language of the response |

---

## How It Works (behind the scenes)

You don't need to fetch customer data — the AI Service does this automatically:

1. Your server sends the customer's message with their `user_id`.
2. The AI Service looks up the `user_id` in EDAMS via a local proxy (`AiClient.php` → `portal.silulumanzi.com/api/ai/`).
3. If customer context is found (balance, meters, area, etc.), it's injected into the AI prompt.
4. The LLM generates a response.
5. The structured response is returned to your server.

---

## Multi-turn Conversations

Your server is responsible for storing conversation history and replaying it with each request via the `history` field.

**First message:**
```json
{
  "user_id": "27821234567",
  "channel": "whatsapp",
  "message": "My water is brown",
  "name": "John Doe"
}
```

**Second message (include prior turns):**
```json
{
  "user_id": "27821234567",
  "channel": "whatsapp",
  "message": "It has been brown for two days",
  "name": "John Doe",
  "history": [
    { "role": "user",      "content": "My water is brown" },
    { "role": "assistant", "content": "How long has it been brown?" }
  ]
}
```

---

## Error Responses

| HTTP Code | Body | Meaning |
|---|---|---|
| `401` | `{"error": "API key required. Provide X-API-Key header."}` | Missing or invalid API key |
| `400` | `{"error": "..."}` | Invalid request (missing `user_id` or `message`) |
| `500` | `{"error": "INTERNAL_SERVER_ERROR"}` | AI Service internal error — retry |

---

## Node.js Example

```javascript
const AI_CHAT_URL = "https://mcp.softaware.net.za/silulumanzi";
const AI_API_KEY  = "0174e6487f5ea034e1cddbcbac8d9d89093638a274cf3c2e73a13231b24683f5";

async function sendToAI(userId, message, name, history = []) {
  const res = await fetch(AI_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": AI_API_KEY,
    },
    body: JSON.stringify({
      user_id: userId,
      channel: "whatsapp",
      message,
      name,
      history,
    }),
  });

  if (!res.ok) throw new Error(`AI error: ${res.status}`);
  return res.json(); // { response, action, language }
}

// Usage
const reply = await sendToAI("27821234567", "My water is brown", "John Doe");
console.log(reply.response); // "I'm sorry to hear that..."

if (reply.action === "escalate") {
  // Transfer to human agent
}
```

---

## Quick Test (curl)

```bash
curl -s -X POST https://mcp.softaware.net.za/silulumanzi \
  -H "Content-Type: application/json" \
  -H "X-API-Key: 0174e6487f5ea034e1cddbcbac8d9d89093638a274cf3c2e73a13231b24683f5" \
  -d '{
    "user_id": "27821234567",
    "channel": "whatsapp",
    "message": "My water is brown",
    "name": "John Doe"
  }'
```
