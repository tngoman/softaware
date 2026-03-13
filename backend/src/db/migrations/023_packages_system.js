/**
 * Migration 023 — Packages System
 *
 * Replaces the legacy team-scoped credit system with a unified
 * contact/company-scoped package system.
 *
 * New tables:
 *   - packages              — all package definitions (consumer, enterprise, staff, addon)
 *   - contact_packages      — which contact has which package (with credit balance)
 *   - package_transactions  — all credit/billing transactions tied to contact_packages
 *   - user_contact_link     — links users to contacts (replaces team_members concept)
 *
 * Seeds:
 *   - Soft Aware company as contacts.id = 1 (contact_type = 3 = internal/provider)
 *   - 7 packages: Free, Starter, Professional, BYOE, Managed, Custom, Staff
 *   - Soft Aware gets the Staff package assigned
 */
import { db } from '../mysql.js';
export async function up() {
    console.log('[Migration 023] Creating packages system...');
    // ── 1. packages table ──────────────────────────────────────────────────
    await db.query(`
    CREATE TABLE IF NOT EXISTS packages (
      id              INT AUTO_INCREMENT PRIMARY KEY,
      slug            VARCHAR(50) NOT NULL UNIQUE,
      name            VARCHAR(100) NOT NULL,
      description     VARCHAR(500) NULL,
      package_type    ENUM('CONSUMER', 'ENTERPRISE', 'STAFF', 'ADDON') NOT NULL,
      price_monthly   INT NOT NULL DEFAULT 0          COMMENT 'ZAR cents',
      price_annually  INT NULL DEFAULT NULL            COMMENT 'ZAR cents (null = not offered)',
      credits_included INT NOT NULL DEFAULT 0          COMMENT 'Monthly credit allocation',
      max_users       INT NULL DEFAULT NULL,
      max_agents      INT NULL DEFAULT NULL,
      max_widgets     INT NULL DEFAULT NULL,
      max_landing_pages INT NULL DEFAULT NULL,
      max_enterprise_endpoints INT NULL DEFAULT NULL,
      features        JSON NULL                        COMMENT 'Flexible feature flags',
      is_active       TINYINT(1) NOT NULL DEFAULT 1,
      is_public       TINYINT(1) NOT NULL DEFAULT 1    COMMENT 'Visible on landing page pricing',
      display_order   INT NOT NULL DEFAULT 0,
      featured        TINYINT(1) NOT NULL DEFAULT 0    COMMENT 'Highlighted as most popular',
      cta_text        VARCHAR(50) NOT NULL DEFAULT 'Get Started',
      created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_packages_type (package_type),
      INDEX idx_packages_active_order (is_active, display_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    console.log('  ✓ packages table created');
    // ── 2. contact_packages table ──────────────────────────────────────────
    await db.query(`
    CREATE TABLE IF NOT EXISTS contact_packages (
      id                        INT AUTO_INCREMENT PRIMARY KEY,
      contact_id                INT NOT NULL,
      package_id                INT NOT NULL,
      status                    ENUM('TRIAL','ACTIVE','PAST_DUE','CANCELLED','EXPIRED','SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
      billing_cycle             ENUM('MONTHLY','ANNUALLY','NONE') NOT NULL DEFAULT 'MONTHLY',
      credits_balance           INT NOT NULL DEFAULT 0,
      credits_used              INT NOT NULL DEFAULT 0,
      trial_ends_at             DATETIME NULL,
      current_period_start      DATETIME NULL,
      current_period_end        DATETIME NULL,
      cancelled_at              DATETIME NULL,
      payment_provider          ENUM('PAYFAST','YOCO','MANUAL') DEFAULT 'MANUAL',
      external_customer_id      VARCHAR(255) NULL,
      external_subscription_id  VARCHAR(255) NULL,
      low_balance_threshold     INT NOT NULL DEFAULT 5000,
      low_balance_alert_sent    TINYINT(1) NOT NULL DEFAULT 0,
      created_at                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (contact_id)  REFERENCES contacts(id) ON DELETE CASCADE,
      FOREIGN KEY (package_id)  REFERENCES packages(id) ON DELETE RESTRICT,
      UNIQUE KEY uq_contact_package (contact_id, package_id),
      INDEX idx_cp_contact (contact_id),
      INDEX idx_cp_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    console.log('  ✓ contact_packages table created');
    // ── 3. package_transactions table ──────────────────────────────────────
    await db.query(`
    CREATE TABLE IF NOT EXISTS package_transactions (
      id                    INT AUTO_INCREMENT PRIMARY KEY,
      contact_package_id    INT NOT NULL,
      contact_id            INT NOT NULL,
      user_id               VARCHAR(36) NULL             COMMENT 'User who triggered this',
      type                  ENUM('PURCHASE','USAGE','BONUS','REFUND','ADJUSTMENT','MONTHLY_ALLOCATION','EXPIRY') NOT NULL,
      amount                INT NOT NULL                 COMMENT 'Positive = add, negative = deduct',
      request_type          VARCHAR(50) NULL             COMMENT 'chat, embedding, image, etc.',
      request_metadata      JSON NULL,
      description           VARCHAR(500) NULL,
      balance_after         INT NOT NULL,
      created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contact_package_id) REFERENCES contact_packages(id) ON DELETE CASCADE,
      FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
      INDEX idx_pt_contact (contact_id),
      INDEX idx_pt_contact_package (contact_package_id),
      INDEX idx_pt_type (type),
      INDEX idx_pt_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    console.log('  ✓ package_transactions table created');
    // ── 4. user_contact_link table ─────────────────────────────────────────
    await db.query(`
    CREATE TABLE IF NOT EXISTS user_contact_link (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      user_id     VARCHAR(36) NOT NULL,
      contact_id  INT NOT NULL,
      role        ENUM('OWNER','ADMIN','MEMBER','STAFF') NOT NULL DEFAULT 'MEMBER',
      created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_user_contact (user_id, contact_id),
      FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
      INDEX idx_ucl_user (user_id),
      INDEX idx_ucl_contact (contact_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    console.log('  ✓ user_contact_link table created');
    // ── 5. Add contact_type = 3 (internal/provider) if not already supported ──
    // The contacts table has contact_type TINYINT DEFAULT 1 (1=customer, 2=supplier)
    // We use 3 = internal/provider for Soft Aware's own entry
    // No schema change needed — TINYINT can hold 3
    // ── 6. Ensure Soft Aware exists as contact ID = 1 ──────────────────────
    // Replace whatever is at ID 1 with Soft Aware (internal/provider).
    // contact_type 3 = internal/provider (1=customer, 2=supplier).
    const [existing] = await db.query('SELECT id FROM contacts WHERE id = 1');
    if (!existing || existing.length === 0) {
        await db.query(`
      INSERT INTO contacts (id, company_name, contact_person, email, phone, contact_code, contact_type, active, remarks)
      VALUES (1, 'Soft Aware', 'System', 'admin@softaware.net.za', '', 'SOFTAWARE-001', 3, 1, 'Internal company — staff and system usage attached here')
    `);
        console.log('  ✓ Soft Aware seeded as contact ID = 1');
    }
    else {
        // Overwrite whatever is there — ID 1 is reserved for the platform company
        await db.query(`
      UPDATE contacts SET company_name = 'Soft Aware', contact_person = 'System',
        email = 'admin@softaware.net.za', contact_code = 'SOFTAWARE-001',
        contact_type = 3, active = 1,
        remarks = 'Internal company — staff and system usage attached here'
      WHERE id = 1
    `);
        console.log('  ✓ Contact ID 1 updated to Soft Aware');
    }
    // ── 7. Seed packages ──────────────────────────────────────────────────
    const packageSeeds = [
        // Consumer packages (matching LandingPage pricing)
        {
            slug: 'free',
            name: 'Free',
            description: 'Get started with AI — no credit card needed',
            package_type: 'CONSUMER',
            price_monthly: 0,
            price_annually: null,
            credits_included: 500,
            max_users: 1,
            max_agents: 1,
            max_widgets: 1,
            max_landing_pages: 1,
            max_enterprise_endpoints: 0,
            features: JSON.stringify([
                '1 AI assistant',
                '1 website widget',
                '1 landing page',
                '500 AI credits/month',
                'Basic analytics',
                'Community support',
            ]),
            is_active: 1,
            is_public: 1,
            display_order: 1,
            featured: 0,
            cta_text: 'Get Started',
        },
        {
            slug: 'starter',
            name: 'Starter',
            description: 'Perfect for growing businesses',
            package_type: 'CONSUMER',
            price_monthly: 19900, // R199.00
            price_annually: 199000, // R1,990.00
            credits_included: 5000,
            max_users: 3,
            max_agents: 3,
            max_widgets: 3,
            max_landing_pages: 5,
            max_enterprise_endpoints: 0,
            features: JSON.stringify([
                'Up to 3 AI assistants',
                '3 website widgets',
                '5 landing pages',
                '5,000 AI credits/month',
                'Advanced analytics',
                'Email support',
                'Custom branding',
            ]),
            is_active: 1,
            is_public: 1,
            display_order: 2,
            featured: 1,
            cta_text: 'Get Started',
        },
        {
            slug: 'professional',
            name: 'Professional',
            description: 'For teams that need more power',
            package_type: 'CONSUMER',
            price_monthly: 49900, // R499.00
            price_annually: 499000, // R4,990.00
            credits_included: 25000,
            max_users: 10,
            max_agents: 10,
            max_widgets: 10,
            max_landing_pages: 20,
            max_enterprise_endpoints: 2,
            features: JSON.stringify([
                'Up to 10 AI assistants',
                '10 website widgets',
                '20 landing pages',
                '25,000 AI credits/month',
                'Enterprise endpoints (2)',
                'Priority support',
                'API access',
                'Custom branding',
            ]),
            is_active: 1,
            is_public: 1,
            display_order: 3,
            featured: 0,
            cta_text: 'Get Started',
        },
        // Enterprise packages
        {
            slug: 'byoe',
            name: 'Bring Your Own Endpoint',
            description: 'Connect your existing AI infrastructure',
            package_type: 'ENTERPRISE',
            price_monthly: 500000, // R5,000.00
            price_annually: null,
            credits_included: 50000,
            max_users: 25,
            max_agents: 25,
            max_widgets: 25,
            max_landing_pages: 50,
            max_enterprise_endpoints: 10,
            features: JSON.stringify([
                'Custom AI endpoints',
                'Bring your own LLM keys',
                'Up to 25 assistants',
                '50,000 AI credits/month',
                '10 enterprise endpoints',
                'Dedicated support',
                'SLA guarantee',
                'Custom integrations',
            ]),
            is_active: 1,
            is_public: 1,
            display_order: 4,
            featured: 0,
            cta_text: 'Get Started',
        },
        {
            slug: 'managed',
            name: 'Managed',
            description: 'Full-service AI integration with dedicated support',
            package_type: 'ENTERPRISE',
            price_monthly: 1500000, // R15,000.00
            price_annually: null,
            credits_included: 200000,
            max_users: 100,
            max_agents: 100,
            max_widgets: 100,
            max_landing_pages: 100,
            max_enterprise_endpoints: 50,
            features: JSON.stringify([
                'Fully managed AI infrastructure',
                'Up to 100 assistants',
                '200,000 AI credits/month',
                '50 enterprise endpoints',
                'Dedicated account manager',
                'Custom model training',
                'On-premise option',
                '99.9% SLA',
            ]),
            is_active: 1,
            is_public: 1,
            display_order: 5,
            featured: 1,
            cta_text: 'Get Started',
        },
        {
            slug: 'custom',
            name: 'Architecture & Build',
            description: 'Bespoke AI solutions built from the ground up',
            package_type: 'ENTERPRISE',
            price_monthly: 0, // Custom pricing — contact us
            price_annually: null,
            credits_included: 0,
            max_users: null,
            max_agents: null,
            max_widgets: null,
            max_landing_pages: null,
            max_enterprise_endpoints: null,
            features: JSON.stringify([
                'Custom architecture design',
                'Loopback API development *',
                'On-premise deployment *',
                'Unlimited assistants',
                'Unlimited enterprise endpoints',
                'Dedicated engineering team',
                'Custom SLA',
                'White-label options',
            ]),
            is_active: 1,
            is_public: 1,
            display_order: 6,
            featured: 0,
            cta_text: 'Contact Sales',
        },
        // Staff package (internal)
        {
            slug: 'staff',
            name: 'Staff',
            description: 'Internal staff package — usage tracked against Soft Aware',
            package_type: 'STAFF',
            price_monthly: 0,
            price_annually: null,
            credits_included: 100000,
            max_users: null,
            max_agents: null,
            max_widgets: null,
            max_landing_pages: null,
            max_enterprise_endpoints: null,
            features: JSON.stringify([
                'Unlimited assistants',
                'Unlimited widgets',
                'Unlimited landing pages',
                'Unlimited enterprise endpoints',
                '100,000 AI credits/month',
                'Internal use only',
            ]),
            is_active: 1,
            is_public: 0, // Not shown on landing page
            display_order: 99,
            featured: 0,
            cta_text: 'Internal',
        },
    ];
    for (const pkg of packageSeeds) {
        const [exists] = await db.query('SELECT id FROM packages WHERE slug = ?', [pkg.slug]);
        if (!exists || exists.length === 0) {
            await db.query(`
        INSERT INTO packages (slug, name, description, package_type, price_monthly, price_annually,
          credits_included, max_users, max_agents, max_widgets, max_landing_pages,
          max_enterprise_endpoints, features, is_active, is_public, display_order, featured, cta_text)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
                pkg.slug, pkg.name, pkg.description, pkg.package_type,
                pkg.price_monthly, pkg.price_annually, pkg.credits_included,
                pkg.max_users, pkg.max_agents, pkg.max_widgets, pkg.max_landing_pages,
                pkg.max_enterprise_endpoints, pkg.features,
                pkg.is_active, pkg.is_public, pkg.display_order, pkg.featured, pkg.cta_text,
            ]);
            console.log(`  ✓ Package "${pkg.name}" seeded`);
        }
        else {
            console.log(`  ⊘ Package "${pkg.slug}" already exists — skipping`);
        }
    }
    // ── 8. Assign Staff package to Soft Aware (contact ID = 1) ────────────
    const [staffPkg] = await db.query('SELECT id, credits_included FROM packages WHERE slug = ?', ['staff']);
    if (staffPkg && staffPkg.length > 0) {
        const staffPkgId = staffPkg[0].id;
        const credits = staffPkg[0].credits_included;
        const [existingAssignment] = await db.query('SELECT id FROM contact_packages WHERE contact_id = 1 AND package_id = ?', [staffPkgId]);
        if (!existingAssignment || existingAssignment.length === 0) {
            const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
            const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
            await db.query(`
        INSERT INTO contact_packages (contact_id, package_id, status, billing_cycle, credits_balance, current_period_start, current_period_end)
        VALUES (1, ?, 'ACTIVE', 'NONE', ?, ?, ?)
      `, [staffPkgId, credits, now, periodEnd]);
            console.log('  ✓ Staff package assigned to Soft Aware (contact 1)');
        }
    }
    console.log('[Migration 023] ✅ Packages system complete');
}
export async function down() {
    console.log('[Migration 023] Rolling back packages system...');
    await db.query('DROP TABLE IF EXISTS package_transactions');
    await db.query('DROP TABLE IF EXISTS contact_packages');
    await db.query('DROP TABLE IF EXISTS user_contact_link');
    await db.query('DROP TABLE IF EXISTS packages');
    // Note: We don't remove the Soft Aware contact — it may have been used for other things
    console.log('[Migration 023] ✅ Rollback complete');
}
