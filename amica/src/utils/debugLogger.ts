/**
 * Debug Logger - Global console interceptor for error tracking
 *
 * This module intercepts console methods and window error events to maintain
 * a log of all console output and errors for debugging purposes.
 */

interface LogEntry {
  type: 'log' | 'debug' | 'info' | 'warn' | 'error';
  ts: number;
  args: unknown[];
  stack?: string;
}

interface WindowWithErrorHandler extends Window {
  error_handler_installed?: boolean;
  error_handler_logs?: LogEntry[];
  console: Console;
}

declare const window: WindowWithErrorHandler;

/**
 * Console method names that should be intercepted and logged
 */
type ConsoleMethod = 'log' | 'debug' | 'info' | 'warn' | 'error';

/**
 * Check if a string is a valid console method to intercept
 */
function isInterceptedMethod(name: string): name is ConsoleMethod {
  return ['log', 'debug', 'info', 'warn', 'error'].includes(name);
}

/**
 * Initialize the global error handler and console interceptor
 */
function initDebugLogger(): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (window.error_handler_installed) {
    return;
  }

  // Initialize the log storage
  window.error_handler_logs = [];

  // Store reference to original console
  const originalConsole = window.console;

  // Create proxy handler for console interception
  const consoleHandler: ProxyHandler<Record<string, unknown>> = {
    get: (_target, name: string) => {
      // Function that passes through to original console
      function passthrough(...args: unknown[]): void {
        const method = originalConsole[name as keyof Console];
        if (typeof method === 'function') {
          (method as (...args: unknown[]) => void).apply(originalConsole, args);
        }
      }

      // Function that logs and then passes through
      function logAndPassthrough(...args: unknown[]): void {
        if (window.error_handler_logs) {
          // Capture stack trace for warnings and errors to get better context
          let stack: string | undefined;
          if (name === 'warn' || name === 'error') {
            const error = new Error();
            stack = error.stack;
          }

          window.error_handler_logs.push({
            type: name as ConsoleMethod,
            ts: Date.now(),
            args: Array.from(args),
            stack,
          });

          // Also log the stack trace to console for immediate visibility
          if (stack && (name === 'warn' || name === 'error')) {
            passthrough(...args);
            passthrough('Stack trace:', stack);
            return;
          }
        }
        passthrough(...args);
      }

      // Return appropriate function based on method name
      if (isInterceptedMethod(name)) {
        return logAndPassthrough;
      }
      return passthrough;
    },
  };

  // Replace console with proxy
  window.console = new Proxy({}, consoleHandler) as unknown as Console;

  // Global error handler
  window.addEventListener('error', (event: ErrorEvent) => {
    const message = event.error?.message ?? event.message ?? 'Unknown error';
    const stack = event.error?.stack ?? '';
    console.error(`Error occurred: ${message}${stack ? ' ' + stack : ''}`);
    return false;
  });

  // Unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const message = reason?.message ?? (typeof reason === 'string' ? reason : reason?.toString?.() ?? 'Unknown rejection');
    console.error(`Unhandled rejection: ${message}`);
    return false;
  });

  window.error_handler_installed = true;
}

// Auto-initialize when script loads
initDebugLogger();

/**
 * Get all logged entries
 */
export function getLogEntries(): LogEntry[] {
  return window.error_handler_logs || [];
}

/**
 * Get logs filtered by type
 */
export function getLogsByType(type: ConsoleMethod): LogEntry[] {
  return getLogEntries().filter(entry => entry.type === type);
}

/**
 * Get recent logs (last N entries)
 */
export function getRecentLogs(count: number = 50): LogEntry[] {
  const logs = getLogEntries();
  return logs.slice(-count);
}

/**
 * Pretty print a log entry with stack trace
 */
export function printLogEntry(entry: LogEntry): void {
  const timestamp = new Date(entry.ts).toISOString();
  console.log(`[${timestamp}] ${entry.type.toUpperCase()}:`, ...entry.args);
  if (entry.stack) {
    console.log('Stack trace:', entry.stack);
  }
}

/**
 * Search logs by message content
 */
export function searchLogs(searchTerm: string): LogEntry[] {
  return getLogEntries().filter(entry =>
    entry.args.some(arg =>
      typeof arg === 'string' && arg.includes(searchTerm)
    )
  );
}

/**
 * Clear all stored logs
 */
export function clearLogs(): void {
  if (window.error_handler_logs) {
    window.error_handler_logs = [];
  }
}

export type { LogEntry, ConsoleMethod };
export { initDebugLogger };
