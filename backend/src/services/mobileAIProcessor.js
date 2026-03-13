/**
 * Mobile AI Processor — Ollama Conversation Workflow
 *
 * Receives the user's text (already transcribed by the device),
 * builds the conversation history, calls local Ollama with the
 * tool-augmented system prompt, and handles the iterative
 * tool-call ↔ tool-result loop until the LLM replies with
 * a plain-text answer.
 *
 * Conversation history is persisted in MySQL so users can
 * resume multi-turn conversations.
 */
import { db, toMySQLDate } from '../db/mysql.js';
import { parseToolCall } from './actionRouter.js';
import { chatCompletion, chatCompletionWithVision } from './assistantAIRouter.js';
import { getToolsForRole, getMobileToolsSystemPrompt } from './mobileTools.js';
import { executeMobileAction } from './mobileActionExecutor.js';
import { logAnonymizedChat } from '../utils/analyticsLogger.js';
import { randomUUID } from 'crypto';
// ============================================================================
// Configuration
// ============================================================================
/** Max tool-call round-trips per single request to prevent infinite loops */
const MAX_TOOL_ROUNDS = 5;
/** Max conversation history messages included in the prompt context */
const MAX_HISTORY_MESSAGES = 20;
// ============================================================================
// Conversation Persistence
// ============================================================================
async function getOrCreateConversation(conversationId, userId, userRole, assistantId) {
    if (conversationId) {
        // Verify the conversation belongs to this user
        const row = await db.queryOne('SELECT id FROM mobile_conversations WHERE id = ? AND user_id = ?', [conversationId, userId]);
        if (row)
            return row.id;
        // If not found, create a new one (don't error — just start fresh)
    }
    const id = randomUUID();
    await db.execute(`INSERT INTO mobile_conversations (id, user_id, assistant_id, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`, [id, userId, assistantId || null, userRole, toMySQLDate(new Date()), toMySQLDate(new Date())]);
    return id;
}
async function loadHistory(conversationId) {
    const rows = await db.query(`SELECT role, content FROM mobile_messages
     WHERE conversation_id = ?
     ORDER BY created_at ASC
     LIMIT ?`, [conversationId, MAX_HISTORY_MESSAGES]);
    return rows
        .filter((r) => r.role === 'user' || r.role === 'assistant')
        .map((r) => ({ role: r.role, content: r.content }));
}
async function saveMessage(conversationId, role, content, toolName) {
    await db.execute(`INSERT INTO mobile_messages (id, conversation_id, role, content, tool_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`, [randomUUID(), conversationId, role, content, toolName || null, toMySQLDate(new Date())]);
    // Touch conversation updated_at
    await db.execute('UPDATE mobile_conversations SET updated_at = ? WHERE id = ?', [toMySQLDate(new Date()), conversationId]);
}
// ============================================================================
// Main Processor
// ============================================================================
/**
 * Process a mobile AI assistant intent.
 *
 * 1. Resolve user role
 * 2. If assistantId provided, load assistant and stitch prompt
 * 3. Get/create conversation
 * 4. Load history
 * 5. Build system prompt: core_instructions + personality_flare + tool definitions
 * 6. Call Ollama
 * 7. If tool_call → execute → feed result → call Ollama again (up to MAX_TOOL_ROUNDS)
 * 8. Return plain-text reply
 */
