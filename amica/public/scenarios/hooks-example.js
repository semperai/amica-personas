class Scenario {
  /*
   * Description: Example scenario demonstrating the Hooks system
   * Version: 1.0
   *
   * This scenario shows how to use hooks to intercept and modify
   * various pipeline stages (user input, LLM, TTS, vision, etc.)
   */
  constructor(ctx) {
    console.log('Hooks Example Scenario - Constructor', ctx);
    this.$ = ctx.scope;
    this.THREE = ctx.THREE;
    this.hookManager = ctx.hookManager;
    this.hookIds = [];

    if (!this.hookManager) {
      console.warn('HookManager not available in this scenario context');
    }
  }

  async setup() {
    console.log('Hooks Example Scenario - Setup');
    const $ = this.$;
    const THREE = this.THREE;

    // Load default VRM model
    await $.loadVrm('/vrm/AvatarSample_B.vrm', (progress) => {
      console.log(`Loading model ${progress}`);
    });

    // Register hooks if hookManager is available
    if (this.hookManager) {
      this.registerHooks();
    }
  }

  registerHooks() {
    console.log('Registering hooks...');

    // Example 1: Log all user messages before processing
    const beforeUserHook = this.hookManager.register(
      'before:user:message:receive',
      (context) => {
        console.log('[Hook] User message received:', context.message);
        return context;
      },
      { priority: 10 }
    );
    this.hookIds.push(beforeUserHook);

    // Example 2: Transform user messages (add emoji)
    const afterUserHook = this.hookManager.register(
      'after:user:message:receive',
      (context) => {
        console.log('[Hook] Processing user message:', context.message);
        // You could modify the message here if needed
        return context;
      }
    );
    this.hookIds.push(afterUserHook);

    // Example 3: Log LLM requests
    const beforeLLMHook = this.hookManager.register(
      'before:llm:request',
      (context) => {
        console.log('[Hook] LLM Request to backend:', context.backend);
        console.log('[Hook] Message count:', context.messages.length);
        return context;
      }
    );
    this.hookIds.push(beforeLLMHook);

    // Example 4: Track LLM chunks (for performance monitoring)
    let chunkCount = 0;
    const chunkHook = this.hookManager.register(
      'on:llm:chunk',
      (context) => {
        chunkCount++;
        if (chunkCount % 10 === 0) {
          console.log(`[Hook] Received ${chunkCount} chunks so far...`);
        }
        return context;
      }
    );
    this.hookIds.push(chunkHook);

    // Example 5: Log when LLM completes
    const afterLLMHook = this.hookManager.register(
      'after:llm:complete',
      (context) => {
        console.log('[Hook] LLM Response complete');
        console.log('[Hook] Response length:', context.response.length);
        chunkCount = 0; // Reset for next request
        return context;
      }
    );
    this.hookIds.push(afterLLMHook);

    // Example 6: Log TTS generation
    const beforeTTSHook = this.hookManager.register(
      'before:tts:generate',
      (context) => {
        console.log('[Hook] Generating TTS for:', context.text.substring(0, 50) + '...');
        console.log('[Hook] TTS Backend:', context.backend);
        return context;
      }
    );
    this.hookIds.push(beforeTTSHook);

    // Example 7: Log TTS completion
    const afterTTSHook = this.hookManager.register(
      'after:tts:generate',
      (context) => {
        if (context.audioBuffer) {
          console.log('[Hook] TTS audio generated, buffer size:', context.audioBuffer.byteLength);
        } else {
          console.log('[Hook] TTS generated null audio (muted or error)');
        }
        return context;
      }
    );
    this.hookIds.push(afterTTSHook);

    // Example 8: Log vision capture
    const beforeVisionHook = this.hookManager.register(
      'before:vision:capture',
      (context) => {
        console.log('[Hook] Vision capture initiated');
        console.log('[Hook] Image data length:', context.imageData.length);
        return context;
      }
    );
    this.hookIds.push(beforeVisionHook);

    // Example 9: Log vision response
    const afterVisionHook = this.hookManager.register(
      'after:vision:response',
      (context) => {
        console.log('[Hook] Vision response:', context.response.substring(0, 100) + '...');
        return context;
      }
    );
    this.hookIds.push(afterVisionHook);

    // Example 10: Conditional hook - only log long responses
    const conditionalHook = this.hookManager.register(
      'after:llm:complete',
      (context) => {
        console.log('[Hook] This is a LONG response!');
        return context;
      },
      {
        priority: 200, // Run after other hooks
        condition: (context) => context.response.length > 500,
        timeout: 1000
      }
    );
    this.hookIds.push(conditionalHook);

    console.log(`Registered ${this.hookIds.length} hooks`);

    // Log initial metrics
    this.logMetrics();
  }

  logMetrics() {
    if (!this.hookManager) return;

    console.log('\n=== Hook Metrics ===');
    this.hookIds.forEach(hookId => {
      const metrics = this.hookManager.getMetrics(hookId);
      if (metrics && metrics.calls > 0) {
        console.log(`Hook ${hookId}:`, {
          calls: metrics.calls,
          avgDuration: metrics.avgDuration.toFixed(2) + 'ms',
          errors: metrics.errors
        });
      }
    });
    console.log('===================\n');
  }

  update(delta) {
    // Log metrics every 30 seconds
    if (!this.lastMetricsLog) {
      this.lastMetricsLog = 0;
    }

    this.lastMetricsLog += delta;
    if (this.lastMetricsLog > 30) {
      this.logMetrics();
      this.lastMetricsLog = 0;
    }
  }

  // Clean up hooks when scenario is unloaded
  async cleanup() {
    console.log('Cleaning up hooks...');
    if (this.hookManager) {
      this.hookIds.forEach(hookId => {
        this.hookManager.unregister(hookId);
      });
      console.log(`Unregistered ${this.hookIds.length} hooks`);
    }
  }
}
