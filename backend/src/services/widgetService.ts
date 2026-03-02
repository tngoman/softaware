import { randomUUID } from 'crypto';
import { db, toMySQLDate } from '../db/mysql.js';

export interface WidgetClient {
  id: string;
  user_id: string | null;
  website_url: string;
  message_count: number;
  max_messages: number;
  max_pages: number;
  pages_ingested: number;
  widget_color: string;
  status: 'active' | 'suspended' | 'upgraded';
  created_at: string;
  last_active: string;
  updated_at: string;
}

export interface DocumentChunk {
  id: string;
  client_id: string;
  content: string;
  source_url: string | null;
  source_type: 'website' | 'pdf' | 'txt' | 'doc';
  chunk_index: number;
  char_count: number;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  client_id: string;
  session_id: string | null;
  role: 'user' | 'assistant';
  content: string;
  model: string | null;
  tokens_used: number | null;
  response_time_ms: number | null;
  created_at: string;
}

export const widgetService = {
  /**
   * Create a new widget client
   */
  async createClient(params: {
    userId?: string;
    websiteUrl: string;
    widgetColor?: string;
  }): Promise<WidgetClient> {
    const id = randomUUID();
    const now = toMySQLDate(new Date());

    await db.execute(
      `INSERT INTO widget_clients (
        id, user_id, website_url, widget_color, created_at, last_active, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        params.userId || null,
        params.websiteUrl,
        params.widgetColor || '#0044cc',
        now,
        now,
        now
      ]
    );

    return this.getClientById(id) as Promise<WidgetClient>;
  },

  /**
   * Get widget client by ID
   */
  async getClientById(clientId: string): Promise<WidgetClient | null> {
    return db.queryOne<WidgetClient>(
      'SELECT * FROM widget_clients WHERE id = ?',
      [clientId]
    );
  },

  /**
   * Get widget client by ID with subscription tier info
   * Used for tier-based routing in chat endpoint
   */
  async getClientByIdWithTier(clientId: string): Promise<any | null> {
    const [rows] = await db.execute(
      `SELECT 
        wc.*,
        gs.business_name
       FROM widget_clients wc
       LEFT JOIN generated_sites gs ON wc.id = gs.widget_client_id
       WHERE wc.id = ?
       LIMIT 1`,
      [clientId]
    ) as any;
    
    return rows && rows.length > 0 ? rows[0] : null;
  },

  /**
   * Get widget client by user ID
   */
  async getClientsByUserId(userId: string): Promise<WidgetClient[]> {
    return db.query<WidgetClient>(
      'SELECT * FROM widget_clients WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
  },

  /**
   * Update message count (increment)
   */
  async incrementMessageCount(clientId: string): Promise<void> {
    const now = toMySQLDate(new Date());
    await db.execute(
      'UPDATE widget_clients SET message_count = message_count + 1, last_active = ? WHERE id = ?',
      [now, clientId]
    );
  },

  /**
   * Check if client has reached message limit
   */
  async hasReachedLimit(clientId: string): Promise<boolean> {
    const client = await this.getClientById(clientId);
    if (!client) return true;
    return client.message_count >= client.max_messages;
  },

  /**
   * Reset message count (monthly reset or manual)
   */
  async resetMessageCount(clientId: string): Promise<void> {
    await db.execute(
      'UPDATE widget_clients SET message_count = 0 WHERE id = ?',
      [clientId]
    );
  },

  /**
   * Update client settings
   */
  async updateClient(clientId: string, updates: Partial<WidgetClient>): Promise<void> {
    const allowedFields = ['website_url', 'widget_color', 'max_messages', 'max_pages', 'status'];
    const updateFields: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (updateFields.length > 0) {
      values.push(clientId);
      await db.execute(
        `UPDATE widget_clients SET ${updateFields.join(', ')} WHERE id = ?`,
        values
      );
    }
  },

  /**
   * Get client usage stats
   */
  async getUsageStats(clientId: string): Promise<{
    messageCount: number;
    maxMessages: number;
    pagesIngested: number;
    maxPages: number;
    messagePercentage: number;
    pagesPercentage: number;
  }> {
    const client = await this.getClientById(clientId);
    if (!client) {
      throw new Error('Client not found');
    }

    return {
      messageCount: client.message_count,
      maxMessages: client.max_messages,
      pagesIngested: client.pages_ingested,
      maxPages: client.max_pages,
      messagePercentage: (client.message_count / client.max_messages) * 100,
      pagesPercentage: (client.pages_ingested / client.max_pages) * 100
    };
  },

  /**
   * Log chat message
   */
  async logChatMessage(params: {
    clientId: string;
    sessionId?: string;
    role: 'user' | 'assistant';
    content: string;
    model?: string;
    tokensUsed?: number;
    responseTimeMs?: number;
  }): Promise<ChatMessage> {
    const id = randomUUID();
    const now = toMySQLDate(new Date());

    await db.execute(
      `INSERT INTO chat_messages (
        id, client_id, session_id, role, content, model, tokens_used, response_time_ms, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        params.clientId,
        params.sessionId || null,
        params.role,
        params.content,
        params.model || null,
        params.tokensUsed || null,
        params.responseTimeMs || null,
        now
      ]
    );

    return {
      id,
      client_id: params.clientId,
      session_id: params.sessionId || null,
      role: params.role,
      content: params.content,
      model: params.model || null,
      tokens_used: params.tokensUsed || null,
      response_time_ms: params.responseTimeMs || null,
      created_at: now
    };
  },

  /**
   * Get recent chat history for a session
   */
  async getChatHistory(clientId: string, sessionId: string, limit: number = 10): Promise<ChatMessage[]> {
    return db.query<ChatMessage>(
      `SELECT * FROM chat_messages 
       WHERE client_id = ? AND session_id = ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [clientId, sessionId, limit]
    );
  },

  /**
   * Get all widget clients (admin)
   */
  async getAllClients(page: number = 1, limit: number = 50): Promise<{
    clients: WidgetClient[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const offset = (page - 1) * limit;

    const [clients, countResult] = await Promise.all([
      db.query<WidgetClient>(
        'SELECT * FROM widget_clients ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [limit, offset]
      ),
      db.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM widget_clients'
      )
    ]);

    const total = countResult?.count || 0;

    return {
      clients,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }
};
