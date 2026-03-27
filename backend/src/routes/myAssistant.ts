/**
 * My Assistant Routes — Unified Mobile Assistant Management
 *
 * Both staff AND client users create / manage their personal AI
 * assistants through these endpoints.  The mobile app calls these
 * for assistant CRUD and personality updates.
 *
 * Rules:
 *   - Staff are limited to 1 assistant (is_staff_agent = 1, auto-primary)
 *   - Clients can create multiple assistants; one is marked is_primary = 1
 *   - core_instructions are NEVER editable here (backend / superadmin only)
 *   - personality_flare, custom_greeting, voice_style etc. are user-editable
 *   - Software token management remains staff-only (for task proxy)
 *
 * Mount: /api/v1/mobile/my-assistant
 */

import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { db, toMySQLDate } from '../db/mysql.js';
import { HttpError, unauthorized, badRequest, notFound, forbidden } from '../utils/httpErrors.js';
import { resolveUserRole } from '../services/mobileAIProcessor.js';
import { guardMaxAssistants, TierLimitError } from '../middleware/tierGuard.js';
import { randomUUID } from 'crypto';

const router = Router();

// ============================================================================
// Helpers
// ============================================================================

async function requireStaffRole(userId: string): Promise<void> {
  const role = await resolveUserRole(userId);
  if (role !== 'staff') {
    throw new HttpError(403, 'FORBIDDEN', 'Only staff members can access this resource.');
  }
}

// ============================================================================
// GET / — List all of the user's assistants
// ============================================================================

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) throw unauthorized('Authentication required.');

    const assistants = await db.query<Record<string, any>>(
      `SELECT id, name, description, personality, personality_flare,
              primary_goal, custom_greeting, voice_style, tts_voice, preferred_model,
              status, tier, pages_indexed, is_staff_agent, is_primary,
              business_type, website, knowledge_categories,
              created_at, updated_at
       FROM assistants
       WHERE userId = ?
       ORDER BY is_primary DESC, created_at DESC`,
      [userId],
    );

    res.json({ success: true, assistants });
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ success: false, error: err.message });
    } else {
      console.error('[MyAssistant] GET list error:', err);
      res.status(500).json({ success: false, error: 'Internal server error.' });
    }
  }
});

// ============================================================================
// GET /:id — Get a single assistant by ID (must own it)
// ============================================================================

router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) throw unauthorized('Authentication required.');

    const assistant = await db.queryOne<Record<string, any>>(
      `SELECT id, name, description, personality, personality_flare,
              primary_goal, custom_greeting, voice_style, tts_voice, preferred_model,
              status, tier, pages_indexed, is_staff_agent, is_primary,
              business_type, website, knowledge_categories,
              created_at, updated_at
       FROM assistants
       WHERE id = ? AND userId = ?`,
      [req.params.id, userId],
    );

    if (!assistant) throw notFound('Assistant not found.');
    res.json({ success: true, assistant });
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ success: false, error: err.message });
    } else {
      console.error('[MyAssistant] GET one error:', err);
      res.status(500).json({ success: false, error: 'Internal server error.' });
    }
  }
});

// ============================================================================
// POST / — Create a new assistant
//   Staff  → max 1 (is_staff_agent=1, auto-primary)
//   Client → unlimited, first one auto-primary
// ============================================================================

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) throw unauthorized('Authentication required.');

    const role = await resolveUserRole(userId);
    const isStaff = role === 'staff';

    // Staff: enforce max 1
    if (isStaff) {
      const existing = await db.queryOne<{ id: string }>(
        'SELECT id FROM assistants WHERE userId = ? AND is_staff_agent = 1',
        [userId],
      );
      if (existing) {
        throw badRequest('You already have a staff assistant. Update it instead of creating a new one.');
      }
    }

    // ── Tier limit check (applies to both staff and clients) ──────────
    await guardMaxAssistants(userId);

    const {
      name,
      description,
      personality,
      personality_flare,
      primary_goal,
      custom_greeting,
      voice_style,
      tts_voice,
      preferred_model,
      business_type,
      website,
    } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw badRequest('Assistant name is required.');
    }

    // Determine if this should be the primary assistant
    const existingCount = await db.queryOne<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM assistants WHERE userId = ?',
      [userId],
    );
    const isFirstAssistant = (existingCount?.cnt ?? 0) === 0;

    const idPrefix = isStaff ? 'staff-assistant' : 'client-assistant';
    const id = `${idPrefix}-${Date.now()}`;
    const now = toMySQLDate(new Date());

    await db.execute(
      `INSERT INTO assistants
        (id, userId, name, description, personality, personality_flare,
         primary_goal, custom_greeting, voice_style, tts_voice, preferred_model,
         business_type, website, is_staff_agent, is_primary,
         tier, status, pages_indexed, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', 'active', 0, ?, ?)`,
      [
        id, userId, name.trim(), description || null,
        personality || 'professional', personality_flare || null,
        primary_goal || null, custom_greeting || null,
        voice_style || null, tts_voice || 'nova', preferred_model || null,
        business_type || (isStaff ? 'Internal' : null), website || null,
        isStaff ? 1 : 0,
        (isStaff || isFirstAssistant) ? 1 : 0,
        now, now,
      ],
    );

    const created = await db.queryOne<Record<string, any>>(
      `SELECT id, name, description, personality, personality_flare,
              primary_goal, custom_greeting, voice_style, tts_voice, preferred_model,
              status, tier, is_staff_agent, is_primary,
              business_type, website, created_at, updated_at
       FROM assistants WHERE id = ?`,
      [id],
    );

    console.log(`[MyAssistant] Created ${id} for ${role} user ${userId}`);
    res.status(201).json({ success: true, assistant: created });
  } catch (err) {
    if (err instanceof TierLimitError) {
      res.status(err.status).json({
        success: false, error: err.message, code: err.code,
        resource: err.resource, current: err.current, limit: err.limit, tier: err.tier,
      });
    } else if (err instanceof HttpError) {
      res.status(err.status).json({ success: false, error: err.message });
    } else {
      console.error('[MyAssistant] CREATE error:', err);
      res.status(500).json({ success: false, error: 'Internal server error.' });
    }
  }
});

