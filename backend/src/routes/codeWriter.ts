import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireApiKey } from '../middleware/apiKey.js';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

const router = Router();

// Base directory for code access - all applications
const CODE_BASE_DIR = '/var/www/code';
const BACKUP_DIR = '/var/www/code/.backups';

// Allowed file extensions for writing
const ALLOWED_EXTENSIONS = ['php', 'js', 'jsx', 'ts', 'tsx', 'json', 'md', 'css', 'scss', 'html', 'sql', 'env', 'txt', 'sh'];

// Protected directories that cannot be modified
const PROTECTED_DIRS = ['vendor', 'node_modules', '.git', '.backups'];

// API key middleware
router.use(requireApiKey);

// Ensure backup directory exists
async function ensureBackupDir() {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
  } catch {
    // Directory exists
  }
}

/**
 * Security: Ensure path stays within CODE_BASE_DIR and not in protected dirs
 */
function resolveSafePath(requestedPath: string): string {
  const normalized = path.normalize(requestedPath || '').replace(/^\/+/, '');
  const fullPath = path.resolve(CODE_BASE_DIR, normalized);
  
  // Security: must be within base directory
  if (!fullPath.startsWith(CODE_BASE_DIR)) {
    throw new Error('Access denied: path traversal detected');
  }
  
  // Check protected directories
  const relativePath = fullPath.slice(CODE_BASE_DIR.length + 1);
  const firstDir = relativePath.split('/')[0];
  if (PROTECTED_DIRS.includes(firstDir)) {
    throw new Error(`Access denied: ${firstDir} is a protected directory`);
  }
  
  return fullPath;
}

/**
 * Validate file extension
 */
function validateExtension(filePath: string): boolean {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

/**
 * Create backup of a file
 */
async function createBackup(filePath: string, tag?: string): Promise<string> {
  await ensureBackupDir();
  
  const relativePath = filePath.slice(CODE_BASE_DIR.length + 1);
  const safeFileName = relativePath.replace(/\//g, '_');
  const timestamp = Date.now();
  const backupName = tag 
    ? `${safeFileName}.${tag}.${timestamp}`
    : `${safeFileName}.${timestamp}`;
  const backupPath = path.join(BACKUP_DIR, backupName);
  
  try {
    await fs.copyFile(filePath, backupPath);
    return backupName;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // File doesn't exist yet, no backup needed
      return '';
    }
    throw error;
  }
}

/**
 * Log operation to audit file
 */
async function logOperation(operation: string, details: any): Promise<void> {
  await ensureBackupDir();
  const logPath = path.join(BACKUP_DIR, 'operations.log');
  const entry = {
    timestamp: new Date().toISOString(),
    operation,
    ...details,
  };
  
  try {
    await fs.appendFile(logPath, JSON.stringify(entry) + '\n');
  } catch {
    // Log failure is not critical
  }
}

// =================================================================
// Read Endpoints (for completeness in this router)
// =================================================================

/**
 * GET /api/code/read
 * Read file contents
 */
router.get('/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requestedPath = req.query.path as string;
    if (!requestedPath) {
      return res.status(400).json({ error: 'MISSING_PATH', message: 'path is required' });
    }
    
    const fullPath = resolveSafePath(requestedPath);
    const stats = await fs.stat(fullPath);
    
    if (stats.isDirectory()) {
      return res.status(400).json({ error: 'IS_DIRECTORY', message: 'Cannot read directory' });
    }
    
    // Size limit: 2MB
    if (stats.size > 2 * 1024 * 1024) {
      return res.status(400).json({ 
        error: 'FILE_TOO_LARGE', 
        message: 'File exceeds 2MB limit',
        size: stats.size 
      });
    }
    
    const content = await fs.readFile(fullPath, 'utf-8');
    const lines = content.split('\n');
    
    // Handle line range
    const startLine = req.query.startLine ? parseInt(req.query.startLine as string, 10) : undefined;
    const endLine = req.query.endLine ? parseInt(req.query.endLine as string, 10) : undefined;
    
    if (startLine !== undefined || endLine !== undefined) {
      const start = Math.max(1, startLine || 1) - 1;
      const end = Math.min(lines.length, endLine || lines.length);
      
      return res.json({
        success: true,
        path: requestedPath,
        content: lines.slice(start, end).join('\n'),
        totalLines: lines.length,
        startLine: start + 1,
        endLine: end,
      });
    }
    
    res.json({
      success: true,
      path: requestedPath,
      content,
      totalLines: lines.length,
    });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'File does not exist' });
    }
    next(error);
  }
});

