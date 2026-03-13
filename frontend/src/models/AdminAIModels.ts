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

// ─── Package System Types ────────────────────────────────────────────────

export interface PackageDefinition {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  package_type: 'CONSUMER' | 'ENTERPRISE' | 'STAFF' | 'ADDON';
  price_monthly: number;
  price_annually: number | null;
  credits_included: number;
  max_users: number | null;
  max_agents: number | null;
  max_widgets: number | null;
  max_landing_pages: number | null;
  max_enterprise_endpoints: number | null;
  features: string | string[] | null;
  is_active: boolean;
  is_public: boolean;
  display_order: number;
  featured: boolean;
  cta_text: string;
  created_at: string;
  updated_at: string;
}

export interface ContactPackageSubscription {
  id: number;
  contact_id: number;
  package_id: number;
  status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED' | 'SUSPENDED';
  billing_cycle: 'MONTHLY' | 'ANNUALLY' | 'NONE';
  credits_balance: number;
  credits_used: number;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  payment_provider: 'PAYFAST' | 'YOCO' | 'MANUAL';
  low_balance_threshold: number;
  low_balance_alert_sent: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  contact_name?: string;
  package_name?: string;
  package_slug?: string;
}

export interface PackageTransaction {
  id: number;
  contact_package_id: number;
  contact_id: number;
  user_id: string | null;
  type: 'PURCHASE' | 'USAGE' | 'BONUS' | 'REFUND' | 'ADJUSTMENT' | 'MONTHLY_ALLOCATION' | 'EXPIRY';
  amount: number;
  request_type: string | null;
  request_metadata: any;
  description: string | null;
  balance_after: number;
  created_at: string;
  contact_name?: string;
  package_name?: string;
}

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
// AI Packages (New unified package system)
// ═══════════════════════════════════════════════════════════════════════════

export class AdminPackagesModel {
  // ── Package CRUD ────────────────────────────────────────────────────
  static async getPackages(): Promise<PackageDefinition[]> {
    const res = await api.get<{ success: boolean; packages: PackageDefinition[] }>('/admin/packages');
    return res.data.packages || [];
  }

  static async getPackage(id: number): Promise<PackageDefinition> {
    const res = await api.get<{ success: boolean; package: PackageDefinition }>(`/admin/packages/${id}`);
    return res.data.package;
  }

  static async createPackage(pkg: Partial<PackageDefinition>): Promise<PackageDefinition> {
    const res = await api.post<{ success: boolean; package: PackageDefinition }>('/admin/packages', pkg);
    return res.data.package;
  }

  static async updatePackage(id: number, pkg: Partial<PackageDefinition>): Promise<PackageDefinition> {
    const res = await api.put<{ success: boolean; package: PackageDefinition }>(`/admin/packages/${id}`, pkg);
    return res.data.package;
  }

  static async deletePackage(id: number): Promise<void> {
    await api.delete(`/admin/packages/${id}`);
  }

  // ── Subscriptions ──────────────────────────────────────────────────
  static async getAllSubscriptions(status?: string): Promise<ContactPackageSubscription[]> {
    const params = status ? { status } : {};
    const res = await api.get<{ success: boolean; subscriptions: ContactPackageSubscription[] }>(
      '/admin/packages/subscriptions/all', { params }
    );
    return res.data.subscriptions || [];
  }

  static async getContactSubscriptions(contactId: number) {
    const res = await api.get<{
      success: boolean;
      subscriptions: ContactPackageSubscription[];
      balance: { total: number; byPackage: any[] };
    }>(`/admin/packages/subscriptions/${contactId}`);
    return res.data;
  }

  static async assignPackage(data: {
    contact_id: number;
    package_id: number;
    billing_cycle?: string;
    payment_provider?: string;
    status?: string;
    trial_days?: number;
  }): Promise<ContactPackageSubscription> {
    const res = await api.post<{ success: boolean; subscription: ContactPackageSubscription }>(
      '/admin/packages/subscriptions/assign', data
    );
    return res.data.subscription;
  }

  static async updateSubscriptionStatus(id: number, status: string) {
    const res = await api.patch(`/admin/packages/subscriptions/${id}/status`, { status });
    return res.data;
  }

  // ── Credits ────────────────────────────────────────────────────────
  static async adjustCredits(contactPackageId: number, amount: number, reason: string) {
    const res = await api.post('/admin/packages/credits/adjust', {
      contact_package_id: contactPackageId,
      amount,
      reason,
    });
    return res.data;
  }

  // ── Transactions ───────────────────────────────────────────────────
  static async getTransactions(options?: { contact_id?: number; type?: string; limit?: number; offset?: number }) {
    const res = await api.get<{ success: boolean; transactions: PackageTransaction[]; total: number }>(
      '/admin/packages/transactions/all', { params: options }
    );
    return res.data;
  }

  static async getContactTransactions(contactId: number, limit = 50, offset = 0) {
    const res = await api.get<{ success: boolean; transactions: PackageTransaction[]; total: number }>(
      `/admin/packages/transactions/${contactId}`, { params: { limit, offset } }
    );
    return res.data;
  }

  // ── Usage Stats ────────────────────────────────────────────────────
  static async getUsageStats(contactId: number, days = 30) {
    const res = await api.get(`/admin/packages/usage/${contactId}`, { params: { days } });
    return res.data;
  }

  // ── User-Contact Links ─────────────────────────────────────────────
  static async linkUser(userId: string, contactId: number, role = 'MEMBER') {
    const res = await api.post('/admin/packages/link-user', { user_id: userId, contact_id: contactId, role });
    return res.data;
  }

  static async getContactUsers(contactId: number) {
    const res = await api.get(`/admin/packages/contact-users/${contactId}`);
    return res.data.users || [];
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
