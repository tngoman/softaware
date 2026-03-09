/**
 * Planning Routes — Unified Calendar / Schedule / Meeting Scheduler
 *
 * Calendar events:
 *   GET    /planning/events               — List events (date range, filters)
 *   POST   /planning/events               — Create event (with attendees & invite link)
 *   GET    /planning/events/:id           — Get event detail (with attendees)
 *   PUT    /planning/events/:id           — Update an event
 *   DELETE /planning/events/:id           — Delete an event
 *   POST   /planning/events/:id/respond   — Accept / tentative / decline
 *
 * Attendees:
 *   POST   /planning/events/:id/attendees — Add attendees
 *   DELETE /planning/events/:id/attendees/:userId — Remove attendee
 *
 * Invitation links:
 *   GET    /planning/invite/:token        — Resolve invitation link
 *   POST   /planning/invite/:token/accept — Accept invitation link
 *
 * Call integration:
 *   POST   /planning/events/:id/start-call — Start a call for this meeting
 *
 * Scheduled call sync:
 *   POST   /planning/sync/scheduled-calls — Import scheduled calls into calendar
 *
 * Email invitation import:
 *   POST   /planning/import/email-invite  — Parse iCal from email and create event
 *   GET    /planning/scan/email-invites   — Scan inbox for calendar invitations
 *
 * Users:
 *   GET    /planning/users                — Search users for attendee picker
 *
 * Stats:
 *   GET    /planning/stats                — Calendar stats
 */

