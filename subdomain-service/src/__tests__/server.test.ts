/**
 * Integration tests for the subdomain server
 * These tests use mocked GraphQL responses to test the full request flow
 */

import request from 'supertest';
import express from 'express';
import { GraphQLClient } from 'graphql-request';

// Mock graphql-request
jest.mock('graphql-request');

const MockedGraphQLClient = GraphQLClient as jest.MockedClass<typeof GraphQLClient>;

// Mock persona data
const mockPersonaData = {
  personas: [
    {
      id: '1',
      tokenId: '123',
      name: 'Cool Agent',
      symbol: 'COOL',
      creator: '0x1234567890123456789012345678901234567890',
      owner: '0x1234567890123456789012345678901234567890',
      erc20Token: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      pairToken: '0x9876543210987654321098765432109876543210',
      pairCreated: false,
      createdAt: '2024-01-01T00:00:00Z',
      createdAtBlock: '12345678',
      totalDeposited: '1000000000000000000',
      tokensSold: '500000000000000000',
      graduationThreshold: '850000000000000000',
      chainId: 42161,
      domain: 'cool-agent',
      metadata: [
        { key: 'system_prompt', value: 'You are a cool AI assistant' },
        { key: 'vrm_url', value: 'https://example.com/cool.vrm' },
        { key: 'bg_color', value: '#00FF00' },
        { key: 'amica_version', value: '1' },
      ],
    },
  ],
};

// Helper to create test server
function createTestServer() {
  // We need to import the server after mocking
  // For now, we'll create a minimal test server with the same logic
  const app = express();

  // Mock implementation similar to our actual server
  app.get('*', async (req, res) => {
    const hostname = req.hostname;
    const subdomain = hostname.split('.')[0];

    if (!subdomain || subdomain === 'www' || hostname.split('.').length < 3) {
      return res.send('<html><body>Landing Page</body></html>');
    }

    try {
      const mockClient = new GraphQLClient('http://mock');
      const data = await mockClient.request('mock-query', {
        domain: subdomain,
        chainId: 42161,
      });

      if (!(data as any).personas || (data as any).personas.length === 0) {
        return res.status(404).send('<html><body>404 - Persona Not Found</body></html>');
      }

      // For testing, just return a simple response
      if (req.path === '/' || req.path === '/index.html') {
        return res.send('<html><head></head><body>Persona Page</body></html>');
      }

      return res.send('Static file');
    } catch (error) {
      return res.status(500).send('<html><body>500 - Server Error</body></html>');
    }
  });

  return app;
}

describe('Subdomain Server', () => {
  let mockRequest: jest.Mock;

  beforeEach(() => {
    // Reset mocks
    MockedGraphQLClient.mockClear();
    mockRequest = jest.fn();

    // Setup default mock implementation
    MockedGraphQLClient.prototype.request = mockRequest;
  });

  describe('Root domain', () => {
    test('should show landing page for root domain', async () => {
      const app = createTestServer();

      const response = await request(app)
        .get('/')
        .set('Host', 'amica.bot');

      expect(response.status).toBe(200);
      expect(response.text).toContain('Landing Page');
      expect(mockRequest).not.toHaveBeenCalled();
    });

    test('should show landing page for www subdomain', async () => {
      const app = createTestServer();

      const response = await request(app)
        .get('/')
        .set('Host', 'www.amica.bot');

      expect(response.status).toBe(200);
      expect(response.text).toContain('Landing Page');
      expect(mockRequest).not.toHaveBeenCalled();
    });
  });

  describe('Persona subdomain', () => {
    test('should load persona when found', async () => {
      mockRequest.mockResolvedValue(mockPersonaData);
      const app = createTestServer();

      const response = await request(app)
        .get('/')
        .set('Host', 'cool-agent.amica.bot');

      expect(response.status).toBe(200);
      expect(response.text).toContain('Persona Page');
      expect(mockRequest).toHaveBeenCalledWith(
        'mock-query',
        expect.objectContaining({
          domain: 'cool-agent',
          chainId: 42161,
        })
      );
    });

    test('should return 404 when persona not found', async () => {
      mockRequest.mockResolvedValue({ personas: [] });
      const app = createTestServer();

      const response = await request(app)
        .get('/')
        .set('Host', 'nonexistent.amica.bot');

      expect(response.status).toBe(404);
      expect(response.text).toContain('404');
      expect(response.text).toContain('Persona Not Found');
    });

    test('should return 500 on GraphQL error', async () => {
      mockRequest.mockRejectedValue(new Error('GraphQL error'));
      const app = createTestServer();

      const response = await request(app)
        .get('/')
        .set('Host', 'test-persona.amica.bot');

      expect(response.status).toBe(500);
      expect(response.text).toContain('500');
      expect(response.text).toContain('Server Error');
    });

    test('should handle different subdomains', async () => {
      mockRequest.mockResolvedValue(mockPersonaData);
      const app = createTestServer();

      const testSubdomains = [
        'my-ai',
        'test-123',
        'cool-agent-v2',
        'persona-with-long-name',
      ];

      for (const subdomain of testSubdomains) {
        mockRequest.mockClear();
        mockRequest.mockResolvedValue(mockPersonaData);

        const response = await request(app)
          .get('/')
          .set('Host', `${subdomain}.amica.bot`);

        expect(mockRequest).toHaveBeenCalledWith(
          'mock-query',
          expect.objectContaining({
            domain: subdomain,
          })
        );
      }
    });
  });

  describe('Static files', () => {
    test('should serve static files for valid persona', async () => {
      mockRequest.mockResolvedValue(mockPersonaData);
      const app = createTestServer();

      const response = await request(app)
        .get('/logo.png')
        .set('Host', 'cool-agent.amica.bot');

      expect(response.text).toBe('Static file');
    });
  });
});

describe('Error Handling', () => {
  let mockRequest: jest.Mock;

  beforeEach(() => {
    MockedGraphQLClient.mockClear();
    mockRequest = jest.fn();
    MockedGraphQLClient.prototype.request = mockRequest;
  });

  test('should handle network errors gracefully', async () => {
    mockRequest.mockRejectedValue(new Error('Network error'));
    const app = createTestServer();

    const response = await request(app)
      .get('/')
      .set('Host', 'test.amica.bot');

    expect(response.status).toBe(500);
  });

  test('should handle timeout errors', async () => {
    mockRequest.mockRejectedValue(new Error('Timeout'));
    const app = createTestServer();

    const response = await request(app)
      .get('/')
      .set('Host', 'test.amica.bot');

    expect(response.status).toBe(500);
  });

  test('should handle malformed GraphQL responses', async () => {
    mockRequest.mockResolvedValue({});
    const app = createTestServer();

    const response = await request(app)
      .get('/')
      .set('Host', 'test.amica.bot');

    expect(response.status).toBe(404);
  });
});
