# Softaware Studio — Module Documentation

**Version:** 1.0.0  
**Last Updated:** 2026-03-18  
**Status:** Production-ready

---

## 1. Module Overview

Softaware Studio is a **staff-facing creative website builder** that provides a full design workspace for creating, editing, and managing client websites with AI assistance. Studio extends the existing SiteBuilder module by wrapping the same `generated_sites` and `site_pages` tables in a professional design environment with real-time collaboration tools and AI-powered design capabilities.

### Key Design Principle

> **Staff AI assistants ARE the Studio AI interface.** Each staff member's existing personal AI assistant gains 16 design-specific tools when operating inside the Studio context (`context === 'studio'`). There is no separate "Studio AI" — the assistant already knows the staff member's preferences, communication style, and work patterns.

### Business Value

- Staff can build and refine client websites without writing code
- AI-assisted design: generate pages, components, color palettes, copy, animations
- Visual editor with live preview at desktop/tablet/mobile breakpoints
- Collaborative sticky notes with replies for team design reviews
- Version snapshots for safe experimentation (before/after comparison)
- Site-scoped CMS collections for dynamic data (blog posts, products, team members)
- Public data API enables deployed sites to fetch collection data at runtime
- Built-in image editing (crop, resize, brightness, contrast, saturation, rotate, flip)
- Color picker with palette management, contrast checker, and harmony generation
- Component library with pre-built section templates (hero, features, CTA, etc.)

### Key Statistics

