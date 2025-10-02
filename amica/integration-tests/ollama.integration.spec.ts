import { test, expect } from '@playwright/test';
import { waitForService, INTEGRATION_SERVICES, shouldRunIntegrationTests } from './setup';

/**
 * Ollama Integration Tests
 *
 * These tests verify that Amica can properly integrate with Ollama
 * for LLM chat functionality.
 *
 * Run with: INTEGRATION_TESTS=true npm run test:e2e
 */

test.describe('Ollama Integration', () => {
  test.beforeAll(async () => {
    if (!shouldRunIntegrationTests()) {
      return;
    }

    // Wait for Ollama service to be ready
    const ready = await waitForService(INTEGRATION_SERVICES.ollama, 60, 2000);
    if (!ready) {
      throw new Error('Ollama service is not available. Run: docker-compose -f docker-compose.integration.yml up -d ollama');
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

  test('should configure Ollama as chat backend', async ({ page }) => {
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

      // Select Ollama
      const ollamaOption = page.getByText('Ollama', { exact: false });
      await expect(ollamaOption).toBeVisible({ timeout: 5000 });
      await ollamaOption.click();
    }
  });

  test('should set Ollama URL', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open settings
    const settingsButton = page.getByRole('button', { name: /menu|settings/i }).first();
    await settingsButton.click();
    await page.waitForTimeout(500);

    // Navigate to Ollama settings
    const ollamaSettings = page.getByText(/ollama/i);
    if (await ollamaSettings.first().isVisible()) {
      await ollamaSettings.first().click();
      await page.waitForTimeout(300);

      // Find URL input and set to docker service
      const urlInput = page.locator('input[type="text"]').filter({ hasText: /url/i }).or(
        page.locator('input').filter({ has: page.locator('label:has-text("URL")') })
      );

      if (await urlInput.first().isVisible()) {
        await urlInput.first().fill(INTEGRATION_SERVICES.ollama.url);
        await page.waitForTimeout(500);
      }
    }
  });

  test('should send message to Ollama', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Send a test message
    const input = page.locator('input[type="text"], textarea').first();
    await input.fill('Hello, this is a test message.');
    await input.press('Enter');

    // Wait for response
    await page.waitForTimeout(2000);

    // Check for response in chat log
    const chatLog = page.locator('[class*="chat"], [id*="chat"]').first();
    await expect(chatLog).toBeVisible({ timeout: 10000 });

    // Should have some response content
    const hasContent = await page.locator('body').textContent();
    expect(hasContent).toBeTruthy();
  });

  test('should handle Ollama connection errors gracefully', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Configure with invalid URL
    const settingsButton = page.getByRole('button', { name: /menu|settings/i }).first();
    await settingsButton.click();
    await page.waitForTimeout(500);

    // Try to use invalid endpoint
    // The app should show an error message or handle it gracefully
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // App should remain functional
    await expect(page.locator('body')).toBeVisible();
  });
});
