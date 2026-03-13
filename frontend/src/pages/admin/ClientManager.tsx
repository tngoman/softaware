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

/**
 * ClientManager — Now redirects to the unified Clients page (/contacts)
 * but still serves as an overview dashboard for quick client stats.
 * Client detail is accessed via the Contact detail view.
 */
const ClientManager: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

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

  useEffect(() => { loadClients(); }, []);

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
      <div className="bg-gradient-to-r from-picton-blue to-picton-blue/80 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
              <UsersIcon className="w-8 h-8" />
              Clients
            </h1>
            <p className="text-white/90">
              Manage client accounts, assistants, and widgets
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={loadClients} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/20">
              <ArrowPathIcon className="w-4 h-4" /> Refresh
            </button>
            <button onClick={() => navigate('/contacts')} className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-white text-picton-blue hover:bg-gray-50 shadow-md">
              View All Clients
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      {data?.stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500">
                <UsersIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{data.stats.totalClients}</p>
                <p className="text-sm text-gray-500">Total Clients</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-500">
                <CheckCircleIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{data.stats.activeClients}</p>
                <p className="text-sm text-gray-500">Active</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-indigo-500">
                <ChatBubbleLeftRightIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-indigo-600">{data.stats.totalAssistants}</p>
                <p className="text-sm text-gray-500">Total Assistants</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-500">
                <GlobeAltIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">{data.stats.totalWidgets}</p>
                <p className="text-sm text-gray-500">Total Widgets</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Client List */}
      <Card>
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Clients</h2>
            <div className="relative">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search clients..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-3 py-2 text-sm border rounded-lg bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="space-y-2">
            {filteredUsers.map((u: any) => (
              <button
                key={u.id}
                onClick={() => {
                  // Navigate to the contact view if contact_id is linked
                  if (u.contact_id) {
                    navigate(`/contacts/${u.contact_id}`);
                  } else {
                    Swal.fire({ icon: 'info', title: 'No Contact Linked', text: 'This client does not have a linked contact record. Create one in the Clients page.' });
                  }
                }}
                className="w-full text-left p-4 rounded-xl transition-all border bg-white border-gray-200 hover:border-blue-200 hover:shadow-sm"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{u.contact_name || u.name || u.email}</p>
                    <p className="text-xs text-gray-500 truncate">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={u.account_status || 'active'} />
                    <EyeIcon className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
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
                <p className="text-sm text-gray-500">No clients found</p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ClientManager;