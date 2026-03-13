import express from 'express';
import { z } from 'zod';
import { db } from '../db/mysql.js';
import { env } from '../config/env.js';
import axios from 'axios';
import { getAssistantKnowledgeHealth, updateAssistantCategories } from '../services/knowledgeCategorizer.js';
import { getDefaultChecklist, getAllTemplates } from '../config/personaTemplates.js';
import { getToolsForTier, getToolsSystemPrompt, parseToolCall, executeToolCall } from '../services/actionRouter.js';
import { search as vectorSearch, deleteByAssistant as deleteVecByAssistant } from '../services/vectorStore.js';
import { checkAssistantStatus } from '../middleware/statusCheck.js';
import { requireAuth } from '../middleware/auth.js';
import { logAnonymizedChat } from '../utils/analyticsLogger.js';
import { chatCompletionStream, chatCompletionStreamWithVision } from '../services/assistantAIRouter.js';
const router = express.Router();
const OLLAMA_API = env.OLLAMA_BASE_URL;
const CHAT_MODEL = env.ASSISTANT_OLLAMA_MODEL;
const KEEP_ALIVE = env.OLLAMA_KEEP_ALIVE; // '-1' = pin in RAM forever
// Helper: parse DB row into clean assistant object
function parseAssistantRow(row) {
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
                    website: parsed.website || undefined
                };
            }
        }
        catch { }
    }
    // Fallback: construct from individual columns
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        businessType: row.business_type,
        personality: row.personality,
        primaryGoal: row.primary_goal,
        website: row.website || undefined
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
    website: z.string().optional()
});
const updateAssistantSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    businessType: z.string().optional(),
    personality: z.enum(['professional', 'friendly', 'expert', 'casual']).optional(),
    primaryGoal: z.string().optional(),
    website: z.string().optional()
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
    }
    catch (error) {
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
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to query Ollama' });
    }
});
/**
 * GET /api/assistants
 *
 * List all assistants from MySQL
 */
router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = req.userId;
        const rows = await db.query('SELECT * FROM assistants WHERE userId = ? OR userId IS NULL ORDER BY created_at DESC', [userId]);
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
    }
    catch (error) {
        console.error('List assistants error:', error);
        return res.status(500).json({ success: false, error: 'Failed to list assistants' });
    }
});
/**
 * POST /api/assistants/create
 *
 * Create a new AI assistant and store it in MySQL
 */
