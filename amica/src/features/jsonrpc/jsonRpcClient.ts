/**
 * Example TypeScript client for Amica JSON-RPC API
 *
 * This can be used as a reference implementation or copied to your project
 */

import {
  JsonRpcRequest,
  JsonRpcResponse,
  AmicaMethod,
  MethodParamsMap,
  MethodResultMap,
} from './protocol';

export class AmicaJsonRpcClient {
  private ws?: WebSocket;
  private requestId = 0;
  private pending = new Map<number, {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
    timeout: NodeJS.Timeout;
  }>();
  private defaultTimeout = 30000;

  constructor(
    private url: string = 'ws://localhost:8765/amica/jsonrpc',
    private transport: 'websocket' | 'http' = 'websocket'
  ) {
    if (transport === 'websocket') {
      this.connectWebSocket();
    }
  }

  /**
   * Connect to WebSocket server
   */
  private connectWebSocket(): void {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('[AmicaClient] Connected to Amica JSON-RPC server');
    };

    this.ws.onmessage = (event) => {
      try {
        const response: JsonRpcResponse = JSON.parse(event.data);
        this.handleResponse(response);
      } catch (error) {
        console.error('[AmicaClient] Failed to parse response:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('[AmicaClient] WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('[AmicaClient] Disconnected from server');
      // Auto-reconnect after 5 seconds
      setTimeout(() => this.connectWebSocket(), 5000);
    };
  }

  /**
   * Handle JSON-RPC response
   */
  private handleResponse(response: JsonRpcResponse): void {
    if (response.id === null || response.id === undefined) {
      // This is a notification from server
      console.log('[AmicaClient] Received notification:', response);
      return;
    }

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
   * Call a JSON-RPC method
   */
  async call<M extends AmicaMethod>(
    method: M,
    params?: MethodParamsMap[M],
    timeout?: number
  ): Promise<MethodResultMap[M]> {
    const id = ++this.requestId;

    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id,
    };

    return new Promise((resolve, reject) => {
      const timeoutMs = timeout || this.defaultTimeout;
      const timeoutHandle = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timeout: timeoutHandle });

      if (this.transport === 'websocket') {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          reject(new Error('WebSocket not connected'));
          return;
        }
        this.ws.send(JSON.stringify(request));
      } else {
        this.sendHttpRequest(request).then(resolve).catch(reject);
      }
    });
  }

  /**
   * Send HTTP request
   */
  private async sendHttpRequest<M extends AmicaMethod>(
    request: JsonRpcRequest
  ): Promise<MethodResultMap[M]> {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    const data: JsonRpcResponse = await response.json();

    if (data.error) {
      throw new Error(`${data.error.message} (code: ${data.error.code})`);
    }

    return data.result as MethodResultMap[M];
  }

  /**
   * Send a notification (no response expected)
   */
  notify<M extends AmicaMethod>(method: M, params?: MethodParamsMap[M]): void {
    const notification = {
      jsonrpc: '2.0' as const,
      method,
      params,
    };

    if (this.transport === 'websocket') {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(notification));
      }
    } else {
      // HTTP doesn't support notifications
      console.warn('[AmicaClient] Notifications not supported over HTTP');
    }
  }

  /**
   * Close the connection
   */
  close(): void {
    if (this.ws) {
      this.ws.close();
    }

    // Reject all pending requests
    this.pending.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error('Connection closed'));
    });
    this.pending.clear();
  }

  // =========================================================================
  // CONVENIENCE METHODS - High-level API
  // =========================================================================

  /**
   * Chat Methods
   */
  async sendMessage(message: string) {
    return this.call('chat.sendMessage', { message });
  }

  async interrupt() {
    return this.call('chat.interrupt');
  }

  async getChatState() {
    return this.call('chat.getState');
  }

  async isAwake() {
    return this.call('chat.isAwake');
  }

  /**
   * Audio Methods
   */
  async sendAudio(audio: string, transcribe = true, format: 'wav' | 'mp3' = 'wav') {
    return this.call('audio.send', { audio, transcribe, format });
  }

  async transcribeAudio(audio: string, format: 'wav' | 'mp3' = 'wav') {
    return this.call('audio.transcribe', { audio, format });
  }

  /**
   * Character Methods
   */
  async setExpression(expression: string) {
    return this.call('character.setExpression', { expression });
  }

  async setEmotion(emotion: string, intensity = 1.0, duration = 0) {
    return this.call('character.setEmotion', { emotion, intensity, duration });
  }

  async speak(text: string, emotion?: string) {
    return this.call('character.speak', { text, emotion });
  }

  async stopSpeaking() {
    return this.call('character.stopSpeaking');
  }

  async playAnimation(animationUrl: string, loop = false) {
    return this.call('character.playAnimation', { animationUrl, loop });
  }

  async lookAt(target: { x: number; y: number; z: number }) {
    return this.call('character.lookAt', { target });
  }

  async setAutoLookAt(enabled: boolean) {
    return this.call('character.setAutoLookAt', { enabled });
  }

  async setAutoBlink(enabled: boolean) {
    return this.call('character.setAutoBlink', { enabled });
  }

  /**
   * Vision Methods
   */
  async processImage(imageData: string) {
    return this.call('vision.processImage', { imageData });
  }

  async captureScreenshot() {
    return this.call('vision.captureScreenshot');
  }

  /**
   * Hook Methods
   */
  async registerHook(
    event: string,
    options?: { priority?: number; timeout?: number; callbackUrl?: string }
  ) {
    return this.call('hooks.register', { event: event as any, ...options });
  }

  async unregisterHook(hookId: string) {
    return this.call('hooks.unregister', { hookId });
  }

  async listHooks(event?: string) {
    return this.call('hooks.list', { event: event as any });
  }

  async getHookMetrics(hookId?: string, event?: string) {
    return this.call('hooks.getMetrics', { hookId, event: event as any });
  }

  /**
   * Config Methods
   */
  async getConfig(key: string) {
    return this.call('config.get', { key });
  }

  async setConfig(key: string, value: string) {
    return this.call('config.set', { key, value });
  }

  async getAllConfig() {
    return this.call('config.getAll');
  }

  /**
   * Scenario Methods
   */
  async loadScenario(scenarioUrl: string) {
    return this.call('scenario.load', { scenarioUrl });
  }

  async unloadScenario() {
    return this.call('scenario.unload');
  }

  async getScenarioState() {
    return this.call('scenario.getState');
  }

  /**
   * System Methods
   */
  async ping() {
    return this.call('system.ping');
  }

  async getVersion() {
    return this.call('system.getVersion');
  }

  async getCapabilities() {
    return this.call('system.getCapabilities');
  }

  /**
   * Execute multiple requests in batch
   */
  async batch(requests: JsonRpcRequest[], sequential = false) {
    return this.call('system.batch', { actions: requests, sequential });
  }
}

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/**
 * Example: Basic usage
 */
