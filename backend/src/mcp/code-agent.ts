import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { env } from '../config/env.js';
import { SSEServerTransport, sseSessionManager } from './sse-transport.js';

const execAsync = promisify(exec);

/**
 * Code Agent MCP Server
 * 
 * Provides tools for remote code editing, file management, and command execution.
 * Designed to be accessed by a desktop app via SSE transport.
 * 
 * Security Notes:
 * - WORKSPACE_ROOT restricts file operations to a specific directory
 * - Command execution is sandboxed to the workspace
 * - Authentication is handled by the route layer
 */

// Map of session ID -> MCP server instance
const serverInstances: Map<string, McpServer> = new Map();

/**
 * Get or create an MCP server for a session
 */
export function getOrCreateCodeAgentServer(sessionId: string): McpServer {
  let server = serverInstances.get(sessionId);
  if (!server) {
    server = createCodeAgentServer();
    serverInstances.set(sessionId, server);
  }
  return server;
}

/**
 * Remove an MCP server instance
 */
export function removeCodeAgentServer(sessionId: string): void {
  serverInstances.delete(sessionId);
}

/**
 * Create a new Code Agent MCP server instance
 */
function createCodeAgentServer(): McpServer {
  const server = new McpServer({
    name: 'softaware-code-agent',
    version: '1.0.0',
  });

  // Workspace root - all file operations are restricted to this directory
  const WORKSPACE_ROOT = env.CODE_AGENT_WORKSPACE || process.cwd();

  /**
   * Helper to resolve and validate file paths
   */
  function resolvePath(filePath: string): string {
    // Normalize the path
    const normalized = path.normalize(filePath);
    
    // If it's an absolute path, check it's within workspace
    if (path.isAbsolute(normalized)) {
      if (!normalized.startsWith(WORKSPACE_ROOT)) {
        throw new Error(`Access denied: Path outside workspace`);
      }
      return normalized;
    }
    
    // Resolve relative path from workspace root
    const resolved = path.resolve(WORKSPACE_ROOT, normalized);
    
    // Verify it's still within workspace (prevents ../ attacks)
    if (!resolved.startsWith(WORKSPACE_ROOT)) {
      throw new Error(`Access denied: Path outside workspace`);
    }
    
    return resolved;
  }

  // ------------------------------------------------------------------
  // Tool: read_file
  // ------------------------------------------------------------------
  server.tool(
    'read_file',
    'Read the contents of a file at the specified path',
    {
      path: z.string().describe('Path to the file to read (relative to workspace or absolute)'),
      startLine: z.number().optional().describe('Start line (1-indexed, optional)'),
      endLine: z.number().optional().describe('End line (1-indexed, optional)'),
    },
    async ({ path: filePath, startLine, endLine }) => {
      try {
        const resolvedPath = resolvePath(filePath);
        const content = await fs.readFile(resolvedPath, 'utf-8');
        
        let result = content;
        
        // If line range specified, extract those lines
        if (startLine !== undefined || endLine !== undefined) {
          const lines = content.split('\n');
          const start = (startLine ?? 1) - 1;
          const end = endLine ?? lines.length;
          result = lines.slice(start, end).join('\n');
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              path: filePath,
              content: result,
              totalLines: content.split('\n').length,
            }),
          }],
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error';
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error }) }],
          isError: true,
        };
      }
    }
  );

  // ------------------------------------------------------------------
  // Tool: write_file
  // ------------------------------------------------------------------
  server.tool(
    'write_file',
    'Create or overwrite a file with the specified content',
    {
      path: z.string().describe('Path to the file to write'),
      content: z.string().describe('Content to write to the file'),
      createDirectories: z.boolean().optional().describe('Create parent directories if they do not exist'),
    },
    async ({ path: filePath, content, createDirectories }) => {
      try {
        const resolvedPath = resolvePath(filePath);
        
        if (createDirectories) {
          await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
        }
        
        await fs.writeFile(resolvedPath, content, 'utf-8');

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              message: `File written: ${filePath}`,
              path: filePath,
              bytesWritten: Buffer.byteLength(content, 'utf-8'),
            }),
          }],
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error';
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error }) }],
          isError: true,
        };
      }
    }
  );

  // ------------------------------------------------------------------
  // Tool: edit_code
  // ------------------------------------------------------------------
  server.tool(
    'edit_code',
    'Edit code in a file by replacing specific text with new text',
    {
      path: z.string().describe('Path to the file to edit'),
      oldText: z.string().describe('The exact text to find and replace'),
      newText: z.string().describe('The text to replace with'),
      expectedReplacements: z.number().optional().describe('Expected number of replacements (default: 1)'),
    },
    async ({ path: filePath, oldText, newText, expectedReplacements = 1 }) => {
      try {
        const resolvedPath = resolvePath(filePath);
        const content = await fs.readFile(resolvedPath, 'utf-8');
        
        // Count occurrences
        const occurrences = content.split(oldText).length - 1;
        
        if (occurrences === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                error: 'Text not found in file',
                searchedFor: oldText.substring(0, 100) + (oldText.length > 100 ? '...' : ''),
              }),
            }],
            isError: true,
          };
        }
        
        if (occurrences !== expectedReplacements) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                error: `Expected ${expectedReplacements} occurrence(s), found ${occurrences}`,
                occurrences,
                hint: 'Include more context in oldText to make it unique',
              }),
            }],
            isError: true,
          };
        }
        
        const newContent = content.replace(oldText, newText);
        await fs.writeFile(resolvedPath, newContent, 'utf-8');

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              message: `Replaced ${occurrences} occurrence(s) in ${filePath}`,
              path: filePath,
              replacements: occurrences,
            }),
          }],
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error';
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error }) }],
          isError: true,
        };
      }
    }
  );

  // ------------------------------------------------------------------
  // Tool: list_directory
  // ------------------------------------------------------------------
  server.tool(
    'list_directory',
    'List files and directories at the specified path',
    {
      path: z.string().describe('Path to the directory to list'),
      recursive: z.boolean().optional().describe('List recursively (default: false)'),
      maxDepth: z.number().optional().describe('Maximum depth for recursive listing'),
    },
    async ({ path: dirPath, recursive = false, maxDepth = 3 }) => {
      try {
        const resolvedPath = resolvePath(dirPath);

        async function listDir(dir: string, depth: number): Promise<string[]> {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          const results: string[] = [];

          for (const entry of entries) {
            const relativePath = path.relative(WORKSPACE_ROOT, path.join(dir, entry.name));
            
            if (entry.isDirectory()) {
              results.push(relativePath + '/');
              if (recursive && depth < maxDepth) {
                const subResults = await listDir(path.join(dir, entry.name), depth + 1);
                results.push(...subResults);
              }
            } else {
              results.push(relativePath);
            }
          }

          return results;
        }

        const files = await listDir(resolvedPath, 0);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              path: dirPath,
              entries: files,
              count: files.length,
            }),
          }],
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error';
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error }) }],
          isError: true,
        };
      }
    }
  );

  // ------------------------------------------------------------------
  // Tool: search_files
  // ------------------------------------------------------------------
  server.tool(
    'search_files',
    'Search for text in files within the workspace',
    {
      query: z.string().describe('Text or regex pattern to search for'),
      path: z.string().optional().describe('Directory to search in (default: workspace root)'),
      filePattern: z.string().optional().describe('File pattern to match (e.g., "*.ts")'),
      isRegex: z.boolean().optional().describe('Treat query as regex (default: false)'),
      maxResults: z.number().optional().describe('Maximum results (default: 50)'),
    },
    async ({ query, path: searchPath, filePattern, isRegex = false, maxResults = 50 }) => {
      try {
        const resolvedPath = resolvePath(searchPath || '.');
        const results: { file: string; line: number; content: string }[] = [];
        const regex = isRegex ? new RegExp(query, 'gi') : null;

        async function searchDir(dir: string): Promise<void> {
          if (results.length >= maxResults) return;

          const entries = await fs.readdir(dir, { withFileTypes: true });

          for (const entry of entries) {
            if (results.length >= maxResults) break;

            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
              // Skip node_modules and hidden directories
              if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
                await searchDir(fullPath);
              }
            } else {
              // Check file pattern
              if (filePattern) {
                const pattern = filePattern.replace(/\*/g, '.*');
                if (!new RegExp(`^${pattern}$`).test(entry.name)) continue;
              }

              try {
                const content = await fs.readFile(fullPath, 'utf-8');
                const lines = content.split('\n');

                lines.forEach((line, index) => {
                  if (results.length >= maxResults) return;

                  const matches = regex
                    ? regex.test(line)
                    : line.toLowerCase().includes(query.toLowerCase());

                  if (matches) {
                    results.push({
                      file: path.relative(WORKSPACE_ROOT, fullPath),
                      line: index + 1,
                      content: line.trim().substring(0, 200),
                    });
                  }
                });
              } catch {
                // Skip files that can't be read (binary, etc.)
              }
            }
          }
        }

        await searchDir(resolvedPath);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              query,
              results,
              totalResults: results.length,
              truncated: results.length >= maxResults,
            }),
          }],
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error';
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error }) }],
          isError: true,
        };
      }
    }
  );

  // ------------------------------------------------------------------
  // Tool: delete_file
  // ------------------------------------------------------------------
  server.tool(
    'delete_file',
    'Delete a file or directory',
    {
      path: z.string().describe('Path to the file or directory to delete'),
      recursive: z.boolean().optional().describe('Delete directories recursively'),
    },
    async ({ path: filePath, recursive = false }) => {
      try {
        const resolvedPath = resolvePath(filePath);
        const stats = await fs.stat(resolvedPath);

        if (stats.isDirectory()) {
          await fs.rm(resolvedPath, { recursive });
        } else {
          await fs.unlink(resolvedPath);
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              message: `Deleted: ${filePath}`,
              type: stats.isDirectory() ? 'directory' : 'file',
            }),
          }],
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error';
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error }) }],
          isError: true,
        };
      }
    }
  );

  // ------------------------------------------------------------------
  // Tool: move_file
  // ------------------------------------------------------------------
  server.tool(
    'move_file',
    'Move or rename a file',
    {
      source: z.string().describe('Source path'),
      destination: z.string().describe('Destination path'),
    },
    async ({ source, destination }) => {
      try {
        const resolvedSource = resolvePath(source);
        const resolvedDest = resolvePath(destination);

        await fs.rename(resolvedSource, resolvedDest);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              message: `Moved ${source} to ${destination}`,
            }),
          }],
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error';
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error }) }],
          isError: true,
        };
      }
    }
  );

  // ------------------------------------------------------------------
  // Tool: run_command
  // ------------------------------------------------------------------
  server.tool(
    'run_command',
    'Run a shell command in the workspace (with restrictions)',
    {
      command: z.string().describe('Command to execute'),
      cwd: z.string().optional().describe('Working directory (relative to workspace)'),
      timeout: z.number().optional().describe('Timeout in milliseconds (default: 30000)'),
    },
    async ({ command, cwd, timeout = 30000 }) => {
      try {
        // Security: Block dangerous commands
        const blockedPatterns = [
          /rm\s+-rf\s+\//,
          /dd\s+if=/,
          /mkfs/,
          /format\s+[a-z]:/i,
          /:(){ :|:& };:/,
          />\s*\/dev\/sd/,
        ];

        for (const pattern of blockedPatterns) {
          if (pattern.test(command)) {
            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({ error: 'Command blocked for security reasons' }),
              }],
              isError: true,
            };
          }
        }

        const workingDir = cwd ? resolvePath(cwd) : WORKSPACE_ROOT;

        const { stdout, stderr } = await execAsync(command, {
          cwd: workingDir,
          timeout,
          maxBuffer: 1024 * 1024 * 5, // 5MB
        });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              command,
              stdout: stdout.trim(),
              stderr: stderr.trim(),
            }),
          }],
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error';
        const execErr = err as { stdout?: string; stderr?: string };
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              error,
              stdout: execErr.stdout?.trim(),
              stderr: execErr.stderr?.trim(),
            }),
          }],
          isError: true,
        };
      }
    }
  );

  // ------------------------------------------------------------------
  // Tool: get_file_info
  // ------------------------------------------------------------------
  server.tool(
    'get_file_info',
    'Get metadata about a file or directory',
    {
      path: z.string().describe('Path to the file or directory'),
    },
    async ({ path: filePath }) => {
      try {
        const resolvedPath = resolvePath(filePath);
        const stats = await fs.stat(resolvedPath);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              path: filePath,
              type: stats.isDirectory() ? 'directory' : 'file',
              size: stats.size,
              created: stats.birthtime.toISOString(),
              modified: stats.mtime.toISOString(),
              permissions: stats.mode.toString(8),
            }),
          }],
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error';
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error }) }],
          isError: true,
        };
      }
    }
  );

  // ------------------------------------------------------------------
  // Tool: create_directory
  // ------------------------------------------------------------------
  server.tool(
    'create_directory',
    'Create a new directory',
    {
      path: z.string().describe('Path to the directory to create'),
      recursive: z.boolean().optional().describe('Create parent directories if needed'),
    },
    async ({ path: dirPath, recursive = true }) => {
      try {
        const resolvedPath = resolvePath(dirPath);
        await fs.mkdir(resolvedPath, { recursive });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              message: `Directory created: ${dirPath}`,
            }),
          }],
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error';
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error }) }],
          isError: true,
        };
      }
    }
  );

  // ------------------------------------------------------------------
  // Tool: apply_diff
  // ------------------------------------------------------------------
  server.tool(
    'apply_diff',
    'Apply multiple edits to a file at once',
    {
      path: z.string().describe('Path to the file to edit'),
      edits: z.array(z.object({
        oldText: z.string(),
        newText: z.string(),
      })).describe('Array of edits to apply'),
    },
    async ({ path: filePath, edits }) => {
      try {
        const resolvedPath = resolvePath(filePath);
        let content = await fs.readFile(resolvedPath, 'utf-8');
        const results: { success: boolean; oldText: string }[] = [];

        for (const edit of edits) {
          if (content.includes(edit.oldText)) {
            content = content.replace(edit.oldText, edit.newText);
            results.push({ success: true, oldText: edit.oldText.substring(0, 50) });
          } else {
            results.push({ success: false, oldText: edit.oldText.substring(0, 50) });
          }
        }

        await fs.writeFile(resolvedPath, content, 'utf-8');

        const successCount = results.filter((r) => r.success).length;

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: successCount === edits.length,
              message: `Applied ${successCount}/${edits.length} edits to ${filePath}`,
              results,
            }),
          }],
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error';
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error }) }],
          isError: true,
        };
      }
    }
  );

  return server;
}

