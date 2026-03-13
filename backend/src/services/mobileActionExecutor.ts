/**
 * Mobile AI Assistant — Tool Execution Engine
 *
 * Executes the function calls emitted by the LLM, with security checks
 * ensuring ownership and role-based access before any database mutation.
 *
 * Every executor follows the pattern:
 *   1. Validate arguments
 *   2. Security check (ownership for clients, admin role for staff)
 *   3. Execute the database operation / proxy call
 *   4. Return a human-readable result string
 *
 * Task tools (v2.0):
 *   - READ:  Direct queries to local MySQL `local_tasks` table
 *   - WRITE: Proxy to external APIs via `task_sources` (source-level API key auth)
 *   - LOCAL: Bookmark, priority, tags, color labels managed locally (no external call)
 *   - No per-user software tokens required — API keys are resolved from task_sources table
 */

import { db, toMySQLDate } from '../db/mysql.js';
import { getAssistantKnowledgeHealth } from './knowledgeCategorizer.js';
import {
  createEndpoint,
  type EndpointCreateInput,
} from './enterpriseEndpoints.js';
import { env } from '../config/env.js';
import { sendEmail } from './emailService.js';
import { siteBuilderService } from './siteBuilderService.js';
import { syncAllSources } from './taskSyncService.js';
import { createNotificationWithPush } from './firebaseService.js';
import { randomUUID } from 'crypto';
import type { ToolCall, ToolResult } from './actionRouter.js';
import type { MobileRole } from './mobileTools.js';

// ============================================================================
// Types
// ============================================================================

export interface MobileExecutionContext {
  userId: string;
  role: MobileRole;
  /** The selected assistant ID (if any) */
  assistantId?: string;
}

// ============================================================================
// Main Dispatcher
// ============================================================================

/**
 * Execute a tool call from the mobile AI assistant.
 * Routes to the correct handler and enforces role + ownership checks.
 */
export async function executeMobileAction(
  toolCall: ToolCall,
  ctx: MobileExecutionContext,
): Promise<ToolResult> {
  const { name, arguments: args } = toolCall;
  console.log(`[MobileAction] Executing ${name} for user ${ctx.userId} (${ctx.role})`);

  try {
    switch (name) {
      // ----- Client tools -----
      case 'list_my_assistants':
        return await execListMyAssistants(ctx);

      case 'toggle_assistant_status':
        return await execToggleAssistantStatus(args, ctx);

      case 'get_usage_stats':
        return await execGetUsageStats(ctx);

      case 'list_failed_jobs':
        return await execListFailedJobs(ctx);

      case 'retry_failed_ingestion':
        return await execRetryFailedIngestion(args, ctx);

      // ----- Client lead management tools -----
      case 'list_leads':
        return await execListLeads(args, ctx);

      case 'get_lead_details':
        return await execGetLeadDetails(args, ctx);

      case 'update_lead_status':
        return await execUpdateLeadStatus(args, ctx);

      case 'get_lead_stats':
        return await execGetLeadStats(ctx);

      // ----- Client email tools -----
      case 'send_followup_email':
        return await execSendFollowupEmail(args, ctx);

      case 'send_info_email':
        return await execSendInfoEmail(args, ctx);

      // ----- Client site builder tools -----
      case 'list_my_sites':
        return await execListMySites(ctx);

      case 'get_site_details':
        return await execGetSiteDetails(args, ctx);

      case 'update_site_field':
        return await execUpdateSiteField(args, ctx);

      case 'regenerate_site':
        return await execRegenerateSite(args, ctx);

      case 'deploy_site':
        return await execDeploySite(args, ctx);

      case 'get_site_deployments':
        return await execGetSiteDeployments(args, ctx);

      // ----- Staff task tools (v2.0 — comprehensive) -----
      case 'list_tasks':
        return requireStaff(ctx, () => execListTasks(args, ctx));

      case 'get_task':
        return requireStaff(ctx, () => execGetTask(args));

      case 'create_task':
        return requireStaff(ctx, () => execCreateTask(args, ctx));

      case 'update_task':
        return requireStaff(ctx, () => execUpdateTask(args, ctx));

      case 'delete_task':
        return requireStaff(ctx, () => execDeleteTask(args));

      case 'get_task_comments':
        return requireStaff(ctx, () => execGetTaskComments(args));

      case 'add_task_comment':
        return requireStaff(ctx, () => execAddTaskComment(args, ctx));

      case 'bookmark_task':
        return requireStaff(ctx, () => execBookmarkTask(args));

      case 'set_task_priority':
        return requireStaff(ctx, () => execSetTaskPriority(args));

      case 'set_task_color':
        return requireStaff(ctx, () => execSetTaskColor(args));

      case 'set_task_tags':
        return requireStaff(ctx, () => execSetTaskTags(args));

      case 'start_task':
        return requireStaff(ctx, () => execStartTask(args));

      case 'complete_task':
        return requireStaff(ctx, () => execCompleteTask(args));

      case 'approve_task':
        return requireStaff(ctx, () => execApproveTask(args));

      case 'get_task_stats':
        return requireStaff(ctx, () => execGetTaskStats());

      case 'get_pending_approvals':
        return requireStaff(ctx, () => execGetPendingApprovals());

      case 'get_task_tags':
        return requireStaff(ctx, () => execGetTaskTags());

      case 'sync_tasks':
        return requireStaff(ctx, () => execSyncTasks());

      case 'get_sync_status':
        return requireStaff(ctx, () => execGetSyncStatus());

      case 'stage_tasks_for_invoice':
        return requireStaff(ctx, () => execStageTasksForInvoice(args));

      case 'get_staged_invoices':
        return requireStaff(ctx, () => execGetStagedInvoices());

      case 'process_staged_invoices':
        return requireStaff(ctx, () => execProcessStagedInvoices());

      // ----- Staff admin tools -----
      case 'search_clients':
        return requireStaff(ctx, () => execSearchClients(args));

      case 'suspend_client_account':
        return requireStaff(ctx, () => execSuspendClientAccount(args, ctx));

      case 'check_client_health':
        return requireStaff(ctx, () => execCheckClientHealth(args));

      case 'generate_enterprise_endpoint':
        return requireStaff(ctx, () => execGenerateEnterpriseEndpoint(args));

      // ----- Staff cases tools -----
      case 'list_cases':
        return requireStaff(ctx, () => execListCases(args));

      case 'get_case_details':
        return requireStaff(ctx, () => execGetCaseDetails(args));

      case 'update_case':
        return requireStaff(ctx, () => execUpdateCase(args, ctx));

      case 'add_case_comment':
        return requireStaff(ctx, () => execAddCaseComment(args, ctx));

      // ----- Staff CRM tools -----
      case 'list_contacts':
        return requireStaff(ctx, () => execListContacts(args));

      case 'get_contact_details':
        return requireStaff(ctx, () => execGetContactDetails(args));

      case 'create_contact':
        return requireStaff(ctx, () => execCreateContact(args));

      // ----- Staff finance tools -----
      case 'list_quotations':
        return requireStaff(ctx, () => execListQuotations(args));

      case 'get_quotation_details':
        return requireStaff(ctx, () => execGetQuotationDetails(args));

      case 'list_invoices':
        return requireStaff(ctx, () => execListInvoices(args));

      case 'get_invoice_details':
        return requireStaff(ctx, () => execGetInvoiceDetails(args));

      case 'search_pricing':
        return requireStaff(ctx, () => execSearchPricing(args));

      // ----- Staff scheduling tools -----
      case 'list_scheduled_calls':
        return requireStaff(ctx, () => execListScheduledCalls(args, ctx));

      case 'create_scheduled_call':
        return requireStaff(ctx, () => execCreateScheduledCall(args, ctx));

      // ----- Staff chat tools -----
      case 'list_conversations':
        return requireStaff(ctx, () => execListConversations(args, ctx));

      case 'send_chat_message':
        return requireStaff(ctx, () => execSendChatMessage(args, ctx));

      // ----- Staff bug tracking tools -----
      case 'list_bugs':
        return requireStaff(ctx, () => execListBugs(args));

      case 'get_bug_details':
        return requireStaff(ctx, () => execGetBugDetails(args));

      case 'create_bug':
        return requireStaff(ctx, () => execCreateBug(args, ctx));

      case 'update_bug':
        return requireStaff(ctx, () => execUpdateBug(args, ctx));

      case 'add_bug_comment':
        return requireStaff(ctx, () => execAddBugComment(args, ctx));

      case 'update_bug_workflow':
        return requireStaff(ctx, () => execUpdateBugWorkflow(args, ctx));

      case 'get_bug_stats':
        return requireStaff(ctx, () => execGetBugStats());

      default:
        return { success: false, message: `Unknown tool: ${name}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[MobileAction] ${name} failed:`, msg);
    return { success: false, message: `Action failed: ${msg}` };
  }
}

// ============================================================================
// Guard Helpers
// ============================================================================

/** Rejects the call if the user is not staff. */
async function requireStaff(
  ctx: MobileExecutionContext,
  fn: () => Promise<ToolResult>,
): Promise<ToolResult> {
  if (ctx.role !== 'staff') {
    return { success: false, message: 'This action requires staff privileges.' };
  }
  return fn();
}

/**
 * Verify the logged-in user owns the assistant.
 * Staff bypass ownership checks.
 */
async function verifyAssistantOwnership(
  assistantId: string,
  ctx: MobileExecutionContext,
): Promise<{ owned: boolean; exists: boolean }> {
  const row = await db.queryOne<{ id: string; userId: string | null }>(
    'SELECT id, userId FROM assistants WHERE id = ?',
    [assistantId],
  );
  if (!row) return { owned: false, exists: false };
  if (ctx.role === 'staff') return { owned: true, exists: true };
  return { owned: row.userId === ctx.userId, exists: true };
}

/**
 * Verify the logged-in user owns the ingestion job (via its assistant).
 * Staff bypass ownership checks.
 */
async function verifyJobOwnership(
  jobId: string,
  ctx: MobileExecutionContext,
): Promise<{ owned: boolean; exists: boolean; assistantId?: string }> {
  const row = await db.queryOne<{ id: string; assistant_id: string }>(
    'SELECT ij.id, ij.assistant_id FROM ingestion_jobs ij WHERE ij.id = ?',
    [jobId],
  );
  if (!row) return { owned: false, exists: false };
  if (ctx.role === 'staff') return { owned: true, exists: true, assistantId: row.assistant_id };
  const ownership = await verifyAssistantOwnership(row.assistant_id, ctx);
  return { ...ownership, assistantId: row.assistant_id };
}

// ============================================================================
// Client Tool Executors
// ============================================================================

async function execListMyAssistants(ctx: MobileExecutionContext): Promise<ToolResult> {
  const assistants = await db.query<{
    id: string; name: string; status: string; tier: string; pages_indexed: number;
  }>(
    `SELECT id, name, status, tier, pages_indexed
     FROM assistants
     WHERE userId = ?
     ORDER BY created_at DESC`,
    [ctx.userId],
  );

  if (assistants.length === 0) {
    return {
      success: true,
      message: 'You don\'t have any assistants yet. You can create one from the portal dashboard.',
    };
  }

  const lines = assistants.map(
    (a, i) =>
      `${i + 1}. **${a.name}** — ${a.status} (${a.tier} tier, ${a.pages_indexed} pages indexed)\n   ID: ${a.id}`,
  );

  return {
    success: true,
    message: `You have ${assistants.length} assistant(s):\n\n${lines.join('\n\n')}`,
    data: { assistants },
  };
}

async function execToggleAssistantStatus(
  args: Record<string, unknown>,
  ctx: MobileExecutionContext,
): Promise<ToolResult> {
  const assistantId = String(args.assistantId || '');
  const status = String(args.status || '');

  if (!assistantId) return { success: false, message: 'Please provide the assistant ID.' };
  if (!['active', 'suspended'].includes(status)) {
    return { success: false, message: 'Status must be "active" or "suspended".' };
  }

  // SECURITY CHECK: ownership
  const check = await verifyAssistantOwnership(assistantId, ctx);
  if (!check.exists) return { success: false, message: 'Assistant not found.' };
  if (!check.owned) return { success: false, message: 'You do not have permission to modify this assistant.' };

  await db.execute(
    'UPDATE assistants SET status = ?, updated_at = ? WHERE id = ?',
    [status, toMySQLDate(new Date()), assistantId],
  );

  const action = status === 'active' ? 'activated' : 'suspended';
  return { success: true, message: `The assistant has been successfully ${action}.` };
}

async function execGetUsageStats(ctx: MobileExecutionContext): Promise<ToolResult> {
  // Find the user's team subscription
  const membership = await db.queryOne<{ teamId: string }>(
    'SELECT teamId FROM team_members WHERE userId = ? LIMIT 1',
    [ctx.userId],
  );

  let tier = 'FREE';
  let messageLimitMonthly = 500;
  let pageLimit = 50;
  let assistantLimit = 5;

  if (membership) {
    const sub = await db.queryOne<{ tier: string; maxAgents: number }>(
      `SELECT sp.tier, sp.maxAgents
       FROM subscriptions s
       JOIN subscription_plans sp ON s.planId = sp.id
       WHERE s.teamId = ? AND s.status IN ('TRIAL','ACTIVE')
       ORDER BY s.createdAt DESC LIMIT 1`,
      [membership.teamId],
    );
    if (sub) {
      tier = sub.tier;
      assistantLimit = sub.maxAgents || 5;
      if (tier === 'TEAM') { messageLimitMonthly = 5000; pageLimit = 500; }
      else if (tier === 'ENTERPRISE') { messageLimitMonthly = 50000; pageLimit = 5000; }
    }
  }

  const assistantCount = await db.queryOne<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM assistants WHERE userId = ?',
    [ctx.userId],
  );

  const pagesIndexed = await db.queryOne<{ cnt: number }>(
    `SELECT COALESCE(SUM(a.pages_indexed), 0) as cnt
     FROM assistants a WHERE a.userId = ?`,
    [ctx.userId],
  );

  const summary = [
    `📊 **Your Usage Summary**`,
    `Plan: ${tier}`,
    `Assistants: ${assistantCount?.cnt ?? 0} / ${assistantLimit}`,
    `Pages indexed: ${pagesIndexed?.cnt ?? 0} / ${pageLimit}`,
    `Monthly message limit: ${messageLimitMonthly}`,
  ].join('\n');

  return {
    success: true,
    message: summary,
    data: {
      tier,
      assistants: { used: assistantCount?.cnt ?? 0, limit: assistantLimit },
      pagesIndexed: { used: pagesIndexed?.cnt ?? 0, limit: pageLimit },
      messageLimitMonthly,
    },
  };
}

