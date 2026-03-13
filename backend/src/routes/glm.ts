import { Router } from 'express';
import { z } from 'zod';
import { glmService } from '../services/glmService.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { requireApiKey } from '../middleware/apiKey.js';
import { db } from '../db/mysql.js';

export const glmRouter = Router();

// Validation schemas
const ChatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['system', 'user', 'assistant']),
      content: z.string(),
    })
  ),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
  stream: z.boolean().optional(),
});

const SimpleChatRequestSchema = z.object({
  prompt: z.string().min(1),
  systemPrompt: z.string().optional(),
});

// Test endpoint (no auth required)
glmRouter.get('/test', async (req, res, next) => {
  try {
    const response = await glmService.simpleChat(
      'Say "Hello! GLM API is working correctly." in a single sentence.'
    );
    res.json({
      success: true,
      message: 'GLM API connection successful',
      response,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ============================================
// API Key Protected Endpoints (for desktop apps)
// ============================================

async function getTeamIdFromApiKey(req: any): Promise<string | undefined> {
  const apiKey = req.apiKey;
  if (!apiKey) return undefined;

  const membership = await db.queryOne<any>(
    'SELECT teamId FROM team_members WHERE userId = ? LIMIT 1',
    [apiKey.userId]
  );

  return membership?.teamId;
}

// Chat endpoint with API key auth + credit deduction
glmRouter.post('/api/chat', requireApiKey, async (req, res, next) => {
  try {
    const teamId = await getTeamIdFromApiKey(req);

    const body = ChatRequestSchema.parse(req.body);
    const response = await glmService.chat(body as any);
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// Simple chat with API key auth + credit deduction
glmRouter.post('/api/simple', requireApiKey, async (req, res, next) => {
  try {
    const teamId = await getTeamIdFromApiKey(req);

    const { prompt, systemPrompt } = SimpleChatRequestSchema.parse(req.body);
    const response = await glmService.simpleChat(prompt, systemPrompt);
    res.json({
      success: true,
      response,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================
// JWT Protected Endpoints (for web UI)
// ============================================
glmRouter.use(requireAuth);

async function getTeamIdFromUser(req: AuthRequest): Promise<string> {
  const membership = await db.queryOne<any>(
    'SELECT teamId FROM team_members WHERE userId = ? LIMIT 1',
    [req.userId!]
  );

  if (!membership) {
    throw new Error('No credit balance found for user');
  }

  return membership.teamId;
}

// Full chat endpoint with credit deduction
glmRouter.post('/chat', async (req: AuthRequest, res, next) => {
  try {
    const teamId = await getTeamIdFromUser(req);

    const body = ChatRequestSchema.parse(req.body);
    const response = await glmService.chat(body as any);
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// Simple chat endpoint with credit deduction
glmRouter.post('/simple', async (req: AuthRequest, res, next) => {
  try {
    const teamId = await getTeamIdFromUser(req);

    const { prompt, systemPrompt } = SimpleChatRequestSchema.parse(req.body);
    const response = await glmService.simpleChat(prompt, systemPrompt);
    res.json({
      success: true,
      response,
    });
  } catch (err) {
    next(err);
  }
});
