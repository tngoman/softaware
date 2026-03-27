/**
 * Admin Client API Gateway Routes
 *
 * CRUD management for client API proxy configurations.
 * All routes require admin authentication.
 *
 * Base path: /api/admin/client-api-configs
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { enforceGatewayLimit } from '../middleware/packageEnforcement.js';
import {
  getAllConfigs,
  getConfigById,
  getConfigByClientId,
  createConfig,
  updateConfig,
  deleteConfig,
  getRequestLogs,
  type ClientApiConfigInput,
} from '../services/clientApiGateway.js';
import { updateEndpoint, getEndpoint } from '../services/enterpriseEndpoints.js';
import { db } from '../db/mysql.js';

export const adminClientApiConfigsRouter = Router();

adminClientApiConfigsRouter.use(requireAuth, requireAdmin);

// ── Validation Schemas ──────────────────────────────────────────────────

const createSchema = z.object({
  client_id: z.string().min(1).regex(/^[a-z0-9_-]+$/i, 'client_id must be alphanumeric with hyphens/underscores'),
  client_name: z.string().min(1),
  contact_id: z.number().int().positive().optional(),
  endpoint_id: z.string().optional(),
  target_base_url: z.string().url(),
  auth_type: z.enum(['rolling_token', 'bearer', 'basic', 'api_key', 'none']).optional(),
  auth_secret: z.string().optional(),
  auth_header: z.string().optional(),
  allowed_actions: z.array(z.string()).optional(),
  rate_limit_rpm: z.number().int().positive().optional(),
  timeout_ms: z.number().int().positive().optional(),
});

const updateSchema = createSchema.partial().omit({ client_id: true });

// ═════════════════════════════════════════════════════════════════════════
// GET /admin/client-api-configs
// List all client API configurations
// ═════════════════════════════════════════════════════════════════════════
adminClientApiConfigsRouter.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const configs = getAllConfigs();
    return res.json({ success: true, data: configs });
  } catch (err) {
    console.error('[AdminClientApiConfigs] List error:', err);
    return res.status(500).json({ success: false, error: 'Failed to list client API configs' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /admin/client-api-configs/export-template
// Download a comprehensive integration specification — a self-documenting
// JSON that tells the client's developer EXACTLY how to build their API
// ═════════════════════════════════════════════════════════════════════════
adminClientApiConfigsRouter.get('/export-template', async (_req: AuthRequest, res: Response) => {
  try {
    const template = {
      _meta: {
        type: 'softaware_gateway_integration_spec',
        version: '2.0.0',
        generated_at: new Date().toISOString(),
        purpose: 'This specification defines how the Soft Aware AI platform will call YOUR API. Use it to build and configure your API endpoints so our gateway can proxy tool calls to your server.',
        workflow: [
          '1. Read this spec to understand the request format, auth, and expected responses.',
          '2. Build your API endpoints (one per tool/action) following the patterns below.',
          '3. Share your base_url and preferred auth_type with Soft Aware staff.',
          '4. We configure the gateway on our side — you never need to import this file.',
          '5. Test with the health check, then go live.',
        ],
      },

      // ── How Soft Aware calls your API ─────────────────────────────────
      request_format: {
        method: 'POST',
        url_pattern: '{your_base_url}/{action_name}',
        content_type: 'application/json',
        description: 'For every AI tool call, Soft Aware sends a POST request to your base URL + the action name. The JSON body contains the tool parameters the AI extracted from the user conversation.',
        example: {
          url: 'https://api.yourcompany.com/ai-gateway/getOrderStatus',
          headers: {
            'Content-Type': 'application/json',
            'X-AI-Auth-Token': '<daily_rolling_token>',
          },
          body: {
            order_id: 'ORD-10042',
          },
        },
        timeout: '30 seconds (configurable). If your API does not respond in time, users get a timeout error.',
      },

      // ── Authentication ────────────────────────────────────────────────
      authentication: {
        description: 'Soft Aware sends an auth header with every request. You MUST validate it on your side. Choose one auth type that suits your infrastructure.',
        supported_types: {

          rolling_token: {
            recommended: true,
            description: 'A daily-rotating SHA-256 token. Both sides compute the same hash from a shared secret + today\'s UTC date. Tokens auto-expire at midnight UTC.',
            algorithm: 'SHA256(shared_secret + "YYYY-MM-DD")',
            header: 'X-AI-Auth-Token',
            how_it_works: [
              '1. We agree on a shared_secret (a long random string, e.g., 64 hex chars).',
              '2. Each day, both sides compute: token = SHA256(shared_secret + "2026-03-22").',
              '3. Soft Aware sends the token in the X-AI-Auth-Token header.',
              '4. Your API computes the same hash and compares. If they match, the request is authentic.',
            ],
            validation_examples: {
              php: [
                '$sharedSecret = "YOUR_SHARED_SECRET_HERE";',
                '$expectedToken = hash("sha256", $sharedSecret . gmdate("Y-m-d"));',
                '$receivedToken = $_SERVER["HTTP_X_AI_AUTH_TOKEN"] ?? "";',
                'if (!hash_equals($expectedToken, $receivedToken)) {',
                '    http_response_code(401);',
                '    echo json_encode(["error" => "Invalid auth token"]);',
                '    exit;',
                '}',
              ],
              node: [
                'const crypto = require("crypto");',
                'const sharedSecret = "YOUR_SHARED_SECRET_HERE";',
                'const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD UTC',
                'const expected = crypto.createHash("sha256").update(sharedSecret + today).digest("hex");',
                'const received = req.headers["x-ai-auth-token"];',
                'if (expected !== received) return res.status(401).json({ error: "Invalid auth token" });',
              ],
              python: [
                'import hashlib, datetime',
                'shared_secret = "YOUR_SHARED_SECRET_HERE"',
                'today = datetime.datetime.utcnow().strftime("%Y-%m-%d")',
                'expected = hashlib.sha256((shared_secret + today).encode()).hexdigest()',
                'received = request.headers.get("X-AI-Auth-Token", "")',
                'if expected != received:',
                '    return jsonify({"error": "Invalid auth token"}), 401',
              ],
            },
          },

          bearer: {
            description: 'A static Bearer token in the Authorization header. Simple but does not rotate.',
            header: 'Authorization: Bearer <your_token>',
            note: 'You provide us a long-lived API key/token. We send it as "Bearer <token>" on every request.',
          },

          api_key: {
            description: 'A static API key in a custom header.',
            header: 'X-API-Key: <your_key> (header name is configurable)',
            note: 'Similar to Bearer but in a custom header. Useful if your API already uses X-API-Key authentication.',
          },

          basic: {
            description: 'HTTP Basic Authentication (Base64-encoded credentials).',
            header: 'Authorization: Basic <base64_encoded>',
            note: 'Provide us a Base64-encoded "username:password" string.',
          },

          none: {
            description: 'No authentication headers sent. Use only if your API is already secured by IP whitelisting or VPN.',
            note: 'Not recommended unless you have network-level security.',
          },
        },
      },

      // ── Response format ───────────────────────────────────────────────
      response_format: {
        description: 'Your API should return JSON. The AI reads the response to formulate answers for the user. Return clear, structured data.',
        success_example: {
          status_code: 200,
          body: {
            success: true,
            data: {
              order_id: 'ORD-10042',
              customer_name: 'Jane Doe',
              email: 'jane@example.com',
              status: 'shipped',
              total: 1250.0,
              tracking_number: 'ZA-9876543210',
              estimated_delivery: '2026-03-25',
            },
          },
        },
        error_example: {
          status_code: 404,
          body: {
            success: false,
            error: 'ORDER_NOT_FOUND',
            message: 'No order found with that ID.',
          },
        },
        tips: [
          'Always return JSON with Content-Type: application/json.',
          'Use meaningful HTTP status codes (200, 400, 404, 500).',
          'Include a human-readable "message" field in errors — the AI uses it to explain to the user.',
          'Return as much relevant context as possible — the AI is smarter with richer data.',
        ],
      },

      // ── Example tools/endpoints to build ──────────────────────────────
      example_tools: {
        description: 'Below are example API actions. Each becomes a POST endpoint on your server. The actual tools will be configured by Soft Aware staff when setting up your gateway.',
        note: 'These are EXAMPLES only. Your actual tool names and parameters will be specific to your business — ecommerce, services, SaaS, etc.',
        endpoints: [
          {
            action: 'lookupCustomer',
            description: 'Look up a customer by email address or name.',
            your_endpoint: 'POST {base_url}/lookupCustomer',
            soft_aware_sends: {
              email: { type: 'string', required: true, description: 'Customer email address' },
              customer_name: { type: 'string', required: false, description: 'Optional name for fuzzy search' },
            },
            you_return: {
              success: true,
              data: {
                customer_id: 'CUST-0012345',
                customer_name: 'Jane Doe',
                email: 'jane@example.com',
                phone: '0821234567',
                account_status: 'active',
                total_orders: 12,
                created_at: '2025-08-15',
              },
            },
          },
          {
            action: 'getOrderStatus',
            description: 'Check the current status and tracking for an order.',
            your_endpoint: 'POST {base_url}/getOrderStatus',
            soft_aware_sends: {
              order_id: { type: 'string', required: true, description: 'Order reference number' },
              email: { type: 'string', required: false, description: 'Customer email for verification' },
            },
            you_return: {
              success: true,
              data: {
                order_id: 'ORD-10042',
                status: 'shipped',
                items: 3,
                total: 1250.00,
                tracking_number: 'ZA-9876543210',
                estimated_delivery: '2026-03-25',
              },
            },
          },
          {
            action: 'createTicket',
            description: 'Log a support ticket on behalf of the customer.',
            your_endpoint: 'POST {base_url}/createTicket',
            soft_aware_sends: {
              email: { type: 'string', required: true, description: 'Customer email address' },
              category: { type: 'string', required: true, description: 'e.g., "billing", "delivery", "product", "general"' },
              description: { type: 'string', required: true, description: 'Detailed issue description from the user' },
              priority: { type: 'string', required: false, description: '"low", "medium", "high" (default: "medium")' },
            },
            you_return: {
              success: true,
              data: {
                ticket_id: 'TKT-2026-00456',
                status: 'open',
                message: 'Support ticket created. Reference: TKT-2026-00456.',
              },
            },
          },
          {
            action: 'updateCustomer',
            description: 'Update a customer record (e.g., contact details).',
            your_endpoint: 'POST {base_url}/updateCustomer',
            soft_aware_sends: {
              email: { type: 'string', required: true, description: 'Customer email (identifies the record)' },
              field: { type: 'string', required: true, description: 'Field name to update (e.g., "phone", "address", "name")' },
              value: { type: 'string', required: true, description: 'New value' },
            },
            you_return: {
              success: true,
              data: {
                customer_id: 'CUST-0012345',
                field: 'phone',
                old_value: '0821234567',
                new_value: '0839876543',
                updated_at: '2026-03-22T10:30:00Z',
              },
            },
          },
        ],
      },

      // ── Trial vs Paid — what you need to know ─────────────────────────
      trial_and_paid: {
        description: 'During a trial, the client has Free tier resource limits (1 site, 1 widget, 500 actions/month, etc.) but ALL tools function normally with full action capability. There are no read-only restrictions on tools.',
        trial_limits: 'Resource caps only: 1 site, 1 widget, 500 actions/month, 50 knowledge pages, 5 MB storage.',
        full_package: 'Upgrade unlocks full resource limits for the package tier.',
        vision_restriction: 'Image/file analysis (vision) is NOT available on Free, Starter, or Pro packages. Vision requires Advanced or Enterprise. Files sent to non-vision endpoints are ignored.',
        note: 'You do not need to enforce trial logic on your side. Just build all endpoints — Soft Aware handles resource caps and vision gating.',
      },

      // ── Kill Switch ───────────────────────────────────────────────────
      kill_switch: {
        description: 'You can instantly block all Soft Aware API access at any time.',
        options: [
          'Remote: Toggle from your Soft Aware Portal dashboard — stops our gateway from calling your API.',
          'Local: Implement a server-side flag. If the flag is set, reject all requests from Soft Aware with HTTP 503.',
        ],
        local_implementation_example: [
          '// In your API middleware, check a kill switch flag:',
          'if (getKillSwitchStatus() === "active") {',
          '    return res.status(503).json({ error: "SERVICE_SUSPENDED", message: "AI gateway disabled by admin" });',
          '}',
        ],
        ip_whitelisting: 'For additional security, restrict your AI endpoints to only accept requests from Soft Aware\'s server IP. Contact support for the current IP address.',
      },

      // ── Client Management API ────────────────────────────────────
      client_endpoints: {
        description: 'Self-service API endpoints for managing your gateway, viewing usage, rotating secrets, and more. All endpoints are authenticated via the X-Client-Secret header using your shared secret (or today\'s rolling token).',
        base_url: 'https://api.softaware.net.za/api/v1/client-api/{your_client_id}',
        authentication: {
          header: 'X-Client-Secret: <your_shared_secret_or_rolling_token>',
          alternatives: [
            'Authorization: Bearer <your_shared_secret_or_rolling_token>',
            'Query param: ?secret=<your_shared_secret_or_rolling_token>',
          ],
          note: 'The rolling token from yesterday is also accepted (grace window for timezone edge cases).',
        },
        endpoints: {
          health_check: {
            method: 'GET',
            path: '/{your_client_id}/health',
            description: 'Quick health check — verifies the gateway config exists and is active. No auth required.',
            response: '{ status, clientId, clientName, targetUrl, authType, totalRequests, lastRequestAt }',
          },
          get_config: {
            method: 'GET',
            path: '/{your_client_id}/config',
            description: 'View your full gateway configuration: connection settings, auth type, rate limits, tools, and branding status.',
            response: '{ success, data: { client_id, status, target_base_url, auth_type, auth_header, rate_limit_rpm, timeout_ms, tools, branding } }',
          },
          update_config: {
            method: 'PATCH',
            path: '/{your_client_id}/config',
            description: 'Update your connection settings. You can change: target_base_url, auth_header, auth_type.',
            body: '{ target_base_url?: string, auth_header?: string, auth_type?: "rolling_token" | "bearer" | "basic" | "api_key" | "none" }',
            response: '{ success, message, updated: string[] }',
          },
          rotate_secret: {
            method: 'POST',
            path: '/{your_client_id}/secret/rotate',
            description: 'Rotate the shared secret. Returns the new secret — store it securely, it will not be shown again. Optionally pass { custom_secret: "..." } to set your own (min 32 chars).',
            response: '{ success, secret, length, auth_type, note }',
          },
          usage_stats: {
            method: 'GET',
            path: '/{your_client_id}/usage?days=30&recent=25',
            description: 'Usage statistics: request counts, error rates, daily breakdown, per-tool breakdown, and recent request log entries.',
            query_params: {
              days: 'Number of days to look back (default 30, max 90)',
              recent: 'Max recent requests to return (default 25, max 100)',
            },
            response: '{ success, total_requests, period_total, period_success, period_errors, avg_response_ms, daily_breakdown[], action_breakdown[], recent_requests[] }',
          },
          request_logs: {
            method: 'GET',
            path: '/{your_client_id}/logs?limit=50&offset=0',
            description: 'Paginated request logs — same data as the Logs tab in the portal.',
            query_params: {
              limit: 'Max rows per page (default 50, max 200)',
              offset: 'Pagination offset (default 0)',
            },
            response: '{ success, total, limit, offset, has_more, logs[] }',
          },
          export_spec: {
            method: 'GET',
            path: '/{your_client_id}/export',
            description: 'Download your integration spec as JSON — includes connection details, tool definitions, auth examples, and management API docs.',
          },
          billing_plans: {
            method: 'GET',
            path: '/{your_client_id}/billing/plans',
            description: 'List available subscription plans and pricing. No auth required.',
          },
          billing_checkout: {
            method: 'POST',
            path: '/{your_client_id}/billing/checkout',
            description: 'Initiate a payment checkout session to upgrade your plan.',
            body: '{ plan_type: "starter" | "pro" | "advanced", success_url?: string, cancel_url?: string }',
            response: '{ success, redirect_url, checkout_id, plan, amount_zar }',
          },
        },
        examples: {
          curl_usage: 'curl -H "X-Client-Secret: YOUR_SECRET" "https://api.softaware.net.za/api/v1/client-api/your-client-id/usage?days=7"',
          curl_health: 'curl "https://api.softaware.net.za/api/v1/client-api/your-client-id/health"',
          curl_config: 'curl -H "X-Client-Secret: YOUR_SECRET" "https://api.softaware.net.za/api/v1/client-api/your-client-id/config"',
          curl_rotate: 'curl -X POST -H "X-Client-Secret: YOUR_SECRET" -H "Content-Type: application/json" "https://api.softaware.net.za/api/v1/client-api/your-client-id/secret/rotate"',
          node: [
            'const BASE = "https://api.softaware.net.za/api/v1/client-api/your-client-id";',
            'const headers = { "X-Client-Secret": sharedSecret };',
            '',
            '// Usage stats',
            'const usage = await fetch(`${BASE}/usage?days=7`, { headers }).then(r => r.json());',
            '',
            '// View config',
            'const config = await fetch(`${BASE}/config`, { headers }).then(r => r.json());',
            '',
            '// Rotate secret',
            'const rotated = await fetch(`${BASE}/secret/rotate`, { method: "POST", headers }).then(r => r.json());',
          ],
          php: [
            '$base = "https://api.softaware.net.za/api/v1/client-api/your-client-id";',
            '$headers = ["X-Client-Secret: " . $sharedSecret];',
            '',
            '// Usage stats',
            '$ch = curl_init("$base/usage?days=7");',
            'curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);',
            'curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);',
            '$stats = json_decode(curl_exec($ch), true);',
          ],
        },
      },

      // ── Your configuration (fill these in) ────────────────────────────
      your_config: {
        _instructions: 'Fill in these values and share with your Soft Aware account manager. Do NOT send the shared_secret over email — use the Soft Aware Portal secure messaging.',
        base_url: 'https://your-server.com/api/ai-gateway',
        auth_type: 'rolling_token',
        shared_secret: '<GENERATE_A_LONG_RANDOM_STRING_AND_SHARE_SECURELY>',
        auth_header: 'X-AI-Auth-Token',
        available_actions: [
          'List every action/tool name your API supports, e.g.:',
          'lookupCustomer',
          'getOrderStatus',
          'createTicket',
          'updateCustomer',
        ],
      },
    };

    res.setHeader('Content-Disposition', 'attachment; filename="softaware-gateway-integration-spec.json"');
    res.setHeader('Content-Type', 'application/json');
    return res.json(template);
  } catch (err) {
    console.error('[AdminClientApiConfigs] Export template error:', err);
    return res.status(500).json({ success: false, error: 'Failed to generate template' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// POST /admin/client-api-configs/import
// Import a gateway config from a populated template JSON
// Requires contact_id in the body (must be associated with a client account)
// ═════════════════════════════════════════════════════════════════════════

const importSchema = z.object({
  contact_id: z.number().int().positive('A client account (contact) is required'),
  endpoint_id: z.string().min(1).optional(),
  selected_tools: z.array(z.string()).default([]),
  connection_overrides: z.object({
    target_base_url: z.string().url().optional(),
    auth_type: z.enum(['rolling_token', 'bearer', 'basic', 'api_key', 'none']).optional(),
    auth_secret: z.string().optional(),
    auth_header: z.string().optional(),
  }).optional(),
  /** 'merge' adds new tools to existing (default); 'replace' overwrites the tool list */
  mode: z.enum(['merge', 'replace']).default('merge'),
});

