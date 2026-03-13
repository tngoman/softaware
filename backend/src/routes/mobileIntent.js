/**
 * Mobile Intent Route — POST /api/v1/mobile/intent
 *
 * Accepts the text transcribed by the mobile device, processes it
 * through the AI assistant with tool-calling, and returns a plain
 * text reply the mobile app can pass to TTS.
 *
 * Request body:
 *   { text: string; conversationId?: string; assistantId?: string; language?: string; }
 *
 * Response:
 *   { reply: string; conversationId: string; toolsUsed: string[]; data?: any; }
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { processMobileIntent, resolveUserRole } from '../services/mobileAIProcessor.js';
import { HttpError, unauthorized, badRequest, notFound, forbidden } from '../utils/httpErrors.js';
import { db } from '../db/mysql.js';
import { getSecret } from '../services/credentialVault.js';
import { env } from '../config/env.js';
import { stripMarkdownForSpeech } from '../utils/stripMarkdown.js';
const router = Router();
// ============================================================================
// POST /intent — Main intent endpoint
// ============================================================================
router.post('/intent', requireAuth, async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId)
            throw unauthorized('Authentication required.');
        const { text, conversationId, assistantId, language, image } = req.body;
        // Validate input
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            throw badRequest('Missing or empty "text" field.');
        }
        if (text.length > 2000) {
            throw badRequest('Text exceeds maximum length of 2000 characters.');
        }
        // Validate image if provided (must be a data URI, max ~10MB base64)
        if (image) {
            if (typeof image !== 'string' || !image.startsWith('data:image/')) {
                throw badRequest('Image must be a base64 data URI (data:image/...).');
            }
            if (image.length > 15_000_000) { // ~10MB image → ~13.3MB base64
                throw badRequest('Image too large. Maximum size is ~10MB.');
            }
        }
        // Verify the user's account is active
        const user = await db.queryOne('SELECT account_status FROM users WHERE id = ?', [userId]);
        if (!user)
            throw notFound('User account not found.');
        if (user.account_status !== 'active') {
            throw forbidden(`Account is ${user.account_status}. Please contact support.`);
        }
        // Resolve which assistant to use
        let resolvedAssistantId = assistantId;
        if (resolvedAssistantId) {
            // Verify ownership
            const assistant = await db.queryOne('SELECT id FROM assistants WHERE id = ? AND userId = ?', [resolvedAssistantId, userId]);
            if (!assistant)
                throw notFound('Assistant not found or access denied.');
        }
        else {
            // Auto-select the user's primary assistant
            const primary = await db.queryOne("SELECT id FROM assistants WHERE userId = ? AND is_primary = 1 AND status = 'active' LIMIT 1", [userId]);
            if (primary)
                resolvedAssistantId = primary.id;
        }
        // Resolve role from DB
        const userRole = await resolveUserRole(userId);
        console.log(`[MobileIntent] ${userId} (${userRole}): "${text.slice(0, 80)}..."`);
        // Process through AI + tools pipeline
        const result = await processMobileIntent({ text: text.trim(), conversationId, assistantId: resolvedAssistantId, language, image }, userId, userRole);
        res.json({
            success: true,
            reply: result.reply,
            tts_text: stripMarkdownForSpeech(result.reply),
            conversationId: result.conversationId,
            toolsUsed: result.toolsUsed,
            data: result.data ?? null,
        });
    }
    catch (err) {
        if (err instanceof HttpError) {
            res.status(err.status).json({ success: false, error: err.message });
        }
        else {
            console.error('[MobileIntent] Unhandled error:', err);
            res.status(500).json({ success: false, error: 'Internal server error.' });
        }
    }
});
// ============================================================================
// GET /assistants — List assistants the user can select on mobile
// ============================================================================
router.get('/assistants', requireAuth, async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId)
            throw unauthorized('Authentication required.');
        const assistants = await db.query(`SELECT id, name, description, personality, personality_flare,
              custom_greeting, voice_style, is_staff_agent, is_primary, status, tier
       FROM assistants
       WHERE userId = ? AND status = 'active'
       ORDER BY is_primary DESC, is_staff_agent DESC, created_at DESC`, [userId]);
        res.json({ success: true, assistants });
    }
    catch (err) {
        if (err instanceof HttpError) {
            res.status(err.status).json({ success: false, error: err.message });
        }
        else {
            console.error('[MobileIntent] Assistants list error:', err);
            res.status(500).json({ success: false, error: 'Internal server error.' });
        }
    }
});
// ============================================================================
// GET /conversations — List user's conversations
// ============================================================================
router.get('/conversations', requireAuth, async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId)
            throw unauthorized('Authentication required.');
        const conversations = await db.query(`SELECT c.id, c.role, c.assistant_id, c.created_at, c.updated_at,
              (SELECT content FROM mobile_messages
               WHERE conversation_id = c.id AND role = 'user'
               ORDER BY created_at ASC LIMIT 1) AS preview
       FROM mobile_conversations c
       WHERE c.user_id = ?
       ORDER BY c.updated_at DESC
       LIMIT 50`, [userId]);
        res.json({ success: true, conversations });
    }
    catch (err) {
        if (err instanceof HttpError) {
            res.status(err.status).json({ success: false, error: err.message });
        }
        else {
            console.error('[MobileIntent] Conversations list error:', err);
            res.status(500).json({ success: false, error: 'Internal server error.' });
        }
    }
});
// ============================================================================
// GET /conversations/:id/messages — Conversation history
// ============================================================================
router.get('/conversations/:id/messages', requireAuth, async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId)
            throw unauthorized('Authentication required.');
        const conversationId = req.params.id;
        // Verify ownership
        const conv = await db.queryOne('SELECT id FROM mobile_conversations WHERE id = ? AND user_id = ?', [conversationId, userId]);
        if (!conv)
            throw notFound('Conversation not found.');
        const messages = await db.query(`SELECT id, role, content, tool_name, created_at
       FROM mobile_messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC`, [conversationId]);
        res.json({ success: true, messages });
    }
    catch (err) {
        if (err instanceof HttpError) {
            res.status(err.status).json({ success: false, error: err.message });
        }
        else {
            console.error('[MobileIntent] Messages list error:', err);
            res.status(500).json({ success: false, error: 'Internal server error.' });
        }
    }
});
// ============================================================================
// DELETE /conversations/:id — Delete a conversation
// ============================================================================
router.delete('/conversations/:id', requireAuth, async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId)
            throw unauthorized('Authentication required.');
        const conversationId = req.params.id;
        // Verify ownership
        const conv = await db.queryOne('SELECT id FROM mobile_conversations WHERE id = ? AND user_id = ?', [conversationId, userId]);
        if (!conv)
            throw notFound('Conversation not found.');
        // Delete messages first, then conversation
        await db.execute('DELETE FROM mobile_messages WHERE conversation_id = ?', [conversationId]);
        await db.execute('DELETE FROM mobile_conversations WHERE id = ?', [conversationId]);
        res.json({ success: true, message: 'Conversation deleted.' });
    }
    catch (err) {
        if (err instanceof HttpError) {
            res.status(err.status).json({ success: false, error: err.message });
        }
        else {
            console.error('[MobileIntent] Conversation delete error:', err);
            res.status(500).json({ success: false, error: 'Internal server error.' });
        }
    }
});
// ============================================================================
// POST /tts — Text-to-Speech via OpenAI API
// ============================================================================
router.post('/tts', requireAuth, async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId)
            throw unauthorized('Authentication required.');
        const { text, voice } = req.body;
        if (!text || typeof text !== 'string' || !text.trim()) {
            throw badRequest('"text" is required.');
        }
        // Strip markdown formatting so TTS doesn't read asterisks, hashes, etc.
        // Then cap at ~4000 chars (OpenAI tts-1 limit is 4096)
        const cleanText = stripMarkdownForSpeech(text).slice(0, 4000).trim();
        // Use OpenAI key from vault (decrypted), fall back to env
        const apiKey = await getSecret('OpenAI', env.OPENAI || env.OPENAI_API_KEY);
        if (!apiKey) {
            throw badRequest('TTS service not configured.');
        }
        // Allowed voices: alloy, echo, fable, onyx, nova, shimmer
        const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
        const selectedVoice = validVoices.includes(voice || '') ? voice : 'nova';
        const openaiRes = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'tts-1',
                input: cleanText,
                voice: selectedVoice,
                response_format: 'mp3',
                speed: 1.0,
            }),
        });
        if (!openaiRes.ok) {
            const errText = await openaiRes.text().catch(() => 'Unknown error');
            console.error(`[TTS] OpenAI error ${openaiRes.status}:`, errText);
            res.status(502).json({ success: false, error: 'TTS generation failed.' });
            return;
        }
        // Stream audio back to client
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'no-cache');
        // Pipe the readable stream from OpenAI response to Express response
        const reader = openaiRes.body;
        if (reader && typeof reader.pipe === 'function') {
            reader.pipe(res);
        }
        else if (reader && typeof reader.getReader === 'function') {
            // Web ReadableStream (Node 18+)
            const webReader = reader.getReader();
            const pump = async () => {
                while (true) {
                    const { done, value } = await webReader.read();
                    if (done) {
                        res.end();
                        return;
                    }
                    res.write(value);
                }
            };
            pump().catch(err => {
                console.error('[TTS] Stream error:', err);
                if (!res.headersSent)
                    res.status(500).end();
                else
                    res.end();
            });
        }
        else {
            // Fallback: arrayBuffer
            const buf = Buffer.from(await openaiRes.arrayBuffer());
            res.send(buf);
        }
    }
    catch (err) {
        if (err instanceof HttpError) {
            res.status(err.status).json({ success: false, error: err.message });
        }
        else {
            console.error('[TTS] Error:', err);
            res.status(500).json({ success: false, error: 'Internal server error.' });
        }
    }
});
export default router;
