import express from 'express';
import { widgetService } from '../services/widgetService.js';
import { embeddingService, generateEmbedding } from '../services/embeddingService.js';
import { enforceMessageLimit } from '../middleware/usageTracking.js';
import { checkWidgetStatus } from '../middleware/statusCheck.js';
import { parseLeadCapture, storeCapturedLead, sendLeadNotification, buildLeadCapturePrompt } from '../services/leadCaptureService.js';
import { chatCompletion } from '../services/assistantAIRouter.js';
import axios from 'axios';

const router = express.Router();

const OLLAMA_API = process.env.OLLAMA_API || 'http://localhost:11434';
const CHAT_MODEL = process.env.WIDGET_OLLAMA_MODEL || 'qwen2.5:1.5b-instruct';

// Tone preset templates
const TONE_PRESETS: Record<string, string> = {
  professional: 'Maintain a professional, business-appropriate tone. Be clear and direct.',
  friendly: 'Be warm, conversational, and approachable. Use a friendly, casual tone.',
  technical: 'Use precise technical language. Assume the user has domain knowledge.',
  sales: 'Be enthusiastic and persuasive. Focus on benefits and value propositions.',
  legal: 'Use formal, precise language. Be thorough and careful with terminology.',
  medical: 'Be empathetic and professional. Use clear, patient-friendly language.',
  luxury: 'Be sophisticated and refined. Emphasize quality, exclusivity, and premium service.'
};

/**
 * POST /api/v1/chat
 * 
 * Chat with RAG-powered widget assistant (Tier-based routing)
 * 
 * Body:
 *   - clientId: string (widget client ID)
 *   - message: string (user's question)
 *   - conversationHistory?: Array<{role, content}> (optional)
 * 
 * Routing Logic:
 *   - Free/Starter: qwen2.5:3b (local, fast)
 *   - Advanced: qwen2.5:7b (local, smarter) OR external API
 *   - Enterprise: Custom routing + Loopback API access
 */
