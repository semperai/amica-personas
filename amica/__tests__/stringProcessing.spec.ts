import { describe, expect, test } from "@jest/globals";
import {
  cleanTranscript,
  cleanFromWakeWord,
  cleanFromPunctuation
} from "../src/utils/stringProcessing";

describe("cleanTranscript", () => {
  test("should trim whitespace", () => {
    expect(cleanTranscript("  hello  ")).toBe("hello");
  });

  test("should remove content in square brackets", () => {
    expect(cleanTranscript("Hello [noise] world")).toBe("Hello  world");
  });

  test("should remove content in curly braces", () => {
    expect(cleanTranscript("Hello {cough} world")).toBe("Hello  world");
  });

  test("should remove content in parentheses", () => {
    expect(cleanTranscript("Hello (pause) world")).toBe("Hello  world");
  });

  test("should remove multiple types of brackets", () => {
    expect(cleanTranscript("Hello [noise] {cough} (pause) world")).toBe("Hello    world");
  });

  test("should handle empty string", () => {
    expect(cleanTranscript("")).toBe("");
  });

  test("should handle text with no brackets", () => {
    expect(cleanTranscript("Hello world")).toBe("Hello world");
  });

  test("should trim result after removing brackets", () => {
    expect(cleanTranscript("[noise] Hello world [end]")).toBe("");
  });

  test("should handle nested brackets (removes outer)", () => {
    expect(cleanTranscript("Text [outer (inner)] more")).toBe("Text  more");
  });
});

describe("cleanFromWakeWord", () => {
  test("should remove wake word from beginning", () => {
    expect(cleanFromWakeWord("Hey Amica how are you", "Hey Amica")).toBe("How are you");
  });

  test("should capitalize first letter after wake word", () => {
    expect(cleanFromWakeWord("hey amica what is the weather", "hey amica")).toBe("What is the weather");
  });

  test("should handle single word wake word", () => {
    expect(cleanFromWakeWord("Amica tell me a joke", "Amica")).toBe("Tell me a joke");
  });

  test("should not remove wake word if not at start", () => {
    expect(cleanFromWakeWord("I said hey amica yesterday", "hey amica")).toBe("I said hey amica yesterday");
  });

  test("should be case insensitive for detection", () => {
    expect(cleanFromWakeWord("HEY AMICA what time is it", "hey amica")).toBe("What time is it");
  });

  test("should handle empty string", () => {
    expect(cleanFromWakeWord("", "hey amica")).toBe("");
  });

  test("should handle text without wake word", () => {
    expect(cleanFromWakeWord("Hello world", "hey amica")).toBe("Hello world");
  });

  test("should handle wake word only", () => {
    expect(cleanFromWakeWord("hey amica", "hey amica")).toBe("");
  });

  test("should handle multi-word wake word correctly", () => {
    expect(cleanFromWakeWord("ok google search for cats", "ok google")).toBe("Search for cats");
  });
});

describe("cleanFromPunctuation", () => {
  test("should convert to lowercase", () => {
    expect(cleanFromPunctuation("HELLO WORLD")).toBe("hello world");
  });

  test("should remove punctuation", () => {
    expect(cleanFromPunctuation("Hello, world!")).toBe("hello world");
  });

  test("should preserve apostrophes", () => {
    expect(cleanFromPunctuation("Don't you think it's great?")).toBe("don't you think it's great");
  });

  test("should remove underscores", () => {
    expect(cleanFromPunctuation("hello_world")).toBe("helloworld");
  });

  test("should collapse multiple spaces", () => {
    expect(cleanFromPunctuation("hello    world")).toBe("hello world");
  });

  test("should handle multiple types of punctuation", () => {
    expect(cleanFromPunctuation("Hello! How are you? I'm fine.")).toBe("hello how are you i'm fine");
  });

  test("should handle empty string", () => {
    expect(cleanFromPunctuation("")).toBe("");
  });

  test("should preserve letters and numbers", () => {
    expect(cleanFromPunctuation("Test123 abc456")).toBe("test123 abc456");
  });

  test("should remove special characters", () => {
    expect(cleanFromPunctuation("Hello@#$%^&*()world")).toBe("helloworld");
  });

  test("should handle text with only punctuation", () => {
    expect(cleanFromPunctuation("!@#$%")).toBe("");
  });
});
