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
import { normalizeInboundPayload, formatOutboundPayload, type VisitorLocation } from '../services/payloadNormalizer.js';
import axios from 'axios';
import { env } from '../config/env.js';
import { getSecret } from '../services/credentialVault.js';

import { logAnonymizedChat } from '../utils/analyticsLogger.js';
import { chatCompletion, chatCompletionWithVision, glmChat, type ChatMessage as RouterChatMessage, type VisionChatMessage } from '../services/assistantAIRouter.js';
import { checkVisionAccess } from '../middleware/packageEnforcement.js';

const router = express.Router();

// ---------------------------------------------------------------------------
// Server-Side Conversation Memory
// ---------------------------------------------------------------------------
// The Silulumanzi chat server (and similar clients) sends each message as an
// independent request with no history.  Without server-side memory every
// message is a blank-slate conversation and the AI constantly re-asks for
// information the customer already provided.
//
// We store the last N messages per session keyed by `session_id` (preferred)
// or `phone_number`.  Sessions expire after SESSION_TTL_MS of inactivity.
// ---------------------------------------------------------------------------

interface ConversationEntry {
  messages: Array<{ role: string; content: string }>;
  verifiedPhones: Set<string>;  // Phone numbers that passed OTP this session
  lastActivity: number; // Date.now()
}

const SESSION_TTL_MS = 30 * 60 * 1000;   // 30 minutes
const MAX_HISTORY_MESSAGES = 20;          // Keep last 20 messages (10 turns)
const conversationStore = new Map<string, ConversationEntry>();

/** Evict expired sessions (runs lazily, not on a timer) */
function evictExpiredSessions(): void {
  const now = Date.now();
  for (const [key, entry] of conversationStore) {
    if (now - entry.lastActivity > SESSION_TTL_MS) {
      conversationStore.delete(key);
    }
  }
}

// ---------------------------------------------------------------------------
// Reverse Geocoding (OpenStreetMap Nominatim)
// ---------------------------------------------------------------------------
interface ReverseGeoResult {
  address: string;           // e.g. "12 Riverside Road, Nelspruit"
  suburb?: string;
  city?: string;
  raw?: any;
}

const geoCache = new Map<string, ReverseGeoResult>();
const GEO_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function reverseGeocode(lat: number, lon: number): Promise<ReverseGeoResult | null> {
  const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const cached = geoCache.get(cacheKey);
  if (cached) return cached;

  try {
    const resp = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: {
        lat,
        lon,
        format: 'json',
        addressdetails: 1,
        zoom: 18,
      },
      headers: {
        'User-Agent': 'SoftAwareAI/1.0 (api-support@softaware.net.za)',
      },
      timeout: 5000,
    });

    const data = resp.data;
    const addr = data.address || {};
    // Build a human-readable address from components
    const parts = [
      addr.house_number,
      addr.road,
      addr.suburb || addr.neighbourhood,
      addr.city || addr.town || addr.village,
    ].filter(Boolean);

    const result: ReverseGeoResult = {
      address: parts.join(', ') || data.display_name || `${lat}, ${lon}`,
      suburb: addr.suburb || addr.neighbourhood,
      city: addr.city || addr.town || addr.village,
      raw: addr,
    };

    geoCache.set(cacheKey, result);
    // Auto-evict after TTL
    setTimeout(() => geoCache.delete(cacheKey), GEO_CACHE_TTL_MS);

    console.log(`[Geocode] ${lat},${lon} → ${result.address}`);
    return result;
  } catch (err: any) {
    console.warn(`[Geocode] Reverse geocoding failed for ${lat},${lon}: ${err.message}`);
    return null;
  }
}

/** Build a session key from the endpoint + sender/session identifiers */
function buildSessionKey(endpointId: string, payload: any, senderId?: string): string {
  // Prefer explicit session_id, fall back to phone_number / sender_id
  const id = payload.session_id || senderId || payload.phone_number || payload.user_id || 'anon';
  return `${endpointId}:${id}`;
}

