/**
 * Webmail Service — IMAP/SMTP operations
 *
 * Provides real-time email access via IMAP and sending via SMTP.
 * No emails are stored locally — all operations go directly to the mail server.
 *
 * Uses:
 *   - imapflow for IMAP operations
 *   - nodemailer for SMTP sending
 *   - AES-256-GCM encryption for stored credentials
 */

import { ImapFlow, type FetchMessageObject } from 'imapflow';
import nodemailer from 'nodemailer';
import { simpleParser, type ParsedMail } from 'mailparser';
import { db } from '../db/mysql.js';
import { encryptPassword, decryptPassword } from '../utils/cryptoUtils.js';

// ─── Types ───────────────────────────────────────────────────────────────

export interface MailboxAccount {
  id: number;
  user_id: number;
  display_name: string;
  email_address: string;
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
  imap_username: string;
  imap_password: string;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_username: string;
  smtp_password: string;
  is_default: boolean;
  is_active: boolean;
  last_connected_at: string | null;
  connection_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface MailFolder {
  path: string;
  name: string;
  delimiter: string;
  flags: string[];
  specialUse: string;
  totalMessages: number;
  unseenMessages: number;
}

export interface MailMessageHeader {
  uid: number;
  messageId: string;
  subject: string;
  from: { name: string; address: string };
  to: { name: string; address: string }[];
  date: string;
  flags: string[];
  size: number;
  preview: string;
}

export interface MailMessage extends MailMessageHeader {
  cc: { name: string; address: string }[];
  bcc: { name: string; address: string }[];
  html: string;
  text: string;
  attachments: MailAttachment[];
}

export interface MailAttachment {
  filename: string;
  contentType: string;
  size: number;
  partId: string;
  contentId?: string;
}

export interface SendMailInput {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  html: string;
  text?: string;
  inReplyTo?: string;
  references?: string;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
}

// ─── Ensure table exists ─────────────────────────────────────────────────

export async function ensureWebmailTable(): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS user_mailboxes (
      id INT NOT NULL AUTO_INCREMENT,
      user_id VARCHAR(100) NOT NULL,
      display_name VARCHAR(255) NOT NULL,
      email_address VARCHAR(255) NOT NULL,
      imap_host VARCHAR(255) NOT NULL,
      imap_port INT NOT NULL DEFAULT 993,
      imap_secure TINYINT(1) NOT NULL DEFAULT 1,
      imap_username VARCHAR(255) NOT NULL,
      imap_password TEXT NOT NULL,
      smtp_host VARCHAR(255) NOT NULL,
      smtp_port INT NOT NULL DEFAULT 587,
      smtp_secure TINYINT(1) NOT NULL DEFAULT 1,
      smtp_username VARCHAR(255) NOT NULL,
      smtp_password TEXT NOT NULL,
      is_default TINYINT(1) NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      last_connected_at DATETIME DEFAULT NULL,
      connection_error TEXT DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_user_mailboxes_user (user_id),
      INDEX idx_user_mailboxes_email (email_address),
      UNIQUE KEY idx_user_mailbox_unique (user_id, email_address)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

// ─── Domain Mail Server Settings ─────────────────────────────────────────

export interface WebmailDomainSettings {
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
}

const WEBMAIL_SETTING_KEYS = [
  'webmail_imap_host', 'webmail_imap_port', 'webmail_imap_secure',
  'webmail_smtp_host', 'webmail_smtp_port', 'webmail_smtp_secure',
];

export async function getWebmailSettings(): Promise<WebmailDomainSettings> {
  const placeholders = WEBMAIL_SETTING_KEYS.map(() => '?').join(',');
  const rows = await db.query<any>(
    `SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN (${placeholders})`,
    WEBMAIL_SETTING_KEYS
  );

  const map: Record<string, string> = {};
  for (const row of rows as any[]) {
    map[row.setting_key] = row.setting_value ?? '';
  }

  return {
    imap_host: map['webmail_imap_host'] || '',
    imap_port: parseInt(map['webmail_imap_port'] || '993', 10),
    imap_secure: map['webmail_imap_secure'] !== '0' && map['webmail_imap_secure'] !== 'false',
    smtp_host: map['webmail_smtp_host'] || '',
    smtp_port: parseInt(map['webmail_smtp_port'] || '587', 10),
    smtp_secure: map['webmail_smtp_secure'] !== '0' && map['webmail_smtp_secure'] !== 'false',
  };
}

export async function saveWebmailSettings(settings: WebmailDomainSettings): Promise<void> {
  const pairs: [string, string][] = [
    ['webmail_imap_host', settings.imap_host],
    ['webmail_imap_port', String(settings.imap_port)],
    ['webmail_imap_secure', settings.imap_secure ? '1' : '0'],
    ['webmail_smtp_host', settings.smtp_host],
    ['webmail_smtp_port', String(settings.smtp_port)],
    ['webmail_smtp_secure', settings.smtp_secure ? '1' : '0'],
  ];

  for (const [key, value] of pairs) {
    await db.execute(
      `INSERT INTO app_settings (setting_key, setting_value, data_type, description)
       VALUES (?, ?, 'string', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [key, value, `Webmail ${key.replace('webmail_', '').replace(/_/g, ' ')}`]
    );
  }
}

// ─── Account CRUD ────────────────────────────────────────────────────────

export async function listMailboxes(userId: string): Promise<Omit<MailboxAccount, 'imap_password' | 'smtp_password'>[]> {
  const rows = await db.query(
    `SELECT id, user_id, display_name, email_address,
            imap_host, imap_port, imap_secure, imap_username,
            smtp_host, smtp_port, smtp_secure, smtp_username,
            is_default, is_active, last_connected_at, connection_error,
            created_at, updated_at
     FROM user_mailboxes WHERE user_id = ? ORDER BY is_default DESC, display_name`,
    [userId]
  );
  return rows as any[];
}

export async function getMailbox(id: number, userId: string): Promise<MailboxAccount | null> {
  const rows = await db.query(
    'SELECT * FROM user_mailboxes WHERE id = ? AND user_id = ?',
    [id, userId]
  );
  const row = (rows as any[])[0];
  if (!row) return null;

  // Decrypt passwords
  return {
    ...row,
    imap_password: decryptPassword(row.imap_password) || '',
    smtp_password: decryptPassword(row.smtp_password) || '',
  };
}

export async function createMailbox(
  userId: string,
  data: {
    display_name: string;
    email_address: string;
    password: string;
    is_default?: boolean;
  }
): Promise<{ id: number; email_address: string }> {
  // Pull server settings from domain config
  const serverCfg = await getWebmailSettings();
  if (!serverCfg.imap_host || !serverCfg.smtp_host) {
    throw new Error('Mail server settings have not been configured. Please contact your administrator.');
  }

  // If setting as default, clear other defaults first
  if (data.is_default) {
    await db.execute('UPDATE user_mailboxes SET is_default = 0 WHERE user_id = ?', [userId]);
  }

  // Username is the email address, password is shared for IMAP & SMTP
  const encPwd = encryptPassword(data.password);

  const result = await db.execute(
    `INSERT INTO user_mailboxes
       (user_id, display_name, email_address,
        imap_host, imap_port, imap_secure, imap_username, imap_password,
        smtp_host, smtp_port, smtp_secure, smtp_username, smtp_password,
        is_default)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId, data.display_name, data.email_address,
      serverCfg.imap_host, serverCfg.imap_port, serverCfg.imap_secure ? 1 : 0,
      data.email_address, encPwd,
      serverCfg.smtp_host, serverCfg.smtp_port, serverCfg.smtp_secure ? 1 : 0,
      data.email_address, encPwd,
      data.is_default ? 1 : 0,
    ]
  );

  return { id: (result as any).insertId, email_address: data.email_address };
}

export async function updateMailbox(
  id: number,
  userId: string,
  data: Partial<{
    display_name: string;
    email_address: string;
    password: string;
    is_default: boolean;
    is_active: boolean;
  }>
): Promise<void> {
  const sets: string[] = [];
  const vals: any[] = [];

  // If setting as default, clear others first
  if (data.is_default) {
    await db.execute('UPDATE user_mailboxes SET is_default = 0 WHERE user_id = ?', [userId]);
  }

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;

    if (key === 'password') {
      // Password is shared for both IMAP and SMTP, username is email
      const encPwd = encryptPassword(value as string);
      sets.push('imap_password = ?', 'smtp_password = ?');
      vals.push(encPwd, encPwd);
    } else if (key === 'email_address') {
      // Email also updates the usernames
      sets.push('email_address = ?', 'imap_username = ?', 'smtp_username = ?');
      vals.push(value, value, value);
    } else if (key === 'is_default' || key === 'is_active') {
      sets.push(`${key} = ?`);
      vals.push(value ? 1 : 0);
    } else if (key === 'display_name') {
      sets.push(`${key} = ?`);
      vals.push(value);
    }
  }

  if (sets.length === 0) return;

  vals.push(id, userId);
  await db.execute(
    `UPDATE user_mailboxes SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`,
    vals
  );
}

export async function deleteMailbox(id: number, userId: string): Promise<boolean> {
  const result = await db.execute(
    'DELETE FROM user_mailboxes WHERE id = ? AND user_id = ?',
    [id, userId]
  );
  return (result as any).affectedRows > 0;
}

export async function setDefaultMailbox(id: number, userId: string): Promise<void> {
  await db.execute('UPDATE user_mailboxes SET is_default = 0 WHERE user_id = ?', [userId]);
  await db.execute('UPDATE user_mailboxes SET is_default = 1 WHERE id = ? AND user_id = ?', [id, userId]);
}

// ─── IMAP Helpers ────────────────────────────────────────────────────────

function createImapClient(account: MailboxAccount): ImapFlow {
  return new ImapFlow({
    host: account.imap_host,
    port: account.imap_port,
    secure: account.imap_secure,
    auth: {
      user: account.imap_username,
      pass: account.imap_password,
    },
    logger: false,
    emitLogs: false,
  });
}

// ─── Test Connection ─────────────────────────────────────────────────────

export async function testConnection(account: MailboxAccount): Promise<{
  imap: { connected: boolean; message: string };
  smtp: { connected: boolean; message: string };
}> {
  const result = {
    imap: { connected: false, message: '' },
    smtp: { connected: false, message: '' },
  };

  // Test IMAP
  try {
    const client = createImapClient(account);
    await client.connect();
    result.imap = { connected: true, message: 'IMAP connection successful' };
    await client.logout();
  } catch (err: any) {
    result.imap = { connected: false, message: err.message || 'IMAP connection failed' };
  }

  // Test SMTP
  try {
    const transport = nodemailer.createTransport({
      host: account.smtp_host,
      port: account.smtp_port,
      secure: account.smtp_secure,
      auth: {
        user: account.smtp_username,
        pass: account.smtp_password,
      },
    });
    await transport.verify();
    result.smtp = { connected: true, message: 'SMTP connection successful' };
    transport.close();
  } catch (err: any) {
    result.smtp = { connected: false, message: err.message || 'SMTP connection failed' };
  }

  // Update connection status in DB
  const allGood = result.imap.connected && result.smtp.connected;
  const errorMsg = [
    !result.imap.connected ? `IMAP: ${result.imap.message}` : '',
    !result.smtp.connected ? `SMTP: ${result.smtp.message}` : '',
  ].filter(Boolean).join('; ');

  await db.execute(
    `UPDATE user_mailboxes 
     SET last_connected_at = IF(?, NOW(), last_connected_at),
         connection_error = ?
     WHERE id = ?`,
    [allGood ? 1 : 0, errorMsg || null, account.id]
  );

  return result;
}

// ─── List Folders ────────────────────────────────────────────────────────

export async function listFolders(account: MailboxAccount): Promise<MailFolder[]> {
  const client = createImapClient(account);
  await client.connect();

  try {
    const tree = await client.listTree();
    const folders: MailFolder[] = [];

    const walk = async (items: any[]) => {
      for (const item of items) {
        // Get status (message count) for each folder
        let totalMessages = 0;
        let unseenMessages = 0;
        try {
          const status = await client.status(item.path, { messages: true, unseen: true });
          totalMessages = status.messages || 0;
          unseenMessages = status.unseen || 0;
        } catch {
          // Some folders may not support STATUS
        }

        folders.push({
          path: item.path,
          name: item.name,
          delimiter: item.delimiter || '/',
          flags: item.flags || [],
          specialUse: item.specialUse || '',
          totalMessages,
          unseenMessages,
        });

        if (item.folders && item.folders.length > 0) {
          await walk(item.folders);
        }
      }
    };

    if (tree.folders) {
      await walk(tree.folders);
    }

    // Update last connected timestamp
    await db.execute(
      'UPDATE user_mailboxes SET last_connected_at = NOW(), connection_error = NULL WHERE id = ?',
      [account.id]
    );

    return folders;
  } finally {
    await client.logout();
  }
}

// ─── List Messages ───────────────────────────────────────────────────────

export async function listMessages(
  account: MailboxAccount,
  folder: string,
  page: number = 1,
  limit: number = 50,
  search?: string
): Promise<{ messages: MailMessageHeader[]; total: number; page: number; pages: number }> {
  const client = createImapClient(account);
  await client.connect();

  try {
    const lock = await client.getMailboxLock(folder);

    try {
      const status = await client.status(folder, { messages: true });
      const total = status.messages || 0;
      const pages = Math.ceil(total / limit);

      if (total === 0) {
        return { messages: [], total: 0, page: 1, pages: 0 };
      }

      // Calculate range (IMAP sequences are 1-based, newest last)
      const end = Math.max(1, total - (page - 1) * limit);
      const start = Math.max(1, end - limit + 1);

      let searchQuery: any = { seq: `${start}:${end}` };
      if (search) {
        searchQuery = {
          seq: `${start}:${end}`,
          or: [
            { subject: search },
            { from: search },
          ],
        };
      }

      const messages: MailMessageHeader[] = [];

      for await (const msg of client.fetch(searchQuery, {
        uid: true,
        envelope: true,
        flags: true,
        size: true,
        bodyStructure: true,
        headers: ['message-id'],
      })) {
        const envelope = msg.envelope;
        messages.push({
          uid: msg.uid,
          messageId: envelope?.messageId || '',
          subject: envelope?.subject || '(No Subject)',
          from: envelope?.from?.[0]
            ? { name: envelope.from[0].name || '', address: envelope.from[0].address || '' }
            : { name: '', address: '' },
          to: (envelope?.to || []).map((a: any) => ({
            name: a.name || '',
            address: a.address || '',
          })),
          date: envelope?.date?.toISOString() || new Date().toISOString(),
          flags: Array.from(msg.flags || []),
          size: msg.size || 0,
          preview: '',
        });
      }

      // Reverse so newest is first
      messages.reverse();

      return { messages, total, page, pages };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

// ─── Get Full Message ────────────────────────────────────────────────────

export async function getMessage(
  account: MailboxAccount,
  folder: string,
  uid: number
): Promise<MailMessage | null> {
  const client = createImapClient(account);
  await client.connect();

  try {
    const lock = await client.getMailboxLock(folder);

    try {
      // Mark as seen
      await client.messageFlagsAdd({ uid }, ['\\Seen'], { uid: true });

      // Download full message
      const download = await client.download(String(uid), undefined, { uid: true });
      if (!download) return null;

      const parsed: ParsedMail = await simpleParser(download.content);

      const attachments: MailAttachment[] = (parsed.attachments || []).map((att, idx) => ({
        filename: att.filename || `attachment-${idx}`,
        contentType: att.contentType || 'application/octet-stream',
        size: att.size || 0,
        partId: String(idx + 1),
        contentId: att.contentId || undefined,
      }));

      return {
        uid,
        messageId: parsed.messageId || '',
        subject: parsed.subject || '(No Subject)',
        from: parsed.from?.value?.[0]
          ? { name: parsed.from.value[0].name || '', address: parsed.from.value[0].address || '' }
          : { name: '', address: '' },
        to: (parsed.to ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to]) : [])
          .flatMap((t: any) => t.value || [])
          .map((a: any) => ({ name: a.name || '', address: a.address || '' })),
        cc: (parsed.cc ? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc]) : [])
          .flatMap((t: any) => t.value || [])
          .map((a: any) => ({ name: a.name || '', address: a.address || '' })),
        bcc: [],
        date: parsed.date?.toISOString() || new Date().toISOString(),
        flags: ['\\Seen'],
        size: 0,
        preview: (parsed.text || '').substring(0, 200),
        html: parsed.html || parsed.textAsHtml || '',
        text: parsed.text || '',
        attachments,
      };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

// ─── Download Attachment ─────────────────────────────────────────────────

export async function getAttachment(
  account: MailboxAccount,
  folder: string,
  uid: number,
  partId: string
): Promise<{ filename: string; contentType: string; content: Buffer } | null> {
  const client = createImapClient(account);
  await client.connect();

  try {
    const lock = await client.getMailboxLock(folder);

    try {
      const download = await client.download(String(uid), undefined, { uid: true });
      if (!download) return null;

      const parsed = await simpleParser(download.content);
      const partIndex = parseInt(partId, 10) - 1;
      const att = parsed.attachments?.[partIndex];

      if (!att) return null;

      return {
        filename: att.filename || `attachment-${partId}`,
        contentType: att.contentType || 'application/octet-stream',
        content: att.content,
      };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

// ─── Delete / Trash Message ──────────────────────────────────────────────

export async function deleteMessage(
  account: MailboxAccount,
  folder: string,
  uid: number
): Promise<void> {
  const client = createImapClient(account);
  await client.connect();

  try {
    const lock = await client.getMailboxLock(folder);

    try {
      // Try to move to Trash first
      try {
        await client.messageMove({ uid }, 'Trash', { uid: true });
      } catch {
        // If Trash doesn't exist, just mark as deleted
        await client.messageFlagsAdd({ uid }, ['\\Deleted'], { uid: true });
        await client.messageDelete({ uid }, { uid: true });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

// ─── Move Message ────────────────────────────────────────────────────────

export async function moveMessage(
  account: MailboxAccount,
  folder: string,
  uid: number,
  destination: string
): Promise<void> {
  const client = createImapClient(account);
  await client.connect();

  try {
    const lock = await client.getMailboxLock(folder);

    try {
      await client.messageMove({ uid }, destination, { uid: true });
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

// ─── Flag Message ────────────────────────────────────────────────────────

export async function flagMessage(
  account: MailboxAccount,
  folder: string,
  uid: number,
  flags: { seen?: boolean; flagged?: boolean; answered?: boolean }
): Promise<void> {
  const client = createImapClient(account);
  await client.connect();

  try {
    const lock = await client.getMailboxLock(folder);

    try {
      if (flags.seen !== undefined) {
        if (flags.seen) {
          await client.messageFlagsAdd({ uid }, ['\\Seen'], { uid: true });
        } else {
          await client.messageFlagsRemove({ uid }, ['\\Seen'], { uid: true });
        }
      }
      if (flags.flagged !== undefined) {
        if (flags.flagged) {
          await client.messageFlagsAdd({ uid }, ['\\Flagged'], { uid: true });
        } else {
          await client.messageFlagsRemove({ uid }, ['\\Flagged'], { uid: true });
        }
      }
      if (flags.answered !== undefined) {
        if (flags.answered) {
          await client.messageFlagsAdd({ uid }, ['\\Answered'], { uid: true });
        } else {
          await client.messageFlagsRemove({ uid }, ['\\Answered'], { uid: true });
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

// ─── Send Email ──────────────────────────────────────────────────────────

export async function sendMail(
  account: MailboxAccount,
  input: SendMailInput
): Promise<{ messageId: string }> {
  const transport = nodemailer.createTransport({
    host: account.smtp_host,
    port: account.smtp_port,
    secure: account.smtp_secure,
    auth: {
      user: account.smtp_username,
      pass: account.smtp_password,
    },
  });

  // Build the mail options once — used for both sending and Sent folder append
  const mailOptions: any = {
    from: `"${account.display_name}" <${account.email_address}>`,
    to: input.to,
    cc: input.cc || undefined,
    bcc: input.bcc || undefined,
    subject: input.subject,
    html: input.html,
    text: input.text || undefined,
    inReplyTo: input.inReplyTo || undefined,
    references: input.references || undefined,
    attachments: input.attachments?.map(a => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  };

  const info = await transport.sendMail(mailOptions);
  transport.close();

  // Try to append the full message (with attachments) to Sent folder via IMAP
  try {
    // Use nodemailer's MailComposer to build the complete RFC822 message
    const MailComposer = (await import('nodemailer/lib/mail-composer')).default;
    const composer = new MailComposer({
      ...mailOptions,
      messageId: info.messageId,
      date: new Date(),
    });
    const rawMessage: Buffer = await new Promise((resolve, reject) => {
      composer.compile().build((err: Error | null, message: Buffer) => {
        if (err) reject(err);
        else resolve(message);
      });
    });

    const client = createImapClient(account);
    await client.connect();
    try {
      // Detect the actual Sent folder path (could be 'Sent', 'INBOX.Sent', etc.)
      let sentPath = 'Sent';
      try {
        const tree = await client.listTree();
        const findSent = (items: any[]): string | null => {
          for (const item of items) {
            if (item.specialUse === '\\Sent') return item.path;
            if (item.folders) {
              const found = findSent(item.folders);
              if (found) return found;
            }
          }
          return null;
        };
        const detected = tree.folders ? findSent(tree.folders) : null;
        if (detected) sentPath = detected;
      } catch {
        // Fall back to 'Sent'
      }

      await client.append(sentPath, rawMessage, ['\\Seen']);
    } finally {
      await client.logout();
    }
  } catch (e) {
    // Silently ignore — the email was sent successfully even if IMAP append fails
    console.warn('[Webmail] Failed to append sent message to IMAP Sent folder:', e);
  }

  return { messageId: info.messageId || '' };
}
