import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import DeveloperRoute from './components/DeveloperRoute';
import PermissionRoute from './components/PermissionRoute';
import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';
import Dashboard from './pages/general/Dashboard';
import AdminDashboard from './pages/admin/Dashboard';
import AIOverview from './pages/admin/AdminAIOverview';
import AdminPackages from './pages/admin/AdminPackages';
import ClientManager from './pages/admin/ClientManager';
import EnterpriseEndpoints from './pages/admin/EnterpriseEndpoints';
import ClientApiConfigs from './pages/admin/ClientApiConfigs';
import FinancialDashboard from './pages/finance/FinancialDashboard';
import Quotations from './pages/finance/Quotations';
import CreateQuotation from './pages/finance/CreateQuotation';
import Invoices from './pages/finance/Invoices';
import CreateInvoice from './pages/finance/CreateInvoice';
import CreditNotes from './pages/finance/CreditNotes';
import CreateCreditNote from './pages/finance/CreateCreditNote';
import PurchaseOrders from './pages/finance/PurchaseOrders';
import CreatePurchaseOrder from './pages/finance/CreatePurchaseOrder';
import Contacts from './pages/contacts/Contacts';
import ContactDetails from './pages/contacts/ContactDetails';
import Pricing from './pages/general/Pricing';
import Categories from './pages/general/Categories';
import Settings from './pages/general/Settings';
import Transactions from './pages/finance/Transactions';
import AddExpense from './pages/finance/AddExpense';
import AddIncome from './pages/finance/AddIncome';
import VatReports from './pages/finance/VatReports';
import BalanceSheet from './pages/finance/BalanceSheet';
import ProfitAndLoss from './pages/finance/ProfitAndLoss';
import TransactionListing from './pages/finance/TransactionListing';
import Statement from './pages/finance/Statement';
import Notifications from './pages/general/Notifications';
import Profile from './pages/general/Profile';
import AccountSettings from './pages/general/AccountSettings';
import Updates from './pages/general/Updates';
import UpdatesAdmin from './pages/general/UpdatesAdmin';
import SoftwareManagement from './pages/general/SoftwareManagement';
import TasksPage from './pages/general/TasksPage';
import BugsPage from './pages/general/Bugs';
import GroupsPage from './pages/general/GroupsPage';
import ChatPage from './pages/general/ChatPage';
import PlanningPage from './pages/general/PlanningPage';
import DatabaseManager from './pages/general/DatabaseManager';
import { Credentials } from './pages/general/Credentials';
import { CreateCredential } from './pages/general/CreateCredential';
import Users from './pages/system/Users';
import Roles from './pages/system/Roles';
import Permissions from './pages/system/Permissions';
import SystemSettings from './pages/system/SystemSettings';
import CasesList from './pages/general/CasesList';
import CaseDetailView from './pages/general/CaseDetailView';
import CasesDashboard from './pages/cases/CasesDashboard';
import AdminCaseManagement from './pages/admin/AdminCaseManagement';
import AuditLog from './pages/admin/AuditLog';
import Webmail from './pages/admin/Webmail';
import AdminPayroll from './pages/admin/Payroll';
import ClientMonitor from './pages/general/ClientMonitor';
import ErrorReports from './pages/general/ErrorReports';
import SourceControl from './pages/general/SourceControl';
import CaseReportHandle from './components/Cases/CaseReportHandle';
import { LandingPage, AuthPage, ActivatePage } from './pages/public';
import OAuthCallback from './pages/public/OAuthCallback';
import PortalLayout from './components/Layout/PortalLayout';
import {
  PortalDashboard,
  AssistantsPage,
  CreateAssistant,
  SitesPage,
  SiteBuilderEditor,
  WebsiteManager,
  PageEditor,
  FormSubmissions,
  PortalSettings,
  KnowledgeBase,
  GatewaysPage,
} from './pages/portal';
import AdminSites from './pages/admin/AdminSites';
import StudioDashboard from './pages/staff/StudioDashboard';
import StudioWorkspace from './pages/staff/StudioWorkspace';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { useAppStore } from './store';

/**
 * Home route — shows landing page for visitors, dashboard for authenticated users.
 */
