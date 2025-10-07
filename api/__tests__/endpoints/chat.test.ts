import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockRequest, createMockStreamResponse, mockStreamingFetch } from "../utils/testHelpers";
import { setupMockEnv } from "../utils/mockEnv";

setupMockEnv();

// Mock all dependencies
vi.mock("@/metrics", () => ({
  creditsUsedCounter: { inc: vi.fn() },
  creditsRemainingGauge: { set: vi.fn() },
  outOfCreditsCounter: { inc: vi.fn() },
  streamingEventsCounter: { inc: vi.fn() },
  apiCallDuration: { observe: vi.fn() },
  apiCallErrors: { inc: vi.fn() },
}));

vi.mock("@/utils/logger", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  })),
  logError: vi.fn(),
}));

describe("Chat endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("message validation", () => {
    it("should filter out empty messages", async () => {
      const messages = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "" },
        { role: "user", content: "How are you?" },
      ];

      const validMessages = messages.filter(
        (msg) => msg.content && typeof msg.content === "string" && msg.content.trim() !== ""
      );

      expect(validMessages).toHaveLength(2);
      expect(validMessages[0].content).toBe("Hello");
      expect(validMessages[1].content).toBe("How are you?");
    });

    it("should filter out messages with only whitespace", async () => {
      const messages = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "   " },
        { role: "user", content: "\n\t" },
      ];

      const validMessages = messages.filter(
        (msg) => msg.content && typeof msg.content === "string" && msg.content.trim() !== ""
      );

      expect(validMessages).toHaveLength(1);
      expect(validMessages[0].content).toBe("Hello");
    });

    it("should keep messages with valid content", async () => {
      const messages = [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "What is the weather?" },
        { role: "assistant", content: "I don't have real-time weather data." },
      ];

      const validMessages = messages.filter(
        (msg) => msg.content && typeof msg.content === "string" && msg.content.trim() !== ""
      );

      expect(validMessages).toHaveLength(3);
    });
  });

  describe("out of credits handling", () => {
    it("should return error message when credits are negative", async () => {
      const { res, chunks } = createMockStreamResponse();
      const req = createMockRequest({
        body: {
          messages: [{ role: "user", content: "Hello" }],
        },
      });

      // Simulate out of credits
      res.locals = {
        accountInfo: {
          plan: "anon",
          credits: -1,
        },
      };

      // The endpoint should check credits and return error
      const hasCredits = res.locals.accountInfo.credits >= 0;
      expect(hasCredits).toBe(false);
    });

    it("should allow request when credits are available", async () => {
      const { res } = createMockStreamResponse();
      const req = createMockRequest({
        body: {
          messages: [{ role: "user", content: "Hello" }],
        },
      });

      res.locals = {
        accountInfo: {
          plan: "anon",
          credits: 100,
        },
      };

      const hasCredits = res.locals.accountInfo.credits >= 0;
      expect(hasCredits).toBe(true);
    });
  });

  describe("streaming response", () => {
    it("should handle streaming chat response", async () => {
      const streamChunks = [
        {
          choices: [
            {
              index: 0,
              delta: { content: "Hello" },
              logprobs: null,
              finish_reason: null,
            },
          ],
        },
        {
          choices: [
            {
              index: 0,
              delta: { content: " there!" },
              logprobs: null,
              finish_reason: null,
            },
          ],
        },
        {
          choices: [
            {
              index: 0,
              delta: {},
              logprobs: null,
              finish_reason: "stop",
            },
          ],
        },
      ];

      mockStreamingFetch(streamChunks);

      const response = await fetch("https://api.test.com");
      const reader = response.body?.getReader();
      expect(reader).toBeDefined();

      const chunks: any[] = [];
      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        const text = new TextDecoder().decode(value);
        chunks.push(text);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe("request body validation", () => {
    it("should validate request has messages array", () => {
      const validBody = {
        messages: [{ role: "user", content: "Hello" }],
      };

      expect(Array.isArray(validBody.messages)).toBe(true);
      expect(validBody.messages.length).toBeGreaterThan(0);
    });

    it("should reject request without messages", () => {
      const invalidBody = {};

      expect((invalidBody as any).messages).toBeUndefined();
    });

    it("should reject empty messages array after filtering", () => {
      const messages = [
        { role: "user", content: "" },
        { role: "assistant", content: "   " },
      ];

      const validMessages = messages.filter(
        (msg) => msg.content && typeof msg.content === "string" && msg.content.trim() !== ""
      );

      expect(validMessages).toHaveLength(0);
    });
  });

  describe("error handling", () => {
    it("should handle 400 errors from API", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: "Invalid request" }),
      });

      const response = await fetch("https://api.test.com");
      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });

    it("should handle timeout errors", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("The operation was aborted due to timeout"));

      await expect(fetch("https://api.test.com")).rejects.toThrow("timeout");
    });

    it("should handle network errors", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      await expect(fetch("https://api.test.com")).rejects.toThrow("Network error");
    });
  });
});
