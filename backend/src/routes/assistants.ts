import express from 'express';
import { z } from 'zod';
import { db } from '../db/mysql.js';
import { env } from '../config/env.js';
import axios from 'axios';
import { getAssistantKnowledgeHealth, updateAssistantCategories } from '../services/knowledgeCategorizer.js';
import { getDefaultChecklist, getAllTemplates } from '../config/personaTemplates.js';
import { getToolsForTier, getToolsSystemPrompt, parseToolCall, executeToolCall } from '../services/actionRouter.js';
import { checkAssistantStatus } from '../middleware/statusCheck.js';

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
          website: parsed.website || undefined
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
  })).optional().default([])
});

const createAssistantSchema = z.object({
  name: z.string().min(1, 'Assistant name is required'),
  description: z.string().min(1, 'Description is required'),
  businessType: z.string().min(1, 'Business type is required'),
  personality: z.enum(['professional', 'friendly', 'expert', 'casual']),
  primaryGoal: z.string().min(1, 'Primary goal is required'),
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
router.get('/', async (_req, res) => {
  try {
    const rows = await db.query<AssistantRow>(
      'SELECT * FROM assistants ORDER BY created_at DESC'
    );

    const assistants = rows.map(row => ({
      ...parseAssistantRow(row),
      createdAt: row.created_at,
      status: 'active' as const,
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
router.post('/create', async (req, res) => {
  try {
    const validatedData = createAssistantSchema.parse(req.body);
    const assistantId = 'assistant-' + Date.now();

    const assistantRecord: AssistantData = {
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

    await db.execute(
      `INSERT INTO assistants (id, name, description, business_type, personality, primary_goal, website, data, knowledge_categories, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        assistantId,
        validatedData.name,
        validatedData.description,
        validatedData.businessType,
        validatedData.personality,
        validatedData.primaryGoal,
        validatedData.website || null,
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
    const validatedData = createAssistantSchema.parse(req.body);

    // Check assistant exists
    const existing = await db.queryOne<AssistantRow>(
      'SELECT id FROM assistants WHERE id = ?',
      [assistantId]
    );
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Assistant not found' });
    }

    const updatedRecord: AssistantData = {
      id: assistantId,
      name: validatedData.name,
      description: validatedData.description,
      businessType: validatedData.businessType,
      personality: validatedData.personality,
      primaryGoal: validatedData.primaryGoal,
      website: validatedData.website || undefined
    };

    await db.execute(
      `UPDATE assistants 
       SET name = ?, description = ?, business_type = ?, personality = ?, 
           primary_goal = ?, website = ?, data = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        validatedData.name,
        validatedData.description,
        validatedData.businessType,
        validatedData.personality,
        validatedData.primaryGoal,
        validatedData.website || null,
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
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.removeHeader('Content-Security-Policy');
  res.removeHeader('X-Content-Type-Options');
  
  const widgetScript = `(function() {
  // Extract assistant ID from script tag
  const scripts = document.getElementsByTagName('script');
  const currentScript = scripts[scripts.length - 1];
  const assistantId = currentScript.getAttribute('data-assistant-id');
  
  if (!assistantId) {
    console.error('Soft Aware Chat Widget: Missing data-assistant-id attribute');
    return;
  }

  // Detect protocol to avoid mixed content errors
  const protocol = window.location.protocol;
  const chatUrl = protocol === 'https:' 
    ? 'https://softaware.net.za/chat/' + assistantId
    : 'http://75.119.141.98:3001/chat/' + assistantId;

  // Create widget button
  const button = document.createElement('div');
  button.id = 'softaware-chat-button';
  button.innerHTML = '💬';
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
    transition: transform 0.2s;
  \`;
  
  button.onmouseover = () => button.style.transform = 'scale(1.1)';
  button.onmouseout = () => button.style.transform = 'scale(1)';
  
  // Create chat iframe
  const iframe = document.createElement('iframe');
  iframe.id = 'softaware-chat-iframe';
  iframe.src = chatUrl;
  iframe.style.cssText = \`
    position: fixed;
    bottom: 90px;
    right: 20px;
    width: 400px;
    height: 600px;
    border: none;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.2);
    z-index: 999998;
    display: none;
  \`;
  
  // Toggle chat
  let isOpen = false;
  button.onclick = () => {
    isOpen = !isOpen;
    iframe.style.display = isOpen ? 'block' : 'none';
    button.innerHTML = isOpen ? '✕' : '💬';
  };
  
  // Add to page
  document.body.appendChild(button);
  document.body.appendChild(iframe);
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
    const affected = await db.execute('DELETE FROM assistants WHERE id = ?', [assistantId]);
    
    if (affected === 0) {
      return res.status(404).json({ success: false, error: 'Assistant not found' });
    }
    
    return res.json({ success: true });
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
    const { assistantId, message, conversationHistory } = validatedData;

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
    const tier = row.tier || 'free';
    
    // Get enabled tools for this assistant
    let enabledTools: string[] | undefined;
    if (row.enabled_tools) {
      try {
        enabledTools = JSON.parse(row.enabled_tools);
      } catch {}
    }
    const tools = getToolsForTier(tier, enabledTools);
    const toolsPrompt = getToolsSystemPrompt(tools);

    // Build system prompt from assistant configuration
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
${toolsPrompt}
Remember: You represent ${assistant.name} and should respond as if you work for this ${assistant.businessType} business.`;

    // Build conversation messages for Ollama
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-10),
      { role: 'user', content: message }
    ];

    // Stream Ollama response back to client as Server-Sent Events
    // First token arrives in ~1-2s; client renders tokens as they stream in
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx/apache proxy buffering
    res.flushHeaders();

    const ollamaResponse = await axios.post(
      `${OLLAMA_API}/api/chat`,
      {
        model: CHAT_MODEL,
        messages,
        stream: true,
        keep_alive: KEEP_ALIVE === '-1' ? -1 : KEEP_ALIVE === '0' ? 0 : KEEP_ALIVE,
        options: {
          temperature: getTemperatureForPersonality(assistant.personality),
          top_p: 0.9,
          top_k: 40
        }
      },
      { responseType: 'stream', timeout: 90000 }
    );

    let fullResponse = '';
    let lineBuffer = '';
    let streamDone = false;

    ollamaResponse.data.on('data', (chunk: Buffer) => {
      lineBuffer += chunk.toString();
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          const token = parsed.message?.content ?? '';
          if (token) {
            fullResponse += token;
            res.write(`data: ${JSON.stringify({ token })}\n\n`);
          }
          if (parsed.done) {
            streamDone = true;
            console.log(`[Assistant ${assistantId}] User: ${message}`);
            console.log(`[Assistant ${assistantId}] Response: ${fullResponse.substring(0, 100)}...`);
          }
        } catch (_e) {
          // skip malformed JSON lines
        }
      }
    });

    ollamaResponse.data.on('end', async () => {
      if (!res.writableEnded) {
        // Check for tool call in the complete response
        const toolCall = parseToolCall(fullResponse);
        if (toolCall) {
          console.log(`[Assistant ${assistantId}] Tool call detected: ${toolCall.name}`);
          
          try {
            const toolResult = await executeToolCall(toolCall, assistantId, {
              name: assistant.name,
              tier,
              leadCaptureEmail: row.lead_capture_email || undefined,
              webhookUrl: row.webhook_url || undefined
            });
            
            res.write(`data: ${JSON.stringify({ 
              toolCall: {
                name: toolCall.name,
                success: toolResult.success,
                message: toolResult.message
              }
            })}\n\n`);
            
            console.log(`[Assistant ${assistantId}] Tool ${toolCall.name} result: ${toolResult.success ? 'success' : 'failed'}`);
          } catch (toolError) {
            console.error(`[Assistant ${assistantId}] Tool execution failed:`, toolError);
          }
        }
        
        res.write(`data: ${JSON.stringify({ done: true, model: CHAT_MODEL })}\n\n`);
        res.end();
      }
    });

    ollamaResponse.data.on('error', (err: Error) => {
      console.error(`[Assistant ${assistantId}] Stream error:`, err.message);
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
      }
    });

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