import express from 'express';
import { z } from 'zod';
import { db } from '../db/mysql.js';
import { env } from '../config/env.js';
import axios from 'axios';
import { getAssistantKnowledgeHealth, updateAssistantCategories } from '../services/knowledgeCategorizer.js';
import { getDefaultChecklist, getAllTemplates } from '../config/personaTemplates.js';
import { getToolsForTier, getToolsSystemPrompt, parseToolCall, executeToolCall, stripToolCallJson } from '../services/actionRouter.js';
import { search as vectorSearch, deleteByAssistant as deleteVecByAssistant } from '../services/vectorStore.js';
import { checkAssistantStatus } from '../middleware/statusCheck.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { guardMaxAssistants, TierLimitError } from '../middleware/tierGuard.js';
import { resolveModelTier } from '../services/packageResolver.js';
import { logAnonymizedChat } from '../utils/analyticsLogger.js';
import { chatCompletionStream, chatCompletionStreamWithVision, type VisionChatMessage } from '../services/assistantAIRouter.js';
import { checkVisionAccess } from '../middleware/packageEnforcement.js';
import { getConfigsByContactId, buildAuthHeaders, recordRequest, type ClientApiConfig } from '../services/clientApiGateway.js';
import { getEndpoint } from '../services/enterpriseEndpoints.js';

const router = express.Router();

const OLLAMA_API = env.OLLAMA_BASE_URL;
const CHAT_MODEL = env.ASSISTANT_OLLAMA_MODEL;
const KEEP_ALIVE = env.OLLAMA_KEEP_ALIVE; // '-1' = pin in RAM forever

// Assistant type from database
interface AssistantRow {
  id: string;
  name: string;
  description: string;
  business_type: string;
  personality: string;
  primary_goal: string;
  website: string | null;
  data: string | object;
  created_at: string;
  updated_at: string;
  tier: 'free' | 'paid';
  pages_indexed: number;
  status: string;
  lead_capture_email: string | null;
  webhook_url: string | null;
  enabled_tools: string | null;
}

interface AssistantData {
  id: string;
  name: string;
  description: string;
  businessType: string;
  personality: string;
  primaryGoal: string;
  website?: string;
}

// Helper: parse DB row into clean assistant object
function parseAssistantRow(row: AssistantRow): AssistantData {
  // Try the JSON data field first (has camelCase keys)
  if (row.data) {
    try {
      const parsed = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      if (parsed && parsed.id) {
        return {
          id: parsed.id,
          name: parsed.name,
          description: parsed.description,
          businessType: parsed.businessType,
          personality: parsed.personality,
          primaryGoal: parsed.primaryGoal,
          website: parsed.website || undefined,
        };
      }
    } catch {}
  }
  // Fallback: construct from individual columns
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    businessType: row.business_type,
    personality: row.personality,
    primaryGoal: row.primary_goal,
    website: row.website || undefined,
  };
}

// Request validation schemas
const chatRequestSchema = z.object({
  assistantId: z.string(),
  message: z.string(),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string()
  })).optional().default([]),
  /** Base64 data-URI of an attached image (data:image/png;base64,...) */
  image: z.string().optional(),
});

const createAssistantSchema = z.object({
  name: z.string().min(1, 'Assistant name is required'),
  description: z.string().min(1, 'Description is required'),
  businessType: z.string().min(1, 'Business type is required'),
  personality: z.enum(['professional', 'friendly', 'expert', 'casual']),
  primaryGoal: z.string().min(1, 'Primary goal is required'),
  website: z.string().optional(),
});

const updateAssistantSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  businessType: z.string().optional(),
  personality: z.enum(['professional', 'friendly', 'expert', 'casual']).optional(),
  primaryGoal: z.string().optional(),
  website: z.string().optional(),
});

/**
 * POST /api/assistants/admin/unload-model
 * 
 * Explicitly unload the DeepSeek model from RAM.
 * Use before server maintenance to free ~10-15GB RAM.
 */
router.post('/admin/unload-model', async (_req, res) => {
  try {
    await axios.post(`${OLLAMA_API}/api/generate`, {
      model: CHAT_MODEL,
      keep_alive: 0,
      prompt: ''
    });
    console.log(`[Ollama] Model ${CHAT_MODEL} unloaded from RAM`);
    return res.json({ success: true, message: `Model ${CHAT_MODEL} unloaded from RAM` });
  } catch (error) {
    return res.json({ success: true, message: 'Model already unloaded or not loaded' });
  }
});

/**
 * GET /api/assistants/admin/model-status
 * 
 * Check which models are currently loaded in Ollama RAM.
 */
router.get('/admin/model-status', async (_req, res) => {
  try {
    const response = await axios.get(`${OLLAMA_API}/api/ps`, { timeout: 5000 });
    return res.json({ success: true, models: response.data.models || [], activeModel: CHAT_MODEL });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to query Ollama' });
  }
});

/**
 * GET /api/assistants
 * 
 * List all assistants from MySQL
 */
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const rows = await db.query<AssistantRow>(
      'SELECT * FROM assistants WHERE userId = ? OR userId IS NULL ORDER BY created_at DESC',
      [userId]
    );

    const assistants = rows.map(row => ({
      ...parseAssistantRow(row),
      createdAt: row.created_at,
      status: row.status || 'active',
      tier: row.tier || 'free',
      pagesIndexed: row.pages_indexed || 0,
      embedCode: `<script src="https://softaware.net.za/api/assistants/widget.js" data-assistant-id="${row.id}"></script>`,
      chatUrl: `https://softaware.net.za/chat/${row.id}`
    }));

    return res.json({ success: true, assistants });
  } catch (error) {
    console.error('List assistants error:', error);
    return res.status(500).json({ success: false, error: 'Failed to list assistants' });
  }
});

/**
 * POST /api/assistants/create
 * 
 * Create a new AI assistant and store it in MySQL
 */
