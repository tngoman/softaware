/**
 * System Health Monitor — Comprehensive
 *
 * Continuously monitors ALL system components and automatically creates cases
 * for detected issues. Monitors:
 * - MySQL connections & pool utilisation
 * - API endpoint error rates (500s tracked via middleware)
 * - Process health (PM2 restarts, orphaned workers)
 * - Memory & heap usage
 * - Disk space
 * - External services (Ollama)
 * - Ingestion queue health
 * - Enterprise endpoints
 * - Worker process status
 * - Authentication failure spikes
 */

import { db, pool, generateId, toMySQLDate } from '../db/mysql.js';
import { getAllEndpoints } from './enterpriseEndpoints.js';
import { Ollama } from 'ollama';
import { createNotification } from './notificationService.js';
import { execSync } from 'child_process';
import { totalmem, freemem } from 'os';

// ── Config ──────────────────────────────────────────────────────
const CHECK_INTERVAL = 60_000;
const FAILURE_THRESHOLD = 3;
const WARNING_THRESHOLD = 5;
const CONNECTION_WARN_PCT = 70;
const CONNECTION_CRIT_PCT = 90;
const MEMORY_WARN_PCT = 80;
const MEMORY_CRIT_PCT = 95;
const DISK_WARN_PCT = 80;
const DISK_CRIT_PCT = 95;
const ERROR_RATE_WARN = 10;
const ERROR_RATE_CRIT = 30;

interface HealthCheckResult {
  status: 'healthy' | 'warning' | 'error' | 'unknown';
  response_time_ms?: number;
  error_message?: string;
  details?: Record<string, any>;
}

// ── In-memory state (survives DB outages) ───────────────────────
const inMemoryFailures: Map<string, number> = new Map();

interface DeferredCase {
  checkType: string;
  checkName: string;
  result: HealthCheckResult;
  detectedAt: string;
}
const deferredCases: DeferredCase[] = [];

// ── API error tracking (populated by middleware) ────────────────
interface ApiErrorEntry {
  method: string;
  path: string;
  statusCode: number;
  timestamp: number;
  errorMessage?: string;
}
const recentApiErrors: ApiErrorEntry[] = [];
const MAX_ERROR_BUFFER = 1000;

/**
 * Called by the error-tracking middleware on every 5xx response.
 */
export function trackApiError(entry: ApiErrorEntry): void {
  recentApiErrors.push(entry);
  if (recentApiErrors.length > MAX_ERROR_BUFFER) {
    recentApiErrors.splice(0, recentApiErrors.length - MAX_ERROR_BUFFER);
  }
}

let lastKnownPm2Restarts: number | null = null;

// ═══════════════════════════════════════════════════════════════════
//  INDIVIDUAL HEALTH CHECKS
// ═══════════════════════════════════════════════════════════════════

async function checkDatabase(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  try {
    await db.queryOne('SELECT 1 as ping');
    const responseTime = Date.now() - startTime;

    let globalStatus: 'healthy' | 'warning' | 'error' = 'healthy';
    let globalMsg = '';
    let threadsConnected = 0;
    let maxConnections = 0;

    try {
      const threadsRow = await db.queryOne<any>("SHOW STATUS LIKE 'Threads_connected'");
      const maxRow = await db.queryOne<any>("SHOW VARIABLES LIKE 'max_connections'");
      threadsConnected = parseInt(threadsRow?.Value || '0', 10);
      maxConnections = parseInt(maxRow?.Value || '151', 10);
      const usagePct = maxConnections > 0 ? (threadsConnected / maxConnections) * 100 : 0;

      if (usagePct >= CONNECTION_CRIT_PCT) {
        globalStatus = 'error';
        globalMsg = `MySQL connection usage critical: ${threadsConnected}/${maxConnections} (${Math.round(usagePct)}%)`;
      } else if (usagePct >= CONNECTION_WARN_PCT) {
        globalStatus = 'warning';
        globalMsg = `MySQL connection usage high: ${threadsConnected}/${maxConnections} (${Math.round(usagePct)}%)`;
      }
    } catch { /* non-fatal */ }

    const poolInfo = (pool.pool as any);
    const poolTotal = poolInfo?._allConnections?.length ?? 0;
    const poolFree  = poolInfo?._freeConnections?.length ?? 0;
    const poolQueued = poolInfo?._connectionQueue?.length ?? 0;

    let status: 'healthy' | 'warning' | 'error' = globalStatus;
    if (responseTime > 1000 && status === 'healthy') status = 'error';
    else if (responseTime > 500 && status === 'healthy') status = 'warning';

    return {
      status,
      response_time_ms: responseTime,
      error_message: globalMsg || undefined,
      details: {
        threads_connected: threadsConnected,
        max_connections: maxConnections,
        pool_total: poolTotal,
        pool_free: poolFree,
        pool_queued: poolQueued,
      },
    };
  } catch (err: any) {
    return { status: 'error', response_time_ms: Date.now() - startTime, error_message: err.message };
  }
}

