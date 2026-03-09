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

// ============================================================================
// Mobile AI Assistant Types & Model
// ============================================================================

export interface MobileConversation {
  id: string;
  assistant_id: string | null;
  role: 'client' | 'staff';
  preview: string | null;
  created_at: string;
  updated_at: string;
}

export interface MobileMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_name: string | null;
  created_at: string;
}

export interface MobileIntentRequest {
  text: string;
  conversationId?: string;
  assistantId?: string;
  language?: string;
}

export interface MobileIntentResponse {
  success: boolean;
  reply: string;
  conversationId: string;
  toolsUsed: string[];
  data?: Record<string, unknown>;
}

/** An assistant available for mobile selection */
export interface MobileAssistantOption {
  id: string;
  name: string;
  description: string | null;
  personality: string | null;
  personality_flare: string | null;
  custom_greeting: string | null;
  voice_style: string | null;
  is_staff_agent: number;
  is_primary: number;
  status: string;
  tier: string;
}

export class MobileModel {
  /**
   * Send an intent (transcribed voice or text) to the mobile AI assistant.
   */
  static async sendIntent(payload: MobileIntentRequest): Promise<MobileIntentResponse> {
    const response = await api.post<MobileIntentResponse>('/v1/mobile/intent', payload);
    return response.data;
  }

  /**
   * List assistants available for mobile selection.
   * Users must create an assistant in the web app first.
   */
  static async getAssistants(): Promise<MobileAssistantOption[]> {
    const response = await api.get<{ success: boolean; assistants: MobileAssistantOption[] }>(
      '/v1/mobile/assistants',
    );
    return response.data.assistants;
  }

  /**
   * List conversations for the current user.
   */
  static async getConversations(): Promise<MobileConversation[]> {
    const response = await api.get<{ success: boolean; conversations: MobileConversation[] }>(
      '/v1/mobile/conversations',
    );
    return response.data.conversations;
  }

  /**
   * Get all messages for a conversation.
   */
  static async getMessages(conversationId: string): Promise<MobileMessage[]> {
    const response = await api.get<{ success: boolean; messages: MobileMessage[] }>(
      `/v1/mobile/conversations/${conversationId}/messages`,
    );
    return response.data.messages;
  }

  /**
   * Delete a conversation and all its messages.
   */
  static async deleteConversation(conversationId: string): Promise<void> {
    await api.delete(`/v1/mobile/conversations/${conversationId}`);
  }
}

// ============================================================================
// Staff Assistant Types & Model (Profile Tab)
// ============================================================================

export interface StaffAssistant {
  id: string;
  name: string;
  description: string | null;
  personality: string | null;
  personality_flare: string | null;
  primary_goal: string | null;
  custom_greeting: string | null;
  voice_style: string | null;
  preferred_model: string | null;
  business_type: string | null;
  website: string | null;
  status: string;
  tier: string;
  is_staff_agent: number;
  is_primary: number;
  pages_indexed: number;
  knowledge_categories: any;
  created_at: string;
  updated_at: string;
}

export interface StaffAssistantCreate {
  name: string;
  description?: string;
  personality?: string;
  personality_flare?: string;
  primary_goal?: string;
  custom_greeting?: string;
  voice_style?: string;
  preferred_model?: string;
  business_type?: string;
  website?: string;
}

export interface StaffAssistantUpdate extends Partial<StaffAssistantCreate> {}

export interface StaffSoftwareToken {
  id: string;
  software_id: number;
  software_name: string | null;
  api_url: string;
  created_at: string;
  updated_at: string;
}

export class StaffAssistantModel {
  private static BASE = '/v1/mobile/staff-assistant';

  /**
   * Get the staff member's personal assistant (or null).
   */
  static async get(): Promise<StaffAssistant | null> {
    const response = await api.get<{ success: boolean; assistant: StaffAssistant | null }>(this.BASE);
    return response.data.assistant;
  }

  /**
   * Create a new staff assistant (max 1 per staff member).
   */
  static async create(data: StaffAssistantCreate): Promise<StaffAssistant> {
    const response = await api.post<{ success: boolean; assistant: StaffAssistant }>(this.BASE, data);
    return response.data.assistant;
  }

  /**
   * Update the staff assistant's editable fields.
   * Note: core_instructions are NOT editable via this endpoint.
   */
  static async update(data: StaffAssistantUpdate): Promise<StaffAssistant> {
    const response = await api.put<{ success: boolean; assistant: StaffAssistant }>(this.BASE, data);
    return response.data.assistant;
  }