/** Load previous conversation messages for this session */
function loadConversation(sessionKey: string): Array<{ role: string; content: string }> {
  const entry = conversationStore.get(sessionKey);
  if (!entry) return [];
  // Check TTL
  if (Date.now() - entry.lastActivity > SESSION_TTL_MS) {
    conversationStore.delete(sessionKey);
    return [];
  }
  return entry.messages;
}

/** Append messages to the session and trim to MAX_HISTORY_MESSAGES */
function saveConversation(
  sessionKey: string,
  newMessages: Array<{ role: string; content: string }>
): void {
  const entry = conversationStore.get(sessionKey) || { messages: [], verifiedPhones: new Set(), lastActivity: 0 };
  entry.messages.push(...newMessages);
  // Keep only the most recent messages
  if (entry.messages.length > MAX_HISTORY_MESSAGES) {
    entry.messages = entry.messages.slice(-MAX_HISTORY_MESSAGES);
  }
  entry.lastActivity = Date.now();
  conversationStore.set(sessionKey, entry);

  // Lazy eviction — every ~50 requests, sweep expired sessions
  if (Math.random() < 0.02) evictExpiredSessions();
}

/** Record that a phone number was verified via OTP in this session */
function markPhoneVerified(sessionKey: string, phone: string): void {
  const entry = conversationStore.get(sessionKey) || { messages: [], verifiedPhones: new Set(), lastActivity: 0 };
  entry.verifiedPhones.add(phone);
  entry.lastActivity = Date.now();
  conversationStore.set(sessionKey, entry);
  console.log(`[OTP] Session ${sessionKey}: phone ${phone} marked as verified`);
}

/** Get the set of verified phone numbers for this session */
function getVerifiedPhones(sessionKey: string): Set<string> {
  const entry = conversationStore.get(sessionKey);
  if (!entry) return new Set();
  if (Date.now() - entry.lastActivity > SESSION_TTL_MS) return new Set();
  return entry.verifiedPhones;
}

/**
 * Simple CIDR matching for IPv4 (e.g. "10.0.0.0/8")
 */
function cidrMatch(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split('/');
  if (!bits) return ip === range;
  const mask = ~(2 ** (32 - parseInt(bits, 10)) - 1) >>> 0;
  const ipNum = ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
  const rangeNum = range.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
  return (ipNum & mask) === (rangeNum & mask);
}

// ---------------------------------------------------------------------------
// Kone Solutions — Custom Reporting Helpers
// ---------------------------------------------------------------------------

/** South African Standard Time = UTC+2 */
function getSASTHour(): number {
  const utcHour = new Date().getUTCHours();
  return (utcHour + 2) % 24;
}

/** Off-peak = 18:00 – 06:00 SAST → prefer Ollama (free) */
function isOffPeak(): boolean {
  const h = getSASTHour();
  return h >= 18 || h < 6;
}

interface KoneRequestMeta {
  is_vision: boolean;
  file_count: number;
  cost_zar: number;        // e.g. 0.20 or 0.05
  cost_credits: number;    // internal credit amount deducted
  provider_used: string;
  model_used: string;
  routing_reason: string;  // 'off-peak-ollama' | 'glm-cascade' | 'openrouter-fallback' | etc.
  processing_ms: number;
  timestamp_sast: string;
}

