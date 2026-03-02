# AI Website Builder - Implementation Guide

## Overview

The AI Website Builder uses **Qwen 2.5 Coder (7B)** to generate complete, professional HTML landing pages from simple business data. The generated sites include Tailwind CSS styling, contact forms, and the Soft Aware widget integration.

## Features

✅ **Instant Generation**: Complete HTML websites generated in ~3 minutes  
✅ **Tailwind CSS**: Beautiful, responsive designs via CDN (no separate CSS files)  
✅ **Contact Form Integration**: Forms submit to `https://api.softaware.co.za/v1/leads/submit`  
✅ **Anti-Spam Protection**: Honeypot field (`bot_check_url`) for automated spam filtering  
✅ **Widget Integration**: Soft Aware chat widget automatically injected  
✅ **Mobile Responsive**: All designs are mobile-friendly  

---

## API Endpoint

### `POST /api/v1/sites/generate-ai`

**Authentication**: Required (Bearer JWT token)

**Request Body**:
```json
{
  "businessName": "TechFlow Innovations",
  "tagline": "Empowering businesses through intelligent automation",
  "aboutText": "We are a cutting-edge technology company...",
  "services": [
    "AI Chatbots",
    "Process Automation",
    "Data Analytics"
  ],
  "logoUrl": "https://example.com/logo.png",  // Optional
  "clientId": "client_demo_001"  // Required - widget client ID
}
```

**Response** (Success):
```json
{
  "success": true,
  "html": "<!DOCTYPE html>\n<html>...</html>",
  "metadata": {
    "model": "qwen2.5-coder:7b",
    "businessName": "TechFlow Innovations",
    "generatedAt": "2026-02-27T16:55:25.544Z"
  }
}
```

**Response** (Error):
```json
{
  "error": "Missing required fields",
  "required": ["businessName", "tagline", "aboutText", "services", "clientId"]
}
```

---

## System Requirements

### Ollama Model
```bash
ollama pull qwen2.5-coder:7b
```

### Environment Variables (.env)
```bash
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5-coder:7b
```

---

## Testing

### 1. Generate Test JWT Token
```bash
cd /var/opt/backend
node generate-test-token.mjs
```

### 2. Run Test Script
```bash
./test-ai-simple.sh
```

### 3. Manual cURL Test
```bash
TOKEN="your_jwt_token_here"

curl -X POST http://localhost:8787/api/v1/sites/generate-ai \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "My Business",
    "tagline": "We do great things",
    "aboutText": "About our amazing company...",
    "services": ["Service 1", "Service 2"],
    "clientId": "client_123"
  }' \
  | jq -r '.html' > website.html
```

---

## How It Works

### 1. System Prompt Engineering

The endpoint sends a carefully crafted prompt to Qwen 2.5 Coder that:
- Explicitly forbids markdown blocks (ensures raw HTML output)
- Requires Tailwind CSS via CDN
- Specifies exact form structure with honeypot field
- Mandates Soft Aware widget script injection
- Includes business data for personalization

### 2. AI Generation

Ollama generates HTML with these parameters:
- **Temperature**: 0.3 (consistent, professional output)
- **Top-p**: 0.9 (diverse but controlled)
- **Max tokens**: 8192 (allows complete websites)
- **Timeout**: 180 seconds

### 3. Response Cleaning

The backend strips any markdown blocks:
```javascript
if (cleanHtml.startsWith('```html')) {
  cleanHtml = cleanHtml.substring(7);
}
if (cleanHtml.endsWith('```')) {
  cleanHtml = cleanHtml.substring(0, cleanHtml.length - 3);
}
```

### 4. Validation

Ensures response starts with `<!DOCTYPE` or `<html`

---

## Generated HTML Structure

Every generated site includes:

### 1. Head Section
- UTF-8 charset
- Viewport meta tag for mobile
- Tailwind CSS CDN
- Business name as title

### 2. Hero Section
- Gradient background
- Business name (large heading)
- Tagline
- Optional logo

### 3. About Section
- Centered heading
- About text with proper formatting

### 4. Services Section
- Grid layout (responsive: 1/2/3 columns)
- Service cards with:
  - Service name
  - Brief description
  - Hover effects

### 5. Contact Form (Footer)
- **Action**: `https://api.softaware.co.za/v1/leads/submit`
- **Method**: POST
- **Fields**:
  - Name (text, required)
  - Email (email, required)
  - Message (textarea, required)
- **Hidden fields**:
  - `client_id` (for lead routing)
  - `bot_check_url` (honeypot for spam)

