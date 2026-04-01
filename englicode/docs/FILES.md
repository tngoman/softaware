# Englicode File Structure

## Root Directory
```
/var/opt/englicode/
├── client/              # React frontend application
└── docs/                # Documentation
```

## Client Application Structure

### `/client` - Root Files
```
client/
├── package.json         # Dependencies and scripts
├── package-lock.json    # Locked dependency versions
├── vite.config.js       # Vite build configuration
├── eslint.config.js     # ESLint rules
├── index.html           # HTML entry point
├── README.md            # Vite + React template info
└── .gitignore           # Git ignore rules
```

### `/client/public` - Static Assets
```
public/
├── favicon.svg          # Browser tab icon
└── icons.svg            # SVG sprite sheet
```

### `/client/src` - Source Code

#### Root Source Files
```
src/
├── main.jsx             # Application entry point, React root
├── App.jsx              # Root component with routing
├── App.css              # Global application styles
└── index.css            # Base styles and CSS variables
```

**main.jsx** - Bootstraps React app, applies saved theme, renders App in StrictMode with BrowserRouter

**App.jsx** - Defines all routes (public + admin), fetches user on mount

**index.css** - CSS custom properties for theming, global styles

#### `/client/src/assets` - Media Files
```
assets/
├── hero.png             # Homepage hero image
├── logo.png             # Englicode logo
├── react.svg            # React logo
└── vite.svg             # Vite logo
```

#### `/client/src/lib` - Utilities
```
lib/
└── api.js               # Axios instance with interceptors
```

**api.js** - Configured Axios client:
- Base URL: `/api`
- Request interceptor: Attaches JWT from localStorage
- Response interceptor: Clears token on 401

#### `/client/src/stores` - State Management
```
stores/
└── authStore.js         # Zustand authentication store
```

**authStore.js** - Global auth state:
- Fields: `user`, `token`, `loading`, `error`, `impersonating`
- Actions: `adminLogin`, `fetchUser`, `impersonate`, `stopImpersonating`, `logout`

#### `/client/src/components` - Reusable Components
```
components/
├── ProtectedRoute.jsx   # Admin route guard
└── training/            # Protocol training modules
    ├── DataDecaTraining.jsx
    ├── DecaScaleTraining.jsx
    ├── PercentageTraining.jsx
    └── TimeIndexTraining.jsx
```

**ProtectedRoute.jsx** - Wraps admin routes, checks user rank >= 4 (Admin)