router.post('/create', requireAuth, async (req: AuthRequest, res) => {
  try {
    const validatedData = createAssistantSchema.parse(req.body);

    // ── Tier limit check ──────────────────────────────────────────────
    await guardMaxAssistants(req.userId!);

    const assistantId = 'assistant-' + Date.now();

    const assistantRecord: AssistantData = {
      id: assistantId,
      name: validatedData.name,
      description: validatedData.description,
      businessType: validatedData.businessType,
      personality: validatedData.personality,
      primaryGoal: validatedData.primaryGoal,
      website: validatedData.website || undefined,
    };

    // Store in MySQL — inject persona-based knowledge checklist
    const defaultChecklist = getDefaultChecklist(validatedData.businessType || 'other');
    const knowledgeCategories = JSON.stringify({ checklist: defaultChecklist });

    await db.execute(
      `INSERT INTO assistants (id, userId, name, description, business_type, personality, primary_goal, website, 
       custom_greeting, proactive_greeting, proactive_delay, theme_color, data, knowledge_categories, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        assistantId,
        req.userId,
        validatedData.name,
        validatedData.description,
        validatedData.businessType,
        validatedData.personality,
        validatedData.primaryGoal,
        validatedData.website || null,
        null,   // custom_greeting
        null,   // proactive_greeting
        5,      // proactive_delay (default 5 seconds, NOT NULL column)
        null,   // theme_color
        JSON.stringify(assistantRecord),
        knowledgeCategories
      ]
    );

    console.log(`[Assistant] Created and stored in MySQL: ${assistantId}`);

    return res.json({
      success: true,
      assistantId,
      assistant: assistantRecord
    });

  } catch (error) {
    console.error('Assistant creation error:', error);

    if (error instanceof TierLimitError) {
      return res.status(error.status).json({
        error: error.message,
        code: error.code,
        resource: error.resource,
        current: error.current,
        limit: error.limit,
        tier: error.tier,
      });
    }
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid assistant data',
        details: error.errors
      });
    }

    return res.status(500).json({
      error: 'Failed to create assistant',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/assistants/:assistantId/update
 * 
 * Update an existing AI assistant
 */
router.put('/:assistantId/update', async (req, res) => {
  try {
    const { assistantId } = req.params;
    const validatedData = updateAssistantSchema.parse(req.body);

    // Check assistant exists
    const existing = await db.queryOne<AssistantRow>(
      'SELECT * FROM assistants WHERE id = ?',
      [assistantId]
    );
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Assistant not found' });
    }

    // Merge: keep existing values for fields not provided
    const existingData = parseAssistantRow(existing);
    const merged = {
      name: validatedData.name ?? existingData.name,
      description: validatedData.description ?? existingData.description,
      businessType: validatedData.businessType ?? existingData.businessType,
      personality: validatedData.personality ?? existingData.personality,
      primaryGoal: validatedData.primaryGoal ?? existingData.primaryGoal,
      website: validatedData.website ?? existingData.website,
    };

    const updatedRecord: AssistantData = { id: assistantId, ...merged };

    await db.execute(
      `UPDATE assistants 
       SET name = ?, description = ?, business_type = ?, personality = ?, 
           primary_goal = ?, website = ?, custom_greeting = ?, 
           proactive_greeting = ?, proactive_delay = ?, theme_color = ?,
           data = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        merged.name,
        merged.description,
        merged.businessType,
        merged.personality,
        merged.primaryGoal,
        merged.website || null,
        
        
        
        
        JSON.stringify(updatedRecord),
        assistantId
      ]
    );

    console.log(`[Assistant] Updated in MySQL: ${assistantId}`);

    return res.json({
      success: true,
      assistantId,
      assistant: updatedRecord
    });

  } catch (error) {
    console.error('Assistant update error:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid assistant data',
        details: error.errors
      });
    }

    return res.status(500).json({
      error: 'Failed to update assistant',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ── Telemetry Consent ─────────────────────────────────────────────────────

/**
 * GET /api/assistants/telemetry-consent
 *
 * Returns the current user's telemetry consent status.
 * Used by the frontend to decide whether to show the terms modal.
 */
router.get('/telemetry-consent', requireAuth, async (req: AuthRequest, res) => {
  try {
    const row = await db.queryOne<{
      telemetry_consent_accepted: number;
      telemetry_opted_out: number;
      telemetry_consent_date: string | null;
    }>(
      'SELECT telemetry_consent_accepted, telemetry_opted_out, telemetry_consent_date FROM users WHERE id = ?',
      [req.userId]
    );

    if (!row) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Also check if this user has any assistants (to know if it's first-time)
    const countRow = await db.queryOne<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM assistants WHERE userId = ?',
      [req.userId]
    );

    return res.json({
      success: true,
      consent: {
        accepted: !!row.telemetry_consent_accepted,
        optedOut: !!row.telemetry_opted_out,
        consentDate: row.telemetry_consent_date,
      },
      assistantCount: countRow?.cnt || 0,
    });
  } catch (error) {
    console.error('Telemetry consent check error:', error);
    return res.status(500).json({ success: false, error: 'Failed to check telemetry consent' });
  }
});

/**
 * POST /api/assistants/telemetry-consent
 *
 * Accept (or update) telemetry terms. Paid-tier users may set optOut=true.
 *
 * Body: { accepted: true, optOut?: boolean }
 */
router.post('/telemetry-consent', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { accepted, optOut } = req.body;

    if (typeof accepted !== 'boolean') {
      return res.status(400).json({ success: false, error: '"accepted" must be a boolean' });
    }

    await db.execute(
      `UPDATE users SET
        telemetry_consent_accepted = ?,
        telemetry_opted_out = ?,
        telemetry_consent_date = NOW()
       WHERE id = ?`,
      [
        accepted ? 1 : 0,
        optOut ? 1 : 0,
        req.userId,
      ]
    );

    console.log(`[Telemetry] User ${req.userId} consent: accepted=${accepted}, optOut=${!!optOut}`);

    return res.json({
      success: true,
      consent: {
        accepted,
        optedOut: !!optOut,
      },
    });
  } catch (error) {
    console.error('Telemetry consent update error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update telemetry consent' });
  }
});

/**
 * GET /api/assistants/templates
 * 
 * Return all persona templates for the frontend to display during creation.
 */
router.get('/templates', (_req, res) => {
  return res.json({ success: true, templates: getAllTemplates() });
});

/**
 * POST /api/assistants/:assistantId/checklist/add
 * 
 * Add a custom checklist item (paid tier only).
 */
router.post('/:assistantId/checklist/add', async (req, res) => {
  try {
    const { assistantId } = req.params;
    const { key, label, type } = req.body;

    if (!key || !label) {
      return res.status(400).json({ success: false, error: 'key and label are required' });
    }

    // Check assistant exists and is paid tier
    const row = await db.queryOne<{ tier: string; knowledge_categories: string | null; business_type: string }>(
      'SELECT tier, knowledge_categories, business_type FROM assistants WHERE id = ?',
      [assistantId]
    );
    if (!row) return res.status(404).json({ success: false, error: 'Assistant not found' });
    if (row.tier !== 'paid') {
      return res.status(403).json({ success: false, error: 'Custom checklist items require a paid plan' });
    }

    // Parse existing checklist
    let checklist: any[];
    try {
      const parsed = JSON.parse(row.knowledge_categories || '{}');
      checklist = parsed.checklist || [];
    } catch {
      checklist = [];
    }

    // Check for duplicate key
    if (checklist.find((c: any) => c.key === key)) {
      return res.status(409).json({ success: false, error: 'Checklist item with this key already exists' });
    }

    // Add new custom item
    checklist.push({
      key,
      label,
      satisfied: false,
      type: type || 'url',
      custom: true,
    });

    await db.execute(
      'UPDATE assistants SET knowledge_categories = ?, updated_at = NOW() WHERE id = ?',
      [JSON.stringify({ checklist }), assistantId]
    );

    return res.json({ success: true, checklist });
  } catch (error) {
    console.error('Add checklist item error:', error);
    return res.status(500).json({ success: false, error: 'Failed to add checklist item' });
  }
});

/**
 * GET /api/assistants/widget.js
 * 
 * Serve the chat widget script for embedding on external websites
 * MUST be before /:assistantId route to avoid matching "widget.js" as an ID
 */
