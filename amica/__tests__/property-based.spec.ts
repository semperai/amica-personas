import { describe, expect, test } from "vitest";
import * as fc from "fast-check";
import { buildUrl } from "@/utils/buildUrl";
import { cleanTalk } from "@/utils/cleanTalk";

/**
 * Property-Based Tests
 *
 * These tests verify properties/invariants that should hold for ALL inputs,
 * not just specific examples. Fast-check generates random inputs to find edge cases.
 */

describe("Property-Based Tests", () => {
  describe("buildUrl", () => {
    test("should always produce valid URLs", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (path) => {
            const result = buildUrl(path);

            // Property: Result should always be a string
            expect(typeof result).toBe("string");

            // Property: Result should contain the input path
            expect(result).toContain(path);

            // Property: Result should start with a forward slash
            expect(result.startsWith("/")).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test("should handle any string path without throwing", () => {
      fc.assert(
        fc.property(
          fc.string({ maxLength: 200 }),
          (path) => {
            // Property: Should never throw an error
            expect(() => buildUrl(path)).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    test("should be idempotent for leading slashes", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          (path) => {
            const withSlash = buildUrl(`/${path}`);
            const withoutSlash = buildUrl(path);

            // Property: Adding leading slash shouldn't change the result
            // (Both should normalize to the same thing)
            const normalizedWith = withSlash.replace(/\/+/g, "/");
            const normalizedWithout = withoutSlash.replace(/\/+/g, "/");

            expect(normalizedWith).toBe(normalizedWithout);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe("cleanTalk", () => {
    test("should never return null or undefined", () => {
      fc.assert(
        fc.property(
          fc.string(),
          (message) => {
            const talk = { style: 'neutral' as const, message };
            const result = cleanTalk(talk);

            // Property: Should always return a Talk object
            expect(result).not.toBeNull();
            expect(result).not.toBeUndefined();
            expect(typeof result.message).toBe("string");
          }
        ),
        { numRuns: 100 }
      );
    });

    test("should not make strings longer", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 500 }),
          (message) => {
            const talk = { style: 'neutral' as const, message };
            const result = cleanTalk(talk);

            // Property: Cleaning should never increase length
            expect(result.message.length).toBeLessThanOrEqual(message.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    test("should be idempotent (cleaning twice = cleaning once)", () => {
      fc.assert(
        fc.property(
          fc.string({ maxLength: 200 }),
          (message) => {
            const talk1 = { style: 'neutral' as const, message };
            const once = cleanTalk(talk1);
            const talk2 = { style: 'neutral' as const, message: once.message };
            const twice = cleanTalk(talk2);

            // Property: Cleaning an already cleaned string shouldn't change it
            expect(twice.message).toBe(once.message);
          }
        ),
        { numRuns: 100 }
      );
    });

    test("should preserve non-special characters (except double spaces)", () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom("a", "b", "c", "1", "2", "3", " "), { maxLength: 50 }),
          (chars) => {
            const message = chars.join('');
            const talk = { style: 'neutral' as const, message };
            const result = cleanTalk(talk);

            // Property: Simple alphanumeric strings should be preserved
            // except cleanTalk collapses double spaces to single spaces
            const expected = message.replace(/  /g, ' ');
            expect(result.message).toBe(expected);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe("String Sanitization Properties", () => {
    const sanitizeHTML = (input: string): string => {
      const tagPattern = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
      let sanitized = input.replace(tagPattern, "");
      sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, "");
      sanitized = sanitized.replace(/on\w+\s*=\s*[^\s>]*/gi, "");
      sanitized = sanitized.replace(/href\s*=\s*["']?javascript:[^"'>]*["']?/gi, "");
      sanitized = sanitized.replace(/javascript:/gi, "");
      return sanitized;
    };

    test("should never contain script tags after sanitization", () => {
      fc.assert(
        fc.property(
          fc.string({ maxLength: 500 }),
          (input) => {
            const result = sanitizeHTML(input);

            // Property: Should never contain <script> tags
            expect(result.toLowerCase()).not.toContain("<script>");
            expect(result.toLowerCase()).not.toContain("</script>");
          }
        ),
        { numRuns: 100 }
      );
    });

    test("should never contain javascript: protocol after sanitization", () => {
      fc.assert(
        fc.property(
          fc.string({ maxLength: 500 }),
          (input) => {
            const result = sanitizeHTML(input);

            // Property: Should never contain javascript: protocol
            expect(result.toLowerCase()).not.toContain("javascript:");
          }
        ),
        { numRuns: 100 }
      );
    });

    test("should be idempotent", () => {
      fc.assert(
        fc.property(
          fc.string({ maxLength: 200 }),
          (input) => {
            const once = sanitizeHTML(input);
            const twice = sanitizeHTML(once);

            // Property: Sanitizing twice should be same as sanitizing once
            expect(twice).toBe(once);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe("URL Building Properties", () => {
    test("should always include the path in result", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 50 }),
          (path) => {
            const result = buildUrl(path);

            // Property: Result should contain the input path
            expect(result).toContain(path);

            // Property: Result should be a string
            expect(typeof result).toBe('string');
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe("Number Properties", () => {
    const isEven = (n: number) => n % 2 === 0;
    const double = (n: number) => n * 2;

    test("doubling any integer always produces an even number", () => {
      fc.assert(
        fc.property(
          fc.integer(),
          (n) => {
            const result = double(n);

            // Property: Double of any integer is even
            expect(isEven(result)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test("adding an even number to itself is divisible by 4", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -10000, max: 10000 }),
          fc.boolean(),
          (n, makeEven) => {
            const evenNum = makeEven ? n * 2 : n;
            if (isEven(evenNum)) {
              const result = evenNum + evenNum;

              // Property: Even + Even is divisible by 4
              // Handle JavaScript's -0 by comparing absolute value
              expect(Math.abs(result % 4)).toBe(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe("Array Properties", () => {
    test("reversing an array twice returns original", () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer()),
          (arr) => {
            // Handle JavaScript's -0 edge case by normalizing
            const normalized = arr.map(n => n === 0 ? 0 : n);
            const reversed = [...normalized].reverse();
            const doubleReversed = [...reversed].reverse();

            // Property: Reverse is involutory (self-inverse)
            expect(doubleReversed).toEqual(normalized);
          }
        ),
        { numRuns: 100 }
      );
    });

    test("concatenating arrays preserves total length", () => {
      fc.assert(
        fc.property(
          fc.array(fc.string()),
          fc.array(fc.string()),
          (arr1, arr2) => {
            const combined = arr1.concat(arr2);

            // Property: Length is sum of parts
            expect(combined.length).toBe(arr1.length + arr2.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    test("filtering positive numbers then squaring gives subset of squaring then filtering positive", () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: -100, max: 100 })),
          (arr) => {
            const isPositive = (n: number) => n > 0;
            const square = (n: number) => n * n;

            const filterThenMap = arr.filter(isPositive).map(square);
            const mapThenFilter = arr.map(square).filter((n) => n > 0);

            // Property: Filtering positive then squaring produces a subset
            // because negative numbers when squared become positive
            // So filterThenMap.length <= mapThenFilter.length
            expect(filterThenMap.length).toBeLessThanOrEqual(mapThenFilter.length);

            // Property: All values in filterThenMap should be in mapThenFilter
            filterThenMap.forEach(val => {
              expect(mapThenFilter).toContain(val);
            });
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe("Object Properties", () => {
    test("JSON.parse(JSON.stringify(obj)) is identity for simple objects", () => {
      fc.assert(
        fc.property(
          fc.record({
            name: fc.string(),
            age: fc.integer({ min: 0, max: 120 }),
            active: fc.boolean(),
          }),
          (obj) => {
            const roundTrip = JSON.parse(JSON.stringify(obj));

            // Property: Round-trip through JSON preserves simple objects
            expect(roundTrip).toEqual(obj);
          }
        ),
        { numRuns: 100 }
      );
    });

    test("Object.keys(obj).length >= 0 for any object", () => {
      fc.assert(
        fc.property(
          fc.object(),
          (obj) => {
            const keys = Object.keys(obj);

            // Property: Key count is always non-negative
            expect(keys.length).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe("Date Properties", () => {
    test("Date.now() is monotonically increasing", () => {
      const timestamps: number[] = [];

      fc.assert(
        fc.property(
          fc.constant(null),
          () => {
            const now = Date.now();
            timestamps.push(now);

            if (timestamps.length > 1) {
              const prev = timestamps[timestamps.length - 2];

              // Property: Time should not go backwards
              expect(now).toBeGreaterThanOrEqual(prev);
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe("Math Properties", () => {
    test("Math.abs is always non-negative", () => {
      fc.assert(
        fc.property(
          fc.float(),
          (n) => {
            const result = Math.abs(n);

            // Property: Absolute value is always >= 0
            if (!isNaN(result)) {
              expect(result).toBeGreaterThanOrEqual(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test("Math.max returns value >= all inputs", () => {
      fc.assert(
        fc.property(
          fc.array(fc.float(), { minLength: 1, maxLength: 10 }),
          (numbers) => {
            const validNumbers = numbers.filter(n => !isNaN(n));
            if (validNumbers.length > 0) {
              const max = Math.max(...validNumbers);

              // Property: Max is >= all numbers
              validNumbers.forEach(n => {
                expect(max).toBeGreaterThanOrEqual(n);
              });
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test("Math.min returns value <= all inputs", () => {
      fc.assert(
        fc.property(
          fc.array(fc.float(), { minLength: 1, maxLength: 10 }),
          (numbers) => {
            const validNumbers = numbers.filter(n => !isNaN(n));
            if (validNumbers.length > 0) {
              const min = Math.min(...validNumbers);

              // Property: Min is <= all numbers
              validNumbers.forEach(n => {
                expect(min).toBeLessThanOrEqual(n);
              });
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe("String Properties", () => {
    test("toLowerCase is idempotent", () => {
      fc.assert(
        fc.property(
          fc.string(),
          (str) => {
            const once = str.toLowerCase();
            const twice = once.toLowerCase();

            // Property: Lowercasing twice = lowercasing once
            expect(twice).toBe(once);
          }
        ),
        { numRuns: 100 }
      );
    });

    test("string concatenation is associative", () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.string(),
          fc.string(),
          (a, b, c) => {
            const leftAssoc = (a + b) + c;
            const rightAssoc = a + (b + c);

            // Property: (a + b) + c = a + (b + c)
            expect(leftAssoc).toBe(rightAssoc);
          }
        ),
        { numRuns: 100 }
      );
    });

    test("trim removes only whitespace", () => {
      fc.assert(
        fc.property(
          fc.string(),
          (str) => {
            const trimmed = str.trim();

            // Property: Trimmed string length <= original
            expect(trimmed.length).toBeLessThanOrEqual(str.length);

            // Property: If not empty, first and last chars are not whitespace
            if (trimmed.length > 0) {
              expect(trimmed[0]).not.toMatch(/\s/);
              expect(trimmed[trimmed.length - 1]).not.toMatch(/\s/);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
