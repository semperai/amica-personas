import { describe, expect, test } from "vitest";
import { clamp } from "../src/utils/audioUtils";

describe("audioUtils", () => {
  describe("clamp", () => {
    test("should return value when within range", () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(0.5, 0, 1)).toBe(0.5);
      expect(clamp(-5, -10, 0)).toBe(-5);
    });

    test("should return min when value is below min", () => {
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(-1, 0, 1)).toBe(0);
      expect(clamp(-100, -50, 50)).toBe(-50);
    });

    test("should return max when value is above max", () => {
      expect(clamp(15, 0, 10)).toBe(10);
      expect(clamp(2, 0, 1)).toBe(1);
      expect(clamp(100, -50, 50)).toBe(50);
    });

    test("should return min when value equals min", () => {
      expect(clamp(0, 0, 10)).toBe(0);
      expect(clamp(-10, -10, 10)).toBe(-10);
    });

    test("should return max when value equals max", () => {
      expect(clamp(10, 0, 10)).toBe(10);
      expect(clamp(1, 0, 1)).toBe(1);
    });

    test("should handle floating point values", () => {
      expect(clamp(0.75, 0, 1)).toBe(0.75);
      expect(clamp(1.5, 0, 1)).toBe(1);
      expect(clamp(-0.5, 0, 1)).toBe(0);
      expect(clamp(3.14159, 0, 3.14)).toBeCloseTo(3.14, 5);
    });

    test("should handle negative ranges", () => {
      expect(clamp(-5, -10, -1)).toBe(-5);
      expect(clamp(-15, -10, -1)).toBe(-10);
      expect(clamp(0, -10, -1)).toBe(-1);
    });

    test("should handle zero as boundary", () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, -10, 0)).toBe(-5);
      expect(clamp(0, -10, 10)).toBe(0);
    });

    test("should handle same min and max", () => {
      expect(clamp(5, 10, 10)).toBe(10);
      expect(clamp(10, 10, 10)).toBe(10);
      expect(clamp(15, 10, 10)).toBe(10);
    });

    test("should handle very large numbers", () => {
      expect(clamp(1e10, 0, 1e9)).toBe(1e9);
      expect(clamp(1e8, 0, 1e9)).toBe(1e8);
      expect(clamp(-1e10, -1e9, 0)).toBe(-1e9);
    });

    test("should handle very small numbers", () => {
      expect(clamp(0.0001, 0, 1)).toBe(0.0001);
      expect(clamp(0.000001, 0.00001, 0.0001)).toBe(0.00001);
      expect(clamp(0.001, 0, 0.0001)).toBe(0.0001);
    });

    test("should work with audio volume ranges (0-1)", () => {
      expect(clamp(0.8, 0, 1)).toBe(0.8);
      expect(clamp(1.5, 0, 1)).toBe(1);
      expect(clamp(-0.2, 0, 1)).toBe(0);
    });

    test("should work with decibel-like ranges", () => {
      expect(clamp(-20, -100, 0)).toBe(-20);
      expect(clamp(5, -100, 0)).toBe(0);
      expect(clamp(-120, -100, 0)).toBe(-100);
    });

    test("should work with frequency ranges", () => {
      // Human hearing range: 20Hz - 20kHz
      expect(clamp(440, 20, 20000)).toBe(440); // A4 note
      expect(clamp(10, 20, 20000)).toBe(20); // Below range
      expect(clamp(25000, 20, 20000)).toBe(20000); // Above range
    });

    test("should handle Integer overflow gracefully", () => {
      const maxSafeInt = Number.MAX_SAFE_INTEGER;
      expect(clamp(maxSafeInt + 1, 0, maxSafeInt)).toBe(maxSafeInt);
    });

    test("should handle NaN gracefully", () => {
      const result = clamp(NaN, 0, 10);
      expect(isNaN(result)).toBe(true);
    });

    test("should handle Infinity", () => {
      expect(clamp(Infinity, 0, 10)).toBe(10);
      expect(clamp(-Infinity, 0, 10)).toBe(0);
      expect(clamp(5, -Infinity, Infinity)).toBe(5);
    });

    test("should be commutative for min/max swap (though not recommended)", () => {
      // If min > max, Math.min and Math.max should handle it
      // Though this is an edge case that shouldn't occur in normal usage
      const result = clamp(5, 10, 0);
      // Math.max(5, 10) = 10, then Math.min(10, 0) = 0
      expect(result).toBe(0);
    });

    test("should handle typical audio processing scenarios", () => {
      // Normalize audio sample to [-1, 1]
      expect(clamp(1.5, -1, 1)).toBe(1);
      expect(clamp(-1.5, -1, 1)).toBe(-1);
      expect(clamp(0.7, -1, 1)).toBe(0.7);

      // Clamp gain multiplier to [0, 2]
      expect(clamp(3, 0, 2)).toBe(2);
      expect(clamp(1.5, 0, 2)).toBe(1.5);
      expect(clamp(-0.5, 0, 2)).toBe(0);
    });
  });

  describe("clamp type safety", () => {
    test("should accept number type for all parameters", () => {
      const value: number = 5;
      const min: number = 0;
      const max: number = 10;
      const result: number = clamp(value, min, max);
      expect(result).toBe(5);
    });

    test("should return number type", () => {
      const result = clamp(5, 0, 10);
      expect(typeof result).toBe("number");
    });
  });
});
