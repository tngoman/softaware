import { type ToolDefinition } from './actionRouter.js';

export const AI_DEBUG_TOOLS: ToolDefinition[] = [
  /* ──────────────────────────────────────────────────────────
   * READ-ONLY TOOLS — must be called BEFORE any modifications
   * ────────────────────────────────────────────────────────── */
  {
    type: 'function',
    function: {
      name: 'list_codebase_files',
      description: 'Lists files and directories at a given path in the linked codebase. Use this FIRST to understand the project structure before reading or modifying any files. You can call this multiple times to explore nested directories.',
      parameters: {
        type: 'object',
        properties: {
          softwareId: { type: 'number', description: 'The software project ID from the bug context.' },
          directoryPath: { type: 'string', description: 'Relative path from codebase root. Use "" or "." for root directory. Example: "app/Controllers" or "src/components"' },
        },
        required: ['softwareId', 'directoryPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_codebase_file',
      description: 'Reads the contents of a file in the linked codebase. You MUST call this to read and understand existing code BEFORE attempting to modify it with modify_codebase. Never guess or fabricate file contents. Always read first.',
      parameters: {
        type: 'object',
        properties: {
          softwareId: { type: 'number', description: 'The software project ID from the bug context.' },
          filePath: { type: 'string', description: 'Relative path from codebase root. Example: "app/Controllers/TicketController.php"' },
          startLine: { type: 'number', description: 'Optional: start reading from this line number (1-based). Useful for large files.' },
          endLine: { type: 'number', description: 'Optional: stop reading at this line number (inclusive). Useful for large files.' },
        },
        required: ['softwareId', 'filePath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_codebase',
      description: 'Searches for a text pattern or keyword across files in the linked codebase using grep. Use this to find where specific functions, classes, variables, or patterns are defined or used. Returns matching lines with file paths and line numbers.',
      parameters: {
        type: 'object',
        properties: {
          softwareId: { type: 'number', description: 'The software project ID from the bug context.' },
          searchPattern: { type: 'string', description: 'The text or pattern to search for. Examples: "function handleReply", "createTicket", "class TicketController"' },
          filePattern: { type: 'string', description: 'Optional: limit search to files matching this glob. Examples: "*.php", "*.ts", "app/Controllers/*.php". Defaults to all files.' },
          maxResults: { type: 'number', description: 'Optional: maximum number of matching lines to return. Defaults to 50.' },
        },
        required: ['softwareId', 'searchPattern'],
      },
    },
  },

  /* ──────────────────────────────────────────────────────────
   * WRITE TOOLS — only use AFTER reading and understanding code
   * ────────────────────────────────────────────────────────── */
  {
    type: 'function',
    function: {
      name: 'modify_codebase',
      description: 'Modifies a file in the linked codebase. CRITICAL RULES: 1) You MUST call read_codebase_file on the target file FIRST so you understand its actual content. NEVER fabricate or guess file contents. 2) The "content" parameter must be the COMPLETE new file content. 3) Only change the specific lines that fix the bug — preserve all other existing code exactly as-is. 4) Only call this if the bug context explicitly states a codebase is linked and provides a valid softwareId.',
      parameters: {
        type: 'object',
        properties: {
          softwareId: { type: 'number', description: 'The software project ID from the bug context. Must be a valid ID.' },
          filePath: { type: 'string', description: 'Relative path from codebase root' },
          content: { type: 'string', description: 'The COMPLETE new content of the file. Must be based on the actual existing content from read_codebase_file with only the necessary bug fix changes applied.' },
        },
        required: ['softwareId', 'filePath', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_dev_server',
      description: 'Starts the dev server for testing the bugfix. Only use when a codebase is linked to the software project.',
      parameters: {
        type: 'object',
        properties: {
          softwareId: { type: 'number', description: 'The software project ID. Must be a valid ID from a linked bug.' },
        },
        required: ['softwareId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'commit_and_push_bugfix',
      description: 'Commits and pushes the fixed files to Git. Only use AFTER you have verified the fix with the user. Always ask the user for confirmation before committing.',
      parameters: {
        type: 'object',
        properties: {
          softwareId: { type: 'number', description: 'The software project ID. Must be a valid ID from a linked bug.' },
          commitMessage: { type: 'string', description: 'A clear, descriptive commit message for the bug fix.' },
        },
        required: ['softwareId', 'commitMessage'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_migrations',
      description: 'Runs database migrations in the linked codebase. Only use when a codebase is linked to the software project.',
      parameters: {
        type: 'object',
        properties: {
          softwareId: { type: 'number', description: 'The software project ID. Must be a valid ID from a linked bug.' },
          migrationsDir: { type: 'string', description: 'Relative path to the migrations directory.' },
        },
        required: ['softwareId', 'migrationsDir'],
      },
    },
  },
];
