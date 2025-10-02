/**
 * Protocol Type and Validation Tests
 */

import {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  JsonRpcError,
  JsonRpcErrorCode,
  AmicaMethod,
  MethodParamsMap,
  MethodResultMap,
  Vec3,
  Transform,
} from '@/features/jsonrpc/protocol';

describe('JSON-RPC Protocol Types', () => {
  describe('JsonRpcRequest', () => {
    it('should accept valid requests', () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'system.ping',
        id: 1,
      };

      expect(request.jsonrpc).toBe('2.0');
      expect(request.method).toBe('system.ping');
      expect(request.id).toBe(1);
    });

    it('should accept requests with params', () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'chat.sendMessage',
        params: { message: 'Hello' },
        id: 1,
      };

      expect(request.params).toEqual({ message: 'Hello' });
    });

    it('should accept null id', () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'system.ping',
        id: null,
      };

      expect(request.id).toBeNull();
    });

    it('should accept string id', () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'system.ping',
        id: 'request-123',
      };

      expect(request.id).toBe('request-123');
    });
  });

  describe('JsonRpcResponse', () => {
    it('should accept success response', () => {
      const response: JsonRpcResponse = {
        jsonrpc: '2.0',
        result: { pong: true },
        id: 1,
      };

      expect(response.result).toEqual({ pong: true });
      expect(response.error).toBeUndefined();
    });

    it('should accept error response', () => {
      const response: JsonRpcResponse = {
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: 'Method not found',
        },
        id: 1,
      };

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32601);
      expect(response.result).toBeUndefined();
    });

    it('should accept error with data', () => {
      const response: JsonRpcResponse = {
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Application error',
          data: { details: 'Additional info' },
        },
        id: 1,
      };

      expect(response.error?.data).toEqual({ details: 'Additional info' });
    });
  });

  describe('JsonRpcNotification', () => {
    it('should accept notifications without id', () => {
      const notification: JsonRpcNotification = {
        jsonrpc: '2.0',
        method: 'heartbeat',
      };

      expect(notification.method).toBe('heartbeat');
      expect((notification as any).id).toBeUndefined();
    });

    it('should accept notifications with params', () => {
      const notification: JsonRpcNotification = {
        jsonrpc: '2.0',
        method: 'event:on:llm:chunk',
        params: { chunk: 'Hello' },
      };

      expect(notification.params).toEqual({ chunk: 'Hello' });
    });
  });

  describe('JsonRpcErrorCode', () => {
    it('should have standard error codes', () => {
      expect(JsonRpcErrorCode.ParseError).toBe(-32700);
      expect(JsonRpcErrorCode.InvalidRequest).toBe(-32600);
      expect(JsonRpcErrorCode.MethodNotFound).toBe(-32601);
      expect(JsonRpcErrorCode.InvalidParams).toBe(-32602);
      expect(JsonRpcErrorCode.InternalError).toBe(-32603);
    });

    it('should have application error codes', () => {
      expect(JsonRpcErrorCode.HookRegistrationFailed).toBe(-32000);
      expect(JsonRpcErrorCode.HookNotFound).toBe(-32001);
      expect(JsonRpcErrorCode.ActionFailed).toBe(-32002);
      expect(JsonRpcErrorCode.StateNotAvailable).toBe(-32003);
      expect(JsonRpcErrorCode.ConfigError).toBe(-32004);
      expect(JsonRpcErrorCode.ChatError).toBe(-32005);
      expect(JsonRpcErrorCode.ViewerError).toBe(-32006);
      expect(JsonRpcErrorCode.ScenarioError).toBe(-32007);
    });
  });

  describe('AmicaMethod', () => {
    it('should include hook methods', () => {
      const methods: AmicaMethod[] = [
        'hooks.register',
        'hooks.unregister',
        'hooks.trigger',
        'hooks.list',
        'hooks.getMetrics',
      ];

      methods.forEach((method) => {
        expect(typeof method).toBe('string');
      });
    });

    it('should include chat methods', () => {
      const methods: AmicaMethod[] = [
        'chat.sendMessage',
        'chat.interrupt',
        'chat.getState',
        'chat.getMessageList',
      ];

      methods.forEach((method) => {
        expect(typeof method).toBe('string');
      });
    });

    it('should include character methods', () => {
      const methods: AmicaMethod[] = [
        'character.setExpression',
        'character.setEmotion',
        'character.speak',
        'character.playAnimation',
        'character.lookAt',
      ];

      methods.forEach((method) => {
        expect(typeof method).toBe('string');
      });
    });

    it('should include model methods', () => {
      const methods: AmicaMethod[] = [
        'model.load',
        'model.unload',
        'model.setPosition',
        'model.setRotation',
        'model.setScale',
        'model.getTransform',
      ];

      methods.forEach((method) => {
        expect(typeof method).toBe('string');
      });
    });

    it('should include room methods', () => {
      const methods: AmicaMethod[] = [
        'room.load',
        'room.unload',
        'room.setPosition',
        'room.loadSplat',
      ];

      methods.forEach((method) => {
        expect(typeof method).toBe('string');
      });
    });

    it('should include XR methods', () => {
      const methods: AmicaMethod[] = [
        'xr.startSession',
        'xr.endSession',
        'xr.getSessionState',
        'xr.setFoveation',
        'xr.setFramebufferScale',
      ];

      methods.forEach((method) => {
        expect(typeof method).toBe('string');
      });
    });

    it('should include system methods', () => {
      const methods: AmicaMethod[] = [
        'system.ping',
        'system.getVersion',
        'system.getCapabilities',
        'system.batch',
      ];

      methods.forEach((method) => {
        expect(typeof method).toBe('string');
      });
    });

    it('should include event subscription methods', () => {
      const methods: AmicaMethod[] = [
        'events.subscribe',
        'events.unsubscribe',
        'events.listSubscriptions',
      ];

      methods.forEach((method) => {
        expect(typeof method).toBe('string');
      });
    });
  });

  describe('MethodParamsMap', () => {
    it('should have correct params for chat.sendMessage', () => {
      const params: MethodParamsMap['chat.sendMessage'] = {
        message: 'Hello',
        role: 'user',
      };

      expect(params.message).toBe('Hello');
      expect(params.role).toBe('user');
    });

    it('should have correct params for model.load', () => {
      const params: MethodParamsMap['model.load'] = {
        modelUrl: 'https://example.com/model.vrm',
        onProgress: true,
      };

      expect(params.modelUrl).toBe('https://example.com/model.vrm');
      expect(params.onProgress).toBe(true);
    });

    it('should have correct params for room.load', () => {
      const params: MethodParamsMap['room.load'] = {
        roomUrl: 'https://example.com/room.glb',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        onProgress: false,
      };

      expect(params.roomUrl).toBe('https://example.com/room.glb');
      expect(params.position).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('should have correct params for xr.startSession', () => {
      const params: MethodParamsMap['xr.startSession'] = {
        mode: 'immersive-vr',
        referenceSpaceType: 'local-floor',
      };

      expect(params.mode).toBe('immersive-vr');
      expect(params.referenceSpaceType).toBe('local-floor');
    });

    it('should have correct params for character.setEmotion', () => {
      const params: MethodParamsMap['character.setEmotion'] = {
        emotion: 'happy',
        intensity: 0.8,
        duration: 5000,
      };

      expect(params.emotion).toBe('happy');
      expect(params.intensity).toBe(0.8);
      expect(params.duration).toBe(5000);
    });

    it('should have correct params for hooks.register', () => {
      const params: MethodParamsMap['hooks.register'] = {
        event: 'before:llm:request',
        priority: 50,
        timeout: 30000,
      };

      expect(params.event).toBe('before:llm:request');
      expect(params.priority).toBe(50);
    });

    it('should accept void params', () => {
      const params: MethodParamsMap['system.ping'] = undefined;
      expect(params).toBeUndefined();
    });
  });

  describe('MethodResultMap', () => {
    it('should have correct result for system.ping', () => {
      const result: MethodResultMap['system.ping'] = {
        pong: true,
        timestamp: 1234567890,
      };

      expect(result.pong).toBe(true);
      expect(result.timestamp).toBe(1234567890);
    });

    it('should have correct result for model.load', () => {
      const result: MethodResultMap['model.load'] = {
        success: true,
        loaded: true,
        modelUrl: 'https://example.com/model.vrm',
      };

      expect(result.success).toBe(true);
      expect(result.loaded).toBe(true);
    });

    it('should have correct result for model.getTransform', () => {
      const result: MethodResultMap['model.getTransform'] = {
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      };

      expect(result.position?.x).toBe(1);
      expect(result.rotation?.y).toBe(0);
      expect(result.scale?.z).toBe(1);
    });

    it('should have correct result for xr.startSession', () => {
      const result: MethodResultMap['xr.startSession'] = {
        success: true,
        sessionActive: true,
        mode: 'immersive-vr',
      };

      expect(result.success).toBe(true);
      expect(result.sessionActive).toBe(true);
      expect(result.mode).toBe('immersive-vr');
    });

    it('should have correct result for chat.sendMessage', () => {
      const result: MethodResultMap['chat.sendMessage'] = {
        messageId: 'msg-123',
        response: 'Hello!',
        processing: false,
      };

      expect(result.messageId).toBe('msg-123');
      expect(result.processing).toBe(false);
    });

    it('should have correct result for system.getCapabilities', () => {
      const result: MethodResultMap['system.getCapabilities'] = {
        methods: ['system.ping', 'chat.sendMessage'] as AmicaMethod[],
        hooks: ['before:llm:request', 'after:llm:complete'],
      };

      expect(Array.isArray(result.methods)).toBe(true);
      expect(Array.isArray(result.hooks)).toBe(true);
    });

    it('should have correct result for events.subscribe', () => {
      const result: MethodResultMap['events.subscribe'] = {
        subscribed: ['before:llm:request'],
        count: 1,
      };

      expect(result.subscribed).toEqual(['before:llm:request']);
      expect(result.count).toBe(1);
    });
  });

  describe('Vec3 Type', () => {
    it('should accept valid Vec3', () => {
      const vec: Vec3 = {
        x: 1.5,
        y: -2.3,
        z: 0,
      };

      expect(vec.x).toBe(1.5);
      expect(vec.y).toBe(-2.3);
      expect(vec.z).toBe(0);
    });
  });

  describe('Transform Type', () => {
    it('should accept full transform', () => {
      const transform: Transform = {
        position: { x: 0, y: 1, z: -2 },
        rotation: { x: 0, y: Math.PI, z: 0 },
        scale: { x: 1.5, y: 1.5, z: 1.5 },
      };

      expect(transform.position?.x).toBe(0);
      expect(transform.rotation?.y).toBe(Math.PI);
      expect(transform.scale?.x).toBe(1.5);
    });

    it('should accept partial transform', () => {
      const transform: Transform = {
        position: { x: 1, y: 2, z: 3 },
      };

      expect(transform.position).toEqual({ x: 1, y: 2, z: 3 });
      expect(transform.rotation).toBeUndefined();
      expect(transform.scale).toBeUndefined();
    });

    it('should accept empty transform', () => {
      const transform: Transform = {};

      expect(transform.position).toBeUndefined();
      expect(transform.rotation).toBeUndefined();
      expect(transform.scale).toBeUndefined();
    });
  });

  describe('Parameter Validation', () => {
    it('should validate SendMessageParams', () => {
      const params: MethodParamsMap['chat.sendMessage'] = {
        message: 'Test message',
      };

      expect(params.message.length).toBeGreaterThan(0);
    });

    it('should validate SetEmotionParams', () => {
      const params: MethodParamsMap['character.setEmotion'] = {
        emotion: 'happy',
        intensity: 0.8,
        duration: 5000,
      };

      expect(params.intensity).toBeGreaterThanOrEqual(0);
      expect(params.intensity).toBeLessThanOrEqual(1);
      expect(params.duration).toBeGreaterThanOrEqual(0);
    });

    it('should validate LoadModelParams', () => {
      const params: MethodParamsMap['model.load'] = {
        modelUrl: 'https://example.com/model.vrm',
      };

      expect(params.modelUrl).toContain('http');
    });

    it('should validate SetTransformParams', () => {
      const params: MethodParamsMap['model.setPosition'] = {
        position: { x: 0, y: 0, z: 0 },
      };

      expect(params.position.x).toBeDefined();
      expect(params.position.y).toBeDefined();
      expect(params.position.z).toBeDefined();
    });
  });

  describe('Method Namespace Coverage', () => {
    const allMethods: AmicaMethod[] = [
      // Hooks
      'hooks.register',
      'hooks.unregister',
      'hooks.unregisterAll',
      'hooks.trigger',
      'hooks.list',
      'hooks.getMetrics',
      'hooks.enable',
      'hooks.disable',
      'hooks.clear',
      // Chat
      'chat.sendMessage',
      'chat.createStream',
      'chat.interrupt',
      'chat.getState',
      'chat.getMessageList',
      'chat.setMessageList',
      'chat.isAwake',
      'chat.getIdleTime',
      // Audio
      'audio.send',
      'audio.transcribe',
      'audio.playback',
      // Character
      'character.setExpression',
      'character.setEmotion',
      'character.playAnimation',
      'character.speak',
      'character.stopSpeaking',
      'character.loadModel',
      'character.lookAt',
      'character.setAutoLookAt',
      'character.setAutoBlink',
      // Vision
      'vision.processImage',
      'vision.captureScreenshot',
      // Config
      'config.get',
      'config.set',
      'config.getAll',
      'config.update',
      // Scenario
      'scenario.load',
      'scenario.unload',
      'scenario.getState',
      // Model
      'model.load',
      'model.unload',
      'model.setPosition',
      'model.setRotation',
      'model.setScale',
      'model.getTransform',
      // Room
      'room.load',
      'room.unload',
      'room.setPosition',
      'room.setRotation',
      'room.setScale',
      'room.getTransform',
      'room.loadSplat',
      // Viewer
      'viewer.getState',
      'viewer.setCamera',
      'viewer.screenshot',
      'viewer.resetCamera',
      'viewer.setBackground',
      'viewer.setLighting',
      'viewer.setPhysics',
      // XR
      'xr.startSession',
      'xr.endSession',
      'xr.getSessionState',
      'xr.setFoveation',
      'xr.setFramebufferScale',
      // Events
      'events.subscribe',
      'events.unsubscribe',
      'events.listSubscriptions',
      // System
      'system.ping',
      'system.getVersion',
      'system.getCapabilities',
      'system.batch',
    ];

    it('should have all expected methods', () => {
      expect(allMethods.length).toBeGreaterThan(60);
    });

    it('should have methods in all namespaces', () => {
      const namespaces = allMethods.map((m) => m.split('.')[0]);
      const uniqueNamespaces = [...new Set(namespaces)];

      expect(uniqueNamespaces).toContain('hooks');
      expect(uniqueNamespaces).toContain('chat');
      expect(uniqueNamespaces).toContain('audio');
      expect(uniqueNamespaces).toContain('character');
      expect(uniqueNamespaces).toContain('vision');
      expect(uniqueNamespaces).toContain('config');
      expect(uniqueNamespaces).toContain('scenario');
      expect(uniqueNamespaces).toContain('model');
      expect(uniqueNamespaces).toContain('room');
      expect(uniqueNamespaces).toContain('viewer');
      expect(uniqueNamespaces).toContain('xr');
      expect(uniqueNamespaces).toContain('events');
      expect(uniqueNamespaces).toContain('system');
    });

    it('should have consistent naming convention', () => {
      allMethods.forEach((method) => {
        expect(method).toMatch(/^[a-z]+\.[a-zA-Z]+$/);
      });
    });
  });
});