function checkApiErrorRate(): HealthCheckResult {
  const oneMinuteAgo = Date.now() - 60_000;
  const recentErrors = recentApiErrors.filter(e => e.timestamp > oneMinuteAgo);
  const fiveXX = recentErrors.filter(e => e.statusCode >= 500);

  const byEndpoint: Record<string, number> = {};
  for (const e of fiveXX) {
    const key = `${e.method} ${e.path.replace(/\/[a-f0-9-]{36}/g, '/:id')}`;
    byEndpoint[key] = (byEndpoint[key] || 0) + 1;
  }
  const topErrors = Object.entries(byEndpoint)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([endpoint, count]) => ({ endpoint, count }));

  const errorCount = fiveXX.length;
  let status: 'healthy' | 'warning' | 'error' = 'healthy';
  let msg: string | undefined;

  if (errorCount >= ERROR_RATE_CRIT) {
    status = 'error';
    msg = `Critical API error rate: ${errorCount} server errors in the last minute`;
  } else if (errorCount >= ERROR_RATE_WARN) {
    status = 'warning';
    msg = `Elevated API error rate: ${errorCount} server errors in the last minute`;
  }

  return {
    status,
    error_message: msg,
    details: { errors_last_minute: errorCount, total_requests_last_minute: recentErrors.length, top_failing_endpoints: topErrors },
  };
}

function checkMemoryUsage(): HealthCheckResult {
  const usage = process.memoryUsage();
  const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
  const rssMB = Math.round(usage.rss / 1024 / 1024);
  const heapPct = heapTotalMB > 0 ? (heapUsedMB / heapTotalMB) * 100 : 0;

  const totalMem = totalmem();
  const freeMem = freemem();
  const sysUsedPct = ((totalMem - freeMem) / totalMem) * 100;

  let status: 'healthy' | 'warning' | 'error' = 'healthy';
  let msg: string | undefined;

  if (sysUsedPct >= MEMORY_CRIT_PCT || (heapUsedMB > 500 && heapPct >= 95)) {
    status = 'error';
    msg = `Memory critical — System: ${Math.round(sysUsedPct)}%, Heap: ${heapUsedMB}/${heapTotalMB}MB (${Math.round(heapPct)}%)`;
  } else if (sysUsedPct >= MEMORY_WARN_PCT || heapUsedMB > 300) {
    status = 'warning';
    msg = `Memory elevated — System: ${Math.round(sysUsedPct)}%, Heap: ${heapUsedMB}/${heapTotalMB}MB`;
  }

  return {
    status,
    error_message: msg,
    details: {
      heap_used_mb: heapUsedMB, heap_total_mb: heapTotalMB, heap_pct: Math.round(heapPct),
      rss_mb: rssMB,
      system_total_mb: Math.round(totalMem / 1024 / 1024),
      system_free_mb: Math.round(freeMem / 1024 / 1024),
      system_used_pct: Math.round(sysUsedPct),
    },
  };
}

