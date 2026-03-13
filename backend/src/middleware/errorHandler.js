import { HttpError } from '../utils/httpErrors.js';
export function errorHandler(err, _req, res, _next) {
    if (err instanceof HttpError) {
        return res.status(err.status).json({ error: err.code, message: err.message });
    }
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
}
