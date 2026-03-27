import { Router } from 'express';
import { z } from 'zod';
import { db, toMySQLDate } from '../db/mysql.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { formatPublicPackage, packageRowToTierLimits, syncUsersForContactPackage, type PackageCatalogRow } from '../services/packageResolver.js';

const router = Router();
router.use(requireAuth, requireAdmin);

const packageSchema = z.object({
  slug: z.string().min(2).max(50),
  name: z.string().min(2).max(100),
  description: z.string().max(500).nullable().optional(),
  package_type: z.enum(['CONSUMER', 'ENTERPRISE', 'STAFF', 'ADDON']),
  price_monthly: z.number().int().min(0),
  price_annually: z.number().int().min(0).nullable().optional(),
  max_users: z.number().int().min(0).nullable().optional(),
  max_agents: z.number().int().min(0).nullable().optional(),
  max_widgets: z.number().int().min(0).nullable().optional(),
  max_landing_pages: z.number().int().min(0).nullable().optional(),
  max_enterprise_endpoints: z.number().int().min(0).nullable().optional(),
  features: z.array(z.string().min(1)).default([]),
  is_active: z.boolean().default(true),
  is_public: z.boolean().default(true),
  display_order: z.number().int().min(0).default(0),
  featured: z.boolean().default(false),
  cta_text: z.string().min(1).max(50).default('Get Started'),
  gateway_plan_id: z.string().max(100).nullable().optional(),
  max_sites: z.number().int().min(0).nullable().optional(),
  max_collections_per_site: z.number().int().min(0).nullable().optional(),
  max_storage_bytes: z.number().int().min(0).nullable().optional(),
  max_actions_per_month: z.number().int().min(0).nullable().optional(),
  allow_auto_recharge: z.boolean().default(false),
  max_knowledge_pages: z.number().int().min(0).nullable().optional(),
  allowed_site_type: z.enum(['single_page', 'classic_cms', 'ecommerce', 'web_application', 'headless']).default('single_page'),
  can_remove_watermark: z.boolean().default(false),
  allowed_system_actions: z.array(z.string()).default([]),
  has_custom_knowledge_categories: z.boolean().default(false),
  has_omni_channel_endpoints: z.boolean().default(false),
  ingestion_priority: z.number().int().min(1).max(10).default(1),
});

const assignSchema = z.object({
  contactId: z.number().int().positive(),
  billingCycle: z.enum(['MONTHLY', 'ANNUALLY', 'NONE']).default('MONTHLY'),
  status: z.enum(['TRIAL', 'ACTIVE']).default('ACTIVE'),
});

async function getPackageById(id: number) {
  return db.queryOne<PackageCatalogRow>('SELECT * FROM packages WHERE id = ?', [id]);
}

router.get('/', async (_req, res) => {
  try {
    const packages = await db.query<any>(
      `SELECT p.*, COUNT(cp.id) AS assignment_count
         FROM packages p
         LEFT JOIN contact_packages cp
           ON cp.package_id = p.id
          AND cp.status IN ('ACTIVE', 'TRIAL')
       GROUP BY p.id
       ORDER BY p.display_order ASC, p.id ASC`,
    );

    return res.json({
      success: true,
      packages: packages.map((pkg) => ({
        ...formatPublicPackage(pkg),
        raw: pkg,
        assignmentCount: Number(pkg.assignment_count || 0),
      })),
    });
  } catch (error) {
    console.error('[AdminPackages] list error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load packages.' });
  }
});

