/**
 * Admin Packages Router
 *
 * Admin-only CRUD for packages, contact subscriptions, credit adjustments,
 * and transaction history. Replaces legacy adminCredits.ts team-based routes.
 *
 * Mount: /admin/packages
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import * as packageService from '../services/packages.js';
export const adminPackagesRouter = Router();
// Require authentication + admin role for ALL routes in this router
adminPackagesRouter.use(requireAuth, requireAdmin);
// ─── Package CRUD ────────────────────────────────────────────────────────
/** GET /admin/packages — list all packages (including inactive) */
adminPackagesRouter.get('/', async (_req, res) => {
    try {
        const packages = await packageService.getAllPackages(true);
        res.json({ success: true, packages });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/** GET /admin/packages/:id — single package detail */
adminPackagesRouter.get('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id))
            return res.status(400).json({ error: 'Invalid package ID' });
        const pkg = await packageService.getPackageById(id);
        if (!pkg)
            return res.status(404).json({ error: 'Package not found' });
        res.json({ success: true, package: pkg });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
const CreatePackageSchema = z.object({
    slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes'),
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    package_type: z.enum(['CONSUMER', 'ENTERPRISE', 'STAFF', 'ADDON']),
    price_monthly: z.number().int().min(0).default(0),
    price_annually: z.number().int().min(0).nullable().optional(),
    credits_included: z.number().int().min(0).default(0),
    max_users: z.number().int().min(0).nullable().optional(),
    max_agents: z.number().int().min(0).nullable().optional(),
    max_widgets: z.number().int().min(0).nullable().optional(),
    max_landing_pages: z.number().int().min(0).nullable().optional(),
    max_enterprise_endpoints: z.number().int().min(0).nullable().optional(),
    features: z.array(z.string()).optional(),
    is_active: z.boolean().default(true),
    is_public: z.boolean().default(true),
    display_order: z.number().int().default(0),
    featured: z.boolean().default(false),
    cta_text: z.string().max(50).default('Get Started'),
});
/** POST /admin/packages — create a new package */
adminPackagesRouter.post('/', async (req, res) => {
    try {
        const data = CreatePackageSchema.parse(req.body);
        const id = await packageService.createPackage({
            ...data,
            features: JSON.stringify(data.features || []),
        });
        const pkg = await packageService.getPackageById(id);
        res.status(201).json({ success: true, package: pkg });
    }
    catch (err) {
        if (err.name === 'ZodError') {
            return res.status(400).json({ error: 'Validation failed', details: err.errors });
        }
        res.status(500).json({ success: false, error: err.message });
    }
});
const UpdatePackageSchema = CreatePackageSchema.partial();
/** PUT /admin/packages/:id — update a package */
adminPackagesRouter.put('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id))
            return res.status(400).json({ error: 'Invalid package ID' });
        const existing = await packageService.getPackageById(id);
        if (!existing)
            return res.status(404).json({ error: 'Package not found' });
        const data = UpdatePackageSchema.parse(req.body);
        const updateData = { ...data };
        if (data.features) {
            updateData.features = JSON.stringify(data.features);
        }
        await packageService.updatePackage(id, updateData);
        const updated = await packageService.getPackageById(id);
        res.json({ success: true, package: updated });
    }
    catch (err) {
        if (err.name === 'ZodError') {
            return res.status(400).json({ error: 'Validation failed', details: err.errors });
        }
        res.status(500).json({ success: false, error: err.message });
    }
});
/** DELETE /admin/packages/:id — delete a package */
adminPackagesRouter.delete('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id))
            return res.status(400).json({ error: 'Invalid package ID' });
        await packageService.deletePackage(id);
        res.json({ success: true, message: 'Package deleted' });
    }
    catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});