adminClientApiConfigsRouter.post('/import', enforceGatewayLimit, async (req: AuthRequest, res: Response) => {
  try {
    const data = importSchema.parse(req.body);

    // ── Step 1: Resolve contact → derive client_id / client_name ──
    const contact = await db.queryOne<{ id: number; company_name: string }>(
      'SELECT id, company_name FROM contacts WHERE id = ?',
      [data.contact_id],
    );
    if (!contact) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    const clientSlug = contact.company_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || `client-${contact.id}`;

    // ── Step 2: Resolve endpoint → get available tools (optional) ──
    let endpoint: ReturnType<typeof getEndpoint> | null = null;
    let endpointTools: string[] = [];
    let validTools: string[] = [];

    if (data.endpoint_id) {
      endpoint = getEndpoint(data.endpoint_id) ?? null;
      if (!endpoint) {
        return res.status(404).json({ success: false, error: 'Enterprise endpoint not found' });
      }

      // Parse tools from the endpoint (for reference / response metadata only)
      if (endpoint.llm_tools_config) {
        try {
          const rawTools = JSON.parse(endpoint.llm_tools_config);
          endpointTools = rawTools.map((t: any) => t.function?.name).filter(Boolean);
        } catch { /* invalid tools config */ }
      }

      // Trust the admin's explicit selection — don't filter by endpoint.
      // New tools from a spec file may not be in the endpoint's llm_tools_config yet.
      // If no tools were explicitly selected, default to all endpoint tools.
      validTools = data.selected_tools.length > 0 ? data.selected_tools : endpointTools;
    } else if (data.selected_tools.length > 0) {
      // No endpoint linked — trust the selected tools directly (e.g. from an imported spec file).
      validTools = data.selected_tools;
    }

    // ── Step 3: Check for existing gateway — merge/replace instead of erroring ──
    const existingByContact = getAllConfigs().find(c => c.contact_id === data.contact_id);
    const existingBySlug = getConfigByClientId(clientSlug);
    const existing = existingByContact || existingBySlug;

    if (existing) {
      const currentTools: string[] = existing.allowed_actions
        ? (() => { try { return JSON.parse(existing.allowed_actions); } catch { return []; } })()
        : [];

      const mergedTools = data.mode === 'replace'
        ? validTools
        : [...new Set([...currentTools, ...validTools])];

      const updatePayload: Partial<typeof existing> = { allowed_actions: mergedTools as any };
      const conn2 = data.connection_overrides || {};
      if (conn2.target_base_url) updatePayload.target_base_url = conn2.target_base_url;
      if (conn2.auth_type) updatePayload.auth_type = conn2.auth_type;
      if (conn2.auth_secret) updatePayload.auth_secret = conn2.auth_secret;
      if (conn2.auth_header) updatePayload.auth_header = conn2.auth_header;
      if (data.endpoint_id) updatePayload.endpoint_id = data.endpoint_id;

      updateConfig(existing.id, updatePayload);
      const updated = getConfigById(existing.id);

      console.log(`[AdminClientApiConfigs] ${data.mode === 'replace' ? 'Replaced' : 'Merged'} tools on gateway ${existing.id} for ${existing.client_id} | tools=${mergedTools.length} (by admin ${(req as any).userId})`);

      return res.json({
        success: true,
        data: updated,
        mode: data.mode,
        tools_selected: mergedTools,
        message: `Gateway "${existing.client_name}" updated (${data.mode}). ${mergedTools.length} tool${mergedTools.length !== 1 ? 's' : ''} now enabled.`,
      });
    }

    // ── Step 4: All selected tools get full action capability ──
    // Tool restrictions are NOT tier-gated. External developers define whatever
    // tools they need. The only limits are:
    //   - Free tier resource caps during trial (sites, widgets, actions/month)
    //   - No vision/file processing unless Advanced+ package
    // The allowed_actions field stores which tools are enabled on this gateway.
    const allowedActions = validTools;

    // ── Step 4: Auto-generate auth credentials if not overridden ──
    const conn = data.connection_overrides || {};
    const authSecret = conn.auth_secret || crypto.randomBytes(32).toString('hex');
    const baseUrl = conn.target_base_url || `https://api.softaware.net.za/api/v1/client-api/${clientSlug}`;

    // ── Step 5: Create the gateway config ──
    const config = createConfig({
      client_id: clientSlug,
      client_name: contact.company_name,
      contact_id: data.contact_id,
      endpoint_id: data.endpoint_id || null,
      target_base_url: baseUrl,
      auth_type: conn.auth_type || 'rolling_token',
      auth_secret: authSecret,
      auth_header: conn.auth_header || 'X-AI-Auth-Token',
      allowed_actions: allowedActions,
      rate_limit_rpm: 60,
      timeout_ms: 30000,
    });

    console.log(`[AdminClientApiConfigs] Imported gateway ${config.id} for ${clientSlug} | tools=${validTools.length} (by admin ${(req as any).userId})`);

    return res.status(201).json({
      success: true,
      data: config,
      tools_available: endpointTools,
      tools_selected: validTools,
      allowed_actions: allowedActions,
      message: `Gateway "${contact.company_name}" created.${validTools.length > 0 ? ` ${validTools.length} tool(s) enabled with full action capability.` : ''}${!data.endpoint_id ? ' No endpoint linked — you can connect one later.' : ''}`,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: err.errors });
    }
    console.error('[AdminClientApiConfigs] Import error:', err);
    return res.status(500).json({ success: false, error: 'Failed to import gateway config' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /admin/client-api-configs/endpoint-tools/:endpointId
// List tools available on an enterprise endpoint (for the tool picker)
// ═════════════════════════════════════════════════════════════════════════
adminClientApiConfigsRouter.get('/endpoint-tools/:endpointId', async (req: AuthRequest, res: Response) => {
  try {
    const ep = getEndpoint(req.params.endpointId);
    if (!ep) {
      return res.status(404).json({ success: false, error: 'Endpoint not found' });
    }

    let tools: Array<{ name: string; description: string; paramCount: number }> = [];
    if (ep.llm_tools_config) {
      try {
        const raw = JSON.parse(ep.llm_tools_config);
        tools = raw.map((t: any) => ({
          name: t.function?.name || '',
          description: t.function?.description || '',
          paramCount: Object.keys(t.function?.parameters?.properties || {}).length,
        })).filter((t: any) => t.name);
      } catch { /* invalid tools config */ }
    }

    return res.json({
      success: true,
      endpoint_id: ep.id,
      endpoint_name: ep.client_name,
      tools,
    });
  } catch (err) {
    console.error('[AdminClientApiConfigs] Endpoint tools error:', err);
    return res.status(500).json({ success: false, error: 'Failed to list endpoint tools' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /admin/client-api-configs/:id
// Get a single client API config by ID
// ═════════════════════════════════════════════════════════════════════════
adminClientApiConfigsRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const config = getConfigById(req.params.id) || getConfigByClientId(req.params.id);
    if (!config) {
      return res.status(404).json({ success: false, error: 'Config not found' });
    }
    return res.json({ success: true, data: config });
  } catch (err) {
    console.error('[AdminClientApiConfigs] Get error:', err);
    return res.status(500).json({ success: false, error: 'Failed to get client API config' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// POST /admin/client-api-configs
// Create a new client API config
// ═════════════════════════════════════════════════════════════════════════
adminClientApiConfigsRouter.post('/', enforceGatewayLimit, async (req: AuthRequest, res: Response) => {
  try {
    const data = createSchema.parse(req.body);

    // Check for duplicate client_id
    const existing = getConfigByClientId(data.client_id);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: `Client API config already exists for client_id: ${data.client_id}`,
      });
    }

    const config = createConfig(data as ClientApiConfigInput);

    console.log(`[AdminClientApiConfigs] Created config ${config.id} for ${config.client_id} (by admin ${(req as any).userId})`);

    return res.status(201).json({ success: true, data: config });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: err.errors });
    }
    console.error('[AdminClientApiConfigs] Create error:', err);
    return res.status(500).json({ success: false, error: 'Failed to create client API config' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// PUT /admin/client-api-configs/:id
// Update an existing client API config
// ═════════════════════════════════════════════════════════════════════════
adminClientApiConfigsRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const data = updateSchema.parse(req.body);

    const existing = getConfigById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Config not found' });
    }

    const updated = updateConfig(req.params.id, data as any);
    if (!updated) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    const config = getConfigById(req.params.id);

    console.log(`[AdminClientApiConfigs] Updated config ${req.params.id} (by admin ${(req as any).userId})`);

    return res.json({ success: true, data: config });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: err.errors });
    }
    console.error('[AdminClientApiConfigs] Update error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update client API config' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// PATCH /admin/client-api-configs/:id/status
// Update config status
// ═════════════════════════════════════════════════════════════════════════
adminClientApiConfigsRouter.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const { status } = z.object({ status: z.enum(['active', 'paused', 'disabled']) }).parse(req.body);

    const existing = getConfigById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Config not found' });
    }

    updateConfig(req.params.id, { status } as any);

    console.log(`[AdminClientApiConfigs] Status ${req.params.id} → ${status} (by admin ${(req as any).userId})`);

    return res.json({ success: true, message: `Status updated to ${status}` });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid status', details: err.errors });
    }
    console.error('[AdminClientApiConfigs] Status update error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update status' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// DELETE /admin/client-api-configs/:id
// Delete a client API config
// ═════════════════════════════════════════════════════════════════════════
adminClientApiConfigsRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = getConfigById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Config not found' });
    }

    deleteConfig(req.params.id);

    console.log(`[AdminClientApiConfigs] Deleted config ${req.params.id} (${existing.client_id}) (by admin ${(req as any).userId})`);

    return res.json({ success: true, message: 'Config deleted' });
  } catch (err) {
    console.error('[AdminClientApiConfigs] Delete error:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete client API config' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /admin/client-api-configs/:id/logs
// Get request logs for a client API config
// ═════════════════════════════════════════════════════════════════════════
adminClientApiConfigsRouter.get('/:id/logs', async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    const existing = getConfigById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Config not found' });
    }

    const logs = getRequestLogs(req.params.id, limit, offset);

    return res.json({ success: true, data: logs });
  } catch (err) {
    console.error('[AdminClientApiConfigs] Logs error:', err);
    return res.status(500).json({ success: false, error: 'Failed to get logs' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /admin/client-api-configs/:id/export
// Export an existing gateway config as a client-specific integration spec
// Includes real tool definitions, auth details, and developer guide
// ═════════════════════════════════════════════════════════════════════════
adminClientApiConfigsRouter.get('/:id/export', async (req: AuthRequest, res: Response) => {
  try {
    const config = getConfigById(req.params.id);
    if (!config) {
      return res.status(404).json({ success: false, error: 'Config not found' });
    }

    // Resolve tools from the linked enterprise endpoint
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
            parameters: Object.entries(t.function?.parameters?.properties || {}).map(([key, val]: [string, any]) => ({
              name: key,
              type: val.type || 'string',
              description: val.description || '',
              required: (t.function?.parameters?.required || []).includes(key),
              ...(val.enum ? { enum: val.enum } : {}),
            })),
          }));
        }
      } catch { /* endpoint may not exist */ }
    }

    const exportData = {
      _meta: {
        type: 'softaware_gateway_client_spec',
        version: '2.0.0',
        exported_at: new Date().toISOString(),
        source_config_id: config.id,
        client_id: config.client_id,
        client_name: config.client_name,
        purpose: `Integration specification for ${config.client_name}. This document defines every tool Soft Aware AI will call on your API, including parameters, expected responses, and auth configuration.`,
      },

      // ── Connection details ──────────────────────────────────────────
      connection: {
        description: 'How Soft Aware connects to your API.',
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

      // ── Rolling token validation (if applicable) ────────────────────
      ...(config.auth_type === 'rolling_token' ? {
        auth_validation: {
          description: 'Validate the daily rolling token on your server. Both sides compute the same SHA-256 hash.',
          algorithm: 'SHA256(shared_secret + "YYYY-MM-DD")',
          header_name: config.auth_header || 'X-AI-Auth-Token',
          examples: {
            php: [
              `$sharedSecret = getenv("SOFTAWARE_SECRET"); // your shared secret`,
              `$expected = hash("sha256", $sharedSecret . gmdate("Y-m-d"));`,
              `$received = $_SERVER["HTTP_${(config.auth_header || 'X-AI-Auth-Token').toUpperCase().replace(/-/g, '_')}"] ?? "";`,
              `if (!hash_equals($expected, $received)) {`,
              `    http_response_code(401);`,
              `    echo json_encode(["success" => false, "error" => "UNAUTHORIZED"]);`,
              `    exit;`,
              `}`,
            ],
            node: [
              `const crypto = require("crypto");`,
              `const secret = process.env.SOFTAWARE_SECRET;`,
              `const today = new Date().toISOString().split("T")[0];`,
              `const expected = crypto.createHash("sha256").update(secret + today).digest("hex");`,
              `const received = req.headers["${(config.auth_header || 'X-AI-Auth-Token').toLowerCase()}"];`,
              `if (expected !== received) return res.status(401).json({ success: false, error: "UNAUTHORIZED" });`,
            ],
            python: [
              `import hashlib, datetime, os`,
              `secret = os.environ["SOFTAWARE_SECRET"]`,
              `today = datetime.datetime.utcnow().strftime("%Y-%m-%d")`,
              `expected = hashlib.sha256((secret + today).encode()).hexdigest()`,
              `received = request.headers.get("${config.auth_header || 'X-AI-Auth-Token'}", "")`,
              `if expected != received:`,
              `    return jsonify({"success": False, "error": "UNAUTHORIZED"}), 401`,
            ],
          },
        },
      } : {}),

      // ── Tool / endpoint definitions ─────────────────────────────────
      tools: {
        description: 'Each tool below is an API endpoint you must implement. Soft Aware sends POST {base_url}/{action_name} with the listed parameters as a JSON body.',
        total: tools.length,
        note: 'All tools have full action capability regardless of package tier. The only hard restriction is that vision/file processing requires the Advanced package or higher.',
        endpoints: tools.map(t => ({
          action: t.name,
          description: t.description,
          url: `POST ${config.target_base_url.replace(/\/+$/, '')}/${t.name}`,
          parameters: t.parameters.map((p: any) => ({
            name: p.name,
            type: p.type,
            required: p.required,
            description: p.description,
            ...(p.enum ? { allowed_values: p.enum } : {}),
          })),
          expected_response: {
            success: true,
            data: '{ ... your response data here ... }',
          },
        })),
      },

      // ── Kill switch reminder ────────────────────────────────────────
      kill_switch: {
        description: 'You can instantly sever Soft Aware API access at any time.',
        remote: 'Toggle from your Soft Aware Portal dashboard.',
        local: 'Reject requests from our IP with HTTP 503 using a server-side flag.',
      },

      // ── your_config — fill in new tools here and re-import to add them ─
      your_config: {
        _instructions: 'Add new tool names to available_actions and re-import this file via the admin panel to update the gateway. Merge mode adds new tools; Replace mode overwrites the list.',
        base_url: config.target_base_url,
        auth_type: config.auth_type,
        shared_secret: '<SHARE_SECURELY — do not put in version control>',
        auth_header: config.auth_header,
        available_actions: (() => {
          try { return JSON.parse(config.allowed_actions || '[]'); } catch { return []; }
        })(),
      },

      // ── Client Usage Stats API ────────────────────────────────────────
      usage_stats: {
        description: 'Query your gateway usage statistics from your own application. Build a client-side dashboard with request counts, error rates, and call history.',
        endpoint: `GET https://api.softaware.net.za/api/v1/client-api/${config.client_id}/usage`,
        authentication: `Send your shared secret in the X-Client-Secret header (or use today's rolling token).`,
        query_params: {
          days: 'Number of days to look back (default 30, max 90)',
          recent: 'Max recent log entries to return (default 25, max 100)',
        },
        example_curl: `curl -H "X-Client-Secret: YOUR_SHARED_SECRET" "https://api.softaware.net.za/api/v1/client-api/${config.client_id}/usage?days=7"`,
        returns: 'total_requests, period stats, daily_breakdown[], action_breakdown[], recent_requests[]',
      },

      // ── Response format guide ───────────────────────────────────────
      response_format: {
        description: 'All your endpoints should return JSON. The AI reads the response to formulate answers.',
        success: { status_code: 200, body: { success: true, data: '{ ... }' } },
        error: { status_code: '4xx/5xx', body: { success: false, error: 'ERROR_CODE', message: 'Human-readable explanation' } },
        tips: [
          'Always return Content-Type: application/json.',
          'Use meaningful HTTP status codes (200, 400, 404, 500).',
          'Include a human-readable "message" field — the AI uses it to explain errors to users.',
          'Return rich context — the AI is smarter with more data.',
        ],
      },
    };

    const filename = `gateway-${config.client_id}-spec.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    return res.json(exportData);
  } catch (err) {
    console.error('[AdminClientApiConfigs] Export error:', err);
    return res.status(500).json({ success: false, error: 'Failed to export config' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// POST /admin/client-api-configs/:id/sync-tools
// Sync tool definitions to the linked enterprise endpoint's llm_tools_config
// ═════════════════════════════════════════════════════════════════════════
adminClientApiConfigsRouter.post('/:id/sync-tools', async (req: AuthRequest, res: Response) => {
  try {
    const { tools } = z.object({
      tools: z.array(z.object({
        type: z.string(),
        function: z.object({
          name: z.string(),
          description: z.string().optional(),
          parameters: z.any().optional(),
        }),
      })),
    }).parse(req.body);

    const config = getConfigById(req.params.id);
    if (!config) {
      return res.status(404).json({ success: false, error: 'Config not found' });
    }

    if (!config.endpoint_id) {
      return res.status(400).json({
        success: false,
        error: 'NO_LINKED_ENDPOINT',
        message: 'This client API config is not linked to an enterprise endpoint. Link one first.',
      });
    }

    // Update the enterprise endpoint's llm_tools_config
    const toolsJson = JSON.stringify(tools);
    const updated = updateEndpoint(config.endpoint_id, { llm_tools_config: toolsJson } as any);

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'ENDPOINT_NOT_FOUND',
        message: `Linked enterprise endpoint ${config.endpoint_id} not found.`,
      });
    }

    console.log(`[AdminClientApiConfigs] Synced ${tools.length} tools to endpoint ${config.endpoint_id} (config ${req.params.id}, by admin ${(req as any).userId})`);

    return res.json({
      success: true,
      message: `${tools.length} tool(s) synced to enterprise endpoint ${config.endpoint_id}`,
      endpoint_id: config.endpoint_id,
      tool_count: tools.length,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid tools format', details: err.errors });
    }
    console.error('[AdminClientApiConfigs] Sync tools error:', err);
    return res.status(500).json({ success: false, error: 'Failed to sync tools' });
  }
});
