import { Router } from 'express';
import { z } from 'zod';
import { db, generateId, toMySQLDate } from '../db/mysql.js';
import { requireAuth, getAuth } from '../middleware/auth.js';
import { notFound } from '../utils/httpErrors.js';
export const aiConfigRouter = Router();
// GET /ai-config - Get AI model routing config for authenticated user's team
aiConfigRouter.get('/', requireAuth, async (req, res, next) => {
    try {
        const { userId } = getAuth(req);
        // Find user's primary team
        const membership = await db.queryOne('SELECT * FROM team_members WHERE userId = ? LIMIT 1', [userId]);
        if (!membership)
            throw notFound('No team found for user');
        const config = await db.queryOne('SELECT * FROM ai_model_config WHERE teamId = ?', [membership.teamId]);
        if (!config) {
            // Return defaults if no config exists yet
            return res.json({
                defaultTextProvider: 'glm',
                defaultTextModel: 'glm-4-plus',
                visionProvider: 'glm',
                visionModel: 'glm-4v-plus',
                codeProvider: 'glm',
                codeModel: 'glm-4-plus',
            });
        }
        res.json({
            defaultTextProvider: config.defaultTextProvider,
            defaultTextModel: config.defaultTextModel,
            visionProvider: config.visionProvider,
            visionModel: config.visionModel,
            codeProvider: config.codeProvider,
            codeModel: config.codeModel,
        });
    }
    catch (err) {
        next(err);
    }
});
const UpdateConfigSchema = z.object({
    defaultTextProvider: z.enum(['glm', 'ollama']).optional(),
    defaultTextModel: z.string().min(1).optional(),
    visionProvider: z.enum(['glm', 'ollama']).optional(),
    visionModel: z.string().min(1).optional(),
    codeProvider: z.enum(['glm', 'ollama']).optional(),
    codeModel: z.string().min(1).optional(),
});
// PUT /ai-config - Update AI model routing config
aiConfigRouter.put('/', requireAuth, async (req, res, next) => {
    try {
        const { userId } = getAuth(req);
        const input = UpdateConfigSchema.parse(req.body);
        const membership = await db.queryOne('SELECT * FROM team_members WHERE userId = ? LIMIT 1', [userId]);
        if (!membership)
            throw notFound('No team found for user');
        const existing = await db.queryOne('SELECT * FROM ai_model_config WHERE teamId = ?', [membership.teamId]);
        const now = toMySQLDate(new Date());
        if (existing) {
            // Update
            const updates = [];
            const values = [];
            if (input.defaultTextProvider !== undefined) {
                updates.push('defaultTextProvider = ?');
                values.push(input.defaultTextProvider);
            }
            if (input.defaultTextModel !== undefined) {
                updates.push('defaultTextModel = ?');
                values.push(input.defaultTextModel);
            }
            if (input.visionProvider !== undefined) {
                updates.push('visionProvider = ?');
                values.push(input.visionProvider);
            }
            if (input.visionModel !== undefined) {
                updates.push('visionModel = ?');
                values.push(input.visionModel);
            }
            if (input.codeProvider !== undefined) {
                updates.push('codeProvider = ?');
                values.push(input.codeProvider);
            }
            if (input.codeModel !== undefined) {
                updates.push('codeModel = ?');
                values.push(input.codeModel);
            }
            if (updates.length > 0) {
                updates.push('updatedAt = ?');
                values.push(now);
                values.push(membership.teamId);
                await db.execute(`UPDATE ai_model_config SET ${updates.join(', ')} WHERE teamId = ?`, values);
            }
        }
        else {
            // Insert with defaults
            const configId = generateId();
            await db.execute(`INSERT INTO ai_model_config (id, teamId, defaultTextProvider, defaultTextModel, visionProvider, visionModel, codeProvider, codeModel, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                configId,
                membership.teamId,
                input.defaultTextProvider ?? 'glm',
                input.defaultTextModel ?? 'glm-4-plus',
                input.visionProvider ?? 'glm',
                input.visionModel ?? 'glm-4v-plus',
                input.codeProvider ?? 'glm',
                input.codeModel ?? 'glm-4-plus',
                now,
                now
            ]);
        }
        const config = await db.queryOne('SELECT * FROM ai_model_config WHERE teamId = ?', [membership.teamId]);
        res.json({
            defaultTextProvider: config.defaultTextProvider,
            defaultTextModel: config.defaultTextModel,
            visionProvider: config.visionProvider,
            visionModel: config.visionModel,
            codeProvider: config.codeProvider,
            codeModel: config.codeModel,
        });
    }
    catch (err) {
        next(err);
    }
});
