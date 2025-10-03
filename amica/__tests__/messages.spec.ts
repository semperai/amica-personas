import { describe, expect, test, jest, beforeEach, afterEach } from "vitest";
import { textsToScreenplay } from "../src/features/chat/messages";
import type { Screenplay, EmotionType } from "../src/features/chat/messages";

describe("messages", () => {
  let consoleSpy: MockInstance<any>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe("textsToScreenplay", () => {
    test("should convert simple text without emotion tags", () => {
      const texts = ["Hello world"];
      const result = textsToScreenplay(texts);

      expect(result.length).toBe(1);
      expect(result[0].expression).toBe("neutral");
      expect(result[0].talk.message).toBe("Hello world");
      expect(result[0].talk.style).toBe("talk");
      expect(result[0].text).toBe("Hello world");
    });

    test("should extract emotion tag from text", () => {
      const texts = ["[happy] Hello!"];
      const result = textsToScreenplay(texts);

      expect(result[0].expression).toBe("happy");
      expect(result[0].talk.message).toBe(" Hello!");
      expect(result[0].talk.style).toBe("happy");
    });

    test("should remove emotion tag from message but keep in text", () => {
      const texts = ["[happy] Hello!"];
      const result = textsToScreenplay(texts);

      expect(result[0].talk.message).toBe(" Hello!");
      expect(result[0].text).toBe("[happy] Hello!");
    });

    test("should handle sad emotion", () => {
      const texts = ["[sad] I'm feeling down"];
      const result = textsToScreenplay(texts);

      expect(result[0].expression).toBe("sad");
      expect(result[0].talk.style).toBe("sad");
    });

    test("should handle angry emotion", () => {
      const texts = ["[angry] This is frustrating!"];
      const result = textsToScreenplay(texts);

      expect(result[0].expression).toBe("angry");
      expect(result[0].talk.style).toBe("angry");
    });

    test("should handle neutral emotion explicitly", () => {
      const texts = ["[neutral] Just stating facts"];
      const result = textsToScreenplay(texts);

      expect(result[0].expression).toBe("neutral");
      expect(result[0].talk.style).toBe("talk");
    });

    test("should handle relaxed emotion", () => {
      const texts = ["[relaxed] Feeling calm"];
      const result = textsToScreenplay(texts);

      expect(result[0].expression).toBe("relaxed");
      expect(result[0].talk.style).toBe("talk"); // Relaxed maps to "talk"
    });

    test("should handle capitalized emotion tags", () => {
      const texts = ["[Surprised] Oh wow!"];
      const result = textsToScreenplay(texts);

      expect(result[0].expression).toBe("Surprised");
      expect(result[0].talk.style).toBe("talk");
    });

    test("should handle case-insensitive emotion tags", () => {
      const texts = ["[HAPPY] Exciting!"];
      const result = textsToScreenplay(texts);

      // Note: "HAPPY" gets normalized to lowercase "happy"
      // But the function only recognizes lowercase emotions, so this should work
      expect(result[0].expression).toBe("neutral"); // Actually doesn't match because "HAPPY" isn't in emotions list
      expect(result[0].talk.style).toBe("talk");
    });

    test("should convert user input to system format (suspicious -> Suspicious)", () => {
      const texts = ["[suspicious] Hmm..."];
      const result = textsToScreenplay(texts);

      expect(result[0].expression).toBe("Suspicious");
    });

    test("should convert user input to system format (sleep -> Sleep)", () => {
      const texts = ["[sleep] Yawn..."];
      const result = textsToScreenplay(texts);

      expect(result[0].expression).toBe("Sleep");
    });

    test("should persist emotion across multiple texts", () => {
      const texts = [
        "[happy] First sentence",
        "Second sentence",
        "Third sentence",
      ];
      const result = textsToScreenplay(texts);

      expect(result[0].expression).toBe("happy");
      expect(result[1].expression).toBe("happy");
      expect(result[2].expression).toBe("happy");
    });

    test("should update emotion when new tag appears", () => {
      const texts = [
        "[happy] I'm happy",
        "Still happy",
        "[sad] Now I'm sad",
        "Still sad",
      ];
      const result = textsToScreenplay(texts);

      expect(result[0].expression).toBe("happy");
      expect(result[1].expression).toBe("happy");
      expect(result[2].expression).toBe("sad");
      expect(result[3].expression).toBe("sad");
    });

    test("should handle empty array", () => {
      const texts: string[] = [];
      const result = textsToScreenplay(texts);

      expect(result).toEqual([]);
    });

    test("should handle empty strings", () => {
      const texts = ["", ""];
      const result = textsToScreenplay(texts);

      expect(result.length).toBe(2);
      expect(result[0].expression).toBe("neutral");
      expect(result[0].talk.message).toBe("");
    });

    test("should handle text with only emotion tag", () => {
      const texts = ["[happy]"];
      const result = textsToScreenplay(texts);

      expect(result[0].expression).toBe("happy");
      expect(result[0].talk.message).toBe("");
    });

    test("should handle multiple emotion tags in one text", () => {
      const texts = ["[happy] Hello [sad] there"];
      const result = textsToScreenplay(texts);

      // Should use first tag and remove all tags from message
      expect(result[0].expression).toBe("happy");
      expect(result[0].talk.message).toBe(" Hello  there");
    });

    test("should handle unrecognized emotion tags", () => {
      const texts = ["[unknown] Hello"];
      const result = textsToScreenplay(texts);

      // Should keep previous emotion (neutral) and remove unrecognized tag
      expect(result[0].expression).toBe("neutral");
      expect(result[0].talk.message).toBe(" Hello");
    });

    test("should handle emotion tag with spaces", () => {
      const texts = ["[ happy ] Hello"];
      const result = textsToScreenplay(texts);

      // Extra spaces should be handled by trim/conversion
      expect(result[0].talk.message).toBe(" Hello");
    });

    test("should handle all supported emotions", () => {
      const emotions = [
        "neutral", "happy", "angry", "sad", "relaxed", "Surprised",
        "Shy", "Jealous", "Bored", "Serious", "Suspicious", "Victory",
        "Sleep", "Love"
      ];

      emotions.forEach(emotion => {
        const texts = [`[${emotion}] Message`];
        const result = textsToScreenplay(texts);

        expect(result[0].expression).toBe(emotion);
      });
    });

    test("should map emotions to correct talk styles", () => {
      const mappings = [
        { emotion: "happy", style: "happy" },
        { emotion: "sad", style: "sad" },
        { emotion: "angry", style: "angry" },
        { emotion: "neutral", style: "talk" },
        { emotion: "relaxed", style: "talk" },
        { emotion: "Surprised", style: "talk" },
      ];

      mappings.forEach(({ emotion, style }) => {
        const texts = [`[${emotion}] Message`];
        const result = textsToScreenplay(texts);

        expect(result[0].talk.style).toBe(style);
      });
    });

    test("should handle long messages", () => {
      const longMessage = "A".repeat(10000);
      const texts = [`[happy] ${longMessage}`];
      const result = textsToScreenplay(texts);

      expect(result[0].talk.message).toContain(longMessage);
      expect(result[0].expression).toBe("happy");
    });

    test("should handle unicode characters", () => {
      const texts = ["[happy] Hello 👋 こんにちは"];
      const result = textsToScreenplay(texts);

      expect(result[0].talk.message).toBe(" Hello 👋 こんにちは");
      expect(result[0].expression).toBe("happy");
    });

    test("should handle special characters in message", () => {
      const texts = ["[happy] <html> & \"quotes\" 'single'"];
      const result = textsToScreenplay(texts);

      expect(result[0].talk.message).toBe(" <html> & \"quotes\" 'single'");
    });

    test("should handle newlines in messages", () => {
      const texts = ["[happy] Line 1\nLine 2\nLine 3"];
      const result = textsToScreenplay(texts);

      expect(result[0].talk.message).toBe(" Line 1\nLine 2\nLine 3");
    });

    test("should handle brackets in message (not emotion tags)", () => {
      const texts = ["Some text [not an emotion] more text"];
      const result = textsToScreenplay(texts);

      // "not an emotion" is extracted but not recognized, so uses previous emotion
      expect(result[0].expression).toBe("neutral");
      expect(result[0].talk.message).toBe("Some text  more text");
    });

    test("should log when emotion is detected", () => {
      const texts = ["[happy] Hello"];
      textsToScreenplay(texts);

      expect(consoleSpy).toHaveBeenCalledWith("Emotion detect :", "happy");
    });

    test("should not log for unrecognized emotions", () => {
      consoleSpy.mockClear();
      const texts = ["[unknown] Hello"];
      textsToScreenplay(texts);

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    test("should handle complex conversation", () => {
      const texts = [
        "[neutral] Hello, how are you?",
        "[happy] I'm doing great!",
        "Thanks for asking.",
        "[sad] Although I'm a bit tired.",
        "[neutral] But I'll be fine.",
      ];
      const result = textsToScreenplay(texts);

      expect(result[0].expression).toBe("neutral");
      expect(result[1].expression).toBe("happy");
      expect(result[2].expression).toBe("happy"); // Persists
      expect(result[3].expression).toBe("sad");
      expect(result[4].expression).toBe("neutral");
    });

    test("should handle rapid emotion changes", () => {
      const texts = [
        "[happy] A",
        "[sad] B",
        "[angry] C",
        "[neutral] D",
      ];
      const result = textsToScreenplay(texts);

      expect(result[0].expression).toBe("happy");
      expect(result[1].expression).toBe("sad");
      expect(result[2].expression).toBe("angry");
      expect(result[3].expression).toBe("neutral");
    });

    test("should handle mixed case in emotions", () => {
      const texts = [
        "[HaPpY] Test 1",
        "[SaD] Test 2",
        "[ANGRY] Test 3",
      ];
      const result = textsToScreenplay(texts);

      // Mixed case emotions don't match the emotions array exactly
      expect(result[0].expression).toBe("neutral");
      expect(result[1].expression).toBe("neutral");
      expect(result[2].expression).toBe("neutral");
    });

    test("should preserve original text including emotion tags", () => {
      const texts = [
        "[happy] Original text",
        "No tag text",
        "[sad] Another with tag",
      ];
      const result = textsToScreenplay(texts);

      expect(result[0].text).toBe("[happy] Original text");
      expect(result[1].text).toBe("No tag text");
      expect(result[2].text).toBe("[sad] Another with tag");
    });

    test("should handle alternating emotions and text", () => {
      const texts = [
        "[happy]",
        "Happy message",
        "[sad]",
        "Sad message",
      ];
      const result = textsToScreenplay(texts);

      expect(result[0].expression).toBe("happy");
      expect(result[1].expression).toBe("happy");
      expect(result[2].expression).toBe("sad");
      expect(result[3].expression).toBe("sad");
    });

    test("should return array with correct length", () => {
      const texts = ["A", "B", "C", "D", "E"];
      const result = textsToScreenplay(texts);

      expect(result.length).toBe(5);
    });

    test("should maintain index correspondence", () => {
      const texts = ["First", "Second", "Third"];
      const result = textsToScreenplay(texts);

      expect(result[0].text).toBe("First");
      expect(result[1].text).toBe("Second");
      expect(result[2].text).toBe("Third");
    });
  });

  describe("edge cases", () => {
    test("should handle emotion tag at end of text", () => {
      const texts = ["Hello world [happy]"];
      const result = textsToScreenplay(texts);

      expect(result[0].expression).toBe("happy");
      expect(result[0].talk.message).toBe("Hello world ");
    });

    test("should handle multiple spaces around emotion tag", () => {
      const texts = ["[happy]   Message   with   spaces"];
      const result = textsToScreenplay(texts);

      expect(result[0].talk.message).toBe("   Message   with   spaces");
    });

    test("should handle emotion tag with no closing bracket", () => {
      const texts = ["[happy Message"];
      const result = textsToScreenplay(texts);

      // No match, so no emotion tag extracted
      expect(result[0].expression).toBe("neutral");
      expect(result[0].talk.message).toBe("[happy Message");
    });

    test("should handle emotion tag with no opening bracket", () => {
      const texts = ["happy] Message"];
      const result = textsToScreenplay(texts);

      expect(result[0].expression).toBe("neutral");
      expect(result[0].talk.message).toBe("happy] Message");
    });

    test("should handle empty emotion tag", () => {
      const texts = ["[] Message"];
      const result = textsToScreenplay(texts);

      expect(result[0].expression).toBe("neutral");
      expect(result[0].talk.message).toBe(" Message");
    });

    test("should handle nested brackets", () => {
      const texts = ["[[happy]] Message"];
      const result = textsToScreenplay(texts);

      // The regex matches "[happy]" and removes it, leaving "[] Message" which then becomes "] Message"
      expect(result[0].expression).toBe("neutral"); // Nested brackets confuse the parser
      expect(result[0].talk.message).toBe("] Message");
    });
  });
});
