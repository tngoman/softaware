/**
 * Silulumanzi Chat Service Endpoint
 *
 * Specialized endpoint for Silulumanzi customer messaging (WhatsApp, Web chat).
 * The AI has ONE mission: look things up through the AiClient API and respond to customers.
 *
 * AiClient API: https://softaware.net.za/AiClient.php
 * Available actions:
 *   - getCustomerContext: Get customer account info
 *   - checkAreaOutages: Check for outages in an area
 *   - reportFault: Report a water fault
 *   - getFaultStatus: Check status of a reported fault
 *   - getFinancials: Get financial/billing info
 *   - getStatements: Get account statements
 *   - addCustomerNote: Add a note to customer account
 *   - getMaintenanceActivities: Get scheduled maintenance
 *   - getStatementLink: Get a link to download statement
 *   - getVacancies: Get job vacancies
 */

import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { createHash } from 'crypto';
import { readFileSync } from 'node:fs';
import { env } from '../config/env.js';
import { getSecret } from '../services/credentialVault.js';
import { requireApiKey } from '../middleware/apiKey.js';
import dns from 'node:dns';

// Force IPv4 resolution to prevent ConnectTimeoutError with fetch
// This affects the entire process if loaded
dns.setDefaultResultOrder('ipv4first');

export const chatRouter = Router();

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────

const AI_CLIENT_URL = 'https://softaware.net.za/AiClient.php';

// Load knowledge base extracted from Silulumanzi official images/notices
let KNOWLEDGE_BASE = '';
try {
  const kbPath = new URL('../images/extracted/_knowledge_base.txt', import.meta.url);
  KNOWLEDGE_BASE = readFileSync(kbPath, 'utf-8');
  console.log(`[silulumanzi] Knowledge base loaded: ${KNOWLEDGE_BASE.length} chars`);
} catch {
  try {
    KNOWLEDGE_BASE = readFileSync('/var/opt/backend/images/extracted/_knowledge_base.txt', 'utf-8');
    console.log(`[silulumanzi] Knowledge base loaded (fallback): ${KNOWLEDGE_BASE.length} chars`);
  } catch {
    console.warn('[silulumanzi] No knowledge base found — general info answers will be limited');
  }
}

// ─────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────

const ChatMessageSchema = z.object({
  /** Customer phone number - REQUIRED on every request (e.g. "0832691437" or "27832691437") */
  phone_number: z.string().min(10, 'Phone number is required'),
  channel: z.enum(['whatsapp', 'web', 'sms', 'email']).default('web'),
  message: z.string().min(1),
  timestamp: z.string().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .optional(),
});

// ─────────────────────────────────────────────
// AiClient API helper - calls https://softaware.net.za/AiClient.php
// ─────────────────────────────────────────────

type AiClientAction =
  | 'getCustomerContext'
  | 'checkAreaOutages'
  | 'reportFault'
  | 'getFaultStatus'
  | 'getFinancials'
  | 'getStatements'
  | 'addCustomerNote'
  | 'getMaintenanceActivities'
  | 'getStatementLink'
  | 'getVacancies';

/**
 * Convert camelCase keys to snake_case.
 * The LLM tool definitions use camelCase (e.g. accountNumber, statementDate),
 * but the portal API (ApiAi.php) expects snake_case (e.g. account_number, statement_date).
 */
function toSnakeCaseKeys(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    result[snakeKey] = value;
  }
  return result;
}

