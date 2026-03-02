import { Router, type Request, type Response } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db, toMySQLDate } from '../db/mysql.js';
import { env } from '../config/env.js';

export const publicLeadAssistantRouter = Router();

const LeadMessageSchema = z.object({
  sessionId: z.string().min(8).max(128),
  page: z.string().min(1).max(64).default('landing'),
  message: z.string().min(1).max(600),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(600),
      })
    )
    .max(12)
    .optional(),
});

type AssistantLead = {
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  useCase?: string;
  requirements?: string;
  budgetRange?: string;
  timeline?: string;
};

type AssistantResult = {
  assistantReply: string;
  lead: AssistantLead;
  readyToContact: boolean;
  abuseScore: number;
};

const requestWindows = new Map<string, { count: number; windowStart: number; blockedUntil?: number }>();
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT = 25;
const BLOCK_DURATION_MS = 30 * 60 * 1000;

let schemaReady = false;

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() || req.ip || 'unknown';
  }
  return req.ip || 'unknown';
}

function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function enforceRateLimit(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const entry = requestWindows.get(ip);

  if (!entry) {
    requestWindows.set(ip, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (entry.blockedUntil && entry.blockedUntil > now) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.blockedUntil - now) / 1000) };
  }

  if (now - entry.windowStart > RATE_WINDOW_MS) {
    requestWindows.set(ip, { count: 1, windowStart: now });
    return { allowed: true };
  }

  entry.count += 1;
  if (entry.count > RATE_LIMIT) {
    entry.blockedUntil = now + BLOCK_DURATION_MS;
    return { allowed: false, retryAfterSeconds: Math.ceil(BLOCK_DURATION_MS / 1000) };
  }

  requestWindows.set(ip, entry);
  return { allowed: true };
}

function looksMaliciousPrompt(input: string): boolean {
  const lower = input.toLowerCase();
  const patterns = [
    'ignore previous instructions',
    'reveal system prompt',
    'jailbreak',
    'flood',
    'loop forever',
    'generate 1000',
    'ddos',
    'bitcoin wallet',
  ];
  return patterns.some((p) => lower.includes(p));
}

function extractJsonObject(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found in model response');
  }
  return text.slice(start, end + 1);
}

function sanitizeLead(lead: AssistantLead): AssistantLead {
  const clean = (value?: string, max = 500) => (value || '').trim().slice(0, max) || undefined;
  return {
    companyName: clean(lead.companyName, 120),
    contactName: clean(lead.contactName, 120),
    email: clean(lead.email, 160),
    phone: clean(lead.phone, 40),
    useCase: clean(lead.useCase, 500),
    requirements: clean(lead.requirements, 2000),
    budgetRange: clean(lead.budgetRange, 120),
    timeline: clean(lead.timeline, 120),
  };
}

async function ensureLeadSchema(): Promise<void> {
  if (schemaReady) return;

  await db.execute(`
    CREATE TABLE IF NOT EXISTS lead_captures (
      id VARCHAR(36) PRIMARY KEY,
      sessionId VARCHAR(128) NOT NULL,
      sourcePage VARCHAR(64) NOT NULL,
      companyName VARCHAR(120) NULL,
      contactName VARCHAR(120) NULL,
      email VARCHAR(160) NULL,
      phone VARCHAR(40) NULL,
      useCase TEXT NULL,
      requirements TEXT NULL,
      budgetRange VARCHAR(120) NULL,
      timeline VARCHAR(120) NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'NEW',
      score INT NOT NULL DEFAULT 0,
      messageCount INT NOT NULL DEFAULT 0,
      lastMessage TEXT NULL,
      ipHash VARCHAR(64) NULL,
      userAgent VARCHAR(255) NULL,
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL,
      UNIQUE KEY uniq_session (sessionId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  schemaReady = true;
}

async function upsertLeadCapture(params: {
  sessionId: string;
  page: string;
  lead: AssistantLead;
  readyToContact: boolean;
  message: string;
  ipHash: string;
  userAgent: string;
}): Promise<string> {
  await ensureLeadSchema();

  const now = toMySQLDate(new Date());
  const existing = await db.queryOne<{ id: string; messageCount: number }>(
    'SELECT id, messageCount FROM lead_captures WHERE sessionId = ? LIMIT 1',
    [params.sessionId]
  );

  const score = params.readyToContact ? 80 : 40;

  if (existing) {
    await db.execute(
      `UPDATE lead_captures
       SET sourcePage = ?,
           companyName = COALESCE(NULLIF(?, ''), companyName),
           contactName = COALESCE(NULLIF(?, ''), contactName),
           email = COALESCE(NULLIF(?, ''), email),
           phone = COALESCE(NULLIF(?, ''), phone),
           useCase = COALESCE(NULLIF(?, ''), useCase),
           requirements = COALESCE(NULLIF(?, ''), requirements),
           budgetRange = COALESCE(NULLIF(?, ''), budgetRange),
           timeline = COALESCE(NULLIF(?, ''), timeline),
           status = CASE WHEN ? = 1 THEN 'QUALIFIED' ELSE status END,
           score = GREATEST(score, ?),
           messageCount = ?,
           lastMessage = ?,
           ipHash = ?,
           userAgent = ?,
           updatedAt = ?
       WHERE id = ?`,
      [
        params.page,
        params.lead.companyName || '',
        params.lead.contactName || '',
        params.lead.email || '',
        params.lead.phone || '',
        params.lead.useCase || '',
        params.lead.requirements || '',
        params.lead.budgetRange || '',
        params.lead.timeline || '',
        params.readyToContact ? 1 : 0,
        score,
        (existing.messageCount || 0) + 1,
        params.message,
        params.ipHash,
        params.userAgent,
        now,
        existing.id,
      ]
    );
    return existing.id;
  }

  const id = randomUUID();
  await db.execute(
    `INSERT INTO lead_captures (
      id, sessionId, sourcePage, companyName, contactName, email, phone, useCase, requirements,
      budgetRange, timeline, status, score, messageCount, lastMessage, ipHash, userAgent, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.sessionId,
      params.page,
      params.lead.companyName || null,
      params.lead.contactName || null,
      params.lead.email || null,
      params.lead.phone || null,
      params.lead.useCase || null,
      params.lead.requirements || null,
      params.lead.budgetRange || null,
      params.lead.timeline || null,
      params.readyToContact ? 'QUALIFIED' : 'NEW',
      score,
      1,
      params.message,
      params.ipHash,
      params.userAgent,
      now,
      now,
    ]
  );

  return id;
}

