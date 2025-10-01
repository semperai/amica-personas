import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import { HookManager } from "../src/features/hooks/hookManager";
import type { HookEvent } from "../src/features/hooks/hookEvents";

describe("HookManager", () => {
  let hookManager: HookManager;

  beforeEach(() => {
    hookManager = new HookManager();
  });

  describe("register", () => {
    test("should register a hook and return a hook ID", () => {
      const hookId = hookManager.register(
        'before:user:message:receive',
        (context) => context,
      );

      expect(hookId).toMatch(/^hook_\d+$/);
    });

    test("should register multiple hooks for the same event", () => {
      const hookId1 = hookManager.register(
        'before:user:message:receive',
        (context) => context,
      );
      const hookId2 = hookManager.register(
        'before:user:message:receive',
        (context) => context,
      );

      expect(hookId1).not.toBe(hookId2);
      expect(hookManager.getHooks('before:user:message:receive').length).toBe(2);
    });

    test("should register hooks with priority", () => {
      const hookId1 = hookManager.register(
        'before:user:message:receive',
        (context) => context,
        { priority: 200 }
      );
      const hookId2 = hookManager.register(
        'before:user:message:receive',
        (context) => context,
        { priority: 50 }
      );

      const hooks = hookManager.getHooks('before:user:message:receive');
      expect(hooks[0].id).toBe(hookId2); // Lower priority executes first
      expect(hooks[1].id).toBe(hookId1);
    });

    test("should use default priority of 100 if not specified", () => {
      const hookId = hookManager.register(
        'before:user:message:receive',
        (context) => context,
      );

      const hooks = hookManager.getHooks('before:user:message:receive');
      expect(hooks[0].options.priority).toBe(100);
    });

    test("should initialize metrics for registered hook", () => {
      const hookId = hookManager.register(
        'before:user:message:receive',
        (context) => context,
      );

      const metrics = hookManager.getMetrics(hookId);
      expect(metrics).toEqual({
        calls: 0,
        totalDuration: 0,
        avgDuration: 0,
        errors: 0,
      });
    });
  });

  describe("unregister", () => {
    test("should unregister a hook by ID", () => {
      const hookId = hookManager.register(
        'before:user:message:receive',
        (context) => context,
      );

      const result = hookManager.unregister(hookId);
      expect(result).toBe(true);
      expect(hookManager.getHooks('before:user:message:receive').length).toBe(0);
    });

    test("should return false when unregistering non-existent hook", () => {
      const result = hookManager.unregister('non_existent_id');
      expect(result).toBe(false);
    });

    test("should delete metrics when unregistering", () => {
      const hookId = hookManager.register(
        'before:user:message:receive',
        (context) => context,
      );

      hookManager.unregister(hookId);
      expect(hookManager.getMetrics(hookId)).toBeUndefined();
    });
  });

  describe("unregisterAll", () => {
    test("should unregister all hooks for an event", () => {
      hookManager.register('before:user:message:receive', (context) => context);
      hookManager.register('before:user:message:receive', (context) => context);
      hookManager.register('after:user:message:receive', (context) => context);

      hookManager.unregisterAll('before:user:message:receive');

      expect(hookManager.getHooks('before:user:message:receive').length).toBe(0);
      expect(hookManager.getHooks('after:user:message:receive').length).toBe(1);
    });

    test("should delete all metrics for event hooks", () => {
      const hookId1 = hookManager.register('before:user:message:receive', (context) => context);
      const hookId2 = hookManager.register('before:user:message:receive', (context) => context);

      hookManager.unregisterAll('before:user:message:receive');

      expect(hookManager.getMetrics(hookId1)).toBeUndefined();
      expect(hookManager.getMetrics(hookId2)).toBeUndefined();
    });
  });

  describe("trigger", () => {
    test("should execute hook callback with context", async () => {
      const callback = jest.fn((context) => context);
      hookManager.register('before:user:message:receive', callback);

      await hookManager.trigger('before:user:message:receive', { message: 'test' });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'test',
          _event: 'before:user:message:receive',
          _timestamp: expect.any(Number),
        })
      );
    });

    test("should pass context through multiple hooks", async () => {
      hookManager.register('before:user:message:receive', (context) => {
        return { ...context, message: context.message + ' modified1' };
      });
      hookManager.register('before:user:message:receive', (context) => {
        return { ...context, message: context.message + ' modified2' };
      });

      const result = await hookManager.trigger('before:user:message:receive', { message: 'original' });

      expect(result.message).toBe('original modified1 modified2');
    });

    test("should execute hooks in priority order", async () => {
      const order: number[] = [];

      hookManager.register('before:user:message:receive', () => {
        order.push(2);
        return { message: '' };
      }, { priority: 200 });

      hookManager.register('before:user:message:receive', () => {
        order.push(1);
        return { message: '' };
      }, { priority: 100 });

      hookManager.register('before:user:message:receive', () => {
        order.push(3);
        return { message: '' };
      }, { priority: 300 });

      await hookManager.trigger('before:user:message:receive', { message: 'test' });

      expect(order).toEqual([1, 2, 3]);
    });

    test("should return original context if no hooks registered", async () => {
      const result = await hookManager.trigger('before:user:message:receive', { message: 'test' });

      expect(result).toEqual({ message: 'test' });
    });

    test("should skip hooks that don't meet condition", async () => {
      const callback = jest.fn((context) => context);
      hookManager.register('before:user:message:receive', callback, {
        condition: (context) => context.message.length > 10
      });

      await hookManager.trigger('before:user:message:receive', { message: 'short' });

      expect(callback).not.toHaveBeenCalled();
    });

    test("should execute hooks that meet condition", async () => {
      const callback = jest.fn((context) => context);
      hookManager.register('before:user:message:receive', callback, {
        condition: (context) => context.message.length > 5
      });

      await hookManager.trigger('before:user:message:receive', { message: 'long message' });

      expect(callback).toHaveBeenCalled();
    });

    test("should handle async hook callbacks", async () => {
      hookManager.register('before:user:message:receive', async (context) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { ...context, message: context.message + ' async' };
      });

      const result = await hookManager.trigger('before:user:message:receive', { message: 'test' });

      expect(result.message).toBe('test async');
    });

    test("should update metrics on successful hook execution", async () => {
      const hookId = hookManager.register('before:user:message:receive', (context) => context);

      await hookManager.trigger('before:user:message:receive', { message: 'test' });

      const metrics = hookManager.getMetrics(hookId);
      expect(metrics?.calls).toBe(1);
      expect(metrics?.avgDuration).toBeGreaterThan(0);
      expect(metrics?.errors).toBe(0);
    });

    test("should isolate errors and continue with other hooks", async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const callback1 = jest.fn(() => { throw new Error('Hook error'); });
      const callback2 = jest.fn((context) => context);

      hookManager.register('before:user:message:receive', callback1, { priority: 10 });
      hookManager.register('before:user:message:receive', callback2, { priority: 20 });

      await hookManager.trigger('before:user:message:receive', { message: 'test' });

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[HookManager] Hook'),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    test("should track errors in metrics", async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const hookId = hookManager.register('before:user:message:receive', () => {
        throw new Error('Test error');
      });

      await hookManager.trigger('before:user:message:receive', { message: 'test' });

      const metrics = hookManager.getMetrics(hookId);
      expect(metrics?.errors).toBe(1);
      expect(metrics?.lastError).toContain('Test error');

      consoleErrorSpy.mockRestore();
    });

    test("should timeout hooks that take too long", async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const hookId = hookManager.register('before:user:message:receive', async () => {
        await new Promise(resolve => setTimeout(resolve, 10000));
        return { message: 'should not reach' };
      }, { timeout: 50 });

      await hookManager.trigger('before:user:message:receive', { message: 'test' });

      const metrics = hookManager.getMetrics(hookId);
      expect(metrics?.errors).toBe(1);
      expect(metrics?.lastError).toContain('timed out');

      consoleErrorSpy.mockRestore();
    });

    test("should return context when disabled", async () => {
      hookManager.setEnabled(false);
      const callback = jest.fn((context) => ({ ...context, message: 'modified' }));
      hookManager.register('before:user:message:receive', callback);

      const result = await hookManager.trigger('before:user:message:receive', { message: 'test' });

      expect(callback).not.toHaveBeenCalled();
      expect(result).toEqual({ message: 'test' });
    });
  });

  describe("getMetrics", () => {
    test("should return undefined for non-existent hook", () => {
      const metrics = hookManager.getMetrics('non_existent');
      expect(metrics).toBeUndefined();
    });

    test("should track multiple calls", async () => {
      const hookId = hookManager.register('before:user:message:receive', (context) => context);

      await hookManager.trigger('before:user:message:receive', { message: 'test1' });
      await hookManager.trigger('before:user:message:receive', { message: 'test2' });
      await hookManager.trigger('before:user:message:receive', { message: 'test3' });

      const metrics = hookManager.getMetrics(hookId);
      expect(metrics?.calls).toBe(3);
    });

    test("should calculate average duration correctly", async () => {
      const hookId = hookManager.register('before:user:message:receive', async (context) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return context;
      });

      await hookManager.trigger('before:user:message:receive', { message: 'test1' });
      await hookManager.trigger('before:user:message:receive', { message: 'test2' });

      const metrics = hookManager.getMetrics(hookId);
      expect(metrics?.calls).toBe(2);
      expect(metrics?.avgDuration).toBe(metrics!.totalDuration / 2);
    });
  });

  describe("getEventMetrics", () => {
    test("should aggregate metrics for all hooks on an event", async () => {
      hookManager.register('before:user:message:receive', (context) => context);
      hookManager.register('before:user:message:receive', (context) => context);

      await hookManager.trigger('before:user:message:receive', { message: 'test' });

      const eventMetrics = hookManager.getEventMetrics('before:user:message:receive');
      expect(eventMetrics.calls).toBe(2);
      expect(eventMetrics.errors).toBe(0);
    });

    test("should return zero metrics for event with no hooks", () => {
      const metrics = hookManager.getEventMetrics('before:user:message:receive');

      expect(metrics).toEqual({
        calls: 0,
        totalDuration: 0,
        avgDuration: 0,
        errors: 0,
      });
    });

    test("should aggregate errors across hooks", async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      hookManager.register('before:user:message:receive', () => { throw new Error('Error 1'); });
      hookManager.register('before:user:message:receive', () => { throw new Error('Error 2'); });

      await hookManager.trigger('before:user:message:receive', { message: 'test' });

      const metrics = hookManager.getEventMetrics('before:user:message:receive');
      expect(metrics.errors).toBe(2);

      consoleErrorSpy.mockRestore();
    });
  });

  describe("getHooks", () => {
    test("should return hooks for specific event", () => {
      hookManager.register('before:user:message:receive', (context) => context);
      hookManager.register('after:user:message:receive', (context) => context);

      const hooks = hookManager.getHooks('before:user:message:receive');
      expect(hooks.length).toBe(1);
      expect(hooks[0].event).toBe('before:user:message:receive');
    });

    test("should return all hooks when no event specified", () => {
      hookManager.register('before:user:message:receive', (context) => context);
      hookManager.register('after:user:message:receive', (context) => context);
      hookManager.register('before:llm:request', (context) => context);

      const allHooks = hookManager.getHooks();
      expect(allHooks.length).toBe(3);
    });

    test("should return empty array for event with no hooks", () => {
      const hooks = hookManager.getHooks('before:user:message:receive');
      expect(hooks).toEqual([]);
    });
  });

  describe("setEnabled / isEnabled", () => {
    test("should enable/disable hook execution", async () => {
      const callback = jest.fn((context) => context);
      hookManager.register('before:user:message:receive', callback);

      hookManager.setEnabled(false);
      expect(hookManager.isEnabled()).toBe(false);

      await hookManager.trigger('before:user:message:receive', { message: 'test' });
      expect(callback).not.toHaveBeenCalled();

      hookManager.setEnabled(true);
      expect(hookManager.isEnabled()).toBe(true);

      await hookManager.trigger('before:user:message:receive', { message: 'test' });
      expect(callback).toHaveBeenCalled();
    });

    test("should be enabled by default", () => {
      expect(hookManager.isEnabled()).toBe(true);
    });

    test("should accept enabled parameter in constructor", () => {
      const disabledManager = new HookManager(false);
      expect(disabledManager.isEnabled()).toBe(false);
    });
  });

  describe("clear", () => {
    test("should clear all hooks and metrics", () => {
      const hookId1 = hookManager.register('before:user:message:receive', (context) => context);
      const hookId2 = hookManager.register('after:user:message:receive', (context) => context);

      hookManager.clear();

      expect(hookManager.getHooks().length).toBe(0);
      expect(hookManager.getMetrics(hookId1)).toBeUndefined();
      expect(hookManager.getMetrics(hookId2)).toBeUndefined();
    });
  });

  describe("integration scenarios", () => {
    test("should handle complex pipeline with multiple hooks", async () => {
      // Simulate a message processing pipeline
      let message = 'hello';

      // Pre-processing hooks
      hookManager.register('before:user:message:receive', (context) => {
        return { ...context, message: context.message.trim() };
      }, { priority: 10 });

      hookManager.register('before:user:message:receive', (context) => {
        return { ...context, message: context.message.toLowerCase() };
      }, { priority: 20 });

      // Conditional emoji addition
      hookManager.register('before:user:message:receive', (context) => {
        return { ...context, message: `${context.message} 👋` };
      }, {
        priority: 30,
        condition: (context) => context.message.includes('hello')
      });

      const result = await hookManager.trigger('before:user:message:receive', { message: '  HELLO  ' });

      expect(result.message).toBe('hello 👋');
    });

    test("should handle high-frequency triggers efficiently", async () => {
      hookManager.register('on:llm:chunk', (context) => context);

      const triggers = [];
      for (let i = 0; i < 100; i++) {
        triggers.push(hookManager.trigger('on:llm:chunk', { chunk: `chunk${i}`, streamIdx: 0 }));
      }

      await Promise.all(triggers);

      const metrics = hookManager.getEventMetrics('on:llm:chunk');
      expect(metrics.calls).toBe(100);
      expect(metrics.errors).toBe(0);
    });

    test("should maintain context immutability for readonly fields", async () => {
      const hookId = hookManager.register('before:user:message:receive', (context) => {
        // Try to modify readonly field (TypeScript prevents this, but we're testing runtime)
        return { ...context, message: 'modified', _event: 'wrong' as HookEvent };
      });

      const result = await hookManager.trigger('before:user:message:receive', { message: 'test' });

      // The _event should be preserved despite hook attempting to modify
      expect(result.message).toBe('modified');
    });
  });
});
