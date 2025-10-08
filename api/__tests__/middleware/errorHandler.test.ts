import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { setupMockEnv } from "../utils/mockEnv";

setupMockEnv();

import errorHandler from "@/middleware/errorHandler";
import * as logger from "@/utils/logger";
import { apiCallErrors } from "@/metrics";

vi.mock("@/utils/logger");
vi.mock("@/metrics", () => ({
  apiCallErrors: {
    inc: vi.fn(),
  },
}));

describe("errorHandler middleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      id: "test-request-id",
      path: "/test/path",
      method: "POST",
    };

    res = {
      locals: {},
      sendStatus: vi.fn(),
      statusCode: 500,
    };

    next = vi.fn();
    vi.clearAllMocks();
  });

  describe("unexpectedRequest handler", () => {
    it("should return 404 for unknown routes", () => {
      const [unexpectedRequest] = errorHandler();

      unexpectedRequest(req as Request, res as Response, next);

      expect(res.sendStatus).toHaveBeenCalledWith(StatusCodes.NOT_FOUND);
      expect(logger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Route not found",
        }),
        {
          path: "/test/path",
          method: "POST",
          requestId: "test-request-id",
        },
      );
    });

    it("should log error with correct request context", () => {
      const [unexpectedRequest] = errorHandler();
      req.path = "/api/nonexistent";
      req.method = "GET";
      req.id = "unique-id-123";

      unexpectedRequest(req as Request, res as Response, next);

      expect(logger.logError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          path: "/api/nonexistent",
          method: "GET",
          requestId: "unique-id-123",
        }),
      );
    });
  });

  describe("addErrorToRequestLog handler", () => {
    it("should add error to response locals", () => {
      const [, addErrorToRequestLog] = errorHandler();
      const error = new Error("Test error");

      addErrorToRequestLog(error, req as Request, res as Response, next);

      expect(res.locals?.err).toBe(error);
    });

    it("should log error with full context", () => {
      const [, addErrorToRequestLog] = errorHandler();
      const error = new Error("Database connection failed");

      res.locals = {
        accountInfo: {
          userId: "user-123",
          tier: "pro",
        },
      };
      res.statusCode = 500;

      addErrorToRequestLog(error, req as Request, res as Response, next);

      expect(logger.logError).toHaveBeenCalledWith(error, {
        requestId: "test-request-id",
        path: "/test/path",
        method: "POST",
        userId: "user-123",
        tier: "pro",
        statusCode: 500,
      });
    });

    it("should track error metrics", () => {
      const [, addErrorToRequestLog] = errorHandler();
      const error = new Error("Validation error");
      error.name = "ValidationError";

      addErrorToRequestLog(error, req as Request, res as Response, next);

      expect(apiCallErrors.inc).toHaveBeenCalledWith({
        service: "api",
        endpoint: "/test/path",
        error_type: "ValidationError",
      });
    });

    it("should use UnknownError as default error type", () => {
      const [, addErrorToRequestLog] = errorHandler();
      const error = new Error("Generic error");
      error.name = "";

      addErrorToRequestLog(error, req as Request, res as Response, next);

      expect(apiCallErrors.inc).toHaveBeenCalledWith({
        service: "api",
        endpoint: "/test/path",
        error_type: "UnknownError",
      });
    });

    it("should call next with the error", () => {
      const [, addErrorToRequestLog] = errorHandler();
      const error = new Error("Test error");

      addErrorToRequestLog(error, req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });

    it("should handle errors without accountInfo", () => {
      const [, addErrorToRequestLog] = errorHandler();
      const error = new Error("Anonymous error");

      res.locals = {};

      addErrorToRequestLog(error, req as Request, res as Response, next);

      expect(logger.logError).toHaveBeenCalledWith(error, {
        requestId: "test-request-id",
        path: "/test/path",
        method: "POST",
        userId: undefined,
        tier: undefined,
        statusCode: 500,
      });
    });

    it("should handle different error types", () => {
      const [, addErrorToRequestLog] = errorHandler();

      // TypeError
      const typeError = new TypeError("Type mismatch");
      addErrorToRequestLog(typeError, req as Request, res as Response, next);

      expect(apiCallErrors.inc).toHaveBeenCalledWith({
        service: "api",
        endpoint: "/test/path",
        error_type: "TypeError",
      });

      // RangeError
      const rangeError = new RangeError("Out of range");
      addErrorToRequestLog(rangeError, req as Request, res as Response, next);

      expect(apiCallErrors.inc).toHaveBeenCalledWith({
        service: "api",
        endpoint: "/test/path",
        error_type: "RangeError",
      });
    });

    it("should handle errors on different endpoints", () => {
      const [, addErrorToRequestLog] = errorHandler();
      const error = new Error("Endpoint error");

      req.path = "/v1/chat/completions";
      req.method = "POST";

      addErrorToRequestLog(error, req as Request, res as Response, next);

      expect(apiCallErrors.inc).toHaveBeenCalledWith({
        service: "api",
        endpoint: "/v1/chat/completions",
        error_type: "Error",
      });
    });
  });

  describe("errorHandler factory", () => {
    it("should return array with both handlers", () => {
      const handlers = errorHandler();

      expect(Array.isArray(handlers)).toBe(true);
      expect(handlers).toHaveLength(2);
      expect(typeof handlers[0]).toBe("function");
      expect(typeof handlers[1]).toBe("function");
    });
  });
});
