import { db } from '../mysql.js';

/**
 * Database Migration: Clean up legacy tables and create free tier widget schema
 */

export async function migrateToFreeTierWidget() {
  console.log('🔄 Starting database migration to Free Tier Widget schema...');

  try {
    // Phase 1: Drop legacy tables
    console.log('\n📦 Phase 1: Removing legacy tables...');
    
    const legacyTables = [
      'MorningBriefing',
      'FleetAsset',
      'ForexAlert',
      'RiskIncident'
    ];

    for (const table of legacyTables) {
      try {
        await db.execute(`DROP TABLE IF EXISTS \`${table}\``);
        console.log(`✅ Dropped table: ${table}`);
      } catch (error) {
        console.log(`⚠️  Table ${table} doesn't exist or already dropped`);
      }
    }

    // Phase 2: Create new free tier schema
    console.log('\n📦 Phase 2: Creating free tier widget schema...');

    // widget_clients table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS widget_clients (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36),
        website_url VARCHAR(512) NOT NULL,
        message_count INT DEFAULT 0,
        max_messages INT DEFAULT 500,
        max_pages INT DEFAULT 50,
        pages_ingested INT DEFAULT 0,
        widget_color VARCHAR(7) DEFAULT '#0044cc',
        status ENUM('active', 'suspended', 'upgraded') DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_status (status),
        INDEX idx_last_active (last_active),
        FOREIGN KEY (user_id) REFERENCES User(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Created widget_clients table');

    // document_metadata table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS document_metadata (
        id VARCHAR(36) PRIMARY KEY,
        client_id VARCHAR(36) NOT NULL,
        content TEXT NOT NULL,
        source_url VARCHAR(1024),
        source_type ENUM('website', 'pdf', 'txt', 'doc') NOT NULL,
        chunk_index INT NOT NULL,
        char_count INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_client_id (client_id),
        INDEX idx_source_url (source_url(255)),
        INDEX idx_source_type (source_type),
        FOREIGN KEY (client_id) REFERENCES widget_clients(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Created document_metadata table');

    // document_embeddings table (instead of sqlite-vec, we'll use MySQL with JSON)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS document_embeddings (
        id VARCHAR(36) PRIMARY KEY,
        document_id VARCHAR(36) NOT NULL,
        embedding JSON NOT NULL,
        embedding_model VARCHAR(64) DEFAULT 'nomic-embed-text',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_document_id (document_id),
        FOREIGN KEY (document_id) REFERENCES document_metadata(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Created document_embeddings table');

    // chat_messages table (for tracking conversations)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id VARCHAR(36) PRIMARY KEY,
        client_id VARCHAR(36) NOT NULL,
        session_id VARCHAR(64),
        role ENUM('user', 'assistant') NOT NULL,
        content TEXT NOT NULL,
        model VARCHAR(64),
        tokens_used INT,
        response_time_ms INT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_client_id (client_id),
        INDEX idx_session_id (session_id),
        INDEX idx_created_at (created_at),
        FOREIGN KEY (client_id) REFERENCES widget_clients(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Created chat_messages table');

    // crawl_queue table (for managing background crawls)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS crawl_queue (
        id VARCHAR(36) PRIMARY KEY,
        client_id VARCHAR(36) NOT NULL,
        url VARCHAR(1024) NOT NULL,
        status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
        priority INT DEFAULT 0,
        retry_count INT DEFAULT 0,
        max_retries INT DEFAULT 3,
        error_message TEXT,
        started_at DATETIME,
        completed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_client_id (client_id),
        INDEX idx_status (status),
        INDEX idx_priority (priority),
        INDEX idx_created_at (created_at),
        FOREIGN KEY (client_id) REFERENCES widget_clients(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Created crawl_queue table');

    console.log('\n✨ Database migration completed successfully!');
    console.log('\n📊 New schema summary:');
    console.log('  - widget_clients: Client accounts with usage limits');
    console.log('  - document_metadata: Text chunks from websites/files');
    console.log('  - document_embeddings: Vector embeddings for RAG');
    console.log('  - chat_messages: Conversation history');
    console.log('  - crawl_queue: Background crawl management');

    return true;
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateToFreeTierWidget()
    .then(() => {
      console.log('\n✅ Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
}
