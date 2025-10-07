import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  logger,
  createLogger,
  logError,
  logWithRequest,
} from "@/utils/logger";

// Mock pino to avoid actual logging during tests
vi.mock("pino", () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  };

  // Make child return a new mock logger with the same methods
  mockLogger.child.mockImplementation((context: any) => ({
    ...mockLogger,
    context,
  }));

  const pinoMock = vi.fn(() => mockLogger);
  pinoMock.stdTimeFunctions = {
    isoTime: vi.fn(() => new Date().toISOString()),
  };

  return {
    default: pinoMock,
  };
});

vi.mock("@/utils/envConfig", () => ({
  env: {
    LOG_LEVEL: "debug",
    isProduction: false,
  },
}));

describe("logger utility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("logger", () => {
    it("should be defined", () => {
      expect(logger).toBeDefined();
    });

    it("should have standard logging methods", () => {
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.debug).toBe("function");
    });

    it("should support info logging", () => {
      logger.info("Test info message");
      expect(logger.info).toHaveBeenCalledWith("Test info message");
    });

    it("should support error logging", () => {
      logger.error("Test error message");
      expect(logger.error).toHaveBeenCalledWith("Test error message");
    });

    it("should support warn logging", () => {
      logger.warn("Test warning message");
      expect(logger.warn).toHaveBeenCalledWith("Test warning message");
    });

    it("should support debug logging", () => {
      logger.debug("Test debug message");
      expect(logger.debug).toHaveBeenCalledWith("Test debug message");
    });
  });

  describe("createLogger", () => {
    it("should create child logger with context", () => {
      const context = { userId: "123", requestId: "abc" };
      const childLogger = createLogger(context);

      expect(logger.child).toHaveBeenCalledWith(context);
      expect(childLogger).toBeDefined();
    });

    it("should handle empty context", () => {
      const childLogger = createLogger({});

      expect(logger.child).toHaveBeenCalledWith({});
      expect(childLogger).toBeDefined();
    });

    it("should handle complex context objects", () => {
      const context = {
        service: "api",
        version: "1.0.0",
        environment: "test",
        metadata: {
          nested: "value",
        },
      };

      const childLogger = createLogger(context);

      expect(logger.child).toHaveBeenCalledWith(context);
      expect(childLogger).toBeDefined();
    });
  });

  describe("logError", () => {
    it("should log error with message and stack", () => {
      const error = new Error("Test error");
      logError(error);

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.objectContaining({
            message: "Test error",
            stack: expect.any(String),
            name: "Error",
          }),
        }),
        "Error: Test error",
      );
    });

    it("should log error with additional context", () => {
      const error = new Error("Database error");
      const context = {
        userId: "user-123",
        operation: "insert",
      };

      logError(error, context);

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.objectContaining({
            message: "Database error",
            name: "Error",
          }),
          userId: "user-123",
          operation: "insert",
        }),
        "Error: Database error",
      );
    });

    it("should handle TypeError", () => {
      const error = new TypeError("Type mismatch");
      logError(error);

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.objectContaining({
            message: "Type mismatch",
            name: "TypeError",
          }),
        }),
        "Error: Type mismatch",
      );
    });

    it("should handle custom error properties", () => {
      const error = new Error("Custom error") as any;
      error.code = "ERR_CUSTOM";
      error.statusCode = 500;

      logError(error);

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.objectContaining({
            message: "Custom error",
            code: "ERR_CUSTOM",
            statusCode: 500,
          }),
        }),
        "Error: Custom error",
      );
    });

    it("should log error without context", () => {
      const error = new Error("Simple error");
      logError(error);

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("logWithRequest", () => {
    const mockRequest = {
      id: "req-123",
      method: "POST",
      path: "/api/test",
      ip: "127.0.0.1",
      user: { id: "user-456" },
    };

    it("should log info level with request context", () => {
      logWithRequest(mockRequest, "info", "Request processed");

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: "req-123",
          method: "POST",
          path: "/api/test",
          ip: "127.0.0.1",
          userId: "user-456",
        }),
        "Request processed",
      );
    });

    it("should log warn level with request context", () => {
      logWithRequest(mockRequest, "warn", "Slow request");

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: "req-123",
          method: "POST",
          path: "/api/test",
        }),
        "Slow request",
      );
    });

    it("should log error level with request context", () => {
      logWithRequest(mockRequest, "error", "Request failed");

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: "req-123",
          method: "POST",
          path: "/api/test",
        }),
        "Request failed",
      );
    });

    it("should include additional metadata", () => {
      const meta = {
        duration: 150,
        statusCode: 200,
      };

      logWithRequest(mockRequest, "info", "Request completed", meta);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: "req-123",
          method: "POST",
          path: "/api/test",
          duration: 150,
          statusCode: 200,
        }),
        "Request completed",
      );
    });

    it("should handle request without user", () => {
      const requestWithoutUser = {
        id: "req-789",
        method: "GET",
        path: "/health",
        ip: "192.168.1.1",
      };

      logWithRequest(requestWithoutUser, "info", "Health check");

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: "req-789",
          method: "GET",
          path: "/health",
          ip: "192.168.1.1",
          userId: undefined,
        }),
        "Health check",
      );
    });

    it("should handle different request methods", () => {
      const getRequest = { ...mockRequest, method: "GET" };
      const deleteRequest = { ...mockRequest, method: "DELETE" };

      logWithRequest(getRequest, "info", "GET request");
      logWithRequest(deleteRequest, "warn", "DELETE request");

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ method: "GET" }),
        "GET request",
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ method: "DELETE" }),
        "DELETE request",
      );
    });

    it("should handle different paths", () => {
      const chatRequest = { ...mockRequest, path: "/v1/chat/completions" };
      const embedRequest = { ...mockRequest, path: "/v1/embeddings" };

      logWithRequest(chatRequest, "info", "Chat request");
      logWithRequest(embedRequest, "info", "Embed request");

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ path: "/v1/chat/completions" }),
        "Chat request",
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ path: "/v1/embeddings" }),
        "Embed request",
      );
    });
  });
});
