/**
 * Softaware Tasks — Proxy Router
 *
 * These routes proxy task requests to external software APIs.
 * Per spec §8, tasks live on each software product's own API, not in the local DB.
 *
 * GET  /softaware/tasks?apiUrl={url}&page=N&limit=N  — Proxy: list tasks from external API
 * POST /softaware/tasks                               — Proxy: create task on external API
 * PUT  /softaware/tasks                               — Proxy: update task on external API
 * DELETE /softaware/tasks/:id?apiUrl={url}            — Proxy: delete task on external API
 * POST /softaware/tasks/reorder                       — Proxy: reorder tasks
 * GET  /softaware/tasks/:id/comments?apiUrl={url}     — Proxy: list comments
 * POST /softaware/tasks/:id/comments                  — Proxy: add comment
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';

export const softawareTasksRouter = Router();

/**
 * Forward a request to the external software API.
 * The external API base URL comes from the `apiUrl` query/body param.
 * The software-specific auth token comes from `X-Software-Token` header
 * or `software_token` in the body.
 */
async function proxyToExternal(
  apiUrl: string,
  path: string,
  method: string,
  softwareToken: string | null,
  body?: any
): Promise<{ status: number; data: any }> {
  const url = `${apiUrl.replace(/\/+$/, '')}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (softwareToken) {
    headers['Authorization'] = `Bearer ${softwareToken}`;
  }

  const opts: RequestInit = {
    method,
    headers,
  };
  if (body && method !== 'GET') {
    opts.body = JSON.stringify(body);
  }

  const resp = await fetch(url, opts);
  const contentType = resp.headers.get('content-type') || '';

  let data: any;
  if (contentType.includes('application/json')) {
    data = await resp.json();
  } else {
    data = await resp.text();
  }
  return { status: resp.status, data };
}

function getSoftwareToken(req: Request): string | null {
  return (req.headers['x-software-token'] as string) || null;
}

function getApiUrl(req: Request): string {
  const url = (req.query.apiUrl as string) || (req.body?.apiUrl as string);
  if (!url) throw new Error('apiUrl is required');
  return url;
}

// ─── GET /softaware/tasks ──────────────────────────────────────
softawareTasksRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const apiUrl = getApiUrl(req);
    const token = getSoftwareToken(req);
    const page = req.query.page || 1;
    const limit = req.query.limit || 1000;

    const result = await proxyToExternal(
      apiUrl,
      `/api/tasks?page=${page}&limit=${limit}`,
      'GET',
      token
    );
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── POST /softaware/tasks ─────────────────────────────────────
softawareTasksRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const apiUrl = getApiUrl(req);
    const token = getSoftwareToken(req);
    const { task } = req.body;

    const result = await proxyToExternal(apiUrl, '/api/tasks', 'POST', token, task);
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── PUT /softaware/tasks ──────────────────────────────────────
softawareTasksRouter.put('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const apiUrl = getApiUrl(req);
    const token = getSoftwareToken(req);
    const { task } = req.body;

    const result = await proxyToExternal(apiUrl, '/api/tasks', 'PUT', token, task);
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── DELETE /softaware/tasks/:id ───────────────────────────────
softawareTasksRouter.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const apiUrl = getApiUrl(req);
    const token = getSoftwareToken(req);
    const { id } = req.params;

    const result = await proxyToExternal(apiUrl, `/api/tasks/${id}`, 'DELETE', token);
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── POST /softaware/tasks/reorder ─────────────────────────────
softawareTasksRouter.post('/reorder', requireAuth, async (req: Request, res: Response) => {
  try {
    const apiUrl = getApiUrl(req);
    const token = getSoftwareToken(req);
    const { orders } = req.body;

    const result = await proxyToExternal(apiUrl, '/api/tasks/reorder', 'POST', token, { orders });
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── GET /softaware/tasks/:id/comments ─────────────────────────
softawareTasksRouter.get('/:id/comments', requireAuth, async (req: Request, res: Response) => {
  try {
    const apiUrl = getApiUrl(req);
    const token = getSoftwareToken(req);
    const { id } = req.params;

    const result = await proxyToExternal(apiUrl, `/api/tasks/${id}/comments`, 'GET', token);
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── POST /softaware/tasks/:id/comments ────────────────────────
softawareTasksRouter.post('/:id/comments', requireAuth, async (req: Request, res: Response) => {
  try {
    const apiUrl = getApiUrl(req);
    const token = getSoftwareToken(req);
    const { id } = req.params;
    const { comment } = req.body;

    const result = await proxyToExternal(apiUrl, `/api/tasks/${id}/comments`, 'POST', token, comment);
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── POST /softaware/software/authenticate ─────────────────────
// Authenticates against external software API and returns token
softawareTasksRouter.post('/authenticate', requireAuth, async (req: Request, res: Response) => {
  try {
    const { apiUrl, username, password, otp, otpToken } = req.body;
    if (!apiUrl) throw new Error('apiUrl is required');

    const body: any = { email: username, password, remember_me: false };
    if (otp) body.otp = otp;
    if (otpToken) body.otpToken = otpToken;

    const result = await proxyToExternal(apiUrl, '/api/auth_login', 'POST', null, body);
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});
