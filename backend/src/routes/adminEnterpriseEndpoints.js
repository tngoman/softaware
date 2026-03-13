/**
 * Admin Enterprise Endpoints Routes
 *
 * CRUD API for managing dynamic enterprise webhook endpoints from the admin UI.
 * All routes are protected by requireAuth + requireAdmin.
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { getAllEndpoints, getEndpoint, createEndpoint, updateEndpoint, deleteEndpoint, setEndpointStatus, getRequestLogs, } from '../services/enterpriseEndpoints.js';
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
});
const statusSchema = z.object({
    status: z.enum(['active', 'paused', 'disabled']),
});
// ═══════════════════════════════════════════════════════════════════════════
// GET / — List all enterprise endpoints
// ═══════════════════════════════════════════════════════════════════════════
adminEnterpriseEndpointsRouter.get('/', (_req, res) => {
    try {
        const endpoints = getAllEndpoints();
        res.json({ success: true, data: endpoints });
    }
    catch (error) {
        console.error('[AdminEnterprise] List error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// ═══════════════════════════════════════════════════════════════════════════
// GET /:id — Get single endpoint with full config
// ═══════════════════════════════════════════════════════════════════════════
adminEnterpriseEndpointsRouter.get('/:id', (req, res) => {
    try {
        const endpoint = getEndpoint(req.params.id);
        if (!endpoint) {
            return res.status(404).json({ success: false, error: 'Endpoint not found' });
        }
        res.json({ success: true, data: endpoint });
    }
    catch (error) {
        console.error('[AdminEnterprise] Get error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// ═══════════════════════════════════════════════════════════════════════════
// POST / — Create a new enterprise endpoint
// ═══════════════════════════════════════════════════════════════════════════
adminEnterpriseEndpointsRouter.post('/', (req, res) => {
    try {
        const data = createSchema.parse(req.body);
        const endpoint = createEndpoint(data);
        res.status(201).json({ success: true, data: endpoint });
    }
    catch (error) {
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
adminEnterpriseEndpointsRouter.put('/:id', (req, res) => {
    try {
        const data = updateSchema.parse(req.body);
        const existing = getEndpoint(req.params.id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Endpoint not found' });
        }
        updateEndpoint(req.params.id, data);
        const updated = getEndpoint(req.params.id);
        res.json({ success: true, data: updated });
    }
    catch (error) {
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
adminEnterpriseEndpointsRouter.patch('/:id/status', (req, res) => {
    try {
        const { status } = statusSchema.parse(req.body);
        const existing = getEndpoint(req.params.id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Endpoint not found' });
        }
        setEndpointStatus(req.params.id, status);
        res.json({ success: true, message: `Endpoint ${req.params.id} set to ${status}` });
    }
    catch (error) {
        if (error.name === 'ZodError') {
            return res.status(400).json({ success: false, error: 'Validation failed', details: error.errors });
        }
        console.error('[AdminEnterprise] Status error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// ═══════════════════════════════════════════════════════════════════════════
// DELETE /:id — Delete an enterprise endpoint
// ═══════════════════════════════════════════════════════════════════════════
adminEnterpriseEndpointsRouter.delete('/:id', (req, res) => {
    try {
        const existing = getEndpoint(req.params.id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Endpoint not found' });
        }
        deleteEndpoint(req.params.id);
        res.json({ success: true, message: `Endpoint ${req.params.id} deleted` });
    }
    catch (error) {
        console.error('[AdminEnterprise] Delete error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// ═══════════════════════════════════════════════════════════════════════════
// GET /:id/logs — Get request logs for an endpoint
// ═══════════════════════════════════════════════════════════════════════════
adminEnterpriseEndpointsRouter.get('/:id/logs', (req, res) => {
    try {
        const existing = getEndpoint(req.params.id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Endpoint not found' });
        }
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const logs = getRequestLogs(req.params.id, limit, offset);
        res.json({ success: true, data: logs, pagination: { limit, offset } });
    }
    catch (error) {
        console.error('[AdminEnterprise] Logs error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