async function execListFailedJobs(ctx: MobileExecutionContext): Promise<ToolResult> {
  const jobs = await db.query<{
    id: string; source: string; job_type: string; error_message: string | null;
    assistant_id: string; retry_count: number; created_at: string;
  }>(
    `SELECT ij.id, ij.source, ij.job_type, ij.error_message, ij.assistant_id,
            ij.retry_count, ij.created_at
     FROM ingestion_jobs ij
     JOIN assistants a ON a.id COLLATE utf8mb4_0900_ai_ci = ij.assistant_id
     WHERE a.userId = ? AND ij.status = 'failed'
     ORDER BY ij.created_at DESC
     LIMIT 20`,
    [ctx.userId],
  );

  if (jobs.length === 0) {
    return { success: true, message: 'No failed ingestion jobs found. Everything looks good! ✅' };
  }

  const lines = jobs.map(
    (j, i) =>
      `${i + 1}. **${j.source}** (${j.job_type}) — ${j.error_message || 'Unknown error'}\n   Job ID: ${j.id} | Retries: ${j.retry_count}`,
  );

  return {
    success: true,
    message: `Found ${jobs.length} failed job(s):\n\n${lines.join('\n\n')}`,
    data: { jobs },
  };
}

async function execRetryFailedIngestion(
  args: Record<string, unknown>,
  ctx: MobileExecutionContext,
): Promise<ToolResult> {
  const jobId = String(args.jobId || '');
  if (!jobId) return { success: false, message: 'Please provide the ingestion job ID.' };

  // SECURITY CHECK: ownership
  const check = await verifyJobOwnership(jobId, ctx);
  if (!check.exists) return { success: false, message: 'Ingestion job not found.' };
  if (!check.owned) return { success: false, message: 'You do not have permission to retry this job.' };

  // Verify the job is actually failed
  const job = await db.queryOne<{ status: string; retry_count: number }>(
    'SELECT status, retry_count FROM ingestion_jobs WHERE id = ?',
    [jobId],
  );
  if (!job) return { success: false, message: 'Job not found.' };
  if (job.status !== 'failed') {
    return { success: false, message: `This job is currently "${job.status}" — only failed jobs can be retried.` };
  }

  // Reset the job to pending so the ingestion worker picks it up
  await db.execute(
    `UPDATE ingestion_jobs SET status = 'pending', retry_count = 0, error_message = NULL, updated_at = ? WHERE id = ?`,
    [toMySQLDate(new Date()), jobId],
  );

  return {
    success: true,
    message: 'The ingestion job has been pushed back into the queue. It will be processed shortly.',
  };
}

// ============================================================================
// Task Proxy Helpers
// ============================================================================

// ============================================================================
// Task Source Resolution (v2.0 — source-level API key auth)
// ============================================================================

interface TaskSourceRow {
  id: number;
  base_url: string;
  api_key: string;
  software_id: number | null;
  name: string;
}

/**
 * Resolve the first available task source (with API key) for external proxy calls.
 * Optionally filter by software_id. Falls back to the first enabled source.
 */
async function resolveTaskSourceForTools(softwareId?: number | null): Promise<TaskSourceRow | null> {
  if (softwareId) {
    const source = await db.queryOne<TaskSourceRow>(
      `SELECT id, base_url, api_key, software_id, name
       FROM task_sources
       WHERE software_id = ? AND sync_enabled = 1 AND api_key IS NOT NULL AND api_key != ''
       ORDER BY id ASC LIMIT 1`,
      [softwareId],
    );
    if (source) return source;
  }

  // Fall back to first enabled source with an API key
  return db.queryOne<TaskSourceRow>(
    `SELECT id, base_url, api_key, software_id, name
     FROM task_sources
     WHERE sync_enabled = 1 AND api_key IS NOT NULL AND api_key != ''
     ORDER BY id ASC LIMIT 1`,
  );
}

/**
 * Proxy a request to the external tasks-api using source-level API key auth.
 * Uses X-API-Key header (v2.0 pattern, not Bearer token).
 */
async function taskProxyV2(
  baseUrl: string,
  path: string,
  method: string,
  apiKey: string,
  body?: any,
): Promise<{ status: number; data: any }> {
  const url = `${baseUrl.replace(/\/+$/, '')}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-API-Key': apiKey,
  };

  const opts: RequestInit = { method, headers };
  if (body && method !== 'GET') {
    opts.body = JSON.stringify(body);
  }

  const resp = await fetch(url, opts);
  const ct = resp.headers.get('content-type') || '';
  const data = ct.includes('json') ? await resp.json() : await resp.text();
  return { status: resp.status, data };
}

const NO_SOURCE_MSG = 'No task source is configured yet. Ask an admin to set up a task source in the Tasks settings (Dashboard → Tasks → Sources).';

/**
 * Resolve a local task by ID — tries local DB id first, then external_id
 */
async function resolveLocalTask(taskId: string): Promise<any | null> {
  // Try by local id first
  let task = await db.queryOne<any>(
    `SELECT t.*, s.name as source_name, s.source_type
     FROM local_tasks t
     LEFT JOIN task_sources s ON s.id = t.source_id
     WHERE t.id = ? AND t.task_deleted = 0`,
    [taskId],
  );
  if (task) return task;

  // Try by external_id
  task = await db.queryOne<any>(
    `SELECT t.*, s.name as source_name, s.source_type
     FROM local_tasks t
     LEFT JOIN task_sources s ON s.id = t.source_id
     WHERE t.external_id = ? AND t.task_deleted = 0`,
    [taskId],
  );
  return task;
}

// ============================================================================
// Staff Task Tool Executors (v2.0 — Local DB reads, proxy writes)
// ============================================================================

async function execListTasks(
  args: Record<string, unknown>,
  ctx: MobileExecutionContext,
): Promise<ToolResult> {
  const conditions: string[] = ['t.task_deleted = 0'];
  const params: any[] = [];

  // Status filter
  const statusFilter = String(args.status || '').toLowerCase();
  if (statusFilter) {
    const normalized = statusFilter === 'in-progress' ? 'progress' : statusFilter;
    conditions.push('t.status = ?');
    params.push(normalized);
  }

  // Type filter
  if (args.type) {
    conditions.push('t.type = ?');
    params.push(String(args.type));
  }

  // Priority filter
  if (args.priority) {
    conditions.push('t.priority = ?');
    params.push(String(args.priority));
  }

  // Workflow phase filter
  if (args.workflow_phase) {
    conditions.push('t.workflow_phase = ?');
    params.push(String(args.workflow_phase));
  }

  // Bookmarked filter
  if (String(args.bookmarked) === '1') {
    conditions.push('t.is_bookmarked = 1');
  }

  // Tag filter
  if (args.tag) {
    conditions.push('JSON_CONTAINS(t.local_tags, JSON_QUOTE(?))');
    params.push(String(args.tag));
  }

  // Search filter
  if (args.search) {
    const search = `%${String(args.search)}%`;
    conditions.push('(t.title LIKE ? OR t.description LIKE ? OR t.external_id LIKE ?)');
    params.push(search, search, search);
  }

  // Assigned-to-me filter
  if (String(args.assignedToMe) === 'true') {
    const user = await db.queryOne<{ name: string | null; email: string }>(
      'SELECT name, email FROM users WHERE id = ?',
      [ctx.userId],
    );
    if (user) {
      const userName = (user.name || user.email || '').toLowerCase();
      conditions.push('LOWER(t.assigned_to_name) LIKE ?');
      params.push(`%${userName}%`);
    }
  }

  const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 50);
  const where = `WHERE ${conditions.join(' AND ')}`;

  // Count total
  const [countRow] = await db.query<any>(
    `SELECT COUNT(*) as total FROM local_tasks t ${where}`,
    params,
  );
  const total = countRow?.total || 0;

  // Fetch tasks
  const tasks = await db.query<any>(
    `SELECT t.*, s.name as source_name
     FROM local_tasks t
     LEFT JOIN task_sources s ON s.id = t.source_id
     ${where}
     ORDER BY t.task_order ASC, t.external_id DESC
     LIMIT ?`,
    [...params, limit],
  );

  if (tasks.length === 0) {
    return { success: true, message: 'No tasks found matching your criteria.' };
  }

  // Format for display
  const display = tasks.map((t: any, i: number) => {
    const status = t.status === 'progress' ? 'in-progress' : (t.status || 'unknown');
    const phase = t.workflow_phase ? ` [${t.workflow_phase}]` : '';
    const assignee = t.assigned_to_name ? ` → ${t.assigned_to_name}` : '';
    const priority = t.priority && t.priority !== 'normal' ? ` ⚡${t.priority}` : '';
    const bookmark = t.is_bookmarked ? ' ⭐' : '';
    const tags = t.local_tags ? (() => { try { const arr = typeof t.local_tags === 'string' ? JSON.parse(t.local_tags) : t.local_tags; return arr.length ? ` [${arr.join(', ')}]` : ''; } catch { return ''; } })() : '';
    return `${i + 1}. **${t.title}** — ${status}${phase}${priority}${assignee}${bookmark}${tags}\n   ID: ${t.external_id || t.id}`;
  });

  return {
    success: true,
    message: `Found ${total} task(s)${total > limit ? ` (showing first ${limit})` : ''}:\n\n${display.join('\n\n')}`,
    data: { tasks: tasks.slice(0, limit), total },
  };
}

async function execGetTask(args: Record<string, unknown>): Promise<ToolResult> {
  const taskId = String(args.taskId || '').trim();
  if (!taskId) return { success: false, message: 'Task ID is required.' };

  const task = await resolveLocalTask(taskId);
  if (!task) return { success: false, message: `Task ${taskId} not found.` };

  const priority = task.priority || 'normal';
  const bookmark = task.is_bookmarked ? '⭐ Bookmarked' : '';
  const color = task.color_label ? `🎨 ${task.color_label}` : '';
  const tags = task.local_tags ? (() => { try { const arr = typeof task.local_tags === 'string' ? JSON.parse(task.local_tags) : task.local_tags; return arr.length ? arr.join(', ') : ''; } catch { return ''; } })() : '';

  const lines = [
    `**${task.title}** (ID: ${task.external_id || task.id})`,
    `**Status:** ${task.status === 'progress' ? 'in-progress' : task.status}`,
    `**Type:** ${task.type || '—'}`,
    `**Priority:** ${priority}`,
    task.workflow_phase ? `**Phase:** ${task.workflow_phase}` : null,
    task.assigned_to_name ? `**Assigned to:** ${task.assigned_to_name}` : null,
    task.estimated_hours ? `**Estimated:** ${task.estimated_hours}h` : null,
    task.hours ? `**Hours logged:** ${task.hours}h` : null,
    task.start_date ? `**Start:** ${task.start_date}` : null,
    task.end_date ? `**Due:** ${task.end_date}` : null,
    bookmark || null,
    color || null,
    tags ? `**Tags:** ${tags}` : null,
    task.source_name ? `**Source:** ${task.source_name}` : null,
    task.description ? `\n**Description:**\n${String(task.description).replace(/<[^>]*>/g, '').slice(0, 500)}` : null,
    task.notes ? `\n**Notes:**\n${String(task.notes).slice(0, 300)}` : null,
  ].filter(Boolean);

  return {
    success: true,
    message: lines.join('\n'),
    data: { task },
  };
}

async function execCreateTask(
  args: Record<string, unknown>,
  ctx: MobileExecutionContext,
): Promise<ToolResult> {
  const softwareId = args.software_id ? Number(args.software_id) : null;
  const source = await resolveTaskSourceForTools(softwareId);
  if (!source) return { success: false, message: NO_SOURCE_MSG };

  const title = String(args.title || '').trim();
  if (!title) return { success: false, message: 'Task title is required.' };

  const taskType = String(args.type || 'development');

  // Get the creator's name
  const user = await db.queryOne<{ name: string | null; email: string }>(
    'SELECT name, email FROM users WHERE id = ?',
    [ctx.userId],
  );
  const creatorName = user?.name || user?.email || 'Staff';

  const taskPayload: Record<string, any> = {
    task_name: title,
    task_description: String(args.description || ''),
    task_type: taskType,
    task_status: String(args.status || 'new'),
    task_hours: '0',
    task_estimated_hours: String(args.estimated_hours || '0'),
    task_notes: '',
    task_color: '',
    task_created_by_name: creatorName,
    user_name: creatorName,
  };

  if (args.workflow_phase) taskPayload.workflow_phase = String(args.workflow_phase);
  if (args.assigned_to) taskPayload.assigned_to = parseInt(String(args.assigned_to), 10);

  const result = await taskProxyV2(source.base_url, '/api/tasks-api', 'POST', source.api_key, taskPayload);

  if (result.status >= 400) {
    return { success: false, message: `Failed to create task: ${typeof result.data === 'string' ? result.data : JSON.stringify(result.data?.message || result.data?.error || 'Unknown error')}` };
  }

  const newTaskId = result.data?.id || result.data?.data?.id || result.data?.task_id || 'unknown';

  // Fire-and-forget: trigger a sync so the new task appears in local DB
  syncAllSources().catch(err => console.error('[MobileAction] Post-create sync failed:', err));

  return {
    success: true,
    message: `✅ Task created successfully!\n\n**Title:** ${title}\n**Type:** ${taskType}\n**Task ID:** ${newTaskId}\n**Source:** ${source.name}`,
    data: { taskId: newTaskId, task: result.data },
  };
}

async function execUpdateTask(
  args: Record<string, unknown>,
  ctx: MobileExecutionContext,
): Promise<ToolResult> {
  const taskId = String(args.taskId || '').trim();
  if (!taskId) return { success: false, message: 'Task ID is required.' };

  // Resolve the local task to get its local id and source info
  const localTask = await resolveLocalTask(taskId);
  if (!localTask) return { success: false, message: `Task ${taskId} not found.` };

  const changes: string[] = [];
  const localUpdates: string[] = [];
  const localValues: any[] = [];

  // Handle local-only fields (priority)
  if (args.priority) {
    localUpdates.push('priority = ?');
    localValues.push(String(args.priority));
    changes.push(`Priority → ${args.priority}`);
  }

  // Build external update payload for fields that sync
  const externalChanges: Record<string, any> = {};
  if (args.status) {
    const status = String(args.status);
    externalChanges.task_status = status === 'in-progress' ? 'progress' : status;
    localUpdates.push('status = ?');
    localValues.push(externalChanges.task_status);
    changes.push(`Status → ${status}`);
  }
  if (args.workflow_phase) {
    externalChanges.workflow_phase = String(args.workflow_phase);
    localUpdates.push('workflow_phase = ?');
    localValues.push(externalChanges.workflow_phase);
    changes.push(`Phase → ${args.workflow_phase}`);
  }
  if (args.assigned_to) {
    externalChanges.assigned_to = parseInt(String(args.assigned_to), 10);
    changes.push(`Assigned to → user ${args.assigned_to}`);
  }
  if (args.hours) {
    externalChanges.task_hours = String(args.hours);
    localUpdates.push('hours = ?');
    localValues.push(String(args.hours));
    changes.push(`Hours → ${args.hours}`);
  }
  if (args.description) {
    externalChanges.task_description = String(args.description);
    localUpdates.push('description = ?');
    localValues.push(String(args.description));
    changes.push('Description updated');
  }
  if (args.title) {
    externalChanges.task_name = String(args.title);
    localUpdates.push('title = ?');
    localValues.push(String(args.title));
    changes.push(`Title → ${args.title}`);
  }

  if (changes.length === 0) {
    return { success: false, message: 'No changes specified. Provide at least one field to update.' };
  }

  // Update local DB immediately
  if (localUpdates.length > 0) {
    localUpdates.push('local_dirty = 1');
    localValues.push(localTask.id);
    await db.execute(
      `UPDATE local_tasks SET ${localUpdates.join(', ')} WHERE id = ?`,
      localValues,
    );
  }

  // If there are external changes, proxy to external API
  if (Object.keys(externalChanges).length > 0 && localTask.external_id) {
    const source = await resolveTaskSourceForTools(localTask.software_id);
    if (source) {
      const updatePayload = { ...externalChanges, task_id: parseInt(localTask.external_id, 10) };
      const result = await taskProxyV2(source.base_url, `/api/tasks-api/${localTask.external_id}`, 'PUT', source.api_key, updatePayload);

      if (result.status >= 400) {
        return {
          success: true,
          message: `⚠️ Task #${taskId} updated locally, but external sync failed: ${typeof result.data === 'string' ? result.data : JSON.stringify(result.data?.message || result.data?.error || 'Unknown error')}\n\nLocal changes:\n${changes.map(c => `  • ${c}`).join('\n')}\n\n_Changes will sync on next automatic sync._`,
          data: { taskId, changes, syncFailed: true },
        };
      }

      // Send notifications for assignment/phase changes (fire & forget)
      if (externalChanges.assigned_to) {
        createNotificationWithPush(String(externalChanges.assigned_to), {
          title: 'Task Assigned to You',
          message: `${(await db.queryOne<any>('SELECT name FROM users WHERE id = ?', [ctx.userId]))?.name || 'Someone'} assigned you: ${localTask.title}`,
          type: 'info',
          data: { type: 'task_assigned', task_id: String(localTask.external_id), link: '/tasks' },
        }).catch(() => {});
      }
    }
  }

  return {
    success: true,
    message: `✅ Task #${taskId} updated:\n${changes.map(c => `  • ${c}`).join('\n')}`,
    data: { taskId, changes },
  };
}

