import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/httpErrors.js';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.code, message: err.message });
  }

  // eslint-disable-next-line no-console
  console.error(err);
  return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
}
