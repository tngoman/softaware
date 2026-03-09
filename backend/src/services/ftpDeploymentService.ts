import { randomUUID } from 'crypto';
import { db, toMySQLDate } from '../db/mysql.js';
import { siteBuilderService, GeneratedSite } from './siteBuilderService.js';
import SftpClient from 'ssh2-sftp-client';
import fs from 'fs/promises';
import path from 'path';

export interface DeploymentResult {
  success: boolean;
  deploymentId?: string;
  filesUploaded?: number;
  error?: string;
  duration?: number;
}

export const ftpDeploymentService = {
  /**
   * Deploy site to FTP/SFTP server
   */
  async deploySite(siteId: string): Promise<DeploymentResult> {
    const startTime = Date.now();
    const deploymentId = randomUUID();
    const now = toMySQLDate(new Date());

    try {
      // Get site data
      const site = await siteBuilderService.getSiteById(siteId);
      if (!site) {
        throw new Error('Site not found');
      }

      // Get decrypted FTP credentials (in memory only)
      const ftpCreds = siteBuilderService.getDecryptedFTPCredentials(site);
      if (!ftpCreds) {
        throw new Error('FTP credentials not configured');
      }

      // Generate static files
      const outputDir = await siteBuilderService.generateStaticFiles(siteId);

      // Create deployment record
      await db.execute(
        `INSERT INTO site_deployments (id, site_id, status, deployed_at)
         VALUES (?, ?, ?, ?)`,
        [deploymentId, siteId, 'pending', now]
      );

      // Update deployment status to uploading
      await db.execute(
        'UPDATE site_deployments SET status = ? WHERE id = ?',
        ['uploading', deploymentId]
      );

      // Deploy based on protocol
      let filesUploaded = 0;
      if (ftpCreds.protocol === 'sftp') {
        filesUploaded = await this.deploySFTP(outputDir, ftpCreds);
      } else {
        // For now, only SFTP is supported (basic-ftp can be added later)
        throw new Error('FTP protocol not yet supported. Please use SFTP.');
      }

      const duration = Date.now() - startTime;

      // Update deployment record
      await db.execute(
        `UPDATE site_deployments 
         SET status = ?, files_uploaded = ?, total_files = ?, deployment_duration_ms = ?
         WHERE id = ?`,
        ['success', filesUploaded, filesUploaded, duration, deploymentId]
      );

      // Update site record
      await db.execute(
        `UPDATE generated_sites 
         SET status = ?, last_deployed_at = ?, deployment_error = NULL
         WHERE id = ?`,
        ['deployed', now, siteId]
      );

      // Clear credentials from memory
      Object.keys(ftpCreds).forEach(key => {
        (ftpCreds as any)[key] = null;
      });

      return {
        success: true,
        deploymentId,
        filesUploaded,
        duration
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown deployment error';
      const duration = Date.now() - startTime;

      console.error('[FTP Deployment] Error:', errorMessage);

      // Update deployment record if it was created
      try {
        await db.execute(
          `UPDATE site_deployments 
           SET status = ?, error_message = ?, deployment_duration_ms = ?
           WHERE id = ?`,
          ['failed', errorMessage, duration, deploymentId]
        );
      } catch (dbError) {
        // Deployment record might not exist yet
      }

      // Keep status as 'generated' — the HTML is still valid, only the deploy failed
      await db.execute(
        `UPDATE generated_sites 
         SET status = CASE WHEN status = 'deployed' THEN 'deployed' ELSE 'generated' END,
             deployment_error = ?
         WHERE id = ?`,
        [errorMessage, siteId]
      );

      return {
        success: false,
        error: errorMessage,
        duration
      };
    }
  },

  /**
   * Deploy using SFTP
   */
  async deploySFTP(
    localDir: string,
    credentials: {
      server: string;
      username: string;
      password: string;
      port: number;
      directory: string;
    }
  ): Promise<number> {
    const sftp = new SftpClient();
    let filesUploaded = 0;

    try {
      // Connect to SFTP server
      await sftp.connect({
        host: credentials.server,
        port: credentials.port,
        username: credentials.username,
        password: credentials.password,
        readyTimeout: 60000,
        retries: 2,
        retry_factor: 2,
        retry_minTimeout: 3000,
      });

      // Ensure remote directory exists
      try {
        await sftp.mkdir(credentials.directory, true);
      } catch (error) {
        // Directory might already exist
      }

      // Upload files
      const files = await fs.readdir(localDir);
      
      for (const file of files) {
        const localPath = path.join(localDir, file);
        const remotePath = `${credentials.directory}/${file}`.replace(/\/+/g, '/');
        
        const stat = await fs.stat(localPath);
        if (stat.isFile()) {
          await sftp.put(localPath, remotePath);
          filesUploaded++;
          console.log(`[SFTP] Uploaded: ${file}`);
        }
      }

      return filesUploaded;

    } finally {
      // Always close connection and clear credentials from memory
      await sftp.end();
      credentials.password = '';
    }
  },

  /**
   * Get deployment history for a site
   */
  async getDeploymentHistory(siteId: string): Promise<any[]> {
    return db.query(
      `SELECT * FROM site_deployments 
       WHERE site_id = ? 
       ORDER BY deployed_at DESC 
       LIMIT 20`,
      [siteId]
    );
  },

  /**
   * Get deployment by ID
   */
  async getDeploymentById(deploymentId: string): Promise<any> {
    return db.queryOne(
      'SELECT * FROM site_deployments WHERE id = ?',
      [deploymentId]
    );
  }
};