function checkDiskSpace(): HealthCheckResult {
  try {
    const output = execSync("df -h / | tail -1 | awk '{print $5}'", { encoding: 'utf-8' }).trim();
    const usedPct = parseInt(output.replace('%', ''), 10);

    let status: 'healthy' | 'warning' | 'error' = 'healthy';
    let msg: string | undefined;
    if (usedPct >= DISK_CRIT_PCT) { status = 'error'; msg = `Disk space critical: ${usedPct}% used`; }
    else if (usedPct >= DISK_WARN_PCT) { status = 'warning'; msg = `Disk space elevated: ${usedPct}% used`; }

    const dfDetail = execSync("df -h / | tail -1 | awk '{print $2, $3, $4}'", { encoding: 'utf-8' }).trim().split(/\s+/);
    return { status, error_message: msg, details: { used_pct: usedPct, total: dfDetail[0], used: dfDetail[1], available: dfDetail[2] } };
  } catch (err: any) {
    return { status: 'unknown', error_message: `Disk check failed: ${err.message}` };
  }
}

function checkProcessHealth(): HealthCheckResult {
  try {
    let pm2Restarts = 0;
    try {
      const pm2Output = execSync('pm2 jlist 2>/dev/null', { encoding: 'utf-8', timeout: 5000 });
      const pm2Data = JSON.parse(pm2Output);
      const backend = pm2Data.find((p: any) => p.name === 'softaware-backend');
      if (backend) pm2Restarts = backend.pm2_env?.restart_time || 0;
    } catch { /* non-fatal */ }

    let orphanedWorkers = 0;
    try {
      const psOutput = execSync("ps aux | grep 'ingestionWorkerProcess' | grep -v grep | wc -l", { encoding: 'utf-8', timeout: 5000 });
      orphanedWorkers = Math.max(0, parseInt(psOutput.trim(), 10) - 1); // -1 for the legitimate one
    } catch { /* non-fatal */ }

    let status: 'healthy' | 'warning' | 'error' = 'healthy';
    let msg: string | undefined;

    if (orphanedWorkers > 5) {
      status = 'error';
      msg = `${orphanedWorkers} orphaned worker processes detected — connection leak risk`;
    } else if (orphanedWorkers > 1) {
      status = 'warning';
      msg = `${orphanedWorkers} orphaned worker process(es) detected`;
    }

    if (lastKnownPm2Restarts !== null && pm2Restarts > lastKnownPm2Restarts + 5) {
      const newRestarts = pm2Restarts - lastKnownPm2Restarts;
      status = 'error';
      msg = `${msg ? msg + '; ' : ''}PM2 restarted ${newRestarts} times since last check (total: ${pm2Restarts})`;
    }
    lastKnownPm2Restarts = pm2Restarts;

    return {
      status, error_message: msg,
      details: { pm2_total_restarts: pm2Restarts, orphaned_workers: orphanedWorkers, node_uptime_seconds: Math.round(process.uptime()), pid: process.pid },
    };
  } catch (err: any) {
    return { status: 'unknown', error_message: `Process check failed: ${err.message}` };
  }
}

async function checkOllamaService(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  try {
    const ollama = new Ollama({ host: process.env.OLLAMA_HOST || 'http://localhost:11434' });
    await ollama.list();
    return { status: 'healthy', response_time_ms: Date.now() - startTime, details: { service: 'running' } };
  } catch (err: any) {
    return { status: 'error', response_time_ms: Date.now() - startTime, error_message: err.message };
  }
}

async function checkIngestionQueue(): Promise<HealthCheckResult> {
  try {
    const pendingJobs = await db.queryOne<any>('SELECT COUNT(*) as count FROM ingestion_jobs WHERE status = ?', ['pending']);
    const stuckJobs = await db.queryOne<any>(
      "SELECT COUNT(*) as count FROM ingestion_jobs WHERE status = 'processing' AND updated_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)", []
    );
    const details = { pending_count: pendingJobs?.count || 0, stuck_count: stuckJobs?.count || 0 };
    if (details.stuck_count > 0) return { status: 'warning', error_message: `${details.stuck_count} jobs stuck for over 1 hour`, details };
    if (details.pending_count > 100) return { status: 'warning', error_message: `Queue backlog: ${details.pending_count} pending`, details };
    return { status: 'healthy', details };
  } catch (err: any) {
    return { status: 'error', error_message: err.message };
  }
}