function buildKoneResponse(
  aiResponse: string,
  meta: KoneRequestMeta,
): Record<string, any> {
  // Try to parse the AI response as JSON (CV data) for cleaner packaging
  let parsedData: any;
  try {
    parsedData = JSON.parse(aiResponse);
  } catch {
    parsedData = null;
  }

  return {
    success: true,
    data: parsedData ?? aiResponse,
    _kone_meta: {
      request_type: meta.is_vision ? 'VISION_CV' : 'TEXT_CV',
      files_processed: meta.file_count,
      cost: {
        amount_zar: meta.cost_zar,
        formatted: `R${meta.cost_zar.toFixed(2)}`,
        credits_deducted: meta.cost_credits,
      },
      processing: {
        provider: meta.provider_used,
        model: meta.model_used,
        routing: meta.routing_reason,
        duration_ms: meta.processing_ms,
      },
      timestamp: meta.timestamp_sast,
    },
  };
}

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

    // 2c. IP restriction enforcement
    if (config.allowed_ips) {
      try {
        const allowedIps: string[] = JSON.parse(config.allowed_ips);
        if (allowedIps.length > 0) {
          // Get the caller's IP (handles proxied requests via X-Forwarded-For)
          const forwarded = req.headers['x-forwarded-for'];
          const rawIp = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '')
            || req.ip || req.socket.remoteAddress || '';
          const callerIp = rawIp.replace(/^::ffff:/, ''); // Normalize IPv4-mapped IPv6

          const isAllowed = allowedIps.some((allowed) => {
            const trimmed = allowed.trim();
            if (trimmed.includes('/')) {
              // CIDR match
              return cidrMatch(callerIp, trimmed);
            }
            return callerIp === trimmed;
          });

          if (!isAllowed) {
            console.log(`[Webhook] IP ${callerIp} blocked for endpoint ${endpointId} — allowed: ${allowedIps.join(', ')}`);
            return res.status(403).json({
              error: 'IP_RESTRICTED',
              message: 'Your IP address is not authorized to access this endpoint.'
            });
          }
        }
      } catch {
        // Malformed allowed_ips JSON — skip enforcement
        console.warn(`[Webhook] Malformed allowed_ips for ${endpointId}, skipping IP check`);
      }
    }

    // 2b. Package enforcement removed — pricing is now static via config/tiers.ts
    let contactPackageId: number | null = null;
    if (config.contact_id) {
      contactPackageId = config.contact_id;
    }

    // 3. Normalize the inbound payload (extract message from WhatsApp/Slack/etc.)
    const normalized = normalizeInboundPayload(config.inbound_provider, incomingPayload);

    if (!normalized.text || normalized.text.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid payload',
        message: 'No message text found in the request'
      });
    }

    // ── Detect vision request (files/images in payload) ──
    // Vision is only available for Advanced+ packages (hard gate).
    // Previously hardcoded to kone_solutions — now package-driven.
    const isKone = config.client_id === 'kone_solutions'; // Legacy: Kone-specific cost tracking + off-peak routing
    const inboundFiles: Array<{ mimeType: string; dataBase64: string }> = incomingPayload.files || [];
    let isVisionRequest = inboundFiles.length > 0
      && inboundFiles.some((f: any) => f.dataBase64 && f.mimeType?.startsWith('image'));
    const fileCount = inboundFiles.length;

    // ── Vision hard gate: check package tier before processing any files ──
    if (isVisionRequest && config.contact_id) {
      const visionCheck = await checkVisionAccess(config.contact_id);
      if (!visionCheck.allowed) {
        console.log(`[Webhook] Vision blocked for endpoint ${endpointId} (${visionCheck.packageSlug}): ${visionCheck.reason}`);
        // Don't reject the request — just strip files and proceed as text-only
        isVisionRequest = false;
      }
    } else if (isVisionRequest && !config.contact_id) {
      // No contact linked — fall back to checking the endpoint's client_id for legacy support
      console.log(`[Webhook] Vision request on endpoint ${endpointId} with no contact_id — blocking files (no package to check)`);
      isVisionRequest = false;
    }

    // 4. Build conversation messages for the LLM
    //    Priority: client-sent history → server-side memory → empty
    const sessionKey = buildSessionKey(endpointId, incomingPayload, normalized.sender_id);
    const clientHistory = incomingPayload.history || normalized.metadata?.history || [];
    const serverHistory = clientHistory.length > 0 ? clientHistory : loadConversation(sessionKey);

    // Check if any phones are already verified in this session
    const verifiedPhones = getVerifiedPhones(sessionKey);
    let systemPrompt = config.llm_system_prompt;
    if (verifiedPhones.size > 0) {
      const phoneList = Array.from(verifiedPhones).join(', ');
      systemPrompt += `\n\n[SESSION CONTEXT: The following phone numbers have already been verified via OTP in this conversation: ${phoneList}. Do NOT send another OTP or ask for verification again — proceed directly to account data.]`;
      console.log(`[Webhook] Injecting verified phones context: ${phoneList}`);
    }

    // ── Inject visitor GPS location into system prompt ──
    if (normalized.location) {
      const { latitude, longitude, accuracy } = normalized.location;
      console.log(`[Webhook] Visitor location: ${latitude}, ${longitude} (accuracy: ${accuracy ?? 'unknown'}m)`);

      let locationContext = `\n\n[VISITOR LOCATION: GPS coordinates ${latitude}, ${longitude}`;
      if (accuracy) locationContext += ` (accuracy: ~${Math.round(accuracy)}m)`;

      // Attempt reverse geocoding (non-blocking — falls back gracefully)
      try {
        const geo = await reverseGeocode(latitude, longitude);
        if (geo) {
          locationContext += ` | Address: ${geo.address}`;
          if (geo.suburb) locationContext += ` | Suburb: ${geo.suburb}`;
          if (geo.city) locationContext += ` | City: ${geo.city}`;
        }
      } catch (geoErr: any) {
        console.warn(`[Webhook] Geocoding failed, using raw coords only: ${geoErr.message}`);
      }

      locationContext += `\nUse this location for fault reports (pass to reportFault address/description). Confirm with the customer: "I can see you're near [address] — is that where the issue is?" Do NOT show raw GPS coordinates to the customer.]`;
      systemPrompt += locationContext;
    }

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...serverHistory.slice(-MAX_HISTORY_MESSAGES),
      { role: 'user', content: normalized.text }
    ];

    console.log(`[Webhook] Session ${sessionKey} — ${serverHistory.length} history msgs + 1 new user msg`);

    // 5. Call the LLM — GLM → OpenRouter → Ollama cascade for ALL endpoints.
    //    Tool-calling endpoints use the OpenRouter tool loop as a fallback.
    const MAX_TOOL_ROUNDS = 5;
    let aiResponse: string = '';
    let actualProvider: string = config.llm_provider;
    let actualModel: string = config.llm_model;
    let routingReason: string = 'glm-cascade';

    const hasTools = config.llm_tools_config
      && config.llm_tools_config.trim() !== ''
      && config.llm_tools_config.trim() !== '[]';

    // ── Vision requests use the vision router directly (package-gated above) ──
    if (isVisionRequest) {
      // Build vision messages with image attachments
      const visionMessages: VisionChatMessage[] = [
        { role: 'system', content: config.llm_system_prompt },
        ...serverHistory.slice(-10).map((m: any) => ({ role: m.role, content: m.content })),
        {
          role: 'user' as const,
          content: normalized.text,
          images: inboundFiles
            .filter((f: any) => f.mimeType?.startsWith('image') && f.dataBase64)
            .map((f: any) => `data:${f.mimeType};base64,${f.dataBase64}`),
        },
      ];

      // Off-peak → force Ollama vision (free), else paid cascade
      const offPeak = isOffPeak();
      const visionTier = offPeak ? 'free' : 'paid';
      routingReason = offPeak ? 'off-peak-ollama-vision' : 'paid-vision-cascade';
      console.log(`[Webhook:Vision] Vision request (${fileCount} file(s)), tier=${visionTier}, SAST hour=${getSASTHour()}`);

      try {
        const visionResult = await chatCompletionWithVision(visionTier, visionMessages, {
          temperature: config.llm_temperature || 0.2,
          max_tokens: config.llm_max_tokens || 4096,
        });
        aiResponse = visionResult.content;
        actualProvider = visionResult.provider;
        actualModel = visionResult.model;
      } catch (err: any) {
        console.error(`[Webhook:Vision] Vision failed: ${err.message}`);
        throw new Error('Vision processing failed for all providers');
      }
    }

    // ── Kone Solutions: text-only requests also use off-peak routing ──
    if (isKone && !isVisionRequest && !aiResponse) {
      const offPeak = isOffPeak();
      if (offPeak) {
        try {
          console.log(`[Webhook:Kone] Off-peak text → Ollama (free)`);
          aiResponse = await callOllama(config, messages);
          actualProvider = 'ollama';
          actualModel = config.llm_model;
          routingReason = 'off-peak-ollama-text';
        } catch (err: any) {
          console.warn(`[Webhook:Kone] Off-peak Ollama failed: ${err.message} — falling through to GLM cascade`);
        }
      }
    }

    // ── Step 1: Try GLM first (only for endpoints WITHOUT tools) ──
    // GLM cannot make tool calls. If we let it handle tool-calling endpoints,
    // it either hallucinates answers or emits raw [FUNCTION_CALL] text that
    // leaks to the end user. Skip GLM entirely when tools are configured.
    let glmSucceeded = false;
    if (!aiResponse && !hasTools) try {
      console.log(`[Webhook] Trying GLM first with ${messages.length} messages (no tools)`);
      const glmResult = await glmChat(messages as RouterChatMessage[], {
        temperature: config.llm_temperature || 0.3,
        max_tokens: config.llm_max_tokens || 1024,
      });
      if (glmResult.content) {
        aiResponse = glmResult.content;
        actualProvider = glmResult.provider;
        actualModel = glmResult.model;
        glmSucceeded = true;
        routingReason = 'glm-primary';
        console.log(`[Webhook] GLM responded (${glmResult.model})`);
      }
    } catch (err: any) {
      console.warn(`[Webhook] GLM failed: ${err.message} — falling back to OpenRouter`);
    }

    if (hasTools && !aiResponse) {
      console.log(`[Webhook] Endpoint has tools — skipping GLM, using OpenRouter tool loop`);
    }

    // ── Step 2: OpenRouter (primary for tool endpoints, fallback for non-tool) ──
    if (!glmSucceeded && !aiResponse) {
      try {
        if (hasTools) {
          console.log(`[Webhook] OpenRouter (tools) with ${messages.length} messages`);
          for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
            const result = await callOpenRouter(config, messages);

            if (!result.requiresAction || !result.toolCalls?.length) {
              aiResponse = result.text;
              actualProvider = 'openrouter';
              actualModel = config.llm_model;
              break;
            }

            messages.push(result.assistantMessage);

            for (const tc of result.toolCalls) {
              console.log(`[Webhook ${endpointId}] Round ${round + 1}: tool_call → ${tc.function.name}(${Object.keys(JSON.parse(tc.function.arguments || '{}')).join(', ')})`);

              let toolResultStr = '{"success": true}';
              if (config.target_api_url) {
                try {
                  const toolResult = await forwardAction(config, {
                    tool: tc.function.name,
                    arguments: JSON.parse(tc.function.arguments || '{}')
                  }, normalized);
                  toolResultStr = typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult);
                } catch (toolErr: any) {
                  console.error(`[Webhook ${endpointId}] Tool ${tc.function.name} failed:`, toolErr.message);
                  toolResultStr = JSON.stringify({ error: true, message: toolErr.message || 'Tool execution failed' });
                }
              }

              messages.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: toolResultStr,
              });

              // Track OTP verification success in the session
              if (tc.function.name === 'verifyOTP') {
                try {
                  const toolRes = JSON.parse(toolResultStr);
                  if (toolRes.success || toolRes?.data?.includes?.('verified successfully')) {
                    const verifyArgs = JSON.parse(tc.function.arguments || '{}');
                    if (verifyArgs.phone_number) {
                      markPhoneVerified(sessionKey, verifyArgs.phone_number);
                    }
                  }
                } catch (_) { /* ignore parse errors */ }
              }
            }

            if (round === MAX_TOOL_ROUNDS - 1) {
              aiResponse = result.text || 'I apologize, but I was unable to complete that action. Please try again or contact us directly.';
              actualProvider = 'openrouter';
              actualModel = config.llm_model;
            }
          }
        } else {
          // Non-tool: simple OpenRouter chat
          console.log(`[Webhook] OpenRouter (simple) with ${messages.length} messages`);
          const result = await callOpenRouter(config, messages);
          aiResponse = result.text;
          actualProvider = 'openrouter';
          actualModel = config.llm_model;
          routingReason = 'openrouter-fallback';
        }
      } catch (err: any) {
        console.warn(`[Webhook] OpenRouter failed: ${err.message} — falling back to Ollama`);
      }
    }

    // ── Step 3: Ollama last resort ──
    if (!aiResponse) {
      try {
        console.log(`[Webhook] Ollama last resort with ${messages.length} messages`);
        aiResponse = await callOllama(config, messages);
        actualProvider = 'ollama';
        actualModel = config.llm_model;
        routingReason = 'ollama-last-resort';
        console.log(`[Webhook] Ollama responded: ${aiResponse.substring(0, 100)}...`);
      } catch (err: any) {
        console.error(`[Webhook] All providers failed — Ollama error: ${err.message}`);
        throw new Error(`All LLM providers failed`);
      }
    }

    // 7. Format response + cost tracking
    const duration = Date.now() - startTime;

    // Sanitize response — strip LLM artifacts (<think>, [FUNCTION_CALL], etc.)
    aiResponse = sanitizeResponse(aiResponse);

    // Save conversation to server-side memory (user msg + assistant reply)
    saveConversation(sessionKey, [
      { role: 'user', content: normalized.text },
      { role: 'assistant', content: aiResponse },
    ]);

    // ── Kone Solutions: rich reporting payload with ZAR cost breakdown ──
    if (isKone) {
      // Pricing: R0.20 per vision request, R0.05 per text request
      const costZAR = isVisionRequest ? 0.20 : 0.05;
      // Credits: 1 credit = R0.01 → 20 credits = R0.20, 5 credits = R0.05
      const costCredits = Math.round(costZAR * 100);

      const now = new Date();
      const sastOffset = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const timestampSAST = sastOffset.toISOString().replace('Z', '+02:00');

      const koneMeta: KoneRequestMeta = {
        is_vision: isVisionRequest,
        file_count: fileCount,
        cost_zar: costZAR,
        cost_credits: costCredits,
        provider_used: actualProvider,
        model_used: actualModel,
        routing_reason: routingReason,
        processing_ms: duration,
        timestamp_sast: timestampSAST,
      };

      const koneResponse = buildKoneResponse(aiResponse, koneMeta);
      logRequest(endpointId, incomingPayload, koneResponse, duration, 'success');

      // Deduct Kone-specific credits (ZAR-based)
      if (config.contact_id && contactPackageId) {
        // packageService.deductCredits removed
      }

      logAnonymizedChat(endpointId, normalized.text, aiResponse, {
        source: 'enterprise',
        model: actualModel,
        provider: actualProvider,
        durationMs: duration,
      });

      console.log(`[Webhook:Kone] Done — ${isVisionRequest ? 'VISION' : 'TEXT'}, R${costZAR.toFixed(2)}, ${actualProvider}/${actualModel}, ${duration}ms`);
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json(koneResponse);
    }

    // ── Standard response for all other enterprise clients ──
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
    logRequest(endpointId, incomingPayload, formatted.body, duration, 'success');

    // 8b. Deduct credits (async, non-blocking — don't hold up the response)
    if (config.contact_id && contactPackageId) {
      // packageService.deductCredits removed
    }

    // 9. Anonymized telemetry (fire-and-forget)
    logAnonymizedChat(endpointId, normalized.text, aiResponse, {
      source: 'enterprise',
      model: actualModel,
      provider: actualProvider,
      durationMs: duration,
    });

    // 10. Send the response
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
 *
 * Returns the raw tool_calls array and the full assistant message so the
 * webhook handler can implement a proper tool-call → result → LLM loop.
 */