router.get('/widget.js', (req, res) => {
  // Set headers for cross-origin script loading
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.removeHeader('Content-Security-Policy');
  res.removeHeader('X-Content-Type-Options');
  
  const widgetScript = `(function() {
  // Extract assistant ID and base URL from script tag
  var scripts = document.getElementsByTagName('script');
  var currentScript = scripts[scripts.length - 1];
  var assistantId = currentScript.getAttribute('data-assistant-id');
  
  if (!assistantId) {
    console.error('Soft Aware Chat Widget: Missing data-assistant-id attribute');
    return;
  }

  // Derive the Soft Aware origin from the script src or fall back to known domain
  var brandOrigin = 'https://softaware.net.za';
  try {
    var scriptSrc = currentScript.src || '';
    if (scriptSrc) {
      var u = new URL(scriptSrc);
      brandOrigin = u.origin;
    }
  } catch(e) {}

  var faviconUrl = brandOrigin + '/images/favicon.png';
  var apiBase = brandOrigin + '/api/assistants/';
  var chatApiUrl = brandOrigin + '/api/assistants/chat';

  // Conversation state
  var conversationHistory = [];
  var assistantName = 'AI Assistant';
  var proactiveGreeting = '';
  var proactiveDelay = 5;
  var customGreeting = '';
  var proactiveShown = false;

  // Theme colors — defaults, overridden when assistant config loads
  var themeFrom = '#667eea';
  var themeTo = '#764ba2';

  function makeGradient() { return 'linear-gradient(135deg, ' + themeFrom + ' 0%, ' + themeTo + ' 100%)'; }

  // Darken a hex color by a percentage (for the gradient "to" stop)
  function darkenHex(hex, pct) {
    var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    r = Math.max(0, Math.round(r * (1 - pct))); g = Math.max(0, Math.round(g * (1 - pct))); b = Math.max(0, Math.round(b * (1 - pct)));
    return '#' + ((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
  }

  // Parse hex to rgba string for shadow
  function hexToRgba(hex, a) {
    var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  // Re-apply theme colors to all branded elements
  function applyTheme() {
    var g = makeGradient();
    button.style.background = g;
    button.style.boxShadow = '0 4px 14px ' + hexToRgba(themeFrom, 0.35);
    header.style.background = g;
    sendBtn.style.background = g;
    // Update pulse animation with new color
    styleEl.textContent = [
      '@keyframes sa-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-8px)}}',
      '@keyframes sa-fade-in{from{opacity:0;transform:translateY(8px) scale(0.95)}to{opacity:1;transform:translateY(0) scale(1)}}',
      '@keyframes sa-pulse{0%,100%{box-shadow:0 4px 14px ' + hexToRgba(themeFrom, 0.25) + '}50%{box-shadow:0 4px 20px ' + hexToRgba(themeFrom, 0.5) + '}}',
      '@keyframes sa-slide-up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}'
    ].join('');
  }

  // Inject keyframes + animations
  var styleEl = document.createElement('style');
  styleEl.textContent = [
    '@keyframes sa-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-8px)}}',
    '@keyframes sa-fade-in{from{opacity:0;transform:translateY(8px) scale(0.95)}to{opacity:1;transform:translateY(0) scale(1)}}',
    '@keyframes sa-pulse{0%,100%{box-shadow:0 4px 14px rgba(102,126,234,0.25)}50%{box-shadow:0 4px 20px rgba(102,126,234,0.5)}}',
    '@keyframes sa-slide-up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}'
  ].join('');
  document.head.appendChild(styleEl);

  // ── Widget button — Android-style squircle ──
  var button = document.createElement('div');
  button.id = 'softaware-chat-button';
  button.style.cssText = \`
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 56px;
    height: 56px;
    border-radius: 16px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(102,126,234,0.35);
    z-index: 999999;
    transition: transform 0.2s ease, box-shadow 0.2s ease, border-radius 0.3s ease;
    animation: sa-pulse 3s ease-in-out infinite;
  \`;

  // Chat SVG icon (speech bubble)
  var btnIcon = document.createElement('span');
  btnIcon.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
  btnIcon.style.cssText = 'display: flex; align-items: center; justify-content: center; pointer-events: none;';
  button.appendChild(btnIcon);

  // Close icon (hidden by default)
  var btnClose = document.createElement('span');
  btnClose.textContent = '\\u2715';
  btnClose.style.cssText = 'display: none; font-size: 22px; color: white; line-height: 1; pointer-events: none;';
  button.appendChild(btnClose);
  
  button.onmouseover = function() { button.style.transform = 'scale(1.08)'; button.style.boxShadow = '0 6px 22px ' + hexToRgba(themeFrom, 0.45); };
  button.onmouseout = function() { button.style.transform = 'scale(1)'; button.style.boxShadow = '0 4px 14px ' + hexToRgba(themeFrom, 0.35); };

  // ── Proactive greeting tooltip ──
  var proactiveBubble = document.createElement('div');
  proactiveBubble.id = 'softaware-proactive';
  proactiveBubble.style.cssText = \`
    position: fixed;
    bottom: 84px;
    right: 20px;
    max-width: 260px;
    padding: 12px 16px;
    background: #fff;
    color: #374151;
    font-size: 13px;
    line-height: 1.45;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    border-radius: 12px 12px 4px 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.12);
    z-index: 999998;
    display: none;
    animation: sa-fade-in 0.4s ease;
    cursor: pointer;
  \`;
  // Dismiss X
  var proactiveClose = document.createElement('span');
  proactiveClose.textContent = '\\u2715';
  proactiveClose.style.cssText = \`
    position: absolute; top: 6px; right: 8px; font-size: 12px;
    color: #9ca3af; cursor: pointer; padding: 2px;
    line-height: 1;
  \`;
  proactiveClose.onclick = function(e) {
    e.stopPropagation();
    proactiveBubble.style.display = 'none';
    proactiveShown = true;
  };
  proactiveBubble.appendChild(proactiveClose);

  var proactiveText = document.createElement('span');
  proactiveBubble.appendChild(proactiveText);

  proactiveBubble.onclick = function() {
    proactiveBubble.style.display = 'none';
    proactiveShown = true;
    if (!isOpen) toggleChat();
  };

  // ── Chat container ──
  var chatContainer = document.createElement('div');
  chatContainer.id = 'softaware-chat-container';
  chatContainer.style.cssText = \`
    position: fixed;
    bottom: 90px;
    right: 20px;
    width: 400px;
    height: 600px;
    max-width: calc(100vw - 32px);
    max-height: calc(100vh - 120px);
    border-radius: 16px;
    box-shadow: 0 8px 30px rgba(0,0,0,0.18);
    z-index: 999998;
    display: none;
    flex-direction: column;
    overflow: hidden;
    background: #fff;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    animation: sa-slide-up 0.3s ease;
  \`;

  // ── Header ──
  var header = document.createElement('div');
  header.style.cssText = \`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    flex-shrink: 0;
  \`;

  var headerIcon = document.createElement('img');
  headerIcon.src = faviconUrl;
  headerIcon.alt = 'Soft Aware';
  headerIcon.style.cssText = 'width: 28px; height: 28px; border-radius: 8px; object-fit: contain; background: rgba(255,255,255,0.15); padding: 2px;';
  header.appendChild(headerIcon);

  var headerMeta = document.createElement('div');
  headerMeta.style.cssText = 'flex: 1; min-width: 0;';
  var headerTitle = document.createElement('div');
  headerTitle.textContent = 'AI Assistant';
  headerTitle.style.cssText = 'font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
  var headerStatus = document.createElement('div');
  headerStatus.style.cssText = 'font-size: 11px; opacity: 0.8; display: flex; align-items: center; gap: 4px;';
  headerStatus.innerHTML = '<span style="width:6px;height:6px;border-radius:50%;background:#4ade80;display:inline-block;"></span> Online';
  headerMeta.appendChild(headerTitle);
  headerMeta.appendChild(headerStatus);
  header.appendChild(headerMeta);

  var headerClose = document.createElement('span');
  headerClose.textContent = '\\u2715';
  headerClose.style.cssText = 'cursor: pointer; font-size: 16px; opacity: 0.75; padding: 4px; transition: opacity 0.15s;';
  headerClose.onmouseover = function() { headerClose.style.opacity = '1'; };
  headerClose.onmouseout = function() { headerClose.style.opacity = '0.75'; };
  headerClose.onclick = function() { toggleChat(); };
  header.appendChild(headerClose);

  chatContainer.appendChild(header);

  // ── Messages area ──
  var messagesArea = document.createElement('div');
  messagesArea.id = 'softaware-chat-messages';
  messagesArea.style.cssText = \`
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    background: #f8f9fb;
    display: flex;
    flex-direction: column;
    gap: 12px;
  \`;

  // Welcome message (will be updated when assistant data loads)
  var welcomeMsg = document.createElement('div');
  welcomeMsg.style.cssText = 'display: flex; justify-content: flex-start;';
  var welcomeBubble = document.createElement('div');
  welcomeBubble.style.cssText = \`
    max-width: 80%;
    padding: 10px 14px;
    border-radius: 12px 12px 12px 2px;
    background: #fff;
    color: #374151;
    font-size: 14px;
    line-height: 1.5;
    border: 1px solid #e5e7eb;
    box-shadow: 0 1px 2px rgba(0,0,0,0.04);
  \`;
  welcomeBubble.textContent = 'Hi! How can I help you today?';
  welcomeMsg.appendChild(welcomeBubble);
  messagesArea.appendChild(welcomeMsg);

  chatContainer.appendChild(messagesArea);

  // ── Input area ──
  var inputArea = document.createElement('div');
  inputArea.style.cssText = \`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid #e5e7eb;
    background: #fff;
    flex-shrink: 0;
  \`;

  var chatInput = document.createElement('input');
  chatInput.type = 'text';
  chatInput.placeholder = 'Type your message...';
  chatInput.autocomplete = 'off';
  chatInput.style.cssText = \`
    flex: 1;
    padding: 10px 14px;
    border: 1px solid #d1d5db;
    border-radius: 20px;
    font-size: 14px;
    color: #1f2937;
    background: #fff;
    outline: none;
    font-family: inherit;
    transition: border-color 0.2s;
  \`;
  chatInput.onfocus = function() { chatInput.style.borderColor = themeFrom; };
  chatInput.onblur = function() { chatInput.style.borderColor = '#d1d5db'; };

  var sendBtn = document.createElement('button');
  sendBtn.style.cssText = \`
    width: 40px;
    height: 40px;
    border-radius: 12px;
    border: none;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: opacity 0.2s;
  \`;
  sendBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';

  inputArea.appendChild(chatInput);
  inputArea.appendChild(sendBtn);
  chatContainer.appendChild(inputArea);

  // ── Footer ──
  var footer = document.createElement('div');
  footer.style.cssText = \`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 6px 0;
    background: #f9fafb;
    border-top: 1px solid #f0f0f0;
    font-size: 11px;
    color: #9ca3af;
    flex-shrink: 0;
  \`;
  var footerImg = document.createElement('img');
  footerImg.src = faviconUrl;
  footerImg.style.cssText = 'width: 14px; height: 14px; opacity: 0.5;';
  footer.appendChild(footerImg);
  var footerText = document.createElement('span');
  footerText.textContent = 'Powered by Soft Aware';
  footer.appendChild(footerText);
  chatContainer.appendChild(footer);

  // ── Helper: add a message bubble ──
  function addMessage(role, text) {
    var row = document.createElement('div');
    row.style.cssText = 'display: flex; justify-content: ' + (role === 'user' ? 'flex-end' : 'flex-start') + ';';
    var bubble = document.createElement('div');
    bubble.style.cssText = \`
      max-width: 80%;
      padding: 10px 14px;
      font-size: 14px;
      line-height: 1.5;
      word-wrap: break-word;
      white-space: pre-wrap;
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
    \` + (role === 'user'
      ? 'border-radius: 12px 12px 2px 12px; background: ' + makeGradient() + '; color: #fff;'
      : 'border-radius: 12px 12px 12px 2px; background: #fff; color: #374151; border: 1px solid #e5e7eb;');
    bubble.textContent = text;
    row.appendChild(bubble);
    messagesArea.appendChild(row);
    messagesArea.scrollTop = messagesArea.scrollHeight;
    return bubble;
  }

  // ── Helper: typing indicator ──
  function showTyping() {
    var row = document.createElement('div');
    row.id = 'softaware-typing';
    row.style.cssText = 'display: flex; justify-content: flex-start;';
    var bubble = document.createElement('div');
    bubble.style.cssText = \`
      padding: 12px 18px;
      border-radius: 12px 12px 12px 2px;
      background: #fff;
      border: 1px solid #e5e7eb;
      display: flex;
      gap: 5px;
      align-items: center;
    \`;
    for (var d = 0; d < 3; d++) {
      var dot = document.createElement('span');
      dot.style.cssText = 'width:7px;height:7px;border-radius:50%;background:#9ca3af;animation:sa-bounce 1.4s infinite;animation-delay:' + (d * 0.2) + 's;';
      bubble.appendChild(dot);
    }
    row.appendChild(bubble);
    messagesArea.appendChild(row);
    messagesArea.scrollTop = messagesArea.scrollHeight;
  }

  function hideTyping() {
    var el = document.getElementById('softaware-typing');
    if (el) el.remove();
  }

  // ── Send message via SSE streaming ──
  var isSending = false;
  function sendMessage() {
    var msg = chatInput.value.trim();
    if (!msg || isSending) return;
    isSending = true;
    sendBtn.style.opacity = '0.5';
    sendBtn.style.pointerEvents = 'none';
    chatInput.value = '';

    addMessage('user', msg);
    conversationHistory.push({ role: 'user', content: msg });
    showTyping();

    fetch(chatApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assistantId: assistantId,
        message: msg,
        conversationHistory: conversationHistory.slice(-10)
      })
    }).then(function(response) {
      hideTyping();
      if (!response.ok) {
        addMessage('assistant', 'Sorry, something went wrong. Please try again.');
        isSending = false;
        sendBtn.style.opacity = '1';
        sendBtn.style.pointerEvents = 'auto';
        return;
      }

      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var assistantBubble = null;
      var fullText = '';
      var buffer = '';

      function readChunk() {
        reader.read().then(function(result) {
          if (result.done) {
            if (fullText) conversationHistory.push({ role: 'assistant', content: fullText });
            isSending = false;
            sendBtn.style.opacity = '1';
            sendBtn.style.pointerEvents = 'auto';
            return;
          }
          buffer += decoder.decode(result.value, { stream: true });
          var lines = buffer.split('\\n');
          buffer = lines.pop() || '';
          for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line.startsWith('data: ')) continue;
            try {
              var parsed = JSON.parse(line.slice(6));
              if (parsed.done) {
                if (fullText) conversationHistory.push({ role: 'assistant', content: fullText });
                isSending = false;
                sendBtn.style.opacity = '1';
                sendBtn.style.pointerEvents = 'auto';
                return;
              }
              if (parsed.token) {
                fullText += parsed.token;
                if (!assistantBubble) {
                  assistantBubble = addMessage('assistant', '');
                }
                assistantBubble.textContent = fullText;
                messagesArea.scrollTop = messagesArea.scrollHeight;
              }
              if (parsed.error) {
                addMessage('assistant', 'Error: ' + parsed.error);
              }
            } catch(e) {}
          }
          readChunk();
        }).catch(function(err) {
          hideTyping();
          if (!fullText) addMessage('assistant', 'Connection error. Please try again.');
          isSending = false;
          sendBtn.style.opacity = '1';
          sendBtn.style.pointerEvents = 'auto';
        });
      }
      readChunk();
    }).catch(function(err) {
      hideTyping();
      addMessage('assistant', 'Connection error. Please check your internet and try again.');
      isSending = false;
      sendBtn.style.opacity = '1';
      sendBtn.style.pointerEvents = 'auto';
    });
  }

  sendBtn.onclick = sendMessage;
  chatInput.onkeydown = function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // ── Toggle chat open/close ──
  var isOpen = false;
  function toggleChat() {
    isOpen = !isOpen;
    chatContainer.style.display = isOpen ? 'flex' : 'none';
    btnIcon.style.display = isOpen ? 'none' : 'flex';
    btnClose.style.display = isOpen ? 'inline' : 'none';
    button.style.borderRadius = isOpen ? '50%' : '16px';
    button.style.animation = isOpen ? 'none' : 'sa-pulse 3s ease-in-out infinite';
    // Hide proactive bubble when chat opens
    if (isOpen) {
      proactiveBubble.style.display = 'none';
      chatInput.focus();
    }
  }

  button.onclick = toggleChat;
  
  // ── Add to page ──
  document.body.appendChild(proactiveBubble);
  document.body.appendChild(button);
  document.body.appendChild(chatContainer);

  // ── Fetch assistant config — name, greeting, proactive settings ──
  try {
    fetch(apiBase + assistantId)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data && data.assistant) {
          var a = data.assistant;
          if (a.name) {
            assistantName = a.name;
            headerTitle.textContent = a.name;
          }
          // Custom welcome greeting
          if (a.customGreeting) {
            welcomeBubble.textContent = a.customGreeting;
          }
          // Theme color
          if (a.themeColor) {
            themeFrom = a.themeColor;
            themeTo = darkenHex(a.themeColor, 0.25);
            applyTheme();
          }
          // Proactive greeting — show after delay
          if (a.proactiveGreeting) {
            proactiveGreeting = a.proactiveGreeting;
            proactiveDelay = (a.proactiveDelay != null ? a.proactiveDelay : 5) * 1000;
            setTimeout(function() {
              if (!isOpen && !proactiveShown) {
                proactiveText.textContent = proactiveGreeting;
                proactiveBubble.style.display = 'block';
                proactiveShown = true;
                // Auto-dismiss after 12 seconds
                setTimeout(function() {
                  if (proactiveBubble.style.display === 'block') {
                    proactiveBubble.style.display = 'none';
                  }
                }, 12000);
              }
            }, proactiveDelay);
          }
        }
      })
      .catch(function() {});
  } catch(e) {}
})();`;
  
  res.send(widgetScript);
});