async function callLeadAssistantModel(message: string, history: Array<{ role: 'user' | 'assistant'; content: string }> = []): Promise<AssistantResult> {
  const model = env.LEADS_OLLAMA_MODEL || env.OLLAMA_MODEL || 'gemma2:2b';
  const baseUrl = env.OLLAMA_BASE_URL.replace(/\/$/, '');

  const systemPrompt = [
    'You are the Lead Solutions Architect for Soft Aware. Your goal is to consultatively guide potential clients to the correct pricing tier.',
    'Core Value Proposition: Soft Aware is a secure intelligence engine and middleware that bridges legacy company databases and modern AI chatbots using "Loopback API" architecture.',
    'The AI never touches internal databases directly, ensuring 100% security and zero hallucinations. We also provide secure Vector Pipelines for scattered company documents.',
    'Pricing Tiers: "Bring Your Own Engine" (R5,000/mo) for clients with existing AI subscriptions and IT staff; "Fully Managed" (R15,000/mo) for plug-and-play solutions with heavy document processing; "Custom" for massive legacy systems requiring on-premise deployment.',
    'Qualify customers by asking: 1) Do you have existing AI subscriptions (Copilot Studio/OpenAI)? 2) Connecting to structured databases or reading scattered files? 3) Do you have IT staff for API wiring?',
    'Be professional, technical but accessible. Never quote prices outside R5,000 and R15,000 monthly tiers.',
    'Extract lead details when available: companyName, contactName, email, phone, useCase, requirements, budgetRange, timeline.',
    'Only use high abuse scores (80+) for clearly malicious content like spam, threats, or explicit jailbreak attempts.',
    'Respond in STRICT JSON only with keys: assistantReply, lead, readyToContact, abuseScore.',
    'abuseScore must be 0-100. readyToContact true only if we have at least contactName + email/phone + useCase.',
  ].join(' ');

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-8),
    { role: 'user', content: message },
  ];

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      options: {
        temperature: 0.2,
        num_predict: 220,
      },
      messages,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Ollama error ${response.status}: ${detail}`);
  }

  const payload = await response.json() as any;
  const content = payload?.message?.content || '{}';
  const json = extractJsonObject(content);
  const parsed = JSON.parse(json) as AssistantResult;

  return {
    assistantReply: (parsed.assistantReply || 'Thanks. Please share your company, contact name, and AI use case.').slice(0, 1200),
    lead: sanitizeLead(parsed.lead || {}),
    readyToContact: !!parsed.readyToContact,
    abuseScore: Math.min(100, Math.max(0, Number(parsed.abuseScore || 0))),
  };
}

publicLeadAssistantRouter.post('/assistant', async (req: Request, res: Response) => {
  const parsed = LeadMessageSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'INVALID_REQUEST', details: parsed.error.flatten() });
  }

  const ip = getClientIp(req);
  const limiter = enforceRateLimit(ip);
  if (!limiter.allowed) {
    return res.status(429).json({
      error: 'RATE_LIMITED',
      message: 'Too many requests. Please try again later.',
      retryAfterSeconds: limiter.retryAfterSeconds,
    });
  }

  const { sessionId, page, message, history = [] } = parsed.data;
  const safeHistory = history.map((h) => ({ role: h.role, content: h.content }));

  if (looksMaliciousPrompt(message)) {
    return res.status(200).json({
      reply: 'I can only assist with your AI project requirements. Please share your use case, timeline, and contact details.',
      readyToContact: false,
      leadCaptured: false,
      guarded: true,
    });
  }

  try {
    const result = await callLeadAssistantModel(message, safeHistory);

    if (result.abuseScore >= 85) {
      return res.status(200).json({
        reply: 'I can help with project scoping and onboarding only. Please share your business use case and contact details to continue.',
        readyToContact: false,
        leadCaptured: false,
        guarded: true,
      });
    }

    const ipHash = hashValue(ip);
    const userAgent = (req.headers['user-agent'] || '').slice(0, 255);
    const leadId = await upsertLeadCapture({
      sessionId,
      page,
      lead: result.lead,
      readyToContact: result.readyToContact,
      message,
      ipHash,
      userAgent,
    });

    return res.status(200).json({
      reply: result.assistantReply,
      readyToContact: result.readyToContact,
      leadCaptured: true,
      leadId,
    });
  } catch (error: any) {
    console.error('[lead-assistant] failed:', error?.message || error);
    return res.status(502).json({
      error: 'ASSISTANT_UNAVAILABLE',
      message: 'Lead assistant is temporarily unavailable. Please leave your contact details and we will reach out.',
    });
  }
});
