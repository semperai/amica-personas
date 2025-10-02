/**
 * JSON-RPC Server Tests
 */

// Mock dependencies BEFORE importing anything that uses them
jest.mock('@/features/chat/chat');
jest.mock('@/features/vrmViewer/viewer', () => ({
  Viewer: jest.fn().mockImplementation(() => ({
    isReady: true,
    model: null,
    room: null,
    loadVrm: jest.fn(),
    unloadVRM: jest.fn(),
    loadRoom: jest.fn(),
    unloadRoom: jest.fn(),
    resetCamera: jest.fn(),
    loadSplat: jest.fn(),
  })),
}));
jest.mock('@/features/hooks/hookManager');

import { JsonRpcServer } from '@/features/jsonrpc/server';
import { Chat } from '@/features/chat/chat';
import { Viewer } from '@/features/vrmViewer/viewer';
import { HookManager } from '@/features/hooks/hookManager';
import {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcErrorCode,
  AmicaMethod,
} from '@/features/jsonrpc/protocol';

describe('JsonRpcServer', () => {
  let server: JsonRpcServer;
  let mockChat: jest.Mocked<Chat>;
  let mockViewer: jest.Mocked<Viewer>;
  let mockHookManager: jest.Mocked<HookManager>;

  beforeEach(() => {
    mockChat = new Chat() as jest.Mocked<Chat>;
    mockViewer = new Viewer() as jest.Mocked<Viewer>;
    mockHookManager = new HookManager() as jest.Mocked<HookManager>;

    // Setup mock methods
    mockChat.sendMessage = jest.fn().mockResolvedValue(undefined);
    mockChat.interrupt = jest.fn().mockResolvedValue(0);
    mockChat.getMessageList = jest.fn().mockReturnValue([]);
    mockChat.getChatProcessing = jest.fn().mockReturnValue(false);
    mockChat.getSpeaking = jest.fn().mockReturnValue(false);

    mockViewer.isReady = true;
    mockViewer.model = null;
    mockViewer.room = null;
    mockViewer.loadVrm = jest.fn().mockResolvedValue(undefined);
    mockViewer.unloadVRM = jest.fn();
    mockViewer.loadRoom = jest.fn().mockResolvedValue(undefined);
    mockViewer.unloadRoom = jest.fn();
    mockViewer.resetCamera = jest.fn();

    mockHookManager.register = jest.fn().mockReturnValue('hook-123');
    mockHookManager.unregister = jest.fn().mockReturnValue(true);
    mockHookManager.trigger = jest.fn().mockResolvedValue({});
    mockHookManager.getHooks = jest.fn().mockReturnValue([]);

    server = new JsonRpcServer(mockChat, mockViewer, mockHookManager);
  });

  describe('Request Validation', () => {
    it('should reject invalid JSON-RPC version', async () => {
      const request: any = {
        jsonrpc: '1.0',
        method: 'system.ping',
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(JsonRpcErrorCode.InvalidRequest);
      expect(response.error?.message).toContain('Invalid JSON-RPC version');
    });

    it('should reject non-string method', async () => {
      const request: any = {
        jsonrpc: '2.0',
        method: 123,
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(JsonRpcErrorCode.InvalidRequest);
      expect(response.error?.message).toContain('Method must be a string');
    });

    it('should reject unknown method', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'unknown.method',
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(JsonRpcErrorCode.MethodNotFound);
      expect(response.error?.message).toContain('Method not found');
    });

    it('should handle valid request', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'system.ping',
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();
      expect(response.result.pong).toBe(true);
    });
  });

  describe('System Methods', () => {
    it('should handle system.ping', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'system.ping',
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result).toEqual({
        pong: true,
        timestamp: expect.any(Number),
      });
    });

    it('should handle system.getVersion', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'system.getVersion',
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result).toEqual({
        version: expect.any(String),
        build: expect.any(String),
      });
    });

    it('should handle system.getCapabilities', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'system.getCapabilities',
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result.methods).toBeDefined();
      expect(response.result.hooks).toBeDefined();
      expect(Array.isArray(response.result.methods)).toBe(true);
      expect(Array.isArray(response.result.hooks)).toBe(true);
    });
  });

  describe('Hook Management', () => {
    it('should register hook', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'hooks.register',
        params: {
          event: 'before:llm:request',
          priority: 50,
        },
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result).toEqual({
        hookId: 'hook-123',
        event: 'before:llm:request',
      });
      expect(mockHookManager.register).toHaveBeenCalled();
    });

    it('should unregister hook', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'hooks.unregister',
        params: {
          hookId: 'hook-123',
        },
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result).toEqual({
        success: true,
        hookId: 'hook-123',
      });
      expect(mockHookManager.unregister).toHaveBeenCalledWith('hook-123');
    });

    it('should trigger hook', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'hooks.trigger',
        params: {
          event: 'before:llm:request',
          data: { test: 'data' },
        },
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result.event).toBe('before:llm:request');
      expect(mockHookManager.trigger).toHaveBeenCalled();
    });

    it('should list hooks', async () => {
      mockHookManager.getHooks = jest.fn().mockReturnValue([
        { id: 'hook-1', event: 'before:llm:request', options: { priority: 100 } },
        { id: 'hook-2', event: 'after:llm:complete', options: { priority: 50 } },
      ]);

      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'hooks.list',
        params: {},
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result.hooks).toHaveLength(2);
      expect(response.result.hooks[0]).toEqual({
        hookId: 'hook-1',
        event: 'before:llm:request',
        priority: 100,
      });
    });
  });

  describe('Chat Methods', () => {
    it('should send message', async () => {
      mockChat.receiveMessageFromUser = jest.fn().mockResolvedValue(undefined);

      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'chat.sendMessage',
        params: {
          message: 'Hello!',
        },
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result.messageId).toBeDefined();
      expect(response.result.processing).toBe(true);
      expect(mockChat.receiveMessageFromUser).toHaveBeenCalledWith('Hello!');
    });

    it('should interrupt chat', async () => {
      mockChat.currentStreamIdx = 5;

      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'chat.interrupt',
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result.interrupted).toBe(true);
      expect(response.result.streamIdx).toBe(5);
      expect(mockChat.interrupt).toHaveBeenCalled();
    });

    it('should get chat state', async () => {
      mockChat.messageList = [
        { role: 'user', content: 'Hello' },
      ] as any;

      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'chat.getState',
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result.messageList).toEqual([
        { role: 'user', content: 'Hello' },
      ]);
      expect(response.result.processing).toBe(false);
      expect(response.result.speaking).toBe(false);
    });
  });

  describe('Character Methods', () => {
    beforeEach(() => {
      // Ensure model is loaded for character methods
      mockViewer.model = {
        position: { x: 0, y: 0, z: 0 },
      } as any;
    });

    it('should set expression', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'character.setExpression',
        params: {
          expression: 'happy',
        },
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result.expression).toBe('happy');
      expect(response.result.success).toBe(true);
    });

    it('should set emotion', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'character.setEmotion',
        params: {
          emotion: 'happy',
          intensity: 0.8,
          duration: 5000,
        },
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result.emotion).toBe('happy');
      expect(response.result.success).toBe(true);
    });

    it('should speak text', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'character.speak',
        params: {
          text: 'Hello world',
        },
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result.success).toBe(true);
    });
  });

  describe('Model Management', () => {
    it('should load model', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'model.load',
        params: {
          modelUrl: 'https://example.com/model.vrm',
        },
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result.success).toBe(true);
      expect(response.result.modelUrl).toBe('https://example.com/model.vrm');
      expect(mockViewer.loadVrm).toHaveBeenCalled();
    });

    it('should unload model', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'model.unload',
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result.success).toBe(true);
      expect(mockViewer.unloadVRM).toHaveBeenCalled();
    });

    it('should set model position', async () => {
      // Mock a loaded model
      mockViewer.model = {
        position: { set: jest.fn(), x: 0, y: 0, z: 0 },
      } as any;

      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'model.setPosition',
        params: {
          position: { x: 1, y: 2, z: 3 },
        },
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result.success).toBe(true);
      expect(response.result.position).toEqual({ x: 1, y: 2, z: 3 });
      expect(mockViewer.model.position.set).toHaveBeenCalledWith(1, 2, 3);
    });

    it('should reject model operations without model', async () => {
      mockViewer.model = null;

      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'model.setPosition',
        params: {
          position: { x: 1, y: 2, z: 3 },
        },
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('No model loaded');
    });

    it('should get model transform', async () => {
      mockViewer.model = {
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      } as any;

      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'model.getTransform',
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result.position).toEqual({ x: 1, y: 2, z: 3 });
      expect(response.result.rotation).toEqual({ x: 0, y: 0, z: 0 });
      expect(response.result.scale).toEqual({ x: 1, y: 1, z: 1 });
    });
  });

  describe('Room Management', () => {
    it('should load room', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'room.load',
        params: {
          roomUrl: 'https://example.com/room.glb',
          position: { x: 0, y: 0, z: 0 },
        },
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result.success).toBe(true);
      expect(response.result.roomUrl).toBe('https://example.com/room.glb');
      expect(mockViewer.loadRoom).toHaveBeenCalled();
    });

    it('should load room with default transform', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'room.load',
        params: {
          roomUrl: 'https://example.com/room.glb',
        },
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result.success).toBe(true);
      expect(mockViewer.loadRoom).toHaveBeenCalledWith(
        'https://example.com/room.glb',
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 1 },
        expect.any(Function)
      );
    });

    it('should unload room', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'room.unload',
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result.success).toBe(true);
      expect(mockViewer.unloadRoom).toHaveBeenCalled();
    });

    it('should set room transform', async () => {
      mockViewer.room = {
        position: { set: jest.fn(), x: 0, y: 0, z: 0 },
        rotation: { set: jest.fn(), x: 0, y: 0, z: 0 },
        scale: { set: jest.fn(), x: 1, y: 1, z: 1 },
      } as any;

      const posRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'room.setPosition',
        params: { position: { x: 5, y: 0, z: -3 } },
        id: 1,
      };

      const response = await server.handleRequest(posRequest);

      expect(response.result.success).toBe(true);
      expect(mockViewer.room.position.set).toHaveBeenCalledWith(5, 0, -3);
    });
  });

  describe('XR Management', () => {
    it('should handle xr.startSession', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'xr.startSession',
        params: {
          mode: 'immersive-vr',
          referenceSpaceType: 'local-floor',
        },
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result.mode).toBe('immersive-vr');
    });

    it('should handle xr.endSession', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'xr.endSession',
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result.success).toBeDefined();
    });

    it('should handle xr.setFoveation', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'xr.setFoveation',
        params: { level: 0.5 },
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result.level).toBe(0.5);
    });
  });

  describe('Viewer Management', () => {
    it('should get viewer state', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'viewer.getState',
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result.isReady).toBe(true);
      expect(response.result.hasModel).toBe(false);
      expect(response.result.hasRoom).toBe(false);
    });

    it('should reset camera', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'viewer.resetCamera',
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result.success).toBe(true);
      expect(mockViewer.resetCamera).toHaveBeenCalled();
    });
  });

  describe('Batch Requests', () => {
    it('should handle batch requests', async () => {
      const requests: JsonRpcRequest[] = [
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
      ];

      const responses = await server.handleBatch(requests);

      expect(responses).toHaveLength(2);
      expect(responses[0].result.pong).toBe(true);
      expect(responses[1].result.pong).toBe(true);
    });

    it('should handle system.batch method', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'system.batch',
        params: {
          sequential: false,
          actions: [
            {
              jsonrpc: '2.0',
              method: 'system.ping',
              id: 1,
            },
            {
              jsonrpc: '2.0',
              method: 'system.getVersion',
              id: 2,
            },
          ],
        },
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result.results).toHaveLength(2);
      expect(response.result.succeeded).toBe(2);
      expect(response.result.errors).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle handler errors gracefully', async () => {
      mockChat.receiveMessageFromUser = jest.fn().mockRejectedValue(new Error('Network error'));

      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'chat.sendMessage',
        params: { message: 'test' },
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(JsonRpcErrorCode.InternalError);
      expect(response.error?.message).toContain('Network error');
    });

    it('should handle missing viewer methods', async () => {
      mockViewer.loadVrm = undefined as any;

      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'model.load',
        params: { modelUrl: 'test.vrm' },
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('Viewer not initialized');
    });
  });

  describe('Notifications', () => {
    it('should handle notifications without returning response', async () => {
      const notification = {
        jsonrpc: '2.0',
        method: 'system.ping',
      };

      await expect(server.handleNotification(notification)).resolves.toBeUndefined();
    });

    it('should log warning for unknown notification methods', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const notification = {
        jsonrpc: '2.0',
        method: 'unknown.notification',
      };

      await server.handleNotification(notification);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown notification method')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Custom Handler Registration', () => {
    it('should allow registering custom handlers', async () => {
      const customHandler = jest.fn().mockResolvedValue({ custom: 'result' });
      server.registerHandler('custom.method' as AmicaMethod, customHandler);

      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'custom.method',
        params: { test: 'data' },
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result).toEqual({ custom: 'result' });
      expect(customHandler).toHaveBeenCalledWith(
        { test: 'data' },
        expect.any(Object)
      );
    });
  });
});