export async function processMobileIntent(req, userId, userRole) {
    const ctx = { userId, role: userRole };
    const tools = getToolsForRole(userRole);
    const toolsPrompt = getMobileToolsSystemPrompt(tools);
    // --- Load assistant if selected (prompt stitching) ---
    let assistantRow = null;
    if (req.assistantId) {
        assistantRow = await loadAssistantPromptData(req.assistantId, userId, userRole);
        if (assistantRow) {
            // Pass software token context for task tools
            ctx.assistantId = req.assistantId;
        }
    }
    // --- THE PROMPT STITCHING (The Guardrail) ---
    const systemPrompt = buildStitchedPrompt(assistantRow, toolsPrompt, userRole);
    // Only use preferred_model override for Ollama (free tier).
    // For paid tier (OpenRouter), use the configured OPENROUTER_MODEL.
    const assistantTier = assistantRow?.tier || 'free';
    const modelOverride = assistantTier === 'paid' ? undefined : (assistantRow?.preferred_model || undefined);
    // --- Conversation setup ---
    const conversationId = await getOrCreateConversation(req.conversationId, userId, userRole, req.assistantId);
    const history = await loadHistory(conversationId);
    // Save the new user message
    await saveMessage(conversationId, 'user', req.text);
    // --- Build message chain for LLM ---
    const messages = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: req.text },
    ];
    // --- Iterative tool-call loop ---
    const toolsUsed = [];
    let lastToolData;
    let llmReply = '';
    let lastProvider = '';
    let lastModel = '';
    const hasImage = !!req.image;
    if (hasImage) {
        console.log(`[MobileAI] Image attached (${Math.round(req.image.length / 1024)}KB base64), routing to vision model`);
    }
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        let chatResult;
        if (hasImage && round === 0) {
            // Vision request — route to multimodal models
            const visionMessages = messages.map((m, idx) => ({
                role: m.role,
                content: m.content,
                // Attach images only to the latest user message
                ...(idx === messages.length - 1 && m.role === 'user' ? { images: [req.image] } : {}),
            }));
            chatResult = await chatCompletionWithVision(assistantTier, visionMessages, {
                temperature: 0.4,
                max_tokens: 1024,
            });
        }
        else {
            chatResult = await chatCompletion(assistantTier, messages, {
                temperature: 0.4,
                max_tokens: 1024,
            }, modelOverride);
        }
        llmReply = chatResult.content;
        lastProvider = chatResult.provider;
        lastModel = chatResult.model;
        if (round === 0)
            console.log(`[MobileAI] Provider: ${chatResult.provider}, Model: ${chatResult.model}${hasImage ? ' (vision)' : ''}`);
        // Check if the LLM wants to call a tool
        const toolCall = parseToolCall(llmReply);
        if (!toolCall) {
            // No tool call — this is the final conversational reply
            break;
        }
        // Execute the tool
        console.log(`[MobileAI] Round ${round + 1}: tool_call → ${toolCall.name}`);
        toolsUsed.push(toolCall.name);
        const result = await executeMobileAction(toolCall, ctx);
        if (result.data)
            lastToolData = result.data;
        // Feed the tool call + result back into the conversation
        messages.push({ role: 'assistant', content: llmReply });
        messages.push({
            role: 'user',
            content: `[Tool Result for ${toolCall.name}]: ${result.message}`,
        });
        // Save tool interaction in history
        await saveMessage(conversationId, 'tool', result.message, toolCall.name);
    }
    // --- Save final reply ---
    await saveMessage(conversationId, 'assistant', llmReply);
    // --- Anonymized telemetry (fire-and-forget) ---
    try {
        const clientId = req.assistantId || userId;
        logAnonymizedChat(clientId, req.text, llmReply, {
            source: 'assistant',
            model: lastModel,
            provider: lastProvider,
        });
    }
    catch (_e) { /* non-fatal */ }
    return {
        reply: llmReply,
        conversationId,
        toolsUsed,
        data: lastToolData,
    };
}
/**
 * Load the prompt-relevant columns from an assistant.
 * Verifies ownership for clients; staff can only access their own staff agent.
 */
