import { Request, Response, NextFunction } from 'express';
import { db } from '../db/mysql.js';
import crypto from 'crypto';
import { getLimitsForTier } from '../config/tiers.js';

function uuidv4() {
  return crypto.randomUUID();
}

/**
 * Usage Tracking Middleware
 * 
 * Enforces message limits based on subscription tiers:
 * - Free: 500 messages/month
 * - Starter: 5,000 messages/month
 * - Advanced: 15,000 messages/month
 * - Enterprise: Unlimited
 */

interface TierLimits {
  max_pages: number;
  max_messages_per_month: number;
}

/**
 * Get tier limits from static config
 */
async function getTierLimits(tier: string): Promise<TierLimits | null> {
  const limits = getLimitsForTier(tier);
  return {
    max_pages: limits.maxKnowledgePages,
    max_messages_per_month: limits.maxActionsPerMonth
  };
}

/**
 * Get current billing cycle dates
 */
function getCurrentBillingCycle(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  return { start, end };
}

/**
 * Initialize billing cycle for client if not set
 */
async function ensureBillingCycle(clientId: string): Promise<void> {
  const cycle = getCurrentBillingCycle();
  
  await db.execute(
    `UPDATE widget_clients 
     SET billing_cycle_start = ?,
         billing_cycle_end = ?,
         messages_this_cycle = CASE 
           WHEN billing_cycle_start IS NULL OR billing_cycle_start < ? 
           THEN 0 
           ELSE messages_this_cycle 
         END
     WHERE id = ? AND (billing_cycle_start IS NULL OR billing_cycle_end < CURDATE())`,
    [
      cycle.start.toISOString().split('T')[0],
      cycle.end.toISOString().split('T')[0],
      cycle.start.toISOString().split('T')[0],
      clientId
    ]
  );
}

/**
 * Track message usage for client
 */
export async function trackMessageUsage(clientId: string): Promise<void> {
  try {
    // Ensure billing cycle is current
    await ensureBillingCycle(clientId);
    
    // Increment message count
    await db.execute(
      `UPDATE widget_clients 
       SET messages_this_cycle = messages_this_cycle + 1,
           message_count = message_count + 1,
           last_active = NOW()
       WHERE id = ?`,
      [clientId]
    );
    
    // Log usage
    const cycle = getCurrentBillingCycle();
    await db.execute(
      `INSERT INTO widget_usage_logs (id, client_id, message_count, cycle_start, cycle_end)
       VALUES (?, ?, 1, ?, ?)
       ON DUPLICATE KEY UPDATE message_count = message_count + 1`,
      [
        uuidv4(),
        clientId,
        cycle.start.toISOString().split('T')[0],
        cycle.end.toISOString().split('T')[0]
      ]
    );
  } catch (error) {
    console.error('Error tracking message usage:', error);
  }
}

/**
 * Check if client has exceeded their message limit
 */
export async function checkMessageLimit(clientId: string): Promise<{
  allowed: boolean;
  usage: number;
  limit: number;
  tier: string;
  resetDate?: string;
}> {
  try {
    // Ensure billing cycle is current
    await ensureBillingCycle(clientId);
    
    // Get client tier and usage
    const [rows] = await db.execute(
      `SELECT 
         wc.subscription_tier,
         wc.messages_this_cycle,
         wc.billing_cycle_end,
         wc.status
       FROM widget_clients wc
       WHERE wc.id = ?`,
      [clientId]
    ) as any;
    
    if (!rows || rows.length === 0) {
      return {
        allowed: false,
        usage: 0,
        limit: 0,
        tier: 'unknown'
      };
    }
    
    const client = rows[0];
    const limits = getLimitsForTier(client.subscription_tier);
    client.max_messages_per_month = limits.maxActionsPerMonth;
    
    // Check if client is suspended
    if (client.status === 'suspended') {
      return {
        allowed: false,
        usage: client.messages_this_cycle,
        limit: client.max_messages_per_month,
        tier: client.subscription_tier,
        resetDate: client.billing_cycle_end
      };
    }
    
    // Enterprise tier has unlimited messages
    if (client.subscription_tier === 'enterprise') {
      return {
        allowed: true,
        usage: client.messages_this_cycle,
        limit: 999999,
        tier: 'enterprise'
      };
    }
    
    // Check if under limit
    const limit = client.max_messages_per_month || 500; // Default to free tier
    const usage = client.messages_this_cycle || 0;
    const allowed = usage < limit;
    
    return {
      allowed,
      usage,
      limit,
      tier: client.subscription_tier,
      resetDate: client.billing_cycle_end
    };
    
  } catch (error) {
    console.error('Error checking message limit:', error);
    // Fail open - allow message but log error
    return {
      allowed: true,
      usage: 0,
      limit: 500,
      tier: 'free'
    };
  }
}

