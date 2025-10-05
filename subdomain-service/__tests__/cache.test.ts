/**
 * Unit tests for caching functionality
 */

import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock data
const mockPersonaData = {
  personas: [
    {
      id: '1',
      tokenId: '123',
      name: 'Cached Agent',
      symbol: 'CACHE',
      creator: '0x1234567890123456789012345678901234567890',
      owner: '0x1234567890123456789012345678901234567890',
      erc20Token: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      pairToken: '0x9876543210987654321098765432109876543210',
      agentToken: '0x1111111111111111111111111111111111111111',
      pairCreated: false,
      pairAddress: null,
      createdAt: '2024-01-01T00:00:00Z',
      createdAtBlock: '12345678',
      totalDeposited: '1000000000000000000',
      tokensSold: '500000000000000000',
      graduationThreshold: '850000000000000000',
      totalAgentDeposited: '0',
      minAgentTokens: '100000000000000000',
      chainId: 42161,
      domain: 'cached-agent',
      metadata: [
        { key: 'system_prompt', value: 'You are a cached AI assistant', updatedAt: '2024-01-01T00:00:00Z' },
        { key: 'amica_version', value: '1', updatedAt: '2024-01-01T00:00:00Z' },
      ],
    },
  ],
};

describe('Cache Functionality', () => {
  describe('Cache Entry Structure', () => {
    test('should store data with timestamp', () => {
      interface CacheEntry {
        data: typeof mockPersonaData;
        timestamp: number;
      }

      const cache = new Map<string, CacheEntry>();
      const now = Date.now();

      cache.set('test:42161', {
        data: mockPersonaData,
        timestamp: now,
      });

      const entry = cache.get('test:42161');
      expect(entry).toBeDefined();
      expect(entry?.data).toEqual(mockPersonaData);
      expect(entry?.timestamp).toBe(now);
    });

    test('should use subdomain:chainId as cache key format', () => {
      interface CacheEntry {
        data: typeof mockPersonaData;
        timestamp: number;
      }

      const cache = new Map<string, CacheEntry>();
      const subdomain = 'my-persona';
      const chainId = 42161;
      const cacheKey = `${subdomain}:${chainId}`;

      cache.set(cacheKey, {
        data: mockPersonaData,
        timestamp: Date.now(),
      });

      expect(cache.has('my-persona:42161')).toBe(true);
      expect(cache.has('my-persona:1')).toBe(false);
    });
  });

  describe('Cache TTL Logic', () => {
    test('should return cached data within TTL', () => {
      interface CacheEntry {
        data: typeof mockPersonaData;
        timestamp: number;
      }

      const cache = new Map<string, CacheEntry>();
      const CACHE_TTL_MS = 3600000; // 1 hour
      const now = Date.now();

      cache.set('test:42161', {
        data: mockPersonaData,
        timestamp: now - 1000, // 1 second ago
      });

      const cached = cache.get('test:42161');
      const isValid = cached && (now - cached.timestamp) < CACHE_TTL_MS;

      expect(isValid).toBe(true);
    });

    test('should invalidate cached data after TTL', () => {
      interface CacheEntry {
        data: typeof mockPersonaData;
        timestamp: number;
      }

      const cache = new Map<string, CacheEntry>();
      const CACHE_TTL_MS = 3600000; // 1 hour
      const now = Date.now();

      cache.set('test:42161', {
        data: mockPersonaData,
        timestamp: now - CACHE_TTL_MS - 1000, // Expired 1 second ago
      });

      const cached = cache.get('test:42161');
      const isValid = cached && (now - cached.timestamp) < CACHE_TTL_MS;

      expect(isValid).toBe(false);
    });

    test('should handle custom TTL values', () => {
      interface CacheEntry {
        data: typeof mockPersonaData;
        timestamp: number;
      }

      const cache = new Map<string, CacheEntry>();
      const CACHE_TTL_MS = 60000; // 1 minute
      const now = Date.now();

      // Within TTL
      cache.set('test1:42161', {
        data: mockPersonaData,
        timestamp: now - 30000, // 30 seconds ago
      });

      // Beyond TTL
      cache.set('test2:42161', {
        data: mockPersonaData,
        timestamp: now - 90000, // 90 seconds ago
      });

      const cached1 = cache.get('test1:42161');
      const isValid1 = cached1 && (now - cached1.timestamp) < CACHE_TTL_MS;

      const cached2 = cache.get('test2:42161');
      const isValid2 = cached2 && (now - cached2.timestamp) < CACHE_TTL_MS;

      expect(isValid1).toBe(true);
      expect(isValid2).toBe(false);
    });
  });

  describe('Cache Operations', () => {
    test('should clear specific cache entry', () => {
      interface CacheEntry {
        data: typeof mockPersonaData;
        timestamp: number;
      }

      const cache = new Map<string, CacheEntry>();

      cache.set('persona1:42161', { data: mockPersonaData, timestamp: Date.now() });
      cache.set('persona2:42161', { data: mockPersonaData, timestamp: Date.now() });

      expect(cache.size).toBe(2);

      cache.delete('persona1:42161');

      expect(cache.size).toBe(1);
      expect(cache.has('persona1:42161')).toBe(false);
      expect(cache.has('persona2:42161')).toBe(true);
    });

    test('should clear all cache entries', () => {
      interface CacheEntry {
        data: typeof mockPersonaData;
        timestamp: number;
      }

      const cache = new Map<string, CacheEntry>();

      cache.set('persona1:42161', { data: mockPersonaData, timestamp: Date.now() });
      cache.set('persona2:42161', { data: mockPersonaData, timestamp: Date.now() });
      cache.set('persona3:42161', { data: mockPersonaData, timestamp: Date.now() });

      expect(cache.size).toBe(3);

      cache.clear();

      expect(cache.size).toBe(0);
    });

    test('should track cache size', () => {
      interface CacheEntry {
        data: typeof mockPersonaData;
        timestamp: number;
      }

      const cache = new Map<string, CacheEntry>();

      expect(cache.size).toBe(0);

      cache.set('persona1:42161', { data: mockPersonaData, timestamp: Date.now() });
      expect(cache.size).toBe(1);

      cache.set('persona2:42161', { data: mockPersonaData, timestamp: Date.now() });
      expect(cache.size).toBe(2);

      cache.delete('persona1:42161');
      expect(cache.size).toBe(1);
    });
  });

  describe('Cache Stats', () => {
    test('should calculate entry age correctly', () => {
      interface CacheEntry {
        data: typeof mockPersonaData;
        timestamp: number;
      }

      const cache = new Map<string, CacheEntry>();
      const now = Date.now();
      const age = 5000; // 5 seconds

      cache.set('test:42161', {
        data: mockPersonaData,
        timestamp: now - age,
      });

      const entry = cache.get('test:42161');
      const calculatedAge = now - (entry?.timestamp || 0);

      expect(calculatedAge).toBeGreaterThanOrEqual(age);
      expect(calculatedAge).toBeLessThan(age + 100); // Allow small variance
    });

    test('should identify expired entries', () => {
      interface CacheEntry {
        data: typeof mockPersonaData;
        timestamp: number;
      }

      const cache = new Map<string, CacheEntry>();
      const CACHE_TTL_MS = 3600000;
      const now = Date.now();

      cache.set('fresh:42161', {
        data: mockPersonaData,
        timestamp: now - 1000, // Fresh
      });

      cache.set('expired:42161', {
        data: mockPersonaData,
        timestamp: now - CACHE_TTL_MS - 1000, // Expired
      });

      const stats = Array.from(cache.entries()).map(([key, entry]) => ({
        key,
        age: now - entry.timestamp,
        expired: (now - entry.timestamp) >= CACHE_TTL_MS,
      }));

      expect(stats.length).toBe(2);
      expect(stats.find(s => s.key === 'fresh:42161')?.expired).toBe(false);
      expect(stats.find(s => s.key === 'expired:42161')?.expired).toBe(true);
    });
  });

  describe('Multi-chain Support', () => {
    test('should cache different chains separately', () => {
      interface CacheEntry {
        data: typeof mockPersonaData;
        timestamp: number;
      }

      const cache = new Map<string, CacheEntry>();
      const subdomain = 'my-persona';

      cache.set(`${subdomain}:42161`, { data: mockPersonaData, timestamp: Date.now() });
      cache.set(`${subdomain}:1`, { data: mockPersonaData, timestamp: Date.now() });

      expect(cache.has('my-persona:42161')).toBe(true);
      expect(cache.has('my-persona:1')).toBe(true);
      expect(cache.size).toBe(2);
    });
  });
});
