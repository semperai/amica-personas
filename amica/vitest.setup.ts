import '@testing-library/jest-dom/vitest';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Polyfills for Node environment
import { TextEncoder, TextDecoder } from 'util';
import { ReadableStream } from 'stream/web';

// Set up TextEncoder/TextDecoder/ReadableStream
if (!globalThis.TextEncoder) {
  globalThis.TextEncoder = TextEncoder;
}
if (!globalThis.TextDecoder) {
  globalThis.TextDecoder = TextDecoder as typeof global.TextDecoder;
}
if (!globalThis.ReadableStream) {
  globalThis.ReadableStream = ReadableStream as typeof global.ReadableStream;
}

// Use undici for fetch
import { MessageChannel, MessagePort } from 'worker_threads';
if (!globalThis.MessageChannel) {
  globalThis.MessageChannel = MessageChannel as typeof global.MessageChannel;
}
if (!globalThis.MessagePort) {
  globalThis.MessagePort = MessagePort as typeof global.MessagePort;
}

import { fetch, Headers, Request, Response, FormData } from 'undici';
if (!globalThis.fetch) {
  globalThis.fetch = fetch as typeof global.fetch;
  globalThis.Headers = Headers as typeof global.Headers;
  globalThis.Request = Request as typeof global.Request;
  globalThis.Response = Response as typeof global.Response;
  globalThis.FormData = FormData as typeof global.FormData;
}

// Mock scrollIntoView (not available in jsdom)
Element.prototype.scrollIntoView = vi.fn();

// Mock ResizeObserver (not available in jsdom)
globalThis.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Ensure fetch is mockable
// Store original if it exists
if (globalThis.fetch) {
  (globalThis as any).__originalFetch = globalThis.fetch;
}
