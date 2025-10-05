import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Config URL Override', () => {
  beforeEach(() => {
    // Reset modules before each test to get fresh config
    vi.resetModules();
  });

  it('should parse URL parameters and override config', async () => {
    // Mock window.location with URL parameters
    const mockUrl = 'http://localhost:5173/?vrm_url=/vrm/custom.vrm&bg_color=%23ffffff&name=TestAmica';
    Object.defineProperty(window, 'location', {
      value: {
        search: new URL(mockUrl).search,
      },
      writable: true,
    });

    // Mock fetch to return empty config
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    // Import config module fresh
    const { loadConfig, config } = await import('@/utils/config');

    // Load config which should parse URL parameters
    await loadConfig();

    // Check that URL parameters override defaults
    expect(config('vrm_url')).toBe('/vrm/custom.vrm');
    expect(config('bg_color')).toBe('#ffffff');
    expect(config('name')).toBe('TestAmica');
  });

  it('should ignore URL parameters that are not valid config keys', async () => {
    // Mock window.location with invalid URL parameters
    const mockUrl = 'http://localhost:5173/?invalid_key=test&vrm_url=/vrm/test.vrm';
    Object.defineProperty(window, 'location', {
      value: {
        search: new URL(mockUrl).search,
      },
      writable: true,
    });

    // Mock fetch to return empty config
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    // Import config module fresh
    const { loadConfig, config } = await import('@/utils/config');

    // Load config
    await loadConfig();

    // Valid key should be overridden
    expect(config('vrm_url')).toBe('/vrm/test.vrm');

    // Invalid key should not be accessible
    expect(() => config('invalid_key')).toThrow();
  });

  it('should prioritize URL parameters over /config endpoint', async () => {
    // Mock window.location with URL parameter
    const mockUrl = 'http://localhost:5173/?name=URLOverride';
    Object.defineProperty(window, 'location', {
      value: {
        search: new URL(mockUrl).search,
      },
      writable: true,
    });

    // Mock fetch to return config with different name
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        metadata: {
          name: 'ConfigEndpointName',
        },
      }),
    });

    // Import config module fresh
    const { loadConfig, config } = await import('@/utils/config');

    // Load config
    await loadConfig();

    // URL parameter should take precedence
    expect(config('name')).toBe('URLOverride');
  });

  it('should handle URL encoded values', async () => {
    // Mock window.location with URL encoded parameters
    const mockUrl = 'http://localhost:5173/?system_prompt=Hello%20World%21&bg_color=%23ff0000';
    Object.defineProperty(window, 'location', {
      value: {
        search: new URL(mockUrl).search,
      },
      writable: true,
    });

    // Mock fetch to return empty config
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    // Import config module fresh
    const { loadConfig, config } = await import('@/utils/config');

    // Load config
    await loadConfig();

    // URL encoded values should be properly decoded
    expect(config('system_prompt')).toBe('Hello World!');
    expect(config('bg_color')).toBe('#ff0000');
  });
});
