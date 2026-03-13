import api from '../services/api';

/**
 * Webmail Models
 * Handles all webmail operations:
 *   - Account management (CRUD for user mailboxes)
 *   - Mail operations (folders, messages, send, attachments)
 */

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
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_username: string;
  signature: string;
  is_default: boolean;
  is_active: boolean;
  last_connected_at: string | null;
  connection_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMailboxInput {
  display_name: string;
  email_address: string;
  password: string;
  signature?: string;
  is_default?: boolean;
}

export interface WebmailDomainSettings {
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
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

export interface MailAddress {
  name: string;
  address: string;
}

export interface MailMessageHeader {
  uid: number;
  messageId: string;
  subject: string;
  from: MailAddress;
  to: MailAddress[];
  date: string;
  flags: string[];
  size: number;
  preview: string;
}

export interface MailMessage extends MailMessageHeader {
  cc: MailAddress[];
  bcc: MailAddress[];
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

export interface ConnectionTestResult {
  imap: { connected: boolean; message: string };
  smtp: { connected: boolean; message: string };
}

export interface UnreadCountResponse {
  total: number;
  accounts: { id: number; email_address: string; unseen: number }[];
}

export interface MessageListResponse {
  messages: MailMessageHeader[];
  total: number;
  page: number;
  pages: number;
}

// ─── Account Model ───────────────────────────────────────────────────────

export class WebmailAccountModel {
  static async list(): Promise<MailboxAccount[]> {
    const res = await api.get<{ success: boolean; data: MailboxAccount[] }>('/webmail/accounts');
    return res.data.data;
  }

  static async create(data: CreateMailboxInput): Promise<{ id: number; email_address: string }> {
    const res = await api.post<{ success: boolean; data: { id: number; email_address: string } }>(
      '/webmail/accounts',
      data
    );
    return res.data.data;
  }

  static async update(id: number, data: Partial<CreateMailboxInput & { is_active: boolean }>): Promise<void> {
    await api.put(`/webmail/accounts/${id}`, data);
  }

  static async delete(id: number): Promise<void> {
    await api.delete(`/webmail/accounts/${id}`);
  }

  static async testConnection(id: number): Promise<ConnectionTestResult> {
    const res = await api.post<{ success: boolean; data: ConnectionTestResult }>(
      `/webmail/accounts/${id}/test`
    );
    return res.data.data;
  }

  static async setDefault(id: number): Promise<void> {
    await api.post(`/webmail/accounts/${id}/default`);
  }
}

// ─── Mail Operations Model ───────────────────────────────────────────────

export class WebmailModel {
  static async getFolders(accountId: number): Promise<MailFolder[]> {
    const res = await api.get<{ success: boolean; data: MailFolder[] }>(
      `/webmail/folders?account_id=${accountId}`
    );
    return res.data.data;
  }

  static async getMessages(
    accountId: number,
    folder: string,
    page: number = 1,
    limit: number = 50,
    search?: string
  ): Promise<MessageListResponse> {
    const params = new URLSearchParams({
      account_id: String(accountId),
      folder,
      page: String(page),
      limit: String(limit),
    });
    if (search) params.set('search', search);

    const res = await api.get<{ success: boolean; data: MessageListResponse }>(
      `/webmail/messages?${params.toString()}`
    );
    return res.data.data;
  }

  static async getMessage(accountId: number, folder: string, uid: number): Promise<MailMessage> {
    const res = await api.get<{ success: boolean; data: MailMessage }>(
      `/webmail/messages/${uid}?account_id=${accountId}&folder=${encodeURIComponent(folder)}`
    );
    return res.data.data;
  }

  static async deleteMessage(accountId: number, folder: string, uid: number): Promise<void> {
    await api.delete(
      `/webmail/messages/${uid}?account_id=${accountId}&folder=${encodeURIComponent(folder)}`
    );
  }

  static async moveMessage(accountId: number, folder: string, uid: number, destination: string): Promise<void> {
    await api.post('/webmail/messages/move', {
      account_id: accountId,
      folder,
      uid,
      destination,
    });
  }

  static async flagMessage(
    accountId: number,
    folder: string,
    uid: number,
    flags: { seen?: boolean; flagged?: boolean; answered?: boolean }
  ): Promise<void> {
    await api.post('/webmail/messages/flag', {
      account_id: accountId,
      folder,
      uid,
      flags,
    });
  }

  static async send(data: {
    account_id: number;
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    html: string;
    text?: string;
    inReplyTo?: string;
    references?: string;
    attachments?: File[];
  }): Promise<{ messageId: string }> {
    const formData = new FormData();
    formData.append('account_id', String(data.account_id));
    formData.append('to', data.to);
    if (data.cc) formData.append('cc', data.cc);
    if (data.bcc) formData.append('bcc', data.bcc);
    formData.append('subject', data.subject);
    formData.append('html', data.html);
    if (data.text) formData.append('text', data.text);
    if (data.inReplyTo) formData.append('inReplyTo', data.inReplyTo);
    if (data.references) formData.append('references', data.references);
    if (data.attachments) {
      data.attachments.forEach(file => formData.append('attachments', file));
    }
    const res = await api.post<{ success: boolean; data: { messageId: string } }>(
      '/webmail/send',
      formData
    );
    return res.data.data;
  }

  static getAttachmentUrl(accountId: number, folder: string, uid: number, partId: string): string {
    return `/webmail/attachment?account_id=${accountId}&folder=${encodeURIComponent(folder)}&uid=${uid}&partId=${partId}`;
  }

  static async getUnreadCount(): Promise<UnreadCountResponse> {
    const res = await api.get<{ success: boolean; data: UnreadCountResponse }>('/webmail/unread-count');
    return res.data.data;
  }
}

// ─── Domain Mail Server Settings Model ───────────────────────────────────

export class WebmailSettingsModel {
  static async get(): Promise<WebmailDomainSettings> {
    const res = await api.get<{ success: boolean; data: WebmailDomainSettings }>('/webmail/settings');
    return res.data.data;
  }

  static async save(data: WebmailDomainSettings): Promise<void> {
    await api.put('/webmail/settings', data);
  }
}
