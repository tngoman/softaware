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
  contact_id?: number | null;
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
  allowed_ips?: string | null;
}

export interface EndpointCreateInput {
  client_id: string;
  client_name: string;
  contact_id?: number;
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

export interface SystemStats {
  workspaces: number;
  users: number;
  assistants: number;
  widgets: number;
  leads: number;
  activeSubscriptions: number;
  totalRevenue: number;
}

// ─── AI Overview Types ───────────────────────────────────────────────────

export interface AIOverviewData {
  assistants: { total: number; active: number; suspended: number; demoExpired: number; paid: number; free: number };
  widgets: { total: number; active: number; suspended: number };
  apiKeys: number;
  aiConfigurations: number;
  packageCredits: PackageCreditSummary;
  subscriptionBreakdown: Array<{ status: string; count: number }>;
  packagePopularity: Array<{ name: string; slug: string; subscribers: number; totalCreditsUsed: number }>;
  topConsumers: Array<{ contactId: number; name: string; packageName: string; creditsUsed: number; creditsBalance: number; status: string }>;
  spending: SpendingSummary;
  telemetry: TelemetrySummary;
  providers: { openRouter: OpenRouterStatus | null; openAI: OpenAIStatus | null; glm: GLMStatus | null; ollama: OllamaStatus | null };
  enterprise: EnterpriseSummary;
  clientApiGateway: ClientApiGatewaySummary;
  modelConfig: ModelConfig;
  system: { uptime: string; nodeVersion: string; memoryUsageMB: number; platform: string };
}

export interface PackageCreditSummary {
  totalUsed: number;
  totalPurchased: number;
  totalAllocated: number;
  totalBonus: number;
  totalAdjusted: number;
  totalRefunded: number;
  usageTransactions: number;
  totalTransactions: number;
  totalBalance: number;
  totalUsedLifetime: number;
  activeSubscriptions: number;
  usageByType: Array<{ type: string; count: number; credits: number }>;
  dailyUsage: Array<{ day: string; requests: number; creditsUsed: number }>;
}

export interface SpendingSummary {
  totalCreditsUsed: number;
  totalCreditsUsedRands: number;
  totalCreditsPurchased: number;
  totalCreditsPurchasedRands: number;
  totalCreditsBalance: number;
  totalCreditsBalanceRands: number;
  openRouterSpendUSD: number | null;
  openRouterLimitUSD: number | null;
  openRouterRemainingUSD: number | null;
  profitMarginRands: number;
  // OpenAI
  openAISpendUSD: number | null;
  openAIRequests: number;
  openAIAvgMs: number;
  // GLM (free cloud)
  glmRequests: number;
  glmAvgMs: number;
  // Ollama (local)
  ollamaRequests: number;
  ollamaAvgMs: number;
  ollamaLoadedModels: number;
  ollamaInstalledModels: number;
  ollamaTotalSize: number;
}

export interface TelemetrySummary {
  totalLogs: number;
  byProvider: Array<{ provider: string; cnt: number; avgMs: number }>;
  byModel: Array<{ model: string; provider: string; cnt: number; avgMs: number }>;
  bySource: Array<{ source: string; cnt: number }>;
  avgDurationMs: number;
  dailyVolume: Array<{ day: string; requests: number; avgMs: number }>;
  providerTrend?: Array<{ day: string; provider: string; cnt: number }>;
}

export interface OpenRouterStatus {
  connected: boolean;
  label?: string;
  credits?: number | null;
  creditsUsed?: number | null;
  creditsRemaining?: number | null;
  rateLimit?: any;
  isFreeTier?: boolean | null;
  error?: string;
}

export interface OpenAIStatus {
  connected: boolean;
  apiKeyPreview?: string;
  models?: string[];
  totalModels?: number;
  error?: string;
}

export interface GLMStatus {
  configured: boolean;
  apiKeyPreview?: string;
  model?: string;
  visionModel?: string;
  baseUrl?: string;
}

export interface OllamaStatus {
  connected: boolean;
  baseUrl?: string;
  runningModels?: Array<{ name: string; size: number; sizeVram: number; digest: string; expiresAt: string }>;
  installedModels?: Array<{ name: string; size: number; modifiedAt: string; digest: string; parameterSize: string; quantization: string; family: string }>;
  totalModels?: number;
  loadedModels?: number;
  error?: string;
}

export interface EnterpriseSummary {
  total: number;
  active: number;
  paused: number;
  disabled: number;
  totalRequests: number;
  endpoints?: Array<{ id: string; client_name: string; status: string; llm_provider: string; llm_model: string; total_requests: number; last_request_at: string }>;
}

export interface ClientApiGatewaySummary {
  total: number;
  active: number;
  paused: number;
  disabled: number;
  totalRequests: number;
  configs?: Array<{ id: string; client_id: string; client_name: string; status: string; auth_type: string; target_base_url: string; total_requests: number; last_request_at: string; created_at: string }>;
}

export interface ModelConfig {
  primaryModel: string;
  primaryProvider: string;
  openRouterFallback: string;
  openRouterAssistant: string;
  assistantOllama: string;
  toolsOllama: string;
  siteBuilderOllama: string;
  visionOpenRouter: string;
  visionOpenRouterFallback: string;
  visionOllama: string;
  ingestionOpenRouter: string;
  ingestionOllama: string;
  siteBuilderGLM: string;
  siteBuilderOpenRouter: string;
}

// ─── Legacy Package System Types removed ──────────────────────────────────
// Pricing is now entirely static via config/tiers.ts

// ═══════════════════════════════════════════════════════════════════════════
// Client Manager
// ═══════════════════════════════════════════════════════════════════════════

export class AdminClientModel {
  static async getOverview() {
    const res = await api.get<{ success: boolean; stats: any; clients: any[]; assistants: any[]; widgets: any[]; landingPages: any[]; enterpriseEndpoints: any[] }>('/admin/clients/overview');
    return res.data; // { stats, clients, assistants, widgets, landingPages, enterpriseEndpoints }
  }

