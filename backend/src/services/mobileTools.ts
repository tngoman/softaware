/**
 * Mobile AI Assistant — Tool Definitions
 *
 * Defines the function-calling tools available to the mobile AI assistant,
 * separated by role:
 *   - Client tools: self-service actions on their own resources
 *   - Staff tools:  administrative actions across all clients + task management
 *
 * Each tool follows the OpenAI-compatible function calling format so Ollama
 * can emit structured JSON tool_call payloads.
 *
 * IMPORTANT: Tools are injected dynamically by the backend based on JWT role.
 * Staff members CANNOT see or edit these definitions from the GUI.
 */

import { type ToolDefinition } from './actionRouter.js';

// ============================================================================
// Client Tools — Self-service (scoped to the authenticated user)
// ============================================================================

// ── Existing Assistant Management Tools ───────────────────────────

const TOGGLE_ASSISTANT_STATUS: ToolDefinition = {
  type: 'function',
  function: {
    name: 'toggle_assistant_status',
    description:
      'Enable or disable one of the user\'s AI assistants. Use when the client says "turn off my bot", "pause my assistant", "activate my chatbot", etc.',
    parameters: {
      type: 'object',
      properties: {
        assistantId: {
          type: 'string',
          description: 'The ID of the assistant to toggle (e.g. "assistant-1709000000000"). Ask the user which one if they have multiple.',
        },
        status: {
          type: 'string',
          description: 'The new status for the assistant.',
          enum: ['active', 'suspended'],
        },
      },
      required: ['assistantId', 'status'],
    },
  },
};

const GET_USAGE_STATS: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_usage_stats',
    description:
      'Retrieve the user\'s current usage statistics: messages sent, pages indexed, assistant count, and plan limits. Use when they ask "how much have I used", "what\'s my plan", "am I near my limit", etc.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

const RETRY_FAILED_INGESTION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'retry_failed_ingestion',
    description:
      'Retry a failed website crawl / ingestion job. Use when the client says "my page failed to index", "retry the crawl", "re-process that URL", etc.',
    parameters: {
      type: 'object',
      properties: {
        jobId: {
          type: 'string',
          description: 'The ingestion job ID to retry. If the user doesn\'t know it, use get_usage_stats first to find failed jobs.',
        },
      },
      required: ['jobId'],
    },
  },
};

const LIST_MY_ASSISTANTS: ToolDefinition = {
  type: 'function',
  function: {
    name: 'list_my_assistants',
    description:
      'List all of the user\'s AI assistants with their names, statuses, and IDs. Use when they say "show my bots", "which assistants do I have", or before toggle_assistant_status if you need the ID.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

const LIST_FAILED_JOBS: ToolDefinition = {
  type: 'function',
  function: {
    name: 'list_failed_jobs',
    description:
      'List all failed ingestion jobs for the user\'s assistants. Use when they ask "what failed", "any crawl errors", or before retry_failed_ingestion if you need the job ID.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

// ── Client Lead Management Tools ──────────────────────────────────

const LIST_LEADS: ToolDefinition = {
  type: 'function',
  function: {
    name: 'list_leads',
    description:
      'List contact form submissions (leads) from the user\'s generated website. Use when client says "show my leads", "any new messages", "who contacted me", "form submissions", etc.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filter by lead status. Leave empty for all leads.',
          enum: ['new', 'contacted', 'converted', 'spam'],
        },
        limit: {
          type: 'string',
          description: 'Max leads to return (default "20").',
        },
      },
      required: [],
    },
  },
};

const GET_LEAD_DETAILS: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_lead_details',
    description:
      'Get full details of a specific contact form submission, including message text and notes. Use when the user asks about a specific lead by number or ID.',
    parameters: {
      type: 'object',
      properties: {
        leadId: {
          type: 'string',
          description: 'The lead/submission ID.',
        },
      },
      required: ['leadId'],
    },
  },
};

const UPDATE_LEAD_STATUS: ToolDefinition = {
  type: 'function',
  function: {
    name: 'update_lead_status',
    description:
      'Update the status of a lead (e.g. mark as contacted, converted, or spam). Optionally add notes. Use when client says "mark that lead as contacted", "flag as spam", etc.',
    parameters: {
      type: 'object',
      properties: {
        leadId: {
          type: 'string',
          description: 'The lead/submission ID to update.',
        },
        status: {
          type: 'string',
          description: 'The new status for the lead.',
          enum: ['new', 'contacted', 'converted', 'spam'],
        },
        notes: {
          type: 'string',
          description: 'Optional notes to add to the lead (e.g. follow-up notes, context).',
        },
      },
      required: ['leadId', 'status'],
    },
  },
};

const GET_LEAD_STATS: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_lead_stats',
    description:
      'Get aggregate statistics about leads/submissions: total count, new leads, conversion rate, recent activity. Use when client asks "how many leads do I have", "lead stats", "conversion numbers".',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

// ── Client Email Follow-up Tools ──────────────────────────────────

const SEND_FOLLOWUP_EMAIL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'send_followup_email',
    description:
      'Send a follow-up email to a lead who submitted the contact form. The assistant composes the email based on the conversation with the user. Use when client says "email that lead", "follow up with them", "send them a reply", etc.',
    parameters: {
      type: 'object',
      properties: {
        leadId: {
          type: 'string',
          description: 'The lead/submission ID to follow up with.',
        },
        subject: {
          type: 'string',
          description: 'The email subject line.',
        },
        body: {
          type: 'string',
          description: 'The email body text (plain text, will be wrapped in HTML template).',
        },
      },
      required: ['leadId', 'subject', 'body'],
    },
  },
};

