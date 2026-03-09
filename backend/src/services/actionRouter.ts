/**
 * Action Router - Function Calling for AI Assistants
 * 
 * Enables AI assistants to execute real-world actions:
 * - Free tier: Lead Capture (email notification)
 * - Paid tier: Lead Capture + External Webhooks
 * 
 * The LLM receives tool definitions in its system prompt and can return
 * structured JSON to invoke tools instead of conversational text.
 */

import { db, toMySQLDate } from '../db/mysql.js';
import nodemailer from 'nodemailer';
import axios from 'axios';
import { env } from '../config/env.js';
import { getSmtpConfig } from './credentialVault.js';

// ============================================================================
// Tool Definitions (OpenAI-compatible function calling format)
// ============================================================================

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, {
        type: string;
        description: string;
        enum?: string[];
      }>;
      required: string[];
    };
  };
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

// Lead Capture Tool - Available to ALL tiers
const LEAD_CAPTURE_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'capture_lead',
    description: 'Capture a potential customer\'s contact information when they express interest in services, products, or want to be contacted. Use this when someone provides their email, phone, or wants a callback.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The customer\'s name'
        },
        email: {
          type: 'string',
          description: 'The customer\'s email address'
        },
        phone: {
          type: 'string',
          description: 'The customer\'s phone number (optional)'
        },
        interest: {
          type: 'string',
          description: 'What the customer is interested in or their inquiry'
        },
        urgency: {
          type: 'string',
          description: 'How urgent is their need',
          enum: ['low', 'medium', 'high']
        }
      },
      required: ['email', 'interest']
    }
  }
};

// Webhook Tool - Available to PAID tier only
const WEBHOOK_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'trigger_webhook',
    description: 'Trigger an external webhook to integrate with the business\'s systems (CRM, inventory, booking systems). Use when a customer wants to book, order, schedule, or trigger any business action.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The action to trigger (e.g., "book_appointment", "create_order", "check_availability")'
        },
        data: {
          type: 'object',
          description: 'Data to send with the webhook (customer info, selected options, etc.)'
        }
      },
      required: ['action', 'data']
    }
  }
};

// Schedule Callback Tool - Available to ALL tiers
const SCHEDULE_CALLBACK_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'schedule_callback',
    description: 'Schedule a callback request when a customer wants to speak with someone. Use when they ask to be called back or want to schedule a call.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Customer\'s name'
        },
        phone: {
          type: 'string',
          description: 'Phone number to call back'
        },
        preferred_time: {
          type: 'string',
          description: 'When they prefer to be called (e.g., "morning", "afternoon", "ASAP", specific time)'
        },
        reason: {
          type: 'string',
          description: 'What they want to discuss'
        }
      },
      required: ['phone', 'reason']
    }
  }
};

// ============================================================================
// Tool Execution Engine
// ============================================================================

/**
 * Get available tools for an assistant based on their tier
 */
export function getToolsForTier(tier: 'free' | 'paid', enabledTools?: string[]): ToolDefinition[] {
  const tools: ToolDefinition[] = [];
  
  // Default enabled tools if none specified
  const enabled = enabledTools || ['lead_capture', 'schedule_callback'];
  
  // Free tier tools
  if (enabled.includes('lead_capture')) {
    tools.push(LEAD_CAPTURE_TOOL);
  }
  if (enabled.includes('schedule_callback')) {
    tools.push(SCHEDULE_CALLBACK_TOOL);
  }
  
  // Paid tier additional tools
  if (tier === 'paid' && enabled.includes('webhook')) {
    tools.push(WEBHOOK_TOOL);
  }
  
  return tools;
}

/**
 * Generate system prompt addition for tool usage
 */
export function getToolsSystemPrompt(tools: ToolDefinition[]): string {
  if (tools.length === 0) return '';
  
  const toolDescriptions = tools.map(t => {
    const params = Object.entries(t.function.parameters.properties)
      .map(([name, prop]) => `  - ${name}: ${prop.description}${t.function.parameters.required.includes(name) ? ' (required)' : ' (optional)'}`)
      .join('\n');
    return `**${t.function.name}**: ${t.function.description}\nParameters:\n${params}`;
  }).join('\n\n');

  return `
AVAILABLE TOOLS:
You have access to the following tools to help customers. When appropriate, you can use these tools by responding with a JSON object.

${toolDescriptions}

TOOL USAGE INSTRUCTIONS:
1. Only use tools when the customer clearly wants to take action (provide contact info, schedule something, etc.)
2. Gather all required information conversationally before using a tool
3. When ready to use a tool, respond ONLY with a JSON object in this exact format:
   {"tool_call": {"name": "tool_name", "arguments": {...}}}
4. After a tool is used, confirm the action to the customer
5. Never fabricate information - only use data the customer provided

IMPORTANT: If the customer hasn't provided required information, ask for it first instead of using the tool.
`;
}