router.post('/chat', checkWidgetStatus, enforceMessageLimit, async (req, res) => {
  try {
    const { clientId, message, conversationHistory = [] } = req.body;

    if (!clientId || !message) {
      return res.status(400).json({ error: 'clientId and message are required' });
    }

    // Get widget client with subscription tier
    const client = await widgetService.getClientByIdWithTier(clientId);
    if (!client) {
      return res.status(404).json({ error: 'Widget client not found' });
    }

    // Generate embedding for user's question
    const queryEmbedding = await generateEmbedding(message);

    // Search for relevant context (RAG retrieval)
    const relevantDocs = await embeddingService.searchSimilar(clientId, queryEmbedding, 5);

    // Build context from retrieved documents
    const context = relevantDocs.length > 0
      ? relevantDocs.map((doc, idx) => `[Context ${idx + 1}]:\n${doc.content}`).join('\n\n')
      : 'No relevant information found in the knowledge base.';

    // Build base system prompt with RAG context
    let systemPrompt = `You are a helpful AI assistant for ${client.website_url}.

You have access to the following information from the website's knowledge base:

${context}

Answer the user's question based on this context. If the context doesn't contain relevant information, politely say you don't have that information and suggest contacting the website directly.`;

    // Add tone control for Advanced tier
    if (client.subscription_tier === 'advanced' || client.subscription_tier === 'enterprise') {
      const toneInstructions = client.custom_tone_instructions 
        || TONE_PRESETS[client.tone_preset || 'professional']
        || TONE_PRESETS.professional;
      
      systemPrompt += `\n\nTONE & STYLE:\n${toneInstructions}`;
    }

    // Add lead capture instructions for Advanced tier
    if ((client.subscription_tier === 'advanced' || client.subscription_tier === 'enterprise') 
        && client.lead_capture_enabled) {
      systemPrompt += `\n\n${buildLeadCapturePrompt()}`;
    }

    // Build conversation messages
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: message }
    ];

    // Determine which model/provider to use based on tier
    const isPaidTier = client.subscription_tier === 'advanced' || client.subscription_tier === 'enterprise';
    let modelToUse = CHAT_MODEL; // Free/Starter default (local Ollama)
    let providerUsed = 'ollama';

    let assistantMessage: string;

    if (isPaidTier && client.external_api_provider) {
      // Client has configured their own external API (Gemini, Claude, etc.)
      assistantMessage = await callExternalLLM(
        client.external_api_provider,
        client.external_api_key_encrypted,
        messages
      );
      modelToUse = client.external_api_provider;
      providerUsed = client.external_api_provider;
    } else {
      // Route through assistantAIRouter with tier-based fallback:
      //   Paid:  GLM → OpenRouter → Ollama
      //   Free:  GLM → Ollama
      const tier = isPaidTier ? 'paid' : 'free';
      const result = await chatCompletion(tier, messages as any, {
        temperature: 0.4,
        max_tokens: 2048,
      });
      assistantMessage = result.content;
      modelToUse = result.model;
      providerUsed = result.provider;
    }

    // Check for lead capture
    let leadCaptured = false;
    const leadCapture = parseLeadCapture(assistantMessage);
    
    if (leadCapture && leadCapture.action === 'capture_lead' && leadCapture.leadData) {
      // Store lead
      await storeCapturedLead(
        clientId,
        leadCapture.leadData,
        JSON.stringify(conversationHistory.slice(-5)) // Last 5 messages for context
      );
      
      // Send notification email
      await sendLeadNotification(
        clientId,
        leadCapture.leadData,
        client.business_name || client.website_url
      );
      
      leadCaptured = true;
      assistantMessage = leadCapture.message; // Clean message without JSON
    }

    // Log chat messages
    await widgetService.logChatMessage({
      clientId,
      role: 'user',
      content: message
    });
    await widgetService.logChatMessage({
      clientId,
      role: 'assistant',
      content: assistantMessage
    });

    // Build response
    const response: any = {
      success: true,
      message: assistantMessage,
      relevantDocsFound: relevantDocs.length,
      model: modelToUse,
      tier: client.subscription_tier
    };

    // Hide branding for paid tiers
    if (client.subscription_tier === 'free') {
      response.poweredBy = 'Soft Aware';
    }

    // Add lead capture confirmation
    if (leadCaptured) {
      response.leadCaptured = true;
      response.confirmation = "Thank you! We've received your information and will be in touch shortly.";
    }

    return res.json(response);

  } catch (error) {
    console.error('Widget chat error:', error);
    return res.status(500).json({
      error: 'Failed to process chat message',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Call external LLM API (Gemini, Claude, etc.)
 */
async function callExternalLLM(
  provider: string,
  encryptedKey: string,
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  // Decrypt API key
  const { decryptPassword } = await import('../utils/cryptoUtils.js');
  const apiKey = decryptPassword(encryptedKey);

  try {
    switch (provider.toLowerCase()) {
      case 'gemini':
        return await callGeminiAPI(apiKey, messages);
      case 'claude':
        return await callClaudeAPI(apiKey, messages);
      default:
        throw new Error(`Unsupported external provider: ${provider}`);
    }
  } finally {
    // Clear API key from memory
    apiKey.split('').fill('0');
  }
}

/**
 * Call Google Gemini API
 */
async function callGeminiAPI(
  apiKey: string,
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
  
  // Convert messages to Gemini format
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
  
  // Add system instruction
  const systemMessage = messages.find(m => m.role === 'system');
  
  const response = await axios.post(
    `${API_URL}?key=${apiKey}`,
    {
      contents,
      systemInstruction: systemMessage ? {
        parts: [{ text: systemMessage.content }]
      } : undefined
    },
    { timeout: 30000 }
  );
  
  return response.data.candidates[0].content.parts[0].text;
}

/**
 * Call Anthropic Claude API
 */
async function callClaudeAPI(
  apiKey: string,
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const API_URL = 'https://api.anthropic.com/v1/messages';
  
  // Separate system message
  const systemMessage = messages.find(m => m.role === 'system');
  const conversationMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }));
  
  const response = await axios.post(
    API_URL,
    {
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      system: systemMessage?.content,
      messages: conversationMessages
    },
    {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      timeout: 30000
    }
  );
  
  return response.data.content[0].text;
}

/**
 * GET /api/v1/client/:clientId/status
 * 
 * Get widget client status and usage stats
 */
router.get('/client/:clientId/status', async (req, res) => {
  try {
    const { clientId } = req.params;

    const client = await widgetService.getClientById(clientId);
    if (!client) {
      return res.status(404).json({ error: 'Widget client not found' });
    }

    const stats = await widgetService.getUsageStats(clientId);

    return res.json({
      success: true,
      client: {
        id: client.id,
        websiteUrl: client.website_url,
        widgetColor: client.widget_color,
        status: client.status
      },
      usage: stats,
      limits: {
        messages: 500,
        pages: 50
      }
    });

  } catch (error) {
    console.error('Status check error:', error);
    return res.status(500).json({
      error: 'Failed to fetch client status'
    });
  }
});

export default router;
