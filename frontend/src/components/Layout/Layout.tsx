import React, { ReactNode, useEffect, useState, useCallback, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  HomeIcon,
  DocumentTextIcon,
  DocumentDuplicateIcon,
  UsersIcon,
  CogIcon,
  ChartBarIcon,
  ArchiveBoxIcon,
  TagIcon,
  BanknotesIcon,
  ClipboardDocumentListIcon,
  KeyIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  AdjustmentsHorizontalIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CurrencyDollarIcon,
  PresentationChartLineIcon,
  CubeIcon,
  ClipboardDocumentCheckIcon,
  ArrowPathIcon,
  ChatBubbleLeftRightIcon,
  CircleStackIcon,
  SparklesIcon,
  SignalIcon,
  GlobeAltIcon,
  CpuChipIcon,
  ArrowUturnLeftIcon,
  EyeIcon,
  FlagIcon,
  EnvelopeIcon,
  BugAntIcon,
  CalendarIcon,
  CommandLineIcon,
  ServerStackIcon,
  PaintBrushIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../store';
import { usePermissions } from '../../hooks/usePermissions';
import { AuthModel } from '../../models';
import { WebmailModel } from '../../models/WebmailModel';
import AppSettingsModel from '../../models/AppSettingsModel';
import Can from '../Can';
import { getApiBaseUrl, getAssetUrl } from '../../config/app';
import NotificationDropdown from '../Notifications/NotificationDropdown';
import UserAccountMenu from '../User/UserAccountMenu';
import GlobalCallProvider from '../CallProvider/GlobalCallProvider';
import ThemeToggle from '../UI/ThemeToggle';

interface LayoutProps {
  children: ReactNode;
}

// ─── Navigation item ─────────────────────────────────────────────────────
interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  roleSlug?: string;    // If set, item only shows for users with this role (or admin)
  roleSlugs?: string[]; // If set, item only shows for users with one of these roles (or admin)
  adminOnly?: boolean;  // If true, item only shows for admin/staff users
  badgeKey?: string;    // Key to look up dynamic badge count
}

// ─── Collapsible section ─────────────────────────────────────────────────
interface NavSection {
  label: string;
  permission?: string;
  anyPermission?: string[];
  roleSlugs?: string[];  // If set, section only shows for users with one of these roles (admin bypass disabled)
  items: NavItem[];
  defaultOpen?: boolean;
  color?: string;
  adminOnly?: boolean; // If true, entire section only shows for admin/staff users
}