async function checkEnterpriseEndpoint(endpointId: string): Promise<HealthCheckResult> {
  const startTime = Date.now();
  try {
    const endpoints = getAllEndpoints();
    const endpoint = endpoints.find(e => e.id === endpointId);
    if (!endpoint) return { status: 'error', error_message: 'Endpoint not found' };
    if (endpoint.status !== 'active') return { status: 'warning', error_message: `Endpoint is ${endpoint.status}` };
    return { status: 'healthy', response_time_ms: Date.now() - startTime, details: { client_name: endpoint.client_name, llm_provider: endpoint.llm_provider } };
  } catch (err: any) {
    return { status: 'error', response_time_ms: Date.now() - startTime, error_message: err.message };
  }
}

async function checkWorkerProcess(): Promise<HealthCheckResult> {
  try {
    let workerRunning = false;
    try {
      const psOutput = execSync("ps aux | grep 'ingestionWorkerProcess' | grep -v grep | head -1", { encoding: 'utf-8', timeout: 5000 });
      workerRunning = psOutput.trim().length > 0;
    } catch { /* grep returns 1 when no match */ }

    return {
      status: workerRunning ? 'healthy' : 'error',
      error_message: workerRunning ? undefined : 'Ingestion worker process is not running',
      details: { worker_running: workerRunning },
    };
  } catch (err: any) {
    return { status: 'unknown', error_message: `Worker check failed: ${err.message}` };
  }
}

function checkAuthHealth(): HealthCheckResult {
  const oneMinuteAgo = Date.now() - 60_000;
  const recentAuthErrors = recentApiErrors.filter(
    e => e.timestamp > oneMinuteAgo && e.path.includes('/auth/login') && e.statusCode >= 500
  );

  let status: 'healthy' | 'warning' | 'error' = 'healthy';
  let msg: string | undefined;
  if (recentAuthErrors.length >= 5) { status = 'error'; msg = `Auth service errors: ${recentAuthErrors.length} login 500s in last minute`; }
  else if (recentAuthErrors.length >= 2) { status = 'warning'; msg = `Auth issues: ${recentAuthErrors.length} login 500s in last minute`; }
  return { status, error_message: msg, details: { auth_errors_last_minute: recentAuthErrors.length } };
}

// ═══════════════════════════════════════════════════════════════════
//  RECORDING & AUTO-CASE CREATION
// ═══════════════════════════════════════════════════════════════════