### 6. Widget Integration
```html
<script 
  src="https://api.softaware.co.za/widget.js" 
  data-client-id="client_demo_001" 
  defer>
</script>
```

---

## Quality Verification

Run the verification script:
```bash
./verify-html.sh
```

This checks for:
- ✅ DOCTYPE declaration
- ✅ Tailwind CSS CDN
- ✅ Contact form with correct action
- ✅ Hidden client_id field
- ✅ Honeypot field (bot_check_url)
- ✅ Widget script tag
- ✅ All business data present
- ✅ All services listed
- ✅ Required form fields

---

## Error Handling

### 1. Missing Required Fields
**Status**: 400  
**Error**: `"Missing required fields"`

### 2. Invalid Services Array
**Status**: 400  
**Error**: `"services must be a non-empty array"`

### 3. Ollama Connection Failed
**Status**: 503  
**Error**: `"AI service unavailable"`

### 4. Generation Timeout
**Status**: 504  
**Error**: `"AI generation timeout"`

### 5. Invalid HTML Response
**Status**: 500  
**Error**: `"AI generated invalid HTML"`

---

## Performance

- **Average generation time**: 3 minutes (175 seconds)
- **HTML size**: ~5KB (4824 bytes typical)
- **Model size**: 4.7 GB
- **Memory usage**: ~8GB during generation

---

## Deployment Workflow

1. **Generate HTML** via API
2. **Review** the generated site
3. **Save to file system** (optional)
4. **Deploy via FTP** using existing `/api/v1/sites/:siteId/deploy` endpoint

---

## Integration with Existing System

The AI generation integrates with:

1. **Site Builder Database** (`generated_sites` table)
2. **Contact Form Handler** (`/v1/leads/submit`)
3. **Widget System** (automatic client_id linking)
4. **FTP Deployment** (existing infrastructure)

---

## Security Features

### 1. Authentication
All requests require valid JWT token

### 2. Honeypot Protection
The `bot_check_url` field:
- Hidden with `display:none`
- Has `tabindex="-1"` (unfocusable)
- Has `autocomplete="off"`
- Spam bots fill it, humans don't

### 3. Client ID Validation
Each form submission includes client_id for proper lead routing

### 4. Rate Limiting
Consider adding rate limits to prevent abuse (not yet implemented)

---

## Future Enhancements

- [ ] Add more themes/styles selection
- [ ] Support custom color schemes
- [ ] Multi-page website generation
- [ ] Image optimization and CDN upload
- [ ] SEO meta tags generation
- [ ] Schema.org structured data
- [ ] Custom section ordering
- [ ] A/B testing variants

---

## Troubleshooting

### Generation Takes Too Long
- Check Ollama is running: `ollama list`
- Verify model is loaded: `ollama ps`
- Check system resources: `htop`

### Invalid HTML Output
- Model might be hallucinating
- Try regenerating (temperature=0.3 helps)
- Check prompt in logs

### Widget Not Appearing
- Verify widget.js is accessible
- Check browser console for errors
- Confirm client_id exists in system

### Form Submissions Failing
- Check contact form endpoint is running
- Verify client_id is valid
- Review API logs for errors

---

## Files Added/Modified

### New Files
- `/var/opt/backend/test-ai-generation.mjs` - Test script
- `/var/opt/backend/generate-test-token.mjs` - JWT token generator
- `/var/opt/backend/test-ai-simple.sh` - Bash test script
- `/var/opt/backend/verify-html.sh` - HTML validation script

### Modified Files
- `/var/opt/backend/src/routes/siteBuilder.ts`:
  - Added `POST /generate-ai` endpoint
  - Imported axios and env config

### Configuration
- `/var/opt/backend/.env`:
  - `OLLAMA_MODEL=qwen2.5-coder:7b` (default)

---

## Example Usage

```javascript
// React frontend example
const generateWebsite = async (businessData) => {
  const response = await fetch('https://api.softaware.co.za/api/v1/sites/generate-ai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({
      businessName: businessData.name,
      tagline: businessData.tagline,
      aboutText: businessData.about,
      services: businessData.services,
      clientId: businessData.widgetClientId
    })
  });

  const result = await response.json();
  
  if (result.success) {
    // Save HTML to file or display preview
    downloadHTML(result.html, `${businessData.name}-website.html`);
  }
};
```

---

## Support

For issues or questions:
1. Check backend logs: `pm2 logs softaware-backend`
2. Verify Ollama status: `ollama ps`
3. Test endpoint manually with curl
4. Review this documentation

---

**Last Updated**: February 27, 2026  
**Version**: 1.0.0  
**Model**: Qwen 2.5 Coder 7B