  static async getClient(userId: number | string) {
    const res = await api.get<{ success: boolean; client: any; assistants: any[]; widgets: any[]; landingPages: any[] }>(`/admin/clients/${userId}`);
    return { user: res.data.client, assistants: res.data.assistants || [], widgets: res.data.widgets || [], landingPages: res.data.landingPages || [] };
  }

  static async getChatLogs(userId: number | string, options?: { limit?: number; offset?: number; source?: string }) {
    const params: Record<string, string> = {};
    if (options?.limit) params.limit = String(options.limit);
    if (options?.offset) params.offset = String(options.offset);
    if (options?.source) params.source = options.source;
    const res = await api.get<{
      success: boolean;
      data: Array<{
        id: number;
        client_id: string;
        source: string;
        sanitized_prompt: string;
        sanitized_response: string;
        model: string;
        provider: string;
        duration_ms: number;
        created_at: string;
      }>;
      pagination: { total: number; limit: number; offset: number; hasMore: boolean };
    }>(`/admin/clients/${userId}/chat-logs`, { params });
    return res.data;
  }

  /**
   * Fetch documentation (Api.md) for a contact from the enterprise docs folder.
   * GET /admin/clients/:contactId/documentation
   */
  static async getDocumentation(contactId: number | string, filename?: string) {
    const params: Record<string, string> = {};
    if (filename) params.file = filename;
    const res = await api.get<{
      success: boolean;
      content: string;
      filename: string;
      contactId: string;
    }>(`/admin/clients/${contactId}/documentation`, { params });
    return res.data;
  }