const SEND_INFO_EMAIL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'send_info_email',
    description:
      'Send an informational email to any email address on behalf of the user. Use for sending quotes, info packs, or general correspondence when the client asks. Requires explicit approval before sending.',
    parameters: {
      type: 'object',
      properties: {
        toEmail: {
          type: 'string',
          description: 'The recipient email address.',
        },
        subject: {
          type: 'string',
          description: 'The email subject line.',
        },
        body: {
          type: 'string',
          description: 'The email body text (plain text, will be wrapped in HTML template).',
        },
      },
      required: ['toEmail', 'subject', 'body'],
    },
  },
};

// ── Client SiteBuilder Tools ──────────────────────────────────────

const LIST_MY_SITES: ToolDefinition = {
  type: 'function',
  function: {
    name: 'list_my_sites',
    description:
      'List all generated websites belonging to the user. Shows business name, status, and deployment info. Use when client says "show my websites", "my sites", "landing pages", etc.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

const GET_SITE_DETAILS: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_site_details',
    description:
      'Get full details of a generated website including business info, contact details, services, and deployment status. Use when client asks about a specific site.',
    parameters: {
      type: 'object',
      properties: {
        siteId: {
          type: 'string',
          description: 'The site ID.',
        },
      },
      required: ['siteId'],
    },
  },
};

const UPDATE_SITE_FIELD: ToolDefinition = {
  type: 'function',
  function: {
    name: 'update_site_field',
    description:
      'Update a specific field on a generated website (e.g. phone number, email, about text, tagline, services, theme color). Use when client says "change my phone number to...", "update my about us section", "change my tagline", etc. After updating, remind the user they need to regenerate & redeploy for changes to go live.',
    parameters: {
      type: 'object',
      properties: {
        siteId: {
          type: 'string',
          description: 'The site ID to update.',
        },
        field: {
          type: 'string',
          description: 'The field to update.',
          enum: ['business_name', 'tagline', 'about_us', 'services', 'contact_email', 'contact_phone', 'theme_color'],
        },
        value: {
          type: 'string',
          description: 'The new value for the field.',
        },
      },
      required: ['siteId', 'field', 'value'],
    },
  },
};

const REGENERATE_SITE: ToolDefinition = {
  type: 'function',
  function: {
    name: 'regenerate_site',
    description:
      'Regenerate the HTML/CSS for a site after field changes. This rebuilds the static files but does NOT deploy them. Use when client says "rebuild my site", "regenerate", or after field updates.',
    parameters: {
      type: 'object',
      properties: {
        siteId: {
          type: 'string',
          description: 'The site ID to regenerate.',
        },
      },
      required: ['siteId'],
    },
  },
};

const DEPLOY_SITE: ToolDefinition = {
  type: 'function',
  function: {
    name: 'deploy_site',
    description:
      'Deploy a generated site to the configured FTP server, making changes live. Use when client says "deploy my site", "push it live", "publish my changes", etc. The site must be regenerated first.',
    parameters: {
      type: 'object',
      properties: {
        siteId: {
          type: 'string',
          description: 'The site ID to deploy.',
        },
      },
      required: ['siteId'],
    },
  },
};

const GET_SITE_DEPLOYMENTS: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_site_deployments',
    description:
      'Get the deployment history for a site (recent deploys, statuses, errors). Use when client asks "when was my site last deployed", "deployment history", "any deploy errors".',
    parameters: {
      type: 'object',
      properties: {
        siteId: {
          type: 'string',
          description: 'The site ID.',
        },
      },
      required: ['siteId'],
    },
  },
};

// ============================================================================
// Staff Tools — Administrative (global scope) + Task Management (v2.0)
//
// Tasks v2.0 — Dual-path architecture:
//   READ:  Direct from local MySQL `local_tasks` table (synced from external sources)
//   WRITE: Proxy to external APIs via `task_sources` table (source-level API key auth)
//   LOCAL: Bookmark, priority, tags, color labels managed locally (no external call)
// ============================================================================

// ── Task Core CRUD ──────────────────────────────────────────────

const LIST_TASKS: ToolDefinition = {
  type: 'function',
  function: {
    name: 'list_tasks',
    description:
      'List tasks from the local database (synced from external sources). Shows task titles, statuses, assignees, priorities, and workflow phases. Supports filtering by status, type, priority, bookmarks, tags, search text, and date range. Use when staff says "show my tasks", "what tasks are pending", "list development tasks", "high priority tasks", "bookmarked tasks", etc.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filter tasks by status. Leave empty for all tasks.',
          enum: ['new', 'progress', 'completed', 'pending'],
        },
        type: {
          type: 'string',
          description: 'Filter by task type.',
          enum: ['development', 'bug-fix', 'feature', 'maintenance', 'support'],
        },
        priority: {
          type: 'string',
          description: 'Filter by priority level.',
          enum: ['urgent', 'high', 'normal', 'low'],
        },
        workflow_phase: {
          type: 'string',
          description: 'Filter by workflow phase.',
          enum: ['intake', 'triage', 'development', 'quality_review', 'verification', 'resolution'],
        },
        bookmarked: {
          type: 'string',
          description: 'Set to "1" to show only bookmarked tasks.',
          enum: ['0', '1'],
        },
        tag: {
          type: 'string',
          description: 'Filter by a specific tag.',
        },
        search: {
          type: 'string',
          description: 'Search in task titles, descriptions, and external IDs.',
        },
        assignedToMe: {
          type: 'string',
          description: 'Set to "true" to show only tasks assigned to the current user.',
          enum: ['true', 'false'],
        },
        limit: {
          type: 'string',
          description: 'Maximum number of tasks to return (default "20", max "50").',
        },
      },
      required: [],
    },
  },
};

const GET_TASK: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_task',
    description:
      'Get full details of a single task including description, notes, hours, dates, priority, tags, and workflow phase. Use when staff asks about a specific task, e.g. "show me task 42", "details on that bug fix", etc.',
    parameters: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The task ID (local DB ID or external ID number).',
        },
      },
      required: ['taskId'],
    },
  },
};

