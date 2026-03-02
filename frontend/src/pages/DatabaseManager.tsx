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
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import api from '../services/api';

/* ═══════════════════════════════════════════════════════════════
   Database Manager — web version of the desktop Database page.
   Executes queries through a backend proxy route (admin-only).
   ═══════════════════════════════════════════════════════════════ */

interface Connection {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  type: 'mysql' | 'mssql';
}

interface QueryResult {
  columns: string[];
  rows: Record<string, any>[];
  affectedRows?: number;
  executionTime?: number;
  error?: string;
}

interface TableInfo {
  name: string;
  type: 'BASE TABLE' | 'VIEW';
  rows?: number;
  engine?: string;
}

/* ── Connection Dialog ─────────────────────────────────────── */
const ConnectionDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  connection: Connection | null;
  onSave: (conn: Connection) => void;
}> = ({ open, onClose, connection, onSave }) => {
  const [form, setForm] = useState<Connection>({
    id: '', name: '', host: '127.0.0.1', port: 3306,
    user: '', password: '', database: '', type: 'mysql',
  });

  useEffect(() => {
    if (open) {
      if (connection) {
        setForm({ ...connection });
      } else {
        setForm({
          id: crypto.randomUUID?.() || String(Date.now()),
          name: '', host: '127.0.0.1', port: 3306,
          user: '', password: '', database: '', type: 'mysql',
        });
      }
    }
  }, [open, connection]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.host.trim()) { toast.error('Name and host are required'); return; }
    onSave(form);
    onClose();
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">{connection ? 'Edit Connection' : 'New Connection'}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><XMarkIcon className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Connection Name *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                required className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="My Database" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as 'mysql' | 'mssql', port: e.target.value === 'mssql' ? 1433 : 3306 })}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                <option value="mysql">MySQL</option>
                <option value="mssql">MS SQL Server</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Host</label>
              <input value={form.host} onChange={e => setForm({ ...form, host: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="127.0.0.1" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Port</label>
              <input type="number" value={form.port} onChange={e => setForm({ ...form, port: parseInt(e.target.value) || 3306 })}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Username</label>
              <input value={form.user} onChange={e => setForm({ ...form, user: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="root" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
              <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Database</label>
              <input value={form.database} onChange={e => setForm({ ...form, database: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="my_database" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit"
              className="px-6 py-2 text-sm font-medium bg-picton-blue text-white rounded-lg hover:bg-picton-blue/90">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   Main Database Manager Page
   ═══════════════════════════════════════════════════════════ */

const DatabaseManager: React.FC = () => {
  const [connections, setConnections] = useState<Connection[]>(() => {
    try { return JSON.parse(localStorage.getItem('db_connections') || '[]'); } catch { return []; }
  });
  const [activeConnection, setActiveConnection] = useState<Connection | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const [sql, setSql] = useState('SELECT 1;');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [executing, setExecuting] = useState(false);
  const [queryHistory, setQueryHistory] = useState<string[]>([]);

  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [tableColumns, setTableColumns] = useState<Record<string, any[]>>({});

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConn, setEditingConn] = useState<Connection | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Save connections to localStorage
  useEffect(() => {
    localStorage.setItem('db_connections', JSON.stringify(connections));
  }, [connections]);

  const saveConnection = (conn: Connection) => {
    setConnections(prev => {
      const idx = prev.findIndex(c => c.id === conn.id);
      if (idx >= 0) { const updated = [...prev]; updated[idx] = conn; return updated; }
      return [...prev, conn];
    });
    toast.success('Connection saved');
  };

  const deleteConnection = async (conn: Connection) => {
    const r = await Swal.fire({
      title: 'Delete Connection',
      text: `Remove "${conn.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Delete',
    });
    if (!r.isConfirmed) return;
    setConnections(prev => prev.filter(c => c.id !== conn.id));
    if (activeConnection?.id === conn.id) { setActiveConnection(null); setConnected(false); }
    toast.success('Connection removed');
  };

  const handleConnect = async (conn: Connection) => {
    setConnecting(true);
    setActiveConnection(conn);
    try {
      await api.post('/database/connect', {
        host: conn.host, port: conn.port, user: conn.user,
        password: conn.password, database: conn.database, type: conn.type,
      });
      setConnected(true);
      toast.success(`Connected to ${conn.name}`);
      fetchTables(conn);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Connection failed');
      setConnected(false);
    } finally {
      setConnecting(false);
    }
  };

  const fetchTables = async (conn?: Connection) => {
    const c = conn || activeConnection;
    if (!c) return;
    setLoadingTables(true);
    try {
      const res = await api.post('/database/tables', {
        host: c.host, port: c.port, user: c.user,
        password: c.password, database: c.database, type: c.type,
      });
      setTables(res.data?.tables || []);
    } catch {
      setTables([]);
    } finally {
      setLoadingTables(false);
    }
  };

  const fetchTableColumns = async (tableName: string) => {
    if (tableColumns[tableName]) return;
    if (!activeConnection) return;
    try {
      const res = await api.post('/database/describe', {
        host: activeConnection.host, port: activeConnection.port, user: activeConnection.user,
        password: activeConnection.password, database: activeConnection.database, type: activeConnection.type,
        table: tableName,
      });
      setTableColumns(prev => ({ ...prev, [tableName]: res.data?.columns || [] }));
    } catch { /* silently fail */ }
  };

  const handleExecute = useCallback(async () => {
    const query = sql.trim();
    if (!query || !activeConnection) return;
    setExecuting(true);
    setResult(null);
    try {
      const start = performance.now();
      const res = await api.post('/database/query', {
        host: activeConnection.host, port: activeConnection.port, user: activeConnection.user,
        password: activeConnection.password, database: activeConnection.database, type: activeConnection.type,
        sql: query,
      });
      const duration = performance.now() - start;
      const data = res.data;
      setResult({
        columns: data.columns || [],
        rows: data.rows || [],
        affectedRows: data.affectedRows,
        executionTime: Math.round(duration),
      });
      setQueryHistory(prev => [query, ...prev.filter(q => q !== query)].slice(0, 50));
      // Refresh tables if DDL
      if (/^\s*(CREATE|DROP|ALTER|TRUNCATE)/i.test(query)) fetchTables();
    } catch (err: any) {
      setResult({
        columns: [], rows: [],
        error: err.response?.data?.error || 'Query execution failed',
      });
    } finally {
      setExecuting(false);
    }
  }, [sql, activeConnection]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleExecute();
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white rounded-lg shadow-sm border overflow-hidden">
      {/* ── Sidebar ── */}
      <div className="w-64 border-r flex flex-col bg-gray-50">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700">Connections</h3>
            <button onClick={() => { setEditingConn(null); setDialogOpen(true); }}
              className="p-1 rounded hover:bg-gray-200 text-gray-500" title="New Connection">
              <PlusIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {connections.length === 0 ? (
            <div className="text-center py-8 px-4">
              <ServerStackIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400 mb-2">No connections</p>
              <button onClick={() => { setEditingConn(null); setDialogOpen(true); }}
                className="text-xs text-picton-blue hover:underline">Add one</button>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {connections.map(conn => (
                <div key={conn.id}
                  className={`group p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                    activeConnection?.id === conn.id && connected
                      ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-gray-100'
                  }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0" onClick={() => handleConnect(conn)}>
                      <CircleStackIcon className={`h-4 w-4 shrink-0 ${
                        activeConnection?.id === conn.id && connected ? 'text-emerald-500' : 'text-gray-400'
                      }`} />
                      <span className="truncate font-medium">{conn.name}</span>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                      <button onClick={() => { setEditingConn(conn); setDialogOpen(true); }}
                        className="p-0.5 rounded hover:bg-gray-200"><CodeBracketIcon className="h-3 w-3" /></button>
                      <button onClick={() => deleteConnection(conn)}
                        className="p-0.5 rounded hover:bg-red-100 text-red-400"><TrashIcon className="h-3 w-3" /></button>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 ml-6 truncate">{conn.host}:{conn.port}/{conn.database}</p>
                </div>
              ))}
            </div>
          )}

          {/* Tables */}
          {connected && (
            <div className="border-t mt-2 pt-2">
              <div className="px-3 flex items-center justify-between mb-1">
                <h4 className="text-xs font-semibold text-gray-500">TABLES</h4>
                <button onClick={() => fetchTables()} className="p-0.5 rounded hover:bg-gray-200">
                  <ArrowPathIcon className={`h-3 w-3 text-gray-400 ${loadingTables ? 'animate-spin' : ''}`} />
                </button>
              </div>
              {loadingTables ? (
                <p className="text-[10px] text-gray-400 text-center py-2">Loading…</p>
              ) : tables.length === 0 ? (
                <p className="text-[10px] text-gray-400 text-center py-2">No tables</p>
              ) : (
                <div className="space-y-0.5 px-2 pb-2">
                  {tables.map(t => (
                    <div key={t.name}>
                      <button
                        onClick={() => {
                          const next = expandedTable === t.name ? null : t.name;
                          setExpandedTable(next);
                          if (next) fetchTableColumns(next);
                        }}
                        onDoubleClick={() => setSql(`SELECT * FROM \`${t.name}\` LIMIT 100;`)}
                        className="w-full flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-gray-100 text-left">
                        {expandedTable === t.name ? <ChevronDownIcon className="h-3 w-3 text-gray-400" /> : <ChevronRightIcon className="h-3 w-3 text-gray-400" />}
                        <TableCellsIcon className="h-3 w-3 text-gray-400" />
                        <span className="truncate">{t.name}</span>
                        {t.type === 'VIEW' && <span className="text-[9px] px-1 rounded bg-blue-50 text-blue-500">VIEW</span>}
                      </button>
                      {expandedTable === t.name && tableColumns[t.name] && (
                        <div className="ml-6 space-y-0.5">
                          {tableColumns[t.name].map((col: any, i: number) => (
                            <div key={i} className="flex items-center gap-1 text-[10px] text-gray-500 px-1 py-0.5">
                              <span className="font-mono truncate">{col.Field || col.COLUMN_NAME || col.name}</span>
                              <span className="text-gray-300 shrink-0">{col.Type || col.DATA_TYPE || ''}</span>
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
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col">
        {/* Query editor */}
        <div className="border-b">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b">
            <button onClick={handleExecute} disabled={executing || !connected}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-colors">
              {executing ? <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" /> : <PlayIcon className="h-3.5 w-3.5" />}
              {executing ? 'Running…' : 'Execute'}
            </button>
            <span className="text-[10px] text-gray-400">Ctrl+Enter to run</span>
            <div className="flex-1" />
            {!connected && (
              <span className="text-xs text-amber-600 flex items-center gap-1">
                <ExclamationTriangleIcon className="h-3.5 w-3.5" /> Not connected
              </span>
            )}
            {connected && activeConnection && (
              <span className="text-xs text-emerald-600 flex items-center gap-1">
                <CircleStackIcon className="h-3.5 w-3.5" /> {activeConnection.name}
              </span>
            )}
          </div>
          <textarea
            ref={textareaRef}
            value={sql}
            onChange={e => setSql(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={8}
            className="w-full p-3 font-mono text-sm resize-y min-h-[120px] border-0 focus:ring-0 bg-gray-900 text-gray-100"
            placeholder="-- Write your SQL query here…"
            spellCheck={false}
          />
        </div>

        {/* Results */}
        <div className="flex-1 overflow-auto">
          {!result && !executing && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <DocumentTextIcon className="h-10 w-10 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Run a query to see results</p>
              </div>
            </div>
          )}

          {executing && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <ArrowPathIcon className="h-8 w-8 animate-spin text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Executing query…</p>
              </div>
            </div>
          )}

          {result && result.error && (
            <div className="p-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-red-800">Query Error</h4>
                    <pre className="text-xs text-red-600 mt-1 whitespace-pre-wrap font-mono">{result.error}</pre>
                  </div>
                </div>
              </div>
            </div>
          )}

          {result && !result.error && (
            <div className="flex flex-col h-full">
              {/* Result stats */}
              <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 border-b text-xs text-gray-500">
                <span>{result.rows.length} row{result.rows.length !== 1 ? 's' : ''}</span>
                {result.affectedRows !== undefined && <span>{result.affectedRows} affected</span>}
                {result.executionTime && (
                  <span className="flex items-center gap-1"><ClockIcon className="h-3 w-3" /> {result.executionTime}ms</span>
                )}
                <span>{result.columns.length} column{result.columns.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Data table */}
              {result.columns.length > 0 && (
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-100">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b w-12">#</th>
                        {result.columns.map(col => (
                          <th key={col} className="px-3 py-2 text-left font-semibold text-gray-600 border-b whitespace-nowrap">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((row, i) => (
                        <tr key={i} className="hover:bg-blue-50/50 border-b border-gray-100">
                          <td className="px-3 py-1.5 text-gray-400 font-mono">{i + 1}</td>
                          {result.columns.map(col => (
                            <td key={col} className="px-3 py-1.5 max-w-[300px] truncate font-mono">
                              {row[col] === null ? <span className="text-gray-300 italic">NULL</span> : String(row[col])}
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
        </div>

        {/* Query history */}
        {queryHistory.length > 0 && (
          <div className="border-t max-h-32 overflow-y-auto">
            <div className="px-3 py-1.5 bg-gray-50 text-[10px] font-semibold text-gray-500 uppercase tracking-wider sticky top-0">
              History
            </div>
            {queryHistory.slice(0, 10).map((q, i) => (
              <button key={i} onClick={() => setSql(q)}
                className="w-full text-left px-3 py-1.5 text-xs font-mono text-gray-600 hover:bg-gray-50 border-b border-gray-50 truncate">
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      <ConnectionDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        connection={editingConn}
        onSave={saveConnection}
      />
    </div>
  );
};

export default DatabaseManager;
