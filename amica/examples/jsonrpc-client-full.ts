/**
 * Complete Amica JSON-RPC Client Example
 *
 * This is a standalone, production-ready client that demonstrates:
 * - Event subscriptions
 * - Audio input/output
 * - Emotion control
 * - Hook management
 * - All major features
 */

import type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  HookEvent,
} from '../src/features/jsonrpc/protocol';

interface SubscriptionHandler {
  (event: HookEvent, data: any): void;
}

export class AmicaClient {
  private ws: WebSocket;
  private requestId = 0;
  private pending = new Map<number, {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
    timeout: NodeJS.Timeout;
  }>();
  private subscriptionHandlers = new Map<HookEvent, Set<SubscriptionHandler>>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;

  constructor(private url: string = 'ws://localhost:8765/amica/jsonrpc') {
    this.ws = this.connect();
  }

  /**
   * Connect to WebSocket server
   */
  private connect(): WebSocket {
    const ws = new WebSocket(this.url);

    ws.onopen = () => {
      console.log('[AmicaClient] Connected to Amica');
      this.reconnectAttempts = 0;
      this.emit('connected', {});
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        // Check if it's an event notification
        if (message.method && message.method.startsWith('event:')) {
          const eventName = message.method.substring(6) as HookEvent;
          this.handleEvent(eventName, message.params);
          return;
        }

        // Check if it's a server notification
        if (message.method && !message.id) {
          this.handleNotification(message);
          return;
        }

        // Handle JSON-RPC response
        if (message.id !== undefined) {
          this.handleResponse(message);
        }
      } catch (error) {
        console.error('[AmicaClient] Failed to parse message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[AmicaClient] WebSocket error:', error);
      this.emit('error', { error });
    };

    ws.onclose = () => {
      console.log('[AmicaClient] Disconnected from server');
      this.emit('disconnected', {});

      // Auto-reconnect with exponential backoff
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
        console.log(`[AmicaClient] Reconnecting in ${delay}ms...`);

        setTimeout(() => {
          this.reconnectAttempts++;
          this.ws = this.connect();
        }, delay);
      } else {
        console.error('[AmicaClient] Max reconnect attempts reached');
      }
    };

