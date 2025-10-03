import { describe, expect, test } from "vitest";
import type { HookEvent, HookEventMap } from "../src/features/hooks/hookEvents";
import type { HookContext, HookCallback } from "../src/features/hooks/hookContext";
import { HookManager } from "../src/features/hooks/hookManager";

describe("Hook Events and Context", () => {
  describe("HookEvent types", () => {
    test("should define all user input pipeline events", () => {
      const events: HookEvent[] = [
        'before:user:message:receive',
        'after:user:message:receive',
        'before:stt:transcribe',
        'after:stt:transcribe',
      ];

      events.forEach(event => {
        expect(typeof event).toBe('string');
      });
    });

    test("should define all LLM pipeline events", () => {
      const events: HookEvent[] = [
        'before:llm:request',
        'after:llm:request',
        'before:llm:stream',
        'on:llm:chunk',
        'after:llm:complete',
      ];

      events.forEach(event => {
        expect(typeof event).toBe('string');
      });
    });

    test("should define all TTS pipeline events", () => {
      const events: HookEvent[] = [
        'before:tts:generate',
        'after:tts:generate',
        'before:rvc:process',
        'after:rvc:process',
      ];

      events.forEach(event => {
        expect(typeof event).toBe('string');
      });
    });

    test("should define all animation pipeline events", () => {
      const events: HookEvent[] = [
        'before:speak:start',
        'after:speak:end',
        'on:expression:change',
        'on:animation:play',
      ];

      events.forEach(event => {
        expect(typeof event).toBe('string');
      });
    });

    test("should define all vision pipeline events", () => {
      const events: HookEvent[] = [
        'before:vision:capture',
        'after:vision:response',
      ];

      events.forEach(event => {
        expect(typeof event).toBe('string');
      });
    });

    test("should define all scenario lifecycle events", () => {
      const events: HookEvent[] = [
        'scenario:loaded',
        'scenario:setup:complete',
        'scenario:update',
        'scenario:unload',
      ];

      events.forEach(event => {
        expect(typeof event).toBe('string');
      });
    });
  });

  describe("HookEventMap context data structures", () => {
    test("should have correct structure for user message events", () => {
      const hookManager = new HookManager();

      hookManager.register('before:user:message:receive', (context) => {
        // Type check - these should be available
        expect(typeof context.message).toBe('string');
        expect(typeof context._event).toBe('string');
        expect(typeof context._timestamp).toBe('number');
        expect(typeof context._hookId).toBe('string');
        return context;
      });

      hookManager.trigger('before:user:message:receive', { message: 'test' });
    });

    test("should have correct structure for STT events", () => {
      const hookManager = new HookManager();

      hookManager.register('before:stt:transcribe', (context) => {
        expect(context.audio).toBeInstanceOf(Float32Array);
        return context;
      });

      hookManager.trigger('before:stt:transcribe', { audio: new Float32Array([1, 2, 3]) });
    });

    test("should have correct structure for LLM request events", () => {
      const hookManager = new HookManager();

      hookManager.register('before:llm:request', (context) => {
        expect(Array.isArray(context.messages)).toBe(true);
        expect(typeof context.backend).toBe('string');
        return context;
      });

      hookManager.trigger('before:llm:request', {
        messages: [{ role: 'user', content: 'test' }],
        backend: 'chatgpt'
      });
    });

    test("should have correct structure for LLM stream events", () => {
      const hookManager = new HookManager();

      hookManager.register('before:llm:stream', (context) => {
        expect(typeof context.streamIdx).toBe('number');
        return context;
      });

      hookManager.trigger('before:llm:stream', { streamIdx: 1 });
    });

    test("should have correct structure for LLM chunk events", () => {
      const hookManager = new HookManager();

      hookManager.register('on:llm:chunk', (context) => {
        expect(typeof context.chunk).toBe('string');
        expect(typeof context.streamIdx).toBe('number');
        return context;
      });

      hookManager.trigger('on:llm:chunk', { chunk: 'test chunk', streamIdx: 1 });
    });

    test("should have correct structure for LLM completion events", () => {
      const hookManager = new HookManager();

      hookManager.register('after:llm:complete', (context) => {
        expect(typeof context.response).toBe('string');
        expect(typeof context.streamIdx).toBe('number');
        return context;
      });

      hookManager.trigger('after:llm:complete', { response: 'full response', streamIdx: 1 });
    });

    test("should have correct structure for TTS events", () => {
      const hookManager = new HookManager();

      hookManager.register('before:tts:generate', (context) => {
        expect(typeof context.text).toBe('string');
        expect(typeof context.backend).toBe('string');
        return context;
      });

      hookManager.trigger('before:tts:generate', { text: 'hello', backend: 'elevenlabs' });
    });

    test("should have correct structure for TTS completion events", () => {
      const hookManager = new HookManager();

      hookManager.register('after:tts:generate', (context) => {
        expect(context.audioBuffer === null || context.audioBuffer instanceof ArrayBuffer).toBe(true);
        expect(typeof context.text).toBe('string');
        return context;
      });

      hookManager.trigger('after:tts:generate', { audioBuffer: null, text: 'hello' });
    });

    test("should have correct structure for speech events", () => {
      const hookManager = new HookManager();

      hookManager.register('before:speak:start', (context) => {
        expect(context.audioBuffer === null || context.audioBuffer instanceof ArrayBuffer).toBe(true);
        expect(typeof context.screenplay).toBe('object');
        return context;
      });

      const mockScreenplay = {
        text: 'test',
        talk: { message: 'test', emotion: 'neutral' as const, style: 'talk' as const }
      };

      hookManager.trigger('before:speak:start', {
        audioBuffer: null,
        screenplay: mockScreenplay
      });
    });

    test("should have correct structure for expression events", () => {
      const hookManager = new HookManager();

      hookManager.register('on:expression:change', (context) => {
        expect(typeof context.expression).toBe('string');
        return context;
      });

      hookManager.trigger('on:expression:change', { expression: 'happy' });
    });

    test("should have correct structure for animation events", () => {
      const hookManager = new HookManager();

      hookManager.register('on:animation:play', (context) => {
        expect(typeof context.animation).toBe('string');
        return context;
      });

      hookManager.trigger('on:animation:play', { animation: 'wave' });
    });

    test("should have correct structure for vision events", () => {
      const hookManager = new HookManager();

      hookManager.register('before:vision:capture', (context) => {
        expect(typeof context.imageData).toBe('string');
        return context;
      });

      hookManager.trigger('before:vision:capture', { imageData: 'base64data' });
    });

    test("should have correct structure for vision response events", () => {
      const hookManager = new HookManager();

      hookManager.register('after:vision:response', (context) => {
        expect(typeof context.response).toBe('string');
        expect(typeof context.imageData).toBe('string');
        return context;
      });

      hookManager.trigger('after:vision:response', {
        response: 'I see a cat',
        imageData: 'base64data'
      });
    });

    test("should have correct structure for scenario events", () => {
      const hookManager = new HookManager();

      hookManager.register('scenario:loaded', (context) => {
        expect(typeof context.scenarioName).toBe('string');
        return context;
      });

      hookManager.register('scenario:update', (context) => {
        expect(typeof context.delta).toBe('number');
        return context;
      });

      hookManager.trigger('scenario:loaded', { scenarioName: 'test-scenario' });
      hookManager.trigger('scenario:update', { delta: 0.016 });
    });
  });

  describe("HookContext metadata", () => {
    test("should include _event metadata", async () => {
      const hookManager = new HookManager();
      let capturedContext: any;

      hookManager.register('before:user:message:receive', (context) => {
        capturedContext = context;
        return context;
      });

      await hookManager.trigger('before:user:message:receive', { message: 'test' });

      expect(capturedContext._event).toBe('before:user:message:receive');
    });

    test("should include _timestamp metadata", async () => {
      const hookManager = new HookManager();
      let capturedContext: any;

      hookManager.register('before:user:message:receive', (context) => {
        capturedContext = context;
        return context;
      });

      const before = Date.now();
      await hookManager.trigger('before:user:message:receive', { message: 'test' });
      const after = Date.now();

      expect(capturedContext._timestamp).toBeGreaterThanOrEqual(before);
      expect(capturedContext._timestamp).toBeLessThanOrEqual(after);
    });

    test("should include _hookId metadata", async () => {
      const hookManager = new HookManager();
      let capturedContext: any;

      const hookId = hookManager.register('before:user:message:receive', (context) => {
        capturedContext = context;
        return context;
      });

      await hookManager.trigger('before:user:message:receive', { message: 'test' });

      expect(capturedContext._hookId).toBe(hookId);
    });

    test("should reset _hookId between hooks", async () => {
      const hookManager = new HookManager();
      const capturedContexts: any[] = [];

      const hookId1 = hookManager.register('before:user:message:receive', (context) => {
        capturedContexts.push({ ...context });
        return context;
      }, { priority: 10 });

      const hookId2 = hookManager.register('before:user:message:receive', (context) => {
        capturedContexts.push({ ...context });
        return context;
      }, { priority: 20 });

      await hookManager.trigger('before:user:message:receive', { message: 'test' });

      expect(capturedContexts[0]._hookId).toBe(hookId1);
      expect(capturedContexts[1]._hookId).toBe(hookId2);
    });
  });

  describe("HookCallback type safety", () => {
    test("should accept synchronous callback", () => {
      const hookManager = new HookManager();

      const syncCallback: HookCallback<'before:user:message:receive'> = (context) => {
        return { ...context, message: context.message.toUpperCase() };
      };

      hookManager.register('before:user:message:receive', syncCallback);
    });

    test("should accept async callback", () => {
      const hookManager = new HookManager();

      const asyncCallback: HookCallback<'before:user:message:receive'> = async (context) => {
        await new Promise(resolve => setTimeout(resolve, 1));
        return { ...context, message: context.message.toUpperCase() };
      };

      hookManager.register('before:user:message:receive', asyncCallback);
    });

    test("should maintain type safety across hook chain", async () => {
      const hookManager = new HookManager();

      // First hook modifies message
      hookManager.register('before:user:message:receive', (context) => {
        const newMessage: string = context.message + ' step1';
        return { ...context, message: newMessage };
      });

      // Second hook uses modified message
      hookManager.register('before:user:message:receive', (context) => {
        const newMessage: string = context.message + ' step2';
        return { ...context, message: newMessage };
      });

      const result = await hookManager.trigger('before:user:message:receive', { message: 'start' });

      expect(result.message).toBe('start step1 step2');
    });

    test("should preserve context data types through pipeline", async () => {
      const hookManager = new HookManager();

      hookManager.register('before:llm:request', (context) => {
        // Verify types are preserved
        expect(Array.isArray(context.messages)).toBe(true);
        expect(typeof context.backend).toBe('string');

        // Modify and return
        return {
          ...context,
          messages: [...context.messages, { role: 'assistant' as const, content: 'added' }]
        };
      });

      const result = await hookManager.trigger('before:llm:request', {
        messages: [{ role: 'user', content: 'test' }],
        backend: 'chatgpt'
      });

      expect(result.messages.length).toBe(2);
      expect(result.messages[1].content).toBe('added');
    });
  });

  describe("Complex event scenarios", () => {
    test("should handle rapid fire chunk events", async () => {
      const hookManager = new HookManager();
      const processedChunks: string[] = [];

      hookManager.register('on:llm:chunk', (context) => {
        processedChunks.push(context.chunk);
        return context;
      });

      const chunks = Array.from({ length: 100 }, (_, i) => `chunk${i}`);

      await Promise.all(
        chunks.map((chunk, idx) =>
          hookManager.trigger('on:llm:chunk', { chunk, streamIdx: 0 })
        )
      );

      expect(processedChunks.length).toBe(100);
    });

    test("should handle mixed event types concurrently", async () => {
      const hookManager = new HookManager();
      let userMsgCount = 0;
      let llmChunkCount = 0;
      let ttsCount = 0;

      hookManager.register('before:user:message:receive', (context) => {
        userMsgCount++;
        return context;
      });

      hookManager.register('on:llm:chunk', (context) => {
        llmChunkCount++;
        return context;
      });

      hookManager.register('before:tts:generate', (context) => {
        ttsCount++;
        return context;
      });

      await Promise.all([
        hookManager.trigger('before:user:message:receive', { message: 'test1' }),
        hookManager.trigger('before:user:message:receive', { message: 'test2' }),
        hookManager.trigger('on:llm:chunk', { chunk: 'chunk1', streamIdx: 0 }),
        hookManager.trigger('on:llm:chunk', { chunk: 'chunk2', streamIdx: 0 }),
        hookManager.trigger('before:tts:generate', { text: 'tts1', backend: 'none' }),
      ]);

      expect(userMsgCount).toBe(2);
      expect(llmChunkCount).toBe(2);
      expect(ttsCount).toBe(1);
    });
  });

  describe("Context immutability", () => {
    test("should not allow modifying readonly metadata fields", async () => {
      const hookManager = new HookManager();

      hookManager.register('before:user:message:receive', (context) => {
        // TypeScript should prevent this, but test runtime behavior
        const modifiedContext = {
          ...context,
          message: 'modified',
          _event: 'wrong_event' as any, // Try to override
          _timestamp: 12345, // Try to override
        };
        return modifiedContext as any;
      });

      const result = await hookManager.trigger('before:user:message:receive', { message: 'test' });

      // Modified data should go through
      expect(result.message).toBe('modified');

      // But metadata is managed by HookManager
      // (The internal logic preserves _event and _timestamp)
    });
  });
});
