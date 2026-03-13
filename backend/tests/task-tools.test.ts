/**
 * Unit Tests — Staff Task Tool Executors (v2.1.0)
 *
 * Tests the 22 task-related executor functions wired in
 * mobileActionExecutor.ts via the `executeMobileAction()` dispatcher.
 *
 * Strategy:
 *   - Mock the `db` module (query/queryOne/execute) to return deterministic data
 *   - Mock `fetch` (global) for external proxy calls (taskProxyV2)
 *   - Mock `syncAllSources` and `createNotificationWithPush` (fire-and-forget)
 *   - Call `executeMobileAction()` with staff context + tool arguments
 *   - Assert success/failure, message content, and data payloads
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be declared BEFORE the dynamic import
// ---------------------------------------------------------------------------

// Mock db
const mockQuery = vi.fn<(...args: any[]) => Promise<any[]>>();
const mockQueryOne = vi.fn<(...args: any[]) => Promise<any>>();
const mockExecute = vi.fn<(...args: any[]) => Promise<number>>();

vi.mock('../src/db/mysql.js', () => ({
  db: {
    query: (...args: any[]) => mockQuery(...args),
    queryOne: (...args: any[]) => mockQueryOne(...args),
    execute: (...args: any[]) => mockExecute(...args),
  },
  toMySQLDate: (d: Date) => d.toISOString().slice(0, 19).replace('T', ' '),
}));

// Mock taskSyncService
const mockSyncAllSources = vi.fn<() => Promise<any[]>>();
vi.mock('../src/services/taskSyncService.js', () => ({
  syncAllSources: (...args: any[]) => mockSyncAllSources(...args),
}));

// Mock firebaseService
const mockCreateNotification = vi.fn<(...args: any[]) => Promise<void>>();
vi.mock('../src/services/firebaseService.js', () => ({
  createNotificationWithPush: (...args: any[]) => mockCreateNotification(...args),
}));

// Mock knowledgeCategorizer
vi.mock('../src/services/knowledgeCategorizer.js', () => ({
  getAssistantKnowledgeHealth: vi.fn().mockResolvedValue({}),
}));

// Mock enterpriseEndpoints
vi.mock('../src/services/enterpriseEndpoints.js', () => ({
  createEndpoint: vi.fn().mockResolvedValue({}),
}));

// Mock env config
vi.mock('../src/config/env.js', () => ({
  env: {
    JWT_SECRET: 'test-secret',
    SMTP_HOST: 'localhost',
    SMTP_PORT: 25,
    SMTP_USER: '',
    SMTP_PASS: '',
    SMTP_FROM: 'test@test.com',
  },
}));

// Mock emailService
vi.mock('../src/services/emailService.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

// Mock siteBuilderService
vi.mock('../src/services/siteBuilderService.js', () => ({
  siteBuilderService: {
    regenerateSite: vi.fn().mockResolvedValue({}),
    deploySite: vi.fn().mockResolvedValue({}),
  },
}));

// Mock global fetch for taskProxyV2
const mockFetch = vi.fn<(...args: any[]) => Promise<any>>();
vi.stubGlobal('fetch', mockFetch);

// ---------------------------------------------------------------------------
// Import the module under test (AFTER mocks are established)
// ---------------------------------------------------------------------------

const { executeMobileAction } = await import('../src/services/mobileActionExecutor.js');

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

type ToolResult = { success: boolean; message: string; data?: Record<string, unknown> };

/** Staff execution context */
const staffCtx = { userId: 'staff-user-1', role: 'staff' as const };

/** Client execution context (should be rejected for task tools) */
const clientCtx = { userId: 'client-user-1', role: 'client' as const };

