/**
 * Client API Gateway Route — Standardized Enterprise API Proxy
 *
 * All enterprise client API calls flow through:
 *
 *     POST /api/v1/client-api/:clientId/:action
 *
 * This replaces the legacy pattern where each client had a language-specific
 * proxy file at a random URL (e.g., AiClient.php on softaware.net.za).
 *
 * The route looks up the client config in SQLite, validates the action,
 * builds auth headers, forwards the request to the real target API,
 * and returns the response.
 *
 * No authentication is required on the inbound side because this endpoint
 * is only called by the AI tool-calling loop (same server / internal).
 * The target API auth is handled via rolling tokens, bearer tokens, etc.
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import {
  getConfigByClientId,
  buildAuthHeaders,
  recordRequest,
  validateClientSecret,
  getUsageStats,
  updateConfig,
  rotateSecret,
  setCustomSecret,
  getRequestLogsByClientId,
  type ClientApiConfig,
} from '../services/clientApiGateway.js';
import { resolveContactPackage } from '../middleware/packageEnforcement.js';

const router = Router();

// ─── Branding helper ───────────────────────────────────────────────────
// Resolves whether the client must show Soft Aware branding.
// Free-tier and trial accounts → branding required.
// Paid tiers (starter+) → branding hidden automatically.
interface BrandingInfo {
  required: boolean;
  powered_by: string | null;
  logo_url: string | null;
  link_url: string | null;
  tier: string;
  message: string | null;
}

async function resolveBranding(contactId: number | null): Promise<BrandingInfo> {
  const FREE_BRANDING: BrandingInfo = {
    required: true,
    powered_by: 'Powered by Soft Aware',
    logo_url: 'https://softaware.net.za/assets/logo-badge.png',
    link_url: 'https://softaware.net.za',
    tier: 'free',
    message: 'Free-tier integrations must display the "Powered by Soft Aware" badge. Upgrade to a paid plan to remove branding.',
  };

  if (!contactId) return FREE_BRANDING;

  try {
    const pkg = await resolveContactPackage(contactId);
    if (!pkg) return FREE_BRANDING;

    const canRemove = pkg.limits.canRemoveWatermark;
    const tier = pkg.package_slug || 'free';

    if (canRemove) {
      return {
        required: false,
        powered_by: null,
        logo_url: null,
        link_url: null,
        tier,
        message: null,
      };
    }

    return { ...FREE_BRANDING, tier };
  } catch {
    // If package resolution fails, default to requiring branding
    return FREE_BRANDING;
  }
}

// ─── Shared auth helper ────────────────────────────────────────────────
// Extracts the client secret/token from standard locations.
function extractClientToken(req: Request): string {
  return (
    (req.headers['x-client-secret'] as string) ||
    (req.headers['authorization'] as string)?.replace(/^Bearer\s+/i, '') ||
    (req.query.secret as string) ||
    ''
  );
}

// Authenticates the request against the client config's shared secret.
// Returns the config if valid, or sends a 401/404 and returns null.
function authenticateClient(req: Request, res: Response): ClientApiConfig | null {
  const { clientId } = req.params;
  const config = getConfigByClientId(clientId);

  if (!config) {
    res.status(404).json({
      success: false,
      error: 'CLIENT_NOT_FOUND',
      message: `No client API configuration found for client: ${clientId}`,
    });
    return null;
  }

  const token = extractClientToken(req);
  if (!validateClientSecret(config, token)) {
    res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Invalid or missing client secret. Send your shared secret in the X-Client-Secret header.',
    });
    return null;
  }

  return config;
}

/**
 * POST /v1/client-api/:clientId/:action
 *
 * Forward a tool-call request to the client's target API.
 *
 * URL params:
 *   clientId — matches client_api_configs.client_id (e.g., 'silulumanzi')
 *   action   — the tool/action name (e.g., 'getCustomerContext')
 *
 * Body: JSON payload to forward (tool arguments)
 */
