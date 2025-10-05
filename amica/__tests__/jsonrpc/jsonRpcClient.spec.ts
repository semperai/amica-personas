import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AmicaJsonRpcClient } from '@/features/jsonrpc/jsonRpcClient';

// Mock WebSocket
class MockWebSocket {
  readyState = 1; // OPEN
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  send = vi.fn();
  close = vi.fn();

  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  triggerOpen() {
    if (this.onopen) {
      this.onopen(new Event('open'));
    }
  }

  triggerMessage(data: string) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data }));
    }
  }

  triggerError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }

  triggerClose() {
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }
}

describe('AmicaJsonRpcClient', () => {
  let mockWebSocket: MockWebSocket;
  let WebSocketConstructor: any;

  beforeEach(() => {
    vi.useFakeTimers();

    // Mock global WebSocket
    mockWebSocket = new MockWebSocket();
    WebSocketConstructor = vi.fn(() => mockWebSocket);
    // Set static constants
    WebSocketConstructor.CONNECTING = 0;
    WebSocketConstructor.OPEN = 1;
    WebSocketConstructor.CLOSING = 2;
    WebSocketConstructor.CLOSED = 3;
    (global as any).WebSocket = WebSocketConstructor;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create client with default websocket transport', () => {
      const client = new AmicaJsonRpcClient();

      expect(WebSocketConstructor).toHaveBeenCalledWith('ws://localhost:8765/amica/jsonrpc');
    });

    it('should create client with custom URL', () => {
      const customUrl = 'ws://example.com:9000/rpc';
      const client = new AmicaJsonRpcClient(customUrl);

      expect(WebSocketConstructor).toHaveBeenCalledWith(customUrl);
    });

    it('should not connect websocket when using http transport', () => {
      const client = new AmicaJsonRpcClient('http://localhost:8000', 'http');

      expect(WebSocketConstructor).not.toHaveBeenCalled();
    });
  });

  describe('WebSocket connection', () => {
    it('should handle onopen event', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const client = new AmicaJsonRpcClient();
      mockWebSocket.triggerOpen();

      expect(consoleLogSpy).toHaveBeenCalledWith('[AmicaClient] Connected to Amica JSON-RPC server');

      consoleLogSpy.mockRestore();
    });

    it('should handle onerror event', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const client = new AmicaJsonRpcClient();
      mockWebSocket.triggerError();

      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should attempt reconnect on close', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const client = new AmicaJsonRpcClient();
      const initialCallCount = WebSocketConstructor.mock.calls.length;

      mockWebSocket.triggerClose();

      expect(consoleLogSpy).toHaveBeenCalledWith('[AmicaClient] Disconnected from server');

      // Fast-forward 5 seconds to trigger reconnect
      vi.advanceTimersByTime(5000);

      expect(WebSocketConstructor.mock.calls.length).toBe(initialCallCount + 1);

      consoleLogSpy.mockRestore();
    });
  });

  describe('handleResponse', () => {
    it('should handle notification (id is null)', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const client = new AmicaJsonRpcClient();
      const notification = {
        jsonrpc: '2.0',
        method: 'notification',
        params: {},
        id: null,
      };

      mockWebSocket.triggerMessage(JSON.stringify(notification));

      expect(consoleLogSpy).toHaveBeenCalledWith('[AmicaClient] Received notification:', notification);

      consoleLogSpy.mockRestore();
    });

    it('should warn on response for unknown request', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const client = new AmicaJsonRpcClient();
      const response = {
        jsonrpc: '2.0',
        id: 999,
        result: {},
      };

      mockWebSocket.triggerMessage(JSON.stringify(response));

      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should handle parse errors', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const client = new AmicaJsonRpcClient();

      mockWebSocket.triggerMessage('invalid json');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[AmicaClient] Failed to parse response:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('call method', () => {
    it('should send request via websocket', async () => {
      const client = new AmicaJsonRpcClient();

      const callPromise = client.call('system.ping');

      expect(mockWebSocket.send).toHaveBeenCalled();
      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.method).toBe('system.ping');
      expect(sentData.jsonrpc).toBe('2.0');
      expect(sentData.id).toBe(1);

      // Simulate response
      mockWebSocket.triggerMessage(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { status: 'ok' },
      }));

      const result = await callPromise;
      expect(result).toEqual({ status: 'ok' });
    });

    it('should reject on websocket not connected', async () => {
      const client = new AmicaJsonRpcClient();
      mockWebSocket.readyState = MockWebSocket.CLOSED;

      await expect(client.call('system.ping')).rejects.toThrow('WebSocket not connected');
    });

    it('should handle error responses', async () => {
      const client = new AmicaJsonRpcClient();

      const callPromise = client.call('system.ping');

      // Simulate error response
      mockWebSocket.triggerMessage(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32600, message: 'Invalid Request' },
      }));

      await expect(callPromise).rejects.toThrow('Invalid Request (code: -32600)');
    });

    it('should timeout after default timeout', async () => {
      const client = new AmicaJsonRpcClient();

      const callPromise = client.call('system.ping');

      // Fast-forward past default timeout (30000ms)
      vi.advanceTimersByTime(30001);

      await expect(callPromise).rejects.toThrow('Request timed out after 30000ms');
    });

    it('should respect custom timeout', async () => {
      const client = new AmicaJsonRpcClient();

      const callPromise = client.call('system.ping', undefined, 5000);

      // Fast-forward past custom timeout
      vi.advanceTimersByTime(5001);

      await expect(callPromise).rejects.toThrow('Request timed out after 5000ms');
    });
  });

  describe('call method - HTTP transport', () => {
    it('should send request via HTTP', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({
          jsonrpc: '2.0',
          id: 1,
          result: { status: 'ok' },
        }),
      });
      (global as any).fetch = mockFetch;

      const client = new AmicaJsonRpcClient('http://localhost:8000', 'http');

      const result = await client.call('system.ping');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
      expect(result).toEqual({ status: 'ok' });
    });

    it('should handle HTTP errors', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32601, message: 'Method not found' },
        }),
      });
      (global as any).fetch = mockFetch;

      const client = new AmicaJsonRpcClient('http://localhost:8000', 'http');

      await expect(client.call('invalid.method')).rejects.toThrow('Method not found (code: -32601)');
    });
  });

  describe('notify method', () => {
    it('should send notification via websocket', () => {
      const client = new AmicaJsonRpcClient();

      client.notify('chat.sendMessage', { message: 'Hello' });

      expect(mockWebSocket.send).toHaveBeenCalled();
      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.method).toBe('chat.sendMessage');
      expect(sentData.params).toEqual({ message: 'Hello' });
      expect(sentData.id).toBeUndefined();
    });

    it('should not send notification when websocket not open', () => {
      const client = new AmicaJsonRpcClient();
      mockWebSocket.readyState = MockWebSocket.CLOSED;

      client.notify('chat.sendMessage', { message: 'Hello' });

      expect(mockWebSocket.send).not.toHaveBeenCalled();
    });

    it('should warn when using notify over HTTP', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const client = new AmicaJsonRpcClient('http://localhost:8000', 'http');

      client.notify('chat.sendMessage', { message: 'Hello' });

      expect(consoleWarnSpy).toHaveBeenCalledWith('[AmicaClient] Notifications not supported over HTTP');

      consoleWarnSpy.mockRestore();
    });
  });

  describe('close method', () => {
    it('should close websocket connection', () => {
      const client = new AmicaJsonRpcClient();

      client.close();

      expect(mockWebSocket.close).toHaveBeenCalled();
    });

    it('should reject all pending requests', async () => {
      const client = new AmicaJsonRpcClient();

      const promise1 = client.call('system.ping');
      const promise2 = client.call('system.getVersion');

      client.close();

      await expect(promise1).rejects.toThrow('Connection closed');
      await expect(promise2).rejects.toThrow('Connection closed');
    });
  });

  describe('convenience methods', () => {
    it('should call sendMessage', async () => {
      const client = new AmicaJsonRpcClient();

      const callPromise = client.sendMessage('Hello');

      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.method).toBe('chat.sendMessage');
      expect(sentData.params).toEqual({ message: 'Hello' });

      mockWebSocket.triggerMessage(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true },
      }));

      await callPromise;
    });

    it('should call interrupt', async () => {
      const client = new AmicaJsonRpcClient();

      const callPromise = client.interrupt();

      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.method).toBe('chat.interrupt');

      mockWebSocket.triggerMessage(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true },
      }));

      await callPromise;
    });

    it('should call setEmotion', async () => {
      const client = new AmicaJsonRpcClient();

      const callPromise = client.setEmotion('happy', 0.8, 5000);

      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.method).toBe('character.setEmotion');
      expect(sentData.params).toEqual({ emotion: 'happy', intensity: 0.8, duration: 5000 });

      mockWebSocket.triggerMessage(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true },
      }));

      await callPromise;
    });

    it('should call speak', async () => {
      const client = new AmicaJsonRpcClient();

      const callPromise = client.speak('Hello world', 'excited');

      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.method).toBe('character.speak');
      expect(sentData.params).toEqual({ text: 'Hello world', emotion: 'excited' });

      mockWebSocket.triggerMessage(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true },
      }));

      await callPromise;
    });

    it('should call getConfig', async () => {
      const client = new AmicaJsonRpcClient();

      const callPromise = client.getConfig('chatbot_backend');

      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.method).toBe('config.get');
      expect(sentData.params).toEqual({ key: 'chatbot_backend' });

      mockWebSocket.triggerMessage(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { value: 'echo' },
      }));

      await callPromise;
    });

    it('should call ping', async () => {
      const client = new AmicaJsonRpcClient();

      const callPromise = client.ping();

      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.method).toBe('system.ping');

      mockWebSocket.triggerMessage(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { status: 'ok' },
      }));

      const result = await callPromise;
      expect(result).toEqual({ status: 'ok' });
    });

    it('should call batch', async () => {
      const client = new AmicaJsonRpcClient();

      const requests = [
        {
          jsonrpc: '2.0' as const,
          method: 'system.ping' as const,
          id: 100,
        },
      ];

      const callPromise = client.batch(requests, true);

      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.method).toBe('system.batch');
      expect(sentData.params).toEqual({ actions: requests, sequential: true });

      mockWebSocket.triggerMessage(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { results: [{ success: true }] },
      }));

      await callPromise;
    });
  });

  describe('multiple concurrent requests', () => {
    it('should handle multiple requests with different IDs', async () => {
      const client = new AmicaJsonRpcClient();

      const promise1 = client.call('system.ping');
      const promise2 = client.call('system.getVersion');

      // Check that different IDs were used
      const call1 = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      const call2 = JSON.parse(mockWebSocket.send.mock.calls[1][0]);

      expect(call1.id).toBe(1);
      expect(call2.id).toBe(2);

      // Respond to second request first
      mockWebSocket.triggerMessage(JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        result: { version: '1.0.0' },
      }));

      // Then respond to first request
      mockWebSocket.triggerMessage(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { status: 'ok' },
      }));

      const result1 = await promise1;
      const result2 = await promise2;

      expect(result1).toEqual({ status: 'ok' });
      expect(result2).toEqual({ version: '1.0.0' });
    });
  });

  describe('additional convenience methods', () => {
    let client: AmicaJsonRpcClient;

    beforeEach(() => {
      client = new AmicaJsonRpcClient();
    });

    it('should call getChatState', async () => {
      const callPromise = client.getChatState();

      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.method).toBe('chat.getState');

      mockWebSocket.triggerMessage(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { state: 'idle' },
      }));

      await callPromise;
    });

    it('should call isAwake', async () => {
      const callPromise = client.isAwake();

      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.method).toBe('chat.isAwake');

      mockWebSocket.triggerMessage(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { awake: true },
      }));

      await callPromise;
    });

    it('should call sendAudio', async () => {
      const callPromise = client.sendAudio('base64audio', true, 'wav');

      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.method).toBe('audio.send');
      expect(sentData.params).toEqual({ audio: 'base64audio', transcribe: true, format: 'wav' });

      mockWebSocket.triggerMessage(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true },
      }));

      await callPromise;
    });

    it('should call transcribeAudio', async () => {
      const callPromise = client.transcribeAudio('base64audio', 'mp3');

      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.method).toBe('audio.transcribe');
      expect(sentData.params).toEqual({ audio: 'base64audio', format: 'mp3' });

      mockWebSocket.triggerMessage(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { transcription: 'hello' },
      }));

      await callPromise;
    });

    it('should call setExpression', async () => {
      const callPromise = client.setExpression('happy');

      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.method).toBe('character.setExpression');
      expect(sentData.params).toEqual({ expression: 'happy' });

      mockWebSocket.triggerMessage(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true },
      }));

      await callPromise;
    });

    it('should call stopSpeaking', async () => {
      const callPromise = client.stopSpeaking();

      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.method).toBe('character.stopSpeaking');

      mockWebSocket.triggerMessage(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true },
      }));

      await callPromise;
    });

    it('should call playAnimation', async () => {
      const callPromise = client.playAnimation('http://example.com/anim.glb', true);

      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.method).toBe('character.playAnimation');
      expect(sentData.params).toEqual({ animationUrl: 'http://example.com/anim.glb', loop: true });

      mockWebSocket.triggerMessage(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true },
      }));

      await callPromise;
    });

    it('should call lookAt', async () => {
      const callPromise = client.lookAt({ x: 1, y: 2, z: 3 });

      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.method).toBe('character.lookAt');
      expect(sentData.params).toEqual({ target: { x: 1, y: 2, z: 3 } });

      mockWebSocket.triggerMessage(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true },
      }));

      await callPromise;
    });

    it('should call setAutoLookAt', async () => {
      const callPromise = client.setAutoLookAt(true);

      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.method).toBe('character.setAutoLookAt');
      expect(sentData.params).toEqual({ enabled: true });

      mockWebSocket.triggerMessage(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true },
      }));

      await callPromise;
    });

    it('should call setAutoBlink', async () => {
      const callPromise = client.setAutoBlink(false);

      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.method).toBe('character.setAutoBlink');
      expect(sentData.params).toEqual({ enabled: false });

      mockWebSocket.triggerMessage(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true },
      }));

      await callPromise;
    });

    it('should call processImage', async () => {
      const callPromise = client.processImage('base64image');

      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.method).toBe('vision.processImage');
      expect(sentData.params).toEqual({ imageData: 'base64image' });

      mockWebSocket.triggerMessage(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { description: 'A cat' },
      }));

      await callPromise;
    });

    it('should call captureScreenshot', async () => {
      const callPromise = client.captureScreenshot();

      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.method).toBe('vision.captureScreenshot');

      mockWebSocket.triggerMessage(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { imageData: 'base64' },
      }));

      await callPromise;
    });

    it('should call registerHook', async () => {
      const callPromise = client.registerHook('before:user:message:receive', { priority: 10 });

      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.method).toBe('hooks.register');
      expect(sentData.params.event).toBe('before:user:message:receive');
      expect(sentData.params.priority).toBe(10);

      mockWebSocket.triggerMessage(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { hookId: 'hook123' },
      }));

      await callPromise;
    });

    it('should call unregisterHook', async () => {
      const callPromise = client.unregisterHook('hook123');

      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.method).toBe('hooks.unregister');
      expect(sentData.params).toEqual({ hookId: 'hook123' });

      mockWebSocket.triggerMessage(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true },
      }));

      await callPromise;
    });

    it('should call listHooks', async () => {
      const callPromise = client.listHooks('before:user:message:receive');

      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.method).toBe('hooks.list');

      mockWebSocket.triggerMessage(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { hooks: [] },
      }));

      await callPromise;
    });

    it('should call getHookMetrics', async () => {
      const callPromise = client.getHookMetrics('hook123');

      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.method).toBe('hooks.getMetrics');

      mockWebSocket.triggerMessage(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { metrics: {} },
      }));

      await callPromise;
    });

    it('should call setConfig', async () => {
      const callPromise = client.setConfig('key', 'value');

      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.method).toBe('config.set');
      expect(sentData.params).toEqual({ key: 'key', value: 'value' });

      mockWebSocket.triggerMessage(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true },
      }));

      await callPromise;
    });

    it('should call getAllConfig', async () => {
      const callPromise = client.getAllConfig();

      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.method).toBe('config.getAll');

      mockWebSocket.triggerMessage(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { config: {} },
      }));

      await callPromise;
    });

    it('should call loadScenario', async () => {
      const callPromise = client.loadScenario('http://example.com/scenario.json');

      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.method).toBe('scenario.load');
      expect(sentData.params).toEqual({ scenarioUrl: 'http://example.com/scenario.json' });

      mockWebSocket.triggerMessage(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true },
      }));

      await callPromise;
    });

    it('should call unloadScenario', async () => {
      const callPromise = client.unloadScenario();

      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.method).toBe('scenario.unload');

      mockWebSocket.triggerMessage(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true },
      }));

      await callPromise;
    });

    it('should call getScenarioState', async () => {
      const callPromise = client.getScenarioState();

      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.method).toBe('scenario.getState');

      mockWebSocket.triggerMessage(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { state: 'loaded' },
      }));

      await callPromise;
    });

    it('should call getVersion', async () => {
      const callPromise = client.getVersion();

      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.method).toBe('system.getVersion');

      mockWebSocket.triggerMessage(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { version: '1.0.0' },
      }));

      await callPromise;
    });

    it('should call getCapabilities', async () => {
      const callPromise = client.getCapabilities();

      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.method).toBe('system.getCapabilities');

      mockWebSocket.triggerMessage(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { capabilities: [] },
      }));

      await callPromise;
    });
  });
});
