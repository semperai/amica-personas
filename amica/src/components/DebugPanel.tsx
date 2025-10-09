import { useEffect, useRef, useState, useMemo } from "react";
import { Switch } from '@headlessui/react'
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { clsx } from "clsx";
import { config } from "@/utils/config";

const TOTAL_ITEMS_TO_SHOW = 50;

// Safe JSON stringify that handles circular references and special objects
function safeStringify(obj: any, maxDepth = 3, maxKeys = 50): string {
  try {
    const seen = new WeakSet();
    let keyCount = 0;
    const depthMap = new WeakMap<object, number>();

    const replacer = function(this: any, key: string, value: any): any {
      // Limit total number of keys to prevent huge objects
      if (keyCount > maxKeys) {
        return '[Max keys reached]';
      }

      if (typeof value === 'object' && value !== null) {
        keyCount++;

        // Track depth
        const parentDepth = depthMap.get(this) ?? 0;
        const currentDepth = parentDepth + 1;

        if (currentDepth > maxDepth) {
          return '[Max depth reached]';
        }

        depthMap.set(value, currentDepth);

        // Handle circular references
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);

        // Handle special browser objects that don't stringify well
        try {
          if (value instanceof HTMLElement) {
            return `<${value.tagName.toLowerCase()}${value.id ? '#' + value.id : ''}${value.className ? '.' + value.className.split(' ').join('.') : ''}>`;
          }
          if (value instanceof Window) {
            return '[Window]';
          }
          if (value instanceof Document) {
            return '[Document]';
          }
          if (value instanceof AudioContext) {
            return `[AudioContext: ${value.state}]`;
          }
          if (value instanceof HTMLCanvasElement) {
            return `[Canvas: ${value.width}x${value.height}]`;
          }
        } catch (e) {
          // instanceof checks can fail for cross-realm objects
        }

        // Check constructor name for various objects
        try {
          if (value.constructor) {
            const ctorName = value.constructor.name;
            // Handle various browser/three.js objects
            if (['MediaStream', 'AudioNode', 'AudioBuffer', 'WebGLRenderingContext', 'WebGL2RenderingContext', 'CanvasRenderingContext2D'].includes(ctorName)) {
              return `[${ctorName}]`;
            }
            // Handle Three.js objects (very large objects)
            if (ctorName && (ctorName.startsWith('Three') || ctorName.includes('Mesh') || ctorName.includes('Scene') || ctorName.includes('Camera') || ctorName === 'Object3D')) {
              return `[${ctorName}]`;
            }
            // Handle other known large objects
            if (['Module', 'WebAssembly'].some(s => ctorName.includes(s))) {
              return `[${ctorName}]`;
            }
          }
        } catch (e) {
          // Constructor access can fail
        }

        // For arrays, limit size
        try {
          if (Array.isArray(value)) {
            if (value.length > 20) {
              return `[Array with ${value.length} items]`;
            }
          }
        } catch (e) {
          return '[Array]';
        }

        // For objects, limit number of keys shown
        try {
          const keys = Object.keys(value);
          if (keys.length > 30) {
            return `{${keys.length} keys: ${keys.slice(0, 3).join(', ')}, ...}`;
          }
        } catch (e) {
          return '[Object]';
        }
      }

      return value;
    };

    const result = JSON.stringify(obj, replacer, 2);

    // Limit total output size
    if (result && result.length > 10000) {
      return result.substring(0, 10000) + '\n\n... [Output truncated - too large]';
    }

    return result || '[Unable to stringify]';
  } catch (e) {
    return `[Error: ${e instanceof Error ? e.message : String(e)}]`;
  }
}

