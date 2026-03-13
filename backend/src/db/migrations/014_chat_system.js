import { db } from '../mysql.js';
/**
 * Migration 014: Chat System
 *
 * Creates the unified chat schema supporting:
 *   - 1-on-1 direct messages and group conversations
 *   - Message status tracking (sent → delivered → read)
 *   - Message reactions, stars, per-user deletions
 *   - User presence (online/offline/away)
 *   - Call sessions (voice/video via WebRTC)
 *
 * Also migrates existing team_chats → conversations for backward compat.
 * Old tables are preserved (not dropped) for a 30-day grace period.
 */
// ── Helper: check if table exists ──────────────────────────
async function tableExists(name) {
    const rows = await db.query(`SELECT COUNT(*) AS cnt FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`, [name]);
    return (rows[0]?.cnt ?? 0) > 0;
}
// ── Helper: check if column exists ─────────────────────────
async function columnExists(table, column) {
    const rows = await db.query(`SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`, [table, column]);
    return (rows[0]?.cnt ?? 0) > 0;
}
export async function up() {
    console.log('[Migration 014] Creating chat system tables...');
    // ────────────────────────────────────────────────────────
    // 1. conversations
    // ────────────────────────────────────────────────────────
    if (!(await tableExists('conversations'))) {
        await db.execute(`
      CREATE TABLE conversations (
        id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        type        ENUM('direct','group') NOT NULL DEFAULT 'group',
        name        VARCHAR(100)    NULL          COMMENT 'NULL for DMs — derive from other member',
        description VARCHAR(500)    NULL,
        icon_url    VARCHAR(512)    NULL,
        created_by  VARCHAR(36)     NOT NULL      COMMENT 'users.id UUID',
        created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  DATETIME        NULL ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_conv_created_by (created_by),
        INDEX idx_conv_type (type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        console.log('  ✅ conversations');
    }
    // ────────────────────────────────────────────────────────
    // 2. conversation_members
    // ────────────────────────────────────────────────────────
    if (!(await tableExists('conversation_members'))) {
        await db.execute(`
      CREATE TABLE conversation_members (
        id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        conversation_id       BIGINT UNSIGNED NOT NULL,
        user_id               VARCHAR(36)     NOT NULL,
        role                  ENUM('admin','member') NOT NULL DEFAULT 'member',
        nickname              VARCHAR(100)    NULL,
        muted_until           DATETIME        NULL     COMMENT 'NULL = not muted',
        pinned                TINYINT(1)      NOT NULL DEFAULT 0,
        archived              TINYINT(1)      NOT NULL DEFAULT 0,
        last_read_message_id  BIGINT UNSIGNED NULL     COMMENT 'Last message the user has read',
        joined_at             DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        removed_at            DATETIME        NULL,
        INDEX idx_cm_user (user_id, removed_at),
        INDEX idx_cm_conv (conversation_id, removed_at),
        UNIQUE INDEX idx_cm_conv_user (conversation_id, user_id),
        CONSTRAINT fk_cm_conv FOREIGN KEY (conversation_id)
          REFERENCES conversations(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        console.log('  ✅ conversation_members');
    }
    // ────────────────────────────────────────────────────────
    // 3. messages
    // ────────────────────────────────────────────────────────
    if (!(await tableExists('messages'))) {
        await db.execute(`
      CREATE TABLE messages (
        id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        conversation_id         BIGINT UNSIGNED NOT NULL,
        sender_id               VARCHAR(36)     NOT NULL  COMMENT 'users.id UUID',
        content                 TEXT            NULL,
        message_type            ENUM('text','image','video','audio','file','gif','location','contact','system')
                                  NOT NULL DEFAULT 'text',
        file_url                VARCHAR(512)    NULL,
        file_name               VARCHAR(255)    NULL,
        file_type               VARCHAR(100)    NULL,
        file_size               BIGINT UNSIGNED NULL,
        thumbnail_url           VARCHAR(512)    NULL,
        link_preview_json       JSON            NULL      COMMENT '{ url, title, description, image, domain }',
        reply_to_id             BIGINT UNSIGNED NULL,
        forwarded_from_id       BIGINT UNSIGNED NULL,
        edited_at               DATETIME        NULL,
        deleted_for_everyone_at DATETIME        NULL,
        created_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_msg_conv_date (conversation_id, created_at),
        INDEX idx_msg_sender (sender_id),
        INDEX idx_msg_reply (reply_to_id),
        CONSTRAINT fk_msg_conv FOREIGN KEY (conversation_id)
          REFERENCES conversations(id) ON DELETE CASCADE,
        CONSTRAINT fk_msg_reply FOREIGN KEY (reply_to_id)
          REFERENCES messages(id) ON DELETE SET NULL,
        CONSTRAINT fk_msg_forward FOREIGN KEY (forwarded_from_id)
          REFERENCES messages(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        console.log('  ✅ messages');
    }
    // ────────────────────────────────────────────────────────
    // 4. message_status  (delivery / read receipts)
    // ────────────────────────────────────────────────────────
    if (!(await tableExists('message_status'))) {
        await db.execute(`
      CREATE TABLE message_status (
        message_id  BIGINT UNSIGNED NOT NULL,
        user_id     VARCHAR(36)     NOT NULL,
        status      ENUM('sent','delivered','read') NOT NULL DEFAULT 'sent',
        timestamp   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (message_id, user_id),
        INDEX idx_ms_user_status (user_id, status),
        CONSTRAINT fk_ms_msg FOREIGN KEY (message_id)
          REFERENCES messages(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        console.log('  ✅ message_status');
    }
    // ────────────────────────────────────────────────────────
    // 5. message_reactions
    // ────────────────────────────────────────────────────────
    if (!(await tableExists('message_reactions'))) {
        await db.execute(`
      CREATE TABLE message_reactions (
        id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        message_id  BIGINT UNSIGNED NOT NULL,
        user_id     VARCHAR(36)     NOT NULL,
        emoji       VARCHAR(20)     NOT NULL,
        created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE INDEX idx_mr_unique (message_id, user_id, emoji),
        CONSTRAINT fk_mr_msg FOREIGN KEY (message_id)
          REFERENCES messages(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        console.log('  ✅ message_reactions');
    }
    // ────────────────────────────────────────────────────────
    // 6. starred_messages
    // ────────────────────────────────────────────────────────
    if (!(await tableExists('starred_messages'))) {
        await db.execute(`
      CREATE TABLE starred_messages (
        user_id     VARCHAR(36)     NOT NULL,
        message_id  BIGINT UNSIGNED NOT NULL,
        created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, message_id),
        CONSTRAINT fk_sm_msg FOREIGN KEY (message_id)
          REFERENCES messages(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        console.log('  ✅ starred_messages');
    }
    // ────────────────────────────────────────────────────────
    // 7. deleted_messages  (per-user "delete for me")
    // ────────────────────────────────────────────────────────
    if (!(await tableExists('deleted_messages'))) {
        await db.execute(`
      CREATE TABLE deleted_messages (
        user_id     VARCHAR(36)     NOT NULL,
        message_id  BIGINT UNSIGNED NOT NULL,
        deleted_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, message_id),
        CONSTRAINT fk_dm_msg FOREIGN KEY (message_id)
          REFERENCES messages(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        console.log('  ✅ deleted_messages');
    }
    // ────────────────────────────────────────────────────────
    // 8. user_presence
    // ────────────────────────────────────────────────────────
    if (!(await tableExists('user_presence'))) {
        await db.execute(`
      CREATE TABLE user_presence (
        user_id       VARCHAR(36) NOT NULL PRIMARY KEY,
        status        ENUM('online','away','offline') NOT NULL DEFAULT 'offline',
        last_seen_at  DATETIME    NULL,
        socket_ids    JSON        NULL   COMMENT 'Array of active socket IDs for multi-device'
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        console.log('  ✅ user_presence');
    }
    // ────────────────────────────────────────────────────────
    // 9. call_sessions
    // ────────────────────────────────────────────────────────
    if (!(await tableExists('call_sessions'))) {
        await db.execute(`
      CREATE TABLE call_sessions (
        id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        conversation_id BIGINT UNSIGNED NOT NULL,
        type            ENUM('voice','video') NOT NULL,
        initiated_by    VARCHAR(36)     NOT NULL,
        status          ENUM('ringing','active','ended','missed','declined') NOT NULL DEFAULT 'ringing',
        started_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ended_at        DATETIME        NULL,
        duration_seconds INT UNSIGNED   NULL,
        CONSTRAINT fk_cs_conv FOREIGN KEY (conversation_id)
          REFERENCES conversations(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        console.log('  ✅ call_sessions');
    }
    // ────────────────────────────────────────────────────────
    // 10. call_participants
    // ────────────────────────────────────────────────────────
    if (!(await tableExists('call_participants'))) {
        await db.execute(`
      CREATE TABLE call_participants (
        id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        call_id     BIGINT UNSIGNED NOT NULL,
        user_id     VARCHAR(36)     NOT NULL,
        joined_at   DATETIME        NULL,
        left_at     DATETIME        NULL,
        muted       TINYINT(1)      NOT NULL DEFAULT 0,
        camera_off  TINYINT(1)      NOT NULL DEFAULT 0,
        INDEX idx_cp_call (call_id),
        CONSTRAINT fk_cp_call FOREIGN KEY (call_id)
          REFERENCES call_sessions(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        console.log('  ✅ call_participants');
    }
    // ────────────────────────────────────────────────────────
    // 11. Add avatar_url to users (if missing)
    // ────────────────────────────────────────────────────────
    if (!(await columnExists('users', 'avatar_url'))) {
        await db.execute(`
      ALTER TABLE users ADD COLUMN avatar_url VARCHAR(512) NULL AFTER email
    `);
        console.log('  ✅ users.avatar_url added');
    }
    // ────────────────────────────────────────────────────────
    // 12. Full-text index on messages.content (for search)
    // ────────────────────────────────────────────────────────
    try {
        await db.execute(`ALTER TABLE messages ADD FULLTEXT INDEX ft_msg_content (content)`);
        console.log('  ✅ fulltext index on messages.content');
    }
    catch {
        // May already exist
    }
    // ────────────────────────────────────────────────────────
    // 13. Migrate existing team_chats → conversations
    // ────────────────────────────────────────────────────────
    if (await tableExists('team_chats')) {
        // Check if we already migrated (avoid double-run)
        const existing = await db.queryOne(`SELECT COUNT(*) AS cnt FROM conversations
       WHERE description LIKE '%[migrated:team_chat:%'`);
        if ((existing?.cnt ?? 0) === 0) {
            console.log('  Migrating team_chats → conversations...');
            // Migrate groups
            const teams = await db.query('SELECT * FROM team_chats');
            for (const team of teams) {
                const convId = await db.insert(`INSERT INTO conversations (type, name, description, created_by, created_at, updated_at)
           VALUES ('group', ?, ?, ?, ?, ?)`, [
                    team.name,
                    `${team.description || ''} [migrated:team_chat:${team.id}]`.trim(),
                    team.created_by || 'system',
                    team.created_at,
                    team.updated_at,
                ]);
                // Migrate members
                const members = await db.query('SELECT * FROM team_chat_members WHERE team_id = ?', [team.id]);
                for (const m of members) {
                    await db.execute(`INSERT INTO conversation_members
               (conversation_id, user_id, role, joined_at, removed_at)
             VALUES (?, ?, ?, ?, ?)`, [convId, m.user_id, m.role, m.joined_at, m.removed_at]);
                }
                // Migrate messages (map old IDs → new IDs for reply_to)
                const oldMessages = await db.query('SELECT * FROM team_chat_messages WHERE team_id = ? ORDER BY id ASC', [team.id]);
                const idMap = new Map(); // old ID → new ID
                for (const msg of oldMessages) {
                    const newReplyTo = msg.reply_to_id ? idMap.get(msg.reply_to_id) || null : null;
                    const newId = await db.insert(`INSERT INTO messages
               (conversation_id, sender_id, content, message_type,
                file_url, file_name, file_type, file_size,
                reply_to_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                        convId,
                        msg.user_id || 'system',
                        msg.content,
                        msg.message_type,
                        msg.file_url,
                        msg.file_name,
                        msg.file_type,
                        msg.file_size,
                        newReplyTo,
                        msg.created_at,
                    ]);
                    idMap.set(msg.id, newId);
                }
                console.log(`    team_chat ${team.id} "${team.name}" → conversation ${convId} (${oldMessages.length} messages)`);
            }
            console.log('  ✅ Migration complete');
        }
        else {
            console.log('  ⏭ team_chats already migrated — skipping');
        }
    }
    console.log('[Migration 014] ✅ Chat system tables ready');
}
export async function down() {
    console.log('[Migration 014] Rolling back chat system...');
    // Drop in reverse dependency order
    const tables = [
        'call_participants',
        'call_sessions',
        'user_presence',
        'deleted_messages',
        'starred_messages',
        'message_reactions',
        'message_status',
        'messages',
        'conversation_members',
        'conversations',
    ];
    for (const table of tables) {
        if (await tableExists(table)) {
            await db.execute(`DROP TABLE ${table}`);
            console.log(`  🗑️ Dropped ${table}`);
        }
    }
    // Remove avatar_url from users (only if we added it)
    if (await columnExists('users', 'avatar_url')) {
        await db.execute('ALTER TABLE users DROP COLUMN avatar_url');
        console.log('  🗑️ Removed users.avatar_url');
    }
    console.log('[Migration 014] ✅ Rollback complete');
}