/**
 * GET /api/assistants/:assistantId
 * 
 * Retrieve assistant configuration from MySQL
 */
router.get('/:assistantId', async (req, res) => {
  try {
    const { assistantId } = req.params;
    
    const row = await db.queryOne<AssistantRow>(
      'SELECT * FROM assistants WHERE id = ?',
      [assistantId]
    );
    
    if (!row) {
      return res.status(404).json({
        success: false,
        error: 'Assistant not found'
      });
    }
    
    const assistantData = parseAssistantRow(row);
    
    return res.json({
      success: true,
      assistant: assistantData
    });
    
  } catch (error) {
    console.error('Assistant fetch error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch assistant',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/assistants/:assistantId
 * 
 * Delete an assistant from MySQL
 */
router.delete('/:assistantId', async (req, res) => {
  try {
    const { assistantId } = req.params;
    // clearKnowledge defaults to true for backward compat
    const clearKnowledge = req.query.clearKnowledge !== 'false';

    const affected = await db.execute('DELETE FROM assistants WHERE id = ?', [assistantId]);
    
    if (affected === 0) {
      return res.status(404).json({ success: false, error: 'Assistant not found' });
    }

    // Clean up ingestion_jobs
    try {
      await db.execute('DELETE FROM ingestion_jobs WHERE assistant_id = ?', [assistantId]);
    } catch (e) {
      console.warn('[Assistant] ingestion_jobs cleanup failed:', (e as Error).message);
    }

    // Clean up sqlite-vec vectors (unless user opted to keep KB)
    if (clearKnowledge) {
      try {
        deleteVecByAssistant(assistantId);
      } catch (e) {
        console.warn('[Assistant] sqlite-vec cleanup failed:', (e as Error).message);
      }
    }
    
    return res.json({ success: true, knowledgeCleared: clearKnowledge });
  } catch (error) {
    console.error('Delete assistant error:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete assistant' });
  }
});

/**
 * GET /api/assistants/:assistantId/knowledge-health
 * 
 * Get the Knowledge Health Score for an assistant.
 * Returns:
 * - score: 0-100 percentage
 * - categories: Which content categories are present
 * - missing: List of missing categories
 * - recommendations: Actions to improve the score
 * - pagesIndexed: Current page count
 * - pageLimit: Max pages for tier
 * - storageFull: Whether they've hit their limit
 */
router.get('/:assistantId/knowledge-health', async (req, res) => {
  try {
    const { assistantId } = req.params;
    const health = await getAssistantKnowledgeHealth(assistantId);
    
    return res.json({
      success: true,
      ...health
    });
  } catch (error) {
    console.error('Knowledge health error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get knowledge health',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/assistants/:assistantId/recategorize
 * 
 * Force recategorization of all indexed content.
 * Useful after manual knowledge base changes.
 */
router.post('/:assistantId/recategorize', async (req, res) => {
  try {
    const { assistantId } = req.params;
    const checklist = await updateAssistantCategories(assistantId);
    
    return res.json({
      success: true,
      checklist
    });
  } catch (error) {
    console.error('Recategorize error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to recategorize',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/assistants/chat
 * 
 * Chat with an AI assistant. Looks up the assistant from MySQL by ID,
 * builds a system prompt from its configuration, and calls Ollama.
 */
router.post('/chat', checkAssistantStatus, async (req, res) => {
  try {
    const validatedData = chatRequestSchema.parse(req.body);
    const { assistantId, message, conversationHistory, image } = validatedData;

    // Look up assistant from database
    const row = await db.queryOne<AssistantRow>(
      'SELECT * FROM assistants WHERE id = ?',
      [assistantId]
    );

    if (!row) {
      return res.status(404).json({
        error: 'Assistant not found',
        details: `No assistant with ID ${assistantId}`
      });
    }

    const assistant = parseAssistantRow(row);

    // Resolve model tier from the assistant owner's package.
    // Pro/Advanced/Enterprise (including TRIAL) → 'paid' chain (GLM → OpenRouter → Ollama).
    // Free/Starter/no-package → 'free' chain (Ollama only).
    // Usage limits are still enforced separately by resolveTrialLimits.
    const tier = await resolveModelTier(row.userId);
    
    // Get enabled tools for this assistant
    let enabledTools: string[] | undefined;
    if (row.enabled_tools) {
      try {
        enabledTools = JSON.parse(row.enabled_tools);
      } catch {}
    }
    const tools = getToolsForTier(tier, enabledTools);
    const toolsPrompt = getToolsSystemPrompt(tools);

    // ── RAG: Retrieve relevant knowledge from sqlite-vec ──────────────
    let knowledgeContext = '';
    try {
      // Embed the user's question with nomic-embed-text
      const embRes = await axios.post<{ embedding: number[] }>(
        `${OLLAMA_API}/api/embeddings`,
        { model: 'nomic-embed-text', prompt: message },
        { timeout: 15_000 }
      );
      const queryEmbedding = embRes.data.embedding;

      if (queryEmbedding && queryEmbedding.length > 0) {
        const results = vectorSearch(assistantId, queryEmbedding, 5);
        if (results.length > 0) {
          knowledgeContext = '\n\nKNOWLEDGE BASE (use this information to answer accurately):\n'
            + results.map((r, i) =>
              `[Source ${i + 1}: ${r.source}]\n${r.content}`
            ).join('\n\n');
          console.log(`[Assistant ${assistantId}] RAG: ${results.length} chunks retrieved (closest distance: ${results[0].distance.toFixed(4)})`);
        }
      }
    } catch (ragErr) {
      // Non-fatal — if RAG fails, we still answer without context
      console.warn(`[Assistant ${assistantId}] RAG retrieval failed:`, (ragErr as Error).message);
    }

    // ── Detect gateway context for the assistant owner ──────────────
    let activeGwConfigs: ClientApiConfig[] = [];
    let gatewayToolsPrompt = '';
    try {
      const ownerRow = await db.queryOne<{ contact_id: number | null }>(
        'SELECT contact_id FROM users WHERE id = ?',
        [row.userId],
      );
      if (ownerRow?.contact_id) {
        const gwConfigs = getConfigsByContactId(ownerRow.contact_id);
        const active = gwConfigs.filter(gc => gc.status === 'active');
        if (active.length > 0) {
          activeGwConfigs = active;
          // Try to load rich tool schemas from the linked enterprise endpoint
          let richTools: any[] | null = null;
          for (const gc of active) {
            if (gc.endpoint_id) {
              try {
                const ep = getEndpoint(gc.endpoint_id);
                if (ep?.llm_tools_config) {
                  richTools = JSON.parse(ep.llm_tools_config);
                }
              } catch {}
            }
          }
          if (richTools && richTools.length > 0) {
            gatewayToolsPrompt = buildGatewayToolsPromptFromSchemas(richTools);
          } else {
            // Fallback: just tool names from allowed_actions
            const allTools: string[] = [];
            for (const gc of active) {
              try { allTools.push(...JSON.parse(gc.allowed_actions || '[]')); } catch {}
            }
            gatewayToolsPrompt = buildGatewayToolsPrompt(allTools);
          }
        }
      }
    } catch (gwErr) {
      console.warn(`[Assistant ${assistantId}] Gateway context lookup failed:`, (gwErr as Error).message);
    }

    // Build system prompt from assistant configuration + retrieved knowledge
    const isGatewayAssistant = activeGwConfigs.length > 0;
    const systemPrompt = isGatewayAssistant
      ? `You are ${assistant.name}, a concise business assistant for ${assistant.description || assistant.businessType}.${assistant.website ? ` Website: ${assistant.website}` : ''}

RULES:
- Keep replies short and direct — 1-2 sentences for greetings and simple questions.
- Only list capabilities when the user explicitly asks what you can do.
- You help manage business operations via the actions listed below.
- Be ${assistant.personality}, helpful, and to the point.
- NEVER reveal raw JSON or tool call syntax to the user.
${knowledgeContext}
${gatewayToolsPrompt}`
      : `You are ${assistant.name}, an AI assistant for a ${assistant.businessType} business.

BUSINESS CONTEXT:
- Business Name: ${assistant.name}
- Business Type: ${assistant.businessType}
- Description: ${assistant.description}
- Primary Goal: ${assistant.primaryGoal}${assistant.website ? `\n- Website: ${assistant.website}` : ''}

PERSONALITY: ${assistant.personality.toUpperCase()}
${getPersonalityInstructions(assistant.personality)}

INSTRUCTIONS:
- Always respond as ${assistant.name}
- Focus on helping with ${assistant.businessType} related queries
- Your main objective is: ${assistant.primaryGoal}
- Be helpful, accurate, and stay in character
- If you don't have specific information, acknowledge it honestly
${assistant.website ? `- Direct users to ${assistant.website} for more detailed information when appropriate` : ''}
${knowledgeContext}
${toolsPrompt}
Remember: You represent ${assistant.name} and should respond as if you work for this ${assistant.businessType} business.`;

    // Build conversation messages
    const messages: { role: string; content: string }[] = [
      { role: 'system', content: systemPrompt },
      ...(conversationHistory.slice(-10) as { role: string; content: string }[]),
      { role: 'user', content: message }
    ];

    // Stream response back to client as Server-Sent Events
    // Fallback chain — Free: GLM → Ollama | Paid: GLM → OpenRouter → Ollama
    // Vision chain — Free: Ollama qwen2.5vl | Paid: OpenRouter gpt-4o → gemini-flash → Ollama
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx/apache proxy buffering
    res.flushHeaders();

    const hasImage = !!image && image.startsWith('data:image/');
    let stream: ReadableStream<Uint8Array>;
    let resolvedModel: string;
    let provider: string;

    if (hasImage) {
      // ── Vision hard gate: only Advanced+ packages can process files ──
      if (row.userId) {
        const ownerUser = await db.queryOne<{ contact_id: number | null }>(
          'SELECT contact_id FROM users WHERE id = ?',
          [row.userId],
        );
        if (ownerUser?.contact_id) {
          const visionCheck = await checkVisionAccess(ownerUser.contact_id);
          if (!visionCheck.allowed) {
            return res.status(403).json({
              success: false,
              error: 'VISION_NOT_AVAILABLE',
              message: visionCheck.reason || 'Image analysis requires an Advanced or Enterprise package.',
            });
          }
        }
      }

      // Vision path — build multimodal messages
      const visionMessages: VisionChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...(conversationHistory.slice(-10).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))),
        { role: 'user', content: message, images: [image!] },
      ];
      const visionResult = await chatCompletionStreamWithVision(
        tier,
        visionMessages,
        {
          temperature: getTemperatureForPersonality(assistant.personality),
          top_p: 0.9,
          max_tokens: 2048,
        },
      );
      stream = visionResult.stream;
      resolvedModel = visionResult.model;
      provider = visionResult.provider;
    } else {
      // Text-only path — existing fallback chain
      const textResult = await chatCompletionStream(
        tier,
        messages as any,
        {
          temperature: getTemperatureForPersonality(assistant.personality),
          top_p: 0.9,
          top_k: 40,
          max_tokens: 2048,
        },
      );
      stream = textResult.stream;
      resolvedModel = textResult.model;
      provider = textResult.provider;
    }

    console.log(`[Assistant ${assistantId}] Provider: ${provider}, Model: ${resolvedModel}`);

    let fullResponse = '';
    let lineBuffer = '';

    // ── Tool-call buffering for gateway assistants ─────────────────────
    // Gateway assistants buffer ALL tokens. Once the stream ends, if a
    // tool_call is detected in the full response we suppress everything
    // and execute the tool. Otherwise we flush the buffer to the client.
    // This prevents the raw JSON from ever reaching the frontend, even
    // when the LLM adds preamble text before the JSON.
    const isBuffered = isGatewayAssistant;

    /** Send a token SSE to the frontend */
    const emitToken = (token: string) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      }
    };

    /** Buffer or forward a token depending on mode */
    const handleToken = (token: string) => {
      fullResponse += token;
      if (!isBuffered) {
        emitToken(token);
      }
      // When buffered, tokens accumulate in fullResponse and are flushed post-stream
    };

    const reader = stream.getReader();
    const decoder = new TextDecoder();

    const processStream = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          lineBuffer += decoder.decode(value, { stream: true });
          const lines = lineBuffer.split('\n');
          lineBuffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            if (provider === 'glm') {
              // Anthropic SSE format: event: content_block_delta\ndata: {"delta":{"text":"..."}}
              if (!trimmed.startsWith('data: ')) continue;
              const payload = trimmed.slice(6);
              try {
                const parsed = JSON.parse(payload);
                if (parsed.type === 'content_block_delta') {
                  const token = parsed.delta?.text ?? '';
                  if (token) {
                    handleToken(token);
                  }
                }
              } catch (_e) { /* skip malformed */ }
            } else if (provider === 'openrouter' || provider === 'openrouter-fallback') {
              // OpenAI-compatible SSE format: data: {...}
              if (!trimmed.startsWith('data: ')) continue;
              const payload = trimmed.slice(6);
              if (payload === '[DONE]') continue;
              try {
                const parsed = JSON.parse(payload);
                const token = parsed.choices?.[0]?.delta?.content ?? '';
                if (token) {
                  handleToken(token);
                }
              } catch (_e) { /* skip malformed */ }
            } else {
              // Ollama NDJSON format: {"message":{"content":"..."},"done":false}
              try {
                const parsed = JSON.parse(trimmed);
                const token = parsed.message?.content ?? '';
                if (token) {
                  handleToken(token);
                }
                if (parsed.done) {
                  console.log(`[Assistant ${assistantId}] User: ${message}`);
                  console.log(`[Assistant ${assistantId}] Response: ${fullResponse.substring(0, 100)}...`);
                }
              } catch (_e) { /* skip malformed */ }
            }
          }
        }

        // Flushing is handled by the agentic loop below
      } catch (streamErr) {
        console.error(`[Assistant ${assistantId}] Stream read error:`, (streamErr as Error).message);
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ error: (streamErr as Error).message })}\n\n`);
        }
      }

      // Stream finished — agentic loop: handle multi-step tool chains
      if (!res.writableEnded) {
        const STANDARD_TOOLS = ['capture_lead', 'schedule_callback', 'trigger_webhook'];
        const MAX_TOOL_ITERATIONS = 5;
        let agenticResponse = fullResponse;
        let toolsExecuted = 0;

        // Build an evolving conversation for follow-up AI passes
        const agenticHistory: { role: string; content: string }[] = [
          { role: 'system', content: systemPrompt },
          ...(conversationHistory.slice(-10) as { role: string; content: string }[]),
          { role: 'user', content: message },
        ];

        for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
          const iterToolCall = parseToolCall(agenticResponse);
          if (!iterToolCall) break; // no tool call — exit loop

          console.log(`[Assistant ${assistantId}] Tool call detected (step ${iteration + 1}): ${iterToolCall.name}`);
          toolsExecuted++;

          // Clear any raw JSON from the display
          res.write(`data: ${JSON.stringify({ toolExecuted: true, replace: '' })}\n\n`);

          // ── Standard tool — handle once and exit loop ──
          if (!isGatewayAssistant || STANDARD_TOOLS.includes(iterToolCall.name)) {
            try {
              const toolResult = await executeToolCall(iterToolCall, assistantId, {
                name: assistant.name,
                tier,
                leadCaptureEmail: row.lead_capture_email || undefined,
                webhookUrl: row.webhook_url || undefined,
              });
              res.write(`data: ${JSON.stringify({ token: toolResult.message })}\n\n`);
              console.log(`[Assistant ${assistantId}] Tool ${iterToolCall.name} result: ${toolResult.success ? 'success' : 'failed'}`);
            } catch (toolError) {
              console.error(`[Assistant ${assistantId}] Tool execution failed:`, toolError);
              res.write(`data: ${JSON.stringify({ token: 'Sorry, I encountered an error processing your request.' })}\n\n`);
            }
            agenticResponse = ''; // prevent final flush re-emitting
            break;
          }

          // ── Gateway tool — execute and loop for more tools ──
          const gwConfig = findGatewayConfig(activeGwConfigs, iterToolCall.name)
            || activeGwConfigs[0] || null;

          if (!gwConfig) {
            res.write(`data: ${JSON.stringify({ token: 'I\'m sorry, the gateway integration is not configured yet. Please contact support.' })}\n\n`);
            agenticResponse = '';
            break;
          }

          const gatewayResult = await executeGatewayTool(
            gwConfig, iterToolCall.name, iterToolCall.arguments as Record<string, unknown>
          );

          // Append to agentic history for next AI pass.
          // Show the assistant's ACTUAL tool call JSON so the LLM knows
          // the correct format and doesn't mimic placeholder text.
          agenticHistory.push({
            role: 'assistant',
            content: JSON.stringify({ tool_call: { name: iterToolCall.name, arguments: iterToolCall.arguments } }),
          });
          agenticHistory.push({
            role: 'user',
            content: `The system executed "${iterToolCall.name}" and received:\n${JSON.stringify(gatewayResult)}\n\nIMPORTANT: If you need to call another tool, respond with ONLY the JSON object using the {"tool_call": ...} format. Do NOT write "[Executed ...]" or any other text before the JSON. If no more tools are needed, give a concise, friendly reply to the user. Do not mention tools, JSON, or technical details.`,
          });

          // Call AI again — buffer the FULL response (don't stream to client yet)
          try {
            const followUp = await chatCompletionStream(
              tier, agenticHistory as any,
              { temperature: getTemperatureForPersonality(assistant.personality), top_p: 0.9, max_tokens: 512 }
            );
            const fuReader = followUp.stream.getReader();
            const fuDecoder = new TextDecoder();
            let fuLineBuffer = '';
            agenticResponse = ''; // reset for this iteration

            while (true) {
              const { done, value } = await fuReader.read();
              if (done) break;
              fuLineBuffer += fuDecoder.decode(value, { stream: true });
              const fuLines = fuLineBuffer.split('\n');
              fuLineBuffer = fuLines.pop() ?? '';

              for (const fuLine of fuLines) {
                const t = fuLine.trim();
                if (!t) continue;
                let tok = '';
                if (followUp.provider === 'glm') {
                  if (!t.startsWith('data: ')) continue;
                  try { const p = JSON.parse(t.slice(6)); if (p.type === 'content_block_delta') tok = p.delta?.text ?? ''; } catch {}
                } else if (followUp.provider === 'openrouter' || followUp.provider === 'openrouter-fallback') {
                  if (!t.startsWith('data: ') || t.slice(6) === '[DONE]') continue;
                  try { const p = JSON.parse(t.slice(6)); tok = p.choices?.[0]?.delta?.content ?? ''; } catch {}
                } else {
                  try { const p = JSON.parse(t); tok = p.message?.content ?? ''; } catch {}
                }
                if (tok) agenticResponse += tok; // buffer only — don't emit
              }
            }
            console.log(`[Assistant ${assistantId}] Follow-up (step ${iteration + 1}): ${agenticResponse.substring(0, 120)}...`);
          } catch (followUpErr) {
            // Fallback: emit a plain message derived from the gateway response
            const fallback = (gatewayResult as any)?.message
              || ((gatewayResult as any)?.error ? 'The action could not be completed.' : 'Done!');
            res.write(`data: ${JSON.stringify({ token: fallback })}\n\n`);
            agenticResponse = ''; // stop loop
            break;
          }
        }

        // Emit the final clean response if the loop produced one with no tool call
        if (agenticResponse && !parseToolCall(agenticResponse)) {
          const cleaned = stripToolCallJson(agenticResponse);
          if (toolsExecuted > 0 || isBuffered) {
            // After gateway tools: emit the AI's final answer
            // After initial buffer with no tool call: flush the buffered response
            emitToken(cleaned || agenticResponse);
          }
        }

        // ── Anonymized telemetry (fire-and-forget) ──
        try {
          const ownerRow = await db.queryOne<{ telemetry_opted_out: number }>(
            'SELECT u.telemetry_opted_out FROM users u JOIN assistants a ON a.userId = u.id WHERE a.id = ?',
            [assistantId]
          );
          if (!ownerRow || !ownerRow.telemetry_opted_out) {
            logAnonymizedChat(assistantId, message, fullResponse, {
              source: 'assistant', model: resolvedModel, provider,
            });
          }
        } catch (_e) { /* non-fatal */ }

        res.write(`data: ${JSON.stringify({ done: true, model: resolvedModel, provider })}\n\n`);
        res.end();
      }
    };

    processStream();
    return; // response handled by stream events above

  } catch (error) {
    console.error('Assistant chat error:', error);

    // If headers already sent (streaming started), can't send JSON error
    if (res.headersSent) {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: 'Stream interrupted' })}\n\n`);
        res.end();
      }
      return;
    }

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: error.errors
      });
    }

    return res.status(500).json({
      error: 'Failed to process chat message',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get personality-specific instructions
 */
function getPersonalityInstructions(personality: string): string {
  const instructions = {
    professional: 'Maintain a professional, business-appropriate tone. Be clear, direct, and formal. Use proper grammar and avoid casual expressions.',
    friendly: 'Be warm, conversational, and approachable. Use a friendly, casual tone with enthusiasm. Make the user feel welcome and comfortable.',
    expert: 'Use precise, technical language when appropriate. Demonstrate deep knowledge and expertise. Be thorough and detailed in your responses.',
    casual: 'Keep things relaxed and conversational. Use everyday language and be personable. Don\'t be overly formal or stiff.'
  };
  
  return instructions[personality as keyof typeof instructions] || instructions.professional;
}

/**
 * Get temperature setting based on personality
 */
function getTemperatureForPersonality(personality: string): number {
  const temperatures = {
    professional: 0.3,  // More focused and consistent
    friendly: 0.7,      // More creative and varied
    expert: 0.2,        // Very focused and precise
    casual: 0.8         // Most creative and conversational
  };
  
  return temperatures[personality as keyof typeof temperatures] || 0.5;
}

export { router as assistantsRouter };

// ─── Gateway AI helpers ───────────────────────────────────────────────────

/**
 * Build a tool-calling system prompt for gateway assistants.
 * Instructs the LLM to emit structured JSON for each available action,
 * and suppresses generic tools (capture_lead, etc.).
 */
function buildGatewayToolsPrompt(tools: string[]): string {
  if (tools.length === 0) return '';

  // Provide explicit parameter signatures for well-known actions so the
  // LLM doesn't hallucinate parameter names (e.g. "search_term" instead of "query").
  const TOOL_SIGNATURES: Record<string, string> = {
    listBranches: '(no arguments needed)',
    searchProducts: '{"query": "keyword", "branch_id": optional_int}',
    createOrder: '{"order_type": "dine_in|take_away|delivery", "branch_id": int, "payment_method": "cash|yoco|card|wallet", "items": [{"product_id": int, "quantity": int}]}',
    getSalesReport: '{"period": "today|week|month|year", "branch_id": optional_int}',
    getCustomer: '{"phone": "string"} or {"email": "string"} or {"user_id": int}',
    adminGetOrderDetail: '{"order_id": int}',
    updateOrderStatus: '{"order_id": int, "status": "confirmed|preparing|ready|out_for_delivery|delivered|cancelled"}',
  };

  const toolList = tools.map(t => {
    const sig = TOOL_SIGNATURES[t];
    return sig ? `- ${t} ${sig}` : `- ${t}`;
  }).join('\n');

  return `
AVAILABLE ACTIONS:
${toolList}

To call an action, respond with ONLY this JSON — nothing else before or after:
{"tool_call": {"name": "ACTION_NAME", "arguments": {…}}}

CRITICAL RULES:
- Output ONLY the JSON object. No text before it. No text after it.
- Use EXACTLY the parameter names shown above (e.g. "query" not "search_term", "keyword", or "search").
- The system executes the action and feeds you the result automatically.
- NEVER write "[Executed ...]" — only the system can execute actions.

WORKFLOW RULES:
- Resolve branch names to branch_id via listBranches before using branch_id in other calls.
- Resolve product names to product_id + price via searchProducts before calling createOrder.
- Do NOT guess or fabricate IDs — always look them up first.
- For walk-in / anonymous customers, omit user_id/user_phone/user_email from createOrder.
- Collect all required info conversationally before calling a tool.`;
}

/**
 * Build a tool-calling prompt from rich OpenAI-format tool schemas.
 * Produces a detailed listing with parameter names, types, required markers,
 * and descriptions so the LLM uses exact names.
 */
function buildGatewayToolsPromptFromSchemas(schemas: any[]): string {
  if (!schemas || schemas.length === 0) return '';

  const toolLines = schemas.map(schema => {
    const fn = schema.function || schema;
    const name = fn.name || 'unknown';
    const desc = fn.description || '';
    const params = fn.parameters?.properties || {};
    const required: string[] = fn.parameters?.required || [];

    const paramParts = Object.entries(params).map(([pname, pdef]: [string, any]) => {
      const req = required.includes(pname) ? ' *required*' : '';
      return `    - ${pname} (${pdef.type || 'string'}${req}): ${pdef.description || ''}`;
    });

    if (paramParts.length === 0) {
      return `- **${name}**: ${desc}\n    (no arguments needed)`;
    }
    return `- **${name}**: ${desc}\n${paramParts.join('\n')}`;
  }).join('\n\n');

  return `
AVAILABLE ACTIONS:
${toolLines}

To call an action, respond with ONLY this JSON — nothing else before or after:
{"tool_call": {"name": "ACTION_NAME", "arguments": {…}}}

CRITICAL RULES:
- Output ONLY the JSON object. No text before it. No text after it.
- Use EXACTLY the parameter names listed above. Do not invent alternatives.
- The system executes the action and feeds you the result automatically.
- NEVER write "[Executed ...]" — only the system can execute actions.

WORKFLOW RULES:
- Resolve branch names to branch_id via listBranches before using branch_id in other calls.
- Resolve product names to product_id + price via searchProducts before calling createOrder.
- Do NOT guess or fabricate IDs — always look them up first.
- For walk-in / anonymous customers, omit user_id/user_phone/user_email from createOrder.
- Collect all required info conversationally before calling a tool.`;
}

/**
 * Find the first active gateway config that permits the given action.
 */
function findGatewayConfig(configs: ClientApiConfig[], action: string): ClientApiConfig | null {
  for (const cfg of configs) {
    if (cfg.status !== 'active') continue;
    if (!cfg.allowed_actions) return cfg; // null = allow all
    try {
      const allowed = JSON.parse(cfg.allowed_actions) as string[];
      if (allowed.includes(action)) return cfg;
    } catch { /* skip malformed */ }
  }
  return null;
}

/**
 * Execute a single gateway tool call against the client's target API.
 * Returns the raw response body (or an error object).
 */
async function executeGatewayTool(
  config: ClientApiConfig,
  action: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const targetUrl = `${config.target_base_url.replace(/\/+$/, '')}/${action}`;
  const headers = buildAuthHeaders(config);
  const startTime = Date.now();

  try {
    const response = await axios.post(targetUrl, args, {
      headers,
      timeout: config.timeout_ms || 30000,
      validateStatus: () => true,
    });
    recordRequest(config.id, config.client_id, action, response.status, Date.now() - startTime);
    console.log(`[GatewayTool] ${config.client_id}/${action} → ${response.status}`);
    return (response.data ?? {}) as Record<string, unknown>;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    recordRequest(config.id, config.client_id, action, 502, Date.now() - startTime, errMsg);
    console.error(`[GatewayTool] ${config.client_id}/${action} error:`, errMsg);
    return { error: true, message: `The ${action} action could not be completed.` };
  }
}

/**
 * Utility: unload the assistant model from RAM.
 * Call this before server maintenance to free ~10-15GB RAM.
 * Usage: POST /api/assistants/admin/unload-model
 */
export async function unloadAssistantModel(): Promise<void> {
  await axios.post(`${OLLAMA_API}/api/generate`, {
    model: CHAT_MODEL,
    keep_alive: 0,
    prompt: ''
  }).catch(() => {}); // Ignore errors — model may already be unloaded
  console.log(`[Ollama] Model ${CHAT_MODEL} unloaded from RAM`);
}