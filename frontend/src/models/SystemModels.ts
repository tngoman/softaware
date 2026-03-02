import api from '../services/api';

/**
 * System Models
 * Handles all system-level operations (users, roles, permissions, system settings)
 * These are separate from app-level entities
 */

// Type definitions
export interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  is_active: boolean;
  is_admin: boolean;
  is_staff?: boolean;
  roles?: Role[];
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: number;
  name: string;
  slug: string;
  description?: string;
  created_at: string;
  updated_at: string;
  permissions?: Permission[];
  permission_count?: number;
}

export interface Permission {
  id: number;
  name: string;
  slug: string;
  description?: string;
  permission_group?: string;
  created_at: string;
  updated_at: string;
}

export interface SystemSetting {
  id: number;
  key: string;
  value: string;
  type: 'string' | 'integer' | 'float' | 'boolean' | 'json';
  description?: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * User Model
 * Handles user management operations
 */
export class UserModel {
  /**
   * Get all users with optional filters
   */
  static async getAll(filters?: { is_active?: boolean; is_admin?: boolean; search?: string }) {
    const response = await api.get<{ success: boolean; data: User[] }>('/users', { params: filters });
    return response.data.data;
  }

  /**
   * Get single user by ID
   */
  static async getById(id: number) {
    const response = await api.get<{ success: boolean; data: User }>(`/users/${id}`);
    return response.data.data;
  }

  /**
   * Create a new user
   */
  static async create(user: Partial<User> & { password: string }) {
    const response = await api.post<{ success: boolean; data: User }>('/users', user);
    return response.data;
  }

  /**
   * Update an existing user
   */
  static async update(id: number, user: Partial<User> & { password?: string }) {
    const response = await api.put<{ success: boolean; data: User }>(`/users/${id}`, user);
    return response.data;
  }

  /**
   * Delete a user
   */
  static async delete(id: number) {
    const response = await api.delete<{ success: boolean }>(`/users/${id}`);
    return response.data;
  }
}

/**
 * Role Model
 * Handles role management and role-user/role-permission relationships
 */
export class RoleModel {
  /**
   * Get all roles
   */
  static async getAll() {
    const response = await api.get<{ success: boolean; data: Role[] }>('/roles');
    return response.data.data;
  }

  /**
   * Get single role by ID (includes permissions)
   */
  static async getById(id: number) {
    const response = await api.get<{ success: boolean; data: Role }>(`/roles/${id}`);
    return response.data.data;
  }

  /**
   * Create a new role
   */
  static async create(role: Partial<Role>) {
    const response = await api.post<{ success: boolean; data: Role }>('/roles', role);
    return response.data;
  }

  /**
   * Update an existing role
   */
  static async update(id: number, role: Partial<Role>) {
    const response = await api.put<{ success: boolean; data: Role }>(`/roles/${id}`, role);
    return response.data;
  }

  /**
   * Delete a role
   */
  static async delete(id: number) {
    const response = await api.delete<{ success: boolean }>(`/roles/${id}`);
    return response.data;
  }

  /**
   * Assign role to user
   */
  static async assignToUser(roleId: number, userId: number) {
    const response = await api.post<{ success: boolean }>(`/roles/${roleId}/assign`, { user_id: userId });
    return response.data;
  }

  /**
   * Remove role from user
   */
  static async removeFromUser(roleId: number, userId: number) {
    const response = await api.post<{ success: boolean }>(`/roles/${roleId}/remove`, { user_id: userId });
    return response.data;
  }
}

/**
 * Permission Model
 * Handles permission management and permission-role relationships
 */
export class PermissionModel {
  /**
   * Get all permissions
   */
  static async getAll() {
    const response = await api.get<{ success: boolean; data: Permission[] }>('/permissions');
    return response.data.data;
  }

  /**
   * Get single permission by ID
   */
  static async getById(id: number) {
    const response = await api.get<{ success: boolean; data: Permission }>(`/permissions/${id}`);
    return response.data.data;
  }

  /**
   * Create a new permission
   */
  static async create(permission: Partial<Permission>) {
    const response = await api.post<{ success: boolean; data: Permission }>('/permissions', permission);
    return response.data;
  }

  /**
   * Update an existing permission
   */
  static async update(id: number, permission: Partial<Permission>) {
    const response = await api.put<{ success: boolean; data: Permission }>(`/permissions/${id}`, permission);
    return response.data;
  }

  /**
   * Delete a permission
   */
  static async delete(id: number) {
    const response = await api.delete<{ success: boolean }>(`/permissions/${id}`);
    return response.data;
  }

  /**
   * Assign permission to role
   */
  static async assignToRole(permissionId: number, roleId: number) {
    const response = await api.post<{ success: boolean }>(`/permissions/${permissionId}/assign`, { role_id: roleId });
    return response.data;
  }

  /**
   * Remove permission from role
   */
  static async removeFromRole(permissionId: number, roleId: number) {
    const response = await api.post<{ success: boolean }>(`/permissions/${permissionId}/remove`, { role_id: roleId });
    return response.data;
  }

  /**
   * Get current user's permissions
   */
  static async getUserPermissions() {
    const response = await api.get<{ success: boolean; data: Permission[] }>('/permissions/user');
    return response.data.data;
  }
}

/**
 * System Settings Model
 * Handles system-level settings (sys_settings table)
 * Separate from app settings
 */
export class SystemSettingModel {
  /**
   * Get all system settings
   */
  static async getAll(publicOnly = false) {
    const response = await api.get<{ success: boolean; data: SystemSetting[] }>('/settings', {
      params: { public_only: publicOnly ? '1' : '0' }
    });
    return response.data.data;
  }

  /**
   * Get single setting by ID
   */
  static async getById(id: number) {
    const response = await api.get<{ success: boolean; data: SystemSetting }>(`/settings/${id}`);
    return response.data.data;
  }

  /**
   * Get setting by key
   */
  static async getByKey(key: string) {
    const response = await api.get<{ success: boolean; data: SystemSetting }>(`/settings/key/${key}`);
    return response.data.data;
  }

  /**
   * Create a new system setting
   */
  static async create(setting: Partial<SystemSetting>) {
    const response = await api.post<{ success: boolean; data: SystemSetting }>('/settings', setting);
    return response.data;
  }

  /**
   * Update an existing system setting
   */
  static async update(id: number, setting: Partial<SystemSetting>) {
    const response = await api.put<{ success: boolean; data: SystemSetting }>(`/settings/${id}`, setting);
    return response.data;
  }

  /**
   * Delete a system setting
   */
  static async delete(id: number) {
    const response = await api.delete<{ success: boolean }>(`/settings/${id}`);
    return response.data;
  }

  /**
   * Get public settings as key-value pairs
   */
  static async getPublicSettings() {
    const response = await api.get<{ success: boolean; data: Record<string, any> }>('/settings/public');
    return response.data.data;
  }
}
