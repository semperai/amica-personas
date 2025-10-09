export const LOG_PREFIX = "[VAD]"

const levels = ["error", "warn", "info", "debug"] as const
type Level = (typeof levels)[number]
type LogFn = (...args: unknown[]) => void
type Logger = Record<Level, LogFn>

/**
 * Log level priority (higher = more important)
 */
const LEVEL_PRIORITY: Record<Level, number> = {
  error: 3,
  warn: 2,
  info: 1,
  debug: 0,
}

/**
 * Configuration for VAD logging
 */
export interface LogConfig {
  /** Minimum log level to display. Messages below this level will be suppressed. */
  minLevel: Level
  /** Whether to include timestamps in log messages */
  timestamps: boolean
  /** Custom prefix for log messages */
  prefix?: string
}

let currentConfig: LogConfig = {
  minLevel: "warn",
  timestamps: false,
  prefix: LOG_PREFIX,
}

/**
 * Configure VAD logging behavior
 */
export function configureLogging(config: Partial<LogConfig>): void {
  currentConfig = { ...currentConfig, ...config }
}

/**
 * Get the current logging configuration
 */
export function getLoggingConfig(): Readonly<LogConfig> {
  return { ...currentConfig }
}

function shouldLog(level: Level): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentConfig.minLevel]
}

function getLog(level: Level): LogFn {
  return (...args: unknown[]) => {
    if (!shouldLog(level)) {
      return
    }

    const prefix = currentConfig.prefix ?? LOG_PREFIX
    const timestamp = currentConfig.timestamps ? `[${new Date().toISOString()}]` : ""

    const logArgs = timestamp ? [prefix, timestamp, ...args] : [prefix, ...args]

    // Map 'info' to 'log' since console.info might not exist in all environments
    const consoleMethod = level === "info" ? "log" : level
    console[consoleMethod](...logArgs)
  }
}

const _log = levels.reduce<Partial<Logger>>((acc, level) => {
  acc[level] = getLog(level)
  return acc
}, {})

export const log = _log as Logger