async function callOpenRouter(
  config: any,
  messages: Array<{ role: string; content: string; tool_call_id?: string; tool_calls?: any[] }>
): Promise<{ text: string; requiresAction: boolean; toolCalls: any[] | null; assistantMessage: any }> {
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
    return {
      text: message.content || '',
      requiresAction: true,
      toolCalls: message.tool_calls,
      assistantMessage: message, // Full message including tool_calls metadata
    };
  }

  return {
    text: message?.content || '',
    requiresAction: false,
    toolCalls: null,
    assistantMessage: message,
  };
}

// ---------------------------------------------------------------------------
// Developer Phone Override (temporary)
// ---------------------------------------------------------------------------
// The developer (0725985535) has no Silulumanzi account. For account-lookup
// tools we swap to a real customer number (0832691437) so data is returned.
// For OTP tools we keep the developer's own number so the SMS arrives on
// their handset.
// ---------------------------------------------------------------------------
const DEV_PHONE_OVERRIDES: Record<string, string> = {
  '0725985535': '0832691437',
};
const OTP_ACTIONS = new Set(['sendOTP', 'verifyOTP']);

function applyDevPhoneOverride(
  action: string,
  args: Record<string, any>
): Record<string, any> {
  // OTP actions must use the real caller's number (SMS destination)
  if (OTP_ACTIONS.has(action)) return args;

  const phone = args.phone_number;
  if (phone && DEV_PHONE_OVERRIDES[phone]) {
    console.log(`[DevOverride] ${action}: phone_number ${phone} → ${DEV_PHONE_OVERRIDES[phone]}`);
    return { ...args, phone_number: DEV_PHONE_OVERRIDES[phone] };
  }
  return args;
}

