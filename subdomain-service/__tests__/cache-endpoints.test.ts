/**
 * Integration tests for cache management endpoints
 */

import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import express, { Request, Response } from 'express';

// Mock persona data
const mockPersonaData = {
  personas: [
    {
      id: '1',
      tokenId: '123',
      name: 'Test Persona',
      symbol: 'TEST',
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
      domain: 'test-persona',
      metadata: [
        { key: 'amica_version', value: '1', updatedAt: '2024-01-01T00:00:00Z' },
      ],
    },
  ],
};

interface CacheEntry {
  data: typeof mockPersonaData;
  timestamp: number;
}

// Helper to create test server with cache endpoints
function createCacheTestServer() {
  const app = express();
  const personaCache = new Map<string, CacheEntry>();
  const CHAIN_ID = 42161;
  const CACHE_TTL_MS = 3600000;

  app.use(express.json());

  // Cache management endpoint - clear cache for a specific persona
  app.post('/api/cache/clear/:subdomain', (req: Request, res: Response) => {
    const { subdomain } = req.params;
    const cacheKey = `${subdomain}:${CHAIN_ID}`;

    if (personaCache.has(cacheKey)) {
      personaCache.delete(cacheKey);
      return res.json({ success: true, message: `Cache cleared for ${subdomain}` });
    } else {
      return res.json({ success: false, message: `No cache entry found for ${subdomain}` });
    }
  });

  // Cache management endpoint - clear all cache
  app.post('/api/cache/clear', (req: Request, res: Response) => {
    const size = personaCache.size;
    personaCache.clear();
    return res.json({ success: true, message: `Cleared ${size} cache entries` });
  });

  // Cache stats endpoint
  app.get('/api/cache/stats', (req: Request, res: Response) => {
    const now = Date.now();
    const stats = {
      totalEntries: personaCache.size,
      entries: Array.from(personaCache.entries()).map(([key, entry]) => ({
        key,
        age: now - entry.timestamp,
        expired: (now - entry.timestamp) >= CACHE_TTL_MS,
      })),
    };
    return res.json(stats);
  });

  // Helper endpoint to seed cache for testing
  app.post('/test/seed-cache', (req: Request, res: Response) => {
    const { subdomain, timestamp } = req.body;
    const cacheKey = `${subdomain}:${CHAIN_ID}`;
    personaCache.set(cacheKey, {
      data: mockPersonaData,
      timestamp: timestamp || Date.now(),
    });
    res.json({ success: true });
  });

  return app;
}