async function recordHealthCheck(checkType: string, checkName: string, result: HealthCheckResult): Promise<void> {
  const memKey = `${checkType}:${checkName}`;
  if (result.status === 'error' || result.status === 'warning') {
    inMemoryFailures.set(memKey, (inMemoryFailures.get(memKey) || 0) + 1);
  } else {
    inMemoryFailures.set(memKey, 0);
  }
  const memFailures = inMemoryFailures.get(memKey) || 0;

  try {
    await flushDeferredCases();

    const existing = await db.queryOne<any>(
      'SELECT * FROM system_health_checks WHERE check_type = ? AND check_name = ?',
      [checkType, checkName]
    );

    const now = toMySQLDate(new Date());
    const isFailure = result.status === 'error' || result.status === 'warning';
    const consecutiveFailures = isFailure
      ? Math.max((existing?.consecutive_failures || 0) + 1, memFailures)
      : 0;

    const shouldCreateCase =
      (result.status === 'error' && consecutiveFailures >= FAILURE_THRESHOLD) ||
      (result.status === 'warning' && consecutiveFailures >= WARNING_THRESHOLD);

    if (existing) {
      await db.execute(
        `UPDATE system_health_checks SET 
          status = ?, response_time_ms = ?, error_message = ?, details = ?,
          last_check = ?, last_success = ?, last_failure = ?,
          consecutive_failures = ?, updated_at = ?
         WHERE id = ?`,
        [
          result.status, result.response_time_ms ?? null,
          result.error_message ?? null, JSON.stringify(result.details || {}),
          now,
          result.status === 'healthy' ? now : existing.last_success,
          isFailure ? now : existing.last_failure,
          consecutiveFailures, now, existing.id,
        ]
      );

      if (shouldCreateCase && !existing.case_id) {
        const caseId = await createAutoDetectedCase(checkType, checkName, result, consecutiveFailures);
        if (caseId) {
          await db.execute('UPDATE system_health_checks SET case_id = ? WHERE id = ?', [caseId, existing.id]);
        }
      }

      if (result.status === 'healthy' && existing.case_id) {
        await db.execute(
          `UPDATE cases SET status = 'resolved', resolution = ?, resolved_at = ? WHERE id = ? AND status NOT IN ('resolved','closed')`,
          [`Automatically resolved — ${checkName} health restored`, now, existing.case_id]
        );
        await db.execute('UPDATE system_health_checks SET case_id = NULL WHERE id = ?', [existing.id]);
      }
    } else {
      await db.execute(
        `INSERT INTO system_health_checks (
          id, check_type, check_name, status, response_time_ms, error_message, details,
          last_check, last_success, last_failure, consecutive_failures, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          generateId(), checkType, checkName, result.status,
          result.response_time_ms ?? null, result.error_message ?? null,
          JSON.stringify(result.details || {}), now,
          result.status === 'healthy' ? now : null,
          isFailure ? now : null,
          consecutiveFailures, now, now,
        ]
      );
    }
  } catch (err: any) {
    console.error('[HealthMonitor] Record error:', err?.message || err);
    if (memFailures >= FAILURE_THRESHOLD) {
      const alreadyDeferred = deferredCases.some(d => d.checkType === checkType && d.checkName === checkName);
      if (!alreadyDeferred) {
        console.warn(`[HealthMonitor] DB unreachable — deferring case for ${checkName} (${memFailures} failures)`);
        deferredCases.push({ checkType, checkName, result, detectedAt: new Date().toISOString() });
      }
    }
  }
}

async function flushDeferredCases(): Promise<void> {
  while (deferredCases.length > 0) {
    const deferred = deferredCases[0];
    try {
      const existing = await db.queryOne<any>(
        'SELECT case_id FROM system_health_checks WHERE check_type = ? AND check_name = ?',
        [deferred.checkType, deferred.checkName]
      );
      if (!existing?.case_id) {
        const enrichedResult = {
          ...deferred.result,
          error_message: `${deferred.result.error_message || 'Unknown error'} (first detected at ${deferred.detectedAt}, deferred because DB was unreachable)`,
        };
        const caseId = await createAutoDetectedCase(deferred.checkType, deferred.checkName, enrichedResult);
        if (caseId && existing) {
          await db.execute(
            'UPDATE system_health_checks SET case_id = ? WHERE check_type = ? AND check_name = ?',
            [caseId, deferred.checkType, deferred.checkName]
          );
        }
      }
      deferredCases.shift();
    } catch { break; }
  }
}

async function createAutoDetectedCase(
  checkType: string, checkName: string, result: HealthCheckResult, consecutiveFailures?: number,
): Promise<string | null> {
  try {
    const caseId = generateId();
    const caseNumber = `AUTO-${Date.now().toString().slice(-8)}`;
    const now = toMySQLDate(new Date());

    const severityMap: Record<string, string> = {
      database: 'critical', process: 'critical', memory: 'critical', authentication: 'critical',
      api_errors: 'high', worker: 'high', disk: 'high',
      service: 'medium', ingestion: 'medium', enterprise: 'medium',
    };
    const severity = result.status === 'error' ? (severityMap[checkType] || 'high') : 'medium';

    const categoryMap: Record<string, string> = {
      api_errors: 'bug', memory: 'performance', process: 'performance', disk: 'performance',
      database: 'data_issue', authentication: 'security',
    };
    const category = categoryMap[checkType] || 'other';

    const title = `System Alert: ${checkName}`;
    const description = [
      `**Automated health check detected a ${result.status} condition.**\n`,
      `**Check Type:** ${checkType}`,
      `**Check Name:** ${checkName}`,
      `**Status:** ${result.status}`,
      `**Error:** ${result.error_message || 'No error message'}\n`,
      `**Details:**\n\`\`\`json\n${JSON.stringify(result.details || {}, null, 2)}\n\`\`\`\n`,
      `Detected after ${consecutiveFailures ?? FAILURE_THRESHOLD} consecutive failures at ${now}.`,
    ].join('\n');

    await db.execute(
      `INSERT INTO cases (
        id, case_number, title, description, severity, status, type, source,
        category, component_name, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        caseId, caseNumber, title, description, severity, 'open',
        'auto_detected', 'health_monitor', category, checkName,
        JSON.stringify({ check_type: checkType, check_name: checkName, details: result.details, auto_detected: true }),
        now, now,
      ]
    );

    await db.execute(
      'INSERT INTO case_activity (id, case_id, action, new_value, created_at) VALUES (?, ?, ?, ?, ?)',
      [generateId(), caseId, 'auto_created', `Health monitor: ${checkType} ${result.status} — ${result.error_message || checkName}`, now]
    );

    const admins = await db.query<any>(
      `SELECT id FROM users WHERE is_admin = 1`
    );
    for (const admin of admins) {
      await createNotification({
        userId: admin.id,
        type: 'system_alert',
        title: `🚨 ${title}`,
        message: result.error_message || `Health check failure: ${checkName}`,
        data: { caseId, caseNumber, checkType, checkName, action_url: '/admin/cases' },
      });
    }

    console.log(`[HealthMonitor] Auto-created case ${caseNumber} for ${checkName}: ${result.error_message || result.status}`);
    return caseId;
  } catch (err) {
    console.error('[HealthMonitor] Auto-case creation failed:', err);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN RUNNER
// ═══════════════════════════════════════════════════════════════════

export async function runHealthChecks(): Promise<void> {
  console.log('[HealthMonitor] Running health checks...');

  // 1. Database (must come first)
  const dbResult = await checkDatabase();
  await recordHealthCheck('database', 'MySQL Connection', dbResult);

  // 2. API error rate (in-memory, no DB needed)
  const apiResult = checkApiErrorRate();
  await recordHealthCheck('api_errors', 'API Error Rate', apiResult);

  // 3. Process health
  const processResult = checkProcessHealth();
  await recordHealthCheck('process', 'Backend Process', processResult);

  // 4. Memory
  const memResult = checkMemoryUsage();
  await recordHealthCheck('memory', 'Memory Usage', memResult);

  // 5. Disk
  const diskResult = checkDiskSpace();
  await recordHealthCheck('disk', 'Disk Space', diskResult);

  // 6. Authentication
  const authResult = checkAuthHealth();
  await recordHealthCheck('authentication', 'Authentication Service', authResult);

  // 7. Worker process
  const workerResult = await checkWorkerProcess();
  await recordHealthCheck('worker', 'Ingestion Worker', workerResult);

  // 8. Ollama
  const ollamaResult = await checkOllamaService();
  await recordHealthCheck('service', 'Ollama Service', ollamaResult);

  // 9. Ingestion queue
  const queueResult = await checkIngestionQueue();
  await recordHealthCheck('ingestion', 'Ingestion Queue', queueResult);

  // 10. Enterprise endpoints
  try {
    const endpoints = getAllEndpoints();
    for (const endpoint of endpoints) {
      const result = await checkEnterpriseEndpoint(endpoint.id);
      await recordHealthCheck('enterprise', `Enterprise: ${endpoint.client_name}`, result);
    }
  } catch { /* endpoint service may not be initialised */ }

  console.log('[HealthMonitor] Health checks complete');
}

export function startHealthMonitoring(): void {
  console.log('[HealthMonitor] Starting comprehensive health monitoring...');
  setTimeout(() => {
    runHealthChecks();
    setInterval(runHealthChecks, CHECK_INTERVAL);
  }, 10_000);
}

export async function getHealthStatus(): Promise<any> {
  const checks = await db.query<any>(
    'SELECT * FROM system_health_checks ORDER BY FIELD(status, "error", "warning", "unknown", "healthy"), check_type, check_name'
  );
  const summary = {
    overall_status: 'healthy' as 'healthy' | 'warning' | 'error',
    total_checks: checks.length,
    healthy: 0, warning: 0, error: 0, unknown: 0,
    checks: checks.map(c => {
      let details = c.details || {};
      if (typeof details === 'string') {
        try { details = JSON.parse(details); } catch { /* leave as-is */ }
      }
      return { ...c, details };
    }),
  };
  for (const check of checks) {
    if (check.status === 'healthy') summary.healthy++;
    else if (check.status === 'warning') summary.warning++;
    else if (check.status === 'error') summary.error++;
    else summary.unknown++;
  }
  if (summary.error > 0) summary.overall_status = 'error';
  else if (summary.warning > 0) summary.overall_status = 'warning';
  return summary;
}
