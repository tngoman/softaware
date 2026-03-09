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
// Staff Tools — Administrative (global scope) + Task Management
// ============================================================================

const LIST_TASKS: ToolDefinition = {
  type: 'function',
  function: {
    name: 'list_tasks',
    description:
      'List development tasks from the external software API. Shows task titles, statuses, assignees, and workflow phases. Use when staff says "show my tasks", "what tasks are pending", "list development tasks", etc.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filter tasks by status. Leave empty for all tasks.',
          enum: ['new', 'progress', 'completed', 'pending'],
        },
        assignedToMe: {
          type: 'string',
          description: 'Set to "true" to show only tasks assigned to the current user.',
          enum: ['true', 'false'],
        },
      },
      required: [],
    },
  },
};

const CREATE_TASK: ToolDefinition = {
  type: 'function',
  function: {
    name: 'create_task',
    description:
      'Create a new development task on the external software API. Use when staff says "create a task", "add a new ticket", "log a bug", "I need a feature request", etc.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'The task title/name.',
        },
        description: {
          type: 'string',
          description: 'Detailed description of the task (can include HTML).',
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
      'Update an existing task — change status, reassign, update description, log hours, or move to a different workflow phase. Use when staff says "mark task done", "move task to review", "assign task to X", "update task 42", etc.',
    parameters: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The task ID (number) to update.',
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
      'Add a comment to a task. Use when staff says "comment on task 42", "add a note to that ticket", "leave a comment", etc.',
    parameters: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The task ID (number) to comment on.',
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

  // ── Staff admin tools ──
  const staffAdminTools = [
    LIST_TASKS,
    CREATE_TASK,
    UPDATE_TASK,
    ADD_TASK_COMMENT,
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

  if (role === 'staff') {
    return [
      ...allClientTools,
      ...staffAdminTools,
      ...staffCaseTools,
      ...staffCrmTools,
      ...staffFinanceTools,
      ...staffSchedulingTools,
      ...staffChatTools,
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
