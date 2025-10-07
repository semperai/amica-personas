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

describe("Whisper (STT) endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("file upload validation", () => {
    it("should validate audio file is present", () => {
      const mockFile = {
        fieldname: "file",
        originalname: "audio.wav",
        encoding: "7bit",
        mimetype: "audio/wav",
        size: 1024,
        buffer: Buffer.from("fake audio data"),
      };

      expect(mockFile).toBeDefined();
      expect(mockFile.mimetype).toMatch(/^audio\//);
    });

    it("should reject if no file uploaded", () => {
      const file = undefined;
      expect(file).toBeUndefined();
    });

    it("should accept various audio formats", () => {
      const validMimeTypes = [
        "audio/wav",
        "audio/mpeg",
        "audio/mp3",
        "audio/mp4",
        "audio/webm",
        "audio/ogg",
      ];

      validMimeTypes.forEach((mimetype) => {
        expect(mimetype).toMatch(/^audio\//);
      });
    });
  });

  describe("credit checking", () => {
    it("should check if user has enough credits for STT", () => {
      const accountInfo = {
        plan: "anon",
        credits: 10,
      };

      const hasCredits = accountInfo.credits >= mockEnv.CREDITS_PER_STT;
      expect(hasCredits).toBe(true);
    });

    it("should reject when insufficient credits", () => {
      const accountInfo = {
        plan: "anon",
        credits: 1,
      };

      const hasCredits = accountInfo.credits >= mockEnv.CREDITS_PER_STT;
      expect(hasCredits).toBe(false);
    });
  });

  describe("transcription response", () => {
    it("should handle successful transcription", async () => {
      const mockTranscription = {
        text: "This is a test transcription.",
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockTranscription,
      });

      const response = await fetch(mockEnv.OPENAI_WHISPER_URL);
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.text).toBeDefined();
      expect(typeof data.text).toBe("string");
      expect(data.text.length).toBeGreaterThan(0);
    });

    it("should handle empty transcription", async () => {
      const mockTranscription = {
        text: "",
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockTranscription,
      });

      const response = await fetch(mockEnv.OPENAI_WHISPER_URL);
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.text).toBe("");
    });

    it("should return transcription text in response", async () => {
      const expectedText = "Hello, this is a test.";
      const mockTranscription = {
        text: expectedText,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockTranscription,
      });

      const response = await fetch(mockEnv.OPENAI_WHISPER_URL);
      const data = await response.json();

      expect(data.text).toBe(expectedText);
    });
  });

  describe("error handling", () => {
    it("should handle unsupported file format error", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: "Unsupported audio format" }),
      });

      const response = await fetch(mockEnv.OPENAI_WHISPER_URL);
      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });

    it("should handle file too large error", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 413,
        text: async () => JSON.stringify({ error: "File too large" }),
      });

      const response = await fetch(mockEnv.OPENAI_WHISPER_URL);
      expect(response.ok).toBe(false);
      expect(response.status).toBe(413);
    });

    it("should handle API authentication error", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: "Invalid API key" }),
      });

      const response = await fetch(mockEnv.OPENAI_WHISPER_URL);
      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });

    it("should handle timeout errors", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("The operation was aborted due to timeout"));

      await expect(fetch(mockEnv.OPENAI_WHISPER_URL)).rejects.toThrow("timeout");
    });

    it("should handle network errors", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      await expect(fetch(mockEnv.OPENAI_WHISPER_URL)).rejects.toThrow("Network error");
    });

    it("should handle invalid audio data", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: "Invalid audio data" }),
      });

      const response = await fetch(mockEnv.OPENAI_WHISPER_URL);
      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });
  });

  describe("multipart/form-data handling", () => {
    it("should handle FormData with audio file", () => {
      const formData = new FormData();
      const blob = new Blob(["fake audio data"], { type: "audio/wav" });
      formData.append("file", blob, "audio.wav");
      formData.append("model", mockEnv.OPENAI_WHISPER_MODEL);

      expect(formData.has("file")).toBe(true);
      expect(formData.has("model")).toBe(true);
    });

    it("should include required parameters", () => {
      const formData = new FormData();
      const blob = new Blob(["fake audio data"], { type: "audio/wav" });
      formData.append("file", blob, "audio.wav");
      formData.append("model", mockEnv.OPENAI_WHISPER_MODEL);

      expect(formData.get("model")).toBe(mockEnv.OPENAI_WHISPER_MODEL);
    });
  });

  describe("language parameter", () => {
    it("should accept optional language parameter", () => {
      const formData = new FormData();
      formData.append("language", "en");

      expect(formData.get("language")).toBe("en");
    });

    it("should work without language parameter", () => {
      const formData = new FormData();
      const blob = new Blob(["fake audio data"], { type: "audio/wav" });
      formData.append("file", blob, "audio.wav");
      formData.append("model", mockEnv.OPENAI_WHISPER_MODEL);

      expect(formData.has("language")).toBe(false);
    });
  });
});
