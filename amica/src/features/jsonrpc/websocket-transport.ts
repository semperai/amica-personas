/**
 * WebSocket Transport for JSON-RPC
 *
 * Enables real-time bidirectional communication between Amica and external services
 */

import { JsonRpcServer } from './server';
import { JsonRpcRequest, JsonRpcNotification, JsonRpcResponse } from './protocol';
import { HookEvent } from '@/features/hooks/hookEvents';

export interface WebSocketTransportConfig {
  port?: number;
  path?: string;
  maxConnections?: number;
  heartbeatInterval?: number;
}

interface ClientConnection {
  ws: WebSocket;
  subscriptions: Set<HookEvent>;
}

export class WebSocketTransport {
  private server: JsonRpcServer;
  private connections: Map<WebSocket, ClientConnection> = new Map();
  private config: Required<WebSocketTransportConfig>;

  constructor(server: JsonRpcServer, config: WebSocketTransportConfig = {}) {
    this.server = server;
    this.config = {
      port: config.port ?? 8765,
      path: config.path ?? '/amica/jsonrpc',
      maxConnections: config.maxConnections ?? 100,
      heartbeatInterval: config.heartbeatInterval ?? 30000,
    };
  }

  /**
   * Handle incoming WebSocket connection
   */
  public handleConnection(ws: WebSocket): void {
    if (this.connections.size >= this.config.maxConnections) {
      console.warn('[WebSocketTransport] Max connections reached, rejecting new connection');
      ws.close(1008, 'Server at capacity');
      return;
    }

    console.log('[WebSocketTransport] New connection established');

    const client: ClientConnection = {
      ws,
      subscriptions: new Set(),
    };
    this.connections.set(ws, client);

    // Make subscription methods available to server
    this.server.setTransport(this);

    // Set up heartbeat
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ jsonrpc: '2.0', method: 'heartbeat' }));
      }
    }, this.config.heartbeatInterval);

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        await this.handleMessage(ws, data);
      } catch (error: any) {
        console.error('[WebSocketTransport] Failed to parse message:', error);
        this.sendError(ws, null, -32700, 'Parse error');
      }
    };

    ws.onclose = () => {
      console.log('[WebSocketTransport] Connection closed');
      clearInterval(heartbeat);
      this.connections.delete(ws);
    };

    ws.onerror = (error) => {
      console.error('[WebSocketTransport] WebSocket error:', error);
    };

    // Send welcome message
    this.send(ws, {
      jsonrpc: '2.0',
      method: 'connected',
      params: {
        server: 'Amica JSON-RPC',
        version: '2.0',
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(ws: WebSocket, data: any): Promise<void> {
    // Set current WebSocket for subscription operations
    this.server.setCurrentWebSocket(ws);

    try {
      // Handle batch requests
      if (Array.isArray(data)) {
        const responses = await this.server.handleBatch(data);
        this.send(ws, responses);
        return;
      }

      // Handle single request or notification
      if (data.id === undefined || data.id === null) {
        // This is a notification (no response expected)
        await this.server.handleNotification(data as JsonRpcNotification);
      } else {
        // This is a request (response expected)
        const response = await this.server.handleRequest(data as JsonRpcRequest);
        this.send(ws, response);
      }
    } finally {
      // Clear current WebSocket
      this.server.setCurrentWebSocket(undefined as any);
    }
  }

  /**
   * Send a message to a client
   */
  private send(ws: WebSocket, data: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  /**
   * Send an error response
   */
  private sendError(
    ws: WebSocket,
    id: string | number | null,
    code: number,
    message: string
  ): void {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      error: { code, message },
      id,
    };
    this.send(ws, response);
  }

  /**
   * Broadcast a notification to all connected clients
   */
  public broadcast(notification: JsonRpcNotification): void {
    const message = JSON.stringify(notification);
    this.connections.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    });
  }

  /**
   * Broadcast an event to subscribed clients only
   */
  public broadcastEvent(event: HookEvent, data: any): void {
    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method: `event:${event}`,
      params: data,
    };

    const message = JSON.stringify(notification);

    this.connections.forEach((client) => {
      if (client.subscriptions.has(event) && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    });
  }

  /**
   * Subscribe a client to events
   */
  public subscribe(ws: WebSocket, events: HookEvent[]): HookEvent[] {
    const client = this.connections.get(ws);
    if (!client) {
      return [];
    }

    events.forEach((event) => client.subscriptions.add(event));
    return events;
  }

  /**
   * Unsubscribe a client from events
   */
  public unsubscribe(ws: WebSocket, events: HookEvent[]): HookEvent[] {
    const client = this.connections.get(ws);
    if (!client) {
      return [];
    }

    events.forEach((event) => client.subscriptions.delete(event));
    return events;
  }

  /**
   * Get client subscriptions
   */
  public getSubscriptions(ws: WebSocket): HookEvent[] {
    const client = this.connections.get(ws);
    if (!client) {
      return [];
    }

    return Array.from(client.subscriptions);
  }

  /**
   * Close all connections
   */
  public closeAll(): void {
    this.connections.forEach((client) => {
      client.ws.close(1000, 'Server shutting down');
    });
    this.connections.clear();
  }

  /**
   * Get connection count
   */
  public getConnectionCount(): number {
    return this.connections.size;
  }
}