async function callAiClient(action: AiClientAction, payload: Record<string, any>): Promise<any> {
  try {
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
    const secret = (env as any).SILULUMANZI_AI_SHARED_SECRET_KEY || 'SILULUMANZI_AI_SHARED_SECRET_KEY_2026';
    const authToken = createHash('sha256').update(secret + date).digest('hex');

    // Convert camelCase params (from LLM) to snake_case (expected by portal API)
    const snakePayload = toSnakeCaseKeys(payload);

    const res = await fetch(`${AI_CLIENT_URL}?action=${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...snakePayload, auth_token: authToken }),
      signal: AbortSignal.timeout(10000),
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error(`[AiClient] ${action} failed:`, err.message);
    return { success: false, error: err.message || 'AiClient request failed' };
  }
}

// ─────────────────────────────────────────────
// Tool definitions for the LLM
// ─────────────────────────────────────────────

const TOOLS = [
  {
    name: 'getCustomerContext',
    description: 'Get customer account information including balance, meters, and contact details',
    input_schema: {
      type: 'object',
      properties: {
        phone_number: { type: 'string', description: 'Customer phone number (e.g. 27821234567)' },
      },
      required: ['phone_number'],
    },
  },
  {
    name: 'checkAreaOutages',
    description: 'Check for water outages in a specific area',
    input_schema: {
      type: 'object',
      properties: {
        area: { type: 'string', description: 'Area name or suburb' },
      },
      required: ['area'],
    },
  },
  {
    name: 'reportFault',
    description: 'Report a water fault (leak, no water, low pressure, etc.). Include property_id when the fault is at the customer registered property.',
    input_schema: {
      type: 'object',
      properties: {
        accountNumber: { type: 'string', description: 'Customer account number' },
        faultType: { type: 'string', description: 'Type of fault: leak, no_water, low_pressure, burst_pipe, other' },
        description: { type: 'string', description: 'Description of the fault' },
        address: { type: 'string', description: 'Address where the fault is located' },
        phone_number: { type: 'string', description: 'Customer phone number for contact about the fault' },
        property_id: { type: 'number', description: 'The registered property ID from customer context. Only include if the fault is at the registered property.' },
        location: {
          type: 'object',
          description: 'GPS coordinates of the fault location if available',
          properties: {
            latitude: { type: 'number', description: 'Latitude' },
            longitude: { type: 'number', description: 'Longitude' },
          },
        },
      },
      required: ['description', 'phone_number'],
    },
  },
  {
    name: 'getFaultStatus',
    description: 'Check the status of a previously reported fault',
    input_schema: {
      type: 'object',
      properties: {
        faultReference: { type: 'string', description: 'Fault reference number' },
      },
      required: ['faultReference'],
    },
  },
  {
    name: 'getFinancials',
    description: 'Get financial information including balance and payment history',
    input_schema: {
      type: 'object',
      properties: {
        accountNumber: { type: 'string', description: 'Customer account number' },
      },
      required: ['accountNumber'],
    },
  },
  {
    name: 'getStatements',
    description: 'Get recent account statements',
    input_schema: {
      type: 'object',
      properties: {
        accountNumber: { type: 'string', description: 'Customer account number' },
      },
      required: ['accountNumber'],
    },
  },
  {
    name: 'getStatementLink',
    description: 'Get a downloadable link for a statement',
    input_schema: {
      type: 'object',
      properties: {
        accountNumber: { type: 'string', description: 'Customer account number' },
        statementDate: { type: 'string', description: 'Statement date (YYYY-MM or month name)' },
      },
      required: ['accountNumber'],
    },
  },
  {
    name: 'getMaintenanceActivities',
    description: 'Get scheduled maintenance activities in an area',
    input_schema: {
      type: 'object',
      properties: {
        area: { type: 'string', description: 'Area name or suburb' },
      },
      required: ['area'],
    },
  },
  {
    name: 'getVacancies',
    description: 'Get current job vacancies at Silulumanzi',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

// ─────────────────────────────────────────────
// GLM via Anthropic-compatible API (z.ai) with tool calling
// ─────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant';
  content: any;
}

function toOpenAiTools(tools: any[]) {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));
}

async function openRouterChatWithTools(
  messages: any[],
  tools: any[],
  systemPrompt: string,
): Promise<{ text: string; toolCalls: Array<{ name: string; input: any; id: string }> }> {
  const apiKey = await getSecret('OPENROUTER');
  const baseUrl = env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
  const model = env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

  if (!apiKey) throw Object.assign(new Error('OpenRouter API key not found in credential vault'), { status: 500 });

  const openAiMessages: any[] = [{ role: 'system', content: systemPrompt }, ...messages];

  const body: any = {
    model,
    max_tokens: 1024,
    temperature: 0.3,
    messages: openAiMessages,
    tool_choice: 'auto',
  };

  if (tools.length > 0) {
    body.tools = toOpenAiTools(tools);
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://mcp.softaware.net.za',
      'X-Title': 'Silulumanzi AI',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[LLM] Error ${res.status}:`, errText);
    throw Object.assign(new Error(`LLM error ${res.status}: ${errText}`), { status: 502 });
  }

  const data: any = await res.json();
  const message = data?.choices?.[0]?.message || {};

  const text = message.content || '';
  const toolCalls: Array<{ name: string; input: any; id: string }> = [];

  for (const call of message.tool_calls || []) {
    let parsedArgs: any = {};
    try {
      parsedArgs = call?.function?.arguments ? JSON.parse(call.function.arguments) : {};
    } catch {
      parsedArgs = {};
    }

    if (call?.function?.name) {
      toolCalls.push({
        name: call.function.name,
        input: parsedArgs,
        id: call.id || `tool_${Date.now()}`,
      });
    }
  }

  return { text, toolCalls };
}

