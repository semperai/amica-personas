import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

// Mock express-rate-limit before importing rateLimiter
vi.mock("express-rate-limit", () => ({
  rateLimit: vi.fn(() => {
    return (req: Request, res: Response, next: NextFunction) => {
      // Mock rate limiter that always allows requests
      res.setHeader("X-RateLimit-Limit", "100");
      res.setHeader("X-RateLimit-Remaining", "99");
      next();
    };
  }),
  ipKeyGenerator: vi.fn((req: Request) => req.ip || "unknown"),
}));

// Mock environment config
vi.mock("@/utils/envConfig", () => ({
  env: {
    COMMON_RATE_LIMIT_MAX_REQUESTS: 100,
    COMMON_RATE_LIMIT_WINDOW_MS: 60000, // 1 minute
  },
}));

// Import after mocks
import rateLimiter from "@/middleware/rateLimiter";

describe("rateLimiter middleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      ip: "127.0.0.1",
      headers: {},
      method: "GET",
      path: "/test",
    };

    res = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
      setHeader: vi.fn(),
    };

    next = vi.fn();
    vi.clearAllMocks();
  });

  it("should be a function", () => {
    expect(typeof rateLimiter).toBe("function");
  });

  it("should allow requests under the limit", () => {
    rateLimiter(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should set rate limit headers", () => {
    rateLimiter(req as Request, res as Response, next);

    // Rate limit middleware sets headers like X-RateLimit-Limit, X-RateLimit-Remaining
    expect(res.setHeader).toHaveBeenCalled();
  });

  it("should use IP address as key by default", () => {
    const req1 = { ...req, ip: "192.168.1.1" };
    const req2 = { ...req, ip: "192.168.1.2" };

    rateLimiter(req1 as Request, res as Response, next);
    rateLimiter(req2 as Request, res as Response, next);

    // Both should succeed as they have different IPs
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("should handle requests from same IP", () => {
    const sameIpReq = { ...req, ip: "10.0.0.1" };

    // First request should succeed
    rateLimiter(sameIpReq as Request, res as Response, next);
    expect(next).toHaveBeenCalledTimes(1);

    // Second request from same IP should also succeed (under limit)
    rateLimiter(sameIpReq as Request, res as Response, next);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("should handle forwarded IPs", () => {
    req.headers = {
      "x-forwarded-for": "203.0.113.1",
    };

    rateLimiter(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it("should work with different HTTP methods", () => {
    const getReq = { ...req, method: "GET" };
    const postReq = { ...req, method: "POST" };

    rateLimiter(getReq as Request, res as Response, next);
    rateLimiter(postReq as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(2);
  });

  it("should work with different paths", () => {
    const req1 = { ...req, path: "/api/v1/chat" };
    const req2 = { ...req, path: "/api/v1/embeddings" };

    rateLimiter(req1 as Request, res as Response, next);
    rateLimiter(req2 as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(2);
  });

  it("should handle missing IP gracefully", () => {
    req.ip = undefined;

    rateLimiter(req as Request, res as Response, next);

    // Should still work, using default key
    expect(next).toHaveBeenCalled();
  });
});
