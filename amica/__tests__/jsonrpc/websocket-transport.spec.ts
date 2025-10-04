/**
 * WebSocket Transport Tests
 */

// Mock dependencies BEFORE importing anything
vi.mock('@/features/chat/chat');
vi.mock('@/features/scene3d/SceneCoordinator', () => ({
  SceneCoordinator: vi.fn().mockImplementation(() => ({
    isReady: true,
    vrm: {
      getModel: vi.fn(() => null),
      loadVrm: vi.fn(),
      unloadVRM: vi.fn(),
    },
    environment: {
      getRoom: vi.fn(() => null),
      loadRoom: vi.fn(),
      unloadRoom: vi.fn(),
      loadSplat: vi.fn(),
    },
    render: {
      resetCamera: vi.fn(),
    },
  })),
}));
vi.mock('@/features/hooks/hookManager');

import { WebSocketTransport } from '@/features/jsonrpc/websocket-transport';
import { JsonRpcServer } from '@/features/jsonrpc/server';
import { Chat } from '@/features/chat/chat';
import { SceneCoordinator } from '@/features/scene3d/SceneCoordinator';
import { HookManager } from '@/features/hooks/hookManager';
import { HookEvent } from '@/features/hooks/hookEvents';

// Mock WebSocket
class MockWebSocket {
  public readyState: number = 1; // OPEN
  public onmessage: ((event: any) => void) | null = null;
  public onclose: (() => void) | null = null;
  public onerror: ((error: any) => void) | null = null;
  public sentMessages: string[] = [];

  static OPEN = 1;
  static CLOSED = 3;

  send(data: string) {
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose();
    }
  }

  // Test helper to simulate receiving a message
  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) });
    }
  }

  // Test helper to simulate an error
  simulateError(error: any) {
    if (this.onerror) {
      this.onerror(error);
    }
  }
}

// Replace global WebSocket with our mock
(global as any).WebSocket = MockWebSocket;

