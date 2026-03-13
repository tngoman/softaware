/**
 * SSE (Server-Sent Events) Transport for MCP
 *
 * Allows remote MCP clients (like a desktop app) to connect via HTTP.
 *
 * Architecture:
 * - SSE stream (GET /mcp/sse) for server -> client messages
 * - POST /mcp/message for client -> server messages
 */
export class SSEServerTransport {
    sseResponse = null;
    sessionId;
    messageQueue = [];
    onMessageCallback = null;
    onCloseCallback = null;
    onErrorCallback = null;
    closed = false;
    constructor(sessionId) {
        this.sessionId = sessionId;
    }
    get id() {
        return this.sessionId;
    }
    /**
     * Set the SSE response object for sending messages to the client
     */
    setSSEResponse(res) {
        this.sseResponse = res;
        // Set up SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // For nginx
        res.flushHeaders();
        // Send session info
        this.sendSSEEvent('session', { sessionId: this.sessionId });
        // Send any queued messages
        while (this.messageQueue.length > 0) {
            const msg = this.messageQueue.shift();
            if (msg)
                this.sendSSEMessage(msg);
        }
        // Handle client disconnect
        res.on('close', () => {
            this.sseResponse = null;
            if (this.onCloseCallback) {
                this.onCloseCallback();
            }
        });
    }
    /**
     * Send an SSE event with a specific event type
     */
    sendSSEEvent(eventType, data) {
        if (this.sseResponse && !this.sseResponse.closed) {
            this.sseResponse.write(`event: ${eventType}\n`);
            this.sseResponse.write(`data: ${JSON.stringify(data)}\n\n`);
        }
    }
    /**
     * Send a JSON-RPC message via SSE
     */
    sendSSEMessage(message) {
        if (this.sseResponse && !this.sseResponse.closed) {
            this.sseResponse.write(`event: message\n`);
            this.sseResponse.write(`data: ${JSON.stringify(message)}\n\n`);
        }
        else {
            // Queue the message for when SSE is connected
            this.messageQueue.push(message);
        }
    }
    /**
     * Handle incoming message from client (via POST)
     */
    handleClientMessage(message) {
        if (this.onMessageCallback) {
            this.onMessageCallback(message);
        }
    }
    // Transport interface implementation
    async start() {
        // SSE transport is started when setSSEResponse is called
        console.log(`[MCP-SSE] Transport started for session ${this.sessionId}`);
    }
    async send(message) {
        if (this.closed) {
            throw new Error('Transport is closed');
        }
        this.sendSSEMessage(message);
    }
    async close() {
        this.closed = true;
        if (this.sseResponse && !this.sseResponse.closed) {
            this.sendSSEEvent('close', { reason: 'Server closing connection' });
            this.sseResponse.end();
        }
        this.sseResponse = null;
        if (this.onCloseCallback) {
            this.onCloseCallback();
        }
    }
    set onmessage(callback) {
        this.onMessageCallback = callback;
    }
    set onclose(callback) {
        this.onCloseCallback = callback;
    }
    set onerror(callback) {
        this.onErrorCallback = callback;
    }
}
/**
 * Session manager for multiple SSE connections
 */
export class SSESessionManager {
    sessions = new Map();
    createSession() {
        const sessionId = crypto.randomUUID();
        const transport = new SSEServerTransport(sessionId);
        this.sessions.set(sessionId, transport);
        return transport;
    }
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    removeSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.close();
            this.sessions.delete(sessionId);
        }
    }
    getAllSessions() {
        return this.sessions;
    }
    getSessionCount() {
        return this.sessions.size;
    }
}
export const sseSessionManager = new SSESessionManager();