const CREATE_TASK: ToolDefinition = {
  type: 'function',
  function: {
    name: 'create_task',
    description:
      'Create a new task on the external software portal. The task will sync back to the local database automatically. Use when staff says "create a task", "add a new ticket", "log a bug", "I need a feature request", etc.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'The task title/name.',
        },
        description: {
          type: 'string',
          description: 'Detailed description of the task.',
        },
        type: {
          type: 'string',
          description: 'The type of task.',
          enum: ['development', 'bug-fix', 'feature', 'maintenance', 'support'],
        },
        status: {
          type: 'string',
          description: 'Initial status for the task.',
          enum: ['new', 'progress', 'pending'],
        },
        workflow_phase: {
          type: 'string',
          description: 'Workflow phase for the task.',
          enum: ['intake', 'triage', 'development', 'quality_review', 'verification', 'resolution'],
        },
        assigned_to: {
          type: 'string',
          description: 'User ID to assign the task to. Leave empty to leave unassigned.',
        },
        estimated_hours: {
          type: 'string',
          description: 'Estimated hours (e.g. "2.5").',
        },
        software_id: {
          type: 'string',
          description: 'The software source ID to create the task on. If omitted, uses the first available source.',
        },
      },
      required: ['title', 'type'],
    },
  },
};

const UPDATE_TASK: ToolDefinition = {
  type: 'function',
  function: {
    name: 'update_task',
    description:
      'Update an existing task — change status, reassign, update description, log hours, move to a different workflow phase, or set priority/color. Also syncs changes to the external source. Use when staff says "mark task done", "move task to review", "assign task to X", "update task 42", etc.',
    parameters: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The task ID (local DB ID or external ID) to update.',
        },
        status: {
          type: 'string',
          description: 'New status.',
          enum: ['new', 'progress', 'completed', 'pending'],
        },
        workflow_phase: {
          type: 'string',
          description: 'New workflow phase.',
          enum: ['intake', 'triage', 'development', 'quality_review', 'verification', 'resolution'],
        },
        assigned_to: {
          type: 'string',
          description: 'New assignee user ID.',
        },
        hours: {
          type: 'string',
          description: 'Hours worked to log (e.g. "1.5").',
        },
        description: {
          type: 'string',
          description: 'Updated description.',
        },
        title: {
          type: 'string',
          description: 'Updated task title.',
        },
        priority: {
          type: 'string',
          description: 'Set task priority.',
          enum: ['urgent', 'high', 'normal', 'low'],
        },
      },
      required: ['taskId'],
    },
  },
};

const DELETE_TASK: ToolDefinition = {
  type: 'function',
  function: {
    name: 'delete_task',
    description:
      'Soft-delete a task (marks as deleted locally, syncs deletion on next sync). Use when staff says "delete task 42", "remove that ticket", etc.',
    parameters: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The task ID to delete.',
        },
      },
      required: ['taskId'],
    },
  },
};

// ── Task Comments ───────────────────────────────────────────────

const GET_TASK_COMMENTS: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_task_comments',
    description:
      'Get all comments on a task from the external source. Use when staff asks "show comments on task 42", "what notes are on that ticket", etc.',
    parameters: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The external task ID to get comments for.',
        },
      },
      required: ['taskId'],
    },
  },
};

const ADD_TASK_COMMENT: ToolDefinition = {
  type: 'function',
  function: {
    name: 'add_task_comment',
    description:
      'Add a comment to a task on the external source. Use when staff says "comment on task 42", "add a note to that ticket", "leave a comment", etc.',
    parameters: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The external task ID to comment on.',
        },
        content: {
          type: 'string',
          description: 'The comment text.',
        },
        is_internal: {
          type: 'string',
          description: 'Whether this is an internal note (not visible to client). Default "true".',
          enum: ['true', 'false'],
        },
      },
      required: ['taskId', 'content'],
    },
  },
};

// ── Task Local Enhancements ─────────────────────────────────────

const BOOKMARK_TASK: ToolDefinition = {
  type: 'function',
  function: {
    name: 'bookmark_task',
    description:
      'Toggle the bookmark status of a task. Bookmarks are local-only (not synced to external). Use when staff says "bookmark task 42", "save that task", "unbookmark it", "star that ticket", etc.',
    parameters: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The task ID to bookmark/unbookmark.',
        },
      },
      required: ['taskId'],
    },
  },
};

const SET_TASK_PRIORITY: ToolDefinition = {
  type: 'function',
  function: {
    name: 'set_task_priority',
    description:
      'Set the priority level of a task. Priority is a local enhancement. Use when staff says "set task 42 to urgent", "make that high priority", "lower the priority", etc.',
    parameters: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The task ID to update priority for.',
        },
        priority: {
          type: 'string',
          description: 'The priority level.',
          enum: ['urgent', 'high', 'normal', 'low'],
        },
      },
      required: ['taskId', 'priority'],
    },
  },
};

const SET_TASK_COLOR: ToolDefinition = {
  type: 'function',
  function: {
    name: 'set_task_color',
    description:
      'Set or clear the color label on a task. Color labels are local-only visual markers. Use when staff says "label task 42 red", "color that task blue", "remove the color", etc.',
    parameters: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The task ID.',
        },
        color_label: {
          type: 'string',
          description: 'The color label (e.g. "red", "blue", "green", "yellow", "purple", "orange"). Send empty string to clear.',
        },
      },
      required: ['taskId'],
    },
  },
};

