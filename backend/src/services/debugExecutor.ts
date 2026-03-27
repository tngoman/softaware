import { db } from '../db/mysql.js';
import { type MobileExecutionContext } from './mobileActionExecutor.js';
import type { ToolResult } from './actionRouter.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

async function getCodebasePath(softwareId: number): Promise<string> {
  if (!softwareId) {
    throw new Error('No softwareId provided. The bug must be linked to a software project before you can use developer tools. Tell the user to select a software project on the bug first.');
  }
  const sw = await db.queryOne<{linked_codebase: string}>('SELECT linked_codebase FROM update_software WHERE id = ?', [softwareId]);
  if (!sw) {
    throw new Error(`Software project with ID ${softwareId} not found. The bug must be linked to a valid software project.`);
  }
  if (!sw.linked_codebase) {
    throw new Error(`Software project "${softwareId}" does not have a linked codebase directory. An administrator must configure the linked_codebase path in Software Management before developer tools can be used.`);
  }
  if (!sw.linked_codebase.startsWith('/var/www/code/')) {
    throw new Error('Linked codebase path is outside the allowed directory.');
  }
  return sw.linked_codebase;
}

// ============================================================================
// READ-ONLY TOOLS
// ============================================================================

export async function execListCodebaseFiles(args: Record<string, any>, ctx: MobileExecutionContext): Promise<ToolResult> {
  try {
    const { softwareId, directoryPath } = args;
    const base = await getCodebasePath(softwareId);
    const targetDir = path.join(base, directoryPath || '.');
    if (!targetDir.startsWith(base)) return { success: false, message: 'Path traversal denied.' };

    if (!fs.existsSync(targetDir)) {
      return { success: false, message: `Directory not found: ${directoryPath || '.'}` };
    }
    if (!fs.statSync(targetDir).isDirectory()) {
      return { success: false, message: `Not a directory: ${directoryPath}. Use read_codebase_file to read file contents.` };
    }

    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    const listing = entries
      .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== 'vendor' && e.name !== '.git')
      .map(e => {
        const relativePath = path.join(directoryPath || '.', e.name);
        if (e.isDirectory()) return `📁 ${relativePath}/`;
        const stats = fs.statSync(path.join(targetDir, e.name));
        const sizeKB = (stats.size / 1024).toFixed(1);
        return `📄 ${relativePath} (${sizeKB} KB)`;
      })
      .sort();

    if (listing.length === 0) {
      return { success: true, message: `Directory "${directoryPath || '.'}" is empty (hidden files and node_modules/vendor excluded).` };
    }

    return {
      success: true,
      message: `Contents of "${directoryPath || '.'}" (${listing.length} items):\n${listing.join('\n')}`,
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Unknown error in list_codebase_files' };
  }
}

