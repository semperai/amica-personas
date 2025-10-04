import { describe, expect, test } from "vitest";
import { Talk } from "../src/features/chat/messages";
import { removeEmojiFromText } from "../src/utils/removeEmojiFromText";

function makeTalk(message: string): Talk {
  return {
    style: "talk",
    message,
  }
}

describe("Cleaning Talk Tests", () => {
  test("should return same thing", () => {
    const t = makeTalk("Hello");
    expect(removeEmojiFromText(t).message).toBe("Hello");
  });
  test("should remove emoji", () => {
    const t = makeTalk("Hello 😊 Goodbye");
    expect(removeEmojiFromText(t).message).toBe("Hello Goodbye");
  });
  test("should remove smiley", () => {
    const t = makeTalk("Hello :) how are you");
    expect(removeEmojiFromText(t).message).toBe("Hello how are you");
  });
  test("should not remove non smiley", () => {
    const t = makeTalk("(WOOD)");
    expect(removeEmojiFromText(t).message).toBe("(WOOD)");
  });
  test("should remove smiley start of sentence", () => {
    const t = makeTalk(":D");
    expect(removeEmojiFromText(t).message).toBe("");
  });
});