async function execDeleteTask(args: Record<string, unknown>): Promise<ToolResult> {
  const taskId = String(args.taskId || '').trim();
  if (!taskId) return { success: false, message: 'Task ID is required.' };

  const task = await resolveLocalTask(taskId);
  if (!task) return { success: false, message: `Task ${taskId} not found.` };

  await db.execute(
    'UPDATE local_tasks SET task_deleted = 1, local_dirty = 1, updated_at = NOW() WHERE id = ?',
    [task.id],
  );

  return {
    success: true,
    message: `🗑️ Task "${task.title}" (ID: ${task.external_id || task.id}) has been deleted.`,
    data: { taskId: task.id },
  };
}

async function execGetTaskComments(args: Record<string, unknown>): Promise<ToolResult> {
  const taskId = String(args.taskId || '').trim();
  if (!taskId) return { success: false, message: 'Task ID is required.' };

  // Resolve the external_id for the proxy call
  const localTask = await resolveLocalTask(taskId);
  const externalId = localTask?.external_id || taskId;

  const source = await resolveTaskSourceForTools(localTask?.software_id);
  if (!source) return { success: false, message: NO_SOURCE_MSG };

  const result = await taskProxyV2(source.base_url, `/api/tasks-api/${externalId}/comments`, 'GET', source.api_key);

  if (result.status >= 400) {
    return { success: false, message: `Failed to fetch comments: HTTP ${result.status}` };
  }

  let comments: any[] = [];
  if (Array.isArray(result.data)) comments = result.data;
  else if (result.data?.data && Array.isArray(result.data.data)) comments = result.data.data;
  else if (result.data?.comments && Array.isArray(result.data.comments)) comments = result.data.comments;

  if (comments.length === 0) {
    return { success: true, message: `No comments found on task #${externalId}.` };
  }

  const display = comments.slice(0, 20).map((c: any, i: number) => {
    const author = c.author_name || c.user_name || 'Unknown';
    const date = c.created_at ? ` (${String(c.created_at).slice(0, 10)})` : '';
    const internal = c.is_internal ? ' 🔒' : '';
    const text = String(c.content || c.comment_text || '').replace(/<[^>]*>/g, '').slice(0, 200);
    return `${i + 1}. **${author}**${date}${internal}: ${text}`;
  });

  return {
    success: true,
    message: `${comments.length} comment(s) on task #${externalId}:\n\n${display.join('\n\n')}`,
    data: { comments: comments.slice(0, 20) },
  };
}

async function execAddTaskComment(
  args: Record<string, unknown>,
  ctx: MobileExecutionContext,
): Promise<ToolResult> {
  const taskId = String(args.taskId || '').trim();
  const content = String(args.content || '').trim();
  if (!taskId) return { success: false, message: 'Task ID is required.' };
  if (!content) return { success: false, message: 'Comment content is required.' };

  const localTask = await resolveLocalTask(taskId);
  const externalId = localTask?.external_id || taskId;

  const source = await resolveTaskSourceForTools(localTask?.software_id);
  if (!source) return { success: false, message: NO_SOURCE_MSG };

  const isInternal = String(args.is_internal || 'true') === 'true' ? 1 : 0;

  const commentPayload = {
    content,
    is_internal: isInternal,
    time_spent: 0,
    parent_comment_id: null,
  };

  const result = await taskProxyV2(
    source.base_url,
    `/api/tasks-api/${externalId}/comments`,
    'POST',
    source.api_key,
    commentPayload,
  );

  if (result.status >= 400) {
    return { success: false, message: `Failed to add comment: ${typeof result.data === 'string' ? result.data : JSON.stringify(result.data?.message || result.data?.error || 'Unknown error')}` };
  }

  return {
    success: true,
    message: `💬 Comment added to task #${externalId}${isInternal ? ' (internal note)' : ''}.`,
    data: { taskId: externalId, commentId: result.data?.comment_id || result.data?.id },
  };
}

// ── Local Enhancement Executors ─────────────────────────────────

async function execBookmarkTask(args: Record<string, unknown>): Promise<ToolResult> {
  const taskId = String(args.taskId || '').trim();
  if (!taskId) return { success: false, message: 'Task ID is required.' };

  const task = await resolveLocalTask(taskId);
  if (!task) return { success: false, message: `Task ${taskId} not found.` };

  const newVal = task.is_bookmarked ? 0 : 1;
  await db.execute('UPDATE local_tasks SET is_bookmarked = ? WHERE id = ?', [newVal, task.id]);

  return {
    success: true,
    message: newVal
      ? `⭐ Task "${task.title}" bookmarked.`
      : `Task "${task.title}" unbookmarked.`,
    data: { taskId: task.id, is_bookmarked: newVal },
  };
}

async function execSetTaskPriority(args: Record<string, unknown>): Promise<ToolResult> {
  const taskId = String(args.taskId || '').trim();
  const priority = String(args.priority || '').trim();
  if (!taskId) return { success: false, message: 'Task ID is required.' };

  const validPriorities = ['urgent', 'high', 'normal', 'low'];
  if (!validPriorities.includes(priority)) {
    return { success: false, message: `Invalid priority. Use: ${validPriorities.join(', ')}` };
  }

  const task = await resolveLocalTask(taskId);
  if (!task) return { success: false, message: `Task ${taskId} not found.` };

  await db.execute('UPDATE local_tasks SET priority = ? WHERE id = ?', [priority, task.id]);

  const emoji = priority === 'urgent' ? '🔴' : priority === 'high' ? '🟠' : priority === 'normal' ? '🟢' : '⚪';
  return {
    success: true,
    message: `${emoji} Task "${task.title}" priority set to **${priority}**.`,
    data: { taskId: task.id, priority },
  };
}

async function execSetTaskColor(args: Record<string, unknown>): Promise<ToolResult> {
  const taskId = String(args.taskId || '').trim();
  if (!taskId) return { success: false, message: 'Task ID is required.' };

  const task = await resolveLocalTask(taskId);
  if (!task) return { success: false, message: `Task ${taskId} not found.` };

  const colorLabel = String(args.color_label || '').trim() || null;
  await db.execute('UPDATE local_tasks SET color_label = ? WHERE id = ?', [colorLabel, task.id]);

  return {
    success: true,
    message: colorLabel
      ? `🎨 Task "${task.title}" labeled **${colorLabel}**.`
      : `Task "${task.title}" color label cleared.`,
    data: { taskId: task.id, color_label: colorLabel },
  };
}

async function execSetTaskTags(args: Record<string, unknown>): Promise<ToolResult> {
  const taskId = String(args.taskId || '').trim();
  if (!taskId) return { success: false, message: 'Task ID is required.' };

  const task = await resolveLocalTask(taskId);
  if (!task) return { success: false, message: `Task ${taskId} not found.` };

  const rawTags = String(args.tags || '').trim();
  const tags = rawTags ? rawTags.split(',').map(t => t.trim()).filter(Boolean) : [];
  const tagJson = tags.length > 0 ? JSON.stringify(tags) : null;

  await db.execute('UPDATE local_tasks SET local_tags = ? WHERE id = ?', [tagJson, task.id]);

  return {
    success: true,
    message: tags.length > 0
      ? `🏷️ Task "${task.title}" tagged: ${tags.join(', ')}`
      : `Task "${task.title}" tags cleared.`,
    data: { taskId: task.id, tags },
  };
}

// ── Workflow Action Executors ───────────────────────────────────

async function execStartTask(args: Record<string, unknown>): Promise<ToolResult> {
  const taskId = String(args.taskId || '').trim();
  if (!taskId) return { success: false, message: 'Task ID is required.' };

  const localTask = await resolveLocalTask(taskId);
  const externalId = localTask?.external_id || taskId;

  const source = await resolveTaskSourceForTools(localTask?.software_id);
  if (!source) return { success: false, message: NO_SOURCE_MSG };

  const result = await taskProxyV2(source.base_url, `/api/tasks-api/${externalId}/start`, 'POST', source.api_key);

  if (result.status >= 400) {
    return { success: false, message: `Failed to start task: ${typeof result.data === 'string' ? result.data : JSON.stringify(result.data?.message || result.data?.error || 'Unknown error')}` };
  }

  // Update local status
  if (localTask) {
    await db.execute('UPDATE local_tasks SET status = ? WHERE id = ?', ['progress', localTask.id]);
  }

  return {
    success: true,
    message: `▶️ Task #${externalId} started — now in progress.`,
    data: { taskId: externalId },
  };
}

async function execCompleteTask(args: Record<string, unknown>): Promise<ToolResult> {
  const taskId = String(args.taskId || '').trim();
  if (!taskId) return { success: false, message: 'Task ID is required.' };

  const localTask = await resolveLocalTask(taskId);
  const externalId = localTask?.external_id || taskId;

  const source = await resolveTaskSourceForTools(localTask?.software_id);
  if (!source) return { success: false, message: NO_SOURCE_MSG };

  const result = await taskProxyV2(source.base_url, `/api/tasks-api/${externalId}/complete`, 'POST', source.api_key);

  if (result.status >= 400) {
    return { success: false, message: `Failed to complete task: ${typeof result.data === 'string' ? result.data : JSON.stringify(result.data?.message || result.data?.error || 'Unknown error')}` };
  }

  // Update local status
  if (localTask) {
    await db.execute('UPDATE local_tasks SET status = ? WHERE id = ?', ['completed', localTask.id]);
  }

  return {
    success: true,
    message: `✅ Task #${externalId} marked as completed.`,
    data: { taskId: externalId },
  };
}

async function execApproveTask(args: Record<string, unknown>): Promise<ToolResult> {
  const taskId = String(args.taskId || '').trim();
  if (!taskId) return { success: false, message: 'Task ID is required.' };

  const localTask = await resolveLocalTask(taskId);
  const externalId = localTask?.external_id || taskId;

  const source = await resolveTaskSourceForTools(localTask?.software_id);
  if (!source) return { success: false, message: NO_SOURCE_MSG };

  const result = await taskProxyV2(source.base_url, `/api/tasks-api/${externalId}/approve`, 'POST', source.api_key);

  if (result.status >= 400) {
    return { success: false, message: `Failed to approve task: ${typeof result.data === 'string' ? result.data : JSON.stringify(result.data?.message || result.data?.error || 'Unknown error')}` };
  }

  return {
    success: true,
    message: `👍 Task #${externalId} approved.`,
    data: { taskId: externalId },
  };
}

// ── Stats & Query Executors ─────────────────────────────────────

async function execGetTaskStats(): Promise<ToolResult> {
  // Get stats from local database
  const statusCounts = await db.query<any>(
    `SELECT status, COUNT(*) as count
     FROM local_tasks
     WHERE task_deleted = 0
     GROUP BY status`,
  );

  const typeCounts = await db.query<any>(
    `SELECT type, COUNT(*) as count
     FROM local_tasks
     WHERE task_deleted = 0
     GROUP BY type`,
  );

  const phaseCounts = await db.query<any>(
    `SELECT workflow_phase, COUNT(*) as count
     FROM local_tasks
     WHERE task_deleted = 0 AND workflow_phase IS NOT NULL AND workflow_phase != ''
     GROUP BY workflow_phase`,
  );

  const [totalRow] = await db.query<any>(
    'SELECT COUNT(*) as total FROM local_tasks WHERE task_deleted = 0',
  );

  const [bookmarkedRow] = await db.query<any>(
    'SELECT COUNT(*) as count FROM local_tasks WHERE task_deleted = 0 AND is_bookmarked = 1',
  );

  const total = totalRow?.total || 0;
  const bookmarked = bookmarkedRow?.count || 0;

  const statusLines = statusCounts.map((s: any) =>
    `  • ${s.status === 'progress' ? 'in-progress' : s.status}: ${s.count}`
  ).join('\n');

  const typeLines = typeCounts.map((t: any) =>
    `  • ${t.type}: ${t.count}`
  ).join('\n');

  const phaseLines = phaseCounts.length > 0
    ? phaseCounts.map((p: any) => `  • ${p.workflow_phase}: ${p.count}`).join('\n')
    : '  (none)';

  return {
    success: true,
    message: `📊 **Task Statistics** (${total} total, ${bookmarked} bookmarked)\n\n**By Status:**\n${statusLines}\n\n**By Type:**\n${typeLines}\n\n**By Phase:**\n${phaseLines}`,
    data: { total, bookmarked, statusCounts, typeCounts, phaseCounts },
  };
}

