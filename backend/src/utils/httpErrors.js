export class HttpError extends Error {
    status;
    code;
    constructor(status, code, message) {
        super(message ?? code);
        this.status = status;
        this.code = code;
    }
}
export function notFound(message) {
    return new HttpError(404, 'NOT_FOUND', message);
}
export function unauthorized(message) {
    return new HttpError(401, 'UNAUTHORIZED', message);
}
export function forbidden(message) {
    return new HttpError(403, 'FORBIDDEN', message);
}
export function badRequest(message) {
    return new HttpError(400, 'BAD_REQUEST', message);
}
