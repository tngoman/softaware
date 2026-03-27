import express, { Request } from 'express';
import multer from 'multer';
import { siteBuilderService } from '../services/siteBuilderService.js';
import { ftpDeploymentService } from '../services/ftpDeploymentService.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import axios from 'axios';
import { env } from '../config/env.js';
import { getSecret } from '../services/credentialVault.js';
import { db } from '../db/mysql.js';
import jwt from 'jsonwebtoken';
import { logAnonymizedChat } from '../utils/analyticsLogger.js';

import { guardMaxSites, TierLimitError } from '../middleware/tierGuard.js';
import { requireActivePackageForUser } from '../services/packageResolver.js';

async function resolveUserTier(userId: string | number) {
  const pkg = await requireActivePackageForUser(userId);
  const tierName = pkg.packageSlug;
  const limits = pkg.limits;
  // Page limits per Pricing.md allowedSiteType
  const pageMap: Record<string, number> = {
    single_page: 1,
    classic_cms: 5,
    ecommerce: 15,
    web_application: 50,
    headless: 999,
  };
  return { 
    tier: tierName === 'free' ? 'free' : 'paid',
    tierName,
    maxPages: pageMap[limits.allowedSiteType] || 1,
    limits 
  };
}

const router = express.Router();


// ── Helper: parse AI enrichment JSON safely ──────────────────
function parseEnrichmentJson(raw: string): { tagline: string; heroSubtitle: string; ctaText: string; about: string; serviceDescs: string[] } | null {
  try {
    // Strip markdown code fences if model wraps output
    let cleaned = raw.replace(/```(?:json)?\s*/gi, '').replace(/```\s*$/gi, '').trim();
    // Try to extract JSON object from possible surrounding text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const obj = JSON.parse(jsonMatch[0]);
    const tagline = typeof obj.tagline === 'string' ? obj.tagline.trim() : '';
    const heroSubtitle = typeof obj.heroSubtitle === 'string' ? obj.heroSubtitle.trim() : '';
    const ctaText = typeof obj.ctaText === 'string' ? obj.ctaText.trim() : '';
    const about = typeof obj.about === 'string' ? obj.about.trim() : '';
    const serviceDescs: string[] = [];
    if (Array.isArray(obj.services)) {
      for (const s of obj.services) {
        serviceDescs.push(typeof s === 'string' ? s.trim() : (s?.desc || s?.description || '').trim());
      }
    }
    // Sanity check — at least one field was enriched
    if (!tagline && !about && serviceDescs.length === 0) return null;
    return { tagline, heroSubtitle, ctaText, about, serviceDescs };
  } catch {
    console.log('[ai-generation] Failed to parse enrichment JSON:', raw.substring(0, 200));
    return null;
  }
}

// ── Helper: extract HTML from AI response (strips markdown fences) ──
function extractHtml(raw: string): string | null {
  if (!raw) return null;
  let html = raw.trim();
  // Strip markdown code fences like ```html ... ``` or ``` ... ```
  html = html.replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  // Must contain a valid HTML structure
  if (html.includes('<!DOCTYPE') || html.includes('<html') || (html.includes('<head') && html.includes('<body'))) {
    return html;
  }
  return null;
}

