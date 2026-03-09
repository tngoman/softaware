import { Router, Request, Response } from 'express';
import mysql from 'mysql2/promise';
import { Client as SSHClient } from 'ssh2';
import net from 'net';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = Router();
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

// ── POST /table-data — paginated browse ─────────────────────
router.post('/table-data', async (req: Request, res: Response) => {
  try {
    const body = req.body as ConnectionBody;
    const table = body.table;
    const page = body.page || 1;
    const pageSize = Math.min(body.pageSize || 100, 1000);
    const offset = (page - 1) * pageSize;
    if (!table) return res.status(400).json({ success: false, error: 'Table name required' });

    if (body.type === 'mssql') {
      await withMSSQL(body, async (pool) => {
        const safe = table.replace(/'/g, "''").replace(/\[|\]/g, '');
        const cnt = await pool.request().query(`SELECT COUNT(*) AS total FROM [${safe}]`);
        const r = await pool.request().query(
          `SELECT * FROM [${safe}] ORDER BY (SELECT NULL) OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY`);
        const columns = r.recordset.length > 0 ? Object.keys(r.recordset[0]) : [];
        res.json({ success: true, columns, rows: r.recordset, total: cnt.recordset[0].total, page, pageSize });
      });
    } else {
      await withMySQL(body, async (conn) => {
        const safe = table.replace(/`/g, '');
        const [cnt] = await conn.query(`SELECT COUNT(*) AS total FROM \`${safe}\``);
        const total = (cnt as any[])[0]?.total || 0;
        const [rows, fields] = await conn.query(`SELECT * FROM \`${safe}\` LIMIT ? OFFSET ?`, [pageSize, offset]);
        const columns = fields && Array.isArray(fields) ? fields.map((f: any) => f.name) : (Array.isArray(rows) && rows.length > 0 ? Object.keys((rows as any[])[0]) : []);
        res.json({ success: true, columns, rows, total, page, pageSize });
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
        if (Array.isArray(result)) {
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
