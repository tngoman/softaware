import React, { useState, useEffect } from 'react';
import { DashboardModel } from '../models/OtherModels';
import Can from '../components/Can';
import { 
  BanknotesIcon, 
  DocumentTextIcon, 
  DocumentDuplicateIcon, 
  UsersIcon,
  ChartBarIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  LockClosedIcon
} from '@heroicons/react/24/outline';

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'quarter' | 'year' | 'all'>('month');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadStats();
  }, [period]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await DashboardModel.getStats(period);
      setStats(data);
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 2
    }).format(amount).replace('ZAR', 'R');
  };

  const getPaymentStatusBadge = (status: number) => {
    switch (status) {
      case 0:
        return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">Unpaid</span>;
      case 1:
        return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">Partial</span>;
      case 2:
        return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Paid</span>;
      default:
        return null;
    }
  };

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-picton-blue"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with gradient background */}
      <div className="bg-gradient-to-r from-picton-blue to-picton-blue/80 rounded-xl shadow-lg p-6 text-white">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
            <p className="text-white/90">Real-time overview of your business metrics</p>
          </div>
          <div className="flex gap-2">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as any)}
              className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-white/50"
            >
              <option value="today" className="text-gray-900 bg-white">Today</option>
              <option value="week" className="text-gray-900 bg-white">This Week</option>
              <option value="month" className="text-gray-900 bg-white">This Month</option>
              <option value="quarter" className="text-gray-900 bg-white">This Quarter</option>
              <option value="year" className="text-gray-900 bg-white">This Year</option>
              <option value="all" className="text-gray-900 bg-white">All Time</option>
            </select>
          </div>
        </div>
      </div>

      <Can 
        permission="dashboard.view" 
        fallback={
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <LockClosedIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Access Restricted</h3>
            <p className="text-gray-500">You don't have permission to view dashboard metrics.</p>
          </div>
        }
      >
        {/* Key Metrics - Row 1: Financial Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue Collected (Actual Cash) */}
        <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-green-100 p-2 rounded-lg">
              <BanknotesIcon className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-xs font-medium text-green-600">
              {stats.revenue.collection_rate}% collected
            </span>
          </div>
          <h3 className="text-xs font-medium text-gray-600 mb-0.5">Revenue Collected</h3>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.revenue.collected)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Actual payments received</p>
        </div>

        {/* Profit */}
        <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-blue-100 p-2 rounded-lg">
              <ChartBarIcon className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-blue-600">
              {stats.profit.profit_margin}% margin
            </span>
          </div>
          <h3 className="text-xs font-medium text-gray-600 mb-0.5">Profit</h3>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.profit.profit)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Revenue - Expenses</p>
        </div>

        {/* Outstanding */}
        <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-orange-500">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-orange-100 p-2 rounded-lg">
              <ClockIcon className="h-5 w-5 text-orange-600" />
            </div>
            <span className="text-xs font-medium text-orange-600">
              {stats.invoices.unpaid_count + stats.invoices.partial_count} invoices
            </span>
          </div>
          <h3 className="text-xs font-medium text-gray-600 mb-0.5">Outstanding</h3>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.revenue.outstanding)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Awaiting payment</p>
        </div>

        {/* Total Invoiced */}
        <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-purple-500">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-purple-100 p-2 rounded-lg">
              <DocumentTextIcon className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-xs font-medium text-purple-600">
              {stats.invoices.total_count} invoices
            </span>
          </div>
          <h3 className="text-xs font-medium text-gray-600 mb-0.5">Total Invoiced</h3>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.invoices.total_amount)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total billed amount</p>
        </div>
      </div>

      {/* Key Metrics - Row 2: Business Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Payments Received */}
        <div className="bg-white rounded-xl shadow-md p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-green-100 p-2 rounded-lg">
              <CheckCircleIcon className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <h3 className="text-xs font-medium text-gray-600 mb-0.5">Payments Received</h3>
          <p className="text-xl font-bold text-green-600">{stats.payments.total_count}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Avg: {formatCurrency(stats.payments.average_amount || 0)}
          </p>
        </div>

        {/* Quotations */}
        <div className="bg-white rounded-xl shadow-md p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-blue-100 p-2 rounded-lg">
              <DocumentDuplicateIcon className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <h3 className="text-xs font-medium text-gray-600 mb-0.5">Quotations</h3>
          <p className="text-xl font-bold text-blue-600">{stats.quotations.total_count}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {stats.quotations.accepted_count} accepted
          </p>
        </div>

        {/* Active Customers */}
        <div className="bg-white rounded-xl shadow-md p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-purple-100 p-2 rounded-lg">
              <UsersIcon className="h-5 w-5 text-purple-600" />
            </div>
          </div>
          <h3 className="text-xs font-medium text-gray-600 mb-0.5">Customers</h3>
          <p className="text-xl font-bold text-purple-600">{stats.customers.customer_count}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {stats.customers.supplier_count} suppliers
          </p>
        </div>

        {/* Expenses */}
        <div className="bg-white rounded-xl shadow-md p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-red-100 p-2 rounded-lg">
              <ExclamationCircleIcon className="h-5 w-5 text-red-600" />
            </div>
          </div>
          <h3 className="text-xs font-medium text-gray-600 mb-0.5">Expenses</h3>
          <p className="text-xl font-bold text-red-600">{formatCurrency(stats.profit.expenses)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total costs</p>
        </div>
      </div>

      {/* Aging Analysis */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Outstanding by Age</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Current</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(stats.outstanding.current)}</p>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">1-30 Days</p>
            <p className="text-xl font-bold text-yellow-600">{formatCurrency(stats.outstanding['30_days'])}</p>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">31-60 Days</p>
            <p className="text-xl font-bold text-orange-600">{formatCurrency(stats.outstanding['60_days'])}</p>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">90+ Days</p>
            <p className="text-xl font-bold text-red-600">{formatCurrency(stats.outstanding['90_plus_days'])}</p>
          </div>
          <div className="text-center p-4 bg-gray-100 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Total</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.outstanding.total)}</p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Invoices */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Invoices</h3>
          <div className="space-y-3">
            {stats.recent_invoices.length > 0 ? (
              stats.recent_invoices.map((inv: any) => (
                <div key={inv.invoice_id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">
                        INV-{String(inv.invoice_id).padStart(5, '0')}
                      </p>
                      {getPaymentStatusBadge(inv.invoice_payment_status)}
                    </div>
                    <p className="text-sm text-gray-500">{inv.contact_name}</p>
                    {inv.amount_paid > 0 && (
                      <p className="text-xs text-green-600">
                        Paid: {formatCurrency(inv.amount_paid)} | Outstanding: {formatCurrency(inv.outstanding)}
                      </p>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{formatCurrency(inv.invoice_total)}</span>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 py-4">No recent invoices</p>
            )}
          </div>
        </div>

        {/* Recent Quotations */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Quotations</h3>
          <div className="space-y-3">
            {stats.recent_quotations.length > 0 ? (
              stats.recent_quotations.map((quote: any) => (
                <div key={quote.quotation_id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div>
                    <p className="font-medium text-gray-900">
                      QUO-{String(quote.quotation_id).padStart(5, '0')}
                    </p>
                    <p className="text-sm text-gray-500">{quote.contact_name}</p>
                  </div>
                  <span className="text-sm font-semibold text-blue-600">{formatCurrency(quote.quotation_total)}</span>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 py-4">No recent quotations</p>
            )}
          </div>
        </div>
      </div>
      </Can>
    </div>
  );
};

export default Dashboard;