export async function exampleBasicUsage() {
  const client = new AmicaJsonRpcClient();

  // Send a message
  await client.sendMessage('Hello, Amica!');

  // Set emotion
  await client.setEmotion('happy', 0.8, 5000);

  // Make character speak
  await client.speak('I am so happy to meet you!', 'excited');
}

/**
 * Example: Audio input
 */
export async function exampleAudioInput() {
  const client = new AmicaJsonRpcClient();

  // Assuming you have audio data as base64
  const audioBase64 = 'data:audio/wav;base64,UklGRi...';

  // Send audio for transcription and processing
  const result = await client.sendAudio(audioBase64, true);
  console.log('Transcription:', result.transcription);
}

/**
 * Example: Hook registration
 */
export async function exampleHooks() {
  const client = new AmicaJsonRpcClient();

  // Register a hook to intercept all user messages
  const hook = await client.registerHook('before:user:message:receive', {
    priority: 10,
    timeout: 5000,
  });

  console.log('Registered hook:', hook.hookId);

  // Later, unregister the hook
  await client.unregisterHook(hook.hookId);
}

/**
 * Example: Complex interaction flow
 */
export async function exampleComplexFlow() {
  const client = new AmicaJsonRpcClient();

  // 1. Set character to neutral state
  await client.setEmotion('neutral', 1.0);

  // 2. Process an image
  const screenshot = await client.captureScreenshot();
  const visionResult = await client.processImage(screenshot.imageData);

  // 3. React based on vision
  await client.setEmotion('surprised', 0.9, 3000);
  await client.speak('Wow! I see something interesting!');

  // 4. Wait for user response
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 5. Return to neutral
  await client.setEmotion('neutral', 1.0);
}

/**
 * Example: Batch operations
 */
export async function exampleBatch() {
  const client = new AmicaJsonRpcClient();

  const result = await client.batch([
    {
      jsonrpc: '2.0',
      method: 'character.setEmotion',
      params: { emotion: 'happy', intensity: 0.8 },
      id: 1,
    },
    {
      jsonrpc: '2.0',
      method: 'character.speak',
      params: { text: 'Hello!' },
      id: 2,
    },
    {
      jsonrpc: '2.0',
      method: 'chat.sendMessage',
      params: { message: 'How are you?' },
      id: 3,
    },
  ], true); // sequential = true

  console.log('Batch result:', result);
}
