import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { hasOnScreenKeyboard } from "@/utils/hasOnScreenKeyboard";

describe("hasOnScreenKeyboard", () => {
  let originalUserAgent: string;
  let originalVendor: string;
  let originalOpera: any;

  beforeEach(() => {
    // Save originals
    originalUserAgent = navigator.userAgent;
    originalVendor = navigator.vendor;
    originalOpera = (window as any).opera;
  });

  afterEach(() => {
    // Restore originals
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true
    });
    Object.defineProperty(navigator, 'vendor', {
      value: originalVendor,
      configurable: true
    });
    (window as any).opera = originalOpera;
  });

  const setUserAgent = (userAgent: string) => {
    Object.defineProperty(navigator, 'userAgent', {
      value: userAgent,
      configurable: true,
      writable: true
    });
  };

  describe("mobile devices", () => {
    test("should detect iPhone", () => {
      setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15");

      expect(hasOnScreenKeyboard()).toBe(true);
    });

    test("should detect iPad", () => {
      setUserAgent("Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15");

      expect(hasOnScreenKeyboard()).toBe(true);
    });

    test("should detect iPod", () => {
      setUserAgent("Mozilla/5.0 (iPod; CPU iPod OS 14_0 like Mac OS X) AppleWebKit/605.1.15");

      expect(hasOnScreenKeyboard()).toBe(true);
    });

    test("should detect Android mobile", () => {
      setUserAgent("Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 Mobile Safari/537.36");

      expect(hasOnScreenKeyboard()).toBe(true);
    });

    test("should detect Android tablet", () => {
      setUserAgent("Mozilla/5.0 (Linux; Android 10; SM-T510) AppleWebKit/537.36 Safari/537.36");

      expect(hasOnScreenKeyboard()).toBe(true);
    });

    test("should detect BlackBerry", () => {
      setUserAgent("Mozilla/5.0 (BlackBerry; U; BlackBerry 9900; en) AppleWebKit/534.11+");

      expect(hasOnScreenKeyboard()).toBe(true);
    });

    test("should detect Windows Phone", () => {
      setUserAgent("Mozilla/5.0 (compatible; MSIE 10.0; Windows Phone 8.0; Trident/6.0)");

      expect(hasOnScreenKeyboard()).toBe(true);
    });

    test("should detect Mobile Firefox", () => {
      setUserAgent("Mozilla/5.0 (Android; Mobile; rv:40.0) Gecko/40.0 Firefox/40.0");

      expect(hasOnScreenKeyboard()).toBe(true);
    });

    test("should detect Opera Mobile", () => {
      setUserAgent("Opera/9.80 (Android; Opera Mini/7.5.33361/31.1448; U; en) Presto/2.8.119 Version/11.1010");

      expect(hasOnScreenKeyboard()).toBe(true);
    });

    test("should detect Samsung Internet", () => {
      setUserAgent("Mozilla/5.0 (Linux; Android 9; SAMSUNG SM-G960F) AppleWebKit/537.36 SamsungBrowser/9.2 Mobile Safari/537.36");

      expect(hasOnScreenKeyboard()).toBe(true);
    });
  });

  describe("desktop devices", () => {
    test("should not detect Windows desktop", () => {
      setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0.4472.124 Safari/537.36");

      expect(hasOnScreenKeyboard()).toBe(false);
    });

    test("should not detect macOS desktop", () => {
      setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/91.0.4472.124 Safari/537.36");

      expect(hasOnScreenKeyboard()).toBe(false);
    });

    test("should not detect Linux desktop", () => {
      setUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/91.0.4472.124 Safari/537.36");

      expect(hasOnScreenKeyboard()).toBe(false);
    });

    test("should not detect Chrome OS", () => {
      setUserAgent("Mozilla/5.0 (X11; CrOS x86_64 13904.55.0) AppleWebKit/537.36 Chrome/91.0.4472.114 Safari/537.36");

      expect(hasOnScreenKeyboard()).toBe(false);
    });

    test("should not detect desktop Firefox", () => {
      setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0");

      expect(hasOnScreenKeyboard()).toBe(false);
    });

    test("should not detect desktop Safari", () => {
      setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15");

      expect(hasOnScreenKeyboard()).toBe(false);
    });

    test("should not detect desktop Edge", () => {
      setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/91.0.864.59");

      expect(hasOnScreenKeyboard()).toBe(false);
    });

    test("should not detect desktop Opera", () => {
      setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 OPR/77.0.4054.90");

      expect(hasOnScreenKeyboard()).toBe(false);
    });
  });

  describe("tablets and hybrids", () => {
    test("should detect Kindle", () => {
      // More specific Kindle Fire user agent
      setUserAgent("Mozilla/5.0 (Linux; Android 4.0.3; KFTT Build/IML74K) AppleWebKit/537.36 Mobile");

      expect(hasOnScreenKeyboard()).toBe(true);
    });

    test("should detect Playbook", () => {
      setUserAgent("Mozilla/5.0 (PlayBook; U; RIM Tablet OS 2.1.0; en-US) AppleWebKit/536.2+");

      expect(hasOnScreenKeyboard()).toBe(true);
    });

    test("should detect Silk (Amazon)", () => {
      setUserAgent("Mozilla/5.0 (Linux; U; Android 4.0.3; en-us; KFTT Build/IML74K) Silk/3.68 like Chrome/39.0.2171.93 Safari/537.36");

      expect(hasOnScreenKeyboard()).toBe(true);
    });
  });

  describe("edge cases", () => {
    test("should handle undefined user agent", () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: undefined,
        configurable: true
      });

      expect(hasOnScreenKeyboard()).toBe(false);
    });

    test("should handle empty user agent", () => {
      setUserAgent("");

      expect(hasOnScreenKeyboard()).toBe(false);
    });

    test("should handle null user agent", () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: null,
        configurable: true
      });

      expect(hasOnScreenKeyboard()).toBe(false);
    });

    test("should handle user agent with only spaces", () => {
      setUserAgent("   ");

      expect(hasOnScreenKeyboard()).toBe(false);
    });

    test("should handle very long user agent", () => {
      const longUA = "Mozilla/5.0 (Linux; Android 10; " + "A".repeat(10000) + ") AppleWebKit/537.36";
      setUserAgent(longUA);

      // Should still detect Android
      expect(hasOnScreenKeyboard()).toBe(true);
    });

    test("should handle user agent with special characters", () => {
      setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) <script>alert('xss')</script>");

      expect(hasOnScreenKeyboard()).toBe(false);
    });

    test("should handle mixed case in user agent", () => {
      setUserAgent("Mozilla/5.0 (IPHONE; CPU iPhone OS 14_0 like Mac OS X)");

      // Should still detect (case insensitive check)
      expect(hasOnScreenKeyboard()).toBe(true);
    });
  });

  describe("specific device models", () => {
    test("should detect Google Pixel", () => {
      setUserAgent("Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 Mobile Safari/537.36");

      expect(hasOnScreenKeyboard()).toBe(true);
    });

    test("should detect Samsung Galaxy", () => {
      setUserAgent("Mozilla/5.0 (Linux; Android 11; SM-G998B) AppleWebKit/537.36 Mobile Safari/537.36");

      expect(hasOnScreenKeyboard()).toBe(true);
    });

    test("should detect OnePlus", () => {
      setUserAgent("Mozilla/5.0 (Linux; Android 11; IN2023) AppleWebKit/537.36 Mobile Safari/537.36");

      expect(hasOnScreenKeyboard()).toBe(true);
    });

    test("should detect Huawei", () => {
      setUserAgent("Mozilla/5.0 (Linux; Android 10; ELE-L29) AppleWebKit/537.36 Mobile Safari/537.36");

      expect(hasOnScreenKeyboard()).toBe(true);
    });

    test("should detect Xiaomi", () => {
      setUserAgent("Mozilla/5.0 (Linux; Android 11; Mi 11) AppleWebKit/537.36 Mobile Safari/537.36");

      expect(hasOnScreenKeyboard()).toBe(true);
    });
  });

  describe("browsers on mobile", () => {
    test("should detect Chrome on Android", () => {
      setUserAgent("Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 Chrome/91.0.4472.120 Mobile Safari/537.36");

      expect(hasOnScreenKeyboard()).toBe(true);
    });

    test("should detect Firefox on Android", () => {
      setUserAgent("Mozilla/5.0 (Android 10; Mobile; rv:89.0) Gecko/89.0 Firefox/89.0");

      expect(hasOnScreenKeyboard()).toBe(true);
    });

    test("should detect Safari on iOS", () => {
      setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1");

      expect(hasOnScreenKeyboard()).toBe(true);
    });

    test("should detect Chrome on iOS", () => {
      setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 CriOS/91.0.4472.80 Mobile/15E148 Safari/604.1");

      expect(hasOnScreenKeyboard()).toBe(true);
    });

    test("should detect Firefox on iOS", () => {
      setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 FxiOS/35.0 Mobile/15E148 Safari/605.1.15");

      expect(hasOnScreenKeyboard()).toBe(true);
    });
  });

  describe("consistency", () => {
    test("should return same result for same user agent", () => {
      setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)");

      const result1 = hasOnScreenKeyboard();
      const result2 = hasOnScreenKeyboard();
      const result3 = hasOnScreenKeyboard();

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    test("should be deterministic", () => {
      setUserAgent("Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Mobile");

      const results = [];
      for (let i = 0; i < 100; i++) {
        results.push(hasOnScreenKeyboard());
      }

      const allSame = results.every(r => r === results[0]);
      expect(allSame).toBe(true);
      expect(results[0]).toBe(true);
    });
  });

  describe("return type", () => {
    test("should always return boolean", () => {
      setUserAgent("Mozilla/5.0 (iPhone)");
      const result = hasOnScreenKeyboard();

      expect(typeof result).toBe("boolean");
    });

    test("should never return undefined", () => {
      setUserAgent("Mozilla/5.0 (Windows NT 10.0)");
      const result = hasOnScreenKeyboard();

      expect(result).not.toBeUndefined();
    });

    test("should never return null", () => {
      setUserAgent("Mozilla/5.0 (Macintosh)");
      const result = hasOnScreenKeyboard();

      expect(result).not.toBeNull();
    });
  });

  describe("real-world user agents", () => {
    test("should detect iPhone 13 Pro", () => {
      setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1");

      expect(hasOnScreenKeyboard()).toBe(true);
    });

    test("should detect Samsung Galaxy S21", () => {
      setUserAgent("Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36");

      expect(hasOnScreenKeyboard()).toBe(true);
    });

    test("should not detect MacBook Pro", () => {
      setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");

      expect(hasOnScreenKeyboard()).toBe(false);
    });

    test("should not detect Windows 11 PC", () => {
      setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.81 Safari/537.36");

      expect(hasOnScreenKeyboard()).toBe(false);
    });

    test("should detect iPad Pro", () => {
      setUserAgent("Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1");

      expect(hasOnScreenKeyboard()).toBe(true);
    });
  });
});
