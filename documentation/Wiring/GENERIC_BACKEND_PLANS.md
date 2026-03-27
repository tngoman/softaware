# AI Generic Backend: Tiers, Limits & Monitoring Plan

This document outlines the architecture and execution plan for tying the new "Generic Backend" functionality (AI-generated dynamic sites) to user subscriptions. The goal is to provide a robust, easily monetized structure where clients can build dynamic features (Blogs, E-commerce, Galleries) based on their subscription tier, while we maintain strict control over database size, API usage, and performance.

---

## 1. The Offering: Suites & Tiers

The Generic Backend allows infinite flexibility using a generic JSON schema (`client_custom_data`). To make this intuitive for users, we package these capabilities into sensible "Suites" that they can enable visually in the Site Builder.

### Tier 1: Static Presence (Free / Starter)
*   **Target Audience:** Users needing a simple landing page or portfolio.
*   **Included Modules:** Contact Form, basic static HTML content.
*   **Backend Access:** None. No dynamic collections or REST API access.
*   **Limits:** 0 records, 0 API calls.

### Tier 2: Dynamic Content Suite (Professional Tier)
*   **Target Audience:** Creators, consultants, and small businesses needing content management.
*   **Included Modules:** Blog / Newsfeed, FAQ, Testimonials, Team Roster, Simple Gallery.
*   **Generic Backend Limits:**
    *   **Max Records:** 1,000 JSON documents total across all collections.
    *   **Max Collections (Tables):** 5 distinct collections (e.g., `blog_posts`, `faq`, etc.).
    *   **Max Storage:** 5MB of raw JSON data.
    *   **API Rate Limit:** 100 requests per minute (reads/writes).

### Tier 3: Commerce & Service Suite (Business Tier)
*   **Target Audience:** Shops, appointment-based services, and larger portfolios.
*   **Included Modules:** Product Catalog, E-commerce Cart logic, Service Menu & Pricing, Appointment Bookings, Event Schedules.
*   **Generic Backend Limits:**
    *   **Max Records:** 10,000 JSON documents total.
    *   **Max Collections (Tables):** 20 distinct collections.
    *   **Max Storage:** 50MB of raw JSON data.
    *   **API Rate Limit:** 500 requests per minute.

---

## 2. Enforcing Limitations & Monitoring

To accurately assign limits based on tiers and prevent abuse, the backend must monitor both the quantity of data and the frequency of API calls.

### A. Storage & Record Counting
Instead of running expensive `COUNT(*)` or `SUM(LENGTH(document_data))` queries on every API request, we will decouple the storage tracking logic:

1.  **Usage Materialized Table:** A secondary table (e.g., `client_usage_stats`) or Redis hash map that increments/decrements whenever a `POST` or `DELETE` request is made.
2.  **Hard Stop Enforcement:** The `POST /api/v1/site-data/:collectionName` endpoint will check the `client_usage_stats` before writing. If the client has exceeded their tier limit (either in document count or estimated payload byte size), the API returns `402 Payment Required` or `413 Payload Too Large`.

### B. Payload Size Enforcement
*   **Row-Level Restriction:** Every individual JSON document inserted via the Generic API will have a max size (e.g., 64KB per document) enforced at the Express middleware level using `express.json({ limit: '64kb' })`.
*   **Total Byte Calculation:** When saving a record, the backend calculates the byte length of the JSON string and adds it to the client's running total in the usage stats.

### C. Rate Limiting (API Abuse Protection)
*   **API Gateway:** Using Redis or a memory-based rate limiter (like `express-rate-limit`), requests to the client’s specific `/api/v1/site-data/...` endpoints are throttled based on the tier assigned to their API key.

---

## 3. Client-Facing Dashboards & Stats

Transparency builds trust. Clients must be able to see exactly how much of their tier allowance they are using. This helps soft-sell upgrades to higher tiers.

### The "Storage & Usage" UI Panel
Within the user portal (e.g., adjacent to the Site Builder or in Account Settings), a new dashboard component will display:

1.  **Storage Progress Bar:**
    *   Visual representation: "2.1 MB / 5.0 MB Used (42%)"
2.  **Total Records Count:**
    *   "345 / 1,000 Records Allowed"
3.  **Collection Breakdown:**
    *   A breakdown of where their data lives. E.g.:
        *   `blog_posts`: 152 records (500KB)
        *   `testimonials`: 20 records (45KB)
        *   `products`: 173 records (1.5MB)
4.  **Upgrade Calls-to-Action:**
    *   If storage exceeds 80%, UI banners will prompt the user to upgrade to the Commerce & Service Suite.

---

## 4. Execution Roadmap

1.  **Database Migration:** Add `json_storage_bytes` and `record_count` columns to the main `clients` or `subscriptions` table to act as our materialized counters.
2.  **Middleware Implementation:** Build `checkTierLimits` Express middleware that intercepts Generic API writes.
3.  **Client Dashboard API:** Create an endpoint (`GET /api/v1/client/usage`) that the React portal can poll to render the Storage & Usage UI.
4.  **Stripe/Billing Integration:** Hook the limit integers directly to the Stripe webhook events (e.g., when a user upgrades, update their `allowed_records` from 1,000 to 10,000).
