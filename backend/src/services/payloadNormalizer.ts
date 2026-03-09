/**
 * Payload Normalization — Universal Adapters
 *
 * Converts incoming payloads from different providers (WhatsApp, Slack, SMS, etc.)
 * into a standardized format for AI processing, and converts AI responses back
 * into provider-specific formats.
 */

// ---------------------------------------------------------------------------
// Inbound Normalization (Provider → Standard Format)
// ---------------------------------------------------------------------------

export interface NormalizedInbound {
  text: string;                 // The user's message
  sender_id?: string;           // Phone number, user ID, email, etc.
  channel: string;              // 'whatsapp', 'slack', 'sms', etc.
  timestamp?: string;
  metadata?: Record<string, any>; // Provider-specific extras
}

/**
 * Extract message text from different provider payloads
 */
export function normalizeInboundPayload(provider: string, payload: any): NormalizedInbound {
  switch (provider.toLowerCase()) {
    case 'whatsapp':
      return normalizeWhatsApp(payload);
    
    case 'slack':
      return normalizeSlack(payload);
    
    case 'sms':
      return normalizeSMS(payload);
    
    case 'email':
      return normalizeEmail(payload);
    
    case 'web':
    case 'custom_rest':
      return normalizeCustomRest(payload);
    
    default:
      // Fallback: assume {text, sender_id} structure
      return {
        text: payload.text || payload.message || String(payload),
        sender_id: payload.sender_id || payload.from || payload.phone_number,
        channel: provider,
        metadata: payload
      };
  }
}

/**
 * WhatsApp Business API (Meta/Twilio format)
 * Payload: { entry: [{ changes: [{ value: { messages: [{ from, text: { body } }] } }] }] }
 */
function normalizeWhatsApp(payload: any): NormalizedInbound {
  const entry = payload.entry?.[0];
  const change = entry?.changes?.[0];
  const message = change?.value?.messages?.[0];

  return {
    text: message?.text?.body || '',
    sender_id: message?.from || payload.phone_number,
    channel: 'whatsapp',
    timestamp: new Date(parseInt(message?.timestamp || '0') * 1000).toISOString(),
    metadata: { raw: payload }
  };
}

/**
 * Slack Event API
 * Payload: { event: { type, text, user, channel, ts } }
 */
function normalizeSlack(payload: any): NormalizedInbound {
  const event = payload.event || {};

  return {
    text: event.text || '',
    sender_id: event.user,
    channel: 'slack',
    timestamp: new Date(parseFloat(event.ts || '0') * 1000).toISOString(),
    metadata: {
      slack_channel: event.channel,
      thread_ts: event.thread_ts,
      raw: payload
    }
  };
}

/**
 * SMS (generic format, e.g., Twilio)
 * Payload: { From, Body, MessageSid }
 */
function normalizeSMS(payload: any): NormalizedInbound {
  return {
    text: payload.Body || payload.text || '',
    sender_id: payload.From || payload.from || payload.phone_number,
    channel: 'sms',
    metadata: {
      message_sid: payload.MessageSid,
      raw: payload
    }
  };
}

/**
 * Email (custom format)
 * Payload: { from, subject, body }
 */
function normalizeEmail(payload: any): NormalizedInbound {
  const body = payload.body || payload.text || '';
  const subject = payload.subject || '';
  const fullText = subject ? `${subject}\n\n${body}` : body;

  return {
    text: fullText,
    sender_id: payload.from || payload.email,
    channel: 'email',
    metadata: {
      subject: payload.subject,
      to: payload.to,
      raw: payload
    }
  };
}

/**
 * Custom REST / Web Chat
 * Payload: { message, phone_number, channel, history?, ... }
 */
function normalizeCustomRest(payload: any): NormalizedInbound {
  return {
    text: payload.message || payload.text || '',
    sender_id: payload.phone_number || payload.user_id || payload.from,
    channel: payload.channel || 'web',
    timestamp: payload.timestamp,
    metadata: {
      history: payload.history,
      raw: payload
    }
  };
}

// ---------------------------------------------------------------------------
// Outbound Formatting (AI Response → Provider Format)
// ---------------------------------------------------------------------------

export interface FormattedOutbound {
  body: any;            // The provider-specific response payload
  contentType: string;  // 'application/json', 'text/plain', etc.
}

/**
 * Format AI response for different providers
 */
export function formatOutboundPayload(
  provider: string,
  aiText: string,
  action?: 'reply' | 'escalate' | 'end_session',
  metadata?: Record<string, any>
): FormattedOutbound {
  switch (provider.toLowerCase()) {
    case 'whatsapp':
      return formatWhatsApp(aiText, metadata);
    
    case 'slack':
      return formatSlack(aiText, metadata);
    
    case 'sms':
      return formatSMS(aiText);
    
    case 'email':
      return formatEmail(aiText, metadata);
    
    case 'web':
    case 'custom_rest':
      return formatCustomRest(aiText, action, metadata);
    
    default:
      // Default JSON response
      return {
        body: { response: aiText, action, ...metadata },
        contentType: 'application/json'
      };
  }
}

/**
 * WhatsApp response (Meta/Twilio format)
 */
function formatWhatsApp(text: string, metadata?: any): FormattedOutbound {
  return {
    body: {
      messaging_product: 'whatsapp',
      to: metadata?.recipient || metadata?.phone_number,
      type: 'text',
      text: { body: text }
    },
    contentType: 'application/json'
  };
}

/**
 * Slack response
 */
function formatSlack(text: string, metadata?: any): FormattedOutbound {
  return {
    body: {
      text,
      thread_ts: metadata?.thread_ts,  // Reply in thread if present
      channel: metadata?.channel
    },
    contentType: 'application/json'
  };
}

/**
 * SMS response (Twilio TwiML format)
 */
function formatSMS(text: string): FormattedOutbound {
  return {
    body: `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(text)}</Message></Response>`,
    contentType: 'text/xml'
  };
}

/**
 * Email response
 */
function formatEmail(text: string, metadata?: any): FormattedOutbound {
  return {
    body: {
      to: metadata?.reply_to || metadata?.from,
      subject: metadata?.subject ? `Re: ${metadata.subject}` : 'Response',
      body: text
    },
    contentType: 'application/json'
  };
}

/**
 * Custom REST / Web Chat (SSE or JSON)
 */
function formatCustomRest(text: string, action?: string, metadata?: any): FormattedOutbound {
  return {
    body: {
      response: text,
      action: action || 'reply',
      language: metadata?.language || 'en',
      ...metadata
    },
    contentType: 'application/json'
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