| Metric | Value |
|--------|-------|
| **Total files** | 28 (4 backend + 24 frontend) |
| **Total LOC** | ~4,748 (1,334 backend + 3,414 frontend) |
| **Backend route files** | 2 (studioSites.ts 629 LOC + publicSiteData.ts 211 LOC) |
| **Backend service files** | 1 (studioAITools.ts 355 LOC) |
| **Migration files** | 1 (034_studio_tables.ts 139 LOC) |
| **Frontend model/hook files** | 4 (262 + 133 + 60 + 124 LOC) |
| **Frontend page files** | 2 (StudioDashboard 204 + StudioWorkspace 105 LOC) |
| **Frontend components** | 15 + 1 barrel (2,726 LOC) |
| **API endpoints** | 30 (24 staff + 3 public + 3 collection items) |
| **Database tables** | 5 new + 2 altered (migration 034) |
| **AI design tools** | 16 (9 design + 4 site management + 3 data/CMS) |

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         SOFTAWARE STUDIO                                 │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────┐  ┌──────────────────┐  ┌───────────────────┐   │
│  │  StudioDashboard    │  │  StudioWorkspace  │  │  StudioProvider   │   │
│  │  (site list, stats, │  │  (3-panel layout) │  │  (reducer state)  │   │
│  │   search, filters)  │  │                   │  │                   │   │
│  └─────────┬───────────┘  └────────┬──────────┘  └────────┬──────────┘   │
│            │                       │                       │              │
│  ┌─────────▼───────────────────────▼───────────────────────▼──────────┐   │
│  │                    15 Studio Components                            │   │
│  │                                                                    │   │
│  │  ┌─────────────┐  ┌──────────┐  ┌────────────┐  ┌─────────────┐  │   │
│  │  │ StudioToolbar│  │StudioSide│  │ StudioCanvas│  │StudioRight  │  │   │
│  │  │ (viewport,   │  │bar (pages│  │ (iframe     │  │Panel (props,│  │   │
│  │  │  zoom, grid) │  │ layers)  │  │  preview)   │  │ AI, code)   │  │   │
│  │  └──────────────┘  └──────────┘  └─────────────┘  └─────────────┘  │   │
│  │                                                                    │   │
│  │  ┌─────────────┐  ┌──────────┐  ┌────────────┐  ┌─────────────┐  │   │
│  │  │StudioAIPanel│  │ColorPick │  │ ImageEditor │  │ DataManager │  │   │
│  │  │ (chat, tool │  │(palettes,│  │ (crop, flip │  │ (collections│  │   │
│  │  │  approve)   │  │ contrast)│  │  brightness)│  │  CMS CRUD)  │  │   │
│  │  └──────────────┘  └──────────┘  └─────────────┘  └─────────────┘  │   │
│  │                                                                    │   │
│  │  ┌─────────────┐  ┌──────────┐  ┌────────────┐  ┌─────────────┐  │   │
│  │  │StickyNotes  │  │CodeEditor│  │  History    │  │  Layers     │  │   │
│  │  │ (annotate,  │  │(HTML/CSS │  │  Timeline   │  │  Panel      │  │   │
│  │  │  resolve)   │  │ editing) │  │  (undo/redo)│  │  (z-order)  │  │   │
│  │  └──────────────┘  └──────────┘  └─────────────┘  └─────────────┘  │   │
│  │                                                                    │   │
│  │  ┌─────────────┐  ┌──────────┐  ┌────────────┐                    │   │
│  │  │Component    │  │ Grid     │  │ Selection  │                    │   │
│  │  │Library      │  │ Overlay  │  │ Box        │                    │   │
│  │  │ (templates) │  │ (guides) │  │ (handles)  │                    │   │
│  │  └──────────────┘  └──────────┘  └─────────────┘                    │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│                    ↓ Axios API calls                                     │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                         BACKEND                                          │
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐   │
│  │  studioSites.ts  │  │publicSiteData.ts │  │  studioAITools.ts   │   │
│  │  (staff routes)  │  │(public read/write│  │  (16 tools + prompt │   │
│  │  24 endpoints    │  │ 3 endpoints)     │  │   injection)        │   │
│  │                  │  │                  │  │                      │   │
│  │ Sites CRUD       │  │ Rate limited     │  │ ┌── Design Tools:   │   │
│  │ Snapshots CRUD   │  │ CORS enabled     │  │ │  generate_page    │   │
│  │ Sticky Notes     │  │ Public-write     │  │ │  generate_comp    │   │
│  │ Collections      │  │ gated per coll.  │  │ │  suggest_palette  │   │
│  └─────────┬────────┘  └─────────┬────────┘  │ │  improve_comp     │   │
│            │                     │            │ │  generate_copy    │   │
│            ▼                     ▼            │ │  review_a11y      │   │
│  ┌─────────────────────────────────────────┐  │ │  review_seo       │   │
│  │              MySQL Database              │  │ │  make_responsive  │   │
│  │                                         │  │ │  add_animation    │   │
│  │  generated_sites  (shared w/ SiteBuilder)│ │ ├── Site Tools:     │   │
│  │  site_pages       (shared w/ SiteBuilder)│ │ │  studio_create    │   │
│  │  studio_snapshots       ★ NEW            │ │ │  studio_deploy    │   │
│  │  studio_sticky_notes    ★ NEW            │ │ │  studio_add_note  │   │
│  │  studio_note_replies    ★ NEW            │ │ │  studio_snapshot  │   │
│  │  site_api_keys          ★ NEW            │ │ ├── Data Tools:     │   │
│  │  collection_metadata    ★ NEW            │ │ │  create_collection│   │
│  │  client_custom_data     ★ ALTERED        │ │ │  populate_coll    │   │
│  └─────────────────────────────────────────┘  │ │  wire_collection  │   │
│                                               │ └───────────────────│   │
│                                               └──────────────────────┘   │
├──────────────────────────────────────────────────────────────────────────┤
│                       AI PIPELINE                                        │
│                                                                          │
│  Staff assistant ──→ mobileAIProcessor.ts ──→ chatCompletion()           │
│       ↑                     │                                            │
│       │            context === 'studio'?                                 │
│       │                     │ YES                                        │
│       │                     ▼                                            │
│       │           Inject STUDIO_CONTEXT_INSTRUCTIONS                     │
│       │           + 16 studioDesignTools/siteTools/dataTools              │
│       │                     │                                            │
│       │                     ▼                                            │
│       │            Tool-call loop (same pipeline as mobile)              │
│       │                     │                                            │
│       │                     ▼                                            │
│       └──── Reply with <studio-actions> JSON ◀───── AI model             │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Route Registration

