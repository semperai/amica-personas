import { describe, expect, test } from "vitest";
import { hashCode } from "@/utils/stringHash";

describe("stringHash", () => {
  describe("hashCode", () => {
    test("should generate consistent hash for same string", () => {
      const str = "test string";
      const hash1 = hashCode(str);
      const hash2 = hashCode(str);

      expect(hash1).toBe(hash2);
    });

    test("should generate different hashes for different strings", () => {
      const hash1 = hashCode("string1");
      const hash2 = hashCode("string2");

      expect(hash1).not.toBe(hash2);
    });

    test("should handle empty string", () => {
      const hash = hashCode("");

      expect(hash).toBe("0");
    });

    test("should handle single character", () => {
      const hash = hashCode("a");

      expect(hash).toBeDefined();
      expect(typeof hash).toBe("string");
      expect(hash).not.toBe("0");
    });

    test("should handle unicode characters", () => {
      const hash1 = hashCode("hello 🌍");
      const hash2 = hashCode("hello 🌎");

      expect(hash1).toBeDefined();
      expect(hash2).toBeDefined();
      expect(hash1).not.toBe(hash2);
    });

    test("should handle long strings", () => {
      const longString = "a".repeat(1000);
      const hash = hashCode(longString);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe("string");
    });

    test("should return string representation of hash", () => {
      const hash = hashCode("test");

      expect(typeof hash).toBe("string");
      expect(hash).toMatch(/^-?\d+$/); // Should be numeric string
    });

    test("should handle special characters", () => {
      const hash = hashCode("!@#$%^&*()");

      expect(hash).toBeDefined();
      expect(typeof hash).toBe("string");
    });

    test("should be case sensitive", () => {
      const hash1 = hashCode("Test");
      const hash2 = hashCode("test");

      expect(hash1).not.toBe(hash2);
    });

    test("should handle whitespace differences", () => {
      const hash1 = hashCode("test string");
      const hash2 = hashCode("teststring");

      expect(hash1).not.toBe(hash2);
    });
  });
});
