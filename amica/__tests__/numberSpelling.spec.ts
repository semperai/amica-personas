import { describe, expect, test } from "vitest";
import { convertNumberToWordsEN } from "../src/utils/numberSpelling";

describe("convertNumberToWordsEN", () => {
  describe("special cases", () => {
    test("should convert zero", () => {
      expect(convertNumberToWordsEN(0)).toBe("zero");
    });

    test("should handle negative numbers", () => {
      expect(convertNumberToWordsEN(-5)).toBe("negative five");
      expect(convertNumberToWordsEN(-42)).toBe("negative forty two");
      expect(convertNumberToWordsEN(-100)).toBe("negative one hundred");
    });

    test("should floor decimal numbers", () => {
      expect(convertNumberToWordsEN(5.7)).toBe("five");
      expect(convertNumberToWordsEN(42.9)).toBe("forty two");
      expect(convertNumberToWordsEN(99.1)).toBe("ninety nine");
    });
  });

  describe("single digits (1-9)", () => {
    test("should convert 1", () => {
      expect(convertNumberToWordsEN(1)).toBe("one");
    });

    test("should convert 5", () => {
      expect(convertNumberToWordsEN(5)).toBe("five");
    });

    test("should convert 9", () => {
      expect(convertNumberToWordsEN(9)).toBe("nine");
    });
  });

  describe("teens (10-19)", () => {
    test("should convert 10", () => {
      expect(convertNumberToWordsEN(10)).toBe("ten");
    });

    test("should convert 11", () => {
      expect(convertNumberToWordsEN(11)).toBe("eleven");
    });

    test("should convert 13", () => {
      expect(convertNumberToWordsEN(13)).toBe("thirteen");
    });

    test("should convert 15", () => {
      expect(convertNumberToWordsEN(15)).toBe("fifteen");
    });

    test("should convert 19", () => {
      expect(convertNumberToWordsEN(19)).toBe("nineteen");
    });
  });

  describe("two digits (20-99)", () => {
    test("should convert 20", () => {
      expect(convertNumberToWordsEN(20)).toBe("twenty ");
    });

    test("should convert 21", () => {
      expect(convertNumberToWordsEN(21)).toBe("twenty one");
    });

    test("should convert 42", () => {
      expect(convertNumberToWordsEN(42)).toBe("forty two");
    });

    test("should convert 50", () => {
      expect(convertNumberToWordsEN(50)).toBe("fifty ");
    });

    test("should convert 77", () => {
      expect(convertNumberToWordsEN(77)).toBe("seventy seven");
    });

    test("should convert 99", () => {
      expect(convertNumberToWordsEN(99)).toBe("ninety nine");
    });
  });

  describe("hundreds (100-999)", () => {
    test("should convert 100", () => {
      expect(convertNumberToWordsEN(100)).toBe("one hundred");
    });

    test("should convert 200", () => {
      expect(convertNumberToWordsEN(200)).toBe("two hundred");
    });

    test("should convert 101", () => {
      expect(convertNumberToWordsEN(101)).toBe("one hundred and one");
    });

    test("should convert 150", () => {
      expect(convertNumberToWordsEN(150)).toBe("one hundred and fifty ");
    });

    test("should convert 234", () => {
      expect(convertNumberToWordsEN(234)).toBe("two hundred and thirty four");
    });

    test("should convert 505", () => {
      expect(convertNumberToWordsEN(505)).toBe("five hundred and five");
    });

    test("should convert 999", () => {
      expect(convertNumberToWordsEN(999)).toBe("nine hundred and ninety nine");
    });
  });

  describe("thousands (1000-9999)", () => {
    test("should convert 1000", () => {
      expect(convertNumberToWordsEN(1000)).toBe("one thousand");
    });

    test("should convert 2000", () => {
      expect(convertNumberToWordsEN(2000)).toBe("two thousand");
    });

    test("should convert 1001", () => {
      expect(convertNumberToWordsEN(1001)).toBe("one thousand and one");
    });

    test("should convert 1050", () => {
      expect(convertNumberToWordsEN(1050)).toBe("one thousand and fifty ");
    });

    test("should convert 1234", () => {
      expect(convertNumberToWordsEN(1234)).toBe("one thousand two hundred and thirty four");
    });

    test("should convert 2500", () => {
      expect(convertNumberToWordsEN(2500)).toBe("two thousand five hundred");
    });

    test("should convert 9999", () => {
      expect(convertNumberToWordsEN(9999)).toBe("nine thousand nine hundred and ninety nine");
    });
  });

  describe("edge cases", () => {
    test("should return empty string for numbers >= 10000", () => {
      expect(convertNumberToWordsEN(10000)).toBe("");
      expect(convertNumberToWordsEN(50000)).toBe("");
    });

    test("should handle negative zero", () => {
      expect(convertNumberToWordsEN(-0)).toBe("zero");
    });

    test("should handle large negative numbers", () => {
      expect(convertNumberToWordsEN(-1234)).toBe("negative one thousand two hundred and thirty four");
    });
  });
});