/**
 * GET /api/code/list
 * List files in directory
 */
router.get('/list', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requestedPath = (req.query.path as string) || '';
    const fullPath = resolveSafePath(requestedPath);
    
    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    
    const result = await Promise.all(
      entries
        .filter(entry => !entry.name.startsWith('.'))
        .map(async (entry) => {
          const entryPath = path.join(fullPath, entry.name);
          try {
            const stats = await fs.stat(entryPath);
            return {
              name: entry.isDirectory() ? `${entry.name}/` : entry.name,
              type: entry.isDirectory() ? 'directory' : 'file',
              size: entry.isFile() ? stats.size : undefined,
              modified: stats.mtime.toISOString(),
            };
          } catch {
            return { name: entry.name, type: entry.isDirectory() ? 'directory' : 'file' };
          }
        })
    );
    
    result.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    
    res.json({ success: true, path: requestedPath || '/', entries: result });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Path does not exist' });
    }
    next(error);
  }
});

/**
 * GET /api/code/search
 * Search for text in files
 */
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query.query as string;
    if (!query) {
      return res.status(400).json({ error: 'MISSING_QUERY', message: 'query is required' });
    }
    
    const searchPath = (req.query.path as string) || '';
    const maxResults = Math.min(parseInt(req.query.maxResults as string, 10) || 50, 200);
    const basePath = resolveSafePath(searchPath);
    
    // Use ripgrep
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    const escapedQuery = query.replace(/'/g, "'\\''");
    const rgCommand = `rg --json -i --max-count 3 --glob '!node_modules/**' --glob '!vendor/**' --glob '!.git/**' '${escapedQuery}' '${basePath}'`;
    
    let stdout = '';
    try {
      const result = await execAsync(rgCommand, { maxBuffer: 10 * 1024 * 1024, timeout: 30000 });
      stdout = result.stdout;
    } catch (error: any) {
      if (error.code === 1) {
        return res.json({ success: true, query, results: [], resultCount: 0 });
      }
      throw error;
    }
    
    const results: Array<{ file: string; line: string; lineNumber: number }> = [];
    const lines = stdout.trim().split('\n').filter(l => l);
    
    for (const line of lines) {
      if (results.length >= maxResults) break;
      try {
        const json = JSON.parse(line);
        if (json.type === 'match') {
          results.push({
            file: json.data.path.text.slice(CODE_BASE_DIR.length + 1),
            lineNumber: json.data.line_number,
            line: json.data.lines.text.trim().slice(0, 200),
          });
        }
      } catch {
        // Skip invalid JSON
      }
    }
    
    res.json({ success: true, query, results, resultCount: results.length });
  } catch (error) {
    next(error);
  }
});

// =================================================================
// Write Endpoints
// =================================================================

/**
 * POST /api/code/write
 * Create or overwrite a file
 */
