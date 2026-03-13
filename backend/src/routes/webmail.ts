/**
 * Webmail Routes — Email client operations
 *
 * Account management:
 *   GET    /webmail/accounts          — List user's mailboxes
 *   POST   /webmail/accounts          — Add a mailbox
 *   PUT    /webmail/accounts/:id      — Update a mailbox
 *   DELETE /webmail/accounts/:id      — Remove a mailbox
 *   POST   /webmail/accounts/:id/test — Test IMAP/SMTP connection
 *   POST   /webmail/accounts/:id/default — Set default account
 *
 * Mail operations:
 *   GET    /webmail/folders            — List IMAP folders
 *   GET    /webmail/messages           — List messages in folder
 *   GET    /webmail/messages/:uid      — Get full message
 *   DELETE /webmail/messages/:uid      — Delete/trash message
 *   POST   /webmail/messages/move      — Move message to folder
 *   POST   /webmail/messages/flag      — Flag/unflag message
 *   POST   /webmail/send              — Send email via SMTP
 *   GET    /webmail/attachment         — Download attachment
 */

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, getAuth, type AuthRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { badRequest, notFound } from '../utils/httpErrors.js';
import {
  ensureWebmailTable,
  listMailboxes,
  getMailbox,
  createMailbox,
  updateMailbox,
  deleteMailbox,
  setDefaultMailbox,
  testConnection,
  listFolders,
  listMessages,
  getMessage,
  getAttachment,
  deleteMessage,
  moveMessage,
  flagMessage,
  sendMail,
  getWebmailSettings,
  saveWebmailSettings,
  getUnreadCount,
} from '../services/webmailService.js';

export const webmailRouter = Router();

// All routes require authentication
webmailRouter.use(requireAuth);

