# Kone Solutions — API Integration Guide

> **Version:** 1.0.0  
> **Last Updated:** 2026-03-13  
> **Status:** ✅ Active  
> **Support:** api-support@softaware.net.za

---

## Overview

This document describes the AI-powered CV/document reading API that SoftAware provides for Kone Solutions. The API accepts CV content — either as pasted text or scanned images — and returns structured candidate data in JSON format, along with a detailed cost and processing report.

**Key features:**
- Structured JSON extraction from CVs (personal info, skills, experience, education)
- Vision support for scanned/photographed CVs
- Per-request cost tracking in South African Rand (R0.20 vision, R0.05 text)
- Intelligent routing — local AI during off-peak hours to reduce costs
- Rich `_kone_meta` reporting block in every response

---

## Quick Start

### Base URL

```
https://api.softaware.net.za/api/v1/webhook/ep_kone_solutions_cv
```

### Process a Text CV (R0.05)

```bash
curl -X POST https://api.softaware.net.za/api/v1/webhook/ep_kone_solutions_cv \
  -H "Content-Type: application/json" \
  -d '{
    "message": "John Doe\nSoftware Engineer\n5 years experience in Python, React, Node.js\nBSc Computer Science, University of Pretoria, 2018\njohn@email.com | +27 82 123 4567"
  }'
```

### Process an Image CV (R0.20)

```bash
curl -X POST https://api.softaware.net.za/api/v1/webhook/ep_kone_solutions_cv \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Extract all information from this CV",
    "files": [{ "mimeType": "image/jpeg", "dataBase64": "'$(base64 -w0 cv_scan.jpg)'" }]
  }'
```

---

## Authentication

> **Note:** API key authentication is configured but not yet provisioned. Contact SoftAware to receive your API key.

Once provisioned, include the key in every request:

```http
POST /api/v1/webhook/ep_kone_solutions_cv HTTP/1.1
Host: api.softaware.net.za
Content-Type: application/json
X-API-Key: your-api-key-here
```

**Security:** Never expose API keys in client-side (browser) code. Always proxy requests through your own backend server.

---

## Request Format

### Endpoint

```
POST /api/v1/webhook/ep_kone_solutions_cv
```

### Headers

| Header | Value | Required |
|--------|-------|----------|
| `Content-Type` | `application/json` | Yes |
| `X-API-Key` | Your API key | When provisioned |

### Body Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `message` | string | **Yes** | The CV text content, or an instruction like "Extract all information from this CV" when sending images |
| `files` | array | No | Array of image attachments for vision processing |
| `files[].mimeType` | string | Yes (if files) | MIME type: `image/jpeg`, `image/png`, `image/webp`, `image/gif` |
| `files[].dataBase64` | string | Yes (if files) | Base64-encoded image data (no `data:` prefix needed) |
| `user_id` | string | No | Your internal user/session identifier for tracking |
| `history` | array | No | Previous conversation messages for context |

### Text Request Example (R0.05)

```json
{
  "message": "Jane Smith\nProject Manager | PMP Certified\n8 years in IT project delivery\nMBA, Wits Business School, 2020\nBSc IT, University of Johannesburg, 2015\njane.smith@email.co.za | +27 83 456 7890\nSkills: Agile, Scrum, PRINCE2, Jira, Confluence, Stakeholder Management",
  "user_id": "kone-recruiter-01"
}
```

### Vision Request Example (R0.20)

```json
{
  "message": "Extract all information from this CV",
  "files": [
    {
      "mimeType": "image/jpeg",
      "dataBase64": "/9j/4AAQSkZJRgABAQ..."
    }
  ],
  "user_id": "kone-recruiter-01"
}
```

### Multi-File Request Example (R0.20)

```json
{
  "message": "Extract information from all pages of this CV",
  "files": [
    { "mimeType": "image/png", "dataBase64": "iVBORw0KGgo..." },
    { "mimeType": "image/png", "dataBase64": "iVBORw0KGgo..." }
  ]
}
```

---

## Response Format

### Success Response (200)

Every response contains two top-level fields:

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always `true` for successful processing |
| `data` | object or string | Structured CV data (JSON) or raw text if parsing failed |
| `_kone_meta` | object | Cost, processing, and routing report |

### Example Response