// ESM __dirname polyfill
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Ensure generated_html + generation_error + form_config columns exist ───
(async () => {
  try {
    const cols = await db.query<{ Field: string }>(
      `SHOW COLUMNS FROM generated_sites WHERE Field IN ('generated_html', 'generation_error', 'form_config', 'include_form', 'include_assistant')`,
    );
    const existing = new Set((cols || []).map(c => c.Field));
    if (!existing.has('generated_html')) {
      await db.execute(`ALTER TABLE generated_sites ADD COLUMN generated_html LONGTEXT NULL AFTER ftp_directory`);
      console.log('[SiteBuilder] Added generated_html column');
    }
    if (!existing.has('generation_error')) {
      await db.execute(`ALTER TABLE generated_sites ADD COLUMN generation_error VARCHAR(2000) NULL AFTER generated_html`);
      console.log('[SiteBuilder] Added generation_error column');
    }
    if (!existing.has('form_config')) {
      await db.execute(`ALTER TABLE generated_sites ADD COLUMN form_config JSON NULL AFTER generation_error`);
      console.log('[SiteBuilder] Added form_config column');
    }
    if (!existing.has('include_form')) {
      await db.execute(`ALTER TABLE generated_sites ADD COLUMN include_form TINYINT(1) NOT NULL DEFAULT 1 AFTER form_config`);
      console.log('[SiteBuilder] Added include_form column');
    }
    if (!existing.has('include_assistant')) {
      await db.execute(`ALTER TABLE generated_sites ADD COLUMN include_assistant TINYINT(1) NOT NULL DEFAULT 0 AFTER include_form`);
      console.log('[SiteBuilder] Added include_assistant column');
    }
    // Ensure 'generating' is a valid status
    await db.execute(`ALTER TABLE generated_sites MODIFY COLUMN status ENUM('draft','generating','generated','deployed','failed') NOT NULL DEFAULT 'draft'`);

    // ── Create site_form_submissions table ──
    await db.execute(`
      CREATE TABLE IF NOT EXISTS site_form_submissions (
        id VARCHAR(36) PRIMARY KEY,
        site_id VARCHAR(36) NOT NULL,
        form_data JSON NOT NULL,
        submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(45) NULL,
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        notification_sent TINYINT(1) NOT NULL DEFAULT 0,
        INDEX idx_site_id (site_id),
        INDEX idx_submitted_at (submitted_at),
        FOREIGN KEY (site_id) REFERENCES generated_sites(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[SiteBuilder] site_form_submissions table ready');
  } catch (err) {
    console.warn('[SiteBuilder] Column migration note:', (err as Error).message);
  }
})();

// Configure multer for image uploads
// __dirname at runtime = src/routes/ → go up two levels to project root, then into uploads/sites
const SITE_UPLOADS_DIR = path.resolve(__dirname, '..', '..', 'uploads', 'sites');
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await fs.mkdir(SITE_UPLOADS_DIR, { recursive: true });
    cb(null, SITE_UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WEBP allowed'));
    }
  }
});

/**
 * POST /api/v1/sites
 * Create a new site
 */
router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      businessName,
      tagline,
      logoUrl,
      heroImageUrl,
      aboutUs,
      services,
      contactEmail,
      contactPhone,
      ftpServer,
      ftpUsername,
      ftpPassword,
      ftpPort,
      ftpProtocol,
      ftpDirectory,
      themeColor,
      widgetClientId
    } = req.body;

    if (!businessName) {
      return res.status(400).json({ error: 'Business name is required' });
    }

    // ── Tier guard: enforce maxSites ────────────────────────
    await guardMaxSites(userId);

    const site = await siteBuilderService.createSite({
      userId,
      widgetClientId,
      businessName,
      tagline,
      logoUrl,
      heroImageUrl,
      aboutUs,
      services,
      contactEmail,
      contactPhone,
      ftpServer,
      ftpUsername,
      ftpPassword,
      ftpPort,
      ftpProtocol,
      ftpDirectory,
      themeColor
    });

    // Auto-set max_pages based on subscription tier
    try {
      const userTier = await resolveUserTier(userId);
      if (userTier.maxPages > 1) {
        await siteBuilderService.setMaxPages(site.id, userTier.maxPages);
      }
    } catch (e) {
      console.warn('[SiteBuilder] Could not resolve tier for max_pages:', (e as Error).message);
    }

    return res.status(201).json({
      success: true,
      site: {
        ...site,
        ftp_password: undefined // Never return password
      }
    });

  } catch (error) {
    if (error instanceof TierLimitError) {
      return res.status(403).json({
        error: error.message,
        code: error.code,
        resource: error.resource,
        current: error.current,
        limit: error.limit,
        tier: error.tier,
      });
    }
    console.error('Create site error:', error);
    return res.status(500).json({
      error: 'Failed to create site',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/v1/sites/tier
 * Get the current user's subscription tier info for the site builder
 */
router.get('/tier', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const tierInfo = await resolveUserTier(userId);
    return res.json({ success: true, ...tierInfo });
  } catch (error) {
    console.error('Get tier error:', error);
    return res.status(500).json({ error: 'Failed to resolve tier' });
  }
});

/**
 * GET /api/v1/sites
 * Get all sites for authenticated user
 */
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const sites = await siteBuilderService.getSitesByUserId(userId);

    // Remove passwords and bulky HTML from list response
    const safeSites = sites.map(site => ({
      ...site,
      ftp_password: undefined,
      generated_html: undefined  // Don't send full HTML in list — fetch via GET /:siteId
    }));

    return res.json({
      success: true,
      sites: safeSites
    });

  } catch (error) {
    console.error('Get sites error:', error);
    return res.status(500).json({
      error: 'Failed to fetch sites'
    });
  }
});

/**
 * GET /api/v1/sites/:siteId/preview
 * Serves the raw generated HTML as a full web page.
 * Supports auth via header OR ?token= query param (for new-tab links).
 * MUST be registered before GET /:siteId to avoid route shadowing.
 */
router.get('/:siteId/preview', async (req: Request, res) => {
  try {
    const { siteId } = req.params;
    const site = await siteBuilderService.getSiteById(siteId);
    if (!site) return res.status(404).send('<h1>Site not found</h1>');
    if (!site.generated_html) return res.status(404).send('<h1>No generated content yet</h1>');

    // Auth: check Authorization header or ?token= query param
    let token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token && typeof req.query.token === 'string') token = req.query.token;
    if (!token) return res.status(401).send('<h1>Unauthorized</h1>');

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET!) as { userId?: string; id?: string };
      const userId = decoded.userId || decoded.id;
      if (!userId) return res.status(403).send('<h1>Access denied</h1>');

      // Allow site owner OR admin users
      if (site.user_id !== userId) {
        const adminRow = await db.queryOne<{ is_admin: number }>(
          'SELECT is_admin FROM users WHERE id = ?',
          [userId]
        );
        if (!adminRow || !adminRow.is_admin) return res.status(403).send('<h1>Access denied</h1>');
      }
    } catch {
      return res.status(401).send('<h1>Invalid or expired token</h1>');
    }

    // Remove Helmet's restrictive CSP — the generated page needs external
    // scripts (Tailwind CDN), images (uploaded assets), and inline styles.
    res.removeHeader('Content-Security-Policy');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Allow the preview to be framed by our own portal (for iframe preview)
    res.removeHeader('X-Frame-Options');
    return res.send(site.generated_html);
  } catch (error) {
    console.error('Preview error:', error);
    return res.status(500).send('<h1>Preview error</h1>');
  }
});

/**
 * GET /api/v1/sites/:siteId
 * Get specific site
 */
router.get('/:siteId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { siteId } = req.params;

    const site = await siteBuilderService.getSiteById(siteId);
    
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Verify ownership
    if (site.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.json({
      success: true,
      site: {
        ...site,
        ftp_password: undefined // Never return password
      }
    });

  } catch (error) {
    console.error('Get site error:', error);
    return res.status(500).json({
      error: 'Failed to fetch site'
    });
  }
});

/**
 * PUT /api/v1/sites/:siteId
 * Update site
 */
router.put('/:siteId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { siteId } = req.params;

    const site = await siteBuilderService.getSiteById(siteId);
    
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Verify ownership
    if (site.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await siteBuilderService.updateSite(siteId, req.body);

    const updatedSite = await siteBuilderService.getSiteById(siteId);

    return res.json({
      success: true,
      site: {
        ...updatedSite,
        ftp_password: undefined
      }
    });

  } catch (error) {
    console.error('Update site error:', error);
    return res.status(500).json({
      error: 'Failed to update site',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/v1/sites/:siteId
 * Delete site
 */
router.delete('/:siteId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { siteId } = req.params;

    const site = await siteBuilderService.getSiteById(siteId);
    
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Verify ownership
    if (site.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await siteBuilderService.deleteSite(siteId);

    return res.json({
      success: true,
      message: 'Site deleted successfully'
    });

  } catch (error) {
    console.error('Delete site error:', error);
    return res.status(500).json({
      error: 'Failed to delete site'
    });
  }
});

/**
 * POST /api/v1/sites/:siteId/generate
 * Generate static files
 */
router.post('/:siteId/generate', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { siteId } = req.params;

    const site = await siteBuilderService.getSiteById(siteId);
    
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Verify ownership
    if (site.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const outputDir = await siteBuilderService.generateStaticFiles(siteId);

    return res.json({
      success: true,
      message: 'Static files generated successfully',
      outputDir
    });

  } catch (error) {
    console.error('Generate files error:', error);
    return res.status(500).json({
      error: 'Failed to generate static files',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/v1/sites/:siteId/deploy
 * Deploy site to FTP/SFTP
 */
router.post('/:siteId/deploy', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { siteId } = req.params;

    const site = await siteBuilderService.getSiteById(siteId);
    
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Verify ownership
    if (site.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Deploy site
    const result = await ftpDeploymentService.deploySite(siteId);

    if (result.success) {
      return res.json({
        success: true,
        message: 'Site deployed successfully',
        deploymentId: result.deploymentId,
        filesUploaded: result.filesUploaded,
        duration: result.duration
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('Deploy site error:', error);
    return res.status(500).json({
      error: 'Failed to deploy site',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/v1/sites/:siteId/deployments
 * Get deployment history
 */
router.get('/:siteId/deployments', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { siteId } = req.params;

    const site = await siteBuilderService.getSiteById(siteId);
    
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Verify ownership
    if (site.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const deployments = await ftpDeploymentService.getDeploymentHistory(siteId);

    return res.json({
      success: true,
      deployments
    });

  } catch (error) {
    console.error('Get deployments error:', error);
    return res.status(500).json({
      error: 'Failed to fetch deployment history'
    });
  }
});

/**
 * GET /api/v1/sites/:siteId/generation-status
 * Lightweight polling endpoint for AI generation progress
 */
router.get('/:siteId/generation-status', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { siteId } = req.params;
    const site = await siteBuilderService.getSiteById(siteId);
    if (!site) return res.status(404).json({ error: 'Site not found' });
    if (site.user_id !== userId) return res.status(403).json({ error: 'Access denied' });

    const result: any = { success: true, status: site.status };
    if (site.status === 'generated' && site.generated_html) {
      result.html = site.generated_html;
    }
    if (site.status === 'failed' && site.generation_error) {
      result.error = site.generation_error;
    }
    return res.json(result);
  } catch (error) {
    console.error('Generation status error:', error);
    return res.status(500).json({ error: 'Failed to check generation status' });
  }
});

/**
 * POST /api/v1/sites/upload/logo
 * Upload logo image
 */
router.post('/upload/logo', requireAuth, upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const url = `https://api.softaware.net.za/uploads/sites/${req.file.filename}`;

    return res.json({
      success: true,
      url
    });

  } catch (error) {
    console.error('Upload logo error:', error);
    return res.status(500).json({
      error: 'Failed to upload logo',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/v1/sites/upload/hero
 * Upload hero image
 */
router.post('/upload/hero', requireAuth, upload.single('hero'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const url = `https://api.softaware.net.za/uploads/sites/${req.file.filename}`;

    return res.json({
      success: true,
      url
    });

  } catch (error) {
    console.error('Upload hero image error:', error);
    return res.status(500).json({
      error: 'Failed to upload hero image',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/v1/sites/generate-ai
 * Start async AI website generation — returns immediately, generates in background.
 * Frontend polls GET /api/v1/sites/:siteId/generation-status for result.
 *
 * Body: { siteId, businessName, tagline, aboutText, services[], logoUrl?, heroImageUrl?, clientId }
 */
router.post('/generate-ai', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      siteId,
      businessName,
      tagline,
      aboutText,
      services,
      logoUrl,
      heroImageUrl,
      clientId,
      includeForm,
      includeAssistant,
      formConfig,
    } = req.body;

    // Server-side tier resolution — never trust client-supplied tier
    const userTier = await resolveUserTier(userId);
    const resolvedTier = userTier.tier;

    // Validate required fields
    if (!businessName || !tagline || !aboutText || !services) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['businessName', 'tagline', 'aboutText', 'services']
      });
    }

    if (!Array.isArray(services) || services.length === 0) {
      return res.status(400).json({ error: 'services must be a non-empty array' });
    }

    // Verify site ownership if siteId provided
    let targetSiteId = siteId;
    if (targetSiteId) {
      const site = await siteBuilderService.getSiteById(targetSiteId);
      if (!site) return res.status(404).json({ error: 'Site not found' });
      if (site.user_id !== userId) return res.status(403).json({ error: 'Access denied' });
    }

    // Mark as generating
    if (targetSiteId) {
      await siteBuilderService.setGenerating(targetSiteId);
    }

    // Calculate queue position (paid = 0, free = count of pending free jobs)
    let queuePosition = 0;
    if (resolvedTier === 'free') {
      const row = await db.queryOne<{ cnt: number }>(
        `SELECT COUNT(*) AS cnt FROM generated_sites WHERE status = 'generating'`
      );
      queuePosition = row?.cnt || 0;
    }

    console.log(`[ai-generation] Starting ${resolvedTier} generation for: ${businessName} (queue pos: ${queuePosition})`);

    // ── Return immediately — generation runs in background ──
    res.json({
      success: true,
      generating: true,
      siteId: targetSiteId,
      tier: resolvedTier,
      queuePosition,
      message: resolvedTier === 'paid'
        ? 'Priority generation started — your site is being built now.'
        : 'Your project has been queued for generation.'
    });

    // ── Background generation ──────────────────────────────────
    (async () => {
      try {
        // AI-enhanced content — start with user's raw input as fallback
        let enhancedTagline = tagline || businessName;
        let enhancedHeroSubtitle = '';
        let enhancedCtaText = '';
        let enhancedAbout = aboutText;
        let serviceDescriptions: string[] = [];

        // ── Single AI call to enrich ALL content ──
        const enrichPrompt = `You are an expert marketing copywriter creating website content. Given the business info below, generate compelling, professional content that would impress visitors.

Business name: ${businessName}
Tagline: ${tagline || '(none provided)'}
About: ${aboutText}
Services: ${services.join(', ')}

Output ONLY a JSON object (no markdown, no code fences, no explanation) with this structure:
{"tagline":"<catchy headline, 5-12 words, action-oriented>","heroSubtitle":"<1-2 sentence supporting text that expands on the tagline and builds trust>","ctaText":"<call-to-action button text, 2-4 words, e.g. 'Start Your Project'>","about":"<3-5 compelling sentences: what the business does, why clients choose them, what makes them unique. Use professional marketing language, not just the user's words.>","services":[{"name":"<service name>","desc":"<2-3 sentence description explaining what this service includes, who it's for, and its key benefit>"}]}

IMPORTANT:
- The about section should be MUCH richer than the user's input — add value propositions, trust signals, and professional tone.
- Service descriptions should sell the service, not just name it.
- Include one object in the services array for each service listed above, in order.`;

        if (resolvedTier === 'paid') {
          // ── Paid tier: GLM → OpenRouter → Ollama fallback chain ──
          let paidEnriched = false;

          // 1. Try GLM first (Anthropic-compatible Messages API)
          try {
            const glmKey = await getSecret('GLM', env.GLM);
            if (glmKey) {
              const glmModel = env.GLM_MODEL || 'glm-4-plus';
              console.log('[ai-generation] Paid tier — trying GLM:', glmModel);

              const glmRes = await fetch('https://api.z.ai/api/anthropic/v1/messages', {
                method: 'POST',
                headers: {
                  'x-api-key': glmKey,
                  'anthropic-version': '2023-06-01',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: glmModel,
                  max_tokens: 1024,
                  system: 'You are a JSON API. Output ONLY valid JSON. No markdown fences, no explanation.',
                  messages: [{ role: 'user', content: enrichPrompt }],
                  temperature: 0.7,
                }),
                signal: AbortSignal.timeout(30000),
              });

              if (glmRes.ok) {
                const glmData = (await glmRes.json()) as any;
                const raw = (glmData.content ?? [])
                  .filter((b: any) => b.type === 'text')
                  .map((b: any) => b.text)
                  .join('');
                const parsed = parseEnrichmentJson(raw);
                if (parsed) {
                  enhancedTagline = parsed.tagline || enhancedTagline;
                  enhancedHeroSubtitle = parsed.heroSubtitle || enhancedHeroSubtitle;
                  enhancedCtaText = parsed.ctaText || enhancedCtaText;
                  enhancedAbout = parsed.about || enhancedAbout;
                  serviceDescriptions = parsed.serviceDescs;
                  paidEnriched = true;
                  console.log('[ai-generation] All content enriched via GLM');
                  logAnonymizedChat('sitebuilder', enrichPrompt.slice(0, 200), raw.slice(0, 200), {
                    source: 'sitebuilder', model: glmModel, provider: 'glm',
                  });
                }
              } else {
                console.warn(`[ai-generation] GLM ${glmRes.status} — trying OpenRouter`);
              }
            }
          } catch (glmErr) {
            console.warn(`[ai-generation] GLM failed: ${(glmErr as Error).message} — trying OpenRouter`);
          }

          // 2. Try OpenRouter if GLM didn't succeed
          if (!paidEnriched) {
            try {
              const orApiKey = await getSecret('OPENROUTER');
              if (orApiKey) {
                const orModel = env.SITE_BUILDER_OPENROUTER_MODEL || 'openai/gpt-4o-mini';
                console.log('[ai-generation] Paid tier — enriching via OpenRouter:', orModel);

                const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${orApiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://softaware.net.za',
                    'X-Title': 'SoftAware Site Builder',
                  },
                  body: JSON.stringify({
                    model: orModel,
                    messages: [
                      { role: 'system', content: 'You are a JSON API. Output ONLY valid JSON. No markdown fences, no explanation.' },
                      { role: 'user', content: enrichPrompt }
                    ],
                    max_tokens: 800,
                    temperature: 0.7,
                  }),
                  signal: AbortSignal.timeout(30000),
                });

                if (orRes.ok) {
                  const orData = await orRes.json() as any;
                  const raw = (orData.choices?.[0]?.message?.content || '').trim();
                  const parsed = parseEnrichmentJson(raw);
                  if (parsed) {
                    enhancedTagline = parsed.tagline || enhancedTagline;
                    enhancedHeroSubtitle = parsed.heroSubtitle || enhancedHeroSubtitle;
                    enhancedCtaText = parsed.ctaText || enhancedCtaText;
                    enhancedAbout = parsed.about || enhancedAbout;
                    serviceDescriptions = parsed.serviceDescs;
                    paidEnriched = true;
                    console.log('[ai-generation] All content enriched via OpenRouter');
                    logAnonymizedChat('sitebuilder', enrichPrompt.slice(0, 200), raw.slice(0, 200), {
                      source: 'sitebuilder', model: orModel, provider: 'openrouter',
                    });
                  }
                }
              } else {
                console.warn('[ai-generation] No OPENROUTER key — falling back to Ollama');
              }
            } catch (orErr) {
              console.warn('[ai-generation] OpenRouter failed:', (orErr as Error).message, '— falling back to Ollama');
            }
          }

          // 3. Final fallback: local Ollama (same as free tier)
          if (!paidEnriched) {
            console.log('[ai-generation] Paid tier — all remote providers failed, using Ollama fallback');
            try {
              const ollamaUrl = `${env.OLLAMA_BASE_URL.replace(/\/$/, '')}/api/chat`;
              const model = env.SITE_BUILDER_OLLAMA_MODEL;
              const ollamaStart = Date.now();

              const aiRes = await axios.post(
                ollamaUrl,
                {
                  model,
                  messages: [
                    { role: 'system', content: 'You are a JSON API. Output ONLY valid JSON. No markdown fences, no explanation.' },
                    { role: 'user', content: enrichPrompt }
                  ],
                  stream: false,
                  options: { temperature: 0.6, num_predict: 512 }
                },
                { timeout: 300000 }
              );

              const ollamaMs = Date.now() - ollamaStart;
              const raw = (aiRes.data.message?.content || '').trim();
              console.log(`[ai-generation] Ollama (paid fallback) responded in ${ollamaMs}ms, raw length: ${raw.length}`);
              const parsed = parseEnrichmentJson(raw);
              if (parsed) {
                enhancedTagline = parsed.tagline || enhancedTagline;
                enhancedHeroSubtitle = parsed.heroSubtitle || enhancedHeroSubtitle;
                enhancedCtaText = parsed.ctaText || enhancedCtaText;
                enhancedAbout = parsed.about || enhancedAbout;
                serviceDescriptions = parsed.serviceDescs;
                console.log('[ai-generation] All content enriched via Ollama (paid fallback) ✓');
                logAnonymizedChat('sitebuilder', enrichPrompt.slice(0, 200), raw.slice(0, 200), {
                  source: 'sitebuilder', model, provider: 'ollama', durationMs: ollamaMs,
                });
              } else {
                console.warn('[ai-generation] Ollama (paid fallback) returned non-parseable JSON:', raw.slice(0, 300));
              }
            } catch (aiErr) {
              const errMsg = aiErr instanceof Error ? aiErr.message : 'unknown';
              const errCode = axios.isAxiosError(aiErr) ? aiErr.code : undefined;
              console.error('[ai-generation] Ollama fallback also FAILED:', errMsg, errCode ? `(${errCode})` : '');
            }
          }
        } else {
          // ── Free tier: local Ollama for enrichment ──
          try {
            const ollamaUrl = `${env.OLLAMA_BASE_URL.replace(/\/$/, '')}/api/chat`;
            const model = env.SITE_BUILDER_OLLAMA_MODEL;
            const ollamaStart = Date.now();
            console.log('[ai-generation] Free tier — enriching all content via', model, '| URL:', ollamaUrl);

            const aiRes = await axios.post(
              ollamaUrl,
              {
                model,
                messages: [
                  { role: 'system', content: 'You are a JSON API. Output ONLY valid JSON. No markdown fences, no explanation.' },
                  { role: 'user', content: enrichPrompt }
                ],
                stream: false,
                options: { temperature: 0.6, num_predict: 512 }
              },
              { timeout: 300000 }
            );

            const ollamaMs = Date.now() - ollamaStart;
            const raw = (aiRes.data.message?.content || '').trim();
            console.log(`[ai-generation] Ollama responded in ${ollamaMs}ms, raw length: ${raw.length}`);
            const parsed = parseEnrichmentJson(raw);
            if (parsed) {
              enhancedTagline = parsed.tagline || enhancedTagline;
              enhancedHeroSubtitle = parsed.heroSubtitle || enhancedHeroSubtitle;
              enhancedCtaText = parsed.ctaText || enhancedCtaText;
              enhancedAbout = parsed.about || enhancedAbout;
              serviceDescriptions = parsed.serviceDescs;
              console.log('[ai-generation] All content enriched via Ollama ✓');
              logAnonymizedChat('sitebuilder', enrichPrompt.slice(0, 200), raw.slice(0, 200), {
                source: 'sitebuilder', model, provider: 'ollama', durationMs: ollamaMs,
              });
            } else {
              console.warn('[ai-generation] Ollama returned non-parseable JSON:', raw.slice(0, 300));
            }
          } catch (aiErr) {
            const errMsg = aiErr instanceof Error ? aiErr.message : 'unknown';
            const errCode = axios.isAxiosError(aiErr) ? aiErr.code : undefined;
            console.error('[ai-generation] Ollama enrichment FAILED:', errMsg, errCode ? `(${errCode})` : '');
          }
        }

        // Generate HTML from template — guaranteed well-styled output
        const { generateSiteHtml } = await import('../services/siteBuilderTemplate.js');

        // Fetch theme colour from DB
        let themeColor = '#0044cc';
        if (targetSiteId) {
          const siteRecord = await siteBuilderService.getSiteById(targetSiteId);
          if (siteRecord?.theme_color) themeColor = siteRecord.theme_color;
        }

        // Resolve form/assistant flags (default: form=true, assistant=false)
        const shouldIncludeForm = includeForm !== false;
        const shouldIncludeAssistant = includeAssistant === true && !!clientId;

        // Store form_config and flags on the site record
        if (targetSiteId) {
          const updates: Record<string, any> = {
            includeForm: shouldIncludeForm ? 1 : 0,
            includeAssistant: shouldIncludeAssistant ? 1 : 0,
          };
          if (formConfig && shouldIncludeForm) {
            updates.formConfig = JSON.stringify(formConfig);
          }
          await siteBuilderService.updateSite(targetSiteId, updates);
        }

        const html = generateSiteHtml({
          businessName,
          tagline: enhancedTagline,
          heroSubtitle: enhancedHeroSubtitle,
          ctaText: enhancedCtaText,
          aboutText: enhancedAbout,
          services,
          serviceDescriptions,
          logoUrl: logoUrl || '',
          heroImageUrl: heroImageUrl || '',
          clientId: clientId || '',
          themeColor,
          includeForm: shouldIncludeForm,
          includeAssistant: shouldIncludeAssistant,
          formConfig: shouldIncludeForm ? formConfig : undefined,
          siteId: targetSiteId || '',
        });

        console.log(`[ai-generation] HTML generated (${resolvedTier} tier), size: ${html.length} bytes`);

        // Store in DB
        if (targetSiteId) {
          await siteBuilderService.storeGeneratedHtml(targetSiteId, html);
        }

      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[ai-generation] Background error:', errMsg);

        if (targetSiteId) {
          let userMsg = 'Failed to generate website. Please try again.';
          if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNREFUSED') userMsg = 'AI service unavailable — could not connect to Ollama.';
            else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') userMsg = 'AI generation timed out. Please try again.';
          }
          await siteBuilderService.setGenerationError(targetSiteId, userMsg);
        }
      }
    })();

  } catch (error) {
    console.error('[ai-generation] Error:', error);
    return res.status(500).json({
      error: 'Failed to start website generation',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/v1/sites/:siteId/skip-queue
 * Re-trigger generation with paid tier for a site that's currently in the queue.
 * Uses the site data already stored in the database.
 */
router.post('/:siteId/skip-queue', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { siteId } = req.params;
    const site = await siteBuilderService.getSiteById(siteId);
    if (!site) return res.status(404).json({ error: 'Site not found' });
    if (site.user_id !== userId) return res.status(403).json({ error: 'Access denied' });

    if (site.status !== 'generating') {
      return res.status(400).json({ error: 'Site is not currently generating' });
    }

    const servicesList = site.services
      ? site.services.split(/[,\n]+/).map(s => s.trim()).filter(Boolean)
      : [];

    // Mark as generating (resets timer)
    await siteBuilderService.setGenerating(siteId);

    console.log(`[ai-generation] Skip-queue → paid re-trigger for: ${site.business_name}`);

    // Return immediately
    res.json({
      success: true,
      generating: true,
      siteId,
      tier: 'paid',
      queuePosition: 0,
      message: 'Priority generation started — your site is being built now.'
    });

    // ── Background generation (same logic as generate-ai with tier=paid) ──
    const businessName = site.business_name;
    const tagline = site.tagline || businessName;
    const aboutText = site.about_us || '';
    const services = servicesList;
    const logoUrl = site.logo_url || '';
    const heroImageUrl = site.hero_image_url || '';
    const clientId = site.widget_client_id || siteId;

    (async () => {
      try {
        let enhancedTagline = tagline;
        let enhancedHeroSubtitle = '';
        let enhancedCtaText = '';
        let enhancedAbout = aboutText;
        let serviceDescriptions: string[] = [];

        const enrichPrompt = `You are an expert marketing copywriter creating website content. Given the business info below, generate compelling, professional content that would impress visitors.

Business name: ${businessName}
Tagline: ${tagline}
About: ${aboutText}
Services: ${services.join(', ')}

Output ONLY a JSON object (no markdown, no code fences, no explanation) with this structure:
{"tagline":"<catchy headline, 5-12 words, action-oriented>","heroSubtitle":"<1-2 sentence supporting text that expands on the tagline and builds trust>","ctaText":"<call-to-action button text, 2-4 words, e.g. 'Start Your Project'>","about":"<3-5 compelling sentences: what the business does, why clients choose them, what makes them unique. Use professional marketing language, not just the user's words.>","services":[{"name":"<service name>","desc":"<2-3 sentence description explaining what this service includes, who it's for, and its key benefit>"}]}

IMPORTANT:
- The about section should be MUCH richer than the user's input — add value propositions, trust signals, and professional tone.
- Service descriptions should sell the service, not just name it.
- Include one object in the services array for each service listed above, in order.`;

        // ── Paid tier: GLM → OpenRouter → Ollama fallback ──
        let paidEnriched = false;

        // 1. Try GLM first
        try {
          const glmKey = await getSecret('GLM');
          if (glmKey) {
            console.log('[ai-generation] Skip-queue — enriching via GLM');
            const glmRes = await fetch('https://api.z.ai/api/anthropic/v1/messages', {
              method: 'POST',
              headers: {
                'x-api-key': glmKey,
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01',
              },
              body: JSON.stringify({
                model: env.SITE_BUILDER_GLM_MODEL || 'claude-sonnet-4-20250514',
                max_tokens: 1024,
                messages: [{ role: 'user', content: enrichPrompt }],
              }),
              signal: AbortSignal.timeout(30000),
            });
            if (glmRes.ok) {
              const glmData = await glmRes.json() as any;
              const raw = (glmData.content || [])
                .filter((b: any) => b.type === 'text')
                .map((b: any) => b.text)
                .join('');
              const parsed = parseEnrichmentJson(raw);
              if (parsed) {
                enhancedTagline = parsed.tagline || enhancedTagline;
                enhancedHeroSubtitle = parsed.heroSubtitle || enhancedHeroSubtitle;
                enhancedCtaText = parsed.ctaText || enhancedCtaText;
                enhancedAbout = parsed.about || enhancedAbout;
                serviceDescriptions = parsed.serviceDescs;
                paidEnriched = true;
                console.log('[ai-generation] Skip-queue enriched via GLM');
                logAnonymizedChat('sitebuilder', enrichPrompt.slice(0, 200), raw.slice(0, 200), {
                  source: 'sitebuilder', model: env.SITE_BUILDER_GLM_MODEL || 'claude-sonnet-4-20250514', provider: 'glm',
                });
              }
            }
          }
        } catch (e) {
          console.warn('[ai-generation] Skip-queue GLM failed:', (e as Error).message);
        }

        // 2. Try OpenRouter
        if (!paidEnriched) {
          try {
            const orApiKey = await getSecret('OPENROUTER');
            if (orApiKey) {
              const orModel = env.SITE_BUILDER_OPENROUTER_MODEL || 'openai/gpt-4o-mini';
              console.log('[ai-generation] Skip-queue — enriching via OpenRouter:', orModel);
              const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${orApiKey}`,
                  'Content-Type': 'application/json',
                  'HTTP-Referer': 'https://softaware.net.za',
                  'X-Title': 'SoftAware Site Builder',
                },
                body: JSON.stringify({
                  model: orModel,
                  messages: [
                    { role: 'system', content: 'You are a JSON API. Output ONLY valid JSON. No markdown fences, no explanation.' },
                    { role: 'user', content: enrichPrompt }
                  ],
                  max_tokens: 800,
                  temperature: 0.7,
                }),
                signal: AbortSignal.timeout(30000),
              });
              if (orRes.ok) {
                const orData = await orRes.json() as any;
                const raw = (orData.choices?.[0]?.message?.content || '').trim();
                const parsed = parseEnrichmentJson(raw);
                if (parsed) {
                  enhancedTagline = parsed.tagline || enhancedTagline;
                  enhancedHeroSubtitle = parsed.heroSubtitle || enhancedHeroSubtitle;
                  enhancedCtaText = parsed.ctaText || enhancedCtaText;
                  enhancedAbout = parsed.about || enhancedAbout;
                  serviceDescriptions = parsed.serviceDescs;
                  paidEnriched = true;
                  console.log('[ai-generation] Skip-queue enriched via OpenRouter');
                  logAnonymizedChat('sitebuilder', enrichPrompt.slice(0, 200), raw.slice(0, 200), {
                    source: 'sitebuilder', model: orModel, provider: 'openrouter',
                  });
                }
              }
            }
          } catch (e) {
            console.warn('[ai-generation] Skip-queue OpenRouter failed:', (e as Error).message);
          }
        }

        // 3. Ollama fallback
        if (!paidEnriched) {
          try {
            const ollamaUrl = `${env.OLLAMA_BASE_URL.replace(/\/$/, '')}/api/chat`;
            const model = env.SITE_BUILDER_OLLAMA_MODEL;
            const ollamaStart = Date.now();
            console.log('[ai-generation] Skip-queue trying Ollama:', model);
            const aiRes = await axios.post(ollamaUrl, {
              model,
              messages: [
                { role: 'system', content: 'You are a JSON API. Output ONLY valid JSON. No markdown fences, no explanation.' },
                { role: 'user', content: enrichPrompt }
              ],
              stream: false,
              options: { temperature: 0.6, num_predict: 512 }
            }, { timeout: 300000 });
            const ollamaMs = Date.now() - ollamaStart;
            const raw = (aiRes.data.message?.content || '').trim();
            console.log(`[ai-generation] Skip-queue Ollama responded in ${ollamaMs}ms, raw length: ${raw.length}`);
            const parsed = parseEnrichmentJson(raw);
            if (parsed) {
              enhancedTagline = parsed.tagline || enhancedTagline;
              enhancedHeroSubtitle = parsed.heroSubtitle || enhancedHeroSubtitle;
              enhancedCtaText = parsed.ctaText || enhancedCtaText;
              enhancedAbout = parsed.about || enhancedAbout;
              serviceDescriptions = parsed.serviceDescs;
              console.log('[ai-generation] Skip-queue enriched via Ollama fallback ✓');
              logAnonymizedChat('sitebuilder', enrichPrompt.slice(0, 200), raw.slice(0, 200), {
                source: 'sitebuilder', model, provider: 'ollama', durationMs: ollamaMs,
              });
            } else {
              console.warn('[ai-generation] Skip-queue Ollama returned non-parseable JSON:', raw.slice(0, 300));
            }
          } catch (e) {
            const errMsg = (e as Error).message;
            const errCode = axios.isAxiosError(e) ? e.code : undefined;
            console.error('[ai-generation] Skip-queue Ollama FAILED:', errMsg, errCode ? `(${errCode})` : '');
          }
        }

        const { generateSiteHtml } = await import('../services/siteBuilderTemplate.js');
        let themeColor = site.theme_color || '#0044cc';

        // Read form/assistant flags from the site record
        const siteRow = await db.queryOne<any>(`SELECT include_form, include_assistant, form_config FROM generated_sites WHERE id = ?`, [siteId]);
        const skipIncludeForm = siteRow?.include_form !== 0;
        const skipIncludeAssistant = siteRow?.include_assistant === 1;
        let skipFormConfig: any = undefined;
        if (siteRow?.form_config) {
          try { skipFormConfig = typeof siteRow.form_config === 'string' ? JSON.parse(siteRow.form_config) : siteRow.form_config; } catch {}
        }

        const html = generateSiteHtml({
          businessName,
          tagline: enhancedTagline,
          heroSubtitle: enhancedHeroSubtitle,
          ctaText: enhancedCtaText,
          aboutText: enhancedAbout,
          services,
          serviceDescriptions,
          logoUrl,
          heroImageUrl,
          clientId: clientId as string,
          themeColor,
          includeForm: skipIncludeForm,
          includeAssistant: skipIncludeAssistant,
          formConfig: skipIncludeForm ? skipFormConfig : undefined,
          siteId,
        });

        console.log(`[ai-generation] Skip-queue HTML generated, size: ${html.length} bytes`);
        await siteBuilderService.storeGeneratedHtml(siteId, html);

      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[ai-generation] Skip-queue background error:', errMsg);
        await siteBuilderService.setGenerationError(siteId, 'Failed to generate website. Please try again.');
      }
    })();

  } catch (error) {
    console.error('[ai-generation] Skip-queue error:', error);
    return res.status(500).json({
      error: 'Failed to start priority generation',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/v1/sites/:siteId/polish
 * AI-assisted design polish — takes a user prompt + the current HTML,
 * sends to AI to modify, and stores the result.
 * Follows the standard queue process (marks generating, runs in background).
 */
router.post('/:siteId/polish', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { siteId } = req.params;
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'A polish prompt is required' });
    }

    const site = await siteBuilderService.getSiteById(siteId);
    if (!site) return res.status(404).json({ error: 'Site not found' });
    if (site.user_id !== userId) return res.status(403).json({ error: 'Access denied' });

    if (!site.generated_html) {
      return res.status(400).json({ error: 'This site has no generated HTML to polish. Generate first.' });
    }

    if (site.status === 'generating') {
      return res.status(409).json({ error: 'Site is already being generated. Please wait.' });
    }

    // Mark as generating
    await siteBuilderService.setGenerating(siteId);

    // Calculate queue position
    let queuePosition = 0;
    const row = await db.queryOne<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM generated_sites WHERE status = 'generating'`
    );
    queuePosition = row?.cnt || 0;

    console.log(`[ai-polish] Starting polish for "${site.business_name}" — prompt: "${prompt.trim().substring(0, 80)}…"`);

    // Resolve tier for provider routing
    const userTier = await resolveUserTier(userId);
    const polishTier = userTier.tier; // 'free' | 'paid'
    console.log(`[ai-polish] Tier: ${polishTier}`);

    // Return immediately
    res.json({
      success: true,
      generating: true,
      siteId,
      queuePosition,
      message: 'Polish request queued — AI is updating your design.'
    });

    // ── Background polish generation ──
    (async () => {
      try {
        const currentHtml = site.generated_html!;
        const userPrompt = prompt.trim();

        // Build the polish prompt — instruct AI to return modified HTML
        const polishPrompt = `You are an expert web designer and frontend developer. You will receive the COMPLETE HTML source of a landing page, plus an edit instruction from the user.

EDIT INSTRUCTION: "${userPrompt}"

Apply ONLY the requested change. Keep ALL other elements, styles, scripts, and structure intact. Return the COMPLETE modified HTML document — not a snippet, not a diff, the FULL page.

RULES:
- Do NOT remove or alter the Tailwind CDN script tag.
- Do NOT remove or alter any widget script tags at the bottom.
- Do NOT remove the contact form or its hidden fields.
- Do NOT change the navigation structure unless specifically asked.
- Preserve all existing content unless the instruction says otherwise.
- If the instruction is about colours, apply it consistently across the page.
- If the instruction asks for layout changes, use proper Tailwind responsive classes.
- Return ONLY the HTML (no markdown code fences, no explanation).

HERE IS THE CURRENT HTML:
${currentHtml}`;

        let modifiedHtml = '';

        // ── Try providers in order: paid → GLM → OpenRouter → Ollama; free → Ollama only ──
        let polished = false;

        if (polishTier === 'paid') {
          // 1. GLM (paid only)
          try {
            const glmKey = await getSecret('GLM');
            if (glmKey) {
              console.log('[ai-polish] Trying GLM');
              const glmRes = await fetch('https://api.z.ai/api/anthropic/v1/messages', {
                method: 'POST',
                headers: {
                  'x-api-key': glmKey,
                  'Content-Type': 'application/json',
                  'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                  model: env.SITE_BUILDER_GLM_MODEL || 'claude-sonnet-4-20250514',
                  max_tokens: 16000,
                  messages: [{ role: 'user', content: polishPrompt }],
                }),
                signal: AbortSignal.timeout(60000),
              });
              if (glmRes.ok) {
                const glmData = await glmRes.json() as any;
                const raw = (glmData.content || [])
                  .filter((b: any) => b.type === 'text')
                  .map((b: any) => b.text)
                  .join('');
                const extracted = extractHtml(raw);
                if (extracted) {
                  modifiedHtml = extracted;
                  polished = true;
                  console.log('[ai-polish] Polished via GLM');
                  logAnonymizedChat('sitebuilder', 'polish-request', raw.slice(0, 200), {
                    source: 'sitebuilder', model: env.SITE_BUILDER_GLM_MODEL || 'claude-sonnet-4-20250514', provider: 'glm',
                  });
                }
              } else {
                console.warn(`[ai-polish] GLM ${glmRes.status}`);
              }
            }
          } catch (e) {
            console.warn('[ai-polish] GLM failed:', (e as Error).message);
          }

          // 2. OpenRouter (paid only)
          if (!polished) {
            try {
              const orApiKey = await getSecret('OPENROUTER');
              if (orApiKey) {
                const orModel = env.SITE_BUILDER_OPENROUTER_MODEL || 'openai/gpt-4o-mini';
                console.log('[ai-polish] Trying OpenRouter:', orModel);
                const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${orApiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://softaware.net.za',
                    'X-Title': 'SoftAware Site Builder',
                  },
                  body: JSON.stringify({
                    model: orModel,
                    messages: [
                      { role: 'system', content: 'You are a web designer. Return only the complete modified HTML. No markdown fences, no explanation.' },
                      { role: 'user', content: polishPrompt }
                    ],
                    max_tokens: 16000,
                    temperature: 0.3,
                  }),
                  signal: AbortSignal.timeout(60000),
                });
                if (orRes.ok) {
                  const orData = await orRes.json() as any;
                  const raw = (orData.choices?.[0]?.message?.content || '').trim();
                  const extracted = extractHtml(raw);
                  if (extracted) {
                    modifiedHtml = extracted;
                    polished = true;
                    console.log('[ai-polish] Polished via OpenRouter');
                    logAnonymizedChat('sitebuilder', 'polish-request', raw.slice(0, 200), {
                      source: 'sitebuilder', model: orModel, provider: 'openrouter',
                    });
                  }
                }
              }
            } catch (e) {
              console.warn('[ai-polish] OpenRouter failed:', (e as Error).message);
            }
          }
        }

        // 3. Ollama fallback (all tiers) / sole provider (free tier)
        if (!polished) {
          try {
            const ollamaUrl = `${env.OLLAMA_BASE_URL.replace(/\/$/, '')}/api/chat`;
            const model = env.SITE_BUILDER_OLLAMA_MODEL;
            const ollamaStart = Date.now();
            console.log('[ai-polish] Trying Ollama:', model);
            const aiRes = await axios.post(ollamaUrl, {
              model,
              messages: [
                { role: 'system', content: 'You are a web designer. Return only the complete modified HTML. No markdown fences.' },
                { role: 'user', content: polishPrompt }
              ],
              stream: false,
              options: { temperature: 0.3, num_predict: 16384 }
            }, { timeout: 180000 });
            const ollamaMs = Date.now() - ollamaStart;
            const raw = (aiRes.data.message?.content || '').trim();
            console.log(`[ai-polish] Ollama responded in ${ollamaMs}ms, raw length: ${raw.length}`);
            const extracted = extractHtml(raw);
            if (extracted) {
              modifiedHtml = extracted;
              polished = true;
              console.log('[ai-polish] Polished via Ollama ✓');
              logAnonymizedChat('sitebuilder', 'polish-request', raw.slice(0, 200), {
                source: 'sitebuilder', model, provider: 'ollama', durationMs: ollamaMs,
              });
            } else {
              console.warn('[ai-polish] Ollama returned no valid HTML, raw length:', raw.length);
            }
          } catch (e) {
            const errMsg = (e as Error).message;
            const errCode = axios.isAxiosError(e) ? (e as any).code : undefined;
            console.error('[ai-polish] Ollama FAILED:', errMsg, errCode ? `(${errCode})` : '');
          }
        }

        if (polished && modifiedHtml) {
          await siteBuilderService.storeGeneratedHtml(siteId, modifiedHtml);
          console.log(`[ai-polish] Done — HTML stored (${modifiedHtml.length} bytes)`);
        } else {
          // Restore original HTML and mark as generated (not failed, since original is intact)
          await siteBuilderService.storeGeneratedHtml(siteId, currentHtml);
          console.warn('[ai-polish] No provider returned valid HTML — original preserved');
        }

      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[ai-polish] Background error:', errMsg);
        // Don't lose the original HTML on error — mark as generated with original
        if (site.generated_html) {
          await siteBuilderService.storeGeneratedHtml(siteId, site.generated_html);
        } else {
          await siteBuilderService.setGenerationError(siteId, 'Polish failed. Please try again.');
        }
      }
    })();

  } catch (error) {
    console.error('[ai-polish] Error:', error);
    return res.status(500).json({
      error: 'Failed to start polish',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// Multi-page routes (paid tiers only)
// ═══════════════════════════════════════════════════════════════════════

const VALID_PAGE_TYPES = ['home', 'about', 'services', 'contact', 'gallery', 'faq', 'pricing', 'custom'] as const;

/**
 * GET /api/v1/sites/:siteId/pages
 * List all pages for a site
 */
router.get('/:siteId/pages', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { siteId } = req.params;

    const site = await siteBuilderService.getSiteById(siteId);
    if (!site) return res.status(404).json({ error: 'Site not found' });
    if (site.user_id !== userId) return res.status(403).json({ error: 'Access denied' });

    const pages = await siteBuilderService.getPagesBySiteId(siteId);
    const maxPages = await siteBuilderService.getMaxPages(siteId);

    // Strip bulky generated_html from list — fetch via individual page endpoint
    const safePagesArr = pages.map(p => ({
      ...p,
      generated_html: undefined,
      content_data: typeof p.content_data === 'string' ? JSON.parse(p.content_data || '{}') : p.content_data
    }));

    return res.json({
      success: true,
      pages: safePagesArr,
      maxPages,
      currentCount: pages.length
    });
  } catch (error) {
    console.error('List pages error:', error);
    return res.status(500).json({ error: 'Failed to list pages' });
  }
});

/**
 * POST /api/v1/sites/:siteId/pages
 * Create a new page (paid tiers only — enforced via max_pages)
 */
router.post('/:siteId/pages', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { siteId } = req.params;

    const site = await siteBuilderService.getSiteById(siteId);
    if (!site) return res.status(404).json({ error: 'Site not found' });
    if (site.user_id !== userId) return res.status(403).json({ error: 'Access denied' });

    // Tier check: enforce max_pages limit
    const maxPages = await siteBuilderService.getMaxPages(siteId);
    if (maxPages <= 1) {
      return res.status(403).json({
        error: 'Multi-page sites are available on paid plans only. Upgrade to add more pages.',
        code: 'UPGRADE_REQUIRED'
      });
    }

    const currentCount = await siteBuilderService.getPageCount(siteId);
    if (currentCount >= maxPages) {
      return res.status(400).json({
        error: `Page limit reached (${maxPages}). Upgrade your plan for more pages.`,
        code: 'PAGE_LIMIT_REACHED',
        maxPages,
        currentCount
      });
    }

    const { pageType, pageSlug, pageTitle, contentData, sortOrder } = req.body;

    if (!pageType || !pageSlug || !pageTitle) {
      return res.status(400).json({ error: 'pageType, pageSlug, and pageTitle are required' });
    }

    if (!VALID_PAGE_TYPES.includes(pageType)) {
      return res.status(400).json({ error: `Invalid pageType. Must be one of: ${VALID_PAGE_TYPES.join(', ')}` });
    }

    // Sanitize slug
    const slug = pageSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (!slug) {
      return res.status(400).json({ error: 'pageSlug must contain at least one alphanumeric character' });
    }

    const page = await siteBuilderService.createPage({
      siteId,
      pageType,
      pageSlug: slug,
      pageTitle,
      contentData: contentData || {},
      sortOrder
    });

    return res.status(201).json({
      success: true,
      page: {
        ...page,
        content_data: typeof page.content_data === 'string' ? JSON.parse(page.content_data || '{}') : page.content_data
      }
    });
  } catch (error: any) {
    if (error?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'A page with that slug already exists for this site' });
    }
    console.error('Create page error:', error);
    return res.status(500).json({ error: 'Failed to create page' });
  }
});

/**
 * GET /api/v1/sites/:siteId/pages/:pageId
 * Get a single page (with full generated_html)
 */
router.get('/:siteId/pages/:pageId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { siteId, pageId } = req.params;

    const site = await siteBuilderService.getSiteById(siteId);
    if (!site) return res.status(404).json({ error: 'Site not found' });
    if (site.user_id !== userId) return res.status(403).json({ error: 'Access denied' });

    const page = await siteBuilderService.getPageById(pageId);
    if (!page || page.site_id !== siteId) return res.status(404).json({ error: 'Page not found' });

    return res.json({
      success: true,
      page: {
        ...page,
        content_data: typeof page.content_data === 'string' ? JSON.parse(page.content_data || '{}') : page.content_data
      }
    });
  } catch (error) {
    console.error('Get page error:', error);
    return res.status(500).json({ error: 'Failed to fetch page' });
  }
});

/**
 * PUT /api/v1/sites/:siteId/pages/:pageId
 * Update a page
 */
router.put('/:siteId/pages/:pageId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { siteId, pageId } = req.params;

    const site = await siteBuilderService.getSiteById(siteId);
    if (!site) return res.status(404).json({ error: 'Site not found' });
    if (site.user_id !== userId) return res.status(403).json({ error: 'Access denied' });

    const page = await siteBuilderService.getPageById(pageId);
    if (!page || page.site_id !== siteId) return res.status(404).json({ error: 'Page not found' });

    const { pageTitle, pageSlug, pageType, contentData, generatedHtml, sortOrder, isPublished } = req.body;

    // Sanitize slug if provided
    let slug: string | undefined;
    if (pageSlug !== undefined) {
      slug = pageSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      if (!slug) {
        return res.status(400).json({ error: 'pageSlug must contain at least one alphanumeric character' });
      }
    }

    if (pageType !== undefined && !VALID_PAGE_TYPES.includes(pageType)) {
      return res.status(400).json({ error: `Invalid pageType. Must be one of: ${VALID_PAGE_TYPES.join(', ')}` });
    }

    await siteBuilderService.updatePage(pageId, {
      pageTitle,
      pageSlug: slug,
      pageType,
      contentData,
      generatedHtml,
      sortOrder,
      isPublished
    });

    const updatedPage = await siteBuilderService.getPageById(pageId);

    return res.json({
      success: true,
      page: {
        ...updatedPage,
        content_data: typeof updatedPage!.content_data === 'string'
          ? JSON.parse(updatedPage!.content_data || '{}')
          : updatedPage!.content_data
      }
    });
  } catch (error: any) {
    if (error?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'A page with that slug already exists for this site' });
    }
    console.error('Update page error:', error);
    return res.status(500).json({ error: 'Failed to update page' });
  }
});