/** Simulate a successful JSON fetch response */
function jsonResponse(data: any, status = 200) {
  return Promise.resolve({
    status,
    headers: { get: (h: string) => (h === 'content-type' ? 'application/json' : null) },
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

/** Standard local task row for test fixtures */
function makeLocalTask(overrides: Record<string, any> = {}) {
  return {
    id: 42,
    source_id: 1,
    external_id: '157',
    title: 'Fix login bug',
    description: '<p>Users cannot log in</p>',
    notes: null,
    status: 'progress',
    type: 'bug-fix',
    color: '#3788d8',
    start_date: '2026-03-01 00:00:00',
    end_date: '2026-03-05 00:00:00',
    actual_start: null,
    actual_end: null,
    hours: '3.50',
    estimated_hours: 4,
    assigned_to: 5,
    assigned_to_name: 'John Developer',
    created_by_name: 'Admin User',
    user_id: 1,
    workflow_phase: 'development',
    approval_required: 0,
    approved_by: null,
    approved_at: null,
    parent_task_id: null,
    association_type: null,
    task_order: 1,
    order_number: null,
    software_id: 5,
    module_id: 2,
    module_name: 'Authentication',
    task_billed: 0,
    task_bill_date: null,
    task_deleted: 0,
    local_dirty: 0,
    last_synced_at: '2026-03-10 08:15:00',
    sync_hash: 'abc123',
    priority: 'high',
    is_bookmarked: 1,
    color_label: 'red',
    local_tags: '["frontend","urgent-fix"]',
    kanban_order: 2,
    view_count: 7,
    last_viewed_at: '2026-03-10 08:00:00',
    source_name: 'Softaware Tasks',
    source_type: 'tasks-api',
    created_at: '2026-03-01 08:00:00',
    updated_at: '2026-03-10 08:15:00',
    ...overrides,
  };
}

/** Standard task source row */
function makeSource(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    base_url: 'https://portal.example.com',
    api_key: 'test-api-key-123',
    software_id: 5,
    name: 'Softaware Tasks',
    ...overrides,
  };
}

function call(name: string, args: Record<string, unknown> = {}) {
  return executeMobileAction({ name, arguments: args }, staffCtx) as Promise<ToolResult>;
}

function callAsClient(name: string, args: Record<string, unknown> = {}) {
  return executeMobileAction({ name, arguments: args }, clientCtx) as Promise<ToolResult>;
}

// ---------------------------------------------------------------------------
// Reset all mocks before each test
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
  mockExecute.mockResolvedValue(1); // Default: 1 row affected
});

// ============================================================================
// SECTION 1: Role Guard — Clients MUST be rejected from all task tools
// ============================================================================

describe('Role Guard — clients rejected from all task tools', () => {
  const taskToolNames = [
    'list_tasks', 'get_task', 'create_task', 'update_task', 'delete_task',
    'get_task_comments', 'add_task_comment',
    'bookmark_task', 'set_task_priority', 'set_task_color', 'set_task_tags',
    'start_task', 'complete_task', 'approve_task',
    'get_task_stats', 'get_pending_approvals', 'get_task_tags',
    'sync_tasks', 'get_sync_status',
    'stage_tasks_for_invoice', 'get_staged_invoices', 'process_staged_invoices',
  ];

  for (const tool of taskToolNames) {
    it(`rejects client calling ${tool}`, async () => {
      const result = await callAsClient(tool, { taskId: '42' });
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/staff/i);
    });
  }
});

// ============================================================================
// SECTION 2: Core CRUD
// ============================================================================

