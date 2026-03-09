/**
 * Staff Assistant Routes — Profile Tab API
 *
 * Staff members can create ONE personal AI assistant using the same UI
 * as clients, but the backend enforces:
 *   - Max 1 assistant per staff member (is_staff_agent = 1)
 *   - core_instructions are hidden / locked from the GUI
 *   - personality_flare is what they edit in the "Personality & Tone" field
 *   - Function calling tools are injected dynamically (never stored in DB)
 *
 * Also manages external software tokens so the assistant can proxy
 * task operations on the staff member's behalf.
 *
 * Mount: /api/v1/mobile/staff-assistant
 */

import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { db, toMySQLDate } from '../db/mysql.js';
import { HttpError, unauthorized, badRequest, notFound, forbidden } from '../utils/httpErrors.js';
import { resolveUserRole } from '../services/mobileAIProcessor.js';
import { randomUUID } from 'crypto';

const router = Router();

// ============================================================================
// Helpers
// ============================================================================

async function requireStaffRole(userId: string): Promise<void> {
  const role = await resolveUserRole(userId);
  if (role !== 'staff') {
    throw new HttpError(403, 'FORBIDDEN', 'Only staff members can manage staff assistants.');
  }
}

// ============================================================================
// GET / — Get staff member's assistant (or null)
// ============================================================================

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) throw unauthorized('Authentication required.');
    await requireStaffRole(userId);

    const assistant = await db.queryOne<Record<string, any>>(
      `SELECT id, name, description, personality, personality_flare,
              primary_goal, custom_greeting, voice_style, preferred_model,
              status, tier, pages_indexed, created_at, updated_at,
              business_type, website, knowledge_categories
       FROM assistants
       WHERE userId = ? AND is_staff_agent = 1
       LIMIT 1`,
      [userId],
    );

    res.json({ success: true, assistant: assistant || null });
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ success: false, error: err.message });
    } else {
      console.error('[StaffAssistant] GET error:', err);
      res.status(500).json({ success: false, error: 'Internal server error.' });
    }
  }
});

// ============================================================================
// POST / — Create staff assistant (max 1)
// ============================================================================

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) throw unauthorized('Authentication required.');
    await requireStaffRole(userId);

    // Enforce max 1 staff agent per user
    const existing = await db.queryOne<{ id: string }>(
      'SELECT id FROM assistants WHERE userId = ? AND is_staff_agent = 1',
      [userId],
    );
    if (existing) {
      throw badRequest('You already have a staff assistant. Update it instead of creating a new one.');
    }

    const {
      name,
      description,
      personality,
      personality_flare,
      primary_goal,
      custom_greeting,
      voice_style,
      preferred_model,
      business_type,
      website,
    } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw badRequest('Assistant name is required.');
    }

    const id = `staff-assistant-${Date.now()}`;
    const now = toMySQLDate(new Date());

    await db.execute(
      `INSERT INTO assistants
        (id, userId, name, description, personality, personality_flare,
         primary_goal, custom_greeting, voice_style, preferred_model,
         business_type, website, is_staff_agent, tier, status, pages_indexed,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'paid', 'active', 0, ?, ?)`,
      [
        id, userId, name.trim(), description || null,
        personality || 'professional', personality_flare || null,
        primary_goal || null, custom_greeting || null,
        voice_style || null, preferred_model || null,
        business_type || 'Internal', website || null,
        now, now,
      ],
    );

    const created = await db.queryOne<Record<string, any>>(
      `SELECT id, name, description, personality, personality_flare,
              primary_goal, custom_greeting, voice_style, preferred_model,
              status, tier, business_type, website, created_at, updated_at
       FROM assistants WHERE id = ?`,
      [id],
    );

    console.log(`[StaffAssistant] Created ${id} for user ${userId}`);
    res.status(201).json({ success: true, assistant: created });
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ success: false, error: err.message });
    } else {
      console.error('[StaffAssistant] CREATE error:', err);
      res.status(500).json({ success: false, error: 'Internal server error.' });
    }
  }
});

// ============================================================================
// PUT / — Update staff assistant
// ============================================================================

router.put('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) throw unauthorized('Authentication required.');
    await requireStaffRole(userId);

    const assistant = await db.queryOne<{ id: string }>(
      'SELECT id FROM assistants WHERE userId = ? AND is_staff_agent = 1',
      [userId],
    );
    if (!assistant) throw notFound('No staff assistant found. Create one first.');

    // Staff can edit these fields (NOT core_instructions — that's backend-only)
    const allowed = [
      'name', 'description', 'personality', 'personality_flare',
      'primary_goal', 'custom_greeting', 'voice_style', 'preferred_model',
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
              primary_goal, custom_greeting, voice_style, preferred_model,
              status, tier, business_type, website, created_at, updated_at
       FROM assistants WHERE id = ?`,
      [assistant.id],
    );

    res.json({ success: true, assistant: updated });
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ success: false, error: err.message });
    } else {
      console.error('[StaffAssistant] UPDATE error:', err);
      res.status(500).json({ success: false, error: 'Internal server error.' });
    }
  }
});

// ============================================================================
// DELETE / — Delete staff assistant
// ============================================================================

router.delete('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) throw unauthorized('Authentication required.');
    await requireStaffRole(userId);

    const assistant = await db.queryOne<{ id: string }>(
      'SELECT id FROM assistants WHERE userId = ? AND is_staff_agent = 1',
      [userId],
    );
    if (!assistant) throw notFound('No staff assistant found.');

    await db.execute('DELETE FROM assistants WHERE id = ?', [assistant.id]);
    console.log(`[StaffAssistant] Deleted ${assistant.id} for user ${userId}`);
    res.json({ success: true, message: 'Staff assistant deleted.' });
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ success: false, error: err.message });
    } else {
      console.error('[StaffAssistant] DELETE error:', err);
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

    // Only super_admin can set core instructions
    const adminCheck = await db.queryOne<{ slug: string }>(
      `SELECT r.slug FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
         AND r.slug = 'super_admin'
       LIMIT 1`,
      [userId],
    );
    if (!adminCheck) throw forbidden('Only super admins can set core instructions.');

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
      console.error('[StaffAssistant] CORE error:', err);
      res.status(500).json({ success: false, error: 'Internal server error.' });
    }
  }
});

// ============================================================================
// Software Token Management (for task proxy)
// ============================================================================

// GET /software-tokens — List stored tokens for current staff user
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
      console.error('[StaffAssistant] TOKENS GET error:', err);
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
      console.error('[StaffAssistant] TOKENS POST error:', err);
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
      console.error('[StaffAssistant] TOKENS DELETE error:', err);
      res.status(500).json({ success: false, error: 'Internal server error.' });
    }
  }
});

export default router;
