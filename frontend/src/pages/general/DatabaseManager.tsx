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
} from '@heroicons/react/24/outline';
import { notify } from '../../utils/notify';
import Swal from 'sweetalert2';
import api from '../../services/api';

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

type MainTab = 'query' | 'browse' | 'structure' | 'info' | 'processes' | 'status';

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
  onSave: (conn: Connection) => void;
  sshKeys: SSHKeyInfo[];
}> = ({ open, onClose, connection, onSave, sshKeys }) => {
  const emptyTunnel: TunnelConfig = { sshHost: '', sshPort: 22, sshUser: '', sshPassword: '', sshKeyFile: '' };
  const [form, setForm] = useState<Connection>({
    id: '', name: '', host: '', port: 3306,
    user: '', password: '', database: '', type: 'mysql',
    tunnel: { ...emptyTunnel },
  });
  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
    if (open) {
      if (connection) {
        setForm({ ...connection, tunnel: connection.tunnel || { ...emptyTunnel } });
      } else {
        setForm({
          id: crypto.randomUUID?.() || String(Date.now()),
          name: '', host: '', port: 3306,
          user: '', password: '', database: '', type: 'mysql',
          tunnel: { ...emptyTunnel, sshKeyFile: sshKeys[0]?.name || '' },
        });
      }
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
    onSave(form);
    onClose();
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
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
   Table Browser Panel — paginated data view
   ═════════════════════════════════════════════════════════════ */
const TableBrowser: React.FC<{
  conn: Connection;
  tableName: string;
  onRunQuery: (sql: string) => void;
}> = ({ conn, tableName, onRunQuery }) => {
  const [data, setData] = useState<{ columns: string[]; rows: any[]; total: number } | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(100);
  const [loading, setLoading] = useState(false);
  const [filterCol, setFilterCol] = useState('');
  const [filterVal, setFilterVal] = useState('');

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await api.post('/database/table-data', { ...connPayload(conn), table: tableName, page: p, pageSize });
      setData(res.data);
      setPage(p);
    } catch (err: any) {
      notify.error(err.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [conn, tableName, pageSize]);

  useEffect(() => { load(1); }, [tableName]);

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;
  const filteredRows = data?.rows?.filter(row => {
    if (!filterCol || !filterVal) return true;
    return String(row[filterCol] ?? '').toLowerCase().includes(filterVal.toLowerCase());
  }) || [];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b text-xs">
        <TableCellsIcon className="h-4 w-4 text-gray-400" />
        <span className="font-semibold text-gray-700">{tableName}</span>
        {data && <span className="text-gray-400">({data.total.toLocaleString()} rows)</span>}
        <div className="flex-1" />
        {/* Filter */}
        {data && data.columns.length > 0 && (
          <div className="flex items-center gap-1">
            <MagnifyingGlassIcon className="h-3.5 w-3.5 text-gray-400" />
            <select value={filterCol} onChange={e => setFilterCol(e.target.value)}
              className="px-1.5 py-1 border rounded text-[11px] bg-white">
              <option value="">Filter…</option>
              {data.columns.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {filterCol && (
              <input value={filterVal} onChange={e => setFilterVal(e.target.value)}
                placeholder="value" className="px-2 py-1 border rounded text-[11px] w-32" />
            )}
          </div>
        )}
        <button onClick={() => load(page)} className="p-1 rounded hover:bg-gray-200">
          <ArrowPathIcon className={`h-3.5 w-3.5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Data */}
      <div className="flex-1 overflow-auto">
        {loading && !data ? (
          <div className="flex items-center justify-center h-full">
            <ArrowPathIcon className="h-6 w-6 animate-spin text-gray-300" />
          </div>
        ) : data && data.columns.length > 0 ? (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-100 z-10">
              <tr>
                <th className="px-2 py-2 text-left font-semibold text-gray-500 border-b w-10">#</th>
                {data.columns.map(col => (
                  <th key={col} className="px-2 py-2 text-left font-semibold text-gray-600 border-b whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, i) => (
                <tr key={i} className="hover:bg-blue-50/50 border-b border-gray-50">
                  <td className="px-2 py-1 text-gray-400 font-mono text-[10px]">{(page - 1) * pageSize + i + 1}</td>
                  {data.columns.map(col => (
                    <td key={col} className="px-2 py-1 max-w-[250px] truncate font-mono">
                      {row[col] === null ? <span className="text-gray-300 italic">NULL</span> : String(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">No data</div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-t text-xs text-gray-500">
          <span>Page {page} of {totalPages} ({data?.total.toLocaleString()} rows)</span>
          <div className="flex items-center gap-1">
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
      )}
    </div>
  );
};

/* ═════════════════════════════════════════════════════════════
   Main Database Manager Page
   ═════════════════════════════════════════════════════════════ */
const DatabaseManager: React.FC = () => {
  // Connections
  const [connections, setConnections] = useState<Connection[]>(() => {
    try { return JSON.parse(localStorage.getItem('db_connections_v2') || '[]'); } catch { return []; }
  });
  const [activeConnection, setActiveConnection] = useState<Connection | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // SSH keys
  const [sshKeys, setSshKeys] = useState<SSHKeyInfo[]>([]);

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

  // Load SSH keys on mount
  useEffect(() => {
    api.get('/database/keys').then(r => setSshKeys(r.data?.keys || [])).catch(() => {});
  }, []);

  // Save connections
  useEffect(() => { localStorage.setItem('db_connections_v2', JSON.stringify(connections)); }, [connections]);
  useEffect(() => { localStorage.setItem('db_query_history', JSON.stringify(queryHistory)); }, [queryHistory]);
  useEffect(() => { localStorage.setItem('db_saved_queries', JSON.stringify(savedQueries)); }, [savedQueries]);

  // ── Connection ops ────────────────────────────────────────
  const saveConnection = (conn: Connection) => {
    setConnections(prev => {
      const idx = prev.findIndex(c => c.id === conn.id);
      if (idx >= 0) { const u = [...prev]; u[idx] = conn; return u; }
      return [...prev, conn];
    });
    notify.success('Connection saved');
  };

  const deleteConnection = async (conn: Connection) => {
    const r = await Swal.fire({
      title: 'Delete Connection', text: `Remove "${conn.name}"?`, icon: 'warning',
      showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Delete',
    });
    if (!r.isConfirmed) return;
    setConnections(prev => prev.filter(c => c.id !== conn.id));
    if (activeConnection?.id === conn.id) { setActiveConnection(null); setConnected(false); }
    notify.success('Removed');
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

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white rounded-xl shadow-sm border overflow-hidden">
      {/* ═════ SIDEBAR ═════ */}
      <div className={`${sidebarCollapsed ? 'w-12' : 'w-64'} border-r flex flex-col bg-gray-50 transition-all duration-200`}>
        {/* Header */}
        <div className="p-2 border-b flex items-center justify-between">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider">Connections</h3>
              <button onClick={() => { setEditingConn(null); setDialogOpen(true); }}
                className="p-1 rounded hover:bg-gray-200 text-gray-500" title="New Connection">
                <PlusIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1 rounded hover:bg-gray-200 text-gray-400" title={sidebarCollapsed ? 'Expand' : 'Collapse'}>
            {sidebarCollapsed ? <ChevronRightIcon className="h-3.5 w-3.5" /> : <ChevronLeftIcon className="h-3.5 w-3.5" />}
          </button>
        </div>

        {sidebarCollapsed ? (
          <div className="flex flex-col items-center gap-2 py-3">
            <button onClick={() => { setSidebarCollapsed(false); setEditingConn(null); setDialogOpen(true); }}
              className="p-2 rounded-lg hover:bg-gray-200 text-gray-500" title="New Connection">
              <PlusIcon className="h-4 w-4" />
            </button>
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
            {connections.length === 0 ? (
              <div className="text-center py-8 px-4">
                <ServerStackIcon className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                <p className="text-xs text-gray-400 mb-2">No connections</p>
                <button onClick={() => { setEditingConn(null); setDialogOpen(true); }}
                  className="text-xs text-picton-blue hover:underline">Add connection</button>
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
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingConn(conn); setDialogOpen(true); }}
                          className="p-0.5 rounded hover:bg-gray-200" title="Edit">
                          <CodeBracketIcon className="h-3 w-3" />
                        </button>
                        <button onClick={() => deleteConnection(conn)}
                          className="p-0.5 rounded hover:bg-red-100 text-red-400" title="Delete">
                          <TrashIcon className="h-3 w-3" />
                        </button>
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

          {/* ── TABLE INFO TAB ── */}
          {mainTab === 'info' && (
            infoTable ? (
              <div className="p-4 space-y-4 max-w-3xl">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <TableCellsIcon className="h-5 w-5 text-gray-400" />
                  {infoTable}
                </h3>

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
      />
    </div>
  );
};

export default DatabaseManager;
