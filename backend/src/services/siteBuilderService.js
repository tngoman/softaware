import { randomUUID } from 'crypto';
import { db, toMySQLDate } from '../db/mysql.js';
import { encryptPassword, decryptPassword } from '../utils/cryptoUtils.js';
import path from 'path';
import fs from 'fs/promises';
export const siteBuilderService = {
    /**
     * Create a new generated site
     */
    async createSite(data) {
        const id = randomUUID();
        const now = toMySQLDate(new Date());
        // Encrypt FTP password if provided
        const encryptedPassword = data.ftpPassword
            ? encryptPassword(data.ftpPassword)
            : null;
        // Validate widget_client_id — accept assistant IDs (assistant-*) or legacy UUIDs
        let validWidgetClientId = null;
        if (data.widgetClientId) {
            const wid = data.widgetClientId.trim();
            if (/^(assistant-|staff-assistant-)/.test(wid)) {
                // New assistant system — verify it exists in assistants table
                const exists = await db.queryOne('SELECT id FROM assistants WHERE id = ? LIMIT 1', [wid]);
                if (exists)
                    validWidgetClientId = wid;
                else
                    console.warn(`[SiteBuilder] Assistant not found: ${wid}`);
            }
            else if (/^[0-9a-f]{8}-/i.test(wid)) {
                // Legacy widget_clients UUID — accept if it exists
                const exists = await db.queryOne('SELECT id FROM widget_clients WHERE id = ? LIMIT 1', [wid]);
                if (exists)
                    validWidgetClientId = wid;
            }
        }
        await db.execute(`INSERT INTO generated_sites (
        id, user_id, widget_client_id, business_name, tagline,
        logo_url, hero_image_url, about_us, services,
        contact_email, contact_phone,
        ftp_server, ftp_username, ftp_password, ftp_port, ftp_protocol, ftp_directory,
        theme_color, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            id,
            data.userId,
            validWidgetClientId,
            data.businessName,
            data.tagline || null,
            data.logoUrl || null,
            data.heroImageUrl || null,
            data.aboutUs || null,
            data.services || null,
            data.contactEmail || null,
            data.contactPhone || null,
            data.ftpServer || null,
            data.ftpUsername || null,
            encryptedPassword,
            data.ftpPort || 21,
            data.ftpProtocol || 'sftp',
            data.ftpDirectory || '/public_html',
            data.themeColor || '#0044cc',
            'draft',
            now,
            now
        ]);
        return this.getSiteById(id);
    },
    /**
     * Get site by ID (with decrypted password in memory only)
     */
    async getSiteById(siteId) {
        const site = await db.queryOne('SELECT * FROM generated_sites WHERE id = ?', [siteId]);
        return site || null;
    },
    /**
     * Get all sites for a user
     */
    async getSitesByUserId(userId) {
        return db.query('SELECT * FROM generated_sites WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    },
    /**
     * Update site data
     */
    async updateSite(siteId, data) {
        const updates = [];
        const values = [];
        if (data.businessName !== undefined) {
            updates.push('business_name = ?');
            values.push(data.businessName);
        }
        if (data.tagline !== undefined) {
            updates.push('tagline = ?');
            values.push(data.tagline);
        }
        if (data.logoUrl !== undefined) {
            updates.push('logo_url = ?');
            values.push(data.logoUrl);
        }
        if (data.heroImageUrl !== undefined) {
            updates.push('hero_image_url = ?');
            values.push(data.heroImageUrl);
        }
        if (data.aboutUs !== undefined) {
            updates.push('about_us = ?');
            values.push(data.aboutUs);
        }
        if (data.services !== undefined) {
            updates.push('services = ?');
            values.push(data.services);
        }
        if (data.contactEmail !== undefined) {
            updates.push('contact_email = ?');
            values.push(data.contactEmail);
        }
        if (data.contactPhone !== undefined) {
            updates.push('contact_phone = ?');
            values.push(data.contactPhone);
        }
        if (data.themeColor !== undefined) {
            updates.push('theme_color = ?');
            values.push(data.themeColor);
        }
        // Handle FTP credentials
        if (data.ftpServer !== undefined) {
            updates.push('ftp_server = ?');
            values.push(data.ftpServer);
        }
        if (data.ftpUsername !== undefined) {
            updates.push('ftp_username = ?');
            values.push(data.ftpUsername);
        }
        if (data.ftpPassword !== undefined) {
            updates.push('ftp_password = ?');
            values.push(encryptPassword(data.ftpPassword));
        }
        if (data.ftpPort !== undefined) {
            updates.push('ftp_port = ?');
            values.push(data.ftpPort);
        }
        if (data.ftpProtocol !== undefined) {
            updates.push('ftp_protocol = ?');
            values.push(data.ftpProtocol);
        }
        if (data.ftpDirectory !== undefined) {
            updates.push('ftp_directory = ?');
            values.push(data.ftpDirectory);
        }
        if (data.widgetClientId !== undefined) {
            if (data.widgetClientId) {
                const wid = data.widgetClientId.trim();
                let valid = false;
                if (/^(assistant-|staff-assistant-)/.test(wid)) {
                    const exists = await db.queryOne('SELECT id FROM assistants WHERE id = ? LIMIT 1', [wid]);
                    valid = !!exists;
                }
                else if (/^[0-9a-f]{8}-/i.test(wid)) {
                    const exists = await db.queryOne('SELECT id FROM widget_clients WHERE id = ? LIMIT 1', [wid]);
                    valid = !!exists;
                }
                updates.push('widget_client_id = ?');
                values.push(valid ? wid : null);
            }
            else {
                updates.push('widget_client_id = ?');
                values.push(null);
            }
        }
        if (updates.length === 0)
            return;
        updates.push('updated_at = ?');
        values.push(toMySQLDate(new Date()));
        values.push(siteId);
        await db.execute(`UPDATE generated_sites SET ${updates.join(', ')} WHERE id = ?`, values);
    },
    /**
     * Mark a site as 'generating' (AI in progress)
     */
    async setGenerating(siteId) {
        await db.execute(`UPDATE generated_sites SET status = 'generating', generation_error = NULL, updated_at = ? WHERE id = ?`, [toMySQLDate(new Date()), siteId]);
    },
    /**
     * Store AI-generated HTML and mark as generated
     */
    async storeGeneratedHtml(siteId, html) {
        await db.execute(`UPDATE generated_sites SET generated_html = ?, status = 'generated', generation_error = NULL, updated_at = ? WHERE id = ?`, [html, toMySQLDate(new Date()), siteId]);
    },
    /**
     * Store generation error
     */
    async setGenerationError(siteId, error) {
        await db.execute(`UPDATE generated_sites SET status = 'failed', generation_error = ?, updated_at = ? WHERE id = ?`, [error.slice(0, 2000), toMySQLDate(new Date()), siteId]);
    },
    /**
     * Generate static HTML files for a site
     */
    async generateStaticFiles(siteId) {
        const site = await this.getSiteById(siteId);
        if (!site)
            throw new Error('Site not found');
        const outputDir = `/var/tmp/generated_sites/${siteId}`;
        await fs.mkdir(outputDir, { recursive: true });
        if (site.generated_html) {
            // Use the AI-generated Tailwind HTML directly — it's self-contained (CDN)
            await fs.writeFile(path.join(outputDir, 'index.html'), site.generated_html, 'utf8');
        }
        else {
            // Fallback: build basic HTML + CSS from raw site data
            const html = this.buildHTML(site);
            await fs.writeFile(path.join(outputDir, 'index.html'), html, 'utf8');
            const css = this.buildCSS(site);
            await fs.writeFile(path.join(outputDir, 'style.css'), css, 'utf8');
        }
        return outputDir;
    },
    /**
     * Build HTML template with injected data
     */
    buildHTML(site) {
        const isRealAssistant = site.widget_client_id && /^(assistant-|staff-assistant-|[0-9a-f]{8}-)/i.test(site.widget_client_id);
        const widgetScript = isRealAssistant
            ? `<script src="https://softaware.net.za/api/assistants/widget.js" data-assistant-id="${site.widget_client_id}" defer></script>`
            : '';
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${site.tagline || site.business_name}">
  <title>${site.business_name}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header>
    <nav class="container">
      ${site.logo_url ? `<img src="${site.logo_url}" alt="${site.business_name} Logo" class="logo">` : ''}
      <h1>${site.business_name}</h1>
    </nav>
  </header>

  <section class="hero">
    ${site.hero_image_url ? `<div class="hero-image" style="background-image: url('${site.hero_image_url}');"></div>` : ''}
    <div class="hero-content container">
      <h2>${site.business_name}</h2>
      ${site.tagline ? `<p class="tagline">${site.tagline}</p>` : ''}
    </div>
  </section>

  ${site.about_us ? `
  <section id="about" class="container">
    <h2>About Us</h2>
    <div class="content">${site.about_us.replace(/\n/g, '<br>')}</div>
  </section>
  ` : ''}

  ${site.services ? `
  <section id="services" class="container">
    <h2>Our Services</h2>
    <div class="content">${site.services.replace(/\n/g, '<br>')}</div>
  </section>
  ` : ''}

  <section id="contact" class="container">
    <h2>Contact Us</h2>
    <form action="https://api.softaware.net.za/v1/leads/submit" method="POST" class="contact-form">
      <input type="hidden" name="client_id" value="${site.widget_client_id || site.id}">
      <input type="text" name="honeypot" style="display:none;" tabindex="-1" autocomplete="off">
      
      <div class="form-group">
        <label for="name">Your Name</label>
        <input type="text" id="name" name="name" required>
      </div>
      
      <div class="form-group">
        <label for="email">Your Email</label>
        <input type="email" id="email" name="email" required>
      </div>
      
      <div class="form-group">
        <label for="message">Message</label>
        <textarea id="message" name="message" rows="5" required></textarea>
      </div>
      
      <button type="submit" class="btn-submit">Send Message</button>
    </form>

    ${site.contact_email || site.contact_phone ? `
    <div class="contact-info">
      ${site.contact_email ? `<p><strong>Email:</strong> ${site.contact_email}</p>` : ''}
      ${site.contact_phone ? `<p><strong>Phone:</strong> ${site.contact_phone}</p>` : ''}
    </div>
    ` : ''}
  </section>

  <footer>
    <div class="container">
      <p>&copy; ${new Date().getFullYear()} ${site.business_name}. All rights reserved.</p>
      <p class="powered-by">Website powered by <a href="https://softaware.net.za" target="_blank">Soft Aware</a></p>
    </div>
  </footer>

  ${widgetScript}
</body>
</html>`;
    },
    /**
     * Build CSS with theme color
     */
    buildCSS(site) {
        return `/* Site Builder Generated Styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  line-height: 1.6;
  color: #333;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

/* Header */
header {
  background: white;
  border-bottom: 1px solid #e0e0e0;
  padding: 20px 0;
}

header nav {
  display: flex;
  align-items: center;
  gap: 20px;
}

.logo {
  height: 50px;
  width: auto;
}

header h1 {
  font-size: 24px;
  color: ${site.theme_color};
}

/* Hero Section */
.hero {
  position: relative;
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, ${site.theme_color} 0%, ${this.adjustBrightness(site.theme_color, -20)} 100%);
  color: white;
  text-align: center;
}

.hero-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  opacity: 0.3;
}

.hero-content {
  position: relative;
  z-index: 1;
}

.hero h2 {
  font-size: 48px;
  margin-bottom: 20px;
}

.tagline {
  font-size: 24px;
  opacity: 0.9;
}

/* Sections */
section {
  padding: 60px 20px;
}

section h2 {
  font-size: 36px;
  margin-bottom: 30px;
  color: ${site.theme_color};
}

.content {
  font-size: 18px;
  line-height: 1.8;
}

/* Contact Form */
.contact-form {
  max-width: 600px;
  margin: 0 auto 40px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
  font-family: inherit;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: ${site.theme_color};
}

.btn-submit {
  background: ${site.theme_color};
  color: white;
  border: none;
  padding: 14px 40px;
  font-size: 18px;
  border-radius: 4px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-submit:hover {
  opacity: 0.9;
}

.contact-info {
  text-align: center;
  margin-top: 40px;
  padding-top: 40px;
  border-top: 1px solid #e0e0e0;
}

.contact-info p {
  margin-bottom: 10px;
  font-size: 18px;
}

/* Footer */
footer {
  background: #f5f5f5;
  padding: 40px 20px;
  text-align: center;
}

footer p {
  margin-bottom: 10px;
}

.powered-by {
  font-size: 14px;
  color: #666;
}

.powered-by a {
  color: ${site.theme_color};
  text-decoration: none;
}

/* Responsive */
@media (max-width: 768px) {
  .hero h2 {
    font-size: 32px;
  }
  
  .tagline {
    font-size: 18px;
  }
  
  section h2 {
    font-size: 28px;
  }
}
`;
    },
    /**
     * Utility: Adjust color brightness
     */
    adjustBrightness(hex, percent) {
        const num = parseInt(hex.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255))
            .toString(16).slice(1);
    },
    /**
     * Delete site
     */
    async deleteSite(siteId) {
        await db.execute('DELETE FROM generated_sites WHERE id = ?', [siteId]);
        // Clean up generated files
        const outputDir = `/var/tmp/generated_sites/${siteId}`;
        try {
            await fs.rm(outputDir, { recursive: true, force: true });
        }
        catch (error) {
            console.warn('Could not delete generated files:', error);
        }
    },
    /**
     * Get decrypted FTP credentials (use only during deployment)
     */
    getDecryptedFTPCredentials(site) {
        if (!site.ftp_server || !site.ftp_username || !site.ftp_password) {
            return null;
        }
        // Decrypt password in memory only
        const decryptedPassword = decryptPassword(site.ftp_password);
        if (!decryptedPassword)
            return null;
        return {
            server: site.ftp_server,
            username: site.ftp_username,
            password: decryptedPassword,
            port: site.ftp_port,
            protocol: site.ftp_protocol,
            directory: site.ftp_directory
        };
    }
};
