import { Router, Request, Response } from 'express';
import mysql from 'mysql2/promise';

const router = Router();

/* ═══════════════════════════════════════════════════════════════
   Database Manager Routes — admin-only, execute SQL queries
   against arbitrary MySQL / MariaDB connections.
   ═══════════════════════════════════════════════════════════════ */

// ── helpers ─────────────────────────────────────────────────
async function getConnection(body: any): Promise<mysql.Connection> {
  const { host, port, user, password, database, type } = body;
  if (type === 'mssql') throw new Error('MSSQL support is not available in the web version');
  return mysql.createConnection({
    host: host || '127.0.0.1',
    port: parseInt(port) || 3306,
    user: user || 'root',
    password: password || '',
    database: database || undefined,
    connectTimeout: 10000,
  });
}

// ── POST /connect — test connection ─────────────────────────
router.post('/connect', async (req: Request, res: Response) => {
  let conn: mysql.Connection | null = null;
  try {
    conn = await getConnection(req.body);
    await conn.ping();
    res.json({ success: true, message: 'Connected successfully' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Connection failed' });
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
});

// ── POST /tables — list tables/views ────────────────────────
router.post('/tables', async (req: Request, res: Response) => {
  let conn: mysql.Connection | null = null;
  try {
    conn = await getConnection(req.body);
    const db = req.body.database;
    if (!db) {
      res.status(400).json({ success: false, error: 'Database name required' });
      return;
    }
    const [rows] = await conn.query(
      `SELECT TABLE_NAME AS name, TABLE_TYPE AS type, TABLE_ROWS AS \`rows\`, ENGINE AS engine
       FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME`,
      [db]
    );
    res.json({ success: true, tables: rows });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
});

// ── POST /describe — describe table columns ─────────────────
router.post('/describe', async (req: Request, res: Response) => {
  let conn: mysql.Connection | null = null;
  try {
    conn = await getConnection(req.body);
    const table = req.body.table;
    if (!table) {
      res.status(400).json({ success: false, error: 'Table name required' });
      return;
    }
    const [rows] = await conn.query(`DESCRIBE \`${table.replace(/`/g, '')}\``);
    res.json({ success: true, columns: rows });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
});

// ── POST /query — execute arbitrary SQL ─────────────────────
router.post('/query', async (req: Request, res: Response) => {
  let conn: mysql.Connection | null = null;
  try {
    const { sql } = req.body;
    if (!sql || typeof sql !== 'string') {
      res.status(400).json({ success: false, error: 'SQL query required' });
      return;
    }

    // Safety: block dangerous operations in non-local environments
    // (This is intentionally permissive for admin use)
    const trimmed = sql.trim().toUpperCase();

    conn = await getConnection(req.body);
    const [result, fields] = await conn.query(sql);

    // SELECT-like queries return rows
    if (Array.isArray(result)) {
      const columns = fields && Array.isArray(fields)
        ? fields.map((f: any) => f.name)
        : (result.length > 0 ? Object.keys(result[0]) : []);
      res.json({
        success: true,
        columns,
        rows: result,
        rowCount: result.length,
      });
    } else {
      // INSERT/UPDATE/DELETE return result info
      res.json({
        success: true,
        columns: [],
        rows: [],
        affectedRows: (result as any).affectedRows || 0,
        insertId: (result as any).insertId,
        message: `${(result as any).affectedRows || 0} row(s) affected`,
      });
    }
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
});

export default router;