const navSections: NavSection[] = [
  {
    label: 'Main',
    defaultOpen: true,
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
      { name: 'Tasks', href: '/tasks', icon: ClipboardDocumentCheckIcon },
      { name: 'Bugs', href: '/bugs', icon: BugAntIcon },
      { name: 'Groups', href: '/groups', icon: ChatBubbleLeftRightIcon },
      { name: 'Chat', href: '/chat', icon: ChatBubbleLeftRightIcon },
      { name: 'Webmail', href: '/webmail', icon: EnvelopeIcon, badgeKey: 'webmail-unread' },
      { name: 'Planning', href: '/planning', icon: CalendarIcon },
    ],
  },
  {
    label: 'AI & Enterprise',
    defaultOpen: false,
    color: 'purple',
    adminOnly: true,
    items: [
      { name: 'AI Overview', href: '/admin/ai', icon: SparklesIcon, adminOnly: true },
      { name: 'Client Manager', href: '/admin/clients', icon: UsersIcon, adminOnly: true },
      { name: 'AI Packages', href: '/admin/packages', icon: CubeIcon, adminOnly: true },
      { name: 'Enterprise Endpoints', href: '/admin/enterprise', icon: SignalIcon, adminOnly: true },
      { name: 'Client API Gateway', href: '/admin/client-api', icon: ServerStackIcon, adminOnly: true },
      { name: 'Sites', href: '/admin/sites', icon: GlobeAltIcon, adminOnly: true },
      { name: 'Studio', href: '/studio', icon: PaintBrushIcon, adminOnly: true },
    ],
  },
  {
    label: 'Case Management',
    defaultOpen: false,
    color: 'red',
    items: [
      { name: 'Dashboard', href: '/cases/dashboard', icon: ChartBarIcon },
      { name: 'My Cases', href: '/cases', icon: FlagIcon },
      { name: 'All Cases', href: '/admin/cases', icon: FlagIcon, adminOnly: true },
    ],
  },
  {
    label: 'Catalog',
    defaultOpen: false,
    anyPermission: ['pricing.view', 'categories.view'],
    items: [
      { name: 'Pricing', href: '/pricing', icon: ArchiveBoxIcon, permission: 'pricing.view' },
      { name: 'Categories', href: '/categories', icon: TagIcon, permission: 'categories.view' },
    ],
  },
  {
    label: 'Billing & Finance',
    defaultOpen: false,
    anyPermission: ['dashboard.view', 'invoices.view', 'quotations.view', 'transactions.view'],
    items: [
      { name: 'Financial Dashboard', href: '/financial-dashboard', icon: CurrencyDollarIcon, permission: 'dashboard.view' },
      { name: 'Invoices', href: '/invoices', icon: DocumentDuplicateIcon, permission: 'invoices.view' },
      { name: 'Quotations', href: '/quotations', icon: DocumentTextIcon, permission: 'quotations.view' },
      { name: 'Credit Notes', href: '/credit-notes', icon: DocumentDuplicateIcon, permission: 'invoices.view' },
      { name: 'Purchase Orders', href: '/purchase-orders', icon: ClipboardDocumentCheckIcon, permission: 'invoices.view' },
      { name: 'Transactions', href: '/transactions', icon: BanknotesIcon, permission: 'transactions.view' },
      { name: 'Payroll', href: '/admin/payroll', icon: BanknotesIcon, adminOnly: true },
    ],
  },
  {
    label: 'Reports',
    defaultOpen: false,
    anyPermission: ['reports.view'],
    items: [
      { name: 'Balance Sheet', href: '/reports/balance-sheet', icon: ClipboardDocumentListIcon, permission: 'reports.view' },
      { name: 'Profit & Loss', href: '/reports/profit-loss', icon: ChartBarIcon, permission: 'reports.view' },
      { name: 'Transaction Listing', href: '/reports/transaction-listing', icon: DocumentTextIcon, permission: 'reports.view' },
      { name: 'VAT Reports', href: '/vat-reports', icon: PresentationChartLineIcon, permission: 'reports.view' },
    ],
  },
  {
    label: 'Settings',
    defaultOpen: false,
    anyPermission: ['settings.view'],
    items: [
      { name: 'Company Settings', href: '/settings', icon: CogIcon, permission: 'settings.view' },
    ],
  },
  {
    label: 'System Management',
    defaultOpen: false,
    color: 'purple',
    anyPermission: ['users.view', 'roles.view', 'permissions.view', 'credentials.view', 'settings.view'],
    items: [
      { name: 'Users', href: '/system/users', icon: UsersIcon, permission: 'users.view' },
      { name: 'Roles', href: '/system/roles', icon: UserGroupIcon, permission: 'roles.view' },
      { name: 'Permissions', href: '/system/permissions', icon: ShieldCheckIcon, permission: 'permissions.view' },
      { name: 'Credentials', href: '/credentials', icon: KeyIcon, adminOnly: true },
      { name: 'System Settings', href: '/system/settings', icon: AdjustmentsHorizontalIcon, permission: 'settings.view' },
      { name: 'Audit Log', href: '/admin/audit-log', icon: ClipboardDocumentListIcon, adminOnly: true },
    ],
  },
  {
    label: 'Development',
    defaultOpen: false,
    color: 'purple',
    roleSlugs: ['developer', 'qa_specialist'],
    items: [
      { name: 'Software', href: '/software', icon: CubeIcon, roleSlugs: ['developer', 'qa_specialist'] },
      { name: 'Updates', href: '/updates', icon: ArrowPathIcon, roleSlugs: ['developer', 'qa_specialist'] },
      { name: 'Client Monitor', href: '/client-monitor', icon: SignalIcon, adminOnly: true },
      { name: 'Error Reports', href: '/error-reports', icon: BugAntIcon, roleSlugs: ['developer', 'qa_specialist'] },
      { name: 'Source Control', href: '/source-control', icon: CommandLineIcon, permission: 'settings.view', roleSlug: 'developer' },
      { name: 'Database', href: '/database', icon: CircleStackIcon, roleSlug: 'developer' },
    ],
  },
];

