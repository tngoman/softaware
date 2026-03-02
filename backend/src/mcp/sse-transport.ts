import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { Response } from 'express';

/**
 * Transport interface for MCP (simplified version to avoid import issues)
 */
interface Transport {
  start(): Promise<void>;
  close(): Promise<void>;
  send(message: JSONRPCMessage): Promise<void>;
  onmessage?: (message: JSONRPCMessage) => void;
  onerror?: (error: Error) => void;
  onclose?: () => void;
}

/**
 * SSE (Server-Sent Events) Transport for MCP
 * 
 * Allows remote MCP clients (like a desktop app) to connect via HTTP.
 * 
 * Architecture:
 * - SSE stream (GET /mcp/sse) for server -> client messages
 * - POST /mcp/message for client -> server messages
 */
export class SSEServerTransport implements Transport {
  private sseResponse: Response | null = null;
  public sessionId: string;
  private messageQueue: JSONRPCMessage[] = [];
  private onMessageCallback: ((message: JSONRPCMessage) => void) | null = null;
  private onCloseCallback: (() => void) | null = null;
  private onErrorCallback: ((error: Error) => void) | null = null;
  private closed = false;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  get id(): string {
    return this.sessionId;
  }

  /**
   * Set the SSE response object for sending messages to the client
   */
  setSSEResponse(res: Response): void {
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
      if (msg) this.sendSSEMessage(msg);
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
  private sendSSEEvent(eventType: string, data: unknown): void {
    if (this.sseResponse && !this.sseResponse.closed) {
      this.sseResponse.write(`event: ${eventType}\n`);
      this.sseResponse.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  }

  /**
   * Send a JSON-RPC message via SSE
   */
  private sendSSEMessage(message: JSONRPCMessage): void {
    if (this.sseResponse && !this.sseResponse.closed) {
      this.sseResponse.write(`event: message\n`);
      this.sseResponse.write(`data: ${JSON.stringify(message)}\n\n`);
    } else {
      // Queue the message for when SSE is connected
      this.messageQueue.push(message);
    }
  }

  /**
   * Handle incoming message from client (via POST)
   */
  handleClientMessage(message: JSONRPCMessage): void {
    if (this.onMessageCallback) {
      this.onMessageCallback(message);
    }
  }

  // Transport interface implementation

  async start(): Promise<void> {
    // SSE transport is started when setSSEResponse is called
    console.log(`[MCP-SSE] Transport started for session ${this.sessionId}`);
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (this.closed) {
      throw new Error('Transport is closed');
    }
    this.sendSSEMessage(message);
  }

  async close(): Promise<void> {
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

  set onmessage(callback: (message: JSONRPCMessage) => void) {
    this.onMessageCallback = callback;
  }

  set onclose(callback: () => void) {
    this.onCloseCallback = callback;
  }

  set onerror(callback: (error: Error) => void) {
    this.onErrorCallback = callback;
  }
}

/**
 * Session manager for multiple SSE connections
 */
export class SSESessionManager {
  private sessions: Map<string, SSEServerTransport> = new Map();

  createSession(): SSEServerTransport {
    const sessionId = crypto.randomUUID();
    const transport = new SSEServerTransport(sessionId);
    this.sessions.set(sessionId, transport);
    return transport;
  }

  getSession(sessionId: string): SSEServerTransport | undefined {
    return this.sessions.get(sessionId);
  }

  removeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.close();
      this.sessions.delete(sessionId);
    }
  }

  getAllSessions(): Map<string, SSEServerTransport> {
    return this.sessions;
  }

  getSessionCount(): number {
    return this.sessions.size;
  }
}

export const sseSessionManager = new SSESessionManager();