describe('list_tasks', () => {
  it('returns tasks from local database', async () => {
    const tasks = [
      makeLocalTask({ id: 42, title: 'Task A' }),
      makeLocalTask({ id: 43, title: 'Task B', external_id: '158' }),
    ];
    mockQuery
      .mockResolvedValueOnce([{ total: 2 }])   // COUNT query
      .mockResolvedValue(tasks);                 // SELECT query

    const result = await call('list_tasks', {});
    expect(result.success).toBe(true);
    expect(result.message).toContain('Task A');
    expect(result.message).toContain('Task B');
    expect(result.message).toContain('2 task(s)');
  });

  it('applies status filter', async () => {
    mockQuery
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([]);

    const result = await call('list_tasks', { status: 'completed' });
    expect(result.success).toBe(true);
    expect(result.message).toMatch(/no tasks found/i);

    // Verify the SQL contained status filter
    const sqlCall = mockQuery.mock.calls[0];
    expect(sqlCall[0]).toContain('t.status = ?');
  });

  it('applies priority filter', async () => {
    mockQuery
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([]);

    await call('list_tasks', { priority: 'urgent' });
    expect(mockQuery.mock.calls[0][0]).toContain('t.priority = ?');
    expect(mockQuery.mock.calls[0][1]).toContain('urgent');
  });

  it('applies bookmarked filter', async () => {
    mockQuery
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([]);

    await call('list_tasks', { bookmarked: '1' });
    expect(mockQuery.mock.calls[0][0]).toContain('t.is_bookmarked = 1');
  });

  it('applies tag filter with JSON_CONTAINS', async () => {
    mockQuery
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([]);

    await call('list_tasks', { tag: 'frontend' });
    expect(mockQuery.mock.calls[0][0]).toContain('JSON_CONTAINS');
    expect(mockQuery.mock.calls[0][1]).toContain('frontend');
  });

  it('applies search filter on title/description/external_id', async () => {
    mockQuery
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([]);

    await call('list_tasks', { search: 'login' });
    expect(mockQuery.mock.calls[0][0]).toContain('t.title LIKE');
    expect(mockQuery.mock.calls[0][0]).toContain('t.description LIKE');
  });

  it('applies assignedToMe filter using user lookup', async () => {
    mockQuery
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([]);
    mockQueryOne.mockResolvedValueOnce({ name: 'Alice Staff', email: 'alice@test.com' });

    await call('list_tasks', { assignedToMe: 'true' });
    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toContain('LOWER(t.assigned_to_name) LIKE');
  });

  it('caps limit at 50', async () => {
    mockQuery
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([]);

    await call('list_tasks', { limit: 999 });
    // The LIMIT param should be 50 (max)
    const selectCall = mockQuery.mock.calls[1];
    const lastParam = selectCall[1][selectCall[1].length - 1];
    expect(lastParam).toBe(50);
  });
});

