import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, PencilIcon, TrashIcon, ArrowPathIcon, AdjustmentsHorizontalIcon, KeyIcon, CheckCircleIcon, XCircleIcon, CodeBracketIcon, EnvelopeIcon, PaperAirplaneIcon, CogIcon, InboxIcon } from '@heroicons/react/24/outline';
import { ColumnDef } from '@tanstack/react-table';
import { SystemSettingModel, SystemSetting, WebmailSettingsModel, WebmailDomainSettings } from '../../models';
import { Input, Button, Card, DataTable, BackButton, Textarea, Select } from '../../components/UI';
import Can from '../../components/Can';
import api from '../../services/api';
import Swal from 'sweetalert2';

const SystemSettings: React.FC = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingSetting, setEditingSetting] = useState<SystemSetting | null>(null);
  const [showPublicOnly, setShowPublicOnly] = useState(false);
  const [pagination, setPagination] = useState({ page: 0, limit: 10, total: 0 });
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'settings' | 'smtp' | 'webmail'>('settings');
  const [formData, setFormData] = useState({
    key: '',
    value: '',
    type: 'string' as 'string' | 'integer' | 'float' | 'boolean' | 'json',
    description: '',
    is_public: false,
  });

  // ── SMTP State ──────────────────────────────────────────────────
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [smtpForm, setSmtpForm] = useState({
    host: '',
    port: '587',
    username: '',
    password: '',
    from_name: '',
    from_email: '',
    encryption: 'tls' as 'tls' | 'ssl' | 'none',
  });
  const [smtpPasswordSet, setSmtpPasswordSet] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');

  // ── Webmail Domain Settings State ───────────────────────────────
  const [webmailLoading, setWebmailLoading] = useState(false);
  const [webmailSaving, setWebmailSaving] = useState(false);
  const [webmailForm, setWebmailForm] = useState<WebmailDomainSettings>({
    imap_host: '', imap_port: 993, imap_secure: true,
    smtp_host: '', smtp_port: 587, smtp_secure: true,
  });

  useEffect(() => {
    loadSettings();
  }, [showPublicOnly, search]);

  useEffect(() => {
    if (activeTab === 'smtp') loadSmtpConfig();
    if (activeTab === 'webmail') loadWebmailSettings();
  }, [activeTab]);

  // ── SMTP Handlers ─────────────────────────────────────────────
  const loadSmtpConfig = async () => {
    try {
      setSmtpLoading(true);
      const res = await api.get('/email/config');
      if (res.data.success && res.data.data) {
        const d = res.data.data;
        setSmtpForm({
          host: d.host || '',
          port: String(d.port || 587),
          username: d.username || '',
          password: '',
          from_name: d.from_name || '',
          from_email: d.from_email || '',
          encryption: d.encryption || 'tls',
        });
        setSmtpPasswordSet(d.password_set || false);
      }
    } catch (error: any) {
      console.error('Failed to load SMTP config:', error);
    } finally {
      setSmtpLoading(false);
    }
  };

  const handleSmtpSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smtpForm.host || !smtpForm.username || !smtpForm.from_name || !smtpForm.from_email) {
      Swal.fire({ icon: 'warning', title: 'Missing Fields', text: 'Please fill in all required fields.' });
      return;
    }
    if (!smtpPasswordSet && !smtpForm.password) {
      Swal.fire({ icon: 'warning', title: 'Password Required', text: 'SMTP password is required for initial setup.' });
      return;
    }
    try {
      setSmtpSaving(true);
      const payload: any = {
        host: smtpForm.host,
        port: parseInt(smtpForm.port, 10),
        username: smtpForm.username,
        from_name: smtpForm.from_name,
        from_email: smtpForm.from_email,
        encryption: smtpForm.encryption,
      };
      if (smtpForm.password) payload.password = smtpForm.password;
      await api.put('/email/config', payload);
      setSmtpPasswordSet(true);
      setSmtpForm(prev => ({ ...prev, password: '' }));
      Swal.fire({ icon: 'success', title: 'Saved!', text: 'SMTP configuration updated.', timer: 2000, showConfirmButton: false });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.message || 'Failed to save SMTP settings.' });
    } finally {
      setSmtpSaving(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmailAddress) {
      Swal.fire({ icon: 'warning', title: 'Enter Email', text: 'Please enter an email address to send the test to.' });
      return;
    }
    try {
      setSendingTestEmail(true);
      const res = await api.post('/email/test', { to: testEmailAddress });
      if (res.data.success) {
        Swal.fire({ icon: 'success', title: 'Test Email Sent!', text: `Check ${testEmailAddress} for the test email.`, timer: 3000, showConfirmButton: false });
      } else {
        Swal.fire({ icon: 'error', title: 'Failed', text: res.data.message || 'Failed to send test email.' });
      }
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Failed', text: error.response?.data?.message || 'Failed to send test email.' });
    } finally {
      setSendingTestEmail(false);
    }
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await SystemSettingModel.getAll(showPublicOnly);
      
      // Filter by search
      let filteredData = data;
      if (search) {
        filteredData = data.filter((setting: SystemSetting) =>
          setting.key.toLowerCase().includes(search.toLowerCase()) ||
          setting.value.toLowerCase().includes(search.toLowerCase()) ||
          (setting.description && setting.description.toLowerCase().includes(search.toLowerCase()))
        );
      }
      
      setSettings(filteredData);
      setPagination(prev => ({ ...prev, total: filteredData.length }));
    } catch (error: any) {
      console.error('Failed to load settings:', error);
      Swal.fire({ 
        icon: 'error', 
        title: 'Error', 
        text: 'Failed to load settings: ' + (error.response?.data?.message || error.message) 
      });
    } finally {
      setLoading(false);
    }
  };

  // ── Webmail Domain Settings Handlers ────────────────────────────
  const loadWebmailSettings = async () => {
    try {
      setWebmailLoading(true);
      const data = await WebmailSettingsModel.get();
      setWebmailForm(data);
    } catch (error: any) {
      console.error('Failed to load webmail settings:', error);
    } finally {
      setWebmailLoading(false);
    }
  };

  const handleWebmailSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webmailForm.imap_host || !webmailForm.smtp_host) {
      Swal.fire({ icon: 'warning', title: 'Missing Fields', text: 'IMAP and SMTP hosts are required.' });
      return;
    }
    try {
      setWebmailSaving(true);
      await WebmailSettingsModel.save(webmailForm);
      Swal.fire({ icon: 'success', title: 'Saved!', text: 'Webmail server settings updated.', timer: 2000, showConfirmButton: false });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.message || 'Failed to save webmail settings.' });
    } finally {
      setWebmailSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      key: '',
      value: '',
      type: 'string',
      description: '',
      is_public: false,
    });
    setEditingSetting(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      if (editingSetting) {
        await SystemSettingModel.update(editingSetting.id, formData);
        Swal.fire({ 
          icon: 'success', 
          title: 'Success!', 
          text: 'Setting updated successfully', 
          timer: 2000, 
          showConfirmButton: false 
        });
      } else {
        await SystemSettingModel.create(formData);
        Swal.fire({ 
          icon: 'success', 
          title: 'Success!', 
          text: 'Setting created successfully', 
          timer: 2000, 
          showConfirmButton: false 
        });
      }

      resetForm();
      loadSettings();
    } catch (error: any) {
      console.error('Failed to save setting:', error);
      Swal.fire({ 
        icon: 'error', 
        title: 'Error', 
        text: 'Failed to save setting: ' + (error.response?.data?.message || error.message) 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (setting: SystemSetting) => {
    setEditingSetting(setting);
    setFormData({
      key: setting.key,
      value: setting.value,
      type: setting.type,
      description: setting.description || '',
      is_public: setting.is_public,
    });
    setShowForm(true);
  };

  const handleDelete = async (setting: SystemSetting) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `Do you want to delete setting "${setting.key}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      setLoading(true);
      await SystemSettingModel.delete(setting.id);
      Swal.fire({ 
        icon: 'success', 
        title: 'Deleted!', 
        text: 'Setting deleted successfully', 
        timer: 2000, 
        showConfirmButton: false 
      });
      loadSettings();
    } catch (error: any) {
      console.error('Failed to delete setting:', error);
      Swal.fire({ 
        icon: 'error', 
        title: 'Error', 
        text: 'Failed to delete setting: ' + (error.response?.data?.message || error.message) 
      });
    } finally {
      setLoading(false);
    }
  };

  const formatValue = (setting: SystemSetting) => {
    switch (setting.type) {
      case 'boolean':
        return setting.value === '1' || setting.value === 'true' ? 'true' : 'false';
      case 'json':
        try {
          return JSON.stringify(JSON.parse(setting.value), null, 2);
        } catch {
          return setting.value;
        }
      default:
        return setting.value;
    }
  };

  // Table columns configuration
  const columns = useMemo<ColumnDef<SystemSetting>[]>(() => [
    {
      accessorKey: 'key',
      header: 'Setting',
      cell: ({ row }) => (
        <div className="flex items-center">
          <div className="flex-shrink-0 h-10 w-10">
            <div className="h-10 w-10 rounded-full bg-secondary-500/10 flex items-center justify-center">
              <AdjustmentsHorizontalIcon className="h-5 w-5 text-secondary-500" />
            </div>
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium text-gray-900 font-mono">
              {row.original.key}
            </div>
            {row.original.description && (
              <div className="text-sm text-gray-500">
                {row.original.description}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'value',
      header: 'Value',
      cell: ({ row }) => {
        const formatted = formatValue(row.original);
        return row.original.type === 'json' ? (
          <pre className="text-xs text-gray-900 font-mono max-w-md overflow-x-auto bg-gray-50 p-2 rounded">
            {formatted}
          </pre>
        ) : (
          <span className="text-sm text-gray-900 break-all">{formatted}</span>
        );
      },
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ getValue }) => {
        const type = getValue() as string;
        const typeColors: Record<string, string> = {
          'string': 'bg-blue-100 text-blue-700',
          'integer': 'bg-green-100 text-green-700',
          'float': 'bg-yellow-100 text-yellow-700',
          'boolean': 'bg-secondary-500/10 text-secondary-700',
          'json': 'bg-pink-100 text-pink-700',
        };
        const colorClass = typeColors[type] || 'bg-gray-100 text-gray-700';
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
            <CodeBracketIcon className="h-3.5 w-3.5 mr-1" />
            {type}
          </span>
        );
      },
    },
    {
      accessorKey: 'is_public',
      header: 'Public',
      cell: ({ getValue }) => {
        const isPublic = getValue() as boolean;
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            isPublic ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {isPublic ? (
              <>
                <CheckCircleIcon className="h-3.5 w-3.5 mr-1" />
                Yes
              </>
            ) : (
              <>
                <XCircleIcon className="h-3.5 w-3.5 mr-1" />
                No
              </>
            )}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Can permission="settings.edit">
            <button
              onClick={() => handleEdit(row.original)}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-secondary-600 bg-secondary-500/10 hover:bg-secondary-500/20 rounded-lg transition-colors"
            >
              <PencilIcon className="h-3.5 w-3.5 mr-1" />
              Edit
            </button>
          </Can>
          <Can permission="settings.delete">
            <button
              onClick={() => handleDelete(row.original)}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-scarlet hover:bg-scarlet/90 rounded-lg transition-colors"
            >
              <TrashIcon className="h-3.5 w-3.5 mr-1" />
              Delete
            </button>
          </Can>
        </div>
      ),
    },
  ], []);

  if (showForm) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {editingSetting ? 'Edit System Setting' : 'Add New System Setting'}
            </h1>
            <p className="text-gray-600">
              {editingSetting ? 'Update' : 'Create'} system configuration setting
            </p>
          </div>
          <BackButton onClick={resetForm} />
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Key"
                type="text"
                required
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                placeholder="e.g., api_timeout, max_upload_size"
                startIcon={<KeyIcon />}
                disabled={!!editingSetting}
                helperText={editingSetting ? 'Key cannot be changed after creation' : 'Unique identifier for this setting'}
              />

              <div>
                <Select
                  label="Type"
                  required
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                >
                  <option value="string">String</option>
                  <option value="integer">Integer</option>
                  <option value="float">Float</option>
                  <option value="boolean">Boolean</option>
                  <option value="json">JSON</option>
                </Select>
                <p className="text-xs text-gray-500 mt-1">Data type for this setting value</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Value
                <span className="text-red-500 ml-1">*</span>
              </label>
              {formData.type === 'boolean' ? (
                <Select
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  required
                >
                  <option value="">Select...</option>
                  <option value="1">true</option>
                  <option value="0">false</option>
                </Select>
              ) : formData.type === 'json' ? (
                <Textarea
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  required
                  rows={6}
                  placeholder='{"key": "value"}'
                  helperText="Valid JSON format required"
                />
              ) : (
                <Input
                  type={formData.type === 'integer' || formData.type === 'float' ? 'number' : 'text'}
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  required
                  placeholder={`Enter ${formData.type} value`}
                />
              )}
            </div>

            <Textarea
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what this setting controls..."
              rows={3}
              helperText="Optional description of the setting's purpose"
            />

            <div className="flex items-center bg-gray-50 p-4 rounded-lg">
              <input
                type="checkbox"
                id="is_public"
                checked={formData.is_public}
                onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                className="h-4 w-4 text-secondary-600 focus:ring-secondary-500 border-gray-300 rounded"
              />
              <label htmlFor="is_public" className="ml-3 block text-sm font-medium text-gray-700">
                Public (accessible without authentication)
              </label>
            </div>

            <div className="flex justify-end space-x-4 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={resetForm}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={loading}
                disabled={loading}
              >
                {editingSetting ? 'Update Setting' : 'Create Setting'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with gradient background */}
      <div className="bg-gradient-to-r from-secondary-500 to-secondary-600 rounded-xl shadow-lg p-6 text-white">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">System Settings</h1>
            <p className="text-white/90">Manage system-level configuration and services</p>
          </div>
          <div className="flex items-center gap-3">
            <Can permission="updates.manage">
              <button
                onClick={() => navigate('/system/updates')}
                className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-semibold text-emerald-600 bg-white hover:bg-gray-50 shadow-md transition-all hover:shadow-lg"
                title="Check for system updates"
              >
                <ArrowPathIcon className="h-5 w-5 mr-2" />
                Updates
              </button>
            </Can>
            {activeTab === 'settings' && (
              <Can permission="settings.create">
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-semibold text-secondary-600 bg-white hover:bg-gray-50 shadow-md transition-all hover:shadow-lg"
                >
                  <PlusIcon className="h-5 w-5 mr-2" />
                  Add Setting
                </button>
              </Can>
            )}
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex gap-1 border-b border-white/20 mb-4">
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-all ${
              activeTab === 'settings'
                ? 'bg-white/20 text-white border-b-2 border-white'
                : 'text-white/60 hover:text-white/80'
            }`}
          >
            <AdjustmentsHorizontalIcon className="h-4 w-4" />
            Key-Value Settings
          </button>
          <button
            onClick={() => setActiveTab('smtp')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-all ${
              activeTab === 'smtp'
                ? 'bg-white/20 text-white border-b-2 border-white'
                : 'text-white/60 hover:text-white/80'
            }`}
          >
            <EnvelopeIcon className="h-4 w-4" />
            Email / SMTP
          </button>
          <button
            onClick={() => setActiveTab('webmail')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-all ${
              activeTab === 'webmail'
                ? 'bg-white/20 text-white border-b-2 border-white'
                : 'text-white/60 hover:text-white/80'
            }`}
          >
            <InboxIcon className="h-4 w-4" />
            Webmail Server
          </button>
        </div>

        {activeTab === 'settings' && (
          <>
            {/* Info Box */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <h3 className="font-semibold text-white mb-2">⚠️ System Settings vs App Settings</h3>
              <p className="text-sm text-white/90">
                <strong>System Settings</strong> (this page) are low-level configuration values stored in 
                <code className="bg-white/20 px-2 py-1 rounded mx-1">sys_settings</code> table.
                <br />
                <strong>App Settings</strong> are business-level settings (site name, logo, VAT rates) stored in 
                <code className="bg-white/20 px-2 py-1 rounded mx-1">tb_settings</code> table.
              </p>
            </div>

            {/* Search and Filter Bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search settings..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm"
                />
                <svg className="absolute left-3 top-2.5 h-5 w-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              <div className="flex items-center bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
                <input
                  type="checkbox"
                  id="public_only"
                  checked={showPublicOnly}
                  onChange={(e) => setShowPublicOnly(e.target.checked)}
                  className="h-4 w-4 text-white focus:ring-white/50 border-white/20 rounded bg-white/10"
                />
                <label htmlFor="public_only" className="ml-3 block text-sm text-white">
                  Show only public settings
                </label>
              </div>
            </div>
          </>
        )}

        {activeTab === 'smtp' && (
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <h3 className="font-semibold text-white mb-2">📧 Email Service Configuration</h3>
            <p className="text-sm text-white/90">
              Configure your SMTP server to enable email sending for notifications, 2FA verification codes, invoices, and quotations.
              Credentials are stored securely in the credentials vault.
            </p>
          </div>
        )}

        {activeTab === 'webmail' && (
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <h3 className="font-semibold text-white mb-2">📬 Webmail Server Configuration</h3>
            <p className="text-sm text-white/90">
              Configure the domain mail server settings (IMAP &amp; SMTP) used by all user mailboxes.
              All email accounts on this platform connect to the same mail server. Individual users add their email accounts from their profile.
            </p>
          </div>
        )}
      </div>

      {/* Settings Table Tab */}
      {activeTab === 'settings' && (
        <DataTable
          data={settings}
          columns={columns}
          loading={loading}
          searchable={false}
          emptyMessage="No settings found. Click 'Add Setting' to get started."
          pageSize={pagination.limit}
          serverSide={false}
        />
      )}

      {/* SMTP Configuration Tab */}
      {activeTab === 'smtp' && (
        <Card>
          {smtpLoading ? (
            <div className="p-6 animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
            </div>
          ) : (
            <form onSubmit={handleSmtpSave} className="p-6 space-y-6">
              <div className="flex items-center mb-2">
                <EnvelopeIcon className="h-6 w-6 text-green-600 mr-2" />
                <h2 className="text-xl font-semibold text-gray-900">SMTP Configuration</h2>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex">
                  <CogIcon className="h-5 w-5 text-yellow-600 mr-2 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-yellow-800">SMTP Settings</h3>
                    <p className="text-sm text-yellow-700 mt-1">
                      Configure your email server settings to enable email notifications, 2FA verification, and invoicing.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label="SMTP Host"
                  placeholder="smtp.gmail.com"
                  required
                  value={smtpForm.host}
                  onChange={(e) => setSmtpForm(prev => ({ ...prev, host: e.target.value }))}
                />

                <Input
                  label="SMTP Port"
                  type="number"
                  placeholder="587"
                  required
                  value={smtpForm.port}
                  onChange={(e) => setSmtpForm(prev => ({ ...prev, port: e.target.value }))}
                />

                <Input
                  label="SMTP Username"
                  placeholder="your-email@gmail.com"
                  required
                  value={smtpForm.username}
                  onChange={(e) => setSmtpForm(prev => ({ ...prev, username: e.target.value }))}
                />

                <Input
                  label="SMTP Password"
                  type="password"
                  placeholder={smtpPasswordSet ? '••••••••  (leave blank to keep current)' : 'Enter SMTP password'}
                  value={smtpForm.password}
                  onChange={(e) => setSmtpForm(prev => ({ ...prev, password: e.target.value }))}
                  helperText={smtpPasswordSet ? 'Leave blank to keep the existing password' : 'Required for initial setup'}
                />

                <Input
                  label="From Name"
                  placeholder="Company Name"
                  required
                  value={smtpForm.from_name}
                  onChange={(e) => setSmtpForm(prev => ({ ...prev, from_name: e.target.value }))}
                  helperText="Name that appears in sent emails"
                />

                <Input
                  label="From Email"
                  type="email"
                  placeholder="noreply@company.com"
                  required
                  value={smtpForm.from_email}
                  onChange={(e) => setSmtpForm(prev => ({ ...prev, from_email: e.target.value }))}
                  helperText="Email address that appears in sent emails"
                />

                <div className="md:col-span-2">
                  <Select
                    label="Encryption Method"
                    required
                    value={smtpForm.encryption}
                    onChange={(e) => setSmtpForm(prev => ({ ...prev, encryption: e.target.value as any }))}
                  >
                    <option value="tls">TLS (Recommended)</option>
                    <option value="ssl">SSL</option>
                    <option value="none">None (Not Recommended)</option>
                  </Select>
                </div>
              </div>

              {/* Test Email Section */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-900 mb-3">Test Email Configuration</h4>
                <p className="text-sm text-blue-700 mb-3">
                  Save your SMTP settings first, then send a test email to verify everything works.
                </p>
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <Input
                      label="Test Email Address"
                      type="email"
                      placeholder="test@example.com"
                      value={testEmailAddress}
                      onChange={(e) => setTestEmailAddress(e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSendTestEmail}
                    loading={sendingTestEmail}
                    disabled={sendingTestEmail || !testEmailAddress}
                    startIcon={<PaperAirplaneIcon className="h-4 w-4" />}
                    className="mb-0.5"
                  >
                    {sendingTestEmail ? 'Sending...' : 'Send Test'}
                  </Button>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end space-x-4 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={loadSmtpConfig}
                  disabled={smtpSaving}
                >
                  Reset
                </Button>
                <Button
                  type="submit"
                  loading={smtpSaving}
                  disabled={smtpSaving}
                >
                  {smtpSaving ? 'Saving...' : 'Save SMTP Settings'}
                </Button>
              </div>
            </form>
          )}
        </Card>
      )}

      {/* Webmail Server Configuration Tab */}
      {activeTab === 'webmail' && (
        <Card>
          {webmailLoading ? (
            <div className="p-6 animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
            </div>
          ) : (
            <form onSubmit={handleWebmailSave} className="p-6 space-y-6">
              <div className="flex items-center mb-2">
                <InboxIcon className="h-6 w-6 text-picton-blue mr-2" />
                <h2 className="text-xl font-semibold text-gray-900">Domain Mail Server</h2>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex">
                  <CogIcon className="h-5 w-5 text-blue-600 mr-2 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-blue-800">Shared Server Settings</h3>
                    <p className="text-sm text-blue-700 mt-1">
                      These IMAP and SMTP settings apply to all user mailboxes. Users only need to add their email address and password from their profile.
                    </p>
                  </div>
                </div>
              </div>

              {/* IMAP Section */}
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <EnvelopeIcon className="h-5 w-5 text-gray-600" />
                  Incoming Mail (IMAP)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label="IMAP Host"
                    placeholder="mail.yourdomain.com"
                    required
                    value={webmailForm.imap_host}
                    onChange={(e) => setWebmailForm(prev => ({ ...prev, imap_host: e.target.value }))}
                    helperText="The IMAP server hostname for incoming mail"
                  />
                  <Input
                    label="IMAP Port"
                    type="number"
                    placeholder="993"
                    required
                    value={String(webmailForm.imap_port)}
                    onChange={(e) => setWebmailForm(prev => ({ ...prev, imap_port: parseInt(e.target.value) || 993 }))}
                    helperText="993 for SSL/TLS, 143 for STARTTLS"
                  />
                  <div className="flex items-end pb-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={webmailForm.imap_secure}
                        onChange={(e) => setWebmailForm(prev => ({ ...prev, imap_secure: e.target.checked }))}
                        className="h-4 w-4 rounded border-gray-300 text-picton-blue focus:ring-picton-blue"
                      />
                      <span className="text-sm text-gray-700">Use SSL/TLS</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* SMTP Section */}
              <div className="border-t pt-6">
                <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <PaperAirplaneIcon className="h-5 w-5 text-gray-600" />
                  Outgoing Mail (SMTP)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label="SMTP Host"
                    placeholder="mail.yourdomain.com"
                    required
                    value={webmailForm.smtp_host}
                    onChange={(e) => setWebmailForm(prev => ({ ...prev, smtp_host: e.target.value }))}
                    helperText="The SMTP server hostname for outgoing mail"
                  />
                  <Input
                    label="SMTP Port"
                    type="number"
                    placeholder="587"
                    required
                    value={String(webmailForm.smtp_port)}
                    onChange={(e) => setWebmailForm(prev => ({ ...prev, smtp_port: parseInt(e.target.value) || 587 }))}
                    helperText="587 for STARTTLS, 465 for SSL"
                  />
                  <div className="flex items-end pb-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={webmailForm.smtp_secure}
                        onChange={(e) => setWebmailForm(prev => ({ ...prev, smtp_secure: e.target.checked }))}
                        className="h-4 w-4 rounded border-gray-300 text-picton-blue focus:ring-picton-blue"
                      />
                      <span className="text-sm text-gray-700">Use SSL/TLS</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end space-x-4 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={loadWebmailSettings}
                  disabled={webmailSaving}
                >
                  Reset
                </Button>
                <Button
                  type="submit"
                  loading={webmailSaving}
                  disabled={webmailSaving}
                >
                  {webmailSaving ? 'Saving...' : 'Save Webmail Settings'}
                </Button>
              </div>
            </form>
          )}
        </Card>
      )}
    </div>
  );
};

export default SystemSettings;