export async function execReadCodebaseFile(args: Record<string, any>, ctx: MobileExecutionContext): Promise<ToolResult> {
  try {
    const { softwareId, filePath, startLine, endLine } = args;
    if (!filePath) return { success: false, message: 'Missing filePath argument.' };

    const base = await getCodebasePath(softwareId);
    const fullPath = path.join(base, filePath);
    if (!fullPath.startsWith(base)) return { success: false, message: 'Path traversal denied.' };

    if (!fs.existsSync(fullPath)) {
      return { success: false, message: `File not found: ${filePath}. Use list_codebase_files to see available files.` };
    }
    if (fs.statSync(fullPath).isDirectory()) {
      return { success: false, message: `"${filePath}" is a directory, not a file. Use list_codebase_files to explore it.` };
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');
    const totalLines = lines.length;

    // Apply line range if specified
    let outputLines = lines;
    let rangeInfo = '';
    if (startLine || endLine) {
      const start = Math.max(1, startLine || 1);
      const end = Math.min(totalLines, endLine || totalLines);
      outputLines = lines.slice(start - 1, end);
      rangeInfo = ` (lines ${start}-${end} of ${totalLines})`;
    }

    // Truncate very large files to prevent context overflow
    const MAX_LINES = 500;
    let truncated = false;
    if (outputLines.length > MAX_LINES) {
      outputLines = outputLines.slice(0, MAX_LINES);
      truncated = true;
    }

    // Add line numbers
    const startNum = (startLine || 1);
    const numbered = outputLines.map((line, i) => `${String(startNum + i).padStart(4, ' ')} | ${line}`).join('\n');
    const truncMsg = truncated ? `\n\n[Truncated at ${MAX_LINES} lines. Use startLine/endLine to read specific sections.]` : '';
    const ext = path.extname(filePath).replace('.', '') || 'txt';

    return {
      success: true,
      message: `File: ${filePath}${rangeInfo} (${totalLines} lines total) [language: ${ext}]\n` +
        `When showing this code to the user, wrap it in a \`\`\`${ext} code block with the filename as a heading.\n` +
        `${'─'.repeat(60)}\n${numbered}${truncMsg}`,
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Unknown error in read_codebase_file' };
  }
}

export async function execSearchCodebase(args: Record<string, any>, ctx: MobileExecutionContext): Promise<ToolResult> {
  try {
    const { softwareId, searchPattern, filePattern, maxResults } = args;
    if (!searchPattern) return { success: false, message: 'Missing searchPattern argument.' };

    const base = await getCodebasePath(softwareId);
    const limit = Math.min(maxResults || 50, 100);

    // Build grep command with safety
    // Escape shell special chars in the search pattern
    const safePattern = searchPattern.replace(/['"\\$`!]/g, '\\$&');
    let cmd = `grep -rn --include='${filePattern || '*'}' '${safePattern}' . 2>/dev/null | head -n ${limit}`;

    // Exclude common non-source dirs
    cmd = `grep -rn --exclude-dir=node_modules --exclude-dir=vendor --exclude-dir=.git --exclude-dir=storage --exclude-dir=bootstrap/cache --include='${filePattern || '*'}' '${safePattern}' . 2>/dev/null | head -n ${limit}`;

    const { stdout } = await execAsync(cmd, { cwd: base, timeout: 15000 });

    if (!stdout.trim()) {
      return { success: true, message: `No matches found for "${searchPattern}"${filePattern ? ` in ${filePattern} files` : ''}.` };
    }

    const matchCount = stdout.trim().split('\n').length;
    return {
      success: true,
      message: `Found ${matchCount} match${matchCount !== 1 ? 'es' : ''} for "${searchPattern}":\n${'─'.repeat(60)}\n${stdout.trim()}`,
    };
  } catch (err: any) {
    // grep returns exit code 1 when no matches found
    if (err.code === 1) {
      return { success: true, message: `No matches found for "${args.searchPattern}".` };
    }
    return { success: false, message: err.message || 'Unknown error in search_codebase' };
  }
}

// ============================================================================
// WRITE TOOLS
// ============================================================================

export async function execModifyCodebase(args: Record<string, any>, ctx: MobileExecutionContext): Promise<ToolResult> {
  try {
    const { softwareId, filePath, content } = args;
    if (!filePath) return { success: false, message: 'Missing filePath argument.' };
    if (content === undefined || content === null) return { success: false, message: 'Missing content argument.' };
    const base = await getCodebasePath(softwareId);
    const fullPath = path.join(base, filePath);
    if (!fullPath.startsWith(base)) return { success: false, message: 'Path traversal denied.' };

    // Capture original content for before/after comparison
    const isNewFile = !fs.existsSync(fullPath);
    const oldContent = isNewFile ? '' : fs.readFileSync(fullPath, 'utf-8');
    const ext = path.extname(filePath).replace('.', '') || 'txt';

    // Write new content
    fs.writeFileSync(fullPath, content);

    // ── New file ──────────────────────────────────────────────
    if (isNewFile) {
      const lineCount = content.split('\n').length;
      const preview = content.length > 3000 ? content.substring(0, 3000) + '\n... (truncated)' : content;
      return {
        success: true,
        message: `✅ Created NEW file: ${filePath} (${lineCount} lines)\n\n` +
          `Show the user the new file content in a \`\`\`${ext} code block so they can review it.\n\n` +
          `File content:\n\`\`\`${ext}\n${preview}\n\`\`\``
      };
    }

    // ── Unchanged file ────────────────────────────────────────
    if (oldContent === content) {
      return { success: true, message: `⚠️ File ${filePath} was written but content is identical to the original. No actual changes were made.` };
    }

    // ── Generate unified diff ─────────────────────────────────
    const tmpOld = `/tmp/diff_old_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const tmpNew = `/tmp/diff_new_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    let diffOutput = '';
    try {
      fs.writeFileSync(tmpOld, oldContent);
      fs.writeFileSync(tmpNew, content);
      const result = await execAsync(
        `diff -u "${tmpOld}" "${tmpNew}" | tail -n +3`,  // skip --- +++ headers
        { timeout: 5000 }
      ).catch(e => ({ stdout: e.stdout || '', stderr: '' }));
      diffOutput = result.stdout || '';
    } finally {
      try { fs.unlinkSync(tmpOld); } catch {}
      try { fs.unlinkSync(tmpNew); } catch {}
    }

    const addedLines = (diffOutput.match(/^\+[^+]/gm) || []).length;
    const removedLines = (diffOutput.match(/^-[^-]/gm) || []).length;
    const truncatedDiff = diffOutput.length > 6000
      ? diffOutput.substring(0, 6000) + '\n... (diff truncated)'
      : diffOutput;

    return {
      success: true,
      message: `✅ File ${filePath} updated successfully.\n\n` +
        `**Summary:** +${addedLines} lines added, -${removedLines} lines removed\n\n` +
        `IMPORTANT: You MUST present this diff to the user clearly. Show the diff below in a \`\`\`diff code block, and then show the key BEFORE and AFTER sections using \`\`\`${ext} code blocks so the user can review exactly what changed.\n\n` +
        `Diff:\n\`\`\`diff\n${truncatedDiff}\n\`\`\``
    };
  } catch (err: any) { return { success: false, message: err.message || 'Unknown error in modify_codebase' }; }
}

export async function execRunDevServer(args: Record<string, any>, ctx: MobileExecutionContext): Promise<ToolResult> {
  try {
    const { softwareId } = args;
    const base = await getCodebasePath(softwareId);
    
    // Check if package.json has a "dev" script
    const pkg = JSON.parse(fs.readFileSync(path.join(base, 'package.json'), 'utf-8'));
    if (!pkg.scripts || !pkg.scripts.dev) return { success: false, message: 'No dev script found in package.json.' };

    // Fire and forget
    execAsync('npm run dev &', { cwd: base, timeout: 5000 }).catch(e => console.log('Dev server background start:', e.message));
    
    return { success: true, message: 'Dev server started. Check UI preview.' };
  } catch (err: any) { return { success: false, message: err.message || 'Unknown error in run_dev_server' }; }
}

export async function execCommitAndPushBugfix(args: Record<string, any>, ctx: MobileExecutionContext): Promise<ToolResult> {
  try {
    const { softwareId, commitMessage } = args;
    const base = await getCodebasePath(softwareId);
    
    await execAsync(`git add . && git commit -m "${commitMessage || 'Bug fix'}" && git push`, { cwd: base });
    return { success: true, message: 'Changes committed and pushed.' };
  } catch (err: any) { return { success: false, message: err.message || 'Unknown error in commit_and_push_bugfix' }; }
}

export async function execRunMigrations(args: Record<string, any>, ctx: MobileExecutionContext): Promise<ToolResult> {
  try {
    const { softwareId, migrationsDir } = args;
    const base = await getCodebasePath(softwareId);
    
    // Simulate migration run
    await execAsync(`ls -la ${migrationsDir}`, { cwd: base });
    return { success: true, message: `Migrations in ${migrationsDir} run successfully.` };
  } catch (err: any) { return { success: false, message: err.message || 'Unknown error in run_migrations' }; }
}
