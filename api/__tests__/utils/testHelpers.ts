import type { Request, Response } from "express";
import { vi } from "vitest";

export function createMockRequest(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    headers: {},
    body: {},
    params: {},
    query: {},
    ip: "127.0.0.1",
    id: "test-request-id",
    ...overrides,
  };
}

export function createMockResponse(): Partial<Response> {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    writeHead: vi.fn().mockReturnThis(),
    write: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
    header: vi.fn().mockReturnThis(),
    locals: {},
  };
  return res;
}

export function createMockStreamResponse() {
  const chunks: string[] = [];
  const res = createMockResponse();

  res.write = vi.fn((chunk: any) => {
    chunks.push(chunk.toString());
    return true;
  });

  return { res, chunks };
}

export function mockFetch(response: any, status = 200, ok = true) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => response,
    text: async () => JSON.stringify(response),
    body: {
      getReader: () => ({
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode("data: " + JSON.stringify(response)) })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      }),
    },
  });
}

export function mockStreamingFetch(chunks: any[]) {
  const encoder = new TextEncoder();
  let index = 0;

  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: vi.fn().mockImplementation(async () => {
          if (index < chunks.length) {
            const chunk = chunks[index++];
            return { done: false, value: encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`) };
          }
          return { done: true, value: undefined };
        }),
      }),
    },
  });
}

export function waitFor(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
