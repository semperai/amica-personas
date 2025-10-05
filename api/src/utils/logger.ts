import pino, { type Logger } from "pino";
import { env } from "@/utils/envConfig";

// Create base logger with structured configuration
const baseLogger = pino({
  level: env.LOG_LEVEL || (env.isProduction ? "info" : "debug"),
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(env.isProduction
    ? {
        // Production: JSON output for log aggregation
      }
    : {
        // Development: Pretty print
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss Z",
            ignore: "pid,hostname",
          },
        },
      }),
});

// Create logger with context helpers
export const logger = baseLogger;

// Helper to create child logger with context
export const createLogger = (context: Record<string, unknown>): Logger => {
  return logger.child(context);
};

// Helper to log errors with full context
export const logError = (error: Error, context?: Record<string, unknown>) => {
  logger.error(
    {
      err: {
        message: error.message,
        stack: error.stack,
        name: error.name,
        ...error,
      },
      ...context,
    },
    `Error: ${error.message}`,
  );
};

// Helper to log with request context
export const logWithRequest = (
  req: any,
  level: "info" | "warn" | "error",
  message: string,
  meta?: Record<string, unknown>,
) => {
  const requestContext = {
    requestId: req.id,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userId: req.user?.id,
    ...meta,
  };

  logger[level](requestContext, message);
};

export default logger;
