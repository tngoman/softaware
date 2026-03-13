/**
 * Package Service
 *
 * Manages the unified package system — replacing the legacy team-scoped
 * credit system. Everything is tied to contacts (companies/clients).
 *
 * Core concepts:
 *   - Package        → a product definition (Free, Starter, Professional, etc.)
 *   - ContactPackage → a contact's active subscription to a package (with credit balance)
 *   - Transaction    → any credit movement (usage, purchase, allocation, etc.)
 *   - UserContactLink → links users to their contact/company
 */
import { db } from '../db/mysql.js';
// ─── Package CRUD ────────────────────────────────────────────────────────
export async function getAllPackages(includeInactive = false) {
    const where = includeInactive ? '' : 'WHERE is_active = 1';
    const rows = await db.query(`SELECT * FROM packages ${where} ORDER BY display_order ASC, name ASC`);
    return rows.map(parsePackageRow);
}
export async function getPublicPackages() {
    const rows = await db.query(`SELECT * FROM packages WHERE is_active = 1 AND is_public = 1 ORDER BY display_order ASC`);
    return rows.map(parsePackageRow);
}
export async function getPackagesByType(type) {
    const rows = await db.query(`SELECT * FROM packages WHERE is_active = 1 AND package_type = ? ORDER BY display_order ASC`, [type]);
    return rows.map(parsePackageRow);
}
export async function getPackageById(id) {
    const rows = await db.query('SELECT * FROM packages WHERE id = ?', [id]);
    if (!rows || rows.length === 0)
        return null;
    return parsePackageRow(rows[0]);
}
export async function getPackageBySlug(slug) {
    const rows = await db.query('SELECT * FROM packages WHERE slug = ?', [slug]);
    if (!rows || rows.length === 0)
        return null;
    return parsePackageRow(rows[0]);
}
export async function createPackage(data) {
    const result = await db.query(`
    INSERT INTO packages (slug, name, description, package_type, price_monthly, price_annually,
      credits_included, max_users, max_agents, max_widgets, max_landing_pages,
      max_enterprise_endpoints, features, is_active, is_public, display_order, featured, cta_text)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
        data.slug, data.name, data.description || null, data.package_type || 'CONSUMER',
        data.price_monthly || 0, data.price_annually || null, data.credits_included || 0,
        data.max_users || null, data.max_agents || null, data.max_widgets || null,
        data.max_landing_pages || null, data.max_enterprise_endpoints || null,
        typeof data.features === 'string' ? data.features : JSON.stringify(data.features || []),
        data.is_active !== false ? 1 : 0, data.is_public !== false ? 1 : 0,
        data.display_order || 0, data.featured ? 1 : 0, data.cta_text || 'Get Started',
    ]);
    return result.insertId;
}
export async function updatePackage(id, data) {
    const fields = [];
    const values = [];
    const fieldMap = {
        slug: 'slug', name: 'name', description: 'description', package_type: 'package_type',
        price_monthly: 'price_monthly', price_annually: 'price_annually',
        credits_included: 'credits_included', max_users: 'max_users', max_agents: 'max_agents',
        max_widgets: 'max_widgets', max_landing_pages: 'max_landing_pages',
        max_enterprise_endpoints: 'max_enterprise_endpoints', is_active: 'is_active',
        is_public: 'is_public', display_order: 'display_order', featured: 'featured',
        cta_text: 'cta_text',
    };
    for (const [key, col] of Object.entries(fieldMap)) {
        if (data[key] !== undefined) {
            fields.push(`${col} = ?`);
            values.push(data[key]);
        }
    }
    if (data.features !== undefined) {
        fields.push('features = ?');
        values.push(typeof data.features === 'string' ? data.features : JSON.stringify(data.features));
    }
    if (fields.length === 0)
        return;
    values.push(id);
    await db.query(`UPDATE packages SET ${fields.join(', ')} WHERE id = ?`, values);
}
export async function deletePackage(id) {
    // Check for active subscriptions before deleting
    const subs = await db.query('SELECT COUNT(*) as cnt FROM contact_packages WHERE package_id = ? AND status IN ("TRIAL","ACTIVE","PAST_DUE")', [id]);
    if (subs[0]?.cnt > 0) {
        throw new Error(`Cannot delete package — ${subs[0].cnt} active subscription(s) exist`);
    }
    await db.query('DELETE FROM packages WHERE id = ?', [id]);
}
// ─── Contact Package (Subscriptions) ────────────────────────────────────
export async function getContactPackages(contactId) {
    const rows = await db.query(`
    SELECT cp.*, c.company_name AS contact_name, p.name AS package_name, p.slug AS package_slug
    FROM contact_packages cp
    JOIN contacts c ON c.id = cp.contact_id
    JOIN packages p ON p.id = cp.package_id
    WHERE cp.contact_id = ?
    ORDER BY cp.created_at DESC
  `, [contactId]);
    return rows;
}
export async function getAllContactPackages(statusFilter) {
    let where = '';
    const params = [];
    if (statusFilter) {
        where = 'WHERE cp.status = ?';
        params.push(statusFilter);
    }
    const rows = await db.query(`
    SELECT cp.*, c.company_name AS contact_name, p.name AS package_name, p.slug AS package_slug
    FROM contact_packages cp
    JOIN contacts c ON c.id = cp.contact_id
    JOIN packages p ON p.id = cp.package_id
    ${where}
    ORDER BY cp.updated_at DESC
  `, params);
    return rows;
}
export async function getContactPackageById(id) {
    const rows = await db.query(`
    SELECT cp.*, c.company_name AS contact_name, p.name AS package_name, p.slug AS package_slug
    FROM contact_packages cp
    JOIN contacts c ON c.id = cp.contact_id
    JOIN packages p ON p.id = cp.package_id
    WHERE cp.id = ?
  `, [id]);
    return rows[0] || null;
}
export async function assignPackageToContact(contactId, packageId, options = {}) {
    const pkg = await getPackageById(packageId);
    if (!pkg)
        throw new Error('Package not found');
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
    const trialEnd = options.trial_days
        ? new Date(now.getTime() + options.trial_days * 24 * 60 * 60 * 1000)
        : null;
    const status = options.status || 'ACTIVE';
    const billingCycle = options.billing_cycle || 'MONTHLY';
    const result = await db.query(`
    INSERT INTO contact_packages (contact_id, package_id, status, billing_cycle, credits_balance,
      current_period_start, current_period_end, trial_ends_at, payment_provider)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      status = VALUES(status),
      billing_cycle = VALUES(billing_cycle),
      credits_balance = credits_balance + VALUES(credits_balance),
      current_period_start = VALUES(current_period_start),
      current_period_end = VALUES(current_period_end),
      payment_provider = VALUES(payment_provider)
  `, [
        contactId, packageId, status, billingCycle,
        pkg.credits_included,
        now.toISOString().slice(0, 19).replace('T', ' '),
        periodEnd.toISOString().slice(0, 19).replace('T', ' '),
        trialEnd ? trialEnd.toISOString().slice(0, 19).replace('T', ' ') : null,
        options.payment_provider || 'MANUAL',
    ]);
    const cpId = result.insertId;
    // Log initial credit allocation
    if (pkg.credits_included > 0 && cpId) {
        await logTransaction(cpId, contactId, null, 'MONTHLY_ALLOCATION', pkg.credits_included, null, null, `Initial ${pkg.name} allocation: ${pkg.credits_included} credits`, pkg.credits_included);
    }
    return cpId;
}
export async function updateContactPackageStatus(id, status) {
    const extra = status === 'CANCELLED' ? ', cancelled_at = NOW()' : '';
    await db.query(`UPDATE contact_packages SET status = ? ${extra} WHERE id = ?`, [status, id]);
}
// ─── Credit Operations ──────────────────────────────────────────────────
export async function getBalance(contactId) {
    const rows = await db.query(`
    SELECT cp.id, cp.credits_balance, cp.credits_used, p.name AS package_name, p.slug
    FROM contact_packages cp
    JOIN packages p ON p.id = cp.package_id
    WHERE cp.contact_id = ? AND cp.status IN ('TRIAL', 'ACTIVE')
  `, [contactId]);
    const total = rows.reduce((sum, r) => sum + r.credits_balance, 0);
    return { total, byPackage: rows };
}
export async function deductCredits(contactId, amount, userId, requestType, metadata = null, description = null) {
    if (amount <= 0)
        throw new Error('Deduction amount must be positive');
    // Find the active package with highest balance to deduct from
    const pkgRows = await db.query(`
    SELECT cp.id, cp.credits_balance, cp.contact_id
    FROM contact_packages cp
    WHERE cp.contact_id = ? AND cp.status IN ('TRIAL', 'ACTIVE') AND cp.credits_balance > 0
    ORDER BY cp.credits_balance DESC
    LIMIT 1
  `, [contactId]);
    if (!pkgRows || pkgRows.length === 0) {
        throw new Error('No active package with available credits');
    }
    const cp = pkgRows[0];
    const newBalance = Math.max(0, cp.credits_balance - amount);
    const actualDeduction = cp.credits_balance - newBalance;
    await db.query('UPDATE contact_packages SET credits_balance = ?, credits_used = credits_used + ? WHERE id = ?', [newBalance, actualDeduction, cp.id]);
    await logTransaction(cp.id, contactId, userId, 'USAGE', -actualDeduction, requestType, metadata, description || `${requestType || 'API'} usage: -${actualDeduction} credits`, newBalance);
    return { success: true, balanceAfter: newBalance, contactPackageId: cp.id };
}
export async function addCredits(contactPackageId, amount, type, userId, description = null) {
    if (amount <= 0)
        throw new Error('Credit amount must be positive');
    const cp = await getContactPackageById(contactPackageId);
    if (!cp)
        throw new Error('Contact package not found');
    const newBalance = cp.credits_balance + amount;
    await db.query('UPDATE contact_packages SET credits_balance = ?, low_balance_alert_sent = 0 WHERE id = ?', [newBalance, contactPackageId]);
    await logTransaction(contactPackageId, cp.contact_id, userId, type, amount, null, null, description || `${type}: +${amount} credits`, newBalance);
    return { balanceAfter: newBalance };
}
export async function adjustCredits(contactPackageId, amount, userId, reason) {
    const cp = await getContactPackageById(contactPackageId);
    if (!cp)
        throw new Error('Contact package not found');
    const newBalance = Math.max(0, cp.credits_balance + amount);
    const extra = amount > 0 ? ', low_balance_alert_sent = 0' : '';
    await db.query(`UPDATE contact_packages SET credits_balance = ? ${extra} WHERE id = ?`, [newBalance, contactPackageId]);
    await logTransaction(contactPackageId, cp.contact_id, userId, 'ADJUSTMENT', amount, null, null, reason, newBalance);
    return { balanceAfter: newBalance };
}
// ─── Transactions ────────────────────────────────────────────────────────
async function logTransaction(contactPackageId, contactId, userId, type, amount, requestType, metadata, description, balanceAfter) {
    await db.query(`
    INSERT INTO package_transactions (contact_package_id, contact_id, user_id, type, amount,
      request_type, request_metadata, description, balance_after)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
        contactPackageId, contactId, userId, type, amount,
        requestType, metadata ? JSON.stringify(metadata) : null,
        description, balanceAfter,
    ]);
}
export async function getTransactions(options = {}) {
    const wheres = [];
    const params = [];
    if (options.contactId) {
        wheres.push('pt.contact_id = ?');
        params.push(options.contactId);
    }
    if (options.contactPackageId) {
        wheres.push('pt.contact_package_id = ?');
        params.push(options.contactPackageId);
    }
    if (options.type) {
        wheres.push('pt.type = ?');
        params.push(options.type);
    }
    const where = wheres.length ? 'WHERE ' + wheres.join(' AND ') : '';
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    const countRows = await db.query(`SELECT COUNT(*) as total FROM package_transactions pt ${where}`, params);
    const rows = await db.query(`
    SELECT pt.*, c.company_name AS contact_name, p.name AS package_name
    FROM package_transactions pt
    JOIN contacts c ON c.id = pt.contact_id
    JOIN contact_packages cp ON cp.id = pt.contact_package_id
    JOIN packages p ON p.id = cp.package_id
    LEFT JOIN users u ON u.id = pt.user_id
    ${where}
    ORDER BY pt.created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, limit, offset]);
    return {
        transactions: rows,
        total: countRows[0]?.total || 0,
    };
}
// ─── User ↔ Contact Linking ─────────────────────────────────────────────
export async function linkUserToContact(userId, contactId, role = 'MEMBER') {
    await db.query(`
    INSERT INTO user_contact_link (user_id, contact_id, role)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE role = VALUES(role)
  `, [userId, contactId, role]);
}
export async function getUserContact(userId) {
    const rows = await db.query('SELECT contact_id AS contactId, role FROM user_contact_link WHERE user_id = ? LIMIT 1', [userId]);
    return rows[0] || null;
}
export async function getContactUsers(contactId) {
    const rows = await db.query(`
    SELECT ucl.*, u.email, u.name
    FROM user_contact_link ucl
    JOIN users u ON u.id = ucl.user_id
    WHERE ucl.contact_id = ?
    ORDER BY ucl.role ASC, ucl.created_at ASC
  `, [contactId]);
    return rows;
}
export async function getContactIdFromUserId(userId) {
    const link = await getUserContact(userId);
    return link?.contactId || null;
}
// ─── Public Pricing API ─────────────────────────────────────────────────
export async function getPublicPricing() {
    const all = await getPublicPackages();
    return {
        consumer: all.filter(p => p.package_type === 'CONSUMER'),
        enterprise: all.filter(p => p.package_type === 'ENTERPRISE'),
    };
}
// ─── Usage Stats ─────────────────────────────────────────────────────────
export async function getUsageStats(contactId, days = 30) {
    const byType = await db.query(`
    SELECT request_type, COUNT(*) as count, SUM(ABS(amount)) as total_credits
    FROM package_transactions
    WHERE contact_id = ? AND type = 'USAGE' AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
    GROUP BY request_type
    ORDER BY total_credits DESC
  `, [contactId, days]);
    const daily = await db.query(`
    SELECT DATE(created_at) as date, SUM(ABS(amount)) as credits_used, COUNT(*) as requests
    FROM package_transactions
    WHERE contact_id = ? AND type = 'USAGE' AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `, [contactId, days]);
    return { byType, daily };
}
// ─── Helpers ─────────────────────────────────────────────────────────────
function parsePackageRow(row) {
    return {
        ...row,
        is_active: !!row.is_active,
        is_public: !!row.is_public,
        featured: !!row.featured,
        features: row.features,
    };
}
/**
 * Format price in ZAR cents to display string.
 * 19900 → "R199.00"
 */
export function formatPrice(cents) {
    if (cents === 0)
        return 'R0.00';
    return `R${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}
