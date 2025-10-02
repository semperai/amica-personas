/**
 * JSON-RPC Server for Amica
 *
 * Handles incoming JSON-RPC requests and dispatches them to appropriate handlers
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
} from './protocol';
import { Chat } from '@/features/chat/chat';
import { Viewer } from '@/features/vrmViewer/viewer';
import { HookManager } from '@/features/hooks/hookManager';
import { HookEvent } from '@/features/hooks/hookEvents';

export type JsonRpcHandler<M extends AmicaMethod> = (
  params: MethodParamsMap[M],
  context: JsonRpcContext
) => Promise<MethodResultMap[M]>;

export interface JsonRpcContext {
  chat: Chat;
  viewer: Viewer;
  hookManager: HookManager;
}

export class JsonRpcServer {
  private handlers: Map<AmicaMethod, JsonRpcHandler<any>> = new Map();
  private context: JsonRpcContext;
  private transport: any; // WebSocketTransport reference
  private currentWebSocket?: WebSocket; // Track current request's WebSocket

  constructor(chat: Chat, viewer: Viewer, hookManager: HookManager) {
    this.context = { chat, viewer, hookManager };
    this.registerDefaultHandlers();
    this.setupEventForwarding();
  }

  /**
   * Set the transport layer (for subscriptions)
   */
  public setTransport(transport: any): void {
    this.transport = transport;
  }

  /**
   * Set current WebSocket for request context
   */
  public setCurrentWebSocket(ws: WebSocket): void {
    this.currentWebSocket = ws;
  }

  /**
   * Register a handler for a specific method
   */
  public registerHandler<M extends AmicaMethod>(
    method: M,
    handler: JsonRpcHandler<M>
  ): void {
    this.handlers.set(method, handler);
  }

  /**
   * Handle a JSON-RPC request
   */
  public async handleRequest(
    request: JsonRpcRequest
  ): Promise<JsonRpcResponse> {
    // Validate JSON-RPC version
    if (request.jsonrpc !== '2.0') {
      return this.errorResponse(
        request.id,
        JsonRpcErrorCode.InvalidRequest,
        'Invalid JSON-RPC version. Must be "2.0"'
      );
    }

    // Validate method
    if (typeof request.method !== 'string') {
      return this.errorResponse(
        request.id,
        JsonRpcErrorCode.InvalidRequest,
        'Method must be a string'
      );
    }

    const handler = this.handlers.get(request.method as AmicaMethod);
    if (!handler) {
      return this.errorResponse(
        request.id,
        JsonRpcErrorCode.MethodNotFound,
        `Method not found: ${request.method}`
      );
    }

    try {
      const result = await handler(request.params, this.context);
      return {
        jsonrpc: '2.0',
        result,
        id: request.id,
      };
    } catch (error: any) {
      console.error(`[JsonRpcServer] Error handling ${request.method}:`, error);
      return this.errorResponse(
        request.id,
        JsonRpcErrorCode.InternalError,
        error.message || 'Internal error',
        error
      );
    }
  }

  /**
   * Handle multiple JSON-RPC requests in batch
   */
  public async handleBatch(
    requests: JsonRpcRequest[]
  ): Promise<JsonRpcResponse[]> {
    return Promise.all(requests.map((req) => this.handleRequest(req)));
  }

  /**
   * Handle a notification (no response expected)
   */
  public async handleNotification(
    notification: JsonRpcNotification
  ): Promise<void> {
    const handler = this.handlers.get(notification.method as AmicaMethod);
    if (!handler) {
      console.warn(`[JsonRpcServer] Unknown notification method: ${notification.method}`);
      return;
    }

    try {
      await handler(notification.params, this.context);
    } catch (error: any) {
      console.error(`[JsonRpcServer] Error handling notification ${notification.method}:`, error);
    }
  }

  /**
   * Create an error response
   */
  private errorResponse(
    id: string | number | null,
    code: JsonRpcErrorCode,
    message: string,
    data?: any
  ): JsonRpcResponse {
    const error: JsonRpcError = { code, message };
    if (data) {
      error.data = data;
    }
    return {
      jsonrpc: '2.0',
      error,
      id,
    };
  }

  /**
   * Setup event forwarding from hooks to subscribed clients
   */
  private setupEventForwarding(): void {
    // Register hooks for all events to forward to subscribed clients
    const allEvents: HookEvent[] = [
      'before:user:message:receive',
      'after:user:message:receive',
      'before:stt:transcribe',
      'after:stt:transcribe',
      'before:llm:request',
      'after:llm:request',
      'before:llm:stream',
      'on:llm:chunk',
      'after:llm:complete',
      'before:tts:generate',
      'after:tts:generate',
      'before:rvc:process',
      'after:rvc:process',
      'before:speak:start',
      'after:speak:end',
      'on:expression:change',
      'on:animation:play',
      'before:vision:capture',
      'after:vision:response',
      'scenario:loaded',
      'scenario:setup:complete',
      'scenario:update',
      'scenario:unload',
    ];

    // Register a low-priority hook for each event to forward to subscribers
    allEvents.forEach((event) => {
      this.context.hookManager.register(
        event,
        async (context) => {
          // Forward event to subscribed clients
          if (this.transport && this.transport.broadcastEvent) {
            this.transport.broadcastEvent(event, context);
          }
          return context;
        },
        { priority: 1000 } // Low priority so it runs last
      );
    });
  }

  /**
   * Register all default handlers
   */
  private registerDefaultHandlers(): void {
    // =========================================================================
    // HOOK MANAGEMENT
    // =========================================================================

    this.registerHandler('hooks.register', async (params, ctx) => {
      try {
        const hookId = ctx.hookManager.register(
          params.event,
          async (hookContext) => hookContext, // Simple passthrough for now
          {
            priority: params.priority,
            timeout: params.timeout,
          }
        );

        return {
          hookId,
          event: params.event,
        };
      } catch (error: any) {
        throw new Error(`Failed to register hook: ${error.message}`);
      }
    });

    this.registerHandler('hooks.unregister', async (params, ctx) => {
      const success = ctx.hookManager.unregister(params.hookId);
      return {
        success,
        hookId: params.hookId,
      };
    });

    this.registerHandler('hooks.unregisterAll', async (params, ctx) => {
      ctx.hookManager.unregisterAll(params.event);
      return {
        success: true,
        event: params.event,
      };
    });

    this.registerHandler('hooks.trigger', async (params, ctx) => {
      const data = await ctx.hookManager.trigger(params.event, params.data);
      const hooks = ctx.hookManager.getHooks(params.event);
      return {
        event: params.event,
        data,
        executedHooks: hooks.length,
      };
    });

    this.registerHandler('hooks.list', async (params, ctx) => {
      const hooks = ctx.hookManager.getHooks(params.event);
      return {
        hooks: hooks.map((h: any) => ({
          hookId: h.id,
          event: h.event,
          priority: h.options.priority ?? 100,
        })),
      };
    });

    this.registerHandler('hooks.getMetrics', async (params, ctx) => {
      if (params.hookId) {
        const metrics = ctx.hookManager.getMetrics(params.hookId);
        if (!metrics) {
          throw new Error(`Hook not found: ${params.hookId}`);
        }
        return { hookId: params.hookId, ...metrics };
      } else if (params.event) {
        const metrics = ctx.hookManager.getEventMetrics(params.event);
        return { hookId: params.event, ...metrics };
      } else {
        const allHooks = ctx.hookManager.getHooks();
        return allHooks.map((h: any) => ({
          hookId: h.id,
          ...ctx.hookManager.getMetrics(h.id)!,
        }));
      }
    });

    this.registerHandler('hooks.enable', async (params, ctx) => {
      ctx.hookManager.setEnabled(true);
      return { enabled: true };
    });

    this.registerHandler('hooks.disable', async (params, ctx) => {
      ctx.hookManager.setEnabled(false);
      return { enabled: false };
    });

    this.registerHandler('hooks.clear', async (params, ctx) => {
      ctx.hookManager.clear();
      return { success: true };
    });

    // =========================================================================
    // CHAT ACTIONS
    // =========================================================================

    this.registerHandler('chat.sendMessage', async (params, ctx) => {
      await ctx.chat.receiveMessageFromUser(params.message);
      return {
        messageId: `msg_${Date.now()}`,
        processing: true,
      };
    });

    this.registerHandler('chat.createStream', async (params, ctx) => {
      await ctx.chat.makeAndHandleStream(params.messages);
      return {
        streamId: `stream_${ctx.chat.currentStreamIdx}`,
        status: 'started',
      };
    });

    this.registerHandler('chat.interrupt', async (params, ctx) => {
      const streamIdx = ctx.chat.currentStreamIdx;
      await ctx.chat.interrupt();
      return {
        interrupted: true,
        streamIdx,
      };
    });

    this.registerHandler('chat.getState', async (params, ctx) => {
      return {
        messageList: ctx.chat.messageList,
        currentUserMessage: (ctx.chat as any).currentUserMessage || '',
        currentAssistantMessage: (ctx.chat as any).currentAssistantMessage || '',
        processing: false, // TODO: track this in Chat class
        speaking: false, // TODO: track this in Chat class
      };
    });

    this.registerHandler('chat.getMessageList', async (params, ctx) => {
      return {
        messages: ctx.chat.messageList,
      };
    });

    this.registerHandler('chat.setMessageList', async (params, ctx) => {
      ctx.chat.setMessageList(params.messages);
      return { success: true };
    });

    this.registerHandler('chat.isAwake', async (params, ctx) => {
      return { awake: ctx.chat.isAwake() };
    });

    this.registerHandler('chat.getIdleTime', async (params, ctx) => {
      return { idleTime: ctx.chat.idleTime() };
    });

    // =========================================================================
    // AUDIO INPUT
    // =========================================================================

    this.registerHandler('audio.send', async (params, ctx) => {
      // Convert base64 audio to Float32Array
      const audioData = this.base64ToFloat32Array(params.audio);

      if (params.transcribe) {
        // Trigger STT hook
        const beforeContext = await ctx.hookManager.trigger('before:stt:transcribe', {
          audio: audioData,
        });

        // TODO: Integrate with actual STT backend
        // For now, just return a placeholder
        const transcript = ''; // Would come from STT service

        const afterContext = await ctx.hookManager.trigger('after:stt:transcribe', {
          transcript,
        });

        // Send transcription as message
        if (afterContext.transcript) {
          await ctx.chat.receiveMessageFromUser(afterContext.transcript);
        }

        return {
          success: true,
          transcription: afterContext.transcript,
        };
      }

      return {
        success: true,
      };
    });

    this.registerHandler('audio.transcribe', async (params, ctx) => {
      // Convert base64 audio to Float32Array
      const audioData = this.base64ToFloat32Array(params.audio);

      // Trigger STT hook
      const beforeContext = await ctx.hookManager.trigger('before:stt:transcribe', {
        audio: audioData,
      });

      // TODO: Integrate with actual STT backend
      const transcript = ''; // Would come from STT service

      const afterContext = await ctx.hookManager.trigger('after:stt:transcribe', {
        transcript,
      });

      return {
        transcript: afterContext.transcript,
        success: true,
      };
    });

    this.registerHandler('audio.playback', async (params, ctx) => {
      if (!ctx.viewer.model) {
        throw new Error('No model loaded');
      }

      // Convert base64 audio to ArrayBuffer
      const audioBuffer = this.base64ToArrayBuffer(params.audio);

      // Create screenplay if provided
      const screenplay = params.screenplay || {
        expression: 'neutral',
        talk: { message: '', style: 'talk', emotion: 'neutral' },
      };

      const fullScreenplay = {
        expression: screenplay.expression || 'neutral',
        talk: screenplay.talk || { message: '', style: 'talk', emotion: 'neutral' },
      };

      // Trigger before speak hook
      await ctx.hookManager.trigger('before:speak:start', {
        audioBuffer,
        screenplay: fullScreenplay,
      });

      // Play audio directly (bypass TTS)
      ctx.viewer.model.speak(audioBuffer, fullScreenplay as any);

      return {
        success: true,
        playing: true,
      };
    });

    // =========================================================================
    // CHARACTER ACTIONS
    // =========================================================================

    this.registerHandler('character.setExpression', async (params, ctx) => {
      if (!ctx.viewer.model) {
        throw new Error('No model loaded');
      }
      // Trigger expression change hook
      await ctx.hookManager.trigger('on:expression:change', {
        expression: params.expression,
      });
      return {
        expression: params.expression,
        success: true,
      };
    });

    this.registerHandler('character.setEmotion', async (params, ctx) => {
      if (!ctx.viewer.model) {
        throw new Error('No model loaded');
      }
      // Set emotion via expression controller
      // This would integrate with the emote controller
      await ctx.hookManager.trigger('on:expression:change', {
        expression: params.emotion,
      });
      return {
        emotion: params.emotion,
        success: true,
      };
    });

    this.registerHandler('character.playAnimation', async (params, ctx) => {
      if (!ctx.viewer.model) {
        throw new Error('No model loaded');
      }
      // Load and play animation
      // Note: This would need to be implemented in the Viewer class
      await ctx.hookManager.trigger('on:animation:play', {
        animation: params.animationUrl,
      });
      return {
        animation: params.animationUrl,
        success: true,
      };
    });

    this.registerHandler('character.speak', async (params, ctx) => {
      if (!ctx.viewer.model) {
        throw new Error('No model loaded');
      }
      // Create a simple talk object and fetch audio
      const talk = {
        message: params.text,
        style: params.style || 'talk',
        emotion: params.emotion || 'neutral',
      };
      await ctx.chat.fetchAudio(talk);
      return {
        speaking: true,
        success: true,
      };
    });

    this.registerHandler('character.stopSpeaking', async (params, ctx) => {
      // Stop current speech
      ctx.chat.speakJobs.clear();
      return { success: true };
    });

    this.registerHandler('character.loadModel', async (params, ctx) => {
      // This would need to be implemented in the Viewer class
      // For now, just return a placeholder
      return {
        modelUrl: params.modelUrl,
        loaded: false,
      };
    });

    this.registerHandler('character.lookAt', async (params, ctx) => {
      if (!ctx.viewer.model) {
        throw new Error('No model loaded');
      }
      // Set look at target
      // This would integrate with the autoLookAt controller
      if (params.enabled === false) {
        // Disable look at
        // TODO: Implement in viewer/model
      } else if (params.target) {
        // Set specific target
        // TODO: Implement in viewer/model
      }
      return {
        success: true,
      };
    });

    this.registerHandler('character.setAutoLookAt', async (params, ctx) => {
      if (!ctx.viewer.model) {
        throw new Error('No model loaded');
      }
      // Enable/disable auto look at
      // This would integrate with the autoLookAt feature
      // TODO: Implement in viewer/model
      return {
        enabled: params.enabled,
        success: true,
      };
    });

    this.registerHandler('character.setAutoBlink', async (params, ctx) => {
      if (!ctx.viewer.model) {
        throw new Error('No model loaded');
      }
      // Enable/disable auto blink
      // This would integrate with the autoBlink feature
      // TODO: Implement in viewer/model
      return {
        enabled: params.enabled,
        success: true,
      };
    });

    // =========================================================================
    // VISION ACTIONS
    // =========================================================================

    this.registerHandler('vision.processImage', async (params, ctx) => {
      await ctx.chat.getVisionResponse(params.imageData);
      return {
        response: 'Vision processing started',
        success: true,
      };
    });

    this.registerHandler('vision.captureScreenshot', async (params, ctx) => {
      // This would need to be implemented in the Viewer class
      return {
        imageData: '',
      };
    });

    // =========================================================================
    // CONFIG MANAGEMENT
    // =========================================================================

    this.registerHandler('config.get', async (params, ctx) => {
      const { config } = await import('@/utils/config');
      return {
        key: params.key,
        value: config(params.key),
      };
    });

    this.registerHandler('config.set', async (params, ctx) => {
      // Note: config is currently read-only in the codebase
      // This would need localStorage integration
      localStorage.setItem(`config_${params.key}`, params.value);
      return {
        success: true,
        key: params.key,
        value: params.value,
      };
    });

    this.registerHandler('config.getAll', async (params, ctx) => {
      // Get all config values
      // This would need to read from the config system
      const config: Record<string, string> = {};
      return { config };
    });

    this.registerHandler('config.update', async (params, ctx) => {
      let updated = 0;
      for (const [key, value] of Object.entries(params.config)) {
        localStorage.setItem(`config_${key}`, value);
        updated++;
      }
      return {
        success: true,
        updated,
      };
    });

    // =========================================================================
    // SCENARIO MANAGEMENT
    // =========================================================================

    this.registerHandler('scenario.load', async (params, ctx) => {
      // This would need to be implemented in the Viewer class
      // await ctx.viewer.loadScenario(params.scenarioUrl);
      return {
        scenarioName: params.scenarioUrl,
        loaded: false,
      };
    });

    this.registerHandler('scenario.unload', async (params, ctx) => {
      // This would need to be implemented in the Viewer class
      return {
        loaded: false,
      };
    });

    this.registerHandler('scenario.getState', async (params, ctx) => {
      return {
        loaded: false,
      };
    });

    // =========================================================================
    // VIEWER MANAGEMENT
    // =========================================================================

    this.registerHandler('viewer.getState', async (params, ctx) => {
      return {
        isReady: ctx.viewer.isReady,
        hasModel: !!ctx.viewer.model,
        hasRoom: !!ctx.viewer.room,
      };
    });

    this.registerHandler('viewer.setCamera', async (params, ctx) => {
      // This would need to be implemented in the Viewer class
      return { success: false };
    });

    this.registerHandler('viewer.screenshot', async (params, ctx) => {
      // This would need to be implemented in the Viewer class
      return { imageData: '' };
    });

    this.registerHandler('viewer.resetCamera', async (params, ctx) => {
      if (ctx.viewer.resetCamera) {
        ctx.viewer.resetCamera();
        return { success: true };
      }
      return { success: false };
    });

    this.registerHandler('viewer.setBackground', async (params, ctx) => {
      // This would need to be implemented in the Viewer class
      return { success: false };
    });

    this.registerHandler('viewer.setLighting', async (params, ctx) => {
      // This would need to be implemented in the Viewer class
      return { success: false };
    });

    this.registerHandler('viewer.setPhysics', async (params, ctx) => {
      // This would need to be implemented in the Viewer class
      return { success: false };
    });

    // =========================================================================
    // MODEL MANAGEMENT
    // =========================================================================

    this.registerHandler('model.load', async (params, ctx) => {
      if (!ctx.viewer.loadVrm) {
        throw new Error('Viewer not initialized');
      }

      await ctx.viewer.loadVrm(params.modelUrl, (progress) => {
        // Optionally send progress events
        if (params.onProgress && this.transport) {
          this.transport.broadcast({
            jsonrpc: '2.0',
            method: 'model.loadProgress',
            params: { progress, modelUrl: params.modelUrl }
          });
        }
      });

      return {
        success: true,
        loaded: !!ctx.viewer.model,
        modelUrl: params.modelUrl
      };
    });

    this.registerHandler('model.unload', async (params, ctx) => {
      if (ctx.viewer.unloadVRM) {
        ctx.viewer.unloadVRM();
        return { success: true };
      }
      return { success: false };
    });

    this.registerHandler('model.setPosition', async (params, ctx) => {
      if (!ctx.viewer.model) {
        throw new Error('No model loaded');
      }

      ctx.viewer.model.position.set(
        params.position.x,
        params.position.y,
        params.position.z
      );

      return {
        success: true,
        position: params.position
      };
    });

    this.registerHandler('model.setRotation', async (params, ctx) => {
      if (!ctx.viewer.model) {
        throw new Error('No model loaded');
      }

      ctx.viewer.model.rotation.set(
        params.rotation.x,
        params.rotation.y,
        params.rotation.z
      );

      return {
        success: true,
        rotation: params.rotation
      };
    });

    this.registerHandler('model.setScale', async (params, ctx) => {
      if (!ctx.viewer.model) {
        throw new Error('No model loaded');
      }

      ctx.viewer.model.scale.set(
        params.scale.x,
        params.scale.y,
        params.scale.z
      );

      return {
        success: true,
        scale: params.scale
      };
    });

    this.registerHandler('model.getTransform', async (params, ctx) => {
      if (!ctx.viewer.model) {
        throw new Error('No model loaded');
      }

      return {
        position: {
          x: ctx.viewer.model.position.x,
          y: ctx.viewer.model.position.y,
          z: ctx.viewer.model.position.z,
        },
        rotation: {
          x: ctx.viewer.model.rotation.x,
          y: ctx.viewer.model.rotation.y,
          z: ctx.viewer.model.rotation.z,
        },
        scale: {
          x: ctx.viewer.model.scale.x,
          y: ctx.viewer.model.scale.y,
          z: ctx.viewer.model.scale.z,
        },
      };
    });

    // =========================================================================
    // ROOM MANAGEMENT
    // =========================================================================

    this.registerHandler('room.load', async (params, ctx) => {
      if (!ctx.viewer.loadRoom) {
        throw new Error('Viewer not initialized');
      }

      const pos = params.position || { x: 0, y: 0, z: 0 };
      const rot = params.rotation || { x: 0, y: 0, z: 0 };
      const scale = params.scale || { x: 1, y: 1, z: 1 };

      await ctx.viewer.loadRoom(
        params.roomUrl,
        pos,
        { x: rot.x, y: rot.y, z: rot.z } as any,
        scale,
        (progress) => {
          // Optionally send progress events
          if (params.onProgress && this.transport) {
            this.transport.broadcast({
              jsonrpc: '2.0',
              method: 'room.loadProgress',
              params: { progress, roomUrl: params.roomUrl }
            });
          }
        }
      );

      return {
        success: true,
        loaded: !!ctx.viewer.room,
        roomUrl: params.roomUrl
      };
    });

    this.registerHandler('room.unload', async (params, ctx) => {
      if (ctx.viewer.unloadRoom) {
        ctx.viewer.unloadRoom();
        return { success: true };
      }
      return { success: false };
    });

    this.registerHandler('room.setPosition', async (params, ctx) => {
      if (!ctx.viewer.room) {
        throw new Error('No room loaded');
      }

      ctx.viewer.room.position.set(
        params.position.x,
        params.position.y,
        params.position.z
      );

      return {
        success: true,
        position: params.position
      };
    });

    this.registerHandler('room.setRotation', async (params, ctx) => {
      if (!ctx.viewer.room) {
        throw new Error('No room loaded');
      }

      ctx.viewer.room.rotation.set(
        params.rotation.x,
        params.rotation.y,
        params.rotation.z
      );

      return {
        success: true,
        rotation: params.rotation
      };
    });

    this.registerHandler('room.setScale', async (params, ctx) => {
      if (!ctx.viewer.room) {
        throw new Error('No room loaded');
      }

      ctx.viewer.room.scale.set(
        params.scale.x,
        params.scale.y,
        params.scale.z
      );

      return {
        success: true,
        scale: params.scale
      };
    });

    this.registerHandler('room.getTransform', async (params, ctx) => {
      if (!ctx.viewer.room) {
        throw new Error('No room loaded');
      }

      return {
        position: {
          x: ctx.viewer.room.position.x,
          y: ctx.viewer.room.position.y,
          z: ctx.viewer.room.position.z,
        },
        rotation: {
          x: ctx.viewer.room.rotation.x,
          y: ctx.viewer.room.rotation.y,
          z: ctx.viewer.room.rotation.z,
        },
        scale: {
          x: ctx.viewer.room.scale.x,
          y: ctx.viewer.room.scale.y,
          z: ctx.viewer.room.scale.z,
        },
      };
    });

    this.registerHandler('room.loadSplat', async (params, ctx) => {
      if (!ctx.viewer.loadSplat) {
        throw new Error('Viewer not initialized');
      }

      const pos = params.position || { x: 0, y: 0, z: 0 };
      const rot = params.rotation || { x: 0, y: 0, z: 0 };
      const scale = params.scale || { x: 1, y: 1, z: 1 };

      await ctx.viewer.loadSplat(params.splatUrl);

      // Apply transform if provided
      if (ctx.viewer.room) {
        ctx.viewer.room.position.set(pos.x, pos.y, pos.z);
        ctx.viewer.room.rotation.set(rot.x, rot.y, rot.z);
        ctx.viewer.room.scale.set(scale.x, scale.y, scale.z);
      }

      return {
        success: true,
        loaded: true
      };
    });

    // =========================================================================
    // XR MANAGEMENT
    // =========================================================================

    this.registerHandler('xr.startSession', async (params, ctx) => {
      // This would need to be implemented in the Viewer class
      // XR session management
      return {
        success: false,
        sessionActive: false,
        mode: params.mode
      };
    });

    this.registerHandler('xr.endSession', async (params, ctx) => {
      // This would need to be implemented in the Viewer class
      return { success: false };
    });

    this.registerHandler('xr.getSessionState', async (params, ctx) => {
      // This would need to be implemented in the Viewer class
      return {
        active: false
      };
    });

    this.registerHandler('xr.setFoveation', async (params, ctx) => {
      // This would need to be implemented in the Viewer class
      return {
        success: false,
        level: params.level
      };
    });

    this.registerHandler('xr.setFramebufferScale', async (params, ctx) => {
      // This would need to be implemented in the Viewer class
      return {
        success: false,
        scale: params.scale
      };
    });

    // =========================================================================
    // EVENT SUBSCRIPTIONS
    // =========================================================================

    this.registerHandler('events.subscribe', async (params, ctx) => {
      if (!this.transport || !this.currentWebSocket) {
        throw new Error('Subscriptions only available over WebSocket');
      }

      const subscribed = this.transport.subscribe(this.currentWebSocket, params.events);

      return {
        subscribed,
        count: subscribed.length,
      };
    });

    this.registerHandler('events.unsubscribe', async (params, ctx) => {
      if (!this.transport || !this.currentWebSocket) {
        throw new Error('Subscriptions only available over WebSocket');
      }

      const unsubscribed = this.transport.unsubscribe(this.currentWebSocket, params.events);

      return {
        unsubscribed,
        count: unsubscribed.length,
      };
    });

    this.registerHandler('events.listSubscriptions', async (params, ctx) => {
      if (!this.transport || !this.currentWebSocket) {
        throw new Error('Subscriptions only available over WebSocket');
      }

      const subscriptions = this.transport.getSubscriptions(this.currentWebSocket);

      return {
        subscriptions,
      };
    });

    // =========================================================================
    // UTILITY METHODS
    // =========================================================================

    this.registerHandler('system.ping', async (params, ctx) => {
      return {
        pong: true,
        timestamp: Date.now(),
      };
    });

    this.registerHandler('system.getVersion', async (params, ctx) => {
      return {
        version: '0.1.0',
        build: 'dev',
      };
    });

    this.registerHandler('system.getCapabilities', async (params, ctx) => {
      const methods = Array.from(this.handlers.keys()) as AmicaMethod[];
      const hooks: HookEvent[] = [
        'before:user:message:receive',
        'after:user:message:receive',
        'before:stt:transcribe',
        'after:stt:transcribe',
        'before:llm:request',
        'after:llm:request',
        'before:llm:stream',
        'on:llm:chunk',
        'after:llm:complete',
        'before:tts:generate',
        'after:tts:generate',
        'before:rvc:process',
        'after:rvc:process',
        'before:speak:start',
        'after:speak:end',
        'on:expression:change',
        'on:animation:play',
        'before:vision:capture',
        'after:vision:response',
        'scenario:loaded',
        'scenario:setup:complete',
        'scenario:update',
        'scenario:unload',
      ];
      return {
        methods,
        hooks,
      };
    });

    this.registerHandler('system.batch', async (params, ctx) => {
      const results = params.sequential
        ? await this.handleBatchSequential(params.actions)
        : await this.handleBatch(params.actions);

      const errors = results.filter((r) => r.error).length;
      const succeeded = results.length - errors;

      return {
        results,
        errors,
        succeeded,
      };
    });
  }

  /**
   * Handle batch requests sequentially
   */
  private async handleBatchSequential(
    requests: JsonRpcRequest[]
  ): Promise<JsonRpcResponse[]> {
    const results: JsonRpcResponse[] = [];
    for (const request of requests) {
      results.push(await this.handleRequest(request));
    }
    return results;
  }

  /**
   * Convert base64 encoded audio to Float32Array
   */
  private base64ToFloat32Array(base64: string): Float32Array {
    // Remove data URL prefix if present
    const base64Data = base64.replace(/^data:audio\/[a-z]+;base64,/, '');

    // Decode base64 to binary string
    const binaryString = atob(base64Data);

    // Convert binary string to Uint8Array
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Convert Uint8Array to Float32Array
    // Assuming 16-bit PCM audio
    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);

    for (let i = 0; i < int16Array.length; i++) {
      // Convert from int16 (-32768 to 32767) to float32 (-1.0 to 1.0)
      float32Array[i] = int16Array[i] / 32768.0;
    }

    return float32Array;
  }

  /**
   * Convert base64 encoded audio to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    // Remove data URL prefix if present
    const base64Data = base64.replace(/^data:audio\/[a-z]+;base64,/, '');

    // Decode base64 to binary string
    const binaryString = atob(base64Data);

    // Convert binary string to ArrayBuffer
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return bytes.buffer;
  }
}
