import { Router } from 'express';
import { z } from 'zod';
import { sshService, SSHConfig } from '../services/sshService.js';

const router = Router();

// Validation schemas
const sshConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).default(22),
  username: z.string().min(1),
  password: z.string().optional(),
  privateKey: z.string().optional(),
  passphrase: z.string().optional(),
});

const listFilesSchema = z.object({
  sshConfig: sshConfigSchema,
  path: z.string().default('/'),
});

const readFileSchema = z.object({
  sshConfig: sshConfigSchema,
  path: z.string().min(1),
});

const writeFileSchema = z.object({
  sshConfig: sshConfigSchema,
  path: z.string().min(1),
  content: z.string(),
});

const deleteFileSchema = z.object({
  sshConfig: sshConfigSchema,
  path: z.string().min(1),
});

const createDirectorySchema = z.object({
  sshConfig: sshConfigSchema,
  path: z.string().min(1),
});

const moveFileSchema = z.object({
  sshConfig: sshConfigSchema,
  oldPath: z.string().min(1),
  newPath: z.string().min(1),
});

/**
 * GET /api/files/list
 * List files in a directory on remote server
 */
router.get('/list', async (req, res, next) => {
  try {
    const { sshConfig, path } = listFilesSchema.parse(req.body);
    const files = await sshService.listDirectory(sshConfig as SSHConfig, path);
    res.json({ files });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/files/list
 * List files (POST for complex configs)
 */
router.post('/list', async (req, res, next) => {
  try {
    const { sshConfig, path } = listFilesSchema.parse(req.body);
    const files = await sshService.listDirectory(sshConfig as SSHConfig, path);
    res.json({ files });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/files/read
 * Read a file's content
 */
router.get('/read', async (req, res, next) => {
  try {
    const { sshConfig, path } = readFileSchema.parse(req.body);
    const content = await sshService.readFile(sshConfig as SSHConfig, path);
    res.json({ path, content });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/files/read
 * Read a file's content (POST for complex configs)
 */
router.post('/read', async (req, res, next) => {
  try {
    const { sshConfig, path } = readFileSchema.parse(req.body);
    const content = await sshService.readFile(sshConfig as SSHConfig, path);
    res.json({ path, content });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/files/write
 * Write content to a file
 */
router.post('/write', async (req, res, next) => {
  try {
    const { sshConfig, path, content } = writeFileSchema.parse(req.body);
    await sshService.writeFile(sshConfig as SSHConfig, path, content);
    res.json({ success: true, path, message: 'File written successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/files/delete
 * Delete a file or directory
 */
router.delete('/delete', async (req, res, next) => {
  try {
    const { sshConfig, path } = deleteFileSchema.parse(req.body);
    await sshService.deleteFile(sshConfig as SSHConfig, path);
    res.json({ success: true, path, message: 'File deleted successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/files/delete
 * Delete a file or directory (POST for complex configs)
 */
router.post('/delete', async (req, res, next) => {
  try {
    const { sshConfig, path } = deleteFileSchema.parse(req.body);
    await sshService.deleteFile(sshConfig as SSHConfig, path);
    res.json({ success: true, path, message: 'File deleted successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/files/mkdir
 * Create a directory
 */
router.post('/mkdir', async (req, res, next) => {
  try {
    const { sshConfig, path } = createDirectorySchema.parse(req.body);
    await sshService.createDirectory(sshConfig as SSHConfig, path);
    res.json({ success: true, path, message: 'Directory created successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/files/move
 * Move/rename a file or directory
 */
router.post('/move', async (req, res, next) => {
  try {
    const { sshConfig, oldPath, newPath } = moveFileSchema.parse(req.body);
    await sshService.moveFile(sshConfig as SSHConfig, oldPath, newPath);
    res.json({ success: true, oldPath, newPath, message: 'File moved successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/files/info
 * Get file information
 */
router.post('/info', async (req, res, next) => {
  try {
    const { sshConfig, path } = readFileSchema.parse(req.body);
    const info = await sshService.getFileInfo(sshConfig as SSHConfig, path);
    res.json({ path, info });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/files/test
 * Test SSH connection
 */
router.post('/test', async (req, res, next) => {
  try {
    const sshConfig = sshConfigSchema.parse(req.body);
    const success = await sshService.testConnection(sshConfig as SSHConfig);
    res.json({ success, message: success ? 'Connection successful' : 'Connection failed' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/files/execute
 * Execute a shell command on remote server
 */
router.post('/execute', async (req, res, next) => {
  try {
    const schema = z.object({
      sshConfig: sshConfigSchema,
      command: z.string().min(1),
    });
    const { sshConfig, command } = schema.parse(req.body);
    const output = await sshService.executeCommand(sshConfig as SSHConfig, command);
    res.json({ command, output });
  } catch (error) {
    next(error);
  }
});

export { router as filesRouter };