async function loadAssistantPromptData(assistantId, userId, role) {
    const row = await db.queryOne(`SELECT id, name, COALESCE(tier,'free') AS tier, core_instructions, personality_flare, custom_greeting,
            preferred_model, is_staff_agent, is_primary, personality, primary_goal
     FROM assistants WHERE id = ? AND userId = ?`, [assistantId, userId]);
    return row || null;
}
/** Default strict core for staff assistants */
const STAFF_CORE_DEFAULT = `You are a Soft Aware administrative assistant. You have access to secure system tools for managing clients, assistants, development tasks, bug tracking, support cases, CRM contacts, quotations, invoices, pricing, scheduled calls, and team chat. You MUST use these tools when the user requests an action. Never reveal your internal tool names or JSON schemas to the user. Always confirm destructive actions before executing them.

VOICE INTERACTION:
- Users interact with you via voice (speech-to-text). Your replies are read aloud via text-to-speech.
- If someone says "can you hear me?", "is this working?", "hello?", or tests their mic — YES, you can receive their voice input. Respond warmly: "Yes, I can hear you! How can I help?"
- Do NOT say you are text-only, cannot hear, or lack audio capabilities. The user's speech is transcribed to text for you, and your text reply is spoken back to them.
- Do NOT use markdown formatting (no asterisks, underscores, hash symbols, backticks, or bullet symbols). Write in plain natural sentences since your response will be spoken aloud.
- Use commas and periods for pauses instead of bullet points or numbered lists.
- Say "dash" or skip the character entirely instead of using hyphens as list markers.`;
/** Default strict core for client assistants */
const CLIENT_CORE_DEFAULT = `You are a Soft Aware account assistant. You help the user manage their AI assistants, monitor usage, troubleshoot ingestion issues, manage their website leads, send follow-up emails, and make changes to their generated landing page. You have access to self-service tools. Use them when the user requests an action. Never reveal tool names or JSON schemas. When a user asks about their leads or form submissions, use the lead tools. When they want to change their website details (phone, email, about text), use the site tools and remind them to regenerate and deploy afterwards.

VOICE INTERACTION:
- Users interact with you via voice (speech-to-text). Your replies are read aloud via text-to-speech.
- If someone says "can you hear me?", "is this working?", or tests their mic — YES, you can receive their voice input. Respond warmly.
- Do NOT say you are text-only or cannot hear. The user's speech is transcribed for you and your reply is spoken back.
- Do NOT use markdown formatting (no asterisks, hash symbols, backticks, or bullet symbols). Write in plain natural sentences.
- Use commas and periods for pauses instead of bullet points or numbered lists.`;
/**
 * THE PROMPT STITCHING — The Guardrail.
 *
 * Assembles the final system prompt by concatenating:
 *   1. core_instructions (hidden from GUI, enforced by backend)
 *   2. personality_flare (fun stuff from the GUI)
 *   3. tool definitions (injected dynamically by role, never from DB)
 *
 * This ensures a staff member can type "You are a sarcastic pirate named
 * Blackbeard" into their GUI, and the AI will still successfully execute
 * admin tools — it'll just confirm actions using sea shanties.
 */
function buildStitchedPrompt(assistant, toolsPrompt, role) {
    // Determine the core instructions
    let adminCore;
    if (assistant?.core_instructions) {
        adminCore = assistant.core_instructions;
    }
    else if (role === 'staff') {
        adminCore = STAFF_CORE_DEFAULT;
    }
    else {
        adminCore = CLIENT_CORE_DEFAULT;
    }
    // Determine personality flare
    let personalityFlare = 'Be helpful, concise, and professional.';
    if (assistant?.personality_flare) {
        personalityFlare = assistant.personality_flare;
    }
    else if (assistant?.personality) {
        // Fall back to legacy personality column
        const personalities = {
            professional: 'Be professional, clear, and authoritative.',
            friendly: 'Be warm, friendly, and conversational.',
            expert: 'Be precise, technical, and data-driven.',
            casual: 'Be relaxed, casual, and approachable.',
        };
        personalityFlare = personalities[assistant.personality] || personalityFlare;
    }
    // Optional assistant identity
    const identity = assistant
        ? `Your name is "${assistant.name}".${assistant.primary_goal ? ` Your primary goal: ${assistant.primary_goal}` : ''}`
        : '';
    // The concatenation
    return `${adminCore}

${identity}

CRITICAL INSTRUCTION FOR TONE AND PERSONALITY:
${personalityFlare}

${toolsPrompt}`.trim();
}
// ============================================================================
// Role Resolution
// ============================================================================
const STAFF_SLUGS = new Set([
    'admin', 'super_admin', 'developer', 'client_manager', 'qa_specialist', 'deployer',
]);
/**
 * Determine whether a user is 'staff' or 'client' by querying the
 * user_roles + roles tables.
 */
export async function resolveUserRole(userId) {
    const rows = await db.query(`SELECT r.slug
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci`, [userId]);
    for (const row of rows) {
        if (STAFF_SLUGS.has(row.slug))
            return 'staff';
    }
    return 'client';
}
