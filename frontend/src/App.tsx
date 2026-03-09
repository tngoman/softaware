import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import PermissionRoute from './components/PermissionRoute';
import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';
import Dashboard from './pages/general/Dashboard';
import AdminDashboard from './pages/admin/Dashboard';
import AIOverview from './pages/admin/AIOverview';
import ClientManager from './pages/admin/ClientManager';
import EnterpriseEndpoints from './pages/admin/EnterpriseEndpoints';
import AICredits from './pages/admin/AICredits';
import FinancialDashboard from './pages/finance/FinancialDashboard';
import Quotations from './pages/finance/Quotations';
import CreateQuotation from './pages/finance/CreateQuotation';
import Invoices from './pages/finance/Invoices';
import CreateInvoice from './pages/finance/CreateInvoice';
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
import Webmail from './pages/admin/Webmail';
import ClientMonitor from './pages/general/ClientMonitor';
import ErrorReports from './pages/general/ErrorReports';
import CaseReportHandle from './components/Cases/CaseReportHandle';
import { LandingPage, AuthPage, ActivatePage } from './pages/public';
import PortalLayout from './components/Layout/PortalLayout';
import {
  PortalDashboard,
  AssistantsPage,
  CreateAssistant,
  ChatInterface,
  SitesPage,
  SiteBuilderEditor,
  PortalSettings,
} from './pages/portal';
import { useAuth } from './hooks/useAuth';
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
          <Route path="/activate" element={<ActivatePage />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          
          {/* Billing Login (legacy light-theme, direct URL only) */}
          <Route path="/billing-login" element={<Login />} />
          
          {/* Home: Landing (unauth) or Dashboard (auth) */}
          <Route path="/" element={<HomePage />} />
          <Route path="/dashboard" element={<ProtectedRoute><SmartDashboard /></ProtectedRoute>} />

          {/* Client Portal Routes */}
          <Route path="/portal" element={<ProtectedRoute><PortalLayout><PortalDashboard /></PortalLayout></ProtectedRoute>} />
          <Route path="/portal/assistants" element={<ProtectedRoute><PortalLayout><AssistantsPage /></PortalLayout></ProtectedRoute>} />
          <Route path="/portal/assistants/new" element={<ProtectedRoute><PortalLayout><CreateAssistant /></PortalLayout></ProtectedRoute>} />
          <Route path="/portal/assistants/:assistantId/edit" element={<ProtectedRoute><PortalLayout><CreateAssistant /></PortalLayout></ProtectedRoute>} />
          <Route path="/portal/assistants/:assistantId/chat" element={<ProtectedRoute><PortalLayout><ChatInterface /></PortalLayout></ProtectedRoute>} />
          <Route path="/portal/sites" element={<ProtectedRoute><PortalLayout><SitesPage /></PortalLayout></ProtectedRoute>} />
          <Route path="/portal/sites/new" element={<ProtectedRoute><PortalLayout><SiteBuilderEditor /></PortalLayout></ProtectedRoute>} />
          <Route path="/portal/sites/:siteId/edit" element={<ProtectedRoute><PortalLayout><SiteBuilderEditor /></PortalLayout></ProtectedRoute>} />
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
          <Route path="/contacts" element={<PermissionRoute permission="contacts.view"><Layout><Contacts /></Layout></PermissionRoute>} />
          <Route path="/contacts/:id" element={<PermissionRoute permission="contacts.view"><Layout><ContactDetails /></Layout></PermissionRoute>} />
          <Route path="/contacts/:id/statement" element={<PermissionRoute permission="contacts.view"><Layout><Statement /></Layout></PermissionRoute>} />
          <Route path="/pricing" element={<ProtectedRoute><Layout><Pricing /></Layout></ProtectedRoute>} />
          <Route path="/categories" element={<ProtectedRoute><Layout><Categories /></Layout></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />

          {/* Software, Tasks, Updates, Groups, Database */}
          <Route path="/software" element={<ProtectedRoute><Layout><SoftwareManagement /></Layout></ProtectedRoute>} />
          <Route path="/tasks" element={<ProtectedRoute><Layout><TasksPage /></Layout></ProtectedRoute>} />
          <Route path="/updates" element={<ProtectedRoute><Layout><UpdatesAdmin /></Layout></ProtectedRoute>} />
          <Route path="/client-monitor" element={<AdminRoute><Layout><ClientMonitor /></Layout></AdminRoute>} />
          <Route path="/error-reports" element={<AdminRoute><Layout><ErrorReports /></Layout></AdminRoute>} />
          <Route path="/groups" element={<ProtectedRoute><Layout><GroupsPage /></Layout></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><Layout><ChatPage /></Layout></ProtectedRoute>} />
          <Route path="/planning" element={<ProtectedRoute><Layout><PlanningPage /></Layout></ProtectedRoute>} />
          <Route path="/database" element={<AdminRoute><Layout><DatabaseManager /></Layout></AdminRoute>} />

          {/* AI & Enterprise Admin Routes */}
          <Route path="/admin/ai" element={<AdminRoute><Layout><AIOverview /></Layout></AdminRoute>} />
          <Route path="/admin/clients" element={<AdminRoute><Layout><ClientManager /></Layout></AdminRoute>} />
          <Route path="/admin/enterprise" element={<AdminRoute><Layout><EnterpriseEndpoints /></Layout></AdminRoute>} />
          <Route path="/admin/credits" element={<AdminRoute><Layout><AICredits /></Layout></AdminRoute>} />
          <Route path="/admin/cases" element={<AdminRoute><Layout><AdminCaseManagement /></Layout></AdminRoute>} />
          <Route path="/admin/webmail" element={<AdminRoute><Layout><Webmail /></Layout></AdminRoute>} />

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