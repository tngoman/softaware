import { db } from '../mysql.js';
/**
 * Migration: Site Builder Tables
 *
 * Creates tables for the Soft Aware Site Builder feature:
 * - generated_sites: Stores user website data and FTP credentials
 * - site_deployments: Tracks deployment history
 */
async function up() {
    console.log('🏗️  Creating Site Builder tables...');
    // generated_sites table
    await db.execute(`
    CREATE TABLE IF NOT EXISTS generated_sites (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      widget_client_id VARCHAR(36),
      
      -- Business Information
      business_name VARCHAR(255) NOT NULL,
      tagline VARCHAR(512),
      logo_url VARCHAR(1024),
      hero_image_url VARCHAR(1024),
      about_us TEXT,
      services TEXT,
      
      -- Contact Information
      contact_email VARCHAR(255),
      contact_phone VARCHAR(50),
      
      -- FTP Credentials (encrypted)
      ftp_server VARCHAR(255),
      ftp_username VARCHAR(255),
      ftp_password TEXT,
      ftp_port INT DEFAULT 21,
      ftp_protocol ENUM('ftp', 'sftp') DEFAULT 'sftp',
      ftp_directory VARCHAR(512) DEFAULT '/public_html',
      
      -- Deployment Status
      status ENUM('draft', 'generated', 'deployed', 'failed') DEFAULT 'draft',
      last_deployed_at DATETIME,
      deployment_error TEXT,
      
      -- Theme & Customization
      theme_color VARCHAR(7) DEFAULT '#0044cc',
      
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      INDEX idx_user_id (user_id),
      INDEX idx_widget_client_id (widget_client_id),
      INDEX idx_status (status),
      FOREIGN KEY (user_id) REFERENCES User(id) ON DELETE CASCADE,
      FOREIGN KEY (widget_client_id) REFERENCES widget_clients(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    console.log('✅ Created generated_sites table');
    // site_deployments table (deployment history log)
    await db.execute(`
    CREATE TABLE IF NOT EXISTS site_deployments (
      id VARCHAR(36) PRIMARY KEY,
      site_id VARCHAR(36) NOT NULL,
      
      status ENUM('pending', 'uploading', 'success', 'failed') DEFAULT 'pending',
      files_uploaded INT DEFAULT 0,
      total_files INT DEFAULT 0,
      error_message TEXT,
      deployment_duration_ms INT,
      
      deployed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      
      INDEX idx_site_id (site_id),
      INDEX idx_status (status),
      INDEX idx_deployed_at (deployed_at),
      FOREIGN KEY (site_id) REFERENCES generated_sites(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    console.log('✅ Created site_deployments table');
    console.log('✅ Site Builder migration completed');
}
async function down() {
    console.log('🗑️  Dropping Site Builder tables...');
    await db.execute('DROP TABLE IF EXISTS site_deployments');
    console.log('✅ Dropped site_deployments table');
    await db.execute('DROP TABLE IF EXISTS generated_sites');
    console.log('✅ Dropped generated_sites table');
    console.log('✅ Site Builder migration rolled back');
}
// Run migration if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    up()
        .then(() => {
        console.log('✅ Migration completed successfully');
        process.exit(0);
    })
        .catch((error) => {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    });
}
export { up, down };
