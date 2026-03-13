import React, { useState, useEffect } from 'react';
import { AdminEnterpriseModel, EnterpriseEndpoint, ContactModel } from '../../models';
import { Contact } from '../../types';
import {
  SignalIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  PauseCircleIcon,
  NoSymbolIcon,
  ClipboardDocumentIcon,
  ClockIcon,
  EyeIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import { Card, Button, Input, Select, Textarea } from '../../components/UI';
import Swal from 'sweetalert2';

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    disabled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };
  const icons: Record<string, React.ComponentType<{ className?: string }>> = {
    active: CheckCircleIcon, paused: PauseCircleIcon, disabled: NoSymbolIcon,
  };
  const Icon = icons[status] || CheckCircleIcon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      <Icon className="w-3 h-3" />{status}
    </span>
  );
};

const emptyForm = {
  client_id: '',
  client_name: '',
  contact_id: '' as string | number,
  inbound_provider: 'custom_rest',
  llm_provider: 'ollama',
  llm_model: '',
  llm_system_prompt: '',
  llm_tools_config: '',
  llm_temperature: 0.3,
  llm_max_tokens: 1024,
  target_api_url: '',
  target_api_auth_type: 'none',
  target_api_auth_value: '',
  target_api_headers: '',
};

const EnterpriseEndpoints: React.FC = () => {
  const [endpoints, setEndpoints] = useState<EnterpriseEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<EnterpriseEndpoint | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [showLogs, setShowLogs] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);

  const loadEndpoints = async () => {
    setLoading(true);
    try {
      const data = await AdminEnterpriseModel.getAll();
      setEndpoints(data);
    } catch (err: any) {
      console.error('Failed to load endpoints:', err);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load enterprise endpoints' });
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async (id: string) => {
    setLogsLoading(true);
    try {
      const data = await AdminEnterpriseModel.getLogs(id, 20);
      setLogs(data);
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    loadEndpoints();
    ContactModel.getAll('customers').then(data => {
      const list = Array.isArray(data) ? data : (data as any).data || [];
      setContacts(list);
    }).catch(() => {});
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setShowForm(true);
  };

  const openEdit = (ep: EnterpriseEndpoint) => {
    setEditing(ep);
    setForm({
      client_id: ep.client_id,
      client_name: ep.client_name,
      contact_id: (ep as any).contact_id || '',
      inbound_provider: ep.inbound_provider,
      llm_provider: ep.llm_provider,
      llm_model: ep.llm_model,
      llm_system_prompt: ep.llm_system_prompt,
      llm_tools_config: ep.llm_tools_config || '',
      llm_temperature: ep.llm_temperature || 0.3,
      llm_max_tokens: ep.llm_max_tokens || 1024,
      target_api_url: ep.target_api_url || '',
      target_api_auth_type: ep.target_api_auth_type || 'none',
      target_api_auth_value: ep.target_api_auth_value || '',
      target_api_headers: ep.target_api_headers || '',
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, contact_id: form.contact_id ? Number(form.contact_id) : undefined };
    try {
      if (editing) {
        await AdminEnterpriseModel.update(editing.id, payload);
        Swal.fire({ icon: 'success', title: 'Updated', timer: 1500, showConfirmButton: false });
      } else {
        const created = await AdminEnterpriseModel.create(payload);
        Swal.fire({
          icon: 'success',
          title: 'Endpoint Created',
          html: `<p class="text-sm">Webhook URL:</p><code class="text-xs bg-gray-100 p-2 rounded block mt-2">/api/v1/webhook/${created.id}</code>`,
        });
      }
      setShowForm(false);
      loadEndpoints();
    } catch (err: any) {
      const msg = err.response?.data?.details?.[0]?.message || err.response?.data?.error || 'Save failed';
      Swal.fire({ icon: 'error', title: 'Error', text: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleStatusToggle = async (ep: EnterpriseEndpoint) => {
    const nextStatus = ep.status === 'active' ? 'paused' : 'active';
    const result = await Swal.fire({
      title: `${nextStatus === 'paused' ? 'Pause' : 'Activate'} endpoint?`,
      text: `Client: ${ep.client_name}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: nextStatus === 'paused' ? 'Pause' : 'Activate',
      confirmButtonColor: nextStatus === 'paused' ? '#F59E0B' : '#10B981',
    });
    if (!result.isConfirmed) return;
    try {
      await AdminEnterpriseModel.setStatus(ep.id, nextStatus);
      loadEndpoints();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.error || 'Failed' });
    }
  };

  const handleDelete = async (ep: EnterpriseEndpoint) => {
    const result = await Swal.fire({
      title: 'Delete endpoint?',
      html: `<p>This will permanently delete <strong>${ep.client_name}</strong>'s endpoint and all request logs.</p>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      confirmButtonText: 'Delete',
    });
    if (!result.isConfirmed) return;
    try {
      await AdminEnterpriseModel.delete(ep.id);
      Swal.fire({ icon: 'success', title: 'Deleted', timer: 1200, showConfirmButton: false });
      loadEndpoints();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.error || 'Failed' });
    }
  };

  const copyWebhookUrl = (id: string) => {
    const url = `${window.location.origin}/api/v1/webhook/${id}`;
    navigator.clipboard.writeText(url);
    Swal.fire({ icon: 'success', title: 'Copied!', text: url, timer: 2000, showConfirmButton: false });
  };

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
            <SignalIcon className="w-7 h-7 text-emerald-500" />
            Enterprise Endpoints
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage dynamic webhook endpoints for enterprise clients
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadEndpoints} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300">
            <ArrowPathIcon className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
          >
            <PlusIcon className="w-4 h-4" /> New Endpoint
          </button>
        </div>
      </div>

      {/* Endpoints Table */}
      <Card>
        <div className="p-5">
          {endpoints.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mx-auto mb-4">
                <SignalIcon className="w-10 h-10 text-emerald-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No endpoints configured</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Create your first enterprise endpoint to get started.</p>
              <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 shadow-sm">
                <PlusIcon className="w-4 h-4" /> Create Endpoint
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b-2 border-gray-200 dark:border-gray-700">
                    <th className="pb-3 font-semibold uppercase tracking-wider">Client</th>
                    <th className="pb-3 font-semibold uppercase tracking-wider">Endpoint</th>
                    <th className="pb-3 font-semibold uppercase tracking-wider">Provider</th>
                    <th className="pb-3 font-semibold uppercase tracking-wider">LLM</th>
                    <th className="pb-3 font-semibold uppercase tracking-wider">Status</th>
                    <th className="pb-3 font-semibold uppercase tracking-wider text-right">Requests</th>
                    <th className="pb-3 font-semibold uppercase tracking-wider">Last Active</th>
                    <th className="pb-3 font-semibold uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {endpoints.map((ep) => (
                    <React.Fragment key={ep.id}>
                      <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700/50">
                        <td className="py-4">
                          <p className="font-semibold text-gray-900 dark:text-white">{ep.client_name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{ep.client_id}</p>
                        </td>
                        <td className="py-4">
                          <button
                            onClick={() => copyWebhookUrl(ep.id)}
                            className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-mono bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                            title="Copy webhook URL"
                          >
                            <ClipboardDocumentIcon className="w-3.5 h-3.5" />{ep.id}
                          </button>
                        </td>
                        <td className="py-4">
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg capitalize">
                            {ep.inbound_provider.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-4">
                          <div className="text-sm text-gray-900 dark:text-white font-medium">{ep.llm_provider}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{ep.llm_model}</div>
                        </td>
                        <td className="py-4"><StatusBadge status={ep.status} /></td>
                        <td className="py-4 text-right">
                          <span className="inline-flex items-center px-2 py-1 text-xs font-mono font-semibold bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg">
                            {ep.total_requests.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-4 text-xs text-gray-500 dark:text-gray-400">{ep.last_request_at ? new Date(ep.last_request_at).toLocaleString() : '—'}</td>
                        <td className="py-4">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => { setShowLogs(ep.id); loadLogs(ep.id); }} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors" title="View Logs">
                              <ClockIcon className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleStatusToggle(ep)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="Toggle Status">
                              {ep.status === 'active' ? <PauseCircleIcon className="w-4 h-4 text-amber-500" /> : <CheckCircleIcon className="w-4 h-4 text-green-500" />}
                            </button>
                            <button onClick={() => openEdit(ep)} className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors" title="Edit">
                              <PencilIcon className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(ep)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors" title="Delete">
                              <TrashIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setExpandedRow(expandedRow === ep.id ? null : ep.id)}
                              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                              title="Details"
                            >
                              {expandedRow === ep.id ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedRow === ep.id && (
                        <tr>
                          <td colSpan={8} className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-800/30 p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                              <div>
                                <p className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                                  <ChatBubbleLeftRightIcon className="w-4 h-4 text-purple-500" />
                                  System Prompt
                                </p>
                                <pre className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700 max-h-40 overflow-y-auto whitespace-pre-wrap text-xs text-gray-700 dark:text-gray-300 font-mono leading-relaxed shadow-sm">
                                  {ep.llm_system_prompt}
                                </pre>
                              </div>
                              <div className="space-y-3">
                                <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                                  <p className="font-semibold text-gray-900 dark:text-white mb-1.5 text-xs">Target API</p>
                                  <p className="text-gray-700 dark:text-gray-300 text-xs font-mono">{ep.target_api_url || 'None'}</p>
                                </div>
                                <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                                  <p className="font-semibold text-gray-900 dark:text-white mb-1.5 text-xs">Auth Type</p>
                                  <p className="text-gray-700 dark:text-gray-300 text-xs capitalize">{ep.target_api_auth_type || 'none'}</p>
                                </div>
                                {ep.llm_tools_config && (
                                  <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                                    <p className="font-semibold text-gray-900 dark:text-white mb-1.5 text-xs">Tools</p>
                                    <p className="text-gray-700 dark:text-gray-300 text-xs">{JSON.parse(ep.llm_tools_config).length} functions configured</p>
                                  </div>
                                )}
                                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                  <p className="font-semibold text-gray-900 dark:text-white mb-1.5 text-xs">Webhook URL</p>
                                  <code className="text-emerald-700 dark:text-emerald-400 text-xs font-mono block">
                                    POST /api/v1/webhook/{ep.id}
                                  </code>
                                </div>
                                <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                                  <p className="font-semibold text-gray-900 dark:text-white mb-1.5 text-xs">Created</p>
                                  <p className="text-gray-700 dark:text-gray-300 text-xs">{new Date(ep.created_at).toLocaleString()}</p>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editing ? 'Edit Endpoint' : 'New Enterprise Endpoint'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <XMarkIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-5">
              {/* Client Info */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Client ID</label>
                  <input
                    type="text"
                    value={form.client_id}
                    onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                    placeholder="e.g., silulumanzi"
                    required
                    disabled={!!editing}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Client Name</label>
                  <input
                    type="text"
                    value={form.client_name}
                    onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                    placeholder="e.g., Silulumanzi Water Services"
                    required
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Linked Client Record</label>
                  <select
                    value={form.contact_id}
                    onChange={(e) => setForm({ ...form, contact_id: e.target.value ? Number(e.target.value) : '' })}
                    required
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white"
                  >
                    <option value="">Select a client...</option>
                    {contacts.map(c => (
                      <option key={c.contact_id} value={c.contact_id}>{c.contact_name}{c.contact_person ? ` — ${c.contact_person}` : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Provider Config */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Inbound Provider</label>
                  <select
                    value={form.inbound_provider}
                    onChange={(e) => setForm({ ...form, inbound_provider: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white"
                  >
                    <option value="custom_rest">Custom REST</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="slack">Slack</option>
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                    <option value="web">Web</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">LLM Provider</label>
                  <select
                    value={form.llm_provider}
                    onChange={(e) => setForm({ ...form, llm_provider: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white"
                  >
                    <option value="ollama">Ollama (Local)</option>
                    <option value="openrouter">OpenRouter (Cloud)</option>
                    <option value="openai">OpenAI (Direct)</option>
                  </select>
                </div>
              </div>

              {/* LLM Config */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">LLM Model</label>
                  <input
                    type="text"
                    value={form.llm_model}
                    onChange={(e) => setForm({ ...form, llm_model: e.target.value })}
                    placeholder="e.g., qwen2.5:3b-instruct"
                    required
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Temperature</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={form.llm_temperature}
                    onChange={(e) => setForm({ ...form, llm_temperature: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Tokens</label>
                  <input
                    type="number"
                    min="1"
                    max="16384"
                    value={form.llm_max_tokens}
                    onChange={(e) => setForm({ ...form, llm_max_tokens: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* System Prompt */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">System Prompt</label>
                <textarea
                  value={form.llm_system_prompt}
                  onChange={(e) => setForm({ ...form, llm_system_prompt: e.target.value })}
                  rows={6}
                  required
                  placeholder="You are a helpful assistant..."
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white font-mono"
                />
              </div>

              {/* Tools Config */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tools Config <span className="text-gray-400">(JSON array, optional)</span>
                </label>
                <textarea
                  value={form.llm_tools_config}
                  onChange={(e) => setForm({ ...form, llm_tools_config: e.target.value })}
                  rows={3}
                  placeholder='[{"type":"function","function":{"name":"myTool",...}}]'
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white font-mono"
                />
              </div>

              {/* Target API */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target API URL</label>
                  <input
                    type="text"
                    value={form.target_api_url}
                    onChange={(e) => setForm({ ...form, target_api_url: e.target.value })}
                    placeholder="https://api.example.com/webhook"
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Auth Type</label>
                  <select
                    value={form.target_api_auth_type}
                    onChange={(e) => setForm({ ...form, target_api_auth_type: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white"
                  >
                    <option value="none">None</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="basic">Basic Auth</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>

              {form.target_api_auth_type !== 'none' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Auth Value</label>
                  <input
                    type="password"
                    value={form.target_api_auth_value}
                    onChange={(e) => setForm({ ...form, target_api_auth_value: e.target.value })}
                    placeholder="Token or credentials..."
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white"
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 font-medium"
                >
                  {saving ? 'Saving...' : editing ? 'Update Endpoint' : 'Create Endpoint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Logs Modal */}
      {showLogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <ClockIcon className="w-5 h-5 text-indigo-500" />
                Request Logs — {showLogs}
              </h2>
              <button onClick={() => setShowLogs(null)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <XMarkIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-5">
              {logsLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <ArrowPathIcon className="w-8 h-8 text-emerald-500 animate-spin mb-3" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">Loading logs...</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-16">
                  <ClockIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500 dark:text-gray-400">No request logs yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log: any) => (
                    <div key={log.id} className={`p-4 rounded-xl border text-sm ${log.status === 'error' ? 'border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{new Date(log.timestamp).toLocaleString()}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{log.duration_ms}ms</span>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${log.status === 'success' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                            {log.status}
                          </span>
                        </div>
                      </div>
                      {log.error_message && <p className="text-sm text-red-600 dark:text-red-400 mb-2 font-medium">Error: {log.error_message}</p>}
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium">View Payload</summary>
                        <pre className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-xs text-gray-700 dark:text-gray-300 overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto font-mono border border-gray-200 dark:border-gray-700">
                          {JSON.stringify(JSON.parse(log.inbound_payload || '{}'), null, 2)}
                        </pre>
                      </details>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnterpriseEndpoints;
