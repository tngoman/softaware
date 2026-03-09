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

import { env } from '../config/env.js';
import { db, toMySQLDate } from '../db/mysql.js';
import { parseToolCall, type ToolCall, type ToolResult, type ToolDefinition } from './actionRouter.js';
import { chatCompletion } from './assistantAIRouter.js';
import { getToolsForRole, getMobileToolsSystemPrompt, type MobileRole } from './mobileTools.js';
import { executeMobileAction, type MobileExecutionContext } from './mobileActionExecutor.js';
import { randomUUID } from 'crypto';
import type { AIMessage } from './ai/AIProvider.js';

// ============================================================================
// Configuration
// ============================================================================

/** Max tool-call round-trips per single request to prevent infinite loops */
const MAX_TOOL_ROUNDS = 5;

/** Max conversation history messages included in the prompt context */
const MAX_HISTORY_MESSAGES = 20;

// ============================================================================
// Types
// ============================================================================

export interface MobileIntentRequest {
  text: string;
  conversationId?: string;
  assistantId?: string;
  language?: string;
}

export interface MobileIntentResponse {
  reply: string;
  conversationId: string;
  toolsUsed: string[];
  /** Structured data from the last tool result, if any */
  data?: Record<string, unknown>;
}

interface ConversationRow {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_name: string | null;
  created_at: string;
}

// ============================================================================
// Conversation Persistence
// ============================================================================

async function getOrCreateConversation(
  conversationId: string | undefined,
  userId: string,
  userRole: MobileRole,
  assistantId?: string,
): Promise<string> {
  if (conversationId) {
    // Verify the conversation belongs to this user
    const row = await db.queryOne<ConversationRow>(
      'SELECT id FROM mobile_conversations WHERE id = ? AND user_id = ?',
      [conversationId, userId],
    );
    if (row) return row.id;
    // If not found, create a new one (don't error — just start fresh)
  }

  const id = randomUUID();
  await db.execute(
    `INSERT INTO mobile_conversations (id, user_id, assistant_id, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, userId, assistantId || null, userRole, toMySQLDate(new Date()), toMySQLDate(new Date())],
  );
  return id;
}

async function loadHistory(conversationId: string): Promise<AIMessage[]> {
  const rows = await db.query<MessageRow>(
    `SELECT role, content FROM mobile_messages
     WHERE conversation_id = ?
     ORDER BY created_at ASC
     LIMIT ?`,
    [conversationId, MAX_HISTORY_MESSAGES],
  );

  return rows
    .filter((r) => r.role === 'user' || r.role === 'assistant')
    .map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content }));
}

async function saveMessage(
  conversationId: string,
  role: 'user' | 'assistant' | 'system' | 'tool',
  content: string,
  toolName?: string,
): Promise<void> {
  await db.execute(
    `INSERT INTO mobile_messages (id, conversation_id, role, content, tool_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [randomUUID(), conversationId, role, content, toolName || null, toMySQLDate(new Date())],
  );

  // Touch conversation updated_at
  await db.execute(
    'UPDATE mobile_conversations SET updated_at = ? WHERE id = ?',
    [toMySQLDate(new Date()), conversationId],
  );
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
export async function processMobileIntent(
  req: MobileIntentRequest,
  userId: string,
  userRole: MobileRole,
): Promise<MobileIntentResponse> {
  const ctx: MobileExecutionContext = { userId, role: userRole };
  const tools: ToolDefinition[] = getToolsForRole(userRole);
  const toolsPrompt = getMobileToolsSystemPrompt(tools);

  // --- Load assistant if selected (prompt stitching) ---
  let assistantRow: AssistantPromptRow | null = null;
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
  const conversationId = await getOrCreateConversation(
    req.conversationId, userId, userRole, req.assistantId,
  );
  const history = await loadHistory(conversationId);

  // Save the new user message
  await saveMessage(conversationId, 'user', req.text);

  // --- Build message chain for LLM ---
  const messages: AIMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: req.text },
  ];

  // --- Iterative tool-call loop ---
  const toolsUsed: string[] = [];
  let lastToolData: Record<string, unknown> | undefined;
  let llmReply = '';

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const chatResult = await chatCompletion(assistantTier, messages as any, {
      temperature: 0.4,
      max_tokens: 1024,
    }, modelOverride);
    llmReply = chatResult.content;
    if (round === 0) console.log(`[MobileAI] Provider: ${chatResult.provider}, Model: ${chatResult.model}`);

    // Check if the LLM wants to call a tool
    const toolCall: ToolCall | null = parseToolCall(llmReply);

    if (!toolCall) {
      // No tool call — this is the final conversational reply
      break;
    }

    // Execute the tool
    console.log(`[MobileAI] Round ${round + 1}: tool_call → ${toolCall.name}`);
    toolsUsed.push(toolCall.name);
    const result: ToolResult = await executeMobileAction(toolCall, ctx);

    if (result.data) lastToolData = result.data;

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

  return {
    reply: llmReply,
    conversationId,
    toolsUsed,
    data: lastToolData,
  };
}