```
app.ts:
  apiRouter.use('/v1/studio', auditLogger, studioSitesRouter)     // Staff routes
  apiRouter.use('/v1/public/site-data', publicSiteDataRouter)      // Public routes (no auth)
```

---

## 3. AI Integration

### 3.1 Context Injection

When a staff member sends a message via the Studio AI panel, the request includes `context: 'studio'`. In `mobileAIProcessor.ts`, this triggers:

1. **Prompt injection** — `STUDIO_CONTEXT_INSTRUCTIONS` appended to the system prompt
2. **Tool injection** — 16 studio-specific tool definitions added to the tool array
3. **Site context** — Optional `studioContext` with selectedComponent, viewport, and siteContext data

### 3.2 Tool Categories

| Category | Tools | Count |
|----------|-------|-------|
| **Design** | generate_page, generate_component, suggest_color_palette, improve_component, generate_copy, review_accessibility, review_seo, make_responsive, add_animation | 9 |
| **Site Management** | studio_create_site, studio_deploy_site, studio_add_note, studio_create_snapshot | 4 |
| **Data/CMS** | studio_create_collection, studio_populate_collection, studio_wire_collection | 3 |

### 3.3 Studio Actions Protocol

AI responses may contain structured actions in `<studio-actions>` tags:

```
AI reply text here...

<studio-actions>
[
  {
    "type": "update_component",
    "target": "hero-section",
    "html": "<section>...</section>",
    "css": "...",
    "description": "Increased padding and improved typography hierarchy",
    "requiresApproval": true
  }
]
</studio-actions>
```

The frontend `useStudioAI` hook parses these and routes them to the pending actions queue for staff approval/rejection.

**Action types:** `update_component`, `insert_component`, `delete_component`, `update_styles`, `update_page`, `create_page`, `suggest_palette`, `add_note`, `generate_image`

---

## 4. Security

| Feature | Implementation |
|---------|----------------|
| **Staff authentication** | All Studio routes require JWT via `requireAuth` middleware |
| **Audit logging** | Studio routes mounted with `auditLogger` middleware |
| **Public API rate limiting** | Read: 60 req/min/IP/site, Write: 10 req/min/IP/site |
| **Public write gating** | Per-collection `allow_public_write` flag in `collection_metadata` |
| **Document size limit** | 64KB max per collection document (both public and staff writes) |
| **Parameterized queries** | All SQL uses parameterized queries — no string concatenation |
| **Dynamic field whitelist** | Site updates only accept fields in `allowedFields` array |
| **Sort field whitelist** | Public API only allows `created_at` and `updated_at` as sort fields |
| **Pagination limits** | Max 100 items per page (staff), max 200 items per page (public) |
| **CORS** | Public API allows all origins (sites deploy to various domains) |

---

## 5. Dependencies

| Dependency | Usage |
|-----------|-------|
| express | Route handling |
| crypto (randomUUID) | UUID generation for all record IDs |
| express-rate-limit | Public API rate limiting |
| `../db/mysql.ts` | Database access (`db.query`, `db.queryOne`, `db.execute`, `toMySQLDate`) |
| `../middleware/auth.ts` | `requireAuth`, `AuthRequest` |
| `../services/studioAITools.ts` | AI tool definitions + prompt injection |
| `../services/mobileAIProcessor.ts` | Studio context detection + tool injection |
| `../services/actionRouter.ts` | `ToolDefinition` type |
| React (frontend) | Component rendering |
| Tailwind CSS (frontend) | Utility-first styling |
| axios via `services/api.ts` (frontend) | HTTP client |
| React Router (frontend) | `/studio` and `/studio/:siteId` routes |

---

## 6. Related Documentation

- [Routes](ROUTES.md) — Detailed API endpoint specifications (24 staff + 3 public + 3 collection items)
- [Fields](FIELDS.md) — Database schema and table definitions (5 new tables + 2 altered)
- [Files](FILES.md) — Source file inventory with LOC counts (28 files)
- [Patterns](PATTERNS.md) — Architecture patterns and design decisions
- [Changes](CHANGES.md) — Version history
- [SiteBuilder](../SiteBuilder/) — Underlying SiteBuilder module (shared tables)
