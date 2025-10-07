import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchWithRetry } from "@/utils/fetchWithRetry";
import { setupMockEnv, mockEnv } from "./mockEnv";

setupMockEnv();

describe("fetchWithRetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should successfully fetch on first attempt", async () => {
    const mockResponse = { data: "success" };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const response = await fetchWithRetry("https://api.test.com", {});
    expect(response.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("should not retry on 400 client errors", async () => {
    const errorBody = JSON.stringify({ error: "Bad request" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => errorBody,
    });

    await expect(fetchWithRetry("https://api.test.com", {})).rejects.toThrow(
      "HTTP error! status: 400"
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("should not retry on 401 unauthorized errors", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: "Unauthorized" }),
    });

    await expect(fetchWithRetry("https://api.test.com", {})).rejects.toThrow(
      "HTTP error! status: 401"
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("should not retry on 404 not found errors", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ error: "Not found" }),
    });

    await expect(fetchWithRetry("https://api.test.com", {})).rejects.toThrow(
      "HTTP error! status: 404"
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("should retry on 500 server errors", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => JSON.stringify({ error: "Internal server error" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => JSON.stringify({ error: "Internal server error" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

    const response = await fetchWithRetry("https://api.test.com", {}, mockEnv.MAX_RETRIES);
    expect(response.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it("should retry on 503 service unavailable errors", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => JSON.stringify({ error: "Service unavailable" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

    const response = await fetchWithRetry("https://api.test.com", {}, mockEnv.MAX_RETRIES);
    expect(response.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("should fail after exhausting retries on server errors", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => JSON.stringify({ error: "Internal server error" }),
    });

    await expect(fetchWithRetry("https://api.test.com", {}, 2)).rejects.toThrow(
      "HTTP error! status: 500"
    );
    expect(global.fetch).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("should retry on network errors", async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

    const response = await fetchWithRetry("https://api.test.com", {}, mockEnv.MAX_RETRIES);
    expect(response.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("should fail after exhausting retries on network errors", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    await expect(fetchWithRetry("https://api.test.com", {}, 2)).rejects.toThrow("Network error");
    expect(global.fetch).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("should include error details in error message", async () => {
    const errorDetails = { error: "Invalid API key", code: "auth_error" };
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify(errorDetails),
    });

    await expect(fetchWithRetry("https://api.test.com", {})).rejects.toThrow(
      `HTTP error! status: 401: ${JSON.stringify(errorDetails)}`
    );
  });

  it("should handle array of URLs by using first URL", async () => {
    const urls = ["https://api1.test.com", "https://api2.test.com"];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });

    await fetchWithRetry(urls, {});
    expect(global.fetch).toHaveBeenCalledWith(urls[0], {});
  });
});
