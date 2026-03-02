/**
 * /credentials — Service credential / API key management routes
 * Frontend CredentialModel expects: CRUD + deactivate/rotate/test + filtering
 */
import { Router, Response } from 'express';
import { db } from '../db/mysql.js';
import { requireAuth, AuthRequest, getAuth } from '../middleware/auth.js';
import { badRequest, notFound } from '../utils/httpErrors.js';

export const credentialsRouter = Router();

/**
 * GET /credentials — List all credentials (values are masked unless decrypt=true)
 */
credentialsRouter.get('/', requireAuth, async (req: AuthRequest, res: Response, next) => {
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
      return c;
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /credentials/expired — Get expired credentials
 */
credentialsRouter.get('/expired', requireAuth, async (_req: AuthRequest, res: Response, next) => {
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
credentialsRouter.get('/expiring', requireAuth, async (_req: AuthRequest, res: Response, next) => {
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
credentialsRouter.get('/:id', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const decrypt = req.query.decrypt === 'true';

    const cred = await db.queryOne<any>('SELECT * FROM credentials WHERE id = ?', [id]);
    if (!cred) throw notFound('Credential not found');

    if (!decrypt) {
      cred.credential_value = cred.credential_value ? '••••••••' : null;
      cred.additional_data = cred.additional_data ? '(encrypted)' : null;
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
credentialsRouter.post('/', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const { service_name, credential_type, identifier, credential_value, additional_data, environment, expires_at, notes } = req.body;

    if (!service_name || !credential_value) throw badRequest('service_name and credential_value are required');

    const id = await db.insertOne('credentials', {
      service_name,
      credential_type: credential_type || 'api_key',
      identifier: identifier || null,
      credential_value,
      additional_data: additional_data ? JSON.stringify(additional_data) : null,
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
credentialsRouter.put('/:id', requireAuth, async (req: AuthRequest, res: Response, next) => {
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
    if (credential_value) { updates.push('credential_value = ?'); params.push(credential_value); }
    if (additional_data !== undefined) { updates.push('additional_data = ?'); params.push(additional_data ? JSON.stringify(additional_data) : null); }
    if (environment) { updates.push('environment = ?'); params.push(environment); }
    if (expires_at !== undefined) { updates.push('expires_at = ?'); params.push(expires_at); }
    if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active); }
    updates.push('updated_by = ?'); params.push(userId);
    params.push(id);

    await db.execute(`UPDATE credentials SET ${updates.join(', ')} WHERE id = ?`, params);

    const updated = await db.queryOne<any>('SELECT * FROM credentials WHERE id = ?', [id]);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /credentials/:id — Delete credential
 */
credentialsRouter.delete('/:id', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const cred = await db.queryOne<any>('SELECT * FROM credentials WHERE id = ?', [id]);
    if (!cred) throw notFound('Credential not found');

    await db.execute('DELETE FROM credentials WHERE id = ?', [id]);
    res.json({ success: true, message: 'Credential deleted' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /credentials/:id/deactivate — Deactivate credential
 */
credentialsRouter.post('/:id/deactivate', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const cred = await db.queryOne<any>('SELECT * FROM credentials WHERE id = ?', [id]);
    if (!cred) throw notFound('Credential not found');

    await db.execute('UPDATE credentials SET is_active = 0 WHERE id = ?', [id]);
    res.json({ success: true, message: 'Credential deactivated' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /credentials/:id/rotate — Rotate credential (mark old as inactive, prompt for new)
 */
credentialsRouter.post('/:id/rotate', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { new_value } = req.body;

    const cred = await db.queryOne<any>('SELECT * FROM credentials WHERE id = ?', [id]);
    if (!cred) throw notFound('Credential not found');

    if (new_value) {
      await db.execute(
        'UPDATE credentials SET credential_value = ?, updated_by = ? WHERE id = ?',
        [new_value, (req as AuthRequest).userId, id]
      );
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
credentialsRouter.post('/:id/test', requireAuth, async (req: AuthRequest, res: Response, next) => {
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
