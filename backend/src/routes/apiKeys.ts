import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { db, generateId, toMySQLDate, type api_keys } from '../db/mysql.js';
import { requireAuth } from '../middleware/auth.js';

export const apiKeysRouter = Router();

apiKeysRouter.use(requireAuth);

const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  expiresInDays: z.number().int().positive().optional(),
});

// List user's API keys
apiKeysRouter.get('/', async (req: any, res, next) => {
  try {
    const apiKeys = await db.query<api_keys>(
      `SELECT id, name, \`key\`, isActive, lastUsedAt, createdAt, expiresAt 
       FROM api_keys WHERE userId = ? ORDER BY createdAt DESC`,
      [req.user!.id]
    );

    // Mask keys except last 8 characters
    const maskedKeys = apiKeys.map(key => ({
      ...key,
      key: `****${key.key.slice(-8)}`
    }));

    res.json({ apiKeys: maskedKeys });
  } catch (error) {
    next(error);
  }
});

// Create new API key
apiKeysRouter.post('/', async (req: any, res, next) => {
  try {
    const { name, expiresInDays } = createApiKeySchema.parse(req.body);
    
    const apiKey = crypto.randomBytes(32).toString('hex');
    const keyId = generateId();
    const now = toMySQLDate(new Date());
    
    const expiresAt = expiresInDays 
      ? toMySQLDate(new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000))
      : null;

    await db.execute(
      `INSERT INTO api_keys (id, name, \`key\`, userId, isActive, createdAt, expiresAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [keyId, name, apiKey, req.user!.id, true, now, expiresAt]
    );

    const newKey = await db.queryOne<api_keys>('SELECT * FROM api_keys WHERE id = ?', [keyId]);

    res.json({
      id: newKey!.id,
      name: newKey!.name,
      key: apiKey, // Show full key only once
      isActive: newKey!.isActive,
      createdAt: newKey!.createdAt,
      expiresAt: newKey!.expiresAt,
      warning: 'Save this key! It will not be shown again.'
    });
  } catch (error) {
    next(error);
  }
});

// Delete API key
apiKeysRouter.delete('/:id', async (req: any, res, next) => {
  try {
    const { id } = req.params;

    const apiKey = await db.queryOne<api_keys>(
      'SELECT * FROM api_keys WHERE id = ? AND userId = ?',
      [id, req.user!.id]
    );

    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    await db.execute('DELETE FROM api_keys WHERE id = ?', [id]);

    res.json({ success: true, message: 'API key deleted' });
  } catch (error) {
    next(error);
  }
});

// Toggle API key active status
apiKeysRouter.patch('/:id/toggle', async (req: any, res, next) => {
  try {
    const { id } = req.params;

    const apiKey = await db.queryOne<api_keys>(
      'SELECT * FROM api_keys WHERE id = ? AND userId = ?',
      [id, req.user!.id]
    );

    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    const newStatus = !apiKey.isActive;
    await db.execute('UPDATE api_keys SET isActive = ? WHERE id = ?', [newStatus, id]);

    res.json({
      id: apiKey.id,
      isActive: newStatus,
      message: newStatus ? 'API key activated' : 'API key deactivated'
    });
  } catch (error) {
    next(error);
  }
});
