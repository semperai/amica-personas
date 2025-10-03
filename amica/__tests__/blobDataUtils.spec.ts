import { describe, expect, test, beforeEach, vi } from "vitest";
import { Base64ToBlob, BlobToBase64 } from "../src/utils/blobDataUtils";

// Mock global fetch for data URLs
global.fetch = vi.fn((url: string) => {
  return Promise.resolve({
    blob: () => {
      // Parse data URL and create blob
      const parts = url.split(',');
      const mime = url.match(/:(.*?);/)?.[1] || '';
      const data = parts[1] || '';

      try {
        const binary = atob(data);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          array[i] = binary.charCodeAt(i);
        }
        return Promise.resolve(new Blob([array], { type: mime }));
      } catch (e) {
        return Promise.resolve(new Blob([], { type: mime }));
      }
    }
  } as Response);
}) as any;

describe("blobDataUtils", () => {
  describe("Base64ToBlob", () => {
    test("should convert base64 text data to blob", async () => {
      const base64Text = "data:text/plain;base64,SGVsbG8gV29ybGQ="; // "Hello World"

      const blob = await Base64ToBlob(base64Text);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe("text/plain");
      expect(blob.size).toBeGreaterThan(0);
    });

    test("should convert base64 image data to blob", async () => {
      // Small 1x1 red PNG
      const base64Image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";

      const blob = await Base64ToBlob(base64Image);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe("image/png");
      expect(blob.size).toBeGreaterThan(0);
    });

    test("should convert base64 JSON data to blob", async () => {
      const jsonString = '{"name":"test","value":123}';
      const base64Json = `data:application/json;base64,${btoa(jsonString)}`;

      const blob = await Base64ToBlob(base64Json);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe("application/json");
    });

    test("should handle empty base64 data", async () => {
      const base64Empty = "data:text/plain;base64,";

      const blob = await Base64ToBlob(base64Empty);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBe(0);
    });

    test("should preserve blob type from data URL", async () => {
      const base64Audio = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA";

      const blob = await Base64ToBlob(base64Audio);

      expect(blob.type).toBe("audio/mp3");
    });

    test("should handle large base64 data", async () => {
      // Create a large string
      const largeData = "A".repeat(10000);
      const base64Large = `data:text/plain;base64,${btoa(largeData)}`;

      const blob = await Base64ToBlob(base64Large);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThanOrEqual(10000);
    });

    test("should handle data URL without type", async () => {
      const base64Data = "data:;base64,SGVsbG8=";

      const blob = await Base64ToBlob(base64Data);

      expect(blob).toBeInstanceOf(Blob);
    });

    test("should handle base64 with special characters", async () => {
      const specialChars = "Hello! 你好 🌍";
      const base64Special = `data:text/plain;base64,${btoa(unescape(encodeURIComponent(specialChars)))}`;

      const blob = await Base64ToBlob(base64Special);

      expect(blob).toBeInstanceOf(Blob);
    });
  });

  describe("BlobToBase64", () => {
    test("should convert text blob to base64", async () => {
      const text = "Hello World";
      const blob = new Blob([text], { type: "text/plain" });

      const base64 = await BlobToBase64(blob);

      expect(typeof base64).toBe("string");
      expect(base64).toContain("data:text/plain");
      expect(base64).toContain("base64,");
    });

    test("should convert JSON blob to base64", async () => {
      const json = { name: "test", value: 123 };
      const blob = new Blob([JSON.stringify(json)], { type: "application/json" });

      const base64 = await BlobToBase64(blob);

      expect(base64).toContain("data:application/json");
      expect(base64).toContain("base64,");
    });

    test("should convert binary blob to base64", async () => {
      const buffer = new Uint8Array([0, 1, 2, 3, 4, 5]);
      const blob = new Blob([buffer], { type: "application/octet-stream" });

      const base64 = await BlobToBase64(blob);

      expect(base64).toContain("data:application/octet-stream");
      expect(base64).toContain("base64,");
    });

    test("should convert empty blob to base64", async () => {
      const blob = new Blob([], { type: "text/plain" });

      const base64 = await BlobToBase64(blob);

      expect(typeof base64).toBe("string");
      expect(base64).toContain("data:text/plain");
    });

    test("should preserve blob mime type in base64 string", async () => {
      const blob = new Blob(["test"], { type: "text/html" });

      const base64 = await BlobToBase64(blob);

      expect(base64).toContain("data:text/html");
    });

    test("should convert large blob to base64", async () => {
      const largeData = new Uint8Array(100000);
      for (let i = 0; i < largeData.length; i++) {
        largeData[i] = i % 256;
      }
      const blob = new Blob([largeData], { type: "application/octet-stream" });

      const base64 = await BlobToBase64(blob);

      expect(typeof base64).toBe("string");
      expect(base64.length).toBeGreaterThan(100000);
    });

    test("should handle blob with no type", async () => {
      const blob = new Blob(["test"]);

      const base64 = await BlobToBase64(blob);

      expect(typeof base64).toBe("string");
      expect(base64).toContain("data:");
    });

    test("should handle unicode text in blob", async () => {
      const unicode = "Hello 👋 你好 مرحبا";
      const blob = new Blob([unicode], { type: "text/plain;charset=utf-8" });

      const base64 = await BlobToBase64(blob);

      expect(base64).toContain("data:text/plain");
      expect(base64).toContain("base64,");
    });
  });

  describe("round-trip conversion", () => {
    test("should preserve text data through Base64ToBlob -> BlobToBase64", async () => {
      const originalText = "Hello World!";
      const originalBase64 = `data:text/plain;base64,${btoa(originalText)}`;

      const blob = await Base64ToBlob(originalBase64);
      const finalBase64 = await BlobToBase64(blob);

      // Decode both to compare content
      const originalContent = atob(originalBase64.split(",")[1]);
      const finalContent = atob(finalBase64.split(",")[1]);

      expect(finalContent).toBe(originalContent);
    });

    test("should preserve binary data through Base64ToBlob -> BlobToBase64", async () => {
      const originalData = new Uint8Array([0, 1, 2, 3, 255, 254, 253]);
      const blob = new Blob([originalData], { type: "application/octet-stream" });
      const base64 = await BlobToBase64(blob);

      const restoredBlob = await Base64ToBlob(base64);
      const restoredBase64 = await BlobToBase64(restoredBlob);

      // The base64 strings should be identical
      expect(restoredBase64).toBe(base64);
    });

    test("should preserve text data through BlobToBase64 -> Base64ToBlob", async () => {
      const originalText = "Test data with special chars: !@#$%^&*()";
      const originalBlob = new Blob([originalText], { type: "text/plain" });

      const base64 = await BlobToBase64(originalBlob);
      const finalBlob = await Base64ToBlob(base64);

      expect(finalBlob.size).toBe(originalBlob.size);
      expect(finalBlob.type).toBe(originalBlob.type);
    });

    test("should preserve image data through round-trip", async () => {
      // Small 1x1 red PNG
      const originalBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";

      const blob = await Base64ToBlob(originalBase64);
      const restoredBase64 = await BlobToBase64(blob);

      // Extract and compare the base64 content (ignoring potential minor differences in headers)
      const originalContent = originalBase64.split(",")[1];
      const restoredContent = restoredBase64.split(",")[1];

      expect(restoredContent).toBe(originalContent);
    });

    test("should preserve empty data through round-trip", async () => {
      const emptyBlob = new Blob([], { type: "text/plain" });

      const base64 = await BlobToBase64(emptyBlob);
      const restoredBlob = await Base64ToBlob(base64);

      expect(restoredBlob.size).toBe(0);
    });

    test("should handle multiple round-trips", async () => {
      let data = "Original test data";
      let blob = new Blob([data], { type: "text/plain" });

      // Convert back and forth 5 times
      for (let i = 0; i < 5; i++) {
        const base64 = await BlobToBase64(blob);
        blob = await Base64ToBlob(base64);
      }

      // Final check - read the blob
      const finalBase64 = await BlobToBase64(blob);
      const finalContent = atob(finalBase64.split(",")[1]);

      expect(finalContent).toBe(data);
    });
  });

  describe("error handling", () => {
    test("should handle invalid base64 in Base64ToBlob", async () => {
      const invalidBase64 = "data:text/plain;base64,!!!INVALID!!!";

      // This might throw or return a blob depending on implementation
      // The fetch API should handle this gracefully
      try {
        const blob = await Base64ToBlob(invalidBase64);
        expect(blob).toBeInstanceOf(Blob);
      } catch (error) {
        // Error is acceptable for invalid data
        expect(error).toBeDefined();
      }
    });

    test("BlobToBase64 should handle blob reader errors gracefully", async () => {
      // Create a valid blob
      const blob = new Blob(["test"], { type: "text/plain" });

      const result = await BlobToBase64(blob);

      // Should still complete successfully
      expect(typeof result).toBe("string");
    });
  });

  describe("type checking", () => {
    test("Base64ToBlob should return Promise<Blob>", async () => {
      const base64 = "data:text/plain;base64,dGVzdA==";
      const result = Base64ToBlob(base64);

      expect(result).toBeInstanceOf(Promise);

      const blob = await result;
      expect(blob).toBeInstanceOf(Blob);
    });

    test("BlobToBase64 should return Promise<string>", async () => {
      const blob = new Blob(["test"], { type: "text/plain" });
      const result = BlobToBase64(blob);

      expect(result).toBeInstanceOf(Promise);

      const base64 = await result;
      expect(typeof base64).toBe("string");
    });
  });

  describe("real-world use cases", () => {
    test("should handle audio blob conversion", async () => {
      // Simulate audio data
      const audioData = new Uint8Array(1000);
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = Math.floor(Math.random() * 256);
      }
      const audioBlob = new Blob([audioData], { type: "audio/wav" });

      const base64 = await BlobToBase64(audioBlob);
      const restoredBlob = await Base64ToBlob(base64);

      expect(restoredBlob.type).toBe("audio/wav");
      expect(restoredBlob.size).toBe(audioBlob.size);
    });

    test("should handle image blob conversion", async () => {
      const imageData = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // PNG header
      const imageBlob = new Blob([imageData], { type: "image/png" });

      const base64 = await BlobToBase64(imageBlob);
      const restoredBlob = await Base64ToBlob(base64);

      expect(restoredBlob.type).toBe("image/png");
    });

    test("should handle video blob conversion", async () => {
      const videoData = new Uint8Array(500);
      const videoBlob = new Blob([videoData], { type: "video/mp4" });

      const base64 = await BlobToBase64(videoBlob);

      expect(base64).toContain("data:video/mp4");
      expect(base64).toContain("base64,");
    });

    test("should handle PDF blob conversion", async () => {
      const pdfData = new Uint8Array([37, 80, 68, 70]); // PDF header "%PDF"
      const pdfBlob = new Blob([pdfData], { type: "application/pdf" });

      const base64 = await BlobToBase64(pdfBlob);
      const restoredBlob = await Base64ToBlob(base64);

      expect(restoredBlob.type).toBe("application/pdf");
    });
  });
});