router.post('/:clientId/:action', async (req: Request, res: Response) => {
  const { clientId, action } = req.params;
  const startTime = Date.now();

  try {
    // 1. Look up client config
    const config = getConfigByClientId(clientId);

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'CLIENT_NOT_FOUND',
        message: `No client API configuration found for client: ${clientId}`,
      });
    }

    // 2. Check status
    if (config.status === 'disabled') {
      return res.status(403).json({
        success: false,
        error: 'CLIENT_API_DISABLED',
        message: `Client API for ${config.client_name} is disabled.`,
      });
    }

    if (config.status === 'paused') {
      return res.status(503).json({
        success: false,
        error: 'CLIENT_API_PAUSED',
        message: `Client API for ${config.client_name} is temporarily paused.`,
      });
    }

    // 3. Validate action is a registered tool (security whitelist — prevents
    //    calling arbitrary endpoints on the target API)
    if (config.allowed_actions) {
      let registeredTools: string[];
      try {
        registeredTools = JSON.parse(config.allowed_actions);
      } catch {
        registeredTools = [];
      }

      if (registeredTools.length > 0 && !registeredTools.includes(action)) {
        return res.status(400).json({
          success: false,
          error: 'UNKNOWN_TOOL',
          message: `Tool '${action}' is not registered for client ${clientId}. Registered tools: ${registeredTools.join(', ')}`,
        });
      }
    }

    // 4. Build the target URL
    const targetUrl = `${config.target_base_url.replace(/\/+$/, '')}/${action}`;

    // 5. Build auth headers
    const headers = buildAuthHeaders(config);

    // 6. Forward the request
    console.log(`[ClientApiGateway] ${clientId}/${action} → ${targetUrl}`);
    console.log(`[ClientApiGateway] Payload:`, JSON.stringify(req.body));

    const response = await axios.post(targetUrl, req.body, {
      headers,
      timeout: config.timeout_ms || 30000,
      validateStatus: () => true, // Don't throw on non-2xx — pass through
    });

    // 7. Log the request
    const duration = Date.now() - startTime;
    recordRequest(
      config.id,
      clientId,
      action,
      response.status,
      duration,
      response.status >= 400 ? JSON.stringify(response.data).substring(0, 500) : undefined
    );

    console.log(`[ClientApiGateway] ${clientId}/${action} → ${response.status} (${duration}ms) Response:`, JSON.stringify(response.data).substring(0, 300));

    // 8. Resolve branding — inject for free-tier clients
    const branding = await resolveBranding(config.contact_id);

    if (branding.required && response.data && typeof response.data === 'object') {
      // Inject branding metadata into the response envelope
      return res.status(response.status).json({
        ...response.data,
        _branding: {
          powered_by: branding.powered_by,
          logo_url: branding.logo_url,
          link_url: branding.link_url,
        },
      });
    }

    return res.status(response.status).json(response.data);

  } catch (error) {
    const duration = Date.now() - startTime;
    const errMsg = error instanceof Error ? error.message : String(error);

    console.error(`[ClientApiGateway] ${clientId}/${action} Error:`, errMsg);

    // Log the error
    try {
      const config = getConfigByClientId(clientId);
      if (config) {
        recordRequest(config.id, clientId, action, 502, duration, errMsg);
      }
    } catch { /* non-fatal */ }

    // Check for timeout
    if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
      return res.status(504).json({
        success: false,
        error: 'GATEWAY_TIMEOUT',
        message: `Target API for ${clientId} did not respond in time.`,
      });
    }

    // Check for connection errors
    if (axios.isAxiosError(error) && (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND')) {
      return res.status(502).json({
        success: false,
        error: 'BAD_GATEWAY',
        message: `Cannot reach target API for ${clientId}.`,
      });
    }

    return res.status(500).json({
      success: false,
      error: 'GATEWAY_ERROR',
      message: 'An error occurred while forwarding the request.',
    });
  }
});

/**
 * GET /v1/client-api/:clientId/usage
 *
 * Client-facing usage statistics endpoint.
 * Authenticated via the shared secret — the client proves identity by sending
 * the same secret (or today's rolling token) in the X-Client-Secret header.
 *
 * Query params:
 *   days   — number of days to look back (default 30, max 90)
 *   recent — max recent requests to return (default 25, max 100)
 *
 * Returns: summary stats, daily breakdown, per-action breakdown, recent requests.
 */
router.get('/:clientId/usage', (req: Request, res: Response) => {
  const { clientId } = req.params;

  try {
    const config = authenticateClient(req, res);
    if (!config) return;

    // Parse options
    const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 90);
    const recent = Math.min(Math.max(parseInt(req.query.recent as string) || 25, 0), 100);

    const stats = getUsageStats(config, days, recent);

    console.log(`[ClientApiGateway] Usage stats served for ${clientId} (${days}d)`);

    return res.json({
      success: true,
      ...stats,
    });
  } catch (error) {
    console.error(`[ClientApiGateway] Usage stats error for ${clientId}:`, error);
    return res.status(500).json({
      success: false,
      error: 'STATS_ERROR',
      message: 'Failed to retrieve usage statistics.',
    });
  }
});

