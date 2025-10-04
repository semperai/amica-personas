import { describe, it, expect } from 'vitest';
import { isDev } from '../src/utils/isDevelopment';
import isDevelopment from '../src/utils/isDevelopment';

describe('isDevelopment', () => {
  it('should export isDev variable', () => {
    expect(typeof isDev).toBe('boolean');
  });

  it('should export isDev as default', () => {
    expect(typeof isDevelopment).toBe('boolean');
  });

  it('should have same value for named and default export', () => {
    expect(isDev).toBe(isDevelopment);
  });

  it('should return false in test environment', () => {
    // In test environment, NODE_ENV is 'test', so isDev should be false
    expect(isDev).toBe(false);
  });
});