const SET_TASK_TAGS: ToolDefinition = {
  type: 'function',
  function: {
    name: 'set_task_tags',
    description:
      'Set tags on a task (replaces all existing tags). Tags are local-only. Use when staff says "tag task 42 as frontend", "add tags urgent and mobile to that task", "clear tags on task 42", etc.',
    parameters: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The task ID.',
        },
        tags: {
          type: 'string',
          description: 'Comma-separated list of tags (e.g. "frontend,urgent,mobile"). Send empty string to clear all tags.',
        },
      },
      required: ['taskId', 'tags'],
    },
  },
};

// ── Task Workflow Actions ───────────────────────────────────────

const START_TASK: ToolDefinition = {
  type: 'function',
  function: {
    name: 'start_task',
    description:
      'Start working on a task (transitions status to in-progress on the external source). Use when staff says "start task 42", "begin working on that", "pick up that task", etc.',
    parameters: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The external task ID to start.',
        },
      },
      required: ['taskId'],
    },
  },
};

const COMPLETE_TASK: ToolDefinition = {
  type: 'function',
  function: {
    name: 'complete_task',
    description:
      'Mark a task as completed on the external source. Use when staff says "complete task 42", "finish that task", "mark it done", etc.',
    parameters: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The external task ID to complete.',
        },
      },
      required: ['taskId'],
    },
  },
};

const APPROVE_TASK: ToolDefinition = {
  type: 'function',
  function: {
    name: 'approve_task',
    description:
      'Approve a completed task. Use when staff says "approve task 42", "sign off on that", etc.',
    parameters: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The external task ID to approve.',
        },
      },
      required: ['taskId'],
    },
  },
};

// ── Task Stats & Queries ────────────────────────────────────────

const GET_TASK_STATS: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_task_stats',
    description:
      'Get task statistics — counts by status, type, and workflow phase. Use when staff asks "how many tasks are open", "task statistics", "project status overview", etc.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

const GET_PENDING_APPROVALS: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_pending_approvals',
    description:
      'Get a list of tasks waiting for approval. Use when staff asks "what needs approval", "pending sign-offs", "tasks awaiting review", etc.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

const GET_TASK_TAGS: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_task_tags',
    description:
      'Get all unique tags used across tasks. Use when staff asks "what tags exist", "show all tags", "list available tags", etc.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

// ── Task Sync ───────────────────────────────────────────────────

const SYNC_TASKS: ToolDefinition = {
  type: 'function',
  function: {
    name: 'sync_tasks',
    description:
      'Trigger a sync of tasks from all external sources into the local database. Use when staff says "sync tasks", "refresh tasks", "pull latest tasks", "update from external", etc.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

const GET_SYNC_STATUS: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_sync_status',
    description:
      'Check the sync status — when each source was last synced, success/failure, and task counts. Use when staff asks "when was last sync", "sync status", "are tasks up to date", etc.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

// ── Invoice Staging ─────────────────────────────────────────────

const STAGE_TASKS_FOR_INVOICE: ToolDefinition = {
  type: 'function',
  function: {
    name: 'stage_tasks_for_invoice',
    description:
      'Stage completed tasks for invoicing. Staged tasks can be reviewed before being processed into a bill. Use when staff says "invoice these tasks", "stage tasks for billing", "prepare invoice for tasks 42, 43, 44", etc.',
    parameters: {
      type: 'object',
      properties: {
        task_ids: {
          type: 'string',
          description: 'Comma-separated external task IDs to stage (e.g. "42,43,44").',
        },
        bill_date: {
          type: 'string',
          description: 'Invoice date (YYYY-MM-DD format). Defaults to today if omitted.',
        },
      },
      required: ['task_ids'],
    },
  },
};

const GET_STAGED_INVOICES: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_staged_invoices',
    description:
      'View all tasks currently staged for invoicing. Use when staff asks "what\'s staged for billing", "show invoice queue", "pending invoices", etc.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

const PROCESS_STAGED_INVOICES: ToolDefinition = {
  type: 'function',
  function: {
    name: 'process_staged_invoices',
    description:
      'Process all staged tasks into actual invoices on the external portal. This finalizes the billing. Use when staff says "process the invoices", "finalize billing", "send invoices", etc.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

const SUSPEND_CLIENT_ACCOUNT: ToolDefinition = {
  type: 'function',
  function: {
    name: 'suspend_client_account',
    description:
      'Suspend or reactivate a client\'s account. Suspended accounts are blocked from all API access. Use when staff says "suspend user X", "block that client", "reactivate account", etc.',
    parameters: {
      type: 'object',
      properties: {
        clientId: {
          type: 'string',
          description: 'The user ID of the client to suspend or reactivate.',
        },
        status: {
          type: 'string',
          description: 'The new account status.',
          enum: ['active', 'suspended', 'demo_expired'],
        },
        reason: {
          type: 'string',
          description: 'The reason for the status change (will be logged).',
        },
      },
      required: ['clientId', 'status', 'reason'],
    },
  },
};

const CHECK_CLIENT_HEALTH: ToolDefinition = {
  type: 'function',
  function: {
    name: 'check_client_health',
    description:
      'Get a health overview for a specific client: their assistants, knowledge health scores, ingestion queue status, and account status. Use when staff asks "how is client X doing", "check their health score", etc.',
    parameters: {
      type: 'object',
      properties: {
        clientId: {
          type: 'string',
          description: 'The user ID of the client to check.',
        },
      },
      required: ['clientId'],
    },
  },
};

const GENERATE_ENTERPRISE_ENDPOINT: ToolDefinition = {
  type: 'function',
  function: {
    name: 'generate_enterprise_endpoint',
    description:
      'Create a new enterprise webhook endpoint for a client. This generates a unique URL they can use for WhatsApp, Slack, or custom REST integrations. Use when staff says "set up a webhook for client X", "create an enterprise endpoint", etc.',
    parameters: {
      type: 'object',
      properties: {
        clientId: {
          type: 'string',
          description: 'The user ID of the client to create the endpoint for.',
        },
        provider: {
          type: 'string',
          description: 'The inbound channel for the endpoint.',
          enum: ['whatsapp', 'slack', 'custom_rest', 'sms', 'email', 'web'],
        },
        systemPrompt: {
          type: 'string',
          description: 'The system prompt for the AI behind this endpoint. If the user doesn\'t specify one, use a sensible default like "You are a helpful customer service assistant."',
        },
      },
      required: ['clientId', 'provider'],
    },
  },
};

const SEARCH_CLIENTS: ToolDefinition = {
  type: 'function',
  function: {
    name: 'search_clients',
    description:
      'Search for a client by name or email. Use before other staff tools if the staff member refers to a client by name and you need their ID.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The name or email (partial match) to search for.',
        },
      },
      required: ['query'],
    },
  },
};

// ── Staff Cases Tools ─────────────────────────────────────────────

const LIST_CASES: ToolDefinition = {
  type: 'function',
  function: {
    name: 'list_cases',
    description:
      'List support/bug cases. Can filter by status, severity, or assigned user. Use when staff says "show open cases", "any critical bugs", "my cases", etc.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filter by case status.',
          enum: ['open', 'in_progress', 'resolved', 'closed', 'reopened'],
        },
        severity: {
          type: 'string',
          description: 'Filter by severity.',
          enum: ['low', 'medium', 'high', 'critical'],
        },
        assignedTo: {
          type: 'string',
          description: 'Filter by assigned user ID.',
        },
        limit: {
          type: 'string',
          description: 'Max results (default "20").',
        },
      },
      required: [],
    },
  },
};