// ─── Sidebar Section Component ───────────────────────────────────────────
const SidebarSection: React.FC<{
  section: NavSection;
  pathname: string;
  badgeCounts?: Record<string, number>;
}> = ({ section, pathname, badgeCounts = {} }) => {
  const { user } = useAppStore();
  const { isStrictAdmin } = usePermissions();
  const [isOpen, setIsOpen] = useState(section.defaultOpen ?? false);

  // Auto-open section if current path matches any item
  useEffect(() => {
    const hasActive = section.items.some(
      (item) => pathname === item.href || pathname.startsWith(item.href + '/')
    );
    if (hasActive) setIsOpen(true);
  }, [pathname, section.items]);

  // Hide entire section from non-admin users if section is admin-only
  if (section.adminOnly && !isStrictAdmin()) return null;

  // Hide section if roleSlugs specified and user doesn't have one of the required roles
  if (section.roleSlugs) {
    const userRoleSlug = user?.role?.slug || '';
    const userRoleSlugs = user?.roles?.map(r => r.slug) || [];
    const hasRole = section.roleSlugs.some(s => s === userRoleSlug || userRoleSlugs.includes(s));
    if (!hasRole) return null;
  }

  const isPurple = section.color === 'purple';
  const isRed = section.color === 'red';

  const sectionContent = (
    <div className="mb-1">
      {/* Section header (collapsible toggle) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
      >
        <span>{section.label}</span>
        {isOpen ? (
          <ChevronDownIcon className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
        ) : (
          <ChevronRightIcon className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
        )}
      </button>

      {/* Items (slide-open) */}
      {isOpen && (
        <div className="space-y-0.5 mt-0.5">
          {section.items.map((item) => {
            // Exact match for dashboard and cases to avoid false positives
            const isExactMatch = pathname === item.href;
            const isSubPath = item.href !== '/dashboard' && 
                              item.href !== '/cases' && 
                              pathname.startsWith(item.href + '/');
            const isActive = isExactMatch || isSubPath;

            const link = (
              <Link
                key={item.name}
                to={item.href}
                className={`${
                  isActive
                    ? isPurple
                      ? 'bg-purple-600 text-white shadow-sm'
                      : isRed
                        ? 'bg-red-500 text-white shadow-sm'
                        : 'bg-picton-blue text-white shadow-sm'
                    : isPurple
                      ? 'text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-900 dark:hover:text-purple-300'
                      : isRed
                        ? 'text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-900 dark:hover:text-red-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 hover:text-gray-900 dark:hover:text-gray-100'
                } group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200`}
              >
                <item.icon
                  className={`${
                    isActive
                      ? 'text-white'
                      : isPurple
                        ? 'text-purple-500 group-hover:text-purple-700 dark:text-purple-400 dark:group-hover:text-purple-300'
                        : isRed
                          ? 'text-red-500 group-hover:text-red-700 dark:text-red-400 dark:group-hover:text-red-300'
                          : 'text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-200'
                  } mr-3 h-5 w-5 flex-shrink-0`}
                />
                <span className="flex-1">{item.name}</span>
                {item.badgeKey && (badgeCounts[item.badgeKey] ?? 0) > 0 && (
                  <span className={`ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold rounded-full ${
                    isActive
                      ? 'bg-white/25 text-white'
                      : 'bg-red-500 text-white'
                  }`}>
                    {(badgeCounts[item.badgeKey] ?? 0) > 99 ? '99+' : badgeCounts[item.badgeKey]}
                  </span>
                )}
              </Link>
            );

            // Hide admin-only items from non-admin users
            if (item.adminOnly && !isStrictAdmin()) return null;

            // Check roleSlug (singular) - legacy
            if (item.roleSlug) {
              const userRoleSlug = user?.role?.slug || '';
              const userRoleSlugs = user?.roles?.map(r => r.slug) || [];
              const hasRole = user?.is_admin || userRoleSlug === item.roleSlug || userRoleSlugs.includes(item.roleSlug);
              if (!hasRole) return null;
            }

            // Check roleSlugs (plural) - new pattern
            if (item.roleSlugs) {
              const userRoleSlug = user?.role?.slug || '';
              const userRoleSlugs = user?.roles?.map(r => r.slug) || [];
              const hasRole = user?.is_admin || item.roleSlugs.some(s => s === userRoleSlug || userRoleSlugs.includes(s));
              if (!hasRole) return null;
            }

            if (item.permission) {
              return (
                <Can key={item.name} permission={item.permission}>
                  {link}
                </Can>
              );
            }
            return <React.Fragment key={item.name}>{link}</React.Fragment>;
          })}
        </div>
      )}
    </div>
  );

  // Wrap section with permission gate
  if (section.anyPermission) {
    return (
      <Can anyPermission={section.anyPermission}>
        {sectionContent}
      </Can>
    );
  }
  if (section.permission) {
    return (
      <Can permission={section.permission}>
        {sectionContent}
      </Can>
    );
  }
  return sectionContent;
};

