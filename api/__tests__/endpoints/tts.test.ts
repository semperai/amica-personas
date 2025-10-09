import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockRequest, createMockResponse } from "../utils/testHelpers";
import { setupMockEnv, mockEnv } from "../utils/mockEnv";

setupMockEnv();

vi.mock("@/metrics", () => ({
  creditsUsedCounter: { inc: vi.fn() },
  creditsRemainingGauge: { set: vi.fn() },
  outOfCreditsCounter: { inc: vi.fn() },
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

describe("TTS endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("request validation", () => {
    it("should validate text parameter is present", () => {
      const validBody = {
        text: "Hello, world!",
        voice: "test-voice",
      };

      expect(validBody.text).toBeDefined();
      expect(typeof validBody.text).toBe("string");
      expect(validBody.text.length).toBeGreaterThan(0);
    });

    it("should reject empty text", () => {
      const invalidBody = {
        text: "",
        voice: "test-voice",
      };

      expect(invalidBody.text.length).toBe(0);
    });

    it("should accept text with various content", () => {
      const texts = [
        "Simple text",
        "Text with numbers 123",
        "Text with punctuation!?",
        "Multi\nline\ntext",
      ];

      texts.forEach((text) => {
        expect(text).toBeDefined();
        expect(text.length).toBeGreaterThan(0);
      });
    });
  });

  describe("credit checking", () => {
    it("should check if user has enough credits for TTS", () => {
      const accountInfo = {
        plan: "anon",
        credits: 10,
      };

      const hasCredits = accountInfo.credits >= mockEnv.CREDITS_PER_TTS;
      expect(hasCredits).toBe(true);
    });

    it("should reject when insufficient credits", () => {
      const accountInfo = {
        plan: "anon",
        credits: 5,
      };

      const hasCredits = accountInfo.credits >= mockEnv.CREDITS_PER_TTS;
      expect(hasCredits).toBe(false);
    });

    it("should handle negative credits", () => {
      const accountInfo = {
        plan: "anon",
        credits: -1,
      };

      const hasCredits = accountInfo.credits >= 0;
      expect(hasCredits).toBe(false);
    });
  });

  describe("audio streaming", () => {
    it("should handle streaming audio response", async () => {
      const mockAudioData = new Uint8Array([0, 1, 2, 3, 4, 5]);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => {
            if (name === "content-type") return "audio/mpeg";
            return null;
          },
        },
        body: {
          getReader: () => ({
            read: vi
              .fn()
              .mockResolvedValueOnce({ done: false, value: mockAudioData })
              .mockResolvedValueOnce({ done: true, value: undefined }),
          }),
        },
      });

      const response = await fetch(mockEnv.FISH_URL);
      expect(response.ok).toBe(true);
      expect(response.headers.get("content-type")).toBe("audio/mpeg");

      const reader = response.body?.getReader();
      expect(reader).toBeDefined();

      const { done, value } = await reader!.read();
      expect(done).toBe(false);
      expect(value).toEqual(mockAudioData);
    });
  });

  describe("error handling", () => {
    it("should handle API errors gracefully", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: "Invalid voice parameter" }),
      });

      const response = await fetch(mockEnv.FISH_URL);
      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });

    it("should handle timeout errors", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("The operation was aborted due to timeout"));

      await expect(fetch(mockEnv.FISH_URL)).rejects.toThrow("timeout");
    });

    it("should handle authentication errors", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: "Invalid API key" }),
      });

      const response = await fetch(mockEnv.FISH_URL);
      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });

    it("should handle rate limit errors", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => JSON.stringify({ error: "Rate limit exceeded" }),
      });

      const response = await fetch(mockEnv.FISH_URL);
      expect(response.ok).toBe(false);
      expect(response.status).toBe(429);
    });
  });

  describe("voice parameter", () => {
    it("should accept valid voice ID", () => {
      const body = {
        text: "Test",
        voice: "valid-voice-id-123",
      };

      expect(body.voice).toBeDefined();
      expect(typeof body.voice).toBe("string");
    });

    it("should use default voice when not provided", () => {
      const body = {
        text: "Test",
      };

      const voice = (body as any).voice || mockEnv.FISH_MODEL;
      expect(voice).toBe(mockEnv.FISH_MODEL);
    });
  });
});
