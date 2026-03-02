export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message?: string) {
    super(message ?? code);
    this.status = status;
    this.code = code;
  }
}

export function notFound(message?: string) {
  return new HttpError(404, 'NOT_FOUND', message);
}

export function unauthorized(message?: string) {
  return new HttpError(401, 'UNAUTHORIZED', message);
}

export function forbidden(message?: string) {
  return new HttpError(403, 'FORBIDDEN', message);
}

export function badRequest(message?: string) {
  return new HttpError(400, 'BAD_REQUEST', message);
}
