import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  PlayIcon,
  TableCellsIcon,
  ServerStackIcon,
  PlusIcon,
  XMarkIcon,
  TrashIcon,
  ClockIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  CircleStackIcon,
  CodeBracketIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  KeyIcon,
  ShieldCheckIcon,
  InformationCircleIcon,
  Cog6ToothIcon,
  ListBulletIcon,
  MagnifyingGlassIcon,
  CommandLineIcon,
  DocumentDuplicateIcon,
  BookmarkIcon,
  ArrowTopRightOnSquareIcon,
  ChevronLeftIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  BoltIcon,
  Square3Stack3DIcon,
  PencilSquareIcon,
  PencilIcon,
  CheckIcon,
  FunnelIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowsUpDownIcon,
  DocumentArrowUpIcon,
  DocumentArrowDownIcon,
  StopIcon,
  NoSymbolIcon,
  ClipboardDocumentIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { notify } from '../../utils/notify';
import Swal from 'sweetalert2';
import api, { API_BASE_URL } from '../../services/api';
import { useAppStore } from '../../store';

/* ═══════════════════════════════════════════════════════════════
   Database Manager — rich admin UI for MySQL & MSSQL
   All connections go through SSH tunnel.
   ═══════════════════════════════════════════════════════════════ */

// ── Interfaces ──────────────────────────────────────────────
interface TunnelConfig {
  sshHost: string;
  sshPort: number;
  sshUser: string;
  sshPassword?: string;
  sshKeyFile?: string;
}

interface Connection {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  type: 'mysql' | 'mssql';
  tunnel: TunnelConfig;
  accessUsers?: { userId: string; name: string; email: string }[];
}

interface DeveloperUser {
  id: string;
  name: string;
  email: string;
}

interface QueryResult {
  columns: string[];
  rows: Record<string, any>[];
  affectedRows?: number;
  executionTime?: number;
  error?: string;
  message?: string;
}

interface TableInfo {
  name: string;
  type: string;
  rows?: number;
  engine?: string;
}

interface SSHKeyInfo {
  name: string;
  hasPublicKey: boolean;
  size: number;
}

type MainTab = 'query' | 'browse' | 'structure' | 'info' | 'processes' | 'status' | 'import' | 'export';

const connPayload = (c: Connection, extra?: Record<string, any>) => ({
  host: c.host, port: c.port, user: c.user, password: c.password,
  database: c.database, type: c.type, tunnel: c.tunnel, ...extra,
});

/* ═════════════════════════════════════════════════════════════
   Connection Dialog — with SSH tunnel + key file selector
   ═════════════════════════════════════════════════════════════ */
const ConnectionDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  connection: Connection | null;
  onSave: (conn: Connection, accessUserIds: string[]) => void;
  sshKeys: SSHKeyInfo[];
  isAdmin: boolean;
  developerUsers: DeveloperUser[];
}> = ({ open, onClose, connection, onSave, sshKeys, isAdmin, developerUsers }) => {
  const emptyTunnel: TunnelConfig = { sshHost: '', sshPort: 22, sshUser: '', sshPassword: '', sshKeyFile: '' };
  const [form, setForm] = useState<Connection>({
    id: '', name: '', host: '', port: 3306,
    user: '', password: '', database: '', type: 'mysql',
    tunnel: { ...emptyTunnel },
  });
  const [testingConnection, setTestingConnection] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [userSearch, setUserSearch] = useState('');

  useEffect(() => {
    if (open) {
      if (connection) {
        setForm({ ...connection, tunnel: connection.tunnel || { ...emptyTunnel } });
        setSelectedUserIds(new Set((connection.accessUsers || []).map(u => u.userId)));
      } else {
        setForm({
          id: crypto.randomUUID?.() || String(Date.now()),
          name: '', host: '', port: 3306,
          user: '', password: '', database: '', type: 'mysql',
          tunnel: { ...emptyTunnel, sshKeyFile: sshKeys[0]?.name || '' },
        });
        setSelectedUserIds(new Set());
      }
      setUserSearch('');
    }
  }, [open, connection]);

  const update = (patch: Partial<Connection>) => setForm(prev => ({ ...prev, ...patch }));
  const updateTunnel = (patch: Partial<TunnelConfig>) =>
    setForm(prev => ({ ...prev, tunnel: { ...prev.tunnel, ...patch } }));

  const handleTest = async () => {
    if (!form.tunnel.sshHost) { notify.error('SSH host is required for tunnel'); return; }
    setTestingConnection(true);
    try {
      await api.post('/database/connect', connPayload(form));
      notify.success('Connection successful!');
    } catch (err: any) {
      notify.error(err.response?.data?.error || 'Connection failed');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { notify.error('Connection name is required'); return; }
    if (!form.tunnel.sshHost.trim()) { notify.error('SSH host is required — all connections must tunnel'); return; }
    if (!form.tunnel.sshKeyFile && !form.tunnel.sshPassword) { notify.error('Select an SSH key file or enter an SSH password'); return; }
    onSave(form, Array.from(selectedUserIds));
    onClose();
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b bg-gradient-to-r from-picton-blue/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-picton-blue/10">
              <CircleStackIcon className="h-5 w-5 text-picton-blue" />
            </div>
            <h3 className="text-lg font-semibold">{connection ? 'Edit Connection' : 'New Connection'}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Connection Name + Type */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Connection Name *</label>
              <input value={form.name} onChange={e => update({ name: e.target.value })}
                required className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-picton-blue/30 focus:border-picton-blue" placeholder="Production DB" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Type</label>
              <select value={form.type}
                onChange={e => update({ type: e.target.value as 'mysql' | 'mssql', port: e.target.value === 'mssql' ? 1433 : 3306 })}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-picton-blue/30">
                <option value="mysql">MySQL</option>
                <option value="mssql">SQL Server</option>
              </select>
            </div>
          </div>

          {/* SSH Tunnel Section */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheckIcon className="h-4 w-4 text-amber-600" />
              <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider">SSH Tunnel (Required)</h4>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">SSH Host *</label>
                <input value={form.tunnel.sshHost} onChange={e => updateTunnel({ sshHost: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-300/50" placeholder="ssh.example.com" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">SSH Port</label>
                <input type="number" value={form.tunnel.sshPort}
                  onChange={e => updateTunnel({ sshPort: parseInt(e.target.value) || 22 })}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-300/50" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">SSH Username *</label>
              <input value={form.tunnel.sshUser} onChange={e => updateTunnel({ sshUser: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-300/50" placeholder="root" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                <KeyIcon className="h-3.5 w-3.5 inline mr-1" />SSH Key File
              </label>
              <select value={form.tunnel.sshKeyFile || ''} onChange={e => updateTunnel({ sshKeyFile: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-300/50">
                <option value="">— None (use password) —</option>
                {sshKeys.map(k => (
                  <option key={k.name} value={k.name}>🔑 {k.name} ({k.size} bytes)</option>
                ))}
              </select>
              {sshKeys.length === 0 && (
                <p className="text-[10px] text-amber-600 mt-1">No keys found. Place key files in backend/keys/</p>
              )}
            </div>
            {!form.tunnel.sshKeyFile && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">SSH Password</label>
                <input type="password" value={form.tunnel.sshPassword || ''}
                  onChange={e => updateTunnel({ sshPassword: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-300/50" placeholder="SSH password" />
              </div>
            )}
          </div>

          {/* Database Connection */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Database Server</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Host</label>
                <input value={form.host} onChange={e => update({ host: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-picton-blue/30" placeholder="127.0.0.1" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Port</label>
                <input type="number" value={form.port} onChange={e => update({ port: parseInt(e.target.value) || 3306 })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-picton-blue/30" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Username</label>
                <input value={form.user} onChange={e => update({ user: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-picton-blue/30" placeholder="root" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
                <input type="password" value={form.password} onChange={e => update({ password: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-picton-blue/30" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Database</label>
              <input value={form.database} onChange={e => update({ database: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-picton-blue/30" placeholder="my_database" />
            </div>
          </div>

          {/* User Access Section (admin only) */}
          {isAdmin && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <UsersIcon className="h-4 w-4 text-blue-600" />
                <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider">User Access</h4>
                <span className="text-[10px] text-blue-500 ml-auto">{selectedUserIds.size} user(s) selected</span>
              </div>
              <p className="text-[10px] text-blue-600">
                Select which developers can access this connection. Only users with the "developer" role are shown.
                Admin users always have access.
              </p>
              {developerUsers.length > 0 && (
                <input
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="Search developers…"
                  className="w-full px-3 py-1.5 border rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-300/50"
                />
              )}
              <div className="max-h-40 overflow-y-auto space-y-1">
                {developerUsers.length === 0 ? (
                  <p className="text-[10px] text-gray-400 text-center py-2">No developer users found</p>
                ) : (
                  developerUsers
                    .filter(u => {
                      if (!userSearch.trim()) return true;
                      const q = userSearch.toLowerCase();
                      return (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
                    })
                    .map(u => (
                      <label key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-blue-100/50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedUserIds.has(u.id)}
                          onChange={() => {
                            setSelectedUserIds(prev => {
                              const next = new Set(prev);
                              if (next.has(u.id)) next.delete(u.id); else next.add(u.id);
                              return next;
                            });
                          }}
                          className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium text-gray-700 block truncate">{u.name || u.email}</span>
                          {u.name && <span className="text-[10px] text-gray-400 block truncate">{u.email}</span>}
                        </div>
                      </label>
                    ))
                )}
              </div>
              {developerUsers.length > 0 && (
                <div className="flex items-center gap-2 pt-1 border-t border-blue-100">
                  <button type="button" onClick={() => setSelectedUserIds(new Set(developerUsers.map(u => u.id)))}
                    className="text-[10px] text-blue-600 hover:underline">Select all</button>
                  <button type="button" onClick={() => setSelectedUserIds(new Set())}
                    className="text-[10px] text-blue-600 hover:underline">Clear all</button>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t">
            <button type="button" onClick={handleTest} disabled={testingConnection}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-emerald-300 text-emerald-700 rounded-lg hover:bg-emerald-50 disabled:opacity-50 transition-colors">
              {testingConnection ? <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" /> : <BoltIcon className="h-3.5 w-3.5" />}
              Test Connection
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
              <button type="submit"
                className="px-6 py-2 text-sm font-medium bg-picton-blue text-white rounded-lg hover:bg-picton-blue/90 transition-colors">
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ═════════════════════════════════════════════════════════════
   Table Browser Panel — Adminer-style data viewer + editor
   ═════════════════════════════════════════════════════════════ */
const TableBrowser: React.FC<{
  conn: Connection;
  tableName: string;
  onRunQuery: (sql: string) => void;
}> = ({ conn, tableName, onRunQuery }) => {
  const [data, setData] = useState<{ columns: string[]; rows: any[]; total: number } | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(false);
  // Sort
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('ASC');
  // Filters
  const [filters, setFilters] = useState<{ column: string; operator: string; value: string }[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  // Row editing
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editData, setEditData] = useState<Record<string, any>>({});
  const [showInsert, setShowInsert] = useState(false);
  const [insertData, setInsertData] = useState<Record<string, any>>({});
  // Row selection
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  // Column info (for PK detection)
  const [colInfo, setColInfo] = useState<any[]>([]);
  // Text search
  const [searchText, setSearchText] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  // Jump to page
  const [jumpPage, setJumpPage] = useState('');

  const primaryKeys = colInfo.filter((c: any) => c.Key === 'PRI' || c.key_column === 1).map((c: any) => c.Field || c.COLUMN_NAME || c.name);

  const buildWhere = (row: any) => {
    if (primaryKeys.length > 0) {
      const w: Record<string, any> = {};
      primaryKeys.forEach(k => { w[k] = row[k] ?? null; });
      return w;
    }
    // Fallback: use all columns
    const w: Record<string, any> = {};
    Object.keys(row).forEach(k => { w[k] = row[k]; });
    return w;
  };

  const load = useCallback(async (p: number, ps?: number, sc?: string | null, sd?: 'ASC' | 'DESC', f?: typeof filters) => {
    setLoading(true);
    try {
      const activeFilters = (f ?? filters).filter(fl => fl.column && (fl.operator === 'IS NULL' || fl.operator === 'IS NOT NULL' || fl.value));
      // Add text search as LIKE filter on all columns if searchText is set
      const allFilters = [...activeFilters];
      const res = await api.post('/database/table-data', {
        ...connPayload(conn), table: tableName,
        page: p, pageSize: ps ?? pageSize,
        sortColumn: sc !== undefined ? sc : sortCol,
        sortDirection: sd ?? sortDir,
        filters: allFilters.length > 0 ? allFilters : undefined,
      });
      setData(res.data);
      setPage(p);
      setEditingRow(null);
      setSelectedRows(new Set());
    } catch (err: any) {
      notify.error(err.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [conn, tableName, pageSize, sortCol, sortDir, filters]);

  // Load column info for PK detection
  useEffect(() => {
    api.post('/database/describe', { ...connPayload(conn), table: tableName })
      .then(r => setColInfo(r.data?.columns || []))
      .catch(() => {});
  }, [tableName]);

  useEffect(() => {
    setSortCol(null); setSortDir('ASC'); setFilters([]); setSearchText(''); setShowSearch(false);
    load(1, pageSize, null, 'ASC', []);
  }, [tableName]);

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  const handleSort = (col: string) => {
    let newDir: 'ASC' | 'DESC' = 'ASC';
    if (sortCol === col) newDir = sortDir === 'ASC' ? 'DESC' : 'ASC';
    setSortCol(col);
    setSortDir(newDir);
    load(1, pageSize, col, newDir);
  };

  const addFilter = () => setFilters(prev => [...prev, { column: data?.columns[0] || '', operator: 'LIKE', value: '' }]);
  const removeFilter = (i: number) => { const n = filters.filter((_, j) => j !== i); setFilters(n); load(1, pageSize, sortCol, sortDir, n); };
  const updateFilter = (i: number, patch: Partial<typeof filters[0]>) => setFilters(prev => prev.map((f, j) => j === i ? { ...f, ...patch } : f));
  const applyFilters = () => load(1, pageSize, sortCol, sortDir);

  const handleTextSearch = () => {
    if (!searchText.trim() || !data?.columns.length) return;
    // Create a LIKE filter on the first column, or use the query editor for multi-col search
    const f = [{ column: data.columns[0], operator: 'LIKE', value: searchText }];
    setFilters(f);
    setShowFilters(true);
    load(1, pageSize, sortCol, sortDir, f);
  };

  const clearAllFilters = () => {
    setFilters([]);
    setSearchText('');
    load(1, pageSize, sortCol, sortDir, []);
  };

  // Row editing
  const startEdit = (i: number) => {
    if (!data) return;
    setEditingRow(i);
    setEditData({ ...data.rows[i] });
  };
  const cancelEdit = () => { setEditingRow(null); setEditData({}); };
  const saveEdit = async () => {
    if (editingRow === null || !data) return;
    try {
      const origRow = data.rows[editingRow];
      const where = buildWhere(origRow);
      // Only send changed fields
      const changes: Record<string, any> = {};
      for (const k of Object.keys(editData)) {
        if (String(editData[k] ?? '') !== String(origRow[k] ?? '')) changes[k] = editData[k];
      }
      if (Object.keys(changes).length === 0) { cancelEdit(); return; }
      await api.post('/database/row-update', { ...connPayload(conn), table: tableName, row: changes, where });
      notify.success('Row updated');
      load(page);
    } catch (err: any) {
      notify.error(err.response?.data?.error || 'Update failed');
    }
  };

  // Insert row
  const handleInsert = async () => {
    const nonEmpty = Object.fromEntries(Object.entries(insertData).filter(([_, v]) => v !== undefined && v !== ''));
    if (Object.keys(nonEmpty).length === 0) { notify.error('No data to insert'); return; }
    try {
      await api.post('/database/row-insert', { ...connPayload(conn), table: tableName, row: nonEmpty });
      notify.success('Row inserted');
      setShowInsert(false);
      setInsertData({});
      load(page);
    } catch (err: any) {
      notify.error(err.response?.data?.error || 'Insert failed');
    }
  };

  // Delete row
  const deleteRow = async (row: any) => {
    const r = await Swal.fire({
      title: 'Delete Row?', text: 'This cannot be undone.', icon: 'warning',
      showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Delete',
    });
    if (!r.isConfirmed) return;
    try {
      const where = buildWhere(row);
      await api.post('/database/row-delete', { ...connPayload(conn), table: tableName, where });
      notify.success('Row deleted');
      load(page);
    } catch (err: any) {
      notify.error(err.response?.data?.error || 'Delete failed');
    }
  };

  // Delete selected rows
  const deleteSelected = async () => {
    if (selectedRows.size === 0) return;
    const r = await Swal.fire({
      title: `Delete ${selectedRows.size} row(s)?`, text: 'This cannot be undone.', icon: 'warning',
      showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Delete All',
    });
    if (!r.isConfirmed) return;
    let ok = 0;
    for (const i of Array.from(selectedRows)) {
      try {
        const where = buildWhere(data!.rows[i]);
        await api.post('/database/row-delete', { ...connPayload(conn), table: tableName, where });
        ok++;
      } catch {}
    }
    notify.success(`${ok} row(s) deleted`);
    setSelectedRows(new Set());
    load(page);
  };

  // Export helpers
  const exportBrowseCSV = () => {
    if (!data) return;
    const esc = (v: any) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const csv = [data.columns.map(esc).join(','), ...data.rows.map(r => data.columns.map(c => esc(r[c])).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${tableName}.csv`; a.click();
    URL.revokeObjectURL(url);
    notify.success('CSV exported');
  };

  const exportBrowseJSON = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data.rows, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${tableName}.json`; a.click();
    URL.revokeObjectURL(url);
    notify.success('JSON exported');
  };

  const exportBrowseSQL = () => {
    if (!data || data.rows.length === 0) return;
    const safe = tableName.replace(/`/g, '');
    const lines = data.rows.map(row => {
      const vals = data.columns.map(c => row[c] === null ? 'NULL' : `'${String(row[c]).replace(/'/g, "\\'")}'`);
      return `INSERT INTO \`${safe}\` (\`${data.columns.join('`, `')}\`) VALUES (${vals.join(', ')});`;
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${tableName}_insert.sql`; a.click();
    URL.revokeObjectURL(url);
    notify.success('SQL export created');
  };

  const copyRows = () => {
    if (!data) return;
    const text = [data.columns.join('\t'), ...data.rows.map(r => data.columns.map(c => r[c] ?? '').join('\t'))].join('\n');
    navigator.clipboard.writeText(text);
    notify.success('Copied to clipboard');
  };

  const selectAll = () => {
    if (!data) return;
    if (selectedRows.size === data.rows.length) setSelectedRows(new Set());
    else setSelectedRows(new Set(data.rows.map((_, i) => i)));
  };

  const toggleSelect = (i: number) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const OPERATORS = ['LIKE', '=', '!=', '>', '<', '>=', '<=', 'REGEXP', 'IS NULL', 'IS NOT NULL'];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar Row 1 — Table name, search, actions */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border-b text-xs flex-wrap">
        <TableCellsIcon className="h-4 w-4 text-gray-400" />
        <span className="font-semibold text-gray-700">{tableName}</span>
        {data && <span className="text-gray-400">({data.total.toLocaleString()} rows)</span>}

        <div className="w-px h-4 bg-gray-200 mx-1" />

        {/* Search */}
        <div className="flex items-center gap-1">
          <button onClick={() => setShowSearch(!showSearch)} className={`p-1 rounded ${showSearch ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-200 text-gray-400'}`} title="Search">
            <MagnifyingGlassIcon className="h-3.5 w-3.5" />
          </button>
          {showSearch && (
            <>
              <input value={searchText} onChange={e => setSearchText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleTextSearch()}
                placeholder="Search…" className="px-2 py-1 border rounded text-[11px] w-36 focus:ring-1 focus:ring-blue-300" />
              {searchText && <button onClick={clearAllFilters} className="text-gray-400 hover:text-red-500"><XMarkIcon className="h-3 w-3" /></button>}
            </>
          )}
        </div>

        {/* Filter toggle */}
        <button onClick={() => { setShowFilters(!showFilters); if (!showFilters && filters.length === 0) addFilter(); }}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] ${showFilters || filters.length > 0 ? 'bg-amber-100 text-amber-700' : 'hover:bg-gray-200 text-gray-500'}`}>
          <FunnelIcon className="h-3 w-3" />
          {filters.length > 0 ? `${filters.length} filter${filters.length > 1 ? 's' : ''}` : 'Filter'}
        </button>

        <div className="flex-1" />

        {/* Limit selector */}
        <label className="text-[10px] text-gray-400">Limit:</label>
        <select value={pageSize} onChange={e => { const ps = +e.target.value; setPageSize(ps); load(1, ps); }}
          className="px-1.5 py-0.5 border rounded text-[11px] bg-white w-16">
          {[20, 50, 100, 200, 500, 1000].map(n => <option key={n} value={n}>{n}</option>)}
        </select>

        <div className="w-px h-4 bg-gray-200 mx-0.5" />

        {/* Row actions */}
        <button onClick={() => { setShowInsert(!showInsert); if (!showInsert) { const d: Record<string, any> = {}; data?.columns.forEach(c => d[c] = ''); setInsertData(d); } }}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium ${showInsert ? 'bg-emerald-100 text-emerald-700' : 'hover:bg-emerald-50 text-emerald-600 border border-emerald-200'}`}
          title="New row">
          <PlusIcon className="h-3 w-3" /> New Row
        </button>

        {selectedRows.size > 0 && (
          <button onClick={deleteSelected}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-red-50 text-red-600 hover:bg-red-100 border border-red-200">
            <TrashIcon className="h-3 w-3" /> Delete {selectedRows.size}
          </button>
        )}

        <div className="w-px h-4 bg-gray-200 mx-0.5" />

        {/* Export */}
        <div className="flex items-center gap-0.5">
          <button onClick={copyRows} className="p-1 rounded hover:bg-gray-200 text-gray-400" title="Copy to clipboard">
            <ClipboardDocumentIcon className="h-3.5 w-3.5" />
          </button>
          <button onClick={exportBrowseCSV} className="p-1 rounded hover:bg-gray-200 text-gray-400" title="Export CSV">
            <ArrowDownTrayIcon className="h-3.5 w-3.5" />
          </button>
          <button onClick={exportBrowseJSON} className="inline-flex items-center gap-0.5 px-1.5 py-1 rounded hover:bg-gray-200 text-gray-400 text-[10px]" title="Export JSON">
            JSON
          </button>
          <button onClick={exportBrowseSQL} className="inline-flex items-center gap-0.5 px-1.5 py-1 rounded hover:bg-gray-200 text-gray-400 text-[10px]" title="Export as INSERT SQL">
            SQL
          </button>
        </div>

        <button onClick={() => load(page)} className="p-1 rounded hover:bg-gray-200" title="Refresh">
          <ArrowPathIcon className={`h-3.5 w-3.5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filters bar */}
      {showFilters && (
        <div className="px-3 py-2 bg-amber-50/50 border-b space-y-1.5">
          {filters.map((f, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[11px]">
              <span className="text-gray-400 w-8 text-right">{i === 0 ? 'WHERE' : 'AND'}</span>
              <select value={f.column} onChange={e => updateFilter(i, { column: e.target.value })}
                className="px-1.5 py-1 border rounded bg-white text-[11px] max-w-[140px]">
                {data?.columns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={f.operator} onChange={e => updateFilter(i, { operator: e.target.value })}
                className="px-1.5 py-1 border rounded bg-white text-[11px] w-24">
                {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
              </select>
              {!['IS NULL', 'IS NOT NULL'].includes(f.operator) && (
                <input value={f.value} onChange={e => updateFilter(i, { value: e.target.value })}
                  onKeyDown={e => e.key === 'Enter' && applyFilters()}
                  placeholder="value" className="px-2 py-1 border rounded text-[11px] flex-1 max-w-[200px] font-mono" />
              )}
              <button onClick={() => removeFilter(i)} className="p-0.5 rounded hover:bg-red-100 text-red-400"><XMarkIcon className="h-3 w-3" /></button>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1">
            <button onClick={addFilter} className="text-[11px] text-blue-600 hover:underline">+ Add condition</button>
            <button onClick={applyFilters} className="px-3 py-1 text-[11px] bg-amber-500 text-white rounded hover:bg-amber-600 font-medium">Apply</button>
            <button onClick={clearAllFilters} className="px-2 py-1 text-[11px] text-gray-500 hover:text-red-500">Clear all</button>
          </div>
        </div>
      )}

      {/* Insert row form */}
      {showInsert && data && (
        <div className="px-3 py-2 bg-emerald-50/50 border-b">
          <div className="flex items-center gap-2 mb-2">
            <PlusIcon className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-[11px] font-semibold text-emerald-800">Insert New Row</span>
            <div className="flex-1" />
            <button onClick={handleInsert} className="px-3 py-1 text-[11px] bg-emerald-500 text-white rounded hover:bg-emerald-600 font-medium">Insert</button>
            <button onClick={() => setShowInsert(false)} className="px-2 py-1 text-[11px] text-gray-500 hover:text-gray-700">Cancel</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
            {data.columns.map(col => (
              <div key={col}>
                <label className="text-[9px] text-gray-500 font-medium uppercase tracking-wider">{col}</label>
                <input value={insertData[col] || ''} onChange={e => setInsertData(prev => ({ ...prev, [col]: e.target.value }))}
                  className="w-full px-2 py-1 border rounded text-[11px] font-mono bg-white focus:ring-1 focus:ring-emerald-300"
                  placeholder="NULL" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="flex-1 overflow-auto">
        {loading && !data ? (
          <div className="flex items-center justify-center h-full">
            <ArrowPathIcon className="h-6 w-6 animate-spin text-gray-300" />
          </div>
        ) : data && data.columns.length > 0 ? (
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-gray-100 z-10">
              <tr>
                <th className="px-1 py-2 border-b w-8">
                  <input type="checkbox" checked={data.rows.length > 0 && selectedRows.size === data.rows.length}
                    onChange={selectAll} className="h-3 w-3 rounded border-gray-300" />
                </th>
                <th className="px-2 py-2 text-left font-semibold text-gray-500 border-b w-10">#</th>
                {data.columns.map(col => (
                  <th key={col} className="px-2 py-2 text-left font-semibold text-gray-600 border-b whitespace-nowrap cursor-pointer hover:bg-gray-200 select-none group"
                    onClick={() => handleSort(col)}>
                    <span className="inline-flex items-center gap-1">
                      {col}
                      {primaryKeys.includes(col) && <KeyIcon className="h-2.5 w-2.5 text-amber-500" />}
                      {sortCol === col
                        ? (sortDir === 'ASC' ? <ArrowUpIcon className="h-3 w-3 text-blue-500" /> : <ArrowDownIcon className="h-3 w-3 text-blue-500" />)
                        : <ArrowsUpDownIcon className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100" />}
                    </span>
                  </th>
                ))}
                <th className="px-2 py-2 text-center font-semibold text-gray-500 border-b w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (
                <tr key={i} className={`border-b border-gray-50 ${selectedRows.has(i) ? 'bg-blue-50' : 'hover:bg-gray-50/80'} ${editingRow === i ? 'bg-yellow-50' : ''}`}>
                  <td className="px-1 py-1 text-center">
                    <input type="checkbox" checked={selectedRows.has(i)} onChange={() => toggleSelect(i)} className="h-3 w-3 rounded border-gray-300" />
                  </td>
                  <td className="px-2 py-1 text-gray-400 font-mono text-[10px]">{(page - 1) * pageSize + i + 1}</td>
                  {data.columns.map(col => (
                    <td key={col} className="px-2 py-1 max-w-[280px] font-mono">
                      {editingRow === i ? (
                        <input value={editData[col] ?? ''} onChange={e => setEditData(prev => ({ ...prev, [col]: e.target.value }))}
                          className="w-full px-1.5 py-0.5 border border-yellow-300 rounded text-[11px] font-mono bg-yellow-50 focus:ring-1 focus:ring-yellow-400 min-w-[60px]" />
                      ) : (
                        <span className="truncate block" title={row[col] !== null ? String(row[col]) : 'NULL'}>
                          {row[col] === null
                            ? <span className="text-gray-300 italic text-[10px]">NULL</span>
                            : typeof row[col] === 'boolean'
                              ? <span className={`text-[10px] px-1.5 py-0.5 rounded ${row[col] ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{String(row[col])}</span>
                              : String(row[col]).length > 100 ? String(row[col]).substring(0, 100) + '…' : String(row[col])}
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="px-2 py-1 text-center">
                    {editingRow === i ? (
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={saveEdit} className="p-0.5 rounded hover:bg-emerald-100 text-emerald-600" title="Save"><CheckIcon className="h-3.5 w-3.5" /></button>
                        <button onClick={cancelEdit} className="p-0.5 rounded hover:bg-gray-200 text-gray-400" title="Cancel"><XMarkIcon className="h-3.5 w-3.5" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-0.5">
                        <button onClick={() => startEdit(i)} className="p-0.5 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600" title="Edit row">
                          <PencilIcon className="h-3 w-3" />
                        </button>
                        <button onClick={() => deleteRow(row)} className="p-0.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-500" title="Delete row">
                          <TrashIcon className="h-3 w-3" />
                        </button>
                        <button onClick={() => { navigator.clipboard.writeText(JSON.stringify(row, null, 2)); notify.success('Row copied'); }}
                          className="p-0.5 rounded hover:bg-gray-200 text-gray-400" title="Copy row as JSON">
                          <ClipboardDocumentIcon className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">
            {filters.length > 0 ? 'No rows match the filter criteria' : 'No data'}
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-t text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <span>
            {data ? `${((page - 1) * pageSize + 1).toLocaleString()}–${Math.min(page * pageSize, data.total).toLocaleString()} of ${data.total.toLocaleString()}` : '—'}
          </span>
          {sortCol && (
            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px]">
              ↕ {sortCol} {sortDir}
              <button onClick={() => { setSortCol(null); load(1, pageSize, null, 'ASC'); }} className="ml-1 hover:text-red-500">×</button>
            </span>
          )}
          {filters.length > 0 && (
            <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded text-[10px]">
              {filters.length} filter(s)
              <button onClick={clearAllFilters} className="ml-1 hover:text-red-500">×</button>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-400 mr-1">Page {page}/{totalPages || 1}</span>
          <input
            value={jumpPage}
            onChange={e => setJumpPage(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { const p = parseInt(jumpPage); if (p >= 1 && p <= totalPages) { load(p); setJumpPage(''); } } }}
            placeholder="#"
            className="w-10 px-1.5 py-0.5 border rounded text-[11px] text-center"
            title="Jump to page"
          />
          <button onClick={() => load(1)} disabled={page <= 1} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30">
            <ChevronDoubleLeftIcon className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => load(page - 1)} disabled={page <= 1} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30">
            <ChevronLeftIcon className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => load(page + 1)} disabled={page >= totalPages} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30">
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => load(totalPages)} disabled={page >= totalPages} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30">
            <ChevronDoubleRightIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ═════════════════════════════════════════════════════════════
   Main Database Manager Page
   ═════════════════════════════════════════════════════════════ */
const DatabaseManager: React.FC = () => {
  const { user } = useAppStore();
  const isAdmin = !!user?.is_admin;

  // Connections (shared via backend API)
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [activeConnection, setActiveConnection] = useState<Connection | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // SSH keys
  const [sshKeys, setSshKeys] = useState<SSHKeyInfo[]>([]);

  // Developer users (for access control)
  const [developerUsers, setDeveloperUsers] = useState<DeveloperUser[]>([]);

  // Query editor
  const [sql, setSql] = useState('SELECT 1;');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [executing, setExecuting] = useState(false);
  const [queryHistory, setQueryHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('db_query_history') || '[]'); } catch { return []; }
  });
  const [savedQueries, setSavedQueries] = useState<{ name: string; sql: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem('db_saved_queries') || '[]'); } catch { return []; }
  });

  // Tables + structure
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [tableColumns, setTableColumns] = useState<Record<string, any[]>>({});

  // Databases
  const [databases, setDatabases] = useState<string[]>([]);

  // UI state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConn, setEditingConn] = useState<Connection | null>(null);
  const [mainTab, setMainTab] = useState<MainTab>('query');
  const [browsingTable, setBrowsingTable] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Extra data for tabs
  const [tableInfo, setTableInfo] = useState<any>(null);
  const [tableIndexes, setTableIndexes] = useState<any[]>([]);
  const [createSQL, setCreateSQL] = useState('');
  const [processes, setProcesses] = useState<any[]>([]);
  const [serverStatus, setServerStatus] = useState<any>(null);
  const [infoTable, setInfoTable] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load SSH keys, shared connections, and developer users on mount
  useEffect(() => {
    api.get('/database/keys').then(r => setSshKeys(r.data?.keys || [])).catch(() => {});
    api.get('/database/connections')
      .then(r => setConnections(r.data?.connections || []))
      .catch(() => {})
      .finally(() => setLoadingConnections(false));
    if (isAdmin) {
      api.get('/database/developer-users')
        .then(r => setDeveloperUsers(r.data?.users || []))
        .catch(() => {});
    }
  }, []);

  // Save query history/saved queries to localStorage (per-user preference)
  useEffect(() => { localStorage.setItem('db_query_history', JSON.stringify(queryHistory)); }, [queryHistory]);
  useEffect(() => { localStorage.setItem('db_saved_queries', JSON.stringify(savedQueries)); }, [savedQueries]);

  // ── Connection ops ────────────────────────────────────────
  const saveConnection = async (conn: Connection, accessUserIds?: string[]) => {
    try {
      const res = await api.post('/database/connections', { ...conn, accessUserIds });
      const savedId = res.data?.id || conn.id;
      const saved = { ...conn, id: savedId };
      // Refresh connections list to get updated accessUsers from server
      const refreshRes = await api.get('/database/connections');
      setConnections(refreshRes.data?.connections || []);
      notify.success('Connection saved');
    } catch (err: any) {
      notify.error(err.response?.data?.error || 'Failed to save connection');
    }
  };

  const deleteConnection = async (conn: Connection) => {
    const r = await Swal.fire({
      title: 'Delete Connection', text: `Remove "${conn.name}"?`, icon: 'warning',
      showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Delete',
    });
    if (!r.isConfirmed) return;
    try {
      await api.delete(`/database/connections/${conn.id}`);
      setConnections(prev => prev.filter(c => c.id !== conn.id));
      if (activeConnection?.id === conn.id) { setActiveConnection(null); setConnected(false); }
      notify.success('Removed');
    } catch (err: any) {
      notify.error(err.response?.data?.error || 'Failed to delete connection');
    }
  };

  const handleConnect = async (conn: Connection) => {
    setConnecting(true);
    setActiveConnection(conn);
    try {
      await api.post('/database/connect', connPayload(conn));
      setConnected(true);
      notify.success(`Connected to ${conn.name}`);
      fetchTables(conn);
      fetchDatabases(conn);
    } catch (err: any) {
      notify.error(err.response?.data?.error || 'Connection failed');
      setConnected(false);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setConnected(false);
    setTables([]);
    setDatabases([]);
    setResult(null);
    setBrowsingTable(null);
    notify.success('Disconnected');
  };

  // ── Data fetching ─────────────────────────────────────────
  const fetchTables = async (conn?: Connection) => {
    const c = conn || activeConnection;
    if (!c) return;
    setLoadingTables(true);
    try {
      const res = await api.post('/database/tables', connPayload(c));
      setTables(res.data?.tables || []);
    } catch { setTables([]); }
    finally { setLoadingTables(false); }
  };

  const fetchDatabases = async (conn?: Connection) => {
    const c = conn || activeConnection;
    if (!c) return;
    try {
      const res = await api.post('/database/databases', connPayload(c));
      setDatabases(res.data?.databases || []);
    } catch { setDatabases([]); }
  };

  const fetchTableColumns = async (tableName: string) => {
    if (tableColumns[tableName] || !activeConnection) return;
    try {
      const res = await api.post('/database/describe', { ...connPayload(activeConnection), table: tableName });
      setTableColumns(prev => ({ ...prev, [tableName]: res.data?.columns || [] }));
    } catch { /* silently fail */ }
  };

  const switchDatabase = async (dbName: string) => {
    if (!activeConnection) return;
    const updated = { ...activeConnection, database: dbName };
    setActiveConnection(updated);
    saveConnection(updated);
    fetchTables(updated);
    notify.success(`Switched to ${dbName}`);
  };

  // ── Query execution ───────────────────────────────────────
  const handleExecute = useCallback(async () => {
    const query = sql.trim();
    if (!query || !activeConnection) return;
    setExecuting(true);
    setResult(null);
    setMainTab('query');
    try {
      const start = performance.now();
      const res = await api.post('/database/query', { ...connPayload(activeConnection), sql: query });
      const duration = performance.now() - start;
      setResult({
        columns: res.data.columns || [],
        rows: res.data.rows || [],
        affectedRows: res.data.affectedRows,
        executionTime: Math.round(duration),
        message: res.data.message,
      });
      setQueryHistory(prev => [query, ...prev.filter(q => q !== query)].slice(0, 100));
      if (/^\s*(CREATE|DROP|ALTER|TRUNCATE)/i.test(query)) fetchTables();
    } catch (err: any) {
      setResult({ columns: [], rows: [], error: err.response?.data?.error || 'Query execution failed' });
    } finally { setExecuting(false); }
  }, [sql, activeConnection]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleExecute(); }
    // Tab → insert 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const t = textareaRef.current;
      if (t) {
        const start = t.selectionStart;
        const end = t.selectionEnd;
        const v = sql.substring(0, start) + '  ' + sql.substring(end);
        setSql(v);
        setTimeout(() => { t.selectionStart = t.selectionEnd = start + 2; }, 0);
      }
    }
  };

  // ── Export helpers ─────────────────────────────────────────
  const exportCSV = () => {
    if (!result || result.columns.length === 0) return;
    const esc = (v: any) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const csv = [result.columns.join(','), ...result.rows.map(r => result.columns.map(c => esc(r[c])).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'query_result.csv'; a.click();
    URL.revokeObjectURL(url);
    notify.success('CSV exported');
  };

  const exportJSON = () => {
    if (!result || result.rows.length === 0) return;
    const blob = new Blob([JSON.stringify(result.rows, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'query_result.json'; a.click();
    URL.revokeObjectURL(url);
    notify.success('JSON exported');
  };

  const copyToClipboard = () => {
    if (!result || result.columns.length === 0) return;
    const text = [result.columns.join('\t'), ...result.rows.map(r => result.columns.map(c => r[c] ?? '').join('\t'))].join('\n');
    navigator.clipboard.writeText(text);
    notify.success('Copied to clipboard');
  };

  // ── Table info tab ────────────────────────────────────────
  const loadTableInfo = async (table: string) => {
    if (!activeConnection) return;
    setInfoTable(table);
    setMainTab('info');
    try {
      const [sizeRes, idxRes, ddlRes] = await Promise.all([
        api.post('/database/table-size', { ...connPayload(activeConnection), table }),
        api.post('/database/indexes', { ...connPayload(activeConnection), table }),
        api.post('/database/table-create-sql', { ...connPayload(activeConnection), table }),
      ]);
      setTableInfo(sizeRes.data?.size || {});
      setTableIndexes(idxRes.data?.indexes || []);
      setCreateSQL(ddlRes.data?.sql || '');
    } catch (err: any) {
      notify.error('Failed to load table info');
    }
  };

  // ── Processes / Status ────────────────────────────────────
  const loadProcesses = async () => {
    if (!activeConnection) return;
    setMainTab('processes');
    try {
      const res = await api.post('/database/processes', connPayload(activeConnection));
      setProcesses(res.data?.processes || []);
    } catch { notify.error('Failed to load processes'); }
  };

  const loadStatus = async () => {
    if (!activeConnection) return;
    setMainTab('status');
    try {
      const res = await api.post('/database/status', connPayload(activeConnection));
      setServerStatus(res.data?.status || {});
    } catch { notify.error('Failed to load status'); }
  };

  // ── Saved queries ─────────────────────────────────────────
  const saveQuery = () => {
    if (!sql.trim()) return;
    Swal.fire({
      title: 'Save Query', input: 'text', inputPlaceholder: 'Query name…',
      showCancelButton: true, confirmButtonText: 'Save',
      inputValidator: v => !v ? 'Name required' : null,
    }).then(r => {
      if (r.isConfirmed && r.value) {
        setSavedQueries(prev => [...prev, { name: r.value, sql: sql.trim() }]);
        notify.success('Query saved');
      }
    });
  };

  // ── Quick query helpers ───────────────────────────────────
  const quickSelect = (table: string) => {
    const q = activeConnection?.type === 'mssql'
      ? `SELECT TOP 100 * FROM [${table}]`
      : `SELECT * FROM \`${table}\` LIMIT 100`;
    setSql(q);
    setMainTab('query');
  };

  const quickCount = (table: string) => {
    const q = activeConnection?.type === 'mssql'
      ? `SELECT COUNT(*) AS total FROM [${table}]`
      : `SELECT COUNT(*) AS total FROM \`${table}\``;
    setSql(q);
    setMainTab('query');
  };

  // ── Import SQL ────────────────────────────────────────────
  const [importSqlText, setImportSqlText] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Export database state
  const [exportType, setExportType] = useState<'structure' | 'data' | 'structure_and_data'>('structure_and_data');
  const [exportAddDropTable, setExportAddDropTable] = useState(true);
  const [exportAddCreateDb, setExportAddCreateDb] = useState(false);
  const [exportSelectedTables, setExportSelectedTables] = useState<Set<string>>(new Set());
  const [exportLoading, setExportLoading] = useState(false);
  const [exportFiles, setExportFiles] = useState<{ name: string; size: number; createdAt: string; modifiedAt: string }[]>([]);
  const [exportFilesLoading, setExportFilesLoading] = useState(false);

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImportSqlText(ev.target?.result as string || '');
    };
    reader.readAsText(file);
    e.target.value = ''; // reset so same file can be re-selected
  };

  const executeImportSQL = async () => {
    if (!activeConnection || !importSqlText.trim()) return;
    setImportLoading(true);
    setImportResult(null);
    try {
      const res = await api.post('/database/import-sql', {
        ...connPayload(activeConnection),
        sql: importSqlText.trim(),
      });
      setImportResult({ success: true, message: res.data?.message || 'SQL executed successfully', details: res.data });
      notify.success('SQL import completed');
      fetchTables(); // refresh table list
    } catch (err: any) {
      setImportResult({ success: false, message: err.response?.data?.error || 'Import failed' });
      notify.error(err.response?.data?.error || 'Import failed');
    } finally {
      setImportLoading(false);
    }
  };

  // ── Export database ───────────────────────────────────────
  const fetchExportFiles = async () => {
    setExportFilesLoading(true);
    try {
      const res = await api.get('/database/export-files');
      setExportFiles(res.data?.files || []);
    } catch {
      // silently ignore
    } finally {
      setExportFilesLoading(false);
    }
  };

  const handleExportDatabase = async () => {
    if (!activeConnection || !activeConnection.database) {
      notify.error('Connect to a database first');
      return;
    }
    setExportLoading(true);
    try {
      await api.post('/database/export-database', {
        ...connPayload(activeConnection),
        exportType,
        selectedTables: exportSelectedTables.size > 0 ? Array.from(exportSelectedTables) : undefined,
        addDropTable: exportAddDropTable,
        addCreateDatabase: exportAddCreateDb,
      });
      notify.success('Export started — file will appear in the list below shortly');
      // Poll for the new file a few times
      setTimeout(() => fetchExportFiles(), 3000);
      setTimeout(() => fetchExportFiles(), 8000);
      setTimeout(() => fetchExportFiles(), 20000);
    } catch (err: any) {
      notify.error(err.response?.data?.error || 'Export failed');
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteExportFile = async (filename: string) => {
    const r = await Swal.fire({
      title: 'Delete export file?',
      text: filename,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Delete',
    });
    if (!r.isConfirmed) return;
    try {
      await api.delete(`/database/export-files/${encodeURIComponent(filename)}`);
      notify.success('File deleted');
      fetchExportFiles();
    } catch (err: any) {
      notify.error(err.response?.data?.error || 'Delete failed');
    }
  };

  // Initialize export table selection when tables change
  useEffect(() => {
    if (tables.length > 0) {
      setExportSelectedTables(new Set(tables.map(t => t.name)));
    }
  }, [tables]);

  // Fetch export files when export tab becomes active
  useEffect(() => {
    if (mainTab === 'export') fetchExportFiles();
  }, [mainTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Truncate / Drop table ─────────────────────────────────
  const truncateTable = async (table: string) => {
    const r = await Swal.fire({
      title: 'Truncate Table?',
      html: `This will <b>delete all rows</b> from <code>${table}</code>.<br/>This cannot be undone!`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Truncate',
    });
    if (!r.isConfirmed || !activeConnection) return;
    try {
      await api.post('/database/truncate', { ...connPayload(activeConnection), table });
      notify.success(`Table ${table} truncated`);
      fetchTables();
      if (browsingTable === table) setBrowsingTable(null);
    } catch (err: any) {
      notify.error(err.response?.data?.error || 'Truncate failed');
    }
  };

  const dropTable = async (table: string) => {
    const r = await Swal.fire({
      title: 'Drop Table?',
      html: `This will <b>permanently delete</b> the table <code>${table}</code> and all its data.<br/><br/>Type the table name to confirm:`,
      icon: 'error',
      input: 'text',
      inputPlaceholder: table,
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Drop Table',
      inputValidator: v => v !== table ? 'Table name does not match' : null,
    });
    if (!r.isConfirmed || !activeConnection) return;
    try {
      await api.post('/database/drop-table', { ...connPayload(activeConnection), table });
      notify.success(`Table ${table} dropped`);
      fetchTables();
      if (browsingTable === table) setBrowsingTable(null);
      if (infoTable === table) { setInfoTable(null); setTableInfo(null); }
    } catch (err: any) {
      notify.error(err.response?.data?.error || 'Drop failed');
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white rounded-xl shadow-sm border overflow-hidden">
      {/* ═════ SIDEBAR ═════ */}
      <div className={`${sidebarCollapsed ? 'w-12' : 'w-64'} border-r flex flex-col bg-gray-50 transition-all duration-200`}>
        {/* Header */}
        <div className="p-2 border-b flex items-center justify-between">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider">Connections</h3>
              {isAdmin && (
                <button onClick={() => { setEditingConn(null); setDialogOpen(true); }}
                  className="p-1 rounded hover:bg-gray-200 text-gray-500" title="New Connection">
                  <PlusIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1 rounded hover:bg-gray-200 text-gray-400" title={sidebarCollapsed ? 'Expand' : 'Collapse'}>
            {sidebarCollapsed ? <ChevronRightIcon className="h-3.5 w-3.5" /> : <ChevronLeftIcon className="h-3.5 w-3.5" />}
          </button>
        </div>

        {sidebarCollapsed ? (
          <div className="flex flex-col items-center gap-2 py-3">
            {isAdmin && (
              <button onClick={() => { setSidebarCollapsed(false); setEditingConn(null); setDialogOpen(true); }}
                className="p-2 rounded-lg hover:bg-gray-200 text-gray-500" title="New Connection">
                <PlusIcon className="h-4 w-4" />
              </button>
            )}
            {connections.map(conn => (
              <button key={conn.id} onClick={() => handleConnect(conn)}
                className={`p-2 rounded-lg ${activeConnection?.id === conn.id && connected ? 'bg-emerald-100 text-emerald-600' : 'hover:bg-gray-200 text-gray-400'}`}
                title={conn.name}>
                <CircleStackIcon className="h-4 w-4" />
              </button>
            ))}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {loadingConnections ? (
              <div className="flex items-center justify-center py-8">
                <ArrowPathIcon className="h-5 w-5 animate-spin text-gray-300" />
              </div>
            ) : connections.length === 0 ? (
              <div className="text-center py-8 px-4">
                <ServerStackIcon className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                <p className="text-xs text-gray-400 mb-2">{isAdmin ? 'No connections' : 'No connections available'}</p>
                {isAdmin && (
                  <button onClick={() => { setEditingConn(null); setDialogOpen(true); }}
                    className="text-xs text-picton-blue hover:underline">Add connection</button>
                )}
                {!isAdmin && (
                  <p className="text-[10px] text-gray-300">Ask an admin to grant you access</p>
                )}
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {connections.map(conn => (
                  <div key={conn.id}
                    className={`group p-2 rounded-lg text-xs cursor-pointer transition-all ${
                      activeConnection?.id === conn.id && connected
                        ? 'bg-emerald-50 border border-emerald-200 shadow-sm' : 'hover:bg-gray-100'
                    }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0" onClick={() => handleConnect(conn)}>
                        <CircleStackIcon className={`h-4 w-4 shrink-0 ${
                          activeConnection?.id === conn.id && connected ? 'text-emerald-500' : 'text-gray-400'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <span className="truncate font-medium block">{conn.name}</span>
                          <span className="text-[10px] text-gray-400 truncate block">
                            {conn.type.toUpperCase()} · {conn.tunnel?.sshHost ? '🔒 tunneled' : 'direct'}
                            {isAdmin && conn.accessUsers && conn.accessUsers.length > 0 && (
                              <> · <UsersIcon className="h-2.5 w-2.5 inline" /> {conn.accessUsers.length}</>
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {isAdmin && (
                          <>
                            <button onClick={(e) => { e.stopPropagation(); setEditingConn(conn); setDialogOpen(true); }}
                              className="p-1 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-colors" title="Edit connection">
                              <PencilSquareIcon className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); deleteConnection(conn); }}
                              className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors" title="Delete connection">
                              <TrashIcon className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Database Selector */}
            {connected && databases.length > 0 && (
              <div className="border-t mt-1 px-3 py-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Database</label>
                <select value={activeConnection?.database || ''}
                  onChange={e => switchDatabase(e.target.value)}
                  className="w-full px-2 py-1.5 border rounded-lg text-xs bg-white">
                  {databases.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            )}

            {/* Tables Tree */}
            {connected && (
              <div className="border-t mt-1 pt-1">
                <div className="px-3 flex items-center justify-between mb-1">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Tables ({tables.length})
                  </h4>
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => handleDisconnect()} className="p-0.5 rounded hover:bg-red-100" title="Disconnect">
                      <XMarkIcon className="h-3 w-3 text-red-400" />
                    </button>
                    <button onClick={() => fetchTables()} className="p-0.5 rounded hover:bg-gray-200" title="Refresh">
                      <ArrowPathIcon className={`h-3 w-3 text-gray-400 ${loadingTables ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>
                {loadingTables ? (
                  <div className="flex items-center justify-center py-4">
                    <ArrowPathIcon className="h-4 w-4 animate-spin text-gray-300" />
                  </div>
                ) : tables.length === 0 ? (
                  <p className="text-[10px] text-gray-400 text-center py-3">No tables found</p>
                ) : (
                  <div className="space-y-0.5 px-1 pb-2">
                    {tables.map(t => (
                      <div key={t.name}>
                        <div className="group flex items-center gap-0.5 pr-1">
                          <button
                            onClick={() => {
                              const next = expandedTable === t.name ? null : t.name;
                              setExpandedTable(next);
                              if (next) fetchTableColumns(next);
                            }}
                            className="flex-1 flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-gray-100 text-left min-w-0">
                            {expandedTable === t.name
                              ? <ChevronDownIcon className="h-3 w-3 text-gray-400 shrink-0" />
                              : <ChevronRightIcon className="h-3 w-3 text-gray-400 shrink-0" />}
                            <TableCellsIcon className="h-3 w-3 text-gray-400 shrink-0" />
                            <span className="truncate">{t.name}</span>
                            {t.type === 'VIEW' && <span className="text-[8px] px-1 rounded bg-blue-50 text-blue-500 shrink-0">V</span>}
                          </button>
                          <div className="flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button onClick={() => quickSelect(t.name)} className="p-0.5 rounded hover:bg-gray-200" title="SELECT *">
                              <EyeIcon className="h-3 w-3 text-gray-400" />
                            </button>
                            <button onClick={() => { setBrowsingTable(t.name); setMainTab('browse'); }} className="p-0.5 rounded hover:bg-gray-200" title="Browse">
                              <ListBulletIcon className="h-3 w-3 text-gray-400" />
                            </button>
                            <button onClick={() => loadTableInfo(t.name)} className="p-0.5 rounded hover:bg-gray-200" title="Info">
                              <InformationCircleIcon className="h-3 w-3 text-gray-400" />
                            </button>
                            <button onClick={() => truncateTable(t.name)} className="p-0.5 rounded hover:bg-red-100" title="Truncate table">
                              <StopIcon className="h-3 w-3 text-gray-400 hover:text-red-500" />
                            </button>
                            <button onClick={() => dropTable(t.name)} className="p-0.5 rounded hover:bg-red-100" title="Drop table">
                              <NoSymbolIcon className="h-3 w-3 text-gray-400 hover:text-red-500" />
                            </button>
                          </div>
                        </div>
                        {expandedTable === t.name && tableColumns[t.name] && (
                          <div className="ml-7 space-y-0.5 mb-1">
                            {tableColumns[t.name].map((col: any, i: number) => (
                              <div key={i} className="flex items-center gap-1.5 text-[10px] text-gray-500 px-1 py-0.5 hover:bg-gray-100 rounded cursor-default">
                                {(col.Key === 'PRI') && <KeyIcon className="h-2.5 w-2.5 text-amber-500 shrink-0" />}
                                <span className="font-mono truncate">{col.Field || col.COLUMN_NAME || col.name}</span>
                                <span className="text-gray-300 shrink-0 text-[9px]">{col.Type || col.DATA_TYPE || ''}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═════ MAIN AREA ═════ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* SQL Editor */}
        <div className="border-b flex-shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border-b">
            {/* Execute */}
            <button onClick={handleExecute} disabled={executing || !connected}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-colors shadow-sm">
              {executing ? <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" /> : <PlayIcon className="h-3.5 w-3.5" />}
              {executing ? 'Running…' : 'Execute'}
            </button>
            <span className="text-[10px] text-gray-400 hidden sm:inline">⌘+Enter</span>

            <div className="w-px h-5 bg-gray-200 mx-1" />

            {/* Quick actions */}
            <button onClick={saveQuery} disabled={!sql.trim()} className="p-1.5 rounded hover:bg-gray-200 text-gray-400 disabled:opacity-30" title="Save query">
              <BookmarkIcon className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setShowSaved(!showSaved)} className="p-1.5 rounded hover:bg-gray-200 text-gray-400" title="Saved queries">
              <Square3Stack3DIcon className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setShowHistory(!showHistory)} className="p-1.5 rounded hover:bg-gray-200 text-gray-400" title="History">
              <ClockIcon className="h-3.5 w-3.5" />
            </button>

            <div className="flex-1" />

            {/* Server tools */}
            {connected && (
              <>
                <button onClick={loadProcesses} className="p-1.5 rounded hover:bg-gray-200 text-gray-400" title="Processes">
                  <CommandLineIcon className="h-3.5 w-3.5" />
                </button>
                <button onClick={loadStatus} className="p-1.5 rounded hover:bg-gray-200 text-gray-400" title="Server Status">
                  <Cog6ToothIcon className="h-3.5 w-3.5" />
                </button>
              </>
            )}

            {/* Connection status */}
            {!connected && (
              <span className="text-xs text-amber-600 flex items-center gap-1">
                <ExclamationTriangleIcon className="h-3.5 w-3.5" /> Not connected
              </span>
            )}
            {connecting && (
              <span className="text-xs text-blue-600 flex items-center gap-1">
                <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" /> Connecting…
              </span>
            )}
            {connected && activeConnection && !connecting && (
              <span className="text-xs text-emerald-600 flex items-center gap-1">
                <ShieldCheckIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{activeConnection.name}</span>
                <span className="text-[10px] text-gray-400">({activeConnection.type.toUpperCase()})</span>
              </span>
            )}
          </div>

          {/* Saved queries dropdown */}
          {showSaved && savedQueries.length > 0 && (
            <div className="bg-amber-50 border-b px-3 py-2 max-h-32 overflow-y-auto">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Saved Queries</span>
                <button onClick={() => setShowSaved(false)} className="text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="h-3 w-3" />
                </button>
              </div>
              {savedQueries.map((q, i) => (
                <div key={i} className="flex items-center gap-2 py-0.5">
                  <button onClick={() => { setSql(q.sql); setShowSaved(false); }}
                    className="flex-1 text-left text-xs text-gray-700 hover:text-picton-blue truncate">{q.name}</button>
                  <button onClick={() => setSavedQueries(prev => prev.filter((_, j) => j !== i))}
                    className="p-0.5 hover:bg-red-100 rounded"><TrashIcon className="h-2.5 w-2.5 text-red-400" /></button>
                </div>
              ))}
            </div>
          )}

          {/* History dropdown */}
          {showHistory && queryHistory.length > 0 && (
            <div className="bg-gray-100 border-b px-3 py-2 max-h-32 overflow-y-auto">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Recent Queries</span>
                <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="h-3 w-3" />
                </button>
              </div>
              {queryHistory.slice(0, 20).map((q, i) => (
                <button key={i} onClick={() => { setSql(q); setShowHistory(false); }}
                  className="w-full text-left text-[11px] font-mono text-gray-600 hover:text-picton-blue py-0.5 truncate block">{q}</button>
              ))}
            </div>
          )}

          {/* SQL textarea */}
          <textarea
            ref={textareaRef}
            value={sql}
            onChange={e => setSql(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={6}
            className="w-full p-3 font-mono text-sm resize-y min-h-[100px] max-h-[300px] border-0 focus:ring-0 focus:outline-none bg-[#1e1e2e] text-[#cdd6f4] selection:bg-[#45475a]"
            placeholder="-- Write your SQL query here…&#10;-- Ctrl+Enter to execute"
            spellCheck={false}
          />
        </div>

        {/* ═════ Tab Bar ═════ */}
        <div className="flex items-center gap-0 bg-gray-50 border-b px-2 text-xs flex-shrink-0">
          {[
            { key: 'query' as MainTab, label: 'Results', icon: DocumentTextIcon },
            { key: 'browse' as MainTab, label: 'Browse', icon: ListBulletIcon },
            { key: 'info' as MainTab, label: 'Info', icon: InformationCircleIcon },
            { key: 'export' as MainTab, label: 'Export', icon: DocumentArrowDownIcon },
            { key: 'import' as MainTab, label: 'Import', icon: DocumentArrowUpIcon },
            { key: 'processes' as MainTab, label: 'Processes', icon: CommandLineIcon },
            { key: 'status' as MainTab, label: 'Server', icon: Cog6ToothIcon },
          ].map(tab => (
            <button key={tab.key} onClick={() => {
              setMainTab(tab.key);
              if (tab.key === 'processes') loadProcesses();
              if (tab.key === 'status') loadStatus();
            }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 border-b-2 transition-colors ${
                mainTab === tab.key
                  ? 'border-picton-blue text-picton-blue font-medium'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}

          <div className="flex-1" />

          {/* Export buttons — show on results tab */}
          {mainTab === 'query' && result && !result.error && result.columns.length > 0 && (
            <div className="flex items-center gap-0.5">
              <button onClick={copyToClipboard} className="p-1.5 rounded hover:bg-gray-200 text-gray-400" title="Copy to clipboard">
                <DocumentDuplicateIcon className="h-3.5 w-3.5" />
              </button>
              <button onClick={exportCSV} className="p-1.5 rounded hover:bg-gray-200 text-gray-400" title="Export CSV">
                <ArrowDownTrayIcon className="h-3.5 w-3.5" />
              </button>
              <button onClick={exportJSON} className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-200 text-gray-400 text-[10px]" title="Export JSON">
                <ArrowTopRightOnSquareIcon className="h-3 w-3" /> JSON
              </button>
            </div>
          )}
        </div>

        {/* ═════ Tab Content ═════ */}
        <div className="flex-1 overflow-auto">
          {/* ── QUERY RESULTS ── */}
          {mainTab === 'query' && (
            <>
              {!result && !executing && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <DocumentTextIcon className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">Run a query to see results</p>
                    <p className="text-xs text-gray-300 mt-1">Press Ctrl + Enter or click Execute</p>
                  </div>
                </div>
              )}

              {executing && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <ArrowPathIcon className="h-8 w-8 animate-spin text-picton-blue/50 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Executing query…</p>
                  </div>
                </div>
              )}

              {result?.error && (
                <div className="p-4">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                    <div className="flex items-start gap-3">
                      <ExclamationTriangleIcon className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-red-800">Query Error</h4>
                        <pre className="text-xs text-red-600 mt-2 whitespace-pre-wrap font-mono bg-red-100/50 rounded-lg p-3 overflow-x-auto">{result.error}</pre>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {result && !result.error && (
                <div className="flex flex-col h-full">
                  {/* Stats bar */}
                  <div className="flex items-center gap-4 px-4 py-1.5 bg-emerald-50/50 border-b text-xs text-gray-500 flex-shrink-0">
                    <span className="font-medium text-emerald-700">{result.rows.length} row{result.rows.length !== 1 ? 's' : ''}</span>
                    {result.affectedRows !== undefined && (
                      <span>{result.affectedRows} affected</span>
                    )}
                    {result.message && <span className="text-gray-400">{result.message}</span>}
                    {result.executionTime != null && (
                      <span className="flex items-center gap-1"><ClockIcon className="h-3 w-3" /> {result.executionTime}ms</span>
                    )}
                    <span>{result.columns.length} column{result.columns.length !== 1 ? 's' : ''}</span>
                  </div>

                  {/* Data table */}
                  {result.columns.length > 0 && (
                    <div className="flex-1 overflow-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-gray-100 z-10">
                          <tr>
                            <th className="px-2 py-2 text-left font-semibold text-gray-500 border-b w-10">#</th>
                            {result.columns.map(col => (
                              <th key={col} className="px-2 py-2 text-left font-semibold text-gray-600 border-b whitespace-nowrap">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {result.rows.map((row, i) => (
                            <tr key={i} className="hover:bg-blue-50/50 border-b border-gray-50">
                              <td className="px-2 py-1.5 text-gray-400 font-mono text-[10px]">{i + 1}</td>
                              {result.columns.map(col => (
                                <td key={col} className="px-2 py-1.5 max-w-[280px] truncate font-mono">
                                  {row[col] === null
                                    ? <span className="text-gray-300 italic text-[10px]">NULL</span>
                                    : typeof row[col] === 'boolean'
                                      ? <span className={`text-[10px] px-1.5 py-0.5 rounded ${row[col] ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{String(row[col])}</span>
                                      : String(row[col])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── BROWSE TAB ── */}
          {mainTab === 'browse' && (
            browsingTable && activeConnection ? (
              <TableBrowser conn={activeConnection} tableName={browsingTable} onRunQuery={q => { setSql(q); setMainTab('query'); }} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <TableCellsIcon className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">Click the browse icon on a table</p>
                </div>
              </div>
            )
          )}

          {/* ── EXPORT DATABASE TAB ── */}
          {mainTab === 'export' && (
            <div className="p-4 max-w-3xl space-y-4">
              <div className="flex items-center gap-3">
                <DocumentArrowDownIcon className="h-6 w-6 text-indigo-500" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Export Database</h3>
                  <p className="text-xs text-gray-400">Export your database structure and/or data as SQL</p>
                </div>
              </div>

              {!connected ? (
                <div className="flex items-center gap-2 p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />
                  <span className="text-sm text-amber-700">Connect to a database first</span>
                </div>
              ) : activeConnection?.type === 'mssql' ? (
                <div className="flex items-center gap-2 p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />
                  <span className="text-sm text-amber-700">Database export is currently supported for MySQL only</span>
                </div>
              ) : (
                <>
                  {/* Export Type */}
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-2">Export Type</label>
                    <div className="flex gap-2">
                      {[
                        { value: 'structure_and_data' as const, label: 'Structure + Data', desc: 'Full database dump' },
                        { value: 'structure' as const, label: 'Structure Only', desc: 'CREATE TABLE statements' },
                        { value: 'data' as const, label: 'Data Only', desc: 'INSERT statements' },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setExportType(opt.value)}
                          className={`flex-1 p-3 rounded-xl border-2 text-left transition-all ${
                            exportType === opt.value
                              ? 'border-indigo-400 bg-indigo-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <span className="text-xs font-semibold block">{opt.label}</span>
                          <span className="text-[10px] text-gray-400">{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Options */}
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-2">Options</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={exportAddDropTable}
                          onChange={e => setExportAddDropTable(e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-xs text-gray-700">Add DROP TABLE IF EXISTS</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={exportAddCreateDb}
                          onChange={e => setExportAddCreateDb(e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-xs text-gray-700">Add CREATE DATABASE + USE statement</span>
                      </label>
                    </div>
                  </div>

                  {/* Table Selection */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-gray-600">Tables to Export</label>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400">{exportSelectedTables.size}/{tables.length} selected</span>
                        <button type="button" onClick={() => setExportSelectedTables(new Set(tables.map(t => t.name)))}
                          className="text-[10px] text-indigo-600 hover:underline">Select all</button>
                        <button type="button" onClick={() => setExportSelectedTables(new Set())}
                          className="text-[10px] text-indigo-600 hover:underline">Clear all</button>
                      </div>
                    </div>
                    <div className="border rounded-xl max-h-60 overflow-y-auto">
                      {tables.length === 0 ? (
                        <p className="text-[10px] text-gray-400 text-center py-4">No tables found</p>
                      ) : (
                        <div className="p-2 space-y-0.5">
                          {tables.map(t => (
                            <label key={t.name} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={exportSelectedTables.has(t.name)}
                                onChange={() => {
                                  setExportSelectedTables(prev => {
                                    const next = new Set(prev);
                                    if (next.has(t.name)) next.delete(t.name); else next.add(t.name);
                                    return next;
                                  });
                                }}
                                className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <TableCellsIcon className="h-3.5 w-3.5 text-gray-400" />
                              <span className="text-xs text-gray-700">{t.name}</span>
                              {t.rows !== undefined && (
                                <span className="text-[10px] text-gray-400 ml-auto">{Number(t.rows).toLocaleString()} rows</span>
                              )}
                              {t.type === 'VIEW' && <span className="text-[8px] px-1 rounded bg-blue-50 text-blue-500">VIEW</span>}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Export Button */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={handleExportDatabase}
                      disabled={exportLoading || exportSelectedTables.size === 0}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-500 text-white text-sm font-medium rounded-lg hover:bg-indigo-600 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      {exportLoading ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <ArrowDownTrayIcon className="h-4 w-4" />}
                      {exportLoading ? 'Starting Export…' : 'Start Export'}
                    </button>
                    {exportSelectedTables.size === 0 && (
                      <span className="text-xs text-amber-600">Select at least one table</span>
                    )}
                  </div>
                </>
              )}

              {/* ── Export Files List ── */}
              <div className="border-t pt-4 mt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-600">Export Files on Server</span>
                  <button
                    type="button"
                    onClick={fetchExportFiles}
                    disabled={exportFilesLoading}
                    className="inline-flex items-center gap-1 text-[10px] text-indigo-600 hover:underline"
                  >
                    <ArrowPathIcon className={`h-3 w-3 ${exportFilesLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>
                {exportFilesLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <ArrowPathIcon className="h-5 w-5 text-gray-400 animate-spin" />
                  </div>
                ) : exportFiles.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 py-6 text-center">
                    <p className="text-xs text-gray-400">No export files yet</p>
                  </div>
                ) : (
                  <div className="rounded-xl border overflow-hidden divide-y">
                    {exportFiles.map(f => (
                      <div key={f.name} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50">
                        <DocumentArrowDownIcon className="h-4 w-4 text-gray-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-700 truncate">{f.name}</p>
                          <p className="text-[10px] text-gray-400">
                            {(f.size / 1024).toFixed(1)} KB &middot; {new Date(f.modifiedAt).toLocaleString()}
                          </p>
                        </div>
                        <a
                          href={`${API_BASE_URL.replace(/\/$/, '')}/database/export-files/${encodeURIComponent(f.name)}/download`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                        >
                          <ArrowDownTrayIcon className="h-3 w-3" />
                          Download
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDeleteExportFile(f.name)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                        >
                          <TrashIcon className="h-3 w-3" />
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── IMPORT SQL TAB ── */}
          {mainTab === 'import' && (
            <div className="p-4 max-w-3xl space-y-4">
              <div className="flex items-center gap-3">
                <DocumentArrowUpIcon className="h-6 w-6 text-blue-500" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Import SQL</h3>
                  <p className="text-xs text-gray-400">Execute SQL statements from a file or paste them directly</p>
                </div>
              </div>

              {/* File upload */}
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-blue-300 transition-colors cursor-pointer"
                onClick={() => importFileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-blue-400', 'bg-blue-50/50'); }}
                onDragLeave={e => { e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50/50'); }}
                onDrop={e => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50/50');
                  const file = e.dataTransfer.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => setImportSqlText(ev.target?.result as string || '');
                    reader.readAsText(file);
                  }
                }}>
                <DocumentArrowUpIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Drop a <span className="font-mono">.sql</span> file here or click to upload</p>
                <p className="text-[10px] text-gray-400 mt-1">Supports .sql, .txt files</p>
              </div>
              <input ref={importFileRef} type="file" accept=".sql,.txt" className="hidden" onChange={handleImportFile} />

              {/* SQL text area */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-600">SQL Statements</label>
                  <div className="flex items-center gap-2">
                    {importSqlText && (
                      <span className="text-[10px] text-gray-400">{importSqlText.length.toLocaleString()} chars</span>
                    )}
                    <button onClick={() => { setImportSqlText(''); setImportResult(null); }}
                      className="text-[10px] text-gray-400 hover:text-red-500">Clear</button>
                  </div>
                </div>
                <textarea
                  value={importSqlText}
                  onChange={e => setImportSqlText(e.target.value)}
                  rows={12}
                  className="w-full p-3 font-mono text-sm resize-y border rounded-xl bg-[#1e1e2e] text-[#cdd6f4] focus:ring-2 focus:ring-blue-300 focus:outline-none"
                  placeholder="-- Paste your SQL here…&#10;-- CREATE TABLE, INSERT INTO, ALTER TABLE, etc.&#10;-- Multiple statements separated by semicolons"
                  spellCheck={false}
                />
              </div>

              {/* Execute button */}
              <div className="flex items-center gap-3">
                <button onClick={executeImportSQL}
                  disabled={importLoading || !importSqlText.trim() || !connected}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors shadow-sm">
                  {importLoading ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <PlayIcon className="h-4 w-4" />}
                  {importLoading ? 'Executing…' : 'Execute Import'}
                </button>
                {!connected && (
                  <span className="text-xs text-amber-600 flex items-center gap-1">
                    <ExclamationTriangleIcon className="h-3.5 w-3.5" /> Connect to a database first
                  </span>
                )}
              </div>

              {/* Import result */}
              {importResult && (
                <div className={`p-4 rounded-xl border ${importResult.success ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-start gap-3">
                    {importResult.success
                      ? <CheckIcon className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                      : <ExclamationTriangleIcon className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-sm font-semibold ${importResult.success ? 'text-emerald-800' : 'text-red-800'}`}>
                        {importResult.success ? 'Import Successful' : 'Import Failed'}
                      </h4>
                      <pre className={`text-xs mt-2 whitespace-pre-wrap font-mono rounded-lg p-3 overflow-x-auto ${
                        importResult.success ? 'text-emerald-600 bg-emerald-100/50' : 'text-red-600 bg-red-100/50'
                      }`}>{importResult.message}</pre>
                      {importResult.details?.results && (
                        <div className="mt-2 text-xs text-gray-600">
                          <span className="font-medium">{importResult.details.results.length} statement(s) executed</span>
                          {importResult.details.results.some((r: any) => r.affectedRows !== undefined) && (
                            <span className="ml-2">
                              ({importResult.details.results.reduce((s: number, r: any) => s + (r.affectedRows || 0), 0)} total rows affected)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TABLE INFO TAB ── */}
          {mainTab === 'info' && (
            infoTable ? (
              <div className="p-4 space-y-4 max-w-3xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <TableCellsIcon className="h-5 w-5 text-gray-400" />
                    {infoTable}
                  </h3>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setBrowsingTable(infoTable!); setMainTab('browse'); }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                      <ListBulletIcon className="h-3.5 w-3.5" /> Browse
                    </button>
                    <button onClick={() => truncateTable(infoTable!)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 border border-amber-200 transition-colors">
                      <StopIcon className="h-3.5 w-3.5" /> Truncate
                    </button>
                    <button onClick={() => dropTable(infoTable!)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 border border-red-200 transition-colors">
                      <NoSymbolIcon className="h-3.5 w-3.5" /> Drop
                    </button>
                  </div>
                </div>

                {/* Size info */}
                {tableInfo && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Rows', value: tableInfo.row_count?.toLocaleString() || '—' },
                      { label: 'Data Size', value: tableInfo.data_kb ? `${tableInfo.data_kb} KB` : '—' },
                      { label: 'Total Size', value: tableInfo.total_kb ? `${tableInfo.total_kb} KB` : '—' },
                      { label: 'Engine', value: tableInfo.engine || '—' },
                    ].map((s, i) => (
                      <div key={i} className="p-3 rounded-xl bg-gray-50 border">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{s.label}</p>
                        <p className="text-lg font-bold text-gray-800 mt-0.5">{s.value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Columns */}
                {tableColumns[infoTable] && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-600 mb-2">Columns</h4>
                    <div className="border rounded-xl overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold text-gray-500">Column</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-500">Type</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-500">Null</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-500">Key</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-500">Default</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tableColumns[infoTable].map((col: any, i: number) => (
                            <tr key={i} className="border-t hover:bg-gray-50">
                              <td className="px-3 py-1.5 font-mono font-medium">{col.Field || col.COLUMN_NAME}</td>
                              <td className="px-3 py-1.5 text-gray-500">{col.Type || col.DATA_TYPE}</td>
                              <td className="px-3 py-1.5">{col.Null === 'YES' || col.Null === 'YES' ? '✓' : '—'}</td>
                              <td className="px-3 py-1.5">{col.Key === 'PRI' ? <span className="text-amber-600 font-bold">PK</span> : col.Key || '—'}</td>
                              <td className="px-3 py-1.5 text-gray-400 font-mono text-[10px]">{col.Default ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Indexes */}
                {tableIndexes.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-600 mb-2">Indexes</h4>
                    <div className="border rounded-xl overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold text-gray-500">Name</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-500">Columns</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-500">Unique</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tableIndexes.map((idx: any, i: number) => (
                            <tr key={i} className="border-t hover:bg-gray-50">
                              <td className="px-3 py-1.5 font-mono">{idx.Key_name || idx.index_name}</td>
                              <td className="px-3 py-1.5 text-gray-500">{idx.Column_name || idx.columns}</td>
                              <td className="px-3 py-1.5">{(!idx.Non_unique || idx.is_unique) ? '✓' : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* CREATE SQL */}
                {createSQL && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-600 mb-2">CREATE Statement</h4>
                    <pre className="p-4 bg-[#1e1e2e] text-[#cdd6f4] rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap">{createSQL}</pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <InformationCircleIcon className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">Click the info icon on a table</p>
                </div>
              </div>
            )
          )}

          {/* ── PROCESSES TAB ── */}
          {mainTab === 'processes' && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Running Processes</h3>
                <button onClick={loadProcesses} className="text-xs text-picton-blue hover:underline flex items-center gap-1">
                  <ArrowPathIcon className="h-3 w-3" /> Refresh
                </button>
              </div>
              {processes.length === 0 ? (
                <p className="text-sm text-gray-400">No active processes</p>
              ) : (
                <div className="border rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        {processes[0] && Object.keys(processes[0]).map(k => (
                          <th key={k} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {processes.map((p: any, i: number) => (
                        <tr key={i} className="border-t hover:bg-gray-50">
                          {Object.values(p).map((v: any, j: number) => (
                            <td key={j} className="px-3 py-1.5 max-w-[200px] truncate font-mono">{v === null ? <span className="text-gray-300">NULL</span> : String(v)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── SERVER STATUS TAB ── */}
          {mainTab === 'status' && (
            <div className="p-4 max-w-2xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Server Status</h3>
                <button onClick={loadStatus} className="text-xs text-picton-blue hover:underline flex items-center gap-1">
                  <ArrowPathIcon className="h-3 w-3" /> Refresh
                </button>
              </div>
              {!serverStatus ? (
                <p className="text-sm text-gray-400">Loading…</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(serverStatus).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border">
                      <span className="text-xs font-semibold text-gray-600">{key.replace(/_/g, ' ')}</span>
                      <span className="text-xs font-mono text-gray-800 max-w-[60%] truncate text-right">{String(value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═════ Connection Dialog ═════ */}
      <ConnectionDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        connection={editingConn}
        onSave={saveConnection}
        sshKeys={sshKeys}
        isAdmin={isAdmin}
        developerUsers={developerUsers}
      />
    </div>
  );
};

export default DatabaseManager;
