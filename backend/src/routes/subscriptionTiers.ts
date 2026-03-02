import express, { Request, Response } from 'express';
import { db } from '../db/mysql.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { encryptPassword, decryptPassword } from '../utils/cryptoUtils.js';
import crypto from 'crypto';

function uuidv4() {
  return crypto.randomUUID();
}

const router = express.Router();

/**
 * Subscription Tier Management Routes
 * 
 * These endpoints allow users and admins to manage widget subscription tiers:
 * - View current subscription
 * - Upgrade/downgrade tiers
 * - Configure advanced features (tone, lead capture)
 * - View usage statistics
 */

/**
 * GET /api/v1/subscriptions/current
 * Get current subscription details for authenticated user
 */
router.get('/subscriptions/current', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    const [rows] = await db.execute(
      `SELECT 
         wc.id,
         wc.website_url,
         wc.subscription_tier,
         wc.monthly_price,
         wc.billing_cycle_start,
         wc.billing_cycle_end,
         wc.messages_this_cycle,
         wc.branding_enabled,
         wc.tone_preset,
         wc.lead_capture_enabled,
         wc.lead_notification_email,
         wc.preferred_model,
         wc.status,
         stl.max_pages,
         stl.max_messages_per_month,
         stl.lead_capture,
         stl.tone_control,
         stl.daily_recrawl,
         stl.document_uploads
       FROM widget_clients wc
       LEFT JOIN subscription_tier_limits stl ON wc.subscription_tier = stl.tier
       WHERE wc.user_id = ?
       ORDER BY wc.created_at DESC`,
      [userId]
    ) as any;

    res.json({
      success: true,
      subscriptions: rows || []
    });

  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    res.status(500).json({
      error: 'Failed to fetch subscription details'
    });
  }
});

/**
 * GET /api/v1/subscriptions/tiers
 * Get all available subscription tiers
 */
router.get('/subscriptions/tiers', async (req: Request, res: Response) => {
  try {
    const [rows] = await db.execute(
      `SELECT * FROM subscription_tier_limits ORDER BY max_messages_per_month ASC`
    ) as any;

    res.json({
      success: true,
      tiers: rows || []
    });

  } catch (error) {
    console.error('Error fetching tiers:', error);
    res.status(500).json({
      error: 'Failed to fetch subscription tiers'
    });
  }
});

/**
 * POST /api/v1/subscriptions/:clientId/upgrade
 * Upgrade widget client to a new tier
 */
