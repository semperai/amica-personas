/**
 * Hook Context - Data structures passed to hooks
 */

import { HookEventMap } from './hookEvents';

export type HookContext<T extends keyof HookEventMap> = HookEventMap[T] & {
  // Internal metadata (not modifiable by hooks)
  readonly _event: T;
  readonly _timestamp: number;
  readonly _hookId: string;
};

export type HookCallback<T extends keyof HookEventMap> = (
  context: HookContext<T>
) => Promise<HookContext<T>> | HookContext<T>;

export interface HookOptions {
  priority?: number; // Lower numbers execute first (default: 100)
  timeout?: number; // Timeout in milliseconds (default: 5000)
  condition?: (context: any) => boolean; // Only run if condition is true
}

export interface HookMetrics {
  calls: number;
  totalDuration: number;
  avgDuration: number;
  errors: number;
  lastError?: string;
}