const GET_CASE_DETAILS: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_case_details',
    description:
      'Get full details of a support case including description, AI analysis, and recent comments. Use when staff asks about a specific case.',
    parameters: {
      type: 'object',
      properties: {
        caseId: {
          type: 'string',
          description: 'The case ID (UUID format).',
        },
      },
      required: ['caseId'],
    },
  },
};

const UPDATE_CASE: ToolDefinition = {
  type: 'function',
  function: {
    name: 'update_case',
    description:
      'Update a support case — change status, severity, assignment, or add a resolution. Use when staff says "close case X", "assign to Y", "escalate case", etc.',
    parameters: {
      type: 'object',
      properties: {
        caseId: {
          type: 'string',
          description: 'The case ID to update.',
        },
        status: {
          type: 'string',
          description: 'New status.',
          enum: ['open', 'in_progress', 'resolved', 'closed', 'reopened'],
        },
        severity: {
          type: 'string',
          description: 'New severity.',
          enum: ['low', 'medium', 'high', 'critical'],
        },
        assignedTo: {
          type: 'string',
          description: 'Assign to user ID.',
        },
        resolution: {
          type: 'string',
          description: 'Resolution text (for resolved/closed).',
        },
      },
      required: ['caseId'],
    },
  },
};

const ADD_CASE_COMMENT: ToolDefinition = {
  type: 'function',
  function: {
    name: 'add_case_comment',
    description:
      'Add a comment to a support case. Can be an internal note or client-visible. Use when staff says "add a note to case X", "comment on the bug", etc.',
    parameters: {
      type: 'object',
      properties: {
        caseId: {
          type: 'string',
          description: 'The case ID to comment on.',
        },
        comment: {
          type: 'string',
          description: 'The comment text.',
        },
        isInternal: {
          type: 'string',
          description: 'Whether this is an internal note (default "true").',
          enum: ['true', 'false'],
        },
      },
      required: ['caseId', 'comment'],
    },
  },
};

// ── Staff Contacts/CRM Tools ──────────────────────────────────────

const LIST_CONTACTS: ToolDefinition = {
  type: 'function',
  function: {
    name: 'list_contacts',
    description:
      'List CRM contacts (customers and suppliers). Can filter by type or search by name/email. Use when staff says "show customers", "list suppliers", "find contact X", etc.',
    parameters: {
      type: 'object',
      properties: {
        contactType: {
          type: 'string',
          description: 'Filter by contact type.',
          enum: ['customer', 'supplier'],
        },
        search: {
          type: 'string',
          description: 'Search by company name, contact person, or email.',
        },
        limit: {
          type: 'string',
          description: 'Max results (default "20").',
        },
      },
      required: [],
    },
  },
};

const GET_CONTACT_DETAILS: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_contact_details',
    description:
      'Get full details of a CRM contact including phone, email, location, VAT number, and remarks. Use when staff asks about a specific customer or supplier.',
    parameters: {
      type: 'object',
      properties: {
        contactId: {
          type: 'string',
          description: 'The contact ID (numeric).',
        },
      },
      required: ['contactId'],
    },
  },
};

const CREATE_CONTACT: ToolDefinition = {
  type: 'function',
  function: {
    name: 'create_contact',
    description:
      'Create a new CRM contact (customer or supplier). Use when staff says "add a customer", "new supplier", "create contact", etc.',
    parameters: {
      type: 'object',
      properties: {
        companyName: {
          type: 'string',
          description: 'The company or individual name.',
        },
        contactPerson: {
          type: 'string',
          description: 'Primary contact person name.',
        },
        email: {
          type: 'string',
          description: 'Email address.',
        },
        phone: {
          type: 'string',
          description: 'Phone number.',
        },
        contactType: {
          type: 'string',
          description: 'Type of contact.',
          enum: ['customer', 'supplier'],
        },
        location: {
          type: 'string',
          description: 'Physical address or location.',
        },
        vatNumber: {
          type: 'string',
          description: 'VAT registration number.',
        },
      },
      required: ['companyName', 'contactType'],
    },
  },
};

// ── Staff Quotation Tools ─────────────────────────────────────────