// ─── Contact Subscriptions ───────────────────────────────────────────────
/** GET /admin/packages/subscriptions — all contact package subscriptions */
adminPackagesRouter.get('/subscriptions/all', async (req, res) => {
    try {
        const status = req.query.status;
        const subs = await packageService.getAllContactPackages(status);
        res.json({ success: true, subscriptions: subs });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/** GET /admin/packages/subscriptions/:contactId — a contact's subscriptions */
adminPackagesRouter.get('/subscriptions/:contactId', async (req, res) => {
    try {
        const contactId = parseInt(req.params.contactId);
        if (isNaN(contactId))
            return res.status(400).json({ error: 'Invalid contact ID' });
        const subs = await packageService.getContactPackages(contactId);
        const balance = await packageService.getBalance(contactId);
        res.json({ success: true, subscriptions: subs, balance });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
const AssignPackageSchema = z.object({
    contact_id: z.number().int().positive(),
    package_id: z.number().int().positive(),
    billing_cycle: z.enum(['MONTHLY', 'ANNUALLY', 'NONE']).default('MONTHLY'),
    payment_provider: z.enum(['PAYFAST', 'YOCO', 'MANUAL']).default('MANUAL'),
    status: z.enum(['TRIAL', 'ACTIVE']).default('ACTIVE'),
    trial_days: z.number().int().min(1).max(90).optional(),
});
/** POST /admin/packages/subscriptions/assign — assign a package to a contact */
adminPackagesRouter.post('/subscriptions/assign', async (req, res) => {
    try {
        const data = AssignPackageSchema.parse(req.body);
        const cpId = await packageService.assignPackageToContact(data.contact_id, data.package_id, {
            billing_cycle: data.billing_cycle,
            payment_provider: data.payment_provider,
            status: data.status,
            trial_days: data.trial_days,
        });
        const subscription = await packageService.getContactPackageById(cpId);
        res.status(201).json({ success: true, subscription });
    }
    catch (err) {
        if (err.name === 'ZodError') {
            return res.status(400).json({ error: 'Validation failed', details: err.errors });
        }
        res.status(400).json({ success: false, error: err.message });
    }
});
const UpdateStatusSchema = z.object({
    status: z.enum(['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED', 'SUSPENDED']),
});
/** PATCH /admin/packages/subscriptions/:id/status — update subscription status */
adminPackagesRouter.patch('/subscriptions/:id/status', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id))
            return res.status(400).json({ error: 'Invalid subscription ID' });
        const { status } = UpdateStatusSchema.parse(req.body);
        await packageService.updateContactPackageStatus(id, status);
        const updated = await packageService.getContactPackageById(id);
        res.json({ success: true, subscription: updated });
    }
    catch (err) {
        if (err.name === 'ZodError') {
            return res.status(400).json({ error: 'Validation failed', details: err.errors });
        }
        res.status(500).json({ success: false, error: err.message });
    }
});
// ─── Credit Adjustments ──────────────────────────────────────────────────
const AdjustCreditsSchema = z.object({
    contact_package_id: z.number().int().positive(),
    amount: z.number().int(),
    reason: z.string().min(1).max(500),
});
/** POST /admin/packages/credits/adjust — manually adjust credits on a subscription */
adminPackagesRouter.post('/credits/adjust', async (req, res) => {
    try {
        const data = AdjustCreditsSchema.parse(req.body);
        const userId = req.user?.id || null;
        const result = await packageService.adjustCredits(data.contact_package_id, data.amount, userId, data.reason);
        res.json({ success: true, ...result });
    }
    catch (err) {
        if (err.name === 'ZodError') {
            return res.status(400).json({ error: 'Validation failed', details: err.errors });
        }
        res.status(400).json({ success: false, error: err.message });
    }
});
// ─── Transactions ────────────────────────────────────────────────────────
/** GET /admin/packages/transactions — all transactions (paginated) */
adminPackagesRouter.get('/transactions/all', async (req, res) => {
    try {
        const contactId = req.query.contact_id ? parseInt(req.query.contact_id) : undefined;
        const type = req.query.type;
        const limit = req.query.limit ? parseInt(req.query.limit) : 50;
        const offset = req.query.offset ? parseInt(req.query.offset) : 0;
        const result = await packageService.getTransactions({ contactId, type, limit, offset });
        res.json({ success: true, ...result });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/** GET /admin/packages/transactions/:contactId — transactions for a specific contact */
adminPackagesRouter.get('/transactions/:contactId', async (req, res) => {
    try {
        const contactId = parseInt(req.params.contactId);
        if (isNaN(contactId))
            return res.status(400).json({ error: 'Invalid contact ID' });
        const limit = req.query.limit ? parseInt(req.query.limit) : 50;
        const offset = req.query.offset ? parseInt(req.query.offset) : 0;
        const result = await packageService.getTransactions({ contactId, limit, offset });
        res.json({ success: true, ...result });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// ─── Usage Stats ─────────────────────────────────────────────────────────
/** GET /admin/packages/usage/:contactId — usage stats for a contact */
adminPackagesRouter.get('/usage/:contactId', async (req, res) => {
    try {
        const contactId = parseInt(req.params.contactId);
        if (isNaN(contactId))
            return res.status(400).json({ error: 'Invalid contact ID' });
        const days = req.query.days ? parseInt(req.query.days) : 30;
        const stats = await packageService.getUsageStats(contactId, days);
        res.json({ success: true, ...stats });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// ─── User ↔ Contact Links ───────────────────────────────────────────────
const LinkUserSchema = z.object({
    user_id: z.string().min(1),
    contact_id: z.number().int().positive(),
    role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'STAFF']).default('MEMBER'),
});
/** POST /admin/packages/link-user — link a user to a contact */
adminPackagesRouter.post('/link-user', async (req, res) => {
    try {
        const data = LinkUserSchema.parse(req.body);
        await packageService.linkUserToContact(data.user_id, data.contact_id, data.role);
        res.json({ success: true, message: 'User linked to contact' });
    }
    catch (err) {
        if (err.name === 'ZodError') {
            return res.status(400).json({ error: 'Validation failed', details: err.errors });
        }
        res.status(500).json({ success: false, error: err.message });
    }
});
/** GET /admin/packages/contact-users/:contactId — users linked to a contact */
adminPackagesRouter.get('/contact-users/:contactId', async (req, res) => {
    try {
        const contactId = parseInt(req.params.contactId);
        if (isNaN(contactId))
            return res.status(400).json({ error: 'Invalid contact ID' });
        const users = await packageService.getContactUsers(contactId);
        res.json({ success: true, users });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
