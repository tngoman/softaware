import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { unauthorized } from '../utils/httpErrors.js';
// ── Cookie name for the HTTP-only auth token ───────────────────────
const AUTH_COOKIE = 'sw_token';
/**
 * Compute cookie options based on the current request origin.
 * Production (HTTPS) → Secure + SameSite=None so cross-origin works.
 * Development (HTTP)  → no Secure flag, SameSite=Lax.
 */
function cookieOpts(req, maxAgeMs) {
    const isHttps = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https';
    return {
        httpOnly: true,
        secure: isHttps,
        sameSite: (isHttps ? 'none' : 'lax'),
        path: '/',
        maxAge: maxAgeMs ?? 30 * 24 * 60 * 60 * 1000, // 30 days default
    };
}
/** Set the JWT as an HTTP-only cookie on the response. */
export function setAuthCookie(req, res, token, maxAgeMs) {
    res.cookie(AUTH_COOKIE, token, cookieOpts(req, maxAgeMs));
}
/** Clear the auth cookie. */
export function clearAuthCookie(req, res) {
    res.clearCookie(AUTH_COOKIE, cookieOpts(req));
}
export function signAccessToken(payload, expiresIn) {
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: (expiresIn || env.JWT_EXPIRES_IN) });
}
export function requireAuth(req, _res, next) {
    // 1. Prefer Authorization header (Bearer token)
    let token;
    const auth = req.header('authorization');
    if (auth && auth.toLowerCase().startsWith('bearer ')) {
        token = auth.slice('bearer '.length);
    }
    // 2. Fall back to HTTP-only cookie
    if (!token && req.cookies?.[AUTH_COOKIE]) {
        token = req.cookies[AUTH_COOKIE];
    }
    if (!token) {
        return next(unauthorized('No token provided'));
    }
    try {
        const decoded = jwt.verify(token, env.JWT_SECRET);
        if (typeof decoded !== 'object' || decoded === null || !('userId' in decoded)) {
            return next(unauthorized('Invalid token'));
        }
        const userId = String(decoded.userId);
        req.auth = { userId };
        req.userId = userId;
        return next();
    }
    catch {
        return next(unauthorized('Invalid token'));
    }
}
export function getAuth(req) {
    const auth = req.auth;
    if (!auth)
        throw unauthorized('Not authenticated');
    return auth;
}