const LIST_QUOTATIONS: ToolDefinition = {
  type: 'function',
  function: {
    name: 'list_quotations',
    description:
      'List quotations. Can filter by contact or show recent quotes. Use when staff says "show quotes", "list quotations for client X", etc.',
    parameters: {
      type: 'object',
      properties: {
        contactId: {
          type: 'string',
          description: 'Filter by contact ID (numeric).',
        },
        limit: {
          type: 'string',
          description: 'Max results (default "20").',
        },
      },
      required: [],
    },
  },
};

const GET_QUOTATION_DETAILS: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_quotation_details',
    description:
      'Get full quotation details including line items, amounts, and associated contact. Use when staff asks "show quote #123", "quotation details", etc.',
    parameters: {
      type: 'object',
      properties: {
        quotationId: {
          type: 'string',
          description: 'The quotation ID (numeric).',
        },
      },
      required: ['quotationId'],
    },
  },
};

// ── Staff Invoice Tools ───────────────────────────────────────────

const LIST_INVOICES: ToolDefinition = {
  type: 'function',
  function: {
    name: 'list_invoices',
    description:
      'List invoices. Can filter by contact, payment status, or date range. Use when staff says "show unpaid invoices", "invoices for client X", "list overdue invoices", etc.',
    parameters: {
      type: 'object',
      properties: {
        contactId: {
          type: 'string',
          description: 'Filter by contact ID (numeric).',
        },
        paid: {
          type: 'string',
          description: 'Filter by payment status.',
          enum: ['true', 'false'],
        },
        limit: {
          type: 'string',
          description: 'Max results (default "20").',
        },
      },
      required: [],
    },
  },
};

const GET_INVOICE_DETAILS: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_invoice_details',
    description:
      'Get full invoice details including line items, amounts, due date, and payment status. Use when staff asks "show invoice #456", "invoice details", etc.',
    parameters: {
      type: 'object',
      properties: {
        invoiceId: {
          type: 'string',
          description: 'The invoice ID (numeric).',
        },
      },
      required: ['invoiceId'],
    },
  },
};

// ── Staff Pricing Tools ───────────────────────────────────────────

const SEARCH_PRICING: ToolDefinition = {
  type: 'function',
  function: {
    name: 'search_pricing',
    description:
      'Search the pricing catalogue by item name or category. Use when staff asks "how much does X cost", "price for Y", "pricing list", etc.',
    parameters: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Search term for item name or description.',
        },
        categoryId: {
          type: 'string',
          description: 'Filter by category ID (numeric).',
        },
      },
      required: [],
    },
  },
};

// ── Staff Scheduling Tools ────────────────────────────────────────

const LIST_SCHEDULED_CALLS: ToolDefinition = {
  type: 'function',
  function: {
    name: 'list_scheduled_calls',
    description:
      'List scheduled voice/video calls. Can filter by status or date range. Use when staff says "what calls are scheduled", "upcoming meetings", "show today\'s calls", etc.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filter by call status.',
          enum: ['scheduled', 'active', 'completed', 'cancelled'],
        },
        upcoming: {
          type: 'string',
          description: 'Set to "true" to only show future calls.',
          enum: ['true', 'false'],
        },
      },
      required: [],
    },
  },
};

const CREATE_SCHEDULED_CALL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'create_scheduled_call',
    description:
      'Schedule a new voice or video call in a conversation. Use when staff says "schedule a call", "set up a meeting", "book a video call", etc.',
    parameters: {
      type: 'object',
      properties: {
        conversationId: {
          type: 'string',
          description: 'The conversation ID to schedule the call in.',
        },
        title: {
          type: 'string',
          description: 'Call title/subject.',
        },
        scheduledAt: {
          type: 'string',
          description: 'Date and time in ISO 8601 format (e.g. "2025-01-15T10:00:00").',
        },
        callType: {
          type: 'string',
          description: 'Type of call.',
          enum: ['voice', 'video'],
        },
        durationMinutes: {
          type: 'string',
          description: 'Duration in minutes (default "30").',
        },
        screenShare: {
          type: 'string',
          description: 'Enable screen sharing ("true"/"false", default "false").',
          enum: ['true', 'false'],
        },
      },
      required: ['conversationId', 'title', 'scheduledAt'],
    },
  },
};

// ── Staff Bug Tracking Tools ──────────────────────────────────────

const LIST_BUGS: ToolDefinition = {
  type: 'function',
  function: {
    name: 'list_bugs',
    description:
      'List bug reports. Can filter by status, severity, workflow phase, software, or assignee. Use when staff says "show bugs", "any critical bugs", "open bugs in intake", "bugs assigned to me", etc.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filter by bug status.',
          enum: ['open', 'in-progress', 'pending-qa', 'resolved', 'closed', 'reopened'],
        },
        severity: {
          type: 'string',
          description: 'Filter by severity level.',
          enum: ['critical', 'high', 'medium', 'low'],
        },
        workflow_phase: {
          type: 'string',
          description: 'Filter by workflow phase.',
          enum: ['intake', 'qa', 'development'],
        },
        software_id: {
          type: 'string',
          description: 'Filter by software product ID (numeric).',
        },
        assigned_to: {
          type: 'string',
          description: 'Filter by assigned user ID (numeric).',
        },
        search: {
          type: 'string',
          description: 'Search in title, description, or reporter name.',
        },
        limit: {
          type: 'string',
          description: 'Max results (default "20").',
        },
      },
      required: [],
    },
  },
};

const GET_BUG_DETAILS: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_bug_details',
    description:
      'Get full details of a bug report including description, current/expected behaviour, comments, and attachments. Use when staff asks about a specific bug, e.g. "show bug #5", "bug details", "what is bug 12 about".',
    parameters: {
      type: 'object',
      properties: {
        bugId: {
          type: 'string',
          description: 'The bug ID (numeric).',
        },
      },
      required: ['bugId'],
    },
  },
};