/**
 * Parse assistant response to detect tool calls
 */
export function parseToolCall(response: string): ToolCall | null {
  try {
    // Look for JSON in the response
    const jsonMatch = response.match(/\{[\s\S]*"tool_call"[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.tool_call && parsed.tool_call.name && parsed.tool_call.arguments) {
      return {
        name: parsed.tool_call.name,
        arguments: parsed.tool_call.arguments
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Execute a tool call and return the result
 */
export async function executeToolCall(
  toolCall: ToolCall,
  assistantId: string,
  assistantConfig: {
    name: string;
    tier: 'free' | 'paid';
    leadCaptureEmail?: string;
    webhookUrl?: string;
  }
): Promise<ToolResult> {
  console.log(`[ActionRouter] Executing tool: ${toolCall.name} for assistant ${assistantId}`);
  
  switch (toolCall.name) {
    case 'capture_lead':
      return await executeCaptureLeadTool(toolCall.arguments, assistantId, assistantConfig);
    
    case 'schedule_callback':
      return await executeScheduleCallbackTool(toolCall.arguments, assistantId, assistantConfig);
    
    case 'trigger_webhook':
      if (assistantConfig.tier !== 'paid') {
        return {
          success: false,
          message: 'Webhook integration is only available for paid tier assistants.'
        };
      }
      return await executeTriggerWebhookTool(toolCall.arguments, assistantId, assistantConfig);
    
    default:
      return {
        success: false,
        message: `Unknown tool: ${toolCall.name}`
      };
  }
}

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Lead Capture Tool - Stores lead and sends notification email
 */
async function executeCaptureLeadTool(
  args: Record<string, unknown>,
  assistantId: string,
  config: { name: string; leadCaptureEmail?: string }
): Promise<ToolResult> {
  const { name, email, phone, interest, urgency } = args as {
    name?: string;
    email: string;
    phone?: string;
    interest: string;
    urgency?: string;
  };

  try {
    const leadId = `lead-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const sessionId = `session-${Date.now()}`;
    const now = toMySQLDate(new Date());
    
    // Store lead in database using existing table structure
    await db.execute(
      `INSERT INTO lead_captures (id, sessionId, sourcePage, companyName, contactName, email, phone, useCase, requirements, status, score, messageCount, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW', 0, 0, ?, ?)`,
      [leadId, sessionId, assistantId, null, name || null, email, phone || null, interest, urgency || null, now, now]
    );

    // Send notification email if configured
    if (config.leadCaptureEmail) {
      await sendLeadNotificationEmail(config.leadCaptureEmail, {
        assistantName: config.name,
        customerName: name || 'Not provided',
        customerEmail: email,
        customerPhone: phone || 'Not provided',
        interest,
        urgency: urgency || 'medium'
      });
    }

    console.log(`[ActionRouter] Lead captured: ${email} for ${assistantId}`);

    return {
      success: true,
      message: `Thank you${name ? `, ${name}` : ''}! I've captured your information. Someone from our team will reach out to you at ${email} shortly.`,
      data: { leadId: 'generated', email }
    };
  } catch (error) {
    console.error('[ActionRouter] Lead capture failed:', error);
    return {
      success: false,
      message: 'I apologize, but I had trouble saving your information. Could you please try again or contact us directly?'
    };
  }
}

/**
 * Schedule Callback Tool - Stores callback request and sends notification
 */
async function executeScheduleCallbackTool(
  args: Record<string, unknown>,
  assistantId: string,
  config: { name: string; leadCaptureEmail?: string }
): Promise<ToolResult> {
  const { name, phone, preferred_time, reason } = args as {
    name?: string;
    phone: string;
    preferred_time?: string;
    reason: string;
  };

  try {
    const leadId = `callback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const sessionId = `session-${Date.now()}`;
    const now = toMySQLDate(new Date());
    
    // Store callback request as a lead using existing table structure
    await db.execute(
      `INSERT INTO lead_captures (id, sessionId, sourcePage, companyName, contactName, email, phone, useCase, requirements, status, score, messageCount, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'CALLBACK', 0, 0, ?, ?)`,
      [leadId, sessionId, assistantId, null, name || 'Callback Request', null, phone, `CALLBACK: ${reason}`, preferred_time || null, now, now]
    );

    // Send notification email if configured
    if (config.leadCaptureEmail) {
      await sendLeadNotificationEmail(config.leadCaptureEmail, {
        assistantName: config.name,
        customerName: name || 'Customer',
        customerPhone: phone,
        interest: reason,
        urgency: 'high',
        isCallback: true,
        preferredTime: preferred_time
      });
    }

    return {
      success: true,
      message: `I've scheduled a callback request for ${phone}${preferred_time ? ` during ${preferred_time}` : ''}. Our team will call you as soon as possible!`,
      data: { phone, preferredTime: preferred_time }
    };
  } catch (error) {
    console.error('[ActionRouter] Callback schedule failed:', error);
    return {
      success: false,
      message: 'I apologize, but I had trouble scheduling the callback. Please try again or call us directly.'
    };
  }
}

/**
 * Webhook Tool - Triggers external webhook (paid tier only)
 */
async function executeTriggerWebhookTool(
  args: Record<string, unknown>,
  assistantId: string,
  config: { webhookUrl?: string; name: string }
): Promise<ToolResult> {
  const { action, data } = args as {
    action: string;
    data: Record<string, unknown>;
  };

  if (!config.webhookUrl) {
    return {
      success: false,
      message: 'Webhook URL not configured for this assistant. Please contact support.'
    };
  }

  try {
    const response = await axios.post(config.webhookUrl, {
      action,
      data,
      assistantId,
      assistantName: config.name,
      timestamp: new Date().toISOString()
    }, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SoftAware-ActionRouter/1.0'
      }
    });

    // Log webhook execution
    await db.execute(
      `INSERT INTO widget_usage_logs (id, assistant_id, action, data, response_code, created_at)
       VALUES (UUID(), ?, ?, ?, ?, ?)`,
      [assistantId, `webhook:${action}`, JSON.stringify(data), response.status, toMySQLDate(new Date())]
    );

    return {
      success: true,
      message: `Done! Your ${action.replace(/_/g, ' ')} request has been processed successfully.`,
      data: { action, status: response.status }
    };
  } catch (error) {
    console.error('[ActionRouter] Webhook failed:', error);
    return {
      success: false,
      message: `I apologize, but I couldn't complete the ${action.replace(/_/g, ' ')} request. Please try again or contact us directly.`
    };
  }
}

// ============================================================================
// Email Notifications
// ============================================================================

interface LeadEmailData {
  assistantName: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  interest: string;
  urgency: string;
  isCallback?: boolean;
  preferredTime?: string;
}

async function sendLeadNotificationEmail(to: string, data: LeadEmailData): Promise<void> {
  // Create transporter with vault credentials
  const smtp = await getSmtpConfig();
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user ? {
      user: smtp.user,
      pass: smtp.pass
    } : undefined
  });

  const subject = data.isCallback 
    ? `📞 Callback Request via ${data.assistantName}`
    : `🎯 New Lead via ${data.assistantName}`;

  const urgencyEmoji = {
    low: '🟢',
    medium: '🟡',
    high: '🔴'
  }[data.urgency] || '🟡';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4F46E5;">${subject}</h2>
      
      <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Customer Details</h3>
        <p><strong>Name:</strong> ${data.customerName}</p>
        ${data.customerEmail ? `<p><strong>Email:</strong> <a href="mailto:${data.customerEmail}">${data.customerEmail}</a></p>` : ''}
        ${data.customerPhone ? `<p><strong>Phone:</strong> <a href="tel:${data.customerPhone}">${data.customerPhone}</a></p>` : ''}
        ${data.isCallback && data.preferredTime ? `<p><strong>Preferred Callback Time:</strong> ${data.preferredTime}</p>` : ''}
        <p><strong>Urgency:</strong> ${urgencyEmoji} ${data.urgency.toUpperCase()}</p>
      </div>
      
      <div style="background: #EEF2FF; padding: 20px; border-radius: 8px;">
        <h3 style="margin-top: 0;">Interest / Inquiry</h3>
        <p>${data.interest}</p>
      </div>
      
      <p style="color: #6B7280; font-size: 12px; margin-top: 20px;">
        This lead was captured by your AI assistant "${data.assistantName}" via Soft Aware.
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: smtp.from,
      to,
      subject,
      html
    });
    console.log(`[ActionRouter] Lead notification sent to ${to}`);
  } catch (error) {
    console.error('[ActionRouter] Email send failed:', error);
    // Don't throw - email failure shouldn't fail the lead capture
  }
}
