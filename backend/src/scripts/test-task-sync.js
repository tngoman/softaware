/**
 * End-to-end test for local task sync
 * Usage: npx tsx src/scripts/test-task-sync.ts
 */
import { syncAllSources } from '../services/taskSyncService.js';
import { db, pool } from '../db/mysql.js';
async function main() {
    try {
        // 1. Check source exists
        const sources = await db.query('SELECT * FROM task_sources WHERE sync_enabled = 1');
        console.log(`\n📋 Found ${sources.length} enabled source(s):`);
        for (const s of sources) {
            console.log(`  - [${s.id}] ${s.name} (${s.source_type}) → ${s.base_url}`);
        }
        if (sources.length === 0) {
            console.log('\n⚠️  No sources found. Please create one first.');
            return;
        }
        // 2. Sync all
        console.log('\n🔄 Starting sync...');
        const results = await syncAllSources();
        for (const r of results) {
            console.log(`\n📊 Source: ${r.source_name}`);
            console.log(`   Status:    ${r.status}`);
            console.log(`   Fetched:   ${r.tasks_fetched}`);
            console.log(`   Created:   ${r.tasks_created}`);
            console.log(`   Updated:   ${r.tasks_updated}`);
            console.log(`   Unchanged: ${r.tasks_unchanged}`);
            console.log(`   Deleted:   ${r.tasks_deleted}`);
            console.log(`   Duration:  ${r.duration_ms}ms`);
            if (r.error)
                console.log(`   Error:     ${r.error}`);
        }
        // 3. Show stats
        const [count] = await db.query('SELECT COUNT(*) as total FROM local_tasks WHERE task_deleted = 0');
        console.log(`\n✅ Total active local tasks: ${count.total}`);
        // 4. Show a sample
        const sample = await db.query('SELECT id, external_id, title, status, type, source_id FROM local_tasks WHERE task_deleted = 0 ORDER BY id DESC LIMIT 5');
        if (sample.length > 0) {
            console.log('\n📝 Latest tasks:');
            for (const t of sample) {
                console.log(`  [${t.external_id}] ${t.title} — ${t.status} (${t.type})`);
            }
        }
        // 5. Show sync log
        const logs = await db.query('SELECT * FROM task_sync_log ORDER BY id DESC LIMIT 3');
        console.log('\n📜 Recent sync logs:');
        for (const l of logs) {
            console.log(`  [${l.started_at}] ${l.status} — fetched:${l.tasks_fetched} created:${l.tasks_created} updated:${l.tasks_updated} (${l.duration_ms}ms)`);
        }
    }
    catch (err) {
        console.error('❌ Error:', err.message);
    }
    finally {
        await pool.end();
    }
}
main();
