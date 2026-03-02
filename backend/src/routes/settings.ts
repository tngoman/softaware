import { Router, Response } from 'express';
import { db } from '../db/mysql.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

export const settingsRouter = Router();

/**
 * GET /settings - Get application settings
 * Reads from app_settings table as key-value pairs and returns as object
 */
settingsRouter.get('/', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const rows = await db.query<any>('SELECT setting_key, setting_value FROM app_settings');
    
    // Convert array of key-value pairs into a single settings object
    const settings: Record<string, any> = {};
    for (const row of rows) {
      try {
        settings[row.setting_key] = JSON.parse(row.setting_value);
      } catch {
        settings[row.setting_key] = row.setting_value;
      }
    }

    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /settings - Update settings
 * Accepts an object of key-value pairs and upserts into app_settings
 */
settingsRouter.put('/', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const updates = req.body;

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ success: false, error: 'Request body must be an object' });
    }

    for (const [key, value] of Object.entries(updates)) {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      const existing = await db.queryOne('SELECT id FROM app_settings WHERE setting_key = ?', [key]);
      
      if (existing) {
        await db.execute(
          'UPDATE app_settings SET setting_value = ?, updated_at = ? WHERE setting_key = ?',
          [stringValue, new Date().toISOString(), key]
        );
      } else {
        await db.insertOne('app_settings', {
          setting_key: key,
          setting_value: stringValue,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }

    res.json({ success: true, message: 'Settings updated' });
  } catch (err) {
    next(err);
  }
});