const CREATE_BUG: ToolDefinition = {
  type: 'function',
  function: {
    name: 'create_bug',
    description:
      'Create a new bug report. Use when staff says "report a bug", "log a bug", "create a bug report", "found an issue", etc. Title and reporter name are required.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Short title describing the bug.',
        },
        reporter_name: {
          type: 'string',
          description: 'Name (or email) of the person reporting the bug.',
        },
        description: {
          type: 'string',
          description: 'Detailed description of the bug.',
        },
        current_behaviour: {
          type: 'string',
          description: 'What currently happens (the buggy behaviour).',
        },
        expected_behaviour: {
          type: 'string',
          description: 'What should happen instead.',
        },
        severity: {
          type: 'string',
          description: 'Bug severity level (default "medium").',
          enum: ['critical', 'high', 'medium', 'low'],
        },
        software_id: {
          type: 'string',
          description: 'Software product ID (numeric) this bug relates to.',
        },
        software_name: {
          type: 'string',
          description: 'Software product name (for display).',
        },
        assigned_to: {
          type: 'string',
          description: 'User ID to assign the bug to (numeric).',
        },
        assigned_to_name: {
          type: 'string',
          description: 'Display name of the assignee.',
        },
      },
      required: ['title', 'reporter_name'],
    },
  },
};

const UPDATE_BUG: ToolDefinition = {
  type: 'function',
  function: {
    name: 'update_bug',
    description:
      'Update a bug report — change status, severity, assignment, or add resolution notes. Use when staff says "close bug #5", "mark bug as resolved", "assign bug to X", "escalate bug severity", etc.',
    parameters: {
      type: 'object',
      properties: {
        bugId: {
          type: 'string',
          description: 'The bug ID to update (numeric).',
        },
        status: {
          type: 'string',
          description: 'New status.',
          enum: ['open', 'in-progress', 'pending-qa', 'resolved', 'closed', 'reopened'],
        },
        severity: {
          type: 'string',
          description: 'New severity.',
          enum: ['critical', 'high', 'medium', 'low'],
        },
        assigned_to: {
          type: 'string',
          description: 'Assign to user ID (numeric).',
        },
        assigned_to_name: {
          type: 'string',
          description: 'Display name of the new assignee.',
        },
        resolution_notes: {
          type: 'string',
          description: 'Resolution notes (when resolving or closing).',
        },
        title: {
          type: 'string',
          description: 'Updated title.',
        },
        description: {
          type: 'string',
          description: 'Updated description.',
        },
      },
      required: ['bugId'],
    },
  },
};

const ADD_BUG_COMMENT: ToolDefinition = {
  type: 'function',
  function: {
    name: 'add_bug_comment',
    description:
      'Add a comment to a bug report. Can be an internal team note or visible to the reporter. Use when staff says "add a note to bug #5", "comment on that bug", "update bug with notes", etc.',
    parameters: {
      type: 'object',
      properties: {
        bugId: {
          type: 'string',
          description: 'The bug ID to comment on (numeric).',
        },
        content: {
          type: 'string',
          description: 'The comment text.',
        },
        is_internal: {
          type: 'string',
          description: 'Whether this is an internal-only note (default "true"). Set to "false" to make visible to the reporter.',
          enum: ['true', 'false'],
        },
      },
      required: ['bugId', 'content'],
    },
  },
};

const UPDATE_BUG_WORKFLOW: ToolDefinition = {
  type: 'function',
  function: {
    name: 'update_bug_workflow',
    description:
      'Advance or change the workflow phase of a bug (Intake → QA → Development). Use when staff says "move bug to QA", "send bug to development", "move to intake", "advance bug workflow", etc. Note: this changes the phase only — status must be updated separately.',
    parameters: {
      type: 'object',
      properties: {
        bugId: {
          type: 'string',
          description: 'The bug ID (numeric).',
        },
        workflow_phase: {
          type: 'string',
          description: 'The new workflow phase.',
          enum: ['intake', 'qa', 'development'],
        },
      },
      required: ['bugId', 'workflow_phase'],
    },
  },
};

const GET_BUG_STATS: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_bug_stats',
    description:
      'Get bug tracking statistics — counts by status, severity, phase, and software. Use when staff asks "bug stats", "how many bugs", "bug overview", "bug dashboard", etc.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

// ── Staff Chat Tools ──────────────────────────────────────────────

const LIST_CONVERSATIONS: ToolDefinition = {
  type: 'function',
  function: {
    name: 'list_conversations',
    description:
      'List chat conversations the staff member is part of. Use when staff says "show my chats", "list conversations", "recent messages", etc.',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'Filter by conversation type.',
          enum: ['direct', 'group'],
        },
        limit: {
          type: 'string',
          description: 'Max results (default "20").',
        },
      },
      required: [],
    },
  },
};

const SEND_CHAT_MESSAGE: ToolDefinition = {
  type: 'function',
  function: {
    name: 'send_chat_message',
    description:
      'Send a text message in a chat conversation. Use when staff says "send a message to X", "message the team", etc. Always confirm the message content before sending.',
    parameters: {
      type: 'object',
      properties: {
        conversationId: {
          type: 'string',
          description: 'The conversation ID to send the message to.',
        },
        content: {
          type: 'string',
          description: 'The message text to send.',
        },
      },
      required: ['conversationId', 'content'],
    },
  },
};

// ============================================================================
// Tool Set Builders
// ============================================================================

export type MobileRole = 'client' | 'staff';

/**
 * Returns the tool definitions permitted for the given role.
 * Client role gets self-service tools (assistants, leads, sites, email).
 * Staff role gets ALL tools (client + admin + CRM + cases + scheduling + chat).
 */
