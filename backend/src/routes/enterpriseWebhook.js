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
import * as packageService from '../services/packages.js';
import { logAnonymizedChat } from '../utils/analyticsLogger.js';
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
        // 2b. Package enforcement — if endpoint is linked to a contact, check their package
        let contactPackageId = null;
        if (config.contact_id) {
            // Check contact is active
            const contactRows = await packageService.getContactPackages(config.contact_id);
            // getContactPackages JOINs contacts — if no rows, contact may not exist or no package
            const activeSub = contactRows.find((s) => s.status === 'ACTIVE' || s.status === 'TRIAL');
            if (!activeSub) {
                console.log(`[Webhook] Contact ${config.contact_id} has no active package — blocking`);
                return res.status(403).json({
                    error: 'NO_ACTIVE_PACKAGE',
                    message: 'This endpoint is linked to a contact with no active package subscription.'
                });
            }
            if (activeSub.credits_balance <= 0) {
                console.log(`[Webhook] Contact ${config.contact_id} has no credits — blocking`);
                return res.status(402).json({
                    error: 'INSUFFICIENT_CREDITS',
                    message: 'This endpoint has exhausted its credit allocation. Please top up or upgrade.',
                    balance: 0
                });
            }
            contactPackageId = activeSub.id;
            console.log(`[Webhook] Contact ${config.contact_id} package OK (${activeSub.package_name}) — balance: ${activeSub.credits_balance}`);
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
            ...conversationHistory.slice(-10), // Keep last 10 messages for context
            { role: 'user', content: normalized.text }
        ];
        // 5. Call the LLM with tool-calling loop
        const MAX_TOOL_ROUNDS = 5;
        let aiResponse = '';
        console.log(`[Webhook] Calling ${config.llm_provider} with ${messages.length} messages`);
        if (config.llm_provider === 'ollama') {
            console.log(`[Webhook] Ollama model: ${config.llm_model}`);
            aiResponse = await callOllama(config, messages);
            console.log(`[Webhook] Ollama response received: ${aiResponse.substring(0, 100)}...`);
        }
        else if (config.llm_provider === 'openrouter') {
            for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
                const result = await callOpenRouter(config, messages);
                if (!result.requiresAction || !result.toolCalls?.length) {
                    aiResponse = result.text;
                    break;
                }
                // Append assistant message (with tool_calls) to conversation
                messages.push(result.assistantMessage);
                for (const tc of result.toolCalls) {
                    console.log(`[Webhook ${endpointId}] Round ${round + 1}: tool_call -> ${tc.function.name}(${Object.keys(JSON.parse(tc.function.arguments || '{}')).join(', ')})`);
                    let toolResultStr = '{"success": true}';
                    if (config.target_api_url) {
                        try {
                            const toolResult = await forwardAction(config, {
                                tool: tc.function.name,
                                arguments: JSON.parse(tc.function.arguments || '{}')
                            }, normalized);
                            toolResultStr = typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult);
                        }
                        catch (toolErr) {
                            console.error(`[Webhook ${endpointId}] Tool ${tc.function.name} failed:`, toolErr.message);
                            toolResultStr = JSON.stringify({ error: true, message: toolErr.message || 'Tool execution failed' });
                        }
                    }
                    messages.push({
                        role: 'tool',
                        tool_call_id: tc.id,
                        content: toolResultStr,
                    });
                }
                if (round === MAX_TOOL_ROUNDS - 1) {
                    aiResponse = result.text || 'I apologize, but I was unable to complete that action. Please try again or contact us directly.';
                }
            }
            if (!aiResponse) {
                aiResponse = 'I apologize, but I encountered an issue processing your request. Please try again.';
            }
        }
        else {
            throw new Error(`Unsupported LLM provider: ${config.llm_provider}`);
        }
        // 7. Format the response for the inbound provider
        const formatted = formatOutboundPayload(config.inbound_provider, aiResponse, 'reply', {
            phone_number: normalized.sender_id,
            language: detectLanguage(aiResponse)
        });
        // 8. Log the request
        const duration = Date.now() - startTime;
        logRequest(endpointId, incomingPayload, formatted.body, duration, 'success');
        // 8b. Deduct credits (async, non-blocking — don't hold up the response)
        if (config.contact_id && contactPackageId) {
            packageService.deductCredits(config.contact_id, 10, // TEXT_CHAT base cost
            null, 'ENTERPRISE_WEBHOOK', { endpoint_id: endpointId, provider: config.llm_provider, model: config.llm_model }, `Enterprise webhook: ${config.client_name}`).catch(err => {
                console.error(`[Webhook ${endpointId}] Credit deduction failed:`, err.message);
            });
        }
        // 9. Anonymized telemetry (fire-and-forget)
        logAnonymizedChat(endpointId, normalized.text, aiResponse, {
            source: 'enterprise',
            model: config.llm_model,
            provider: config.llm_provider,
            durationMs: duration,
        });
        // 10. Send the response
        res.setHeader('Content-Type', formatted.contentType);
        return res.status(200).send(formatted.body);
    }
    catch (error) {
        console.error(`[Webhook ${endpointId}] Error:`, error);
        const duration = Date.now() - startTime;
        logRequest(endpointId, incomingPayload, null, duration, 'error', error instanceof Error ? error.message : String(error));
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
async function callOllama(config, messages) {
    console.log(`[callOllama] Sending ${messages.length} messages, system prompt length: ${messages[0]?.content?.length || 0}`);
    const response = await axios.post(`${env.OLLAMA_BASE_URL}/api/chat`, {
        model: config.llm_model,
        messages,
        stream: false,
        options: {
            temperature: config.llm_temperature || 0.3,
            num_predict: config.llm_max_tokens || 1024
        }
    }, { timeout: 60000 });
    return response.data.message?.content || '';
}
/**
 * Call OpenRouter for LLM inference (with tool calling support)
 */
async function callOpenRouter(config, messages) {
    const tools = config.llm_tools_config ? JSON.parse(config.llm_tools_config) : [];
    const response = await axios.post(`${env.OPENROUTER_BASE_URL}/chat/completions`, {
        model: config.llm_model,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        temperature: config.llm_temperature || 0.3,
        max_tokens: config.llm_max_tokens || 1024
    }, {
        headers: {
            'Authorization': `Bearer ${await getSecret('OPENROUTER')}`,
            'Content-Type': 'application/json'
        },
        timeout: 60000
    });
    const choice = response.data.choices?.[0];
    const message = choice?.message;
    // Check for tool calls
    if (message?.tool_calls && message.tool_calls.length > 0) {
        return {
            text: message.content || '',
            requiresAction: true,
            toolCalls: message.tool_calls,
            assistantMessage: message,
        };
    }
    return {
        text: message?.content || '',
        requiresAction: false,
        toolCalls: null,
        assistantMessage: message,
    };
}
/**
 * Forward an AI action to the target API and return the response data
 */
async function forwardAction(config, actionData, normalized) {
    if (!config.target_api_url)
        return { success: true };
    const headers = {
        'Content-Type': 'application/json'
    };
    // Add authentication
    if (config.target_api_auth_type === 'bearer' && config.target_api_auth_value) {
        headers['Authorization'] = `Bearer ${config.target_api_auth_value}`;
    }
    else if (config.target_api_auth_type === 'basic' && config.target_api_auth_value) {
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
    // Build the target URL — append the action as a path segment
    let targetUrl = config.target_api_url;
    if (targetUrl.includes('/v1/client-api/')) {
        targetUrl = `${targetUrl.replace(/\/+$/, '')}/${actionData.tool}`;
    }
    const response = await axios.post(targetUrl, payload, {
        headers,
        timeout: 30000
    });
    return response.data;
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/**
 * Simple language detection (naive, can be replaced with a proper library)
 */
function detectLanguage(text) {
    // Very basic heuristic — extend with proper language detection if needed
    const zuWords = /\b(ngiyabonga|sawubona|yebo|cha)\b/i;
    const xhWords = /\b(enkosi|molo|ewe|hayi)\b/i;
    const afWords = /\b(dankie|hallo|ja|nee)\b/i;
    if (zuWords.test(text))
        return 'zu';
    if (xhWords.test(text))
        return 'xh';
    if (afWords.test(text))
        return 'af';
    return 'en';
}
export default router;
