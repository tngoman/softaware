import { Router } from 'express';
import { db } from '../db/mysql.js';
import { formatPublicPackage } from '../services/packageResolver.js';

const router = Router();

router.get('/packages', async (_req, res) => {
  try {
    const packages = await db.query<any>(
      `SELECT *
         FROM packages
        WHERE is_active = 1
          AND is_public = 1
        ORDER BY display_order ASC, id ASC`,
    );

    return res.json({
      success: true,
      packages: packages.map((pkg) => formatPublicPackage(pkg)),
    });
  } catch (error) {
    console.error('[PublicPackages] list error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load packages.' });
  }
});

export default router;