/**
 * GET /v1/client-api/:clientId/health
 *
 * Quick health check — verifies the config exists and is active.
 * Does NOT call the target API.
 */
router.get('/:clientId/health', async (req: Request, res: Response) => {
  const { clientId } = req.params;
  const config = getConfigByClientId(clientId);

  if (!config) {
    return res.status(404).json({ status: 'not_found', clientId });
  }

  const branding = await resolveBranding(config.contact_id);

  return res.json({
    status: config.status,
    clientId: config.client_id,
    clientName: config.client_name,
    targetUrl: config.target_base_url,
    authType: config.auth_type,
    totalRequests: config.total_requests,
    lastRequestAt: config.last_request_at,
    branding: {
      required: branding.required,
      powered_by: branding.powered_by,
      logo_url: branding.logo_url,
      link_url: branding.link_url,
    },
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CLIENT SELF-SERVICE MANAGEMENT API
//
// All endpoints below are authenticated via X-Client-Secret (shared secret
// or rolling token). These let external developers build their own admin UI
// for managing their gateway without needing Soft Aware admin access.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /v1/client-api/:clientId/config
 *
 * Read the gateway configuration. Returns connection settings, auth type,
 * status, tools, rate limits — everything except the full auth_secret.
 */
router.get('/:clientId/config', async (req: Request, res: Response) => {
  try {
    const config = authenticateClient(req, res);
    if (!config) return;

    // Parse tools
    let tools: string[] = [];
    if (config.allowed_actions) {
      try { tools = JSON.parse(config.allowed_actions); } catch { /* */ }
    }

    // Resolve tool details from the linked enterprise endpoint, or fall back to allowed_actions names
    let toolDetails: Array<{ name: string; description: string; parameters: any[] }> = [];
    if (config.endpoint_id) {
      try {
        // Dynamic import to avoid circular dependency
        const { getEndpoint } = await import('../services/enterpriseEndpoints.js');
        const ep = getEndpoint(config.endpoint_id);
        if (ep?.llm_tools_config) {
          const rawTools = JSON.parse(ep.llm_tools_config);
          toolDetails = rawTools
            .filter((t: any) => {
              const name = t.function?.name || '';
              return tools.length === 0 || tools.includes(name);
            })
            .map((t: any) => ({
              name: t.function?.name || '',
              description: t.function?.description || '',
              parameters: Object.entries(t.function?.parameters?.properties || {}).map(
                ([key, val]: [string, any]) => ({
                  name: key,
                  type: val.type || 'string',
                  description: val.description || '',
                  required: (t.function?.parameters?.required || []).includes(key),
                })
              ),
            }));
        }
      } catch { /* endpoint not available */ }
    }

    // Fallback: if no enterprise endpoint provided rich details, list tool names from allowed_actions
    if (toolDetails.length === 0 && tools.length > 0) {
      toolDetails = tools.map(name => ({ name, description: '', parameters: [] }));
    }

    const branding = await resolveBranding(config.contact_id);

    console.log(`[ClientApiGateway] Config served for ${config.client_id}`);

    return res.json({
      success: true,
      data: {
        client_id: config.client_id,
        client_name: config.client_name,
        status: config.status,
        target_base_url: config.target_base_url,
        auth_type: config.auth_type,
        auth_header: config.auth_header,
        // Show a masked hint of the secret, never the full value
        auth_secret_hint: config.auth_secret
          ? `${config.auth_secret.substring(0, 6)}...${config.auth_secret.substring(config.auth_secret.length - 4)}`
          : null,
        auth_secret_length: config.auth_secret?.length || 0,
        rate_limit_rpm: config.rate_limit_rpm,
        timeout_ms: config.timeout_ms,
        total_requests: config.total_requests,
        last_request_at: config.last_request_at,
        created_at: config.created_at,
        updated_at: config.updated_at,
        tools: toolDetails,
        branding,
      },
    });
  } catch (error) {
    console.error(`[ClientApiGateway] Config error:`, error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve config' });
  }
});

/**
 * PATCH /v1/client-api/:clientId/config
 *
 * Update connection settings. Clients can update:
 *   - target_base_url
 *   - auth_header
 *   - auth_type (with validation)
 *
 * They CANNOT change: client_id, client_name, allowed_actions, rate_limit_rpm,
 * timeout_ms — those are managed by Soft Aware admin.
 */
router.patch('/:clientId/config', (req: Request, res: Response) => {
  try {
    const config = authenticateClient(req, res);
    if (!config) return;

    const { target_base_url, auth_header, auth_type } = req.body;

    const updates: Partial<ClientApiConfig> = {};
    let changed = 0;

    // Validate and apply target_base_url
    if (target_base_url !== undefined) {
      if (typeof target_base_url !== 'string' || !target_base_url.startsWith('http')) {
        return res.status(400).json({ success: false, error: 'target_base_url must be a valid HTTP(S) URL' });
      }
      updates.target_base_url = target_base_url;
      changed++;
    }

    // Validate and apply auth_header
    if (auth_header !== undefined) {
      if (typeof auth_header !== 'string' || auth_header.length < 1 || auth_header.length > 100) {
        return res.status(400).json({ success: false, error: 'auth_header must be a non-empty string (max 100 chars)' });
      }
      updates.auth_header = auth_header;
      changed++;
    }

    // Validate and apply auth_type
    if (auth_type !== undefined) {
      const validTypes = ['rolling_token', 'bearer', 'basic', 'api_key', 'none'];
      if (!validTypes.includes(auth_type)) {
        return res.status(400).json({ success: false, error: `auth_type must be one of: ${validTypes.join(', ')}` });
      }
      updates.auth_type = auth_type;
      changed++;
    }

    if (changed === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields to update. Allowed: target_base_url, auth_header, auth_type' });
    }

    updateConfig(config.id, updates as any);

    console.log(`[ClientApiGateway] Config updated for ${config.client_id}: ${Object.keys(updates).join(', ')}`);

    return res.json({
      success: true,
      message: `Updated ${changed} field(s)`,
      updated: Object.keys(updates),
    });
  } catch (error) {
    console.error(`[ClientApiGateway] Config update error:`, error);
    return res.status(500).json({ success: false, error: 'Failed to update config' });
  }
});

/**
 * POST /v1/client-api/:clientId/secret/rotate
 *
 * Rotate the shared secret. Generates a new random 64-char hex secret.
 * The new secret is returned in the response body — this is the ONLY time
 * the full secret is visible. Store it securely.
 *
 * Optionally accepts { custom_secret: "..." } to set a client-provided secret.
 */
router.post('/:clientId/secret/rotate', (req: Request, res: Response) => {
  try {
    const config = authenticateClient(req, res);
    if (!config) return;

    const { custom_secret } = req.body || {};

    let newSecret: string;

    if (custom_secret) {
      // Validate custom secret
      if (typeof custom_secret !== 'string' || custom_secret.length < 32) {
        return res.status(400).json({
          success: false,
          error: 'custom_secret must be at least 32 characters',
        });
      }
      if (custom_secret.length > 256) {
        return res.status(400).json({
          success: false,
          error: 'custom_secret must be at most 256 characters',
        });
      }
      newSecret = setCustomSecret(config.id, custom_secret);
      console.log(`[ClientApiGateway] Custom secret set for ${config.client_id}`);
    } else {
      newSecret = rotateSecret(config.id);
      console.log(`[ClientApiGateway] Secret rotated for ${config.client_id}`);
    }

    return res.json({
      success: true,
      message: 'Secret updated. Store this securely — it will not be shown again.',
      secret: newSecret,
      length: newSecret.length,
      auth_type: config.auth_type,
      note: config.auth_type === 'rolling_token'
        ? `Your new rolling token = SHA256("${newSecret.substring(0, 6)}..." + "YYYY-MM-DD"). Update your server's SOFTAWARE_SECRET env var immediately.`
        : 'Update the corresponding credential on your server immediately.',
    });
  } catch (error) {
    console.error(`[ClientApiGateway] Secret rotate error:`, error);
    return res.status(500).json({ success: false, error: 'Failed to rotate secret' });
  }
});

/**
 * PATCH /v1/client-api/:clientId/status
 *
 * Pause or resume the gateway. Clients can toggle between 'active' and 'paused'.
 * They cannot set 'disabled' — that's admin-only.
 */
router.patch('/:clientId/status', (req: Request, res: Response) => {
  try {
    const config = authenticateClient(req, res);
    if (!config) return;

    const { status } = req.body;

    if (!status || !['active', 'paused'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'status must be "active" or "paused"',
      });
    }

    // Don't allow resuming if admin has disabled
    if (config.status === 'disabled') {
      return res.status(403).json({
        success: false,
        error: 'GATEWAY_DISABLED',
        message: 'This gateway has been disabled by Soft Aware admin. Contact support to re-enable.',
      });
    }

    updateConfig(config.id, { status } as any);

    console.log(`[ClientApiGateway] Status ${config.client_id} → ${status} (client self-service)`);

    return res.json({
      success: true,
      message: `Gateway ${status === 'paused' ? 'paused — no AI requests will be sent to your API' : 'resumed — AI requests will flow normally'}`,
      status,
      previous_status: config.status,
    });
  } catch (error) {
    console.error(`[ClientApiGateway] Status update error:`, error);
    return res.status(500).json({ success: false, error: 'Failed to update status' });
  }
});

/**
 * GET /v1/client-api/:clientId/logs
 *
 * Paginated request logs. Returns the same data as the Logs tab in the portal.
 *
 * Query params:
 *   limit  — max rows (default 50, max 200)
 *   offset — pagination offset (default 0)
 */
router.get('/:clientId/logs', (req: Request, res: Response) => {
  try {
    const config = authenticateClient(req, res);
    if (!config) return;

    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

    const { logs, total } = getRequestLogsByClientId(config.client_id, limit, offset);

    console.log(`[ClientApiGateway] Logs served for ${config.client_id} (${logs.length}/${total})`);

    return res.json({
      success: true,
      client_id: config.client_id,
      total,
      limit,
      offset,
      has_more: offset + limit < total,
      logs,
    });
  } catch (error) {
    console.error(`[ClientApiGateway] Logs error:`, error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve logs' });
  }
});

/**
 * GET /v1/client-api/:clientId/export
 *
 * Client-facing export — downloads the integration spec JSON with connection
 * details, auth validation examples, tool definitions, and usage API docs.
 * Same format as the admin export but authenticated via X-Client-Secret.
 */
router.get('/:clientId/export', async (req: Request, res: Response) => {
  try {
    const config = authenticateClient(req, res);
    if (!config) return;

    const branding = await resolveBranding(config.contact_id);

    // Resolve tools from the linked enterprise endpoint, or fall back to allowed_actions
    let tools: any[] = [];
    if (config.endpoint_id) {
      try {
        const { getEndpoint } = await import('../services/enterpriseEndpoints.js');
        const ep = getEndpoint(config.endpoint_id);
        if (ep?.llm_tools_config) {
          const rawTools = JSON.parse(ep.llm_tools_config);
          tools = rawTools.map((t: any) => ({
            name: t.function?.name || '',
            description: t.function?.description || '',
            parameters: Object.entries(t.function?.parameters?.properties || {}).map(
              ([key, val]: [string, any]) => ({
                name: key,
                type: val.type || 'string',
                description: val.description || '',
                required: (t.function?.parameters?.required || []).includes(key),
                ...(val.enum ? { enum: val.enum } : {}),
              })
            ),
          }));
        }
      } catch { /* endpoint may not exist */ }
    }

    // Fallback: if no enterprise endpoint, use allowed_actions as basic tool list
    if (tools.length === 0 && config.allowed_actions) {
      try {
        const actionNames: string[] = JSON.parse(config.allowed_actions);
        tools = actionNames.map(name => ({ name, description: '', parameters: [] }));
      } catch { /* */ }
    }

    const exportData = {
      _meta: {
        type: 'softaware_gateway_client_spec',
        version: '2.0.0',
        exported_at: new Date().toISOString(),
        client_id: config.client_id,
        client_name: config.client_name,
        purpose: `Integration specification for ${config.client_name}. Defines every tool the Soft Aware AI will call on your API, including parameters, expected responses, and auth configuration.`,
      },

      connection: {
        base_url: config.target_base_url,
        auth_type: config.auth_type,
        auth_header: config.auth_header,
        auth_secret_hint: config.auth_secret
          ? `${config.auth_secret.substring(0, 6)}...${config.auth_secret.substring(config.auth_secret.length - 4)} (${config.auth_secret.length} chars)`
          : null,
        note: config.auth_type === 'rolling_token'
          ? `Token = SHA256(shared_secret + "YYYY-MM-DD"). Rotates daily at midnight UTC. Sent in the "${config.auth_header}" header.`
          : `Auth sent in the "${config.auth_header || 'Authorization'}" header using ${config.auth_type} scheme.`,
        rate_limit: `${config.rate_limit_rpm} requests per minute`,
        timeout: `${config.timeout_ms}ms`,
      },

      ...(config.auth_type === 'rolling_token' ? {
        auth_validation: {
          algorithm: 'SHA256(shared_secret + "YYYY-MM-DD")',
          header_name: config.auth_header || 'X-AI-Auth-Token',
          examples: {
            php: [
              `$sharedSecret = getenv("SOFTAWARE_SECRET");`,
              `$expected = hash("sha256", $sharedSecret . gmdate("Y-m-d"));`,
              `$received = $_SERVER["HTTP_${(config.auth_header || 'X-AI-Auth-Token').toUpperCase().replace(/-/g, '_')}"] ?? "";`,
              `if (!hash_equals($expected, $received)) { http_response_code(401); exit; }`,
            ],
            node: [
              `const expected = require("crypto").createHash("sha256").update(secret + new Date().toISOString().split("T")[0]).digest("hex");`,
              `if (expected !== req.headers["${(config.auth_header || 'X-AI-Auth-Token').toLowerCase()}"]) return res.status(401).json({ error: "UNAUTHORIZED" });`,
            ],
            python: [
              `import hashlib, datetime, os`,
              `expected = hashlib.sha256((os.environ["SOFTAWARE_SECRET"] + datetime.datetime.utcnow().strftime("%Y-%m-%d")).encode()).hexdigest()`,
              `if expected != request.headers.get("${config.auth_header || 'X-AI-Auth-Token'}", ""): abort(401)`,
            ],
          },
        },
      } : {}),

      tools: {
        total: tools.length,
        endpoints: tools.map(t => ({
          action: t.name,
          description: t.description,
          url: `POST ${config.target_base_url.replace(/\/+$/, '')}/${t.name}`,
          parameters: t.parameters,
        })),
      },

      management_api: {
        description: 'Self-service endpoints for managing your gateway programmatically.',
        base: `https://api.softaware.net.za/api/v1/client-api/${config.client_id}`,
        authentication: 'Send your shared secret in the X-Client-Secret header.',
        endpoints: {
          get_config: `GET /${config.client_id}/config`,
          update_config: `PATCH /${config.client_id}/config`,
          rotate_secret: `POST /${config.client_id}/secret/rotate`,
          pause_resume: `PATCH /${config.client_id}/status`,
          usage_stats: `GET /${config.client_id}/usage?days=30`,
          request_logs: `GET /${config.client_id}/logs?limit=50&offset=0`,
          health_check: `GET /${config.client_id}/health`,
          billing: `POST /${config.client_id}/billing/checkout`,
        },
      },

      branding: {
        required: branding.required,
        powered_by: branding.powered_by,
        logo_url: branding.logo_url,
        link_url: branding.link_url,
        tier: branding.tier,
        policy: branding.required
          ? 'Free-tier integrations MUST display the "Powered by Soft Aware" badge with a link to https://softaware.net.za in any UI that uses this gateway. The badge is removed automatically when the account upgrades to a paid plan.'
          : 'Branding is optional on paid plans. You may display it if you wish.',
      },

      response_format: {
        success: { status_code: 200, body: { success: true, data: '{ ... }' } },
        error: { status_code: '4xx/5xx', body: { success: false, error: 'ERROR_CODE', message: 'Human-readable' } },
      },
    };

    const filename = `gateway-${config.client_id}-spec.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');

    console.log(`[ClientApiGateway] Export spec served for ${config.client_id}`);

    return res.json(exportData);
  } catch (error) {
    console.error(`[ClientApiGateway] Export error:`, error);
    return res.status(500).json({ success: false, error: 'Failed to export spec' });
  }
});

/**
 * POST /v1/client-api/:clientId/billing/checkout
 *
 * Initiate a Yoco payment checkout session for upgrading or subscribing.
 * Returns a redirect URL — the client opens this in a browser or new tab.
 *
 * Body:
 *   plan_type    — 'starter' | 'pro' | 'advanced' (required)
 *   success_url  — URL to redirect to after successful payment (optional)
 *   cancel_url   — URL to redirect to if user cancels (optional)
 */
router.post('/:clientId/billing/checkout', async (req: Request, res: Response) => {
  try {
    const config = authenticateClient(req, res);
    if (!config) return;

    const { plan_type, success_url, cancel_url } = req.body;

    // Plan prices in ZAR cents — must match config/tiers.ts
    const PLAN_PRICES: Record<string, number> = {
      starter:   34900,   // R349
      pro:       69900,   // R699
      advanced: 149900,   // R1,499
    };

    const PLAN_NAMES: Record<string, string> = {
      starter:  'Starter',
      pro:      'Pro',
      advanced: 'Advanced',
    };

    if (!plan_type || !PLAN_PRICES[plan_type]) {
      return res.status(400).json({
        success: false,
        error: `Invalid plan_type. Valid options: ${Object.keys(PLAN_PRICES).join(', ')}`,
        plans: Object.entries(PLAN_PRICES).map(([key, price]) => ({
          plan: key,
          name: PLAN_NAMES[key],
          price_zar: price / 100,
          price_cents: price,
        })),
      });
    }

    // Resolve the user/contact from the gateway config
    if (!config.contact_id) {
      return res.status(400).json({
        success: false,
        error: 'No contact linked to this gateway. Contact Soft Aware support.',
      });
    }

    // Look up the user associated with this contact
    const { db: mysqlDb } = await import('../db/mysql.js');
    const user = await mysqlDb.queryOne<{ id: string; email: string }>(
      'SELECT id, email FROM users WHERE contact_id = ? LIMIT 1',
      [config.contact_id]
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'No user account linked to this gateway contact. Contact Soft Aware support.',
      });
    }

    const { createCheckout } = await import('../services/yocoCheckout.js');

    const displayName = `SoftAware ${PLAN_NAMES[plan_type]} Plan — Monthly`;

    const result = await createCheckout({
      contactId: config.contact_id,
      userId: user.id,
      packageId: null,
      action: 'SUBSCRIBE',
      billingCycle: 'MONTHLY',
      amount: PLAN_PRICES[plan_type],
      displayName,
      successUrl: success_url,
      cancelUrl: cancel_url,
      targetTier: plan_type,
    });

    console.log(`[ClientApiGateway] Billing checkout created for ${config.client_id}: ${plan_type} → ${result.checkoutId}`);

    return res.json({
      success: true,
      redirect_url: result.redirectUrl,
      checkout_id: result.checkoutId,
      plan: plan_type,
      plan_name: PLAN_NAMES[plan_type],
      amount_zar: PLAN_PRICES[plan_type] / 100,
      message: `Open the redirect_url in a browser to complete payment for the ${PLAN_NAMES[plan_type]} plan (R${PLAN_PRICES[plan_type] / 100}/month).`,
    });
  } catch (error: any) {
    console.error(`[ClientApiGateway] Billing checkout error:`, error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create checkout session',
    });
  }
});

/**
 * GET /v1/client-api/:clientId/billing/plans
 *
 * List available plans and pricing. No authentication required —
 * this is public info useful for building pricing UI.
 */
router.get('/:clientId/billing/plans', async (req: Request, res: Response) => {
  const { TIER_LIMITS } = await import('../config/tiers.js');

  const plans = ['starter', 'pro', 'advanced'].map(tier => {
    const limits = TIER_LIMITS[tier];
    return {
      plan: tier,
      name: limits.name,
      price_zar: limits.priceZAR,
      price_monthly_display: `R${limits.priceZAR}/month`,
      limits: {
        sites: limits.maxSites,
        widgets: limits.maxWidgets,
        actions_per_month: limits.maxActionsPerMonth,
        knowledge_pages: limits.maxKnowledgePages,
        storage_mb: Math.round(limits.maxStorageBytes / 1048576),
        has_vision: limits.hasVision,
        can_remove_watermark: limits.canRemoveWatermark,
      },
    };
  });

  return res.json({
    success: true,
    currency: 'ZAR',
    plans,
    enterprise: {
      plan: 'enterprise',
      name: 'Enterprise',
      price: 'Custom — contact sales',
      contact: 'support@softaware.net.za',
    },
  });
});

export default router;