    return ws;
  }

  /**
   * Handle JSON-RPC response
   */
  private handleResponse(response: JsonRpcResponse): void {
    const pending = this.pending.get(response.id as number);
    if (!pending) {
      console.warn('[AmicaClient] Received response for unknown request:', response.id);
      return;
    }

    clearTimeout(pending.timeout);
    this.pending.delete(response.id as number);

    if (response.error) {
      pending.reject(new Error(`${response.error.message} (code: ${response.error.code})`));
    } else {
      pending.resolve(response.result);
    }
  }

  /**
   * Handle event from server
   */
  private handleEvent(event: HookEvent, data: any): void {
    const handlers = this.subscriptionHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(event, data);
        } catch (error) {
          console.error(`[AmicaClient] Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Handle notification from server
   */
  private handleNotification(notification: JsonRpcNotification): void {
    console.log('[AmicaClient] Notification:', notification);
    this.emit('notification', notification);
  }

  /**
   * Call a JSON-RPC method
   */
  async call<T = any>(method: string, params?: any, timeout = 30000): Promise<T> {
    return new Promise((resolve, reject) => {
      if (this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const id = ++this.requestId;
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method,
        params,
        id,
      };

      const timeoutHandle = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request timed out after ${timeout}ms`));
      }, timeout);

      this.pending.set(id, { resolve, reject, timeout: timeoutHandle });
      this.ws.send(JSON.stringify(request));
    });
  }

  /**
   * Subscribe to hook events
   */
  async subscribe(events: HookEvent | HookEvent[], handler?: SubscriptionHandler): Promise<void> {
    const eventArray = Array.isArray(events) ? events : [events];

    // Register local handler
    if (handler) {
      eventArray.forEach((event) => {
        if (!this.subscriptionHandlers.has(event)) {
          this.subscriptionHandlers.set(event, new Set());
        }
        this.subscriptionHandlers.get(event)!.add(handler);
      });
    }

    // Subscribe on server
    await this.call('events.subscribe', { events: eventArray });
  }

  /**
   * Unsubscribe from hook events
   */
  async unsubscribe(events: HookEvent | HookEvent[], handler?: SubscriptionHandler): Promise<void> {
    const eventArray = Array.isArray(events) ? events : [events];

    // Remove local handler
    if (handler) {
      eventArray.forEach((event) => {
        this.subscriptionHandlers.get(event)?.delete(handler);
      });
    } else {
      // Remove all handlers for these events
      eventArray.forEach((event) => {
        this.subscriptionHandlers.delete(event);
      });
    }

    // Unsubscribe on server
    await this.call('events.unsubscribe', { events: eventArray });
  }

  /**
   * On event handler (for internal events like connected, disconnected)
   */
  on(event: string, handler: Function): void {
    const hookEvent = event as HookEvent;
    if (!this.subscriptionHandlers.has(hookEvent)) {
      this.subscriptionHandlers.set(hookEvent, new Set());
    }
    this.subscriptionHandlers.get(hookEvent)!.add(handler as any);
  }

  /**
   * Emit internal event
   */
  private emit(event: string, data: any): void {
    const handlers = this.subscriptionHandlers.get(event as HookEvent);
    if (handlers) {
      handlers.forEach((handler) => handler(event as HookEvent, data));
    }
  }

  /**
   * Close the connection
   */
  close(): void {
    this.maxReconnectAttempts = 0; // Prevent reconnection
    this.ws.close();

    // Reject all pending requests
    this.pending.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error('Connection closed'));
    });
    this.pending.clear();
  }

  // =========================================================================
  // CONVENIENCE METHODS
  // =========================================================================

  // Chat
  async sendMessage(message: string) {
    return this.call('chat.sendMessage', { message });
  }

  async interrupt() {
    return this.call('chat.interrupt');
  }

  async getChatState() {
    return this.call('chat.getState');
  }

  // Audio
  async sendAudio(audio: string, transcribe = true) {
    return this.call('audio.send', { audio, transcribe });
  }

  async transcribeAudio(audio: string) {
    return this.call('audio.transcribe', { audio });
  }

  async playAudio(audio: string, screenplay?: any) {
    return this.call('audio.playback', { audio, screenplay });
  }

  // Character
  async setExpression(expression: string) {
    return this.call('character.setExpression', { expression });
  }

  async setEmotion(emotion: string, intensity = 1.0, duration = 0) {
    return this.call('character.setEmotion', { emotion, intensity, duration });
  }

  async speak(text: string, emotion?: string) {
    return this.call('character.speak', { text, emotion });
  }

  async playAnimation(animationUrl: string, loop = false) {
    return this.call('character.playAnimation', { animationUrl, loop });
  }

  async lookAt(target: { x: number; y: number; z: number }) {
    return this.call('character.lookAt', { target });
  }

  // Vision
  async processImage(imageData: string) {
    return this.call('vision.processImage', { imageData });
  }

  async captureScreenshot() {
    return this.call('vision.captureScreenshot');
  }

  // Config
  async getConfig(key: string) {
    return this.call('config.get', { key });
  }

  async setConfig(key: string, value: string) {
    return this.call('config.set', { key, value });
  }

  // Model
  async loadModel(modelUrl: string, onProgress = false) {
    return this.call('model.load', { modelUrl, onProgress });
  }

  async unloadModel() {
    return this.call('model.unload');
  }

  async setModelPosition(position: { x: number; y: number; z: number }) {
    return this.call('model.setPosition', { position });
  }

  async setModelRotation(rotation: { x: number; y: number; z: number }) {
    return this.call('model.setRotation', { rotation });
  }

  async setModelScale(scale: { x: number; y: number; z: number }) {
    return this.call('model.setScale', { scale });
  }

  async getModelTransform() {
    return this.call('model.getTransform');
  }

  // Room
  async loadRoom(roomUrl: string, position?: { x: number; y: number; z: number }, rotation?: { x: number; y: number; z: number }, scale?: { x: number; y: number; z: number }, onProgress = false) {
    return this.call('room.load', { roomUrl, position, rotation, scale, onProgress });
  }

  async unloadRoom() {
    return this.call('room.unload');
  }

  async setRoomPosition(position: { x: number; y: number; z: number }) {
    return this.call('room.setPosition', { position });
  }

  async setRoomRotation(rotation: { x: number; y: number; z: number }) {
    return this.call('room.setRotation', { rotation });
  }

  async setRoomScale(scale: { x: number; y: number; z: number }) {
    return this.call('room.setScale', { scale });
  }

  async getRoomTransform() {
    return this.call('room.getTransform');
  }

  async loadSplat(splatUrl: string, position?: { x: number; y: number; z: number }, rotation?: { x: number; y: number; z: number }, scale?: { x: number; y: number; z: number }) {
    return this.call('room.loadSplat', { splatUrl, position, rotation, scale });
  }

  // XR
  async startXRSession(mode: 'immersive-vr' | 'immersive-ar' | 'inline' = 'immersive-vr', referenceSpaceType: 'local' | 'local-floor' | 'bounded-floor' | 'unbounded' = 'local-floor') {
    return this.call('xr.startSession', { mode, referenceSpaceType });
  }

  async endXRSession() {
    return this.call('xr.endSession');
  }

  async getXRSessionState() {
    return this.call('xr.getSessionState');
  }

  async setXRFoveation(level: number) {
    return this.call('xr.setFoveation', { level });
  }

  async setXRFramebufferScale(scale: number) {
    return this.call('xr.setFramebufferScale', { scale });
  }

  // System
  async ping() {
    return this.call('system.ping');
  }

  async getCapabilities() {
    return this.call('system.getCapabilities');
  }
}

