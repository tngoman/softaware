/**
 * Types for the Updates System — Clients, Heartbeats, Error Reports
 */

/* ── Client Status ────────────────────────────────────────── */
export type ClientStatus = 'online' | 'recent' | 'inactive' | 'offline';

/* ── Update Client (from GET /updates/clients) ────────────── */
export interface UpdateClient {
  id: number;
  software_id: number;
  client_identifier: string;
  ip_address: string | null;
  hostname: string | null;
  machine_name: string | null;
  os_info: string | null;
  app_version: string | null;
  last_update_id: number | null;
  last_update_installed_at: string | null;
  last_heartbeat: string | null;
  first_seen: string | null;
  user_agent: string | null;
  metadata: Record<string, any> | null;
  is_blocked: number;
  blocked_at: string | null;
  blocked_reason: string | null;
  user_name: string | null;
  user_id: string | null;
  active_page: string | null;
  ai_sessions_active: number | null;
  ai_model: string | null;
  force_logout: number;
  server_message: string | null;
  server_message_id: string | null;
  cpu_usage: number | null;
  memory_usage: number | null;

  // Computed fields from backend JOIN
  software_name: string | null;
  last_update_version: string | null;
  seconds_since_heartbeat: number | null;
  status: ClientStatus;
}

/* ── Error Report (from error_reports table) ──────────────── */
export interface ErrorReport {
  id: number;
  software_key: string;
  client_identifier: string;
  error_type: string;
  error_level: 'error' | 'warning' | 'notice';
  message: string;
  file: string | null;
  line: number | null;
  stack_trace: string | null;
  url: string | null;
  user_agent: string | null;
  request_method: string | null;
  request_uri: string | null;
  hostname: string | null;
  app_version: string | null;
  os_info: string | null;
  source: string | null;
  ip_address: string | null;
  created_at: string;

  // Joined fields
  software_name?: string;
}

/* ── Client Error Summary ─────────────────────────────────── */
export interface ClientErrorSummary {
  id: number;
  software_key: string;
  client_identifier: string;
  hostname: string | null;
  total_errors: number;
  total_warnings: number;
  total_notices: number;
  last_error_at: string | null;
  first_error_at: string | null;
  updated_at: string;
}

/* ── Dashboard Stats (from GET /updates/dashboard) ────────── */
export interface UpdatesDashboard {
  summary: {
    software_count: number;
    update_count: number;
    user_count: number;
    active_clients_24h: number;
  };
  latest_clients: {
    id: number;
    software_id: number;
    software_name: string;
    hostname: string;
    machine_name: string;
    app_version: string;
    last_heartbeat: string;
  }[];
  recent_updates: {
    id: number;
    software_id: number;
    software_name: string;
    version: string;
    created_at: string;
  }[];
}

/* ── Client Action payloads ───────────────────────────────── */
export type ClientAction = 'block' | 'unblock' | 'force_logout' | 'send_message';

export interface ClientActionPayload {
  id: number;
  action: ClientAction;
  blocked_reason?: string;
  server_message?: string;
}
