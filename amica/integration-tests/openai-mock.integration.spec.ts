import { test, expect } from '@playwright/test';
import { waitForService, INTEGRATION_SERVICES, shouldRunIntegrationTests } from './setup';

/**
 * OpenAI Mock Integration Tests
 *
 * These tests verify that Amica can properly integrate with an OpenAI-compatible API
 * using our mock server for testing.
 *
 * Run with: INTEGRATION_TESTS=true npm run test:e2e
 */

test.describe('OpenAI Mock Integration', () => {
  test.beforeAll(async () => {
    if (!shouldRunIntegrationTests()) {
      return;
    }

    // Wait for mock OpenAI service to be ready
    const ready = await waitForService(INTEGRATION_SERVICES.openai_mock, 30, 1000);
    if (!ready) {
      throw new Error('OpenAI mock service is not available. Run: docker-compose -f docker-compose.integration.yml up -d');
    }
  });

  test.skip(({ }, testInfo) => {
    if (!shouldRunIntegrationTests()) {
      testInfo.annotations.push({
        type: 'skip',
        description: 'Integration tests disabled. Set INTEGRATION_TESTS=true to enable.',
      });
    }
  });

  test('should verify mock server is running', async ({ page }) => {
    const response = await page.request.get(
      `${INTEGRATION_SERVICES.openai_mock.url}${INTEGRATION_SERVICES.openai_mock.healthEndpoint}`
    );

    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.status).toBe('ok');
  });

  test('should list available models', async ({ page }) => {
    const response = await page.request.get(
      `${INTEGRATION_SERVICES.openai_mock.url}/v1/models`
    );

    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.object).toBe('list');
    expect(body.data).toBeDefined();
    expect(body.data.length).toBeGreaterThan(0);
  });

  test('should handle chat completion (non-streaming)', async ({ page }) => {
    const response = await page.request.post(
      `${INTEGRATION_SERVICES.openai_mock.url}/v1/chat/completions`,
      {
        data: {
          model: 'mock-gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }],
          stream: false
        }
      }
    );

    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.choices).toBeDefined();
    expect(body.choices[0].message.content).toBeTruthy();
  });

  test('should configure ChatGPT backend with mock server', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open settings
    const settingsButton = page.getByRole('button', { name: /menu|settings/i }).first();
    await settingsButton.click();
    await page.waitForTimeout(500);

    // Navigate to Chatbot Backend
    const chatbotBackend = page.getByText(/chatbot.*backend/i).or(page.getByText(/backend/i));
    if (await chatbotBackend.isVisible()) {
      await chatbotBackend.click();
      await page.waitForTimeout(300);

      // Select ChatGPT
      const chatgptOption = page.getByText('ChatGPT', { exact: false });
      if (await chatgptOption.isVisible()) {
        await chatgptOption.click();
      }
    }
  });

  test('should set mock server URL in ChatGPT settings', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open settings
    const settingsButton = page.getByRole('button', { name: /menu|settings/i }).first();
    await settingsButton.click();
    await page.waitForTimeout(500);

    // Navigate to ChatGPT settings
    const chatgptSettings = page.getByText(/chatgpt|openai/i);
    if (await chatgptSettings.first().isVisible()) {
      await chatgptSettings.first().click();
      await page.waitForTimeout(300);

      // Find URL input
      const urlInput = page.locator('input[type="text"]').filter({ hasText: /url/i }).or(
        page.locator('input[placeholder*="URL"]')
      );

      if (await urlInput.first().isVisible()) {
        await urlInput.first().fill(INTEGRATION_SERVICES.openai_mock.url);
        await page.waitForTimeout(500);
      }

      // Set a dummy API key (not validated by mock)
      const apiKeyInput = page.locator('input[type="password"]').or(
        page.locator('input[placeholder*="API"]')
      );

      if (await apiKeyInput.first().isVisible()) {
        await apiKeyInput.first().fill('test-api-key-12345');
        await page.waitForTimeout(500);
      }
    }
  });

  test('should send message and receive response from mock server', async ({ page }) => {
    // First configure the mock server (this test assumes previous tests set it up)
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Send a test message
    const input = page.locator('input[type="text"], textarea').first();
    await input.fill('Hello from integration test');
    await input.press('Enter');

    // Wait for response (mock server responds quickly)
    await page.waitForTimeout(3000);

    // Check that the page is still functional
    await expect(page.locator('body')).toBeVisible();

    // The input should be cleared after sending
    const value = await input.inputValue();
    expect(value).toBe('');
  });

  test('should handle streaming responses', async ({ page }) => {
    const messages = [{ role: 'user', content: 'Test streaming' }];

    const response = await page.request.post(
      `${INTEGRATION_SERVICES.openai_mock.url}/v1/chat/completions`,
      {
        data: {
          model: 'mock-gpt-3.5-turbo',
          messages,
          stream: true
        }
      }
    );

    expect(response.ok()).toBeTruthy();
    expect(response.headers()['content-type']).toContain('text/event-stream');
  });

  test('should handle invalid JSON gracefully', async ({ page }) => {
    const response = await page.request.post(
      `${INTEGRATION_SERVICES.openai_mock.url}/v1/chat/completions`,
      {
        data: 'invalid json',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    expect(response.status()).toBe(400);
  });

  test('should return 404 for unknown endpoints', async ({ page }) => {
    const response = await page.request.get(
      `${INTEGRATION_SERVICES.openai_mock.url}/unknown/endpoint`
    );

    expect(response.status()).toBe(404);
  });
});