router.get('/contacts', async (_req, res) => {
  try {
    const rows = await db.query<any>(
      `SELECT
         c.id AS contact_id,
         c.company_name AS contact_name,
         c.contact_person,
         c.email AS contact_email,
         c.phone AS contact_phone,
         c.contact_type,
         cp.id AS contact_package_id,
         cp.status AS package_status,
         cp.billing_cycle,
         cp.current_period_start,
         cp.current_period_end,
         p.id AS package_id,
         p.slug AS package_slug,
         p.name AS package_name,
         (SELECT GROUP_CONCAT(u.email ORDER BY u.email SEPARATOR ', ')
            FROM users u
           WHERE u.contact_id = c.id) AS linked_user_emails,
         (SELECT COUNT(*) FROM users u WHERE u.contact_id = c.id) AS linked_user_count
       FROM contacts c
       LEFT JOIN contact_packages cp
         ON cp.id = (
           SELECT cp2.id
             FROM contact_packages cp2
            WHERE cp2.contact_id = c.id
              AND cp2.status IN ('ACTIVE', 'TRIAL')
            ORDER BY CASE cp2.status WHEN 'ACTIVE' THEN 0 WHEN 'TRIAL' THEN 1 ELSE 2 END,
                     cp2.updated_at DESC,
                     cp2.id DESC
            LIMIT 1
         )
       LEFT JOIN packages p ON p.id = cp.package_id
       WHERE c.active = 1
       ORDER BY c.company_name ASC`,
    );

    return res.json({ success: true, contacts: rows });
  } catch (error) {
    console.error('[AdminPackages] contacts error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load contacts.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const data = packageSchema.parse(req.body);
    const now = toMySQLDate(new Date());
    const features = JSON.stringify(data.features);
    const insertId = await db.insertOne('packages', {
      slug: data.slug,
      name: data.name,
      description: data.description ?? null,
      package_type: data.package_type,
      price_monthly: data.price_monthly,
      price_annually: data.price_annually ?? null,
      max_users: data.max_users ?? null,
      max_agents: data.max_agents ?? null,
      max_widgets: data.max_widgets ?? null,
      max_landing_pages: data.max_landing_pages ?? null,
      max_enterprise_endpoints: data.max_enterprise_endpoints ?? null,
      features,
      is_active: data.is_active ? 1 : 0,
      is_public: data.is_public ? 1 : 0,
      display_order: data.display_order,
      featured: data.featured ? 1 : 0,
      cta_text: data.cta_text,
      gateway_plan_id: data.gateway_plan_id ?? null,
      max_sites: data.max_sites ?? null,
      max_collections_per_site: data.max_collections_per_site ?? null,
      max_storage_bytes: data.max_storage_bytes ?? null,
      max_actions_per_month: data.max_actions_per_month ?? null,
      allow_auto_recharge: data.allow_auto_recharge ? 1 : 0,
      max_knowledge_pages: data.max_knowledge_pages ?? null,
      allowed_site_type: data.allowed_site_type,
      can_remove_watermark: data.can_remove_watermark ? 1 : 0,
      allowed_system_actions: JSON.stringify(data.allowed_system_actions),
      has_custom_knowledge_categories: data.has_custom_knowledge_categories ? 1 : 0,
      has_omni_channel_endpoints: data.has_omni_channel_endpoints ? 1 : 0,
      ingestion_priority: data.ingestion_priority,
      created_at: now,
      updated_at: now,
    });

    const pkg = await getPackageById(Number(insertId));
    return res.status(201).json({ success: true, package: pkg ? formatPublicPackage(pkg) : null });
  } catch (error) {
    console.error('[AdminPackages] create error:', error);
    return res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Failed to create package.' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const data = packageSchema.parse(req.body);
    const pkg = await getPackageById(id);
    if (!pkg) return res.status(404).json({ success: false, error: 'Package not found.' });

    await db.execute(
      `UPDATE packages SET
         slug = ?,
         name = ?,
         description = ?,
         package_type = ?,
         price_monthly = ?,
         price_annually = ?,
         max_users = ?,
         max_agents = ?,
         max_widgets = ?,
         max_landing_pages = ?,
         max_enterprise_endpoints = ?,
         features = ?,
         is_active = ?,
         is_public = ?,
         display_order = ?,
         featured = ?,
         cta_text = ?,
         gateway_plan_id = ?,
         max_sites = ?,
         max_collections_per_site = ?,
         max_storage_bytes = ?,
         max_actions_per_month = ?,
         allow_auto_recharge = ?,
         max_knowledge_pages = ?,
         allowed_site_type = ?,
         can_remove_watermark = ?,
         allowed_system_actions = ?,
         has_custom_knowledge_categories = ?,
         has_omni_channel_endpoints = ?,
         ingestion_priority = ?,
         updated_at = NOW()
       WHERE id = ?`,
      [
        data.slug,
        data.name,
        data.description ?? null,
        data.package_type,
        data.price_monthly,
        data.price_annually ?? null,
        data.max_users ?? null,
        data.max_agents ?? null,
        data.max_widgets ?? null,
        data.max_landing_pages ?? null,
        data.max_enterprise_endpoints ?? null,
        JSON.stringify(data.features),
        data.is_active ? 1 : 0,
        data.is_public ? 1 : 0,
        data.display_order,
        data.featured ? 1 : 0,
        data.cta_text,
        data.gateway_plan_id ?? null,
        data.max_sites ?? null,
        data.max_collections_per_site ?? null,
        data.max_storage_bytes ?? null,
        data.max_actions_per_month ?? null,
        data.allow_auto_recharge ? 1 : 0,
        data.max_knowledge_pages ?? null,
        data.allowed_site_type,
        data.can_remove_watermark ? 1 : 0,
        JSON.stringify(data.allowed_system_actions),
        data.has_custom_knowledge_categories ? 1 : 0,
        data.has_omni_channel_endpoints ? 1 : 0,
        data.ingestion_priority,
        id,
      ],
    );

    const updated = await getPackageById(id);
    if (updated) {
      const contacts = await db.query<{ contact_id: number }>(
        `SELECT DISTINCT contact_id FROM contact_packages WHERE package_id = ? AND status IN ('ACTIVE', 'TRIAL')`,
        [id],
      );
      for (const row of contacts) {
        await syncUsersForContactPackage(row.contact_id, updated);
      }
    }

    return res.json({ success: true, package: updated ? formatPublicPackage(updated) : null });
  } catch (error) {
    console.error('[AdminPackages] update error:', error);
    return res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Failed to update package.' });
  }
});

router.post('/:id/assign-contact', async (req, res) => {
  try {
    const packageId = Number(req.params.id);
    const assignment = assignSchema.parse(req.body);
    const pkg = await getPackageById(packageId);
    if (!pkg) return res.status(404).json({ success: false, error: 'Package not found.' });

    const contact = await db.queryOne<{ id: number }>('SELECT id FROM contacts WHERE id = ? LIMIT 1', [assignment.contactId]);
    if (!contact) return res.status(404).json({ success: false, error: 'Contact not found.' });

    await db.transaction(async (conn) => {
      await conn.execute(
        `UPDATE contact_packages
            SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW()
          WHERE contact_id = ?
            AND package_id <> ?
            AND status IN ('ACTIVE', 'TRIAL')`,
        [assignment.contactId, packageId],
      );

      const [existingRows] = await conn.execute(
        'SELECT id FROM contact_packages WHERE contact_id = ? AND package_id = ? LIMIT 1',
        [assignment.contactId, packageId],
      );
      const existing = (existingRows as Array<{ id: number }>)[0];
      const now = toMySQLDate(new Date());
      const trialEndsAt = assignment.status === 'TRIAL'
        ? toMySQLDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000))
        : null;
      const periodEnd = assignment.status === 'TRIAL'
        ? toMySQLDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000))
        : assignment.billingCycle === 'ANNUALLY'
          ? toMySQLDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000))
          : toMySQLDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

      if (existing?.id) {
        await conn.execute(
          `UPDATE contact_packages
              SET status = ?,
                  billing_cycle = ?,
                  trial_ends_at = ?,
                  current_period_start = ?,
                  current_period_end = ?,
                  cancelled_at = NULL,
                  updated_at = NOW()
            WHERE id = ?`,
          [assignment.status, assignment.billingCycle, trialEndsAt, now, periodEnd, existing.id],
        );
      } else {
        await conn.execute(
          `INSERT INTO contact_packages (
             contact_id, package_id, status, billing_cycle, trial_ends_at, credits_balance, credits_used,
             current_period_start, current_period_end, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, NOW(), NOW())`,
          [assignment.contactId, packageId, assignment.status, assignment.billingCycle, trialEndsAt, now, periodEnd],
        );
      }
    });

    await syncUsersForContactPackage(assignment.contactId, pkg);

    return res.json({
      success: true,
      contactId: assignment.contactId,
      package: {
        id: pkg.id,
        slug: pkg.slug,
        name: pkg.name,
        limits: packageRowToTierLimits(pkg),
      },
    });
  } catch (error) {
    console.error('[AdminPackages] assign error:', error);
    return res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Failed to assign package.' });
  }
});

export default router;
