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
import { parseToolCall, stripToolCallJson, type ToolCall, type ToolResult, type ToolDefinition } from './actionRouter.js';
import { chatCompletion, chatCompletionWithVision, type VisionChatMessage } from './assistantAIRouter.js';
import { resolveModelTier } from './packageResolver.js';
import { getToolsForRole, getMobileToolsSystemPrompt, type MobileRole } from './mobileTools.js';
import { executeMobileAction, type MobileExecutionContext } from './mobileActionExecutor.js';
import { getStudioTools, getStudioToolsPrompt, STUDIO_CONTEXT_INSTRUCTIONS } from './studioAITools.js';
import { getConfigsByContactId } from './clientApiGateway.js';
import { getEndpoint } from './enterpriseEndpoints.js';
import { logAnonymizedChat } from '../utils/analyticsLogger.js';
import { checkVisionAccess } from '../middleware/packageEnforcement.js';
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
  /** Base64 data-URI of an attached image (data:image/png;base64,...) */
  image?: string;
  /** Studio context — when set to 'studio', injects design tools + creative prompt */
  context?: 'studio' | 'default';
  /** Active site ID when in studio context */
  siteId?: string;
  /** Additional context payload from Studio (selected component, viewport, etc.) */
  studioContext?: {
    selectedComponent?: { id: string; type: string; html: string; css: string };
    viewport?: 'desktop' | 'tablet' | 'mobile';
    siteContext?: { businessName: string; industry: string; colorPalette: string[]; pageCount: number; currentPageType: string };
  };
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
  content: string | null | undefined,
  toolName?: string,
): Promise<void> {
  const safeContent = content || (toolName ? `[${toolName} returned no output]` : '[empty]');
  await db.execute(
    `INSERT INTO mobile_messages (id, conversation_id, role, content, tool_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [randomUUID(), conversationId, role, safeContent, toolName || null, toMySQLDate(new Date())],
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
  
  // Check developer tools config
  const userObj = await db.queryOne<{ai_developer_tools_granted: number}>('SELECT ai_developer_tools_granted FROM users WHERE id = ?', [userId]);
  const isDev = !!userObj?.ai_developer_tools_granted;
  
  let tools: ToolDefinition[] = getToolsForRole(userRole, isDev);
  let toolsPrompt = getMobileToolsSystemPrompt(tools);

  // --- STUDIO CONTEXT INJECTION ---
  // When the request originates from Softaware Studio, inject additional
  // design/site/data tools and augment the system prompt with creative instructions.
  const isStudioContext = req.context === 'studio';
  if (isStudioContext && userRole === 'staff') {
    const studioTools = getStudioTools();
    tools = [...tools, ...studioTools];
    toolsPrompt += '\n' + getStudioToolsPrompt(studioTools);
  }

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
  let systemPrompt = buildStitchedPrompt(assistantRow, toolsPrompt, userRole, isDev);

  // --- STUDIO CONTEXT AUGMENTATION ---
  // Append studio creative instructions + active design context when in studio mode.
  if (isStudioContext && userRole === 'staff') {
    systemPrompt += '\n\n' + STUDIO_CONTEXT_INSTRUCTIONS;
    if (req.studioContext) {
      const sc = req.studioContext;
      let contextBlock = '\nCURRENT STUDIO STATE:';
      if (sc.viewport) contextBlock += `\nViewport: ${sc.viewport}`;
      if (sc.siteContext) {
        contextBlock += `\nBusiness: ${sc.siteContext.businessName}`;
        if (sc.siteContext.industry) contextBlock += ` (${sc.siteContext.industry})`;
        if (sc.siteContext.colorPalette?.length) contextBlock += `\nColor palette: ${sc.siteContext.colorPalette.join(', ')}`;
        contextBlock += `\nPages: ${sc.siteContext.pageCount}, Current page type: ${sc.siteContext.currentPageType}`;
      }
      if (sc.selectedComponent) {
        contextBlock += `\nSelected component: [${sc.selectedComponent.type}] id="${sc.selectedComponent.id}"`;
        contextBlock += `\nComponent HTML:\n${sc.selectedComponent.html.slice(0, 2000)}`;
        if (sc.selectedComponent.css) contextBlock += `\nComponent CSS:\n${sc.selectedComponent.css.slice(0, 1000)}`;
      }
      systemPrompt += contextBlock;
    }
  }

  // --- GATEWAY CONTEXT INJECTION ---
  // If this client user has gateway configs (client_api_configs rows for their contact_id),
  // they are a gateway client (e.g. Braai Online). Override the prompt so the AI acts as
  // their business assistant, not a generic Soft Aware website assistant.
  if (userRole === 'client') {
    try {
      const userRow = await db.queryOne<{ contact_id: number | null }>(
        'SELECT contact_id FROM users WHERE id = ?',
        [userId],
      );
      if (userRow?.contact_id) {
        const gwConfigs = getConfigsByContactId(userRow.contact_id);
        if (gwConfigs.length > 0) {
          // Collect all allowed gateway tools across all configs
          const allTools: string[] = [];
          let clientId = '';
          let clientName = '';
          let richSchemas: any[] | null = null;
          for (const gc of gwConfigs) {
            if (!clientId) clientId = gc.client_id;
            if (!clientName) clientName = gc.client_name;
            try { allTools.push(...JSON.parse(gc.allowed_actions || '[]')); } catch {}
            // Load rich tool schemas from linked enterprise endpoint
            if (!richSchemas && gc.endpoint_id) {
              try {
                const ep = getEndpoint(gc.endpoint_id);
                if (ep?.llm_tools_config) richSchemas = JSON.parse(ep.llm_tools_config);
              } catch {}
            }
          }

          if (allTools.length > 0) {
            ctx.gatewayTools = allTools;
            ctx.gatewayClientId = clientId;

            // Build detailed tool signatures from rich schemas, or fall back to names
            const gatewayToolsBlock = richSchemas
              ? buildMobileGatewayToolsPrompt(richSchemas)
              : `GATEWAY TOOLS: ${allTools.join(', ')}`;

            // Build a gateway-aware assistant name, preserving assistant identity
            const assistantName = assistantRow?.name || clientName || 'Business Assistant';
            const personalityLine = assistantRow?.personality_flare
              || (assistantRow?.personality ? `Be ${assistantRow.personality}.` : 'Be helpful, professional, and to the point.');
            const goalLine = assistantRow?.primary_goal ? `Your primary goal: ${assistantRow.primary_goal}` : '';

            // Preserve the assistant's identity while adding gateway capabilities
            systemPrompt = `You are ${assistantName}, a business assistant for ${clientName}.
${goalLine}

${personalityLine}

${gatewayToolsBlock}

To call an action, respond with ONLY this JSON, nothing else before or after:
{"tool_call": {"name": "ACTION_NAME", "arguments": {…}}}

CRITICAL RULES:
- Output ONLY the JSON object when calling a tool. No text before it. No text after it.
- Use EXACTLY the parameter names listed above. Do not invent alternatives.
- The system executes the action and feeds you the result automatically.
- NEVER write "[Executed ...]" text. Only the system executes actions.
- Keep replies short and direct. 1-2 sentences for greetings and simple questions.
- Only list capabilities when the user explicitly asks what you can do.
- Resolve branch names to branch_id via listBranches before using branch_id in other calls.
- Resolve product names to product_id and price via searchProducts before calling createOrder.
- Do NOT guess or fabricate IDs. Always look them up first.
- For walk-in or anonymous customers, omit user_id, user_phone, user_email from createOrder.

VOICE INTERACTION:
- Users interact via voice (speech-to-text). Your replies are read aloud via text-to-speech.
- If someone tests their mic, respond warmly. You CAN receive their voice input.
- Do NOT say you are text-only or cannot hear.
- Do NOT use markdown formatting. Write in plain natural sentences.
- Use commas and periods for pauses instead of bullet points or numbered lists.

${toolsPrompt}`.trim();

            console.log(`[MobileAI] Gateway detected: ${clientId} (${clientName}) — ${allTools.length} tools, schemas: ${richSchemas ? 'rich' : 'names-only'}`);
          }
        }
      }
    } catch (gwErr) {
      console.warn(`[MobileAI] Gateway context lookup failed:`, (gwErr as Error).message);
    }
  }

  // Resolve model tier from the user's package (pro/advanced/enterprise → 'paid').
  // Trial users get the paid model chain but their usage limits stay at free tier.
  const assistantTier = await resolveModelTier(userId);
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
  let lastProvider = '';
  let lastModel = '';
  const hasImage = !!req.image;
  if (hasImage) {
    console.log(`[MobileAI] Image attached (${Math.round(req.image!.length / 1024)}KB base64), routing to vision model`);

    // ── Vision hard gate: only Advanced+ packages can process files ──
    const userRow = await db.queryOne<{ contact_id: number | null }>(
      'SELECT contact_id FROM users WHERE id = ?',
      [userId],
    );
    if (userRow?.contact_id) {
      const visionCheck = await checkVisionAccess(userRow.contact_id);
      if (!visionCheck.allowed) {
        console.log(`[MobileAI] Vision blocked for user ${userId}: ${visionCheck.reason}`);
        return {
          reply: 'Image analysis requires an Advanced or Enterprise package. Please upgrade to unlock vision capabilities.',
          conversationId,
          toolsUsed: [],
        };
      }
    }
  }

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let chatResult: { content: string; model: string; provider: string };

    if (hasImage && round === 0) {
      // Vision request — route to multimodal models
      const visionMessages: VisionChatMessage[] = messages.map((m, idx) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
        // Attach images only to the latest user message
        ...(idx === messages.length - 1 && m.role === 'user' ? { images: [req.image!] } : {}),
      }));
      chatResult = await chatCompletionWithVision(assistantTier, visionMessages, {
        temperature: 0.4,
        max_tokens: 1024,
      });
    } else {
      chatResult = await chatCompletion(assistantTier, messages as any, {
        temperature: 0.4,
        max_tokens: 1024,
      }, modelOverride);
    }

    llmReply = chatResult.content;
    lastProvider = chatResult.provider;
    lastModel = chatResult.model;
    if (round === 0) console.log(`[MobileAI] Provider: ${chatResult.provider}, Model: ${chatResult.model}${hasImage ? ' (vision)' : ''}`);

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

    // Ensure we always have a string for the tool result
    const toolResultMsg = result.message || (result as any).error || `[${toolCall.name} completed with no output]`;

    // Strip tool call JSON from the reply so conversation history is clean
    const cleanedAssistantMsg = stripToolCallJson(llmReply);

    // Feed the tool call + result back into the conversation
    if (cleanedAssistantMsg) {
      messages.push({ role: 'assistant', content: cleanedAssistantMsg });
    }
    messages.push({
      role: 'user',
      content: `[Tool Result for ${toolCall.name}]: ${toolResultMsg}`,
    });

    // Save tool interaction in history
    if (cleanedAssistantMsg) {
      await saveMessage(conversationId, 'assistant', cleanedAssistantMsg);
    }
    await saveMessage(conversationId, 'tool', toolResultMsg, toolCall.name);
  }

  // --- Clean and save final reply ---
  llmReply = stripToolCallJson(llmReply);
  await saveMessage(conversationId, 'assistant', llmReply);

  // --- Anonymized telemetry (fire-and-forget) ---
  try {
    const clientId = req.assistantId || userId;
    logAnonymizedChat(clientId, req.text, llmReply, {
      source: 'assistant',
      model: lastModel,
      provider: lastProvider,
    });
  } catch (_e) { /* non-fatal */ }

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
function buildStitchedPrompt(
  assistant: AssistantPromptRow | null,
  toolsPrompt: string,
  role: MobileRole,
  isDev: boolean = false,
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

  // Developer workflow instructions — injected when user has AI dev tools granted
  const devInstructions = isDev ? `

DEVELOPER WORKFLOW — CRITICAL RULES:
You have access to developer tools for reading and modifying codebases. This is a TEXT-BASED chat interface (not voice). You MUST use markdown formatting, code blocks, and structured text in your responses.

FORMATTING RULES:
- ALWAYS wrap code in fenced code blocks with the language identifier, e.g. \`\`\`php, \`\`\`javascript, \`\`\`python, \`\`\`diff
- When showing file contents, ALWAYS include the filename as a bold heading above the code block
- When showing changes, ALWAYS present a clear BEFORE and AFTER comparison:
  1. Show "**Before** (filename)" followed by the original code in a fenced code block
  2. Show "**After** (filename)" followed by the modified code in a fenced code block  
  3. Explain what changed and why between them
- For diffs, use \`\`\`diff blocks where + lines are additions and - lines are removals
- Use headings (##, ###) to organize your analysis
- Use bullet points for lists of findings
- Use **bold** for emphasis on important terms
- Use \`inline code\` for function names, variable names, file paths

When helping with bug fixes, you MUST follow this workflow:
1. EXPLORE FIRST: Use list_codebase_files to understand the project structure.
2. SEARCH: Use search_codebase to find relevant code (controllers, routes, models, views) related to the bug.
3. READ: Use read_codebase_file to read the ACTUAL source code of the files involved. NEVER guess or fabricate file contents.
4. ANALYSE: Explain to the user what you found, what the root cause is, and what your proposed fix is. Wait for the user to agree before modifying.
5. MODIFY: Only after reading the actual code and getting user approval, use modify_codebase to apply the fix. The content MUST be based on the real file content with only the necessary changes.
6. VERIFY: Ask the user to test the fix. Only commit after confirmation.

NEVER skip steps 1-3. NEVER fabricate code you haven't read. NEVER rewrite entire files from scratch — make targeted, minimal changes to fix the specific bug.` : '';

  // The concatenation
  return `${adminCore}

${identity}

CRITICAL INSTRUCTION FOR TONE AND PERSONALITY:
${personalityFlare}${devInstructions}

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

/**
 * Build a detailed tool-calling prompt from rich OpenAI-format schemas.
 * Same format as the widget path's buildGatewayToolsPromptFromSchemas.
 */
function buildMobileGatewayToolsPrompt(schemas: any[]): string {
  const toolLines = schemas.map(schema => {
    const fn = schema.function || schema;
    const name = fn.name || 'unknown';
    const desc = fn.description || '';
    const params = fn.parameters?.properties || {};
    const required: string[] = fn.parameters?.required || [];

    const paramParts = Object.entries(params).map(([pname, pdef]: [string, any]) => {
      const req = required.includes(pname) ? ' *required*' : '';
      return `    ${pname} (${pdef.type || 'string'}${req}): ${pdef.description || ''}`;
    });

    if (paramParts.length === 0) return `- ${name}: ${desc} (no arguments)`;
    return `- ${name}: ${desc}\n${paramParts.join('\n')}`;
  }).join('\n');

  return `AVAILABLE ACTIONS:\n${toolLines}`;
}