router.post('/write', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { path: filePath, content, createDirs, createBackup: shouldBackup } = z.object({
      path: z.string().min(1),
      content: z.string(),
      createDirs: z.boolean().optional().default(true),
      createBackup: z.boolean().optional().default(true),
    }).parse(req.body);
    
    const fullPath = resolveSafePath(filePath);
    
    if (!validateExtension(fullPath)) {
      return res.status(400).json({ 
        error: 'INVALID_EXTENSION', 
        message: `File extension not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` 
      });
    }
    
    // Create backup if file exists
    let backupName = '';
    if (shouldBackup) {
      backupName = await createBackup(fullPath);
    }
    
    // Create directories if needed
    if (createDirs) {
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
    }
    
    // Write file
    await fs.writeFile(fullPath, content, 'utf-8');
    
    await logOperation('write', { path: filePath, backup: backupName, bytes: content.length });
    
    res.json({
      success: true,
      path: filePath,
      bytes: content.length,
      backup: backupName || undefined,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/code/replace
 * Replace text in a file
 */
router.post('/replace', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { path: filePath, oldString, newString, all, createBackup: shouldBackup } = z.object({
      path: z.string().min(1),
      oldString: z.string().min(1),
      newString: z.string(),
      all: z.boolean().optional().default(false),
      createBackup: z.boolean().optional().default(true),
    }).parse(req.body);
    
    const fullPath = resolveSafePath(filePath);
    
    // Read current content
    const content = await fs.readFile(fullPath, 'utf-8');
    
    // Check if oldString exists
    if (!content.includes(oldString)) {
      return res.status(400).json({ 
        error: 'STRING_NOT_FOUND', 
        message: 'The string to replace was not found in the file' 
      });
    }
    
    // Create backup
    let backupName = '';
    if (shouldBackup) {
      backupName = await createBackup(fullPath);
    }
    
    // Replace
    const newContent = all 
      ? content.split(oldString).join(newString)
      : content.replace(oldString, newString);
    
    const replacements = all 
      ? content.split(oldString).length - 1 
      : 1;
    
    await fs.writeFile(fullPath, newContent, 'utf-8');
    
    await logOperation('replace', { path: filePath, backup: backupName, replacements });
    
    res.json({
      success: true,
      path: filePath,
      replacements,
      backup: backupName || undefined,
    });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'File does not exist' });
    }
    next(error);
  }
});

/**
 * POST /api/code/insert
 * Insert content at a specific line
 */
router.post('/insert', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { path: filePath, line, content: insertContent, position, createBackup: shouldBackup } = z.object({
      path: z.string().min(1),
      line: z.number().int().positive(),
      content: z.string(),
      position: z.enum(['before', 'after']).optional().default('after'),
      createBackup: z.boolean().optional().default(true),
    }).parse(req.body);
    
    const fullPath = resolveSafePath(filePath);
    
    // Read current content
    const content = await fs.readFile(fullPath, 'utf-8');
    const lines = content.split('\n');
    
    if (line > lines.length + 1) {
      return res.status(400).json({ 
        error: 'LINE_OUT_OF_RANGE', 
        message: `File has ${lines.length} lines, cannot insert at line ${line}` 
      });
    }
    
    // Create backup
    let backupName = '';
    if (shouldBackup) {
      backupName = await createBackup(fullPath);
    }
    
    // Insert content
    const insertLines = insertContent.split('\n');
    const insertIndex = position === 'before' ? line - 1 : line;
    lines.splice(insertIndex, 0, ...insertLines);
    
    await fs.writeFile(fullPath, lines.join('\n'), 'utf-8');
    
    await logOperation('insert', { path: filePath, backup: backupName, line, position, linesInserted: insertLines.length });
    
    res.json({
      success: true,
      path: filePath,
      line,
      position,
      linesInserted: insertLines.length,
      backup: backupName || undefined,
    });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'File does not exist' });
    }
    next(error);
  }
});

/**
 * POST /api/code/delete-lines
 * Delete lines from a file
 */
router.post('/delete-lines', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { path: filePath, startLine, endLine, createBackup: shouldBackup } = z.object({
      path: z.string().min(1),
      startLine: z.number().int().positive(),
      endLine: z.number().int().positive(),
      createBackup: z.boolean().optional().default(true),
    }).parse(req.body);
    
    if (endLine < startLine) {
      return res.status(400).json({ error: 'INVALID_RANGE', message: 'endLine must be >= startLine' });
    }
    
    const fullPath = resolveSafePath(filePath);
    
    // Read current content
    const content = await fs.readFile(fullPath, 'utf-8');
    const lines = content.split('\n');
    
    if (startLine > lines.length) {
      return res.status(400).json({ 
        error: 'LINE_OUT_OF_RANGE', 
        message: `File has ${lines.length} lines` 
      });
    }
    
    // Create backup
    let backupName = '';
    if (shouldBackup) {
      backupName = await createBackup(fullPath);
    }
    
    // Delete lines
    const actualEnd = Math.min(endLine, lines.length);
    const deletedCount = actualEnd - startLine + 1;
    lines.splice(startLine - 1, deletedCount);
    
    await fs.writeFile(fullPath, lines.join('\n'), 'utf-8');
    
    await logOperation('delete-lines', { path: filePath, backup: backupName, startLine, endLine: actualEnd, linesDeleted: deletedCount });
    
    res.json({
      success: true,
      path: filePath,
      linesDeleted: deletedCount,
      backup: backupName || undefined,
    });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'File does not exist' });
    }
    next(error);
  }
});