const HomePage: React.FC = () => {
  const { isAuthenticated, user } = useAppStore();
  if (!isAuthenticated) return <LandingPage />;
  // Admin & Staff → admin dashboard, regular users → client portal
  if (user?.is_admin || user?.is_staff) return <Layout><AdminDashboard /></Layout>;
  return <PortalLayout><PortalDashboard /></PortalLayout>;
};

/**
 * Smart dashboard — admin/staff get admin dashboard, regular users get portal.
 */
const SmartDashboard: React.FC = () => {
  const { user } = useAppStore();
  if (user?.is_admin || user?.is_staff) return <Layout><AdminDashboard /></Layout>;
  return <PortalLayout><PortalDashboard /></PortalLayout>;
};

const App: React.FC = () => {
  useAuth(); // Initialize authentication
  useTheme(); // Initialize theme (applies dark class to <html>)

  return (
    <Router>
      <div className="App">
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: { fontSize: '14px', maxWidth: '420px' },
          }}
        />
        <CaseReportHandle />
        <Routes>
          {/* Public Routes — Marketing & SaaS Auth */}
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/register" element={<AuthPage />} />
          <Route path="/oauth/callback" element={<OAuthCallback />} />
          <Route path="/activate" element={<ActivatePage />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          
          {/* Billing Login (legacy light-theme, direct URL only) */}
          <Route path="/billing-login" element={<Login />} />
          
          {/* Home: Landing (unauth) or Dashboard (auth) */}
          <Route path="/" element={<HomePage />} />
          <Route path="/dashboard" element={<ProtectedRoute><SmartDashboard /></ProtectedRoute>} />

          {/* Client Portal Routes */}
          <Route path="/portal" element={<ProtectedRoute><PortalLayout><PortalDashboard /></PortalLayout></ProtectedRoute>} />
          <Route path="/portal/knowledge" element={<ProtectedRoute><PortalLayout><KnowledgeBase /></PortalLayout></ProtectedRoute>} />
          <Route path="/portal/assistants" element={<ProtectedRoute><PortalLayout><AssistantsPage /></PortalLayout></ProtectedRoute>} />
          <Route path="/portal/assistants/new" element={<ProtectedRoute><PortalLayout><CreateAssistant /></PortalLayout></ProtectedRoute>} />
          <Route path="/portal/assistants/:assistantId/edit" element={<ProtectedRoute><PortalLayout><CreateAssistant /></PortalLayout></ProtectedRoute>} />
          <Route path="/portal/sites" element={<ProtectedRoute><PortalLayout><SitesPage /></PortalLayout></ProtectedRoute>} />
          <Route path="/portal/sites/new" element={<ProtectedRoute><PortalLayout><SiteBuilderEditor /></PortalLayout></ProtectedRoute>} />
          <Route path="/portal/sites/:siteId/edit" element={<ProtectedRoute><PortalLayout><SiteBuilderEditor /></PortalLayout></ProtectedRoute>} />
          <Route path="/portal/sites/:siteId/manage" element={<ProtectedRoute><PortalLayout><WebsiteManager /></PortalLayout></ProtectedRoute>} />
          <Route path="/portal/sites/:siteId/submissions" element={<ProtectedRoute><PortalLayout><FormSubmissions /></PortalLayout></ProtectedRoute>} />
          <Route path="/portal/sites/:siteId/pages/:pageId" element={<ProtectedRoute><PortalLayout><PageEditor /></PortalLayout></ProtectedRoute>} />
          <Route path="/portal/gateways" element={<ProtectedRoute><PortalLayout><GatewaysPage /></PortalLayout></ProtectedRoute>} />
          <Route path="/portal/settings" element={<ProtectedRoute><PortalLayout><PortalSettings /></PortalLayout></ProtectedRoute>} />
          <Route path="/financial-dashboard" element={<ProtectedRoute><Layout><FinancialDashboard /></Layout></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><Layout><Notifications /></Layout></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>} />
          <Route path="/account-settings" element={<ProtectedRoute><Layout><AccountSettings /></Layout></ProtectedRoute>} />
          <Route path="/transactions" element={<ProtectedRoute><Layout><Transactions /></Layout></ProtectedRoute>} />
          <Route path="/transactions/add-expense" element={<ProtectedRoute><Layout><AddExpense /></Layout></ProtectedRoute>} />
          <Route path="/transactions/add-income" element={<ProtectedRoute><Layout><AddIncome /></Layout></ProtectedRoute>} />
          <Route path="/vat-reports" element={<ProtectedRoute><Layout><VatReports /></Layout></ProtectedRoute>} />
          <Route path="/reports/balance-sheet" element={<ProtectedRoute><Layout><BalanceSheet /></Layout></ProtectedRoute>} />
          <Route path="/reports/profit-loss" element={<ProtectedRoute><Layout><ProfitAndLoss /></Layout></ProtectedRoute>} />
          <Route path="/reports/transaction-listing" element={<ProtectedRoute><Layout><TransactionListing /></Layout></ProtectedRoute>} />
          <Route path="/quotations" element={<ProtectedRoute><Layout><Quotations /></Layout></ProtectedRoute>} />
          <Route path="/quotations/new" element={<ProtectedRoute><Layout><CreateQuotation /></Layout></ProtectedRoute>} />
          <Route path="/quotations/:id/edit" element={<ProtectedRoute><Layout><CreateQuotation /></Layout></ProtectedRoute>} />
          <Route path="/quotations/:id" element={<ProtectedRoute><Layout><Quotations /></Layout></ProtectedRoute>} />
          <Route path="/invoices" element={<ProtectedRoute><Layout><Invoices /></Layout></ProtectedRoute>} />
          <Route path="/invoices/new" element={<ProtectedRoute><Layout><CreateInvoice /></Layout></ProtectedRoute>} />
          <Route path="/invoices/:id/edit" element={<ProtectedRoute><Layout><CreateInvoice /></Layout></ProtectedRoute>} />
          <Route path="/invoices/:id" element={<ProtectedRoute><Layout><Invoices /></Layout></ProtectedRoute>} />
          <Route path="/credit-notes" element={<ProtectedRoute><Layout><CreditNotes /></Layout></ProtectedRoute>} />
          <Route path="/credit-notes/new" element={<ProtectedRoute><Layout><CreateCreditNote /></Layout></ProtectedRoute>} />
          <Route path="/credit-notes/:id/edit" element={<ProtectedRoute><Layout><CreateCreditNote /></Layout></ProtectedRoute>} />
          <Route path="/credit-notes/:id" element={<ProtectedRoute><Layout><CreditNotes /></Layout></ProtectedRoute>} />
          <Route path="/purchase-orders" element={<ProtectedRoute><Layout><PurchaseOrders /></Layout></ProtectedRoute>} />
          <Route path="/purchase-orders/new" element={<ProtectedRoute><Layout><CreatePurchaseOrder /></Layout></ProtectedRoute>} />
          <Route path="/purchase-orders/:id/edit" element={<ProtectedRoute><Layout><CreatePurchaseOrder /></Layout></ProtectedRoute>} />
          <Route path="/purchase-orders/:id" element={<ProtectedRoute><Layout><PurchaseOrders /></Layout></ProtectedRoute>} />
          <Route path="/contacts" element={<PermissionRoute permission="contacts.view"><Layout><Contacts /></Layout></PermissionRoute>} />
          <Route path="/contacts/:id" element={<PermissionRoute permission="contacts.view"><Layout><ContactDetails /></Layout></PermissionRoute>} />
          <Route path="/contacts/:id/statement" element={<PermissionRoute permission="contacts.view"><Layout><Statement /></Layout></PermissionRoute>} />
          <Route path="/pricing" element={<ProtectedRoute><Layout><Pricing /></Layout></ProtectedRoute>} />
          <Route path="/categories" element={<ProtectedRoute><Layout><Categories /></Layout></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />

          {/* Software, Tasks, Updates, Groups, Database */}
          <Route path="/software" element={<ProtectedRoute><Layout><SoftwareManagement /></Layout></ProtectedRoute>} />
          <Route path="/tasks" element={<ProtectedRoute><Layout><TasksPage /></Layout></ProtectedRoute>} />
          <Route path="/bugs" element={<ProtectedRoute><Layout><BugsPage /></Layout></ProtectedRoute>} />
          <Route path="/updates" element={<ProtectedRoute><Layout><UpdatesAdmin /></Layout></ProtectedRoute>} />
          <Route path="/client-monitor" element={<AdminRoute><Layout><ClientMonitor /></Layout></AdminRoute>} />
          <Route path="/error-reports" element={<AdminRoute><Layout><ErrorReports /></Layout></AdminRoute>} />
          <Route path="/groups" element={<ProtectedRoute><Layout><GroupsPage /></Layout></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><Layout><ChatPage /></Layout></ProtectedRoute>} />
          <Route path="/planning" element={<ProtectedRoute><Layout><PlanningPage /></Layout></ProtectedRoute>} />
          <Route path="/database" element={<DeveloperRoute><Layout><DatabaseManager /></Layout></DeveloperRoute>} />
          <Route path="/source-control" element={<DeveloperRoute><Layout><SourceControl /></Layout></DeveloperRoute>} />

          {/* AI & Enterprise Admin Routes */}
          <Route path="/admin/ai" element={<AdminRoute><Layout><AIOverview /></Layout></AdminRoute>} />
          <Route path="/admin/packages" element={<AdminRoute><Layout><AdminPackages /></Layout></AdminRoute>} />
          <Route path="/admin/clients" element={<AdminRoute><Layout><Contacts /></Layout></AdminRoute>} />
          <Route path="/admin/enterprise" element={<AdminRoute><Layout><EnterpriseEndpoints /></Layout></AdminRoute>} />
          <Route path="/admin/client-api" element={<AdminRoute><Layout><ClientApiConfigs /></Layout></AdminRoute>} />
          <Route path="/admin/cases" element={<AdminRoute><Layout><AdminCaseManagement /></Layout></AdminRoute>} />
          <Route path="/admin/sites" element={<AdminRoute><Layout><AdminSites /></Layout></AdminRoute>} />
          <Route path="/studio" element={<AdminRoute><Layout><StudioDashboard /></Layout></AdminRoute>} />
          <Route path="/studio/:siteId" element={<AdminRoute><StudioWorkspace /></AdminRoute>} />
          <Route path="/admin/payroll" element={<AdminRoute><Layout><AdminPayroll /></Layout></AdminRoute>} />
          <Route path="/admin/audit-log" element={<AdminRoute><Layout><AuditLog /></Layout></AdminRoute>} />
          <Route path="/webmail" element={<ProtectedRoute><Layout><Webmail /></Layout></ProtectedRoute>} />

          {/* Case Management */}
          <Route path="/cases/dashboard" element={<ProtectedRoute><Layout><CasesDashboard /></Layout></ProtectedRoute>} />
          <Route path="/cases" element={<ProtectedRoute><Layout><CasesList /></Layout></ProtectedRoute>} />
          <Route path="/cases/:id" element={<ProtectedRoute><Layout><CaseDetailView /></Layout></ProtectedRoute>} />

          <Route path="/credentials" element={<AdminRoute><Layout><Credentials /></Layout></AdminRoute>} />
          <Route path="/credentials/new" element={<AdminRoute><Layout><CreateCredential /></Layout></AdminRoute>} />
          <Route path="/credentials/:id/edit" element={<AdminRoute><Layout><CreateCredential /></Layout></AdminRoute>} />
          
          {/* System Management Routes (Permission-Based) */}
          <Route path="/system/users" element={<PermissionRoute permission="users.view"><Layout><Users /></Layout></PermissionRoute>} />
          <Route path="/system/roles" element={<PermissionRoute permission="roles.view"><Layout><Roles /></Layout></PermissionRoute>} />
          <Route path="/system/permissions" element={<PermissionRoute permission="permissions.view"><Layout><Permissions /></Layout></PermissionRoute>} />
          <Route path="/system/settings" element={<PermissionRoute permission="settings.view"><Layout><SystemSettings /></Layout></PermissionRoute>} />
          <Route path="/system/updates" element={<PermissionRoute permission="updates.manage"><Layout><Updates /></Layout></PermissionRoute>} />
          
          {/* Legacy routes (keeping /users, /roles, /permissions, /system-settings for backward compatibility) */}
          <Route path="/users" element={<PermissionRoute permission="users.view"><Layout><Users /></Layout></PermissionRoute>} />
          <Route path="/roles" element={<PermissionRoute permission="roles.view"><Layout><Roles /></Layout></PermissionRoute>} />
          <Route path="/permissions" element={<PermissionRoute permission="permissions.view"><Layout><Permissions /></Layout></PermissionRoute>} />
          <Route path="/system-settings" element={<PermissionRoute permission="settings.view"><Layout><SystemSettings /></Layout></PermissionRoute>} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;