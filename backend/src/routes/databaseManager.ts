import { Router, Request, Response } from 'express';
import mysql from 'mysql2/promise';
import { Client as SSHClient } from 'ssh2';
import net from 'net';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { requireDeveloper } from '../middleware/requireDeveloper.js';
import { db } from '../db/mysql.js';

const router = Router();

// ── All database routes require authenticated developer/admin ──
router.use(requireAuth, requireDeveloper);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEYS_DIR = path.resolve(__dirname, '..', '..', 'keys');

/* ═══════════════════════════════════════════════════════════════
   Database Manager Routes — admin-only, execute SQL queries
   against MySQL / MSSQL via SSH tunnel.

   All connections go through an SSH tunnel:
     Client → Backend → SSH Tunnel → DB Server
   ═══════════════════════════════════════════════════════════════ */

// ── Types ───────────────────────────────────────────────────
interface TunnelConfig {
  sshHost: string;
  sshPort: number;
  sshUser: string;
  sshPassword?: string;
  sshKeyFile?: string;     // filename within /keys/
}

interface ConnectionBody {
  host: string;
  port: number;
  user: string;
  password: string;
  database?: string;
  type: 'mysql' | 'mssql';
  tunnel?: TunnelConfig;
  table?: string;
  sql?: string;
  page?: number;
  pageSize?: number;
  // Enhanced browse options
  sortColumn?: string;
  sortDirection?: 'ASC' | 'DESC';
  filters?: { column: string; operator: string; value: string }[];
  // Row operations
  row?: Record<string, any>;
  where?: Record<string, any>;
  primaryKeys?: string[];
}

// ── SSH Tunnel ──────────────────────────────────────────────
interface TunnelHandle {
  localPort: number;
  server: net.Server;
  sshClient: SSHClient;
}

function createTunnel(tunnel: TunnelConfig, dbHost: string, dbPort: number): Promise<TunnelHandle> {
  return new Promise((resolve, reject) => {
    const sshClient = new SSHClient();
    const timeout = setTimeout(() => {
      sshClient.end();
      reject(new Error('SSH tunnel connection timed out (15 s)'));
    }, 15_000);

    let privateKey: Buffer | undefined;
    if (tunnel.sshKeyFile) {
      const keyPath = path.join(KEYS_DIR, path.basename(tunnel.sshKeyFile));
      if (!fs.existsSync(keyPath)) {
        clearTimeout(timeout);
        return reject(new Error(`SSH key file not found: ${tunnel.sshKeyFile}`));
      }
      privateKey = fs.readFileSync(keyPath);
    }

    sshClient.on('ready', () => {
      const server = net.createServer((sock) => {
        sshClient.forwardOut('127.0.0.1', 0, dbHost, dbPort, (err, stream) => {
          if (err) { sock.end(); return; }
          sock.pipe(stream).pipe(sock);
        });
      });
      server.listen(0, '127.0.0.1', () => {
        clearTimeout(timeout);
        const addr = server.address() as net.AddressInfo;
        resolve({ localPort: addr.port, server, sshClient });
      });
      server.on('error', (err) => { clearTimeout(timeout); sshClient.end(); reject(err); });
    });

    sshClient.on('error', (err) => { clearTimeout(timeout); reject(new Error(`SSH: ${err.message}`)); });

    const opts: any = {
      host: tunnel.sshHost,
      port: tunnel.sshPort || 22,
      username: tunnel.sshUser,
      readyTimeout: 15000,
    };
    if (privateKey) opts.privateKey = privateKey;
    else if (tunnel.sshPassword) opts.password = tunnel.sshPassword;
    else { clearTimeout(timeout); return reject(new Error('SSH auth requires a key file or password')); }

    sshClient.connect(opts);
  });
}

function closeTunnel(h: TunnelHandle) {
  try { h.server.close(); } catch {}
  try { h.sshClient.end(); } catch {}
}