async function execGetPendingApprovals(): Promise<ToolResult> {
  const source = await resolveTaskSourceForTools();
  if (!source) return { success: false, message: NO_SOURCE_MSG };

  const result = await taskProxyV2(source.base_url, '/api/tasks-api/pending-approval', 'GET', source.api_key);

  if (result.status >= 400) {
    return { success: false, message: `Failed to fetch pending approvals: HTTP ${result.status}` };
  }

  let tasks: any[] = [];
  if (Array.isArray(result.data)) tasks = result.data;
  else if (result.data?.data && Array.isArray(result.data.data)) tasks = result.data.data;
  else if (result.data?.tasks && Array.isArray(result.data.tasks)) tasks = result.data.tasks;

  if (tasks.length === 0) {
    return { success: true, message: 'No tasks pending approval. All clear! ✅' };
  }

  const display = tasks.slice(0, 15).map((t: any, i: number) => {
    const assignee = t.assigned_to_name ? ` → ${t.assigned_to_name}` : '';
    return `${i + 1}. **${t.title || t.task_name}**${assignee}\n   ID: ${t.id}`;
  });

  return {
    success: true,
    message: `🔍 ${tasks.length} task(s) pending approval:\n\n${display.join('\n\n')}`,
    data: { tasks: tasks.slice(0, 15), total: tasks.length },
  };
}

async function execGetTaskTags(): Promise<ToolResult> {
  const rows = await db.query<any>(`
    SELECT DISTINCT j.tag
    FROM local_tasks, JSON_TABLE(local_tags, '$[*]' COLUMNS (tag VARCHAR(100) PATH '$')) j
    WHERE task_deleted = 0 AND local_tags IS NOT NULL
    ORDER BY j.tag
  `);
  const tags = rows.map((r: any) => r.tag);

  if (tags.length === 0) {
    return { success: true, message: 'No tags found. You can add tags to tasks using the set_task_tags tool.' };
  }

  return {
    success: true,
    message: `🏷️ ${tags.length} tag(s) in use:\n${tags.map(t => `  • ${t}`).join('\n')}`,
    data: { tags },
  };
}

// ── Sync Executors ──────────────────────────────────────────────

async function execSyncTasks(): Promise<ToolResult> {
  try {
    const results = await syncAllSources();
    const allOk = results.every(r => r.status === 'success');
    const totalCreated = results.reduce((s, r) => s + (r.tasks_created || 0), 0);
    const totalUpdated = results.reduce((s, r) => s + (r.tasks_updated || 0), 0);

    if (results.length === 0) {
      return { success: true, message: 'No task sources configured. Add a source in Dashboard → Tasks → Sources first.' };
    }

    const lines = results.map(r => {
      const icon = r.status === 'success' ? '✅' : '❌';
      return `${icon} **${r.source_name}**: ${r.tasks_created || 0} new, ${r.tasks_updated || 0} updated, ${r.tasks_unchanged || 0} unchanged${r.error ? ` — ${r.error}` : ''}`;
    });

    return {
      success: true,
      message: `🔄 Sync complete (${results.length} source(s)):\n\n${lines.join('\n')}\n\n**Total:** ${totalCreated} created, ${totalUpdated} updated`,
      data: { results },
    };
  } catch (err: any) {
    return { success: false, message: `Sync failed: ${err.message}` };
  }
}

async function execGetSyncStatus(): Promise<ToolResult> {
  const sources = await db.query<any>(`
    SELECT id, name, source_type, sync_enabled, sync_interval_min,
           last_synced_at, last_sync_status, last_sync_message, last_sync_count
    FROM task_sources
    ORDER BY name
  `);

  if (sources.length === 0) {
    return { success: true, message: 'No task sources configured yet.' };
  }

  const lines = sources.map((s: any) => {
    const enabled = s.sync_enabled ? '🟢' : '🔴';
    const lastSync = s.last_synced_at ? new Date(s.last_synced_at).toLocaleString() : 'never';
    const status = s.last_sync_status || 'unknown';
    const count = s.last_sync_count != null ? ` (${s.last_sync_count} tasks)` : '';
    return `${enabled} **${s.name}** (${s.source_type})\n   Last sync: ${lastSync} — ${status}${count}`;
  });

  return {
    success: true,
    message: `📡 ${sources.length} task source(s):\n\n${lines.join('\n\n')}`,
    data: { sources },
  };
}

// ── Invoice Staging Executors ───────────────────────────────────

async function execStageTasksForInvoice(args: Record<string, unknown>): Promise<ToolResult> {
  const rawIds = String(args.task_ids || '').trim();
  if (!rawIds) return { success: false, message: 'task_ids is required (comma-separated external IDs, e.g. "42,43,44").' };

  const taskIds = rawIds.split(',').map(id => id.trim()).filter(Boolean);
  if (taskIds.length === 0) return { success: false, message: 'No valid task IDs provided.' };

  const billDate = String(args.bill_date || new Date().toISOString().slice(0, 10));

  const placeholders = taskIds.map(() => '?').join(',');
  const affected = await db.execute(
    `UPDATE local_tasks SET task_billed = 2, task_bill_date = ? WHERE external_id IN (${placeholders}) AND task_billed = 0`,
    [billDate, ...taskIds],
  );

  return {
    success: true,
    message: `📋 ${affected} task(s) staged for invoicing (bill date: ${billDate}).`,
    data: { staged: affected, bill_date: billDate },
  };
}

async function execGetStagedInvoices(): Promise<ToolResult> {
  const tasks = await db.query<any>(
    `SELECT id, external_id, title, hours, estimated_hours, task_bill_date, assigned_to_name, type
     FROM local_tasks WHERE task_billed = 2 AND task_deleted = 0 ORDER BY task_bill_date DESC, id DESC`,
  );

  if (tasks.length === 0) {
    return { success: true, message: 'No tasks currently staged for invoicing.' };
  }

  const totalHours = tasks.reduce((s: number, t: any) => s + (Number(t.hours) || 0), 0);

  const display = tasks.map((t: any, i: number) => {
    const hrs = t.hours ? ` (${t.hours}h)` : '';
    return `${i + 1}. **${t.title}**${hrs} — ${t.task_bill_date || 'no date'}\n   ID: ${t.external_id || t.id}`;
  });

  return {
    success: true,
    message: `📋 ${tasks.length} task(s) staged for invoicing (${totalHours}h total):\n\n${display.join('\n\n')}`,
    data: { tasks, total_hours: totalHours },
  };
}

async function execProcessStagedInvoices(): Promise<ToolResult> {
  // Get the first source for invoice processing
  const source = await resolveTaskSourceForTools();
  if (!source) return { success: false, message: NO_SOURCE_MSG };

  // Get all staged tasks
  const staged = await db.query<any>(
    `SELECT id, external_id, task_bill_date FROM local_tasks WHERE task_billed = 2 AND task_deleted = 0`,
  );

  if (staged.length === 0) {
    return { success: true, message: 'No staged tasks to process. Stage some tasks first using stage_tasks_for_invoice.' };
  }

  const billDate = staged[0].task_bill_date || new Date().toISOString().slice(0, 10);
  const externalIds = staged.map((t: any) => t.external_id).filter(Boolean);

  if (externalIds.length === 0) {
    return { success: false, message: 'No tasks with external IDs found to sync.' };
  }

  // Call external portal to invoice tasks
  const result = await taskProxyV2(
    source.base_url,
    '/api/tasks-api/invoice-tasks',
    'POST',
    source.api_key,
    { task_ids: externalIds, bill_date: billDate },
  );

  if (result.status >= 400) {
    return { success: false, message: `External invoicing failed: ${typeof result.data === 'string' ? result.data : JSON.stringify(result.data?.message || result.data?.error || 'Unknown error')}` };
  }

  // Mark all staged tasks as fully invoiced
  const ids = staged.map((t: any) => t.id);
  const placeholders = ids.map(() => '?').join(',');
  await db.execute(
    `UPDATE local_tasks SET task_billed = 1 WHERE id IN (${placeholders})`,
    ids,
  );

  return {
    success: true,
    message: `💰 ${staged.length} task(s) invoiced and synced to portal (bill date: ${billDate}).`,
    data: { processed: staged.length, bill_date: billDate },
  };
}

// ============================================================================
// Staff Admin Tool Executors
// ============================================================================

async function execSearchClients(args: Record<string, unknown>): Promise<ToolResult> {
  const query = String(args.query || '').trim();
  if (!query || query.length < 2) {
    return { success: false, message: 'Please provide at least 2 characters to search.' };
  }

  const clients = await db.query<{
    id: string; email: string; name: string | null; account_status: string;
  }>(
    `SELECT id, email, name, account_status FROM users
     WHERE (email LIKE ? OR name LIKE ?)
     AND is_admin = 0 AND is_staff = 0
     ORDER BY name ASC
     LIMIT 10`,
    [`%${query}%`, `%${query}%`],
  );

  if (clients.length === 0) {
    return { success: true, message: `No clients found matching "${query}".` };
  }

  const lines = clients.map(
    (c, i) => `${i + 1}. **${c.name || '(no name)'}** — ${c.email} [${c.account_status}]\n   ID: ${c.id}`,
  );

  return {
    success: true,
    message: `Found ${clients.length} client(s):\n\n${lines.join('\n\n')}`,
    data: { clients },
  };
}

async function execSuspendClientAccount(
  args: Record<string, unknown>,
  ctx: MobileExecutionContext,
): Promise<ToolResult> {
  const clientId = String(args.clientId || '');
  const status = String(args.status || '');
  const reason = String(args.reason || 'No reason provided');

  if (!clientId) return { success: false, message: 'Please provide the client ID.' };
  if (!['active', 'suspended', 'demo_expired'].includes(status)) {
    return { success: false, message: 'Status must be "active", "suspended", or "demo_expired".' };
  }

  // Verify the target is actually a client (not staff)
  const target = await db.queryOne<{ id: string; email: string; name: string | null; account_status: string }>(
    'SELECT id, email, name, account_status FROM users WHERE id = ?',
    [clientId],
  );
  if (!target) return { success: false, message: 'User not found.' };

  // Prevent suspending other staff members
  const staffCheck = await db.queryOne<{ is_admin: number; is_staff: number }>(
    'SELECT is_admin, is_staff FROM users WHERE id = ?',
    [clientId],
  );
  if (staffCheck && (staffCheck.is_admin || staffCheck.is_staff)) {
    return { success: false, message: 'Cannot modify account status of staff members via this tool.' };
  }

  await db.execute(
    'UPDATE users SET account_status = ? WHERE id = ?',
    [status, clientId],
  );

  // Log the action
  console.log(
    `[MobileAction] Account status change: ${clientId} → ${status} by staff ${ctx.userId}. Reason: ${reason}`,
  );

  const verb = status === 'active' ? 'reactivated' : status === 'suspended' ? 'suspended' : 'set to demo_expired';
  return {
    success: true,
    message: `Account for **${target.name || target.email}** has been ${verb}.\nReason: ${reason}`,
  };
}

async function execCheckClientHealth(args: Record<string, unknown>): Promise<ToolResult> {
  const clientId = String(args.clientId || '');
  if (!clientId) return { success: false, message: 'Please provide the client ID.' };

  const user = await db.queryOne<{ id: string; email: string; name: string | null; account_status: string }>(
    'SELECT id, email, name, account_status FROM users WHERE id = ?',
    [clientId],
  );
  if (!user) return { success: false, message: 'User not found.' };

  // Assistants
  const assistants = await db.query<{
    id: string; name: string; status: string; tier: string; pages_indexed: number;
  }>(
    'SELECT id, name, status, tier, pages_indexed FROM assistants WHERE userId = ? ORDER BY created_at DESC',
    [clientId],
  );

  // Pending/failed jobs
  const queueStats = await db.queryOne<{ pending: number; failed: number }>(
    `SELECT
       SUM(CASE WHEN ij.status = 'pending' THEN 1 ELSE 0 END) as pending,
       SUM(CASE WHEN ij.status = 'failed' THEN 1 ELSE 0 END) as failed
     FROM ingestion_jobs ij
     JOIN assistants a ON a.id COLLATE utf8mb4_0900_ai_ci = ij.assistant_id
     WHERE a.userId = ?`,
    [clientId],
  );

  // Get health scores for each assistant
  const healthLines: string[] = [];
  for (const a of assistants.slice(0, 5)) {
    try {
      const health = await getAssistantKnowledgeHealth(a.id);
      healthLines.push(
        `  • **${a.name}** [${a.status}] — Health: ${health.score}%, ${a.pages_indexed} pages (${a.tier})`,
      );
    } catch {
      healthLines.push(`  • **${a.name}** [${a.status}] — Health: N/A, ${a.pages_indexed} pages (${a.tier})`);
    }
  }

  const summary = [
    `🏥 **Client Health Report**`,
    `Client: ${user.name || user.email} (${user.account_status})`,
    `Account ID: ${user.id}`,
    ``,
    `**Assistants (${assistants.length}):**`,
    healthLines.length > 0 ? healthLines.join('\n') : '  (none)',
    ``,
    `**Queue:** ${queueStats?.pending ?? 0} pending, ${queueStats?.failed ?? 0} failed`,
  ].join('\n');

  return {
    success: true,
    message: summary,
    data: { user, assistants, queueStats },
  };
}

async function execGenerateEnterpriseEndpoint(args: Record<string, unknown>): Promise<ToolResult> {
  const clientId = String(args.clientId || '');
  const provider = String(args.provider || 'custom_rest');
  const systemPrompt = String(args.systemPrompt || 'You are a helpful customer service assistant.');

  if (!clientId) return { success: false, message: 'Please provide the client ID.' };

  // Verify client exists
  const user = await db.queryOne<{ id: string; email: string; name: string | null }>(
    'SELECT id, email, name FROM users WHERE id = ?',
    [clientId],
  );
  if (!user) return { success: false, message: 'Client not found.' };

  const input: EndpointCreateInput = {
    client_id: clientId,
    client_name: user.name || user.email,
    inbound_provider: provider,
    llm_provider: 'openrouter',
    llm_model: env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
    llm_system_prompt: systemPrompt,
  };

  const endpoint = createEndpoint(input);

  const webhookUrl = `https://api.softaware.net.za/api/v1/webhook/${endpoint.id}`;

  return {
    success: true,
    message: [
      `✅ Enterprise endpoint created!`,
      ``,
      `**Endpoint ID:** ${endpoint.id}`,
      `**Webhook URL:** ${webhookUrl}`,
      `**Provider:** ${provider}`,
      `**Client:** ${user.name || user.email}`,
      ``,
      `The client can start sending requests to this URL immediately.`,
    ].join('\n'),
    data: { endpoint, webhookUrl },
  };
}

// ============================================================================
// Client Lead Management Tool Executors
// ============================================================================

/**
 * Verify the user owns a site (for lead/site access).
 */
async function verifySiteOwnership(
  siteId: string,
  ctx: MobileExecutionContext,
): Promise<{ owned: boolean; exists: boolean }> {
  const site = await db.queryOne<{ id: string; user_id: string }>(
    'SELECT id, user_id FROM generated_sites WHERE id = ?',
    [siteId],
  );
  if (!site) return { owned: false, exists: false };
  if (ctx.role === 'staff') return { owned: true, exists: true };
  return { owned: site.user_id === ctx.userId, exists: true };
}

