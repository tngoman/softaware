import mysql from 'mysql2/promise';
import crypto from 'crypto';
import { env } from '../config/env.js';

// Parse DATABASE_URL to extract connection details
function parseConnectionString(url: string) {
  // Format: mysql://user:password@host:port/database
  const match = url.match(/^mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
  if (!match) {
    throw new Error('Invalid DATABASE_URL format. Expected: mysql://user:password@host:port/database');
  }
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: parseInt(match[4], 10),
    database: match[5],
  };
}

const dbConfig = parseConnectionString(env.DATABASE_URL);

// Create connection pool
export const pool = mysql.createPool({
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  timezone: '+00:00',   // toMySQLDate stores UTC — read back as UTC too
});

// Helper type for query results
export type QueryResult<T = any> = T[];

// Database helper functions
export const db = {
  /**
   * Execute a query and return results
   */
  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const [rows] = await pool.query(sql, params);
    return rows as T[];
  },

  /**
   * Execute a query and return first result or null
   */
  async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] || null;
  },

  /**
   * Execute an insert and return insertId
   */
  async insert(sql: string, params?: any[]): Promise<string> {
    const [result] = await pool.query(sql, params);
    return String((result as any).insertId);
  },

  /**
   * Build and execute an INSERT statement from table name and data object
   * Usage: insertOne('users', { name: 'John', email: 'john@example.com' })
   */
  async insertOne(table: string, data: Record<string, any>): Promise<string> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
    return this.insert(sql, values);
  },

  /**
   * Execute an update/delete and return affected rows
   */
  async execute(sql: string, params?: any[]): Promise<number> {
    const [result] = await pool.query(sql, params);
    return (result as any).affectedRows;
  },

  /**
   * Run queries in a transaction
   */
  async transaction<T>(callback: (conn: mysql.PoolConnection) => Promise<T>): Promise<T> {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const result = await callback(conn);
      await conn.commit();
      return result;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  },

  /**
   * Check database connection
   */
  async ping(): Promise<boolean> {
    try {
      await pool.execute('SELECT 1');
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    await pool.end();
  },
};

// Generate UUID (MySQL doesn't have built-in UUID generation in older versions)
export function generateId(): string {
  return crypto.randomUUID();
}

// Helper to convert JS Date to MySQL datetime string
export function toMySQLDate(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

// Helper to parse MySQL datetime to JS Date
export function fromMySQLDate(date: string | Date): Date {
  if (date instanceof Date) return date;
  return new Date(date);
}

// Type definitions for database entities
export interface User {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  avatarUrl?: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Team {
  id: string;
  name: string;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface team_members {
  id: string;
  teamId: string;
  userId: string;
  role: 'ADMIN' | 'STAFF' | 'ARCHITECT' | 'OPERATOR' | 'AUDITOR';
  createdAt: Date;
}

export interface team_invites {
  id: string;
  teamId: string;
  email: string;
  role: 'ADMIN' | 'STAFF' | 'ARCHITECT' | 'OPERATOR' | 'AUDITOR';
  createdAt: Date;
  acceptedAt?: Date;
}

export interface Agent {
  id: string;
  teamId: string;
  name: string;
  version: string;
  region: string;
  compliance: any;
  blueprint: any;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string;
}

export interface vault_credentials {
  id: string;
  teamId: string;
  name: string;
  kind: string;
  description?: string;
  createdAt: Date;
  revokedAt?: Date;
  createdByUserId: string;
}

export interface activation_keys {
  id: string;
  code: string;
  tier: 'PERSONAL' | 'TEAM' | 'ENTERPRISE';
  isActive: boolean;
  cloudSyncAllowed: boolean;
  vaultAllowed: boolean;
  maxAgents?: number;
  maxUsers?: number;
  createdAt: Date;
  createdByUserId?: string;
}

export interface device_activations {
  id: string;
  deviceId: string;
  appVersion?: string;
  isActive: boolean;
  tier: 'PERSONAL' | 'TEAM' | 'ENTERPRISE';
  lastSeenAt: Date;
  createdAt: Date;
  userId?: string;
  activationKeyId?: string;
}

export interface client_agents {
  id: string;
  deviceId: string;
  agentId: string;
  name: string;
  version: string;
  region: string;
  compliance: any;
  blueprint: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface api_keys {
  id: string;
  name: string;
  key: string;
  userId: string;
  isActive: boolean;
  lastUsedAt?: Date;
  createdAt: Date;
  expiresAt?: Date;
}

export interface ai_model_config {
  id: string;
  teamId: string;
  defaultTextProvider: string;
  defaultTextModel: string;
  visionProvider: string;
  visionModel: string;
  codeProvider: string;
  codeModel: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface subscription_plans {
  id: string;
  tier: 'PERSONAL' | 'TEAM' | 'ENTERPRISE';
  name: string;
  description?: string;
  priceMonthly: number;
  priceAnnually?: number;
  maxUsers: number;
  maxAgents?: number;
  maxDevices: number;
  cloudSyncAllowed: boolean;
  vaultAllowed: boolean;
  prioritySupport: boolean;
  trialDays: number;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Subscription {
  id: string;
  teamId: string;
  planId: string;
  status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED';
  billingCycle: string;
  trialEndsAt?: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelledAt?: Date;
  paymentProvider?: 'PAYFAST' | 'YOCO' | 'MANUAL';
  externalCustomerId?: string;
  externalSubscriptionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Invoice {
  id: string;
  subscriptionId: string;
  invoiceNumber: string;
  description: string;
  subtotal: number;
  vatAmount: number;
  total: number;
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
  paidAt?: Date;
  pdfUrl?: string;
  createdAt: Date;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  provider: 'PAYFAST' | 'YOCO' | 'MANUAL';
  externalPaymentId?: string;
  cardLast4?: string;
  cardBrand?: string;
  failureReason?: string;
  createdAt: Date;
  completedAt?: Date;
}

// Export for backward compatibility
export default db;
