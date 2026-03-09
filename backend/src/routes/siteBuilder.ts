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

// ── Ensure generated_html + generation_error columns exist ───
(async () => {
  try {
    const cols = await db.query<{ Field: string }>(
      `SHOW COLUMNS FROM generated_sites WHERE Field IN ('generated_html', 'generation_error')`,
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
    // Ensure 'generating' is a valid status
    await db.execute(`ALTER TABLE generated_sites MODIFY COLUMN status ENUM('draft','generating','generated','deployed','failed') NOT NULL DEFAULT 'draft'`);
  } catch (err) {
    console.warn('[SiteBuilder] Column migration note:', (err as Error).message);
  }
})();

// Configure multer for image uploads
// __dirname at runtime = dist/routes/ → go up two levels to project root, then into uploads/sites
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

    return res.status(201).json({
      success: true,
      site: {
        ...site,
        ftp_password: undefined // Never return password
      }
    });

  } catch (error) {
    console.error('Create site error:', error);
    return res.status(500).json({
      error: 'Failed to create site',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
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
      if (!userId || site.user_id !== userId) return res.status(403).send('<h1>Access denied</h1>');
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
      tier = 'free'
    } = req.body;

    const resolvedTier = (tier === 'paid' ? 'paid' : 'free') as 'free' | 'paid';

    // Validate required fields
    if (!businessName || !tagline || !aboutText || !services || !clientId) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['businessName', 'tagline', 'aboutText', 'services', 'clientId']
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

              const aiRes = await axios.post(
                ollamaUrl,
                {
                  model,
                  messages: [
                    { role: 'system', content: 'You are a JSON API. Output ONLY valid JSON. No markdown fences, no explanation.' },
                    { role: 'user', content: enrichPrompt }
                  ],
                  stream: false,
                  options: { temperature: 0.6, num_predict: 1024 }
                },
                { timeout: 120000 }
              );

              const raw = (aiRes.data.message?.content || '').trim();
              const parsed = parseEnrichmentJson(raw);
              if (parsed) {
                enhancedTagline = parsed.tagline || enhancedTagline;
                enhancedHeroSubtitle = parsed.heroSubtitle || enhancedHeroSubtitle;
                enhancedCtaText = parsed.ctaText || enhancedCtaText;
                enhancedAbout = parsed.about || enhancedAbout;
                serviceDescriptions = parsed.serviceDescs;
                console.log('[ai-generation] All content enriched via Ollama (paid fallback)');
              }
            } catch (aiErr) {
              console.log('[ai-generation] Ollama fallback also failed (non-fatal):', aiErr instanceof Error ? aiErr.message : 'unknown');
            }
          }
        } else {
          // ── Free tier: local Ollama for enrichment ──
          try {
            const ollamaUrl = `${env.OLLAMA_BASE_URL.replace(/\/$/, '')}/api/chat`;
            const model = env.SITE_BUILDER_OLLAMA_MODEL;
            console.log('[ai-generation] Free tier — enriching all content via', model);

            const aiRes = await axios.post(
              ollamaUrl,
              {
                model,
                messages: [
                  { role: 'system', content: 'You are a JSON API. Output ONLY valid JSON. No markdown fences, no explanation.' },
                  { role: 'user', content: enrichPrompt }
                ],
                stream: false,
                options: { temperature: 0.6, num_predict: 1024 }
              },
              { timeout: 120000 }
            );

            const raw = (aiRes.data.message?.content || '').trim();
            const parsed = parseEnrichmentJson(raw);
            if (parsed) {
              enhancedTagline = parsed.tagline || enhancedTagline;
              enhancedHeroSubtitle = parsed.heroSubtitle || enhancedHeroSubtitle;
              enhancedCtaText = parsed.ctaText || enhancedCtaText;
              enhancedAbout = parsed.about || enhancedAbout;
              serviceDescriptions = parsed.serviceDescs;
              console.log('[ai-generation] All content enriched via Ollama');
            }
          } catch (aiErr) {
            console.log('[ai-generation] Ollama enrichment skipped (non-fatal):', aiErr instanceof Error ? aiErr.message : 'unknown');
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
          clientId,
          themeColor,
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
            const aiRes = await axios.post(ollamaUrl, {
              model,
              messages: [
                { role: 'system', content: 'You are a JSON API. Output ONLY valid JSON. No markdown fences, no explanation.' },
                { role: 'user', content: enrichPrompt }
              ],
              stream: false,
              options: { temperature: 0.6, num_predict: 1024 }
            }, { timeout: 120000 });
            const raw = (aiRes.data.message?.content || '').trim();
            const parsed = parseEnrichmentJson(raw);
            if (parsed) {
              enhancedTagline = parsed.tagline || enhancedTagline;
              enhancedHeroSubtitle = parsed.heroSubtitle || enhancedHeroSubtitle;
              enhancedCtaText = parsed.ctaText || enhancedCtaText;
              enhancedAbout = parsed.about || enhancedAbout;
              serviceDescriptions = parsed.serviceDescs;
              console.log('[ai-generation] Skip-queue enriched via Ollama fallback');
            }
          } catch (e) {
            console.log('[ai-generation] Skip-queue Ollama fallback also failed:', (e as Error).message);
          }
        }

        const { generateSiteHtml } = await import('../services/siteBuilderTemplate.js');
        let themeColor = site.theme_color || '#0044cc';

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

        // ── Try providers in order: GLM → OpenRouter → Ollama ──
        let polished = false;

        // 1. GLM
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
              }
            } else {
              console.warn(`[ai-polish] GLM ${glmRes.status}`);
            }
          }
        } catch (e) {
          console.warn('[ai-polish] GLM failed:', (e as Error).message);
        }

        // 2. OpenRouter
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
                }
              }
            }
          } catch (e) {
            console.warn('[ai-polish] OpenRouter failed:', (e as Error).message);
          }
        }

        // 3. Ollama fallback
        if (!polished) {
          try {
            const ollamaUrl = `${env.OLLAMA_BASE_URL.replace(/\/$/, '')}/api/chat`;
            const model = env.SITE_BUILDER_OLLAMA_MODEL;
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
            const raw = (aiRes.data.message?.content || '').trim();
            const extracted = extractHtml(raw);
            if (extracted) {
              modifiedHtml = extracted;
              polished = true;
              console.log('[ai-polish] Polished via Ollama');
            }
          } catch (e) {
            console.warn('[ai-polish] Ollama failed:', (e as Error).message);
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

export default router;