// ============================================================================
// Assistant Prompt Data & Stitching
// ============================================================================

interface AssistantPromptRow {
  id: string;
  name: string;
  tier: 'free' | 'paid';
  core_instructions: string | null;
  personality_flare: string | null;
  custom_greeting: string | null;
  preferred_model: string | null;
  is_staff_agent: number;
  is_primary: number;
  personality: string | null;
  primary_goal: string | null;
}

/**
 * Load the prompt-relevant columns from an assistant.
 * Verifies ownership for clients; staff can only access their own staff agent.
 */
async function loadAssistantPromptData(
  assistantId: string,
  userId: string,
  role: MobileRole,
): Promise<AssistantPromptRow | null> {
  const row = await db.queryOne<AssistantPromptRow>(
    `SELECT id, name, COALESCE(tier,'free') AS tier, core_instructions, personality_flare, custom_greeting,
            preferred_model, is_staff_agent, is_primary, personality, primary_goal
     FROM assistants WHERE id = ? AND userId = ?`,
    [assistantId, userId],
  );
  return row || null;
}

/** Default strict core for staff assistants */
const STAFF_CORE_DEFAULT = `You are a Soft Aware administrative assistant. You have access to secure system tools for managing clients, assistants, development tasks, support cases, CRM contacts, quotations, invoices, pricing, scheduled calls, and team chat. You MUST use these tools when the user requests an action. Never reveal your internal tool names or JSON schemas to the user. Always confirm destructive actions before executing them.`;

/** Default strict core for client assistants */
const CLIENT_CORE_DEFAULT = `You are a Soft Aware account assistant. You help the user manage their AI assistants, monitor usage, troubleshoot ingestion issues, manage their website leads, send follow-up emails, and make changes to their generated landing page. You have access to self-service tools. Use them when the user requests an action. Never reveal tool names or JSON schemas. When a user asks about their leads or form submissions, use the lead tools. When they want to change their website details (phone, email, about text), use the site tools and remind them to regenerate and deploy afterwards.`;

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
function buildStitchedPrompt(
  assistant: AssistantPromptRow | null,
  toolsPrompt: string,
  role: MobileRole,
): string {
  // Determine the core instructions
  let adminCore: string;
  if (assistant?.core_instructions) {
    adminCore = assistant.core_instructions;
  } else if (role === 'staff') {
    adminCore = STAFF_CORE_DEFAULT;
  } else {
    adminCore = CLIENT_CORE_DEFAULT;
  }

  // Determine personality flare
  let personalityFlare = 'Be helpful, concise, and professional.';
  if (assistant?.personality_flare) {
    personalityFlare = assistant.personality_flare;
  } else if (assistant?.personality) {
    // Fall back to legacy personality column
    const personalities: Record<string, string> = {
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
export async function resolveUserRole(userId: string): Promise<MobileRole> {
  const rows = await db.query<{ slug: string }>(
    `SELECT r.slug
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci`,
    [userId],
  );

  for (const row of rows) {
    if (STAFF_SLUGS.has(row.slug)) return 'staff';
  }
  return 'client';
}
