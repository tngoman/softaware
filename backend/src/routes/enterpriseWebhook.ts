/**
 * Universal Enterprise Webhook Route
 *
 * Single dynamic endpoint that handles ALL enterprise clients.
 * Behavior is entirely database-driven — no client-specific code.
 *
 * URL: POST /api/v1/webhook/:endpointId
 *
 * This replaces hardcoded routes like /silulumanzi with database-configured endpoints.
 */

import express from 'express';
import { getEndpoint, logRequest } from '../services/enterpriseEndpoints.js';
import { normalizeInboundPayload, formatOutboundPayload } from '../services/payloadNormalizer.js';
import axios from 'axios';
import { env } from '../config/env.js';
import { getSecret } from '../services/credentialVault.js';

const router = express.Router();

/**
 * Universal Webhook Handler
 *
 * All enterprise clients use this single route with their unique endpoint ID.
 * The database configuration determines:
 *   - What LLM to use
 *   - What tools are available
 *   - Where to forward actions
 *   - How to format responses
 */
router.post('/:endpointId', async (req, res) => {
  const { endpointId } = req.params;
  const incomingPayload = req.body;
  const startTime = Date.now();

  try {
    // 1. Fetch the configuration for this endpoint
    console.log(`[Webhook] Processing request for endpoint: ${endpointId}`);
    const config = getEndpoint(endpointId);

    if (!config) {
      console.log(`[Webhook] Endpoint not found: ${endpointId}`);
      return res.status(404).json({
        error: 'Endpoint not found',
        message: `No enterprise endpoint configured with ID: ${endpointId}`
      });
    }

    // 2. Check endpoint status (kill switch)
    if (config.status === 'disabled') {
      return res.status(403).json({
        error: 'Endpoint disabled',
        message: 'This endpoint has been disabled by the administrator'
      });
    }

    if (config.status === 'paused') {
      return res.status(503).json({
        error: 'Endpoint paused',
        message: 'This endpoint is temporarily paused. Please try again later.'
      });
    }

    // 3. Normalize the inbound payload (extract message from WhatsApp/Slack/etc.)
    const normalized = normalizeInboundPayload(config.inbound_provider, incomingPayload);

    if (!normalized.text || normalized.text.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid payload',
        message: 'No message text found in the request'
      });
    }

    // 4. Build conversation messages for the LLM
    const conversationHistory = incomingPayload.history || normalized.metadata?.history || [];
    const messages = [
      { role: 'system', content: config.llm_system_prompt },
      ...conversationHistory.slice(-10),  // Keep last 10 messages for context
      { role: 'user', content: normalized.text }
    ];

    // 5. Call the configured LLM
    console.log(`[Webhook] Calling ${config.llm_provider} with ${messages.length} messages`);
    let aiResponse: string;
    let requiresAction = false;
    let actionData: any = null;

    if (config.llm_provider === 'ollama') {
      console.log(`[Webhook] Ollama model: ${config.llm_model}`);
      aiResponse = await callOllama(config, messages);
      console.log(`[Webhook] Ollama response received: ${aiResponse.substring(0, 100)}...`);
    } else if (config.llm_provider === 'openrouter') {
      const result = await callOpenRouter(config, messages);
      aiResponse = result.text;
      requiresAction = result.requiresAction;
      actionData = result.actionData;
    } else {
      throw new Error(`Unsupported LLM provider: ${config.llm_provider}`);
    }

    // 6. If the AI decided to take an action, forward it to the target API
    if (requiresAction && config.target_api_url && actionData) {
      try {
        await forwardAction(config, actionData, normalized);
      } catch (actionError) {
        console.error(`[Webhook ${endpointId}] Action forwarding failed:`, actionError);
        // Non-fatal — we still return the AI response
      }
    }

    // 7. Format the response for the inbound provider
    const formatted = formatOutboundPayload(
      config.inbound_provider,
      aiResponse,
      'reply',
      {
        phone_number: normalized.sender_id,
        language: detectLanguage(aiResponse)
      }
    );

    // 8. Log the request
    const duration = Date.now() - startTime;
    logRequest(endpointId, incomingPayload, formatted.body, duration, 'success');

    // 9. Send the response
    res.setHeader('Content-Type', formatted.contentType);
    return res.status(200).send(formatted.body);

  } catch (error) {
    console.error(`[Webhook ${endpointId}] Error:`, error);

    const duration = Date.now() - startTime;
    logRequest(
      endpointId,
      incomingPayload,
      null,
      duration,
      'error',
      error instanceof Error ? error.message : String(error)
    );

    if (res.headersSent) {
      return;
    }

    return res.status(500).json({
      error: 'Processing error',
      message: 'An error occurred while processing your request'
    });
  }
});