// ─── Flat list for title resolution ──────────────────────────────────────
const allNavItems = navSections.flatMap((s) => s.items);

// ─── Layout Component ────────────────────────────────────────────────────
const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, setUser, setIsAuthenticated } = useAppStore();
  const [siteLogo, setSiteLogo] = useState<string>('');
  const [siteName, setSiteName] = useState<string>('');
  const [isMasquerading, setIsMasquerading] = useState(false);
  const [exitingMasquerade, setExitingMasquerade] = useState(false);
  const [badgeCounts, setBadgeCounts] = useState<Record<string, number>>({});
  const unreadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll webmail unread count every 2 minutes
  const fetchUnreadCount = useCallback(async () => {
    try {
      const result = await WebmailModel.getUnreadCount();
      setBadgeCounts(prev => ({ ...prev, 'webmail-unread': result.total }));
    } catch {
      // Silently ignore — user may not have mailboxes configured
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    unreadTimerRef.current = setInterval(fetchUnreadCount, 120_000); // 2 min
    return () => {
      if (unreadTimerRef.current) clearInterval(unreadTimerRef.current);
    };
  }, [fetchUnreadCount]);

  // Check masquerade state on mount and user changes
  useEffect(() => {
    setIsMasquerading(AuthModel.isMasquerading());
  }, [user]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await AppSettingsModel.get();
      const baseUrl = settings.site_base_url || getApiBaseUrl();

      if (settings.site_logo) {
        setSiteLogo(getAssetUrl(`/assets/images/${settings.site_logo}`));
      }
      if (settings.site_name) {
        setSiteName(settings.site_name);
      }
      if (settings.site_icon) {
        const favicon = document.querySelector("link[rel='icon']") as HTMLLinkElement;
        if (favicon) {
          favicon.href = `${baseUrl}/assets/images/${settings.site_icon}`;
        } else {
          const newFavicon = document.createElement('link');
          newFavicon.rel = 'icon';
          newFavicon.href = `${baseUrl}/assets/images/${settings.site_icon}`;
          document.head.appendChild(newFavicon);
        }
      }
      if (settings.site_name) {
        document.title = settings.site_title || settings.site_name;
      }

      const brandingCache = {
        logoUrl: settings.site_logo ? `${baseUrl}/assets/images/${settings.site_logo}` : '',
        name: settings.site_name || 'Soft Aware',
        description: settings.site_description || 'Sign in to continue.',
      };
      localStorage.setItem('app_branding', JSON.stringify(brandingCache));
    } catch (error) {
      console.error('Failed to load settings:', error);
      localStorage.removeItem('app_branding');
    }
  };

  const handleLogout = async () => {
    try {
      await AuthModel.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      AuthModel.clearAuth();
      logout();
      navigate('/login');
    }
  };

  const handleExitMasquerade = async () => {
    setExitingMasquerade(true);
    try {
      const { token, user: adminUser } = await AuthModel.exitMasquerade();

      // Fetch fresh permissions for admin
      try {
        const permissions = await AuthModel.getUserPermissions();
        adminUser.permissions = permissions;
        AuthModel.storeAuth(token, adminUser);
      } catch {
        adminUser.permissions = [];
      }

      setUser(adminUser);
      setIsAuthenticated(true);
      setIsMasquerading(false);

      navigate('/admin/clients');
    } catch (error) {
      console.error('Exit masquerade error:', error);
      // If restore fails, force full logout
      AuthModel.clearAuth();
      logout();
      navigate('/login');
    } finally {
      setExitingMasquerade(false);
    }
  };

  const resolveTitle = (): string => {
    const path = location.pathname;
    const exact = allNavItems.find((i) => i.href === path);
    if (exact) return exact.name;
    const prefix = allNavItems.find(
      (i) => i.href !== '/dashboard' && path.startsWith(i.href + '/')
    );
    if (prefix) return prefix.name;
    if (path.startsWith('/notifications')) return 'Notifications';
    if (path.startsWith('/profile')) return 'Profile';
    if (path.startsWith('/account-settings')) return 'Account Settings';
    if (path.startsWith('/financial-dashboard')) return 'Financial Dashboard';
    return 'Dashboard';
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-dark-900">
      {/* Global incoming-call listener (persists across pages) */}
      <GlobalCallProvider />
      {/* Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col">
        <div className="flex min-h-0 flex-1 flex-col bg-white dark:bg-dark-850 border-r border-gray-200 dark:border-dark-700 shadow-sm">
          <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
            {/* Logo */}
            <div className="flex flex-shrink-0 items-center px-4 pb-4 border-b border-gray-200 dark:border-dark-700">
              {siteLogo ? (
                <img
                  src={siteLogo}
                  alt={siteName || 'Logo'}
                  className="h-10 w-auto"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/images/logo_small.png';
                  }}
                />
              ) : (
                <span className="text-xl font-bold text-gray-900 dark:text-white">
                  {siteName || 'Soft Aware'}
                </span>
              )}
            </div>

            {/* Navigation sections */}
            <nav className="mt-4 flex-1 space-y-1 px-3">
              {navSections.map((section) => (
                <SidebarSection
                  key={section.label}
                  section={section}
                  pathname={location.pathname}
                  badgeCounts={badgeCounts}
                />
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Masquerade Banner */}
        {isMasquerading && (
          <div className="bg-purple-600 text-white px-4 py-2 flex items-center justify-between shadow-md z-50">
            <div className="flex items-center gap-2">
              <EyeIcon className="w-5 h-5 text-purple-200" />
              <span className="text-sm font-medium">
                You are viewing as <strong>{user?.email || 'another user'}</strong>
              </span>
              <span className="text-xs text-purple-200 ml-1">(masquerade mode)</span>
            </div>
            <button
              onClick={handleExitMasquerade}
              disabled={exitingMasquerade}
              className="flex items-center gap-1.5 px-3 py-1 text-sm font-medium rounded-lg bg-white/20 hover:bg-white/30 text-white border border-white/30 transition-colors disabled:opacity-50"
            >
              {exitingMasquerade ? (
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowUturnLeftIcon className="w-4 h-4" />
              )}
              Return to Admin
            </button>
          </div>
        )}

        {/* Top header */}
        <header className="bg-white dark:bg-dark-850 shadow-md border-b-2 border-picton-blue/20 dark:border-primary-700/30">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {resolveTitle()}
            </h2>
            <div className="flex items-center space-x-3">
              <ThemeToggle />
              <NotificationDropdown />
              <UserAccountMenu
                user={user}
                onLogout={handleLogout}
              />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
