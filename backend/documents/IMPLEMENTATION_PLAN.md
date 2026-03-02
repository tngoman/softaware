# Soft Aware Free Tier Widget Implementation Plan

## Overview
Transitioning from legacy fleet/forex system to AI BaaS with free tier widget offering.

---

## Phase 1: Database Cleanup & Schema Migration

### 1.1 Remove Legacy Tables ⏳
- [ ] Drop MorningBriefing table and routes
- [ ] Drop FleetAsset table and routes
- [ ] Drop ForexAlert table and routes
- [ ] Drop RiskIncident table and routes
- [ ] Remove related backend routes/controllers
- [ ] Clean up API endpoints

### 1.2 Create New Free Tier Schema ⏳
- [ ] Create `widget_clients` table (client_id, website_url, message_count, max_messages, created_at, last_active)
- [ ] Create `document_metadata` table (id, client_id, content, source_url, source_type, chunk_index, created_at)
- [ ] Install and configure sqlite-vec extension
- [ ] Create `vss_documents` virtual table for embeddings
- [ ] Create indexes for performance

---

## Phase 2: Ingestion Pipeline

### 2.1 Website Crawler ⏳
- [ ] Install dependencies (axios, cheerio)
- [ ] Create URL crawler service
- [ ] Extract clean text from HTML (strip nav, footer, scripts)
- [ ] Chunk text into semantic blocks
- [ ] Store chunks in document_metadata
- [ ] Enforce 50 page limit per client

### 2.2 File Upload Handler ⏳
- [ ] Install pdf-parse dependency
- [ ] Create file upload endpoint
- [ ] Handle PDF parsing
- [ ] Handle TXT file uploads
- [ ] Combine file + web page count (50 total limit)
- [ ] Store file chunks in document_metadata

### 2.3 Embedding Generation ⏳
- [ ] Configure Ollama embedding model (nomic-embed-text)
- [ ] Create embedding service
- [ ] Generate embeddings for all chunks
- [ ] Store embeddings in vss_documents
- [ ] Link embeddings to metadata via foreign key

### 2.4 Background Re-crawl ⏳
- [ ] Install node-cron
- [ ] Create daily crawl job
- [ ] Update existing document embeddings
- [ ] Handle URL failures gracefully

---

## Phase 3: Chat API & RAG System

### 3.1 Chat Endpoint ⏳
- [ ] Create POST /api/v1/chat endpoint
- [ ] Validate client_id
- [ ] Check message count limit (500/month)
- [ ] Return limit message if exceeded

### 3.2 RAG Implementation ⏳
- [ ] Embed incoming user query
- [ ] Query vss_documents for similar chunks (top 5)
- [ ] Construct RAG prompt with retrieved context
- [ ] Call Ollama API (qwen2.5:3b or llama3.2:3b)
- [ ] Stream response back to client
- [ ] Increment message_count

### 3.3 Rate Limiting & Monitoring ⏳
- [ ] Add IP-based rate limiting
- [ ] Track usage per client_id
- [ ] Create usage analytics endpoint for admin
- [ ] Log all queries for debugging

---

## Phase 4: Embeddable Widget

### 4.1 Widget Core ⏳
- [ ] Create widget.js (vanilla ES6)
- [ ] Use Shadow DOM for style isolation
- [ ] Parse data-client-id from script tag
- [ ] Inject floating chat UI (bottom-right)
- [ ] Handle open/close animations

### 4.2 Widget UI ⏳
- [ ] Design chat bubble icon
- [ ] Design chat window layout
- [ ] Style message bubbles (user vs assistant)
- [ ] Add typing indicator
- [ ] Add error state handling

### 4.3 Widget Communication ⏳
- [ ] POST messages to /api/v1/chat
- [ ] Handle streaming responses
- [ ] Display assistant replies
- [ ] Handle offline/error states

### 4.4 Widget Branding ⏳
- [ ] Add "Powered by Soft Aware" footer
- [ ] Link to softaware.co.za landing page
- [ ] Make branding customizable by color
- [ ] Ensure accessibility (ARIA labels)

### 4.5 Widget Distribution ⏳
- [ ] Host widget.js on CDN or /public
- [ ] Add CORS headers for cross-origin embedding
- [ ] Create widget configuration endpoint
- [ ] Generate embed code snippet for users

---

## Phase 5: Client Onboarding Flow

### 5.1 Signup & Setup ⏳
- [ ] Create widget client signup endpoint
- [ ] Generate unique client_id
- [ ] Collect website URL
- [ ] Initialize with 50 page limit, 500 msg/month
- [ ] Return embed code snippet

### 5.2 Data Ingestion UI ⏳
- [ ] Create portal page for URL submission
- [ ] Create portal page for file uploads
- [ ] Show ingestion progress
- [ ] Display current page count (X/50)
- [ ] Display current message count (X/500)

### 5.3 Widget Testing ⏳
- [ ] Create preview/test page
- [ ] Allow users to test widget before deploying
- [ ] Show sample conversations
- [ ] Provide troubleshooting guide

---

## Phase 6: Admin Management

### 6.1 Widget Client Dashboard ⏳
- [ ] List all widget clients
- [ ] Show usage stats per client
- [ ] Show message count trends
- [ ] Flag clients approaching limits

### 6.2 Manual Controls ⏳
- [ ] Manually reset message count
- [ ] Manually increase limits
- [ ] Disable/enable specific clients
- [ ] Re-trigger crawl for specific client

---

## Phase 7: Upsell & Upgrade Path

### 7.1 Limit Notifications ⏳
- [ ] Email client when 80% of messages used
- [ ] Email client when 100% of messages used
- [ ] Show upgrade CTA in widget when limit hit
- [ ] Create pricing comparison page

### 7.2 Upgrade Flow ⏳
- [ ] Create upgrade to paid tier endpoint
- [ ] Transition client to Loopback API architecture
- [ ] Preserve existing embeddings
- [ ] Migrate to dedicated infrastructure

---

## Phase 8: Testing & Deployment

### 8.1 Unit Tests ⏳
- [ ] Test RAG retrieval accuracy
- [ ] Test rate limiting logic
- [ ] Test embedding generation
- [ ] Test crawler edge cases

### 8.2 Integration Tests ⏳
- [ ] Test full chat flow end-to-end
- [ ] Test widget embed on sample sites
- [ ] Test cross-origin requests
- [ ] Test concurrent users

### 8.3 Load Tests ⏳
- [ ] Simulate 100 concurrent chats
- [ ] Measure response times
- [ ] Identify bottlenecks
- [ ] Optimize database queries

### 8.4 Production Deployment ⏳
- [ ] Deploy updated backend
- [ ] Deploy widget.js to CDN
- [ ] Update DNS/CORS settings
- [ ] Monitor error logs

---

## Technical Stack Summary

**Backend:**
- Node.js + Express.js
- better-sqlite3 + sqlite-vec
- Ollama (qwen2.5:3b for chat, nomic-embed-text for embeddings)
- axios, cheerio, pdf-parse, node-cron

**Frontend:**
- Vanilla JavaScript (ES6)
- Shadow DOM
- CSS Modules

**Infrastructure:**
- Linux VPS (12 vCPU, 48GB RAM)
- Ollama running locally
- SQLite database

---

## Current Status: Phase 1 - Starting Database Cleanup