// ── Helpers: withMySQL / withMSSQL ──────────────────────────
async function withMySQL<T>(body: ConnectionBody, fn: (conn: mysql.Connection) => Promise<T>): Promise<T> {
  let tunnel: TunnelHandle | undefined;
  let host = body.host || '127.0.0.1';
  let port = body.port || 3306;

  if (body.tunnel?.sshHost) {
    tunnel = await createTunnel(body.tunnel, host, port);
    host = '127.0.0.1';
    port = tunnel.localPort;
  }
  let conn: mysql.Connection | undefined;
  try {
    conn = await mysql.createConnection({
      host, port,
      user: body.user || 'root',
      password: body.password || '',
      database: body.database || undefined,
      connectTimeout: 10000,
      multipleStatements: true,
    });
    return await fn(conn);
  } finally {
    if (conn) await conn.end().catch(() => {});
    if (tunnel) closeTunnel(tunnel);
  }
}

async function withMSSQL<T>(body: ConnectionBody, fn: (pool: any) => Promise<T>): Promise<T> {
  let tunnel: TunnelHandle | undefined;
  let host = body.host || '127.0.0.1';
  let port = body.port || 1433;

  if (body.tunnel?.sshHost) {
    tunnel = await createTunnel(body.tunnel, host, port);
    host = '127.0.0.1';
    port = tunnel.localPort;
  }
  let pool: any;
  try {
    const mssql = await import('mssql');
    pool = await new mssql.default.ConnectionPool({
      server: host, port,
      user: body.user || 'sa',
      password: body.password || '',
      database: body.database || undefined,
      options: { encrypt: false, trustServerCertificate: true, connectTimeout: 10000 },
    }).connect();
    return await fn(pool);
  } catch (err: any) {
    if (err.code === 'MODULE_NOT_FOUND' || err.code === 'ERR_MODULE_NOT_FOUND')
      throw new Error('MSSQL driver not installed. Run: npm install mssql');
    throw err;
  } finally {
    if (pool) await pool.close().catch(() => {});
    if (tunnel) closeTunnel(tunnel);
  }
}

// ═══════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════

// ── Shared Connections CRUD ─────────────────────────────────

