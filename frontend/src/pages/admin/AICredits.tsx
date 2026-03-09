import React, { useState, useEffect } from 'react';
import { AdminCreditsModel, CreditPackage, CreditBalance } from '../../models';
import {
  CurrencyDollarIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ArrowPathIcon,
  BanknotesIcon,
  XMarkIcon,
  AdjustmentsHorizontalIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { Card } from '../../components/UI';
import Swal from 'sweetalert2';

const AICredits: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [balances, setBalances] = useState<CreditBalance[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'packages' | 'balances' | 'transactions'>('packages');
  const [showPkgForm, setShowPkgForm] = useState(false);
  const [editingPkg, setEditingPkg] = useState<CreditPackage | null>(null);
  const [pkgForm, setPkgForm] = useState({ name: '', credits: 100, price: 10, description: '', isActive: true });
  const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ team_id: '' as string, amount: 0, reason: '' });

  const loadData = async () => {
    setLoading(true);
    try {
      const [pkgs, bals, txns] = await Promise.all([
        AdminCreditsModel.getPackages().catch(() => []),
        AdminCreditsModel.getAllBalances().catch(() => []),
        AdminCreditsModel.getTransactions().catch(() => []),
      ]);
      setPackages(pkgs);
      setBalances(bals);
      setTransactions(txns);
    } catch (err) {
      console.error('Failed to load credits data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPkg) {
        await AdminCreditsModel.updatePackage(editingPkg.id, pkgForm);
      } else {
        await AdminCreditsModel.createPackage(pkgForm);
      }
      Swal.fire({ icon: 'success', title: 'Saved', timer: 1200, showConfirmButton: false });
      setShowPkgForm(false);
      loadData();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.error || 'Save failed' });
    }
  };

  const handleDeletePackage = async (pkg: CreditPackage) => {
    const result = await Swal.fire({
      title: 'Delete package?',
      text: `This will delete the "${pkg.name}" credit package.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      confirmButtonText: 'Delete',
    });
    if (!result.isConfirmed) return;
    try {
      await AdminCreditsModel.deletePackage(pkg.id);
      loadData();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.error || 'Failed' });
    }
  };

  const openEditPackage = (pkg: any) => {
    setEditingPkg(pkg);
    setPkgForm({ name: pkg.name, credits: pkg.credits, price: pkg.price, description: pkg.description || '', isActive: !!pkg.isActive });
    setShowPkgForm(true);
  };

  const openCreatePackage = () => {
    setEditingPkg(null);
    setPkgForm({ name: '', credits: 100, price: 10, description: '', isActive: true });
    setShowPkgForm(true);
  };

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await AdminCreditsModel.adjustCredits(adjustForm.team_id, adjustForm.amount, adjustForm.reason);
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
    { key: 'packages', label: 'Credit Packages', icon: BanknotesIcon },
    { key: 'balances', label: 'Team Balances', icon: CurrencyDollarIcon },
    { key: 'transactions', label: 'Transactions', icon: DocumentTextIcon },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <CurrencyDollarIcon className="w-7 h-7 text-amber-500" />
            AI Credits
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage credit packages, view balances, and adjust credits
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

      {/* Packages Tab */}
      {activeTab === 'packages' && (
        <Card>
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Credit Packages</h2>
              <button onClick={openCreatePackage} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium">
                <PlusIcon className="w-4 h-4" /> New Package
              </button>
            </div>
            {packages.length === 0 ? (
              <p className="text-center py-8 text-gray-500">No credit packages configured</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {packages.map((pkg: any) => (
                  <div key={pkg.id} className={`p-4 rounded-xl border ${pkg.isActive ? 'border-gray-200 dark:border-gray-700' : 'border-red-200 dark:border-red-900/50 opacity-60'} bg-white dark:bg-gray-800`}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">{pkg.name}</h3>
                      <div className="flex gap-1">
                        <button onClick={() => openEditPackage(pkg)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><PencilIcon className="w-4 h-4 text-gray-500" /></button>
                        <button onClick={() => handleDeletePackage(pkg)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><TrashIcon className="w-4 h-4 text-red-500" /></button>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-amber-600">{(pkg.totalCredits || pkg.credits || 0).toLocaleString()} <span className="text-sm font-normal text-gray-500">credits</span></p>
                    <p className="text-lg text-gray-700 dark:text-gray-300">{pkg.formattedPrice || `R${(pkg.price / 100).toFixed(2)}`}</p>
                    {pkg.description && <p className="text-xs text-gray-500 mt-1">{pkg.description}</p>}
                    {!pkg.isActive && <span className="text-xs text-red-500 font-medium">Inactive</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Balances Tab */}
      {activeTab === 'balances' && (
        <Card>
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Team Credit Balances</h2>
              <button onClick={() => setShowAdjustForm(true)} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium">
                <AdjustmentsHorizontalIcon className="w-4 h-4" /> Adjust Credits
              </button>
            </div>
            {balances.length === 0 ? (
              <p className="text-center py-8 text-gray-500">No team balances found</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-2 font-medium">Team</th>
                    <th className="pb-2 font-medium text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {balances.map((b: any, i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-3 text-gray-900 dark:text-white">{b.team?.name || `Team #${b.teamId}`}</td>
                      <td className="py-3 text-right font-mono font-bold text-amber-600">{b.formattedBalance || (b.balance || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      )}

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <Card>
          <div className="p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Transactions</h2>
            {transactions.length === 0 ? (
              <p className="text-center py-8 text-gray-500">No transactions found</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Team</th>
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 font-medium text-right">Amount</th>
                    <th className="pb-2 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {transactions.slice(0, 50).map((tx: any, i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-2 text-gray-500 text-xs">{tx.createdAt ? new Date(tx.createdAt).toLocaleString() : '—'}</td>
                      <td className="py-2 text-gray-900 dark:text-white">{tx.team?.name || `#${tx.teamId}`}</td>
                      <td className="py-2 text-gray-600 dark:text-gray-300 capitalize">{tx.type || tx.requestType}</td>
                      <td className={`py-2 text-right font-mono ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>{tx.formattedAmount || ((tx.amount > 0 ? '+' : '') + tx.amount)}</td>
                      <td className="py-2 text-gray-500 text-xs">{tx.description || tx.requestType}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      )}

      {/* Package Form Modal */}
      {showPkgForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editingPkg ? 'Edit Package' : 'New Package'}</h2>
              <button onClick={() => setShowPkgForm(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><XMarkIcon className="w-5 h-5 text-gray-500" /></button>
            </div>
            <form onSubmit={handleSavePackage} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                <input type="text" value={pkgForm.name} onChange={(e) => setPkgForm({ ...pkgForm, name: e.target.value })} required className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Credits</label>
                  <input type="number" min="1" value={pkgForm.credits} onChange={(e) => setPkgForm({ ...pkgForm, credits: parseInt(e.target.value) })} required className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price (ZAR)</label>
                  <input type="number" step="0.01" min="0" value={pkgForm.price} onChange={(e) => setPkgForm({ ...pkgForm, price: parseFloat(e.target.value) })} required className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <input type="text" value={pkgForm.description} onChange={(e) => setPkgForm({ ...pkgForm, description: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="pkg_active" checked={pkgForm.isActive} onChange={(e) => setPkgForm({ ...pkgForm, isActive: e.target.checked })} className="rounded" />
                <label htmlFor="pkg_active" className="text-sm text-gray-700 dark:text-gray-300">Active</label>
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <button type="button" onClick={() => setShowPkgForm(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-amber-600 text-white hover:bg-amber-700 font-medium">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Credits Modal */}
      {showAdjustForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Adjust Credits</h2>
              <button onClick={() => setShowAdjustForm(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><XMarkIcon className="w-5 h-5 text-gray-500" /></button>
            </div>
            <form onSubmit={handleAdjust} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Team</label>
                <select value={adjustForm.team_id} onChange={(e) => setAdjustForm({ ...adjustForm, team_id: e.target.value })} required className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white">
                  <option value="">Select team...</option>
                  {balances.map((b: any) => (
                    <option key={b.teamId} value={b.teamId}>{b.team?.name || `Team #${b.teamId}`} (Balance: {b.formattedBalance || b.balance})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount (positive = add, negative = deduct)</label>
                <input type="number" value={adjustForm.amount} onChange={(e) => setAdjustForm({ ...adjustForm, amount: parseInt(e.target.value) })} required className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason</label>
                <input type="text" value={adjustForm.reason} onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })} required placeholder="e.g., Manual top-up, refund, etc." className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white" />
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

export default AICredits;
