# Softaware Studio — API Routes Reference

**Version:** 1.0.0  
**Last Updated:** 2026-03-18

---

## 1. Overview

| Property | Value |
|----------|-------|
| **Staff base path** | `/api/v1/studio` |
| **Public base path** | `/api/v1/public/site-data` |
| **Registered in** | `src/app.ts` → `apiRouter.use('/v1/studio', auditLogger, studioSitesRouter)` + `apiRouter.use('/v1/public/site-data', publicSiteDataRouter)` |
| **Auth** | Staff endpoints require JWT (`requireAuth`); public endpoints are unauthenticated (rate-limited) |
| **Total endpoints** | 30 (24 staff + 3 public + 3 collection items) |

---

## 2. Staff Site Endpoints (studioSites.ts)

### 2.1 `GET /sites` — List All Sites

| Property | Value |
|----------|-------|
| Auth | JWT required |
| Query Params | `search`, `status`, `limit` (max 100, default 25), `offset` |
| Returns | 200 + `{ success, sites, total, limit, offset }` |

**Behavior:**
- Searches across `business_name`, `id`, and owner `email`
- Returns owner info (email, name) via JOIN on `users`
- Includes `page_count` and `deploy_count` subqueries
- Ordered by `updated_at DESC`

**Response item fields:**

```json
{
  "id": "site-1710729600000",
  "business_name": "Acme Corp",
  "tagline": "Building Better Solutions",
  "status": "deployed",
  "tier": "paid",
  "max_pages": 15,
  "logo_url": "/uploads/sites/logo.png",
  "custom_domain": "acme.com",
  "user_id": "uuid",
  "owner_email": "staff@example.com",
  "owner_name": "John Doe",
  "page_count": 5,
  "deploy_count": 3,
  "created_at": "2026-03-18T00:00:00.000Z",
  "updated_at": "2026-03-18T00:00:00.000Z"
}
```

---

### 2.2 `GET /sites/stats` — Aggregate Statistics

| Property | Value |
|----------|-------|
| Auth | JWT required |
| Returns | 200 + `{ success, stats }` |

**Response:**

```json
{
  "success": true,
  "stats": {
    "total_sites": 42,
    "deployed": 28,
    "generating": 1,
    "failed": 3,
    "draft": 10,
    "total_pages": 156,
    "total_deployments": 87
  }
}
```

---

### 2.3 `GET /sites/:siteId` — Get Site with Pages & Deployments

| Property | Value |
|----------|-------|
| Auth | JWT required |
| Params | `siteId` |
| Returns | 200 + `{ success, site, pages, deployments }` |

**Behavior:**
- Returns full site record with owner info
- Includes all `site_pages` ordered by `sort_order ASC`
- Includes last 10 deployments ordered by `deployed_at DESC`

**Responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 200 | `{ success, site, pages, deployments }` | Found |
| 404 | `{ error: "Site not found" }` | Invalid siteId |

---

### 2.4 `PUT /sites/:siteId` — Update Site

| Property | Value |
|----------|-------|
| Auth | JWT required |
| Params | `siteId` |
| Body | Partial site data |
| Returns | 200 + `{ success: true }` |

**Allowed fields:** `business_name`, `tagline`, `about`, `services`, `status`, `max_pages`, `custom_domain`, `primary_color`, `font_family`, `logo_url`, `hero_image_url`, `include_assistant`, `include_form`

**Responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 200 | `{ success: true }` | Updated |
| 400 | `{ error: "No valid fields to update" }` | No allowed fields in body |

---

### 2.5 `POST /sites` — Create Site

| Property | Value |
|----------|-------|
| Auth | JWT required |
| Body | JSON (see below) |
| Returns | 201 + `{ success, siteId, pageId }` |

**Request Body:**

```json
{
  "clientId": "user-uuid",          // Required — the client user ID
  "businessName": "Acme Corp",      // Required
  "tagline": "Building Better",     // Optional
  "about": "About text...",         // Optional
  "services": "Web, IT, Hosting",   // Optional
  "primaryColor": "#3B82F6",        // Optional (default: #3B82F6)
  "fontFamily": "Inter",            // Optional (default: Inter)
  "maxPages": 5                     // Optional (default: 5)
}
```

**Side Effects:**
- Creates site record with `status: 'draft'`, `tier: 'paid'`
- Auto-creates a default "Home" page at slug `/`

**Responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 201 | `{ success, siteId, pageId }` | Created |
| 400 | `{ error: "clientId and businessName are required" }` | Missing required fields |

---

