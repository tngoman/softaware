import React, { ReactNode, useEffect, useState } from 'react';
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
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../store';
import { AuthModel } from '../../models';
import AppSettingsModel from '../../models/AppSettingsModel';
import Can from '../Can';
import { getApiBaseUrl, getAssetUrl } from '../../config/app';
import NotificationDropdown from '../Notifications/NotificationDropdown';
import UserAccountMenu from '../User/UserAccountMenu';

interface LayoutProps {
  children: ReactNode;
}

// ─── Navigation item ─────────────────────────────────────────────────────
interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
}

// ─── Collapsible section ─────────────────────────────────────────────────
interface NavSection {
  label: string;
  permission?: string;
  anyPermission?: string[];
  items: NavItem[];
  defaultOpen?: boolean;
  color?: string;
}

const navSections: NavSection[] = [
  {
    label: 'Main',
    defaultOpen: true,
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
      { name: 'Tasks', href: '/tasks', icon: ClipboardDocumentCheckIcon },
      { name: 'Software', href: '/software', icon: CubeIcon },
      { name: 'Updates', href: '/updates', icon: ArrowPathIcon },
      { name: 'Groups', href: '/groups', icon: ChatBubbleLeftRightIcon },
    ],
  },
  {
    label: 'Billing & Finance',
    defaultOpen: false,
    anyPermission: ['dashboard.view', 'invoices.view', 'quotations.view', 'transactions.view', 'contacts.view'],
    items: [
      { name: 'Financial Dashboard', href: '/financial-dashboard', icon: CurrencyDollarIcon, permission: 'dashboard.view' },
      { name: 'Invoices', href: '/invoices', icon: DocumentDuplicateIcon, permission: 'invoices.view' },
      { name: 'Quotations', href: '/quotations', icon: DocumentTextIcon, permission: 'quotations.view' },
      { name: 'Transactions', href: '/transactions', icon: BanknotesIcon, permission: 'transactions.view' },
      { name: 'Contacts', href: '/contacts', icon: UsersIcon, permission: 'contacts.view' },
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
    label: 'Catalog',
    defaultOpen: false,
    anyPermission: ['pricing.view', 'categories.view'],
    items: [
      { name: 'Pricing', href: '/pricing', icon: ArchiveBoxIcon, permission: 'pricing.view' },
      { name: 'Categories', href: '/categories', icon: TagIcon, permission: 'categories.view' },
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
      { name: 'Credentials', href: '/credentials', icon: KeyIcon, permission: 'credentials.view' },
      { name: 'System Settings', href: '/system/settings', icon: AdjustmentsHorizontalIcon, permission: 'settings.view' },
    ],
  },
  {
    label: 'Development',
    defaultOpen: false,
    color: 'purple',
    anyPermission: ['settings.view'],
    items: [
      { name: 'Database', href: '/database', icon: CircleStackIcon, permission: 'settings.view' },
    ],
  },
];

// ─── Sidebar Section Component ───────────────────────────────────────────
const SidebarSection: React.FC<{
  section: NavSection;
  pathname: string;
}> = ({ section, pathname }) => {
  const [isOpen, setIsOpen] = useState(section.defaultOpen ?? false);

  // Auto-open section if current path matches any item
  useEffect(() => {
    const hasActive = section.items.some(
      (item) => pathname === item.href || pathname.startsWith(item.href + '/')
    );
    if (hasActive) setIsOpen(true);
  }, [pathname, section.items]);

  const isPurple = section.color === 'purple';

  const sectionContent = (
    <div className="mb-1">
      {/* Section header (collapsible toggle) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
      >
        <span>{section.label}</span>
        {isOpen ? (
          <ChevronDownIcon className="h-3.5 w-3.5 text-gray-400" />
        ) : (
          <ChevronRightIcon className="h-3.5 w-3.5 text-gray-400" />
        )}
      </button>

      {/* Items (slide-open) */}
      {isOpen && (
        <div className="space-y-0.5 mt-0.5">
          {section.items.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'));

            const link = (
              <Link
                key={item.name}
                to={item.href}
                className={`${
                  isActive
                    ? isPurple
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-picton-blue text-white shadow-sm'
                    : isPurple
                      ? 'text-gray-700 hover:bg-purple-50 hover:text-purple-900'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                } group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200`}
              >
                <item.icon
                  className={`${
                    isActive
                      ? 'text-white'
                      : isPurple
                        ? 'text-purple-500 group-hover:text-purple-700'
                        : 'text-gray-500 group-hover:text-gray-700'
                  } mr-3 h-5 w-5 flex-shrink-0`}
                />
                {item.name}
              </Link>
            );

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
  const { user, logout } = useAppStore();
  const [siteLogo, setSiteLogo] = useState<string>('');
  const [siteName, setSiteName] = useState<string>('');

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
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col">
        <div className="flex min-h-0 flex-1 flex-col bg-white border-r border-gray-200 shadow-sm">
          <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
            {/* Logo */}
            <div className="flex flex-shrink-0 items-center px-4 pb-4 border-b border-gray-200">
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
                <span className="text-xl font-bold text-gray-900">
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
                />
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top header */}
        <header className="bg-white shadow-md border-b-2 border-picton-blue/20">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <h2 className="text-xl font-bold text-gray-900">
              {resolveTitle()}
            </h2>
            <div className="flex items-center space-x-3">
              <NotificationDropdown />
              <UserAccountMenu
                user={user!}
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
