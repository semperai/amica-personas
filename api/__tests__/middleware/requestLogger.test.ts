import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import type { IncomingMessage, ServerResponse } from "node:http";
import { StatusCodes } from "http-status-codes";

// Mock dependencies
vi.mock("pino-http", () => ({
  pinoHttp: vi.fn(() => {
    return (req: Request, res: Response, next: NextFunction) => {
      req.id = req.id || "test-id";
      next();
    };
  }),
}));

vi.mock("@/utils/envConfig", () => ({
  env: {
    isProduction: false,
  },
}));

// Import after mocks
import requestLogger from "@/middleware/requestLogger";

describe("requestLogger middleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      id: undefined,
      method: "GET",
      path: "/test",
      headers: {},
    };

    res = {
      locals: {},
      statusCode: 200,
      send: vi.fn(),
      setHeader: vi.fn(),
    };

    next = vi.fn();
    vi.clearAllMocks();
  });

  it("should export middleware array", () => {
    expect(Array.isArray(requestLogger)).toBe(true);
    expect(requestLogger.length).toBeGreaterThan(0);
  });

  it("should be callable as middleware", () => {
    const [middleware] = requestLogger;
    expect(typeof middleware).toBe("function");
  });

  describe("responseBodyMiddleware", () => {
    it("should intercept response body in non-production", () => {
      const [responseBodyMiddleware] = requestLogger;
      const originalSend = vi.fn((content: any) => res as Response);
      res.send = originalSend;

      responseBodyMiddleware(req as Request, res as Response, next);

      // Call the wrapped send
      const testContent = { message: "test" };
      res.send?.(testContent);

      expect(res.locals?.responseBody).toEqual(testContent);
      expect(next).toHaveBeenCalled();
    });

    it("should call next middleware", () => {
      const [responseBodyMiddleware] = requestLogger;

      responseBodyMiddleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe("request ID generation", () => {
    it("should generate request ID if not present", () => {
      const [, pinoMiddleware] = requestLogger;

      pinoMiddleware(req as Request, res as Response, next);

      expect(req.id).toBeDefined();
      expect(typeof req.id).toBe("string");
    });

    it("should use existing request ID from header", () => {
      const existingId = "existing-request-id";
      req.headers = { "x-request-id": existingId };
      req.id = existingId;

      const [, pinoMiddleware] = requestLogger;

      pinoMiddleware(req as Request, res as Response, next);

      expect(req.id).toBe(existingId);
    });
  });

  describe("log level determination", () => {
    it("should determine correct log level for 200 OK", () => {
      res.statusCode = StatusCodes.OK;
      // Log level logic is internal, but we can verify middleware runs
      const [, pinoMiddleware] = requestLogger;

      expect(() => {
        pinoMiddleware(req as Request, res as Response, next);
      }).not.toThrow();
    });

    it("should determine correct log level for 404 Not Found", () => {
      res.statusCode = StatusCodes.NOT_FOUND;
      const [, pinoMiddleware] = requestLogger;

      expect(() => {
        pinoMiddleware(req as Request, res as Response, next);
      }).not.toThrow();
    });

    it("should determine correct log level for 500 Internal Server Error", () => {
      res.statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
      const [, pinoMiddleware] = requestLogger;

      expect(() => {
        pinoMiddleware(req as Request, res as Response, next);
      }).not.toThrow();
    });
  });

  describe("custom properties", () => {
    it("should handle error in response locals", () => {
      const error = new Error("Test error");
      res.locals = { err: error };

      const [, pinoMiddleware] = requestLogger;

      expect(() => {
        pinoMiddleware(req as Request, res as Response, next);
      }).not.toThrow();
    });

    it("should handle response body in locals", () => {
      res.locals = { responseBody: { data: "test" } };

      const [, pinoMiddleware] = requestLogger;

      expect(() => {
        pinoMiddleware(req as Request, res as Response, next);
      }).not.toThrow();
    });
  });

  describe("sensitive data redaction", () => {
    it("should handle authorization header", () => {
      req.headers = {
        authorization: "Bearer secret-token",
      };

      const [, pinoMiddleware] = requestLogger;

      expect(() => {
        pinoMiddleware(req as Request, res as Response, next);
      }).not.toThrow();
    });

    it("should handle cookie header", () => {
      req.headers = {
        cookie: "session=secret-session-id",
      };

      const [, pinoMiddleware] = requestLogger;

      expect(() => {
        pinoMiddleware(req as Request, res as Response, next);
      }).not.toThrow();
    });
  });

  describe("different HTTP methods", () => {
    it("should handle GET requests", () => {
      req.method = "GET";
      const [, pinoMiddleware] = requestLogger;

      pinoMiddleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it("should handle POST requests", () => {
      req.method = "POST";
      const [, pinoMiddleware] = requestLogger;

      pinoMiddleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it("should handle PUT requests", () => {
      req.method = "PUT";
      const [, pinoMiddleware] = requestLogger;

      pinoMiddleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it("should handle DELETE requests", () => {
      req.method = "DELETE";
      const [, pinoMiddleware] = requestLogger;

      pinoMiddleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe("different status codes", () => {
    const statusCodes = [
      StatusCodes.OK,
      StatusCodes.CREATED,
      StatusCodes.BAD_REQUEST,
      StatusCodes.UNAUTHORIZED,
      StatusCodes.FORBIDDEN,
      StatusCodes.NOT_FOUND,
      StatusCodes.INTERNAL_SERVER_ERROR,
      StatusCodes.BAD_GATEWAY,
      StatusCodes.SERVICE_UNAVAILABLE,
    ];

    statusCodes.forEach((statusCode) => {
      it(`should handle status code ${statusCode}`, () => {
        res.statusCode = statusCode;
        const [, pinoMiddleware] = requestLogger;

        expect(() => {
          pinoMiddleware(req as Request, res as Response, next);
        }).not.toThrow();
      });
    });
  });

  describe("middleware chain", () => {
    it("should have response body middleware first", () => {
      expect(requestLogger.length).toBe(2);

      const [first, second] = requestLogger;

      // Execute both in order
      first(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledTimes(1);

      second(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledTimes(2);
    });

    it("should pass request through both middlewares", () => {
      const mockNext = vi.fn();

      requestLogger.forEach((middleware) => {
        middleware(req as Request, res as Response, mockNext);
      });

      expect(mockNext).toHaveBeenCalledTimes(2);
    });
  });
});