// Ensure table exists on first load
let tableReady = false;
webmailRouter.use(async (_req, _res, next) => {
  try {
    if (!tableReady) {
      await ensureWebmailTable();
      tableReady = true;
    }
    next();
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ACCOUNT MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

// ─── GET /webmail/accounts — List user's mailboxes ───────────────────────
webmailRouter.get('/accounts', async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const accounts = await listMailboxes(userId);
    res.json({ success: true, data: accounts });
  } catch (err) {
    next(err);
  }
});

// ─── Zod coercion: MySQL TINYINT comes as 0/1, coerce to boolean ─────────
const coerceBool = z.preprocess(
  (v) => (typeof v === 'number' ? v !== 0 : v),
  z.boolean().optional(),
);

// ─── POST /webmail/accounts — Add a mailbox ──────────────────────────────
const CreateAccountSchema = z.object({
  display_name: z.string().min(1).max(255),
  email_address: z.string().email().max(255),
  password: z.string().min(1),
  signature: z.string().optional(),
  is_default: coerceBool,
});

webmailRouter.post('/accounts', async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const data = CreateAccountSchema.parse(req.body) as {
      display_name: string;
      email_address: string;
      password: string;
      signature?: string;
      is_default?: boolean;
    };
    const result = await createMailbox(userId, data);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /webmail/accounts/:id — Update a mailbox ────────────────────────
const UpdateAccountSchema = z.object({
  display_name: z.string().min(1).max(255).optional(),
  email_address: z.string().email().max(255).optional(),
  password: z.string().min(1).optional(),
  signature: z.string().optional(),
  is_default: coerceBool,
  is_active: coerceBool,
});

webmailRouter.put('/accounts/:id', async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw badRequest('Invalid mailbox ID');

    const data = UpdateAccountSchema.parse(req.body);
    await updateMailbox(id, userId, data);
    res.json({ success: true, message: 'Mailbox updated' });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /webmail/accounts/:id — Remove a mailbox ─────────────────────
webmailRouter.delete('/accounts/:id', async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw badRequest('Invalid mailbox ID');

    const deleted = await deleteMailbox(id, userId);
    if (!deleted) throw notFound('Mailbox not found');
    res.json({ success: true, message: 'Mailbox removed' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /webmail/accounts/:id/test — Test connection ───────────────────
webmailRouter.post('/accounts/:id/test', async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw badRequest('Invalid mailbox ID');

    const account = await getMailbox(id, userId);
    if (!account) throw notFound('Mailbox not found');

    const result = await testConnection(account);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ─── POST /webmail/accounts/:id/default — Set default ────────────────────
webmailRouter.post('/accounts/:id/default', async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw badRequest('Invalid mailbox ID');

    await setDefaultMailbox(id, userId);
    res.json({ success: true, message: 'Default account updated' });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// MAIL OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

// Helper: resolve account from query param
async function resolveAccount(req: any): Promise<any> {
  const { userId } = getAuth(req);
  const accountId = parseInt(req.query.account_id as string, 10);
  if (isNaN(accountId)) throw badRequest('account_id query parameter required');

  const account = await getMailbox(accountId, userId);
  if (!account) throw notFound('Mailbox not found');
  if (!account.is_active) throw badRequest('Mailbox is disabled');
  return account;
}

// ─── GET /webmail/folders — List IMAP folders ────────────────────────────
webmailRouter.get('/folders', async (req, res, next) => {
  try {
    const account = await resolveAccount(req);
    const folders = await listFolders(account);
    res.json({ success: true, data: folders });
  } catch (err) {
    next(err);
  }
});

// ─── GET /webmail/messages — List messages in folder ─────────────────────
webmailRouter.get('/messages', async (req, res, next) => {
  try {
    const account = await resolveAccount(req);
    const folder = (req.query.folder as string) || 'INBOX';
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
    const search = req.query.search as string | undefined;

    const result = await listMessages(account, folder, page, limit, search);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ─── GET /webmail/messages/:uid — Get full message ───────────────────────
webmailRouter.get('/messages/:uid', async (req, res, next) => {
  try {
    const account = await resolveAccount(req);
    const folder = (req.query.folder as string) || 'INBOX';
    const uid = parseInt(req.params.uid, 10);
    if (isNaN(uid)) throw badRequest('Invalid message UID');

    const message = await getMessage(account, folder, uid);
    if (!message) throw notFound('Message not found');
    res.json({ success: true, data: message });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /webmail/messages/:uid — Delete message ──────────────────────
webmailRouter.delete('/messages/:uid', async (req, res, next) => {
  try {
    const account = await resolveAccount(req);
    const folder = (req.query.folder as string) || 'INBOX';
    const uid = parseInt(req.params.uid, 10);
    if (isNaN(uid)) throw badRequest('Invalid message UID');

    await deleteMessage(account, folder, uid);
    res.json({ success: true, message: 'Message deleted' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /webmail/messages/move — Move message ──────────────────────────
const MoveSchema = z.object({
  account_id: z.number().int(),
  folder: z.string().min(1),
  uid: z.number().int(),
  destination: z.string().min(1),
});

webmailRouter.post('/messages/move', async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const input = MoveSchema.parse(req.body);

    const account = await getMailbox(input.account_id, userId);
    if (!account) throw notFound('Mailbox not found');

    await moveMessage(account, input.folder, input.uid, input.destination);
    res.json({ success: true, message: 'Message moved' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /webmail/messages/flag — Flag message ──────────────────────────
const FlagSchema = z.object({
  account_id: z.number().int(),
  folder: z.string().min(1),
  uid: z.number().int(),
  flags: z.object({
    seen: z.boolean().optional(),
    flagged: z.boolean().optional(),
    answered: z.boolean().optional(),
  }),
});

webmailRouter.post('/messages/flag', async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const input = FlagSchema.parse(req.body);

    const account = await getMailbox(input.account_id, userId);
    if (!account) throw notFound('Mailbox not found');

    await flagMessage(account, input.folder, input.uid, input.flags);
    res.json({ success: true, message: 'Flags updated' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /webmail/send — Send email (multipart with attachments) ────────
import multer from 'multer';
const sendUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

webmailRouter.post('/send', sendUpload.array('attachments', 20), async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const body = req.body;
    const accountId = parseInt(body.account_id, 10);

    // Debug logging
    const files = (req.files as Express.Multer.File[]) || [];
    console.log('[Webmail Send Debug]', {
      accountId,
      to: body.to,
      subject: body.subject,
      htmlLength: body.html?.length || 0,
      textLength: body.text?.length || 0,
      filesCount: files.length,
      fileNames: files.map(f => f.originalname),
      fileSizes: files.map(f => f.size),
      bodyKeys: Object.keys(body),
    });

    if (isNaN(accountId)) throw badRequest('account_id is required');
    if (!body.to) throw badRequest('to is required');
    if (!body.subject) throw badRequest('subject is required');
    if (!body.html) throw badRequest('html is required');

    const account = await getMailbox(accountId, userId);
    if (!account) throw notFound('Mailbox not found');

    const attachments = files.map(f => ({
      filename: f.originalname,
      content: f.buffer,
      contentType: f.mimetype,
    }));

    const result = await sendMail(account, {
      to: body.to,
      cc: body.cc || undefined,
      bcc: body.bcc || undefined,
      subject: body.subject,
      html: body.html,
      text: body.text || undefined,
      inReplyTo: body.inReplyTo || undefined,
      references: body.references || undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    res.json({ success: true, message: 'Email sent successfully', data: result });
  } catch (err) {
    next(err);
  }
});

// ─── GET /webmail/attachment — Download attachment ────────────────────────
webmailRouter.get('/attachment', async (req, res, next) => {
  try {
    const account = await resolveAccount(req);
    const folder = (req.query.folder as string) || 'INBOX';
    const uid = parseInt(req.query.uid as string, 10);
    const partId = req.query.partId as string;

    if (isNaN(uid) || !partId) throw badRequest('uid and partId query parameters required');

    const attachment = await getAttachment(account, folder, uid, partId);
    if (!attachment) throw notFound('Attachment not found');

    res.setHeader('Content-Type', attachment.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
    res.send(attachment.content);
  } catch (err) {
    next(err);
  }
});

// ─── GET /webmail/unread-count — Unread INBOX count across all accounts ──
webmailRouter.get('/unread-count', async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const result = await getUnreadCount(userId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DOMAIN MAIL SERVER SETTINGS (Admin only)
// ═══════════════════════════════════════════════════════════════════════════

// ─── GET /webmail/settings — Get domain mail server config ───────────────
webmailRouter.get('/settings', requireAdmin, async (_req, res, next) => {
  try {
    const settings = await getWebmailSettings();
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /webmail/settings — Update domain mail server config ────────────
const WebmailSettingsSchema = z.object({
  imap_host: z.string().min(1).max(255),
  imap_port: z.number().int().min(1).max(65535),
  imap_secure: z.boolean(),
  smtp_host: z.string().min(1).max(255),
  smtp_port: z.number().int().min(1).max(65535),
  smtp_secure: z.boolean(),
});

webmailRouter.put('/settings', requireAdmin, async (req, res, next) => {
  try {
    const data = WebmailSettingsSchema.parse(req.body) as {
      imap_host: string;
      imap_port: number;
      imap_secure: boolean;
      smtp_host: string;
      smtp_port: number;
      smtp_secure: boolean;
    };
    await saveWebmailSettings(data);
    res.json({ success: true, message: 'Webmail server settings updated' });
  } catch (err) {
    next(err);
  }
});
