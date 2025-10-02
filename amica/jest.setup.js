require('@testing-library/jest-dom');

// Polyfills for Node environment
const util = require('util');
const { ReadableStream } = require('stream/web');

// Set up TextEncoder/TextDecoder/ReadableStream
if (!global.TextEncoder) {
  global.TextEncoder = util.TextEncoder;
  globalThis.TextEncoder = util.TextEncoder;
}
if (!global.TextDecoder) {
  global.TextDecoder = util.TextDecoder;
  globalThis.TextDecoder = util.TextDecoder;
}
if (!global.ReadableStream) {
  global.ReadableStream = ReadableStream;
  globalThis.ReadableStream = ReadableStream;
}

// Use undici for fetch (Node.js built-in in 18+)
// We need to require undici after setting up the polyfills it needs
const { MessageChannel, MessagePort } = require('worker_threads');
if (!global.MessageChannel) {
  global.MessageChannel = MessageChannel;
  globalThis.MessageChannel = MessageChannel;
}
if (!global.MessagePort) {
  global.MessagePort = MessagePort;
  globalThis.MessagePort = MessagePort;
}

const { fetch, Headers, Request, Response, FormData } = require('undici');
if (!global.fetch) {
  global.fetch = fetch;
  global.Headers = Headers;
  global.Request = Request;
  global.Response = Response;
  global.FormData = FormData;
}

// Mock clearImmediate for jsdom compatibility with undici
if (!global.clearImmediate && typeof setImmediate !== 'undefined') {
  global.clearImmediate = clearImmediate;
}

// Mock scrollIntoView (not available in jsdom)
Element.prototype.scrollIntoView = jest.fn();

// Mock ResizeObserver (not available in jsdom)
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Ensure fetch is mockable (jsdom might have it, but we want to allow tests to mock it)
// Store original if it exists
if (global.fetch) {
  global.__originalFetch = global.fetch;
}
