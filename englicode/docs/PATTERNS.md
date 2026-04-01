# Englicode Design Patterns

## Architecture Overview

Englicode follows a modern React SPA architecture with clear separation between public and admin functionality.

## Component Organization

### Directory Structure Pattern
```
src/
├── components/          # Reusable components
│   ├── training/       # Protocol-specific training modules
│   └── ProtectedRoute.jsx
├── pages/              # Route-level components
│   ├── public/         # Public-facing pages
│   └── terminal/       # Admin-only pages
├── stores/             # Zustand state stores
├── lib/                # Utilities and API client
└── App.jsx             # Root routing
```

## State Management Patterns

### Zustand Store Pattern
Englicode uses Zustand for global state management with a single auth store.

**Pattern**: Centralized authentication state
```javascript
const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('englicode_token') || null,
  loading: true,
  
  // Actions
  fetchUser: async () => { /* ... */ },
  logout: () => { /* ... */ },
}));
```

**Usage**:
```javascript
const { user, fetchUser } = useAuthStore((s) => ({ 
  user: s.user, 
  fetchUser: s.fetchUser 
}));
```

### Local Component State
For page-specific state, use React's `useState` and `useCallback`:
```javascript
const [loading, setLoading] = useState(true);
const [data, setData] = useState([]);

const fetchData = useCallback(async () => {
  setLoading(true);
  // fetch logic
  setLoading(false);
}, [dependencies]);
```

## Routing Patterns

### Public vs Protected Routes
```javascript
<Routes>
  {/* Public routes with shared layout */}
  <Route element={<PublicLayout />}>
    <Route path="/" element={<Home />} />
    <Route path="/protocols" element={<Protocols />} />
  </Route>

  {/* Protected admin routes */}
  <Route path="/terminal" element={<ProtectedRoute><TerminalLayout /></ProtectedRoute>}>
    <Route index element={<Dashboard />} />
  </Route>
</Routes>
```

### Protected Route Pattern
```javascript
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuthStore();
  
  if (loading) return <LoadingSpinner />;
  if (!user || user.rank_tier < 4) return <Navigate to="/terminal/login" />;
  
  return children;
}
```

## API Communication Patterns

### Axios Instance with Interceptors
**Pattern**: Centralized API client with automatic token injection

```javascript
const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor - attach JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('englicode_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor - handle 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('englicode_token');
    }
    return Promise.reject(err);
  }
);
```

### API Call Pattern
```javascript
try {
  const { data } = await api.get('/endpoint');
  setData(data.data); // Unwrap nested data
} catch (err) {
  const msg = err.response?.data?.message || 'Operation failed';
  setError(msg);
}
```

## Styling Patterns

### CSS Variables for Theming
All colors use CSS custom properties for light/dark theme support:

```css
:root {
  --bg-primary: #0a0a0a;
  --bg-secondary: #111111;
  --text-primary: #ffffff;
  --text-secondary: #a0a0a0;
  --accent: #00d4aa;
  --border: #222222;
}

.light {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --text-primary: #0a0a0a;
  --text-secondary: #666666;
  --accent: #00a885;
  --border: #e0e0e0;
}
```

### Inline Style Pattern
For dynamic theming, use inline styles with CSS variables:
```javascript
<div style={{ color: 'var(--accent)', background: 'var(--bg-secondary)' }}>
  Content
</div>
```

### Tailwind + CSS Variables
Combine Tailwind utilities with CSS variables:
```javascript
<div className="px-4 py-2 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
```

## Animation Patterns

### Framer Motion for Interactions
**Pattern**: Declarative animations with `motion` components

```javascript
import { motion } from 'framer-motion';

<motion.div
  animate={{ width: `${percentage}%` }}
  transition={{ type: 'spring', stiffness: 120, damping: 20 }}
/>
```

### Conditional Animations
```javascript
<motion.div
  animate={isOverload ? { scale: [1, 1.05, 1] } : {}}
  transition={isOverload ? { duration: 0.4, repeat: Infinity } : {}}
/>
```

## Form Patterns

