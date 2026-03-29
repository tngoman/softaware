# Softaware Studio — Comprehensive Plan

**Created:** 2026-03-27  
**Status:** Planning  
**Priority:** High — Staff-facing creative platform

---

## 0. Critical Architectural Principle: Staff AI Assistants ARE the Studio AI

> **This is the single most important design decision in the Studio.**

Each staff member already has a **personal AI assistant** wired via `/api/v1/mobile/my-assistant`. This assistant has:
- A unique identity (`staff-assistant-{timestamp}`)
- A hidden `core_instructions` system prompt (set by superadmin)
- An editable `personality_flare` (personal style)
- Dynamic tool injection based on JWT role (67+ tools for staff)
- Model preferences, voice settings, TTS pipeline
- Conversation history, context window management

**The Studio does NOT create a new AI chatbot.** Instead, the Studio's AI interface IS the staff member's existing assistant. When a staff member opens the Studio and asks the AI to "make the hero section more vibrant" or "generate a blog page for this restaurant," the request flows through the same `my-assistant` pipeline — `buildStitchedPrompt()` in `mobileAIProcessor.ts` stitches the core instructions + personality + Studio-specific tool definitions.

### Why This Matters

1. **Continuity** — Staff are already familiar with their assistant's personality and behavior. The Studio feels like a natural extension, not a separate tool.
2. **Context accumulation** — The assistant already knows the staff member's preferences, past conversations, and working patterns. This context enriches Studio interactions.
3. **Tool injection** — Studio-specific tools (site generation, image manipulation, component creation, color palette suggestions) are injected dynamically alongside existing staff tools. No new assistant entity is needed.
4. **Permissions model** — The assistant's capabilities are gated by the staff member's JWT role. Senior designers get more tools than junior staff. The existing RBAC model extends naturally.
5. **Single source of truth** — One assistant per staff member. No confusion about "which AI am I talking to?"

### Implementation Implications

| Aspect | Approach |
|--------|----------|
| AI Chat in Studio | Reuse `my-assistant` intent endpoint with `context: 'studio'` parameter |
| Tool definitions | New `studio_tools` category in `mobileAIProcessor.ts` — injected when `context === 'studio'` |
| System prompt augmentation | Append Studio-specific instructions to `core_instructions` when in Studio context |
| Conversation scope | New `conversation_context` field — `'studio:{siteId}'` — so AI remembers per-site design conversations |
| Assistant settings | No changes — staff configure their assistant once on the Profile page |
| Model selection | Inherits `preferred_model` from assistant settings; Studio may override to a vision-capable model when image editing is active |

### Wire-Up Required

```
Staff opens Studio
  → Frontend loads assistant via GET /api/v1/mobile/my-assistant
  → If no assistant exists → prompt to create one (existing StaffAssistantTab flow)
  → Studio sends intents via POST /api/v1/mobile/intent with:
      { message, context: 'studio', siteId, activeComponent, viewport }
  → Backend buildStitchedPrompt() detects context === 'studio'
      → Appends studio design instructions to system prompt
      → Injects studio tool definitions (generate_component, suggest_colors, edit_image, etc.)
  → Response includes structured actions alongside text reply:
      { reply, tts_text, actions: [{ type: 'update_component', target, html, css }] }
```

---

## 1. Overview

### What is Softaware Studio?

A **staff-facing creative platform** for building, designing, and deploying client websites using AI assistance and manual editing tools. It is the professional-grade counterpart to the portal's self-service site builder — giving staff full creative control with advanced tooling.

### Who Uses It?

- **Softaware staff** — designers, developers, project managers
- **Not clients** — clients use the portal's SiteBuilder; staff use the Studio to build FOR clients

### Core Capabilities

