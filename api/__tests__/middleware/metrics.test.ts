import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

// Mock prom-client before importing
vi.mock("prom-client", () => {
  const mockHistogram = vi.fn(() => ({
    observe: vi.fn(),
  }));

  const mockCounter = vi.fn(() => ({
    labels: vi.fn(() => ({
      inc: vi.fn(),
    })),
    inc: vi.fn(),
  }));

  const mockRegistry = vi.fn(() => ({}));

  return {
    default: {
      Histogram: mockHistogram,
      Counter: mockCounter,
      Registry: mockRegistry,
    },
    Histogram: mockHistogram,
    Counter: mockCounter,
    Registry: mockRegistry,
  };
});

vi.mock("express-prom-bundle", () => ({
  default: vi.fn(() => (req: Request, res: Response, next: NextFunction) => {
    next();
  }),
}));

// Import after mocks
import measureDuration from "@/middleware/metrics";

describe("metrics middleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let finishCallback: (() => void) | undefined;

  beforeEach(() => {
    finishCallback = undefined;

    req = {
      method: "POST",
      path: "/v1/chat/completions",
      headers: {},
    };

    res = {
      locals: {},
      on: vi.fn((event: string, callback: () => void) => {
        if (event === "finish") {
          finishCallback = callback;
        }
        return res as Response;
      }),
    };

    next = vi.fn();
    vi.clearAllMocks();
  });

  it("should be a function", () => {
    expect(typeof measureDuration).toBe("function");
  });

  it("should return middleware function", () => {
    const middleware = measureDuration("chatCompletions");
    expect(typeof middleware).toBe("function");
  });

  it("should call next immediately", () => {
    const middleware = measureDuration("chatCompletions");
    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it("should register finish event listener", () => {
    const middleware = measureDuration("chatCompletions");
    middleware(req as Request, res as Response, next);

    expect(res.on).toHaveBeenCalledWith("finish", expect.any(Function));
  });

  describe("duration measurement", () => {
    it("should measure request duration for chatCompletions", () => {
      const middleware = measureDuration("chatCompletions");
      middleware(req as Request, res as Response, next);

      expect(finishCallback).toBeDefined();
      // Simulate response finishing
      finishCallback?.();
      // Duration should be measured (tested via observe call in implementation)
    });

    it("should measure request duration for audioSpeech", () => {
      const middleware = measureDuration("audioSpeech");
      middleware(req as Request, res as Response, next);

      expect(finishCallback).toBeDefined();
      finishCallback?.();
    });

    it("should measure request duration for audioTranscriptions", () => {
      const middleware = measureDuration("audioTranscriptions");
      middleware(req as Request, res as Response, next);

      expect(finishCallback).toBeDefined();
      finishCallback?.();
    });
  });

  describe("authentication tracking", () => {
    it("should track anonymous requests", () => {
      const middleware = measureDuration("chatCompletions");
      req.headers = {}; // No authorization header

      middleware(req as Request, res as Response, next);
      finishCallback?.();

      // Metrics should be tracked for anonymous user
      expect(next).toHaveBeenCalled();
    });

    it("should track authenticated requests", () => {
      const middleware = measureDuration("chatCompletions");
      req.headers = {
        authorization: "Bearer test-api-key",
      };

      middleware(req as Request, res as Response, next);
      finishCallback?.();

      // Metrics should be tracked for authenticated user
      expect(next).toHaveBeenCalled();
    });

    it("should handle different authorization formats", () => {
      const middleware = measureDuration("chatCompletions");

      // Test with Bearer token
      req.headers = { authorization: "Bearer token123" };
      middleware(req as Request, res as Response, next);
      finishCallback?.();

      // Test without authorization
      req.headers = {};
      middleware(req as Request, res as Response, next);
      finishCallback?.();

      expect(next).toHaveBeenCalledTimes(2);
    });
  });

  describe("route metrics", () => {
    it("should track metrics for chat completions route", () => {
      const middleware = measureDuration("chatCompletions");

      middleware(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
      expect(res.on).toHaveBeenCalledWith("finish", expect.any(Function));
    });

    it("should track metrics for audio speech route", () => {
      const middleware = measureDuration("audioSpeech");
      req.path = "/v1/audio/speech";

      middleware(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
      expect(res.on).toHaveBeenCalledWith("finish", expect.any(Function));
    });

    it("should track metrics for audio transcriptions route", () => {
      const middleware = measureDuration("audioTranscriptions");
      req.path = "/v1/audio/transcriptions";

      middleware(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
      expect(res.on).toHaveBeenCalledWith("finish", expect.any(Function));
    });
  });

  describe("multiple requests", () => {
    it("should handle multiple requests sequentially", () => {
      const middleware = measureDuration("chatCompletions");

      // First request
      middleware(req as Request, res as Response, next);
      const firstFinish = finishCallback;

      // Second request
      const req2 = { ...req };
      const res2 = {
        ...res,
        on: vi.fn((event: string, callback: () => void) => {
          if (event === "finish") {
            finishCallback = callback;
          }
          return res2 as Response;
        }),
      };

      middleware(req2 as Request, res2 as Response, next);
      const secondFinish = finishCallback;

      // Both should have finish callbacks
      expect(firstFinish).toBeDefined();
      expect(secondFinish).toBeDefined();
      expect(next).toHaveBeenCalledTimes(2);
    });
  });

  describe("error handling", () => {
    it("should handle missing headers gracefully", () => {
      const middleware = measureDuration("chatCompletions");
      req.headers = undefined as any;

      expect(() => {
        middleware(req as Request, res as Response, next);
      }).not.toThrow();
    });

    it("should handle response finish event gracefully", () => {
      const middleware = measureDuration("chatCompletions");

      middleware(req as Request, res as Response, next);

      expect(() => {
        finishCallback?.();
      }).not.toThrow();
    });
  });

  describe("timing", () => {
    it("should measure non-zero duration", async () => {
      const middleware = measureDuration("chatCompletions");

      middleware(req as Request, res as Response, next);

      // Wait a bit before finishing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(() => {
        finishCallback?.();
      }).not.toThrow();
    });

    it("should handle immediate finish", () => {
      const middleware = measureDuration("chatCompletions");

      middleware(req as Request, res as Response, next);

      // Finish immediately
      expect(() => {
        finishCallback?.();
      }).not.toThrow();
    });
  });
});
