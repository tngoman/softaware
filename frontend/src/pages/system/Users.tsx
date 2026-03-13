import React, { useState, useEffect, useMemo } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, UserIcon, EnvelopeIcon, ShieldCheckIcon, CheckCircleIcon, XCircleIcon, KeyIcon, NoSymbolIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline';
import { ColumnDef } from '@tanstack/react-table';
import { SystemUserModel, User, SystemRoleModel, Role, ContactModel } from '../../models';
import { Contact } from '../../types';
import { Input, Select, Button, Card, DataTable, BackButton } from '../../components/UI';
import Can from '../../components/Can';
import Swal from 'sweetalert2';

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [pagination, setPagination] = useState({ page: 0, limit: 10, total: 0 });
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    is_active: true,
    is_admin: false,
    is_staff: false,
    role_id: undefined as number | undefined,
    contact_id: undefined as number | undefined,
  });

  useEffect(() => {
    loadUsers();
    loadRoles();
    loadContacts();
  }, [pagination.page, pagination.limit, search]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await SystemUserModel.getAll({
        search: search || undefined,
      });
      setUsers(data);
      setPagination(prev => ({ ...prev, total: data.length }));
    } catch (error: any) {
      console.error('Failed to load users:', error);
      Swal.fire({ 
        icon: 'error', 
        title: 'Error', 
        text: 'Failed to load users: ' + (error.response?.data?.message || error.message) 
      });
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const data = await SystemRoleModel.getAll();
      setRoles(data);
    } catch (error: any) {
      console.error('Failed to load roles:', error);
    }
  };

  const loadContacts = async () => {
    try {
      const data = await ContactModel.getAll('customers');
      const list = Array.isArray(data) ? data : (data as any).data || [];
      setContacts(list);
    } catch (error: any) {
      console.error('Failed to load contacts:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      is_active: true,
      is_admin: false,
      is_staff: false,
      role_id: undefined,
      contact_id: undefined,
    });
    setEditingUser(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      if (editingUser) {
        // Update - only include password if it's not empty
        const updateData: any = {
          username: formData.username,
          email: formData.email,
          first_name: formData.first_name,
          last_name: formData.last_name,
          is_active: formData.is_active,
          is_admin: formData.is_admin,
          is_staff: formData.is_staff,
          contact_id: formData.contact_id || null,
        };
        
        if (formData.password) {
          updateData.password = formData.password;
        }

        await SystemUserModel.update(editingUser.id, updateData);

        // Handle role assignment changes
        const oldRoleId = editingUser.roles?.[0]?.id;
        const newRoleId = formData.role_id;
        
        if (oldRoleId !== newRoleId) {
          // Remove old role if exists
          if (oldRoleId) {
            await SystemRoleModel.removeFromUser(oldRoleId, editingUser.id);
          }
          
          // Assign new role if selected
          if (newRoleId) {
            await SystemRoleModel.assignToUser(newRoleId, editingUser.id);
          }
        }

        Swal.fire({ 
          icon: 'success', 
          title: 'Success!', 
          text: 'User updated successfully', 
          timer: 2000, 
          showConfirmButton: false 
        });
      } else {
        // Create - password is required
        if (!formData.password) {
          Swal.fire({ icon: 'error', title: 'Error', text: 'Password is required for new users' });
          return;
        }
        
        const result = await SystemUserModel.create({
          ...formData,
          contact_id: formData.contact_id || undefined,
        });
        
        // Assign role if selected
        if (formData.role_id && result.data?.id) {
          await SystemRoleModel.assignToUser(formData.role_id, result.data.id);
        }
        
        Swal.fire({ 
          icon: 'success', 
          title: 'Success!', 
          text: 'User created successfully', 
          timer: 2000, 
          showConfirmButton: false 
        });
      }

      resetForm();
      loadUsers();
    } catch (error: any) {
      console.error('Failed to save user:', error);
      Swal.fire({ 
        icon: 'error', 
        title: 'Error', 
        text: 'Failed to save user: ' + (error.response?.data?.message || error.message) 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      password: '', // Don't populate password
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      is_active: user.is_active,
      is_admin: user.is_admin,
      is_staff: user.is_staff || false,
      role_id: user.roles?.[0]?.id,
      contact_id: (user as any).contact_id || undefined,
    });
    setShowForm(true);
  };

  const handleDelete = async (user: User) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `Do you want to delete user "${user.username}"?`,
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
      await SystemUserModel.delete(user.id);
      Swal.fire({ 
        icon: 'success', 
        title: 'Deleted!', 
        text: 'User deleted successfully', 
        timer: 2000, 
        showConfirmButton: false 
      });
      loadUsers();
    } catch (error: any) {
      console.error('Failed to delete user:', error);
      Swal.fire({ 
        icon: 'error', 
        title: 'Error', 
        text: 'Failed to delete user: ' + (error.response?.data?.message || error.message) 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (user: User) => {
    const newStatus = !user.is_active;
    const action = newStatus ? 'activate' : 'deactivate';

    const result = await Swal.fire({
      title: `${newStatus ? 'Activate' : 'Deactivate'} User?`,
      text: `Are you sure you want to ${action} "${user.username}"?${!newStatus ? ' They will no longer be able to log in.' : ''}`,
      icon: newStatus ? 'question' : 'warning',
      showCancelButton: true,
      confirmButtonColor: newStatus ? '#10B981' : '#F59E0B',
      cancelButtonColor: '#6B7280',
      confirmButtonText: `Yes, ${action}!`,
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) return;

    try {
      setLoading(true);
      await SystemUserModel.update(user.id, { is_active: newStatus } as any);
      Swal.fire({
        icon: 'success',
        title: newStatus ? 'Activated!' : 'Deactivated!',
        text: `User ${action}d successfully`,
        timer: 2000,
        showConfirmButton: false
      });
      loadUsers();
    } catch (error: any) {
      console.error(`Failed to ${action} user:`, error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: `Failed to ${action} user: ` + (error.response?.data?.message || error.message)
      });
    } finally {
      setLoading(false);
    }
  };

  // Table columns configuration
  const columns = useMemo<ColumnDef<User>[]>(() => [
    {
      accessorKey: 'username',
      header: 'User',
      cell: ({ row }) => (
        <div className="flex items-center">
          <div className="flex-shrink-0 h-10 w-10">
            <div className="h-10 w-10 rounded-full bg-secondary-500/10 flex items-center justify-center">
              <UserIcon className="h-5 w-5 text-secondary-500" />
            </div>
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium text-gray-900">
              {row.original.username}
            </div>
            {(row.original.first_name || row.original.last_name) && (
              <div className="text-sm text-gray-500">
                {`${row.original.first_name || ''} ${row.original.last_name || ''}`.trim()}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ getValue }) => {
        const email = getValue() as string;
        return email ? (
          <a href={`mailto:${email}`} className="text-secondary-500 hover:text-secondary-600">
            {email}
          </a>
        ) : (
          <span className="text-gray-400">-</span>
        );
      },
    },
    {
      accessorKey: 'roles',
      header: 'Role',
      cell: ({ row }) => {
        const role = row.original.roles?.[0];
        return role ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            <ShieldCheckIcon className="h-3.5 w-3.5 mr-1" />
            {role.name}
          </span>
        ) : (
          <span className="text-gray-400 italic text-sm">No role</span>
        );
      },
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ getValue }) => {
        const isActive = getValue() as boolean;
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {isActive ? (
              <>
                <CheckCircleIcon className="h-3.5 w-3.5 mr-1" />
                Active
              </>
            ) : (
              <>
                <XCircleIcon className="h-3.5 w-3.5 mr-1" />
                Inactive
              </>
            )}
          </span>
        );
      },
    },
    {
      id: 'user_type',
      header: 'Type',
      cell: ({ row }) => {
        const isAdmin = row.original.is_admin;
        const isStaff = (row.original as any).is_staff;
        if (isAdmin) {
          return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary-500/10 text-secondary-700">
              Admin
            </span>
          );
        }
        if (isStaff) {
          return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
              Staff
            </span>
          );
        }
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            User
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Can permission="users.edit">
            <button
              onClick={() => handleEdit(row.original)}
              className="p-1.5 text-secondary-600 hover:bg-secondary-500/10 rounded-lg transition-colors"
              title="Edit user"
            >
              <PencilIcon className="h-4 w-4" />
            </button>
          </Can>
          <Can permission="users.edit">
            <button
              onClick={() => handleToggleActive(row.original)}
              className={`p-1.5 rounded-lg transition-colors ${
                row.original.is_active
                  ? 'text-amber-600 hover:bg-amber-50'
                  : 'text-green-600 hover:bg-green-50'
              }`}
              title={row.original.is_active ? 'Deactivate user' : 'Activate user'}
            >
              {row.original.is_active ? (
                <NoSymbolIcon className="h-4 w-4" />
              ) : (
                <CheckCircleIcon className="h-4 w-4" />
              )}
            </button>
          </Can>
          <Can permission="users.delete">
            <button
              onClick={() => handleDelete(row.original)}
              className="p-1.5 text-scarlet hover:bg-scarlet/10 rounded-lg transition-colors"
              title="Delete user"
            >
              <TrashIcon className="h-4 w-4" />
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
              {editingUser ? 'Edit User' : 'Add New User'}
            </h1>
            <p className="text-gray-600">
              {editingUser ? 'Update' : 'Create'} user account information
            </p>
          </div>
          <BackButton onClick={resetForm} />
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Username"
                type="text"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="Enter username"
                startIcon={<UserIcon />}
              />

              <Input
                label="Email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Enter email address"
                startIcon={<EnvelopeIcon />}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="First Name"
                type="text"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                placeholder="Enter first name"
                startIcon={<UserIcon />}
              />

              <Input
                label="Last Name"
                type="text"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                placeholder="Enter last name"
                startIcon={<UserIcon />}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Password"
                type="password"
                required={!editingUser}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={editingUser ? 'Leave blank to keep current' : 'Enter password'}
                startIcon={<KeyIcon />}
                helperText={editingUser ? 'Leave blank to keep the current password' : 'Minimum 8 characters'}
              />

              <div>
                <Select
                  label="Role"
                  value={formData.role_id?.toString() || ''}
                  onChange={(e) => setFormData({ ...formData, role_id: e.target.value ? parseInt(e.target.value) : undefined })}
                >
                  <option value="">No Role</option>
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </Select>
                <p className="text-xs text-gray-500 mt-1">Assign a role to grant permissions</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Select
                  label="Linked Client"
                  value={formData.contact_id?.toString() || ''}
                  onChange={(e) => setFormData({ ...formData, contact_id: e.target.value ? parseInt(e.target.value) : undefined })}
                >
                  <option value="">Select a client...</option>
                  {contacts.map(c => (
                    <option key={c.contact_id} value={c.contact_id}>{c.contact_name}{c.contact_person ? ` — ${c.contact_person}` : ''}</option>
                  ))}
                </Select>
                <p className="text-xs text-gray-500 mt-1">Link this user to a client record. Required for portal users.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4 text-secondary-600 focus:ring-secondary-500 border-gray-300 rounded"
                />
                <label htmlFor="is_active" className="ml-3 block text-sm font-medium text-gray-700">
                  Active Account
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">User Type</label>
                <div className="flex items-center gap-6">
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="user_type"
                      checked={!formData.is_admin && !formData.is_staff}
                      onChange={() => setFormData({ ...formData, is_admin: false, is_staff: false })}
                      className="h-4 w-4 text-secondary-600 focus:ring-secondary-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">User</span>
                  </label>
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="user_type"
                      checked={formData.is_staff && !formData.is_admin}
                      onChange={() => setFormData({ ...formData, is_admin: false, is_staff: true })}
                      className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">Staff</span>
                  </label>
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="user_type"
                      checked={formData.is_admin}
                      onChange={() => setFormData({ ...formData, is_admin: true, is_staff: false })}
                      className="h-4 w-4 text-secondary-600 focus:ring-secondary-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">Administrator</span>
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-1">Admins &amp; Staff see the admin dashboard. Users see the client portal.</p>
              </div>
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
                {editingUser ? 'Update User' : 'Create User'}
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
            <h1 className="text-3xl font-bold mb-2">User Management</h1>
            <p className="text-white/90">Manage system users and their access</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 pl-10 pr-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm"
              />
              <svg className="absolute left-3 top-2.5 h-5 w-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <Can permission="users.create">
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-semibold text-secondary-600 bg-white hover:bg-gray-50 shadow-md transition-all hover:shadow-lg"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Add New User
              </button>
            </Can>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <DataTable
        data={users}
        columns={columns}
        loading={loading}
        searchable={false}
        emptyMessage="No users found. Click 'Add New User' to get started."
        pageSize={pagination.limit}
        serverSide={false}
      />
    </div>
  );
};

export default Users;
