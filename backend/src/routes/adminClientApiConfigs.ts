/**
 * Admin Client API Gateway Routes
 *
 * CRUD management for client API proxy configurations.
 * All routes require admin authentication.
 *
 * Base path: /api/admin/client-api-configs
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import {
  getAllConfigs,
  getConfigById,
  getConfigByClientId,
  createConfig,
  updateConfig,
  deleteConfig,
  getRequestLogs,
  type ClientApiConfigInput,
} from '../services/clientApiGateway.js';

export const adminClientApiConfigsRouter = Router();

adminClientApiConfigsRouter.use(requireAuth, requireAdmin);

// ── Validation Schemas ──────────────────────────────────────────────────

const createSchema = z.object({
  client_id: z.string().min(1).regex(/^[a-z0-9_-]+$/i, 'client_id must be alphanumeric with hyphens/underscores'),
  client_name: z.string().min(1),
  endpoint_id: z.string().optional(),
  target_base_url: z.string().url(),
  auth_type: z.enum(['rolling_token', 'bearer', 'basic', 'api_key', 'none']).optional(),
  auth_secret: z.string().optional(),
  auth_header: z.string().optional(),
  allowed_actions: z.array(z.string()).optional(),
  rate_limit_rpm: z.number().int().positive().optional(),
  timeout_ms: z.number().int().positive().optional(),
});

const updateSchema = createSchema.partial().omit({ client_id: true });

// ═════════════════════════════════════════════════════════════════════════
// GET /admin/client-api-configs
// List all client API configurations
// ═════════════════════════════════════════════════════════════════════════
adminClientApiConfigsRouter.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const configs = getAllConfigs();
    return res.json({ success: true, data: configs });
  } catch (err) {
    console.error('[AdminClientApiConfigs] List error:', err);
    return res.status(500).json({ success: false, error: 'Failed to list client API configs' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /admin/client-api-configs/:id
// Get a single client API config by ID
// ═════════════════════════════════════════════════════════════════════════
adminClientApiConfigsRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const config = getConfigById(req.params.id) || getConfigByClientId(req.params.id);
    if (!config) {
      return res.status(404).json({ success: false, error: 'Config not found' });
    }
    return res.json({ success: true, data: config });
  } catch (err) {
    console.error('[AdminClientApiConfigs] Get error:', err);
    return res.status(500).json({ success: false, error: 'Failed to get client API config' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// POST /admin/client-api-configs
// Create a new client API config
// ═════════════════════════════════════════════════════════════════════════
adminClientApiConfigsRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = createSchema.parse(req.body);

    // Check for duplicate client_id
    const existing = getConfigByClientId(data.client_id);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: `Client API config already exists for client_id: ${data.client_id}`,
      });
    }

    const config = createConfig(data as ClientApiConfigInput);

    console.log(`[AdminClientApiConfigs] Created config ${config.id} for ${config.client_id} (by admin ${(req as any).userId})`);

    return res.status(201).json({ success: true, data: config });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: err.errors });
    }
    console.error('[AdminClientApiConfigs] Create error:', err);
    return res.status(500).json({ success: false, error: 'Failed to create client API config' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// PUT /admin/client-api-configs/:id
// Update an existing client API config
// ═════════════════════════════════════════════════════════════════════════
adminClientApiConfigsRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const data = updateSchema.parse(req.body);

    const existing = getConfigById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Config not found' });
    }

    const updated = updateConfig(req.params.id, data as any);
    if (!updated) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    const config = getConfigById(req.params.id);

    console.log(`[AdminClientApiConfigs] Updated config ${req.params.id} (by admin ${(req as any).userId})`);

    return res.json({ success: true, data: config });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: err.errors });
    }
    console.error('[AdminClientApiConfigs] Update error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update client API config' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// PATCH /admin/client-api-configs/:id/status
// Update config status
// ═════════════════════════════════════════════════════════════════════════
adminClientApiConfigsRouter.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const { status } = z.object({ status: z.enum(['active', 'paused', 'disabled']) }).parse(req.body);

    const existing = getConfigById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Config not found' });
    }

    updateConfig(req.params.id, { status } as any);

    console.log(`[AdminClientApiConfigs] Status ${req.params.id} → ${status} (by admin ${(req as any).userId})`);

    return res.json({ success: true, message: `Status updated to ${status}` });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid status', details: err.errors });
    }
    console.error('[AdminClientApiConfigs] Status update error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update status' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// DELETE /admin/client-api-configs/:id
// Delete a client API config
// ═════════════════════════════════════════════════════════════════════════
adminClientApiConfigsRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = getConfigById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Config not found' });
    }

    deleteConfig(req.params.id);

    console.log(`[AdminClientApiConfigs] Deleted config ${req.params.id} (${existing.client_id}) (by admin ${(req as any).userId})`);

    return res.json({ success: true, message: 'Config deleted' });
  } catch (err) {
    console.error('[AdminClientApiConfigs] Delete error:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete client API config' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /admin/client-api-configs/:id/logs
// Get request logs for a client API config
// ═════════════════════════════════════════════════════════════════════════
adminClientApiConfigsRouter.get('/:id/logs', async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    const existing = getConfigById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Config not found' });
    }

    const logs = getRequestLogs(req.params.id, limit, offset);

    return res.json({ success: true, data: logs });
  } catch (err) {
    console.error('[AdminClientApiConfigs] Logs error:', err);
    return res.status(500).json({ success: false, error: 'Failed to get logs' });
  }
});
