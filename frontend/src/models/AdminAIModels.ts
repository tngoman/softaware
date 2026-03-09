import api from '../services/api';

/**
 * Admin AI Models
 * Handles all admin-level AI operations:
 *   - Client Manager (users, assistants, widgets, kill switches)
 *   - Enterprise Endpoints (CRUD, status toggle, request logs)
 *   - AI Credits (packages, balances, adjustments)
 *   - AI Overview (system-wide stats)
 */

// ─── Types ───────────────────────────────────────────────────────────────

export interface ClientOverview {
  id: number;
  email: string;
  name: string;
  account_status: string;
  createdAt: string;
  assistant_count: number;
  widget_count: number;
}

export interface ClientDetail {
  user: any;
  assistants: any[];
  widgets: any[];
}

export interface EnterpriseEndpoint {
  id: string;
  client_id: string;
  client_name: string;
  status: 'active' | 'paused' | 'disabled';
  inbound_provider: string;
  inbound_auth_type?: string;
  llm_provider: string;
  llm_model: string;
  llm_temperature?: number;
  llm_max_tokens?: number;
  llm_system_prompt: string;
  llm_tools_config?: string;
  llm_knowledge_base?: string;
  target_api_url?: string;
  target_api_auth_type?: string;
  target_api_auth_value?: string;
  target_api_headers?: string;
  created_at: string;
  updated_at: string;
  last_request_at?: string;
  total_requests: number;
}

export interface EndpointCreateInput {
  client_id: string;
  client_name: string;
  inbound_provider: string;
  llm_provider: string;
  llm_model: string;
  llm_system_prompt: string;
  llm_tools_config?: string;
  llm_temperature?: number;
  llm_max_tokens?: number;
  target_api_url?: string;
  target_api_auth_type?: string;
  target_api_auth_value?: string;
  target_api_headers?: string;
}

export interface RequestLog {
  id: string;
  endpoint_id: string;
  timestamp: string;
  inbound_payload: string;
  ai_response: string;
  duration_ms: number;
  status: string;
  error_message?: string;
}

export interface CreditPackage {
  id: number;
  name: string;
  credits: number;
  bonusCredits?: number;
  totalCredits?: number;
  price: number;
  formattedPrice?: string;
  description?: string;
  isActive: boolean;
}

export interface CreditBalance {
  id: number;
  teamId: string;
  team: { id: string; name: string };
  balance: number;
  formattedBalance?: string;
}

export interface SystemStats {
  workspaces: number;
  users: number;
  assistants: number;
  widgets: number;
  leads: number;
  activeSubscriptions: number;
  totalRevenue: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Client Manager
// ═══════════════════════════════════════════════════════════════════════════

export class AdminClientModel {
  static async getOverview() {
    const res = await api.get<{ success: boolean; stats: any; clients: any[]; assistants: any[]; widgets: any[] }>('/admin/clients/overview');
    return res.data; // { stats, clients, assistants, widgets }
  }

  static async getClient(userId: number | string) {
    const res = await api.get<{ success: boolean; client: any; assistants: any[]; widgets: any[] }>(`/admin/clients/${userId}`);
    return { user: res.data.client, assistants: res.data.assistants || [], widgets: res.data.widgets || [] };
  }

  static async setAccountStatus(userId: number, status: string) {
    const res = await api.patch(`/admin/clients/${userId}/status`, { status });
    return res.data;
  }

  static async setAssistantStatus(assistantId: string, status: string) {
    const res = await api.patch(`/admin/clients/assistants/${assistantId}/status`, { status });
    return res.data;
  }

  static async setWidgetStatus(widgetId: number, status: string) {
    const res = await api.patch(`/admin/clients/widgets/${widgetId}/status`, { status });
    return res.data;
  }

  static async suspendAccount(userId: number) {
    const res = await api.post(`/admin/clients/${userId}/suspend`);
    return res.data;
  }

  static async reactivateAccount(userId: number) {
    const res = await api.post(`/admin/clients/${userId}/reactivate`);
    return res.data;
  }

  static async masquerade(userId: number | string) {
    const res = await api.post<{
      success: boolean;
      message: string;
      data: {
        token: string;
        user: any;
        adminRestoreToken: string;
        masquerading: boolean;
        adminId: string;
        targetUser: { id: string; email: string; name: string };
      };
    }>(`/admin/clients/${userId}/masquerade`);
    return res.data;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Enterprise Endpoints
// ═══════════════════════════════════════════════════════════════════════════

export class AdminEnterpriseModel {
  static async getAll() {
    const res = await api.get<{ success: boolean; data: EnterpriseEndpoint[] }>('/admin/enterprise-endpoints');
    return res.data.data;
  }

  static async get(id: string) {
    const res = await api.get<{ success: boolean; data: EnterpriseEndpoint }>(`/admin/enterprise-endpoints/${id}`);
    return res.data.data;
  }

  static async create(data: EndpointCreateInput) {
    const res = await api.post<{ success: boolean; data: EnterpriseEndpoint }>('/admin/enterprise-endpoints', data);
    return res.data.data;
  }

  static async update(id: string, data: Partial<EndpointCreateInput & { status: string }>) {
    const res = await api.put<{ success: boolean; data: EnterpriseEndpoint }>(`/admin/enterprise-endpoints/${id}`, data);
    return res.data.data;
  }

  static async setStatus(id: string, status: 'active' | 'paused' | 'disabled') {
    const res = await api.patch(`/admin/enterprise-endpoints/${id}/status`, { status });
    return res.data;
  }

  static async delete(id: string) {
    const res = await api.delete(`/admin/enterprise-endpoints/${id}`);
    return res.data;
  }

  static async getLogs(id: string, limit = 50, offset = 0) {
    const res = await api.get<{ success: boolean; data: RequestLog[] }>(`/admin/enterprise-endpoints/${id}/logs`, {
      params: { limit, offset },
    });
    return res.data.data;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// AI Credits
// ═══════════════════════════════════════════════════════════════════════════

export class AdminCreditsModel {
  static async getPackages() {
    const res = await api.get<{ success: boolean; packages: CreditPackage[] }>('/admin/credits/packages');
    return res.data.packages || [];
  }

  static async createPackage(pkg: Partial<CreditPackage>) {
    const res = await api.post('/admin/credits/packages', pkg);
    return res.data;
  }

  static async updatePackage(id: number, pkg: Partial<CreditPackage>) {
    const res = await api.put(`/admin/credits/packages/${id}`, pkg);
    return res.data;
  }

  static async deletePackage(id: number) {
    const res = await api.delete(`/admin/credits/packages/${id}`);
    return res.data;
  }

  static async getAllBalances() {
    const res = await api.get<{ success: boolean; balances: CreditBalance[] }>('/admin/credits/balances');
    return res.data.balances || [];
  }

  static async adjustCredits(teamId: string | number, amount: number, reason: string) {
    const res = await api.post('/admin/credits/adjust', { team_id: teamId, amount, reason });
    return res.data;
  }

  static async getTransactions(teamId?: number) {
    const url = teamId ? `/admin/credits/transactions/${teamId}` : '/admin/credits/transactions';
    const res = await api.get(url);
    return res.data.transactions || [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// AI Config / Overview
// ═══════════════════════════════════════════════════════════════════════════

export class AdminConfigModel {
  static async getAIConfig() {
    const res = await api.get('/admin/config/ai');
    return res.data;
  }

  static async testAIConnection() {
    const res = await api.post('/admin/config/ai/test');
    return res.data;
  }

  static async getSystemStats() {
    const res = await api.get('/admin/dashboard');
    return res.data;
  }
}