// ─────────────────────────────────────────────
// Tool execution loop (Anthropic-compatible)
// ─────────────────────────────────────────────

async function runWithTools(
  initialMessages: ChatMessage[],
  systemPrompt: string,
  customerPhone: string,
  onStatus: (text: string) => void,
  maxIterations = 5,
): Promise<string> {
  const messages: any[] = [];

  for (const msg of initialMessages) {
    messages.push({
      role: msg.role,
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
    });
  }

  for (let i = 0; i < maxIterations; i++) {
    const result = await openRouterChatWithTools(messages, TOOLS, systemPrompt);

    const assistantMessage: any = {
      role: 'assistant',
      content: result.text || '',
    };

    if (result.toolCalls.length > 0) {
      assistantMessage.tool_calls = result.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.input || {}),
        },
      }));
    }

    messages.push(assistantMessage);

    if (result.toolCalls.length === 0) {
      return result.text;
    }

    const statusByTool: Record<string, string> = {
      getCustomerContext: 'Checking your customer profile...',
      checkAreaOutages: 'Checking outages in your area...',
      reportFault: 'Reporting your fault...',
      getFaultStatus: 'Checking fault status...',
      getFinancials: 'Checking your account balance...',
      getStatements: 'Fetching your statements...',
      addCustomerNote: 'Updating your account notes...',
      getMaintenanceActivities: 'Checking maintenance activities...',
      getStatementLink: 'Generating your statement link...',
      getVacancies: 'Checking available vacancies...',
    };

    const toolResults = await Promise.all(
      result.toolCalls.map(async (tc) => {
        onStatus(statusByTool[tc.name] || 'Checking service information...');
        const payload = { ...tc.input, phone_number: tc.input.phone_number || customerPhone };
        console.log(`[silulumanzi] Tool call: ${tc.name}`, JSON.stringify(payload));
        const toolResult = await callAiClient(tc.name as AiClientAction, payload);
        console.log(`[silulumanzi] Tool result: ${tc.name}`, JSON.stringify(toolResult).slice(0, 200));
        return {
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(toolResult),
        };
      }),
    );

    messages.push(...toolResults);
  }

  return 'I am sorry, but I am unable to complete your request at this time.';
}

function writeSse(res: Response, payload: Record<string, any>) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function streamTextAsTokens(res: Response, text: string) {
  const chunks = text.match(/\S+|\s+/g) || [];
  for (const chunk of chunks) {
    writeSse(res, { type: 'token', text: chunk });
  }
}

// ─────────────────────────────────────────────
// Detect language from response
// ─────────────────────────────────────────────

