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
 * Task tools proxy to external software APIs using the staff member's
 * stored software token from staff_software_tokens.
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

      // ----- Staff task tools -----
      case 'list_tasks':
        return requireStaff(ctx, () => execListTasks(args, ctx));

      case 'create_task':
        return requireStaff(ctx, () => execCreateTask(args, ctx));

      case 'update_task':
        return requireStaff(ctx, () => execUpdateTask(args, ctx));

      case 'add_task_comment':
        return requireStaff(ctx, () => execAddTaskComment(args, ctx));

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

interface SoftwareTokenRow {
  api_url: string;
  token: string;
  software_name: string | null;
}

/**
 * Get the first available software token for a staff user.
 * Tasks live on the external software API, so we need the stored token.
 */
async function getStaffSoftwareToken(userId: string): Promise<SoftwareTokenRow | null> {
  return db.queryOne<SoftwareTokenRow>(
    `SELECT api_url, token, software_name
     FROM staff_software_tokens
     WHERE user_id = ?
     ORDER BY updated_at DESC LIMIT 1`,
    [userId],
  );
}

/**
 * Proxy a request to the external software API (same pattern as softawareTasks route).
 */
async function taskProxy(
  apiUrl: string,
  path: string,
  method: string,
  softwareToken: string,
  body?: any,
): Promise<{ status: number; data: any }> {
  const url = `${apiUrl.replace(/\/+$/, '')}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Bearer ${softwareToken}`,
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

// ============================================================================
// Staff Task Tool Executors
// ============================================================================

async function execListTasks(
  args: Record<string, unknown>,
  ctx: MobileExecutionContext,
): Promise<ToolResult> {
  const creds = await getStaffSoftwareToken(ctx.userId);
  if (!creds) {
    return {
      success: false,
      message: 'You don\'t have an external software token linked yet. To use task management, go to Dashboard → Software Connections and add your project management API credentials. Once linked, I\'ll be able to list, create, and manage your development tasks.',
    };
  }

  const result = await taskProxy(
    creds.api_url,
    '/api/development/tasks/paginated?page=1&limit=50',
    'GET',
    creds.token,
  );

  if (result.status >= 400) {
    return { success: false, message: `External API returned error ${result.status}. Your software token may have expired.` };
  }

  // Parse the response — external APIs typically return { data: [...] } or an array
  let tasks: any[] = [];
  if (Array.isArray(result.data)) tasks = result.data;
  else if (result.data?.data && Array.isArray(result.data.data)) tasks = result.data.data;
  else if (result.data?.tasks && Array.isArray(result.data.tasks)) tasks = result.data.tasks;

  // Filter by status if requested
  const statusFilter = String(args.status || '').toLowerCase();
  if (statusFilter) {
    const normalized = statusFilter === 'in-progress' ? 'progress' : statusFilter;
    tasks = tasks.filter((t: any) => t.status === normalized || t.task_status === normalized);
  }

  // Filter to assigned-to-me
  if (String(args.assignedToMe) === 'true') {
    // Try matching by user name from local DB
    const user = await db.queryOne<{ name: string | null; email: string }>(
      'SELECT name, email FROM users WHERE id = ?',
      [ctx.userId],
    );
    if (user) {
      const userName = (user.name || user.email || '').toLowerCase();
      tasks = tasks.filter((t: any) => {
        const assignee = (t.assigned_to_name || '').toLowerCase();
        return assignee.includes(userName) || userName.includes(assignee);
      });
    }
  }

  if (tasks.length === 0) {
    return { success: true, message: 'No tasks found matching your criteria.' };
  }

  // Format for display (limit to 15)
  const display = tasks.slice(0, 15).map((t: any, i: number) => {
    const status = t.status === 'progress' ? 'in-progress' : (t.status || t.task_status || 'unknown');
    const phase = t.workflow_phase ? ` [${t.workflow_phase}]` : '';
    const assignee = t.assigned_to_name ? ` → ${t.assigned_to_name}` : '';
    return `${i + 1}. **${t.title || t.task_name}** — ${status}${phase}${assignee}\n   ID: ${t.id}`;
  });

  return {
    success: true,
    message: `Found ${tasks.length} task(s)${tasks.length > 15 ? ' (showing first 15)' : ''}:\n\n${display.join('\n\n')}`,
    data: { tasks: tasks.slice(0, 15), total: tasks.length },
  };
}

async function execCreateTask(
  args: Record<string, unknown>,
  ctx: MobileExecutionContext,
): Promise<ToolResult> {
  const creds = await getStaffSoftwareToken(ctx.userId);
  if (!creds) {
    return { success: false, message: 'You don\'t have an external software token linked yet. Go to Dashboard → Software Connections to add your project management API credentials first.' };
  }

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

  const result = await taskProxy(creds.api_url, '/api/development/tasks', 'POST', creds.token, taskPayload);

  if (result.status >= 400) {
    return { success: false, message: `Failed to create task: ${typeof result.data === 'string' ? result.data : JSON.stringify(result.data?.message || result.data?.error || 'Unknown error')}` };
  }

  const taskId = result.data?.id || result.data?.data?.id || result.data?.task_id || 'unknown';
  return {
    success: true,
    message: `✅ Task created successfully!\n\n**Title:** ${title}\n**Type:** ${taskType}\n**Task ID:** ${taskId}`,
    data: { taskId, task: result.data },
  };
}

async function execUpdateTask(
  args: Record<string, unknown>,
  ctx: MobileExecutionContext,
): Promise<ToolResult> {
  const creds = await getStaffSoftwareToken(ctx.userId);
  if (!creds) {
    return { success: false, message: 'You don\'t have an external software token linked yet. Go to Dashboard → Software Connections to add your project management API credentials first.' };
  }

  const taskId = String(args.taskId || '').trim();
  if (!taskId) return { success: false, message: 'Task ID is required.' };

  const updatePayload: Record<string, any> = {
    task_id: parseInt(taskId, 10),
  };

  const changes: string[] = [];

  if (args.status) {
    const status = String(args.status);
    updatePayload.task_status = status === 'in-progress' ? 'progress' : status;
    changes.push(`Status → ${status}`);
  }
  if (args.workflow_phase) {
    updatePayload.workflow_phase = String(args.workflow_phase);
    changes.push(`Phase → ${args.workflow_phase}`);
  }
  if (args.assigned_to) {
    updatePayload.assigned_to = parseInt(String(args.assigned_to), 10);
    changes.push(`Assigned to → user ${args.assigned_to}`);
  }
  if (args.hours) {
    updatePayload.task_hours = String(args.hours);
    changes.push(`Hours → ${args.hours}`);
  }
  if (args.description) {
    updatePayload.task_description = String(args.description);
    changes.push('Description updated');
  }

  if (changes.length === 0) {
    return { success: false, message: 'No changes specified. Provide at least one field to update (status, workflow_phase, assigned_to, hours, or description).' };
  }

  const result = await taskProxy(creds.api_url, '/api/development/tasks', 'PUT', creds.token, updatePayload);

  if (result.status >= 400) {
    return { success: false, message: `Failed to update task: ${typeof result.data === 'string' ? result.data : JSON.stringify(result.data?.message || result.data?.error || 'Unknown error')}` };
  }

  return {
    success: true,
    message: `✅ Task #${taskId} updated:\n${changes.map(c => `  • ${c}`).join('\n')}`,
    data: { taskId, changes },
  };
}

async function execAddTaskComment(
  args: Record<string, unknown>,
  ctx: MobileExecutionContext,
): Promise<ToolResult> {
  const creds = await getStaffSoftwareToken(ctx.userId);
  if (!creds) {
    return { success: false, message: 'You don\'t have an external software token linked yet. Go to Dashboard → Software Connections to add your project management API credentials first.' };
  }

  const taskId = String(args.taskId || '').trim();
  const content = String(args.content || '').trim();
  if (!taskId) return { success: false, message: 'Task ID is required.' };
  if (!content) return { success: false, message: 'Comment content is required.' };

  const isInternal = String(args.is_internal || 'true') === 'true' ? 1 : 0;

  const commentPayload = {
    content,
    is_internal: isInternal,
    time_spent: 0,
    parent_comment_id: null,
  };

  const result = await taskProxy(
    creds.api_url,
    `/api/development/tasks/${taskId}/comments`,
    'POST',
    creds.token,
    commentPayload,
  );

  if (result.status >= 400) {
    return { success: false, message: `Failed to add comment: ${typeof result.data === 'string' ? result.data : JSON.stringify(result.data?.message || result.data?.error || 'Unknown error')}` };
  }

  return {
    success: true,
    message: `💬 Comment added to task #${taskId}${isInternal ? ' (internal note)' : ''}.`,
    data: { taskId, commentId: result.data?.comment_id || result.data?.id },
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
     AND id COLLATE utf8mb4_unicode_ci NOT IN (
       SELECT ur.user_id COLLATE utf8mb4_unicode_ci FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE r.slug IN ('admin','super_admin','developer','client_manager','qa_specialist','deployer')
     )
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
  const isStaff = await db.queryOne<{ slug: string }>(
    `SELECT r.slug FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
       AND r.slug IN ('admin','super_admin','developer','client_manager','qa_specialist','deployer')
     LIMIT 1`,
    [clientId],
  );
  if (isStaff) {
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
