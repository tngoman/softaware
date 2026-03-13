import { Router } from 'express';
import { sseSessionManager } from '../mcp/sse-transport.js';
import { connectCodeAgentToSSE, removeCodeAgentServer, getToolDefinitions } from '../mcp/code-agent.js';
import { requireAuth, getAuth } from '../middleware/auth.js';
export const mcpRouter = Router();
const sessionData = new Map();
/**
 * Create a new MCP session
 * Returns session ID and tool definitions for the client LLM
 */
mcpRouter.post('/session', requireAuth, async (req, res) => {
    try {
        const { userId } = getAuth(req);
        // Create SSE transport
        const transport = sseSessionManager.createSession();
        const sessionId = transport.id;
        // Store session data
        sessionData.set(sessionId, {
            userId,
            createdAt: new Date(),
            lastActivity: new Date(),
        });
        // Connect MCP server to transport
        await connectCodeAgentToSSE(sessionId, transport);
        // Return session info and tool definitions
        res.json({
            sessionId,
            tools: getToolDefinitions(),
            sseEndpoint: `/mcp/sse/${sessionId}`,
            messageEndpoint: `/mcp/message/${sessionId}`,
            expiresIn: 3600, // 1 hour
        });
    }
    catch (err) {
        console.error('[MCP] Session creation failed:', err);
        res.status(500).json({ error: 'Failed to create session' });
    }
});
/**
 * SSE endpoint for server -> client messages
 * Client connects here to receive tool responses and notifications
 */
mcpRouter.get('/sse/:sessionId', requireAuth, (req, res) => {
    const { sessionId } = req.params;
    const { userId } = getAuth(req);
    // Verify session ownership
    const session = sessionData.get(sessionId);
    if (!session || session.userId !== userId) {
        res.status(404).json({ error: 'Session not found' });
        return;
    }
    // Get transport
    const transport = sseSessionManager.getSession(sessionId);
    if (!transport) {
        res.status(404).json({ error: 'Session not found' });
        return;
    }
    // Update activity
    session.lastActivity = new Date();
    // Set up SSE connection
    transport.setSSEResponse(res);
    // Clean up on disconnect
    req.on('close', () => {
        console.log(`[MCP] SSE disconnected: ${sessionId}`);
    });
});
/**
 * Message endpoint for client -> server messages
 * Client posts JSON-RPC messages here to invoke tools
 */
mcpRouter.post('/message/:sessionId', requireAuth, async (req, res) => {
    const { sessionId } = req.params;
    const { userId } = getAuth(req);
    // Verify session ownership
    const session = sessionData.get(sessionId);
    if (!session || session.userId !== userId) {
        res.status(404).json({ error: 'Session not found' });
        return;
    }
    // Get transport
    const transport = sseSessionManager.getSession(sessionId);
    if (!transport) {
        res.status(404).json({ error: 'Session not found' });
        return;
    }
    // Update activity
    session.lastActivity = new Date();
    try {
        const message = req.body;
        // Validate message structure
        if (!message || typeof message !== 'object') {
            res.status(400).json({ error: 'Invalid message format' });
            return;
        }
        // Forward message to MCP server
        transport.handleClientMessage(message);
        res.json({ success: true, message: 'Message received' });
    }
    catch (err) {
        console.error('[MCP] Message handling failed:', err);
        res.status(500).json({ error: 'Failed to process message' });
    }
});
/**
 * Close a session
 */
mcpRouter.delete('/session/:sessionId', requireAuth, (req, res) => {
    const { sessionId } = req.params;
    const { userId } = getAuth(req);
    // Verify session ownership
    const session = sessionData.get(sessionId);
    if (!session || session.userId !== userId) {
        res.status(404).json({ error: 'Session not found' });
        return;
    }
    // Clean up
    sseSessionManager.removeSession(sessionId);
    removeCodeAgentServer(sessionId);
    sessionData.delete(sessionId);
    res.json({ success: true, message: 'Session closed' });
});
/**
 * Get session status
 */
mcpRouter.get('/session/:sessionId', requireAuth, (req, res) => {
    const { sessionId } = req.params;
    const { userId } = getAuth(req);
    // Verify session ownership
    const session = sessionData.get(sessionId);
    if (!session || session.userId !== userId) {
        res.status(404).json({ error: 'Session not found' });
        return;
    }
    const transport = sseSessionManager.getSession(sessionId);
    res.json({
        sessionId,
        connected: !!transport,
        createdAt: session.createdAt.toISOString(),
        lastActivity: session.lastActivity.toISOString(),
    });
});
/**
 * List all sessions for the current user
 */
mcpRouter.get('/sessions', requireAuth, (req, res) => {
    const { userId } = getAuth(req);
    const userSessions = [];
    sessionData.forEach((data, sessionId) => {
        if (data.userId === userId) {
            const transport = sseSessionManager.getSession(sessionId);
            userSessions.push({
                sessionId,
                connected: !!transport,
                createdAt: data.createdAt.toISOString(),
                lastActivity: data.lastActivity.toISOString(),
            });
        }
    });
    res.json({ sessions: userSessions });
});
/**
 * Get available tools (public, no auth required)
 * Desktop apps can use this to get tool definitions for their LLM
 */
mcpRouter.get('/tools', (_req, res) => {
    res.json({ tools: getToolDefinitions() });
});
// Cleanup inactive sessions periodically (every 5 minutes)
setInterval(() => {
    const now = Date.now();
    const timeout = 60 * 60 * 1000; // 1 hour
    sessionData.forEach((data, sessionId) => {
        if (now - data.lastActivity.getTime() > timeout) {
            console.log(`[MCP] Cleaning up inactive session: ${sessionId}`);
            sseSessionManager.removeSession(sessionId);
            removeCodeAgentServer(sessionId);
            sessionData.delete(sessionId);
        }
    });
}, 5 * 60 * 1000);
