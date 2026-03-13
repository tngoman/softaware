/**
 * Admin Enterprise Endpoints Routes
 *
 * CRUD API for managing dynamic enterprise webhook endpoints from the admin UI.
 * All routes are protected by requireAuth + requireAdmin.
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import {
  getAllEndpoints,
  getEndpoint,
  createEndpoint,
  updateEndpoint,
  deleteEndpoint,
  setEndpointStatus,
  getRequestLogs,
  type EndpointCreateInput,
} from '../services/enterpriseEndpoints.js';

export const adminEnterpriseEndpointsRouter = Router();
adminEnterpriseEndpointsRouter.use(requireAuth, requireAdmin);

// ─── Validation ──────────────────────────────────────────────────────────

const createSchema = z.object({
  client_id: z.string().min(1).max(100),
  client_name: z.string().min(1).max(255),
  contact_id: z.number().optional(),
  inbound_provider: z.enum(['whatsapp', 'slack', 'custom_rest', 'sms', 'email', 'web']),
  llm_provider: z.enum(['ollama', 'openrouter', 'openai']),
  llm_model: z.string().min(1),
  llm_system_prompt: z.string().min(1),
  llm_tools_config: z.string().optional(),
  llm_temperature: z.number().min(0).max(2).optional(),
  llm_max_tokens: z.number().min(1).max(16384).optional(),
  target_api_url: z.string().url().optional().or(z.literal('')),
  target_api_auth_type: z.enum(['bearer', 'basic', 'custom', 'none']).optional(),
  target_api_auth_value: z.string().optional(),
  target_api_headers: z.string().optional(),
});

const updateSchema = createSchema.partial().extend({
  status: z.enum(['active', 'paused', 'disabled']).optional(),
  allowed_ips: z.string().nullish(),
});

const statusSchema = z.object({
  status: z.enum(['active', 'paused', 'disabled']),
});

// ═══════════════════════════════════════════════════════════════════════════
// GET / — List all enterprise endpoints
// ═══════════════════════════════════════════════════════════════════════════
adminEnterpriseEndpointsRouter.get('/', (_req: AuthRequest, res: Response) => {
  try {
    const endpoints = getAllEndpoints();
    res.json({ success: true, data: endpoints });
  } catch (error: any) {
    console.error('[AdminEnterprise] List error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /:id — Get single endpoint with full config
// ═══════════════════════════════════════════════════════════════════════════
adminEnterpriseEndpointsRouter.get('/:id', (req: AuthRequest, res: Response) => {
  try {
    const endpoint = getEndpoint(req.params.id);
    if (!endpoint) {
      return res.status(404).json({ success: false, error: 'Endpoint not found' });
    }
    res.json({ success: true, data: endpoint });
  } catch (error: any) {
    console.error('[AdminEnterprise] Get error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST / — Create a new enterprise endpoint
// ═══════════════════════════════════════════════════════════════════════════
adminEnterpriseEndpointsRouter.post('/', (req: AuthRequest, res: Response) => {
  try {
    const data = createSchema.parse(req.body);
    const endpoint = createEndpoint(data as EndpointCreateInput);
    res.status(201).json({ success: true, data: endpoint });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ success: false, error: 'Validation failed', details: error.errors });
    }
    console.error('[AdminEnterprise] Create error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PUT /:id — Update an enterprise endpoint
// ═══════════════════════════════════════════════════════════════════════════
adminEnterpriseEndpointsRouter.put('/:id', (req: AuthRequest, res: Response) => {
  try {
    const data = updateSchema.parse(req.body);
    const existing = getEndpoint(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Endpoint not found' });
    }
    updateEndpoint(req.params.id, data);
    const updated = getEndpoint(req.params.id);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ success: false, error: 'Validation failed', details: error.errors });
    }
    console.error('[AdminEnterprise] Update error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PATCH /:id/status — Quick status toggle (kill switch)
// ═══════════════════════════════════════════════════════════════════════════
adminEnterpriseEndpointsRouter.patch('/:id/status', (req: AuthRequest, res: Response) => {
  try {
    const { status } = statusSchema.parse(req.body);
    const existing = getEndpoint(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Endpoint not found' });
    }
    setEndpointStatus(req.params.id, status);
    res.json({ success: true, message: `Endpoint ${req.params.id} set to ${status}` });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ success: false, error: 'Validation failed', details: error.errors });
    }
    console.error('[AdminEnterprise] Status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PATCH /:id/config — Update endpoint configuration (IP restrictions, etc.)
// ═══════════════════════════════════════════════════════════════════════════
const configSchema = z.object({
  allowed_ips: z.string().nullish(),
});

adminEnterpriseEndpointsRouter.patch('/:id/config', (req: AuthRequest, res: Response) => {
  try {
    const data = configSchema.parse(req.body);
    const existing = getEndpoint(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Endpoint not found' });
    }
    // Validate IP list if provided
    if (data.allowed_ips) {
      try {
        const ips = JSON.parse(data.allowed_ips);
        if (!Array.isArray(ips)) throw new Error('Must be an array');
        for (const ip of ips) {
          if (typeof ip !== 'string' || !/^[\d.:a-fA-F\/]+$/.test(ip.trim())) {
            throw new Error(`Invalid IP: ${ip}`);
          }
        }
      } catch (e: any) {
        return res.status(400).json({ success: false, error: `Invalid allowed_ips: ${e.message}` });
      }
    }
    updateEndpoint(req.params.id, { allowed_ips: data.allowed_ips ?? null } as any);
    const updated = getEndpoint(req.params.id);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ success: false, error: 'Validation failed', details: error.errors });
    }
    console.error('[AdminEnterprise] Config error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /:id — Delete an enterprise endpoint
// ═══════════════════════════════════════════════════════════════════════════
adminEnterpriseEndpointsRouter.delete('/:id', (req: AuthRequest, res: Response) => {
  try {
    const existing = getEndpoint(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Endpoint not found' });
    }
    deleteEndpoint(req.params.id);
    res.json({ success: true, message: `Endpoint ${req.params.id} deleted` });
  } catch (error: any) {
    console.error('[AdminEnterprise] Delete error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /:id/logs — Get request logs for an endpoint
// ═══════════════════════════════════════════════════════════════════════════
adminEnterpriseEndpointsRouter.get('/:id/logs', (req: AuthRequest, res: Response) => {
  try {
    const existing = getEndpoint(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Endpoint not found' });
    }
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const logs = getRequestLogs(req.params.id, limit, offset);
    res.json({ success: true, data: logs, pagination: { limit, offset } });
  } catch (error: any) {
    console.error('[AdminEnterprise] Logs error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