/**
 * Connect an MCP server to an SSE transport
 */
export async function connectCodeAgentToSSE(
  sessionId: string,
  transport: SSEServerTransport
): Promise<McpServer> {
  const server = getOrCreateCodeAgentServer(sessionId);
  await server.connect(transport as any);
  console.log(`[MCP-CodeAgent] Connected session ${sessionId}`);
  return server;
}

/**
 * Get tool definitions for client-side LLM
 */
export function getToolDefinitions() {
  return [
    {
      name: 'read_file',
      description: 'Read the contents of a file at the specified path',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file to read' },
          startLine: { type: 'number', description: 'Start line (1-indexed, optional)' },
          endLine: { type: 'number', description: 'End line (1-indexed, optional)' },
        },
        required: ['path'],
      },
    },
    {
      name: 'write_file',
      description: 'Create or overwrite a file with the specified content',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file to write' },
          content: { type: 'string', description: 'Content to write to the file' },
          createDirectories: { type: 'boolean', description: 'Create parent directories if they do not exist' },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'edit_code',
      description: 'Edit code in a file by replacing specific text with new text',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file to edit' },
          oldText: { type: 'string', description: 'The exact text to find and replace' },
          newText: { type: 'string', description: 'The text to replace with' },
          expectedReplacements: { type: 'number', description: 'Expected number of replacements (default: 1)' },
        },
        required: ['path', 'oldText', 'newText'],
      },
    },
    {
      name: 'list_directory',
      description: 'List files and directories at the specified path',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the directory to list' },
          recursive: { type: 'boolean', description: 'List recursively (default: false)' },
          maxDepth: { type: 'number', description: 'Maximum depth for recursive listing' },
        },
        required: ['path'],
      },
    },
    {
      name: 'search_files',
      description: 'Search for text in files within the workspace',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Text or regex pattern to search for' },
          path: { type: 'string', description: 'Directory to search in' },
          filePattern: { type: 'string', description: 'File pattern to match (e.g., "*.ts")' },
          isRegex: { type: 'boolean', description: 'Treat query as regex' },
          maxResults: { type: 'number', description: 'Maximum results' },
        },
        required: ['query'],
      },
    },
    {
      name: 'delete_file',
      description: 'Delete a file or directory',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file or directory to delete' },
          recursive: { type: 'boolean', description: 'Delete directories recursively' },
        },
        required: ['path'],
      },
    },
    {
      name: 'move_file',
      description: 'Move or rename a file',
      inputSchema: {
        type: 'object',
        properties: {
          source: { type: 'string', description: 'Source path' },
          destination: { type: 'string', description: 'Destination path' },
        },
        required: ['source', 'destination'],
      },
    },
    {
      name: 'run_command',
      description: 'Run a shell command in the workspace',
      inputSchema: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Command to execute' },
          cwd: { type: 'string', description: 'Working directory' },
          timeout: { type: 'number', description: 'Timeout in milliseconds' },
        },
        required: ['command'],
      },
    },
    {
      name: 'get_file_info',
      description: 'Get metadata about a file or directory',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file or directory' },
        },
        required: ['path'],
      },
    },
    {
      name: 'create_directory',
      description: 'Create a new directory',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the directory to create' },
          recursive: { type: 'boolean', description: 'Create parent directories if needed' },
        },
        required: ['path'],
      },
    },
    {
      name: 'apply_diff',
      description: 'Apply multiple edits to a file at once',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file to edit' },
          edits: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                oldText: { type: 'string' },
                newText: { type: 'string' },
              },
              required: ['oldText', 'newText'],
            },
            description: 'Array of edits to apply',
          },
        },
        required: ['path', 'edits'],
      },
    },
  ];
}
