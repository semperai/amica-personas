import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextFunction } from "express";
import { createMockRequest, createMockResponse } from "../utils/testHelpers";
import { setupMockEnv, mockEnv } from "../utils/mockEnv";

setupMockEnv();

// Mock the metrics module
vi.mock("@/metrics", () => ({
  authMetrics: {
    labels: vi.fn().mockReturnValue({
      inc: vi.fn(),
    }),
  },
}));

// Mock ts-postgres
vi.mock("ts-postgres", () => ({
  connect: vi.fn().mockResolvedValue({
    prepare: vi.fn().mockResolvedValue({
      execute: vi.fn().mockResolvedValue([]),
      [Symbol.asyncDispose]: vi.fn(),
    }),
  }),
  Client: vi.fn(),
}));

describe("authorizationCheck middleware", () => {
  let mockNext: NextFunction;
  let authorizationCheck: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockNext = vi.fn();

    // Dynamically import to ensure mocks are applied
    const module = await import("@/middleware/authorizationCheck");
    authorizationCheck = module.default;
  });

  describe("authorization header handling", () => {
    it("should use default API key when no authorization header", async () => {
      const req = createMockRequest({
        headers: {},
        ip: "192.168.1.1",
      });
      const res = createMockResponse();

      const middleware = authorizationCheck(1);
      middleware(req, res, mockNext);

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockNext).toHaveBeenCalled();
      expect(res.locals?.accountInfo).toBeDefined();
      expect(res.locals?.accountInfo.plan).toBe("anon");
    });

    it("should extract Bearer token from authorization header", async () => {
      const req = createMockRequest({
        headers: {
          authorization: "Bearer test-api-key-123",
        },
        ip: "192.168.1.1",
      });
      const res = createMockResponse();

      const middleware = authorizationCheck(1);
      middleware(req, res, mockNext);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockNext).toHaveBeenCalled();
    });

    it("should reject invalid authorization header format", async () => {
      const req = createMockRequest({
        headers: {
          authorization: "InvalidFormat token",
        },
        ip: "192.168.1.1",
      });
      const res = createMockResponse();

      const middleware = authorizationCheck(1);
      middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.send).toHaveBeenCalledWith("Invalid authorization header");
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject request with no IP address", async () => {
      const req = createMockRequest({
        headers: {},
        ip: undefined,
      });
      const res = createMockResponse();

      const middleware = authorizationCheck(1);
      middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.send).toHaveBeenCalledWith("Invalid IP address");
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("credit tracking", () => {
    it("should set credits remaining header", async () => {
      const req = createMockRequest({
        headers: {},
        ip: "192.168.1.1",
      });
      const res = createMockResponse();

      const middleware = authorizationCheck(10);
      middleware(req, res, mockNext);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(res.header).toHaveBeenCalledWith("X-Credits-Remaining", expect.any(String));
      expect(res.header).toHaveBeenCalledWith("X-Plan", expect.any(String));
    });

    it("should deduct credits for anonymous users", async () => {
      const req = createMockRequest({
        headers: {},
        ip: "192.168.1.2",
      });
      const res = createMockResponse();

      const creditsToSpend = 5;
      const middleware = authorizationCheck(creditsToSpend);
      middleware(req, res, mockNext);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(res.locals?.accountInfo).toBeDefined();
      expect(res.locals?.accountInfo.plan).toBe("anon");
      expect(res.locals?.accountInfo.credits).toBe(mockEnv.ANON_CREDITS_PER_DAY - creditsToSpend);
    });
  });

  describe("plan tier handling", () => {
    it("should handle anonymous plan tier", async () => {
      const req = createMockRequest({
        headers: {},
        ip: "192.168.1.3",
      });
      const res = createMockResponse();

      const middleware = authorizationCheck(1);
      middleware(req, res, mockNext);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(res.locals?.accountInfo.plan).toBe("anon");
      expect(res.header).toHaveBeenCalledWith("X-Plan", "anon");
    });
  });
});
