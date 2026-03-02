/**
 * TypeScript interfaces for the Updates system tables (upd_* prefix).
 * These tables power software update distribution, client heartbeats,
 * module tracking, and remote control functionality.
 */

// ─── update_software ──────────────────────────────────────────────────
export interface UpdSoftware {
  id: number;
  name: string;
  description?: string;
  software_key: string;
  created_by?: string;          // FK → User.id (UUID)
  created_at: Date;
  updated_at: Date;
  has_external_integration: number;
  external_username?: string;
  external_password?: string;
  external_live_url?: string;
  external_test_url?: string;
  external_mode?: string;
  external_integration_notes?: string;
}

// ─── update_releases ───────────────────────────────────────────────────
export interface UpdUpdate {
  id: number;
  software_id: number;
  version: string;
  description?: string;
  file_path?: string;
  file_size?: number;
  file_name?: string;
  uploaded_by?: string;          // FK → User.id (UUID)
  has_migrations: number;
  migration_notes?: string;
  schema_file?: string;
  released_at?: Date;
  created_at: Date;
}

// ─── update_clients ───────────────────────────────────────────────────
export interface UpdClient {
  id: number;
  software_id: number;
  client_identifier: string;
  ip_address?: string;
  hostname?: string;
  machine_name?: string;
  os_info?: string;
  app_version?: string;
  last_update_id?: number;
  last_update_installed_at?: Date;
  last_heartbeat: Date;
  first_seen: Date;
  user_agent?: string;
  metadata?: any;
  is_blocked: number;
  blocked_at?: Date;
  blocked_reason?: string;
  user_name?: string;
  user_id?: number;
  active_page?: string;
  ai_sessions_active: number;
  ai_model?: string;
  force_logout: number;
  server_message?: string;
  server_message_id?: string;
}

// ─── update_modules ───────────────────────────────────────────────────
export interface UpdModule {
  id: number;
  software_id: number;
  name: string;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

// ─── update_user_modules ──────────────────────────────────────────────
export interface UpdUserModule {
  id: number;
  user_id: string;               // FK → User.id (UUID)
  module_id: number;
  created_at: Date;
}

// ─── update_installed ─────────────────────────────────────────
export interface UpdInstalledUpdate {
  id: number;
  update_id: number;
  status: string;
  installed_at: Date;
}

// ─── update_password_resets ─────────────────────────────────────
export interface UpdPasswordResetToken {
  id: number;
  user_id: string;               // FK → User.id (UUID)
  token: string;
  expires_at: Date;
  used: number;
  created_at: Date;
}

// ─── Computed types for responses ──────────────────────────────────

export type ClientStatus = 'online' | 'recent' | 'inactive' | 'offline';

export function computeClientStatus(secondsSinceHeartbeat: number): ClientStatus {
  if (secondsSinceHeartbeat < 300)     return 'online';   // < 5 min
  if (secondsSinceHeartbeat < 86400)   return 'recent';   // < 24 hr
  if (secondsSinceHeartbeat < 604800)  return 'inactive'; // < 7 days
  return 'offline';
}

export type UpdUserRole = 'admin' | 'client_manager' | 'qa_specialist' | 'developer' | 'deployer' | 'viewer';
