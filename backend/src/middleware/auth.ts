import jwt from 'jsonwebtoken';
import { Request } from 'express';
import { env } from '../config/env.js';
import { unauthorized } from '../utils/httpErrors.js';

export type AuthUser = {
  userId: string;
};

export interface AuthRequest extends Request {
  userId?: string;
  auth?: AuthUser;
}

export function signAccessToken(payload: AuthUser, expiresIn?: string) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: (expiresIn || env.JWT_EXPIRES_IN) as any });
}

export function requireAuth(req: Request, _res: import('express').Response, next: import('express').NextFunction) {
  const auth = req.header('authorization');
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) {
    return next(unauthorized('Missing Authorization header'));
  }

  const token = auth.slice('bearer '.length);
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded !== 'object' || decoded === null || !('userId' in decoded)) {
      return next(unauthorized('Invalid token'));
    }

    const userId = String((decoded as any).userId);
    (req as AuthRequest).auth = { userId } satisfies AuthUser;
    (req as AuthRequest).userId = userId;
    return next();
  } catch {
    return next(unauthorized('Invalid token'));
  }
}

export function getAuth(req: import('express').Request): AuthUser {
  const auth = (req as any).auth as AuthUser | undefined;
  if (!auth) throw unauthorized('Not authenticated');
  return auth;
}