```json
{
  "success": true,
  "data": {
    "personal_info": {
      "name": "Jane Smith",
      "email": "jane.smith@email.co.za",
      "phone": "+27 83 456 7890",
      "location": null,
      "linkedin": null,
      "portfolio": null
    },
    "professional_summary": "Experienced project manager with 8 years in IT project delivery, PMP certified with an MBA.",
    "skills": {
      "technical": ["Agile", "Scrum", "PRINCE2", "Jira", "Confluence"],
      "soft": ["Stakeholder Management"],
      "languages": []
    },
    "experience": [],
    "education": [
      {
        "institution": "Wits Business School",
        "degree": "MBA",
        "field": "Business Administration",
        "year": "2020",
        "gpa": null
      },
      {
        "institution": "University of Johannesburg",
        "degree": "BSc",
        "field": "Information Technology",
        "year": "2015",
        "gpa": null
      }
    ],
    "certifications": [
      { "name": "PMP", "issuer": "PMI", "year": null }
    ],
    "total_years_experience": 8,
    "seniority_level": "senior"
  },
  "_kone_meta": {
    "request_type": "TEXT_CV",
    "files_processed": 0,
    "cost": {
      "amount_zar": 0.05,
      "formatted": "R0.05",
      "credits_deducted": 5
    },
    "processing": {
      "provider": "glm",
      "model": "glm-4.6",
      "routing": "glm-primary",
      "duration_ms": 1247
    },
    "timestamp": "2026-03-13T10:15:32.000+02:00"
  }
}
```

---

## The `_kone_meta` Report

This block is included in **every response** and is designed for your reporting and cost tracking systems.

### Cost Block

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `cost.amount_zar` | number | `0.20` | Cost in South African Rand |
| `cost.formatted` | string | `"R0.20"` | Human-readable cost |
| `cost.credits_deducted` | number | `20` | Internal credits used (1 credit = R0.01) |

### Processing Block

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `processing.provider` | string | `"openrouter"` | AI provider that processed the request |
| `processing.model` | string | `"openai/gpt-4o"` | Exact model used |
| `processing.routing` | string | `"paid-vision-cascade"` | Why this provider was chosen (see table below) |
| `processing.duration_ms` | number | `3842` | Total processing time |

### Routing Reasons

| Reason | When | Cost Impact |
|--------|------|-------------|
| `off-peak-ollama-vision` | Vision request, 18:00–06:00 SAST | Free (local) |
| `off-peak-ollama-text` | Text request, 18:00–06:00 SAST | Free (local) |
| `paid-vision-cascade` | Vision request, 06:00–18:00 SAST | Cloud cost |
| `glm-primary` | Text, GLM responded (business hours) | GLM cost |
| `openrouter-fallback` | Text, GLM failed → OpenRouter | OpenRouter cost |
| `ollama-last-resort` | All cloud providers failed | Free (local) |

---

## Pricing

| Request Type | Trigger | Cost (ZAR) | Credits |
|-------------|---------|-----------|---------|
| **Vision** | `files` array contains image(s) | R0.20 | 20 |
| **Text** | No files, or no image files | R0.05 | 5 |

### Monthly Budget Examples

| Scenario | Vision | Text | Total Cost | Credits Used |
|----------|--------|------|-----------|-------------|
| 500 scanned CVs | 500 | 0 | R100.00 | 10,000 |
| 2,000 text CVs | 0 | 2,000 | R100.00 | 10,000 |
| Mixed: 300 scans + 1,000 text | 300 | 1,000 | R110.00 | 11,000 |
| Off-peak batch (all local) | any | any | R0.00* | Same credits** |

\* Off-peak routing uses local Ollama — no cloud inference cost, but credits are still deducted for billing purposes.  
\** Credit deductions are the same regardless of routing — R0.20/R0.05 per request.

---

## Cost Optimisation

### Schedule Batch Processing Off-Peak

Requests between **18:00 and 06:00 SAST** are routed to the local Ollama model, avoiding cloud inference costs. While you are still charged the same credits (R0.20 / R0.05), the underlying AI inference cost to SoftAware is zero, which may be reflected in future pricing negotiations.

### Use Text When Possible

If you can extract the text from a CV before sending (e.g., parsing a Word document), send it as a text request (R0.05) rather than a screenshot (R0.20).

---

## CV Data Schema

The `data` field contains structured CV information:

```typescript
{
  personal_info: {
    name: string | null;
    email: string | null;
    phone: string | null;
    location: string | null;
    linkedin: string | null;
    portfolio: string | null;
  };
  professional_summary: string | null;
  skills: {
    technical: string[];
    soft: string[];
    languages: string[];
  };
  experience: Array<{
    company: string;
    title: string;
    start_date: string | null;
    end_date: string | null;
    duration: string | null;
    responsibilities: string[];
    achievements: string[];
  }>;
  education: Array<{
    institution: string;
    degree: string;
    field: string;
    year: string | null;
    gpa: string | null;
  }>;
  certifications: Array<{
    name: string;
    issuer: string;
    year: string | null;
  }>;
  total_years_experience: number | null;
  seniority_level: "junior" | "mid" | "senior" | "executive" | null;
}
```

If the AI cannot parse the response as JSON, the `data` field will contain the raw text response instead.

