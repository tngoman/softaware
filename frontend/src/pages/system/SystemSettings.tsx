import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, PencilIcon, TrashIcon, ArrowPathIcon, AdjustmentsHorizontalIcon, KeyIcon, CheckCircleIcon, XCircleIcon, CodeBracketIcon } from '@heroicons/react/24/outline';
import { ColumnDef } from '@tanstack/react-table';
import { SystemSettingModel, SystemSetting } from '../../models';
import { Input, Button, Card, DataTable, BackButton, Textarea, Select } from '../../components/UI';
import Can from '../../components/Can';
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
  const [formData, setFormData] = useState({
    key: '',
    value: '',
    type: 'string' as 'string' | 'integer' | 'float' | 'boolean' | 'json',
    description: '',
    is_public: false,
  });

  useEffect(() => {
    loadSettings();
  }, [showPublicOnly, search]);

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
            <p className="text-white/90">Manage system-level configuration (sys_settings table)</p>
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
            <Can permission="settings.create">
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-semibold text-secondary-600 bg-white hover:bg-gray-50 shadow-md transition-all hover:shadow-lg"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Add Setting
              </button>
            </Can>
          </div>
        </div>

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
      </div>

      {/* Settings Table */}
      <DataTable
        data={settings}
        columns={columns}
        loading={loading}
        searchable={false}
        emptyMessage="No settings found. Click 'Add Setting' to get started."
        pageSize={pagination.limit}
        serverSide={false}
      />
    </div>
  );
};

export default SystemSettings;