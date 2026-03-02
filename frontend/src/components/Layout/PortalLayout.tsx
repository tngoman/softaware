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
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../store';
import { AuthModel } from '../../models';
import { useAppSettings } from '../../hooks/useAppSettings';
import NotificationDropdown from '../Notifications/NotificationDropdown';
import UserAccountMenu from '../User/UserAccountMenu';

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

const navSections: NavSection[] = [
  {
    label: 'Overview',
    defaultOpen: true,
    items: [
      { name: 'Dashboard', href: '/portal', icon: HomeIcon },
    ],
  },
  {
    label: 'AI & Automation',
    defaultOpen: true,
    items: [
      { name: 'My Assistants', href: '/portal/assistants', icon: SparklesIcon },
    ],
  },
  {
    label: 'Web Presence',
    defaultOpen: true,
    items: [
      { name: 'Landing Pages', href: '/portal/sites', icon: GlobeAltIcon },
    ],
  },
  {
    label: 'Account',
    defaultOpen: false,
    items: [
      { name: 'Settings', href: '/portal/settings', icon: CogIcon },
    ],
  },
];

const allNavItems = navSections.flatMap((s) => s.items);

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
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
      >
        <span>{section.label}</span>
        {isOpen ? (
          <ChevronDownIcon className="h-3.5 w-3.5 text-gray-400" />
        ) : (
          <ChevronRightIcon className="h-3.5 w-3.5 text-gray-400" />
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
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                } group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200`}
              >
                <item.icon
                  className={`${
                    isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-700'
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
  const { user, logout } = useAppStore();
  const { logoUrl, siteName } = useAppSettings();
  const [mobileOpen, setMobileOpen] = useState(false);

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
      <div className="flex flex-shrink-0 items-center px-4 pb-4 border-b border-gray-200">
        <Link to="/portal" className="flex items-center">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={siteName || 'Logo'}
              className="h-10 w-auto"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <span className="text-xl font-bold text-gray-900">{siteName || 'Portal'}</span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="mt-4 flex-1 space-y-1 px-3">
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
    <div className="flex h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col">
        <div className="flex min-h-0 flex-1 flex-col bg-white border-r border-gray-200 shadow-sm">
          <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
            {sidebarContent}
          </div>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="fixed inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-xl flex flex-col pt-5 pb-4 overflow-y-auto">
            <div className="absolute top-3 right-3">
              <button onClick={() => setMobileOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top header */}
        <header className="bg-white shadow-md border-b-2 border-picton-blue/20">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                className="md:hidden p-1.5 text-gray-500 hover:text-gray-700"
                onClick={() => setMobileOpen(true)}
              >
                <Bars3Icon className="h-6 w-6" />
              </button>
              <h2 className="text-xl font-bold text-gray-900">{resolveTitle()}</h2>
            </div>
            <div className="flex items-center space-x-3">
              <NotificationDropdown />
              <UserAccountMenu user={user!} onLogout={handleLogout} />
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