describe('Cache Management Endpoints', () => {
  describe('POST /api/cache/clear/:subdomain', () => {
    test('should clear cache for specific subdomain', async () => {
      const app = createCacheTestServer();

      // Seed cache
      await request(app)
        .post('/test/seed-cache')
        .send({ subdomain: 'test-persona' });

      // Verify cache has entry
      let stats = await request(app).get('/api/cache/stats');
      expect(stats.body.totalEntries).toBe(1);

      // Clear specific subdomain
      const response = await request(app)
        .post('/api/cache/clear/test-persona');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('test-persona');

      // Verify cache is empty
      stats = await request(app).get('/api/cache/stats');
      expect(stats.body.totalEntries).toBe(0);
    });

    test('should return success=false when subdomain not in cache', async () => {
      const app = createCacheTestServer();

      const response = await request(app)
        .post('/api/cache/clear/nonexistent');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('No cache entry found');
    });

    test('should only clear specified subdomain', async () => {
      const app = createCacheTestServer();

      // Seed multiple cache entries
      await request(app)
        .post('/test/seed-cache')
        .send({ subdomain: 'persona1' });

      await request(app)
        .post('/test/seed-cache')
        .send({ subdomain: 'persona2' });

      // Verify 2 entries
      let stats = await request(app).get('/api/cache/stats');
      expect(stats.body.totalEntries).toBe(2);

      // Clear one entry
      await request(app).post('/api/cache/clear/persona1');

      // Verify only 1 entry remains
      stats = await request(app).get('/api/cache/stats');
      expect(stats.body.totalEntries).toBe(1);
      expect(stats.body.entries[0].key).toBe('persona2:42161');
    });
  });

  describe('POST /api/cache/clear', () => {
    test('should clear all cache entries', async () => {
      const app = createCacheTestServer();

      // Seed multiple entries
      await request(app)
        .post('/test/seed-cache')
        .send({ subdomain: 'persona1' });

      await request(app)
        .post('/test/seed-cache')
        .send({ subdomain: 'persona2' });

      await request(app)
        .post('/test/seed-cache')
        .send({ subdomain: 'persona3' });

      // Verify entries exist
      let stats = await request(app).get('/api/cache/stats');
      expect(stats.body.totalEntries).toBe(3);

      // Clear all
      const response = await request(app).post('/api/cache/clear');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Cleared 3 cache entries');

      // Verify cache is empty
      stats = await request(app).get('/api/cache/stats');
      expect(stats.body.totalEntries).toBe(0);
    });

    test('should handle clearing empty cache', async () => {
      const app = createCacheTestServer();

      const response = await request(app).post('/api/cache/clear');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Cleared 0 cache entries');
    });
  });

  describe('GET /api/cache/stats', () => {
    test('should return empty stats when cache is empty', async () => {
      const app = createCacheTestServer();

      const response = await request(app).get('/api/cache/stats');

      expect(response.status).toBe(200);
      expect(response.body.totalEntries).toBe(0);
      expect(response.body.entries).toEqual([]);
    });

    test('should return cache statistics', async () => {
      const app = createCacheTestServer();

      // Seed cache
      await request(app)
        .post('/test/seed-cache')
        .send({ subdomain: 'persona1' });

      await request(app)
        .post('/test/seed-cache')
        .send({ subdomain: 'persona2' });

      const response = await request(app).get('/api/cache/stats');

      expect(response.status).toBe(200);
      expect(response.body.totalEntries).toBe(2);
      expect(response.body.entries).toHaveLength(2);
      expect(response.body.entries[0]).toHaveProperty('key');
      expect(response.body.entries[0]).toHaveProperty('age');
      expect(response.body.entries[0]).toHaveProperty('expired');
    });

    test('should calculate entry age correctly', async () => {
      const app = createCacheTestServer();
      const pastTimestamp = Date.now() - 5000; // 5 seconds ago

      await request(app)
        .post('/test/seed-cache')
        .send({ subdomain: 'test-persona', timestamp: pastTimestamp });

      const response = await request(app).get('/api/cache/stats');

      expect(response.status).toBe(200);
      expect(response.body.entries[0].age).toBeGreaterThanOrEqual(5000);
      expect(response.body.entries[0].age).toBeLessThan(6000);
    });

    test('should identify expired entries', async () => {
      const app = createCacheTestServer();
      const CACHE_TTL_MS = 3600000; // 1 hour
      const expiredTimestamp = Date.now() - CACHE_TTL_MS - 1000; // Expired

      await request(app)
        .post('/test/seed-cache')
        .send({ subdomain: 'expired-persona', timestamp: expiredTimestamp });

      await request(app)
        .post('/test/seed-cache')
        .send({ subdomain: 'fresh-persona' }); // Recent

      const response = await request(app).get('/api/cache/stats');

      expect(response.status).toBe(200);
      expect(response.body.totalEntries).toBe(2);

      const expiredEntry = response.body.entries.find((e: any) => e.key === 'expired-persona:42161');
      const freshEntry = response.body.entries.find((e: any) => e.key === 'fresh-persona:42161');

      expect(expiredEntry.expired).toBe(true);
      expect(freshEntry.expired).toBe(false);
    });

    test('should include correct cache keys with chain ID', async () => {
      const app = createCacheTestServer();

      await request(app)
        .post('/test/seed-cache')
        .send({ subdomain: 'my-persona' });

      const response = await request(app).get('/api/cache/stats');

      expect(response.status).toBe(200);
      expect(response.body.entries[0].key).toBe('my-persona:42161');
    });
  });

  describe('Cache Endpoint Integration', () => {
    test('should allow sequential operations', async () => {
      const app = createCacheTestServer();

      // Seed cache
      await request(app)
        .post('/test/seed-cache')
        .send({ subdomain: 'persona1' });

      // Check stats
      let stats = await request(app).get('/api/cache/stats');
      expect(stats.body.totalEntries).toBe(1);

      // Clear specific entry
      await request(app).post('/api/cache/clear/persona1');

      // Check stats again
      stats = await request(app).get('/api/cache/stats');
      expect(stats.body.totalEntries).toBe(0);

      // Seed again
      await request(app)
        .post('/test/seed-cache')
        .send({ subdomain: 'persona2' });

      // Clear all
      await request(app).post('/api/cache/clear');

      // Final check
      stats = await request(app).get('/api/cache/stats');
      expect(stats.body.totalEntries).toBe(0);
    });
  });
});