describe('WebSocketTransport', () => {
  let transport: WebSocketTransport;
  let server: JsonRpcServer;
  let mockChat: MockedObject<Chat>;
  let mockSceneCoordinator: MockedObject<SceneCoordinator>;
  let mockHookManager: MockedObject<HookManager>;
  let ws: MockWebSocket;

  beforeEach(() => {
    mockChat = new Chat() as MockedObject<Chat>;
    mockSceneCoordinator = new SceneCoordinator() as MockedObject<SceneCoordinator>;
    mockHookManager = new HookManager() as MockedObject<HookManager>;

    mockSceneCoordinator.isReady = true;
    const mockModel = null;
    mockSceneCoordinator.room = null;

    server = new JsonRpcServer(mockChat, mockSceneCoordinator, mockHookManager);
    transport = new WebSocketTransport(server, {
      port: 8765,
      path: '/test',
      maxConnections: 10,
      heartbeatInterval: 30000,
    });

    ws = new MockWebSocket();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Connection Management', () => {
    it('should accept new connections', () => {
      transport.handleConnection(ws as any);

      expect(transport.getConnectionCount()).toBe(1);
      expect(ws.sentMessages.length).toBeGreaterThan(0);

      // Check welcome message
      const welcomeMsg = JSON.parse(ws.sentMessages[0]);
      expect(welcomeMsg.method).toBe('connected');
      expect(welcomeMsg.params.server).toBe('Amica JSON-RPC');
    });

    it('should reject connections when at capacity', () => {
      const maxConnections = 10;
      const connections: MockWebSocket[] = [];

      // Fill to capacity
      for (let i = 0; i < maxConnections; i++) {
        const ws = new MockWebSocket();
        transport.handleConnection(ws as any);
        connections.push(ws);
      }

      expect(transport.getConnectionCount()).toBe(maxConnections);

      // Try to exceed capacity
      const rejectedWs = new MockWebSocket();
      transport.handleConnection(rejectedWs as any);

      expect(rejectedWs.readyState).toBe(MockWebSocket.CLOSED);
      expect(transport.getConnectionCount()).toBe(maxConnections);
    });

    it('should remove connection on close', () => {
      transport.handleConnection(ws as any);
      expect(transport.getConnectionCount()).toBe(1);

      ws.close();

      expect(transport.getConnectionCount()).toBe(0);
    });

    it('should handle connection errors', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation();

      transport.handleConnection(ws as any);
      ws.simulateError(new Error('Connection error'));

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Message Handling', () => {
    beforeEach(() => {
      transport.handleConnection(ws as any);
      ws.sentMessages = []; // Clear welcome message
    });

    it('should handle JSON-RPC requests', async () => {
      ws.simulateMessage({
        jsonrpc: '2.0',
        method: 'system.ping',
        id: 1,
      });

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(ws.sentMessages.length).toBeGreaterThan(0);
      const response = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]);
      expect(response.result.pong).toBe(true);
      expect(response.id).toBe(1);
    });

    it('should handle JSON-RPC notifications', async () => {
      ws.simulateMessage({
        jsonrpc: '2.0',
        method: 'system.ping',
        // No id = notification
      });

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Notifications don't send responses
      expect(ws.sentMessages.length).toBe(0);
    });

    it('should handle batch requests', async () => {
      ws.simulateMessage([
        {
          jsonrpc: '2.0',
          method: 'system.ping',
          id: 1,
        },
        {
          jsonrpc: '2.0',
          method: 'system.ping',
          id: 2,
        },
      ]);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      const response = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]);
      expect(Array.isArray(response)).toBe(true);
      expect(response).toHaveLength(2);
    });

    it('should handle parse errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation();

      // Simulate invalid JSON
      if (ws.onmessage) {
        ws.onmessage({ data: 'invalid json{' });
      }

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(ws.sentMessages.length).toBeGreaterThan(0);
      const response = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]);
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32700); // Parse error

      consoleSpy.mockRestore();
    });
  });

  describe('Event Subscriptions', () => {
    beforeEach(() => {
      transport.handleConnection(ws as any);
      ws.sentMessages = []; // Clear welcome message
    });

    it('should subscribe to events', () => {
      const events: HookEvent[] = ['before:llm:request', 'after:llm:complete'];
      const subscribed = transport.subscribe(ws as any, events);

      expect(subscribed).toEqual(events);
      expect(transport.getSubscriptions(ws as any)).toEqual(events);
    });

    it('should unsubscribe from events', () => {
      const events: HookEvent[] = ['before:llm:request', 'after:llm:complete'];
      transport.subscribe(ws as any, events);

      const unsubscribed = transport.unsubscribe(ws as any, ['before:llm:request']);

      expect(unsubscribed).toEqual(['before:llm:request']);
      expect(transport.getSubscriptions(ws as any)).toEqual(['after:llm:complete']);
    });

    it('should broadcast events to subscribed clients only', () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();

      transport.handleConnection(ws1 as any);
      transport.handleConnection(ws2 as any);

      // ws1 subscribes to event
      transport.subscribe(ws1 as any, ['before:llm:request']);

      // ws2 doesn't subscribe
      ws1.sentMessages = [];
      ws2.sentMessages = [];

      // Broadcast event
      transport.broadcastEvent('before:llm:request', { test: 'data' });

      // Only ws1 should receive the event
      expect(ws1.sentMessages.length).toBe(1);
      expect(ws2.sentMessages.length).toBe(0);

      const eventMsg = JSON.parse(ws1.sentMessages[0]);
      expect(eventMsg.method).toBe('event:before:llm:request');
      expect(eventMsg.params.test).toBe('data');
    });

    it('should not send events to unsubscribed clients', () => {
      transport.subscribe(ws as any, ['before:llm:request']);
      ws.sentMessages = [];

      // Broadcast different event
      transport.broadcastEvent('after:llm:complete', { test: 'data' });

      expect(ws.sentMessages.length).toBe(0);
    });

    it('should handle subscriptions for disconnected clients', () => {
      const subscribed = transport.subscribe(new MockWebSocket() as any, [
        'before:llm:request',
      ]);

      // Should return empty array for unknown connection
      expect(subscribed).toEqual([]);
    });
  });

  describe('Broadcasting', () => {
    it('should broadcast to all connected clients', () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();

      transport.handleConnection(ws1 as any);
      transport.handleConnection(ws2 as any);

      ws1.sentMessages = [];
      ws2.sentMessages = [];

      transport.broadcast({
        jsonrpc: '2.0',
        method: 'notification',
        params: { message: 'test' },
      });

      expect(ws1.sentMessages.length).toBe(1);
      expect(ws2.sentMessages.length).toBe(1);

      const msg1 = JSON.parse(ws1.sentMessages[0]);
      const msg2 = JSON.parse(ws2.sentMessages[0]);

      expect(msg1.method).toBe('notification');
      expect(msg2.method).toBe('notification');
    });

    it('should not send to closed connections', () => {
      transport.handleConnection(ws as any);
      ws.readyState = MockWebSocket.CLOSED;

      ws.sentMessages = [];

      transport.broadcast({
        jsonrpc: '2.0',
        method: 'notification',
      });

      expect(ws.sentMessages.length).toBe(0);
    });
  });

  describe('Heartbeat', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should send heartbeat messages', () => {
      transport.handleConnection(ws as any);
      ws.sentMessages = [];

      // Fast-forward time
      vi.advanceTimersByTime(30000);

      expect(ws.sentMessages.length).toBeGreaterThan(0);
      const heartbeat = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]);
      expect(heartbeat.method).toBe('heartbeat');
    });

    it('should stop heartbeat on connection close', () => {
      transport.handleConnection(ws as any);
      ws.sentMessages = [];

      ws.close();

      vi.advanceTimersByTime(60000);

      // Should not send heartbeat after close
      expect(ws.sentMessages.length).toBe(0);
    });
  });

  describe('Cleanup', () => {
    it('should close all connections', () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();

      transport.handleConnection(ws1 as any);
      transport.handleConnection(ws2 as any);

      expect(transport.getConnectionCount()).toBe(2);

      transport.closeAll();

      expect(ws1.readyState).toBe(MockWebSocket.CLOSED);
      expect(ws2.readyState).toBe(MockWebSocket.CLOSED);
      expect(transport.getConnectionCount()).toBe(0);
    });
  });

  describe('Integration with JsonRpcServer', () => {
    beforeEach(() => {
      transport.handleConnection(ws as any);
      ws.sentMessages = [];
    });

    it('should handle events.subscribe through server', async () => {
      ws.simulateMessage({
        jsonrpc: '2.0',
        method: 'events.subscribe',
        params: {
          events: ['before:llm:request', 'after:llm:complete'],
        },
        id: 1,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const response = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]);
      expect(response.result.subscribed).toBeDefined();
      expect(response.result.count).toBe(2);

      // Verify subscriptions are stored
      const subs = transport.getSubscriptions(ws as any);
      expect(subs).toContain('before:llm:request');
      expect(subs).toContain('after:llm:complete');
    });

    it('should handle events.unsubscribe through server', async () => {
      // First subscribe
      transport.subscribe(ws as any, ['before:llm:request', 'after:llm:complete']);

      ws.simulateMessage({
        jsonrpc: '2.0',
        method: 'events.unsubscribe',
        params: {
          events: ['before:llm:request'],
        },
        id: 1,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const response = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]);
      expect(response.result.unsubscribed).toBeDefined();

      // Verify subscription was removed
      const subs = transport.getSubscriptions(ws as any);
      expect(subs).not.toContain('before:llm:request');
      expect(subs).toContain('after:llm:complete');
    });

    it('should handle events.listSubscriptions through server', async () => {
      transport.subscribe(ws as any, ['before:llm:request']);

      ws.simulateMessage({
        jsonrpc: '2.0',
        method: 'events.listSubscriptions',
        id: 1,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const response = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]);
      expect(response.result.subscriptions).toEqual(['before:llm:request']);
    });
  });
});
