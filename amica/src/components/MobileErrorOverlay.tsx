import { useEffect, useState } from 'react';

// Maximum number of errors to store to prevent memory issues
const MAX_ERRORS = 50;

interface ErrorInfo {
  type: 'error' | 'rejection' | 'console';
  message: string;
  stack?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  timestamp: number;
  userAgent: string;
  level?: string;
}

interface StackFrame {
  functionName: string;
  fileName: string;
  lineNumber: string;
  columnNumber: string;
}

/**
 * Parse stack trace into structured format
 */
function parseStackTrace(stack?: string): StackFrame[] {
  if (!stack) return [];

  const frames: StackFrame[] = [];
  const lines = stack.split('\n');

  for (const line of lines) {
    // Match various stack trace formats
    // Chrome: "at functionName (file:line:col)"
    // Firefox: "functionName@file:line:col"
    const chromeMatch = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
    const firefoxMatch = line.match(/(.+?)@(.+?):(\d+):(\d+)/);
    const simpleMatch = line.match(/at\s+(.+?):(\d+):(\d+)/);

    if (chromeMatch) {
      frames.push({
        functionName: chromeMatch[1],
        fileName: chromeMatch[2],
        lineNumber: chromeMatch[3],
        columnNumber: chromeMatch[4],
      });
    } else if (firefoxMatch) {
      frames.push({
        functionName: firefoxMatch[1],
        fileName: firefoxMatch[2],
        lineNumber: firefoxMatch[3],
        columnNumber: firefoxMatch[4],
      });
    } else if (simpleMatch) {
      frames.push({
        functionName: '(anonymous)',
        fileName: simpleMatch[1],
        lineNumber: simpleMatch[2],
        columnNumber: simpleMatch[3],
      });
    }
  }

  return frames;
}

/**
 * Mobile Error Overlay - shows errors visually when console is not accessible
 * Captures unhandled errors and rejections during app initialization
 */
