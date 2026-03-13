/**
 * Migration 005: Standardize all table names to snake_case
 *
 * Problem: The database has 4 different naming conventions:
 *   - PascalCase (Prisma-era): User, Team, Agent, Invoice ...
 *   - snake_case (post-Prisma): assistants, chat_messages ...
 *   - upd_ prefixed (absorbed Updates API): update_clients, update_software ...
 *   - widget_ prefixed: widget_clients ...
 *
 * Solution: Rename everything to consistent snake_case.
 *   - PascalCase → snake_case (User → users)
 *   - upd_ prefix → update_ full word (update_clients → update_clients)
 *   - widget_ tables stay (meaningful domain prefix)
 *   - Existing snake_case stays
 *   - Dead tables dropped (Product, Keyword, FleetAsset, _prisma_migrations, Payment)
 */
// Map of old name → new name
const RENAMES = [
    // ── PascalCase → snake_case ──────────────────────────
    ['User', 'users'],
    ['Team', 'teams'],
    ['team_members', 'team_members'],
    ['team_invites', 'team_invites'],
    ['Agent', 'agents_config'], // 'agents' is taken by assistants-era table; this is the AI agent config
    ['client_agents', 'client_agents'],
    ['api_keys', 'api_keys'],
    ['vault_credentials', 'vault_credentials'],
    ['activation_keys', 'activation_keys'],
    ['device_activations', 'device_activations'],
    ['ai_model_config', 'ai_model_config'],
    ['credit_balances', 'credit_balances'],
    ['credit_packages', 'credit_packages'],
    ['credit_transactions', 'credit_transactions'],
    ['Subscription', 'subscriptions'],
    ['subscription_plans', 'subscription_plans'],
    ['Invoice', 'billing_invoices'], // Distinguishes from incoming business invoices
    ['lead_captures', 'lead_captures'],
    // ── upd_ → update_ ──────────────────────────────────
    ['update_clients', 'update_clients'],
    ['update_software', 'update_software'],
    ['update_releases', 'update_releases'], // Avoids "update_updates"
    ['update_modules', 'update_modules'],
    ['update_user_modules', 'update_user_modules'],
    ['update_installed', 'update_installed'],
    ['update_password_resets', 'update_password_resets'],
];
// Tables to drop (dead / zero references / zero rows)
const DROPS = [
    'Payment', // 0 rows, 0 SQL references in code
    'Product', // Dead — only broken Prisma proxy calls
    'Keyword', // Dead — only broken Prisma proxy calls
    'FleetAsset', // Already dropped by migration 001, may not exist
    '_prisma_migrations', // Zero code references, Prisma artifact
];
export async function up(conn) {
    // Disable FK checks for the duration of the rename
    await conn.execute('SET FOREIGN_KEY_CHECKS = 0');
    // Drop dead tables first
    for (const table of DROPS) {
        try {
            await conn.execute(`DROP TABLE IF EXISTS \`${table}\``);
            console.log(`  [005] Dropped dead table: ${table}`);
        }
        catch (err) {
            console.warn(`  [005] Could not drop ${table}: ${err.message}`);
        }
    }
    // Rename tables
    for (const [oldName, newName] of RENAMES) {
        try {
            await conn.execute(`RENAME TABLE \`${oldName}\` TO \`${newName}\``);
            console.log(`  [005] Renamed: ${oldName} → ${newName}`);
        }
        catch (err) {
            // Table might not exist (e.g. already renamed in a previous partial run)
            console.warn(`  [005] Could not rename ${oldName}: ${err.message}`);
        }
    }
    await conn.execute('SET FOREIGN_KEY_CHECKS = 1');
    console.log('[Migration 005] Table name standardization complete');
}
export async function down(conn) {
    await conn.execute('SET FOREIGN_KEY_CHECKS = 0');
    // Reverse renames
    for (const [oldName, newName] of RENAMES) {
        try {
            await conn.execute(`RENAME TABLE \`${newName}\` TO \`${oldName}\``);
            console.log(`  [005 rollback] Renamed: ${newName} → ${oldName}`);
        }
        catch (err) {
            console.warn(`  [005 rollback] Could not rename ${newName}: ${err.message}`);
        }
    }
    await conn.execute('SET FOREIGN_KEY_CHECKS = 1');
    console.log('[Migration 005] Rollback complete (dropped tables NOT restored)');
}
