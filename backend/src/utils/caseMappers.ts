/**
 * Shared Case Mapping Utilities
 *
 * Extracted from cases.ts and adminCases.ts to avoid duplication.
 */

/** Safely handle MySQL JSON columns (already parsed objects or JSON strings) */
export function safeJson(val: any, fallback: any = null) {
  if (val == null) return fallback;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return fallback; }
}

/** Map a raw DB case row to the frontend-expected shape */
export function mapCaseRow(row: any, aiOverride?: any) {
  if (!row) return row;

  // Derive source from type if the source column is still null
  const source = row.source || (() => {
    switch (row.type) {
      case 'auto_detected': return 'auto_detected';
      case 'monitoring': return 'health_monitor';
      default: return 'user_report';
    }
  })();

  return {
    ...row,
    // Always provide category & source (frontend relies on them)
    category: row.category || 'other',
    source,
    // Map DB field names → frontend field names
    user_rating: row.rating ?? null,
    user_feedback: row.rating_comment ?? null,
    page_url: row.url ?? null,
    // Reporter / assignee aliases already come from JOINs:
    reporter_name: row.reported_by_name ?? null,
    reporter_email: row.reported_by_email ?? null,
    assignee_name: row.assigned_to_name ?? null,
    // Parse JSON columns safely
    ai_analysis: aiOverride !== undefined ? aiOverride : safeJson(row.ai_analysis, null),
    metadata: safeJson(row.metadata, {}),
    tags: safeJson(row.tags, []),
    browser_info: safeJson(row.browser_info, {}),
  };
}