// ============================================================================
// PUT /:id — Update an assistant (must own it)
// ============================================================================

router.put('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) throw unauthorized('Authentication required.');

    const assistant = await db.queryOne<{ id: string }>(
      'SELECT id FROM assistants WHERE id = ? AND userId = ?',
      [req.params.id, userId],
    );
    if (!assistant) throw notFound('Assistant not found.');

    // Users can edit these fields (NOT core_instructions — that's backend-only)
    const allowed = [
      'name', 'description', 'personality', 'personality_flare',
      'primary_goal', 'custom_greeting', 'voice_style', 'tts_voice', 'preferred_model',
      'business_type', 'website',
    ];

    const sets: string[] = [];
    const vals: any[] = [];

    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        sets.push(`${field} = ?`);
        vals.push(req.body[field]);
      }
    }

    if (sets.length === 0) {
      throw badRequest('No valid fields to update.');
    }

    sets.push('updated_at = ?');
    vals.push(toMySQLDate(new Date()));
    vals.push(assistant.id);

    await db.execute(
      `UPDATE assistants SET ${sets.join(', ')} WHERE id = ?`,
      vals,
    );

    const updated = await db.queryOne<Record<string, any>>(
      `SELECT id, name, description, personality, personality_flare,
              primary_goal, custom_greeting, voice_style, tts_voice, preferred_model,
              status, tier, is_staff_agent, is_primary,
              business_type, website, created_at, updated_at
       FROM assistants WHERE id = ?`,
      [assistant.id],
    );

    res.json({ success: true, assistant: updated });
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ success: false, error: err.message });
    } else {
      console.error('[MyAssistant] UPDATE error:', err);
      res.status(500).json({ success: false, error: 'Internal server error.' });
    }
  }
});

// ============================================================================
// PUT /:id/set-primary — Make this assistant the user's main/primary
// ============================================================================

router.put('/:id/set-primary', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) throw unauthorized('Authentication required.');

    const assistant = await db.queryOne<{ id: string }>(
      "SELECT id FROM assistants WHERE id = ? AND userId = ? AND status = 'active'",
      [req.params.id, userId],
    );
    if (!assistant) throw notFound('Assistant not found.');

    const now = toMySQLDate(new Date());

    // Transaction: unset all → set the chosen one
    await db.transaction(async (conn) => {
      await conn.execute(
        'UPDATE assistants SET is_primary = 0, updated_at = ? WHERE userId = ?',
        [now, userId],
      );
      await conn.execute(
        'UPDATE assistants SET is_primary = 1, updated_at = ? WHERE id = ?',
        [now, assistant.id],
      );
    });

    console.log(`[MyAssistant] Set primary: ${assistant.id} for user ${userId}`);
    res.json({ success: true, message: 'Primary assistant updated.' });
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ success: false, error: err.message });
    } else {
      console.error('[MyAssistant] SET-PRIMARY error:', err);
      res.status(500).json({ success: false, error: 'Internal server error.' });
    }
  }
});

// ============================================================================
// DELETE /:id — Delete an assistant (must own it)
// ============================================================================

