import { useEffect, useRef, useState, useMemo } from "react";
import { Switch } from '@headlessui/react'
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { clsx } from "clsx";
import { config } from "@/utils/config";

const TOTAL_ITEMS_TO_SHOW = 50;

// Safe JSON stringify that handles circular references
function safeStringify(obj: any): string {
  try {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    }, 2);
  } catch (e) {
    return String(obj);
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

export function DebugPane({ onClickClose }: {
  onClickClose: () => void
}) {
  const [typeDebugEnabled, setTypeDebugEnabled] = useState(false);
  const [typeInfoEnabled, setTypeInfoEnabled] = useState(true);
  const [typeWarnEnabled, setTypeWarnEnabled] = useState(true);
  const [typeErrorEnabled, setTypeErrorEnabled] = useState(true);
  const [isReady, setIsReady] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

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

  // Get logs safely and defer processing
  const filteredLogs = useMemo(() => {
    // Don't process logs until modal is ready
    if (!isReady) return [];

    const logs = (window as any).error_handler_logs || [];
    const recentLogs = logs.slice(-TOTAL_ITEMS_TO_SHOW);

    return recentLogs.filter((log: any) => {
      if (log.type === 'debug' && !typeDebugEnabled) return false;
      if ((log.type === 'info' || log.type === 'log') && !typeInfoEnabled) return false;
      if (log.type === 'warn' && !typeWarnEnabled) return false;
      if (log.type === 'error' && !typeErrorEnabled) return false;
      return true;
    });
  }, [typeDebugEnabled, typeInfoEnabled, typeWarnEnabled, typeErrorEnabled, isReady]);

  // Defer heavy rendering until after modal opens
  useEffect(() => {
    // Use requestAnimationFrame for better timing
    const rafId = requestAnimationFrame(() => {
      setTimeout(() => {
        setIsReady(true);
        requestAnimationFrame(() => {
          scrollRef.current?.scrollIntoView({
            behavior: "auto",
            block: "center",
          });
        });
      }, 100);
    });

    return () => cancelAnimationFrame(rafId);
  }, []);

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
          {!isReady ? (
            <div className="flex items-center justify-center h-full text-slate-600">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-slate-600 mx-auto mb-2"></div>
                <div className="text-xs font-medium">Loading logs...</div>
              </div>
            </div>
          ) : (
            <div className="space-y-1 font-mono text-xs">
              {filteredLogs.map((log: any, idx: number) => {
                // Prepare log message string (lightweight)
                let logMessage = '';
                try {
                  logMessage = [...log.arguments].map((v: any) =>
                    typeof v === 'object' ? '[Object]' : String(v)
                  ).join(" ");
                  if (logMessage.length > 500) {
                    logMessage = logMessage.substring(0, 500) + '...';
                  }
                } catch (e) {
                  logMessage = '[Error rendering log]';
                }

                return (
                  <div
                    key={log.ts+idx}
                    className={clsx(
                      "rounded px-2 py-1.5 flex items-start gap-2 border transition-colors text-xs",
                      log.type === 'error' && 'bg-rose-50 border-rose-200 hover:bg-rose-100',
                      log.type === 'warn' && 'bg-amber-50 border-amber-200 hover:bg-amber-100',
                      log.type === 'debug' && 'bg-slate-50 border-slate-200 hover:bg-slate-100',
                      (log.type === 'info' || log.type === 'log') && 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
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