function SwitchToggle({ enabled, set }: {
  enabled: boolean;
  set: (enabled: boolean) => void;
}) {
  return (
    <Switch
      className="group ml-1 relative inline-flex h-4 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-full focus:outline-none focus:ring-0"
      checked={enabled}
      onChange={set}
    >
      <span className="sr-only">Use setting</span>
      <span aria-hidden="true" className="pointer-events-none absolute h-full w-full rounded-md" />
      <span
        aria-hidden="true"
        className={clsx(
          enabled ? 'bg-slate-300' : 'bg-slate-200',
          'pointer-events-none absolute mx-auto h-3 w-7 rounded-full transition-colors duration-200 ease-in-out'
        )}
      />
      <span
        aria-hidden="true"
        className={clsx(
          enabled ? 'translate-x-4' : 'translate-x-0',
          'pointer-events-none absolute left-0 inline-block h-4 w-4 transform rounded-full border border-slate-300 bg-white shadow ring-0 transition-transform duration-200 ease-in-out'
        )}
        />
    </Switch>
  )
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

export function DebugPane({ onClickClose }: {
  onClickClose: () => void
}) {
  const [typeDebugEnabled, setTypeDebugEnabled] = useState(false);
  const [typeInfoEnabled, setTypeInfoEnabled] = useState(true);
  const [typeWarnEnabled, setTypeWarnEnabled] = useState(true);
  const [typeErrorEnabled, setTypeErrorEnabled] = useState(true);
  const [processedLogs, setProcessedLogs] = useState<Array<{log: any, message: string}>>([]);
  const [isProcessing, setIsProcessing] = useState(true);
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());

  const scrollRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const toggleExpanded = (index: number) => {
    setExpandedLogs(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  useKeyboardShortcut("Escape", onClickClose);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClickClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClickClose]);

  // Get filtered logs (lightweight, just filtering)
  const filteredLogs = useMemo(() => {
    const logs = (window as any).error_handler_logs || [];
    const recentLogs = logs.slice(-TOTAL_ITEMS_TO_SHOW);

    return recentLogs.filter((log: any) => {
      if (log.type === 'debug' && !typeDebugEnabled) return false;
      if ((log.type === 'info' || log.type === 'log') && !typeInfoEnabled) return false;
      if (log.type === 'warn' && !typeWarnEnabled) return false;
      if (log.type === 'error' && !typeErrorEnabled) return false;
      return true;
    });
  }, [typeDebugEnabled, typeInfoEnabled, typeWarnEnabled, typeErrorEnabled]);

  // Process logs asynchronously in chunks to avoid blocking
  useEffect(() => {
    setIsProcessing(true);

    const processLogs = async () => {
      const processed = filteredLogs.map((log: any) => {
        let logMessage = '';
        try {
          let args: any[] = [];

          if (log.args) {
            if (Array.isArray(log.args)) {
              args = log.args;
            } else if (typeof log.args === 'object') {
              try {
                args = Array.from(log.args);
              } catch {
                args = Object.values(log.args);
              }
            }
          }

          if (args.length === 0) {
            if (log.message) {
              args = [log.message];
            } else if (log.msg) {
              args = [log.msg];
            }
          }

          logMessage = args.map((v: any) => {
            if (v === null) return 'null';
            if (v === undefined) return 'undefined';
            if (typeof v === 'object') {
              try {
                // For arrays, show preview
                if (Array.isArray(v)) {
                  if (v.length === 0) return '[]';
                  if (v.length <= 3) return `[${v.join(', ')}]`;
                  return `[${v.length} items]`;
                }

                // For objects, show a compact preview
                const keys = Object.keys(v);
                if (keys.length === 0) return '{}';

                // Constructor name if available
                if (v.constructor && v.constructor.name !== 'Object') {
                  return `{${v.constructor.name}}`;
                }

                // Show first few keys
                if (keys.length <= 3) {
                  const preview = keys.map(k => `${k}: ${typeof v[k] === 'object' ? '...' : v[k]}`).join(', ');
                  return `{${preview}}`;
                }

                return `{${keys.length} keys: ${keys.slice(0, 2).join(', ')}, ...}`;
              } catch {
                return '[Object]';
              }
            }
            return String(v);
          }).join(" ");

          if (logMessage.length > 500) {
            logMessage = logMessage.substring(0, 500) + '...';
          }

          if (!logMessage) {
            logMessage = '(empty log)';
          }
        } catch (e) {
          logMessage = `[Error: ${e instanceof Error ? e.message : 'Unknown error'}]`;
        }

        return { log, message: logMessage };
      });

      setProcessedLogs(processed);
      setIsProcessing(false);

      // Scroll to bottom after processing
      requestAnimationFrame(() => {
        scrollRef.current?.scrollIntoView({
          behavior: "auto",
          block: "center",
        });
      });
    };

    // Use setTimeout to defer processing and let the modal render first
    const timeoutId = setTimeout(processLogs, 0);
    return () => clearTimeout(timeoutId);
  }, [filteredLogs]);

  function onClickCopy() {
    try {
      const logs = (window as any).error_handler_logs || [];
      navigator.clipboard.writeText(safeStringify(logs));
    } catch (e) {
      console.error('Failed to copy logs:', e);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center overflow-hidden p-4 md:p-8 animate-in fade-in duration-200">
      <div ref={modalRef} className="w-full h-full max-w-6xl bg-white/95 backdrop-blur-xl shadow-2xl flex flex-col md:max-h-[85vh] md:rounded-lg overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 bg-white/95 backdrop-blur-xl px-3 py-2 border-b border-slate-200/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Debug Console</h2>
              </div>
              <button
                onClick={onClickCopy}
                className="ml-2 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded px-2 py-1 transition-colors cursor-pointer text-xs font-medium"
                title="Copy logs to clipboard"
              >
                Copy
              </button>
            </div>
            <button
              onClick={onClickClose}
              className="bg-slate-100 hover:bg-slate-200 text-slate-900 rounded p-1 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* System Info */}
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
            <span className="bg-slate-100 px-2 py-1 rounded border border-slate-200">
              <span className="font-semibold text-slate-900">LLM:</span> <span className="text-slate-600">{config("chatbot_backend")}</span>
            </span>
            <span className="bg-slate-100 px-2 py-1 rounded border border-slate-200">
              <span className="font-semibold text-slate-900">TTS:</span> <span className="text-slate-600">{config("tts_backend")}</span>
            </span>
            <span className="bg-slate-100 px-2 py-1 rounded border border-slate-200">
              <span className="font-semibold text-slate-900">STT:</span> <span className="text-slate-600">{config("stt_backend")}</span>
            </span>
            <span className="bg-slate-100 px-2 py-1 rounded border border-slate-200">
              <span className="font-semibold text-slate-900">Build:</span> <span className="text-slate-600">{import.meta.env.VITE_CONFIG_BUILD_ID}</span>
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex-shrink-0 bg-slate-50 border-b border-slate-200 px-3 py-2">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors">
              Debug
              <SwitchToggle enabled={typeDebugEnabled} set={setTypeDebugEnabled} />
            </span>
            <span className="inline-flex items-center gap-2 rounded bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors">
              Info
              <SwitchToggle enabled={typeInfoEnabled} set={setTypeInfoEnabled} />
            </span>
            <span className="inline-flex items-center gap-2 rounded bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors">
              Warning
              <SwitchToggle enabled={typeWarnEnabled} set={setTypeWarnEnabled} />
            </span>
            <span className="inline-flex items-center gap-2 rounded bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors">
              Error
              <SwitchToggle enabled={typeErrorEnabled} set={setTypeErrorEnabled} />
            </span>
          </div>
        </div>

        {/* Log Content */}
        <div className="flex-1 overflow-y-auto bg-white p-3">
          {isProcessing ? (
            <div className="flex items-center justify-center h-32 text-slate-400">
              <div className="text-xs">Processing logs...</div>
            </div>
          ) : (
            <div className="space-y-1 font-mono text-xs">
              {processedLogs.map((item, idx) => {
                const { log, message: logMessage } = item;
                const isExpanded = expandedLogs.has(idx);

                // Try to extract details from any log type
                let errorObj: any = null;
                let stackFrames: StackFrame[] = [];
                let detailsObjects: any[] = [];

                if (log.args) {
                  const args = Array.isArray(log.args) ? log.args : Object.values(log.args);

                  // For errors, extract stack trace
                  if (log.type === 'error') {
                    errorObj = args.find((arg: any) => arg instanceof Error || (arg && arg.stack));
                    if (errorObj && errorObj.stack) {
                      stackFrames = parseStackTrace(errorObj.stack);
                    }
                  }

                  // For all log types, extract objects/arrays for details
                  detailsObjects = args.filter((arg: any) => {
                    if (arg === null || arg === undefined) return false;
                    if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean') return false;
                    if (arg instanceof Error) return false; // Already handled separately
                    return typeof arg === 'object';
                  });
                }

                const hasDetails = stackFrames.length > 0 || detailsObjects.length > 0;

                return (
                  <div
                    key={`${log.ts}-${idx}`}
                    className={clsx(
                      "rounded border transition-colors text-xs overflow-hidden",
                      log.type === 'error' && 'bg-rose-50 border-rose-200',
                      log.type === 'warn' && 'bg-amber-50 border-amber-200',
                      log.type === 'debug' && 'bg-slate-50 border-slate-200',
                      (log.type === 'info' || log.type === 'log') && 'bg-emerald-50 border-emerald-200',
                    )}
                  >
                    {/* Main log line - clickable if has details */}
                    <div
                      onClick={() => hasDetails && toggleExpanded(idx)}
                      className={clsx(
                        "px-2 py-1.5 flex items-start gap-2",
                        hasDetails && "cursor-pointer hover:bg-opacity-80"
                      )}
                    >
                      {log.type === 'debug' && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold text-slate-700 bg-slate-200 rounded uppercase flex-shrink-0">
                          DBG
                        </span>
                      )}
                      {(log.type === 'info' || log.type === 'log') && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-200 rounded uppercase flex-shrink-0">
                          INF
                        </span>
                      )}
                      {log.type === 'warn' && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold text-amber-700 bg-amber-200 rounded uppercase flex-shrink-0">
                          WRN
                        </span>
                      )}
                      {log.type === 'error' && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold text-rose-700 bg-rose-200 rounded uppercase flex-shrink-0">
                          ERR
                        </span>
                      )}

                      <span className="text-slate-500 text-[10px] flex-shrink-0 font-semibold">
                        {new Date(log.ts).toLocaleTimeString()}
                      </span>

                      <span className="text-slate-900 flex-1 break-all leading-tight">
                        {logMessage}
                      </span>

                      {hasDetails && (
                        <span className="text-slate-400 text-[10px] flex-shrink-0">
                          {isExpanded ? '▼' : '▶'}
                        </span>
                      )}
                    </div>

                    {/* Expanded details */}
                    {isExpanded && hasDetails && (
                      <div className="px-2 pb-2 border-t border-slate-200/50">
                        {/* Stack Frames */}
                        {stackFrames.length > 0 && (
                          <div className="mt-2">
                            <div className="text-[10px] font-semibold text-slate-600 mb-1">
                              📚 Stack Trace ({stackFrames.length} frames)
                            </div>
                            <div className="bg-white/50 rounded border border-slate-200/50">
                              {stackFrames.map((frame, frameIdx) => (
                                <div
                                  key={frameIdx}
                                  className="px-2 py-1 text-[10px] border-b border-slate-100 last:border-b-0"
                                >
                                  <div className="text-blue-600 font-semibold">
                                    {frame.functionName}
                                  </div>
                                  <div className="text-slate-500">
                                    {frame.fileName}:{frame.lineNumber}:{frame.columnNumber}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Object/Array details */}
                        {detailsObjects.map((obj, objIdx) => (
                          <div key={objIdx} className="mt-2">
                            <div className="text-[10px] font-semibold text-slate-600 mb-1">
                              {log.type === 'error' ? '🔍 Error Details' : '📦 Object Details'}
                              {detailsObjects.length > 1 && ` (${objIdx + 1}/${detailsObjects.length})`}
                            </div>
                            <pre className="bg-white/50 rounded border border-slate-200/50 p-2 text-[10px] overflow-x-auto max-h-60 overflow-y-auto">
                              {safeStringify(obj)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={scrollRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