### 2.6 `DELETE /sites/:siteId` — Delete Site

| Property | Value |
|----------|-------|
| Auth | JWT required |
| Params | `siteId` |
| Returns | 200 + `{ success: true }` |

**Cascade delete order:**
1. `studio_note_replies` (via note_id subquery)
2. `studio_sticky_notes`
3. `studio_snapshots`
4. `site_api_keys`
5. `site_pages`
6. `site_deployments`
7. `site_form_submissions`
8. `generated_sites`

---

## 3. Snapshot Endpoints

### 3.1 `GET /sites/:siteId/snapshots` — List Snapshots

| Property | Value |
|----------|-------|
| Auth | JWT required |
| Returns | 200 + `{ success, snapshots }` |

Returns `id`, `label`, `staff_id`, `created_at` (excludes heavy `page_data`/`styles_data`). Ordered by `created_at DESC`.

---

### 3.2 `POST /sites/:siteId/snapshots` — Create Snapshot

| Property | Value |
|----------|-------|
| Auth | JWT required |
| Body | `{ label?: string }` |
| Returns | 201 + `{ success, snapshotId }` |

**Behavior:**
- Captures all `site_pages` as `page_data` JSON
- Captures site styles (`primary_color`, `font_family`, `about`, `services`) as `styles_data` JSON
- Auto-generates label if not provided: `"Snapshot 2026-03-18T12:00:00.000Z"`

---

### 3.3 `GET /sites/:siteId/snapshots/:id` — Get Snapshot Detail

| Property | Value |
|----------|-------|
| Auth | JWT required |
| Returns | 200 + `{ success, snapshot }` |

Returns full snapshot including `page_data` and `styles_data` JSON.

---

### 3.4 `DELETE /sites/:siteId/snapshots/:id` — Delete Snapshot

| Property | Value |
|----------|-------|
| Auth | JWT required |
| Returns | 200 + `{ success: true }` |

---

## 4. Sticky Note Endpoints

### 4.1 `GET /sites/:siteId/notes` — List Notes

| Property | Value |
|----------|-------|
| Auth | JWT required |
| Query Params | `pageId` (optional — filter to specific page) |
| Returns | 200 + `{ success, notes }` |

**Behavior:**
- Includes `staff_name` via JOIN on `users`
- Includes `reply_count` via subquery on `studio_note_replies`
- Ordered by `created_at DESC`

---

### 4.2 `POST /sites/:siteId/notes` — Create Note

| Property | Value |
|----------|-------|
| Auth | JWT required |
| Body | `{ content, color?, pageId?, posX?, posY? }` |
| Returns | 201 + `{ success, noteId }` |

**Defaults:** `color: 'yellow'`, `posX: 100`, `posY: 100`

---

### 4.3 `PUT /sites/:siteId/notes/:id` — Update Note

| Property | Value |
|----------|-------|
| Auth | JWT required |
| Body | Partial: `{ content?, color?, posX?, posY?, width?, height?, minimized?, resolved? }` |
| Returns | 200 + `{ success: true }` |

---

### 4.4 `DELETE /sites/:siteId/notes/:id` — Delete Note

| Property | Value |
|----------|-------|
| Auth | JWT required |
| Returns | 200 + `{ success: true }` |

**Side Effects:** Also deletes all `studio_note_replies` for the note.

---

### 4.5 `POST /sites/:siteId/notes/:id/replies` — Add Reply

| Property | Value |
|----------|-------|
| Auth | JWT required |
| Body | `{ content }` |
| Returns | 201 + `{ success, replyId }` |

---

## 5. Collection Endpoints (Staff)

### 5.1 `GET /sites/:siteId/collections` — List Collections

| Property | Value |
|----------|-------|
| Auth | JWT required |
| Returns | 200 + `{ success, collections }` |

**Behavior:**
- Aggregates `client_custom_data` by `collection_name` (count + total_bytes)
- Merges with `collection_metadata` for `allowPublicWrite` and `schemaTemplate`

**Response item:**

```json
{
  "collection_name": "blog_posts",
  "count": 12,
  "total_bytes": 8192,
  "allowPublicWrite": false,
  "schemaTemplate": { "title": "string", "content": "text", "image": "string" }
}
```

---

### 5.2 `POST /sites/:siteId/collections/:name` — Create Record

| Property | Value |
|----------|-------|
| Auth | JWT required |
| Params | `name` — collection name |
| Body | JSON document (max 64KB) |
| Returns | 201 + `{ success, id }` |

---