// =============================================================================
// USAGE EXAMPLES
// =============================================================================

/**
 * Example 1: Basic usage with subscriptions
 */
export async function example1_BasicSubscriptions() {
  const client = new AmicaClient();

  // Wait for connection
  await new Promise((resolve) => client.on('connected', resolve));

  // Subscribe to LLM events
  await client.subscribe(['before:llm:request', 'after:llm:complete'], (event, data) => {
    console.log(`Event: ${event}`, data);
  });

  // Send a message
  await client.sendMessage('Tell me a joke!');

  // The subscribed events will fire as the message is processed
}

/**
 * Example 2: Audio input with transcription
 */
export async function example2_AudioInput() {
  const client = new AmicaClient();

  await new Promise((resolve) => client.on('connected', resolve));

  // Subscribe to STT events
  await client.subscribe('after:stt:transcribe', (event, data) => {
    console.log('Transcribed:', data.transcript);
  });

  // Send audio (assuming you have base64 encoded audio)
  const audioBase64 = 'data:audio/wav;base64,UklGRi...';
  const result = await client.sendAudio(audioBase64, true);

  console.log('Audio sent:', result);
}

/**
 * Example 3: Direct audio playback (bypass TTS)
 */
export async function example3_AudioPlayback() {
  const client = new AmicaClient();

  await new Promise((resolve) => client.on('connected', resolve));

  // Load pre-generated audio (e.g., from your own TTS system)
  const audioBase64 = 'data:audio/wav;base64,UklGRi...';

  // Play audio with custom screenplay
  await client.playAudio(audioBase64, {
    expression: 'happy',
    talk: {
      message: 'This is custom generated audio!',
      style: 'talk',
      emotion: 'excited',
    },
  });
}

/**
 * Example 4: Emotion control with event monitoring
 */
export async function example4_EmotionControl() {
  const client = new AmicaClient();

  await new Promise((resolve) => client.on('connected', resolve));

  // Subscribe to expression changes
  await client.subscribe('on:expression:change', (event, data) => {
    console.log('Expression changed to:', data.expression);
  });

  // Set emotion with intensity and duration
  await client.setEmotion('happy', 0.8, 5000);

  // Wait 5 seconds
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Change to another emotion
  await client.setEmotion('surprised', 1.0, 3000);
}

/**
 * Example 5: Complex interaction flow
 */
export async function example5_ComplexFlow() {
  const client = new AmicaClient();

  await new Promise((resolve) => client.on('connected', resolve));

  // Subscribe to multiple events
  await client.subscribe([
    'after:user:message:receive',
    'on:llm:chunk',
    'after:llm:complete',
    'before:tts:generate',
    'after:tts:generate',
    'before:speak:start',
    'after:speak:end',
  ], (event, data) => {
    console.log(`[${event}]`, JSON.stringify(data).substring(0, 100));
  });

  // 1. Set initial emotion
  await client.setEmotion('neutral', 1.0);

  // 2. Send a message
  await client.sendMessage('Can you help me with a creative project?');

  // 3. Wait for response to complete (listen for after:speak:end event)
  await new Promise((resolve) => {
    client.subscribe('after:speak:end', (event, data) => {
      resolve(data);
    });
  });

  // 4. React to completion
  await client.setEmotion('happy', 0.9, 3000);
}

