import { describe, expect, test, jest, beforeEach } from "vitest";
import { getMimeType, getExtension, mimeTypeCheck } from "../src/utils/getMimeType";

// Mock MediaRecorder
const mockIsTypeSupported = vi.fn();
global.MediaRecorder = {
  isTypeSupported: mockIsTypeSupported,
} as any;

describe("getMimeType", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAudioMimeType", () => {
    test("should return audio/webm when supported", () => {
      mockIsTypeSupported.mockImplementation((type: string) => type === "audio/webm");
      const result = getMimeType("audio");
      expect(result).toBe("audio/webm");
    });

    test("should return audio/mpeg when webm not supported but mpeg is", () => {
      mockIsTypeSupported.mockImplementation((type: string) => type === "audio/mpeg");
      const result = getMimeType("audio");
      expect(result).toBe("audio/mpeg");
    });

    test("should return audio/mp4 when webm and mpeg not supported", () => {
      mockIsTypeSupported.mockImplementation((type: string) => type === "audio/mp4");
      const result = getMimeType("audio");
      expect(result).toBe("audio/mp4");
    });

    test("should return audio/mp4 when MediaRecorder.isTypeSupported is not available", () => {
      // @ts-ignore
      delete global.MediaRecorder.isTypeSupported;
      const result = getMimeType("audio");
      expect(result).toBe("audio/mp4");
      // Restore for other tests
      global.MediaRecorder.isTypeSupported = mockIsTypeSupported;
    });

    test("should return empty string when no audio formats supported", () => {
      mockIsTypeSupported.mockReturnValue(false);
      const result = getMimeType("audio");
      expect(result).toBe("");
    });
  });

  describe("getVideoMimeType", () => {
    test("should return video/webm when supported", () => {
      mockIsTypeSupported.mockImplementation((type: string) => type === "video/webm");
      const result = getMimeType("video");
      expect(result).toBe("video/webm");
    });

    test("should return video/mp4 when webm not supported but mp4 is", () => {
      mockIsTypeSupported.mockImplementation((type: string) => type === "video/mp4");
      const result = getMimeType("video");
      expect(result).toBe("video/mp4");
    });

    test("should return video/mp4 when MediaRecorder.isTypeSupported is not available", () => {
      // @ts-ignore
      delete global.MediaRecorder.isTypeSupported;
      const result = getMimeType("video");
      expect(result).toBe("video/mp4");
      // Restore for other tests
      global.MediaRecorder.isTypeSupported = mockIsTypeSupported;
    });

    test("should return empty string when no video formats supported", () => {
      mockIsTypeSupported.mockReturnValue(false);
      const result = getMimeType("video");
      expect(result).toBe("");
    });
  });

  describe("getExtension", () => {
    test("should return mp4 for audio/mp4 mime type", () => {
      mockIsTypeSupported.mockImplementation((type: string) => type === "audio/mp4");
      const result = getExtension("audio");
      expect(result).toBe("mp4");
    });

    test("should return mp3 for audio/mpeg mime type", () => {
      mockIsTypeSupported.mockImplementation((type: string) => type === "audio/mpeg");
      const result = getExtension("audio");
      expect(result).toBe("mp3");
    });

    test("should return webm for audio/webm mime type", () => {
      mockIsTypeSupported.mockImplementation((type: string) => type === "audio/webm");
      const result = getExtension("audio");
      expect(result).toBe("webm");
    });

    test("should return mp4 for video/mp4 mime type", () => {
      mockIsTypeSupported.mockImplementation((type: string) => type === "video/mp4");
      const result = getExtension("video");
      expect(result).toBe("mp4");
    });

    test("should return webm for video/webm mime type", () => {
      mockIsTypeSupported.mockImplementation((type: string) => type === "video/webm");
      const result = getExtension("video");
      expect(result).toBe("webm");
    });
  });

  describe("mimeTypeCheck", () => {
    test("should log all mime types and their support status", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation();
      mockIsTypeSupported.mockReturnValue(true);

      mimeTypeCheck();

      expect(consoleSpy).toHaveBeenCalled();
      expect(mockIsTypeSupported).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("edge cases", () => {
    test("should handle multiple calls consistently", () => {
      mockIsTypeSupported.mockImplementation((type: string) => type === "audio/webm");

      const result1 = getMimeType("audio");
      const result2 = getMimeType("audio");
      const result3 = getMimeType("audio");

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    test("should handle switching between audio and video types", () => {
      mockIsTypeSupported.mockImplementation((type: string) =>
        type === "audio/webm" || type === "video/webm"
      );

      const audioType = getMimeType("audio");
      const videoType = getMimeType("video");

      expect(audioType).toBe("audio/webm");
      expect(videoType).toBe("video/webm");
    });

    test("should prioritize webm over other formats", () => {
      mockIsTypeSupported.mockReturnValue(true);

      const audioType = getMimeType("audio");
      const videoType = getMimeType("video");

      expect(audioType).toBe("audio/webm");
      expect(videoType).toBe("video/webm");
    });
  });
});