### 5.3 `GET /sites/:siteId/collections/:name` — List Collection Items

| Property | Value |
|----------|-------|
| Auth | JWT required |
| Returns | 200 + `{ success, items }` |

Returns up to 200 items. Each item: `{ id, data_key, data, created_at }`.

---

### 5.4 `DELETE /sites/:siteId/collections/:name/:id` — Delete Item

| Property | Value |
|----------|-------|
| Auth | JWT required |
| Returns | 200 + `{ success: true }` |

---

### 5.5 `PATCH /sites/:siteId/collections/:name/meta` — Update Metadata

| Property | Value |
|----------|-------|
| Auth | JWT required |
| Body | `{ allowPublicWrite?: boolean, schemaTemplate?: Record<string,string> }` |
| Returns | 200 + `{ success: true }` |

**Behavior:** Upserts into `collection_metadata` table (INSERT ... ON DUPLICATE KEY UPDATE).

---

## 6. Public Site Data Endpoints (publicSiteData.ts)

### 6.1 `GET /:siteId/:collectionName` — List Records (Public)

| Property | Value |
|----------|-------|
| Auth | **None** (public) |
| Rate Limit | 60 req/min per IP per site |
| Query Params | `limit` (max 200, default 50), `offset`, `sort` (prefix `-` for DESC, default `-created_at`) |
| Returns | 200 + `{ success, data, total, limit, offset }` |

**Behavior:**
- Validates site exists via `generated_sites` lookup
- Queries `client_custom_data` scoped to `client_id` (site owner) + `site_id` + `collection_name`
- Sort field whitelist: `created_at`, `updated_at` only
- Flattens `document_data` JSON into response with `_created` and `_updated` metadata

**CORS:** `Access-Control-Allow-Origin: *` (sites deploy to various domains)

---

### 6.2 `GET /:siteId/:collectionName/:id` — Get Single Record (Public)

| Property | Value |
|----------|-------|
| Auth | **None** (public) |
| Rate Limit | 60 req/min per IP per site |
| Returns | 200 + `{ success, data }` |

---

### 6.3 `POST /:siteId/:collectionName` — Create Record (Public)

| Property | Value |
|----------|-------|
| Auth | **None** (public) |
| Rate Limit | 10 req/min per IP per site |
| Body | JSON document (max 64KB) |
| Returns | 201 + `{ success, id }` |

**Security checks:**
1. Validates site exists
2. Checks `collection_metadata.allow_public_write` — returns 403 if not enabled
3. Enforces 64KB document size limit
4. Updates site owner's `storage_used_bytes` ledger

---

## 7. Endpoint Summary Table

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 1 | GET | /sites | JWT | List all sites (paginated, searchable) |
| 2 | GET | /sites/stats | JWT | Aggregate statistics |
| 3 | GET | /sites/:siteId | JWT | Get site + pages + deployments |
| 4 | PUT | /sites/:siteId | JWT | Update site data |
| 5 | POST | /sites | JWT | Create site for client |
| 6 | DELETE | /sites/:siteId | JWT | Delete site (cascading) |
| 7 | GET | /sites/:siteId/snapshots | JWT | List snapshots |
| 8 | POST | /sites/:siteId/snapshots | JWT | Create snapshot |
| 9 | GET | /sites/:siteId/snapshots/:id | JWT | Get snapshot detail |
| 10 | DELETE | /sites/:siteId/snapshots/:id | JWT | Delete snapshot |
| 11 | GET | /sites/:siteId/notes | JWT | List sticky notes |
| 12 | POST | /sites/:siteId/notes | JWT | Create note |
| 13 | PUT | /sites/:siteId/notes/:id | JWT | Update note |
| 14 | DELETE | /sites/:siteId/notes/:id | JWT | Delete note + replies |
| 15 | POST | /sites/:siteId/notes/:id/replies | JWT | Add reply to note |
| 16 | GET | /sites/:siteId/collections | JWT | List site collections |
| 17 | POST | /sites/:siteId/collections/:name | JWT | Create record in collection |
| 18 | GET | /sites/:siteId/collections/:name | JWT | List collection items |
| 19 | DELETE | /sites/:siteId/collections/:name/:id | JWT | Delete collection item |
| 20 | PATCH | /sites/:siteId/collections/:name/meta | JWT | Update collection metadata |
| 21 | GET | /public/site-data/:siteId/:coll | None | Public: list records |
| 22 | GET | /public/site-data/:siteId/:coll/:id | None | Public: get record |
| 23 | POST | /public/site-data/:siteId/:coll | None | Public: create record |
