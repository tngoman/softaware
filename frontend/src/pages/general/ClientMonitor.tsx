import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  SignalIcon,
  ComputerDesktopIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  ShieldExclamationIcon,
  NoSymbolIcon,
  ChatBubbleLeftEllipsisIcon,
  ArrowRightEndOnRectangleIcon,
  TrashIcon,
  EyeIcon,
  XMarkIcon,
  ClockIcon,
  CpuChipIcon,
  WifiIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ServerIcon,
  GlobeAltIcon,
  BugAntIcon,
} from '@heroicons/react/24/outline';
import { notify } from '../../utils/notify';
import Swal from 'sweetalert2';
import api from '../../services/api';
import type { UpdateClient, ClientStatus } from '../../types/updates';

/* ═══════════════════════════════════════════════════════════════
   Client Monitor — Live view of all connected update clients
   Shows heartbeat status, client details, admin actions
   ═══════════════════════════════════════════════════════════════ */

const STATUS_CONFIG: Record<ClientStatus, { label: string; color: string; bg: string; dot: string }> = {
  online:   { label: 'Online',   color: 'text-green-700',  bg: 'bg-green-100',  dot: 'bg-green-500' },
  recent:   { label: 'Recent',   color: 'text-blue-700',   bg: 'bg-blue-100',   dot: 'bg-blue-500' },
  inactive: { label: 'Inactive', color: 'text-yellow-700', bg: 'bg-yellow-100', dot: 'bg-yellow-500' },
  offline:  { label: 'Offline',  color: 'text-gray-700',   bg: 'bg-gray-100',   dot: 'bg-gray-400' },
};

function timeAgo(secondsAgo: number | null, dateStr?: string | null): string {
  if (secondsAgo == null) return 'Never';
  const secs = Math.max(0, Math.round(secondsAgo));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  if (dateStr) return new Date(dateStr).toLocaleDateString();
  return `${days}d ago`;
}

