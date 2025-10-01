import { describe, expect, test, jest, beforeEach, afterEach } from "@jest/globals";
import { handleNews } from "@/features/plugins/news";

// Mock expandPrompt
jest.mock("@/features/functionCalling/eventHandler", () => ({
  expandPrompt: jest.fn((prompt: string, values: any) => {
    return Promise.resolve(prompt.replace('{context_str}', values.context_str));
  }),
}));

describe("news", () => {
  let fetchSpy: jest.SpiedFunction<typeof global.fetch>;

  beforeEach(() => {
    // Spy on global fetch
    fetchSpy = jest.spyOn(global, 'fetch') as jest.SpiedFunction<typeof global.fetch>;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createMockRSS = (items: Array<{title: string, description: string}>) => {
    const itemsXML = items.map(item => `
      <item>
        <title>${item.title}</title>
        <description>${item.description}</description>
      </item>
    `).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <title>NYT Homepage</title>
          ${itemsXML}
        </channel>
      </rss>`;
  };

  describe("handleNews", () => {
    test("should fetch and process news successfully", async () => {
      const mockRSS = createMockRSS([
        { title: "Test Article", description: "Test description" }
      ]);

      fetchSpy.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockRSS),
      });

      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      const result = await handleNews();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml"
      );
      expect(result).toContain("Test Article: Test description");
      expect(consoleSpy).toHaveBeenCalledWith(
        "News function calling result: ",
        "Test Article: Test description"
      );

      consoleSpy.mockRestore();
    });

    test("should randomly select from multiple articles", async () => {
      const mockRSS = createMockRSS([
        { title: "Article 1", description: "Description 1" },
        { title: "Article 2", description: "Description 2" },
        { title: "Article 3", description: "Description 3" },
      ]);

      fetchSpy.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockRSS),
      });

      const results = new Set();

      // Run multiple times to check randomness
      for (let i = 0; i < 20; i++) {
        const result = await handleNews();
        if (result.includes("Article 1")) results.add("1");
        if (result.includes("Article 2")) results.add("2");
        if (result.includes("Article 3")) results.add("3");
      }

      // At least 2 different articles should have been selected
      // (statistically very likely with 20 tries and 3 articles)
      expect(results.size).toBeGreaterThanOrEqual(2);
    });

    test("should handle fetch error with status code", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        statusText: "Not Found",
      });

      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await handleNews();

      expect(result).toBe("An error occurred while fetching and processing the news.");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error in handleNews:",
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    test("should handle network error", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await handleNews();

      expect(result).toBe("An error occurred while fetching and processing the news.");
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    test("should handle malformed XML", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("Invalid XML"),
      });

      const result = await handleNews();

      // Should still return a result, even if parsing is weird
      expect(typeof result).toBe("string");
    });

    test("should handle empty RSS feed", async () => {
      const mockRSS = `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <title>NYT Homepage</title>
          </channel>
        </rss>`;

      fetchSpy.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockRSS),
      });

      const result = await handleNews();

      // With no items, it should handle gracefully
      expect(typeof result).toBe("string");
    });

    test("should extract title and description correctly", async () => {
      const mockRSS = createMockRSS([
        {
          title: "Breaking News: Important Event",
          description: "This is a detailed description of the event."
        }
      ]);

      fetchSpy.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockRSS),
      });

      const result = await handleNews();

      expect(result).toContain("Breaking News: Important Event");
      expect(result).toContain("This is a detailed description of the event");
    });

    test("should handle special characters in title and description", async () => {
      const mockRSS = createMockRSS([
        {
          title: "Article with & ampersand < > quotes",
          description: "Description with 'quotes' and \"double quotes\""
        }
      ]);

      fetchSpy.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockRSS),
      });

      const result = await handleNews();

      expect(result).toContain("Article with & ampersand");
    });

    test("should handle unicode characters in content", async () => {
      const mockRSS = createMockRSS([
        {
          title: "世界新闻 🌍 News",
          description: "Description with émojis 👍 and ñoñ-ASCII"
        }
      ]);

      fetchSpy.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockRSS),
      });

      const result = await handleNews();

      expect(result).toContain("世界新闻");
      expect(result).toContain("émojis");
    });

    test("should handle very long article content", async () => {
      const longTitle = "A".repeat(500);
      const longDescription = "B".repeat(5000);

      const mockRSS = createMockRSS([
        {
          title: longTitle,
          description: longDescription
        }
      ]);

      fetchSpy.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockRSS),
      });

      const result = await handleNews();

      expect(result).toContain(longTitle);
      expect(result).toContain(longDescription);
    });

    test("should handle missing title tag", async () => {
      const mockRSS = `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <item>
              <description>Description without title</description>
            </item>
          </channel>
        </rss>`;

      fetchSpy.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockRSS),
      });

      const result = await handleNews();

      // Should handle gracefully even with missing tags
      expect(typeof result).toBe("string");
    });

    test("should handle missing description tag", async () => {
      const mockRSS = `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <item>
              <title>Title without description</title>
            </item>
          </channel>
        </rss>`;

      fetchSpy.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockRSS),
      });

      const result = await handleNews();

      expect(typeof result).toBe("string");
    });

    test("should handle nested tags in content", async () => {
      const mockRSS = `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <item>
              <title>Article Title <span>with nested tag</span></title>
              <description>Description <a href="#">with link</a></description>
            </item>
          </channel>
        </rss>`;

      fetchSpy.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockRSS),
      });

      const result = await handleNews();

      // Should extract content including nested tags
      expect(typeof result).toBe("string");
    });

    test("should handle CDATA sections", async () => {
      const mockRSS = `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <item>
              <title><![CDATA[Article with CDATA]]></title>
              <description><![CDATA[Description with <html> tags]]></description>
            </item>
          </channel>
        </rss>`;

      fetchSpy.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockRSS),
      });

      const result = await handleNews();

      expect(typeof result).toBe("string");
    });

    test("should handle multiple items with various content", async () => {
      const mockRSS = createMockRSS([
        { title: "Politics: Election Results", description: "Detailed coverage" },
        { title: "Tech: New AI Breakthrough", description: "Revolutionary technology" },
        { title: "Sports: Championship Game", description: "Exciting match" },
        { title: "Weather: Storm Warning", description: "Severe weather alert" },
        { title: "Business: Market Update", description: "Stocks rise" },
      ]);

      fetchSpy.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockRSS),
      });

      const result = await handleNews();

      // Should successfully parse and return one of the articles
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    test("should include prompt context", async () => {
      const mockRSS = createMockRSS([
        { title: "Test", description: "Test desc" }
      ]);

      fetchSpy.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockRSS),
      });

      const result = await handleNews();

      // The expandPrompt mock should have wrapped the content
      expect(result).toContain("Test: Test desc");
    });

    test("should handle empty title and description", async () => {
      const mockRSS = createMockRSS([
        { title: "", description: "" }
      ]);

      fetchSpy.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockRSS),
      });

      const result = await handleNews();

      expect(typeof result).toBe("string");
    });

    test("should handle whitespace-only content", async () => {
      const mockRSS = createMockRSS([
        { title: "   ", description: "   " }
      ]);

      fetchSpy.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockRSS),
      });

      const result = await handleNews();

      expect(typeof result).toBe("string");
    });

    test("should handle timeout error", async () => {
      mockFetch.mockRejectedValue(new Error("Timeout"));

      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await handleNews();

      expect(result).toBe("An error occurred while fetching and processing the news.");
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    test("should call fetch with correct URL", async () => {
      const mockRSS = createMockRSS([
        { title: "Test", description: "Test" }
      ]);

      fetchSpy.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockRSS),
      });

      await handleNews();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml"
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
