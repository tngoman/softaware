/**
 * Migration 009 — Seed roles (from SOFTAWARECODE_WEB_APP_SPEC §6.1) and
 * comprehensive permissions, then wire role_permissions.
 *
 * Roles: super_admin, admin, developer, client_manager, qa_specialist, deployer, viewer
 *
 * Also assigns the admin user to the Admin role via user_roles,
 * and expands the permissions table with all permission slugs needed for the
 * dashboard, software, AI, websites, and system management sections.
 */
export async function up(pool) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        // ── 1. Seed roles (UPSERT by slug) ──────────────────────────────
        const roles = [
            { name: 'Super Admin', slug: 'super_admin', description: 'Full platform access — all features, all data' },
            { name: 'Admin', slug: 'admin', description: 'Full system access' },
            { name: 'Developer', slug: 'developer', description: 'Code development — development phase tasks' },
            { name: 'Client Manager', slug: 'client_manager', description: 'Client intake — intake phase tasks' },
            { name: 'QA Specialist', slug: 'qa_specialist', description: 'Quality review — QA phase tasks' },
            { name: 'Deployer', slug: 'deployer', description: 'Deployment pipeline — releases & updates' },
            { name: 'Viewer', slug: 'viewer', description: 'Read-only access to dashboards and reports' },
        ];
        for (const r of roles) {
            const [existing] = await conn.query('SELECT id FROM roles WHERE slug = ?', [r.slug]);
            if (existing.length === 0) {
                await conn.execute('INSERT INTO roles (name, slug, description, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())', [r.name, r.slug, r.description]);
            }
            else {
                // Update name/description if slug already exists
                await conn.execute('UPDATE roles SET name = ?, description = ? WHERE slug = ?', [r.name, r.description, r.slug]);
            }
        }
        // Rename old "User" role slug from "user" → "viewer" if it exists as generic
        await conn.execute(`UPDATE roles SET name = 'Viewer', slug = 'viewer', description = 'Read-only access to dashboards and reports'
       WHERE slug = 'user' AND NOT EXISTS (SELECT 1 FROM (SELECT id FROM roles WHERE slug = 'viewer') AS t)`);
        // ── 2. Seed permissions ─────────────────────────────────────────
        const permissions = [
            // Dashboard
            { name: 'View Dashboard', slug: 'dashboard.view', group: 'Dashboard' },
            // Quotations
            { name: 'View Quotations', slug: 'quotations.view', group: 'Quotations' },
            { name: 'Manage Quotations', slug: 'quotations.manage', group: 'Quotations' },
            // Invoices
            { name: 'View Invoices', slug: 'invoices.view', group: 'Invoices' },
            { name: 'Manage Invoices', slug: 'invoices.manage', group: 'Invoices' },
            { name: 'Manage Payments', slug: 'invoices.payments', group: 'Invoices' },
            // Contacts
            { name: 'View Contacts', slug: 'contacts.view', group: 'Contacts' },
            { name: 'Manage Contacts', slug: 'contacts.manage', group: 'Contacts' },
            // Categories
            { name: 'View Categories', slug: 'categories.view', group: 'Categories' },
            { name: 'Manage Categories', slug: 'categories.manage', group: 'Categories' },
            // Reports
            { name: 'View Reports', slug: 'reports.view', group: 'Reports' },
            // Settings
            { name: 'View Settings', slug: 'settings.view', group: 'Settings' },
            { name: 'Manage Settings', slug: 'settings.manage', group: 'Settings' },
            // Users / Roles / Permissions (System)
            { name: 'View Users', slug: 'users.view', group: 'System' },
            { name: 'Manage Users', slug: 'users.manage', group: 'System' },
            { name: 'View Roles', slug: 'roles.view', group: 'System' },
            { name: 'Manage Roles', slug: 'roles.manage', group: 'System' },
            { name: 'View Permissions', slug: 'permissions.view', group: 'System' },
            { name: 'Manage Permissions', slug: 'permissions.manage', group: 'System' },
            // Credentials
            { name: 'View Credentials', slug: 'credentials.view', group: 'Credentials' },
            { name: 'Manage Credentials', slug: 'credentials.manage', group: 'Credentials' },
            // Software / Updates (SoftAwareCode)
            { name: 'View Software', slug: 'software.view', group: 'Software' },
            { name: 'Manage Software', slug: 'software.manage', group: 'Software' },
            { name: 'View Updates', slug: 'updates.view', group: 'Software' },
            { name: 'Manage Updates', slug: 'updates.manage', group: 'Software' },
            // Clients (connected desktops)
            { name: 'View Clients', slug: 'clients.view', group: 'Clients' },
            { name: 'Manage Clients', slug: 'clients.manage', group: 'Clients' },
            // AI
            { name: 'View AI', slug: 'ai.view', group: 'AI' },
            { name: 'Manage AI', slug: 'ai.manage', group: 'AI' },
            // Websites / Site Builder
            { name: 'View Websites', slug: 'websites.view', group: 'Websites' },
            { name: 'Manage Websites', slug: 'websites.manage', group: 'Websites' },
            // Pricing
            { name: 'View Pricing', slug: 'pricing.view', group: 'Pricing' },
            { name: 'Manage Pricing', slug: 'pricing.manage', group: 'Pricing' },
            // Transactions
            { name: 'View Transactions', slug: 'transactions.view', group: 'Transactions' },
            { name: 'Manage Transactions', slug: 'transactions.manage', group: 'Transactions' },
            // Leads
            { name: 'View Leads', slug: 'leads.view', group: 'Leads' },
            { name: 'Manage Leads', slug: 'leads.manage', group: 'Leads' },
            // Wildcard
            { name: 'All Access', slug: '*', group: 'System' },
        ];
        for (const p of permissions) {
            const [existing] = await conn.query('SELECT id FROM permissions WHERE slug = ?', [p.slug]);
            if (existing.length === 0) {
                await conn.execute('INSERT INTO permissions (name, slug, description, permission_group, created_at, updated_at) VALUES (?, ?, NULL, ?, NOW(), NOW())', [p.name, p.slug, p.group]);
            }
        }
        // ── 3. Wire role_permissions ────────────────────────────────────
        // Helper: get role id
        async function roleId(slug) {
            const [rows] = await conn.query('SELECT id FROM roles WHERE slug = ?', [slug]);
            return rows[0]?.id;
        }
        // Helper: get permission id
        async function permId(slug) {
            const [rows] = await conn.query('SELECT id FROM permissions WHERE slug = ?', [slug]);
            return rows[0]?.id;
        }
        // Helper: link
        async function link(rSlug, pSlug) {
            const rId = await roleId(rSlug);
            const pId = await permId(pSlug);
            if (!rId || !pId)
                return;
            const [existing] = await conn.query('SELECT role_id FROM role_permissions WHERE role_id = ? AND permission_id = ?', [rId, pId]);
            if (existing.length === 0) {
                await conn.execute('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [rId, pId]);
            }
        }
        // Super Admin & Admin → wildcard (*)
        await link('super_admin', '*');
        await link('admin', '*');
        // Also give admin all explicit permissions so queries without wildcard still work
        const adminPerms = [
            'dashboard.view', 'quotations.view', 'quotations.manage', 'invoices.view', 'invoices.manage',
            'invoices.payments', 'contacts.view', 'contacts.manage', 'categories.view', 'categories.manage',
            'reports.view', 'settings.view', 'settings.manage', 'users.view', 'users.manage',
            'roles.view', 'roles.manage', 'permissions.view', 'permissions.manage',
            'credentials.view', 'credentials.manage', 'software.view', 'software.manage',
            'updates.view', 'updates.manage', 'clients.view', 'clients.manage',
            'ai.view', 'ai.manage', 'websites.view', 'websites.manage',
            'pricing.view', 'pricing.manage', 'transactions.view', 'transactions.manage',
            'leads.view', 'leads.manage',
        ];
        for (const p of adminPerms) {
            await link('super_admin', p);
            await link('admin', p);
        }
        // Developer
        const devPerms = [
            'dashboard.view', 'software.view', 'updates.view', 'clients.view',
            'ai.view', 'websites.view', 'reports.view',
        ];
        for (const p of devPerms)
            await link('developer', p);
        // Client Manager
        const cmPerms = [
            'dashboard.view', 'contacts.view', 'contacts.manage',
            'invoices.view', 'quotations.view',
            'clients.view', 'leads.view', 'leads.manage', 'reports.view',
        ];
        for (const p of cmPerms)
            await link('client_manager', p);
        // QA Specialist
        const qaPerms = [
            'dashboard.view', 'software.view', 'updates.view',
            'clients.view', 'reports.view',
        ];
        for (const p of qaPerms)
            await link('qa_specialist', p);
        // Deployer
        const deployPerms = [
            'dashboard.view', 'software.view', 'software.manage',
            'updates.view', 'updates.manage',
            'clients.view', 'clients.manage', 'reports.view',
        ];
        for (const p of deployPerms)
            await link('deployer', p);
        // Viewer — read-only dashboard
        const viewerPerms = ['dashboard.view'];
        for (const p of viewerPerms)
            await link('viewer', p);
        // ── 4. Assign admin user to Admin role (via user_roles) ─────────
        const adminRoleId = await roleId('admin');
        if (adminRoleId) {
            // Get admin user
            const [adminUsers] = await conn.query(`SELECT u.id FROM users u
         JOIN team_members tm ON tm.userId COLLATE utf8mb4_unicode_ci = u.id COLLATE utf8mb4_unicode_ci
         WHERE tm.role = 'ADMIN'`);
            for (const u of adminUsers) {
                const [existing] = await conn.query('SELECT id FROM user_roles WHERE user_id COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci AND role_id = ?', [u.id, adminRoleId]);
                if (existing.length === 0) {
                    await conn.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [u.id, adminRoleId]);
                }
            }
        }
        await conn.commit();
        console.log('[migration-009] Roles, permissions, and role_permissions seeded successfully.');
    }
    catch (err) {
        await conn.rollback();
        throw err;
    }
    finally {
        conn.release();
    }
}