// ---------------------------------------------------------------------------
// LLM Providers
// ---------------------------------------------------------------------------

/**
 * Call Ollama for LLM inference
 */
async function callOllama(
  config: any,
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  console.log(`[callOllama] Sending ${messages.length} messages, system prompt length: ${messages[0]?.content?.length || 0}`);
  const response = await axios.post(
    `${env.OLLAMA_BASE_URL}/api/chat`,
    {
      model: config.llm_model,
      messages,
      stream: false,
      options: {
        temperature: config.llm_temperature || 0.3,
        num_predict: config.llm_max_tokens || 1024
      }
    },
    { timeout: 60000 }
  );

  return response.data.message?.content || '';
}

/**
 * Call OpenRouter for LLM inference (with tool calling support)
 */
async function callOpenRouter(
  config: any,
  messages: Array<{ role: string; content: string }>
): Promise<{ text: string; requiresAction: boolean; actionData: any }> {
  const tools = config.llm_tools_config ? JSON.parse(config.llm_tools_config) : [];

  const response = await axios.post(
    `${env.OPENROUTER_BASE_URL}/chat/completions`,
    {
      model: config.llm_model,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      temperature: config.llm_temperature || 0.3,
      max_tokens: config.llm_max_tokens || 1024
    },
    {
      headers: {
        'Authorization': `Bearer ${await getSecret('OPENROUTER')}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    }
  );

  const choice = response.data.choices?.[0];
  const message = choice?.message;

  // Check for tool calls
  if (message?.tool_calls && message.tool_calls.length > 0) {
    const toolCall = message.tool_calls[0];
    return {
      text: message.content || '',
      requiresAction: true,
      actionData: {
        tool: toolCall.function.name,
        arguments: JSON.parse(toolCall.function.arguments || '{}')
      }
    };
  }

  return {
    text: message?.content || '',
    requiresAction: false,
    actionData: null
  };
}

/**
 * Forward an AI action to the target API
 */
async function forwardAction(
  config: any,
  actionData: any,
  normalized: any
): Promise<void> {
  if (!config.target_api_url) return;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  // Add authentication
  if (config.target_api_auth_type === 'bearer' && config.target_api_auth_value) {
    headers['Authorization'] = `Bearer ${config.target_api_auth_value}`;
  } else if (config.target_api_auth_type === 'basic' && config.target_api_auth_value) {
    headers['Authorization'] = `Basic ${config.target_api_auth_value}`;
  }

  // Add custom headers
  if (config.target_api_headers) {
    const customHeaders = JSON.parse(config.target_api_headers);
    Object.assign(headers, customHeaders);
  }

  // Inject sender_id into the action payload
  const payload = {
    ...actionData.arguments,
    phone_number: normalized.sender_id,
    sender_id: normalized.sender_id,
    action: actionData.tool
  };

  await axios.post(config.target_api_url, payload, {
    headers,
    timeout: 30000
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Simple language detection (naive, can be replaced with a proper library)
 */
function detectLanguage(text: string): string {
  // Very basic heuristic — extend with proper language detection if needed
  const zuWords = /\b(ngiyabonga|sawubona|yebo|cha)\b/i;
  const xhWords = /\b(enkosi|molo|ewe|hayi)\b/i;
  const afWords = /\b(dankie|hallo|ja|nee)\b/i;

  if (zuWords.test(text)) return 'zu';
  if (xhWords.test(text)) return 'xh';
  if (afWords.test(text)) return 'af';
  return 'en';
}

export default router;
