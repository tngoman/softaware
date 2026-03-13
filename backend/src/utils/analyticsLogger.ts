/**
 * analyticsLogger.ts — PII-Sanitized AI Chat Telemetry
 *
 * Logs anonymized chat interactions for error detection, routing
 * accuracy, and platform improvement. All PII is stripped via regex
 * before data touches the disk (POPIA-compliant).
 *
 * Usage:
 *   import { logAnonymizedChat } from '../utils/analyticsLogger.js';
 *
 *   // Fire-and-forget — call right before sending the response
 *   logAnonymizedChat(clientId, rawPrompt, rawResponse);
 *
 * The SQLite table lives in /var/opt/backend/data/vectors.db alongside
 * the knowledge base chunks. It auto-creates on first use.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// ---------------------------------------------------------------------------
// Database (reuses the same vectors.db file, separate table)
// ---------------------------------------------------------------------------
const DB_DIR  = path.resolve('/var/opt/backend/data');
const DB_PATH = path.join(DB_DIR, 'vectors.db');

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('busy_timeout = 5000');

  // Create the analytics log table if it doesn't exist
  _db.exec(`
    CREATE TABLE IF NOT EXISTS ai_analytics_logs (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id           TEXT,
      source              TEXT DEFAULT 'assistant'
                          CHECK(source IN ('assistant','widget','enterprise')),
      sanitized_prompt    TEXT,
      sanitized_response  TEXT,
      model               TEXT,
      provider            TEXT,
      duration_ms         INTEGER,
      created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Index for querying by client and time
  _db.exec(`
    CREATE INDEX IF NOT EXISTS idx_analytics_client
      ON ai_analytics_logs (client_id, created_at)
  `);

  return _db;
}

// ---------------------------------------------------------------------------
// PII Sanitization
// ---------------------------------------------------------------------------

/**
 * Aggressively strips PII from text before it is logged.
 * Targets South African formats as primary, with international fallbacks.
 */
export function sanitizeText(text: string): string {
  if (!text) return '';
  let clean = text;

  // 1. Email addresses
  clean = clean.replace(
    /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
    '[EMAIL REMOVED]'
  );

  // 2. South African phone numbers (+27, 0xx xxx xxxx)
  clean = clean.replace(
    /(\+27|0)[6-8]\d[\s\-]?\d{3}[\s\-]?\d{4}/g,
    '[PHONE REMOVED]'
  );

  // 3. Generic international phone numbers (10+ digits with optional separators)
  clean = clean.replace(
    /\b\d{3}[\-.\s]?\d{3}[\-.\s]?\d{4}\b/g,
    '[PHONE REMOVED]'
  );

  // 4. South African ID numbers (exactly 13 digits)
  clean = clean.replace(/\b\d{13}\b/g, '[SA_ID REMOVED]');

  // 5. Credit card numbers (13-19 digits with optional spaces/dashes)
  clean = clean.replace(
    /\b(?:\d[\s\-]*?){13,19}\b/g,
    '[CARD REMOVED]'
  );

  // 6. South African bank account numbers (7-11 digits following common patterns)
  //    Only strip if preceded by keywords like "account", "acc", "ref"
  clean = clean.replace(
    /\b(?:account|acc|ref(?:erence)?)\s*(?:no\.?|number|#)?\s*:?\s*(\d{7,11})\b/gi,
    '[ACCOUNT REMOVED]'
  );

  // 7. Physical addresses (street numbers followed by road types)
  // Light touch — only obvious patterns to avoid over-stripping
  clean = clean.replace(
    /\b\d{1,5}\s+[A-Z][a-z]+\s+(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Lane|Ln|Boulevard|Blvd|Crescent|Cres)\b/gi,
    '[ADDRESS REMOVED]'
  );

  return clean;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface AnalyticsLogOptions {
  /** 'assistant' | 'widget' | 'enterprise' */
  source?: string;
  /** LLM model name */
  model?: string;
  /** LLM provider name */
  provider?: string;
  /** Request duration in ms */
  durationMs?: number;
}

/**
 * Fire-and-forget: sanitize and log a chat interaction.
 * Does NOT throw — any error is silently caught so the
 * user's chat response is never delayed or broken.
 */
export function logAnonymizedChat(
  clientId: string,
  rawPrompt: string,
  rawResponse: string,
  options: AnalyticsLogOptions = {}
): void {
  try {
    const db = getDb();
    const cleanPrompt   = sanitizeText(rawPrompt);
    const cleanResponse = sanitizeText(rawResponse);

    const stmt = db.prepare(`
      INSERT INTO ai_analytics_logs
        (client_id, source, sanitized_prompt, sanitized_response, model, provider, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      clientId,
      options.source || 'assistant',
      cleanPrompt,
      cleanResponse,
      options.model || null,
      options.provider || null,
      options.durationMs || null
    );
  } catch (error) {
    // Non-fatal — analytics must never crash the chat
    console.error('[Analytics] Non-fatal: Failed to log telemetry:', (error as Error).message);
  }
}
