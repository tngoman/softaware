import React, { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  HomeIcon,
  SparklesIcon,
  GlobeAltIcon,
  CogIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  Bars3Icon,
  XMarkIcon,
  EyeIcon,
  ArrowUturnLeftIcon,
  ArrowPathIcon,
  PlusIcon,
  ServerStackIcon,
  RocketLaunchIcon,
  ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../store';
import { AuthModel } from '../../models';
import { useAppSettings } from '../../hooks/useAppSettings';
import { useTierLimits } from '../../hooks/useTierLimits';
import { useProducts } from '../../hooks/useProducts';
import NotificationDropdown from '../Notifications/NotificationDropdown';
import UserAccountMenu from '../User/UserAccountMenu';
import GlobalCallProvider from '../CallProvider/GlobalCallProvider';
import ThemeToggle from '../UI/ThemeToggle';

interface PortalLayoutProps {
  children: ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  label: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

function buildNavSections(products: { ai_assistant: boolean; api_gateway: boolean }): NavSection[] {
  const sections: NavSection[] = [
    {
      label: 'Overview',
      defaultOpen: true,
      items: [
        { name: 'Dashboard', href: '/portal', icon: HomeIcon },
      ],
    },
  ];

  if (products.ai_assistant) {
    sections.push(
      {
        label: 'AI & Automation',
        defaultOpen: true,
        items: [
          { name: 'My Assistants', href: '/portal/assistants', icon: SparklesIcon },
          { name: 'Knowledge Base', href: '/portal/knowledge', icon: ServerStackIcon },
        ],
      },
      {
        label: 'Web Presence',
        defaultOpen: true,
        items: [
          { name: 'Websites', href: '/portal/sites', icon: GlobeAltIcon },
        ],
      },
    );
  }

  if (products.api_gateway) {
    sections.push({
      label: 'API Gateway',
      defaultOpen: true,
      items: [
        { name: 'My Gateways', href: '/portal/gateways', icon: ArrowsRightLeftIcon },
        // Gateway-only users get assistants here instead of under AI & Automation
        ...(!products.ai_assistant ? [{ name: 'My Assistants', href: '/portal/assistants', icon: SparklesIcon }] : []),
      ],
    });
  }

  sections.push({
    label: 'Account',
    defaultOpen: false,
    items: [
      { name: 'Settings', href: '/portal/settings', icon: CogIcon },
    ],
  });

  return sections;
}

const SidebarSection: React.FC<{ section: NavSection; pathname: string }> = ({
  section,
  pathname,
}) => {
  const [isOpen, setIsOpen] = useState(section.defaultOpen ?? false);

  useEffect(() => {
    const hasActive = section.items.some(
      (item) => pathname === item.href || pathname.startsWith(item.href + '/')
    );
    if (hasActive) setIsOpen(true);
  }, [pathname, section.items]);

  return (
    <div className="mb-1">
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
      {isOpen && (
        <div className="space-y-0.5 mt-0.5">
          {section.items.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/portal' && pathname.startsWith(item.href + '/'));

            return (
              <Link
                key={item.name}
                to={item.href}
                className={`${
                  isActive
                    ? 'bg-picton-blue text-white shadow-sm'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 hover:text-gray-900 dark:hover:text-gray-100'
                } group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200`}
              >
                <item.icon
                  className={`${
                    isActive ? 'text-white' : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200'
                  } mr-3 h-5 w-5 flex-shrink-0`}
                />
                {item.name}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

const PortalLayout: React.FC<PortalLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, setUser, setIsAuthenticated } = useAppStore();
  const { logoUrl, siteName } = useAppSettings();
  const { canCreate, limits, loading: limitsLoading } = useTierLimits();
  const { products } = useProducts();
  const navSections = buildNavSections(products);
  const allNavItems = navSections.flatMap((s) => s.items);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMasquerading, setIsMasquerading] = useState(false);
  const [exitingMasquerade, setExitingMasquerade] = useState(false);

  // Check masquerade state on mount and user changes
  useEffect(() => {
    setIsMasquerading(AuthModel.isMasquerading());
  }, [user]);

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
      (i) => i.href !== '/portal' && path.startsWith(i.href + '/')
    );
    if (prefix) return prefix.name;
    if (path.includes('/assistants/new')) return 'Create Assistant';
    if (path.includes('/assistants/') && path.includes('/edit')) return 'Edit Assistant';
    if (path.includes('/assistants/') && path.includes('/chat')) return 'Chat';
    return 'Dashboard';
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex flex-shrink-0 items-center px-4 pb-4 border-b border-gray-200 dark:border-dark-700">
        <Link to="/portal" className="flex items-center">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={siteName || 'Logo'}
              className="h-10 w-auto"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <span className="text-xl font-bold text-gray-900 dark:text-white">{siteName || 'Portal'}</span>
          )}
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="px-3 mt-4 space-y-2">
        {limitsLoading ? (
          <div className="space-y-2">
            <div className="h-10 rounded-lg bg-gray-100 dark:bg-dark-700 animate-pulse" />
            <div className="h-10 rounded-lg bg-gray-100 dark:bg-dark-700 animate-pulse" />
          </div>
        ) : (
          <>
            {products.ai_assistant && (
              canCreate('assistants') ? (
                <Link
                  to="/portal/assistants/new"
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-picton-blue text-white text-sm font-semibold rounded-lg hover:bg-picton-blue/90 transition-all shadow-sm"
                >
                  <PlusIcon className="h-4 w-4" />
                  New Assistant
                </Link>
              ) : (
                <span
                  title={`${limits.tier} plan limit reached (${limits.assistants.used}/${limits.assistants.limit})`}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-gray-300 dark:bg-dark-700 text-gray-500 dark:text-gray-400 text-sm font-semibold rounded-lg cursor-not-allowed"
                >
                  <PlusIcon className="h-4 w-4" />
                  Assistant Limit Reached
                </span>
              )
            )}

            {products.ai_assistant && (
              canCreate('sites') ? (
                <Link
                  to="/portal/sites/new"
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-white dark:bg-dark-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg border border-gray-200 dark:border-dark-600 hover:bg-gray-50 dark:hover:bg-dark-600 hover:border-picton-blue/30 transition-all"
                >
                  <RocketLaunchIcon className="h-4 w-4 text-emerald-500" />
                  Create Website
                </Link>
              ) : (
                <span
                  title={`${limits.tier} plan limit reached (${limits.sites.used}/${limits.sites.limit})`}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-gray-200 dark:bg-dark-700 text-gray-500 dark:text-gray-400 text-sm font-medium rounded-lg border border-gray-200 dark:border-dark-600 cursor-not-allowed"
                >
                  <RocketLaunchIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  Site Limit Reached
                </span>
              )
            )}
          </>
        )}
      </div>

      <div className="mx-3 my-3 border-t border-gray-200 dark:border-dark-700" />

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3">
        {navSections.map((section) => (
          <SidebarSection
            key={section.label}
            section={section}
            pathname={location.pathname}
          />
        ))}
      </nav>
    </>
  );

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-dark-900">
      {/* Global incoming-call listener (persists across pages) */}
      <GlobalCallProvider />
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col">
        <div className="flex min-h-0 flex-1 flex-col bg-white dark:bg-dark-850 border-r border-gray-200 dark:border-dark-700 shadow-sm">
          <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
            {sidebarContent}
          </div>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="fixed inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-dark-850 shadow-xl flex flex-col pt-5 pb-4 overflow-y-auto">
            <div className="absolute top-3 right-3">
              <button onClick={() => setMobileOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            {sidebarContent}
          </div>
        </div>
      )}

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
            <div className="flex items-center gap-3">
              <button
                className="md:hidden p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                onClick={() => setMobileOpen(true)}
              >
                <Bars3Icon className="h-6 w-6" />
              </button>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{resolveTitle()}</h2>
            </div>
            <div className="flex items-center space-x-3">
              <ThemeToggle />
              <NotificationDropdown />
              <UserAccountMenu user={user} onLogout={handleLogout} />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default PortalLayout;