/**
 * Get all site IDs owned by a user (for scoping lead queries).
 */
async function getUserSiteIds(userId: string): Promise<string[]> {
  const sites = await db.query<{ id: string }>(
    'SELECT id FROM generated_sites WHERE user_id = ?',
    [userId],
  );
  return sites.map(s => s.id);
}

async function execListLeads(
  args: Record<string, unknown>,
  ctx: MobileExecutionContext,
): Promise<ToolResult> {
  const siteIds = await getUserSiteIds(ctx.userId);
  if (siteIds.length === 0) {
    return { success: true, message: 'You don\'t have any generated websites yet, so there are no leads to show.' };
  }

  const limit = Math.min(parseInt(String(args.limit || '20'), 10) || 20, 50);
  const statusFilter = String(args.status || '').toLowerCase();

  const placeholders = siteIds.map(() => '?').join(',');
  let sql = `SELECT id, site_id, sender_name, sender_email, sender_phone, status, created_at
     FROM form_submissions
     WHERE site_id IN (${placeholders})`;
  const params: any[] = [...siteIds];

  if (statusFilter && ['new', 'contacted', 'converted', 'spam'].includes(statusFilter)) {
    sql += ' AND status = ?';
    params.push(statusFilter);
  }

  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const leads = await db.query<{
    id: string; site_id: string; sender_name: string; sender_email: string;
    sender_phone: string | null; status: string; created_at: string;
  }>(sql, params);

  if (leads.length === 0) {
    return { success: true, message: statusFilter ? `No leads with status "${statusFilter}" found.` : 'No contact form submissions yet.' };
  }

  const lines = leads.map(
    (l, i) => `${i + 1}. **${l.sender_name}** (${l.sender_email})${l.sender_phone ? ` — ${l.sender_phone}` : ''}\n   Status: ${l.status} | ${new Date(l.created_at).toLocaleDateString()}\n   ID: ${l.id}`,
  );

  return {
    success: true,
    message: `Found ${leads.length} lead(s):\n\n${lines.join('\n\n')}`,
    data: { leads },
  };
}

async function execGetLeadDetails(
  args: Record<string, unknown>,
  ctx: MobileExecutionContext,
): Promise<ToolResult> {
  const leadId = String(args.leadId || '').trim();
  if (!leadId) return { success: false, message: 'Please provide the lead ID.' };

  const lead = await db.queryOne<{
    id: string; site_id: string; sender_name: string; sender_email: string;
    sender_phone: string | null; message: string; source_page: string | null;
    ip_address: string | null; status: string; notes: string | null;
    created_at: string; updated_at: string;
  }>(
    'SELECT * FROM form_submissions WHERE id = ?',
    [leadId],
  );

  if (!lead) return { success: false, message: 'Lead not found.' };

  // Verify ownership
  const check = await verifySiteOwnership(lead.site_id, ctx);
  if (!check.owned) return { success: false, message: 'You do not have permission to view this lead.' };

  const details = [
    `📋 **Lead Details**`,
    `**Name:** ${lead.sender_name}`,
    `**Email:** ${lead.sender_email}`,
    lead.sender_phone ? `**Phone:** ${lead.sender_phone}` : null,
    `**Status:** ${lead.status}`,
    `**Submitted:** ${new Date(lead.created_at).toLocaleString()}`,
    lead.source_page ? `**Source:** ${lead.source_page}` : null,
    ``,
    `**Message:**`,
    lead.message,
    lead.notes ? `\n**Notes:** ${lead.notes}` : null,
  ].filter(Boolean).join('\n');

  return { success: true, message: details, data: { lead } };
}

async function execUpdateLeadStatus(
  args: Record<string, unknown>,
  ctx: MobileExecutionContext,
): Promise<ToolResult> {
  const leadId = String(args.leadId || '').trim();
  const status = String(args.status || '').toLowerCase();
  const notes = args.notes ? String(args.notes) : null;

  if (!leadId) return { success: false, message: 'Please provide the lead ID.' };
  if (!['new', 'contacted', 'converted', 'spam'].includes(status)) {
    return { success: false, message: 'Status must be "new", "contacted", "converted", or "spam".' };
  }

  const lead = await db.queryOne<{ id: string; site_id: string }>(
    'SELECT id, site_id FROM form_submissions WHERE id = ?',
    [leadId],
  );
  if (!lead) return { success: false, message: 'Lead not found.' };

  const check = await verifySiteOwnership(lead.site_id, ctx);
  if (!check.owned) return { success: false, message: 'You do not have permission to update this lead.' };

  const updates: string[] = ['status = ?'];
  const params: any[] = [status];

  if (notes) {
    updates.push('notes = ?');
    params.push(notes);
  }

  updates.push('updated_at = ?');
  params.push(toMySQLDate(new Date()));
  params.push(leadId);

  await db.execute(
    `UPDATE form_submissions SET ${updates.join(', ')} WHERE id = ?`,
    params,
  );

  return {
    success: true,
    message: `✅ Lead status updated to "${status}"${notes ? ` with notes.` : '.'}`,
  };
}

async function execGetLeadStats(ctx: MobileExecutionContext): Promise<ToolResult> {
  const siteIds = await getUserSiteIds(ctx.userId);
  if (siteIds.length === 0) {
    return { success: true, message: 'No generated websites found. Create a website first to start receiving leads.' };
  }

  const placeholders = siteIds.map(() => '?').join(',');
  const stats = await db.queryOne<{
    total: number; new_count: number; contacted: number; converted: number; spam: number;
  }>(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_count,
       SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END) as contacted,
       SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) as converted,
       SUM(CASE WHEN status = 'spam' THEN 1 ELSE 0 END) as spam
     FROM form_submissions
     WHERE site_id IN (${placeholders})`,
    [...siteIds],
  );

  // Recent leads (last 7 days)
  const recentCount = await db.queryOne<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM form_submissions
     WHERE site_id IN (${placeholders}) AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
    [...siteIds],
  );

  const conversionRate = stats && stats.total > 0
    ? ((stats.converted / stats.total) * 100).toFixed(1)
    : '0.0';

  const summary = [
    `📊 **Lead Statistics**`,
    `Total submissions: ${stats?.total ?? 0}`,
    `New (unread): ${stats?.new_count ?? 0}`,
    `Contacted: ${stats?.contacted ?? 0}`,
    `Converted: ${stats?.converted ?? 0}`,
    `Spam: ${stats?.spam ?? 0}`,
    `Conversion rate: ${conversionRate}%`,
    `Last 7 days: ${recentCount?.cnt ?? 0} new leads`,
  ].join('\n');

  return { success: true, message: summary, data: { stats, recentCount: recentCount?.cnt ?? 0 } };
}

// ============================================================================
// Client Email Tool Executors
// ============================================================================

async function execSendFollowupEmail(
  args: Record<string, unknown>,
  ctx: MobileExecutionContext,
): Promise<ToolResult> {
  const leadId = String(args.leadId || '').trim();
  const subject = String(args.subject || '').trim();
  const body = String(args.body || '').trim();

  if (!leadId) return { success: false, message: 'Please provide the lead ID.' };
  if (!subject) return { success: false, message: 'Please provide an email subject.' };
  if (!body) return { success: false, message: 'Please provide the email body.' };

  // Get the lead
  const lead = await db.queryOne<{
    id: string; site_id: string; sender_name: string; sender_email: string;
  }>(
    'SELECT id, site_id, sender_name, sender_email FROM form_submissions WHERE id = ?',
    [leadId],
  );
  if (!lead) return { success: false, message: 'Lead not found.' };

  // Verify ownership
  const check = await verifySiteOwnership(lead.site_id, ctx);
  if (!check.owned) return { success: false, message: 'You do not have permission to email this lead.' };

  // Get the site owner's info for the "from" address context
  const user = await db.queryOne<{ email: string; name: string | null }>(
    'SELECT email, name FROM users WHERE id = ?',
    [ctx.userId],
  );

  // Send using the shared email service
  const result = await sendEmail({
    to: lead.sender_email,
    subject,
    replyTo: user?.email,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <p>Hi ${lead.sender_name},</p>
        <div style="white-space: pre-wrap;">${body.replace(/\n/g, '<br>')}</div>
        <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;">
        <p style="color: #999; font-size: 12px;">
          Sent by ${user?.name || 'Support'} via Soft Aware
        </p>
      </div>
    `,
    text: `Hi ${lead.sender_name},\n\n${body}\n\n---\nSent by ${user?.name || 'Support'} via Soft Aware`,
  });

  if (!result.success) {
    return { success: false, message: `Failed to send email: ${result.error}` };
  }

  // Update lead status to "contacted" if it was "new"
  await db.execute(
    `UPDATE form_submissions SET status = 'contacted', updated_at = ? WHERE id = ? AND status = 'new'`,
    [toMySQLDate(new Date()), leadId],
  );

  return {
    success: true,
    message: `✅ Follow-up email sent to **${lead.sender_name}** (${lead.sender_email}).\nSubject: ${subject}`,
  };
}

async function execSendInfoEmail(
  args: Record<string, unknown>,
  ctx: MobileExecutionContext,
): Promise<ToolResult> {
  const toEmail = String(args.toEmail || '').trim();
  const subject = String(args.subject || '').trim();
  const body = String(args.body || '').trim();

  if (!toEmail) return { success: false, message: 'Please provide a recipient email address.' };
  if (!subject) return { success: false, message: 'Please provide an email subject.' };
  if (!body) return { success: false, message: 'Please provide the email body.' };

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
    return { success: false, message: 'Invalid email format.' };
  }

  const user = await db.queryOne<{ email: string; name: string | null }>(
    'SELECT email, name FROM users WHERE id = ?',
    [ctx.userId],
  );

  const result = await sendEmail({
    to: toEmail,
    subject,
    replyTo: user?.email,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="white-space: pre-wrap;">${body.replace(/\n/g, '<br>')}</div>
        <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;">
        <p style="color: #999; font-size: 12px;">
          Sent by ${user?.name || 'User'} via Soft Aware
        </p>
      </div>
    `,
    text: `${body}\n\n---\nSent by ${user?.name || 'User'} via Soft Aware`,
  });

  if (!result.success) {
    return { success: false, message: `Failed to send email: ${result.error}` };
  }

  return {
    success: true,
    message: `✅ Email sent to ${toEmail}.\nSubject: ${subject}`,
  };
}

// ============================================================================
// Client Site Builder Tool Executors
// ============================================================================

async function execListMySites(ctx: MobileExecutionContext): Promise<ToolResult> {
  const sites = await siteBuilderService.getSitesByUserId(ctx.userId);

  if (sites.length === 0) {
    return { success: true, message: 'You don\'t have any generated websites yet. You can create one from the portal dashboard.' };
  }

  const lines = sites.map(
    (s, i) => `${i + 1}. **${s.business_name}** — ${s.status}${s.last_deployed_at ? ` (deployed ${new Date(s.last_deployed_at).toLocaleDateString()})` : ''}\n   ID: ${s.id}`,
  );

  return {
    success: true,
    message: `You have ${sites.length} website(s):\n\n${lines.join('\n\n')}`,
    data: { sites: sites.map(s => ({ id: s.id, business_name: s.business_name, status: s.status })) },
  };
}

async function execGetSiteDetails(
  args: Record<string, unknown>,
  ctx: MobileExecutionContext,
): Promise<ToolResult> {
  const siteId = String(args.siteId || '').trim();
  if (!siteId) return { success: false, message: 'Please provide the site ID.' };

  const check = await verifySiteOwnership(siteId, ctx);
  if (!check.exists) return { success: false, message: 'Site not found.' };
  if (!check.owned) return { success: false, message: 'You do not have permission to view this site.' };

  const site = await siteBuilderService.getSiteById(siteId);
  if (!site) return { success: false, message: 'Site not found.' };

  const details = [
    `🌐 **${site.business_name}**`,
    site.tagline ? `*${site.tagline}*` : null,
    ``,
    `**Status:** ${site.status}`,
    site.contact_email ? `**Email:** ${site.contact_email}` : null,
    site.contact_phone ? `**Phone:** ${site.contact_phone}` : null,
    site.theme_color ? `**Theme Color:** ${site.theme_color}` : null,
    site.about_us ? `\n**About Us:**\n${site.about_us.substring(0, 200)}${site.about_us.length > 200 ? '...' : ''}` : null,
    site.services ? `\n**Services:**\n${site.services.substring(0, 200)}${site.services.length > 200 ? '...' : ''}` : null,
    ``,
    `**FTP Server:** ${site.ftp_server || 'Not configured'}`,
    site.last_deployed_at ? `**Last Deployed:** ${new Date(site.last_deployed_at).toLocaleString()}` : '**Last Deployed:** Never',
    site.deployment_error ? `**⚠️ Last Deploy Error:** ${site.deployment_error}` : null,
  ].filter(Boolean).join('\n');

  return { success: true, message: details, data: { site: { ...site, ftp_password: '***' } } };
}

async function execUpdateSiteField(
  args: Record<string, unknown>,
  ctx: MobileExecutionContext,
): Promise<ToolResult> {
  const siteId = String(args.siteId || '').trim();
  const field = String(args.field || '').trim();
  const value = String(args.value || '');

  if (!siteId) return { success: false, message: 'Please provide the site ID.' };
  if (!field) return { success: false, message: 'Please specify which field to update.' };

  const allowedFields: Record<string, string> = {
    business_name: 'businessName',
    tagline: 'tagline',
    about_us: 'aboutUs',
    services: 'services',
    contact_email: 'contactEmail',
    contact_phone: 'contactPhone',
    theme_color: 'themeColor',
  };

  const siteDataKey = allowedFields[field];
  if (!siteDataKey) {
    return { success: false, message: `Field "${field}" is not editable. Allowed: ${Object.keys(allowedFields).join(', ')}` };
  }

  const check = await verifySiteOwnership(siteId, ctx);
  if (!check.exists) return { success: false, message: 'Site not found.' };
  if (!check.owned) return { success: false, message: 'You do not have permission to update this site.' };

  await siteBuilderService.updateSite(siteId, { [siteDataKey]: value });

  return {
    success: true,
    message: `✅ Updated **${field.replace(/_/g, ' ')}** to "${value}".\n\n💡 Remember to **regenerate** and **deploy** your site for the changes to go live.`,
  };
}

async function execRegenerateSite(
  args: Record<string, unknown>,
  ctx: MobileExecutionContext,
): Promise<ToolResult> {
  const siteId = String(args.siteId || '').trim();
  if (!siteId) return { success: false, message: 'Please provide the site ID.' };

  const check = await verifySiteOwnership(siteId, ctx);
  if (!check.exists) return { success: false, message: 'Site not found.' };
  if (!check.owned) return { success: false, message: 'You do not have permission to regenerate this site.' };

  try {
    await siteBuilderService.generateStaticFiles(siteId);
    return {
      success: true,
      message: '✅ Site files regenerated successfully. You can now **deploy** the site to make changes live.',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Failed to regenerate site: ${msg}` };
  }
}