/**
 * Forward an AI action to the target API and return the response data
 */
async function forwardAction(
  config: any,
  actionData: any,
  normalized: any
): Promise<any> {
  if (!config.target_api_url) return { success: true };

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

  // Apply developer phone overrides before building the payload
  const resolvedArgs = applyDevPhoneOverride(actionData.tool, actionData.arguments || {});

  // Inject sender_id into the action payload (as fallback — LLM arguments take priority)
  const payload = {
    phone_number: normalized.sender_id,
    sender_id: normalized.sender_id,
    ...resolvedArgs,                      // LLM-provided args override the defaults above
    action: actionData.tool
  };

  // Build the target URL — append the action as a path segment
  // Supports both:
  //   • New gateway:  https://api.softaware.net.za/api/v1/client-api/silulumanzi → .../silulumanzi/getCustomerContext
  //   • Legacy PHP:   https://example.com/AiClient.php (action sent in body)
  let targetUrl = config.target_api_url;
  if (targetUrl.includes('/v1/client-api/')) {
    // New standardized gateway — append action as path segment
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
 * Strip LLM artifacts that should never be shown to end users.
 *
 * Some models (GLM, DeepSeek) emit thinking tags and raw function-call text
 * instead of using the proper tool_calls API. This sanitizer catches those
 * artifacts as a safety net.
 */
function sanitizeResponse(text: string): string {
  let cleaned = text;

  // Remove <think>...</think> blocks (GLM / DeepSeek reasoning)
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');

  // Remove orphaned </think> tags (when <think> was already stripped or absent)
  cleaned = cleaned.replace(/<\/?think>/gi, '');

  // Remove [FUNCTION_CALL]...[/FUNCTION_CALL] blocks
  cleaned = cleaned.replace(/\[FUNCTION_CALL\][\s\S]*?\[\/FUNCTION_CALL\]/gi, '');

  // Remove [Response]...{json} blocks (often follows a function call)
  cleaned = cleaned.replace(/\[Response\]\s*\{[\s\S]*?\}\s*/gi, '');

  // Remove ```json blocks that look like raw API responses
  // (Only remove if they contain typical API fields like "success", "customer_name", etc.)
  cleaned = cleaned.replace(/```json\s*\{[\s\S]*?"(?:success|customer_name|error)"[\s\S]*?\}\s*```/gi, '');

  // Clean up excessive whitespace left by removals
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

  return cleaned;
}

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