/**
 * POST /api/code/delete-file
 * Delete a file
 */
router.post('/delete-file', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { path: filePath, createBackup: shouldBackup } = z.object({
      path: z.string().min(1),
      createBackup: z.boolean().optional().default(true),
    }).parse(req.body);
    
    const fullPath = resolveSafePath(filePath);
    
    // Create backup before deletion
    let backupName = '';
    if (shouldBackup) {
      backupName = await createBackup(fullPath, 'deleted');
    }
    
    await fs.unlink(fullPath);
    
    await logOperation('delete-file', { path: filePath, backup: backupName });
    
    res.json({
      success: true,
      path: filePath,
      deleted: true,
      backup: backupName || undefined,
    });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'File does not exist' });
    }
    next(error);
  }
});

// =================================================================
// Backup/Rollback Endpoints
// =================================================================

/**
 * GET /api/code/backups
 * List available backups
 */
router.get('/backups', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await ensureBackupDir();
    
    const filePath = req.query.path as string;
    const entries = await fs.readdir(BACKUP_DIR, { withFileTypes: true });
    
    let backups = await Promise.all(
      entries
        .filter(e => e.isFile() && !e.name.endsWith('.log'))
        .map(async (e) => {
          const stats = await fs.stat(path.join(BACKUP_DIR, e.name));
          // Parse backup name: originalName.tag?.timestamp
          const parts = e.name.split('.');
          const timestamp = parseInt(parts[parts.length - 1], 10);
          
          return {
            name: e.name,
            originalPath: e.name.replace(/_/g, '/').replace(/\.\d+$/, '').replace(/\.deleted\.\d+$/, ''),
            size: stats.size,
            timestamp: isNaN(timestamp) ? undefined : new Date(timestamp).toISOString(),
          };
        })
    );
    
    // Filter by path if specified
    if (filePath) {
      const normalizedPath = filePath.replace(/\//g, '_');
      backups = backups.filter(b => b.name.startsWith(normalizedPath));
    }
    
    // Sort by timestamp descending
    backups.sort((a, b) => {
      if (!a.timestamp || !b.timestamp) return 0;
      return b.timestamp.localeCompare(a.timestamp);
    });
    
    res.json({ success: true, backups });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/code/rollback
 * Restore a file from backup
 */
router.post('/rollback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { backupName, targetPath } = z.object({
      backupName: z.string().min(1),
      targetPath: z.string().optional(),
    }).parse(req.body);
    
    const backupPath = path.join(BACKUP_DIR, backupName);
    
    // Security: ensure backup exists in backup dir
    if (!backupPath.startsWith(BACKUP_DIR)) {
      return res.status(400).json({ error: 'INVALID_BACKUP', message: 'Invalid backup name' });
    }
    
    // Determine target path
    const originalPath = targetPath || backupName.replace(/_/g, '/').replace(/\.\w*\.\d+$/, '');
    const fullTargetPath = resolveSafePath(originalPath);
    
    // Create backup of current file before rollback
    const preRollbackBackup = await createBackup(fullTargetPath, 'pre-rollback');
    
    // Copy backup to target
    await fs.copyFile(backupPath, fullTargetPath);
    
    await logOperation('rollback', { backup: backupName, target: originalPath, preRollbackBackup });
    
    res.json({
      success: true,
      restoredFrom: backupName,
      restoredTo: originalPath,
      preRollbackBackup: preRollbackBackup || undefined,
    });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Backup not found' });
    }
    next(error);
  }
});

// =================================================================
// Batch Execute Endpoint
// =================================================================

/**
 * POST /api/code/execute
 * Execute multiple operations in sequence
 */
