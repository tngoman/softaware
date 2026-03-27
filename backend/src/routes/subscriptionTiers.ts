import express, { Request, Response } from 'express';
import { db } from '../db/mysql.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { encryptPassword } from '../utils/cryptoUtils.js';
import { TIER_LIMITS, getLimitsForTier, TierName } from '../config/tiers.js';

const router = express.Router();

/**
 * GET /api/v1/subscriptions/current
 * Get current subscription details for authenticated user
 */
router.get('/subscriptions/current', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    const rows = await db.query<any>(
      `SELECT 
         wc.id,
         wc.website_url,
         wc.subscription_tier,
         wc.messages_this_cycle,
         wc.branding_enabled,
         wc.tone_preset,
         wc.lead_capture_enabled,
         wc.lead_notification_email,
         wc.preferred_model,
         wc.status
       FROM widget_clients wc
       WHERE wc.user_id = ?
       ORDER BY wc.created_at DESC`,
      [userId]
    );

    // Enrich each row with its static tier limits
    const enriched = rows.map((wc: any) => {
      const limits = getLimitsForTier(wc.subscription_tier);
      return {
        ...wc,
        max_pages: limits.maxKnowledgePages,
        max_actions_per_month: limits.maxActionsPerMonth,
        lead_capture: limits.allowedSystemActions.includes('email_capture'),
        tone_control: true,
        daily_recrawl: wc.subscription_tier !== 'free',
        document_uploads: wc.subscription_tier !== 'free',
      };
    });

    res.json({ success: true, subscriptions: enriched });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    res.status(500).json({ error: 'Failed to fetch subscription details' });
  }
});

/**
 * GET /api/v1/subscriptions/tiers
 * Get all available subscription tiers — now served from static config
 */
router.get('/subscriptions/tiers', async (_req: Request, res: Response) => {
  try {
    const tiers = Object.entries(TIER_LIMITS).map(([key, t]) => ({
      tier: key,
      name: t.name,
      priceZAR: t.priceZAR,
      maxSites: t.maxSites,
      maxWidgets: t.maxWidgets,
      maxStorageBytes: t.maxStorageBytes,
      maxActionsPerMonth: t.maxActionsPerMonth,
      allowAutoRecharge: t.allowAutoRecharge,
      maxKnowledgePages: t.maxKnowledgePages,
      allowedSiteType: t.allowedSiteType,
      canRemoveWatermark: t.canRemoveWatermark,
      hasOmniChannelEndpoints: t.hasOmniChannelEndpoints,
    }));
    res.json({ success: true, tiers });
  } catch (error) {
    console.error('Error fetching tiers:', error);
    res.status(500).json({ error: 'Failed to fetch subscription tiers' });
  }
});

/**
 * POST /api/v1/subscriptions/:clientId/upgrade
 * Upgrade widget client to a new tier
 */
router.post('/subscriptions/:clientId/upgrade', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { clientId } = req.params;
    const { tier } = req.body;
    const userId = req.userId;

    const clientRows = await db.query<any>(
      'SELECT * FROM widget_clients WHERE id = ? AND user_id = ?',
      [clientId, userId]
    );
    if (!clientRows || clientRows.length === 0) {
      return res.status(404).json({ error: 'Widget client not found or access denied' });
    }

    const validTiers: TierName[] = ['free', 'starter', 'pro', 'advanced', 'enterprise'];
    if (!validTiers.includes(tier)) {
      return res.status(400).json({ error: 'Invalid subscription tier' });
    }

    const limits = getLimitsForTier(tier);

    await db.execute(
      `UPDATE widget_clients 
       SET subscription_tier = ?,
           monthly_price = ?,
           messages_this_cycle = 0,
           branding_enabled = CASE WHEN ? = 'free' THEN TRUE ELSE FALSE END,
           status = 'active',
           updated_at = NOW()
       WHERE id = ?`,
      [tier, typeof limits.priceZAR === 'number' ? limits.priceZAR : 0, tier, clientId]
    );

    res.json({ success: true, message: `Successfully upgraded to ${tier} tier`, tier });
  } catch (error) {
    console.error('Error upgrading subscription:', error);
    res.status(500).json({ error: 'Failed to upgrade subscription' });
  }
});

/**
 * PUT /api/v1/subscriptions/:clientId/config
 * Update advanced configuration (tone, lead capture, etc.)
 */
