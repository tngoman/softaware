import { trackApiError } from '../services/healthMonitor.js';
/**
 * Middleware that intercepts all responses and feeds 5xx (and optionally 4xx)
 * errors into the health monitor's in-memory error buffer.
 * Must be mounted BEFORE routes so it can hook into `res.end`.
 */
export function apiErrorTracker(req, res, next) {
    const originalEnd = res.end.bind(res);
    // Override res.end to capture the final status code
    res.end = function (...args) {
        if (res.statusCode >= 500) {
            trackApiError({
                method: req.method,
                path: req.originalUrl || req.path,
                statusCode: res.statusCode,
                timestamp: Date.now(),
                errorMessage: res.statusMessage || undefined,
            });
        }
        return originalEnd(...args);
    };
    next();
}