### Controlled Inputs with Validation
```javascript
const [form, setForm] = useState({ term: '', meaning: '' });

<input
  value={form.term}
  onChange={(e) => setForm({ ...form, term: e.target.value })}
  required
/>
```

### Numeric Input Pattern
```javascript
const [value, setValue] = useState('1.5');

<input
  type="text"
  inputMode="decimal"
  value={value}
  onChange={(e) => {
    const v = e.target.value;
    if (v === '' || /^\d*\.?\d*$/.test(v)) setValue(v);
  }}
/>
```

## Modal Patterns

### Portal-Free Modal
```javascript
const [modalOpen, setModalOpen] = useState(false);

{modalOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/70" onClick={() => setModalOpen(false)} />
    <div className="relative bg-[var(--bg-secondary)] rounded-lg p-6">
      {/* Modal content */}
    </div>
  </div>
)}
```

## Data Fetching Patterns

### Fetch on Mount with Cleanup
```javascript
useEffect(() => {
  let mounted = true;
  
  async function fetch() {
    const data = await api.get('/endpoint');
    if (mounted) setData(data);
  }
  
  fetch();
  return () => { mounted = false; };
}, []);
```

### Paginated Data Pattern
```javascript
const [page, setPage] = useState(1);
const [total, setTotal] = useState(0);

const fetchData = useCallback(async () => {
  const params = new URLSearchParams({ page, limit: 20 });
  const { data } = await api.get(`/endpoint?${params}`);
  setItems(data.data.items);
  setTotal(data.data.total);
}, [page]);

const totalPages = Math.ceil(total / 20);
```

## Error Handling Patterns

### Try-Catch with User Feedback
```javascript
try {
  await api.post('/endpoint', payload);
  // Success feedback
} catch (err) {
  const msg = err.response?.data?.message || 'Operation failed';
  alert(msg); // Or use toast notification
}
```

### Loading States
```javascript
const [loading, setLoading] = useState(true);

if (loading) return <LoadingSpinner />;
if (error) return <ErrorMessage />;
return <Content />;
```

## Performance Patterns

### useCallback for Stable References
```javascript
const fetchData = useCallback(async () => {
  // fetch logic
}, [dependencies]);

useEffect(() => {
  fetchData();
}, [fetchData]);
```

### Debounced Search
```javascript
const [search, setSearch] = useState('');

useEffect(() => {
  const timer = setTimeout(() => {
    // Perform search
  }, 300);
  return () => clearTimeout(timer);
}, [search]);
```

## Naming Conventions

### Component Files
- PascalCase: `DictionaryManager.jsx`
- Match component name: `export default function DictionaryManager()`

### State Variables
- Descriptive names: `loading`, `error`, `terms`, `totalPages`
- Boolean prefix: `isLoading`, `hasError`, `canSubmit`

### Functions
- Verb prefix: `fetchData`, `handleSubmit`, `openModal`
- Event handlers: `handleClick`, `handleChange`

### API Endpoints
- RESTful: `/index`, `/pull-requests`, `/quiz/question`
- Kebab-case: `/auth/admin/login`

## Code Organization Principles

1. **Separation of Concerns**: Public vs Admin, UI vs Logic
2. **Single Responsibility**: Each component has one clear purpose
3. **DRY**: Reusable components in `/components`, shared logic in `/lib`
4. **Consistent Styling**: CSS variables + Tailwind utilities
5. **Type Safety**: Prop validation through usage patterns
6. **Error Boundaries**: Graceful degradation with loading/error states

## Testing Patterns

While no tests are currently implemented, the architecture supports:
- Unit tests for utility functions
- Component tests with React Testing Library
- Integration tests for API flows
- E2E tests with Playwright/Cypress

## Deployment Patterns

### Build Process
```bash
npm run build  # Vite builds to /dist
```

### Environment Variables
- Development: Vite dev server proxies `/api` to backend
- Production: Static files served, API at same origin

## Security Patterns

### Token Storage
- JWT in `localStorage` as `englicode_token`
- Automatic attachment via Axios interceptor
- Cleared on 401 responses

### Admin Impersonation
- Original token preserved as `englicode_admin_token`
- Reversible with `stopImpersonating()`

### Protected Routes
- Server-side validation required
- Client-side guards for UX only