| Category | Features |
|----------|----------|
| **AI-Powered Design** | Generate pages, components, layouts via staff assistant AI; prompt-based iteration |
| **Visual Editor** | Drag-and-drop components, inline text editing, grid/flex layout manipulation |
| **Image Editing** | Crop, resize, filters, brightness/contrast, overlay text, remove backgrounds |
| **Color System** | Advanced color picker, palette generator, color harmony tools, extract from image |
| **Creative Tools** | Sticky notes, annotations, ruler/guides, snap-to-grid, z-index layers panel |
| **Code Editor** | Split-view HTML/CSS/JS editor with syntax highlighting, live preview |
| **Site Backend** | Wire collections (CMS) to site pages, configure public APIs for dynamic content |
| **Deployment** | One-click deploy via existing FTP/SFTP pipeline, preview on staging domain |
| **Collaboration** | Sticky notes for team communication, version snapshots, change history |

---

## 2. Prerequisite Wiring — Site Backend (Collections → Sites)

Before the Studio can fully function, the collections system must be wired to individual sites. Currently, collections are user-scoped (`client_id`) with no `site_id` awareness.

### 2.1 Database Changes

#### 2.1.1 Add `site_id` to `client_custom_data`

```sql
ALTER TABLE client_custom_data
  ADD COLUMN site_id VARCHAR(50) DEFAULT NULL AFTER client_id,
  ADD INDEX idx_site_collection (site_id, collection_name);
```

- `NULL` = user-level collection (legacy behavior)
- Non-null = scoped to a specific generated site

#### 2.1.2 Site API Keys table

```sql
CREATE TABLE site_api_keys (
  id          VARCHAR(50) PRIMARY KEY,
  site_id     VARCHAR(50) NOT NULL,
  client_id   VARCHAR(50) NOT NULL,
  api_key     VARCHAR(128) NOT NULL UNIQUE,
  label       VARCHAR(100) DEFAULT 'Default',
  permissions JSON DEFAULT '["read"]',
  rate_limit  INT DEFAULT 60,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (site_id) REFERENCES generated_sites(id) ON DELETE CASCADE
);
```

### 2.2 New Endpoints — Public Site Data API

