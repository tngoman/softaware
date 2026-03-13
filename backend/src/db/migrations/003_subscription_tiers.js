import { db } from '../mysql.js';
/**
 * Migration: Subscription Tiers for Widget-Only Plans
 *
 * Adds subscription tier support to enable:
 * - Starter Package (R299-R499): 1,000 pages, 5,000 messages/month, no branding
 * - Advanced Assistant (R899-R1,499): 10,000 pages, 15,000 messages/month, lead capture, tone control
 */
async function up() {
    console.log('🎯 Adding subscription tier columns to widget_clients...');
    try {
        // Check if subscription_tier column already exists
        const columnsResult = await db.execute(`SHOW COLUMNS FROM widget_clients LIKE 'subscription_tier'`);
        const columns = Array.isArray(columnsResult) ? columnsResult[0] : columnsResult?.rows || [];
        if (columns && columns.length > 0) {
            console.log('⚠️  Subscription tier columns already exist, skipping column addition...');
        }
        else {
            // Add subscription tier columns
            await db.execute(`
        ALTER TABLE widget_clients
        ADD COLUMN subscription_tier ENUM('free', 'starter', 'advanced', 'enterprise') DEFAULT 'free' AFTER status,
        ADD COLUMN monthly_price DECIMAL(10,2) DEFAULT 0.00 AFTER subscription_tier,
        ADD COLUMN billing_cycle_start DATE AFTER monthly_price,
        ADD COLUMN billing_cycle_end DATE AFTER billing_cycle_start,
        ADD COLUMN messages_this_cycle INT DEFAULT 0 AFTER billing_cycle_end,
        ADD COLUMN branding_enabled BOOLEAN DEFAULT TRUE AFTER messages_this_cycle,
        ADD COLUMN tone_preset VARCHAR(50) DEFAULT 'professional' AFTER branding_enabled,
        ADD COLUMN custom_tone_instructions TEXT AFTER tone_preset,
        ADD COLUMN lead_capture_enabled BOOLEAN DEFAULT FALSE AFTER custom_tone_instructions,
        ADD COLUMN lead_notification_email VARCHAR(255) AFTER lead_capture_enabled,
        ADD COLUMN preferred_model VARCHAR(50) DEFAULT 'qwen2.5:3b' AFTER lead_notification_email,
        ADD COLUMN external_api_provider VARCHAR(50) AFTER preferred_model,
        ADD COLUMN external_api_key_encrypted TEXT AFTER external_api_provider,
        ADD INDEX idx_subscription_tier (subscription_tier),
        ADD INDEX idx_billing_cycle (billing_cycle_start, billing_cycle_end)
      `);
            console.log('✅ Added subscription tier columns');
        }
    }
    catch (error) {
        // Column might already exist
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log('⚠️  Columns already exist, continuing...');
        }
        else {
            throw error;
        }
    }
    // Create usage_logs table for message tracking
    await db.execute(`
    CREATE TABLE IF NOT EXISTS widget_usage_logs (
      id VARCHAR(36) PRIMARY KEY,
      client_id VARCHAR(36) NOT NULL,
      message_count INT DEFAULT 1,
      cycle_start DATE NOT NULL,
      cycle_end DATE NOT NULL,
      logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_client_cycle (client_id, cycle_start, cycle_end),
      FOREIGN KEY (client_id) REFERENCES widget_clients(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    console.log('✅ Created widget_usage_logs table');
    // Create leads_captured table
    await db.execute(`
    CREATE TABLE IF NOT EXISTS widget_leads_captured (
      id VARCHAR(36) PRIMARY KEY,
      client_id VARCHAR(36) NOT NULL,
      visitor_email VARCHAR(255) NOT NULL,
      visitor_name VARCHAR(255),
      visitor_message TEXT,
      chat_context TEXT,
      captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      notification_sent BOOLEAN DEFAULT FALSE,
      INDEX idx_client_id (client_id),
      INDEX idx_captured_at (captured_at),
      FOREIGN KEY (client_id) REFERENCES widget_clients(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    console.log('✅ Created widget_leads_captured table');
    // Create subscription_tier_limits reference table
    await db.execute(`
    CREATE TABLE IF NOT EXISTS subscription_tier_limits (
      tier ENUM('free', 'starter', 'advanced', 'enterprise') PRIMARY KEY,
      max_pages INT NOT NULL,
      max_messages_per_month INT NOT NULL,
      branding_removal BOOLEAN DEFAULT FALSE,
      lead_capture BOOLEAN DEFAULT FALSE,
      tone_control BOOLEAN DEFAULT FALSE,
      priority_support BOOLEAN DEFAULT FALSE,
      daily_recrawl BOOLEAN DEFAULT FALSE,
      document_uploads BOOLEAN DEFAULT FALSE,
      suggested_price_min DECIMAL(10,2) DEFAULT 0.00,
      suggested_price_max DECIMAL(10,2) DEFAULT 0.00,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    console.log('✅ Created subscription_tier_limits table');
    // Insert tier definitions
    await db.execute(`
    INSERT INTO subscription_tier_limits 
    (tier, max_pages, max_messages_per_month, branding_removal, lead_capture, tone_control, 
     daily_recrawl, document_uploads, suggested_price_min, suggested_price_max, description)
    VALUES 
    ('free', 50, 500, FALSE, FALSE, FALSE, FALSE, FALSE, 0.00, 0.00, 
     'Free tier with Soft Aware branding. 50 pages indexed, 500 messages/month.'),
    
    ('starter', 1000, 5000, TRUE, FALSE, FALSE, FALSE, FALSE, 299.00, 499.00, 
     'Starter Package: Remove branding, 1,000 pages indexed, 5,000 messages/month, weekly re-crawl.'),
    
    ('advanced', 10000, 15000, TRUE, TRUE, TRUE, TRUE, TRUE, 899.00, 1499.00, 
     'Advanced Assistant: Lead capture, tone control, 10,000 pages, 15,000 messages/month, daily re-crawl, document uploads.'),
    
    ('enterprise', 999999, 999999, TRUE, TRUE, TRUE, TRUE, TRUE, 5000.00, 15000.00, 
     'Enterprise: Loopback API access, unlimited pages/messages, custom integrations.')
  `);
    console.log('✅ Inserted tier definitions');
    console.log('');
    console.log('📊 Subscription Tiers Summary:');
    console.log('  - Free: 50 pages, 500 messages/month (with branding)');
    console.log('  - Starter (R299-R499): 1,000 pages, 5,000 messages/month (no branding)');
    console.log('  - Advanced (R899-R1,499): 10,000 pages, 15,000 messages/month (lead capture + tone control)');
    console.log('  - Enterprise (R5,000+): Unlimited + Loopback API');
    console.log('');
}
async function down() {
    console.log('⏪ Rolling back subscription tier changes...');
    // Drop new tables
    await db.execute(`DROP TABLE IF EXISTS subscription_tier_limits`);
    await db.execute(`DROP TABLE IF EXISTS widget_leads_captured`);
    await db.execute(`DROP TABLE IF EXISTS widget_usage_logs`);
    console.log('✅ Dropped subscription tier tables');
    // Remove columns from widget_clients
    await db.execute(`
    ALTER TABLE widget_clients
    DROP COLUMN IF EXISTS external_api_key_encrypted,
    DROP COLUMN IF EXISTS external_api_provider,
    DROP COLUMN IF EXISTS preferred_model,
    DROP COLUMN IF EXISTS lead_notification_email,
    DROP COLUMN IF EXISTS lead_capture_enabled,
    DROP COLUMN IF EXISTS custom_tone_instructions,
    DROP COLUMN IF EXISTS tone_preset,
    DROP COLUMN IF EXISTS branding_enabled,
    DROP COLUMN IF EXISTS messages_this_cycle,
    DROP COLUMN IF EXISTS billing_cycle_end,
    DROP COLUMN IF EXISTS billing_cycle_start,
    DROP COLUMN IF EXISTS monthly_price,
    DROP COLUMN IF EXISTS subscription_tier
  `);
    console.log('✅ Removed subscription tier columns from widget_clients');
}
export { up, down };