If the input is not a CV, the `data` field will contain:

```json
{
  "error": "NOT_A_CV",
  "message": "The provided content does not appear to be a CV or resume."
}
```

---

## Error Responses

| Status | Error Code | Description |
|--------|-----------|-------------|
| 400 | `Invalid payload` | Missing `message` field |
| 402 | `INSUFFICIENT_CREDITS` | Credit balance exhausted — contact SoftAware to top up |
| 403 | `Endpoint disabled` | Endpoint has been disabled by the administrator |
| 403 | `NO_ACTIVE_PACKAGE` | No active subscription found |
| 403 | `IP_RESTRICTED` | Your IP address is not in the allowlist |
| 404 | `Endpoint not found` | Invalid endpoint ID |
| 500 | `Processing error` | All AI providers failed — retry after a moment |
| 503 | `Endpoint paused` | Endpoint is temporarily paused for maintenance |

---

## Integration Examples

### Node.js (Backend Proxy)

```javascript
const express = require('express');
const multer = require('multer');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const WEBHOOK = 'https://api.softaware.net.za/api/v1/webhook/ep_kone_solutions_cv';
const API_KEY = process.env.SOFTAWARE_API_KEY;

app.post('/api/read-cv', upload.single('cv'), async (req, res) => {
  const payload = {
    message: req.body.prompt || 'Extract all information from this CV',
    user_id: req.user?.id || 'anonymous',
  };

  if (req.file) {
    payload.files = [{
      mimeType: req.file.mimetype,
      dataBase64: req.file.buffer.toString('base64'),
    }];
  }

  const response = await fetch(WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  res.json(result);
});
```

### Python

```python
import requests, base64
from pathlib import Path

WEBHOOK = "https://api.softaware.net.za/api/v1/webhook/ep_kone_solutions_cv"
API_KEY = "your-api-key"

def read_cv(file_path: str) -> dict:
    payload = { "message": "Extract all information from this CV" }

    path = Path(file_path)
    image_mimes = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" }

    if path.suffix.lower() in image_mimes:
        with open(file_path, "rb") as f:
            payload["files"] = [{ "mimeType": image_mimes[path.suffix.lower()], "dataBase64": base64.b64encode(f.read()).decode() }]
    else:
        with open(file_path, "r") as f:
            payload["message"] += "\n\n" + f.read()

    resp = requests.post(WEBHOOK, json=payload, headers={"X-API-Key": API_KEY}, timeout=60)
    resp.raise_for_status()
    result = resp.json()

    meta = result["_kone_meta"]
    print(f"✓ {meta['cost']['formatted']} | {meta['request_type']} | {meta['processing']['duration_ms']}ms")
    return result
```

### Batch Processing with Cost Report

```javascript
async function processBatch(files) {
  let totalCost = 0, visionCount = 0, textCount = 0;

  for (const file of files) {
    const result = await fetch(WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Extract CV info', files: file.isImage ? [{ mimeType: file.type, dataBase64: file.base64 }] : undefined }) }).then(r => r.json());

    totalCost += result._kone_meta.cost.amount_zar;
    result._kone_meta.request_type === 'VISION_CV' ? visionCount++ : textCount++;

    await new Promise(r => setTimeout(r, 500)); // rate limit
  }

  console.log(`Vision: ${visionCount} × R0.20 = R${(visionCount * 0.2).toFixed(2)}`);
  console.log(`Text:   ${textCount} × R0.05 = R${(textCount * 0.05).toFixed(2)}`);
  console.log(`Total:  R${totalCost.toFixed(2)}`);
}
```

---

## Supported File Types

| Type | MIME | Processing | Cost |
|------|------|-----------|------|
| JPEG | `image/jpeg` | Vision | R0.20 |
| PNG | `image/png` | Vision | R0.20 |
| WebP | `image/webp` | Vision | R0.20 |
| GIF | `image/gif` | Vision | R0.20 |
| BMP | `image/bmp` | Vision | R0.20 |
| Text | *(in message body)* | Text | R0.05 |

> **PDF/Word:** Convert to images (screenshots or scans) before sending. The vision model processes visual content.

---

## Rate Limits & Usage

| Metric | Value |
|--------|-------|
| Timeout | 60 seconds (vision may take longer) |
| Monthly Credits | 50,000 (adjustable) |
| Max File Size | ~10 MB (base64 encoded) |
| Response Format | JSON |

---

## Support & Contact

| | |
|---|---|
| **Technical Support** | api-support@softaware.net.za |
| **Emergency (API down)** | admin@softaware.net.za |
| **Billing** | accounts@softaware.net.za |

---

*This API is provided by SoftAware (Pty) Ltd under the Enterprise AI Services agreement. Usage is subject to the terms of your service contract.*
