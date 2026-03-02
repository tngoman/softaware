#!/bin/bash

echo "🔍 Verifying Generated HTML..."
echo ""

HTML="generated-site.html"

check_element() {
  local name="$1"
  local pattern="$2"
  if grep -q "$pattern" "$HTML"; then
    echo "✅ $name"
    return 0
  else
    echo "❌ $name - NOT FOUND"
    return 1
  fi
}

check_element "DOCTYPE declaration" "<!DOCTYPE html>"
check_element "Tailwind CSS CDN" "cdn.tailwindcss.com"
check_element "Contact form action" 'action="https://api.softaware.co.za/v1/leads/submit"'
check_element "Hidden client_id" 'name="client_id" value="client_demo_001"'
check_element "Honeypot field" 'name="bot_check_url"'
check_element "Widget script" 'https://api.softaware.co.za/widget.js'
check_element "Widget data-client-id" 'data-client-id="client_demo_001"'
check_element "Business name in title" "<title>TechFlow Innovations</title>"
check_element "Tagline" "Empowering businesses through intelligent automation"
check_element "About section" "We are a cutting-edge technology company"
check_element "AI Chatbots service" "AI Chatbots"
check_element "Process Automation service" "Process Automation"
check_element "Data Analytics service" "Data Analytics"
check_element "Custom Software Development service" "Custom Software Development"
check_element "Name input (required)" 'name="name" type="text" required'
check_element "Email input (required)" 'name="email" type="email" required'
check_element "Message textarea (required)" 'name="message" required'

echo ""
echo "📊 HTML Size: $(wc -c < $HTML) bytes"
echo "📝 Lines: $(wc -l < $HTML)"
