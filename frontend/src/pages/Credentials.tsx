import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
  PlusIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  KeyIcon,
  LockClosedIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import DataTable from '../components/UI/DataTable';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import Select from '../components/UI/Select';
import Card from '../components/UI/Card';
import { CredentialModel } from '../models';
import type { Credential } from '../models';
import type { ColumnDef } from '@tanstack/react-table';
import { formatDate, formatDateTime } from '../utils/formatters';

export const Credentials: React.FC = () => {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterEnvironment, setFilterEnvironment] = useState<string>('');
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedCredential, setSelectedCredential] = useState<Credential | null>(null);
  const [showValue, setShowValue] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [credentialToDelete, setCredentialToDelete] = useState<Credential | null>(null);

  useEffect(() => {
    loadCredentials();
  }, [filterType, filterEnvironment]);

  const loadCredentials = async () => {
    try {
      setLoading(true);
      const filters: any = {};
      if (filterType) filters.type = filterType;
      if (filterEnvironment) filters.environment = filterEnvironment;
      
      const data = await CredentialModel.getAll(false, filters);
      setCredentials(data);
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Failed to Load',
        text: error.message || 'Failed to load credentials'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadCredentials();
      return;
    }

    try {
      setLoading(true);
      const data = await CredentialModel.search(searchQuery, false);
      setCredentials(data);
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Search Failed',
        text: error.message || 'Failed to search credentials'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewDecrypted = async (credential: Credential) => {
    try {
      const decrypted = await CredentialModel.getById(credential.id, true);
      setSelectedCredential(decrypted);
      setShowValue(false);
      setViewDialogOpen(true);
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Decryption Failed',
        text: error.message || 'Failed to decrypt credential'
      });
    }
  };

  const handleDelete = async () => {
    if (!credentialToDelete) return;

    try {
      await CredentialModel.delete(credentialToDelete.id);
      Swal.fire({
        icon: 'success',
        title: 'Deleted!',
        text: 'Credential deleted successfully',
        timer: 2000,
        showConfirmButton: false
      });
      setDeleteDialogOpen(false);
      setCredentialToDelete(null);
      loadCredentials();
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Delete Failed',
        text: error.message || 'Failed to delete credential'
      });
    }
  };

  const handleDeactivate = async (id: number) => {
    try {
      await CredentialModel.deactivate(id);
      Swal.fire({
        icon: 'success',
        title: 'Deactivated!',
        text: 'Credential deactivated successfully',
        timer: 2000,
        showConfirmButton: false
      });
      loadCredentials();
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Deactivation Failed',
        text: error.message || 'Failed to deactivate credential'
      });
    }
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      api_key: 'bg-blue-100 text-blue-800',
      password: 'bg-purple-100 text-purple-800',
      token: 'bg-green-100 text-green-800',
      oauth: 'bg-indigo-100 text-indigo-800',
      ssh_key: 'bg-yellow-100 text-yellow-800',
      certificate: 'bg-red-100 text-red-800',
      other: 'bg-gray-100 text-gray-800',
    };
    return colors[type] || colors.other;
  };

  const getEnvironmentBadge = (env: string) => {
    const colors: Record<string, string> = {
      development: 'bg-gray-100 text-gray-800',
      staging: 'bg-yellow-100 text-yellow-800',
      production: 'bg-red-100 text-red-800',
      all: 'bg-green-100 text-green-800',
    };
    return colors[env] || colors.development;
  };

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const isExpiringSoon = (expiresAt?: string) => {
    if (!expiresAt) return false;
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const expiryDate = new Date(expiresAt);
    return expiryDate > new Date() && expiryDate < thirtyDaysFromNow;
  };

  const columns: ColumnDef<Credential>[] = [
    {
      accessorKey: 'service_name',
      header: 'Service Name',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <KeyIcon className="h-4 w-4 text-gray-400" />
          <span className="font-medium">{row.original.service_name}</span>
        </div>
      ),
    },
    {
      accessorKey: 'credential_type',
      header: 'Type',
      cell: ({ row }) => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeBadge(row.original.credential_type)}`}>
          {row.original.credential_type}
        </span>
      ),
    },
    {
      accessorKey: 'identifier',
      header: 'Identifier',
      cell: ({ row }) => row.original.identifier || '-',
    },
    {
      accessorKey: 'environment',
      header: 'Environment',
      cell: ({ row }) => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getEnvironmentBadge(row.original.environment)}`}>
          {row.original.environment}
        </span>
      ),
    },
    {
      accessorKey: 'expires_at',
      header: 'Expires',
      cell: ({ row }) => {
        if (!row.original.expires_at) return '-';
        const expired = isExpired(row.original.expires_at);
        const expiringSoon = isExpiringSoon(row.original.expires_at);
        
        return (
          <div className="flex items-center gap-1">
            {expired && <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />}
            {!expired && expiringSoon && <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />}
            <span className={expired ? 'text-red-600' : expiringSoon ? 'text-yellow-600' : ''}>
              {formatDate(row.original.expires_at)}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
          row.original.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {row.original.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleViewDecrypted(row.original)}
            className="p-1 text-blue-600 hover:text-blue-800"
            title="View Decrypted"
          >
            <EyeIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => navigate(`/credentials/${row.original.id}/edit`)}
            className="p-1 text-green-600 hover:text-green-800"
            title="Edit"
          >
            <PencilIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setCredentialToDelete(row.original);
              setDeleteDialogOpen(true);
            }}
            className="p-1 text-red-600 hover:text-red-800"
            title="Delete"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Credentials Management</h1>
        <Button onClick={() => navigate('/credentials/new')}>
          <PlusIcon className="h-5 w-5 mr-2" />
          Add Credential
        </Button>
      </div>

      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
        <div className="flex">
          <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
          <div className="ml-3">
            <p className="text-sm text-yellow-700">
              <strong>Security Notice:</strong> This page is only accessible to administrators.
              Credentials are encrypted in the database. Always use caution when viewing or sharing decrypted values.
            </p>
          </div>
        </div>
      </div>

      <Card className="mb-6 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <Input
              placeholder="Search credentials..."
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              onKeyPress={(e: React.KeyboardEvent) => e.key === 'Enter' && handleSearch()}
              startIcon={<MagnifyingGlassIcon className="h-5 w-5" />}
            />
          </div>
          <Select
            value={filterType}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterType(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="api_key">API Key</option>
            <option value="password">Password</option>
            <option value="token">Token</option>
            <option value="oauth">OAuth</option>
            <option value="ssh_key">SSH Key</option>
            <option value="certificate">Certificate</option>
            <option value="other">Other</option>
          </Select>
          <Select
            value={filterEnvironment}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterEnvironment(e.target.value)}
          >
            <option value="">All Environments</option>
            <option value="development">Development</option>
            <option value="staging">Staging</option>
            <option value="production">Production</option>
            <option value="all">All</option>
          </Select>
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="secondary" onClick={handleSearch}>
            <MagnifyingGlassIcon className="h-4 w-4 mr-2" />
            Search
          </Button>
          <Button variant="secondary" onClick={loadCredentials}>
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </Card>

      <DataTable
        data={credentials}
        columns={columns}
        loading={loading}
        pageSize={25}
      />

      {/* View Decrypted Dialog */}
      {viewDialogOpen && selectedCredential && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setViewDialogOpen(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div>
                <div className="flex items-center mb-4">
                  <LockClosedIcon className="h-6 w-6 text-blue-600 mr-2" />
                  <h3 className="text-lg font-medium text-gray-900">Decrypted Credential: {selectedCredential.service_name}</h3>
                </div>
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4">
                  <p className="text-sm text-yellow-700"><strong>Warning:</strong> This is sensitive information. Do not share or expose these values.</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Service Name</label>
                    <p className="text-sm text-gray-900">{selectedCredential.service_name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeBadge(selectedCredential.credential_type)}`}>
                      {selectedCredential.credential_type}
                    </span>
                  </div>
                  {selectedCredential.identifier && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Identifier</label>
                      <p className="text-sm text-gray-900">{selectedCredential.identifier}</p>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Credential Value</label>
                    <div className="relative">
                      <input
                        type={showValue ? 'text' : 'password'}
                        value={selectedCredential.credential_value || ''}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm"
                      />
                      <button
                        onClick={() => setShowValue(!showValue)}
                        className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                      >
                        {showValue ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>
                  {selectedCredential.additional_data && Object.keys(selectedCredential.additional_data).length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Additional Data</label>
                      <textarea
                        value={JSON.stringify(selectedCredential.additional_data, null, 2)}
                        readOnly
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm font-mono"
                      />
                    </div>
                  )}
                  {selectedCredential.notes && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                      <p className="text-sm text-gray-900">{selectedCredential.notes}</p>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Used</label>
                    <p className="text-sm text-gray-900">
                      {selectedCredential.last_used_at ? formatDateTime(selectedCredential.last_used_at) : 'Never'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-6">
                <Button onClick={() => setViewDialogOpen(false)} variant="secondary" className="w-full">Close</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteDialogOpen && credentialToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setDeleteDialogOpen(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Confirm Delete</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Are you sure you want to permanently delete the credential for <strong>{credentialToDelete.service_name}</strong>?
                </p>
                <div className="bg-red-50 border-l-4 border-red-400 p-3">
                  <p className="text-sm text-red-700">This action cannot be undone. Consider deactivating instead of deleting to maintain audit history.</p>
                </div>
              </div>
              <div className="mt-5 sm:mt-6 flex gap-3">
                <Button onClick={() => setDeleteDialogOpen(false)} variant="secondary" className="flex-1">Cancel</Button>
                <Button onClick={() => credentialToDelete && handleDeactivate(credentialToDelete.id)} variant="outline" className="flex-1">
                  Deactivate Instead
                </Button>
                <Button onClick={handleDelete} variant="danger" className="flex-1">Delete</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
