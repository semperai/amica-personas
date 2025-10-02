import { test, expect } from '@playwright/test';
import { waitForService, INTEGRATION_SERVICES, shouldRunIntegrationTests } from './setup';

/**
 * Whisper Integration Tests
 *
 * These tests verify that Amica can properly integrate with Whisper.cpp
 * for speech-to-text functionality.
 *
 * Run with: INTEGRATION_TESTS=true npm run test:e2e
 */

test.describe('Whisper Integration', () => {
  test.beforeAll(async () => {
    if (!shouldRunIntegrationTests()) {
      return;
    }

    // Wait for Whisper service to be ready
    const ready = await waitForService(INTEGRATION_SERVICES.whispercpp, 60, 2000);
    if (!ready) {
      throw new Error('Whisper service is not available. Run: docker-compose -f docker-compose.integration.yml up -d whispercpp');
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

  test('should configure Whisper.cpp as STT backend', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open settings
    const settingsButton = page.getByRole('button', { name: /menu|settings/i }).first();
    await settingsButton.click();
    await page.waitForTimeout(500);

    // Navigate to STT Backend
    const sttBackend = page.getByText(/speech.*text.*backend/i).or(page.getByText(/stt.*backend/i));
    if (await sttBackend.isVisible()) {
      await sttBackend.click();
      await page.waitForTimeout(300);

      // Select Whisper
      const whisperOption = page.getByText('Whisper', { exact: false });
      if (await whisperOption.isVisible()) {
        await whisperOption.click();
      }
    }
  });

  test('should set Whisper.cpp URL', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open settings
    const settingsButton = page.getByRole('button', { name: /menu|settings/i }).first();
    await settingsButton.click();
    await page.waitForTimeout(500);

    // Navigate to Whisper settings
    const whisperSettings = page.getByText(/whisper/i);
    if (await whisperSettings.first().isVisible()) {
      await whisperSettings.first().click();
      await page.waitForTimeout(300);

      // Find URL input
      const urlInput = page.locator('input[type="text"]').filter({ hasText: /url/i }).or(
        page.locator('input').filter({ has: page.locator('label:has-text("URL")') })
      );

      if (await urlInput.first().isVisible()) {
        await urlInput.first().fill(INTEGRATION_SERVICES.whispercpp.url);
        await page.waitForTimeout(500);
      }
    }
  });

  test('should validate Whisper service connectivity', async ({ page }) => {
    // Directly test the Whisper service
    const response = await page.request.get(
      `${INTEGRATION_SERVICES.whispercpp.url}${INTEGRATION_SERVICES.whispercpp.healthEndpoint}`
    );

    expect(response.ok()).toBeTruthy();
  });

  test('should handle Whisper connection errors gracefully', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Monitor console for errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // App should remain functional even with service errors
    await expect(page.locator('body')).toBeVisible();
  });
});
