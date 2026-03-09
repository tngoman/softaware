# SoftAware — Mobile App Design Language

> **Version 1.0** · March 2026
> Derived from the SoftAware web frontend · For React Native / Flutter / Swift / Kotlin implementations

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Brand Tokens](#brand-tokens)
   - [Colors](#colors)
   - [Typography](#typography)
   - [Spacing Scale](#spacing-scale)
   - [Border Radius](#border-radius)
   - [Shadows / Elevation](#shadows--elevation)
3. [Dynamic Theming (API-Driven)](#dynamic-theming-api-driven)
4. [App Shell & Navigation](#app-shell--navigation)
   - [Admin / Staff Shell](#admin--staff-shell)
   - [Portal (Regular User) Shell](#portal-regular-user-shell)
   - [Navigation Item Anatomy](#navigation-item-anatomy)
5. [Screen Structure](#screen-structure)
   - [Page Header Pattern](#page-header-pattern)
   - [Content Area Pattern](#content-area-pattern)
6. [Core Components](#core-components)
   - [Buttons](#buttons)
   - [Cards](#cards)
   - [Inputs / Form Fields](#inputs--form-fields)
   - [Select / Dropdown](#select--dropdown)
   - [Textarea](#textarea)
   - [Data Tables / Lists](#data-tables--lists)
   - [Modals / Bottom Sheets](#modals--bottom-sheets)
   - [Badges / Pills / Tags](#badges--pills--tags)
   - [Avatars](#avatars)
7. [State Patterns](#state-patterns)
   - [Loading States](#loading-states)
   - [Empty States](#empty-states)
   - [Error States](#error-states)
8. [Status Colors](#status-colors)
9. [KPI / Metric Cards](#kpi--metric-cards)
10. [Chat UI](#chat-ui)
11. [Notification Patterns](#notification-patterns)
12. [Forms](#forms)
13. [Alerts & Toasts](#alerts--toasts)
14. [Animation & Motion](#animation--motion)
15. [Icons](#icons)
16. [Currency & Locale](#currency--locale)
17. [Dark Mode (Future)](#dark-mode-future)
18. [Platform-Specific Notes](#platform-specific-notes)
19. [Component Quick Reference](#component-quick-reference)

---

## Design Philosophy

SoftAware's visual identity follows a **clean, professional, trust-building** aesthetic. The mobile app should feel like a polished business tool — not a toy.

| Principle | Implementation |
|-----------|---------------|
| **Clean & White** | Light backgrounds (`#F9FAFB` / `#F8FAFC`), white cards, minimal visual noise |
| **Blue Confidence** | Picton Blue (`#00A4EE`) is the primary brand accent — conveys trust, technology, professionalism |
| **Generous Whitespace** | Content breathes. Don't crowd elements. Spacing is 16–24pt between sections. |
| **Rounded & Soft** | Cards use 12–16pt radius. Buttons use 8–12pt. Badges use full-round (pill). No sharp corners. |
| **Subtle Depth** | Light shadows on cards and headers. No heavy drop shadows. Elevation is understated. |
| **Consistent Accents** | Purple for AI/enterprise features. Green for success. Red/scarlet for danger. Orange for warnings. |
| **Readable First** | Inter font. 14pt minimum body text. Strong contrast ratios. |

---

## Brand Tokens

### Colors

#### Primary Palette

| Token | Hex | RGB | Usage |
|-------|-----|-----|-------|
| `primary-50` | `#B6EAFB` | 182, 234, 251 | Light tint, background highlight |
| `primary-100` | `#DBEAFE` | 219, 234, 254 | Active sidebar item background |
| `primary-200` | `#80D9F7` | 128, 217, 247 | Soft focus ring |
| `primary-300` | `#4DCAF4` | 77, 202, 244 | Light accent |
| `primary-400` | `#26B5F0` | 38, 181, 240 | Hover tint |
| **`primary-500`** | **`#00A4EE`** | **0, 164, 238** | **Main brand color — Picton Blue** |
| `primary-600` | `#0090D1` | 0, 144, 209 | Primary button background, links |
| `primary-700` | `#007AB4` | 0, 122, 180 | Primary button hover, active sidebar border |
| `primary-800` | `#0071A6` | 0, 113, 166 | Pressed state |
| `primary-900` | `#00608F` | 0, 96, 143 | Deep accent |

#### Secondary / Danger

| Token | Hex | Usage |
|-------|-----|-------|
| `scarlet-500` | `#E7370B` | Delete buttons, error badges, overdue amounts, unread notification dot |
| `scarlet-600` | `#D02E09` | Danger button hover |
| `scarlet-700` | `#B92608` | Danger button pressed |

#### Accent Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `purple` | `#8B5CF6` | AI features, enterprise sections, masquerade banner, admin badges |
| `green` | `#10B981` | Success states, paid badges, revenue indicators |
| `orange` | `#F59E0B` | Warning states, partial payment, outstanding amounts |
| `pink` | `#EC4899` | Reserved / decorative |

#### Neutral / Gray Scale

| Token | Hex | Usage |
|-------|-----|-------|
| `gray-50` | `#F9FAFB` | Page background, card hover |
| `gray-100` | `#F3F4F6` | Section backgrounds, card borders |
| `gray-200` | `#E5E7EB` | Dividers, input borders at rest |
| `gray-300` | `#D1D5DB` | Input borders, disabled borders |
| `gray-400` | `#9CA3AF` | Placeholder text, disabled icons |
| `gray-500` | `#6B7280` | Secondary text, labels, captions |
| `gray-600` | `#4B5563` | Body text (secondary), outline button |
| `gray-700` | `#374151` | Body text, form labels |
| `gray-800` | `#1F2937` | Headings, strong text |
| `gray-900` | `#111827` | Page titles, highest contrast text |
| `white` | `#FFFFFF` | Card backgrounds, header bars, input backgrounds |

#### Semantic Colors Summary

| Semantic | Background | Text | Border |
|----------|------------|------|--------|
| **Success** | `#D1FAE5` (green-100) | `#065F46` (green-800) | `#6EE7B7` (green-300) |
| **Warning** | `#FEF3C7` (yellow-100) | `#92400E` (yellow-800) | `#FCD34D` (yellow-300) |
| **Error** | `#FEE2E2` (red-100) | `#991B1B` (red-800) | `#FCA5A5` (red-300) |
| **Info** | `#DBEAFE` (blue-100) | `#1E40AF` (blue-800) | `#93C5FD` (blue-300) |

---

### Typography

**Font Family:** `Inter` (primary), falling back to `System UI` / platform default.

> On mobile, if Inter is not bundled, use the platform default:
> - **iOS:** SF Pro Text / SF Pro Display
> - **Android:** Roboto
> - **React Native:** Use `expo-google-fonts` for Inter, or just use system font

#### Type Scale

| Token | Size (pt) | Weight | Line Height | Usage |
|-------|-----------|--------|-------------|-------|
| `display-lg` | 30–36 | 800 (ExtraBold) | 1.2 | Landing hero headline |
| `display-md` | 24 | 700 (Bold) | 1.25 | Page titles in gradient headers |
| `heading-lg` | 20 | 700 (Bold) | 1.3 | Section headings, modal titles |
| `heading-md` | 18 | 600 (SemiBold) | 1.35 | Card group titles, subsection heads |
| `heading-sm` | 16 | 600 (SemiBold) | 1.4 | Card titles, KPI labels |
| `body-lg` | 16 | 400 (Regular) | 1.5 | Primary body text, input values |
| `body-md` | 14 | 400 (Regular) | 1.5 | Standard body text, table cells, descriptions |
| `body-sm` | 13 | 400 (Regular) | 1.45 | Secondary text, sidebar items |
| `caption` | 12 | 500 (Medium) | 1.4 | Labels, table headers, timestamps, helper text |
| `caption-sm` | 11 | 500 (Medium) | 1.35 | Badges, tiny labels, KPI subtext |
| `overline` | 10–11 | 600 (SemiBold) | 1.3 | Section headers in sidebar (uppercase, letter-spaced) |

#### Text Colors

| Purpose | Color |
|---------|-------|
| Primary text | `gray-900` (#111827) |
| Secondary text | `gray-500` (#6B7280) |
| Tertiary / disabled | `gray-400` (#9CA3AF) |
| Placeholder | `gray-400` to `gray-500` |
| Link text | `primary-600` (#0090D1) |
| Error text | `red-600` (#DC2626) |
| On-primary (white on blue) | `white` (#FFFFFF) |
| On-gradient header | `white` (#FFFFFF) |

---

### Spacing Scale

Use a **4pt base grid**. All spacing should be multiples of 4.

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4pt | Tight gaps (icon-to-text in badges) |
| `sm` | 8pt | Inner badge padding, tight element spacing |
| `md` | 12pt | Button icon gap, card inner sections |
| `base` | 16pt | Standard padding (cards sm, input horizontal), item spacing |
| `lg` | 20pt | Navigation item vertical padding with horizontal |
| `xl` | 24pt | Card padding (default), section spacing |
| `2xl` | 32pt | Page content horizontal padding, large section gaps |
| `3xl` | 40pt | Page top padding |
| `4xl` | 48pt | Hero section vertical padding |

#### Common Spacing Patterns

| Context | Mobile Value |
|---------|-------------|
| Screen horizontal padding | 16–20pt |
| Card internal padding | 16pt (compact), 20pt (default), 24pt (spacious) |
| Card-to-card gap | 12–16pt |
| Section-to-section gap | 24pt |
| Form field gap | 16–20pt |
| Button internal padding | H: 16pt, V: 10pt (md) / H: 12pt, V: 8pt (sm) |
| List item padding | H: 16pt, V: 12–16pt |
| Navigation item padding | H: 12pt, V: 10pt |
| Modal content padding | 20–24pt |

---

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `none` | 0pt | N/A |
| `sm` | 4pt | Small tags |
| `md` | 6pt | Table containers |
| `base` | 8pt | Inputs, selects, buttons (default), KPI cards |
| `lg` | 12pt | Cards, modals, chat input areas |
| `xl` | 16pt | Login card, chat bubbles, feature cards |
| `2xl` | 20pt | Auth screens, hero mockups |
| `full` | 9999pt | Badges, pills, avatars, progress bars, FAB buttons |

---

### Shadows / Elevation

The design uses **subtle elevation** — shadows are light and diffused, never harsh.

| Token | CSS Shadow | Mobile Elevation | Usage |
|-------|-----------|-----------------|-------|
| `none` | none | 0 | Flat elements |
| `sm` | `0 1px 2px rgba(0,0,0,0.05)` | 1 | Inputs on focus, subtle lift |
| `base` | `0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)` | 2 | Cards, header bar |
| `md` | `0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)` | 4 | Elevated cards, sidebar, KPI cards |
| `lg` | `0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)` | 8 | Modals, dropdown menus |
| `xl` | `0 20px 25px rgba(0,0,0,0.1), 0 10px 10px rgba(0,0,0,0.04)` | 12 | Auth card, full-screen modal |
| `2xl` | `0 25px 50px rgba(0,0,0,0.25)` | 16 | Critical modals (newer style) |

> **iOS:** Use `shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius`
> **Android:** Use `elevation` property
> **Flutter:** Use `BoxShadow` or `Material` elevation

---

## Dynamic Theming (API-Driven)

The app supports **dynamic branding** via the API. On app launch (before login), fetch:

```
GET /app-settings/public
```

Response:
```json
{
  "settings": {
    "app_name": "SoftAware",
    "logo_url": "/uploads/logo.png",
    "company_name": "Soft Aware (Pty) Ltd",
    "primary_color": "#1976d2",
    "tagline": "Smart Software Solutions"
  }
}
```

| Setting | Where to Apply |
|---------|---------------|
| `app_name` | Login screen title, header bar title, splash screen |
| `logo_url` | Login screen logo, sidebar header logo, splash screen |
| `company_name` | Login screen subtitle, "About" section |
| `primary_color` | **Override** the primary-500/600 token if different from `#00A4EE` |
| `tagline` | Login screen subtitle text |

### Theme Override Strategy

```
1. Bundle default theme (Picton Blue #00A4EE) into the app
2. On launch → GET /app-settings/public
3. If primary_color differs from default → generate a derived palette:
   - primary-400 = lighten(primary_color, 15%)
   - primary-500 = primary_color
   - primary-600 = darken(primary_color, 10%)
   - primary-700 = darken(primary_color, 20%)
4. Cache in local storage, re-fetch on next cold launch
5. Apply to all primary-colored elements
```

---

## App Shell & Navigation

The mobile app uses **two completely different navigation experiences** based on user type:

### Admin / Staff Shell

```
┌─────────────────────────────────┐
│  ┌─────────────────────────┐    │
│  │  Header Bar (h: 56pt)   │    │
│  │  [☰]  SoftAware  [🔔] [👤]│    │
│  └─────────────────────────┘    │
│                                 │
│  ┌─────────────────────────┐    │
│  │                         │    │
│  │     Content Area        │    │
│  │     (scrollable)        │    │
│  │                         │    │
│  └─────────────────────────┘    │
│                                 │
│  ┌─────────────────────────┐    │
│  │  Bottom Tab Bar          │    │
│  │  [🏠][📊][📄][⚙️][•••] │    │
│  └─────────────────────────┘    │
└─────────────────────────────────┘

Hamburger (☰) → Drawer navigation with all sections:

┌──────────────────────┐
│  [Logo]              │
│  SoftAware           │
│  ────────────────    │
│                      │
│  MAIN                │
│  · Dashboard         │
│  · Financial Dash    │
│  · Notifications     │
│                      │
│  BILLING & FINANCE   │
│  · Contacts          │
│  · Quotations        │
│  · Invoices          │
│  · Transactions      │
│                      │
│  REPORTS             │
│  · Balance Sheet     │
│  · Profit & Loss     │
│  · Transaction List  │
│  · VAT Reports       │
│                      │
│  CATALOG             │
│  · Pricing           │
│  · Categories        │
│                      │
│  SETTINGS            │
│  · App Settings      │
│  · Profile           │
│                      │
│  🟣 AI & ENTERPRISE  │
│  · Admin Dashboard   │
│  · Client Manager    │
│  · AI Overview       │
│  · AI Credits        │
│  · Enterprise EP     │
│  · Database Manager  │
│  · Credentials       │
│                      │
│  🟣 SYSTEM           │
│  · Users             │
│  · Roles             │
│  · Permissions       │
│  · System Settings   │
│                      │
│  DEVELOPMENT         │
│  · Software          │
│  · Tasks             │
│  · Updates           │
│  · Groups            │
│                      │
│  ────────────────    │
│  [Logout]            │
└──────────────────────┘
```

**Bottom Tab Bar (Admin — 5 tabs):**

| Tab | Icon | Screen |
|-----|------|--------|
| Home | `HomeIcon` | Admin Dashboard |
| Finance | `ChartBarIcon` | Financial Dashboard |
| Invoices | `DocumentTextIcon` | Invoices List |
| Settings | `Cog6ToothIcon` | Settings |
| More | `EllipsisHorizontalIcon` | Opens drawer |

---

### Portal (Regular User) Shell

```
┌─────────────────────────────────┐
│  ┌─────────────────────────┐    │
│  │  Header Bar (h: 56pt)   │    │
│  │  [☰]  SoftAware  [🔔] [👤]│    │
│  └─────────────────────────┘    │
│                                 │
│  ┌─────────────────────────┐    │
│  │                         │    │
│  │     Content Area        │    │
│  │     (scrollable)        │    │
│  │                         │    │
│  └─────────────────────────┘    │
│                                 │
│  ┌─────────────────────────┐    │
│  │  Bottom Tab Bar          │    │
│  │  [🏠][🤖][🌐][⚙️][🔔] │    │
│  └─────────────────────────┘    │
└─────────────────────────────────┘

Hamburger (☰) → Drawer navigation:

┌──────────────────────┐
│  [Logo]              │
│  SoftAware           │
│  ────────────────    │
│                      │
│  OVERVIEW            │
│  · Portal Home       │
│                      │
│  AI & AUTOMATION     │
│  · My Assistants     │
│  · Chat              │
│                      │
│  WEB PRESENCE        │
│  · Landing Pages     │
│                      │
│  ACCOUNT             │
│  · Settings          │
│  · Profile           │
│  · Notifications     │
│                      │
│  (Permission-gated): │
│  · Contacts     🔑   │
│  · Invoices     🔑   │
│  · Quotations   🔑   │
│  · Reports      🔑   │
│  · Transactions      │
│  · Groups            │
│                      │
│  ────────────────    │
│  [Logout]            │
└──────────────────────┘
```

**Bottom Tab Bar (Portal — 5 tabs):**

| Tab | Icon | Screen |
|-----|------|--------|
| Home | `HomeIcon` | Portal Dashboard |
| Assistants | `SparklesIcon` | Assistants List |
| Sites | `GlobeAltIcon` | Sites List |
| Settings | `Cog6ToothIcon` | Portal Settings |
| Alerts | `BellIcon` | Notifications |

---

### Navigation Item Anatomy

```
┌────────────────────────────────────┐
│  [icon]  Label Text     [badge]    │  ← 48pt minimum touch target
│  24x24   body-sm/md     (opt.)     │
│  gray-400 → primary-600 (active)   │
└────────────────────────────────────┘

Inactive:  icon = gray-400, text = gray-600, bg = transparent
Active:    icon = primary-600, text = primary-700, bg = primary-50 (#B6EAFB at 30%), left-border 3pt primary-700
Hover:     bg = gray-50

Purple sections (AI & Enterprise, System):
Active:    icon = purple-600, text = purple-700, bg = purple-50, left-border 3pt purple-700
Inactive:  icon = purple-400, text = gray-600, hover bg = purple-50
```

**Section Header:**
- Text: `caption` size (11pt), `gray-500`, uppercase, letter-spacing 0.5pt
- Collapsible on web, always expanded on mobile drawer (or use expandable sections)

---

## Screen Structure

### Page Header Pattern

Most screens use a **gradient header banner** at the top:

```
┌──────────────────────────────────┐
│  bg: gradient primary-500 →      │
│      primary-500/80              │
│                                  │
│  [←]                     [⊕]    │ ← Back button (if not root), action button
│                                  │
│  📊  Page Title                  │ ← icon (h:28) + display-md, white, bold
│  Subtitle / description text     │ ← body-md, white/80 opacity
│                                  │
│  shadow-md                       │
└──────────────────────────────────┘
│                                  │
│  Content below (bg: gray-50)     │
```

**Mobile implementation:**
- Height: ~140–160pt (flexible, wraps content)
- Horizontal padding: 20pt
- Vertical padding: 20pt top, 24pt bottom
- Corner radius: 0 (flush to edges) — OR 0pt top, 16pt bottom-left/right (modern variant)
- Icon + title on same row
- Back arrow (`ChevronLeftIcon`) on top-left if navigable

### Content Area Pattern

```
┌──────────────────────────────────┐
│  p: 16pt horizontal, 16pt top   │
│                                  │
│  [Card 1 - Full Width]          │
│  [Card 2 - Full Width]          │
│                                  │
│  ─── or grid for KPIs: ───      │
│  [KPI 1] [KPI 2]                │
│  [KPI 3] [KPI 4]                │
│                                  │
│  gap: 12–16pt between cards     │
│  section gap: 24pt              │
└──────────────────────────────────┘
```

---

## Core Components

### Buttons

#### Variants

| Variant | Background | Text | Border | Usage |
|---------|-----------|------|--------|-------|
| **Primary** | `primary-600` | `white` | none | Main CTAs — Save, Submit, Create, Send |
| **Secondary** | `gray-600` | `white` | none | Alternative actions |
| **Outline** | `white` | `gray-700` | 1pt `gray-300` | Cancel, Back, secondary actions |
| **Ghost** | `transparent` | `primary-600` | none | Inline actions — View, Edit, Test Chat |
| **Danger** | `scarlet-500` | `white` | none | Delete, Remove, destructive actions |
| **Disabled** | any at 50% opacity | — | — | Non-interactive state |

#### Sizes

| Size | Height | Padding (H×V) | Font | Icon |
|------|--------|---------------|------|------|
| **Small** | 32pt | 12pt × 6pt | 12pt Medium | 14×14 |
| **Medium** | 40pt | 16pt × 10pt | 14pt Medium | 16×16 |
| **Large** | 48pt | 24pt × 14pt | 16pt Medium | 20×20 |

#### States

```
Default  → opacity 1.0
Pressed  → darken background 10% (e.g. primary-700)
Disabled → opacity 0.5, no interaction
Loading  → show spinner (16×16 animate-spin), replace/prepend to text ("Saving...")
```

#### Focus Ring (accessibility)

- Ring: 2pt solid, `primary-500` at 50% opacity, 2pt offset
- On danger: ring color = `red-500`

#### Button Anatomy

```
┌──────────────────────────────────┐
│  [icon?]  Label Text  [icon?]    │  ← centered content
│   16×16    14pt med    16×16     │
│                                  │
│  min-height: 40pt (md)           │
│  border-radius: 8pt             │
│  transition: 200ms              │
└──────────────────────────────────┘
```

---

### Cards

The primary container for content grouping.

```
┌──────────────────────────────────┐
│  bg: white                       │
│  border: 1pt gray-100            │
│  border-radius: 12pt            │
│  shadow: md (elevation 4)        │
│  padding: 20pt (default)         │
│                                  │
│  [Card Content]                  │
│                                  │
└──────────────────────────────────┘
```

**Padding Variants:**

| Variant | Padding | Usage |
|---------|---------|-------|
| `none` | 0 | Custom layouts, tables inside cards |
| `sm` | 16pt | Compact cards, KPI metric cards |
| `md` | 20pt | Default — form sections, detail cards |
| `lg` | 24pt | Auth card, settings panels |

**Card with Left-Border Accent (KPI pattern):**

```
┌─┬────────────────────────────────┐
│▌│  Revenue         ← caption    │  ← 4pt left border, colored
│▌│  R 150,000       ← heading    │     (green/blue/orange/purple)
│▌│  +12.5% ↑        ← caption    │
└─┴────────────────────────────────┘
```

---

### Inputs / Form Fields

```
┌──────────────────────────────────┐
│  Label Text *                    │ ← caption (12pt), gray-700, * = red-500
│                                  │
│  ┌──────────────────────────┐    │
│  │ [🔍]  Placeholder text   │    │ ← optional leading icon
│  │                          │    │
│  │  h: 44pt                 │    │    bg: white
│  │  border: 1pt gray-300    │    │    radius: 8pt
│  │  px: 12pt, py: 10pt     │    │    font: body-md (14pt)
│  └──────────────────────────┘    │
│                                  │
│  Helper or error text            │ ← caption (12pt), gray-500 or red-600
└──────────────────────────────────┘

States:
  Rest:    border gray-300
  Focus:   border primary-500, ring 2pt primary-500/20
  Error:   border red-300, ring 2pt red-500/20, error text below
  Disabled: bg gray-50, text gray-400, not editable
```

---

### Select / Dropdown

Same visual styling as Input. On mobile, prefer:
- **iOS:** Native picker or action sheet
- **Android:** Native dropdown / exposed dropdown menu
- **Custom:** Bottom sheet with searchable list for long option lists

```
┌──────────────────────────────────┐
│  [Selected Value]          [▼]   │ ← chevron-down icon, 16×16
│                                  │
│  Same dimensions as Input        │
└──────────────────────────────────┘
```

---

### Textarea

Same styling as Input, with:
- Minimum height: 88pt (4 lines)
- Resizable vertically (web) / expanding (mobile)
- Border radius: 8pt

---

### Data Tables / Lists

On **mobile**, full data tables should be converted to **list cards** or **swipeable rows**:

#### List Card Pattern (preferred on mobile)

```
┌──────────────────────────────────┐
│  Acme Corp                [PAID] │ ← title (body-md bold) + status badge
│  INV-0042 · R 5,000.00          │ ← subtitle (caption, gray-500)
│  Due: 15 Mar 2026       [→]     │ ← detail + chevron
└──────────────────────────────────┘
  ↕ 1pt divider (gray-200)
┌──────────────────────────────────┐
│  Beta Holdings          [UNPAID] │
│  INV-0043 · R 12,500.00         │
│  Due: 20 Mar 2026       [→]     │
└──────────────────────────────────┘
```

- Row height: minimum 64pt
- Horizontal padding: 16pt
- Vertical padding: 12pt
- Divider: 1pt `gray-200`
- Tap → navigate to detail
- Long-press or swipe → action menu (Edit, Delete, Email)

#### Table Header (when table is needed)

```
bg: gray-50
text: caption (12pt), gray-500, uppercase, letter-spacing 0.5pt
padding: H 16pt, V 12pt
```

#### Pagination

- Use infinite scroll on mobile (load more on scroll)
- Or: "Load More" button at bottom
- Show count: "Showing 1–10 of 45"

#### Empty Table

```
┌──────────────────────────────────┐
│                                  │
│        [📄 icon, 48×48]         │
│        gray-300                  │
│                                  │
│    No invoices found             │  ← heading-sm, gray-700
│    Create your first invoice     │  ← body-sm, gray-500
│    to get started.               │
│                                  │
│    [+ Create Invoice]            │  ← primary button
│                                  │
└──────────────────────────────────┘
```

#### Loading Table

```
┌──────────────────────────────────┐
│                                  │
│      [Spinner, 32×32]           │
│      primary-500                 │
│                                  │
│      Loading...                  │  ← body-sm, gray-500
│                                  │
└──────────────────────────────────┘
```

---

### Modals / Bottom Sheets

On mobile, prefer **Bottom Sheets** over centered modals.

#### Bottom Sheet Pattern

```
┌──────────────────────────────────┐
│  ████████ (drag handle, 40×4pt)  │ ← centered, gray-300, radius-full
│                                  │
│  Modal Title           [✕]      │ ← heading-lg, bold
│  ────────────────────────────    │ ← divider
│                                  │
│  [Content scrollable area]       │
│                                  │
│  ────────────────────────────    │
│  [Cancel]      [Confirm]        │ ← footer actions
│                                  │
│  bg: white                       │
│  border-radius: 16pt top         │
│  shadow: xl                      │
└──────────────────────────────────┘

Backdrop: black at 50% opacity
```

#### Gradient Header Modal (matches web pattern)

```
┌──────────────────────────────────┐
│  ┌────────────────────────────┐  │
│  │  bg: gradient primary      │  │ ← rounded top 16pt
│  │  Modal Title        [✕]   │  │ ← white text, heading-lg
│  │  Subtitle text             │  │ ← white/80
│  └────────────────────────────┘  │
│                                  │
│  [Scrollable content]            │
│  p: 20pt                         │
│                                  │
│  ┌────────────────────────────┐  │
│  │  bg: gray-50, border-t     │  │ ← rounded bottom 16pt
│  │  [Cancel]    [Confirm]     │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
```

---

### Badges / Pills / Tags

All badges use `border-radius: full` (pill shape).

| Badge Type | Background | Text | Font | Padding |
|------------|-----------|------|------|---------|
| **Paid / Success** | `green-100` | `green-800` | 11pt SemiBold | H: 8pt, V: 2pt |
| **Partial / Warning** | `yellow-100` | `yellow-800` | 11pt SemiBold | H: 8pt, V: 2pt |
| **Unpaid / Error** | `red-100` | `red-800` | 11pt SemiBold | H: 8pt, V: 2pt |
| **New / Info** | `primary-500` | `white` | 11pt SemiBold | H: 8pt, V: 2pt |
| **Active** | `emerald-50` | `emerald-700` | 11pt Medium | H: 8pt, V: 2pt |
| **Role** | `primary-50` | `primary-700` | 11pt Medium | H: 8pt, V: 4pt |
| **Admin badge** | `gray-100` | `gray-600` | 10pt Medium | H: 6pt, V: 2pt |
| **Module tag** | `gray-100` | `gray-600` | 10pt Medium | H: 6pt, V: 2pt |
| **Unread count** | `scarlet-500` | `white` | 10pt Bold | H: 6pt, V: 2pt |

#### Notification Dot

```
Position: absolute, top-right of bell icon
Size: 8×8pt (no text) or min 16pt wide (with count)
Color: scarlet-500
Shape: circle
```

---

### Avatars

| Size | Dimensions | Usage |
|------|-----------|-------|
| **sm** | 32×32pt | Chat message avatars, inline mentions |
| **md** | 40×40pt | Group list items, contact rows |
| **lg** | 56×56pt | Profile header, contact detail |
| **xl** | 80×80pt | Profile edit screen |

**Style:**
- Shape: Circle (`border-radius: full`)
- With image: `object-fit: cover`
- Without image (initials): `bg: gradient primary-500 → indigo-500`, `text: white, font-weight: SemiBold`
- Fallback icon: `UserIcon` from Heroicons, `gray-400` on `gray-200` background

---

## State Patterns

### Loading States

**Full-screen spinner:**
```
Center of content area
Spinner: 48×48pt circle, 2pt border
Color: border-b primary-500 (partial border trick) + animate-spin
Below: "Loading..." text, body-sm, gray-500
```

**Skeleton loading (portal dashboard):**
```
Animated pulse rectangles:
  - Title: 200×20pt, gray-200, radius-md, animate-pulse
  - Subtitle: 150×16pt, gray-200, radius-md, animate-pulse
  - Card: full-width×120pt, gray-200, radius-lg, animate-pulse
Pulse: 0→50%→100% opacity oscillation, 2s duration, infinite
```

**Button loading:**
```
Replace icon with spinner (16×16, animate-spin)
Change label: "Save" → "Saving..."
Disable interaction
```

**Pull-to-refresh (mobile-specific):**
```
Spinner appears above content on pull-down
Color: primary-500
Release triggers refresh
```

---

### Empty States

Centered in the content area:

```
┌──────────────────────────────────┐
│                                  │
│         [Illustration]           │ ← Heroicon, 48–64pt, gray-300
│                                  │
│     No items yet                 │ ← heading-sm, gray-800
│     Description of what to       │ ← body-sm, gray-500, max 240pt wide
│     do to get started.           │
│                                  │
│     [+ Primary Action]           │ ← Primary button (optional)
│                                  │
└──────────────────────────────────┘
```

**Icons per context:**

| Screen | Icon | Title |
|--------|------|-------|
| Invoices | `DocumentTextIcon` | No invoices yet |
| Contacts | `UserGroupIcon` | No contacts yet |
| Quotations | `DocumentDuplicateIcon` | No quotations yet |
| Notifications | `BellSlashIcon` | All caught up! |
| Chat | `ChatBubbleLeftRightIcon` | No messages yet |
| Assistants | `SparklesIcon` | No assistants created |
| Tasks | `ClipboardDocumentListIcon` | No tasks assigned |

---

### Error States

**Inline error banner:**
```
┌──────────────────────────────────┐
│ ⚠ bg: red-50, border: red-200   │
│                                  │
│  [ExclamationTriangleIcon]       │ ← 20×20, red-600
│  Error message text              │ ← body-sm, red-800
│                                  │
│  radius: 8pt, padding: 12pt     │
└──────────────────────────────────┘
```

**Access Denied screen:**
```
┌──────────────────────────────────┐
│                                  │
│        [🔒 LockClosedIcon]      │ ← 48×48, gray-400
│                                  │
│     Access Restricted            │ ← heading-md, gray-800
│     You don't have permission    │ ← body-sm, gray-500
│     to view this page.           │
│                                  │
│     [Go Back]                    │ ← Outline button
│                                  │
│  bg: white, radius: 12pt        │
│  shadow: md, padding: 32pt      │
└──────────────────────────────────┘
```

---

## Status Colors

Consistent status indicator colors used across all screens:

| Status | Dot Color | Badge BG | Badge Text | Usage |
|--------|-----------|----------|------------|-------|
| **Paid / Complete / Active** | `green-500` | `green-100` | `green-800` | Paid invoices, active assistants, online status |
| **Partial / In Progress** | `yellow-500` | `yellow-100` | `yellow-800` | Partially paid, pending actions |
| **Unpaid / Overdue / Error** | `red-500` | `red-100` | `red-800` | Unpaid invoices, overdue, failed |
| **New / Info** | `blue-500` | `blue-100` | `blue-800` | New items, informational |
| **Draft** | `gray-500` | `gray-100` | `gray-800` | Draft quotations/invoices |
| **Sent** | `blue-500` | `blue-100` | `blue-800` | Sent quotations/invoices |

---

## KPI / Metric Cards

Used on Dashboard, Financial Dashboard, Admin Dashboard, and Portal Dashboard.

### Standard KPI Card (Admin)

```
┌──────────────────────────────────┐
│ ▌ Revenue                        │ ← left-border 4pt (green/blue/orange/purple)
│ ▌                                │
│ ▌ R 150,000                      │ ← heading-lg or display-md, gray-900
│ ▌ +12.5% from last month        │ ← caption, green-600 (positive) / red-600 (negative)
└──────────────────────────────────┘

bg: white, radius: 8pt, shadow: md
padding: 16pt
Grid: 2 columns on mobile
```

**Left-border accent colors:**

| Metric | Border Color |
|--------|-------------|
| Revenue / Income | `green-500` |
| Profit / Balance | `blue-500` |
| Outstanding | `orange-500` |
| Total Invoiced | `purple-500` |

### Portal Stat Card

```
┌──────────────────────────────────┐
│  [SparklesIcon]                  │ ← 24×24, primary-500
│                                  │
│  AI Credits                      │ ← caption, gray-500
│  2,450                           │ ← heading-lg, gray-900, bold
│  remaining                       │ ← caption, gray-400
└──────────────────────────────────┘

bg: white, radius: 12pt, shadow: md
padding: 20pt
Grid: 2 columns on mobile
```

---

## Chat UI

### Chat Bubble Layout

```
┌──────────────────────────────────────────┐
│                                          │
│  [🤖]  ┌───────────────────────────┐     │
│  32×32 │  Assistant message text    │     │
│        │  that can be multi-line    │     │
│        │                           │     │
│        │  bg: gray-100             │     │
│        │  radius: 16pt             │     │
│        │  radius-tl: 4pt           │     │
│        └───────────────────────────┘     │
│        10:42 AM                          │ ← caption, gray-400
│                                          │
│       ┌───────────────────────────┐ [👤] │
│       │  User message text        │ 32×32│
│       │                           │      │
│       │  bg: primary-500          │      │
│       │  text: white              │      │
│       │  radius: 16pt             │      │
│       │  radius-tr: 4pt           │      │
│       └───────────────────────────┘      │
│                               10:43 AM   │
│                                          │
└──────────────────────────────────────────┘
```

**Chat bubble specs:**

| Property | User Bubble | Assistant Bubble |
|----------|------------|-----------------|
| Background | `primary-500` | `gray-100` |
| Text | `white` | `gray-900` |
| Max width | 75% of screen | 75% of screen |
| Border radius | 16pt, top-right 4pt | 16pt, top-left 4pt |
| Alignment | Right | Left |
| Avatar | Right side, `gray-200` bg | Left side, `primary-500/10` bg |
| Padding | 12pt H, 10pt V | 12pt H, 10pt V |
| Font | body-md (14pt) | body-md (14pt) |

### Typing Indicator

```
[🤖] [·  ·  ·]
      Three dots, 6×6pt each, gray-400, rounded-full
      Staggered bounce animation: 0ms, 150ms, 300ms delay
      Bounce: translateY 0 → -6pt → 0, 1.4s infinite
```

### Chat Input Area

```
┌──────────────────────────────────────────┐
│  border-t: 1pt gray-200                  │
│  padding: 12pt                           │
│                                          │
│  ┌────────────────────────────┐  [➤]    │
│  │  Type a message...         │  40×40   │
│  │                            │  primary │
│  │  bg: gray-50               │  radius: │
│  │  radius: 12pt              │  full    │
│  │  padding: 10pt 16pt        │          │
│  └────────────────────────────┘          │
└──────────────────────────────────────────┘
```

---

## Notification Patterns

### Notification List Item

```
┌──────────────────────────────────────────┐
│  ┌────┐                                  │
│  │ 🔵 │  New invoice payment received    │ ← title (body-md, bold if unread)
│  │icon│  Payment of R5,000 for INV-0001  │ ← body (body-sm, gray-500)
│  │32×32│ 2 hours ago                     │ ← timestamp (caption, gray-400)
│  └────┘                          [•]     │ ← blue dot if unread (8pt, primary-500)
└──────────────────────────────────────────┘
  border-bottom: 1pt gray-100
  bg: white (read) / primary-50/10 (unread)
  padding: 16pt
```

**Type-based icon backgrounds:**

| Type | Icon BG | Icon Color |
|------|---------|-----------|
| Info | `blue-100` | `blue-600` |
| Success | `green-100` | `green-600` |
| Warning | `yellow-100` | `yellow-600` |
| Error | `red-100` | `red-600` |

---

## Forms

### Form Layout

```
┌──────────────────────────────────┐
│  Section Title                   │ ← heading-md, gray-900
│  ────────────────────────        │
│                                  │
│  Label *                         │
│  [Input field                ]   │
│                                  │ ← 16pt gap between fields
│  Label                           │
│  [Input field                ]   │
│                                  │
│  Two-column fields:              │
│  ┌──────────┐  ┌──────────┐    │ ← side-by-side on tablet, stacked on phone
│  │ Label    │  │ Label    │    │
│  │ [Input]  │  │ [Input]  │    │
│  └──────────┘  └──────────┘    │
│                                  │
│  ────────────────────────        │
│           [Cancel] [Save]        │ ← right-aligned, 12pt gap
└──────────────────────────────────┘
```

**Form field rules:**
- Labels above inputs (not floating)
- Required fields: red asterisk `*` after label
- Error messages appear below the field, red-600, caption size
- Form section spacing: 24pt
- Action buttons: right-aligned (or full-width on small phones)
- Minimum touch target: 44×44pt for all interactive elements

---

## Alerts & Toasts

### Confirmation Dialog (SweetAlert2 → Native Alert)

```
┌──────────────────────────────────┐
│                                  │
│  ⚠️  [Warning icon, 48pt]       │
│                                  │
│  Delete Invoice?                 │ ← heading-md, center-aligned
│                                  │
│  This action cannot be undone.   │ ← body-sm, gray-500, center
│  The invoice INV-0042 will be    │
│  permanently removed.            │
│                                  │
│  [Cancel]        [Delete]        │ ← outline btn + danger btn
│                                  │
│  bg: white, radius: 16pt        │
│  shadow: xl                      │
│  Backdrop: black/50              │
└──────────────────────────────────┘
```

### Toast Notification

```
┌──────────────────────────────────┐
│  [✓]  Invoice saved successfully │ ← slides down from top (or up from bottom)
│  green-600 icon, body-sm text    │
│                                  │
│  bg: white, radius: 12pt        │
│  shadow: lg                      │
│  border-l: 4pt green-500        │
│  auto-dismiss: 3–5 seconds      │
│  swipe to dismiss                │
└──────────────────────────────────┘
```

**Toast types:**

| Type | Left Border | Icon Color | Icon |
|------|-------------|-----------|------|
| Success | `green-500` | `green-600` | `CheckCircleIcon` |
| Error | `red-500` | `red-600` | `XCircleIcon` |
| Warning | `orange-500` | `orange-600` | `ExclamationTriangleIcon` |
| Info | `blue-500` | `blue-600` | `InformationCircleIcon` |

---

## Animation & Motion

### Timing

| Duration | Usage |
|----------|-------|
| 150ms | Micro-interactions: button press, icon color change |
| 200ms | Hover states, focus transitions, nav item highlights |
| 300ms | Screen transitions, modal open/close, drawer slide |
| 500ms | Content fade-in, slide-up entrance animations |
| 1000ms+ | Skeleton pulse loops, typing indicator bounce |

### Easing

| Easing | Usage |
|--------|-------|
| `ease-out` | Entrance animations (content appearing) |
| `ease-in` | Exit animations (content disappearing) |
| `ease-in-out` | Looping animations (float, pulse) |
| `spring` | Navigation transitions (React Native Reanimated) |

### Standard Animations

| Animation | Description | Duration | Usage |
|-----------|-------------|----------|-------|
| **Slide Up** | translateY(20pt→0) + opacity(0→1) | 500ms ease-out | Content loading on screen enter |
| **Fade In** | opacity(0→1) | 500ms ease-out | Secondary content appearance |
| **Spin** | rotate(0→360°) | 1000ms linear infinite | Loading spinners |
| **Pulse** | opacity(1→0.5→1) | 2000ms ease-in-out infinite | Skeleton loaders, status dots |
| **Bounce** | translateY(0→-6pt→0) | 1400ms ease-in-out infinite | Typing indicator dots (staggered) |
| **Scale Press** | scale(1→0.97→1) | 150ms | Button press feedback (optional) |

### Screen Transitions

| Transition | Direction | Usage |
|-----------|-----------|-------|
| Slide from right | → | Push navigation (detail screens) |
| Slide from bottom | ↑ | Modal / Bottom sheet presentation |
| Fade | — | Tab switches, root screen changes |
| None | — | Same-level sibling navigation |

---

## Icons

**Icon Library:** [Heroicons v2](https://heroicons.com/) — **Outline** variant (24px)

### Icon Sizes

| Context | Size | Examples |
|---------|------|---------|
| Navigation item | 20×20pt | Sidebar, bottom tab icons |
| Button icon | 16×16pt | Inline button icons |
| Header action | 24×24pt | Bell, user menu in top bar |
| Page header | 28×28pt | Icon next to page title in gradient header |
| Empty state | 48–64pt | Large centered empty state illustrations |
| Status inline | 16×16pt | Status indicators in lists |

### Common Icons Reference

| Purpose | Icon Name | Heroicons Import |
|---------|-----------|-----------------|
| Dashboard | `ChartBarSquareIcon` | `@heroicons/react/24/outline` |
| Contacts | `UserGroupIcon` | |
| Invoices | `DocumentTextIcon` | |
| Quotations | `DocumentDuplicateIcon` | |
| Payments | `CreditCardIcon` | |
| Transactions | `BanknotesIcon` | |
| Settings | `Cog6ToothIcon` | |
| Profile | `UserCircleIcon` | |
| Notifications | `BellIcon` | |
| Search | `MagnifyingGlassIcon` | |
| Add / Create | `PlusIcon` | |
| Edit | `PencilSquareIcon` | |
| Delete | `TrashIcon` | |
| Back | `ChevronLeftIcon` | |
| Forward / Navigate | `ChevronRightIcon` | |
| Close | `XMarkIcon` | |
| Menu / Hamburger | `Bars3Icon` | |
| Send | `PaperAirplaneIcon` | |
| Download | `ArrowDownTrayIcon` | |
| Upload | `ArrowUpTrayIcon` | |
| Calendar | `CalendarIcon` | |
| Chat | `ChatBubbleLeftRightIcon` | |
| AI / Sparkles | `SparklesIcon` | |
| Globe / Sites | `GlobeAltIcon` | |
| Lock | `LockClosedIcon` | |
| Eye (view) | `EyeIcon` | |
| Filter | `FunnelIcon` | |
| Sort | `ArrowsUpDownIcon` | |
| Info | `InformationCircleIcon` | |
| Warning | `ExclamationTriangleIcon` | |
| Success | `CheckCircleIcon` | |
| Error | `XCircleIcon` | |
| Logout | `ArrowRightOnRectangleIcon` | |

> **React Native:** Use `react-native-heroicons` or `@nandorojo/heroicons`
> **Flutter:** Use `heroicons_flutter` package or convert SVGs to custom icons
> **Native iOS/Swift:** Use SF Symbols with visual matching to Heroicons
> **Native Android/Kotlin:** Use Material Icons or bundle Heroicons as vector drawables

---

## Currency & Locale

| Setting | Value |
|---------|-------|
| Default Currency | ZAR (South African Rand) |
| Currency Symbol | `R` |
| Decimal Separator | `.` (period) |
| Thousands Separator | `,` (comma) |
| Tax Rate | 15% (VAT) |
| Date Format | `DD MMM YYYY` (e.g., "15 Mar 2026") |
| Time Format | `HH:mm` (24-hour) or `h:mm A` (12-hour, user preference) |

**Formatting examples:**
```
R 1,500.00          ← currency with spaces
R 25,000.00         ← thousands separator
15 Mar 2026         ← date
10:42 AM            ← time
2 hours ago         ← relative time (use date-fns formatDistanceToNow)
```

> Currency symbol and tax rate are **dynamic** — fetched from `GET /app-settings`. Always use the API values, not hardcoded.

---

## Dark Mode (Future)

Dark mode is **not yet implemented** but the token system is prepared. The `dark` scale is defined:

| Token | Hex | Light Mode Usage | Dark Mode Mapping |
|-------|-----|------------------|-------------------|
| `dark-50` | `#F8FAFC` | — | Text on dark surfaces |
| `dark-800` | `#1E293B` | — | Card backgrounds |
| `dark-850` | `#172033` | — | Elevated surface |
| `dark-900` | `#0F172A` | — | Page background |
| `dark-925` | `#0A0F1A` | — | Deep background |
| `dark-950` | `#050810` | — | Deepest / true dark |

When dark mode is implemented:

| Element | Light | Dark |
|---------|-------|------|
| Page background | `gray-50` | `dark-900` |
| Card background | `white` | `dark-800` |
| Card border | `gray-100` | `dark-700` |
| Primary text | `gray-900` | `dark-50` |
| Secondary text | `gray-500` | `dark-400` |
| Input background | `white` | `dark-850` |
| Input border | `gray-300` | `dark-600` |
| Dividers | `gray-200` | `dark-700` |
| Primary brand | `#00A4EE` | `#00A4EE` (unchanged) |

---

## Platform-Specific Notes

### iOS

| Aspect | Guideline |
|--------|-----------|
| Safe areas | Respect `SafeAreaView` — header and bottom tabs inside safe area |
| Bottom tab | Standard `UITabBarController` height (~49pt + home indicator) |
| Navigation | Use native-stack navigator for iOS-style push/pop animations |
| Haptics | Light haptic on button press, medium on destructive action confirm |
| Status bar | Light content (white text) when gradient header is visible, dark otherwise |
| Pull-to-refresh | Native `UIRefreshControl` with primary-500 tint |
| Keyboard | `KeyboardAvoidingView` with `behavior="padding"` on iOS |
| Font | Inter via `expo-google-fonts` or SF Pro as fallback |

### Android

| Aspect | Guideline |
|--------|-----------|
| Status bar | Translucent, primary-700 background when gradient header is visible |
| Navigation bar | Match page background color (gray-50 / white) |
| Bottom tab | Material 3 navigation bar style, 80pt height |
| Elevation | Use Android `elevation` property for shadows |
| Ripple | Enable ripple effect on all touchable elements |
| Back button | Handle hardware back button for navigation |
| Edge-to-edge | Enable edge-to-edge display with proper insets |
| Font | Inter via Google Fonts or Roboto as fallback |

### React Native Specific

```javascript
// Recommended library stack:
{
  "navigation": "@react-navigation/native + @react-navigation/bottom-tabs + @react-navigation/drawer",
  "icons": "react-native-heroicons",
  "animations": "react-native-reanimated",
  "gestures": "react-native-gesture-handler",
  "toast": "react-native-toast-message",
  "alerts": "react-native-awesome-alerts or Alert.alert()",
  "forms": "react-hook-form",
  "storage": "expo-secure-store (tokens), @react-native-async-storage/async-storage (prefs)",
  "fonts": "@expo-google-fonts/inter",
  "dates": "date-fns",
  "charts": "react-native-chart-kit or victory-native"
}
```

### Flutter Specific

```yaml
# Recommended packages:
dependencies:
  google_fonts: ^6.0.0          # Inter font
  heroicons_flutter: ^0.4.0     # Icons
  flutter_secure_storage: ^9.0.0 # Token storage
  go_router: ^14.0.0            # Navigation
  flutter_riverpod: ^2.0.0      # State management
  intl: ^0.19.0                 # Currency/date formatting
  fl_chart: ^0.68.0             # Charts
```

---

## Component Quick Reference

### At-a-Glance: Component → Token Mapping

| Component | BG | Border | Radius | Shadow | Padding |
|-----------|----|--------|--------|--------|---------|
| **Page** | `gray-50` | — | — | — | 16pt H |
| **Header bar** | `white` | bottom 2pt `primary-500/20` | — | `md` | 16pt H |
| **Page header (gradient)** | gradient `primary-500→primary-500/80` | — | — | `md` | 20pt |
| **Card** | `white` | 1pt `gray-100` | 12pt | `md` | 20pt |
| **KPI card** | `white` | left 4pt (accent color) | 8pt | `md` | 16pt |
| **Input** | `white` | 1pt `gray-300` | 8pt | — | 12pt H, 10pt V |
| **Input (focus)** | `white` | 1pt `primary-500` + ring | 8pt | — | 12pt H, 10pt V |
| **Button (primary)** | `primary-600` | — | 8pt | — | 16pt H, 10pt V |
| **Button (outline)** | `white` | 1pt `gray-300` | 8pt | — | 16pt H, 10pt V |
| **Button (danger)** | `scarlet-500` | — | 8pt | — | 16pt H, 10pt V |
| **Badge (success)** | `green-100` | — | full | — | 8pt H, 2pt V |
| **Badge (error)** | `red-100` | — | full | — | 8pt H, 2pt V |
| **Modal** | `white` | — | 16pt top | `xl` | 20pt |
| **Bottom sheet** | `white` | — | 16pt top | `xl` | 20pt |
| **Toast** | `white` | left 4pt (type color) | 12pt | `lg` | 16pt |
| **Nav item (active)** | `primary-50` | right 3pt `primary-700` | 8pt | — | 12pt H, 10pt V |
| **Nav item (rest)** | transparent | — | 8pt | — | 12pt H, 10pt V |
| **Chat bubble (user)** | `primary-500` | — | 16pt (tr: 4pt) | — | 12pt H, 10pt V |
| **Chat bubble (assistant)** | `gray-100` | — | 16pt (tl: 4pt) | — | 12pt H, 10pt V |
| **Avatar** | gradient or `gray-200` | — | full | — | — |
| **Divider** | `gray-200` | — | — | — | 1pt height |
| **Table header** | `gray-50` | — | — | — | 16pt H, 12pt V |
| **List row** | `white` | bottom 1pt `gray-100` | — | — | 16pt H, 12pt V |
| **Sidebar** | `white` | right 1pt `gray-200` | — | `md` | — |

---

> **Document Maintenance:** This design language should be updated whenever the web frontend's Tailwind config, UI components, or visual patterns change. Cross-reference with `/var/opt/frontend/tailwind.config.js` and `/var/opt/frontend/src/components/UI/` for the source of truth.