router.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) throw unauthorized('Authentication required.');

    const assistant = await db.queryOne<{ id: string; is_primary: number }>(
      'SELECT id, is_primary FROM assistants WHERE id = ? AND userId = ?',
      [req.params.id, userId],
    );
    if (!assistant) throw notFound('Assistant not found.');

    await db.execute('DELETE FROM assistants WHERE id = ?', [assistant.id]);

    // If the deleted assistant was primary, promote the next one
    if (assistant.is_primary) {
      const next = await db.queryOne<{ id: string }>(
        "SELECT id FROM assistants WHERE userId = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
        [userId],
      );
      if (next) {
        await db.execute(
          'UPDATE assistants SET is_primary = 1, updated_at = ? WHERE id = ?',
          [toMySQLDate(new Date()), next.id],
        );
      }
    }

    console.log(`[MyAssistant] Deleted ${assistant.id} for user ${userId}`);
    res.json({ success: true, message: 'Assistant deleted.' });
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ success: false, error: err.message });
    } else {
      console.error('[MyAssistant] DELETE error:', err);
      res.status(500).json({ success: false, error: 'Internal server error.' });
    }
  }
});

// ============================================================================
// POST /core-instructions — Superadmin-only: set core_instructions
// ============================================================================

router.post('/core-instructions', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) throw unauthorized('Authentication required.');

    // Only admins can set core instructions
    const adminCheck = await db.queryOne<{ is_admin: number }>(
      'SELECT is_admin FROM users WHERE id = ?',
      [userId],
    );
    if (!adminCheck || !adminCheck.is_admin) throw forbidden('Only administrators can set core instructions.');

    const { assistantId, core_instructions } = req.body;
    if (!assistantId) throw badRequest('assistantId is required.');

    await db.execute(
      'UPDATE assistants SET core_instructions = ?, updated_at = ? WHERE id = ?',
      [core_instructions || null, toMySQLDate(new Date()), assistantId],
    );

    res.json({ success: true, message: 'Core instructions updated.' });
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ success: false, error: err.message });
    } else {
      console.error('[MyAssistant] CORE error:', err);
      res.status(500).json({ success: false, error: 'Internal server error.' });
    }
  }
});

// ============================================================================
// Software Token Management (staff-only)
// ⚠️  DEPRECATED (v2.1.0) — Task tools now use source-level API keys from
//    `task_sources` table instead of per-user software tokens.
//    These endpoints remain for backward compatibility but will be removed
//    in a future release.  No new code should call them.
//    See: mobileActionExecutor.ts → resolveTaskSourceForTools()
// ============================================================================

// GET /software-tokens — List stored tokens for current staff user
// DEPRECATED: No longer used by AI assistant task tools (v2.1.0)
router.get('/software-tokens', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) throw unauthorized('Authentication required.');
    await requireStaffRole(userId);

    const tokens = await db.query<{
      id: string; software_id: number; software_name: string | null;
      api_url: string; created_at: string; updated_at: string;
    }>(
      `SELECT id, software_id, software_name, api_url, created_at, updated_at
       FROM staff_software_tokens
       WHERE user_id = ?
       ORDER BY software_name ASC`,
      [userId],
    );

    res.json({ success: true, tokens });
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ success: false, error: err.message });
    } else {
      console.error('[MyAssistant] TOKENS GET error:', err);
      res.status(500).json({ success: false, error: 'Internal server error.' });
    }
  }
});

// POST /software-tokens — Store or update a software token
router.post('/software-tokens', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) throw unauthorized('Authentication required.');
    await requireStaffRole(userId);

    const { software_id, software_name, api_url, token } = req.body;
    if (!software_id || !api_url || !token) {
      throw badRequest('software_id, api_url, and token are required.');
    }

    const now = toMySQLDate(new Date());
    const existing = await db.queryOne<{ id: string }>(
      'SELECT id FROM staff_software_tokens WHERE user_id = ? AND software_id = ?',
      [userId, software_id],
    );

    if (existing) {
      await db.execute(
        `UPDATE staff_software_tokens
         SET token = ?, api_url = ?, software_name = ?, updated_at = ?
         WHERE id = ?`,
        [token, api_url, software_name || null, now, existing.id],
      );
      res.json({ success: true, message: 'Token updated.', id: existing.id });
    } else {
      const id = randomUUID();
      await db.execute(
        `INSERT INTO staff_software_tokens (id, user_id, software_id, software_name, api_url, token, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, userId, software_id, software_name || null, api_url, token, now, now],
      );
      res.json({ success: true, message: 'Token stored.', id });
    }
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ success: false, error: err.message });
    } else {
      console.error('[MyAssistant] TOKENS POST error:', err);
      res.status(500).json({ success: false, error: 'Internal server error.' });
    }
  }
});

// DELETE /software-tokens/:id — Remove a software token
router.delete('/software-tokens/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) throw unauthorized('Authentication required.');

    const { id } = req.params;
    const token = await db.queryOne<{ id: string }>(
      'SELECT id FROM staff_software_tokens WHERE id = ? AND user_id = ?',
      [id, userId],
    );
    if (!token) throw notFound('Token not found.');

    await db.execute('DELETE FROM staff_software_tokens WHERE id = ?', [id]);
    res.json({ success: true, message: 'Token deleted.' });
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ success: false, error: err.message });
    } else {
      console.error('[MyAssistant] TOKENS DELETE error:', err);
      res.status(500).json({ success: false, error: 'Internal server error.' });
    }
  }
});

export default router;
