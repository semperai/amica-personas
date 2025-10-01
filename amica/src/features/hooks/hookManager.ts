/**
 * HookManager - Central system for managing lifecycle hooks
 */

import { HookEvent, HookEventMap } from './hookEvents';
import { HookCallback, HookContext, HookOptions, HookMetrics } from './hookContext';

interface RegisteredHook<T extends HookEvent = HookEvent> {
  event: T;
  callback: HookCallback<T>;
  options: HookOptions;
  id: string;
}

export class HookManager {
  private hooks: Map<HookEvent, RegisteredHook[]> = new Map();
  private metrics: Map<string, HookMetrics> = new Map();
  private enabled: boolean = true;
  private hookIdCounter: number = 0;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
  }

  /**
   * Register a hook for a specific event
   */
  public register<T extends HookEvent>(
    event: T,
    callback: HookCallback<T>,
    options: HookOptions = {}
  ): string {
    const hookId = `hook_${this.hookIdCounter++}`;

    const hook: RegisteredHook<T> = {
      event,
      callback,
      options: {
        priority: options.priority ?? 100,
        timeout: options.timeout ?? 5000,
        condition: options.condition,
      },
      id: hookId,
    };

    if (!this.hooks.has(event)) {
      this.hooks.set(event, []);
    }

    const hooks = this.hooks.get(event)!;
    hooks.push(hook as RegisteredHook);

    // Sort by priority (lower numbers first)
    hooks.sort((a, b) => (a.options.priority ?? 100) - (b.options.priority ?? 100));

    // Initialize metrics
    this.metrics.set(hookId, {
      calls: 0,
      totalDuration: 0,
      avgDuration: 0,
      errors: 0,
    });

    console.debug(`[HookManager] Registered hook ${hookId} for event ${event}`);
    return hookId;
  }

  /**
   * Unregister a hook by ID
   */
  public unregister(hookId: string): boolean {
    for (const [event, hooks] of this.hooks.entries()) {
      const index = hooks.findIndex(h => h.id === hookId);
      if (index !== -1) {
        hooks.splice(index, 1);
        this.metrics.delete(hookId);
        console.debug(`[HookManager] Unregistered hook ${hookId}`);
        return true;
      }
    }
    return false;
  }

  /**
   * Unregister all hooks for a specific event
   */
  public unregisterAll(event: HookEvent): void {
    const hooks = this.hooks.get(event);
    if (hooks) {
      hooks.forEach(hook => this.metrics.delete(hook.id));
      this.hooks.delete(event);
      console.debug(`[HookManager] Unregistered all hooks for event ${event}`);
    }
  }

  /**
   * Trigger hooks for a specific event
   */
  public async trigger<T extends HookEvent>(
    event: T,
    contextData: HookEventMap[T]
  ): Promise<HookEventMap[T]> {
    if (!this.enabled) {
      return contextData;
    }

    const hooks = this.hooks.get(event);
    if (!hooks || hooks.length === 0) {
      return contextData;
    }

    let context: HookContext<T> = {
      ...contextData,
      _event: event,
      _timestamp: Date.now(),
      _hookId: '',
    } as HookContext<T>;

    for (const hook of hooks) {
      // Check condition
      if (hook.options.condition && !hook.options.condition(context)) {
        continue;
      }

      const startTime = performance.now();
      const metrics = this.metrics.get(hook.id)!;

      try {
        // Set hook ID for this execution
        context = { ...context, _hookId: hook.id } as HookContext<T>;

        // Execute hook with timeout
        const result = await this.executeWithTimeout(
          hook.callback as HookCallback<T>,
          context,
          hook.options.timeout ?? 5000
        );

        // Update context with result (preserving readonly fields)
        const { _event, _timestamp, _hookId, ...mutableContext } = result;
        context = {
          ...mutableContext,
          _event,
          _timestamp,
          _hookId: '',
        } as HookContext<T>;

        // Update metrics
        const duration = performance.now() - startTime;
        metrics.calls++;
        metrics.totalDuration += duration;
        metrics.avgDuration = metrics.totalDuration / metrics.calls;

      } catch (error: any) {
        const duration = performance.now() - startTime;
        metrics.errors++;
        metrics.lastError = error.toString();

        console.error(`[HookManager] Hook ${hook.id} for event ${event} failed:`, error);

        // Continue with other hooks despite error (error isolation)
      }
    }

    // Return mutable context data
    const { _event, _timestamp, _hookId, ...result } = context;
    return result as HookEventMap[T];
  }

  /**
   * Execute a hook with timeout
   */
  private async executeWithTimeout<T extends HookEvent>(
    callback: HookCallback<T>,
    context: HookContext<T>,
    timeout: number
  ): Promise<HookContext<T>> {
    return Promise.race([
      Promise.resolve(callback(context)),
      new Promise<HookContext<T>>((_, reject) =>
        setTimeout(() => reject(new Error(`Hook timed out after ${timeout}ms`)), timeout)
      ),
    ]);
  }

  /**
   * Get metrics for a specific hook
   */
  public getMetrics(hookId: string): HookMetrics | undefined {
    return this.metrics.get(hookId);
  }

  /**
   * Get all metrics for an event
   */
  public getEventMetrics(event: HookEvent): HookMetrics {
    const hooks = this.hooks.get(event) || [];
    const combined: HookMetrics = {
      calls: 0,
      totalDuration: 0,
      avgDuration: 0,
      errors: 0,
    };

    hooks.forEach(hook => {
      const metrics = this.metrics.get(hook.id);
      if (metrics) {
        combined.calls += metrics.calls;
        combined.totalDuration += metrics.totalDuration;
        combined.errors += metrics.errors;
      }
    });

    combined.avgDuration = combined.calls > 0 ? combined.totalDuration / combined.calls : 0;
    return combined;
  }

  /**
   * Get all registered hooks
   */
  public getHooks(event?: HookEvent): RegisteredHook[] {
    if (event) {
      return this.hooks.get(event) || [];
    }
    return Array.from(this.hooks.values()).flat();
  }

  /**
   * Enable or disable all hooks
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.debug(`[HookManager] Hooks ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if hooks are enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Clear all hooks and metrics
   */
  public clear(): void {
    this.hooks.clear();
    this.metrics.clear();
    console.debug('[HookManager] Cleared all hooks');
  }
}

// Export singleton instance
export const globalHookManager = new HookManager();
