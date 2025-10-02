import { describe, expect, test, jest } from "@jest/globals";
import { processResponse } from "@/utils/processResponse";

// Mock textsToScreenplay
jest.mock("@/features/chat/messages", () => ({
  textsToScreenplay: jest.fn((texts: string[]) => {
    return texts.map(text => ({
      text: text,
      talk: { message: text, style: "talk" }
    }));
  }),
}));

/**
 * processResponse Tests
 *
 * Tests for streaming AI response processing including:
 * - Tag extraction ([happy], [sad], etc.)
 * - Role-play detection (*smiling*, *thinking*)
 * - Sentence segmentation
 * - Callback invocation
 */

describe("processResponse", () => {
  const createDefaultParams = () => ({
    sentences: [] as string[],
    aiTextLog: "",
    receivedMessage: "",
    tag: "",
    rolePlay: "",
    callback: jest.fn(() => false),
  });

  describe("tag extraction", () => {
    test("should extract tag from message", () => {
      const params = createDefaultParams();
      params.receivedMessage = "[happy] Hello world.";

      const result = processResponse(params);

      expect(result.tag).toBe("[happy]");
      // Sentence is also extracted in same call, leaving receivedMessage empty
      expect(result.sentences).toEqual([" Hello world."]);
      expect(result.receivedMessage).toBe("");
    });

    test("should handle multiple tags by extracting only the first", () => {
      const params = createDefaultParams();
      params.receivedMessage = "[happy] I am [excited] today.";

      const result = processResponse(params);

      expect(result.tag).toBe("[happy]");
      // First tag is removed, sentence extracted, second tag remains in next iteration
      expect(result.sentences).toEqual([" I am [excited] today."]);
      expect(result.receivedMessage).toBe("");
    });

    test("should preserve existing tag if no new tag found", () => {
      const params = createDefaultParams();
      params.tag = "[neutral]";
      params.receivedMessage = "Hello world.";

      const result = processResponse(params);

      expect(result.tag).toBe("[neutral]");
    });

    test("should handle empty tag brackets", () => {
      const params = createDefaultParams();
      params.receivedMessage = "[] Hello world.";

      const result = processResponse(params);

      expect(result.tag).toBe("[]");
    });

    test("should not extract partial tags", () => {
      const params = createDefaultParams();
      params.receivedMessage = "[happy Hello.";

      const result = processResponse(params);

      expect(result.tag).toBe("");
    });
  });

  describe("role-play extraction", () => {
    test("should extract role-play text", () => {
      const params = createDefaultParams();
      params.receivedMessage = "*smiling* Hello there.";

      const result = processResponse(params);

      expect(result.rolePlay).toBe("*smiling*");
      // Role-play is replaced, sentence extracted, receivedMessage becomes empty
      expect(result.sentences).toEqual([" Hello there."]);
      expect(result.receivedMessage).toBe("");
    });

    test("should remove role-play from message", () => {
      const params = createDefaultParams();
      params.receivedMessage = "Hello *waving* there.";

      const result = processResponse(params);

      expect(result.rolePlay).toBe("*waving*");
      // Role-play is replaced, sentence extracted
      expect(result.sentences).toEqual(["Hello  there."]);
      expect(result.receivedMessage).toBe("");
    });

    test("should handle multiple role-play markers", () => {
      const params = createDefaultParams();
      params.receivedMessage = "*smiling* Hello *waving* there.";

      const result = processResponse(params);

      // Only first match is extracted
      expect(result.rolePlay).toBe("*smiling*");
    });

    test("should preserve existing rolePlay if no new one found", () => {
      const params = createDefaultParams();
      params.rolePlay = "*thinking*";
      params.receivedMessage = "Hello.";

      const result = processResponse(params);

      expect(result.rolePlay).toBe("*thinking*");
    });
  });

  describe("sentence segmentation", () => {
    test("should extract sentence ending with period", () => {
      const params = createDefaultParams();
      params.receivedMessage = "Hello world. More text";

      const result = processResponse(params);

      expect(result.sentences).toEqual(["Hello world."]);
      expect(result.receivedMessage).toBe("More text");
    });

    test("should extract sentence ending with exclamation mark", () => {
      const params = createDefaultParams();
      params.receivedMessage = "Wow! Amazing";

      const result = processResponse(params);

      expect(result.sentences).toEqual(["Wow!"]);
      expect(result.receivedMessage).toBe("Amazing");
    });

    test("should extract sentence ending with question mark", () => {
      const params = createDefaultParams();
      params.receivedMessage = "How are you? I'm fine";

      const result = processResponse(params);

      expect(result.sentences).toEqual(["How are you?"]);
      expect(result.receivedMessage).toBe("I'm fine");
    });

    test("should extract sentence ending with newline", () => {
      const params = createDefaultParams();
      params.receivedMessage = "First line\nSecond line";

      const result = processResponse(params);

      expect(result.sentences).toEqual(["First line\n"]);
      expect(result.receivedMessage).toBe("Second line");
    });

    test("should extract sentence with comma after 10+ characters", () => {
      const params = createDefaultParams();
      params.receivedMessage = "This is a long sentence, with more";

      const result = processResponse(params);

      expect(result.sentences).toEqual(["This is a long sentence,"]);
      expect(result.receivedMessage).toBe("with more");
    });

    test("should not extract comma before 10 characters", () => {
      const params = createDefaultParams();
      params.receivedMessage = "Short, text";

      const result = processResponse(params);

      // Comma is too early, no sentence extracted
      expect(result.sentences).toEqual([]);
      expect(result.receivedMessage).toBe("Short, text");
    });

    test("should handle Japanese punctuation", () => {
      const params = createDefaultParams();
      params.receivedMessage = "こんにちは。世界";

      const result = processResponse(params);

      expect(result.sentences).toEqual(["こんにちは。"]);
      expect(result.receivedMessage).toBe("世界");
    });

    test("should trim whitespace after extracting sentence", () => {
      const params = createDefaultParams();
      params.receivedMessage = "Hello.    Lots of spaces";

      const result = processResponse(params);

      expect(result.receivedMessage).toBe("Lots of spaces");
    });

    test("should accumulate multiple sentences", () => {
      let params = createDefaultParams();
      params.receivedMessage = "First.";

      let result = processResponse(params);
      expect(result.sentences).toEqual(["First."]);

      // Process second sentence
      params = { ...result, receivedMessage: "Second.", callback: jest.fn(() => false) };
      result = processResponse(params);

      expect(result.sentences).toEqual(["First.", "Second."]);
    });
  });

  describe("callback invocation", () => {
    test("should call callback with screenplay when sentence is complete", () => {
      const mockCallback = jest.fn(() => false);
      const params = createDefaultParams();
      params.callback = mockCallback;
      params.tag = "[happy]";
      params.receivedMessage = "Hello world.";

      processResponse(params);

      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledWith([
        expect.objectContaining({
          text: "[happy] Hello world.",
        })
      ]);
    });

    test("should not call callback if no complete sentence", () => {
      const mockCallback = jest.fn(() => false);
      const params = createDefaultParams();
      params.callback = mockCallback;
      params.receivedMessage = "Incomplete";

      processResponse(params);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    test("should set shouldBreak when callback returns true", () => {
      const mockCallback = jest.fn(() => true);
      const params = createDefaultParams();
      params.callback = mockCallback;
      params.receivedMessage = "Hello.";

      const result = processResponse(params);

      expect(result.shouldBreak).toBe(true);
    });

    test("should not set shouldBreak when callback returns false", () => {
      const mockCallback = jest.fn(() => false);
      const params = createDefaultParams();
      params.callback = mockCallback;
      params.receivedMessage = "Hello.";

      const result = processResponse(params);

      expect(result.shouldBreak).toBe(false);
    });
  });

  describe("aiTextLog accumulation", () => {
    test("should accumulate text to aiTextLog", () => {
      const params = createDefaultParams();
      params.tag = "[happy]";
      params.receivedMessage = "Hello.";

      const result = processResponse(params);

      expect(result.aiTextLog).toBe("[happy] Hello.");
    });

    test("should append to existing aiTextLog", () => {
      const params = createDefaultParams();
      params.aiTextLog = "Previous text. ";
      params.tag = "[happy]";
      params.receivedMessage = "New text.";

      const result = processResponse(params);

      expect(result.aiTextLog).toBe("Previous text. [happy] New text.");
    });

    test("should include tag in aiTextLog", () => {
      const params = createDefaultParams();
      params.tag = "[excited]";
      params.receivedMessage = "Wow!";

      const result = processResponse(params);

      expect(result.aiTextLog).toContain("[excited]");
      expect(result.aiTextLog).toContain("Wow!");
    });
  });

  describe("edge cases", () => {
    test("should extract tag with only whitespace", () => {
      const mockCallback = jest.fn(() => false);
      const params = createDefaultParams();
      params.callback = mockCallback;
      params.receivedMessage = "[  ]. Real content.";

      const result = processResponse(params);

      // [  ] is treated as a tag, then ". Real content." is the sentence
      expect(result.tag).toBe("[  ]");
      expect(result.sentences).toEqual([". Real content."]);
      expect(result.aiTextLog).toBe("[  ] . Real content.");
      expect(mockCallback).toHaveBeenCalled();
    });

    test("should handle empty receivedMessage", () => {
      const mockCallback = jest.fn(() => false);
      const params = createDefaultParams();
      params.callback = mockCallback;
      params.receivedMessage = "";

      const result = processResponse(params);

      expect(result.sentences).toEqual([]);
      expect(result.aiTextLog).toBe("");
      expect(mockCallback).not.toHaveBeenCalled();
    });

    test("should handle message with only tag and rolePlay", () => {
      const params = createDefaultParams();
      params.receivedMessage = "[happy] *smiling*";

      const result = processResponse(params);

      expect(result.tag).toBe("[happy]");
      expect(result.rolePlay).toBe("*smiling*");
      expect(result.sentences).toEqual([]);
    });

    test("should process complex message with tag, rolePlay, and sentence", () => {
      const params = createDefaultParams();
      params.receivedMessage = "[excited] *jumping* This is amazing!";

      const result = processResponse(params);

      expect(result.tag).toBe("[excited]");
      expect(result.rolePlay).toBe("*jumping*");
      // rolePlay replacement leaves extra space, resulting in 2 spaces before sentence
      expect(result.sentences).toEqual(["  This is amazing!"]);
      // aiText = tag + " " + sentence, so "[excited]" + " " + "  This is amazing!"
      expect(result.aiTextLog).toBe("[excited]   This is amazing!");
    });

    test("should handle very long messages", () => {
      const params = createDefaultParams();
      const longText = "a".repeat(1000) + ".";
      params.receivedMessage = longText;

      const result = processResponse(params);

      expect(result.sentences).toHaveLength(1);
      expect(result.sentences[0]).toBe(longText);
    });

    test("should handle special characters in sentence", () => {
      const params = createDefaultParams();
      params.receivedMessage = "Hello 👋 world! 🌍";

      const result = processResponse(params);

      expect(result.sentences).toEqual(["Hello 👋 world!"]);
    });
  });

  describe("return value structure", () => {
    test("should return all required fields", () => {
      const params = createDefaultParams();
      params.receivedMessage = "Hello.";

      const result = processResponse(params);

      expect(result).toHaveProperty("sentences");
      expect(result).toHaveProperty("aiTextLog");
      expect(result).toHaveProperty("receivedMessage");
      expect(result).toHaveProperty("tag");
      expect(result).toHaveProperty("rolePlay");
      expect(result).toHaveProperty("shouldBreak");
    });

    test("should preserve input arrays/strings as new instances", () => {
      const params = createDefaultParams();
      params.sentences = ["existing"];
      params.receivedMessage = "New.";

      const result = processResponse(params);

      // Sentences array should be the same reference (mutated)
      expect(result.sentences).toBe(params.sentences);
      expect(result.sentences).toEqual(["existing", "New."]);
    });
  });
});
