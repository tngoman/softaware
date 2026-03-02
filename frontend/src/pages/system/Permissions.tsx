import React, { useState, useEffect, useMemo } from 'react';
import { MagnifyingGlassIcon, FunnelIcon, ShieldCheckIcon, TagIcon, DocumentTextIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import { ColumnDef } from '@tanstack/react-table';
import { SystemPermissionModel, Permission } from '../../models';
import { DataTable } from '../../components/UI';
import Swal from 'sweetalert2';

const Permissions: React.FC = () => {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [pagination, setPagination] = useState({ page: 0, limit: 10, total: 0 });

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      const data = await SystemPermissionModel.getAll();
      setPermissions(data);
      setPagination(prev => ({ ...prev, total: data.length }));
    } catch (error: any) {
      console.error('Failed to load permissions:', error);
      Swal.fire({ 
        icon: 'error', 
        title: 'Error', 
        text: 'Failed to load permissions: ' + (error.response?.data?.message || error.message) 
      });
    } finally {
      setLoading(false);
    }
  };

  // Get all unique groups
  const allGroups = useMemo(() => 
    Array.from(new Set(permissions.map(p => p.permission_group || 'Other'))).sort(),
    [permissions]
  );

  // Filter permissions based on search and group
  const filteredPermissions = useMemo(() => {
    return permissions.filter(permission => {
      const matchesSearch = search === '' || 
        permission.name.toLowerCase().includes(search.toLowerCase()) ||
        permission.slug.toLowerCase().includes(search.toLowerCase()) ||
        (permission.description && permission.description.toLowerCase().includes(search.toLowerCase()));
      
      const matchesGroup = selectedGroup === 'all' || (permission.permission_group || 'Other') === selectedGroup;
      
      return matchesSearch && matchesGroup;
    });
  }, [permissions, search, selectedGroup]);

  // Table columns configuration
  const columns = useMemo<ColumnDef<Permission>[]>(() => [
    {
      accessorKey: 'permission_group',
      header: 'Group',
      cell: ({ getValue }) => {
        const group = (getValue() as string) || 'Other';
        const groupColors: Record<string, string> = {
          'Users': 'bg-blue-100 text-blue-700',
          'Roles': 'bg-secondary-500/10 text-secondary-700',
          'Permissions': 'bg-indigo-100 text-indigo-700',
          'Settings': 'bg-green-100 text-green-700',
          'Credentials': 'bg-yellow-100 text-yellow-700',
          'Contacts': 'bg-pink-100 text-pink-700',
          'Invoices': 'bg-orange-100 text-orange-800',
          'Quotations': 'bg-cyan-100 text-cyan-800',
          'Categories': 'bg-teal-100 text-teal-800',
          'Pricing': 'bg-lime-100 text-lime-800',
          'Transactions': 'bg-emerald-100 text-emerald-800',
          'Reports': 'bg-violet-100 text-violet-800',
        };
        const colorClass = groupColors[group] || 'bg-gray-100 text-gray-800';
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
            <LockClosedIcon className="h-3.5 w-3.5 mr-1" />
            {group}
          </span>
        );
      },
    },
    {
      accessorKey: 'name',
      header: 'Permission',
      cell: ({ row }) => (
        <div className="flex items-center">
          <div className="flex-shrink-0 h-10 w-10">
            <div className="h-10 w-10 rounded-full bg-secondary-500/10 flex items-center justify-center">
              <ShieldCheckIcon className="h-5 w-5 text-secondary-500" />
            </div>
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium text-gray-900">
              {row.original.name}
            </div>
            <code className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
              {row.original.slug}
            </code>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ getValue }) => {
        const description = getValue() as string;
        return description ? (
          <span className="text-sm text-gray-600">{description}</span>
        ) : (
          <span className="text-gray-400 italic text-sm">No description</span>
        );
      },
    },
  ], []);

  return (
    <div className="space-y-6">
      {/* Header with gradient background */}
      <div className="bg-gradient-to-r from-secondary-500 to-secondary-600 rounded-xl shadow-lg p-6 text-white">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Permission Management</h1>
          <p className="text-white/90">
            View and manage system permissions. Permissions are defined in code.
          </p>
          <div className="mt-3 bg-white/10 backdrop-blur-sm rounded-lg p-3 text-sm">
            <p className="text-white/95">
              📝 To add or modify permissions, edit: 
              <code className="bg-white/20 px-2 py-1 rounded ml-2">api/src/System/permissions.php</code> or 
              <code className="bg-white/20 px-2 py-1 rounded ml-2">api/src/App/permissions.php</code>
            </p>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search permissions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm"
            />
            <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-white/60" />
          </div>

          {/* Group Filter */}
          <div className="relative">
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm cursor-pointer"
            >
              <option value="all" className="bg-gray-800 text-white">All Groups ({permissions.length})</option>
              {allGroups.map(group => {
                const count = permissions.filter(p => (p.permission_group || 'Other') === group).length;
                return (
                  <option key={group} value={group} className="bg-gray-800 text-white">
                    {group} ({count})
                  </option>
                );
              })}
            </select>
            <FunnelIcon className="absolute left-3 top-2.5 h-5 w-5 text-white/60" />
          </div>
        </div>

        {/* Results count */}
        {(search || selectedGroup !== 'all') && (
          <div className="mt-4 text-sm text-white/80 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2 inline-block">
            Showing {filteredPermissions.length} of {permissions.length} permissions
          </div>
        )}
      </div>

      {/* Permissions Table */}
      <DataTable
        data={filteredPermissions}
        columns={columns}
        loading={loading}
        searchable={false}
        emptyMessage={
          search || selectedGroup !== 'all' 
            ? 'No permissions match your filters' 
            : 'No permissions found'
        }
        pageSize={pagination.limit}
        serverSide={false}
      />
    </div>
  );
};

export default Permissions;