/**
 * DELETE /api/v1/sites/:siteId/pages/:pageId
 * Delete a page
 */
router.delete('/:siteId/pages/:pageId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { siteId, pageId } = req.params;

    const site = await siteBuilderService.getSiteById(siteId);
    if (!site) return res.status(404).json({ error: 'Site not found' });
    if (site.user_id !== userId) return res.status(403).json({ error: 'Access denied' });

    const page = await siteBuilderService.getPageById(pageId);
    if (!page || page.site_id !== siteId) return res.status(404).json({ error: 'Page not found' });

    await siteBuilderService.deletePage(pageId);

    return res.json({ success: true, message: 'Page deleted successfully' });
  } catch (error) {
    console.error('Delete page error:', error);
    return res.status(500).json({ error: 'Failed to delete page' });
  }
});

/**
 * POST /api/v1/sites/:siteId/pages/:pageId/generate
 * Generate HTML for a single page using the template engine + AI enrichment.
 * Uses the page's content_data to feed into the template.
 */
router.post('/:siteId/pages/:pageId/generate', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { siteId, pageId } = req.params;

    const site = await siteBuilderService.getSiteById(siteId);
    if (!site) return res.status(404).json({ error: 'Site not found' });
    if (site.user_id !== userId) return res.status(403).json({ error: 'Access denied' });

    // Tier check
    const maxPages = await siteBuilderService.getMaxPages(siteId);
    if (maxPages <= 1) {
      return res.status(403).json({ error: 'Multi-page generation requires a paid plan.', code: 'UPGRADE_REQUIRED' });
    }

    const page = await siteBuilderService.getPageById(pageId);
    if (!page || page.site_id !== siteId) return res.status(404).json({ error: 'Page not found' });

    // Parse content_data
    let contentData: Record<string, any> = {};
    try {
      contentData = typeof page.content_data === 'string'
        ? JSON.parse(page.content_data || '{}')
        : page.content_data;
    } catch { /* empty */ }

    // Generate a standalone page HTML using the template engine
    const { generateSiteHtml } = await import('../services/siteBuilderTemplate.js');

    const themeColor = site.theme_color || '#0044cc';
    const businessName = contentData.businessName || site.business_name;
    const tagline = contentData.tagline || page.page_title;
    const aboutText = contentData.aboutText || contentData.description || page.page_title;
    const services = contentData.services || [];
    const logoUrl = contentData.logoUrl || site.logo_url || '';
    const heroImageUrl = contentData.heroImageUrl || site.hero_image_url || '';
    const clientId = site.widget_client_id || siteId;

    // Read form/assistant flags from the site record
    const siteRow = await db.queryOne<any>(`SELECT include_form, include_assistant, form_config FROM generated_sites WHERE id = ?`, [siteId]);
    const pageIncludeForm = siteRow?.include_form !== 0;
    const pageIncludeAssistant = siteRow?.include_assistant === 1;
    let pageFormConfig: any = undefined;
    if (siteRow?.form_config) {
      try { pageFormConfig = typeof siteRow.form_config === 'string' ? JSON.parse(siteRow.form_config) : siteRow.form_config; } catch {}
    }

    const html = generateSiteHtml({
      businessName,
      tagline,
      heroSubtitle: contentData.heroSubtitle || '',
      ctaText: contentData.ctaText || 'Contact Us',
      aboutText,
      services: Array.isArray(services) ? services : [services],
      serviceDescriptions: contentData.serviceDescriptions || [],
      logoUrl,
      heroImageUrl,
      clientId,
      themeColor,
      includeForm: pageIncludeForm,
      includeAssistant: pageIncludeAssistant,
      formConfig: pageIncludeForm ? pageFormConfig : undefined,
      siteId,
    });

    // Store the generated HTML on the page
    await siteBuilderService.updatePage(pageId, { generatedHtml: html });

    return res.json({
      success: true,
      message: 'Page HTML generated successfully',
      page: {
        id: page.id,
        page_slug: page.page_slug,
        page_title: page.page_title,
        html_length: html.length
      }
    });
  } catch (error) {
    console.error('Generate page HTML error:', error);
    return res.status(500).json({ error: 'Failed to generate page HTML' });
  }
});