export function MobileErrorOverlay() {
  const [errors, setErrors] = useState<ErrorInfo[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [expandedErrors, setExpandedErrors] = useState<Set<number>>(new Set());

  useEffect(() => {
    // Intercept console.error to capture important error logs
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      // Call original console.error
      originalConsoleError.apply(console, args);

      // Capture for display
      const message = args.map(arg => {
        if (typeof arg === 'string') return arg;
        if (arg instanceof Error) return arg.message;
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }).join(' ');

      // Only show critical errors from our code (ScenarioLoader, VrmViewer, etc.)
      // DO NOT show VAD errors as they are non-critical (mic features will just be disabled)
      if ((message.includes('[ScenarioLoader]') ||
           message.includes('[VrmViewer]') ||
           message.includes('[VRM]') ||
           (message.includes('Loading') && !message.includes('[VAD]')) ||
           message.includes('ERROR')) &&
          !message.includes('[VAD]') &&
          !message.includes('[useMicVAD]') &&
          !message.includes('ModelLoadError') &&
          !message.includes('silero_vad')) {
        const errorInfo: ErrorInfo = {
          type: 'console',
          level: 'error',
          message,
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
        };
        console.log('[Mobile Error Overlay] Captured console error:', errorInfo);
        setErrors(prev => {
          const updated = [...prev, errorInfo];
          return updated.length > MAX_ERRORS ? updated.slice(-MAX_ERRORS) : updated;
        });
        setIsVisible(true);
      }
    };

    // Capture unhandled errors
    const handleError = (event: ErrorEvent) => {
      console.error('[Mobile Error Overlay] Caught error:', event);

      // Better error message extraction
      let message = 'Unknown error';
      let stack = '';

      if (event.error) {
        // Standard Error object
        message = event.error.message || String(event.error);
        stack = event.error.stack || '';
      } else if (event.message) {
        // Plain message - check if it's the generic "Uncaught [object Event]"
        message = event.message;
        if (message.includes('[object Event]') || message.includes('[object Object]')) {
          // Try to extract more info from the event
          message = `Worker error at ${event.filename || 'unknown'}`;
        }
      }

      const errorInfo: ErrorInfo = {
        type: 'error',
        message,
        stack: stack || new Error().stack,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
      };
      console.error('[Mobile Error Overlay] Error details:', errorInfo);
      setErrors(prev => {
        const updated = [...prev, errorInfo];
        // Keep only the most recent MAX_ERRORS errors to prevent memory issues
        return updated.length > MAX_ERRORS ? updated.slice(-MAX_ERRORS) : updated;
      });
      setIsVisible(true);
    };

    // Capture unhandled promise rejections
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error('[Mobile Error Overlay] Caught rejection:', event);
      const reason = event.reason;
      const errorInfo: ErrorInfo = {
        type: 'rejection',
        message: reason?.message || String(reason),
        stack: reason?.stack || new Error().stack,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
      };
      console.error('[Mobile Error Overlay] Rejection details:', errorInfo);
      setErrors(prev => {
        const updated = [...prev, errorInfo];
        // Keep only the most recent MAX_ERRORS errors to prevent memory issues
        return updated.length > MAX_ERRORS ? updated.slice(-MAX_ERRORS) : updated;
      });
      setIsVisible(true);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
      console.error = originalConsoleError;
    };
  }, []);

  const toggleExpanded = (index: number) => {
    setExpandedErrors(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  if (!isVisible || errors.length === 0) {
    return null;
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#0d1117',
        color: '#c9d1d9',
        zIndex: 999999,
        overflow: 'auto',
        padding: '16px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
        fontSize: '14px',
      }}
    >
      {/* Header */}
      <div style={{
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '10px',
      }}>
        <h1 style={{
          margin: 0,
          fontSize: '20px',
          color: '#f85149',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{ fontSize: '24px' }}>⚠️</span>
          Application Error ({errors.length})
        </h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => {
              const errorText = errors.map((e, i) =>
                `Error #${i + 1} (${e.type})\n` +
                `Message: ${e.message}\n` +
                `File: ${e.filename || 'unknown'}:${e.lineno || '?'}:${e.colno || '?'}\n` +
                `Stack:\n${e.stack}\n\n`
              ).join('\n---\n\n');
              navigator.clipboard?.writeText(errorText);
            }}
            aria-label="Copy error details to clipboard"
            style={{
              padding: '8px 16px',
              backgroundColor: '#238636',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            📋 Copy
          </button>
          <button
            onClick={() => {
              if (confirm('Reloading will discard any unsaved changes. Continue?')) {
                window.location.reload();
              }
            }}
            aria-label="Reload page"
            style={{
              padding: '8px 16px',
              backgroundColor: '#1f6feb',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            🔄 Reload
          </button>
        </div>
      </div>

      {/* Device Info */}
      <div style={{
        marginBottom: '20px',
        padding: '12px',
        backgroundColor: '#161b22',
        border: '1px solid #30363d',
        borderRadius: '6px',
      }}>
        <div style={{ fontWeight: '600', marginBottom: '8px', color: '#58a6ff' }}>
          📱 Device Info <span style={{ fontSize: '11px', fontWeight: '400', color: '#8b949e' }}>(displayed locally only)</span>
        </div>
        <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#8b949e' }}>
          <div>Screen: {window.screen.width}x{window.screen.height}</div>
          <div>Viewport: {window.innerWidth}x{window.innerHeight}</div>
          <div>Pixel Ratio: {window.devicePixelRatio}</div>
          <div style={{ wordBreak: 'break-all' }}>UA: {navigator.userAgent}</div>
        </div>
      </div>

      {/* Errors */}
      {errors.map((error, index) => {
        const stackFrames = parseStackTrace(error.stack);
        const isExpanded = expandedErrors.has(index);

        return (
          <div
            key={index}
            style={{
              marginBottom: '16px',
              backgroundColor: '#161b22',
              border: '1px solid #f85149',
              borderRadius: '6px',
              overflow: 'hidden',
            }}
          >
            {/* Error Header */}
            <div
              onClick={() => toggleExpanded(index)}
              style={{
                padding: '12px',
                backgroundColor: '#21262d',
                cursor: 'pointer',
                userSelect: 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ color: '#f85149', fontWeight: '600', marginBottom: '4px' }}>
                  {error.type === 'error' ? '❌ Error' : error.type === 'rejection' ? '⚡ Promise Rejection' : '📋 Console Error'} #{index + 1}
                </div>
                <div style={{ fontSize: '12px', color: '#8b949e' }}>
                  {new Date(error.timestamp).toLocaleString()}
                </div>
              </div>
              <div style={{ fontSize: '18px', color: '#8b949e' }}>
                {isExpanded ? '▼' : '▶'}
              </div>
            </div>

            {/* Error Body */}
            {isExpanded && (
              <div style={{ padding: '12px' }}>
                {/* Message */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontWeight: '600', marginBottom: '4px', color: '#58a6ff' }}>
                    💬 Message
                  </div>
                  <div style={{
                    padding: '8px',
                    backgroundColor: '#0d1117',
                    borderRadius: '4px',
                    fontSize: '13px',
                    wordBreak: 'break-word',
                    color: '#ff7b72',
                    fontFamily: 'monospace',
                  }}>
                    {error.message}
                  </div>
                </div>

                {/* Location */}
                {(error.filename || error.lineno) && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontWeight: '600', marginBottom: '4px', color: '#58a6ff' }}>
                      📍 Location
                    </div>
                    <div style={{
                      padding: '8px',
                      backgroundColor: '#0d1117',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      color: '#ffa657',
                    }}>
                      {error.filename}:{error.lineno}:{error.colno}
                    </div>
                  </div>
                )}

                {/* Stack Frames */}
                {stackFrames.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontWeight: '600', marginBottom: '4px', color: '#58a6ff' }}>
                      📚 Stack Trace ({stackFrames.length} frames)
                    </div>
                    <div style={{
                      backgroundColor: '#0d1117',
                      borderRadius: '4px',
                      overflow: 'hidden',
                    }}>
                      {stackFrames.map((frame, frameIndex) => (
                        <div
                          key={frameIndex}
                          style={{
                            padding: '8px',
                            borderBottom: frameIndex < stackFrames.length - 1 ? '1px solid #21262d' : 'none',
                            fontSize: '11px',
                            fontFamily: 'monospace',
                          }}
                        >
                          <div style={{ color: '#79c0ff', marginBottom: '2px' }}>
                            {frame.functionName}
                          </div>
                          <div style={{ color: '#8b949e' }}>
                            {frame.fileName}:{frame.lineNumber}:{frame.columnNumber}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Raw Stack (fallback) */}
                {error.stack && stackFrames.length === 0 && (
                  <div>
                    <div style={{ fontWeight: '600', marginBottom: '4px', color: '#58a6ff' }}>
                      📋 Raw Stack Trace
                    </div>
                    <pre style={{
                      margin: 0,
                      padding: '8px',
                      backgroundColor: '#0d1117',
                      borderRadius: '4px',
                      overflow: 'auto',
                      fontSize: '10px',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontFamily: 'monospace',
                      color: '#8b949e',
                      maxHeight: '300px',
                    }}>
                      {error.stack}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Footer */}
      <div style={{ marginTop: '20px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
        <button
          onClick={() => {
            setErrors([]);
            setIsVisible(false);
          }}
          aria-label="Dismiss error overlay"
          style={{
            padding: '8px 16px',
            backgroundColor: '#21262d',
            color: '#c9d1d9',
            border: '1px solid #30363d',
            borderRadius: '6px',
            fontSize: '14px',
            cursor: 'pointer',
            fontWeight: '500',
          }}
        >
          ✖️ Dismiss
        </button>
      </div>
    </div>
  );
}
