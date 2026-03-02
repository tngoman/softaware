import express, { Request } from 'express';
import multer from 'multer';
import { siteBuilderService } from '../services/siteBuilderService.js';
import { ftpDeploymentService } from '../services/ftpDeploymentService.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import path from 'path';
import fs from 'fs/promises';
import axios from 'axios';
import { env } from '../config/env.js';

const router = express.Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = '/var/www/code/uploads/sites';
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
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

    // Remove passwords from response
    const safeSites = sites.map(site => ({
      ...site,
      ftp_password: undefined
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
 * Generate a complete website using AI (Qwen 2.5 Coder)
 * 
 * Body format:
 * {
 *   businessName: string (required)
 *   tagline: string (required)
 *   aboutText: string (required)
 *   services: string[] (required)
 *   logoUrl?: string
 *   clientId: string (required - widget client ID)
 * }
 */
router.post('/generate-ai', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      businessName,
      tagline,
      aboutText,
      services,
      logoUrl,
      clientId
    } = req.body;

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

    console.log('[ai-generation] Starting AI website generation for:', businessName);

    // Prepare data for prompt
    const userData = {
      businessName,
      tagline,
      aboutText,
      services,
      logoUrl: logoUrl || '',
      clientId
    };

    // Build the system prompt for Qwen 2.5 Coder
    const systemPrompt = `You are an expert, senior frontend web developer. Your task is to generate a complete, responsive, single-page HTML5 landing page for a business.

CRITICAL INSTRUCTIONS - READ CAREFULLY:
1. OUTPUT FORMAT: You must output ONLY raw, valid HTML code. Do not wrap the code in markdown blocks (no \`\`\`html). Do not include ANY conversational text, explanations, or greetings before or after the HTML. The output must begin with <!DOCTYPE html> and end with </html>.
2. STYLING: Use Tailwind CSS via CDN (<script src="https://cdn.tailwindcss.com"></script>) in the <head>. Create a clean, modern, professional, and mobile-responsive design.
3. CONTENT: Use the provided business data to populate the Hero, About, and Services sections.
4. INTEGRATIONS:
   - You MUST include a Contact Form in the footer section.
   - The form MUST use: action="https://api.softaware.co.za/v1/leads/submit" method="POST".
   - The form MUST include these inputs: 'name' (text, required), 'email' (email, required), 'message' (textarea, required).
   - The form MUST include this hidden input: <input type="hidden" name="client_id" value="${userData.clientId}">
   - The form MUST include this hidden honeypot field for anti-spam: <input type="text" name="bot_check_url" style="display:none" tabindex="-1" autocomplete="off">
5. SOFT AWARE WIDGET: You MUST inject this exact script tag immediately before the closing </body> tag:
   <script src="https://api.softaware.co.za/widget.js" data-client-id="${userData.clientId}" defer></script>

BUSINESS DATA TO USE:
- Business Name: ${userData.businessName}
- Tagline: ${userData.tagline}
- About: ${userData.aboutText}
- Services: ${userData.services.join(", ")}
${userData.logoUrl ? `- Logo URL: ${userData.logoUrl}` : ''}

Generate the raw HTML now.`;

    // Call Ollama with Qwen 2.5 Coder
    const ollamaUrl = `${env.OLLAMA_BASE_URL.replace(/\/$/, '')}/api/generate`;
    const model = env.OLLAMA_MODEL; // Default is qwen2.5-coder:7b

    console.log('[ai-generation] Calling Ollama:', model);

    const ollamaResponse = await axios.post(
      ollamaUrl,
      {
        model,
        prompt: systemPrompt,
        stream: false,
        options: {
          temperature: 0.3,
          top_p: 0.9,
          num_predict: 8192 // Allow long responses for complete HTML
        }
      },
      {
        timeout: 180000 // 3 minute timeout for generation
      }
    );

    let aiResponse = ollamaResponse.data.response || '';

    console.log('[ai-generation] Received response, length:', aiResponse.length);

    // Clean the AI response - remove markdown blocks if present
    let cleanHtml = aiResponse.trim();
    if (cleanHtml.startsWith('```html')) {
      cleanHtml = cleanHtml.substring(7);
    } else if (cleanHtml.startsWith('```')) {
      cleanHtml = cleanHtml.substring(3);
    }
    if (cleanHtml.endsWith('```')) {
      cleanHtml = cleanHtml.substring(0, cleanHtml.length - 3);
    }
    cleanHtml = cleanHtml.trim();

    // Validate the response looks like HTML
    if (!cleanHtml.startsWith('<!DOCTYPE') && !cleanHtml.startsWith('<html')) {
      console.error('[ai-generation] Invalid HTML response:', cleanHtml.substring(0, 200));
      return res.status(500).json({
        error: 'AI generated invalid HTML',
        message: 'The AI did not generate valid HTML. Please try again.'
      });
    }

    console.log('[ai-generation] HTML generated successfully, size:', cleanHtml.length, 'bytes');

    // Return the generated HTML
    return res.json({
      success: true,
      html: cleanHtml,
      metadata: {
        model,
        businessName: userData.businessName,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[ai-generation] Error:', error);
    
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED') {
        return res.status(503).json({
          error: 'AI service unavailable',
          message: 'Could not connect to Ollama. Please ensure it is running.'
        });
      }
      if (error.code === 'ETIMEDOUT') {
        return res.status(504).json({
          error: 'AI generation timeout',
          message: 'The AI took too long to generate the website. Please try again.'
        });
      }
    }

    return res.status(500).json({
      error: 'Failed to generate website',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
