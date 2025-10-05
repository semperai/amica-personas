import "./instrument.ts";
import { app } from "@/server";
// this should be loaded first (well after instrumentation)
// so that we can read the env variables
import { env } from "@/utils/envConfig";
import { createLogger } from "@/utils/logger";

const logger = createLogger({ component: "main" });

const server = app.listen(env.PORT, () => {
  const { NODE_ENV, HOST, PORT } = env;
  logger.info(`Server (${NODE_ENV}) running on port http://${HOST}:${PORT}`);
});

let isShuttingDown = false;

const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) {
    logger.warn("Shutdown already in progress, ignoring signal");
    return;
  }

  isShuttingDown = true;
  logger.info({ signal }, "Received shutdown signal, starting graceful shutdown...");

  // Stop accepting new connections
  server.close(async () => {
    logger.info("HTTP server closed, no longer accepting new connections");

    try {
      // Close database connections if any are open
      // Note: Add your database cleanup here when connection pooling is implemented
      // await pool.end();

      logger.info("All resources cleaned up successfully");
      process.exit(0);
    } catch (error) {
      logger.error({ error }, "Error during shutdown cleanup");
      process.exit(1);
    }
  });

  // Force shutdown after 30 seconds if graceful shutdown hangs
  setTimeout(() => {
    logger.error("Graceful shutdown timeout exceeded, forcing shutdown");
    process.exit(1);
  }, 30000);
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

// Handle uncaught errors gracefully
process.on("uncaughtException", (error) => {
  logger.fatal({ error }, "Uncaught exception, shutting down");
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, promise) => {
  logger.fatal({ reason, promise }, "Unhandled promise rejection, shutting down");
  gracefulShutdown("unhandledRejection");
});
