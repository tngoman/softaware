import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  PencilIcon,
  TrashIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  CubeIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
  ClipboardDocumentListIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';
import Swal from 'sweetalert2';
import { notify } from '../../utils/notify';
import api from '../../services/api';
import { useSoftware } from '../../hooks/useSoftware';
import { useModules } from '../../hooks/useModules';
import { Software } from '../../types';
import { setSoftwareToken, hasSoftwareToken } from '../../utils/softwareAuth';

/* ═══════════════════════════════════════════════════════════════
   Software Management Page — mirrors desktop SoftwarePage
   Two tabs: Overview (software cards) + Modules (per-software)
   ═══════════════════════════════════════════════════════════════ */

interface Module {
  id: number;
  name: string;
  description?: string;
  software_id: number;
  developer_count?: number;
  task_count?: number;
}

/* ── Authenticate Dialog ─────────────────────────────────────── */
const AuthenticateDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  software: Software;
  onSuccess: () => void;
}> = ({ open, onClose, software, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'otp'>('idle');
  const [message, setMessage] = useState('');
  const [otp, setOtp] = useState('');
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [otpUserId, setOtpUserId] = useState<number | null>(null);
  const [response, setResponse] = useState<string | null>(null);

  const apiUrl = software.external_mode === 'live'
    ? software.external_live_url
    : software.external_test_url;

  const authenticate = async (useOtp = false) => {
    if (!apiUrl) { setMessage('No API URL configured'); setStatus('error'); return; }
    setLoading(true);
    setMessage('');

    try {
      const res = await api.post('/softaware/tasks/authenticate', {
        apiUrl,
        username: software.external_username,
        password: software.external_password,
        otp: useOtp ? otp : null,
        otpToken,
        userId: otpUserId,
      });

      const data = res.data;
      setResponse(JSON.stringify(data, null, 2));

      if (data.success && data.token) {
        setSoftwareToken(software.id, data.token);
        setStatus('success');
        setMessage('Authentication successful!');
        setTimeout(() => { onSuccess(); onClose(); }, 1000);
      } else if (data.requires_otp) {
        setStatus('otp');
        setOtpToken(data.otp_token || null);
        setOtpUserId(data.user_id || data.userId || null);
        setMessage('OTP verification required — check your SMS');
      } else {
        setStatus('error');
        setMessage(data.error || 'Authentication failed');
      }
    } catch (err: any) {
      setStatus('error');
      setMessage(err.response?.data?.error || err.message || 'Authentication failed');
      setResponse(JSON.stringify({ error: err.message }, null, 2));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Authenticate — {software.name}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><XMarkIcon className="h-5 w-5" /></button>
        </div>
        <div className="p-4 space-y-4">
          {message && (
            <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
              status === 'success' ? 'bg-emerald-50 text-emerald-700' :
              status === 'error' ? 'bg-red-50 text-red-700' :
              'bg-blue-50 text-blue-700'
            }`}>
              {status === 'success' && <CheckCircleIcon className="h-4 w-4" />}
              {status === 'error' && <ExclamationTriangleIcon className="h-4 w-4" />}
              {message}
            </div>
          )}

          <p className="text-sm text-gray-500">
            Authenticate with the external system using configured credentials.
            <br />Environment: <strong>{software.external_mode === 'live' ? 'Production' : 'Test'}</strong>
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => authenticate(false)}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
            >
              {loading ? 'Authenticating…' : 'Authenticate'}
            </button>
            {response && (
              <button onClick={() => { setStatus('idle'); setMessage(''); setResponse(null); }}
                className="px-4 py-2 text-sm font-medium border rounded-lg hover:bg-gray-50">
                Clear
              </button>
            )}
          </div>

          {status === 'otp' && (
            <div className="p-4 bg-gray-50 rounded-lg border space-y-3">
              <label className="block text-sm font-medium text-gray-700">OTP Code</label>
              <input
                value={otp}
                onChange={e => setOtp(e.target.value)}
                placeholder="Enter 6-digit code"
                maxLength={6}
                className="w-40 px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:ring-picton-blue"
              />
              <p className="text-xs text-gray-500">Enter the code sent to your phone</p>
              <button
                onClick={() => authenticate(true)}
                disabled={loading || !otp.trim()}
                className="w-full px-4 py-2 text-sm font-medium bg-picton-blue text-white rounded-lg hover:bg-picton-blue/90 disabled:opacity-50"
              >
                {loading ? 'Verifying…' : 'Verify OTP'}
              </button>
            </div>
          )}

          {response && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">API Response</label>
              <pre className="bg-gray-50 border rounded-lg p-3 text-xs overflow-auto max-h-[200px] break-all whitespace-pre-wrap">
                {response}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Software Dialog (Create / Edit) ─────────────────────────── */
const SoftwareDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  software: Software | null;
  onSaved: () => void;
}> = ({ open, onClose, software, onSaved }) => {
  const [tab, setTab] = useState<'general' | 'integration'>('general');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    name: '', software_key: '', description: '',
    has_external_integration: false,
    external_username: '', external_password: '',
    external_live_url: '', external_test_url: '',
    external_mode: 'live', order_number: '',
  });

  useEffect(() => {
    if (open) {
      setTab('general');
      setErrors({});
      if (software) {
        setForm({
          name: software.name || '',
          software_key: software.software_key || '',
          description: software.description || '',
          has_external_integration: !!software.has_external_integration,
          external_username: software.external_username || '',
          external_password: software.external_password || '',
          external_live_url: software.external_live_url || '',
          external_test_url: software.external_test_url || '',
          external_mode: software.external_mode || 'live',
          order_number: String(software.order_number || ''),
        });
      } else {
        setForm({
          name: '', software_key: '', description: '',
          has_external_integration: false,
          external_username: '', external_password: '',
          external_live_url: '', external_test_url: '',
          external_mode: 'live', order_number: '',
        });
      }
    }
  }, [open, software]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.software_key.trim()) e.software_key = 'Software key is required';
    else if (!/^[a-zA-Z0-9_-]+$/.test(form.software_key)) e.software_key = 'Letters, numbers, hyphens, underscores only';
    if (form.has_external_integration) {
      if (!form.external_username.trim()) e.external_username = 'Username required';
      if (!form.external_password.trim()) e.external_password = 'Password required';
      if (!form.external_live_url.trim()) e.external_live_url = 'Live URL required';
      if (!form.external_test_url.trim()) e.external_test_url = 'Test URL required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      if (software) {
        await api.put('/softaware/software', { ...form, id: software.id });
      } else {
        await api.post('/softaware/software', form);
      }
      notify.success(software ? 'Software updated' : 'Software created');
      onSaved();
      onClose();
    } catch (err: any) {
      notify.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const Field: React.FC<{
    label: string; id: string; error?: string;
    children: React.ReactNode;
  }> = ({ label, id, error, children }) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">{software ? 'Edit Software' : 'Create Software'}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><XMarkIcon className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          {/* Tabs */}
          <div className="flex border-b">
            {(['general', 'integration'] as const).map(t => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={`px-6 py-3 text-sm font-medium capitalize ${tab === t
                  ? 'border-b-2 border-picton-blue text-picton-blue'
                  : 'text-gray-500 hover:text-gray-700'}`}>
                {t}
              </button>
            ))}
          </div>

          <div className="p-6 space-y-4">
            {tab === 'general' && (
              <>
                <Field label="Software Name *" id="name" error={errors.name}>
                  <input id="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:ring-picton-blue" />
                </Field>
                <Field label="Software Key *" id="software_key" error={errors.software_key}>
                  <input id="software_key" value={form.software_key}
                    onChange={e => setForm({ ...form, software_key: e.target.value })}
                    disabled={!!software}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:ring-picton-blue disabled:bg-gray-100" />
                  <p className="text-xs text-gray-400 mt-1">Unique identifier (letters, numbers, hyphens, underscores only)</p>
                </Field>
                <Field label="Description" id="description">
                  <textarea id="description" value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    rows={4} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:ring-picton-blue" />
                </Field>
              </>
            )}
            {tab === 'integration' && (
              <>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.has_external_integration}
                    onChange={e => setForm({ ...form, has_external_integration: e.target.checked })}
                    className="h-4 w-4 rounded text-picton-blue" />
                  <span className="text-sm font-medium text-gray-700">Enable external API integration</span>
                </label>
                <p className="text-xs text-gray-400">Connect this software to an external task management system</p>

                {form.has_external_integration && (
                  <>
                    <Field label="Username *" id="external_username" error={errors.external_username}>
                      <input id="external_username" value={form.external_username}
                        onChange={e => setForm({ ...form, external_username: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </Field>
                    <Field label="Password *" id="external_password" error={errors.external_password}>
                      <input id="external_password" type="password" value={form.external_password}
                        onChange={e => setForm({ ...form, external_password: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </Field>
                    <Field label="Live API URL *" id="external_live_url" error={errors.external_live_url}>
                      <input id="external_live_url" value={form.external_live_url}
                        onChange={e => setForm({ ...form, external_live_url: e.target.value })}
                        placeholder="https://api.example.com" className="w-full px-3 py-2 border rounded-lg text-sm" />
                      <p className="text-xs text-gray-400 mt-1">Production environment URL</p>
                    </Field>
                    <Field label="Test API URL *" id="external_test_url" error={errors.external_test_url}>
                      <input id="external_test_url" value={form.external_test_url}
                        onChange={e => setForm({ ...form, external_test_url: e.target.value })}
                        placeholder="https://test.example.com" className="w-full px-3 py-2 border rounded-lg text-sm" />
                      <p className="text-xs text-gray-400 mt-1">Development/testing environment URL</p>
                    </Field>
                    <Field label="Default Environment" id="external_mode">
                      <select id="external_mode" value={form.external_mode}
                        onChange={e => setForm({ ...form, external_mode: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                        <option value="test">Test</option>
                        <option value="live">Live</option>
                      </select>
                    </Field>
                    <Field label="Default Order Number" id="order_number">
                      <input id="order_number" value={form.order_number}
                        onChange={e => setForm({ ...form, order_number: e.target.value })}
                        placeholder="e.g. PO12345" className="w-full px-3 py-2 border rounded-lg text-sm" />
                      <p className="text-xs text-gray-400 mt-1">Order number for budget tracking</p>
                    </Field>
                  </>
                )}
              </>
            )}
          </div>

          <div className="flex justify-end gap-3 p-4 border-t">
            <button type="button" onClick={onClose} disabled={loading}
              className="px-4 py-2 text-sm font-medium border rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm font-medium bg-picton-blue text-white rounded-lg hover:bg-picton-blue/90 disabled:opacity-50">
              {loading ? 'Saving…' : software ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ── Modules Tab ─────────────────────────────────────────────── */
const ModulesTab: React.FC<{
  softwareList: Software[];
}> = ({ softwareList }) => {
  const [selectedSw, setSelectedSw] = useState<Software | null>(null);
  const { modules, isLoading } = useModules(selectedSw?.id);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      if (editingModule) {
        await api.put(`/softaware/modules?id=${editingModule.id}`, { name: form.name, description: form.description });
        notify.success('Module updated');
      } else {
        await api.post('/softaware/modules', { software_id: selectedSw!.id, name: form.name, description: form.description });
        notify.success('Module created');
      }
      setDialogOpen(false);
      // Force re-render by selecting again
      const sw = selectedSw;
      setSelectedSw(null);
      setTimeout(() => setSelectedSw(sw), 0);
    } catch (err: any) {
      notify.error(err.response?.data?.error || 'Failed to save module');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (mod: Module) => {
    const result = await Swal.fire({
      title: 'Delete Module',
      text: `Delete "${mod.name}"? This cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Delete',
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/softaware/modules?id=${mod.id}`);
      notify.success('Module deleted');
      const sw = selectedSw;
      setSelectedSw(null);
      setTimeout(() => setSelectedSw(sw), 0);
    } catch {
      notify.error('Failed to delete module');
    }
  };

  if (!selectedSw) {
    return (
      <div className="text-center py-12">
        <CubeIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Software</h3>
        <p className="text-sm text-gray-500 mb-6">Choose a software product to manage its modules</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-w-3xl mx-auto">
          {softwareList.map(sw => (
            <button key={sw.id} onClick={() => setSelectedSw(sw)}
              className="text-left p-4 border rounded-lg hover:bg-gray-50 transition-colors">
              <h4 className="font-semibold text-gray-900">{sw.name}</h4>
              {sw.description && <p className="text-sm text-gray-500 line-clamp-2 mt-1">{sw.description}</p>}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedSw(null)} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Modules for {selectedSw.name}</h3>
            <p className="text-sm text-gray-500">Manage modules to organize development work</p>
          </div>
        </div>
        <button
          onClick={() => { setEditingModule(null); setForm({ name: '', description: '' }); setDialogOpen(true); }}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-picton-blue text-white rounded-lg hover:bg-picton-blue/90">
          <PlusIcon className="h-4 w-4" /> New Module
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48 text-gray-400">Loading modules…</div>
      ) : modules.length === 0 ? (
        <div className="text-center py-16 border rounded-lg">
          <ClipboardDocumentListIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <h4 className="font-medium text-gray-900 mb-1">No modules yet</h4>
          <p className="text-sm text-gray-500">Create your first module to organize development work</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((mod: any) => (
            <div key={mod.id} className="border rounded-lg bg-white p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{mod.name}</h4>
                  {mod.description && <p className="text-sm text-gray-500 mt-1">{mod.description}</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditingModule(mod); setForm({ name: mod.name, description: mod.description || '' }); setDialogOpen(true); }}
                    className="p-1.5 rounded hover:bg-gray-100"><PencilIcon className="h-4 w-4 text-gray-500" /></button>
                  <button onClick={() => handleDelete(mod)}
                    className="p-1.5 rounded hover:bg-red-50"><TrashIcon className="h-4 w-4 text-red-500" /></button>
                </div>
              </div>
              <div className="flex items-center gap-4 pt-3 border-t text-sm text-gray-500">
                <span className="flex items-center gap-1"><UserGroupIcon className="h-4 w-4" />{mod.developer_count || 0} developers</span>
                <span className="flex items-center gap-1"><ClipboardDocumentListIcon className="h-4 w-4" />{mod.task_count || 0} tasks</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Module Create/Edit Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDialogOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">{editingModule ? 'Edit Module' : 'New Module'}</h3>
              <button onClick={() => setDialogOpen(false)} className="p-1 rounded hover:bg-gray-100"><XMarkIcon className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  required className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Module name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="What is this module for?" />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setDialogOpen(false)}
                  className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={submitting || !form.name.trim()}
                  className="px-4 py-2 text-sm font-medium bg-picton-blue text-white rounded-lg hover:bg-picton-blue/90 disabled:opacity-50">
                  {submitting ? 'Saving…' : editingModule ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════════ */

const SoftwareManagement: React.FC = () => {
  const { software, isLoading, error, refetch } = useSoftware();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'overview' | 'modules'>('overview');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Software | null>(null);
  const [authSoftware, setAuthSoftware] = useState<Software | null>(null);

  const filtered = useMemo(() => {
    if (!search) return software;
    const s = search.toLowerCase();
    return software.filter(sw =>
      sw.name?.toLowerCase().includes(s) ||
      sw.software_key?.toLowerCase().includes(s) ||
      sw.description?.toLowerCase().includes(s)
    );
  }, [software, search]);

  const handleDelete = async (sw: Software) => {
    const result = await Swal.fire({
      title: 'Delete Software',
      text: `Delete "${sw.name}"? This will also delete all associated updates.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Delete',
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/softaware/software?id=${sw.id}`);
      notify.success('Software deleted');
      refetch();
    } catch {
      notify.error('Failed to delete software');
    }
  };

  const hasExternal = (sw: Software) =>
    sw.external_username && sw.external_password && (sw.external_live_url || sw.external_test_url);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Software Management</h2>
            <p className="text-sm text-gray-500">Manage your software products</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => refetch()}
              className="p-2 border rounded-lg hover:bg-gray-50"><ArrowPathIcon className="h-4 w-4" /></button>
            <button onClick={() => { setEditing(null); setDialogOpen(true); }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-picton-blue text-white rounded-lg hover:bg-picton-blue/90">
              <PlusIcon className="h-4 w-4" /> New Software
            </button>
          </div>
        </div>
        <div className="relative max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search software…" className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" />
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="flex border-b">
          {(['overview', 'modules'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-6 py-3 text-sm font-medium capitalize ${tab === t
                ? 'border-b-2 border-picton-blue text-picton-blue'
                : 'text-gray-500 hover:text-gray-700'}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === 'overview' ? (
            isLoading ? (
              <div className="flex items-center justify-center h-48 text-gray-400">Loading software…</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <CubeIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <h3 className="font-medium text-gray-900 mb-1">No software found</h3>
                <p className="text-sm text-gray-500">Add your first software product to get started</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map(sw => (
                  <div key={sw.id} className="border rounded-lg bg-white p-4 hover:-translate-y-0.5 hover:shadow-md transition-all">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{sw.name}</h3>
                        <p className="text-xs text-gray-400 font-mono">{sw.software_key}</p>
                        {hasExternal(sw) && (
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] text-gray-600">
                              <LinkIcon className="h-3 w-3" /> External Integration
                            </span>
                            {hasSoftwareToken(sw.id) && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px]">
                                <CheckCircleIcon className="h-3 w-3" /> Authenticated
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {hasExternal(sw) && (
                          <button onClick={() => setAuthSoftware(sw)} title="Authenticate"
                            className="p-1.5 rounded hover:bg-gray-100"><ShieldCheckIcon className="h-4 w-4 text-gray-500" /></button>
                        )}
                        <button onClick={() => { setEditing(sw); setDialogOpen(true); }}
                          className="p-1.5 rounded hover:bg-gray-100"><PencilIcon className="h-4 w-4 text-gray-500" /></button>
                        <button onClick={() => handleDelete(sw)}
                          className="p-1.5 rounded hover:bg-red-50"><TrashIcon className="h-4 w-4 text-red-500" /></button>
                      </div>
                    </div>
                    {sw.description && (
                      <p className="text-sm text-gray-500 line-clamp-3 mt-2" dangerouslySetInnerHTML={{ __html: sw.description }} />
                    )}
                    {(sw.latest_version || sw.total_updates) && (
                      <div className="flex items-center gap-3 pt-3 mt-3 border-t text-xs text-gray-400">
                        {sw.latest_version && <span>v{sw.latest_version}</span>}
                        {sw.total_updates !== undefined && <span>{sw.total_updates} updates</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            <ModulesTab softwareList={software} />
          )}
        </div>
      </div>

      <SoftwareDialog open={dialogOpen} onClose={() => setDialogOpen(false)} software={editing} onSaved={refetch} />
      {authSoftware && (
        <AuthenticateDialog
          open={!!authSoftware}
          onClose={() => setAuthSoftware(null)}
          software={authSoftware}
          onSuccess={() => { notify.success('Authenticated!'); setAuthSoftware(null); }}
        />
      )}
    </div>
  );
};

export default SoftwareManagement;
