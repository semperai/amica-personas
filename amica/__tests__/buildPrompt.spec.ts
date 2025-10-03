import { describe, expect, test } from "vitest";
import { buildPrompt, buildVisionPrompt } from "@/utils/buildPrompt";
import type { Message } from "@/features/chat/messages";
import { config } from "@/utils/config";

describe("buildPrompt", () => {
  describe("buildPrompt", () => {
    test("should build prompt with single user message", () => {
      const messages: Message[] = [
        { role: "user", content: "Hello" },
      ];

      const result = buildPrompt(messages);

      expect(result).toBe("User: Hello\nAmica:");
    });

    test("should build prompt with system message", () => {
      const messages: Message[] = [
        { role: "system", content: "You are helpful" },
      ];

      const result = buildPrompt(messages);

      expect(result).toBe(`${config("system_prompt")}\n\n${config("name")}:`);
    });

    test("should build prompt with assistant message", () => {
      const messages: Message[] = [
        { role: "assistant", content: "How can I help?" },
      ];

      const result = buildPrompt(messages);

      expect(result).toBe("Amica: How can I help?\nAmica:");
    });

    test("should build prompt with mixed messages in order", () => {
      const messages: Message[] = [
        { role: "system", content: "System prompt" },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
        { role: "user", content: "How are you?" },
      ];

      const result = buildPrompt(messages);

      expect(result).toBe(
        `${config("system_prompt")}\n\n` +
        "User: Hello\n" +
        `${config("name")}: Hi there!\n` +
        "User: How are you?\n" +
        `${config("name")}:`
      );
    });

    test("should handle empty messages array", () => {
      const messages: Message[] = [];

      const result = buildPrompt(messages);

      expect(result).toBe("Amica:");
    });

    test("should handle empty message content", () => {
      const messages: Message[] = [
        { role: "user", content: "" },
      ];

      const result = buildPrompt(messages);

      expect(result).toBe("User: \nAmica:");
    });

    test("should handle multiple system messages", () => {
      const messages: Message[] = [
        { role: "system", content: "First system" },
        { role: "system", content: "Second system" },
      ];

      const result = buildPrompt(messages);

      expect(result).toBe(
        `${config("system_prompt")}\n\n` +
        `${config("system_prompt")}\n\n` +
        `${config("name")}:`
      );
    });

    test("should preserve special characters in content", () => {
      const messages: Message[] = [
        { role: "user", content: "Hello! How are you? I'm fine. <test>" },
      ];

      const result = buildPrompt(messages);

      expect(result).toBe("User: Hello! How are you? I'm fine. <test>\nAmica:");
    });

    test("should preserve newlines in content", () => {
      const messages: Message[] = [
        { role: "user", content: "Line 1\nLine 2\nLine 3" },
      ];

      const result = buildPrompt(messages);

      expect(result).toBe("User: Line 1\nLine 2\nLine 3\nAmica:");
    });

    test("should handle long conversation", () => {
      const messages: Message[] = [
        { role: "system", content: "System" },
        { role: "user", content: "Message 1" },
        { role: "assistant", content: "Response 1" },
        { role: "user", content: "Message 2" },
        { role: "assistant", content: "Response 2" },
        { role: "user", content: "Message 3" },
        { role: "assistant", content: "Response 3" },
        { role: "user", content: "Message 4" },
      ];

      const result = buildPrompt(messages);

      expect(result).toContain("User: Message 1");
      expect(result).toContain("Amica: Response 1");
      expect(result).toContain("User: Message 4");
      expect(result).toMatch(/Amica:$/);
    });

    test("should handle unicode characters", () => {
      const messages: Message[] = [
        { role: "user", content: "Hello 👋 こんにちは 中文" },
      ];

      const result = buildPrompt(messages);

      expect(result).toBe("User: Hello 👋 こんにちは 中文\nAmica:");
    });

    test("should handle very long message content", () => {
      const longContent = "A".repeat(10000);
      const messages: Message[] = [
        { role: "user", content: longContent },
      ];

      const result = buildPrompt(messages);

      expect(result).toContain(longContent);
      expect(result).toMatch(/Amica:$/);
    });

    test("should always end with assistant name and colon", () => {
      const messages: Message[] = [
        { role: "user", content: "test" },
      ];

      const result = buildPrompt(messages);

      expect(result).toMatch(/Amica:$/);
    });

    test("should format user messages with User prefix", () => {
      const messages: Message[] = [
        { role: "user", content: "test message" },
      ];

      const result = buildPrompt(messages);

      expect(result).toContain("User: test message");
    });

    test("should format assistant messages with configured name", () => {
      const messages: Message[] = [
        { role: "assistant", content: "test response" },
      ];

      const result = buildPrompt(messages);

      expect(result).toContain("Amica: test response");
    });

    test("should handle alternating user and assistant messages", () => {
      const messages: Message[] = [
        { role: "user", content: "Q1" },
        { role: "assistant", content: "A1" },
        { role: "user", content: "Q2" },
        { role: "assistant", content: "A2" },
      ];

      const result = buildPrompt(messages);

      const lines = result.split("\n");
      expect(lines[0]).toBe("User: Q1");
      expect(lines[1]).toBe("Amica: A1");
      expect(lines[2]).toBe("User: Q2");
      expect(lines[3]).toBe("Amica: A2");
    });
  });

  describe("buildVisionPrompt", () => {
    test("should build vision prompt with single user message", () => {
      const messages: Message[] = [
        { role: "user", content: "What's in this image?" },
      ];

      const result = buildVisionPrompt(messages);

      expect(result).toBe("User: What's in this image?\nAmica:");
    });

    test("should build vision prompt with system message", () => {
      const messages: Message[] = [
        { role: "system", content: "Vision prompt" },
      ];

      const result = buildVisionPrompt(messages);

      expect(result).toBe("You are a friendly human named Amica. Describe the image in detail. Let's start the conversation.\n\nAmica:");
    });

    test("should build vision prompt with assistant message", () => {
      const messages: Message[] = [
        { role: "assistant", content: "I see a cat" },
      ];

      const result = buildVisionPrompt(messages);

      expect(result).toBe("Amica: I see a cat\nAmica:");
    });

    test("should build vision prompt with mixed messages", () => {
      const messages: Message[] = [
        { role: "system", content: "Vision system" },
        { role: "user", content: "Describe the image" },
        { role: "assistant", content: "I see a landscape" },
      ];

      const result = buildVisionPrompt(messages);

      expect(result).toBe(
        "You are a friendly human named Amica. Describe the image in detail. Let's start the conversation.\n\n" +
        "User: Describe the image\n" +
        "Amica: I see a landscape\n" +
        "Amica:"
      );
    });

    test("should handle empty messages array", () => {
      const messages: Message[] = [];

      const result = buildVisionPrompt(messages);

      expect(result).toBe("Amica:");
    });

    test("should use vision_system_prompt for system messages", () => {
      const messages: Message[] = [
        { role: "system", content: "Ignored" },
      ];

      const result = buildVisionPrompt(messages);

      expect(result).toContain("You are a friendly human named Amica. Describe the image in detail.");
    });

    test("should format messages same as buildPrompt except system", () => {
      const messages: Message[] = [
        { role: "user", content: "test" },
        { role: "assistant", content: "response" },
      ];

      const regularResult = buildPrompt(messages);
      const visionResult = buildVisionPrompt(messages);

      // They should be the same for non-system messages
      expect(regularResult).toBe(visionResult);
    });

    test("should handle long vision conversation", () => {
      const messages: Message[] = [
        { role: "system", content: "Vision" },
        { role: "user", content: "What do you see?" },
        { role: "assistant", content: "I see a cat" },
        { role: "user", content: "What color?" },
        { role: "assistant", content: "Orange" },
      ];

      const result = buildVisionPrompt(messages);

      expect(result).toContain("User: What do you see?");
      expect(result).toContain("Amica: I see a cat");
      expect(result).toContain("User: What color?");
      expect(result).toContain("Amica: Orange");
      expect(result).toMatch(/Amica:$/);
    });
  });

  describe("buildPrompt vs buildVisionPrompt differences", () => {
    test("should use different system prompts", () => {
      const messages: Message[] = [
        { role: "system", content: "Test" },
      ];

      const regularResult = buildPrompt(messages);
      const visionResult = buildVisionPrompt(messages);

      expect(regularResult).toContain(config("system_prompt"));
      expect(visionResult).toContain(config("vision_system_prompt"));
      expect(regularResult).not.toBe(visionResult);
    });

    test("should have same format for user and assistant messages", () => {
      const messages: Message[] = [
        { role: "user", content: "test" },
        { role: "assistant", content: "response" },
      ];

      const regularLines = buildPrompt(messages).split("\n");
      const visionLines = buildVisionPrompt(messages).split("\n");

      // Should have same number of lines
      expect(regularLines.length).toBe(visionLines.length);

      // User and assistant lines should be identical
      expect(regularLines[0]).toBe(visionLines[0]);
      expect(regularLines[1]).toBe(visionLines[1]);
    });
  });
});