/**
 * Example 6: Hook management
 */
export async function example6_HookManagement() {
  const client = new AmicaClient();

  await new Promise((resolve) => client.on('connected', resolve));

  // List all available hooks
  const capabilities = await client.getCapabilities();
  console.log('Available hooks:', capabilities.hooks);

  // Subscribe to a specific set of hooks
  await client.subscribe(capabilities.hooks.slice(0, 5));

  // List current subscriptions
  const subscriptions = await client.call('events.listSubscriptions');
  console.log('Current subscriptions:', subscriptions);

  // Unsubscribe from some events
  await client.unsubscribe(capabilities.hooks.slice(0, 2));
}

/**
 * Example 7: Real-time monitoring dashboard
 */
export async function example7_MonitoringDashboard() {
  const client = new AmicaClient();

  await new Promise((resolve) => client.on('connected', resolve));

  // Subscribe to all events for monitoring
  const { hooks } = await client.getCapabilities();

  const stats = {
    messages: 0,
    llmChunks: 0,
    ttsGenerations: 0,
    speeches: 0,
  };

  await client.subscribe(hooks, (event, data) => {
    switch (event) {
      case 'after:user:message:receive':
        stats.messages++;
        break;
      case 'on:llm:chunk':
        stats.llmChunks++;
        break;
      case 'after:tts:generate':
        stats.ttsGenerations++;
        break;
      case 'before:speak:start':
        stats.speeches++;
        break;
    }

    console.log('Stats:', stats);
  });

  // The stats will update in real-time as events occur
}

/**
 * Example 8: Graceful shutdown
 */
export async function example8_GracefulShutdown() {
  const client = new AmicaClient();

  await new Promise((resolve) => client.on('connected', resolve));

  // Do some work
  await client.sendMessage('Hello!');

  // Listen for disconnection
  client.on('disconnected', (event, data) => {
    console.log('Client disconnected gracefully');
  });

  // Close the connection
  client.close();
}

/**
 * Example 9: VRM/Room Loading and 3D Manipulation
 */
export async function example9_VRMAndRoomManagement() {
  const client = new AmicaClient();

  await new Promise((resolve) => client.on('connected', resolve));

  // Load a VRM model
  console.log('Loading VRM model...');
  const modelResult = await client.loadModel('https://example.com/model.vrm', true);
  console.log('Model loaded:', modelResult);

  // Position the model
  await client.setModelPosition({ x: 0, y: 0, z: -2 });
  await client.setModelRotation({ x: 0, y: Math.PI / 4, z: 0 });
  await client.setModelScale({ x: 1, y: 1, z: 1 });

  // Get current transform
  const transform = await client.getModelTransform();
  console.log('Model transform:', transform);

  // Load a room/environment
  console.log('Loading room...');
  const roomResult = await client.loadRoom(
    'https://example.com/room.glb',
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 1, z: 1 },
    true
  );
  console.log('Room loaded:', roomResult);

  // Or load a Gaussian Splat scene
  await client.loadSplat('https://example.com/scene.splat');
}

/**
 * Example 10: VR/XR Session Management
 */
export async function example10_XRSession() {
  const client = new AmicaClient();

  await new Promise((resolve) => client.on('connected', resolve));

  // Start an immersive VR session
  console.log('Starting VR session...');
  const session = await client.startXRSession('immersive-vr', 'local-floor');
  console.log('VR session started:', session);

  // Optimize for performance
  await client.setXRFoveation(0.5); // 50% foveation
  await client.setXRFramebufferScale(1.2); // 120% resolution

  // Check session state
  const state = await client.getXRSessionState();
  console.log('XR session state:', state);

  // End the session
  await client.endXRSession();
  console.log('VR session ended');
}

// =============================================================================
// RUN ALL EXAMPLES
// =============================================================================

if (require.main === module) {
  (async () => {
    console.log('Running Amica JSON-RPC client examples...\n');

    try {
      console.log('=== Example 1: Basic Subscriptions ===');
      await example1_BasicSubscriptions();

      console.log('\n=== Example 4: Emotion Control ===');
      await example4_EmotionControl();

      console.log('\n=== Example 6: Hook Management ===');
      await example6_HookManagement();

      console.log('\nAll examples completed!');
    } catch (error) {
      console.error('Error running examples:', error);
    }
  })();
}
