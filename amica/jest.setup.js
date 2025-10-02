require('@testing-library/jest-dom');

// Polyfills for Node environment
const { TextEncoder, TextDecoder } = require('util');
const { ReadableStream } = require('stream/web');

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.ReadableStream = ReadableStream;

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