Mount at `/api/v1/public/site-data` — **no auth required**, scoped by site API key or site ID with CORS.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/:siteId/:collectionName` | List records in a collection for a deployed site |
| GET | `/:siteId/:collectionName/:id` | Get single record |
| POST | `/:siteId/:collectionName` | Public write (if collection allows it — e.g., comments, signups) |
| OPTIONS | `*` | CORS preflight |

**Security:**
- Rate limit: 60 req/min per site, 10 req/min per IP for writes
- CORS: Allow only the site's configured domain(s)
- Public writes: Only for collections explicitly marked `allow_public_write = true`
- Read-only by default

### 2.3 Updated Site Data Router (`siteData.ts`)

Add `site_id` parameter support to existing authenticated endpoints:

| Method | Path | Change |
|--------|------|--------|
| GET | `/sites/:siteId/collections` | List collections scoped to a site |
| POST | `/sites/:siteId/:collectionName` | Create record scoped to a site |
| PUT | `/sites/:siteId/:collectionName/:id` | Update site-scoped record |
| DELETE | `/sites/:siteId/:collectionName/:id` | Delete site-scoped record |

### 2.4 JavaScript SDK for Deployed Sites

Generate a lightweight client SDK that the Studio injects into deployed site HTML:

```html
<script src="https://api.softaware.net.za/sdk/site-data.js" data-site-id="site_abc123"></script>
```

Provides:
```javascript
SiteData.list('blog_posts', { limit: 10, sort: '-created_at' })
SiteData.get('blog_posts', 'post-id-123')
SiteData.create('signups', { email, name })  // public write
SiteData.on('blog_posts:change', callback)   // optional SSE
```

### 2.5 Collection Templates (Suites)

Auto-create collections when the Studio generates a site of a certain type:

| Site Type | Auto-Created Collections | Fields |
|-----------|-------------------------|--------|
| Blog | `blog_posts` | title, slug, content, excerpt, author, featured_image, published_at, status |
| E-commerce | `products`, `categories`, `orders` | name, price, description, images, stock, category_id |
| Restaurant | `menu_items`, `categories`, `reservations` | name, description, price, category, image, available |
| Portfolio | `projects`, `skills` | title, description, images, url, tags, sort_order |
| Directory | `listings`, `categories` | name, description, address, phone, email, category, image |

---

## 3. Studio Frontend Architecture

### 3.1 Route Structure

```
/staff/studio                    → StudioDashboard (site list + create)
/staff/studio/:siteId            → StudioWorkspace (main editor)
/staff/studio/:siteId/pages/:id  → StudioPageEditor (focused page editing)
/staff/studio/:siteId/data       → StudioDataManager (collections for this site)
/staff/studio/:siteId/deploy     → StudioDeployment (deploy + preview)
/staff/studio/:siteId/settings   → StudioSiteSettings (domain, SEO, analytics)
```

### 3.2 Component Hierarchy

```
StudioWorkspace (main container)
├── StudioToolbar (top)
│   ├── ViewportSwitcher (desktop/tablet/mobile preview)
│   ├── UndoRedo
│   ├── ZoomControl
│   ├── DeviceFrame toggle
│   └── DeployButton
│
├── StudioSidebar (left)
│   ├── PageTree (site pages list with drag-reorder)
│   ├── ComponentLibrary (draggable components)
│   ├── LayersPanel (z-index visual tree)
│   └── SiteDataPanel (collections quick access)
│
├── StudioCanvas (center — the main workspace)
│   ├── DesignCanvas (visual drag-and-drop with guides)
│   │   ├── GridOverlay (snap-to-grid, rulers)
│   │   ├── SelectionBox (multi-select, resize handles)
│   │   ├── InlineTextEditor (contentEditable with toolbar)
│   │   └── ComponentDropZone (highlights on drag)
│   ├── CodeEditor (split view — toggled)
│   │   ├── HTMLEditor (Monaco-based)
│   │   ├── CSSEditor
│   │   └── JSEditor
│   └── PreviewFrame (live iframe preview)
│
├── StudioRightPanel (right)
│   ├── PropertiesPanel (selected component properties)
│   │   ├── LayoutControls (margin, padding, flex, grid)
│   │   ├── TypographyControls (font, size, weight, spacing)
│   │   ├── ColorControls → AdvancedColorPicker
│   │   ├── SpacingVisualizer (box model diagram)
│   │   └── AnimationControls (transitions, keyframes)
│   ├── StylesPanel (CSS class management)
│   └── ResponsivePanel (per-breakpoint overrides)
│
├── StudioAIPanel (right drawer — expandable)
│   ├── AssistantChat (reuses my-assistant with studio context)
│   ├── AIActionQueue (pending AI operations)
│   ├── AISuggestions (proactive design tips)
│   └── AIHistory (past AI actions with undo)
│
├── StudioBottomBar (bottom)
│   ├── StickyNotesPanel (collaborative annotations)
│   ├── ConsoleOutput (errors, warnings from preview)
│   ├── AssetManager (uploaded images, icons, fonts)
│   └── HistoryTimeline (visual undo stack with thumbnails)
│
└── Floating Overlays
    ├── ImageEditor (modal — crop, resize, filters)
    ├── ColorPickerPopover (advanced picker with palettes)
    ├── StickyNote (draggable, color-coded, positioned on canvas)
    └── ContextMenu (right-click on component)