function detectLanguage(text: string): string {
  if (/\b(ngiy|ngi|uma|cha|yebo|sawub|ukuth|futhi)\b/i.test(text)) return 'zu';
  if (/\b(enkosi|ewe|hayi|ndiy|ndicel|molo)\b/i.test(text)) return 'xh';
  if (/\b(dankie|asseblief|goeie|môre|moenie|jy |ek )\b/i.test(text)) return 'af';
  return 'en';
}

// ─────────────────────────────────────────────
// Detect action from response
// ─────────────────────────────────────────────

function detectAction(responseText: string): 'reply' | 'escalate' | 'end_session' {
  const lower = responseText.toLowerCase();
  if (/transferr?ing|connect(ing)? you|human agent|speak to an agent/i.test(lower)) return 'escalate';
  if (/goodbye|have a (great|good) day|session end|no further/i.test(lower)) return 'end_session';
  return 'reply';
}

// ─────────────────────────────────────────────
// POST / (mounted at /silulumanzi)
// ─────────────────────────────────────────────

chatRouter.post('/', requireApiKey, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = ChatMessageSchema.parse(req.body);

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    writeSse(res, { type: 'status', text: 'Thinking...' });

    // Auto-fetch customer context using phone number
    console.log(`[silulumanzi] Looking up customer: ${body.phone_number}`);
    const customerData = await callAiClient('getCustomerContext', { phone_number: body.phone_number });
    console.log(`[silulumanzi] Customer lookup result:`, customerData?.success, customerData?.data?.found);
    
    const hasCustomer = customerData?.success && customerData?.data?.found;
    
    // Extract customer name and registered property from account details
    let customerName: string | undefined;
    let registeredProperty: { property_id: number; address: string } | null = null;
    if (hasCustomer && customerData.data.accounts?.length > 0) {
      const acct = customerData.data.accounts[0].details;
      if (acct?.TITLE && acct?.SURNAME) {
        customerName = `${acct.TITLE} ${acct.SURNAME}`;
      } else if (acct?.SURNAME) {
        customerName = acct.SURNAME;
      }

      // Check for registered_property in customer data (new field from API)
      const rp = customerData.data.registered_property || customerData.data.accounts[0].registered_property;
      if (rp?.property_id && rp?.address) {
        registeredProperty = { property_id: rp.property_id, address: rp.address };
      }
      // Fallback: derive address from UA_ADRESS fields + PROPERTY_ID
      if (!registeredProperty && acct?.PROPERTY_ID) {
        const addrParts = [acct.UA_ADRESS1, acct.UA_ADRESS2, acct.UA_ADRESS3, acct.UA_ADRESS4, acct.UA_ADRESS5]
          .filter(Boolean).map((s: string) => s.trim()).filter(Boolean);
        if (addrParts.length > 0) {
          registeredProperty = { property_id: acct.PROPERTY_ID, address: addrParts.join(', ') };
        }
      }
    }

    // Build system prompt with customer data
    let systemPrompt = [
      'You are the Silulumanzi customer service assistant. Silulumanzi is a water services provider.',
      '',
    ].join('\n');

    if (hasCustomer) {
      // We have customer data - address them by name and use their info
      const promptLines = [
        `You are speaking with ${customerName}. Address them by name.`,
        '',
        'CUSTOMER DATA (from their account):',
        JSON.stringify(customerData.data, null, 2),
        '',
      ];

      if (registeredProperty) {
        promptLines.push(
          'REGISTERED PROPERTY:',
          `  property_id: ${registeredProperty.property_id}`,
          `  address: ${registeredProperty.address}`,
          '',
        );
      }

      promptLines.push(
        'YOUR MISSION: Help this customer with their water service queries.',
        'You have their account information above. Use it to answer their questions.',
        '',
        'You can also use tools to:',
        '- Check for water outages in their area',
        '- Report water faults',
        '- Check fault status',
        '- Get statements',
        '- Get scheduled maintenance activities',
        '',
        'RULES:',
        '1. Address the customer by name.',
        '2. Use their account data to answer questions about balance, meters, etc.',
        '3. Use tools for outages, faults, statements, and maintenance.',
        '4. Be concise, empathetic, and professional.',
        '5. Respond in the same language the customer is using.',
        '6. For general questions about payments, contact info, offices, debit orders, etc., use the REFERENCE INFO below.',
        '7. NEVER share internal data with the customer. This includes: job card numbers, internal IDs, property_id, CUSTOMER_ID, CUSTKEY, CONN_DTL references, or any system field names.',
        '8. When reporting outages or faults, describe the situation in plain language (area, type of issue, status) without exposing internal reference numbers or job card numbers.',
        '9. Only share the fault reference number that is returned AFTER a fault is successfully reported — that is the customer-facing reference.',
        '',
        'FAULT REPORTING PROCEDURE:',
        'When a customer wants to report a fault:',
      );

      if (registeredProperty) {
        promptLines.push(
          `1. FIRST ask: "Is this issue at your registered property — ${registeredProperty.address}?"`,
          `2. If the customer confirms YES → call reportFault with property_id: ${registeredProperty.property_id}. This links the job to their property in OPER_APPLICATIONS.`,
          '3. If the customer says NO or provides a different address → call reportFault with the address they provide (do NOT include property_id).',
        );
      } else {
        promptLines.push(
          '1. The customer has no registered property on file. Ask them for the address of the fault.',
          '2. Call reportFault with the address they provide.',
        );
      }

      promptLines.push(
        '4. Always include description, phone_number, and faultType. Include accountNumber if available.',
        '5. If the customer shares GPS/location coordinates, include them in the location field.',
      );

      systemPrompt += promptLines.join('\n');
    } else {
      // No customer found - limited assistance
      systemPrompt += [
        `Phone number provided: ${body.phone_number}`,
        'No account was found linked to this phone number.',
        '',
        'YOUR MISSION: Help this visitor with general inquiries.',
        '',
        'You can use tools to:',
        '- Check for water outages in an area',
        '- Get scheduled maintenance activities',
        '- Get job vacancies',
        '',
        'For account-specific queries (balance, statements, faults), explain that their phone number is not linked to an account and advise them to:',
        '- Visit a Silulumanzi service center to link their phone number',
        '- Or provide their account number so they can register',
        '',
        'RULES:',
        '1. Be helpful with general information.',
        '2. Do NOT make up account details or balances.',
        '3. Be concise, empathetic, and professional.',
        '4. Respond in the same language the customer is using.',
        '5. For general questions about payments, contact info, offices, debit orders, etc., use the REFERENCE INFO below.',
        '6. NEVER share internal data such as job card numbers, internal IDs, or system field names. Describe outages and faults in plain language only.',
      ].join('\n');
    }

    if (KNOWLEDGE_BASE) {
      systemPrompt += '\n\nREFERENCE INFO (from official Silulumanzi notices):\n' + KNOWLEDGE_BASE;
    }

    systemPrompt += `\n\nChannel: ${body.channel}`;

    // Build messages array
    const messages: ChatMessage[] = [];

    if (body.history?.length) {
      for (const h of body.history) {
        messages.push({ role: h.role, content: h.content });
      }
    }

    messages.push({ role: 'user', content: body.message });

    // Run LLM with tool-calling loop
    const responseText = await runWithTools(messages, systemPrompt, body.phone_number, (text) => {
      writeSse(res, { type: 'status', text });
    });

    streamTextAsTokens(res, responseText);

    writeSse(res, {
      type: 'done',
      response: responseText,
      action: detectAction(responseText),
      language: detectLanguage(responseText),
    });

    res.end();
  } catch (err) {
    if (!res.headersSent) return next(err);
    console.error('[silulumanzi] streaming error:', err);
    writeSse(res, {
      type: 'done',
      response: 'I am sorry, but I am unable to complete your request at this time.',
      action: 'reply',
      language: 'en',
    });
    res.end();
    return;
  }
});