export function getToolsForRole(role: MobileRole): ToolDefinition[] {
  // ── Core client tools (assistant management) ──
  const clientCoreTools = [
    LIST_MY_ASSISTANTS,
    TOGGLE_ASSISTANT_STATUS,
    GET_USAGE_STATS,
    LIST_FAILED_JOBS,
    RETRY_FAILED_INGESTION,
  ];

  // ── Client lead management tools ──
  const clientLeadTools = [
    LIST_LEADS,
    GET_LEAD_DETAILS,
    UPDATE_LEAD_STATUS,
    GET_LEAD_STATS,
  ];

  // ── Client email tools ──
  const clientEmailTools = [
    SEND_FOLLOWUP_EMAIL,
    SEND_INFO_EMAIL,
  ];

  // ── Client site builder tools ──
  const clientSiteTools = [
    LIST_MY_SITES,
    GET_SITE_DETAILS,
    UPDATE_SITE_FIELD,
    REGENERATE_SITE,
    DEPLOY_SITE,
    GET_SITE_DEPLOYMENTS,
  ];

  const allClientTools = [
    ...clientCoreTools,
    ...clientLeadTools,
    ...clientEmailTools,
    ...clientSiteTools,
  ];

  // ── Staff task tools (v2.0 — comprehensive) ──
  const staffTaskTools = [
    LIST_TASKS,
    GET_TASK,
    CREATE_TASK,
    UPDATE_TASK,
    DELETE_TASK,
    GET_TASK_COMMENTS,
    ADD_TASK_COMMENT,
    BOOKMARK_TASK,
    SET_TASK_PRIORITY,
    SET_TASK_COLOR,
    SET_TASK_TAGS,
    START_TASK,
    COMPLETE_TASK,
    APPROVE_TASK,
    GET_TASK_STATS,
    GET_PENDING_APPROVALS,
    GET_TASK_TAGS,
    SYNC_TASKS,
    GET_SYNC_STATUS,
    STAGE_TASKS_FOR_INVOICE,
    GET_STAGED_INVOICES,
    PROCESS_STAGED_INVOICES,
  ];

  // ── Staff admin tools ──
  const staffAdminTools = [
    SEARCH_CLIENTS,
    SUSPEND_CLIENT_ACCOUNT,
    CHECK_CLIENT_HEALTH,
    GENERATE_ENTERPRISE_ENDPOINT,
  ];

  // ── Staff cases tools ──
  const staffCaseTools = [
    LIST_CASES,
    GET_CASE_DETAILS,
    UPDATE_CASE,
    ADD_CASE_COMMENT,
  ];

  // ── Staff CRM tools ──
  const staffCrmTools = [
    LIST_CONTACTS,
    GET_CONTACT_DETAILS,
    CREATE_CONTACT,
  ];

  // ── Staff finance tools ──
  const staffFinanceTools = [
    LIST_QUOTATIONS,
    GET_QUOTATION_DETAILS,
    LIST_INVOICES,
    GET_INVOICE_DETAILS,
    SEARCH_PRICING,
  ];

  // ── Staff scheduling tools ──
  const staffSchedulingTools = [
    LIST_SCHEDULED_CALLS,
    CREATE_SCHEDULED_CALL,
  ];

  // ── Staff chat tools ──
  const staffChatTools = [
    LIST_CONVERSATIONS,
    SEND_CHAT_MESSAGE,
  ];

  // ── Staff bug tracking tools ──
  const staffBugTools = [
    LIST_BUGS,
    GET_BUG_DETAILS,
    CREATE_BUG,
    UPDATE_BUG,
    ADD_BUG_COMMENT,
    UPDATE_BUG_WORKFLOW,
    GET_BUG_STATS,
  ];

  if (role === 'staff') {
    return [
      ...allClientTools,
      ...staffTaskTools,
      ...staffAdminTools,
      ...staffCaseTools,
      ...staffCrmTools,
      ...staffFinanceTools,
      ...staffSchedulingTools,
      ...staffChatTools,
      ...staffBugTools,
    ];
  }

  return allClientTools;
}

/**
 * Build the system prompt section that describes available tools to the LLM.
 */
export function getMobileToolsSystemPrompt(tools: ToolDefinition[]): string {
  if (tools.length === 0) return '';

  const toolDescriptions = tools
    .map((t) => {
      const params = Object.entries(t.function.parameters.properties)
        .map(([name, prop]) => {
          const req = t.function.parameters.required.includes(name) ? ' (required)' : ' (optional)';
          const enumStr = prop.enum ? ` — one of: ${prop.enum.join(', ')}` : '';
          return `  - ${name}: ${prop.description}${enumStr}${req}`;
        })
        .join('\n');
      return `**${t.function.name}**: ${t.function.description}\nParameters:\n${params || '  (none)'}`;
    })
    .join('\n\n');

  return `
AVAILABLE TOOLS:
You have access to the following tools. When you need to use a tool, respond ONLY with a JSON object in the exact format shown below.

${toolDescriptions}

TOOL USAGE FORMAT:
When ready to call a tool, respond with ONLY this JSON (no other text):
{"tool_call": {"name": "tool_name", "arguments": {...}}}

RULES:
1. Only use tools when the user explicitly requests an action or information that requires one.
2. Gather all required parameters conversationally before calling a tool.
3. After a tool executes, summarize the result in plain conversational language.
4. If a tool fails, relay the error message DIRECTLY to the user — do not rephrase, speculate about causes, or add your own interpretation. Just pass along what the tool said.
5. Never fabricate data — only use information the user provides or that a tool returns.
6. For listing tools (list_my_assistants, list_failed_jobs, search_clients), call the tool first — don't guess.
7. Keep error explanations short. Do not ask the user for API keys or tokens — just tell them where to go to set things up.
`;
}