**training/** - Interactive protocol learning components for TrainingRoom page

#### `/client/src/pages` - Route Components

##### `/client/src/pages/public` - Public Pages
```
pages/public/
├── PublicLayout.jsx     # Shared navbar/footer wrapper
├── Home.jsx             # Landing page with protocol demos
├── About.jsx            # Platform mission and pillars
├── Protocols.jsx        # Complete protocol reference
├── IndexBrowser.jsx     # Dictionary search and browse
├── TrainingRoom.jsx     # Interactive protocol training
├── Quiz.jsx             # Multi-protocol speed quiz
├── Leaderboard.jsx      # Top users by points
├── ConsensusBoard.jsx   # Public PR viewing
├── UserProfile.jsx      # User stats and rank
├── Settings.jsx         # User preferences
├── Legal.jsx            # Terms, privacy, legal
└── OAuthCallback.jsx    # OAuth redirect handler
```

**PublicLayout.jsx** - Outlet wrapper with navigation and footer

**Home.jsx** - Hero section, protocol examples, interactive translators:
- Universal Translator (time/currency scaling)
- Status Protocol (bandwidth gauge)
- Direction Protocol (metric compass)
- Rank system overview

**Protocols.jsx** - Detailed documentation for all 8 protocols with examples

**IndexBrowser.jsx** - Searchable dictionary with category filters

**TrainingRoom.jsx** - Protocol selector + active training component

**Quiz.jsx** - Random protocol questions, speed-based scoring, streak tracking

**Leaderboard.jsx** - Ranked user list with points and ranks

**ConsensusBoard.jsx** - Public view of Pull Requests with voting

**UserProfile.jsx** - User stats, rank badge, contribution history

**Settings.jsx** - Theme toggle, account preferences

**Legal.jsx** - Dynamic legal content based on route param

**OAuthCallback.jsx** - Handles OAuth redirect, extracts token, redirects to home

##### `/client/src/pages/terminal` - Admin Pages
```
pages/terminal/
├── TerminalLayout.jsx   # Admin sidebar wrapper
├── TerminalLogin.jsx    # Admin login form
├── Dashboard.jsx        # Platform statistics
├── DictionaryManager.jsx # CRUD for canon terms
├── PullRequests.jsx     # PR approval/rejection
└── UsersManager.jsx     # User administration
```

**TerminalLayout.jsx** - Admin navigation sidebar with Outlet

**TerminalLogin.jsx** - Email/password form for admin access

**Dashboard.jsx** - Overview cards:
- Total canon terms
- Pending PRs
- Category breakdown
- Top users leaderboard

**DictionaryManager.jsx** - Full dictionary management:
- Add/edit/delete terms
- Category filter
- Search
- Pagination

**PullRequests.jsx** - PR management:
- Status tabs (pending/approved/rejected)
- Approve (merge to canon)
- Reject with reason
- Upvote/downvote display

**UsersManager.jsx** - User administration (CRUD, impersonation)

## Documentation Structure

### `/docs` - Documentation Files
```
docs/
├── README.md            # This file - platform overview
├── PATTERNS.md          # Design patterns and conventions
├── FILES.md             # File structure (this document)
├── FIELDS.md            # Data structures and API fields
├── ROUTES.md            # API endpoint documentation
├── CHANGES.md           # Version history and updates
└── how_to_contribute.md # Community contribution guide
```

## Key File Relationships

### Authentication Flow
```
main.jsx
  └─> App.jsx (fetchUser on mount)
       └─> authStore.js (fetchUser action)
            └─> api.js (GET /auth/me)
```

### Protected Route Flow
```
App.jsx (route definition)
  └─> ProtectedRoute.jsx (checks authStore.user.rank_tier)
       └─> TerminalLayout.jsx (if authorized)
            └─> Dashboard.jsx / DictionaryManager.jsx / etc.
```

### API Call Flow
```
Component (e.g., Quiz.jsx)
  └─> api.js (axios instance)
       └─> Request interceptor (attach token)
            └─> Backend API
                 └─> Response interceptor (handle 401)
```

### Theme System
```
main.jsx (apply saved theme on load)
  └─> index.css (CSS variables)
       └─> Components (inline styles with var(--accent))
```

## Build Output

### Production Build
```
dist/
├── index.html           # Entry HTML
├── assets/              # Bundled JS/CSS with hashes
│   ├── index-[hash].js
│   └── index-[hash].css
└── [static assets]      # Copied from public/
```

## Configuration Files

### vite.config.js
- React plugin with Oxc
- Dev server configuration
- Build optimizations

### eslint.config.js
- React-specific rules
- React Hooks plugin
- React Refresh plugin

### package.json Scripts
- `dev` - Start Vite dev server
- `build` - Production build
- `lint` - Run ESLint
- `preview` - Preview production build

## Asset Loading

### Images
- Imported in components: `import logo from './assets/logo.png'`
- Public assets: Referenced as `/favicon.svg`

### Styles
- Global: `index.css` imported in `main.jsx`
- Component: `App.css` imported in `App.jsx`
- Inline: CSS variables for theming

## Code Splitting

Vite automatically code-splits:
- Each route component is a separate chunk
- Lazy-loaded on navigation
- Shared dependencies in vendor chunk

## Development Workflow

1. Edit files in `/client/src`
2. Vite HMR updates browser instantly
3. ESLint checks on save
4. Build with `npm run build`
5. Deploy `/dist` to production

## File Naming Conventions

- **Components**: PascalCase (e.g., `DictionaryManager.jsx`)
- **Utilities**: camelCase (e.g., `api.js`)
- **Stores**: camelCase with "Store" suffix (e.g., `authStore.js`)
- **Styles**: kebab-case or camelCase (e.g., `index.css`, `App.css`)
- **Assets**: lowercase with hyphens (e.g., `hero.png`)

## Import Patterns

### Relative Imports
```javascript
import api from '../../lib/api';
import useAuthStore from '../../stores/authStore';
```

### Named vs Default Exports
- Components: Default export
- Utilities: Named or default based on usage
- Stores: Default export

## File Size Considerations

- Keep components under 500 lines
- Extract reusable logic to `/lib`
- Split large pages into sub-components
- Use code splitting for heavy dependencies

## Future Structure Considerations

Potential additions:
- `/client/src/hooks` - Custom React hooks
- `/client/src/utils` - Pure utility functions
- `/client/src/constants` - App-wide constants
- `/client/src/types` - TypeScript definitions (if migrating)
- `/client/src/contexts` - React Context providers