describe('get_task', () => {
  it('returns task detail', async () => {
    const task = makeLocalTask();
    mockQueryOne.mockResolvedValueOnce(task);

    const result = await call('get_task', { taskId: '42' });
    expect(result.success).toBe(true);
    expect(result.message).toContain('Fix login bug');
    expect(result.message).toContain('bug-fix');
    expect(result.message).toContain('high');
    expect(result.message).toContain('Bookmarked');
  });

  it('fails when task not found', async () => {
    mockQueryOne.mockResolvedValue(null);

    const result = await call('get_task', { taskId: '999' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('fails when taskId is empty', async () => {
    const result = await call('get_task', { taskId: '' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('required');
  });

  it('resolves by external_id fallback', async () => {
    // First queryOne (by id) returns null, second (by external_id) finds it
    mockQueryOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeLocalTask({ external_id: '157' }));

    const result = await call('get_task', { taskId: '157' });
    expect(result.success).toBe(true);
    expect(result.message).toContain('Fix login bug');
  });
});

describe('create_task', () => {
  it('creates a task via proxy and triggers sync', async () => {
    const source = makeSource();
    mockQueryOne.mockResolvedValueOnce(source);   // resolveTaskSourceForTools
    mockQueryOne.mockResolvedValueOnce({ name: 'Admin User', email: 'admin@test.com' }); // user lookup
    mockFetch.mockReturnValueOnce(jsonResponse({ id: 201, title: 'New task' }));
    mockSyncAllSources.mockResolvedValueOnce([]);

    const result = await call('create_task', {
      title: 'New task',
      type: 'feature',
      description: 'A new feature',
      software_id: 5,
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('created successfully');
    expect(result.message).toContain('New task');

    // Verify proxy was called with X-API-Key
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/tasks-api');
    expect(opts.headers['X-API-Key']).toBe('test-api-key-123');
    expect(opts.method).toBe('POST');
  });

  it('fails when no task source configured', async () => {
    mockQueryOne.mockResolvedValue(null); // No source found

    const result = await call('create_task', { title: 'Task X' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('No task source');
  });

  it('fails when title is empty', async () => {
    mockQueryOne.mockResolvedValueOnce(makeSource());

    const result = await call('create_task', { title: '' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('title is required');
  });

  it('handles external API error gracefully', async () => {
    mockQueryOne.mockResolvedValueOnce(makeSource());
    mockQueryOne.mockResolvedValueOnce({ name: 'Admin', email: 'a@b.com' });
    mockFetch.mockReturnValueOnce(jsonResponse({ error: 'Server error' }, 500));

    const result = await call('create_task', { title: 'Will fail' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Failed to create task');
  });
});

describe('update_task', () => {
  it('updates local DB and proxies to external', async () => {
    const task = makeLocalTask();
    mockQueryOne
      .mockResolvedValueOnce(task)               // resolveLocalTask (by id)
      .mockResolvedValueOnce(makeSource());       // resolveTaskSourceForTools

    mockFetch.mockReturnValueOnce(jsonResponse({ success: true }));

    const result = await call('update_task', {
      taskId: '42',
      status: 'completed',
      title: 'Updated title',
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('updated');
    expect(result.message).toContain('Status → completed');
    expect(result.message).toContain('Title → Updated title');

    // Verify local DB was updated
    expect(mockExecute).toHaveBeenCalled();
    const sql = mockExecute.mock.calls[0][0] as string;
    expect(sql).toContain('UPDATE local_tasks SET');
    expect(sql).toContain('local_dirty = 1');
  });

  it('fails when no changes provided', async () => {
    mockQueryOne.mockResolvedValueOnce(makeLocalTask());

    const result = await call('update_task', { taskId: '42' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('No changes specified');
  });

  it('reports partial success when external proxy fails', async () => {
    mockQueryOne
      .mockResolvedValueOnce(makeLocalTask())
      .mockResolvedValueOnce(makeSource());
    mockFetch.mockReturnValueOnce(jsonResponse({ error: 'Timeout' }, 502));

    const result = await call('update_task', {
      taskId: '42',
      status: 'in-progress',
    });

    expect(result.success).toBe(true); // Local changes still persisted
    expect(result.message).toContain('external sync failed');
    expect(result.message).toContain('will sync on next');
  });

  it('sends assignment notification when assigned_to changes', async () => {
    const task = makeLocalTask();
    mockQueryOne
      .mockResolvedValueOnce(task)
      .mockResolvedValueOnce(makeSource())
      .mockResolvedValueOnce({ name: 'Admin' }); // user name for notification
    mockFetch.mockReturnValueOnce(jsonResponse({ success: true }));
    mockCreateNotification.mockResolvedValueOnce(undefined);

    await call('update_task', { taskId: '42', assigned_to: '10' });

    // Wait a tick for fire-and-forget notification
    await new Promise(r => setTimeout(r, 50));
    expect(mockCreateNotification).toHaveBeenCalledOnce();
    expect(mockCreateNotification.mock.calls[0][0]).toBe('10');
  });
});

describe('delete_task', () => {
  it('soft-deletes the task', async () => {
    mockQueryOne.mockResolvedValueOnce(makeLocalTask());

    const result = await call('delete_task', { taskId: '42' });
    expect(result.success).toBe(true);
    expect(result.message).toContain('deleted');
    expect(result.message).toContain('Fix login bug');

    expect(mockExecute).toHaveBeenCalledOnce();
    const sql = mockExecute.mock.calls[0][0] as string;
    expect(sql).toContain('task_deleted = 1');
    expect(sql).toContain('local_dirty = 1');
  });

  it('fails when task not found', async () => {
    mockQueryOne.mockResolvedValue(null);

    const result = await call('delete_task', { taskId: '999' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });
});

// ============================================================================
// SECTION 3: Comments
// ============================================================================

describe('get_task_comments', () => {
  it('proxies to external API and returns formatted comments', async () => {
    const task = makeLocalTask();
    mockQueryOne
      .mockResolvedValueOnce(task)                // resolveLocalTask
      .mockResolvedValueOnce(makeSource());        // resolveTaskSourceForTools

    mockFetch.mockReturnValueOnce(jsonResponse({
      data: [
        { author_name: 'Alice', content: 'Looks good', created_at: '2026-03-10 09:00:00' },
        { author_name: 'Bob', content: 'Agreed', created_at: '2026-03-10 10:00:00', is_internal: 1 },
      ],
    }));

    const result = await call('get_task_comments', { taskId: '42' });
    expect(result.success).toBe(true);
    expect(result.message).toContain('Alice');
    expect(result.message).toContain('Bob');
    expect(result.message).toContain('2 comment(s)');
    expect(result.message).toContain('🔒'); // internal flag
  });

  it('returns "no comments" when empty', async () => {
    mockQueryOne
      .mockResolvedValueOnce(makeLocalTask())
      .mockResolvedValueOnce(makeSource());
    mockFetch.mockReturnValueOnce(jsonResponse({ data: [] }));

    const result = await call('get_task_comments', { taskId: '42' });
    expect(result.success).toBe(true);
    expect(result.message).toContain('No comments');
  });
});

describe('add_task_comment', () => {
  it('adds a comment via proxy', async () => {
    mockQueryOne
      .mockResolvedValueOnce(makeLocalTask())
      .mockResolvedValueOnce(makeSource());
    mockFetch.mockReturnValueOnce(jsonResponse({ comment_id: 99 }));

    const result = await call('add_task_comment', {
      taskId: '42',
      content: 'Great progress!',
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('Comment added');
    expect(result.message).toContain('💬');

    // Verify the POST body
    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(fetchBody.content).toBe('Great progress!');
  });

  it('fails when content is empty', async () => {
    const result = await call('add_task_comment', { taskId: '42', content: '' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('content is required');
  });

  it('fails when no source configured', async () => {
    mockQueryOne
      .mockResolvedValueOnce(makeLocalTask())
      .mockResolvedValueOnce(null);                // no source

    const result = await call('add_task_comment', { taskId: '42', content: 'Test' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('No task source');
  });
});

// ============================================================================
// SECTION 4: Local Enhancements
// ============================================================================

describe('bookmark_task', () => {
  it('toggles bookmark ON when currently OFF', async () => {
    mockQueryOne.mockResolvedValueOnce(makeLocalTask({ is_bookmarked: 0 }));

    const result = await call('bookmark_task', { taskId: '42' });
    expect(result.success).toBe(true);
    expect(result.message).toContain('⭐');
    expect(result.message).toContain('bookmarked');

    // Verify UPDATE with is_bookmarked = 1
    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain('is_bookmarked');
    expect(params).toContain(1); // toggled to ON
  });

  it('toggles bookmark OFF when currently ON', async () => {
    mockQueryOne.mockResolvedValueOnce(makeLocalTask({ is_bookmarked: 1 }));

    const result = await call('bookmark_task', { taskId: '42' });
    expect(result.success).toBe(true);
    expect(result.message).toContain('unbookmarked');

    const [, params] = mockExecute.mock.calls[0];
    expect(params).toContain(0); // toggled to OFF
  });
});

describe('set_task_priority', () => {
  it('sets valid priority', async () => {
    mockQueryOne.mockResolvedValueOnce(makeLocalTask());

    const result = await call('set_task_priority', { taskId: '42', priority: 'urgent' });
    expect(result.success).toBe(true);
    expect(result.message).toContain('🔴');
    expect(result.message).toContain('urgent');
  });

  it('rejects invalid priority', async () => {
    const result = await call('set_task_priority', { taskId: '42', priority: 'super-duper' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Invalid priority');
  });

  it('maps emoji for each priority level', async () => {
    const expectedEmojis: Record<string, string> = {
      urgent: '🔴', high: '🟠', normal: '🟢', low: '⚪',
    };

    for (const [level, emoji] of Object.entries(expectedEmojis)) {
      vi.clearAllMocks();
      mockQueryOne.mockResolvedValueOnce(makeLocalTask());
      mockExecute.mockResolvedValueOnce(1);

      const result = await call('set_task_priority', { taskId: '42', priority: level });
      expect(result.message).toContain(emoji);
    }
  });
});

describe('set_task_color', () => {
  it('sets a color label', async () => {
    mockQueryOne.mockResolvedValueOnce(makeLocalTask());

    const result = await call('set_task_color', { taskId: '42', color_label: 'blue' });
    expect(result.success).toBe(true);
    expect(result.message).toContain('🎨');
    expect(result.message).toContain('blue');
  });

  it('clears color label when empty string', async () => {
    mockQueryOne.mockResolvedValueOnce(makeLocalTask());

    const result = await call('set_task_color', { taskId: '42', color_label: '' });
    expect(result.success).toBe(true);
    expect(result.message).toContain('cleared');
  });
});

describe('set_task_tags', () => {
  it('sets tags from comma-separated string', async () => {
    mockQueryOne.mockResolvedValueOnce(makeLocalTask());

    const result = await call('set_task_tags', { taskId: '42', tags: 'frontend, backend, urgent' });
    expect(result.success).toBe(true);
    expect(result.message).toContain('🏷️');
    expect(result.message).toContain('frontend');
    expect(result.message).toContain('backend');
    expect(result.message).toContain('urgent');

    // Verify JSON array stored
    const [, params] = mockExecute.mock.calls[0];
    const storedJson = params[0];
    expect(JSON.parse(storedJson)).toEqual(['frontend', 'backend', 'urgent']);
  });

  it('clears tags when empty string', async () => {
    mockQueryOne.mockResolvedValueOnce(makeLocalTask());

    const result = await call('set_task_tags', { taskId: '42', tags: '' });
    expect(result.success).toBe(true);
    expect(result.message).toContain('cleared');
  });
});

// ============================================================================
// SECTION 5: Workflow Actions
// ============================================================================

describe('start_task', () => {
  it('proxies start command and updates local status', async () => {
    const task = makeLocalTask();
    mockQueryOne
      .mockResolvedValueOnce(task)
      .mockResolvedValueOnce(makeSource());
    mockFetch.mockReturnValueOnce(jsonResponse({ success: true }));

    const result = await call('start_task', { taskId: '42' });
    expect(result.success).toBe(true);
    expect(result.message).toContain('▶️');
    expect(result.message).toContain('started');

    // Verify local status updated to 'progress'
    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain('UPDATE local_tasks SET status');
    expect(params).toContain('progress');
  });

  it('fails when external API errors', async () => {
    mockQueryOne
      .mockResolvedValueOnce(makeLocalTask())
      .mockResolvedValueOnce(makeSource());
    mockFetch.mockReturnValueOnce(jsonResponse({ error: 'Task already started' }, 400));

    const result = await call('start_task', { taskId: '42' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Failed to start');
  });
});

describe('complete_task', () => {
  it('proxies complete command and updates local status', async () => {
    mockQueryOne
      .mockResolvedValueOnce(makeLocalTask())
      .mockResolvedValueOnce(makeSource());
    mockFetch.mockReturnValueOnce(jsonResponse({ success: true }));

    const result = await call('complete_task', { taskId: '42' });
    expect(result.success).toBe(true);
    expect(result.message).toContain('✅');
    expect(result.message).toContain('completed');

    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain('UPDATE local_tasks SET status');
    expect(params).toContain('completed');
  });
});

describe('approve_task', () => {
  it('proxies approve command', async () => {
    mockQueryOne
      .mockResolvedValueOnce(makeLocalTask())
      .mockResolvedValueOnce(makeSource());
    mockFetch.mockReturnValueOnce(jsonResponse({ success: true }));

    const result = await call('approve_task', { taskId: '42' });
    expect(result.success).toBe(true);
    expect(result.message).toContain('👍');
    expect(result.message).toContain('approved');

    // Verify the proxy URL includes /approve
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/approve');
  });
});

// ============================================================================
// SECTION 6: Stats & Queries
// ============================================================================

describe('get_task_stats', () => {
  it('returns aggregated stats', async () => {
    mockQuery
      .mockResolvedValueOnce([{ status: 'progress', count: 10 }, { status: 'completed', count: 25 }])  // by status
      .mockResolvedValueOnce([{ type: 'bug-fix', count: 15 }, { type: 'feature', count: 20 }])          // by type
      .mockResolvedValueOnce([{ workflow_phase: 'testing', count: 5 }])                                  // by phase
      .mockResolvedValueOnce([{ total: 35 }])                                                           // total
      .mockResolvedValueOnce([{ count: 8 }]);                                                           // bookmarked

    const result = await call('get_task_stats');
    expect(result.success).toBe(true);
    expect(result.message).toContain('📊');
    expect(result.message).toContain('35 total');
    expect(result.message).toContain('8 bookmarked');
    expect(result.message).toContain('in-progress');  // normalized display
    expect(result.message).toContain('bug-fix');
    expect(result.message).toContain('testing');
  });
});

describe('get_pending_approvals', () => {
  it('returns pending tasks from external API', async () => {
    mockQueryOne.mockResolvedValueOnce(makeSource());
    mockFetch.mockReturnValueOnce(jsonResponse({
      data: [
        { title: 'Review PR', assigned_to_name: 'Alice', id: 101 },
        { title: 'Sign off deployment', assigned_to_name: 'Bob', id: 102 },
      ],
    }));

    const result = await call('get_pending_approvals');
    expect(result.success).toBe(true);
    expect(result.message).toContain('🔍');
    expect(result.message).toContain('Review PR');
    expect(result.message).toContain('Sign off deployment');
    expect(result.message).toContain('2 task(s)');
  });

  it('returns all-clear when none pending', async () => {
    mockQueryOne.mockResolvedValueOnce(makeSource());
    mockFetch.mockReturnValueOnce(jsonResponse({ data: [] }));

    const result = await call('get_pending_approvals');
    expect(result.success).toBe(true);
    expect(result.message).toContain('All clear');
  });
});

describe('get_task_tags', () => {
  it('returns distinct tags from local DB', async () => {
    mockQuery.mockResolvedValueOnce([
      { tag: 'backend' }, { tag: 'frontend' }, { tag: 'sprint-3' },
    ]);

    const result = await call('get_task_tags');
    expect(result.success).toBe(true);
    expect(result.message).toContain('🏷️');
    expect(result.message).toContain('backend');
    expect(result.message).toContain('frontend');
    expect(result.message).toContain('sprint-3');
    expect(result.message).toContain('3 tag(s)');
  });

  it('returns hint when no tags exist', async () => {
    mockQuery.mockResolvedValueOnce([]);

    const result = await call('get_task_tags');
    expect(result.success).toBe(true);
    expect(result.message).toContain('No tags found');
    expect(result.message).toContain('set_task_tags');
  });
});

// ============================================================================
// SECTION 7: Sync
// ============================================================================

describe('sync_tasks', () => {
  it('triggers sync and reports results', async () => {
    mockSyncAllSources.mockResolvedValueOnce([
      {
        source_name: 'Softaware Tasks',
        status: 'success',
        tasks_created: 3,
        tasks_updated: 5,
        tasks_unchanged: 142,
      },
    ]);

    const result = await call('sync_tasks');
    expect(result.success).toBe(true);
    expect(result.message).toContain('🔄');
    expect(result.message).toContain('Sync complete');
    expect(result.message).toContain('3 new');
    expect(result.message).toContain('5 updated');
    expect(result.message).toContain('Softaware Tasks');
  });

  it('reports error from sync engine', async () => {
    mockSyncAllSources.mockRejectedValueOnce(new Error('Connection refused'));

    const result = await call('sync_tasks');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Sync failed');
    expect(result.message).toContain('Connection refused');
  });

  it('handles zero sources', async () => {
    mockSyncAllSources.mockResolvedValueOnce([]);

    const result = await call('sync_tasks');
    expect(result.success).toBe(true);
    expect(result.message).toContain('No task sources configured');
  });
});

describe('get_sync_status', () => {
  it('returns source sync metadata', async () => {
    mockQuery.mockResolvedValueOnce([
      {
        id: 1, name: 'Softaware Tasks', source_type: 'tasks-api',
        sync_enabled: 1, sync_interval_min: 30,
        last_synced_at: '2026-03-10 08:00:00', last_sync_status: 'success',
        last_sync_message: null, last_sync_count: 150,
      },
    ]);

    const result = await call('get_sync_status');
    expect(result.success).toBe(true);
    expect(result.message).toContain('📡');
    expect(result.message).toContain('Softaware Tasks');
    expect(result.message).toContain('🟢'); // enabled
    expect(result.message).toContain('150 tasks');
  });

  it('returns "none configured" when empty', async () => {
    mockQuery.mockResolvedValueOnce([]);

    const result = await call('get_sync_status');
    expect(result.success).toBe(true);
    expect(result.message).toContain('No task sources configured');
  });
});

// ============================================================================
// SECTION 8: Invoice Staging
// ============================================================================

describe('stage_tasks_for_invoice', () => {
  it('stages tasks by external IDs', async () => {
    mockExecute.mockResolvedValueOnce(3); // 3 rows affected

    const result = await call('stage_tasks_for_invoice', {
      task_ids: '157,158,159',
      bill_date: '2026-03-10',
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('📋');
    expect(result.message).toContain('3 task(s) staged');
    expect(result.message).toContain('2026-03-10');

    // Verify SQL sets task_billed = 2
    const sql = mockExecute.mock.calls[0][0] as string;
    expect(sql).toContain('task_billed = 2');
  });

  it('fails when no IDs provided', async () => {
    const result = await call('stage_tasks_for_invoice', { task_ids: '' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('required');
  });
});

describe('get_staged_invoices', () => {
  it('returns staged tasks with total hours', async () => {
    mockQuery.mockResolvedValueOnce([
      { id: 42, external_id: '157', title: 'Task A', hours: '2.5', task_bill_date: '2026-03-10' },
      { id: 43, external_id: '158', title: 'Task B', hours: '4.0', task_bill_date: '2026-03-10' },
    ]);

    const result = await call('get_staged_invoices');
    expect(result.success).toBe(true);
    expect(result.message).toContain('📋');
    expect(result.message).toContain('2 task(s)');
    expect(result.message).toContain('6.5h total');
    expect(result.message).toContain('Task A');
    expect(result.message).toContain('Task B');
  });

  it('returns "nothing staged" when empty', async () => {
    mockQuery.mockResolvedValueOnce([]);

    const result = await call('get_staged_invoices');
    expect(result.success).toBe(true);
    expect(result.message).toContain('No tasks currently staged');
  });
});

describe('process_staged_invoices', () => {
  it('processes staged tasks via external API', async () => {
    mockQueryOne.mockResolvedValueOnce(makeSource());
    mockQuery.mockResolvedValueOnce([
      { id: 42, external_id: '157', task_bill_date: '2026-03-10' },
      { id: 43, external_id: '158', task_bill_date: '2026-03-10' },
    ]);
    mockFetch.mockReturnValueOnce(jsonResponse({ success: true }));

    const result = await call('process_staged_invoices');
    expect(result.success).toBe(true);
    expect(result.message).toContain('💰');
    expect(result.message).toContain('2 task(s) invoiced');

    // Verify external API was called with invoice-tasks endpoint
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/invoice-tasks');

    // Verify tasks marked as billed (task_billed = 1)
    const updateSql = mockExecute.mock.calls[0][0] as string;
    expect(updateSql).toContain('task_billed = 1');
  });

  it('returns hint when nothing is staged', async () => {
    mockQueryOne.mockResolvedValueOnce(makeSource());
    mockQuery.mockResolvedValueOnce([]); // no staged tasks

    const result = await call('process_staged_invoices');
    expect(result.success).toBe(true);
    expect(result.message).toContain('No staged tasks');
    expect(result.message).toContain('stage_tasks_for_invoice');
  });

  it('fails when external billing API errors', async () => {
    mockQueryOne.mockResolvedValueOnce(makeSource());
    mockQuery.mockResolvedValueOnce([
      { id: 42, external_id: '157', task_bill_date: '2026-03-10' },
    ]);
    mockFetch.mockReturnValueOnce(jsonResponse({ error: 'Payment failed' }, 500));

    const result = await call('process_staged_invoices');
    expect(result.success).toBe(false);
    expect(result.message).toContain('External invoicing failed');
  });
});

// ============================================================================
// SECTION 9: Unknown tool
// ============================================================================

describe('unknown tool', () => {
  it('returns failure for unrecognized tool name', async () => {
    const result = await call('nonexistent_tool', {});
    expect(result.success).toBe(false);
    expect(result.message).toContain('Unknown tool');
  });
});
