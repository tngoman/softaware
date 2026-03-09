import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminClientModel } from '../../models';
import { AuthModel } from '../../models';
import { useAppStore } from '../../store';
import {
  UsersIcon,
  ShieldCheckIcon,
  ShieldExclamationIcon,
  ChatBubbleLeftRightIcon,
  GlobeAltIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  NoSymbolIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { Card } from '../../components/UI';
import Swal from 'sweetalert2';

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { cls: string; icon: React.ComponentType<{ className?: string }> }> = {
    active: { cls: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircleIcon },
    suspended: { cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: NoSymbolIcon },
    demo_expired: { cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', icon: ExclamationTriangleIcon },
  };
  const s = map[status] || map['active'];
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
      <Icon className="w-3 h-3" />{status}
    </span>
  );
};

const ClientManager: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [clientDetail, setClientDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser, setIsAuthenticated } = useAppStore();

  const loadClients = async () => {
    setLoading(true);
    try {
      const res = await AdminClientModel.getOverview();
      setData(res);
    } catch (err: any) {
      console.error('Failed to load clients:', err);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load client data' });
    } finally {
      setLoading(false);
    }
  };

  const loadClientDetail = async (userId: number) => {
    setDetailLoading(true);
    try {
      const detail = await AdminClientModel.getClient(userId);
      setClientDetail(detail);
    } catch (err) {
      console.error('Failed to load client detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleStatusChange = async (userId: number, newStatus: string) => {
    const result = await Swal.fire({
      title: `Set status to "${newStatus}"?`,
      text: newStatus === 'suspended' ? 'This will suspend the account and all associated AI services.' : 'This will change the account status.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: newStatus === 'suspended' ? '#EF4444' : '#3B82F6',
      confirmButtonText: 'Confirm',
    });
    if (!result.isConfirmed) return;

    try {
      if (newStatus === 'suspended') {
        await AdminClientModel.suspendAccount(userId);
      } else if (newStatus === 'active') {
        await AdminClientModel.reactivateAccount(userId);
      } else {
        await AdminClientModel.setAccountStatus(userId, newStatus);
      }
      Swal.fire({ icon: 'success', title: 'Updated', text: `Account status set to ${newStatus}`, timer: 1500, showConfirmButton: false });
      loadClients();
      if (selectedClient?.id === userId) loadClientDetail(userId);
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.error || 'Failed to update status' });
    }
  };

  const handleAssistantStatus = async (assistantId: string, newStatus: string) => {
    try {
      await AdminClientModel.setAssistantStatus(assistantId, newStatus);
      Swal.fire({ icon: 'success', title: 'Updated', timer: 1200, showConfirmButton: false });
      if (selectedClient) loadClientDetail(selectedClient.id);
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.error || 'Failed' });
    }
  };

  const handleWidgetStatus = async (widgetId: number, newStatus: string) => {
    try {
      await AdminClientModel.setWidgetStatus(widgetId, newStatus);
      Swal.fire({ icon: 'success', title: 'Updated', timer: 1200, showConfirmButton: false });
      if (selectedClient) loadClientDetail(selectedClient.id);
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.error || 'Failed' });
    }
  };

  const handleMasquerade = async (userId: string, email: string) => {
    const result = await Swal.fire({
      title: 'Login as User?',
      html: `You will be logged in as <strong>${email}</strong>.<br/><br/>A banner will appear at the top of the page to return to your admin session.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#7C3AED',
      confirmButtonText: 'Login as User',
      cancelButtonText: 'Cancel',
    });
    if (!result.isConfirmed) return;

    try {
      const response = await AdminClientModel.masquerade(userId);
      if (response.success && response.data) {
        const { token, user, adminRestoreToken, adminId } = response.data;

        // Store masquerade state and switch session
        AuthModel.startMasquerade(token, user, adminRestoreToken, adminId);

        // Fetch permissions for the masqueraded user
        try {
          const permissions = await AuthModel.getUserPermissions();
          user.permissions = permissions;
          AuthModel.storeAuth(token, user);
        } catch {
          user.permissions = [];
        }

        // Update store
        setUser(user);
        setIsAuthenticated(true);

        // Navigate to dashboard as the masqueraded user
        navigate('/dashboard');
      }
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Masquerade Failed', text: err.response?.data?.error || 'Failed to login as user' });
    }
  };

  useEffect(() => { loadClients(); }, []);

  useEffect(() => {
    if (selectedClient) loadClientDetail(selectedClient.id);
  }, [selectedClient]);

  const filteredUsers = data?.clients?.filter((u: any) =>
    !search || u.email?.toLowerCase().includes(search.toLowerCase()) || u.name?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <ArrowPathIcon className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <UsersIcon className="w-7 h-7 text-blue-500" />
            Client Manager
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage client accounts, assistants, and widgets • Kill switches
          </p>
        </div>
        <button onClick={loadClients} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300">
          <ArrowPathIcon className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Stats */}
      {data?.stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500">
                <UsersIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.stats.totalClients}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Clients</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-500">
                <CheckCircleIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{data.stats.activeClients}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Active</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-indigo-500">
                <ChatBubbleLeftRightIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-indigo-600">{data.stats.totalAssistants}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Assistants</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-500">
                <GlobeAltIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">{data.stats.totalWidgets}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Widgets</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client List */}
        <Card>
          <div className="p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Clients</h2>
            <div className="relative mb-4">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search clients..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredUsers.map((u: any) => (
                <button
                  key={u.id}
                  onClick={() => setSelectedClient(u)}
                  className={`w-full text-left p-4 rounded-xl transition-all border ${
                    selectedClient?.id === u.id
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 shadow-sm'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-700 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">{u.name || u.email}</p>
                      <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    </div>
                    <StatusBadge status={u.account_status || 'active'} />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />
                      <span>{u.assistant_count} assistants</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <GlobeAltIcon className="w-3.5 h-3.5" />
                      <span>{u.widget_count} widgets</span>
                    </div>
                  </div>
                </button>
              ))}
              {filteredUsers.length === 0 && (
                <div className="text-center py-12">
                  <UsersIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">No clients found</p>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Client Detail */}
        <div className="lg:col-span-2">
          {!selectedClient ? (
            <Card>
              <div className="p-12 text-center">
                <EyeIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Select a Client</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Choose a client from the list to view and manage their account details</p>
              </div>
            </Card>
          ) : detailLoading ? (
            <Card>
              <div className="p-12 flex flex-col items-center justify-center">
                <ArrowPathIcon className="w-8 h-8 text-blue-500 animate-spin mb-3" />
                <p className="text-sm text-gray-500">Loading client details...</p>
              </div>
            </Card>
          ) : clientDetail ? (
            <div className="space-y-4">
              {/* Account Info */}
              <Card>
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                        <span className="text-xl font-bold text-white">{(clientDetail.user?.name || clientDetail.user?.email || 'U')[0].toUpperCase()}</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {clientDetail.user?.name || clientDetail.user?.email}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{clientDetail.user?.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={clientDetail.user?.account_status || 'active'} />
                      <select
                        value={clientDetail.user?.account_status || 'active'}
                        onChange={(e) => handleStatusChange(selectedClient.id, e.target.value)}
                        className="text-sm border rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                        <option value="demo_expired">Demo Expired</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Member Since</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {clientDetail.user?.createdAt ? new Date(clientDetail.user.createdAt).toLocaleDateString() : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Account ID</p>
                      <p className="text-sm font-mono text-gray-900 dark:text-white">{selectedClient.id}</p>
                    </div>
                  </div>
                  {/* Login as User */}
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => handleMasquerade(selectedClient.id, clientDetail.user?.email || selectedClient.email)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-900/20 dark:hover:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800 transition-colors"
                    >
                      <ArrowRightOnRectangleIcon className="w-4 h-4" />
                      Login as this User
                    </button>
                  </div>
                </div>
              </Card>

              {/* Assistants */}
              <Card>
                <div className="p-5">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <ChatBubbleLeftRightIcon className="w-5 h-5 text-indigo-500" />
                    Assistants
                    <span className="text-sm font-normal text-gray-500">({clientDetail.assistants?.length || 0})</span>
                  </h3>
                  {(!clientDetail.assistants || clientDetail.assistants.length === 0) ? (
                    <div className="text-center py-8">
                      <ChatBubbleLeftRightIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-sm text-gray-500">No assistants created yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {clientDetail.assistants.map((a: any) => (
                        <div key={a.id} className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900 dark:text-white">{a.name}</p>
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{a.description || 'No description'}</p>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <StatusBadge status={a.status || 'active'} />
                              <select
                                value={a.status || 'active'}
                                onChange={(e) => handleAssistantStatus(a.id, e.target.value)}
                                className="text-xs border rounded-lg px-2 py-1 bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                              >
                                <option value="active">Active</option>
                                <option value="suspended">Suspended</option>
                              </select>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 rounded-lg">
                              <ShieldCheckIcon className="w-3 h-3" />
                              Tier: {a.tier}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>

              {/* Widgets */}
              <Card>
                <div className="p-5">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <GlobeAltIcon className="w-5 h-5 text-purple-500" />
                    Widgets
                    <span className="text-sm font-normal text-gray-500">({clientDetail.widgets?.length || 0})</span>
                  </h3>
                  {(!clientDetail.widgets || clientDetail.widgets.length === 0) ? (
                    <div className="text-center py-8">
                      <GlobeAltIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-sm text-gray-500">No widgets created yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {clientDetail.widgets.map((w: any) => (
                        <div key={w.id} className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border border-purple-100 dark:border-purple-800">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 dark:text-white truncate">{w.website_url}</p>
                              <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                                <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                                  <ShieldCheckIcon className="w-3 h-3" />
                                  <span>Tier: {w.subscription_tier}</span>
                                </div>
                                <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                                  <ChatBubbleLeftRightIcon className="w-3 h-3" />
                                  <span>{w.message_count}/{w.max_messages} msgs</span>
                                </div>
                                <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400 col-span-2">
                                  <GlobeAltIcon className="w-3 h-3" />
                                  <span>{w.pages_ingested}/{w.max_pages} pages ingested</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <StatusBadge status={w.status || 'active'} />
                              <select
                                value={w.status || 'active'}
                                onChange={(e) => handleWidgetStatus(w.id, e.target.value)}
                                className="text-xs border rounded-lg px-2 py-1 bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                              >
                                <option value="active">Active</option>
                                <option value="suspended">Suspended</option>
                                <option value="upgraded">Upgraded</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ClientManager;
