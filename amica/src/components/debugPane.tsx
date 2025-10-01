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
      className="group ml-1 relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer items-center justify-center rounded-full focus:outline-none focus:ring-0"
      checked={enabled}
      onChange={set}
    >
      <span className="sr-only">Use setting</span>
      <span aria-hidden="true" className="pointer-events-none absolute h-full w-full rounded-md" />
      <span
        aria-hidden="true"
        className={clsx(
          enabled ? 'bg-indigo-200' : 'bg-gray-200',
          'pointer-events-none absolute mx-auto h-4 w-9 rounded-full transition-colors duration-200 ease-in-out'
        )}
      />
      <span
        aria-hidden="true"
        className={clsx(
          enabled ? 'translate-x-5' : 'translate-x-0',
          'pointer-events-none absolute left-0 inline-block h-5 w-5 transform rounded-full border border-gray-200 bg-white shadow ring-0 transition-transform duration-200 ease-in-out'
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
      <div ref={modalRef} className="w-full h-full max-w-7xl bg-slate-50 shadow-2xl flex flex-col md:max-h-[90vh] md:rounded-lg overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 bg-slate-900 text-white p-5 shadow-lg border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight">Debug Console</h2>
                <p className="text-xs text-white/70">System logs and diagnostics</p>
              </div>
              <button
                onClick={onClickCopy}
                className="ml-2 bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-sm text-white rounded-lg px-3 py-2 transition-all hover:scale-105 cursor-pointer text-sm font-medium"
                title="Copy logs to clipboard"
              >
                Copy Logs
              </button>
            </div>
            <button
              onClick={onClickClose}
              className="bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-sm text-white rounded-lg p-2.5 transition-colors cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* System Info */}
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/20">
              <span className="font-semibold text-white/90">LLM:</span> <span className="text-white/70">{config("chatbot_backend")}</span>
            </span>
            <span className="bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/20">
              <span className="font-semibold text-white/90">TTS:</span> <span className="text-white/70">{config("tts_backend")}</span>
            </span>
            <span className="bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/20">
              <span className="font-semibold text-white/90">STT:</span> <span className="text-white/70">{config("stt_backend")}</span>
            </span>
            <span className="bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/20">
              <span className="font-semibold text-white/90">Build:</span> <span className="text-white/70">{import.meta.env.VITE_CONFIG_BUILD_ID}</span>
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex-shrink-0 bg-slate-800 border-b border-slate-700 p-4 shadow-sm">
          <div className="flex flex-wrap gap-2.5">
            <span className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 shadow-sm border border-slate-600 hover:bg-slate-600 transition-colors">
              Debug
              <SwitchToggle enabled={typeDebugEnabled} set={setTypeDebugEnabled} />
            </span>
            <span className="inline-flex items-center gap-2 rounded-lg bg-emerald-900/40 px-4 py-2 text-sm font-semibold text-emerald-300 shadow-sm border border-emerald-700/50 hover:bg-emerald-900/60 transition-colors">
              Info
              <SwitchToggle enabled={typeInfoEnabled} set={setTypeInfoEnabled} />
            </span>
            <span className="inline-flex items-center gap-2 rounded-lg bg-amber-900/40 px-4 py-2 text-sm font-semibold text-amber-300 shadow-sm border border-amber-700/50 hover:bg-amber-900/60 transition-colors">
              Warning
              <SwitchToggle enabled={typeWarnEnabled} set={setTypeWarnEnabled} />
            </span>
            <span className="inline-flex items-center gap-2 rounded-lg bg-rose-900/40 px-4 py-2 text-sm font-semibold text-rose-300 shadow-sm border border-rose-700/50 hover:bg-rose-900/60 transition-colors">
              Error
              <SwitchToggle enabled={typeErrorEnabled} set={setTypeErrorEnabled} />
            </span>
          </div>
        </div>

        {/* Log Content */}
        <div className="flex-1 overflow-y-auto bg-slate-950 p-5">
          {!isReady ? (
            <div className="flex items-center justify-center h-full text-slate-400">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-3 border-slate-700 border-t-slate-400 mx-auto mb-3"></div>
                <div className="text-sm font-medium">Loading logs...</div>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 font-mono text-xs">
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
                      "rounded px-3 py-2 flex items-start gap-3 border transition-colors hover:bg-slate-900/50",
                      log.type === 'error' && 'bg-red-950/20 border-red-900/30',
                      log.type === 'warn' && 'bg-amber-950/10 border-amber-900/20',
                      log.type === 'debug' && 'bg-slate-900/30 border-slate-800/50',
                      (log.type === 'info' || log.type === 'log') && 'bg-emerald-950/10 border-emerald-900/20',
                    )}
                  >
                    {log.type === 'debug' && (
                      <span className="px-2 py-1 text-[10px] font-bold text-slate-400 bg-slate-800 rounded uppercase flex-shrink-0 border border-slate-700">
                        DBG
                      </span>
                    )}
                    {(log.type === 'info' || log.type === 'log') && (
                      <span className="px-2 py-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/60 rounded uppercase flex-shrink-0 border border-emerald-800">
                        INF
                      </span>
                    )}
                    {log.type === 'warn' && (
                      <span className="px-2 py-1 text-[10px] font-bold text-amber-400 bg-amber-950/60 rounded uppercase flex-shrink-0 border border-amber-800">
                        WRN
                      </span>
                    )}
                    {log.type === 'error' && (
                      <span className="px-2 py-1 text-[10px] font-bold text-rose-400 bg-rose-950/60 rounded uppercase flex-shrink-0 border border-rose-800">
                        ERR
                      </span>
                    )}

                    <span className="text-slate-500 text-[10px] flex-shrink-0 font-semibold pt-1">
                      {new Date(log.ts).toLocaleTimeString()}
                    </span>

                    <span className="text-slate-200 flex-1 break-all leading-relaxed">
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