```

### 3.3 Key Component Specifications

#### 3.3.1 Advanced Color Picker (`StudioColorPicker`)

```
Features:
├── Color wheel with saturation/lightness square
├── HSL / RGB / HEX input fields (live conversion)
├── Opacity slider (RGBA/HSLA support)
├── Eyedropper tool (pick from canvas)
├── Saved palettes (per-site)
├── AI palette generator ("generate a palette for a bakery")
├── Color harmony tools:
│   ├── Complementary
│   ├── Triadic
│   ├── Analogous
│   ├── Split-complementary
│   └── Monochromatic
├── Contrast checker (WCAG AA/AAA compliance)
├── Extract palette from uploaded image
├── CSS variable mapping (--primary, --secondary, etc.)
└── Recent colors strip
```

#### 3.3.2 Sticky Notes System (`StickyNotes`)

```
Features:
├── Create notes at any position on the canvas
├── Color-coded categories:
│   ├── Yellow — general notes
│   ├── Pink — urgent / action required
│   ├── Blue — design feedback
│   ├── Green — approved / done
│   └── Purple — AI suggestions
├── Resize and drag
├── Minimize/expand
├── Staff name + timestamp on each note
├── Reply thread on each note (mini-conversation)
├── Filter by category / author
├── Toggle visibility (hide all notes for clean preview)
├── Export notes as task list
└── AI can create purple notes with suggestions
```

#### 3.3.3 Image Editor (`StudioImageEditor`)

```
Features:
├── Basic Editing:
│   ├── Crop (free, aspect ratio presets: 16:9, 4:3, 1:1, story)
│   ├── Resize (with/without aspect lock)
│   ├── Rotate (90° steps + free rotation)
│   ├── Flip (horizontal/vertical)
│   └── Canvas resize (extend with background)
├── Adjustments:
│   ├── Brightness
│   ├── Contrast
│   ├── Saturation
│   ├── Hue shift
│   ├── Sharpness
│   ├── Blur (gaussian)
│   └── Opacity
├── Filters (CSS filter presets):
│   ├── Grayscale
│   ├── Sepia
│   ├── Vintage
│   ├── Cool
│   ├── Warm
│   ├── High contrast
│   └── Custom (user-defined CSS filter string)
├── Overlays:
│   ├── Text overlay (font, size, color, position, shadow)
│   ├── Shape overlay (rectangle, circle, arrow, line)
│   └── Watermark
├── Advanced:
│   ├── AI background removal (via assistant tool call)
│   ├── AI image generation (DALL-E / Stable Diffusion via assistant)
│   ├── Smart crop (AI-suggested focal point)
│   └── Color extraction (dominant colors from image)
├── Export:
│   ├── Format selection (PNG, JPEG, WebP)
│   ├── Quality slider
│   ├── Download or save to asset library
│   └── Copy as base64 to clipboard
└── History:
    ├── Non-destructive edit stack
    ├── Undo/redo per adjustment
    └── Compare (before/after split view)
```

#### 3.3.4 AI Chat Panel — Studio Mode (`StudioAIPanel`)

This panel reuses the existing `my-assistant` pipeline with studio-specific context injection.

```
Chat Interface:
├── Message history (scoped to site + session)
├── Rich message rendering:
│   ├── Text with markdown
│   ├── Code blocks (HTML/CSS/JS) with "Apply" button
│   ├── Color swatches (clickable → applies to selection)
│   ├── Component previews (thumbnail + "Insert" button)
│   └── Image thumbnails (AI-generated images)
├── Quick action buttons:
│   ├── "Generate this page"
│   ├── "Improve this component"
│   ├── "Suggest a color palette"
│   ├── "Write copy for [section]"
│   ├── "Make this responsive"
│   └── "Add animations"
├── Context awareness:
│   ├── Selected component auto-included in prompt
│   ├── Current page structure sent as context
│   ├── Site-wide style variables included
│   └── Active viewport (desktop/mobile) noted
├── Action queue:
│   ├── Multi-step AI operations shown as progress cards
│   ├── Each action has preview → approve → apply flow
│   └── Batch reject / approve
└── Proactive suggestions:
    ├── Accessibility issues detected
    ├── Performance recommendations
    ├── Mobile responsiveness gaps
    └── SEO improvements