router.post('/create', requireAuth, async (req, res) => {
    try {
        const validatedData = createAssistantSchema.parse(req.body);
        const assistantId = 'assistant-' + Date.now();
        const assistantRecord = {
            id: assistantId,
            name: validatedData.name,
            description: validatedData.description,
            businessType: validatedData.businessType,
            personality: validatedData.personality,
            primaryGoal: validatedData.primaryGoal,
            website: validatedData.website || undefined
        };
        // Store in MySQL — inject persona-based knowledge checklist
        const defaultChecklist = getDefaultChecklist(validatedData.businessType || 'other');
        const knowledgeCategories = JSON.stringify({ checklist: defaultChecklist });
        await db.execute(`INSERT INTO assistants (id, userId, name, description, business_type, personality, primary_goal, website, data, knowledge_categories, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`, [
            assistantId,
            req.userId,
            validatedData.name,
            validatedData.description,
            validatedData.businessType,
            validatedData.personality,
            validatedData.primaryGoal,
            validatedData.website || null,
            JSON.stringify(assistantRecord),
            knowledgeCategories
        ]);
        console.log(`[Assistant] Created and stored in MySQL: ${assistantId}`);
        return res.json({
            success: true,
            assistantId,
            assistant: assistantRecord
        });
    }
    catch (error) {
        console.error('Assistant creation error:', error);
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
        const existing = await db.queryOne('SELECT * FROM assistants WHERE id = ?', [assistantId]);
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
        const updatedRecord = { id: assistantId, ...merged };
        await db.execute(`UPDATE assistants 
       SET name = ?, description = ?, business_type = ?, personality = ?, 
           primary_goal = ?, website = ?, data = ?, updated_at = NOW()
       WHERE id = ?`, [
            merged.name,
            merged.description,
            merged.businessType,
            merged.personality,
            merged.primaryGoal,
            merged.website || null,
            JSON.stringify(updatedRecord),
            assistantId
        ]);
        console.log(`[Assistant] Updated in MySQL: ${assistantId}`);
        return res.json({
            success: true,
            assistantId,
            assistant: updatedRecord
        });
    }
    catch (error) {
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
router.get('/telemetry-consent', requireAuth, async (req, res) => {
    try {
        const row = await db.queryOne('SELECT telemetry_consent_accepted, telemetry_opted_out, telemetry_consent_date FROM users WHERE id = ?', [req.userId]);
        if (!row) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        // Also check if this user has any assistants (to know if it's first-time)
        const countRow = await db.queryOne('SELECT COUNT(*) as cnt FROM assistants WHERE userId = ?', [req.userId]);
        return res.json({
            success: true,
            consent: {
                accepted: !!row.telemetry_consent_accepted,
                optedOut: !!row.telemetry_opted_out,
                consentDate: row.telemetry_consent_date,
            },
            assistantCount: countRow?.cnt || 0,
        });
    }
    catch (error) {
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
router.post('/telemetry-consent', requireAuth, async (req, res) => {
    try {
        const { accepted, optOut } = req.body;
        if (typeof accepted !== 'boolean') {
            return res.status(400).json({ success: false, error: '"accepted" must be a boolean' });
        }
        await db.execute(`UPDATE users SET
        telemetry_consent_accepted = ?,
        telemetry_opted_out = ?,
        telemetry_consent_date = NOW()
       WHERE id = ?`, [
            accepted ? 1 : 0,
            optOut ? 1 : 0,
            req.userId,
        ]);
        console.log(`[Telemetry] User ${req.userId} consent: accepted=${accepted}, optOut=${!!optOut}`);
        return res.json({
            success: true,
            consent: {
                accepted,
                optedOut: !!optOut,
            },
        });
    }
    catch (error) {
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
        const row = await db.queryOne('SELECT tier, knowledge_categories, business_type FROM assistants WHERE id = ?', [assistantId]);
        if (!row)
            return res.status(404).json({ success: false, error: 'Assistant not found' });
        if (row.tier !== 'paid') {
            return res.status(403).json({ success: false, error: 'Custom checklist items require a paid plan' });
        }
        // Parse existing checklist
        let checklist;
        try {
            const parsed = JSON.parse(row.knowledge_categories || '{}');
            checklist = parsed.checklist || [];
        }
        catch {
            checklist = [];
        }
        // Check for duplicate key
        if (checklist.find((c) => c.key === key)) {
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
        await db.execute('UPDATE assistants SET knowledge_categories = ?, updated_at = NOW() WHERE id = ?', [JSON.stringify({ checklist }), assistantId]);
        return res.json({ success: true, checklist });
    }
    catch (error) {
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
    res.setHeader('Cache-Control', 'public, max-age=3600');
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

  // Detect protocol to avoid mixed content errors
  var protocol = window.location.protocol;
  var chatUrl = protocol === 'https:' 
    ? 'https://softaware.net.za/chat/' + assistantId
    : 'http://75.119.141.98:3001/chat/' + assistantId;

  // Create widget button with brand icon
  var button = document.createElement('div');
  button.id = 'softaware-chat-button';
  button.style.cssText = \`
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 60px;
    height: 60px;
    border-radius: 30px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    font-size: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 999999;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  \`;

  // Brand icon image for the button
  var btnIcon = document.createElement('img');
  btnIcon.src = faviconUrl;
  btnIcon.alt = 'Soft Aware Chat';
  btnIcon.style.cssText = 'width: 32px; height: 32px; border-radius: 50%; object-fit: contain; pointer-events: none;';
  button.appendChild(btnIcon);

  // Close icon (hidden by default)
  var btnClose = document.createElement('span');
  btnClose.textContent = '\\u2715';
  btnClose.style.cssText = 'display: none; font-size: 24px; color: white; line-height: 1; pointer-events: none;';
  button.appendChild(btnClose);
  
  button.onmouseover = function() { button.style.transform = 'scale(1.1)'; button.style.boxShadow = '0 6px 20px rgba(0,0,0,0.25)'; };
  button.onmouseout = function() { button.style.transform = 'scale(1)'; button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'; };

  // Create chat container with branded header
  var chatContainer = document.createElement('div');
  chatContainer.id = 'softaware-chat-container';
  chatContainer.style.cssText = \`
    position: fixed;
    bottom: 90px;
    right: 20px;
    width: 400px;
    height: 600px;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.2);
    z-index: 999998;
    display: none;
    flex-direction: column;
    overflow: hidden;
    background: #fff;
  \`;

  // Branded header bar
  var header = document.createElement('div');
  header.style.cssText = \`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  \`;

  var headerIcon = document.createElement('img');
  headerIcon.src = faviconUrl;
  headerIcon.alt = 'Soft Aware';
  headerIcon.style.cssText = 'width: 28px; height: 28px; border-radius: 50%; object-fit: contain; background: rgba(255,255,255,0.2); padding: 2px;';
  header.appendChild(headerIcon);

  var headerTitle = document.createElement('span');
  headerTitle.textContent = 'AI Assistant';
  headerTitle.style.cssText = 'font-size: 14px; font-weight: 600; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
  header.appendChild(headerTitle);

  var headerClose = document.createElement('span');
  headerClose.textContent = '\\u2715';
  headerClose.style.cssText = 'cursor: pointer; font-size: 16px; opacity: 0.8; padding: 4px;';
  headerClose.onclick = function() { toggleChat(); };
  header.appendChild(headerClose);

  chatContainer.appendChild(header);

  // Chat iframe
  var iframe = document.createElement('iframe');
  iframe.id = 'softaware-chat-iframe';
  iframe.src = chatUrl;
  iframe.style.cssText = 'border: none; width: 100%; flex: 1;';
  chatContainer.appendChild(iframe);

  // Powered-by footer
  var footer = document.createElement('div');
  footer.style.cssText = \`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 6px 0;
    background: #f9fafb;
    border-top: 1px solid #e5e7eb;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 11px;
    color: #9ca3af;
  \`;
  var footerImg = document.createElement('img');
  footerImg.src = faviconUrl;
  footerImg.style.cssText = 'width: 14px; height: 14px; opacity: 0.6;';
  footer.appendChild(footerImg);
  var footerText = document.createElement('span');
  footerText.textContent = 'Powered by Soft Aware';
  footer.appendChild(footerText);
  chatContainer.appendChild(footer);
  
  // Toggle chat open/close
  var isOpen = false;
  function toggleChat() {
    isOpen = !isOpen;
    chatContainer.style.display = isOpen ? 'flex' : 'none';
    btnIcon.style.display = isOpen ? 'none' : 'block';
    btnClose.style.display = isOpen ? 'inline' : 'none';
  }

  button.onclick = toggleChat;
  
  // Add to page
  document.body.appendChild(button);
  document.body.appendChild(chatContainer);

  // Fetch assistant name asynchronously and update the header title
  try {
    fetch(apiBase + assistantId)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data && data.assistant && data.assistant.name) {
          headerTitle.textContent = data.assistant.name;
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
        const row = await db.queryOne('SELECT * FROM assistants WHERE id = ?', [assistantId]);
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
    }
    catch (error) {
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
        }
        catch (e) {
            console.warn('[Assistant] ingestion_jobs cleanup failed:', e.message);
        }
        // Clean up sqlite-vec vectors (unless user opted to keep KB)
        if (clearKnowledge) {
            try {
                deleteVecByAssistant(assistantId);
            }
            catch (e) {
                console.warn('[Assistant] sqlite-vec cleanup failed:', e.message);
            }
        }
        return res.json({ success: true, knowledgeCleared: clearKnowledge });
    }
    catch (error) {
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
    }
    catch (error) {
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
    }
    catch (error) {
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
        const row = await db.queryOne('SELECT * FROM assistants WHERE id = ?', [assistantId]);
        if (!row) {
            return res.status(404).json({
                error: 'Assistant not found',
                details: `No assistant with ID ${assistantId}`
            });
        }
        const assistant = parseAssistantRow(row);
        const tier = row.tier || 'free';
        // Get enabled tools for this assistant
        let enabledTools;
        if (row.enabled_tools) {
            try {
                enabledTools = JSON.parse(row.enabled_tools);
            }
            catch { }
        }
        const tools = getToolsForTier(tier, enabledTools);
        const toolsPrompt = getToolsSystemPrompt(tools);
        // ── RAG: Retrieve relevant knowledge from sqlite-vec ──────────────
        let knowledgeContext = '';
        try {
            // Embed the user's question with nomic-embed-text
            const embRes = await axios.post(`${OLLAMA_API}/api/embeddings`, { model: 'nomic-embed-text', prompt: message }, { timeout: 15_000 });
            const queryEmbedding = embRes.data.embedding;
            if (queryEmbedding && queryEmbedding.length > 0) {
                const results = vectorSearch(assistantId, queryEmbedding, 5);
                if (results.length > 0) {
                    knowledgeContext = '\n\nKNOWLEDGE BASE (use this information to answer accurately):\n'
                        + results.map((r, i) => `[Source ${i + 1}: ${r.source}]\n${r.content}`).join('\n\n');
                    console.log(`[Assistant ${assistantId}] RAG: ${results.length} chunks retrieved (closest distance: ${results[0].distance.toFixed(4)})`);
                }
            }
        }
        catch (ragErr) {
            // Non-fatal — if RAG fails, we still answer without context
            console.warn(`[Assistant ${assistantId}] RAG retrieval failed:`, ragErr.message);
        }
        // Build system prompt from assistant configuration + retrieved knowledge
        const systemPrompt = `You are ${assistant.name}, an AI assistant for a ${assistant.businessType} business.

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
        const messages = [
            { role: 'system', content: systemPrompt },
            ...conversationHistory.slice(-10),
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
        let stream;
        let resolvedModel;
        let provider;
        if (hasImage) {
            // Vision path — build multimodal messages
            const visionMessages = [
                { role: 'system', content: systemPrompt },
                ...(conversationHistory.slice(-10).map(m => ({ role: m.role, content: m.content }))),
                { role: 'user', content: message, images: [image] },
            ];
            const visionResult = await chatCompletionStreamWithVision(tier, visionMessages, {
                temperature: getTemperatureForPersonality(assistant.personality),
                top_p: 0.9,
                max_tokens: 2048,
            });
            stream = visionResult.stream;
            resolvedModel = visionResult.model;
            provider = visionResult.provider;
        }
        else {
            // Text-only path — existing fallback chain
            const textResult = await chatCompletionStream(tier, messages, {
                temperature: getTemperatureForPersonality(assistant.personality),
                top_p: 0.9,
                top_k: 40,
                max_tokens: 2048,
            });
            stream = textResult.stream;
            resolvedModel = textResult.model;
            provider = textResult.provider;
        }
        console.log(`[Assistant ${assistantId}] Provider: ${provider}, Model: ${resolvedModel}`);
        let fullResponse = '';
        let lineBuffer = '';
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        const processStream = async () => {
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done)
                        break;
                    lineBuffer += decoder.decode(value, { stream: true });
                    const lines = lineBuffer.split('\n');
                    lineBuffer = lines.pop() ?? '';
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed)
                            continue;
                        if (provider === 'glm') {
                            // Anthropic SSE format: event: content_block_delta\ndata: {"delta":{"text":"..."}}
                            if (!trimmed.startsWith('data: '))
                                continue;
                            const payload = trimmed.slice(6);
                            try {
                                const parsed = JSON.parse(payload);
                                if (parsed.type === 'content_block_delta') {
                                    const token = parsed.delta?.text ?? '';
                                    if (token) {
                                        fullResponse += token;
                                        res.write(`data: ${JSON.stringify({ token })}\n\n`);
                                    }
                                }
                            }
                            catch (_e) { /* skip malformed */ }
                        }
                        else if (provider === 'openrouter' || provider === 'openrouter-fallback') {
                            // OpenAI-compatible SSE format: data: {...}
                            if (!trimmed.startsWith('data: '))
                                continue;
                            const payload = trimmed.slice(6);
                            if (payload === '[DONE]')
                                continue;
                            try {
                                const parsed = JSON.parse(payload);
                                const token = parsed.choices?.[0]?.delta?.content ?? '';
                                if (token) {
                                    fullResponse += token;
                                    res.write(`data: ${JSON.stringify({ token })}\n\n`);
                                }
                            }
                            catch (_e) { /* skip malformed */ }
                        }
                        else {
                            // Ollama NDJSON format: {"message":{"content":"..."},"done":false}
                            try {
                                const parsed = JSON.parse(trimmed);
                                const token = parsed.message?.content ?? '';
                                if (token) {
                                    fullResponse += token;
                                    res.write(`data: ${JSON.stringify({ token })}\n\n`);
                                }
                                if (parsed.done) {
                                    console.log(`[Assistant ${assistantId}] User: ${message}`);
                                    console.log(`[Assistant ${assistantId}] Response: ${fullResponse.substring(0, 100)}...`);
                                }
                            }
                            catch (_e) { /* skip malformed */ }
                        }
                    }
                }
            }
            catch (streamErr) {
                console.error(`[Assistant ${assistantId}] Stream read error:`, streamErr.message);
                if (!res.writableEnded) {
                    res.write(`data: ${JSON.stringify({ error: streamErr.message })}\n\n`);
                }
            }
            // Stream finished — check for tool calls and finalize
            if (!res.writableEnded) {
                const toolCall = parseToolCall(fullResponse);
                if (toolCall) {
                    console.log(`[Assistant ${assistantId}] Tool call detected: ${toolCall.name}`);
                    try {
                        const toolResult = await executeToolCall(toolCall, assistantId, {
                            name: assistant.name,
                            tier,
                            leadCaptureEmail: row.lead_capture_email || undefined,
                            webhookUrl: row.webhook_url || undefined,
                        });
                        res.write(`data: ${JSON.stringify({
                            toolCall: {
                                name: toolCall.name,
                                success: toolResult.success,
                                message: toolResult.message,
                            },
                        })}\n\n`);
                        console.log(`[Assistant ${assistantId}] Tool ${toolCall.name} result: ${toolResult.success ? 'success' : 'failed'}`);
                    }
                    catch (toolError) {
                        console.error(`[Assistant ${assistantId}] Tool execution failed:`, toolError);
                    }
                }
                // ── Anonymized telemetry (fire-and-forget) ──
                try {
                    const ownerRow = await db.queryOne('SELECT u.telemetry_opted_out FROM users u JOIN assistants a ON a.userId = u.id WHERE a.id = ?', [assistantId]);
                    if (!ownerRow || !ownerRow.telemetry_opted_out) {
                        logAnonymizedChat(assistantId, message, fullResponse, {
                            source: 'assistant', model: resolvedModel, provider,
                        });
                    }
                }
                catch (_e) { /* non-fatal */ }
                res.write(`data: ${JSON.stringify({ done: true, model: resolvedModel, provider })}\n\n`);
                res.end();
            }
        };
        processStream();
        return; // response handled by stream events above
    }
    catch (error) {
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
function getPersonalityInstructions(personality) {
    const instructions = {
        professional: 'Maintain a professional, business-appropriate tone. Be clear, direct, and formal. Use proper grammar and avoid casual expressions.',
        friendly: 'Be warm, conversational, and approachable. Use a friendly, casual tone with enthusiasm. Make the user feel welcome and comfortable.',
        expert: 'Use precise, technical language when appropriate. Demonstrate deep knowledge and expertise. Be thorough and detailed in your responses.',
        casual: 'Keep things relaxed and conversational. Use everyday language and be personable. Don\'t be overly formal or stiff.'
    };
    return instructions[personality] || instructions.professional;
}
/**
 * Get temperature setting based on personality
 */
function getTemperatureForPersonality(personality) {
    const temperatures = {
        professional: 0.3, // More focused and consistent
        friendly: 0.7, // More creative and varied
        expert: 0.2, // Very focused and precise
        casual: 0.8 // Most creative and conversational
    };
    return temperatures[personality] || 0.5;
}
export { router as assistantsRouter };
/**
 * Utility: unload the assistant model from RAM.
 * Call this before server maintenance to free ~10-15GB RAM.
 * Usage: POST /api/assistants/admin/unload-model
 */
export async function unloadAssistantModel() {
    await axios.post(`${OLLAMA_API}/api/generate`, {
        model: CHAT_MODEL,
        keep_alive: 0,
        prompt: ''
    }).catch(() => { }); // Ignore errors — model may already be unloaded
    console.log(`[Ollama] Model ${CHAT_MODEL} unloaded from RAM`);
}
