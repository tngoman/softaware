import { randomUUID } from 'crypto';
import { db, toMySQLDate } from '../db/mysql.js';
import { siteBuilderService } from './siteBuilderService.js';
import SftpClient from 'ssh2-sftp-client';
import * as basicFtp from 'basic-ftp';
import fs from 'fs/promises';
import path from 'path';
export const ftpDeploymentService = {
    /**
     * Deploy site to FTP/SFTP server
     */
    async deploySite(siteId) {
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
            await db.execute(`INSERT INTO site_deployments (id, site_id, status, deployed_at)
         VALUES (?, ?, ?, ?)`, [deploymentId, siteId, 'pending', now]);
            // Update deployment status to uploading
            await db.execute('UPDATE site_deployments SET status = ? WHERE id = ?', ['uploading', deploymentId]);
            // Deploy based on protocol
            let filesUploaded = 0;
            if (ftpCreds.protocol === 'sftp') {
                filesUploaded = await this.deploySFTP(outputDir, ftpCreds);
            }
            else {
                filesUploaded = await this.deployFTP(outputDir, ftpCreds);
            }
            const duration = Date.now() - startTime;
            // Update deployment record
            await db.execute(`UPDATE site_deployments 
         SET status = ?, files_uploaded = ?, total_files = ?, deployment_duration_ms = ?
         WHERE id = ?`, ['success', filesUploaded, filesUploaded, duration, deploymentId]);
            // Update site record
            await db.execute(`UPDATE generated_sites 
         SET status = ?, last_deployed_at = ?, deployment_error = NULL
         WHERE id = ?`, ['deployed', now, siteId]);
            // Clear credentials from memory
            Object.keys(ftpCreds).forEach(key => {
                ftpCreds[key] = null;
            });
            return {
                success: true,
                deploymentId,
                filesUploaded,
                duration
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown deployment error';
            const duration = Date.now() - startTime;
            console.error('[FTP Deployment] Error:', errorMessage);
            // Update deployment record if it was created
            try {
                await db.execute(`UPDATE site_deployments 
           SET status = ?, error_message = ?, deployment_duration_ms = ?
           WHERE id = ?`, ['failed', errorMessage, duration, deploymentId]);
            }
            catch (dbError) {
                // Deployment record might not exist yet
            }
            // Keep status as 'generated' — the HTML is still valid, only the deploy failed
            await db.execute(`UPDATE generated_sites 
         SET status = CASE WHEN status = 'deployed' THEN 'deployed' ELSE 'generated' END,
             deployment_error = ?
         WHERE id = ?`, [errorMessage, siteId]);
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
    async deploySFTP(localDir, credentials) {
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
            }
            catch (error) {
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
        }
        finally {
            // Always close connection and clear credentials from memory
            await sftp.end();
            credentials.password = '';
        }
    },
    /**
     * Deploy using FTP (basic-ftp with optional TLS)
     */
    async deployFTP(localDir, credentials) {
        const client = new basicFtp.Client();
        client.ftp.verbose = false;
        let filesUploaded = 0;
        try {
            // Try explicit FTPS first, fall back to plain FTP
            const useTLS = credentials.protocol === 'ftps';
            const port = credentials.port || 21;
            console.log(`[FTP] Connecting to ${credentials.server}:${port} (TLS: ${useTLS ? 'explicit' : 'auto-try'})`);
            // Attempt with explicit TLS first (most shared hosts support FTPS)
            let connected = false;
            if (!connected) {
                try {
                    await client.access({
                        host: credentials.server,
                        port,
                        user: credentials.username,
                        password: credentials.password,
                        secure: true,
                        secureOptions: { rejectUnauthorized: false },
                    });
                    connected = true;
                    console.log('[FTP] Connected with explicit TLS');
                }
                catch (tlsErr) {
                    console.warn('[FTP] TLS failed, trying plain FTP:', tlsErr.message);
                }
            }
            // Fall back to plain FTP if TLS didn't work
            if (!connected) {
                await client.access({
                    host: credentials.server,
                    port,
                    user: credentials.username,
                    password: credentials.password,
                    secure: false,
                });
                connected = true;
                console.log('[FTP] Connected without TLS');
            }
            // Ensure remote directory exists
            await client.ensureDir(credentials.directory);
            console.log(`[FTP] Remote dir ready: ${credentials.directory}`);
            // Upload files
            const files = await fs.readdir(localDir);
            for (const file of files) {
                const localPath = path.join(localDir, file);
                const remotePath = `${credentials.directory}/${file}`.replace(/\/+/g, '/');
                const stat = await fs.stat(localPath);
                if (stat.isFile()) {
                    await client.uploadFrom(localPath, remotePath);
                    filesUploaded++;
                    console.log(`[FTP] Uploaded: ${file}`);
                }
                else if (stat.isDirectory()) {
                    // Recursively upload subdirectories
                    await client.ensureDir(remotePath);
                    const subFiles = await fs.readdir(localPath);
                    for (const subFile of subFiles) {
                        const subLocalPath = path.join(localPath, subFile);
                        const subRemotePath = `${remotePath}/${subFile}`.replace(/\/+/g, '/');
                        const subStat = await fs.stat(subLocalPath);
                        if (subStat.isFile()) {
                            await client.uploadFrom(subLocalPath, subRemotePath);
                            filesUploaded++;
                            console.log(`[FTP] Uploaded: ${file}/${subFile}`);
                        }
                    }
                    // Go back to the parent directory after uploading subdirectory
                    await client.cd(credentials.directory);
                }
            }
            return filesUploaded;
        }
        finally {
            client.close();
            credentials.password = '';
        }
    },
    /**
     * Get deployment history for a site
     */
    async getDeploymentHistory(siteId) {
        return db.query(`SELECT * FROM site_deployments 
       WHERE site_id = ? 
       ORDER BY deployed_at DESC 
       LIMIT 20`, [siteId]);
    },
    /**
     * Get deployment by ID
     */
    async getDeploymentById(deploymentId) {
        return db.queryOne('SELECT * FROM site_deployments WHERE id = ?', [deploymentId]);
    }
};
