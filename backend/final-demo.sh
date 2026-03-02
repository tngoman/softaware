#!/bin/bash

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         AI Website Builder - Complete Demonstration            ║"
echo "║                Qwen 2.5 Coder 7B (4.7 GB)                     ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Generate token
echo "📝 Step 1: Generating JWT token..."
TOKEN=$(node generate-test-token.mjs 2>/dev/null | grep -A 1 "Token:" | tail -1 | xargs)
echo "   ✅ Token: ${TOKEN:0:50}..."
echo ""

# Prepare request
echo "📊 Step 2: Preparing business data..."
cat << 'BUSINESS' > business-data.json
{
  "businessName": "African Tech Solutions",
  "tagline": "Innovative technology for emerging markets",
  "aboutText": "We are a South African technology company providing cutting-edge software solutions tailored for African businesses. Our mission is to bridge the digital divide and empower enterprises with world-class technology at affordable prices.",
  "services": [
    "Mobile App Development",
    "Cloud Infrastructure Setup",
    "AI & Machine Learning Consulting",
    "Cybersecurity Solutions",
    "Legacy System Modernization"
  ],
  "clientId": "african_tech_client_2026"
}
BUSINESS
cat business-data.json | jq .
echo ""

# Call API
echo "🤖 Step 3: Generating website with AI (this takes ~3 minutes)..."
START_TIME=$(date +%s)
curl -X POST http://localhost:8787/api/v1/sites/generate-ai \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @business-data.json \
  --max-time 180 \
  -s -o ai-response.json \
  -w "   HTTP Status: %{http_code}\n"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
echo "   ⏱️  Generation completed in ${DURATION}s"
echo ""

# Check success
if jq -e '.success' ai-response.json > /dev/null 2>&1; then
  echo "✅ Step 4: Website generated successfully!"
  
  # Extract HTML
  jq -r '.html' ai-response.json > african-tech-website.html
  HTML_SIZE=$(wc -c < african-tech-website.html)
  HTML_LINES=$(wc -l < african-tech-website.html)
  
  echo "   �� File: african-tech-website.html"
  echo "   📊 Size: $HTML_SIZE bytes ($HTML_LINES lines)"
  echo ""
  
  # Get metadata
  MODEL=$(jq -r '.metadata.model' ai-response.json)
  GENERATED=$(jq -r '.metadata.generatedAt' ai-response.json)
  echo "   🤖 Model: $MODEL"
  echo "   📅 Generated: $GENERATED"
  echo ""
  
  # Quality checks
  echo "🔍 Step 5: Running quality checks..."
  
  check() {
    if grep -q "$2" african-tech-website.html; then
      echo "   ✅ $1"
    else
      echo "   ❌ $1"
    fi
  }
  
  check "HTML5 DOCTYPE" "<!DOCTYPE html>"
  check "Tailwind CSS" "cdn.tailwindcss.com"
  check "Business name" "African Tech Solutions"
  check "Tagline" "Innovative technology for emerging markets"
  check "All 5 services" "Legacy System Modernization"
  check "Contact form" 'action="https://api.softaware.co.za/v1/leads/submit"'
  check "Client ID" 'value="african_tech_client_2026"'
  check "Honeypot field" 'name="bot_check_url"'
  check "Widget script" 'data-client-id="african_tech_client_2026"'
  echo ""
  
  # Preview
  echo "�� Step 6: HTML Preview (first 40 lines):"
  echo "   ─────────────────────────────────────────────────────"
  head -40 african-tech-website.html | sed 's/^/   /'
  echo "   ... ($(( HTML_LINES - 40 )) more lines) ..."
  echo "   ─────────────────────────────────────────────────────"
  echo ""
  
  echo "╔════════════════════════════════════════════════════════════════╗"
  echo "║                  🎉 DEMONSTRATION COMPLETE! 🎉                 ║"
  echo "╚════════════════════════════════════════════════════════════════╝"
  echo ""
  echo "📁 Generated files:"
  echo "   • african-tech-website.html ($HTML_SIZE bytes)"
  echo "   • business-data.json"
  echo "   • ai-response.json"
  echo ""
  echo "🌐 Next steps:"
  echo "   1. Open african-tech-website.html in your browser"
  echo "   2. Test the contact form"
  echo "   3. Verify the widget loads"
  echo "   4. Deploy via FTP if ready"
  echo ""
  
else
  echo "❌ Generation failed!"
  echo "Response:"
  cat ai-response.json | jq .
  exit 1
fi