/** GET /connections — list all saved connections (shared across all users) */
router.get('/connections', async (_req: Request, res: Response) => {
  try {
    const rows = await db.query(
      'SELECT * FROM db_connections ORDER BY name ASC'
    );
    const connections = rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      host: r.host,
      port: r.port,
      user: r.user,
      password: r.password,
      database: r.database,
      type: r.type,
      tunnel: {
        sshHost: r.ssh_host || '',
        sshPort: r.ssh_port || 22,
        sshUser: r.ssh_user || '',
        sshPassword: r.ssh_password || undefined,
        sshKeyFile: r.ssh_key_file || undefined,
      },
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
    res.json({ success: true, connections });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** POST /connections — create or update a connection */
router.post('/connections', async (req: Request, res: Response) => {
  try {
    const { id, name, host, port, user, password, database: dbName, type, tunnel } = req.body;
    if (!name || !host || !type) {
      return res.status(400).json({ success: false, error: 'name, host, and type are required' });
    }
    const userId = (req as AuthRequest).userId || null;
    const connId = id || crypto.randomUUID();
    const t = tunnel || {};

    await db.query(
      `INSERT INTO db_connections (id, name, host, port, user, password, \`database\`, type, ssh_host, ssh_port, ssh_user, ssh_password, ssh_key_file, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name), host = VALUES(host), port = VALUES(port),
         user = VALUES(user), password = VALUES(password), \`database\` = VALUES(\`database\`),
         type = VALUES(type), ssh_host = VALUES(ssh_host), ssh_port = VALUES(ssh_port),
         ssh_user = VALUES(ssh_user), ssh_password = VALUES(ssh_password),
         ssh_key_file = VALUES(ssh_key_file)`,
      [
        connId, name, host, port || 3306, user || '', password || '',
        dbName || '', type, t.sshHost || '', t.sshPort || 22,
        t.sshUser || '', t.sshPassword || null, t.sshKeyFile || null, userId,
      ]
    );
    res.json({ success: true, id: connId });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** DELETE /connections/:id — remove a connection */
router.delete('/connections/:id', async (req: Request, res: Response) => {
  try {
    await db.query('DELETE FROM db_connections WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /keys — available SSH key files ─────────────────────
router.get('/keys', (_req: Request, res: Response) => {
  try {
    if (!fs.existsSync(KEYS_DIR)) return res.json({ success: true, keys: [] });
    const keys = fs.readdirSync(KEYS_DIR)
      .filter(f => !f.endsWith('.pub') && !f.startsWith('.'))
      .map(f => ({
        name: f,
        hasPublicKey: fs.existsSync(path.join(KEYS_DIR, f + '.pub')),
        size: fs.statSync(path.join(KEYS_DIR, f)).size,
      }));
    res.json({ success: true, keys });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /connect — test connection ─────────────────────────
router.post('/connect', async (req: Request, res: Response) => {
  try {
    const body = req.body as ConnectionBody;
    if (body.type === 'mssql') {
      await withMSSQL(body, async (pool) => { await pool.request().query('SELECT 1 AS ok'); });
    } else {
      await withMySQL(body, async (conn) => { await conn.ping(); });
    }
    res.json({ success: true, message: 'Connected successfully' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Connection failed' });
  }
});

// ── POST /databases — list databases ────────────────────────
router.post('/databases', async (req: Request, res: Response) => {
  try {
    const body = req.body as ConnectionBody;
    if (body.type === 'mssql') {
      await withMSSQL(body, async (pool) => {
        const r = await pool.request().query(`SELECT name FROM sys.databases WHERE state_desc='ONLINE' ORDER BY name`);
        res.json({ success: true, databases: r.recordset.map((x: any) => x.name) });
      });
    } else {
      await withMySQL(body, async (conn) => {
        const [rows] = await conn.query('SHOW DATABASES');
        res.json({ success: true, databases: (rows as any[]).map((r: any) => r.Database) });
      });
    }
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── POST /tables — list tables/views ────────────────────────
router.post('/tables', async (req: Request, res: Response) => {
  try {
    const body = req.body as ConnectionBody;
    const db = body.database;
    if (!db) return res.status(400).json({ success: false, error: 'Database name required' });
    if (body.type === 'mssql') {
      await withMSSQL(body, async (pool) => {
        const r = await pool.request().query(`
          SELECT TABLE_NAME AS name, TABLE_TYPE AS type
          FROM INFORMATION_SCHEMA.TABLES
          WHERE TABLE_CATALOG='${db.replace(/'/g, "''")}'
          ORDER BY TABLE_NAME`);
        res.json({ success: true, tables: r.recordset });
      });
    } else {
      await withMySQL(body, async (conn) => {
        const [rows] = await conn.query(
          `SELECT TABLE_NAME AS name, TABLE_TYPE AS type, TABLE_ROWS AS \`rows\`, ENGINE AS engine
           FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME`, [db]);
        res.json({ success: true, tables: rows });
      });
    }
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── POST /describe — table columns ──────────────────────────
router.post('/describe', async (req: Request, res: Response) => {
  try {
    const body = req.body as ConnectionBody;
    const table = body.table;
    if (!table) return res.status(400).json({ success: false, error: 'Table name required' });
    if (body.type === 'mssql') {
      await withMSSQL(body, async (pool) => {
        const r = await pool.request().query(`
          SELECT c.COLUMN_NAME AS Field,
                 c.DATA_TYPE + CASE WHEN c.CHARACTER_MAXIMUM_LENGTH IS NOT NULL
                   THEN '(' + CAST(c.CHARACTER_MAXIMUM_LENGTH AS VARCHAR) + ')' ELSE '' END AS Type,
                 c.IS_NULLABLE AS [Null],
                 CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 'PRI' ELSE '' END AS [Key],
                 c.COLUMN_DEFAULT AS [Default]
          FROM INFORMATION_SCHEMA.COLUMNS c
          LEFT JOIN (
            SELECT ku.COLUMN_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
            JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku ON tc.CONSTRAINT_NAME=ku.CONSTRAINT_NAME
            WHERE tc.TABLE_NAME='${table.replace(/'/g, "''")}' AND tc.CONSTRAINT_TYPE='PRIMARY KEY'
          ) pk ON c.COLUMN_NAME=pk.COLUMN_NAME
          WHERE c.TABLE_NAME='${table.replace(/'/g, "''")}'
          ORDER BY c.ORDINAL_POSITION`);
        res.json({ success: true, columns: r.recordset });
      });
    } else {
      await withMySQL(body, async (conn) => {
        const [rows] = await conn.query(`DESCRIBE \`${table.replace(/`/g, '')}\``);
        res.json({ success: true, columns: rows });
      });
    }
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── POST /indexes — table indexes ───────────────────────────
router.post('/indexes', async (req: Request, res: Response) => {
  try {
    const body = req.body as ConnectionBody;
    const table = body.table;
    if (!table) return res.status(400).json({ success: false, error: 'Table name required' });
    if (body.type === 'mssql') {
      await withMSSQL(body, async (pool) => {
        const r = await pool.request().query(`
          SELECT i.name AS index_name, i.type_desc AS index_type, i.is_unique,
                 STRING_AGG(c.name,', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS columns
          FROM sys.indexes i
          JOIN sys.index_columns ic ON i.object_id=ic.object_id AND i.index_id=ic.index_id
          JOIN sys.columns c ON ic.object_id=c.object_id AND ic.column_id=c.column_id
          WHERE OBJECT_NAME(i.object_id)='${table.replace(/'/g, "''")}'
          GROUP BY i.name, i.type_desc, i.is_unique ORDER BY i.name`);
        res.json({ success: true, indexes: r.recordset });
      });
    } else {
      await withMySQL(body, async (conn) => {
        const [rows] = await conn.query(`SHOW INDEX FROM \`${table.replace(/`/g, '')}\``);
        res.json({ success: true, indexes: rows });
      });
    }
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── POST /table-data — paginated browse with sort/filter ────
router.post('/table-data', async (req: Request, res: Response) => {
  try {
    const body = req.body as ConnectionBody;
    const table = body.table;
    const page = body.page || 1;
    const pageSize = Math.min(body.pageSize || 100, 1000);
    const offset = (page - 1) * pageSize;
    const sortCol = body.sortColumn;
    const sortDir = body.sortDirection === 'DESC' ? 'DESC' : 'ASC';
    const filters = body.filters || [];
    if (!table) return res.status(400).json({ success: false, error: 'Table name required' });

    if (body.type === 'mssql') {
      await withMSSQL(body, async (pool) => {
        const safe = table.replace(/'/g, "''").replace(/\[|\]/g, '');
        let where = '';
        if (filters.length > 0) {
          const clauses = filters.map(f => {
            const col = `[${f.column.replace(/\]/g, ']]')}]`;
            const op = f.operator || 'LIKE';
            if (op === 'IS NULL') return `${col} IS NULL`;
            if (op === 'IS NOT NULL') return `${col} IS NOT NULL`;
            if (op === 'LIKE') return `CAST(${col} AS NVARCHAR(MAX)) LIKE '%${f.value.replace(/'/g, "''")}%'`;
            return `${col} ${op} '${f.value.replace(/'/g, "''")}'`;
          });
          where = ' WHERE ' + clauses.join(' AND ');
        }
        const orderBy = sortCol ? `ORDER BY [${sortCol.replace(/\]/g, ']]')}] ${sortDir}` : 'ORDER BY (SELECT NULL)';
        const cnt = await pool.request().query(`SELECT COUNT(*) AS total FROM [${safe}]${where}`);
        const r = await pool.request().query(
          `SELECT * FROM [${safe}]${where} ${orderBy} OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY`);
        const columns = r.recordset.length > 0 ? Object.keys(r.recordset[0]) : [];
        res.json({ success: true, columns, rows: r.recordset, total: cnt.recordset[0].total, page, pageSize });
      });
    } else {
      await withMySQL(body, async (conn) => {
        const safe = table.replace(/`/g, '');
        let where = '';
        const whereParams: any[] = [];
        if (filters.length > 0) {
          const clauses = filters.map(f => {
            const col = `\`${f.column.replace(/`/g, '')}\``;
            const op = f.operator || 'LIKE';
            if (op === 'IS NULL') return `${col} IS NULL`;
            if (op === 'IS NOT NULL') return `${col} IS NOT NULL`;
            if (op === 'LIKE') { whereParams.push(`%${f.value}%`); return `${col} LIKE ?`; }
            if (op === 'REGEXP') { whereParams.push(f.value); return `${col} REGEXP ?`; }
            whereParams.push(f.value);
            return `${col} ${op} ?`;
          });
          where = ' WHERE ' + clauses.join(' AND ');
        }
        const orderBy = sortCol ? ` ORDER BY \`${sortCol.replace(/`/g, '')}\` ${sortDir}` : '';
        const [cnt] = await conn.query(`SELECT COUNT(*) AS total FROM \`${safe}\`${where}`, whereParams);
        const total = (cnt as any[])[0]?.total || 0;
        const [rows, fields] = await conn.query(`SELECT * FROM \`${safe}\`${where}${orderBy} LIMIT ? OFFSET ?`, [...whereParams, pageSize, offset]);
        const columns = fields && Array.isArray(fields) ? fields.map((f: any) => f.name) : (Array.isArray(rows) && rows.length > 0 ? Object.keys((rows as any[])[0]) : []);
        res.json({ success: true, columns, rows, total, page, pageSize });
      });
    }
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── POST /row-insert — insert a new row ─────────────────────
router.post('/row-insert', async (req: Request, res: Response) => {
  try {
    const body = req.body as ConnectionBody;
    const { table, row } = body;
    if (!table || !row) return res.status(400).json({ success: false, error: 'Table and row data required' });

    if (body.type === 'mssql') {
      await withMSSQL(body, async (pool) => {
        const cols = Object.keys(row);
        const colList = cols.map(c => `[${c.replace(/\]/g, ']]')}]`).join(', ');
        const valList = cols.map((_, i) => `@p${i}`).join(', ');
        const request = pool.request();
        cols.forEach((c, i) => request.input(`p${i}`, row[c] === '' ? null : row[c]));
        await request.query(`INSERT INTO [${table.replace(/\]/g, ']]')}] (${colList}) VALUES (${valList})`);
        res.json({ success: true, message: 'Row inserted' });
      });
    } else {
      await withMySQL(body, async (conn) => {
        const cols = Object.keys(row);
        const colList = cols.map(c => `\`${c.replace(/`/g, '')}\``).join(', ');
        const placeholders = cols.map(() => '?').join(', ');
        const values = cols.map(c => row[c] === '' ? null : row[c]);
        await conn.execute(`INSERT INTO \`${table.replace(/`/g, '')}\` (${colList}) VALUES (${placeholders})`, values);
        res.json({ success: true, message: 'Row inserted' });
      });
    }
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── POST /row-update — update a row by primary key ──────────
router.post('/row-update', async (req: Request, res: Response) => {
  try {
    const body = req.body as ConnectionBody;
    const { table, row, where: whereObj } = body;
    if (!table || !row || !whereObj) return res.status(400).json({ success: false, error: 'Table, row data, and where clause required' });

    if (body.type === 'mssql') {
      await withMSSQL(body, async (pool) => {
        const setCols = Object.keys(row);
        const whereCols = Object.keys(whereObj);
        const request = pool.request();
        const setClause = setCols.map((c, i) => { request.input(`s${i}`, row[c] === '' ? null : row[c]); return `[${c.replace(/\]/g, ']]')}]=@s${i}`; }).join(', ');
        const whereClause = whereCols.map((c, i) => {
          if (whereObj[c] === null) return `[${c.replace(/\]/g, ']]')}] IS NULL`;
          request.input(`w${i}`, whereObj[c]);
          return `[${c.replace(/\]/g, ']]')}]=@w${i}`;
        }).join(' AND ');
        await request.query(`UPDATE [${table.replace(/\]/g, ']]')}] SET ${setClause} WHERE ${whereClause}`);
        res.json({ success: true, message: 'Row updated' });
      });
    } else {
      await withMySQL(body, async (conn) => {
        const setCols = Object.keys(row);
        const whereCols = Object.keys(whereObj);
        const setClause = setCols.map(c => `\`${c.replace(/`/g, '')}\`=?`).join(', ');
        const whereClause = whereCols.map(c => {
          if (whereObj[c] === null) return `\`${c.replace(/`/g, '')}\` IS NULL`;
          return `\`${c.replace(/`/g, '')}\`=?`;
        }).join(' AND ');
        const params = [...setCols.map(c => row[c] === '' ? null : row[c]), ...whereCols.filter(c => whereObj[c] !== null).map(c => whereObj[c])];
        await conn.execute(`UPDATE \`${table.replace(/`/g, '')}\` SET ${setClause} WHERE ${whereClause} LIMIT 1`, params);
        res.json({ success: true, message: 'Row updated' });
      });
    }
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── POST /row-delete — delete a row by primary key ──────────
router.post('/row-delete', async (req: Request, res: Response) => {
  try {
    const body = req.body as ConnectionBody;
    const { table, where: whereObj } = body;
    if (!table || !whereObj) return res.status(400).json({ success: false, error: 'Table and where clause required' });

    if (body.type === 'mssql') {
      await withMSSQL(body, async (pool) => {
        const whereCols = Object.keys(whereObj);
        const request = pool.request();
        const whereClause = whereCols.map((c, i) => {
          if (whereObj[c] === null) return `[${c.replace(/\]/g, ']]')}] IS NULL`;
          request.input(`w${i}`, whereObj[c]);
          return `[${c.replace(/\]/g, ']]')}]=@w${i}`;
        }).join(' AND ');
        await request.query(`DELETE TOP(1) FROM [${table.replace(/\]/g, ']]')}] WHERE ${whereClause}`);
        res.json({ success: true, message: 'Row deleted' });
      });
    } else {
      await withMySQL(body, async (conn) => {
        const whereCols = Object.keys(whereObj);
        const whereClause = whereCols.map(c => {
          if (whereObj[c] === null) return `\`${c.replace(/`/g, '')}\` IS NULL`;
          return `\`${c.replace(/`/g, '')}\`=?`;
        }).join(' AND ');
        const params = whereCols.filter(c => whereObj[c] !== null).map(c => whereObj[c]);
        await conn.execute(`DELETE FROM \`${table.replace(/`/g, '')}\` WHERE ${whereClause} LIMIT 1`, params);
        res.json({ success: true, message: 'Row deleted' });
      });
    }
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── POST /import-sql — execute a SQL file/dump ──────────────
router.post('/import-sql', async (req: Request, res: Response) => {
  try {
    const body = req.body as ConnectionBody;
    const { sql } = body;
    if (!sql) return res.status(400).json({ success: false, error: 'SQL content required' });

    // Split by semicolons, filter empties, execute sequentially
    const statements = sql.split(/;\s*\n/).map((s: string) => s.trim()).filter((s: string) => s.length > 0 && !s.startsWith('--'));
    let executed = 0;
    let errors: string[] = [];

    if (body.type === 'mssql') {
      await withMSSQL(body, async (pool) => {
        for (const stmt of statements) {
          try { await pool.request().query(stmt); executed++; }
          catch (e: any) { errors.push(`${e.message} — ${stmt.substring(0, 80)}…`); }
        }
      });
    } else {
      await withMySQL(body, async (conn) => {
        for (const stmt of statements) {
          try { await conn.query(stmt); executed++; }
          catch (e: any) { errors.push(`${e.message} — ${stmt.substring(0, 80)}…`); }
        }
      });
    }
    res.json({ success: true, message: `${executed} statement(s) executed`, executed, errors: errors.slice(0, 20), totalStatements: statements.length });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── POST /truncate — truncate a table ───────────────────────
router.post('/truncate', async (req: Request, res: Response) => {
  try {
    const body = req.body as ConnectionBody;
    const { table } = body;
    if (!table) return res.status(400).json({ success: false, error: 'Table name required' });

    if (body.type === 'mssql') {
      await withMSSQL(body, async (pool) => {
        await pool.request().query(`TRUNCATE TABLE [${table.replace(/\]/g, ']]')}]`);
        res.json({ success: true, message: `Table ${table} truncated` });
      });
    } else {
      await withMySQL(body, async (conn) => {
        await conn.query(`TRUNCATE TABLE \`${table.replace(/`/g, '')}\``);
        res.json({ success: true, message: `Table ${table} truncated` });
      });
    }
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── POST /drop-table — drop a table ────────────────────────
router.post('/drop-table', async (req: Request, res: Response) => {
  try {
    const body = req.body as ConnectionBody;
    const { table } = body;
    if (!table) return res.status(400).json({ success: false, error: 'Table name required' });

    if (body.type === 'mssql') {
      await withMSSQL(body, async (pool) => {
        await pool.request().query(`DROP TABLE [${table.replace(/\]/g, ']]')}]`);
        res.json({ success: true, message: `Table ${table} dropped` });
      });
    } else {
      await withMySQL(body, async (conn) => {
        await conn.query(`DROP TABLE \`${table.replace(/`/g, '')}\``);
        res.json({ success: true, message: `Table ${table} dropped` });
      });
    }
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── POST /table-size — size info ────────────────────────────
router.post('/table-size', async (req: Request, res: Response) => {
  try {
    const body = req.body as ConnectionBody;
    const table = body.table;
    if (!table) return res.status(400).json({ success: false, error: 'Table name required' });
    if (body.type === 'mssql') {
      await withMSSQL(body, async (pool) => {
        const r = await pool.request().query(`
          SELECT SUM(a.total_pages)*8 AS total_kb, SUM(a.used_pages)*8 AS used_kb,
                 MAX(p.rows) AS row_count
          FROM sys.partitions p
          JOIN sys.allocation_units a ON p.partition_id=a.container_id
          WHERE OBJECT_NAME(p.object_id)='${table.replace(/'/g, "''")}'`);
        res.json({ success: true, size: r.recordset[0] || {} });
      });
    } else {
      await withMySQL(body, async (conn) => {
        const [rows] = await conn.query(
          `SELECT TABLE_ROWS AS row_count,
                  ROUND(DATA_LENGTH/1024,2) AS data_kb,
                  ROUND(INDEX_LENGTH/1024,2) AS index_kb,
                  ROUND((DATA_LENGTH+INDEX_LENGTH)/1024,2) AS total_kb,
                  ENGINE AS engine, TABLE_COLLATION AS collation, CREATE_TIME, UPDATE_TIME
           FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=?`,
          [body.database, table]);
        res.json({ success: true, size: (rows as any[])[0] || {} });
      });
    }
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── POST /table-create-sql — DDL ────────────────────────────
router.post('/table-create-sql', async (req: Request, res: Response) => {
  try {
    const body = req.body as ConnectionBody;
    const table = body.table;
    if (!table) return res.status(400).json({ success: false, error: 'Table name required' });
    if (body.type === 'mssql') {
      return res.json({ success: true, sql: '-- CREATE TABLE DDL not supported for MSSQL in this version' });
    }
    await withMySQL(body, async (conn) => {
      const [rows] = await conn.query(`SHOW CREATE TABLE \`${table.replace(/`/g, '')}\``);
      res.json({ success: true, sql: (rows as any[])[0]?.['Create Table'] || '' });
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── POST /processes — running processes ─────────────────────
router.post('/processes', async (req: Request, res: Response) => {
  try {
    const body = req.body as ConnectionBody;
    if (body.type === 'mssql') {
      await withMSSQL(body, async (pool) => {
        const r = await pool.request().query(`
          SELECT session_id AS Id, status AS Status, command AS Command,
                 DB_NAME(database_id) AS [db], wait_type AS State, total_elapsed_time AS Time
          FROM sys.dm_exec_requests WHERE session_id > 50`);
        res.json({ success: true, processes: r.recordset });
      });
    } else {
      await withMySQL(body, async (conn) => {
        const [rows] = await conn.query('SHOW FULL PROCESSLIST');
        res.json({ success: true, processes: rows });
      });
    }
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── POST /status — server status ────────────────────────────
router.post('/status', async (req: Request, res: Response) => {
  try {
    const body = req.body as ConnectionBody;
    if (body.type === 'mssql') {
      await withMSSQL(body, async (pool) => {
        const r = await pool.request().query(`
          SELECT @@SERVERNAME AS server_name, @@VERSION AS version, DB_NAME() AS current_db,
                 (SELECT COUNT(*) FROM sys.dm_exec_sessions WHERE is_user_process=1) AS user_connections`);
        res.json({ success: true, status: r.recordset[0] || {} });
      });
    } else {
      await withMySQL(body, async (conn) => {
        const [v] = await conn.query('SELECT VERSION() AS version');
        const [s] = await conn.query('SHOW GLOBAL STATUS WHERE Variable_name IN ("Uptime","Threads_connected","Questions","Slow_queries","Open_tables","Bytes_received","Bytes_sent")');
        const status: Record<string, string> = {};
        (s as any[]).forEach((r: any) => { status[r.Variable_name] = r.Value; });
        res.json({ success: true, status: { version: (v as any[])[0]?.version, ...status } });
      });
    }
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── POST /query — execute arbitrary SQL ─────────────────────
router.post('/query', async (req: Request, res: Response) => {
  try {
    const body = req.body as ConnectionBody;
    const { sql } = body;
    if (!sql || typeof sql !== 'string')
      return res.status(400).json({ success: false, error: 'SQL query required' });

    if (body.type === 'mssql') {
      await withMSSQL(body, async (pool) => {
        const r = await pool.request().query(sql);
        if (r.recordset) {
          const columns = r.recordset.length > 0 ? Object.keys(r.recordset[0]) : [];
          res.json({ success: true, columns, rows: r.recordset, rowCount: r.recordset.length });
        } else {
          res.json({ success: true, columns: [], rows: [], affectedRows: r.rowsAffected?.[0] || 0,
            message: `${r.rowsAffected?.[0] || 0} row(s) affected` });
        }
      });
    } else {
      await withMySQL(body, async (conn) => {
        const [result, fields] = await conn.query(sql);

        // Detect multi-statement results: for single statements, fields entries
        // are FieldPacket objects (with .name). For multi-statement, fields entries
        // are either undefined (non-SELECT) or sub-arrays of FieldPackets (SELECT).
        const isMulti = Array.isArray(fields) && fields.length > 0
          && (fields[0] === undefined || Array.isArray(fields[0]));

        if (isMulti) {
          // Multiple statements — find last SELECT result set or summarise all
          const results = result as any[];
          const fieldSets = fields as any[];
          let lastSelectIdx = -1;
          for (let i = fieldSets.length - 1; i >= 0; i--) {
            if (Array.isArray(fieldSets[i]) && fieldSets[i].length > 0) { lastSelectIdx = i; break; }
          }
          if (lastSelectIdx >= 0) {
            // Return the last SELECT result set
            const rows = Array.isArray(results[lastSelectIdx]) ? results[lastSelectIdx] : [];
            const cols = fieldSets[lastSelectIdx].map((f: any) => f.name);
            res.json({ success: true, columns: cols, rows, rowCount: rows.length,
              message: `${results.length} statement(s) executed — showing last SELECT result` });
          } else {
            // All statements were non-SELECT (CREATE, INSERT, UPDATE, etc.)
            let totalAffected = 0;
            for (const r of results) {
              if (r && typeof r === 'object' && !Array.isArray(r)) totalAffected += (r.affectedRows || 0);
            }
            res.json({ success: true, columns: [], rows: [],
              affectedRows: totalAffected,
              message: `${results.length} statement(s) executed — ${totalAffected} row(s) affected` });
          }
        } else if (Array.isArray(result)) {
          const columns = fields && Array.isArray(fields)
            ? fields.map((f: any) => f.name)
            : (result.length > 0 ? Object.keys(result[0]) : []);
          res.json({ success: true, columns, rows: result, rowCount: result.length });
        } else {
          res.json({ success: true, columns: [], rows: [],
            affectedRows: (result as any).affectedRows || 0,
            insertId: (result as any).insertId,
            message: `${(result as any).affectedRows || 0} row(s) affected` });
        }
      });
    }
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── POST /export-csv — export query as CSV ──────────────────
router.post('/export-csv', async (req: Request, res: Response) => {
  try {
    const body = req.body as ConnectionBody;
    const { sql } = body;
    if (!sql) return res.status(400).json({ success: false, error: 'SQL query required' });

    const exec = async (): Promise<{ columns: string[]; rows: any[] }> => {
      if (body.type === 'mssql') {
        return withMSSQL(body, async (pool) => {
          const r = await pool.request().query(sql);
          const columns = r.recordset?.length > 0 ? Object.keys(r.recordset[0]) : [];
          return { columns, rows: r.recordset || [] };
        });
      }
      return withMySQL(body, async (conn) => {
        const [result, fields] = await conn.query(sql);
        if (!Array.isArray(result)) return { columns: [], rows: [] };
        const columns = fields && Array.isArray(fields) ? fields.map((f: any) => f.name) : (result.length > 0 ? Object.keys(result[0]) : []);
        return { columns, rows: result };
      });
    };

    const { columns, rows } = await exec();
    const esc = (v: any) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const csv = [columns.map(esc).join(','), ...rows.map((r: any) => columns.map(c => esc(r[c])).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="export.csv"');
    res.send(csv);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