router.post('/subscriptions/:clientId/upgrade', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { clientId } = req.params;
    const { tier, monthlyPrice } = req.body;
    const userId = req.userId;

    // Verify ownership
    const [clientRows] = await db.execute(
      `SELECT * FROM widget_clients WHERE id = ? AND user_id = ?`,
      [clientId, userId]
    ) as any;

    if (!clientRows || clientRows.length === 0) {
      return res.status(404).json({ error: 'Widget client not found or access denied' });
    }

    // Validate tier
    const validTiers = ['free', 'starter', 'advanced', 'enterprise'];
    if (!validTiers.includes(tier)) {
      return res.status(400).json({ error: 'Invalid subscription tier' });
    }

    // Set billing cycle
    const now = new Date();
    const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Update subscription
    await db.execute(
      `UPDATE widget_clients 
       SET subscription_tier = ?,
           monthly_price = ?,
           billing_cycle_start = ?,
           billing_cycle_end = ?,
           messages_this_cycle = 0,
           branding_enabled = CASE WHEN ? = 'free' THEN TRUE ELSE FALSE END,
           status = 'active',
           updated_at = NOW()
       WHERE id = ?`,
      [
        tier,
        monthlyPrice || 0,
        cycleStart.toISOString().split('T')[0],
        cycleEnd.toISOString().split('T')[0],
        tier,
        clientId
      ]
    );

    res.json({
      success: true,
      message: `Successfully upgraded to ${tier} tier`,
      tier,
      monthlyPrice
    });

  } catch (error) {
    console.error('Error upgrading subscription:', error);
    res.status(500).json({
      error: 'Failed to upgrade subscription'
    });
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

    // Verify ownership and tier
    const [clientRows] = await db.execute(
      `SELECT wc.*, stl.tone_control, stl.lead_capture
       FROM widget_clients wc
       LEFT JOIN subscription_tier_limits stl ON wc.subscription_tier = stl.tier
       WHERE wc.id = ? AND wc.user_id = ?`,
      [clientId, userId]
    ) as any;

    if (!clientRows || clientRows.length === 0) {
      return res.status(404).json({ error: 'Widget client not found or access denied' });
    }

    const client = clientRows[0];

    // Check if tier supports requested features
    if (leadCaptureEnabled && !client.lead_capture) {
      return res.status(403).json({
        error: 'Lead capture requires Advanced or Enterprise tier',
        upgrade: 'Upgrade to Advanced (R899/month) to enable lead capture'
      });
    }

    if ((tonePreset || customToneInstructions) && !client.tone_control) {
      return res.status(403).json({
        error: 'Tone control requires Advanced or Enterprise tier',
        upgrade: 'Upgrade to Advanced (R899/month) to customize bot personality'
      });
    }

    // Build update query
    const updates: string[] = [];
    const values: any[] = [];

    if (tonePreset !== undefined) {
      updates.push('tone_preset = ?');
      values.push(tonePreset);
    }

    if (customToneInstructions !== undefined) {
      updates.push('custom_tone_instructions = ?');
      values.push(customToneInstructions);
    }

    if (leadCaptureEnabled !== undefined) {
      updates.push('lead_capture_enabled = ?');
      values.push(leadCaptureEnabled);
    }

    if (leadNotificationEmail !== undefined) {
      updates.push('lead_notification_email = ?');
      values.push(leadNotificationEmail);
    }

    if (preferredModel !== undefined) {
      updates.push('preferred_model = ?');
      values.push(preferredModel);
    }

    if (externalApiProvider !== undefined) {
      updates.push('external_api_provider = ?');
      values.push(externalApiProvider);
    }

    if (externalApiKey !== undefined) {
      // Encrypt API key
      const encryptedKey = encryptPassword(externalApiKey);
      updates.push('external_api_key_encrypted = ?');
      values.push(encryptedKey);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No configuration changes provided' });
    }

    values.push(clientId);

    await db.execute(
      `UPDATE widget_clients SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      values
    );

    res.json({
      success: true,
      message: 'Configuration updated successfully'
    });

  } catch (error) {
    console.error('Error updating config:', error);
    res.status(500).json({
      error: 'Failed to update configuration'
    });
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

    // Verify ownership
    const [clientRows] = await db.execute(
      `SELECT * FROM widget_clients WHERE id = ? AND user_id = ?`,
      [clientId, userId]
    ) as any;

    if (!clientRows || clientRows.length === 0) {
      return res.status(404).json({ error: 'Widget client not found or access denied' });
    }

    // Get usage stats
    const [usageRows] = await db.execute(
      `SELECT 
         cycle_start,
         cycle_end,
         SUM(message_count) as total_messages
       FROM widget_usage_logs
       WHERE client_id = ?
       GROUP BY cycle_start, cycle_end
       ORDER BY cycle_start DESC
       LIMIT 6`,
      [clientId]
    ) as any;

    // Get lead stats
    const [leadRows] = await db.execute(
      `SELECT 
         COUNT(*) as total_leads,
         COUNT(DISTINCT visitor_email) as unique_visitors,
         COUNT(DISTINCT DATE(captured_at)) as active_days
       FROM widget_leads_captured
       WHERE client_id = ?
         AND captured_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      [clientId]
    ) as any;

    res.json({
      success: true,
      usage: usageRows || [],
      leads: leadRows && leadRows.length > 0 ? leadRows[0] : null,
      client: clientRows[0]
    });

  } catch (error) {
    console.error('Error fetching usage:', error);
    res.status(500).json({
      error: 'Failed to fetch usage statistics'
    });
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

    // Verify ownership
    const [clientRows] = await db.execute(
      `SELECT * FROM widget_clients WHERE id = ? AND user_id = ?`,
      [clientId, userId]
    ) as any;

    if (!clientRows || clientRows.length === 0) {
      return res.status(404).json({ error: 'Widget client not found or access denied' });
    }

    // Get leads
    const [leadRows] = await db.execute(
      `SELECT 
         id,
         visitor_email,
         visitor_name,
         visitor_message,
         captured_at,
         notification_sent
       FROM widget_leads_captured
       WHERE client_id = ?
       ORDER BY captured_at DESC
       LIMIT ? OFFSET ?`,
      [clientId, Number(limit), Number(offset)]
    ) as any;

    // Get total count
    const [countRows] = await db.execute(
      `SELECT COUNT(*) as total FROM widget_leads_captured WHERE client_id = ?`,
      [clientId]
    ) as any;

    res.json({
      success: true,
      leads: leadRows || [],
      total: countRows && countRows.length > 0 ? countRows[0].total : 0,
      limit: Number(limit),
      offset: Number(offset)
    });

  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({
      error: 'Failed to fetch leads'
    });
  }
});

export default router;