/**
 * Middleware to enforce message limits
 */
export async function enforceMessageLimit(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const clientId = req.body.client_id || req.query.client_id;
    
    if (!clientId) {
      res.status(400).json({ 
        error: 'Missing client_id',
        message: 'Widget client ID is required'
      });
      return;
    }
    
    const limitCheck = await checkMessageLimit(clientId as string);
    
    if (!limitCheck.allowed) {
      // Return friendly upgrade message
      const resetDate = limitCheck.resetDate 
        ? new Date(limitCheck.resetDate).toLocaleDateString('en-ZA')
        : 'next month';
      
      res.status(429).json({
        error: 'Message limit exceeded',
        message: `You've reached your ${limitCheck.tier} tier limit of ${limitCheck.limit} messages per month.`,
        details: {
          tier: limitCheck.tier,
          usage: limitCheck.usage,
          limit: limitCheck.limit,
          resetDate: resetDate
        },
        upgrade: {
          message: limitCheck.tier === 'free' 
            ? 'Upgrade to Starter (R349/month) for 2,000 messages and no branding.'
            : limitCheck.tier === 'starter'
            ? 'Upgrade to Pro (R699/month) for 5,000 messages plus e-commerce.'
            : limitCheck.tier === 'pro'
            ? 'Upgrade to Advanced (R1,499/month) for 20,000 messages plus API webhooks.'
            : 'Contact support to increase your limits.',
          url: 'https://portal.softaware.net.za/billing'
        }
      });
      return;
    }
    
    // Track usage and continue
    await trackMessageUsage(clientId as string);
    
    // Attach usage info to request for logging
    (req as any).usageInfo = limitCheck;
    
    next();
  } catch (error) {
    console.error('Error in enforceMessageLimit middleware:', error);
    // Fail open - allow request to proceed
    next();
  }
}

/**
 * Get usage statistics for a client
 */
export async function getUsageStats(clientId: string, months: number = 3): Promise<any> {
  try {
    const [rows] = await db.execute(
      `SELECT 
         cycle_start,
         cycle_end,
         SUM(message_count) as total_messages,
         COUNT(DISTINCT DATE(logged_at)) as active_days
       FROM widget_usage_logs
       WHERE client_id = ?
         AND cycle_start >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
       GROUP BY cycle_start, cycle_end
       ORDER BY cycle_start DESC`,
      [clientId, months]
    ) as any;
    
    return rows || [];
  } catch (error) {
    console.error('Error fetching usage stats:', error);
    return [];
  }
}

/**
 * Check if client needs billing cycle reset (for cron jobs)
 */
export async function resetExpiredBillingCycles(): Promise<number> {
  try {
    const result = await db.execute(
      `UPDATE widget_clients
       SET messages_this_cycle = 0,
           billing_cycle_start = DATE_FORMAT(CURDATE(), '%Y-%m-01'),
           billing_cycle_end = LAST_DAY(CURDATE())
       WHERE billing_cycle_end < CURDATE()`
    ) as any;
    
    const rowsAffected = result[0].affectedRows || 0;
    if (rowsAffected > 0) {
      console.log(`✅ Reset ${rowsAffected} expired billing cycles`);
    }
    
    return rowsAffected;
  } catch (error) {
    console.error('Error resetting billing cycles:', error);
    return 0;
  }
}

/**
 * Get clients approaching their message limit (for proactive notifications)
 */
export async function getClientsNearLimit(threshold: number = 0.9): Promise<any[]> {
  try {
    const [rows] = await db.execute(
      `SELECT 
         wc.id,
         wc.user_id,
         wc.website_url,
         wc.subscription_tier,
         wc.messages_this_cycle,
         u.email,
         u.name
       FROM widget_clients wc
       LEFT JOIN users u ON wc.user_id = u.id
       WHERE wc.status = 'active'
         AND wc.subscription_tier != 'enterprise'`
    ) as any;
    
    const nearLimitClients = rows.filter((client: any) => {
      const limits = getLimitsForTier(client.subscription_tier);
      const usageRatio = client.messages_this_cycle / limits.maxActionsPerMonth;
      return usageRatio >= threshold;
    }).map((client: any) => {
      const limits = getLimitsForTier(client.subscription_tier);
      return {
        ...client,
        max_messages_per_month: limits.maxActionsPerMonth,
        usage_ratio: client.messages_this_cycle / limits.maxActionsPerMonth
      };
    }).sort((a: any, b: any) => b.usage_ratio - a.usage_ratio);
    
    return nearLimitClients;
  } catch (error) {
    console.error('Error fetching clients near limit:', error);
    return [];
  }
}