```

---

## 4. Studio AI Tool Definitions

These tools are injected into the staff assistant when `context === 'studio'`. They extend the existing 67 staff tools.

### 4.1 Design Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `generate_page` | AI-generate a full page from a prompt | siteId, pageType, prompt, style |
| `generate_component` | Generate a single component (hero, CTA, footer, etc.) | componentType, prompt, targetSection |
| `suggest_color_palette` | Generate a harmonious color palette | industry, mood, baseColor? |
| `improve_component` | Refine a selected component's design | componentId, instruction |
| `generate_copy` | Write text content for a section | sectionType, businessContext, tone |
| `make_responsive` | Add responsive breakpoints to a component | componentId, breakpoints |
| `add_animation` | Add CSS animations/transitions | componentId, animationType, trigger |
| `review_accessibility` | Check WCAG compliance and suggest fixes | pageId or componentId |
| `review_seo` | Analyze SEO and suggest improvements | pageId |
| `generate_favicon` | Create a favicon from the site's brand | siteName, primaryColor, style |

### 4.2 Image Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `generate_image` | AI-generate an image (DALL-E / SD) | prompt, size, style |
| `remove_background` | Remove image background | imageUrl |
| `smart_crop` | AI-suggest best crop for a context | imageUrl, targetAspectRatio, context |
| `extract_colors` | Get dominant colors from an image | imageUrl, count |
| `optimize_image` | Compress and optimize for web | imageUrl, targetFormat, quality |

### 4.3 Data/Backend Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `create_collection` | Create a new CMS collection for the site | siteId, collectionName, fields |
| `populate_collection` | AI-generate sample data for a collection | siteId, collectionName, count |
| `wire_collection_to_page` | Connect a collection to a page template | siteId, pageId, collectionName, templateHint |
| `configure_public_api` | Enable public read/write for a site collection | siteId, collectionName, permissions |

### 4.4 Site Management Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `create_site` | Create a new site for a client | clientId, siteType, businessInfo |
| `deploy_site` | Deploy site to staging or production | siteId, target |
| `add_sticky_note` | Add a design note to the canvas | siteId, pageId, text, color, position |
| `create_snapshot` | Save a version snapshot of the current state | siteId, label |
| `compare_snapshots` | Show diff between two snapshots | siteId, snapshotA, snapshotB |

---

## 5. Backend Changes Required

### 5.1 New Files

| File | Purpose |
|------|---------|
| `backend/src/routes/studioSites.ts` | Studio-specific site CRUD (staff-only, can manage client sites) |
| `backend/src/routes/publicSiteData.ts` | Public unauthenticated read API for deployed sites |
| `backend/src/services/studioAITools.ts` | Studio tool definitions + handlers |
| `backend/src/services/imageProcessor.ts` | Server-side image processing (sharp-based) |
| `backend/src/services/siteSDK.ts` | Generate the client-side JS SDK for deployed sites |
| `backend/src/db/migrations/0XX_site_collections.ts` | Add `site_id` to `client_custom_data`, create `site_api_keys` |
| `backend/src/db/migrations/0XX_studio_snapshots.ts` | Create `studio_snapshots` table for version history |

### 5.2 Modified Files

| File | Change |
|------|--------|
| `backend/src/services/mobileAIProcessor.ts` | Add `context === 'studio'` branch in `buildStitchedPrompt()` to inject studio tools + instructions |
| `backend/src/routes/myAssistant.ts` | No changes needed — Studio reuses existing endpoints |
| `backend/src/routes/siteData.ts` | Add `site_id` scoping to existing collection CRUD |
| `backend/src/routes/siteBuilder.ts` | Add staff-access middleware (staff can edit client sites) |
| `backend/src/app.ts` | Mount new routes: `/api/v1/studio/*`, `/api/v1/public/site-data/*` |
| `backend/src/middleware/tierGuard.ts` | Add site-scoped collection guards |

### 5.3 New Database Tables

#### `studio_snapshots`
```sql
CREATE TABLE studio_snapshots (
  id          VARCHAR(50) PRIMARY KEY,
  site_id     VARCHAR(50) NOT NULL,
  staff_id    VARCHAR(50) NOT NULL,
  label       VARCHAR(200),
  page_data   JSON NOT NULL,      -- full page states
  styles_data JSON NOT NULL,      -- site-wide styles
  thumbnail   TEXT,               -- base64 thumbnail
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (site_id) REFERENCES generated_sites(id) ON DELETE CASCADE
);
```

#### `studio_sticky_notes`
```sql
CREATE TABLE studio_sticky_notes (
  id          VARCHAR(50) PRIMARY KEY,
  site_id     VARCHAR(50) NOT NULL,
  page_id     VARCHAR(50),
  staff_id    VARCHAR(50) NOT NULL,
  content     TEXT NOT NULL,
  color       VARCHAR(20) DEFAULT 'yellow',
  pos_x       INT DEFAULT 0,
  pos_y       INT DEFAULT 0,
  width       INT DEFAULT 200,
  height      INT DEFAULT 150,
  minimized   TINYINT DEFAULT 0,
  resolved    TINYINT DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (site_id) REFERENCES generated_sites(id) ON DELETE CASCADE
);
```

#### `studio_note_replies`
```sql
CREATE TABLE studio_note_replies (
  id          VARCHAR(50) PRIMARY KEY,
  note_id     VARCHAR(50) NOT NULL,
  staff_id    VARCHAR(50) NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (note_id) REFERENCES studio_sticky_notes(id) ON DELETE CASCADE
);
```

---

## 6. Frontend Files Required

### 6.1 New Files

| File | LOC Est. | Purpose |
|------|---------|---------|
| `pages/staff/StudioDashboard.tsx` | ~400 | Site list for staff, create new, client selector |
| `pages/staff/StudioWorkspace.tsx` | ~800 | Main workspace container, panel layout management |
| `components/Studio/StudioToolbar.tsx` | ~200 | Top toolbar: viewport, zoom, undo/redo, deploy |
| `components/Studio/StudioSidebar.tsx` | ~300 | Left sidebar: page tree, component library, layers |
| `components/Studio/StudioCanvas.tsx` | ~600 | Central design canvas with drag-drop, selection, guides |
| `components/Studio/StudioRightPanel.tsx` | ~400 | Properties, styles, responsive controls |
| `components/Studio/StudioAIPanel.tsx` | ~500 | AI chat with action queue, uses my-assistant pipeline |
| `components/Studio/StudioBottomBar.tsx` | ~250 | Sticky notes, console, assets, history |
| `components/Studio/StudioColorPicker.tsx` | ~350 | Advanced color picker with harmony tools |
| `components/Studio/StudioImageEditor.tsx` | ~500 | Image editing modal with canvas-based operations |
| `components/Studio/StickyNote.tsx` | ~200 | Individual sticky note component |
| `components/Studio/StickyNotesPanel.tsx` | ~250 | Notes list, filter, create |
| `components/Studio/ComponentLibrary.tsx` | ~300 | Draggable component palette |
| `components/Studio/LayersPanel.tsx` | ~200 | Z-index visual tree |
| `components/Studio/CodeEditorPanel.tsx` | ~300 | Monaco-based HTML/CSS/JS editor |
| `components/Studio/HistoryTimeline.tsx` | ~200 | Visual undo stack with thumbnails |
| `components/Studio/StudioDataManager.tsx` | ~350 | Collection management for the current site |
| `components/Studio/GridOverlay.tsx` | ~150 | Snap-to-grid, rulers, guides |
| `components/Studio/SelectionBox.tsx` | ~200 | Multi-select, resize handles, rotation |
| `models/StudioModels.ts` | ~200 | TypeScript interfaces + API client methods |
| `hooks/useStudioState.ts` | ~150 | Global Studio state (Zustand or context) |
| `hooks/useStudioAI.ts` | ~100 | AI integration hook (wraps my-assistant calls) |
| `hooks/useStudioHistory.ts` | ~100 | Undo/redo state management |

### 6.2 Modified Files

| File | Change |
|------|--------|
| `App.tsx` | Add `/staff/studio/*` routes |
| `components/Layout/Layout.tsx` | Add "Studio" to staff sidebar nav |
| `models/SystemModels.ts` | Add Studio API methods to existing model classes |

---

## 7. Implementation Phases

### Phase A — Prerequisite: Wire Collections to Sites
**Must complete before Studio development**

1. Migration: Add `site_id` to `client_custom_data`
2. Migration: Create `site_api_keys` table
3. New route: `publicSiteData.ts` — public read API for deployed sites
4. Update `siteData.ts` — add site-scoped endpoints
5. SDK generator: `siteSDK.ts` — client-side JS for deployed sites
6. Collection templates: auto-create collections for site types

### Phase B — Studio Foundation
**Core workspace with basic editing**

1. `StudioDashboard` — site list, create, client selector
2. `StudioWorkspace` — panel layout with resizable panes
3. `StudioToolbar` — viewport, zoom, basic actions
4. `StudioSidebar` — page tree, basic component palette
5. `StudioCanvas` — iframe-based preview with selection overlay
6. `StudioRightPanel` — basic properties (text, color, spacing)
7. Backend: `studioSites.ts` — staff CRUD for client sites

### Phase C — AI Integration (The Heart of the Studio)
**Wire staff assistant as the Studio AI interface**

1. `StudioAIPanel` — chat interface reusing my-assistant pipeline
2. Backend: `mobileAIProcessor.ts` — add `context === 'studio'` branch
3. Backend: `studioAITools.ts` — define Studio tool handlers
4. AI action queue — preview → approve → apply flow
5. Proactive suggestions system
6. Test: verify staff assistant personality carries into Studio

### Phase D — Creative Tools
**Advanced editing capabilities**

1. `StudioColorPicker` — full color system with harmony tools
2. `StudioImageEditor` — crop, resize, filters, overlays
3. `StickyNote` + `StickyNotesPanel` — collaborative annotations
4. `CodeEditorPanel` — Monaco-based code editing
5. `GridOverlay` — snap-to-grid, rulers, guides
6. `SelectionBox` — multi-select, resize, rotation handles
7. `LayersPanel` — z-index management
8. `HistoryTimeline` — visual undo with thumbnails
9. Migrations: `studio_snapshots`, `studio_sticky_notes`, `studio_note_replies`

### Phase E — Site Backend Integration
**Dynamic content for deployed sites**

1. `StudioDataManager` — collection CRUD within Studio
2. Wire collection templates to AI site generation
3. Public API testing and CORS configuration
4. SDK integration into generated site HTML
5. Real-time preview of collection data in design canvas

### Phase F — Polish & Advanced Features

1. Drag-and-drop component insertion from library
2. Component templates (hero variations, pricing tables, testimonials)
3. Custom CSS class management
4. Responsive breakpoint editing
5. Animation controls (CSS transitions/keyframes)
6. Multi-page navigation management
7. SEO settings panel
8. Performance analysis
9. Export (HTML zip, GitHub push)
10. Keyboard shortcuts

---

## 8. AI Context Protocol

When the Studio sends a message to the assistant, it includes rich context:

```typescript
interface StudioIntentPayload {
  message: string;               // Staff's text message
  context: 'studio';             // Triggers studio tool injection
  siteId: string;                // Current site being edited
  pageId?: string;               // Current page (if applicable)
  
  // Design context (auto-attached)
  selectedComponent?: {
    id: string;
    type: string;                // 'hero', 'section', 'card', etc.
    html: string;                // Current HTML
    css: string;                 // Applicable CSS
    boundingBox: { x: number; y: number; w: number; h: number };
  };
  
  viewport: 'desktop' | 'tablet' | 'mobile';
  
  siteContext: {
    businessName: string;
    industry: string;
    colorPalette: string[];      // Current CSS variables
    pageCount: number;
    currentPageType: string;
  };
}
```

The assistant responds with actionable outputs:

```typescript
interface StudioIntentResponse {
  reply: string;                 // Natural language response
  tts_text: string;              // Stripped for TTS
  actions?: StudioAction[];      // Structured actions to apply
}

interface StudioAction {
  type: 'update_component' | 'insert_component' | 'delete_component'
      | 'update_styles' | 'update_page' | 'create_page'
      | 'suggest_palette' | 'add_note' | 'generate_image';
  target?: string;               // Component ID or page ID
  html?: string;                 // New HTML content
  css?: string;                  // New CSS
  palette?: string[];            // Color suggestions
  imageUrl?: string;             // Generated image URL
  note?: { text: string; color: string; position: { x: number; y: number } };
  preview?: string;              // Base64 thumbnail for approval UI
  requiresApproval: boolean;     // If true, show preview before applying
}
```

---

## 9. Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Canvas rendering | iframe + overlay | Keeps generated HTML isolated; overlay handles selection/guides |
| State management | Zustand | Lightweight, works well with complex nested state (components tree) |
| Code editor | Monaco Editor | Industry standard, powers VS Code, excellent TypeScript support |
| Image editing | Canvas API (browser) | No server roundtrip for basic edits; server for AI operations only |
| Color picker | Custom (Canvas + inputs) | No good open-source option has all needed features; canvas-based wheel |
| Drag-and-drop | @dnd-kit | Accessible, performant, works with lists and free-form canvas |
| Panel layout | react-resizable-panels | Handles resizable pane layout (VS Code-style) |
| Undo/redo | Immer patches | Structural sharing, efficient diff storage, integrates with Zustand |

---

## 10. Dependencies (npm)

| Package | Purpose | Existing? |
|---------|---------|-----------|
| `@monaco-editor/react` | Code editor | No — new |
| `@dnd-kit/core` + `@dnd-kit/sortable` | Drag and drop | No — new |
| `react-resizable-panels` | Panel layout | No — new |
| `immer` | Immutable state with patches for undo | Check |
| `zustand` | State management | Check |
| `sharp` (backend) | Server-side image processing | No — new |
| `canvas` (backend) | Server-side canvas for thumbnails | Check |
| `colord` | Color manipulation + harmony calculations | No — new |

---

## 11. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Staff accessing client sites | JWT role check (`is_staff` or `is_admin`); audit log all Studio operations |
| AI-generated HTML injection | Sanitize AI output through DOMPurify before injecting into preview iframe |
| Public site data API abuse | Rate limiting per site + per IP; read-only by default; CORS locked to site domain |
| Image upload abuse | Existing multer limits (10MB); validate mime types; no executable uploads |
| Site API key security | Keys hashed in DB; revocable; scoped to read-only or specific collections |

---

## 12. Success Metrics

| Metric | Target |
|--------|--------|
| Time to generate a complete 5-page site | < 10 minutes with AI |
| Staff adoption | 100% of design staff using Studio within 2 weeks of launch |
| AI action approval rate | > 80% of AI suggestions approved without modification |
| Site backend wiring | 100% of new paid sites have at least one collection |
| Image editor usage | 50%+ of sites use at least one edited image |

---

## 13. Files Changed Summary

| File | Type | Category |
|------|------|----------|
| `backend/src/routes/studioSites.ts` | **NEW** | Backend |
| `backend/src/routes/publicSiteData.ts` | **NEW** | Backend |
| `backend/src/services/studioAITools.ts` | **NEW** | Backend |
| `backend/src/services/imageProcessor.ts` | **NEW** | Backend |
| `backend/src/services/siteSDK.ts` | **NEW** | Backend |
| `backend/src/services/mobileAIProcessor.ts` | Modified | Backend |
| `backend/src/routes/siteData.ts` | Modified | Backend |
| `backend/src/routes/siteBuilder.ts` | Modified | Backend |
| `backend/src/app.ts` | Modified | Backend |
| `backend/src/middleware/tierGuard.ts` | Modified | Backend |
| `backend/src/db/migrations/0XX_site_collections.ts` | **NEW** | Database |
| `backend/src/db/migrations/0XX_studio_snapshots.ts` | **NEW** | Database |
| 22 frontend files | **NEW** | Frontend (see §6.1) |
| `frontend/src/App.tsx` | Modified | Frontend |
| `frontend/src/components/Layout/Layout.tsx` | Modified | Frontend |
| `frontend/src/models/SystemModels.ts` | Modified | Frontend |
