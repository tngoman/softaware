/**
 * storageLimit.ts — Middleware to enforce CMS storage limits
 *
 * Intercepts POST and PUT requests to the generic CMS API,
 * calculates the byte size of the incoming JSON payload,
 * checks the user's storage ledger on the `users` table,
 * and blocks the request if they would exceed their limit.
 *
 * On success, attaches `req.incomingBytes` so the downstream
 * controller doesn't have to recalculate.
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../db/mysql.js';
import { calculateByteSize } from '../utils/byteCalculator.js';

// Extend Express Request to carry the byte calculation downstream
export interface StorageLimitRequest extends Request {
  incomingBytes?: number;
}

/**
 * Middleware: check storage ledger before allowing a CMS write.
 *
 * Expects `req.body.data` to contain the JSON payload and
 * a `getClientId(req)` pattern to resolve the user ID.
 * The caller must ensure auth has already run.
 */
export function enforceStorageLimit(resolveClientId: (req: Request) => string) {
  return async (req: StorageLimitRequest, res: Response, next: NextFunction) => {
    try {
      const clientId = resolveClientId(req);
      const incomingData = req.body?.data;

      if (!incomingData || typeof incomingData !== 'object') {
        // Let the route handler deal with validation errors
        return next();
      }

      // 1. Calculate how big this new data is
      const incomingBytes = calculateByteSize(incomingData);

      // 2. Fetch their current ledger
      const client = await db.queryOne<{
        storage_used_bytes: number;
        storage_limit_bytes: number;
      }>(
        `SELECT storage_used_bytes, storage_limit_bytes FROM users WHERE id = ?`,
        [clientId]
      );

      if (!client) {
        return res.status(401).json({ error: 'Client not found.' });
      }

      // 3. The Math: is current + new > limit?
      // For PUT requests, the controller will subtract old bytes first.
      // This middleware is a fast pre-check using worst-case (full add).
      if ((client.storage_used_bytes + incomingBytes) > client.storage_limit_bytes) {
        const limitMb = (client.storage_limit_bytes / 1024 / 1024).toFixed(1);
        const usedMb = (client.storage_used_bytes / 1024 / 1024).toFixed(2);
        const requiredMb = (incomingBytes / 1024 / 1024).toFixed(2);

        return res.status(403).json({
          error: 'Storage limit exceeded.',
          code: 'STORAGE_FULL',
          requiredUpgrade: true,
          message: `This action requires ${requiredMb} MB, but you only have ${(parseFloat(limitMb) - parseFloat(usedMb)).toFixed(2)} MB remaining (${usedMb} / ${limitMb} MB used).`,
          usage: {
            usedBytes: client.storage_used_bytes,
            limitBytes: client.storage_limit_bytes,
            usedMb: parseFloat(usedMb),
            limitMb: parseFloat(limitMb)
          }
        });
      }

      // 4. Pass the calculated bytes down to the controller
      req.incomingBytes = incomingBytes;
      next();

    } catch (error) {
      console.error('[StorageLimit] Check error:', error);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  };
}