  /**
   * Delete the staff assistant.
   */
  static async delete(): Promise<void> {
    await api.delete(this.BASE);
  }

  // --- Software Token Management ---

  /**
   * List stored external software tokens.
   */
  static async getTokens(): Promise<StaffSoftwareToken[]> {
    const response = await api.get<{ success: boolean; tokens: StaffSoftwareToken[] }>(
      `${this.BASE}/software-tokens`,
    );
    return response.data.tokens;
  }

  /**
   * Store or update a software token for task proxy operations.
   */
  static async saveToken(data: {
    software_id: number;
    software_name?: string;
    api_url: string;
    token: string;
  }): Promise<{ id: string }> {
    const response = await api.post<{ success: boolean; id: string; message: string }>(
      `${this.BASE}/software-tokens`,
      data,
    );
    return { id: response.data.id };
  }

  /**
   * Delete a software token.
   */
  static async deleteToken(id: string): Promise<void> {
    await api.delete(`${this.BASE}/software-tokens/${id}`);
  }
}

// ============================================================================
// My Assistant — Unified Model (Staff + Clients)
// ============================================================================

/** Create / update payload for the unified my-assistant endpoint */
export interface MyAssistantCreate {
  name: string;
  description?: string;
  personality?: string;
  personality_flare?: string;
  primary_goal?: string;
  custom_greeting?: string;
  voice_style?: string;
  preferred_model?: string;
  business_type?: string;
  website?: string;
}

export interface MyAssistantUpdate extends Partial<MyAssistantCreate> {}

/**
 * Unified assistant management for both staff and client users.
 * Staff: max 1 assistant, auto-primary.
 * Clients: unlimited assistants, one marked as primary.
 */
export class MyAssistantModel {
  private static BASE = '/v1/mobile/my-assistant';

  /**
   * List all of the user's assistants.
   */
  static async list(): Promise<StaffAssistant[]> {
    const response = await api.get<{ success: boolean; assistants: StaffAssistant[] }>(this.BASE);
    return response.data.assistants;
  }

  /**
   * Get a single assistant by ID.
   */
  static async get(id: string): Promise<StaffAssistant> {
    const response = await api.get<{ success: boolean; assistant: StaffAssistant }>(`${this.BASE}/${id}`);
    return response.data.assistant;
  }

  /**
   * Create a new assistant.
   * Staff: max 1, auto-primary. Clients: first one auto-primary.
   */
  static async create(data: MyAssistantCreate): Promise<StaffAssistant> {
    const response = await api.post<{ success: boolean; assistant: StaffAssistant }>(this.BASE, data);
    return response.data.assistant;
  }

  /**
   * Update an assistant's editable fields.
   * Note: core_instructions are NOT editable via this endpoint.
   */
  static async update(id: string, data: MyAssistantUpdate): Promise<StaffAssistant> {
    const response = await api.put<{ success: boolean; assistant: StaffAssistant }>(
      `${this.BASE}/${id}`,
      data,
    );
    return response.data.assistant;
  }

  /**
   * Set an assistant as the user's primary (main) assistant.
   * Unsets any previous primary.
   */
  static async setPrimary(id: string): Promise<void> {
    await api.put(`${this.BASE}/${id}/set-primary`);
  }

  /**
   * Delete an assistant. If it was primary, the next one is auto-promoted.
   */
  static async delete(id: string): Promise<void> {
    await api.delete(`${this.BASE}/${id}`);
  }

  // --- Software Token Management (staff-only) ---

  static async getTokens(): Promise<StaffSoftwareToken[]> {
    const response = await api.get<{ success: boolean; tokens: StaffSoftwareToken[] }>(
      `${this.BASE}/software-tokens`,
    );
    return response.data.tokens;
  }

  static async saveToken(data: {
    software_id: number;
    software_name?: string;
    api_url: string;
    token: string;
  }): Promise<{ id: string }> {
    const response = await api.post<{ success: boolean; id: string; message: string }>(
      `${this.BASE}/software-tokens`,
      data,
    );
    return { id: response.data.id };
  }

  static async deleteToken(id: string): Promise<void> {
    await api.delete(`${this.BASE}/software-tokens/${id}`);
  }
}