import { Router, type Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { requireAuth, getAuth, type AuthRequest } from '../middleware/auth.js';
import { db } from '../db/mysql.js';
import {
  getMailbox,
  listMailboxes,
  getMessage,
} from '../services/webmailService.js';

export const planningRouter = Router();

// All routes require authentication
planningRouter.use(requireAuth);

// ═══════════════════════════════════════════════════════════════════════════
// TABLE AUTO-CREATE
// ═══════════════════════════════════════════════════════════════════════════

let tableReady = false;
planningRouter.use(async (_req, _res, next) => {
  if (!tableReady) {
    try {
      // Main events table
      await db.query(`
        CREATE TABLE IF NOT EXISTS calendar_events (
          id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          user_id          VARCHAR(36)     NOT NULL,
          title            VARCHAR(500)    NOT NULL,
          description      TEXT            NULL,
          location         VARCHAR(500)    NULL,
          event_type       ENUM('meeting','call','reminder','task','email_invite','other') NOT NULL DEFAULT 'meeting',
          source_type      ENUM('manual','scheduled_call','email_invite') NOT NULL DEFAULT 'manual',
          start_at         DATETIME        NOT NULL,
          end_at           DATETIME        NOT NULL,
          all_day          TINYINT(1)      NOT NULL DEFAULT 0,
          recurrence       ENUM('none','daily','weekly','biweekly','monthly') NOT NULL DEFAULT 'none',
          recurrence_end   DATETIME        NULL,
          status           ENUM('confirmed','tentative','cancelled','declined') NOT NULL DEFAULT 'confirmed',
          scheduled_call_id BIGINT UNSIGNED NULL,
          call_session_id   BIGINT UNSIGNED NULL,
          email_account_id  INT UNSIGNED    NULL,
          email_folder      VARCHAR(255)    NULL,
          email_uid         INT UNSIGNED    NULL,
          email_message_id  VARCHAR(500)    NULL,
          ical_uid          VARCHAR(500)    NULL,
          organizer_name    VARCHAR(255)    NULL,
          organizer_email   VARCHAR(255)    NULL,
          color             VARCHAR(20)     NULL DEFAULT NULL,
          reminder_minutes  INT UNSIGNED    NULL DEFAULT 15,
          reminder_sent     TINYINT(1)      NOT NULL DEFAULT 0,
          invitation_token  VARCHAR(64)     NULL,
          meeting_link      VARCHAR(500)    NULL,
          call_type         ENUM('voice','video') NULL DEFAULT 'video',
          notes             TEXT            NULL,
          created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_user        (user_id),
          INDEX idx_start_at    (start_at),
          INDEX idx_end_at      (end_at),
          INDEX idx_source      (source_type),
          INDEX idx_status      (status),
          INDEX idx_ical_uid    (ical_uid),
          INDEX idx_scheduled   (scheduled_call_id),
          INDEX idx_email       (email_account_id, email_uid),
          INDEX idx_reminder    (status, reminder_sent, start_at),
          INDEX idx_invite_token (invitation_token),
          CONSTRAINT fk_calendar_user
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // Attendees table
      await db.query(`
        CREATE TABLE IF NOT EXISTS calendar_event_attendees (
          id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          event_id         BIGINT UNSIGNED NOT NULL,
          user_id          VARCHAR(36)     NOT NULL,
          rsvp             ENUM('pending','accepted','declined','tentative') NOT NULL DEFAULT 'pending',
          is_organizer     TINYINT(1)      NOT NULL DEFAULT 0,
          added_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
          responded_at     DATETIME        NULL,
          UNIQUE KEY uq_event_user (event_id, user_id),
          INDEX idx_attendee_user (user_id),
          CONSTRAINT fk_attendee_event FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE,
          CONSTRAINT fk_attendee_user  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // Safe column additions for existing tables
      const safeAlter = async (sql: string) => {
        try { await db.query(sql); } catch (e: any) {
          if (e.code !== 'ER_DUP_FIELDNAME' && e.errno !== 1060 &&
              e.code !== 'ER_DUP_KEYNAME' && e.errno !== 1061) throw e;
        }
      };
      await safeAlter(`ALTER TABLE calendar_events ADD COLUMN invitation_token VARCHAR(64) NULL`);
      await safeAlter(`ALTER TABLE calendar_events ADD COLUMN meeting_link VARCHAR(500) NULL`);
      await safeAlter(`ALTER TABLE calendar_events ADD COLUMN call_type ENUM('voice','video') NULL DEFAULT 'video'`);
      await safeAlter(`ALTER TABLE calendar_events ADD COLUMN notes TEXT NULL`);
      await safeAlter(`ALTER TABLE calendar_events ADD COLUMN call_session_id BIGINT UNSIGNED NULL`);
      await safeAlter(`ALTER TABLE calendar_events ADD INDEX idx_invite_token (invitation_token)`);

      tableReady = true;
    } catch (err: any) {
      if (err.code === 'ER_TABLE_EXISTS_ERROR' || err.errno === 1050) {
        tableReady = true;
      } else {
        console.error('[Planning] Table creation error:', err.message);
      }
    }
  }
  next();
});

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function generateInviteToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function toMySQLDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 19).replace('T', ' ');
}

function parseICalEvents(icalText: string): Array<{
  uid: string; summary: string; description: string; location: string;
  dtstart: string; dtend: string; organizer: { name: string; email: string };
  status: string; allDay: boolean;
}> {
  const events: any[] = [];
  const veventRegex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/gi;
  let match;
  while ((match = veventRegex.exec(icalText)) !== null) {
    const block = match[1];
    const get = (key: string): string => {
      const unfolded = block.replace(/\r?\n[ \t]/g, '');
      const re = new RegExp(`^${key}[^:]*:(.*)$`, 'mi');
      const m = unfolded.match(re);
      return m ? m[1].trim() : '';
    };
    const dtstart = get('DTSTART');
    const dtend = get('DTEND');
    const allDay = dtstart.length === 8;
    const orgLine = block.replace(/\r?\n[ \t]/g, '').match(/^ORGANIZER[^:]*:(.*)/mi);
    const orgParams = block.replace(/\r?\n[ \t]/g, '').match(/ORGANIZER;([^:]*)/mi);
    let orgEmail = orgLine ? orgLine[1].replace('mailto:', '').trim() : '';
    let orgName = '';
    if (orgParams) {
      const cnMatch = orgParams[1].match(/CN=([^;:]+)/i);
      if (cnMatch) orgName = cnMatch[1].replace(/"/g, '').trim();
    }
    events.push({
      uid: get('UID'), summary: get('SUMMARY'),
      description: get('DESCRIPTION').replace(/\\n/g, '\n').replace(/\\,/g, ','),
      location: get('LOCATION').replace(/\\,/g, ','),
      dtstart: parseICalDate(dtstart), dtend: parseICalDate(dtend || dtstart),
      organizer: { name: orgName, email: orgEmail },
      status: (get('STATUS') || 'CONFIRMED').toUpperCase(), allDay,
    });
  }
  return events;
}

function parseICalDate(str: string): string {
  if (!str) return new Date().toISOString();
  str = str.replace(/^TZID=[^:]+:/i, '');
  if (/^\d{8}$/.test(str)) return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}T00:00:00.000Z`;
  if (/^\d{8}T\d{6}Z?$/i.test(str)) return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}T${str.slice(9, 11)}:${str.slice(11, 13)}:${str.slice(13, 15)}.000Z`;
  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function mapICalStatus(status: string): 'confirmed' | 'tentative' | 'cancelled' {
  switch (status.toUpperCase()) {
    case 'TENTATIVE': return 'tentative';
    case 'CANCELLED': return 'cancelled';
    default: return 'confirmed';
  }
}

async function enrichEventWithAttendees(event: any): Promise<any> {
  if (!event) return event;
  const attendees: any = await db.query(
    `SELECT a.user_id, a.rsvp, a.is_organizer, a.added_at, a.responded_at,
            u.name, u.email, u.avatar_url
     FROM calendar_event_attendees a
     JOIN users u ON u.id = a.user_id
     WHERE a.event_id = ?
     ORDER BY a.is_organizer DESC, a.added_at ASC`,
    [event.id]
  );
  return { ...event, attendees };
}

async function enrichEventsWithAttendeeCounts(events: any[]): Promise<any[]> {
  if (!events.length) return events;
  const ids = events.map((e: any) => e.id);
  const placeholders = ids.map(() => '?').join(',');
  const counts: any = await db.query(
    `SELECT event_id, COUNT(*) as count,
            SUM(CASE WHEN rsvp = 'accepted' THEN 1 ELSE 0 END) as accepted_count
     FROM calendar_event_attendees WHERE event_id IN (${placeholders}) GROUP BY event_id`, ids
  );
  const countMap: Record<number, { total: number; accepted: number }> = {};
  for (const c of counts) countMap[c.event_id] = { total: Number(c.count), accepted: Number(c.accepted_count) };
  return events.map((e: any) => ({
    ...e,
    attendee_count: countMap[e.id]?.total || 0,
    accepted_attendees: countMap[e.id]?.accepted || 0,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// CALENDAR EVENT CRUD
// ═══════════════════════════════════════════════════════════════════════════

const ListEventsSchema = z.object({
  start: z.string().optional(), end: z.string().optional(),
  source_type: z.string().optional(), event_type: z.string().optional(),
  status: z.string().optional(),
});

planningRouter.get('/events', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const params = ListEventsSchema.parse(req.query);
    let sql = `SELECT DISTINCT ce.* FROM calendar_events ce
      LEFT JOIN calendar_event_attendees cea ON cea.event_id = ce.id
      WHERE (ce.user_id = ? OR cea.user_id = ?)`;
    const values: any[] = [userId, userId];
    if (params.start) { sql += ` AND ce.end_at >= ?`; values.push(toMySQLDate(params.start)); }
    if (params.end) { sql += ` AND ce.start_at <= ?`; values.push(toMySQLDate(params.end)); }
    if (params.source_type) { sql += ` AND ce.source_type = ?`; values.push(params.source_type); }
    if (params.event_type) { sql += ` AND ce.event_type = ?`; values.push(params.event_type); }
    if (params.status) { sql += ` AND ce.status = ?`; values.push(params.status); }
    sql += ` ORDER BY ce.start_at ASC`;
    const rows: any = await db.query(sql, values);
    const enriched = await enrichEventsWithAttendeeCounts(rows);
    res.json({ success: true, data: enriched });
  } catch (err) { next(err); }
});

const CreateEventSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  location: z.string().max(500).optional(),
  event_type: z.enum(['meeting', 'call', 'reminder', 'task', 'email_invite', 'other']).default('meeting'),
  start_at: z.string().min(1), end_at: z.string().min(1),
  all_day: z.boolean().default(false),
  recurrence: z.enum(['none', 'daily', 'weekly', 'biweekly', 'monthly']).default('none'),
  recurrence_end: z.string().optional(),
  color: z.string().max(20).optional(),
  reminder_minutes: z.number().int().min(0).max(10080).optional(),
  call_type: z.enum(['voice', 'video']).optional(),
  notes: z.string().max(5000).optional(),
  attendee_ids: z.array(z.string()).optional(),
  meeting_link: z.string().max(500).optional(),
});

planningRouter.post('/events', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const data = CreateEventSchema.parse(req.body);
    const inviteToken = (data.event_type === 'meeting' || data.event_type === 'call') ? generateInviteToken() : null;

    const insertId = await db.insert(
      `INSERT INTO calendar_events
        (user_id, title, description, location, event_type, source_type,
         start_at, end_at, all_day, recurrence, recurrence_end, color,
         reminder_minutes, invitation_token, call_type, notes, meeting_link)
       VALUES (?, ?, ?, ?, ?, 'manual', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, data.title, data.description || null, data.location || null,
        data.event_type, toMySQLDate(data.start_at), toMySQLDate(data.end_at),
        data.all_day ? 1 : 0, data.recurrence,
        data.recurrence_end ? toMySQLDate(data.recurrence_end) : null,
        data.color || null, data.reminder_minutes ?? 15, inviteToken,
        data.call_type || (data.event_type === 'call' ? 'voice' : 'video'),
        data.notes || null, data.meeting_link || null,
      ]
    );

    // Add creator as organizer attendee
    await db.insert(
      `INSERT INTO calendar_event_attendees (event_id, user_id, rsvp, is_organizer) VALUES (?, ?, 'accepted', 1)`,
      [insertId, userId]
    );

    // Add additional attendees
    if (data.attendee_ids?.length) {
      for (const uid of data.attendee_ids) {
        if (uid === userId) continue;
        try {
          await db.insert(
            `INSERT INTO calendar_event_attendees (event_id, user_id, rsvp, is_organizer) VALUES (?, ?, 'pending', 0)`,
            [insertId, uid]
          );
        } catch (e: any) {
          if (e.code !== 'ER_DUP_ENTRY' && e.errno !== 1062) throw e;
        }
      }
    }

    const rows: any = await db.query(`SELECT * FROM calendar_events WHERE id = ?`, [insertId]);
    const enriched = await enrichEventWithAttendees(rows[0]);
    res.status(201).json({ success: true, data: enriched });
  } catch (err) { next(err); }
});

planningRouter.get('/events/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const rows: any = await db.query(
      `SELECT DISTINCT ce.* FROM calendar_events ce
       LEFT JOIN calendar_event_attendees cea ON cea.event_id = ce.id
       WHERE ce.id = ? AND (ce.user_id = ? OR cea.user_id = ?) LIMIT 1`,
      [req.params.id, userId, userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Event not found' });
    const enriched = await enrichEventWithAttendees(rows[0]);
    res.json({ success: true, data: enriched });
  } catch (err) { next(err); }
});

planningRouter.put('/events/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const existing: any = await db.query(
      `SELECT id, user_id FROM calendar_events WHERE id = ? AND user_id = ?`,
      [req.params.id, userId]
    );
    if (!existing.length) return res.status(404).json({ error: 'Event not found or not owned by you' });

    const updates: string[] = [];
    const values: any[] = [];
    const body = req.body;

    if (body.title) { updates.push('title = ?'); values.push(body.title); }
    if (body.description !== undefined) { updates.push('description = ?'); values.push(body.description || null); }
    if (body.location !== undefined) { updates.push('location = ?'); values.push(body.location || null); }
    if (body.event_type) { updates.push('event_type = ?'); values.push(body.event_type); }
    if (body.start_at) { updates.push('start_at = ?'); values.push(toMySQLDate(body.start_at)); }
    if (body.end_at) { updates.push('end_at = ?'); values.push(toMySQLDate(body.end_at)); }
    if (body.all_day !== undefined) { updates.push('all_day = ?'); values.push(body.all_day ? 1 : 0); }
    if (body.recurrence) { updates.push('recurrence = ?'); values.push(body.recurrence); }
    if (body.recurrence_end !== undefined) { updates.push('recurrence_end = ?'); values.push(body.recurrence_end ? toMySQLDate(body.recurrence_end) : null); }
    if (body.status) { updates.push('status = ?'); values.push(body.status); }
    if (body.color !== undefined) { updates.push('color = ?'); values.push(body.color || null); }
    if (body.reminder_minutes !== undefined) { updates.push('reminder_minutes = ?'); values.push(body.reminder_minutes); }
    if (body.call_type) { updates.push('call_type = ?'); values.push(body.call_type); }
    if (body.notes !== undefined) { updates.push('notes = ?'); values.push(body.notes || null); }
    if (body.meeting_link !== undefined) { updates.push('meeting_link = ?'); values.push(body.meeting_link || null); }

    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

    values.push(req.params.id);
    await db.query(`UPDATE calendar_events SET ${updates.join(', ')} WHERE id = ?`, values);

    // Update attendees if provided
    if (body.attendee_ids && Array.isArray(body.attendee_ids)) {
      const placeholders = body.attendee_ids.length ? body.attendee_ids.map(() => '?').join(',') : "''";
      await db.query(
        `DELETE FROM calendar_event_attendees WHERE event_id = ? AND is_organizer = 0 AND user_id NOT IN (${placeholders})`,
        [req.params.id, ...body.attendee_ids]
      );
      for (const uid of body.attendee_ids) {
        if (uid === userId) continue;
        try {
          await db.insert(
            `INSERT INTO calendar_event_attendees (event_id, user_id, rsvp, is_organizer) VALUES (?, ?, 'pending', 0)`,
            [req.params.id, uid]
          );
        } catch (e: any) {
          if (e.code !== 'ER_DUP_ENTRY' && e.errno !== 1062) throw e;
        }
      }
    }

    const rows: any = await db.query(`SELECT * FROM calendar_events WHERE id = ?`, [req.params.id]);
    const enriched = await enrichEventWithAttendees(rows[0]);
    res.json({ success: true, data: enriched });
  } catch (err) { next(err); }
});

planningRouter.delete('/events/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const existing: any = await db.query(
      `SELECT id FROM calendar_events WHERE id = ? AND user_id = ?`,
      [req.params.id, userId]
    );
    if (!existing.length) return res.status(404).json({ error: 'Event not found' });
    await db.query(`DELETE FROM calendar_events WHERE id = ?`, [req.params.id]);
    res.json({ success: true, message: 'Event deleted' });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════
// ATTENDEE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

planningRouter.post('/events/:id/attendees', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const existing: any = await db.query(
      `SELECT id FROM calendar_events WHERE id = ? AND user_id = ?`,
      [req.params.id, userId]
    );
    if (!existing.length) return res.status(404).json({ error: 'Event not found or not owned by you' });

    const { user_ids } = z.object({ user_ids: z.array(z.string()).min(1) }).parse(req.body);
    let added = 0;
    for (const uid of user_ids) {
      try {
        await db.insert(
          `INSERT INTO calendar_event_attendees (event_id, user_id, rsvp, is_organizer) VALUES (?, ?, 'pending', 0)`,
          [req.params.id, uid]
        );
        added++;
      } catch (e: any) {
        if (e.code !== 'ER_DUP_ENTRY' && e.errno !== 1062) throw e;
      }
    }

    const rows: any = await db.query(`SELECT * FROM calendar_events WHERE id = ?`, [req.params.id]);
    const enriched = await enrichEventWithAttendees(rows[0]);
    res.json({ success: true, data: enriched, added });
  } catch (err) { next(err); }
});

planningRouter.delete('/events/:id/attendees/:userId', async (req: AuthRequest, res: Response, next) => {
  try {
    const auth = getAuth(req);
    const existing: any = await db.query(`SELECT id, user_id FROM calendar_events WHERE id = ?`, [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Event not found' });
    if (existing[0].user_id !== auth.userId && req.params.userId !== auth.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    await db.query(
      `DELETE FROM calendar_event_attendees WHERE event_id = ? AND user_id = ? AND is_organizer = 0`,
      [req.params.id, req.params.userId]
    );
    res.json({ success: true, message: 'Attendee removed' });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════
// RESPOND TO EVENT
// ═══════════════════════════════════════════════════════════════════════════

planningRouter.post('/events/:id/respond', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const status = z.enum(['accepted', 'tentative', 'declined']).parse(req.body.status);

    const attendee: any = await db.query(
      `SELECT id FROM calendar_event_attendees WHERE event_id = ? AND user_id = ?`,
      [req.params.id, userId]
    );

    if (attendee.length) {
      await db.query(
        `UPDATE calendar_event_attendees SET rsvp = ?, responded_at = NOW() WHERE event_id = ? AND user_id = ?`,
        [status, req.params.id, userId]
      );
    } else {
      const mapped = status === 'accepted' ? 'confirmed' : status === 'declined' ? 'declined' : 'tentative';
      await db.query(
        `UPDATE calendar_events SET status = ? WHERE id = ? AND user_id = ?`,
        [mapped, req.params.id, userId]
      );
    }

    const rows: any = await db.query(`SELECT * FROM calendar_events WHERE id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Event not found' });
    const enriched = await enrichEventWithAttendees(rows[0]);
    res.json({ success: true, data: enriched });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════
// INVITATION LINKS
// ═══════════════════════════════════════════════════════════════════════════

planningRouter.get('/invite/:token', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const rows: any = await db.query(
      `SELECT ce.*, u.name as creator_name, u.email as creator_email
       FROM calendar_events ce JOIN users u ON u.id = ce.user_id
       WHERE ce.invitation_token = ?`,
      [req.params.token]
    );
    if (!rows.length) return res.status(404).json({ error: 'Invitation not found or expired' });

    const existing: any = await db.query(
      `SELECT rsvp FROM calendar_event_attendees WHERE event_id = ? AND user_id = ?`,
      [rows[0].id, userId]
    );

    const enriched = await enrichEventWithAttendees(rows[0]);
    res.json({
      success: true, data: enriched,
      my_rsvp: existing.length ? existing[0].rsvp : null,
      is_my_event: rows[0].user_id === userId,
    });
  } catch (err) { next(err); }
});

planningRouter.post('/invite/:token/accept', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const rsvp = z.enum(['accepted', 'tentative', 'declined']).parse(req.body.rsvp || 'accepted');

    const rows: any = await db.query(
      `SELECT id, user_id FROM calendar_events WHERE invitation_token = ?`,
      [req.params.token]
    );
    if (!rows.length) return res.status(404).json({ error: 'Invitation not found' });

    try {
      await db.insert(
        `INSERT INTO calendar_event_attendees (event_id, user_id, rsvp, is_organizer, responded_at)
         VALUES (?, ?, ?, 0, NOW())`,
        [rows[0].id, userId, rsvp]
      );
    } catch (e: any) {
      if (e.code === 'ER_DUP_ENTRY' || e.errno === 1062) {
        await db.query(
          `UPDATE calendar_event_attendees SET rsvp = ?, responded_at = NOW() WHERE event_id = ? AND user_id = ?`,
          [rsvp, rows[0].id, userId]
        );
      } else throw e;
    }

    const updated: any = await db.query(`SELECT * FROM calendar_events WHERE id = ?`, [rows[0].id]);
    const enriched = await enrichEventWithAttendees(updated[0]);
    res.json({ success: true, data: enriched });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════
// CALL INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

planningRouter.post('/events/:id/start-call', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const rows: any = await db.query(
      `SELECT * FROM calendar_events WHERE id = ? AND user_id = ?`,
      [req.params.id, userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Event not found' });

    const event = rows[0];
    if (event.scheduled_call_id) {
      return res.json({
        success: true,
        data: { action: 'start_scheduled_call', scheduled_call_id: event.scheduled_call_id, call_session_id: event.call_session_id },
      });
    }

    const attendees: any = await db.query(
      `SELECT user_id FROM calendar_event_attendees WHERE event_id = ? AND rsvp = 'accepted' AND user_id != ?`,
      [req.params.id, userId]
    );

    res.json({
      success: true,
      data: {
        action: 'initiate_call',
        event_id: event.id, call_type: event.call_type || 'video',
        title: event.title,
        attendee_user_ids: attendees.map((a: any) => a.user_id),
      },
    });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════
// USERS — Search for attendee picker
// ═══════════════════════════════════════════════════════════════════════════

planningRouter.get('/users', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const search = (req.query.q as string || '').trim();
    let sql = `SELECT id, name, email, avatar_url FROM users WHERE id != ?`;
    const values: any[] = [userId];
    if (search) { sql += ` AND (name LIKE ? OR email LIKE ?)`; values.push(`%${search}%`, `%${search}%`); }
    sql += ` ORDER BY name ASC LIMIT 50`;
    const rows: any = await db.query(sql, values);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════
// SCHEDULED CALL SYNC
// ═══════════════════════════════════════════════════════════════════════════

planningRouter.post('/sync/scheduled-calls', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const calls: any = await db.query(`
      SELECT sc.*, u.name AS creator_name, u.email AS creator_email
      FROM scheduled_calls sc
      JOIN scheduled_call_participants scp ON scp.scheduled_call_id = sc.id
      LEFT JOIN users u ON u.id = sc.created_by
      WHERE scp.user_id = ? AND sc.status IN ('scheduled', 'active')
    `, [userId]);

    let imported = 0;
    for (const call of calls) {
      const existingCal: any = await db.query(
        `SELECT id FROM calendar_events WHERE user_id = ? AND scheduled_call_id = ?`,
        [userId, call.id]
      );
      if (existingCal.length) continue;

      const endAt = new Date(call.scheduled_at);
      endAt.setMinutes(endAt.getMinutes() + (call.duration_minutes || 30));

      const newId = await db.insert(
        `INSERT INTO calendar_events
          (user_id, title, description, event_type, source_type,
           start_at, end_at, recurrence, recurrence_end, status, scheduled_call_id,
           organizer_name, organizer_email, color, call_type, invitation_token)
         VALUES (?, ?, ?, 'call', 'scheduled_call', ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?, ?)`,
        [
          userId, call.title, call.description || null,
          toMySQLDate(new Date(call.scheduled_at).toISOString()),
          toMySQLDate(endAt.toISOString()),
          call.recurrence || 'none',
          call.recurrence_end ? toMySQLDate(new Date(call.recurrence_end).toISOString()) : null,
          call.id, call.creator_name || null, call.creator_email || null,
          call.call_type === 'video' ? '#3B82F6' : '#10B981',
          call.call_type || 'video', generateInviteToken(),
        ]
      );

      await db.insert(
        `INSERT IGNORE INTO calendar_event_attendees (event_id, user_id, rsvp, is_organizer) VALUES (?, ?, 'accepted', 1)`,
        [newId, userId]
      );

      const scParticipants: any = await db.query(
        `SELECT user_id, rsvp FROM scheduled_call_participants WHERE scheduled_call_id = ?`,
        [call.id]
      );
      for (const p of scParticipants) {
        if (p.user_id === userId) continue;
        try {
          await db.insert(
            `INSERT INTO calendar_event_attendees (event_id, user_id, rsvp, is_organizer) VALUES (?, ?, ?, 0)`,
            [newId, p.user_id, p.rsvp || 'pending']
          );
        } catch (e: any) { if (e.code !== 'ER_DUP_ENTRY' && e.errno !== 1062) throw e; }
      }
      imported++;
    }

    res.json({ success: true, data: { imported, total: (calls || []).length } });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════
// EMAIL INVITATION IMPORT
// ═══════════════════════════════════════════════════════════════════════════

const ImportEmailSchema = z.object({
  account_id: z.number().int().positive(),
  folder: z.string().min(1),
  uid: z.number().int().positive(),
});

planningRouter.post('/import/email-invite', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const { account_id, folder, uid } = ImportEmailSchema.parse(req.body);

    const account = await getMailbox(account_id, userId);
    if (!account) return res.status(404).json({ error: 'Mailbox account not found' });

    const message = await getMessage(account, folder, uid);
    if (!message) return res.status(404).json({ error: 'Email message not found' });

    let icalText = '';
    if (message.attachments) {
      for (const att of message.attachments) {
        if (att.contentType === 'text/calendar' || att.contentType === 'application/ics' ||
            (att.filename && att.filename.endsWith('.ics'))) {
          const { ImapFlow } = await import('imapflow');
          const { simpleParser } = await import('mailparser');
          const { decryptPassword } = await import('../utils/cryptoUtils.js');
          const client = new ImapFlow({
            host: account.imap_host, port: account.imap_port, secure: account.imap_secure,
            auth: { user: account.imap_username, pass: decryptPassword(account.imap_password) },
            logger: false as any,
          });
          await client.connect();
          try {
            const lock = await client.getMailboxLock(folder);
            try {
              const download = await client.download(String(uid), undefined, { uid: true });
              if (download) {
                const parsed = await simpleParser(download.content);
                for (const a of (parsed.attachments || [])) {
                  if (a.contentType === 'text/calendar' || a.contentType === 'application/ics' ||
                      (a.filename && a.filename.endsWith('.ics'))) {
                    icalText = a.content.toString('utf-8');
                    break;
                  }
                }
              }
            } finally { lock.release(); }
          } finally { await client.logout(); }
          break;
        }
      }
    }

    if (!icalText) {
      const body = message.html || message.text || '';
      const vcalMatch = body.match(/BEGIN:VCALENDAR[\s\S]*?END:VCALENDAR/i);
      if (vcalMatch) icalText = vcalMatch[0];
    }

    if (!icalText) {
      const startAt = new Date(message.date);
      const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);
      const fallbackId = await db.insert(
        `INSERT INTO calendar_events
          (user_id, title, description, event_type, source_type,
           start_at, end_at, status,
           email_account_id, email_folder, email_uid, email_message_id,
           organizer_name, organizer_email, color, invitation_token)
         VALUES (?, ?, ?, 'email_invite', 'email_invite', ?, ?, 'tentative',
                 ?, ?, ?, ?, ?, ?, '#F59E0B', ?)`,
        [
          userId, message.subject || 'Email Event',
          `Imported from email: ${message.from?.name || ''} <${message.from?.address || ''}>`,
          toMySQLDate(startAt.toISOString()), toMySQLDate(endAt.toISOString()),
          account_id, folder, uid, message.messageId || null,
          message.from?.name || null, message.from?.address || null, generateInviteToken(),
        ]
      );
      const rows: any = await db.query(`SELECT * FROM calendar_events WHERE id = ?`, [fallbackId]);
      const enriched = await enrichEventWithAttendees(rows[0]);
      return res.status(201).json({ success: true, data: enriched, message: 'No iCal data found — event created from email metadata', ical_found: false });
    }

    const parsedEvents = parseICalEvents(icalText);
    if (!parsedEvents.length) return res.status(400).json({ error: 'No VEVENT found in iCalendar data' });

    const importedArr: any[] = [];
    for (const evt of parsedEvents) {
      if (evt.uid) {
        const dup: any = await db.query(`SELECT id FROM calendar_events WHERE user_id = ? AND ical_uid = ?`, [userId, evt.uid]);
        if (dup.length) {
          await db.query(
            `UPDATE calendar_events SET title = ?, description = ?, location = ?,
             start_at = ?, end_at = ?, all_day = ?, status = ?,
             organizer_name = ?, organizer_email = ? WHERE id = ?`,
            [evt.summary || message.subject || 'Calendar Event', evt.description || null,
             evt.location || null, toMySQLDate(evt.dtstart), toMySQLDate(evt.dtend),
             evt.allDay ? 1 : 0, mapICalStatus(evt.status),
             evt.organizer.name || null, evt.organizer.email || null, dup[0].id]
          );
          const updatedRows: any = await db.query(`SELECT * FROM calendar_events WHERE id = ?`, [dup[0].id]);
          importedArr.push(await enrichEventWithAttendees(updatedRows[0]));
          continue;
        }
      }

      const icalInsertId = await db.insert(
        `INSERT INTO calendar_events
          (user_id, title, description, location, event_type, source_type,
           start_at, end_at, all_day, status,
           email_account_id, email_folder, email_uid, email_message_id, ical_uid,
           organizer_name, organizer_email, color, invitation_token)
         VALUES (?, ?, ?, ?, 'email_invite', 'email_invite', ?, ?, ?, ?,
                 ?, ?, ?, ?, ?, ?, ?, '#8B5CF6', ?)`,
        [
          userId, evt.summary || message.subject || 'Calendar Event',
          evt.description || null, evt.location || null,
          toMySQLDate(evt.dtstart), toMySQLDate(evt.dtend),
          evt.allDay ? 1 : 0, mapICalStatus(evt.status),
          account_id, folder, uid, message.messageId || null, evt.uid || null,
          evt.organizer.name || null, evt.organizer.email || null, generateInviteToken(),
        ]
      );
      const icalRows: any = await db.query(`SELECT * FROM calendar_events WHERE id = ?`, [icalInsertId]);
      importedArr.push(await enrichEventWithAttendees(icalRows[0]));
    }

    res.status(201).json({ success: true, data: importedArr, ical_found: true, count: importedArr.length });
  } catch (err) { next(err); }
});

planningRouter.get('/scan/email-invites', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const accountId = parseInt(req.query.account_id as string, 10);
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const account = await getMailbox(accountId, userId);
    if (!account) return res.status(404).json({ error: 'Mailbox account not found' });

    const { ImapFlow } = await import('imapflow');
    const { decryptPassword } = await import('../utils/cryptoUtils.js');

    const client = new ImapFlow({
      host: account.imap_host, port: account.imap_port, secure: account.imap_secure,
      auth: { user: account.imap_username, pass: decryptPassword(account.imap_password) },
      logger: false as any,
    });

    await client.connect();
    const invitations: any[] = [];
    try {
      const lock = await client.getMailboxLock('INBOX');
      try {
        const since = new Date();
        since.setDate(since.getDate() - 90);
        const messages = client.fetch({ since }, { envelope: true, bodyStructure: true, uid: true });
        for await (const msg of messages) {
          const hasCalendar = checkBodyForCalendar(msg.bodyStructure);
          if (hasCalendar) {
            const existingImport: any = await db.query(
              `SELECT id FROM calendar_events WHERE user_id = ? AND email_account_id = ? AND email_uid = ?`,
              [userId, accountId, msg.uid]
            );
            invitations.push({
              uid: msg.uid,
              subject: msg.envelope?.subject || '(No Subject)',
              from: msg.envelope?.from?.[0] ? {
                name: (msg.envelope.from[0] as any).name || '',
                address: `${(msg.envelope.from[0] as any).mailbox}@${(msg.envelope.from[0] as any).host}`,
              } : { name: '', address: '' },
              date: msg.envelope?.date?.toISOString() || new Date().toISOString(),
              already_imported: existingImport.length > 0,
              calendar_event_id: existingImport.length > 0 ? existingImport[0].id : null,
            });
          }
        }
      } finally { lock.release(); }
    } finally { await client.logout(); }

    res.json({ success: true, data: invitations });
  } catch (err) { next(err); }
});

function checkBodyForCalendar(structure: any): boolean {
  if (!structure) return false;
  if (structure.type === 'text/calendar' || structure.type === 'application/ics') return true;
  if (structure.disposition === 'attachment' && structure.parameters?.name?.endsWith('.ics')) return true;
  if (structure.childNodes) {
    for (const child of structure.childNodes) { if (checkBodyForCalendar(child)) return true; }
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════════════════════

planningRouter.get('/stats', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const now = new Date();
    const todayStart = toMySQLDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString());
    const todayEnd = toMySQLDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString());
    const weekEnd = toMySQLDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).toISOString());

    const todayRows: any = await db.query(
      `SELECT COUNT(DISTINCT ce.id) as count FROM calendar_events ce
       LEFT JOIN calendar_event_attendees cea ON cea.event_id = ce.id
       WHERE (ce.user_id = ? OR cea.user_id = ?) AND ce.start_at >= ? AND ce.start_at < ? AND ce.status != 'cancelled'`,
      [userId, userId, todayStart, todayEnd]
    );
    const weekRows: any = await db.query(
      `SELECT COUNT(DISTINCT ce.id) as count FROM calendar_events ce
       LEFT JOIN calendar_event_attendees cea ON cea.event_id = ce.id
       WHERE (ce.user_id = ? OR cea.user_id = ?) AND ce.start_at >= ? AND ce.start_at < ? AND ce.status != 'cancelled'`,
      [userId, userId, todayStart, weekEnd]
    );
    const inviteRows: any = await db.query(
      `SELECT COUNT(*) as count FROM calendar_event_attendees WHERE user_id = ? AND rsvp = 'pending'`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        today: todayRows[0]?.count || 0,
        this_week: weekRows[0]?.count || 0,
        pending_invites: inviteRows[0]?.count || 0,
      },
    });
  } catch (err) { next(err); }
});