/* ── Detail Drawer ────────────────────────────────────────── */
const ClientDetailDrawer: React.FC<{
  client: UpdateClient | null;
  onClose: () => void;
  onAction: (id: number, action: string, extra?: any) => void;
}> = ({ client, onClose, onAction }) => {
  if (!client) return null;
  const st = STATUS_CONFIG[client.status];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative w-full max-w-md bg-white shadow-xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-5 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <ComputerDesktopIcon className="h-6 w-6 text-gray-500" />
            <div>
              <h3 className="font-semibold text-gray-900">{client.hostname || 'Unknown Host'}</h3>
              <p className="text-xs text-gray-500">{client.software_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Status badge */}
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${st.bg} ${st.color}`}>
              <span className={`h-2 w-2 rounded-full ${st.dot}`} />
              {st.label}
            </span>
            {client.is_blocked === 1 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
                <NoSymbolIcon className="h-3.5 w-3.5" /> Blocked
              </span>
            )}
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <InfoRow icon={GlobeAltIcon} label="IP Address" value={client.ip_address} />
            <InfoRow icon={ComputerDesktopIcon} label="Machine" value={client.machine_name} />
            <InfoRow icon={ServerIcon} label="OS" value={client.os_info} />
            <InfoRow icon={CpuChipIcon} label="Version" value={client.app_version} />
            <InfoRow icon={ClockIcon} label="Last Heartbeat" value={timeAgo(client.seconds_since_heartbeat, client.last_heartbeat)} />
            <InfoRow icon={ClockIcon} label="First Seen" value={client.first_seen ? new Date(client.first_seen).toLocaleDateString() : '—'} />
            <InfoRow icon={SignalIcon} label="Active Page" value={client.active_page} />
            <InfoRow icon={CpuChipIcon} label="CPU" value={client.cpu_usage != null ? `${client.cpu_usage}%` : null} />
          </div>

          {client.user_name && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Logged-in User</p>
              <p className="text-sm font-medium text-gray-900">{client.user_name}</p>
              {client.user_id && <p className="text-xs text-gray-400 font-mono mt-0.5">{client.user_id}</p>}
            </div>
          )}

          {client.last_update_version && (
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs text-blue-600 mb-1">Last Installed Update</p>
              <p className="text-sm font-medium text-blue-900">v{client.last_update_version}</p>
              {client.last_update_installed_at && (
                <p className="text-xs text-blue-500 mt-0.5">
                  Installed {new Date(client.last_update_installed_at).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          {client.blocked_reason && (
            <div className="bg-red-50 rounded-lg p-3">
              <p className="text-xs text-red-600 mb-1">Block Reason</p>
              <p className="text-sm text-red-800">{client.blocked_reason}</p>
            </div>
          )}

          {/* Client Identifier (mono) */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Client Identifier</p>
            <p className="text-xs font-mono text-gray-600 break-all">{client.client_identifier}</p>
          </div>

          {/* Actions */}
          <div className="border-t pt-4 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Actions</p>

            {client.is_blocked ? (
              <ActionBtn
                icon={CheckCircleIcon}
                label="Unblock Client"
                color="green"
                onClick={() => onAction(client.id, 'unblock')}
              />
            ) : (
              <ActionBtn
                icon={NoSymbolIcon}
                label="Block Client"
                color="red"
                onClick={() => onAction(client.id, 'block')}
              />
            )}

            <ActionBtn
              icon={ArrowRightEndOnRectangleIcon}
              label="Force Logout"
              color="yellow"
              onClick={() => onAction(client.id, 'force_logout')}
            />
            <ActionBtn
              icon={ChatBubbleLeftEllipsisIcon}
              label="Send Message"
              color="blue"
              onClick={() => onAction(client.id, 'send_message')}
            />
            <ActionBtn
              icon={TrashIcon}
              label="Delete Client"
              color="red"
              onClick={() => onAction(client.id, 'delete')}
            />
            <ActionBtn
              icon={BugAntIcon}
              label="View Error Reports"
              color="blue"
              onClick={() => onAction(client.id, 'view_errors')}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Small helpers ────────────────────────────────────────── */
const InfoRow: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null | undefined;
}> = ({ icon: Icon, label, value }) => (
  <div>
    <p className="text-xs text-gray-500 flex items-center gap-1">
      <Icon className="h-3.5 w-3.5" /> {label}
    </p>
    <p className="text-sm font-medium text-gray-900 mt-0.5">{value || '—'}</p>
  </div>
);

const ActionBtn: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  onClick: () => void;
}> = ({ icon: Icon, label, color, onClick }) => {
  const colors: Record<string, string> = {
    red: 'text-red-700 hover:bg-red-50',
    green: 'text-green-700 hover:bg-green-50',
    yellow: 'text-yellow-700 hover:bg-yellow-50',
    blue: 'text-blue-700 hover:bg-blue-50',
  };
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition ${colors[color] || colors.blue}`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */

const ClientMonitor: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [clients, setClients] = useState<UpdateClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSoftware, setFilterSoftware] = useState<string>('all');
  const [selectedClient, setSelectedClient] = useState<UpdateClient | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadClients = useCallback(async () => {
    try {
      const res = await api.get('/updates/clients');
      setClients(res.data.clients || []);
    } catch (err: any) {
      notify.error('Failed to load clients');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + auto-refresh
  useEffect(() => {
    loadClients();
    if (!autoRefresh) return;
    const interval = setInterval(loadClients, 15000); // every 15s
    return () => clearInterval(interval);
  }, [loadClients, autoRefresh]);

  /* ── Filtering ─────────────────────────────────────────── */
  const softwareList = Array.from(new Set(clients.map((c) => c.software_name).filter(Boolean))) as string[];

  const filtered = clients.filter((c) => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    if (filterSoftware !== 'all' && c.software_name !== filterSoftware) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (c.hostname || '').toLowerCase().includes(q) ||
        (c.machine_name || '').toLowerCase().includes(q) ||
        (c.ip_address || '').toLowerCase().includes(q) ||
        (c.user_name || '').toLowerCase().includes(q) ||
        (c.app_version || '').toLowerCase().includes(q) ||
        (c.software_name || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  /* ── Summary counts ────────────────────────────────────── */
  const counts = {
    total: clients.length,
    online: clients.filter((c) => c.status === 'online').length,
    recent: clients.filter((c) => c.status === 'recent').length,
    inactive: clients.filter((c) => c.status === 'inactive').length,
    offline: clients.filter((c) => c.status === 'offline').length,
    blocked: clients.filter((c) => c.is_blocked === 1).length,
  };

  /* ── Actions ───────────────────────────────────────────── */
  const handleAction = async (id: number, action: string, extra?: any) => {
    try {
      if (action === 'view_errors') {
        const client = clients.find((c) => c.id === id);
        const hostname = client?.hostname || '';
        navigate(`/error-reports?hostname=${encodeURIComponent(hostname)}`);
        return;
      }

      if (action === 'delete') {
        const result = await Swal.fire({
          title: 'Delete client?',
          text: 'This will permanently remove this client record.',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#dc2626',
          confirmButtonText: 'Delete',
        });
        if (!result.isConfirmed) return;
        await api.delete(`/updates/clients?id=${id}`);
        notify.success('Client deleted');
        loadClients();
        setSelectedClient(null);
        return;
      }

      if (action === 'block') {
        const { value: reason } = await Swal.fire({
          title: 'Block Client',
          input: 'textarea',
          inputLabel: 'Block reason (optional)',
          showCancelButton: true,
          confirmButtonText: 'Block',
          confirmButtonColor: '#dc2626',
        });
        if (reason === undefined) return; // cancelled
        await api.put('/updates/clients', { id, action: 'block', reason: reason || undefined });
        notify.success('Client blocked');
      } else if (action === 'send_message') {
        const { value: message } = await Swal.fire({
          title: 'Send Message to Client',
          input: 'textarea',
          inputLabel: 'Message will appear at next heartbeat',
          inputValidator: (val) => (!val ? 'Message required' : undefined),
          showCancelButton: true,
          confirmButtonText: 'Send',
        });
        if (!message) return;
        await api.put('/updates/clients', { id, action: 'send_message', message });
        notify.success('Message queued');
      } else if (action === 'force_logout') {
        const result = await Swal.fire({
          title: 'Force logout?',
          text: 'The user will be logged out at the next heartbeat.',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Force Logout',
          confirmButtonColor: '#d97706',
        });
        if (!result.isConfirmed) return;
        await api.put('/updates/clients', { id, action: 'force_logout' });
        notify.success('Force logout queued');
      } else if (action === 'unblock') {
        await api.put('/updates/clients', { id, action: 'unblock' });
        notify.success('Client unblocked');
      }

      loadClients();
    } catch (err: any) {
      notify.error(err?.response?.data?.message || 'Action failed');
    }
  };

  /* ── Render ────────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <SignalIcon className="h-7 w-7 text-indigo-600" />
            Client Monitor
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Live heartbeat monitoring across all connected clients
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            Auto-refresh
          </label>
          <button
            onClick={() => { setLoading(true); loadClients(); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50 transition"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryCard label="Total" count={counts.total} color="gray" onClick={() => setFilterStatus('all')} active={filterStatus === 'all'} />
        <SummaryCard label="Online" count={counts.online} color="green" onClick={() => setFilterStatus('online')} active={filterStatus === 'online'} />
        <SummaryCard label="Recent" count={counts.recent} color="blue" onClick={() => setFilterStatus('recent')} active={filterStatus === 'recent'} />
        <SummaryCard label="Inactive" count={counts.inactive} color="yellow" onClick={() => setFilterStatus('inactive')} active={filterStatus === 'inactive'} />
        <SummaryCard label="Offline" count={counts.offline} color="gray" onClick={() => setFilterStatus('offline')} active={filterStatus === 'offline'} />
        <SummaryCard label="Blocked" count={counts.blocked} color="red" onClick={() => setFilterStatus('all')} active={false} />
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search hostname, IP, user, version..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <select
          value={filterSoftware}
          onChange={(e) => setFilterSoftware(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Software</option>
          {softwareList.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Client Table */}
      {loading && clients.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ArrowPathIcon className="h-8 w-8 mx-auto animate-spin mb-3" />
          Loading clients...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ComputerDesktopIcon className="h-10 w-10 mx-auto mb-3" />
          <p className="text-sm">{clients.length === 0 ? 'No clients have connected yet' : 'No clients match your filters'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Software</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Version</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Heartbeat</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP / Activity</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((client) => {
                  const st = STATUS_CONFIG[client.status];
                  return (
                    <tr
                      key={client.id}
                      className="hover:bg-gray-50 cursor-pointer transition"
                      onClick={() => setSelectedClient(client)}
                    >
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full ${st.bg} ${st.color}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                          {st.label}
                        </span>
                        {client.is_blocked === 1 && (
                          <span className="ml-1 inline-flex items-center px-1.5 py-0.5 text-xs rounded-full bg-red-100 text-red-600">
                            <NoSymbolIcon className="h-3 w-3" />
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">{client.hostname || client.machine_name || '—'}</p>
                        <p className="text-xs text-gray-400">{client.os_info || '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{client.software_name || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 font-mono">{client.app_version || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{client.user_name || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{timeAgo(client.seconds_since_heartbeat, client.last_heartbeat)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                        <div>{client.ip_address || '—'}</div>
                        {client.active_page && <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[180px]" title={client.active_page}>{client.active_page}</div>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedClient(client); }}
                          className="text-indigo-600 hover:text-indigo-800 transition"
                          title="View details"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 border-t">
            Showing {filtered.length} of {clients.length} clients
            {autoRefresh && <span className="ml-2">• Auto-refreshing every 15s</span>}
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {selectedClient && (
        <ClientDetailDrawer
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onAction={handleAction}
        />
      )}
    </div>
  );
};

/* ── Summary Card ─────────────────────────────────────────── */
const SummaryCard: React.FC<{
  label: string;
  count: number;
  color: string;
  onClick: () => void;
  active: boolean;
}> = ({ label, count, color, onClick, active }) => {
  const colors: Record<string, { ring: string; text: string; bg: string }> = {
    green:  { ring: 'ring-green-500',  text: 'text-green-700',  bg: 'bg-green-50' },
    blue:   { ring: 'ring-blue-500',   text: 'text-blue-700',   bg: 'bg-blue-50' },
    yellow: { ring: 'ring-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-50' },
    gray:   { ring: 'ring-gray-400',   text: 'text-gray-700',   bg: 'bg-gray-50' },
    red:    { ring: 'ring-red-500',    text: 'text-red-700',    bg: 'bg-red-50' },
  };
  const c = colors[color] || colors.gray;
  return (
    <button
      onClick={onClick}
      className={`p-3 rounded-xl border text-left transition hover:shadow-sm ${active ? `ring-2 ${c.ring} ${c.bg}` : 'bg-white'}`}
    >
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${c.text}`}>{count}</p>
    </button>
  );
};

export default ClientMonitor;
