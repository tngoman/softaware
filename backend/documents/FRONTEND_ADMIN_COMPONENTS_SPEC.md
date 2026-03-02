# Frontend Admin Components Specification
## Detailed Component Designs & Implementation Guide

**Document Version**: 1.0  
**Created**: March 1, 2026  
**Target**: `/var/opt/frontend` Component Library  

---

## Table of Contents

1. [Admin Layout Components](#admin-layout-components)
2. [UI Component Specifications](#ui-component-specifications)
3. [Page Components](#page-components)
4. [Data Visualization](#data-visualization)
5. [Forms & Modals](#forms--modals)
6. [API Service Layer](#api-service-layer)
7. [Types & Interfaces](#types--interfaces)

---

## Admin Layout Components

### 1. AdminLayout.tsx
**Purpose**: Main wrapper component for all admin pages  
**Location**: `src/components/AdminLayout/AdminLayout.tsx`

**Features**:
- Two-column layout (sidebar + main content)
- Responsive design (sidebar collapses on mobile)
- Navigation structure
- User menu and logout
- Breadcrumb navigation

**Props**:
```typescript
interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
  breadcrumbs?: BreadcrumbItem[];
}
```

**Implementation Notes**:
- Use existing Layout component as base
- Create admin-specific sidebar with admin routes only
- Add collapsible sidebar toggle
- Maintain consistent header styling

**Example Usage**:
```tsx
<AdminLayout title="Dashboard">
  <Dashboard />
</AdminLayout>
```

---

### 2. AdminSidebar.tsx
**Purpose**: Navigation sidebar for admin section  
**Location**: `src/components/AdminLayout/AdminSidebar.tsx`

**Menu Structure**:
```
ADMIN
├── Dashboard
├── OPERATIONS
│   ├── Workspaces
│   └── Activation Keys
├── LICENSING
│   ├── Subscriptions
│   ├── Credits
│   └── Packages
├── CONFIGURATION
│   ├── Pricing
│   └── System Settings
```

**Features**:
- Collapsible sections
- Active state highlighting
- Icon + label
- Mobile collapse/expand
- Permission-based visibility

**Styling**:
```tsx
// Active route styling
className={`flex items-center gap-3 px-4 py-2 rounded-lg
  ${isActive ? 'bg-picton-blue-50 text-picton-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
```

---

### 3. AdminHeader.tsx
**Purpose**: Header with breadcrumbs and user menu  
**Location**: `src/components/AdminLayout/AdminHeader.tsx`

**Features**:
- Breadcrumb navigation
- Title display
- User menu (profile, logout)
- Notification icon (if applicable)
- Search bar (optional)

**Props**:
```typescript
interface AdminHeaderProps {
  title: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: ReactNode;
}
```

---

## UI Component Specifications

### 1. StatsCard.tsx
**Purpose**: Display KPI statistics on dashboard  
**Location**: `src/components/UI/StatsCard.tsx`

**Design**:
```
┌─────────────────────────────────────┐
│ Title                          Icon │
│ 1,234                               │
│ +12.5% from last month              │
└─────────────────────────────────────┘
```

**Props**:
```typescript
interface StatsCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    isPositive: boolean;
  };
  icon?: React.ComponentType<IconProps>;
  onClick?: () => void;
  loading?: boolean;
  className?: string;
}
```

**Implementation**:
```tsx
export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  change,
  icon: Icon,
  loading = false,
}) => (
  <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-gray-600 text-sm font-medium">{title}</p>
        <p className="text-3xl font-bold text-gray-900 mt-2">
          {loading ? '...' : value}
        </p>
        {change && (
          <p className={`text-sm mt-2 ${
            change.isPositive ? 'text-green-600' : 'text-red-600'
          }`}>
            {change.isPositive ? '+' : '-'}{Math.abs(change.value)}%
          </p>
        )}
      </div>
      {Icon && <Icon className="w-8 h-8 text-picton-blue-500" />}
    </div>
  </div>
);
```

**Usage**:
```tsx
<StatsCard
  title="Total Workspaces"
  value={45}
  change={{ value: 12.5, isPositive: true }}
  icon={BuildingOfficeIcon}
/>
```

---

### 2. FormModal.tsx
**Purpose**: Generic modal for create/edit forms  
**Location**: `src/components/UI/FormModal.tsx`

**Design**:
```
┌────────────────────────────────────┐
│ Title                          ╳   │
├────────────────────────────────────┤
│                                    │
│  Form fields                       │
│                                    │
├────────────────────────────────────┤
│           Cancel      Save          │
└────────────────────────────────────┘
```

**Props**:
```typescript
interface FormModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  loading?: boolean;
  children: ReactNode;
  submitLabel?: string;
  cancelLabel?: string;
}
```

**Implementation**:
```tsx
export const FormModal: React.FC<FormModalProps> = ({
  isOpen,
  title,
  onClose,
  onSubmit,
  loading = false,
  children,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        
        <form onSubmit={onSubmit} className="p-6 space-y-4">
          {children}
        </form>

        <div className="flex gap-3 p-6 border-t justify-end">
          <Button variant="outline" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button 
            onClick={onSubmit} 
            loading={loading}
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
```

---

### 3. ConfirmDialog.tsx
**Purpose**: Confirmation dialog for destructive actions  
**Location**: `src/components/UI/ConfirmDialog.tsx`

**Design**:
```
┌────────────────────────────────┐
│ ⚠️  Confirm Action             │
├────────────────────────────────┤
│ Are you sure? This action      │
│ cannot be undone.              │
├────────────────────────────────┤
│    Cancel        Delete         │
└────────────────────────────────┘
```

**Props**:
```typescript
interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  isDangerous?: boolean;
  loading?: boolean;
}
```

---

### 4. TabNavigation.tsx
**Purpose**: Tab switcher for Configuration page  
**Location**: `src/components/UI/TabNavigation.tsx`

**Design**:
```
┌─────────────────────────────────┐
│ Tab 1   Tab 2   Tab 3           │
│ ────                            │
│                                 │
│  Tab 1 content here             │
│                                 │
└─────────────────────────────────┘
```

**Props**:
```typescript
interface Tab {
  id: string;
  label: string;
  icon?: React.ComponentType<IconProps>;
  content: ReactNode;
}

interface TabNavigationProps {
  tabs: Tab[];
  defaultTab?: string;
  onChange?: (tabId: string) => void;
}
```

---

### 5. StatusBadge.tsx
**Purpose**: Status indicator with color coding  
**Location**: `src/components/UI/StatusBadge.tsx`

**Variants**:
- `active` - Green
- `inactive` - Gray
- `pending` - Yellow
- `error` - Red
- `revoked` - Red

**Implementation**:
```tsx
const statusStyles = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  pending: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  revoked: 'bg-red-100 text-red-800',
};

export const StatusBadge: React.FC<{
  status: keyof typeof statusStyles;
  label: string;
}> = ({ status, label }) => (
  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
    statusStyles[status]
  }`}>
    {label}
  </span>
);
```

---

### 6. PricingTable.tsx
**Purpose**: Display pricing matrix with comparison  
**Location**: `src/components/UI/PricingTable.tsx`

**Design**:
```
┌──────────────┬────────┬────────┬────────┐
│ Feature      │ Basic  │ Pro    │ Ent.   │
├──────────────┼────────┼────────┼────────┤
│ Users        │ 5      │ 25     │ ∞      │
│ API Access   │ ✓      │ ✓      │ ✓      │
│ Support      │ Email  │ Chat   │ Phone  │
│ Price/mo     │ $10    │ $50    │ Custom │
└──────────────┴────────┴────────┴────────┘
```

**Props**:
```typescript
interface PricingColumn {
  name: string;
  price: number;
  period: 'month' | 'year';
  highlighted?: boolean;
}

interface PricingRow {
  label: string;
  values: (string | number | boolean)[];
}

interface PricingTableProps {
  columns: PricingColumn[];
  rows: PricingRow[];
}
```

---

### 7. TransactionList.tsx
**Purpose**: Display transaction history  
**Location**: `src/components/UI/TransactionList.tsx`

**Features**:
- Transaction type icons
- Color-coded transaction types
- Amount formatting
- Date formatting
- Expandable detail rows
- Pagination

**Transaction Types**:
- PURCHASE (Green, up arrow)
- USAGE (Red, down arrow)
- BONUS (Purple, gift)
- REFUND (Blue, refresh)
- ADJUSTMENT (Amber, settings)

---

## Page Components

### Dashboard.tsx (Admin)
**Location**: `src/pages/admin/Dashboard.tsx`  
**Route**: `/admin/dashboard`

**Layout**:
```
Header
├── Stats Cards Row
│   ├── Total Workspaces
│   ├── Active Teams
│   ├── Credit Usage
│   └── Pending Transactions
├── Charts Row (if applicable)
│   ├── Usage over time
│   └── Team activity
└── Recent Activity Feed
    ├── Latest transactions
    ├── Workspace creations
    └── Key generations
```

**Implementation Structure**:
```tsx
const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [statsData, activityData] = await Promise.all([
        AdminService.getDashboardStats(),
        AdminService.getActivityFeed(),
      ]);
      setStats(statsData);
      setActivity(activityData);
    } catch (error) {
      // Handle error
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Admin overview" />
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Workspaces" value={stats?.totalWorkspaces} />
        <StatsCard title="Active Teams" value={stats?.activeTeams} />
        <StatsCard title="Credit Usage" value={stats?.creditUsage} />
        <StatsCard title="Transactions" value={stats?.pendingTransactions} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {/* Activity Feed */}
        </div>
        <div>
          {/* Quick Stats */}
        </div>
      </div>
    </div>
  );
};
```

---

### Workspaces.tsx
**Location**: `src/pages/admin/Workspaces.tsx`  
**Route**: `/admin/workspaces`

**Features**:
- Table view with columns: Name, Owner, Created, Status, Actions
- Search bar
- Filter by status
- Pagination
- Create button
- Edit modal
- Delete confirmation

**Table Columns**:
```typescript
columns: [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'owner', header: 'Owner' },
  { accessorKey: 'createdAt', header: 'Created', cell: formatDate },
  { accessorKey: 'status', header: 'Status', cell: StatusBadge },
  { accessorKey: 'actions', header: '', cell: ActionButtons },
]
```

---

### ActivationKeys.tsx
**Location**: `src/pages/admin/ActivationKeys.tsx`  
**Route**: `/admin/activation-keys`

**Features**:
- List of activation keys with status
- Generate new key button
- Copy key to clipboard (with visual feedback)
- Revoke button with confirmation
- Filter by tier
- Search by code or description

**Generate Form**:
```
Title: Generate New Activation Key
Fields:
- Tier (select: PERSONAL, PROFESSIONAL, ENTERPRISE)
- Cloud Sync Allowed (toggle)
- Vault Allowed (toggle)
- Max Agents (optional number)
- Max Users (optional number)
```

---

### SubscriptionPlans.tsx
**Location**: `src/pages/admin/SubscriptionPlans.tsx`  
**Route**: `/admin/subscriptions`

**Features**:
- Comparison table view
- Edit inline or modal
- Features matrix (toggles)
- Pricing input (monthly/annual)
- Activate/deactivate
- Delete with confirmation

**Plan Form Fields**:
```typescript
name: string;
tier: 'BYOE' | 'MANAGED' | 'ENTERPRISE';
priceMonthly: number;
priceAnnually: number;
trialDays: number;
maxKnowledgePages: number;
features: {
  loopbackAPIIncluded: boolean;
  automatedDocSync: boolean;
  dedicatedVectorInfra: boolean;
  onPremiseDeployment: boolean;
  prioritySupport: boolean;
  slaGuarantees: boolean;
};
description: string;
isActive: boolean;
```

---

### Credits.tsx
**Location**: `src/pages/admin/Credits.tsx`  
**Route**: `/admin/credits`

**Layout**:
```
Teams List (left/top)
├── Search bar
├── Filter by balance
├── Table:
│   ├── Team Name
│   ├── Balance
│   ├── Last Transaction
│   └── Actions (view details)

Transaction History (right/bottom)
├── Date range filter
├── Transaction type filter
├── Transaction list:
│   ├── Type (with icon)
│   ├── Amount
│   ├── Description
│   ├── Balance Before/After
│   └── Date/Time
```

**Adjust Modal**:
```
Fields:
- Amount (number)
- Type (select: BONUS, REFUND, ADJUSTMENT)
- Description (textarea)
- Reason (optional)
```

---

### CreditPackages.tsx
**Location**: `src/pages/admin/CreditPackages.tsx`  
**Route**: `/admin/packages`

**View Options**:
1. **Card Grid** (default)
   ```
   ┌──────────────────┐
   │ Package Name     │
   │ 1,000 credits    │
   │ R 149.99         │
   │ + 100 bonus      │
   │                  │
   │ [Edit] [Delete]  │
   └──────────────────┘
   ```

2. **Table View** (alternative)

**Form Fields**:
```
- Package Name
- Description
- Credits (number)
- Price (currency)
- Bonus Credits (number)
- Featured (checkbox)
```

---

### Pricing.tsx
**Location**: `src/pages/admin/Pricing.tsx`  
**Route**: `/admin/pricing`

**Display**:
```
┌─────────────────────┬──────────┬─────────────┐
│ Request Type        │ Base Cost│ Per Token   │
├─────────────────────┼──────────┼─────────────┤
│ Simple Text         │ R 0.50   │ R 0.0001    │
│ Chat (Full)         │ R 1.00   │ R 0.0002    │
│ Code Agent          │ R 2.00   │ R 0.0003    │
│ File Operation      │ R 0.75   │ -           │
│ MCP Tool            │ R 1.50   │ -           │
└─────────────────────┴──────────┴─────────────┘
```

**Edit Modal**:
```
Fields:
- Base Cost (number with R currency)
- Per Token Cost (optional)
```

---

### Configuration.tsx
**Location**: `src/pages/admin/Configuration.tsx`  
**Route**: `/admin/config`

**Tab Structure**:

#### Tab 1: Payment Gateways
```
Stripe
├── API Key (masked input with show/hide)
├── Status (toggle)
├── Test Mode (checkbox)

PayPal
├── Client ID (masked input)
├── Secret (masked input)
├── Status (toggle)
```

#### Tab 2: AI Providers
```
OpenAI
├── API Key (masked input)
├── Model (select)
├── Status (toggle)
├── Rate Limits (info)

Anthropic
├── API Key (masked input)
├── Model (select)
├── Status (toggle)
```

#### Tab 3: System
```
Site Settings
├── Site Name
├── Base URL
├── Support Email

Email Configuration
├── SMTP Host
├── SMTP Port
├── From Email
├── Reply-To Email
```

---

## Data Visualization

### Chart Components (if needed)

**Dependencies**: Consider using:
- **Recharts** (lightweight, React-friendly)
- **Chart.js** (popular, extensive)

**Common Charts**:
1. **Line Chart** - Usage over time
2. **Bar Chart** - Credits by team
3. **Pie Chart** - Distribution by type
4. **Area Chart** - Trend visualization

**Example - Usage Trend**:
```tsx
<ResponsiveContainer width="100%" height={300}>
  <LineChart data={usageData}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="date" />
    <YAxis />
    <Tooltip />
    <Legend />
    <Line type="monotone" dataKey="usage" stroke="#3B82F6" />
  </LineChart>
</ResponsiveContainer>
```

---

## Forms & Modals

### Form Patterns

#### Pattern 1: Simple CRUD Modal
```tsx
const [showModal, setShowModal] = useState(false);
const [formData, setFormData] = useState<FormData>(initialData);
const [loading, setLoading] = useState(false);

const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();
  try {
    setLoading(true);
    if (editingId) {
      await AdminService.update(editingId, formData);
    } else {
      await AdminService.create(formData);
    }
    setShowModal(false);
    // Refresh list
  } catch (error) {
    // Show error
  } finally {
    setLoading(false);
  }
};
```

#### Pattern 2: Inline Edit
```tsx
const [editingId, setEditingId] = useState<string | null>(null);
const [editValue, setEditValue] = useState('');

const handleInlineEdit = async (id: string, field: string, value: any) => {
  try {
    await AdminService.updateField(id, field, value);
    setEditingId(null);
  } catch (error) {
    // Show error
  }
};
```

#### Pattern 3: Multi-step Form
```tsx
const [step, setStep] = useState(1);
const [formData, setFormData] = useState<MultiStepFormData>({});

const nextStep = () => {
  if (validateStep(step)) {
    setStep(step + 1);
  }
};

const prevStep = () => setStep(step - 1);
```

---

## API Service Layer

### AdminService.ts
**Location**: `src/services/adminService.ts`

```typescript
// Dashboard
export const getDashboardStats = () => 
  api.get<AdminDashboardStats>('/admin/dashboard/stats');

export const getActivityFeed = () => 
  api.get<ActivityEvent[]>('/admin/dashboard/activity');

// Workspaces
export const getWorkspaces = (params?: PaginationParams) =>
  api.get<PaginatedResponse<Workspace>>('/admin/workspaces', { params });

export const getWorkspace = (id: string) =>
  api.get<Workspace>(`/admin/workspaces/${id}`);

export const createWorkspace = (data: Partial<Workspace>) =>
  api.post<Workspace>('/admin/workspaces', data);

export const updateWorkspace = (id: string, data: Partial<Workspace>) =>
  api.put<Workspace>(`/admin/workspaces/${id}`, data);

export const deleteWorkspace = (id: string) =>
  api.delete(`/admin/workspaces/${id}`);

// Activation Keys
export const getActivationKeys = () =>
  api.get<ActivationKey[]>('/admin/activation-keys');

export const generateActivationKey = (data: KeyGenerationData) =>
  api.post<ActivationKey>('/admin/activation-keys', data);

export const revokeActivationKey = (id: string) =>
  api.delete(`/admin/activation-keys/${id}`);

// ... Similar patterns for other resources
```

---

## Types & Interfaces

### Admin Types
**Location**: `src/types/admin.ts`

```typescript
// Dashboard
export interface AdminDashboardStats {
  totalWorkspaces: number;
  activeTeams: number;
  creditUsage: number;
  pendingTransactions: number;
}

export interface ActivityEvent {
  id: string;
  type: 'workspace_created' | 'key_generated' | 'credits_adjusted' | 'plan_updated';
  description: string;
  createdAt: string;
  actor?: string;
}

// Workspaces
export interface Workspace {
  id: string;
  name: string;
  description?: string;
  ownerId?: string;
  owner?: { name: string; email: string };
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'inactive' | 'archived';
  memberCount?: number;
}

// Activation Keys
export interface ActivationKey {
  id: string;
  code: string;
  tier: 'PERSONAL' | 'PROFESSIONAL' | 'ENTERPRISE';
  features: {
    cloudSync: boolean;
    vault: boolean;
  };
  limits: {
    maxAgents?: number;
    maxUsers?: number;
  };
  createdAt: string;
  revokedAt?: string;
  status: 'active' | 'revoked';
  usageStats?: {
    activations: number;
    lastUsed: string;
  };
}

// Credit Transactions
export interface CreditTransaction {
  id: string;
  teamId: string;
  amount: number;
  type: 'PURCHASE' | 'USAGE' | 'BONUS' | 'REFUND' | 'ADJUSTMENT';
  description: string;
  createdAt: string;
  balanceBefore: number;
  balanceAfter: number;
  actor?: string;
}

// Subscription Plans
export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: 'BYOE' | 'MANAGED' | 'ENTERPRISE';
  pricing: {
    monthly: number;
    annually: number;
  };
  features: {
    maxKnowledgePages: number;
    loopbackAPIIncluded: boolean;
    automatedDocSync: boolean;
    dedicatedVectorInfra: boolean;
    onPremiseDeployment: boolean;
    prioritySupport: boolean;
    slaGuarantees: boolean;
  };
  trialDays: number;
  description: string;
  isActive: boolean;
  createdAt: string;
}

// Credit Packages
export interface CreditPackage {
  id: string;
  name: string;
  description?: string;
  credits: number;
  price: number; // in cents
  bonusCredits: number;
  featured: boolean;
  createdAt?: string;
}

// Pricing Rules
export interface PricingRule {
  type: string;
  baseCost: number;
  perTokenCost?: number;
  lastUpdated: string;
}

// Pagination
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}
```

---

## Styling Guidelines

### Admin Page Base Template
```tsx
<div className="space-y-6 p-6 bg-gray-50 min-h-screen">
  {/* Header Section */}
  <div className="bg-gradient-to-r from-picton-blue-500 to-picton-blue-600 
                  rounded-lg p-6 text-white shadow-lg">
    <h1 className="text-3xl font-bold">{title}</h1>
    <p className="text-white/90 mt-2">{description}</p>
  </div>

  {/* Filter/Action Bar */}
  <div className="bg-white rounded-lg shadow p-4 flex gap-4 items-center">
    <Input placeholder="Search..." className="flex-1" />
    <Button>Filters</Button>
    <Button variant="primary">+ Create</Button>
  </div>

  {/* Content Area */}
  <div className="bg-white rounded-lg shadow overflow-hidden">
    {/* Data table or content */}
  </div>
</div>
```

### Responsive Breakpoints
```
sm: 640px   - Mobile
md: 768px   - Tablet
lg: 1024px  - Desktop
xl: 1280px  - Wide Desktop
```

### Animation Classes
```css
/* Fade in */
.animate-fade-in {
  animation: fadeIn 0.3s ease-in;
}

/* Slide up */
.animate-slide-up {
  animation: slideUp 0.3s ease-out;
}
```

---

## Error Handling

### Error Boundary Component
```tsx
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export const ErrorBoundary: React.FC<ErrorBoundaryProps> = ({ 
  children, 
  fallback 
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const handleError = () => setHasError(true);
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return fallback || <ErrorFallback onReset={() => setHasError(false)} />;
  }

  return children;
};
```

### Toast Notifications
```tsx
// Success
Swal.fire({
  icon: 'success',
  title: 'Success',
  text: 'Operation completed successfully',
  timer: 3000
});

// Error
Swal.fire({
  icon: 'error',
  title: 'Error',
  text: 'Operation failed: ' + error.message
});
```

---

## Performance Optimization

### Data Fetching Best Practices

1. **Pagination**
```tsx
const [page, setPage] = useState(0);
const limit = 20;

const loadData = useCallback(async () => {
  const data = await api.get('/resource', {
    params: { page, limit }
  });
  setData(data);
}, [page]);
```

2. **Lazy Loading**
```tsx
const loadMoreItems = useCallback(() => {
  setPage(prev => prev + 1);
}, []);
```

3. **Memoization**
```tsx
const memoizedValue = useMemo(() => 
  expensiveComputation(data), 
  [data]
);
```

4. **Debouncing Search**
```tsx
const debouncedSearch = useCallback(
  debounce((query: string) => {
    fetchResults(query);
  }, 300),
  []
);
```

---

## Testing Approach

### Unit Tests (Jest + React Testing Library)
```tsx
describe('AdminDashboard', () => {
  it('loads and displays stats', async () => {
    const { getByText } = render(<AdminDashboard />);
    await waitFor(() => {
      expect(getByText(/Total Workspaces/)).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    // Mock API error
    // Assert error message displayed
  });
});
```

### Component Tests
```tsx
describe('StatsCard', () => {
  it('renders with title and value', () => {
    const { getByText } = render(
      <StatsCard title="Test" value={100} />
    );
    expect(getByText('Test')).toBeInTheDocument();
    expect(getByText('100')).toBeInTheDocument();
  });
});
```

---

## Accessibility Requirements

- [ ] All interactive elements keyboard accessible
- [ ] Proper ARIA labels on buttons and inputs
- [ ] Color not sole indicator of status
- [ ] Sufficient color contrast (WCAG AA)
- [ ] Focus indicators visible
- [ ] Form error messages associated with inputs
- [ ] Data tables have proper header associations

---

**Document prepared by**: Development Team  
**Last Updated**: March 1, 2026  
**Status**: Ready for Component Development
