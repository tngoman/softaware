import React, { useState, useEffect, useMemo } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, ShieldCheckIcon, UserGroupIcon, TagIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { ColumnDef } from '@tanstack/react-table';
import { SystemRoleModel, SystemPermissionModel, Role, Permission } from '../../models';
import { Input, Button, Card, DataTable, BackButton, Textarea } from '../../components/UI';
import { formatDate } from '../../utils/formatters';
import Can from '../../components/Can';
import Swal from 'sweetalert2';

const Roles: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [pagination, setPagination] = useState({ page: 0, limit: 10, total: 0 });
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
  });

  useEffect(() => {
    loadData();
  }, [pagination.page, pagination.limit, search]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rolesData, permissionsData] = await Promise.all([
        SystemRoleModel.getAll(),
        SystemPermissionModel.getAll(),
      ]);
      
      // Filter roles by search
      let filteredRoles = rolesData;
      if (search) {
        filteredRoles = rolesData.filter((role: Role) => 
          role.name.toLowerCase().includes(search.toLowerCase()) ||
          role.slug.toLowerCase().includes(search.toLowerCase()) ||
          (role.description && role.description.toLowerCase().includes(search.toLowerCase()))
        );
      }
      
      setRoles(filteredRoles);
      setPermissions(permissionsData);
      setPagination(prev => ({ ...prev, total: filteredRoles.length }));
    } catch (error: any) {
      console.error('Failed to load data:', error);
      Swal.fire({ 
        icon: 'error', 
        title: 'Error', 
        text: 'Failed to load data: ' + (error.response?.data?.message || error.message) 
      });
    } finally {
      setLoading(false);
    }
  };

  // Group permissions by permission_group
  const groupedPermissions = useMemo(() => {
    return permissions.reduce((acc, permission) => {
      const group = permission.permission_group || 'Other';
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(permission);
      return acc;
    }, {} as Record<string, Permission[]>);
  }, [permissions]);

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      description: '',
    });
    setEditingRole(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      if (editingRole) {
        await SystemRoleModel.update(editingRole.id, formData);
        Swal.fire({ 
          icon: 'success', 
          title: 'Success!', 
          text: 'Role updated successfully', 
          timer: 2000, 
          showConfirmButton: false 
        });
      } else {
        await SystemRoleModel.create(formData);
        Swal.fire({ 
          icon: 'success', 
          title: 'Success!', 
          text: 'Role created successfully', 
          timer: 2000, 
          showConfirmButton: false 
        });
      }

      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Failed to save role:', error);
      Swal.fire({ 
        icon: 'error', 
        title: 'Error', 
        text: 'Failed to save role: ' + (error.response?.data?.message || error.message) 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      slug: role.slug,
      description: role.description || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (role: Role) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `Do you want to delete role "${role.name}"?`,
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
      await SystemRoleModel.delete(role.id);
      Swal.fire({ 
        icon: 'success', 
        title: 'Deleted!', 
        text: 'Role deleted successfully', 
        timer: 2000, 
        showConfirmButton: false 
      });
      loadData();
    } catch (error: any) {
      console.error('Failed to delete role:', error);
      Swal.fire({ 
        icon: 'error', 
        title: 'Error', 
        text: 'Failed to delete role: ' + (error.response?.data?.message || error.message) 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManagePermissions = async (role: Role) => {
    try {
      const roleWithPermissions = await SystemRoleModel.getById(role.id);
      setSelectedRole(roleWithPermissions);
      setShowPermissionsModal(true);
    } catch (error: any) {
      console.error('Failed to load role permissions:', error);
      Swal.fire({ 
        icon: 'error', 
        title: 'Error', 
        text: 'Failed to load permissions: ' + (error.response?.data?.message || error.message) 
      });
    }
  };

  const handleTogglePermission = async (permissionId: number) => {
    if (!selectedRole) return;

    try {
      const hasPermission = selectedRole.permissions?.some(p => p.id === permissionId);
      
      if (hasPermission) {
        await SystemPermissionModel.removeFromRole(permissionId, selectedRole.id);
      } else {
        await SystemPermissionModel.assignToRole(permissionId, selectedRole.id);
      }

      // Reload role permissions
      const updatedRole = await SystemRoleModel.getById(selectedRole.id);
      setSelectedRole(updatedRole);
      
      // Also refresh the roles list
      loadData();
    } catch (error: any) {
      console.error('Failed to toggle permission:', error);
      Swal.fire({ 
        icon: 'error', 
        title: 'Error', 
        text: 'Failed to toggle permission: ' + (error.response?.data?.message || error.message) 
      });
    }
  };

  // Table columns configuration
  const columns = useMemo<ColumnDef<Role>[]>(() => [
    {
      accessorKey: 'name',
      header: 'Role',
      cell: ({ row }) => (
        <div className="flex items-center">
          <div className="flex-shrink-0 h-10 w-10">
            <div className="h-10 w-10 rounded-full bg-secondary-500/10 flex items-center justify-center">
              <UserGroupIcon className="h-5 w-5 text-secondary-500" />
            </div>
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium text-gray-900">
              {row.original.name}
            </div>
            <div className="text-sm text-gray-500">
              {row.original.slug}
            </div>
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
          <span className="text-sm text-gray-900">{description}</span>
        ) : (
          <span className="text-gray-400 italic text-sm">No description</span>
        );
      },
    },
    {
      accessorKey: 'permissions',
      header: 'Permissions',
      cell: ({ row }) => {
        const permissionCount = row.original.permission_count || 0;
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            <ShieldCheckIcon className="h-3.5 w-3.5 mr-1" />
            {permissionCount} permission{permissionCount !== 1 ? 's' : ''}
          </span>
        );
      },
    },
    {
      accessorKey: 'created_at',
      header: 'Created',
      cell: ({ getValue }) => {
        const date = getValue() as string;
        return (
          <span className="text-sm text-gray-500">
            {formatDate(date)}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Can permission="permissions.manage">
            <button
              onClick={() => handleManagePermissions(row.original)}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-secondary-600 bg-secondary-500/10 hover:bg-secondary-500/20 rounded-lg transition-colors"
              title="Manage Permissions"
            >
              <ShieldCheckIcon className="h-3.5 w-3.5 mr-1" />
              Permissions
            </button>
          </Can>
          <Can permission="roles.edit">
            <button
              onClick={() => handleEdit(row.original)}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-secondary-600 bg-secondary-500/10 hover:bg-secondary-500/20 rounded-lg transition-colors"
            >
              <PencilIcon className="h-3.5 w-3.5 mr-1" />
              Edit
            </button>
          </Can>
          <Can permission="roles.delete">
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
              {editingRole ? 'Edit Role' : 'Add New Role'}
            </h1>
            <p className="text-gray-600">
              {editingRole ? 'Update' : 'Create'} role information
            </p>
          </div>
          <BackButton onClick={resetForm} />
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Role Name"
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter role name"
                startIcon={<UserGroupIcon />}
              />

              <Input
                label="Slug"
                type="text"
                required
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="e.g., admin, manager, user"
                startIcon={<TagIcon />}
                helperText="Unique identifier for the role (lowercase, no spaces)"
              />
            </div>

            <Textarea
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe this role and its purpose..."
              rows={3}
              helperText="Optional description of the role's purpose and responsibilities"
            />

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
                {editingRole ? 'Update Role' : 'Create Role'}
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
            <h1 className="text-3xl font-bold mb-2">Role Management</h1>
            <p className="text-white/90">Manage roles and their permissions</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search roles..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 pl-10 pr-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm"
              />
              <svg className="absolute left-3 top-2.5 h-5 w-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <Can permission="roles.create">
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-semibold text-secondary-600 bg-white hover:bg-gray-50 shadow-md transition-all hover:shadow-lg"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Add New Role
              </button>
            </Can>
          </div>
        </div>
      </div>

      {/* Roles Table */}
      <DataTable
        data={roles}
        columns={columns}
        loading={loading}
        searchable={false}
        emptyMessage="No roles found. Click 'Add New Role' to get started."
        pageSize={pagination.limit}
        serverSide={false}
      />

      {/* Permissions Management Modal */}
      {showPermissionsModal && selectedRole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <div className="h-12 w-12 rounded-full bg-secondary-500/10 flex items-center justify-center mr-4">
                    <ShieldCheckIcon className="h-6 w-6 text-secondary-500" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Manage Permissions</h2>
                    <p className="text-sm text-gray-600">Role: {selectedRole.name}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col lg:flex-row lg:space-x-6 space-y-6 lg:space-y-0">
                <div className="flex-1 space-y-6">
                  {Object.entries(groupedPermissions).filter((_, index) => index % 2 === 0).map(([group, groupPermissions]) => (
                    <div key={group} className="border border-gray-200 rounded-lg">
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-900">{group || 'Other'}</h3>
                        <p className="text-xs text-gray-500">{groupPermissions.length} permissions</p>
                      </div>
                      <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
                        {groupPermissions.map((permission) => {
                          const isAssigned = selectedRole.permissions?.some(p => p.id === permission.id);
                          return (
                            <div
                              key={permission.id}
                              className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center">
                                  <ShieldCheckIcon className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                                  <div className="font-medium text-gray-900 truncate">{permission.name}</div>
                                </div>
                                <div className="text-xs text-gray-500 ml-6 truncate">{permission.slug}</div>
                                {permission.description && (
                                  <div className="text-xs text-gray-400 mt-1 ml-6 line-clamp-2">{permission.description}</div>
                                )}
                              </div>
                              <button
                                onClick={() => handleTogglePermission(permission.id)}
                                className={`ml-3 px-3 py-1.5 rounded-md text-xs font-medium transition-all flex-shrink-0 ${
                                  isAssigned
                                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                              >
                                {isAssigned ? 'Remove' : 'Add'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex-1 space-y-6">
                  {Object.entries(groupedPermissions).filter((_, index) => index % 2 === 1).map(([group, groupPermissions]) => (
                    <div key={group} className="border border-gray-200 rounded-lg">
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-900">{group || 'Other'}</h3>
                        <p className="text-xs text-gray-500">{groupPermissions.length} permissions</p>
                      </div>
                      <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
                        {groupPermissions.map((permission) => {
                          const isAssigned = selectedRole.permissions?.some(p => p.id === permission.id);
                          return (
                            <div
                              key={permission.id}
                              className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center">
                                  <ShieldCheckIcon className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                                  <div className="font-medium text-gray-900 truncate">{permission.name}</div>
                                </div>
                                <div className="text-xs text-gray-500 ml-6 truncate">{permission.slug}</div>
                                {permission.description && (
                                  <div className="text-xs text-gray-400 mt-1 ml-6 line-clamp-2">{permission.description}</div>
                                )}
                              </div>
                              <button
                                onClick={() => handleTogglePermission(permission.id)}
                                className={`ml-3 px-3 py-1.5 rounded-md text-xs font-medium transition-all flex-shrink-0 ${
                                  isAssigned
                                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                              >
                                {isAssigned ? 'Remove' : 'Add'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <Button
                  onClick={() => setShowPermissionsModal(false)}
                >
                  Done
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Roles;