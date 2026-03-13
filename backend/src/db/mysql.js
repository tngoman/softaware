import mysql from 'mysql2/promise';
import crypto from 'crypto';
import { env } from '../config/env.js';
// Parse DATABASE_URL to extract connection details
function parseConnectionString(url) {
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
    timezone: '+00:00', // toMySQLDate stores UTC — read back as UTC too
});
// Database helper functions
export const db = {
    /**
     * Execute a query and return results
     */
    async query(sql, params) {
        const [rows] = await pool.query(sql, params);
        return rows;
    },
    /**
     * Execute a query and return first result or null
     */
    async queryOne(sql, params) {
        const rows = await this.query(sql, params);
        return rows[0] || null;
    },
    /**
     * Execute an insert and return insertId
     */
    async insert(sql, params) {
        const [result] = await pool.query(sql, params);
        return String(result.insertId);
    },
    /**
     * Build and execute an INSERT statement from table name and data object
     * Usage: insertOne('users', { name: 'John', email: 'john@example.com' })
     */
    async insertOne(table, data) {
        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = columns.map(() => '?').join(', ');
        const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
        return this.insert(sql, values);
    },
    /**
     * Execute an update/delete and return affected rows
     */
    async execute(sql, params) {
        const [result] = await pool.query(sql, params);
        return result.affectedRows;
    },
    /**
     * Run queries in a transaction
     */
    async transaction(callback) {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            const result = await callback(conn);
            await conn.commit();
            return result;
        }
        catch (error) {
            await conn.rollback();
            throw error;
        }
        finally {
            conn.release();
        }
    },
    /**
     * Check database connection
     */
    async ping() {
        try {
            await pool.execute('SELECT 1');
            return true;
        }
        catch {
            return false;
        }
    },
    /**
     * Close all connections
     */
    async close() {
        await pool.end();
    },
};
// Generate UUID (MySQL doesn't have built-in UUID generation in older versions)
export function generateId() {
    return crypto.randomUUID();
}
// Helper to convert JS Date to MySQL datetime string
export function toMySQLDate(date) {
    return date.toISOString().slice(0, 19).replace('T', ' ');
}
// Helper to parse MySQL datetime to JS Date
export function fromMySQLDate(date) {
    if (date instanceof Date)
        return date;
    return new Date(date);
}
// Export for backward compatibility
export default db;
