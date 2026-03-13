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
import {
  getConfigByClientId,
  buildAuthHeaders,
  recordRequest,
  type ClientApiConfig,
} from '../services/clientApiGateway.js';

const router = Router();

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

    // 3. Validate action against allowed list
    if (config.allowed_actions) {
      let allowedActions: string[];
      try {
        allowedActions = JSON.parse(config.allowed_actions);
      } catch {
        allowedActions = [];
      }

      if (allowedActions.length > 0 && !allowedActions.includes(action)) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_ACTION',
          message: `Action '${action}' is not allowed for client ${clientId}. Allowed: ${allowedActions.join(', ')}`,
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

    // 8. Return the target's response verbatim
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
 * GET /v1/client-api/:clientId/health
 *
 * Quick health check — verifies the config exists and is active.
 * Does NOT call the target API.
 */
router.get('/:clientId/health', (req: Request, res: Response) => {
  const { clientId } = req.params;
  const config = getConfigByClientId(clientId);

  if (!config) {
    return res.status(404).json({ status: 'not_found', clientId });
  }

  return res.json({
    status: config.status,
    clientId: config.client_id,
    clientName: config.client_name,
    targetUrl: config.target_base_url,
    authType: config.auth_type,
    totalRequests: config.total_requests,
    lastRequestAt: config.last_request_at,
  });
});

export default router;