  /**
   * List all documentation .md files available for a contact.
   * GET /admin/clients/:contactId/documentation/list
   */
  static async getDocumentationList(contactId: number | string) {
    const res = await api.get<{
      success: boolean;
      files: Array<{ filename: string; size: number; modified: string }>;
      contactId: string;
    }>(`/admin/clients/${contactId}/documentation/list`);
    return res.data;
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

  static async updateConfig(id: string, config: { allowed_ips?: string | null }) {
    const res = await api.patch<{ success: boolean; data: EnterpriseEndpoint }>(`/admin/enterprise-endpoints/${id}/config`, config);
    return res.data.data;
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
// Client API Gateway Configs
// ═══════════════════════════════════════════════════════════════════════════

export interface ClientApiConfig {
  id: string;
  client_id: string;
  client_name: string;
  contact_id: number | null;
  endpoint_id: string | null;
  status: 'active' | 'paused' | 'disabled';
  target_base_url: string;
  auth_type: 'rolling_token' | 'bearer' | 'basic' | 'api_key' | 'none';
  auth_secret: string | null;
  auth_header: string;
  allowed_actions: string | null; // JSON array of strings
  rate_limit_rpm: number;
  timeout_ms: number;
  created_at: string;
  updated_at: string;
  total_requests: number;
  last_request_at: string | null;
}

export interface ClientApiConfigInput {
  client_id: string;
  client_name: string;
  contact_id?: number;
  endpoint_id?: string;
  target_base_url: string;
  auth_type?: string;
  auth_secret?: string;
  auth_header?: string;
  allowed_actions?: string[];
  rate_limit_rpm?: number;
  timeout_ms?: number;
}

export interface ClientApiLog {
  id: string;
  config_id: string;
  client_id: string;
  action: string;
  status_code: number;
  duration_ms: number;
  error_message: string | null;
  created_at: string;
}

export class AdminClientApiModel {
  static async getAll(): Promise<ClientApiConfig[]> {
    const res = await api.get<{ success: boolean; data: ClientApiConfig[] }>('/admin/client-api-configs');
    return res.data.data;
  }

  static async get(id: string): Promise<ClientApiConfig> {
    const res = await api.get<{ success: boolean; data: ClientApiConfig }>(`/admin/client-api-configs/${id}`);
    return res.data.data;
  }

  static async create(data: ClientApiConfigInput): Promise<ClientApiConfig> {
    const res = await api.post<{ success: boolean; data: ClientApiConfig }>('/admin/client-api-configs', data);
    return res.data.data;
  }

  static async update(id: string, data: Partial<ClientApiConfigInput>): Promise<ClientApiConfig> {
    const res = await api.put<{ success: boolean; data: ClientApiConfig }>(`/admin/client-api-configs/${id}`, data);
    return res.data.data;
  }

  static async setStatus(id: string, status: 'active' | 'paused' | 'disabled'): Promise<void> {
    await api.patch(`/admin/client-api-configs/${id}/status`, { status });
  }

  static async delete(id: string): Promise<void> {
    await api.delete(`/admin/client-api-configs/${id}`);
  }

  static async getLogs(id: string, limit = 50, offset = 0): Promise<ClientApiLog[]> {
    const res = await api.get<{ success: boolean; data: ClientApiLog[] }>(`/admin/client-api-configs/${id}/logs`, {
      params: { limit, offset },
    });
    return res.data.data;
  }

  /** Sync tool definitions to the linked enterprise endpoint's llm_tools_config */
  static async syncTools(id: string, tools: any[]): Promise<void> {
    await api.post(`/admin/client-api-configs/${id}/sync-tools`, { tools });
  }

  /** Download a blank gateway template JSON */
  static async exportTemplate(): Promise<any> {
    const res = await api.get('/admin/client-api-configs/export-template');
    return res.data;
  }

  /** Export an existing gateway config as a re-importable JSON */
  static async exportConfig(id: string): Promise<any> {
    const res = await api.get(`/admin/client-api-configs/${id}/export`);
    return res.data;
  }

  /** Import a gateway by selecting a client + endpoint + tools. Backend derives all config. */
  static async importConfig(payload: {
    contact_id: number;
    endpoint_id: string;
    selected_tools: string[];
    connection_overrides?: {
      target_base_url?: string;
      auth_type?: string;
      auth_secret?: string;
      auth_header?: string;
    };
  }): Promise<{ data: ClientApiConfig; tools_selected: string[]; allowed_actions: string[]; message: string }> {
    const res = await api.post<{ success: boolean; data: ClientApiConfig; tools_selected: string[]; allowed_actions: string[]; message: string }>('/admin/client-api-configs/import', payload);
    return res.data;
  }

  /** List tools available on an enterprise endpoint (for the import tool picker) */
  static async getEndpointTools(endpointId: string): Promise<{ endpoint_id: string; endpoint_name: string; tools: Array<{ name: string; description: string; paramCount: number }> }> {
    const res = await api.get<{ success: boolean; endpoint_id: string; endpoint_name: string; tools: Array<{ name: string; description: string; paramCount: number }> }>(`/admin/client-api-configs/endpoint-tools/${endpointId}`);
    return res.data;
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

// ═══════════════════════════════════════════════════════════════════════════
// AI Overview (comprehensive AI dashboard)
// ═══════════════════════════════════════════════════════════════════════════

export class AdminAIOverviewModel {
  static async getOverview(): Promise<AIOverviewData> {
    const res = await api.get<{ success: boolean; data: AIOverviewData }>('/admin/ai-overview');
    return res.data.data;
  }

  static async getAssistantLogs(assistantId: string, limit = 50, offset = 0) {
    const res = await api.get<{
      success: boolean;
      data: Array<{
        id: number;
        client_id: string;
        source: string;
        sanitized_prompt: string;
        sanitized_response: string;
        model: string;
        provider: string;
        duration_ms: number;
        created_at: string;
      }>;
      pagination: { total: number; limit: number; offset: number; hasMore: boolean };
    }>(`/admin/ai-overview/assistant-logs/${assistantId}`, { params: { limit, offset } });
    return res.data;
  }
}