/**
 * PATCH /api/v1/sites/:siteId/max-pages
 * Update the max_pages limit for a site (admin or system use)
 */
router.patch('/:siteId/max-pages', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { siteId } = req.params;
    const { maxPages } = req.body;

    const site = await siteBuilderService.getSiteById(siteId);
    if (!site) return res.status(404).json({ error: 'Site not found' });
    if (site.user_id !== userId) return res.status(403).json({ error: 'Access denied' });

    if (typeof maxPages !== 'number' || maxPages < 1 || maxPages > 50) {
      return res.status(400).json({ error: 'maxPages must be a number between 1 and 50' });
    }

    await siteBuilderService.setMaxPages(siteId, maxPages);

    return res.json({ success: true, maxPages });
  } catch (error) {
    console.error('Update max-pages error:', error);
    return res.status(500).json({ error: 'Failed to update page limit' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// Form Submissions
// ═══════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/sites/forms/submit
 * Public endpoint (no auth) — receives form submissions from generated sites.
 * Stores in DB, sends notification email to site owner, sends auto-reply if configured.
 * Rate-limited by IP to prevent abuse.
 */
const formSubmitLimiter = new Map<string, { count: number; resetAt: number }>();

router.post('/forms/submit', async (req: Request, res) => {
  try {
    const { site_id, bot_check_url, ...formFields } = req.body;

    // Honeypot check
    if (bot_check_url) {
      return res.status(200).json({ success: true, message: 'Thank you!' }); // silent fail for bots
    }

    if (!site_id) {
      return res.status(400).json({ error: 'Missing site_id' });
    }

    // Rate limit: max 10 submissions per IP per 10 minutes
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    const now = Date.now();
    const limiterKey = `${ip}:${site_id}`;
    const limiter = formSubmitLimiter.get(limiterKey);
    if (limiter) {
      if (now < limiter.resetAt) {
        if (limiter.count >= 10) {
          return res.status(429).json({ error: 'Too many submissions. Please try again later.' });
        }
        limiter.count++;
      } else {
        formSubmitLimiter.set(limiterKey, { count: 1, resetAt: now + 600000 });
      }
    } else {
      formSubmitLimiter.set(limiterKey, { count: 1, resetAt: now + 600000 });
    }

    // Verify site exists
    const site = await siteBuilderService.getSiteById(site_id);
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Check free tier submission limit: max 50 submissions per site
    const userTier = await resolveUserTier(site.user_id);
    if (userTier.tier === 'free') {
      const countRow = await db.queryOne<{ cnt: number }>(
        'SELECT COUNT(*) AS cnt FROM site_form_submissions WHERE site_id = ?',
        [site_id]
      );
      if ((countRow?.cnt || 0) >= 50) {
        return res.status(429).json({ error: 'This site has reached its submission limit.' });
      }
    }

    // Store submission
    const submissionId = (await import('crypto')).randomUUID();
    await db.execute(
      `INSERT INTO site_form_submissions (id, site_id, form_data, ip_address)
       VALUES (?, ?, ?, ?)`,
      [submissionId, site_id, JSON.stringify(formFields), ip]
    );

    console.log(`[form-submit] New submission for site ${site_id} from ${ip}`);

    // Parse form_config for destination email
    let formConfig: any = null;
    if (site.form_config) {
      try {
        formConfig = typeof site.form_config === 'string' ? JSON.parse(site.form_config) : site.form_config;
      } catch {}
    }

    const destinationEmail = formConfig?.destinationEmail;
    const autoReplyMessage = formConfig?.autoReplyMessage;
    const submitterEmail = formFields.email;

    // Send notification email to site owner (background, don't block response)
    if (destinationEmail) {
      (async () => {
        try {
          const { sendEmail } = await import('../services/emailService.js');
          const fieldsSummary = Object.entries(formFields)
            .map(([key, val]) => `<strong>${key}:</strong> ${val}`)
            .join('<br>');

          await sendEmail({
            to: destinationEmail,
            subject: `New form submission — ${site.business_name}`,
            html: `<h2>New Contact Form Submission</h2>
<p>You received a new form submission from your website <strong>${site.business_name}</strong>.</p>
<hr>
${fieldsSummary}
<hr>
<p style="color:#888;font-size:12px;">Submitted at ${new Date().toISOString()} from IP ${ip}</p>
<p style="color:#888;font-size:12px;">View all submissions in your <a href="https://softaware.net.za/portal/sites/${site_id}/submissions">dashboard</a>.</p>`,
          });

          await db.execute(
            'UPDATE site_form_submissions SET notification_sent = 1 WHERE id = ?',
            [submissionId]
          );
          console.log(`[form-submit] Notification sent to ${destinationEmail}`);
        } catch (emailErr) {
          console.error('[form-submit] Failed to send notification:', (emailErr as Error).message);
        }
      })();
    }

    // Send auto-reply to submitter (background)
    if (autoReplyMessage && submitterEmail) {
      (async () => {
        try {
          const { sendEmail } = await import('../services/emailService.js');
          await sendEmail({
            to: submitterEmail,
            subject: `Thank you for contacting ${site.business_name}`,
            html: `<p>${autoReplyMessage.replace(/\n/g, '<br>')}</p>
<p style="color:#888;font-size:12px;">This is an automated message from ${site.business_name}.</p>`,
          });
          console.log(`[form-submit] Auto-reply sent to ${submitterEmail}`);
        } catch (emailErr) {
          console.error('[form-submit] Failed to send auto-reply:', (emailErr as Error).message);
        }
      })();
    }

    return res.json({
      success: true,
      message: autoReplyMessage
        ? 'Thank you! We\'ll be in touch soon.'
        : 'Thank you for your submission!',
    });
  } catch (error) {
    console.error('[form-submit] Error:', error);
    return res.status(500).json({ error: 'Failed to process submission' });
  }
});

/**
 * GET /api/v1/sites/:siteId/submissions
 * List form submissions for a site (authenticated, owner only).
 * Supports pagination via ?page=1&limit=20 and filtering via ?unread=1
 */
router.get('/:siteId/submissions', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { siteId } = req.params;

    const site = await siteBuilderService.getSiteById(siteId);
    if (!site) return res.status(404).json({ error: 'Site not found' });
    if (site.user_id !== userId) return res.status(403).json({ error: 'Access denied' });

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;
    const unreadOnly = req.query.unread === '1';

    const whereClause = unreadOnly
      ? 'WHERE site_id = ? AND is_read = 0'
      : 'WHERE site_id = ?';

    const totalRow = await db.queryOne<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM site_form_submissions ${whereClause}`,
      [siteId]
    );
    const total = totalRow?.cnt || 0;

    const submissions = await db.query<any>(
      `SELECT id, form_data, submitted_at, ip_address, is_read, notification_sent
       FROM site_form_submissions ${whereClause}
       ORDER BY submitted_at DESC
       LIMIT ? OFFSET ?`,
      [siteId, limit, offset]
    );

    // Parse form_data JSON
    const parsed = (submissions || []).map((s: any) => ({
      ...s,
      form_data: typeof s.form_data === 'string' ? JSON.parse(s.form_data) : s.form_data,
    }));

    // Count unread
    const unreadRow = await db.queryOne<{ cnt: number }>(
      'SELECT COUNT(*) AS cnt FROM site_form_submissions WHERE site_id = ? AND is_read = 0',
      [siteId]
    );

    return res.json({
      success: true,
      submissions: parsed,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      unreadCount: unreadRow?.cnt || 0,
    });
  } catch (error) {
    console.error('List submissions error:', error);
    return res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

/**
 * PATCH /api/v1/sites/:siteId/submissions/:submissionId/read
 * Mark a submission as read
 */
router.patch('/:siteId/submissions/:submissionId/read', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { siteId, submissionId } = req.params;

    const site = await siteBuilderService.getSiteById(siteId);
    if (!site) return res.status(404).json({ error: 'Site not found' });
    if (site.user_id !== userId) return res.status(403).json({ error: 'Access denied' });

    await db.execute(
      'UPDATE site_form_submissions SET is_read = 1 WHERE id = ? AND site_id = ?',
      [submissionId, siteId]
    );

    return res.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    return res.status(500).json({ error: 'Failed to mark submission as read' });
  }
});

/**
 * DELETE /api/v1/sites/:siteId/submissions/:submissionId
 * Delete a submission
 */
router.delete('/:siteId/submissions/:submissionId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { siteId, submissionId } = req.params;

    const site = await siteBuilderService.getSiteById(siteId);
    if (!site) return res.status(404).json({ error: 'Site not found' });
    if (site.user_id !== userId) return res.status(403).json({ error: 'Access denied' });

    await db.execute(
      'DELETE FROM site_form_submissions WHERE id = ? AND site_id = ?',
      [submissionId, siteId]
    );

    return res.json({ success: true, message: 'Submission deleted' });
  } catch (error) {
    console.error('Delete submission error:', error);
    return res.status(500).json({ error: 'Failed to delete submission' });
  }
});

export default router;
