import { db } from '../mysql.js';

export async function up() {
  console.log('\n🔄 Migration 030: Purging Legacy Pricing Systems\n');

  try {
    await db.execute('DROP TABLE IF EXISTS package_transactions');
    console.log('✅ Dropped package_transactions');
  } catch (err: any) {
    console.error('Failed to drop package_transactions:', err.message);
  }

  try {
    await db.execute('DROP TABLE IF EXISTS contact_packages');
    console.log('✅ Dropped contact_packages');
  } catch (err: any) {
    console.error('Failed to drop contact_packages:', err.message);
  }

  try {
    await db.execute('DROP TABLE IF EXISTS packages');
    console.log('✅ Dropped packages');
  } catch (err: any) {
    console.error('Failed to drop packages:', err.message);
  }

  try {
    await db.execute('DROP TABLE IF EXISTS subscription_tier_limits');
    console.log('✅ Dropped subscription_tier_limits');
  } catch (err: any) {
    console.error('Failed to drop subscription_tier_limits:', err.message);
  }
}

export async function down() {
  console.log('\n🔄 Migration 030: Down method not supported for purged tables (use Migration 023 and 003 directly instead)\n');
}
