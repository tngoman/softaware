/**
 * /credentials — Service credential / API key management routes
 * Frontend CredentialModel expects: CRUD + deactivate/rotate/test + filtering
 */
import { Router, Response } from 'express';
import { db } from '../db/mysql.js';
import { requireAuth, AuthRequest, getAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { badRequest, notFound } from '../utils/httpErrors.js';
import { encryptPassword, decryptPassword } from '../utils/cryptoUtils.js';
import { invalidateCache } from '../services/credentialVault.js';

export const credentialsRouter = Router();

// All credential-management routes require admin
credentialsRouter.use(requireAuth, requireAdmin);

/**
 * GET /credentials — List all credentials (values are masked unless decrypt=true)
 */
credentialsRouter.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const decrypt = req.query.decrypt === 'true';
    const type = req.query.type as string | undefined;
    const environment = req.query.environment as string | undefined;

    let query = 'SELECT * FROM credentials WHERE 1=1';
    const params: any[] = [];

    if (type) { query += ' AND credential_type = ?'; params.push(type); }
    if (environment) { query += ' AND environment = ?'; params.push(environment); }

    query += ' ORDER BY service_name';

    const creds = await db.query<any>(query, params);

    // Mask credential_value and additional_data unless decrypting
    const result = creds.map((c: any) => {
      if (!decrypt) {
        return {
          ...c,
          credential_value: c.credential_value ? '••••••••' : null,
          additional_data: c.additional_data ? '(encrypted)' : null,
        };
      }
      // Decrypt values for the caller
      let val = c.credential_value;
      try { val = decryptPassword(c.credential_value) ?? val; } catch { /* plaintext */ }
      let addData = c.additional_data;
      if (addData) {
        try {
          const obj = typeof addData === 'string' ? JSON.parse(addData) : addData;
          for (const k of Object.keys(obj)) {
            try { obj[k] = decryptPassword(obj[k]) ?? obj[k]; } catch { /* plaintext */ }
          }
          addData = obj;
        } catch { /* leave as-is */ }
      }
      return { ...c, credential_value: val, additional_data: addData };
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /credentials/search — Search credentials by query string
 */
credentialsRouter.get('/search', async (req: AuthRequest, res: Response, next) => {
  try {
    const q = (req.query.q as string || '').trim();
    if (!q) throw badRequest('q query parameter is required');

    const creds = await db.query<any>(
      `SELECT * FROM credentials
        WHERE (service_name LIKE ? OR identifier LIKE ? OR notes LIKE ?)
          AND is_active = 1
        ORDER BY service_name`,
      [`%${q}%`, `%${q}%`, `%${q}%`],
    );

    const result = creds.map((c: any) => ({
      ...c,
      credential_value: c.credential_value ? '••••••••' : null,
      additional_data: c.additional_data ? '(encrypted)' : null,
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /credentials/service/:serviceName — Get credential by service name
 */
credentialsRouter.get('/service/:serviceName', async (req: AuthRequest, res: Response, next) => {
  try {
    const { serviceName } = req.params;
    const decrypt = req.query.decrypt === 'true';
    const environment = req.query.environment as string | undefined;

    let query = 'SELECT * FROM credentials WHERE service_name = ? AND is_active = 1';
    const params: any[] = [serviceName];
    if (environment) { query += ' AND environment = ?'; params.push(environment); }
    query += ' ORDER BY id DESC LIMIT 1';

    const cred = await db.queryOne<any>(query, params);
    if (!cred) throw notFound(`Credential for service "${serviceName}" not found`);

    if (!decrypt) {
      cred.credential_value = cred.credential_value ? '••••••••' : null;
      cred.additional_data = cred.additional_data ? '(encrypted)' : null;
    } else {
      try { cred.credential_value = decryptPassword(cred.credential_value) ?? cred.credential_value; } catch { /* plaintext */ }
      if (cred.additional_data) {
        try {
          const obj = typeof cred.additional_data === 'string' ? JSON.parse(cred.additional_data) : cred.additional_data;
          for (const k of Object.keys(obj)) {
            try { obj[k] = decryptPassword(obj[k]) ?? obj[k]; } catch { /* plaintext */ }
          }
          cred.additional_data = obj;
        } catch { /* leave as-is */ }
      }
    }

    res.json({ success: true, data: cred });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /credentials/expired — Get expired credentials
 */
credentialsRouter.get('/expired', async (_req: AuthRequest, res: Response, next) => {
  try {
    const creds = await db.query<any>(
      'SELECT * FROM credentials WHERE expires_at IS NOT NULL AND expires_at < NOW() AND is_active = 1 ORDER BY expires_at'
    );
    res.json({ success: true, data: creds });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /credentials/expiring — Get credentials expiring within 30 days
 */
credentialsRouter.get('/expiring', async (_req: AuthRequest, res: Response, next) => {
  try {
    const creds = await db.query<any>(
      'SELECT * FROM credentials WHERE expires_at IS NOT NULL AND expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 30 DAY) AND is_active = 1 ORDER BY expires_at'
    );
    res.json({ success: true, data: creds });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /credentials/:id — Get single credential
 */
credentialsRouter.get('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const decrypt = req.query.decrypt === 'true';

    const cred = await db.queryOne<any>('SELECT * FROM credentials WHERE id = ?', [id]);
    if (!cred) throw notFound('Credential not found');

    if (!decrypt) {
      cred.credential_value = cred.credential_value ? '••••••••' : null;
      cred.additional_data = cred.additional_data ? '(encrypted)' : null;
    } else {
      // Decrypt values for the caller
      try { cred.credential_value = decryptPassword(cred.credential_value) ?? cred.credential_value; } catch { /* plaintext */ }
      if (cred.additional_data) {
        try {
          const obj = typeof cred.additional_data === 'string' ? JSON.parse(cred.additional_data) : cred.additional_data;
          for (const k of Object.keys(obj)) {
            try { obj[k] = decryptPassword(obj[k]) ?? obj[k]; } catch { /* plaintext */ }
          }
          cred.additional_data = obj;
        } catch { /* leave as-is */ }
      }
    }

    // Update last_used_at
    await db.execute('UPDATE credentials SET last_used_at = NOW() WHERE id = ?', [id]);

    res.json({ success: true, data: cred });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /credentials — Create credential
 */
credentialsRouter.post('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const { service_name, credential_type, identifier, credential_value, additional_data, environment, expires_at, notes } = req.body;

    if (!service_name || !credential_value) throw badRequest('service_name and credential_value are required');

    // Encrypt the secret value before storage
    const encryptedValue = encryptPassword(credential_value) || credential_value;
    // Encrypt each field inside additional_data
    let encryptedAdditional: string | null = null;
    if (additional_data && typeof additional_data === 'object') {
      const encrypted: Record<string, string> = {};
      for (const [k, v] of Object.entries(additional_data)) {
        encrypted[k] = typeof v === 'string' ? (encryptPassword(v) || v) : String(v);
      }
      encryptedAdditional = JSON.stringify(encrypted);
    }

    const id = await db.insertOne('credentials', {
      service_name,
      credential_type: credential_type || 'api_key',
      identifier: identifier || null,
      credential_value: encryptedValue,
      additional_data: encryptedAdditional,
      environment: environment || 'production',
      expires_at: expires_at || null,
      is_active: 1,
      notes: notes || null,
      created_by: userId,
    });

    const cred = await db.queryOne<any>('SELECT * FROM credentials WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: cred });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /credentials/:id — Update credential
 */
credentialsRouter.put('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { userId } = getAuth(req);

    const cred = await db.queryOne<any>('SELECT * FROM credentials WHERE id = ?', [id]);
    if (!cred) throw notFound('Credential not found');

    const { service_name, credential_type, identifier, credential_value, additional_data, environment, expires_at, notes, is_active } = req.body;

    const updates: string[] = [];
    const params: any[] = [];

    if (service_name) { updates.push('service_name = ?'); params.push(service_name); }
    if (credential_type) { updates.push('credential_type = ?'); params.push(credential_type); }
    if (identifier !== undefined) { updates.push('identifier = ?'); params.push(identifier); }
    if (credential_value) {
      updates.push('credential_value = ?');
      params.push(encryptPassword(credential_value) || credential_value);
    }
    if (additional_data !== undefined) {
      if (additional_data && typeof additional_data === 'object') {
        const encrypted: Record<string, string> = {};
        for (const [k, v] of Object.entries(additional_data as Record<string, unknown>)) {
          encrypted[k] = typeof v === 'string' ? (encryptPassword(v) || v) : String(v);
        }
        updates.push('additional_data = ?');
        params.push(JSON.stringify(encrypted));
      } else {
        updates.push('additional_data = ?');
        params.push(null);
      }
    }
    if (environment) { updates.push('environment = ?'); params.push(environment); }
    if (expires_at !== undefined) { updates.push('expires_at = ?'); params.push(expires_at || null); }
    if (notes !== undefined) { updates.push('notes = ?'); params.push(notes || null); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active); }
    updates.push('updated_by = ?'); params.push(userId);
    params.push(id);

    await db.execute(`UPDATE credentials SET ${updates.join(', ')} WHERE id = ?`, params);

    // Invalidate credential vault cache for this service
    invalidateCache(cred.service_name);

    const updated = await db.queryOne<any>('SELECT * FROM credentials WHERE id = ?', [id]);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /credentials/:id — Delete credential
 */
credentialsRouter.delete('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const cred = await db.queryOne<any>('SELECT * FROM credentials WHERE id = ?', [id]);
    if (!cred) throw notFound('Credential not found');

    await db.execute('DELETE FROM credentials WHERE id = ?', [id]);
    invalidateCache(cred.service_name);
    res.json({ success: true, message: 'Credential deleted' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /credentials/:id/deactivate — Deactivate credential
 */
credentialsRouter.post('/:id/deactivate', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const cred = await db.queryOne<any>('SELECT * FROM credentials WHERE id = ?', [id]);
    if (!cred) throw notFound('Credential not found');

    await db.execute('UPDATE credentials SET is_active = 0 WHERE id = ?', [id]);
    invalidateCache(cred.service_name);
    res.json({ success: true, message: 'Credential deactivated' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /credentials/:id/rotate — Rotate credential (mark old as inactive, prompt for new)
 */
credentialsRouter.post('/:id/rotate', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { new_value } = req.body;

    const cred = await db.queryOne<any>('SELECT * FROM credentials WHERE id = ?', [id]);
    if (!cred) throw notFound('Credential not found');

    if (new_value) {
      const encryptedNew = encryptPassword(new_value) || new_value;
      await db.execute(
        'UPDATE credentials SET credential_value = ?, updated_by = ? WHERE id = ?',
        [encryptedNew, (req as AuthRequest).userId, id]
      );
      invalidateCache(cred.service_name);
      res.json({ success: true, message: 'Credential rotated' });
    } else {
      res.json({ success: true, message: 'Provide new_value to complete rotation', data: { id: cred.id, service_name: cred.service_name } });
    }
  } catch (err) {
    next(err);
  }
});

/**
 * POST /credentials/:id/test — Test if credential is valid (basic check)
 */
credentialsRouter.post('/:id/test', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const cred = await db.queryOne<any>('SELECT * FROM credentials WHERE id = ?', [id]);
    if (!cred) throw notFound('Credential not found');

    // Basic validity check
    const isExpired = cred.expires_at && new Date(cred.expires_at) < new Date();
    const isActive = cred.is_active === 1;
    const hasValue = !!cred.credential_value;

    res.json({
      success: true,
      data: {
        valid: isActive && hasValue && !isExpired,
        is_active: isActive,
        is_expired: !!isExpired,
        has_value: hasValue,
      },
    });
  } catch (err) {
    next(err);
  }
});