async function execDeploySite(
  args: Record<string, unknown>,
  ctx: MobileExecutionContext,
): Promise<ToolResult> {
  const siteId = String(args.siteId || '').trim();
  if (!siteId) return { success: false, message: 'Please provide the site ID.' };

  const check = await verifySiteOwnership(siteId, ctx);
  if (!check.exists) return { success: false, message: 'Site not found.' };
  if (!check.owned) return { success: false, message: 'You do not have permission to deploy this site.' };

  const site = await siteBuilderService.getSiteById(siteId);
  if (!site) return { success: false, message: 'Site not found.' };

  if (!site.ftp_server || !site.ftp_username) {
    return { success: false, message: 'FTP credentials are not configured for this site. Please set up FTP in the portal first.' };
  }

  if (site.status === 'draft') {
    return { success: false, message: 'Please regenerate the site first before deploying.' };
  }

  // Use the ftpDeployment service
  try {
    const { ftpDeploymentService } = await import('./ftpDeploymentService.js');
    const result = await ftpDeploymentService.deploySite(siteId);

    if (result.success) {
      return {
        success: true,
        message: `🚀 Site deployed successfully!${result.filesUploaded ? ` (${result.filesUploaded} files uploaded)` : ''}\n\nYour changes are now live.`,
      };
    } else {
      return {
        success: false,
        message: `Deployment failed: ${result.error || 'Unknown error'}. Check your FTP credentials.`,
      };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Deployment error: ${msg}` };
  }
}

async function execGetSiteDeployments(
  args: Record<string, unknown>,
  ctx: MobileExecutionContext,
): Promise<ToolResult> {
  const siteId = String(args.siteId || '').trim();
  if (!siteId) return { success: false, message: 'Please provide the site ID.' };

  const check = await verifySiteOwnership(siteId, ctx);
  if (!check.exists) return { success: false, message: 'Site not found.' };
  if (!check.owned) return { success: false, message: 'You do not have permission to view this site.' };

  const deployments = await db.query<{
    id: number; status: string; deployed_at: string; error_message: string | null;
    files_deployed: number | null;
  }>(
    `SELECT id, status, deployed_at, error_message, files_deployed
     FROM site_deployments
     WHERE site_id = ?
     ORDER BY deployed_at DESC
     LIMIT 10`,
    [siteId],
  );

  if (deployments.length === 0) {
    return { success: true, message: 'No deployment history found for this site.' };
  }

  const lines = deployments.map(
    (d, i) => {
      const icon = d.status === 'success' ? '✅' : d.status === 'failed' ? '❌' : '⏳';
      return `${i + 1}. ${icon} ${d.status} — ${new Date(d.deployed_at).toLocaleString()}${d.files_deployed ? ` (${d.files_deployed} files)` : ''}${d.error_message ? `\n   Error: ${d.error_message}` : ''}`;
    },
  );

  return {
    success: true,
    message: `📜 **Deployment History** (last ${deployments.length}):\n\n${lines.join('\n\n')}`,
    data: { deployments },
  };
}

// ============================================================================
// Staff Cases Tool Executors
// ============================================================================

async function execListCases(args: Record<string, unknown>): Promise<ToolResult> {
  const limit = Math.min(parseInt(String(args.limit || '20'), 10) || 20, 50);
  let sql = `SELECT id, case_number, title, severity, status, type, assigned_to, created_at
     FROM cases WHERE 1=1`;
  const params: any[] = [];

  const statusFilter = String(args.status || '').toLowerCase();
  if (statusFilter && ['open', 'in_progress', 'resolved', 'closed', 'reopened'].includes(statusFilter)) {
    sql += ' AND status = ?';
    params.push(statusFilter);
  }

  const severityFilter = String(args.severity || '').toLowerCase();
  if (severityFilter && ['low', 'medium', 'high', 'critical'].includes(severityFilter)) {
    sql += ' AND severity = ?';
    params.push(severityFilter);
  }

  if (args.assignedTo) {
    sql += ' AND assigned_to = ?';
    params.push(String(args.assignedTo));
  }

  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const cases = await db.query<{
    id: string; case_number: string; title: string; severity: string;
    status: string; type: string; assigned_to: string | null; created_at: string;
  }>(sql, params);

  if (cases.length === 0) {
    return { success: true, message: 'No cases found matching your criteria.' };
  }

  const lines = cases.map(
    (c, i) => {
      const severityIcon = c.severity === 'critical' ? '🔴' : c.severity === 'high' ? '🟠' : c.severity === 'medium' ? '🟡' : '🟢';
      return `${i + 1}. ${severityIcon} **${c.case_number}: ${c.title}**\n   ${c.status} | ${c.type} | ${c.severity}\n   ID: ${c.id}`;
    },
  );

  return {
    success: true,
    message: `Found ${cases.length} case(s):\n\n${lines.join('\n\n')}`,
    data: { cases },
  };
}

async function execGetCaseDetails(args: Record<string, unknown>): Promise<ToolResult> {
  const caseId = String(args.caseId || '').trim();
  if (!caseId) return { success: false, message: 'Please provide the case ID.' };

  const c = await db.queryOne<{
    id: string; case_number: string; title: string; description: string | null;
    severity: string; status: string; type: string; category: string | null;
    source: string | null; reported_by: string | null; assigned_to: string | null;
    url: string | null; resolution: string | null; tags: string | null;
    ai_analysis: string | null; created_at: string; updated_at: string;
  }>(
    'SELECT * FROM cases WHERE id = ?',
    [caseId],
  );

  if (!c) return { success: false, message: 'Case not found.' };

  // Get recent comments
  const comments = await db.query<{
    id: string; comment: string; is_internal: number; created_at: string; user_id: string;
  }>(
    `SELECT cc.id, cc.comment, cc.is_internal, cc.created_at, cc.user_id
     FROM case_comments cc WHERE cc.case_id = ?
     ORDER BY cc.created_at DESC LIMIT 5`,
    [caseId],
  );

  const commentLines = comments.map(
    (cm) => `  • ${cm.is_internal ? '[Internal]' : '[Public]'} ${cm.comment.substring(0, 100)}${cm.comment.length > 100 ? '...' : ''} (${new Date(cm.created_at).toLocaleDateString()})`,
  );

  const details = [
    `🎫 **${c.case_number}: ${c.title}**`,
    `Status: ${c.status} | Severity: ${c.severity} | Type: ${c.type}`,
    c.category ? `Category: ${c.category}` : null,
    c.assigned_to ? `Assigned to: ${c.assigned_to}` : 'Unassigned',
    c.url ? `URL: ${c.url}` : null,
    `Created: ${new Date(c.created_at).toLocaleString()}`,
    c.description ? `\n**Description:**\n${c.description.substring(0, 500)}${c.description.length > 500 ? '...' : ''}` : null,
    c.resolution ? `\n**Resolution:** ${c.resolution}` : null,
    commentLines.length > 0 ? `\n**Recent Comments:**\n${commentLines.join('\n')}` : null,
  ].filter(Boolean).join('\n');

  return { success: true, message: details, data: { case: c, comments } };
}

async function execUpdateCase(
  args: Record<string, unknown>,
  ctx: MobileExecutionContext,
): Promise<ToolResult> {
  const caseId = String(args.caseId || '').trim();
  if (!caseId) return { success: false, message: 'Please provide the case ID.' };

  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM cases WHERE id = ?',
    [caseId],
  );
  if (!existing) return { success: false, message: 'Case not found.' };

  const updates: string[] = [];
  const values: any[] = [];
  const changes: string[] = [];

  if (args.status) {
    updates.push('status = ?');
    values.push(String(args.status));
    changes.push(`Status → ${args.status}`);
  }
  if (args.severity) {
    updates.push('severity = ?');
    values.push(String(args.severity));
    changes.push(`Severity → ${args.severity}`);
  }
  if (args.assignedTo) {
    updates.push('assigned_to = ?');
    values.push(String(args.assignedTo));
    changes.push(`Assigned to → ${args.assignedTo}`);
  }
  if (args.resolution) {
    updates.push('resolution = ?');
    values.push(String(args.resolution));
    changes.push('Resolution updated');
  }

  if (changes.length === 0) {
    return { success: false, message: 'No changes specified.' };
  }

  updates.push('updated_at = ?');
  values.push(toMySQLDate(new Date()));
  values.push(caseId);

  await db.execute(
    `UPDATE cases SET ${updates.join(', ')} WHERE id = ?`,
    values,
  );

  return {
    success: true,
    message: `✅ Case updated:\n${changes.map(c => `  • ${c}`).join('\n')}`,
  };
}

async function execAddCaseComment(
  args: Record<string, unknown>,
  ctx: MobileExecutionContext,
): Promise<ToolResult> {
  const caseId = String(args.caseId || '').trim();
  const comment = String(args.comment || '').trim();
  if (!caseId) return { success: false, message: 'Please provide the case ID.' };
  if (!comment) return { success: false, message: 'Please provide the comment text.' };

  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM cases WHERE id = ?',
    [caseId],
  );
  if (!existing) return { success: false, message: 'Case not found.' };

  const isInternal = String(args.isInternal || 'true') === 'true' ? 1 : 0;

  await db.execute(
    `INSERT INTO case_comments (id, case_id, user_id, comment, is_internal, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [randomUUID(), caseId, ctx.userId, comment, isInternal, toMySQLDate(new Date()), toMySQLDate(new Date())],
  );

  return {
    success: true,
    message: `💬 Comment added to case${isInternal ? ' (internal note)' : ''}.`,
  };
}

// ============================================================================
// Staff CRM Tool Executors
// ============================================================================

async function execListContacts(args: Record<string, unknown>): Promise<ToolResult> {
  const limit = Math.min(parseInt(String(args.limit || '20'), 10) || 20, 50);
  let sql = 'SELECT id, company_name, contact_person, email, phone, contact_type, active FROM contacts WHERE active = 1';
  const params: any[] = [];

  const contactType = String(args.contactType || '').toLowerCase();
  if (contactType === 'customer') {
    sql += ' AND contact_type = 1';
  } else if (contactType === 'supplier') {
    sql += ' AND contact_type = 2';
  }

  const search = String(args.search || '').trim();
  if (search) {
    sql += ' AND (company_name LIKE ? OR contact_person LIKE ? OR email LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  sql += ' ORDER BY company_name ASC LIMIT ?';
  params.push(limit);

  const contacts = await db.query<{
    id: number; company_name: string; contact_person: string | null;
    email: string | null; phone: string | null; contact_type: number; active: number;
  }>(sql, params);

  if (contacts.length === 0) {
    return { success: true, message: 'No contacts found matching your criteria.' };
  }

  const lines = contacts.map(
    (c, i) => {
      const type = c.contact_type === 1 ? 'Customer' : c.contact_type === 2 ? 'Supplier' : 'Other';
      return `${i + 1}. **${c.company_name}** (${type})${c.contact_person ? ` — ${c.contact_person}` : ''}\n   ${c.email || 'No email'} | ${c.phone || 'No phone'}\n   ID: ${c.id}`;
    },
  );

  return {
    success: true,
    message: `Found ${contacts.length} contact(s):\n\n${lines.join('\n\n')}`,
    data: { contacts },
  };
}

async function execGetContactDetails(args: Record<string, unknown>): Promise<ToolResult> {
  const contactId = String(args.contactId || '').trim();
  if (!contactId) return { success: false, message: 'Please provide the contact ID.' };

  const c = await db.queryOne<{
    id: number; company_name: string; contact_person: string | null;
    email: string | null; phone: string | null; fax: string | null;
    website: string | null; location: string | null; contact_code: string | null;
    vat_number: string | null; contact_type: number; remarks: string | null;
    created_at: string;
  }>(
    'SELECT * FROM contacts WHERE id = ?',
    [contactId],
  );

  if (!c) return { success: false, message: 'Contact not found.' };

  const type = c.contact_type === 1 ? 'Customer' : c.contact_type === 2 ? 'Supplier' : 'Other';
  const details = [
    `👤 **${c.company_name}** (${type})`,
    c.contact_person ? `Contact Person: ${c.contact_person}` : null,
    c.email ? `Email: ${c.email}` : null,
    c.phone ? `Phone: ${c.phone}` : null,
    c.fax ? `Fax: ${c.fax}` : null,
    c.website ? `Website: ${c.website}` : null,
    c.location ? `Location: ${c.location}` : null,
    c.vat_number ? `VAT: ${c.vat_number}` : null,
    c.contact_code ? `Code: ${c.contact_code}` : null,
    c.remarks ? `\nRemarks: ${c.remarks}` : null,
    `\nCreated: ${new Date(c.created_at).toLocaleDateString()}`,
  ].filter(Boolean).join('\n');

  return { success: true, message: details, data: { contact: c } };
}

async function execCreateContact(args: Record<string, unknown>): Promise<ToolResult> {
  const companyName = String(args.companyName || '').trim();
  const contactType = String(args.contactType || 'customer').toLowerCase();

  if (!companyName) return { success: false, message: 'Company name is required.' };

  const typeNum = contactType === 'supplier' ? 2 : 1;

  await db.execute(
    `INSERT INTO contacts (company_name, contact_person, email, phone, location, vat_number, contact_type, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
    [
      companyName,
      args.contactPerson ? String(args.contactPerson) : null,
      args.email ? String(args.email) : null,
      args.phone ? String(args.phone) : null,
      args.location ? String(args.location) : null,
      args.vatNumber ? String(args.vatNumber) : null,
      typeNum,
    ],
  );

  return {
    success: true,
    message: `✅ ${contactType === 'supplier' ? 'Supplier' : 'Customer'} "**${companyName}**" created successfully.`,
  };
}

// ============================================================================
// Staff Finance Tool Executors (Quotations, Invoices, Pricing)
// ============================================================================

async function execListQuotations(args: Record<string, unknown>): Promise<ToolResult> {
  const limit = Math.min(parseInt(String(args.limit || '20'), 10) || 20, 50);
  let sql = `SELECT q.id, q.quotation_number, q.quotation_amount, q.quotation_date, q.remarks,
                    c.company_name
             FROM quotations q
             LEFT JOIN contacts c ON c.id = q.contact_id
             WHERE q.active = 1`;
  const params: any[] = [];

  if (args.contactId) {
    sql += ' AND q.contact_id = ?';
    params.push(parseInt(String(args.contactId), 10));
  }

  sql += ' ORDER BY q.quotation_date DESC LIMIT ?';
  params.push(limit);

  const quotations = await db.query<{
    id: number; quotation_number: string; quotation_amount: number;
    quotation_date: string; remarks: string | null; company_name: string | null;
  }>(sql, params);

  if (quotations.length === 0) {
    return { success: true, message: 'No quotations found.' };
  }

  const lines = quotations.map(
    (q, i) => `${i + 1}. **${q.quotation_number}** — R${Number(q.quotation_amount).toFixed(2)}\n   ${q.company_name || 'No contact'} | ${new Date(q.quotation_date).toLocaleDateString()}\n   ID: ${q.id}`,
  );

  return {
    success: true,
    message: `Found ${quotations.length} quotation(s):\n\n${lines.join('\n\n')}`,
    data: { quotations },
  };
}

async function execGetQuotationDetails(args: Record<string, unknown>): Promise<ToolResult> {
  const quotationId = String(args.quotationId || '').trim();
  if (!quotationId) return { success: false, message: 'Please provide the quotation ID.' };

  const q = await db.queryOne<{
    id: number; quotation_number: string; quotation_amount: number;
    quotation_date: string; remarks: string | null; contact_id: number | null;
  }>(
    'SELECT * FROM quotations WHERE id = ? AND active = 1',
    [quotationId],
  );

  if (!q) return { success: false, message: 'Quotation not found.' };

  // Get contact info
  let contactName = 'Unknown';
  if (q.contact_id) {
    const c = await db.queryOne<{ company_name: string }>(
      'SELECT company_name FROM contacts WHERE id = ?',
      [q.contact_id],
    );
    if (c) contactName = c.company_name;
  }

  // Get line items
  const items = await db.query<{
    id: number; item_description: string; item_price: number;
    item_quantity: number; item_discount: number; line_total: number;
  }>(
    'SELECT * FROM quote_items WHERE quotation_id = ?',
    [quotationId],
  );

  const itemLines = items.map(
    (it, i) => `  ${i + 1}. ${it.item_description} — R${Number(it.item_price).toFixed(2)} × ${it.item_quantity}${it.item_discount ? ` (-${it.item_discount}%)` : ''} = R${Number(it.line_total).toFixed(2)}`,
  );

  const details = [
    `📄 **Quotation ${q.quotation_number}**`,
    `Client: ${contactName}`,
    `Date: ${new Date(q.quotation_date).toLocaleDateString()}`,
    `Total: **R${Number(q.quotation_amount).toFixed(2)}**`,
    q.remarks ? `Remarks: ${q.remarks}` : null,
    ``,
    `**Line Items:**`,
    itemLines.length > 0 ? itemLines.join('\n') : '  (no items)',
  ].filter(Boolean).join('\n');

  return { success: true, message: details, data: { quotation: q, items } };
}

async function execListInvoices(args: Record<string, unknown>): Promise<ToolResult> {
  const limit = Math.min(parseInt(String(args.limit || '20'), 10) || 20, 50);
  let sql = `SELECT i.id, i.invoice_number, i.invoice_amount, i.invoice_date, i.due_date, i.paid,
                    c.company_name
             FROM invoices i
             LEFT JOIN contacts c ON c.id = i.contact_id
             WHERE i.active = 1`;
  const params: any[] = [];

  if (args.contactId) {
    sql += ' AND i.contact_id = ?';
    params.push(parseInt(String(args.contactId), 10));
  }

  const paidFilter = String(args.paid || '').toLowerCase();
  if (paidFilter === 'true') {
    sql += ' AND i.paid = 1';
  } else if (paidFilter === 'false') {
    sql += ' AND i.paid = 0';
  }

  sql += ' ORDER BY i.invoice_date DESC LIMIT ?';
  params.push(limit);

  const invoices = await db.query<{
    id: number; invoice_number: string; invoice_amount: number;
    invoice_date: string; due_date: string | null; paid: number;
    company_name: string | null;
  }>(sql, params);

  if (invoices.length === 0) {
    return { success: true, message: 'No invoices found.' };
  }

  const lines = invoices.map(
    (inv, i) => {
      const paidIcon = inv.paid ? '✅' : '⏳';
      const overdue = !inv.paid && inv.due_date && new Date(inv.due_date) < new Date() ? ' ⚠️ OVERDUE' : '';
      return `${i + 1}. ${paidIcon} **${inv.invoice_number}** — R${Number(inv.invoice_amount).toFixed(2)}${overdue}\n   ${inv.company_name || 'No contact'} | ${new Date(inv.invoice_date).toLocaleDateString()}${inv.due_date ? ` | Due: ${new Date(inv.due_date).toLocaleDateString()}` : ''}\n   ID: ${inv.id}`;
    },
  );

  return {
    success: true,
    message: `Found ${invoices.length} invoice(s):\n\n${lines.join('\n\n')}`,
    data: { invoices },
  };
}

async function execGetInvoiceDetails(args: Record<string, unknown>): Promise<ToolResult> {
  const invoiceId = String(args.invoiceId || '').trim();
  if (!invoiceId) return { success: false, message: 'Please provide the invoice ID.' };

  const inv = await db.queryOne<{
    id: number; invoice_number: string; invoice_amount: number;
    invoice_date: string; due_date: string | null; paid: number;
    contact_id: number | null; quotation_id: number | null; remarks: string | null;
  }>(
    'SELECT * FROM invoices WHERE id = ? AND active = 1',
    [invoiceId],
  );

  if (!inv) return { success: false, message: 'Invoice not found.' };

  // Get contact info
  let contactName = 'Unknown';
  if (inv.contact_id) {
    const c = await db.queryOne<{ company_name: string }>(
      'SELECT company_name FROM contacts WHERE id = ?',
      [inv.contact_id],
    );
    if (c) contactName = c.company_name;
  }

  // Get line items
  const items = await db.query<{
    id: number; item_description: string; item_price: number;
    item_quantity: number; item_discount: number; line_total: number;
  }>(
    'SELECT * FROM invoice_items WHERE invoice_id = ?',
    [invoiceId],
  );

  const itemLines = items.map(
    (it, i) => `  ${i + 1}. ${it.item_description} — R${Number(it.item_price).toFixed(2)} × ${it.item_quantity}${it.item_discount ? ` (-${it.item_discount}%)` : ''} = R${Number(it.line_total).toFixed(2)}`,
  );

  const paidStatus = inv.paid ? '✅ PAID' : '⏳ UNPAID';
  const overdue = !inv.paid && inv.due_date && new Date(inv.due_date) < new Date() ? ' ⚠️ OVERDUE' : '';

  const details = [
    `🧾 **Invoice ${inv.invoice_number}** ${paidStatus}${overdue}`,
    `Client: ${contactName}`,
    `Date: ${new Date(inv.invoice_date).toLocaleDateString()}`,
    inv.due_date ? `Due: ${new Date(inv.due_date).toLocaleDateString()}` : null,
    `Total: **R${Number(inv.invoice_amount).toFixed(2)}**`,
    inv.quotation_id ? `Quotation: #${inv.quotation_id}` : null,
    inv.remarks ? `Remarks: ${inv.remarks}` : null,
    ``,
    `**Line Items:**`,
    itemLines.length > 0 ? itemLines.join('\n') : '  (no items)',
  ].filter(Boolean).join('\n');

  return { success: true, message: details, data: { invoice: inv, items } };
}

async function execSearchPricing(args: Record<string, unknown>): Promise<ToolResult> {
  let sql = `SELECT p.id, p.item_name, p.description, p.unit_price, p.category_id
     FROM pricing p WHERE 1=1`;
  const params: any[] = [];

  const search = String(args.search || '').trim();
  if (search) {
    sql += ' AND (p.item_name LIKE ? OR p.description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  if (args.categoryId) {
    sql += ' AND p.category_id = ?';
    params.push(parseInt(String(args.categoryId), 10));
  }

  sql += ' ORDER BY p.item_name ASC LIMIT 30';

  const items = await db.query<{
    id: number; item_name: string; description: string | null;
    unit_price: number; category_id: number | null;
  }>(sql, params);

  if (items.length === 0) {
    return { success: true, message: search ? `No pricing items found matching "${search}".` : 'No pricing items found.' };
  }

  const lines = items.map(
    (p, i) => `${i + 1}. **${p.item_name}** — R${Number(p.unit_price).toFixed(2)}${p.description ? `\n   ${p.description.substring(0, 100)}` : ''}`,
  );

  return {
    success: true,
    message: `Found ${items.length} item(s):\n\n${lines.join('\n\n')}`,
    data: { items },
  };
}

// ============================================================================
// Staff Scheduling Tool Executors
// ============================================================================

async function execListScheduledCalls(
  args: Record<string, unknown>,
  ctx: MobileExecutionContext,
): Promise<ToolResult> {
  let sql = `SELECT sc.id, sc.title, sc.call_type, sc.scheduled_at, sc.duration_minutes,
                    sc.status, sc.screen_share, sc.conversation_id
             FROM scheduled_calls sc
             WHERE 1=1`;
  const params: any[] = [];

  const statusFilter = String(args.status || '').toLowerCase();
  if (statusFilter && ['scheduled', 'active', 'completed', 'cancelled'].includes(statusFilter)) {
    sql += ' AND sc.status = ?';
    params.push(statusFilter);
  }

  if (String(args.upcoming) === 'true') {
    sql += ' AND sc.scheduled_at >= NOW()';
  }

  sql += ' ORDER BY sc.scheduled_at ASC LIMIT 20';

  const calls = await db.query<{
    id: number; title: string; call_type: string; scheduled_at: string;
    duration_minutes: number; status: string; screen_share: number; conversation_id: number;
  }>(sql, params);

  if (calls.length === 0) {
    return { success: true, message: 'No scheduled calls found.' };
  }

  const lines = calls.map(
    (c, i) => {
      const icon = c.call_type === 'video' ? '📹' : '📞';
      const shareIcon = c.screen_share ? ' 🖥️' : '';
      return `${i + 1}. ${icon}${shareIcon} **${c.title}** — ${c.status}\n   ${new Date(c.scheduled_at).toLocaleString()} (${c.duration_minutes} min)\n   ID: ${c.id}`;
    },
  );

  return {
    success: true,
    message: `Found ${calls.length} call(s):\n\n${lines.join('\n\n')}`,
    data: { calls },
  };
}

async function execCreateScheduledCall(
  args: Record<string, unknown>,
  ctx: MobileExecutionContext,
): Promise<ToolResult> {
  const conversationId = String(args.conversationId || '').trim();
  const title = String(args.title || '').trim();
  const scheduledAt = String(args.scheduledAt || '').trim();

  if (!conversationId) return { success: false, message: 'Please provide a conversation ID.' };
  if (!title) return { success: false, message: 'Please provide a title for the call.' };
  if (!scheduledAt) return { success: false, message: 'Please provide the date and time for the call.' };

  // Validate the conversation exists
  const conv = await db.queryOne<{ id: number }>(
    'SELECT id FROM conversations WHERE id = ?',
    [conversationId],
  );
  if (!conv) return { success: false, message: 'Conversation not found.' };

  const callType = String(args.callType || 'video');
  const duration = parseInt(String(args.durationMinutes || '30'), 10) || 30;
  const screenShare = String(args.screenShare) === 'true' ? 1 : 0;

  await db.execute(
    `INSERT INTO scheduled_calls
      (conversation_id, created_by, title, call_type, screen_share, scheduled_at, duration_minutes, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', NOW(), NOW())`,
    [conversationId, ctx.userId, title, callType, screenShare, scheduledAt, duration],
  );

  return {
    success: true,
    message: `✅ Call scheduled!\n\n**${title}**\n📅 ${new Date(scheduledAt).toLocaleString()} (${duration} min)\nType: ${callType}${screenShare ? ' with screen share' : ''}`,
  };
}

// ============================================================================
// Staff Chat Tool Executors
// ============================================================================

async function execListConversations(
  args: Record<string, unknown>,
  ctx: MobileExecutionContext,
): Promise<ToolResult> {
  const limit = Math.min(parseInt(String(args.limit || '20'), 10) || 20, 50);

  let sql = `SELECT c.id, c.type, c.name, c.description, c.created_at
     FROM conversations c
     JOIN conversation_members cm ON cm.conversation_id = c.id
     WHERE cm.user_id = ?`;
  const params: any[] = [ctx.userId];

  const typeFilter = String(args.type || '').toLowerCase();
  if (typeFilter && ['direct', 'group'].includes(typeFilter)) {
    sql += ' AND c.type = ?';
    params.push(typeFilter);
  }

  sql += ' ORDER BY c.created_at DESC LIMIT ?';
  params.push(limit);

  const conversations = await db.query<{
    id: number; type: string; name: string | null; description: string | null; created_at: string;
  }>(sql, params);

  if (conversations.length === 0) {
    return { success: true, message: 'No conversations found.' };
  }

  const lines = conversations.map(
    (c, i) => {
      const icon = c.type === 'group' ? '👥' : '💬';
      return `${i + 1}. ${icon} **${c.name || 'Direct Message'}** (${c.type})\n   ID: ${c.id}`;
    },
  );

  return {
    success: true,
    message: `Found ${conversations.length} conversation(s):\n\n${lines.join('\n\n')}`,
    data: { conversations },
  };
}

async function execSendChatMessage(
  args: Record<string, unknown>,
  ctx: MobileExecutionContext,
): Promise<ToolResult> {
  const conversationId = String(args.conversationId || '').trim();
  const content = String(args.content || '').trim();

  if (!conversationId) return { success: false, message: 'Please provide a conversation ID.' };
  if (!content) return { success: false, message: 'Please provide message content.' };

  // Verify conversation exists and user is a member
  const membership = await db.queryOne<{ conversation_id: number }>(
    'SELECT conversation_id FROM conversation_members WHERE conversation_id = ? AND user_id = ?',
    [conversationId, ctx.userId],
  );
  if (!membership) {
    return { success: false, message: 'You are not a member of this conversation.' };
  }

  await db.execute(
    `INSERT INTO messages (conversation_id, sender_id, content, message_type, created_at, updated_at)
     VALUES (?, ?, ?, 'text', NOW(), NOW())`,
    [conversationId, ctx.userId, content],
  );

  return {
    success: true,
    message: `✅ Message sent to conversation ${conversationId}.`,
  };
}

// ============================================================================
// Staff Bug Tracking Tool Executors
// ============================================================================

async function execListBugs(args: Record<string, unknown>): Promise<ToolResult> {
  const limit = Math.min(parseInt(String(args.limit || '20'), 10) || 20, 50);

  let sql = `SELECT b.id, b.title, b.reporter_name, b.status, b.severity, b.workflow_phase,
                    b.assigned_to_name, b.software_name, b.created_at,
                    (SELECT COUNT(*) FROM bug_comments bc WHERE bc.bug_id = b.id) AS comment_count
             FROM bugs b WHERE 1=1`;
  const params: any[] = [];

  const status = String(args.status || '').trim();
  if (status) { sql += ' AND b.status = ?'; params.push(status); }

  const severity = String(args.severity || '').trim();
  if (severity) { sql += ' AND b.severity = ?'; params.push(severity); }

  const phase = String(args.workflow_phase || '').trim();
  if (phase) { sql += ' AND b.workflow_phase = ?'; params.push(phase); }

  const softwareId = String(args.software_id || '').trim();
  if (softwareId) { sql += ' AND b.software_id = ?'; params.push(softwareId); }

  const assignedTo = String(args.assigned_to || '').trim();
  if (assignedTo) { sql += ' AND b.assigned_to = ?'; params.push(assignedTo); }

  const search = String(args.search || '').trim();
  if (search) {
    sql += ' AND (b.title LIKE ? OR b.description LIKE ? OR b.reporter_name LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  sql += ` ORDER BY FIELD(b.severity, 'critical', 'high', 'medium', 'low'), b.created_at DESC LIMIT ?`;
  params.push(limit);

  const bugs = await db.query<{
    id: number; title: string; reporter_name: string; status: string; severity: string;
    workflow_phase: string; assigned_to_name: string | null; software_name: string | null;
    created_at: string; comment_count: number;
  }>(sql, params);

  if (bugs.length === 0) {
    return { success: true, message: 'No bugs found matching the filters.' };
  }

  const severityIcon: Record<string, string> = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' };

  const lines = bugs.map(
    (b, i) => {
      const icon = severityIcon[b.severity] || '⚪';
      const assignee = b.assigned_to_name ? ` → ${b.assigned_to_name}` : '';
      const software = b.software_name ? ` [${b.software_name}]` : '';
      const comments = b.comment_count > 0 ? ` 💬${b.comment_count}` : '';
      return `${i + 1}. ${icon} **#${b.id} ${b.title}**${software}${comments}\n   ${b.severity} · ${b.status} · ${b.workflow_phase}${assignee}\n   Reporter: ${b.reporter_name} · ${new Date(b.created_at).toLocaleDateString()}`;
    },
  );

  return {
    success: true,
    message: `Found ${bugs.length} bug(s):\n\n${lines.join('\n\n')}`,
    data: { bugs },
  };
}

async function execGetBugDetails(args: Record<string, unknown>): Promise<ToolResult> {
  const bugId = String(args.bugId || '').trim();
  if (!bugId) return { success: false, message: 'Please provide the bug ID.' };

  const bug = await db.queryOne<{
    id: number; title: string; description: string | null; current_behaviour: string | null;
    expected_behaviour: string | null; reporter_name: string; software_name: string | null;
    status: string; severity: string; workflow_phase: string;
    assigned_to: number | null; assigned_to_name: string | null;
    created_by_name: string | null; linked_task_id: number | null;
    converted_from_task: number; converted_to_task: number | null;
    resolution_notes: string | null; resolved_at: string | null; resolved_by: string | null;
    created_at: string; updated_at: string;
  }>('SELECT * FROM bugs WHERE id = ?', [bugId]);

  if (!bug) return { success: false, message: `Bug #${bugId} not found.` };

  const comments = await db.query<{
    id: number; author_name: string; content: string; comment_type: string; is_internal: number; created_at: string;
  }>(
    'SELECT id, author_name, content, comment_type, is_internal, created_at FROM bug_comments WHERE bug_id = ? ORDER BY created_at ASC LIMIT 20',
    [bugId],
  );

  const attachmentCount = await db.queryOne<{ cnt: number }>(
    'SELECT COUNT(*) AS cnt FROM bug_attachments WHERE bug_id = ?',
    [bugId],
  );

  const severityIcon: Record<string, string> = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' };
  const icon = severityIcon[bug.severity] || '⚪';

  let msg = `${icon} **Bug #${bug.id}: ${bug.title}**\n\n`;
  msg += `**Status:** ${bug.status} · **Severity:** ${bug.severity} · **Phase:** ${bug.workflow_phase}\n`;
  msg += `**Reporter:** ${bug.reporter_name}\n`;
  if (bug.assigned_to_name) msg += `**Assigned to:** ${bug.assigned_to_name}\n`;
  if (bug.software_name) msg += `**Software:** ${bug.software_name}\n`;
  msg += `**Created:** ${new Date(bug.created_at).toLocaleString()}\n`;

  if (bug.description) msg += `\n**Description:**\n${bug.description.replace(/<[^>]+>/g, '')}\n`;
  if (bug.current_behaviour) msg += `\n**Current Behaviour:**\n${bug.current_behaviour.replace(/<[^>]+>/g, '')}\n`;
  if (bug.expected_behaviour) msg += `\n**Expected Behaviour:**\n${bug.expected_behaviour.replace(/<[^>]+>/g, '')}\n`;
  if (bug.resolution_notes) msg += `\n**Resolution:** ${bug.resolution_notes}\n`;
  if (bug.resolved_by) msg += `**Resolved by:** ${bug.resolved_by} at ${bug.resolved_at ? new Date(bug.resolved_at).toLocaleString() : 'N/A'}\n`;
  if (bug.linked_task_id) msg += `\n**Linked Task:** #${bug.linked_task_id}\n`;

  msg += `\n📎 ${attachmentCount?.cnt || 0} attachment(s)`;

  if (comments.length > 0) {
    msg += `\n\n**Comments (${comments.length}):**\n`;
    for (const c of comments) {
      const internalTag = c.is_internal ? ' 🔒' : '';
      const typeTag = c.comment_type !== 'comment' ? ` [${c.comment_type}]` : '';
      msg += `\n• **${c.author_name}**${typeTag}${internalTag} — ${new Date(c.created_at).toLocaleString()}\n  ${c.content.replace(/<[^>]+>/g, '').slice(0, 200)}`;
    }
  }

  return { success: true, message: msg, data: { bug, comments } };
}

async function execCreateBug(
  args: Record<string, unknown>,
  ctx: MobileExecutionContext,
): Promise<ToolResult> {
  const title = String(args.title || '').trim();
  const reporter_name = String(args.reporter_name || '').trim();

  if (!title) return { success: false, message: 'Please provide a title for the bug.' };
  if (!reporter_name) return { success: false, message: 'Please provide the reporter name.' };

  const description = args.description ? String(args.description) : null;
  const current_behaviour = args.current_behaviour ? String(args.current_behaviour) : null;
  const expected_behaviour = args.expected_behaviour ? String(args.expected_behaviour) : null;
  const severity = String(args.severity || 'medium');
  const software_id = args.software_id ? parseInt(String(args.software_id), 10) : null;
  const software_name = args.software_name ? String(args.software_name) : null;
  const assigned_to = args.assigned_to ? parseInt(String(args.assigned_to), 10) : null;
  const assigned_to_name = args.assigned_to_name ? String(args.assigned_to_name) : null;

  // Look up the staff user's name for created_by_name
  let created_by_name = 'System';
  const userRow = await db.queryOne<{ name: string }>('SELECT name FROM users WHERE id = ?', [ctx.userId]);
  if (userRow) created_by_name = userRow.name;

  const result = await db.execute(
    `INSERT INTO bugs
      (title, description, current_behaviour, expected_behaviour, reporter_name,
       software_id, software_name, status, severity, workflow_phase,
       assigned_to, assigned_to_name, created_by, created_by_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, 'intake', ?, ?, ?, ?, NOW(), NOW())`,
    [title, description, current_behaviour, expected_behaviour, reporter_name,
     software_id, software_name, severity, assigned_to, assigned_to_name,
     ctx.userId, created_by_name],
  );

  const insertId = (result as any).insertId;

  // Add system comment for creation
  await db.execute(
    `INSERT INTO bug_comments (bug_id, author_name, author_id, content, is_internal, comment_type, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, 'status_change', NOW(), NOW())`,
    [insertId, 'System', ctx.userId, `Bug reported and entered Intake phase.`],
  );

  return {
    success: true,
    message: `✅ Bug #${insertId} created!\n\n**${title}**\nSeverity: ${severity} · Status: open · Phase: intake\nReporter: ${reporter_name}${assigned_to_name ? `\nAssigned to: ${assigned_to_name}` : ''}`,
    data: { bugId: insertId },
  };
}

async function execUpdateBug(
  args: Record<string, unknown>,
  ctx: MobileExecutionContext,
): Promise<ToolResult> {
  const bugId = String(args.bugId || '').trim();
  if (!bugId) return { success: false, message: 'Please provide the bug ID.' };

  // Verify bug exists
  const existing = await db.queryOne<{ id: number; status: string; assigned_to: number | null }>(
    'SELECT id, status, assigned_to FROM bugs WHERE id = ?',
    [bugId],
  );
  if (!existing) return { success: false, message: `Bug #${bugId} not found.` };

  const allowed = [
    'title', 'description', 'current_behaviour', 'expected_behaviour',
    'reporter_name', 'software_id', 'software_name', 'status', 'severity',
    'assigned_to', 'assigned_to_name', 'resolution_notes',
  ];

  const fields: string[] = [];
  const values: any[] = [];
  const changes: string[] = [];

  for (const key of allowed) {
    if (args[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(args[key] === '' ? null : args[key]);
      changes.push(key);
    }
  }

  // Handle resolution timestamps
  const newStatus = String(args.status || '');
  if (newStatus === 'resolved' && existing.status !== 'resolved') {
    let resolvedBy = 'System';
    const userRow = await db.queryOne<{ name: string }>('SELECT name FROM users WHERE id = ?', [ctx.userId]);
    if (userRow) resolvedBy = userRow.name;
    fields.push('resolved_at = NOW()');
    fields.push('resolved_by = ?');
    values.push(resolvedBy);
  }

  if (fields.length === 0) return { success: false, message: 'No fields provided to update.' };

  values.push(bugId);
  await db.execute(`UPDATE bugs SET ${fields.join(', ')} WHERE id = ?`, values);

  return {
    success: true,
    message: `✅ Bug #${bugId} updated!\n\nFields changed: ${changes.join(', ')}`,
  };
}

async function execAddBugComment(
  args: Record<string, unknown>,
  ctx: MobileExecutionContext,
): Promise<ToolResult> {
  const bugId = String(args.bugId || '').trim();
  const content = String(args.content || '').trim();

  if (!bugId) return { success: false, message: 'Please provide the bug ID.' };
  if (!content) return { success: false, message: 'Please provide comment content.' };

  // Verify bug exists
  const bug = await db.queryOne<{ id: number }>('SELECT id FROM bugs WHERE id = ?', [bugId]);
  if (!bug) return { success: false, message: `Bug #${bugId} not found.` };

  const isInternal = String(args.is_internal || 'true') === 'true' ? 1 : 0;

  // Look up the staff user's name
  let authorName = 'Staff';
  const userRow = await db.queryOne<{ name: string }>('SELECT name FROM users WHERE id = ?', [ctx.userId]);
  if (userRow) authorName = userRow.name;

  await db.execute(
    `INSERT INTO bug_comments (bug_id, author_name, author_id, content, is_internal, comment_type, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'comment', NOW(), NOW())`,
    [bugId, authorName, ctx.userId, content, isInternal],
  );

  const internalNote = isInternal ? ' (internal)' : '';
  return {
    success: true,
    message: `✅ Comment added to bug #${bugId}${internalNote}.`,
  };
}

async function execUpdateBugWorkflow(
  args: Record<string, unknown>,
  ctx: MobileExecutionContext,
): Promise<ToolResult> {
  const bugId = String(args.bugId || '').trim();
  const newPhase = String(args.workflow_phase || '').trim();

  if (!bugId) return { success: false, message: 'Please provide the bug ID.' };
  if (!['intake', 'qa', 'development'].includes(newPhase)) {
    return { success: false, message: 'Workflow phase must be one of: intake, qa, development.' };
  }

  // Verify bug exists and get current phase
  const bug = await db.queryOne<{ id: number; workflow_phase: string }>(
    'SELECT id, workflow_phase FROM bugs WHERE id = ?',
    [bugId],
  );
  if (!bug) return { success: false, message: `Bug #${bugId} not found.` };

  if (bug.workflow_phase === newPhase) {
    return { success: true, message: `Bug #${bugId} is already in the **${newPhase}** phase.` };
  }

  const oldPhase = bug.workflow_phase;
  await db.execute('UPDATE bugs SET workflow_phase = ? WHERE id = ?', [newPhase, bugId]);

  // Add system workflow comment
  let authorName = 'System';
  const userRow = await db.queryOne<{ name: string }>('SELECT name FROM users WHERE id = ?', [ctx.userId]);
  if (userRow) authorName = userRow.name;

  await db.execute(
    `INSERT INTO bug_comments (bug_id, author_name, author_id, content, is_internal, comment_type, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, 'workflow_change', NOW(), NOW())`,
    [bugId, authorName, ctx.userId, `Workflow phase changed: ${oldPhase} → ${newPhase}`],
  );

  const phaseLabels: Record<string, string> = { intake: 'Intake', qa: 'QA', development: 'Development' };
  return {
    success: true,
    message: `✅ Bug #${bugId} moved from **${phaseLabels[oldPhase] || oldPhase}** to **${phaseLabels[newPhase]}**.`,
  };
}

async function execGetBugStats(): Promise<ToolResult> {
  const total = await db.queryOne<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM bugs');

  const byStatus = await db.query<{ status: string; cnt: number }>(
    'SELECT status, COUNT(*) AS cnt FROM bugs GROUP BY status',
  );
  const bySeverity = await db.query<{ severity: string; cnt: number }>(
    'SELECT severity, COUNT(*) AS cnt FROM bugs GROUP BY severity',
  );
  const byPhase = await db.query<{ workflow_phase: string; cnt: number }>(
    'SELECT workflow_phase, COUNT(*) AS cnt FROM bugs GROUP BY workflow_phase',
  );
  const bySoftware = await db.query<{ software_name: string; cnt: number }>(
    `SELECT COALESCE(software_name, 'Unspecified') AS software_name, COUNT(*) AS cnt FROM bugs GROUP BY software_name`,
  );

  const statusMap = Object.fromEntries(byStatus.map(r => [r.status, r.cnt]));
  const severityMap = Object.fromEntries(bySeverity.map(r => [r.severity, r.cnt]));
  const phaseMap = Object.fromEntries(byPhase.map(r => [r.workflow_phase, r.cnt]));

  const severityIcon: Record<string, string> = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' };

  let msg = `📊 **Bug Statistics** (${total?.cnt || 0} total)\n\n`;

  msg += `**By Status:**\n`;
  for (const s of ['open', 'in-progress', 'pending-qa', 'resolved', 'closed', 'reopened']) {
    if (statusMap[s]) msg += `  ${s}: ${statusMap[s]}\n`;
  }

  msg += `\n**By Severity:**\n`;
  for (const s of ['critical', 'high', 'medium', 'low']) {
    if (severityMap[s]) msg += `  ${severityIcon[s]} ${s}: ${severityMap[s]}\n`;
  }

  msg += `\n**By Phase:**\n`;
  for (const p of ['intake', 'qa', 'development']) {
    if (phaseMap[p]) msg += `  ${p}: ${phaseMap[p]}\n`;
  }

  if (bySoftware.length > 0) {
    msg += `\n**By Software:**\n`;
    for (const sw of bySoftware) {
      msg += `  ${sw.software_name}: ${sw.cnt}\n`;
    }
  }

  return {
    success: true,
    message: msg,
    data: { total: total?.cnt || 0, byStatus: statusMap, bySeverity: severityMap, byPhase: phaseMap },
  };
}