router.put('/subscriptions/:clientId/config', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { clientId } = req.params;
    const userId = req.userId;
    const {
      tonePreset,
      customToneInstructions,
      leadCaptureEnabled,
      leadNotificationEmail,
      preferredModel,
      externalApiProvider,
      externalApiKey
    } = req.body;

    const clientRows = await db.query<any>(
      'SELECT * FROM widget_clients WHERE id = ? AND user_id = ?',
      [clientId, userId]
    );
    if (!clientRows || clientRows.length === 0) {
      return res.status(404).json({ error: 'Widget client not found or access denied' });
    }

    const client = clientRows[0];
    const limits = getLimitsForTier(client.subscription_tier);

    if (leadCaptureEnabled && !limits.allowedSystemActions.includes('email_capture')) {
      return res.status(403).json({
        error: 'Lead capture requires a higher tier',
        upgrade: 'Upgrade to enable lead capture'
      });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (tonePreset !== undefined) { updates.push('tone_preset = ?'); values.push(tonePreset); }
    if (customToneInstructions !== undefined) { updates.push('custom_tone_instructions = ?'); values.push(customToneInstructions); }
    if (leadCaptureEnabled !== undefined) { updates.push('lead_capture_enabled = ?'); values.push(leadCaptureEnabled); }
    if (leadNotificationEmail !== undefined) { updates.push('lead_notification_email = ?'); values.push(leadNotificationEmail); }
    if (preferredModel !== undefined) { updates.push('preferred_model = ?'); values.push(preferredModel); }
    if (externalApiProvider !== undefined) { updates.push('external_api_provider = ?'); values.push(externalApiProvider); }
    if (externalApiKey !== undefined) {
      const encryptedKey = encryptPassword(externalApiKey);
      updates.push('external_api_key_encrypted = ?'); values.push(encryptedKey);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No configuration changes provided' });
    }

    values.push(clientId);
    await db.execute(`UPDATE widget_clients SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, values);

    res.json({ success: true, message: 'Configuration updated successfully' });
  } catch (error) {
    console.error('Error updating config:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

/**
 * GET /api/v1/subscriptions/:clientId/usage
 * Get usage statistics for client
 */
router.get('/subscriptions/:clientId/usage', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { clientId } = req.params;
    const userId = req.userId;

    const clientRows = await db.query<any>(
      'SELECT * FROM widget_clients WHERE id = ? AND user_id = ?',
      [clientId, userId]
    );
    if (!clientRows || clientRows.length === 0) {
      return res.status(404).json({ error: 'Widget client not found or access denied' });
    }

    const usageRows = await db.query<any>(
      `SELECT 
         cycle_start, cycle_end,
         SUM(message_count) as total_messages
       FROM widget_usage_logs
       WHERE client_id = ?
       GROUP BY cycle_start, cycle_end
       ORDER BY cycle_start DESC
       LIMIT 6`,
      [clientId]
    );

    const leadRows = await db.query<any>(
      `SELECT 
         COUNT(*) as total_leads,
         COUNT(DISTINCT visitor_email) as unique_visitors,
         COUNT(DISTINCT DATE(captured_at)) as active_days
       FROM widget_leads_captured
       WHERE client_id = ?
         AND captured_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      [clientId]
    );

    res.json({
      success: true,
      usage: usageRows || [],
      leads: leadRows && leadRows.length > 0 ? leadRows[0] : null,
      client: clientRows[0]
    });
  } catch (error) {
    console.error('Error fetching usage:', error);
    res.status(500).json({ error: 'Failed to fetch usage statistics' });
  }
});

/**
 * GET /api/v1/subscriptions/:clientId/leads
 * Get captured leads for client
 */
router.get('/subscriptions/:clientId/leads', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { clientId } = req.params;
    const userId = req.userId;
    const { limit = 50, offset = 0 } = req.query;

    const clientRows = await db.query<any>(
      'SELECT * FROM widget_clients WHERE id = ? AND user_id = ?',
      [clientId, userId]
    );
    if (!clientRows || clientRows.length === 0) {
      return res.status(404).json({ error: 'Widget client not found or access denied' });
    }

    const leadRows = await db.query<any>(
      `SELECT id, visitor_email, visitor_name, visitor_message, captured_at, notification_sent
       FROM widget_leads_captured
       WHERE client_id = ?
       ORDER BY captured_at DESC
       LIMIT ? OFFSET ?`,
      [clientId, Number(limit), Number(offset)]
    );

    const countRows = await db.query<any>(
      'SELECT COUNT(*) as total FROM widget_leads_captured WHERE client_id = ?',
      [clientId]
    );

    res.json({
      success: true,
      leads: leadRows || [],
      total: countRows && countRows.length > 0 ? countRows[0].total : 0,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

export default router;
