import React, { useState, useEffect, useCallback } from 'react';
import {
  AdminPackagesModel,
  PackageDefinition,
  ContactPackageSubscription,
  PackageTransaction,
} from '../../models';
import {
  CubeIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ArrowPathIcon,
  CurrencyDollarIcon,
  XMarkIcon,
  AdjustmentsHorizontalIcon,
  DocumentTextIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { Card } from '../../components/UI';
import Swal from 'sweetalert2';

// ─── Helpers ─────────────────────────────────────────────────────────────

const formatPrice = (cents: number): string => {
  if (cents === 0) return 'Free';
  return `R${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  TRIAL: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  PAST_DUE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  CANCELLED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  EXPIRED: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  SUSPENDED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const typeColors: Record<string, string> = {
  CONSUMER: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  ENTERPRISE: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  STAFF: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  ADDON: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

// ─── Component ───────────────────────────────────────────────────────────

const AIPackages: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<PackageDefinition[]>([]);
  const [subscriptions, setSubscriptions] = useState<ContactPackageSubscription[]>([]);
  const [transactions, setTransactions] = useState<PackageTransaction[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [activeTab, setActiveTab] = useState<'packages' | 'subscriptions' | 'transactions'>('packages');

  // Package form state
  const [showPkgForm, setShowPkgForm] = useState(false);
  const [editingPkg, setEditingPkg] = useState<PackageDefinition | null>(null);
  const [pkgForm, setPkgForm] = useState({
    slug: '', name: '', description: '', package_type: 'CONSUMER' as PackageDefinition['package_type'],
    price_monthly: 0, price_annually: 0, credits_included: 0,
    max_users: 0, max_agents: 0, max_widgets: 0, max_landing_pages: 0, max_enterprise_endpoints: 0,
    features: '' as string, is_active: true, is_public: true, display_order: 0,
    featured: false, cta_text: 'Get Started',
  });

  // Assign form state
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignForm, setAssignForm] = useState({
    contact_id: 0, package_id: 0, billing_cycle: 'MONTHLY', status: 'ACTIVE',
  });

  // Adjust form state
  const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [adjustForm, setAdjustForm] = useState({
    contact_package_id: 0, amount: 0, reason: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pkgs, subs, txResult] = await Promise.all([
        AdminPackagesModel.getPackages().catch(() => []),
        AdminPackagesModel.getAllSubscriptions().catch(() => []),
        AdminPackagesModel.getTransactions({ limit: 50 }).catch(() => ({ transactions: [], total: 0 })),
      ]);
      setPackages(pkgs);
      setSubscriptions(subs);
      setTransactions(txResult.transactions || []);
      setTxTotal(txResult.total || 0);
    } catch (err) {
      console.error('Failed to load packages data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Package CRUD ─────────────────────────────────────────────────────

  const openCreatePackage = () => {
    setEditingPkg(null);
    setPkgForm({
      slug: '', name: '', description: '', package_type: 'CONSUMER',
      price_monthly: 0, price_annually: 0, credits_included: 0,
      max_users: 0, max_agents: 0, max_widgets: 0, max_landing_pages: 0, max_enterprise_endpoints: 0,
      features: '', is_active: true, is_public: true, display_order: 0,
      featured: false, cta_text: 'Get Started',
    });
    setShowPkgForm(true);
  };

  const openEditPackage = (pkg: PackageDefinition) => {
    setEditingPkg(pkg);
    let featureStr = '';
    try {
      const arr = typeof pkg.features === 'string' ? JSON.parse(pkg.features) : pkg.features || [];
      featureStr = arr.join('\n');
    } catch { featureStr = ''; }
    setPkgForm({
      slug: pkg.slug, name: pkg.name, description: pkg.description || '',
      package_type: pkg.package_type, price_monthly: pkg.price_monthly,
      price_annually: pkg.price_annually || 0, credits_included: pkg.credits_included,
      max_users: pkg.max_users || 0, max_agents: pkg.max_agents || 0,
      max_widgets: pkg.max_widgets || 0, max_landing_pages: pkg.max_landing_pages || 0,
      max_enterprise_endpoints: pkg.max_enterprise_endpoints || 0,
      features: featureStr, is_active: pkg.is_active, is_public: pkg.is_public,
      display_order: pkg.display_order, featured: pkg.featured, cta_text: pkg.cta_text,
    });
    setShowPkgForm(true);
  };

  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...pkgForm,
        features: pkgForm.features.split('\n').map(f => f.trim()).filter(Boolean),
        price_annually: pkgForm.price_annually || null,
        max_users: pkgForm.max_users || null,
        max_agents: pkgForm.max_agents || null,
        max_widgets: pkgForm.max_widgets || null,
        max_landing_pages: pkgForm.max_landing_pages || null,
        max_enterprise_endpoints: pkgForm.max_enterprise_endpoints || null,
      };
      if (editingPkg) {
        await AdminPackagesModel.updatePackage(editingPkg.id, payload);
      } else {
        await AdminPackagesModel.createPackage(payload);
      }
      Swal.fire({ icon: 'success', title: 'Saved', timer: 1200, showConfirmButton: false });
      setShowPkgForm(false);
      loadData();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.error || 'Save failed' });
    }
  };

  const handleDeletePackage = async (pkg: PackageDefinition) => {
    const result = await Swal.fire({
      title: 'Delete package?',
      text: `This will delete the "${pkg.name}" package. Active subscriptions will prevent deletion.`,
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#EF4444', confirmButtonText: 'Delete',
    });
    if (!result.isConfirmed) return;
    try {
      await AdminPackagesModel.deletePackage(pkg.id);
      loadData();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.error || 'Failed' });
    }
  };

  // ── Assign Package ───────────────────────────────────────────────────

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await AdminPackagesModel.assignPackage(assignForm as any);
      Swal.fire({ icon: 'success', title: 'Package Assigned', timer: 1500, showConfirmButton: false });
      setShowAssignForm(false);
      loadData();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.error || 'Assignment failed' });
    }
  };

  // ── Adjust Credits ───────────────────────────────────────────────────

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await AdminPackagesModel.adjustCredits(adjustForm.contact_package_id, adjustForm.amount, adjustForm.reason);
      Swal.fire({ icon: 'success', title: 'Credits Adjusted', timer: 1500, showConfirmButton: false });
      setShowAdjustForm(false);
      loadData();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.error || 'Adjustment failed' });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><ArrowPathIcon className="w-8 h-8 text-indigo-500 animate-spin" /></div>;
  }

  const tabs = [
    { key: 'packages' as const, label: 'Packages', icon: CubeIcon },
    { key: 'subscriptions' as const, label: 'Subscriptions', icon: UserGroupIcon },
    { key: 'transactions' as const, label: 'Transactions', icon: DocumentTextIcon },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <CubeIcon className="w-7 h-7 text-picton-blue" />
            AI Packages
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage packages, subscriptions, and credit allocations
          </p>
        </div>
        <button onClick={loadData} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300">
          <ArrowPathIcon className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
              activeTab === key ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* ═══ Packages Tab ═══════════════════════════════════════════════════ */}
      {activeTab === 'packages' && (
        <Card>
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Package Definitions</h2>
              <button onClick={openCreatePackage} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-picton-blue hover:bg-picton-blue/90 text-white font-medium">
                <PlusIcon className="w-4 h-4" /> New Package
              </button>
            </div>
            {packages.length === 0 ? (
              <p className="text-center py-8 text-gray-500">No packages configured</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {packages.map((pkg) => {
                  let features: string[] = [];
                  try { features = typeof pkg.features === 'string' ? JSON.parse(pkg.features) : pkg.features || []; } catch { /* */ }
                  return (
                    <div
                      key={pkg.id}
                      className={`p-4 rounded-xl border ${
                        pkg.is_active ? (pkg.featured ? 'border-picton-blue ring-1 ring-picton-blue/20' : 'border-gray-200 dark:border-gray-700') : 'border-red-200 dark:border-red-900/50 opacity-60'
                      } bg-white dark:bg-gray-800 flex flex-col`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{pkg.name}</h3>
                          <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${typeColors[pkg.package_type] || 'bg-gray-100 text-gray-600'}`}>
                            {pkg.package_type}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => openEditPackage(pkg)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                            <PencilIcon className="w-3.5 h-3.5 text-gray-500" />
                          </button>
                          <button onClick={() => handleDeletePackage(pkg)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                            <TrashIcon className="w-3.5 h-3.5 text-red-500" />
                          </button>
                        </div>
                      </div>
                      <div className="mb-2">
                        <span className="text-xl font-bold text-gray-900 dark:text-white">{formatPrice(pkg.price_monthly)}</span>
                        {pkg.price_monthly > 0 && <span className="text-xs text-gray-500">/mo</span>}
                      </div>
                      <p className="text-xs text-gray-500 mb-2">{pkg.credits_included.toLocaleString()} credits/month</p>
                      {pkg.description && <p className="text-xs text-gray-400 mb-3">{pkg.description}</p>}
                      <div className="flex-1">
                        <ul className="space-y-1">
                          {features.slice(0, 4).map((f, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                              <CheckCircleIcon className="w-3.5 h-3.5 text-picton-blue mt-0.5 shrink-0" />
                              {f}
                            </li>
                          ))}
                          {features.length > 4 && (
                            <li className="text-xs text-gray-400">+{features.length - 4} more...</li>
                          )}
                        </ul>
                      </div>
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${pkg.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                          {pkg.is_active ? 'Active' : 'Inactive'}
                        </span>
                        {pkg.is_public && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Public</span>}
                        {pkg.featured && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Featured</span>}
                        <span className="text-[10px] text-gray-400 ml-auto">#{pkg.display_order}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ═══ Subscriptions Tab ═════════════════════════════════════════════ */}
      {activeTab === 'subscriptions' && (
        <Card>
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Contact Subscriptions</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => { setAdjustForm({ contact_package_id: 0, amount: 0, reason: '' }); setShowAdjustForm(true); }}
                  className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                >
                  <AdjustmentsHorizontalIcon className="w-4 h-4" /> Adjust Credits
                </button>
                <button
                  onClick={() => { setAssignForm({ contact_id: 0, package_id: 0, billing_cycle: 'MONTHLY', status: 'ACTIVE' }); setShowAssignForm(true); }}
                  className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-picton-blue hover:bg-picton-blue/90 text-white font-medium"
                >
                  <PlusIcon className="w-4 h-4" /> Assign Package
                </button>
              </div>
            </div>
            {subscriptions.length === 0 ? (
              <p className="text-center py-8 text-gray-500">No subscriptions found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-200 dark:border-gray-700">
                      <th className="pb-2 font-medium">Contact</th>
                      <th className="pb-2 font-medium">Package</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium">Billing</th>
                      <th className="pb-2 font-medium text-right">Credits Balance</th>
                      <th className="pb-2 font-medium text-right">Credits Used</th>
                      <th className="pb-2 font-medium">Period End</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                    {subscriptions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-3 text-gray-900 dark:text-white font-medium">
                          {sub.contact_name || `Contact #${sub.contact_id}`}
                        </td>
                        <td className="py-3 text-gray-600 dark:text-gray-300">{sub.package_name}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${statusColors[sub.status] || 'bg-gray-100'}`}>
                            {sub.status}
                          </span>
                        </td>
                        <td className="py-3 text-gray-500 text-xs">{sub.billing_cycle}</td>
                        <td className={`py-3 text-right font-mono font-bold ${sub.credits_balance > 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {sub.credits_balance.toLocaleString()}
                        </td>
                        <td className="py-3 text-right font-mono text-gray-500">{sub.credits_used.toLocaleString()}</td>
                        <td className="py-3 text-gray-500 text-xs">
                          {sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ═══ Transactions Tab ══════════════════════════════════════════════ */}
      {activeTab === 'transactions' && (
        <Card>
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Recent Transactions <span className="text-sm font-normal text-gray-400">({txTotal} total)</span>
              </h2>
            </div>
            {transactions.length === 0 ? (
              <p className="text-center py-8 text-gray-500">No transactions found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-200 dark:border-gray-700">
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 font-medium">Contact</th>
                      <th className="pb-2 font-medium">Package</th>
                      <th className="pb-2 font-medium">Type</th>
                      <th className="pb-2 font-medium text-right">Amount</th>
                      <th className="pb-2 font-medium text-right">Balance After</th>
                      <th className="pb-2 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-2 text-gray-500 text-xs whitespace-nowrap">
                          {tx.created_at ? new Date(tx.created_at).toLocaleString() : '—'}
                        </td>
                        <td className="py-2 text-gray-900 dark:text-white">{tx.contact_name || `#${tx.contact_id}`}</td>
                        <td className="py-2 text-gray-600 dark:text-gray-300 text-xs">{tx.package_name || '—'}</td>
                        <td className="py-2">
                          <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                            tx.type === 'USAGE' ? 'bg-red-100 text-red-700' :
                            tx.type === 'PURCHASE' ? 'bg-green-100 text-green-700' :
                            tx.type === 'MONTHLY_ALLOCATION' ? 'bg-blue-100 text-blue-700' :
                            tx.type === 'ADJUSTMENT' ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {tx.type}
                          </span>
                        </td>
                        <td className={`py-2 text-right font-mono font-bold ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString()}
                        </td>
                        <td className="py-2 text-right font-mono text-gray-500">{tx.balance_after.toLocaleString()}</td>
                        <td className="py-2 text-gray-500 text-xs max-w-xs truncate">{tx.description || tx.request_type || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ═══ Package Form Modal ════════════════════════════════════════════ */}
      {showPkgForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingPkg ? 'Edit Package' : 'New Package'}
              </h2>
              <button onClick={() => setShowPkgForm(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <XMarkIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSavePackage} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Slug</label>
                  <input type="text" value={pkgForm.slug} onChange={(e) => setPkgForm({ ...pkgForm, slug: e.target.value })} required
                    placeholder="e.g. starter" pattern="[a-z0-9-]+"
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                  <input type="text" value={pkgForm.name} onChange={(e) => setPkgForm({ ...pkgForm, name: e.target.value })} required
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <input type="text" value={pkgForm.description} onChange={(e) => setPkgForm({ ...pkgForm, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                  <select value={pkgForm.package_type} onChange={(e) => setPkgForm({ ...pkgForm, package_type: e.target.value as PackageDefinition['package_type'] })}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white">
                    <option value="CONSUMER">Consumer</option>
                    <option value="ENTERPRISE">Enterprise</option>
                    <option value="STAFF">Staff</option>
                    <option value="ADDON">Add-on</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price Monthly (cents)</label>
                  <input type="number" min="0" value={pkgForm.price_monthly} onChange={(e) => setPkgForm({ ...pkgForm, price_monthly: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white" />
                  <p className="text-[10px] text-gray-400 mt-0.5">{formatPrice(pkgForm.price_monthly)}/mo</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price Annually (cents)</label>
                  <input type="number" min="0" value={pkgForm.price_annually} onChange={(e) => setPkgForm({ ...pkgForm, price_annually: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white" />
                  <p className="text-[10px] text-gray-400 mt-0.5">{pkgForm.price_annually ? `${formatPrice(pkgForm.price_annually)}/yr` : 'Not offered'}</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Credits Included (monthly)</label>
                <input type="number" min="0" value={pkgForm.credits_included} onChange={(e) => setPkgForm({ ...pkgForm, credits_included: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white" />
              </div>
              <div className="grid grid-cols-5 gap-3">
                {(['max_users', 'max_agents', 'max_widgets', 'max_landing_pages', 'max_enterprise_endpoints'] as const).map((field) => (
                  <div key={field}>
                    <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                      {field.replace('max_', '').replace('_', ' ')}
                    </label>
                    <input type="number" min="0" value={(pkgForm as any)[field]}
                      onChange={(e) => setPkgForm({ ...pkgForm, [field]: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 text-xs border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white" />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Features (one per line)</label>
                <textarea rows={4} value={pkgForm.features} onChange={(e) => setPkgForm({ ...pkgForm, features: e.target.value })}
                  placeholder="One feature per line"
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Order</label>
                  <input type="number" min="0" value={pkgForm.display_order} onChange={(e) => setPkgForm({ ...pkgForm, display_order: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CTA Text</label>
                  <input type="text" value={pkgForm.cta_text} onChange={(e) => setPkgForm({ ...pkgForm, cta_text: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white" />
                </div>
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={pkgForm.is_active} onChange={(e) => setPkgForm({ ...pkgForm, is_active: e.target.checked })} className="rounded" />
                  Active
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={pkgForm.is_public} onChange={(e) => setPkgForm({ ...pkgForm, is_public: e.target.checked })} className="rounded" />
                  Public (show on landing page)
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={pkgForm.featured} onChange={(e) => setPkgForm({ ...pkgForm, featured: e.target.checked })} className="rounded" />
                  Featured (highlight as popular)
                </label>
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <button type="button" onClick={() => setShowPkgForm(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-picton-blue text-white hover:bg-picton-blue/90 font-medium">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ Assign Package Modal ══════════════════════════════════════════ */}
      {showAssignForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Assign Package to Contact</h2>
              <button onClick={() => setShowAssignForm(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><XMarkIcon className="w-5 h-5 text-gray-500" /></button>
            </div>
            <form onSubmit={handleAssign} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact ID</label>
                <input type="number" min="1" value={assignForm.contact_id || ''} onChange={(e) => setAssignForm({ ...assignForm, contact_id: parseInt(e.target.value) || 0 })} required
                  placeholder="Enter contact ID"
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Package</label>
                <select value={assignForm.package_id || ''} onChange={(e) => setAssignForm({ ...assignForm, package_id: parseInt(e.target.value) || 0 })} required
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white">
                  <option value="">Select package...</option>
                  {packages.filter(p => p.is_active).map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({formatPrice(p.price_monthly)}/mo, {p.credits_included.toLocaleString()} credits)</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Billing Cycle</label>
                  <select value={assignForm.billing_cycle} onChange={(e) => setAssignForm({ ...assignForm, billing_cycle: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white">
                    <option value="MONTHLY">Monthly</option>
                    <option value="ANNUALLY">Annually</option>
                    <option value="NONE">None</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                  <select value={assignForm.status} onChange={(e) => setAssignForm({ ...assignForm, status: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white">
                    <option value="ACTIVE">Active</option>
                    <option value="TRIAL">Trial</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <button type="button" onClick={() => setShowAssignForm(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-picton-blue text-white hover:bg-picton-blue/90 font-medium">Assign</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ Adjust Credits Modal ══════════════════════════════════════════ */}
      {showAdjustForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Adjust Credits</h2>
              <button onClick={() => setShowAdjustForm(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><XMarkIcon className="w-5 h-5 text-gray-500" /></button>
            </div>
            <form onSubmit={handleAdjust} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subscription</label>
                <select value={adjustForm.contact_package_id || ''} onChange={(e) => setAdjustForm({ ...adjustForm, contact_package_id: parseInt(e.target.value) || 0 })} required
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white">
                  <option value="">Select subscription...</option>
                  {subscriptions.filter(s => s.status === 'ACTIVE' || s.status === 'TRIAL').map(s => (
                    <option key={s.id} value={s.id}>
                      {s.contact_name} — {s.package_name} (Balance: {s.credits_balance.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount (positive = add, negative = deduct)</label>
                <input type="number" value={adjustForm.amount} onChange={(e) => setAdjustForm({ ...adjustForm, amount: parseInt(e.target.value) || 0 })} required
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason</label>
                <input type="text" value={adjustForm.reason} onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })} required
                  placeholder="e.g., Manual top-up, refund, correction"
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white" />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <button type="button" onClick={() => setShowAdjustForm(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium">Adjust</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIPackages;
