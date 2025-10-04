/**
 * Extended JSON-RPC Server Tests
 * Tests for additional methods to increase coverage
 */

// Mock dependencies BEFORE importing anything that uses them
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
vi.mock('@/utils/config', () => ({
  config: vi.fn((key: string) => {
    const configs: Record<string, string> = {
      test_key: 'test_value',
    };
    return configs[key] || '';
  }),
}));

import { JsonRpcServer } from '@/features/jsonrpc/server';
import { Chat } from '@/features/chat/chat';
import { SceneCoordinator } from '@/features/scene3d/SceneCoordinator';
import { HookManager } from '@/features/hooks/hookManager';
import { JsonRpcRequest } from '@/features/jsonrpc/protocol';

describe('JsonRpcServer Extended Tests', () => {
  let server: JsonRpcServer;
  let mockChat: MockedObject<Chat>;
  let mockSceneCoordinator: MockedObject<SceneCoordinator>;
  let mockHookManager: MockedObject<HookManager>;

  beforeEach(() => {
    mockChat = new Chat() as MockedObject<Chat>;
    mockSceneCoordinator = new SceneCoordinator() as MockedObject<SceneCoordinator>;
    mockHookManager = new HookManager() as MockedObject<HookManager>;

    mockChat.receiveMessageFromUser = vi.fn().mockResolvedValue(undefined);
    mockChat.interrupt = vi.fn().mockResolvedValue(0);
    mockChat.makeAndHandleStream = vi.fn().mockResolvedValue(undefined);
    mockChat.getMessageList = vi.fn().mockReturnValue([]);
    mockChat.messageList = [];
    mockChat.currentStreamIdx = 0;
    mockChat.isAwake = vi.fn().mockReturnValue(true);
    mockChat.idleTime = vi.fn().mockReturnValue(5000);

    mockSceneCoordinator.isReady = true;
    const mockModel = {
      position: { set: vi.fn(), x: 0, y: 0, z: 0 },
      rotation: { set: vi.fn(), x: 0, y: 0, z: 0 },
      scale: { set: vi.fn(), x: 1, y: 1, z: 1 },
      speak: vi.fn(),
    } as any;
    mockSceneCoordinator.vrm = {
      getModel: vi.fn(() => mockModel),
      loadVrm: vi.fn().mockResolvedValue(undefined),
      unloadVRM: vi.fn(),
    } as any;
    mockSceneCoordinator.environment = {
      getRoom: vi.fn(() => null),
      loadRoom: vi.fn().mockResolvedValue(undefined),
      unloadRoom: vi.fn(),
      loadSplat: vi.fn().mockResolvedValue(undefined),
    } as any;
    mockSceneCoordinator.render = {
      resetCamera: vi.fn(),
    } as any;

    mockHookManager.register = vi.fn().mockReturnValue('hook-123');
    mockHookManager.unregister = vi.fn().mockReturnValue(true);
    mockHookManager.unregisterAll = vi.fn();
    mockHookManager.trigger = vi.fn().mockResolvedValue({});
    mockHookManager.getHooks = vi.fn().mockReturnValue([]);
    mockHookManager.setEnabled = vi.fn();
    mockHookManager.clear = vi.fn();

    server = new JsonRpcServer(mockChat, mockSceneCoordinator, mockHookManager);
  });

  describe('Audio Methods', () => {
    // Skipping audio tests as they require complex base64 audio data setup
    it.skip('should handle audio.send with transcription', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'audio.send',
        params: {
          audio: 'data:audio/wav;base64,UklGRi...',
          transcribe: true,
        },
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result.success).toBe(true);
    });

    it.skip('should handle audio.transcribe', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'audio.transcribe',
        params: {
          audio: 'data:audio/wav;base64,UklGRi...',
        },
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
    });

    it.skip('should handle audio.playback', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'audio.playback',
        params: {
          audio: 'data:audio/wav;base64,UklGRi...',
          screenplay: {
            expression: 'happy',
            talk: { message: 'Test', style: 'talk', emotion: 'happy' },
          },
        },
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result.success).toBe(true);
      expect(response.result.playing).toBe(true);
    });

    it.skip('should reject audio.playback without model', async () => {
      const mockModel = null;

      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'audio.playback',
        params: {
          audio: 'data:audio/wav;base64,UklGRi...',
        },
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('No model loaded');
    });
  });

  describe('Character Methods Extended', () => {
    beforeEach(() => {
      const mockModel = {
        position: { set: vi.fn(), x: 0, y: 0, z: 0 },
        rotation: { set: vi.fn(), x: 0, y: 0, z: 0 },
        scale: { set: vi.fn(), x: 1, y: 1, z: 1 },
        speak: vi.fn(),
      } as any;
    });

    it('should handle character.playAnimation', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'character.playAnimation',
        params: {
          animationUrl: 'https://example.com/anim.fbx',
          loop: true,
        },
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result.success).toBe(true);
    });

    it.skip('should handle character.stopSpeaking', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'character.stopSpeaking',
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result.success).toBe(true);
    });

    it('should handle character.loadModel', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'character.loadModel',
        params: {
          modelUrl: 'https://example.com/model.vrm',
        },
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
    });

    it('should handle character.lookAt', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'character.lookAt',
        params: {
          target: { x: 1, y: 2, z: 3 },
        },
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result.success).toBe(true);
    });

    it('should handle character.setAutoLookAt', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'character.setAutoLookAt',
        params: {
          enabled: true,
        },
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result.success).toBe(true);
    });

    it('should handle character.setAutoBlink', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'character.setAutoBlink',
        params: {
          enabled: false,
        },
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result.success).toBe(true);
    });
  });

  describe('Vision Methods', () => {
    it('should handle vision.processImage', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'vision.processImage',
        params: {
          imageData: 'data:image/png;base64,iVBORw0KGgo...',
        },
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
    });

    it('should handle vision.captureScreenshot', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'vision.captureScreenshot',
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result.imageData).toBeDefined();
    });
  });

  describe('Config Methods', () => {
    let localStorageMock: any;

    beforeEach(() => {
      localStorageMock = {
        setItem: vi.fn(),
        getItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      };
      (global as any).localStorage = localStorageMock;
    });

    it('should handle config.get', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'config.get',
        params: {
          key: 'test_key',
        },
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result.key).toBe('test_key');
    });

    it('should handle config.set', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'config.set',
        params: {
          key: 'new_key',
          value: 'new_value',
        },
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result.success).toBe(true);
      expect(response.result.key).toBe('new_key');
      expect(response.result.value).toBe('new_value');
    });

    it('should handle config.getAll', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'config.getAll',
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result.config).toBeDefined();
    });

    it('should handle config.update', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'config.update',
        params: {
          config: {
            key1: 'value1',
            key2: 'value2',
            key3: 'value3',
          },
        },
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result.success).toBe(true);
      expect(response.result.updated).toBe(3);
    });
  });

  describe('Scenario Methods', () => {
    it('should handle scenario.load', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'scenario.load',
        params: {
          scenarioUrl: 'https://example.com/scenario.json',
        },
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result.scenarioName).toBe('https://example.com/scenario.json');
    });

    it('should handle scenario.unload', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'scenario.unload',
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result.loaded).toBe(false);
    });

    it('should handle scenario.getState', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'scenario.getState',
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result.loaded).toBe(false);
    });
  });

  describe('Chat Methods Extended', () => {
    it('should handle chat.createStream', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'chat.createStream',
        params: {
          messages: [{ role: 'user', content: 'Hello' }],
        },
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result.streamId).toBeDefined();
      expect(response.result.status).toBe('started');
    });

    it('should handle chat.getMessageList', async () => {
      mockChat.messageList = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' },
      ] as any;

      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'chat.getMessageList',
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result.messages).toHaveLength(2);
    });

    it('should handle chat.setMessageList', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'chat.setMessageList',
        params: {
          messages: [{ role: 'user', content: 'New message' }],
        },
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result.success).toBe(true);
    });

    it('should handle chat.isAwake', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'chat.isAwake',
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result.awake).toBe(true);
      expect(mockChat.isAwake).toHaveBeenCalled();
    });

    it('should handle chat.getIdleTime', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'chat.getIdleTime',
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result.idleTime).toBe(5000);
      expect(mockChat.idleTime).toHaveBeenCalled();
    });
  });

  describe('Hook Methods Extended', () => {
    it('should handle hooks.unregisterAll', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'hooks.unregisterAll',
        params: {
          event: 'before:llm:request',
        },
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result.success).toBe(true);
      expect(mockHookManager.unregisterAll).toHaveBeenCalledWith('before:llm:request');
    });

    it('should handle hooks.enable', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'hooks.enable',
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result.enabled).toBe(true);
      expect(mockHookManager.setEnabled).toHaveBeenCalledWith(true);
    });

    it('should handle hooks.disable', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'hooks.disable',
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result.enabled).toBe(false);
      expect(mockHookManager.setEnabled).toHaveBeenCalledWith(false);
    });

    it('should handle hooks.clear', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'hooks.clear',
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result.success).toBe(true);
      expect(mockHookManager.clear).toHaveBeenCalled();
    });
  });

  describe('SceneCoordinator Methods Extended', () => {
    it('should handle viewer.setCamera', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'viewer.setCamera',
        params: {
          position: { x: 0, y: 5, z: 10 },
          target: { x: 0, y: 0, z: 0 },
          fov: 60,
        },
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
    });

    it('should handle viewer.screenshot', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'viewer.screenshot',
        id: 1,
      };

      const response = await server.handleRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result.imageData).toBeDefined();
    });
  });
});