router.post('/execute', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { operations, dryRun } = z.object({
      operations: z.array(z.object({
        type: z.enum(['write', 'replace', 'insert', 'delete-lines', 'delete-file']),
        path: z.string(),
        content: z.string().optional(),
        oldString: z.string().optional(),
        newString: z.string().optional(),
        line: z.number().optional(),
        position: z.enum(['before', 'after']).optional(),
        startLine: z.number().optional(),
        endLine: z.number().optional(),
        all: z.boolean().optional(),
      })),
      dryRun: z.boolean().optional().default(false),
    }).parse(req.body);
    
    const results = [];
    
    for (const op of operations) {
      try {
        const fullPath = resolveSafePath(op.path);
        
        if (dryRun) {
          // Validate operation would succeed
          if (op.type !== 'write') {
            await fs.access(fullPath); // Check file exists
          }
          if (op.type === 'write' && !validateExtension(fullPath)) {
            throw new Error('Invalid file extension');
          }
          
          results.push({
            operation: op.type,
            path: op.path,
            status: 'valid',
            wouldExecute: true,
          });
        } else {
          // Actually execute
          let result: any;
          
          switch (op.type) {
            case 'write':
              if (!validateExtension(fullPath)) {
                throw new Error('Invalid file extension');
              }
              const writeBackup = await createBackup(fullPath);
              await fs.mkdir(path.dirname(fullPath), { recursive: true });
              await fs.writeFile(fullPath, op.content || '', 'utf-8');
              result = { backup: writeBackup };
              break;
              
            case 'replace':
              const replaceContent = await fs.readFile(fullPath, 'utf-8');
              if (!replaceContent.includes(op.oldString || '')) {
                throw new Error('String not found');
              }
              const replaceBackup = await createBackup(fullPath);
              const newContent = op.all 
                ? replaceContent.split(op.oldString || '').join(op.newString || '')
                : replaceContent.replace(op.oldString || '', op.newString || '');
              await fs.writeFile(fullPath, newContent, 'utf-8');
              result = { backup: replaceBackup };
              break;
              
            case 'insert':
              const insertFileContent = await fs.readFile(fullPath, 'utf-8');
              const insertLines = insertFileContent.split('\n');
              const insertBackup = await createBackup(fullPath);
              const insertIndex = (op.position === 'before' ? (op.line || 1) - 1 : (op.line || 1));
              insertLines.splice(insertIndex, 0, ...(op.content || '').split('\n'));
              await fs.writeFile(fullPath, insertLines.join('\n'), 'utf-8');
              result = { backup: insertBackup };
              break;
              
            case 'delete-lines':
              const deleteContent = await fs.readFile(fullPath, 'utf-8');
              const deleteLines = deleteContent.split('\n');
              const deleteBackup = await createBackup(fullPath);
              deleteLines.splice((op.startLine || 1) - 1, (op.endLine || op.startLine || 1) - (op.startLine || 1) + 1);
              await fs.writeFile(fullPath, deleteLines.join('\n'), 'utf-8');
              result = { backup: deleteBackup };
              break;
              
            case 'delete-file':
              const deleteFileBackup = await createBackup(fullPath, 'deleted');
              await fs.unlink(fullPath);
              result = { backup: deleteFileBackup };
              break;
          }
          
          results.push({
            operation: op.type,
            path: op.path,
            status: 'success',
            ...result,
          });
        }
      } catch (error: any) {
        results.push({
          operation: op.type,
          path: op.path,
          status: 'error',
          error: error.message,
        });
        
        // Stop on first error in non-dry-run mode
        if (!dryRun) {
          break;
        }
      }
    }
    
    const successCount = results.filter(r => r.status === 'success' || r.status === 'valid').length;
    
    res.json({
      success: successCount === operations.length,
      dryRun,
      totalOperations: operations.length,
      successfulOperations: successCount,
      results,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/code/status
 * Get API status and configuration
 */
router.get('/status', async (req: Request, res: Response) => {
  let backupCount = 0;
  let logSize = 0;
  
  try {
    const entries = await fs.readdir(BACKUP_DIR);
    backupCount = entries.filter(e => !e.endsWith('.log')).length;
    const logStats = await fs.stat(path.join(BACKUP_DIR, 'operations.log')).catch(() => null);
    logSize = logStats?.size || 0;
  } catch {
    // Backup dir doesn't exist yet
  }
  
  res.json({
    success: true,
    status: 'operational',
    basePath: CODE_BASE_DIR,
    backupDir: BACKUP_DIR,
    backupCount,
    logSize,
    allowedExtensions: ALLOWED_EXTENSIONS,
    protectedDirs: PROTECTED_DIRS,
    timestamp: new Date().toISOString(),
  });
});

export { router as codeWriterRouter };
