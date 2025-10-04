import { describe, expect, test, afterEach, vi } from "vitest";
import { buildUrl } from "@/utils/resolveAssetUrl";

// Helper to mock BASE_URL
function setMockBaseUrl(url: string) {
  vi.stubEnv('BASE_URL', url);
}

describe("buildUrl", () => {
  afterEach(() => {
    // Reset to default after each test
    setMockBaseUrl('/');
  });

  describe("basic functionality", () => {
    test("should append path to base URL", () => {
      setMockBaseUrl("/app/");

      const result = buildUrl("assets/image.png");

      expect(result).toBe("/app/assets/image.png");
    });

    test("should handle root base URL", () => {
      setMockBaseUrl("/");

      const result = buildUrl("assets/image.png");

      expect(result).toBe("/assets/image.png");
    });

    test("should handle empty path", () => {
      setMockBaseUrl("/app/");

      const result = buildUrl("");

      expect(result).toBe("/app/");
    });

    test("should use root when BASE_URL is undefined", () => {
      setMockBaseUrl(undefined);

      const result = buildUrl("assets/image.png");

      expect(result).toBe("/assets/image.png");
    });

    test("should use root when BASE_URL is empty string", () => {
      setMockBaseUrl("");

      const result = buildUrl("assets/image.png");

      expect(result).toBe("/assets/image.png");
    });
  });

  describe("path variations", () => {
    test("should handle path with leading slash", () => {
      setMockBaseUrl("/app/");

      const result = buildUrl("/assets/image.png");

      expect(result).toBe("/app//assets/image.png");
    });

    test("should handle path without leading slash", () => {
      setMockBaseUrl("/app/");

      const result = buildUrl("assets/image.png");

      expect(result).toBe("/app/assets/image.png");
    });

    test("should handle nested paths", () => {
      setMockBaseUrl("/app/");

      const result = buildUrl("assets/images/icons/icon.png");

      expect(result).toBe("/app/assets/images/icons/icon.png");
    });

    test("should handle paths with dots", () => {
      setMockBaseUrl("/app/");

      const result = buildUrl("../assets/image.png");

      expect(result).toBe("/app/../assets/image.png");
    });

    test("should handle paths with query parameters", () => {
      setMockBaseUrl("/app/");

      const result = buildUrl("assets/image.png?v=1.0");

      expect(result).toBe("/app/assets/image.png?v=1.0");
    });

    test("should handle paths with hash fragments", () => {
      setMockBaseUrl("/app/");

      const result = buildUrl("page.html#section");

      expect(result).toBe("/app/page.html#section");
    });

    test("should handle paths with special characters", () => {
      setMockBaseUrl("/app/");

      const result = buildUrl("assets/file name with spaces.png");

      expect(result).toBe("/app/assets/file name with spaces.png");
    });
  });

  describe("base URL variations", () => {
    test("should handle base URL without trailing slash", () => {
      setMockBaseUrl("/app");

      const result = buildUrl("assets/image.png");

      expect(result).toBe("/appassets/image.png");
    });

    test("should handle base URL with trailing slash", () => {
      setMockBaseUrl("/app/");

      const result = buildUrl("assets/image.png");

      expect(result).toBe("/app/assets/image.png");
    });

    test("should handle deep base URL path", () => {
      setMockBaseUrl("/organization/project/app/");

      const result = buildUrl("assets/image.png");

      expect(result).toBe("/organization/project/app/assets/image.png");
    });

    test("should handle GitHub Pages style base URL", () => {
      setMockBaseUrl("/repository-name/");

      const result = buildUrl("assets/image.png");

      expect(result).toBe("/repository-name/assets/image.png");
    });

    test("should handle base URL with multiple slashes", () => {
      setMockBaseUrl("///app///");

      const result = buildUrl("assets/image.png");

      expect(result).toBe("///app///assets/image.png");
    });
  });

  describe("common use cases", () => {
    test("should build URL for VRM model", () => {
      setMockBaseUrl("/");

      const result = buildUrl("vrm/AvatarSample_A.vrm");

      expect(result).toBe("/vrm/AvatarSample_A.vrm");
    });

    test("should build URL for background image", () => {
      setMockBaseUrl("/amica/");

      const result = buildUrl("bg/bg-room2.jpg");

      expect(result).toBe("/amica/bg/bg-room2.jpg");
    });

    test("should build URL for animation file", () => {
      setMockBaseUrl("/");

      const result = buildUrl("animations/idle_loop.vrma");

      expect(result).toBe("/animations/idle_loop.vrma");
    });

    test("should build URL for audio file", () => {
      setMockBaseUrl("/app/");

      const result = buildUrl("audio/voice.mp3");

      expect(result).toBe("/app/audio/voice.mp3");
    });

    test("should build URL for public assets", () => {
      setMockBaseUrl("/");

      const result = buildUrl("public/icon.png");

      expect(result).toBe("/public/icon.png");
    });
  });

  describe("edge cases", () => {
    test("should handle undefined path", () => {
      setMockBaseUrl("/app/");

      const result = buildUrl(undefined as any);

      expect(result).toBe("/app/undefined");
    });

    test("should handle null path", () => {
      setMockBaseUrl("/app/");

      const result = buildUrl(null as any);

      expect(result).toBe("/app/null");
    });

    test("should handle numeric path", () => {
      setMockBaseUrl("/app/");

      const result = buildUrl(123 as any);

      expect(result).toBe("/app/123");
    });

    test("should handle path with only slashes", () => {
      setMockBaseUrl("/app/");

      const result = buildUrl("///");

      expect(result).toBe("/app////");
    });

    test("should handle very long paths", () => {
      setMockBaseUrl("/app/");
      const longPath = "a/".repeat(100) + "file.png";

      const result = buildUrl(longPath);

      expect(result).toContain("/app/a/a/a/");
      expect(result).toMatch(/file\.png$/);
    });

    test("should handle unicode in path", () => {
      setMockBaseUrl("/app/");

      const result = buildUrl("assets/文件.png");

      expect(result).toBe("/app/assets/文件.png");
    });

    test("should handle emoji in path", () => {
      setMockBaseUrl("/app/");

      const result = buildUrl("assets/😀.png");

      expect(result).toBe("/app/assets/😀.png");
    });
  });

  describe("production scenarios", () => {
    test("should work in production with custom base", () => {
      setMockBaseUrl("/my-app/");

      const result = buildUrl("assets/logo.png");

      expect(result).toBe("/my-app/assets/logo.png");
    });

    test("should work in development with root", () => {
      setMockBaseUrl("/");

      const result = buildUrl("assets/logo.png");

      expect(result).toBe("/assets/logo.png");
    });

    test("should handle GitHub Pages deployment", () => {
      setMockBaseUrl("/amica-personas/");

      const vrm = buildUrl("vrm/model.vrm");
      const bg = buildUrl("bg/background.jpg");
      const anim = buildUrl("animations/idle.vrma");

      expect(vrm).toBe("/amica-personas/vrm/model.vrm");
      expect(bg).toBe("/amica-personas/bg/background.jpg");
      expect(anim).toBe("/amica-personas/animations/idle.vrma");
    });

    test("should handle CDN deployment", () => {
      setMockBaseUrl("/cdn/v1.0/");

      const result = buildUrl("assets/bundle.js");

      expect(result).toBe("/cdn/v1.0/assets/bundle.js");
    });

    test("should handle subdirectory deployment", () => {
      setMockBaseUrl("/apps/amica/");

      const result = buildUrl("public/data.json");

      expect(result).toBe("/apps/amica/public/data.json");
    });
  });

  describe("consistency", () => {
    test("should return same result for same input", () => {
      setMockBaseUrl("/app/");

      const result1 = buildUrl("assets/image.png");
      const result2 = buildUrl("assets/image.png");
      const result3 = buildUrl("assets/image.png");

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    test("should be deterministic", () => {
      setMockBaseUrl("/test/");

      const results = [];
      for (let i = 0; i < 100; i++) {
        results.push(buildUrl("file.txt"));
      }

      const allSame = results.every(r => r === results[0]);
      expect(allSame).toBe(true);
    });
  });

  describe("return type", () => {
    test("should always return a string", () => {
      setMockBaseUrl("/app/");

      const result = buildUrl("test.png");

      expect(typeof result).toBe("string");
    });

    test("should never return undefined", () => {
      setMockBaseUrl("/app/");

      const result = buildUrl("test.png");

      expect(result).not.toBeUndefined();
    });

    test("should never return null", () => {
      setMockBaseUrl("/app/");

      const result = buildUrl("test.png");

      expect(result).not.toBeNull();
    });

    test("should always return non-empty string for non-empty path", () => {
      setMockBaseUrl("/app/");

      const result = buildUrl("test.png");

      expect(result.length).toBeGreaterThan(0);
    });
  });
});
