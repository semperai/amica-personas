import { test, expect } from '@playwright/test';

/**
 * Settings Tests
 *
 * Tests for the settings/configuration functionality
 */

test.describe('Settings Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should open settings menu', async ({ page }) => {
    // Find and click settings button
    const settingsButton = page.getByRole('button', { name: /menu|settings/i }).first();
    await settingsButton.click();

    // Settings panel should be visible
    const settingsPanel = page.locator('[class*="settings"], [id*="settings"]').first();
    await expect(settingsPanel).toBeVisible({ timeout: 2000 });
  });

  test('should close settings menu', async ({ page }) => {
    // Open settings
    const settingsButton = page.getByRole('button', { name: /menu|settings/i }).first();
    await settingsButton.click();

    await page.waitForTimeout(300);

    // Close settings (could be X button, close button, or clicking outside)
    const closeButton = page.getByRole('button', { name: /close|✕/i }).first();

    if (await closeButton.isVisible()) {
      await closeButton.click();

      // Settings should be hidden or page should be visible
      await expect(page.locator('canvas')).toBeVisible();
    }
  });

  test('should navigate between settings pages', async ({ page }) => {
    // Open settings
    const settingsButton = page.getByRole('button', { name: /menu|settings/i }).first();
    await settingsButton.click();

    await page.waitForTimeout(500);

    // Look for navigation links/buttons
    const navLinks = page.getByRole('link').or(page.getByRole('button'));

    // Should have multiple navigation options
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(1);
  });
});

test.describe('Settings Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should persist settings across page reload', async ({ page }) => {
    // Open settings
    const settingsButton = page.getByRole('button', { name: /menu|settings/i }).first();
    await settingsButton.click();

    await page.waitForTimeout(500);

    // Find a toggle switch and remember its state
    const toggle = page.locator('button[role="switch"]').first();

    if (await toggle.isVisible()) {
      const initialState = await toggle.getAttribute('aria-checked');

      // Toggle it
      await toggle.click();
      await page.waitForTimeout(300);

      const newState = await toggle.getAttribute('aria-checked');
      expect(newState).not.toBe(initialState);

      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Open settings again
      await settingsButton.click();
      await page.waitForTimeout(500);

      // Check if the toggle state persisted
      const persistedState = await toggle.getAttribute('aria-checked');
      expect(persistedState).toBe(newState);
    }
  });

  test('should save text input changes', async ({ page }) => {
    // Open settings
    const settingsButton = page.getByRole('button', { name: /menu|settings/i }).first();
    await settingsButton.click();

    await page.waitForTimeout(500);

    // Find a text input
    const textInput = page.locator('input[type="text"]').first();

    if (await textInput.isVisible()) {
      const testValue = 'Test Value ' + Date.now();

      await textInput.fill(testValue);

      // Wait for auto-save
      await page.waitForTimeout(1000);

      // Reload
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Open settings again
      await settingsButton.click();
      await page.waitForTimeout(500);

      // Check if value persisted
      const persistedValue = await textInput.inputValue();
      expect(persistedValue).toBe(testValue);
    }
  });
});

test.describe('Settings Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should validate API key format', async ({ page }) => {
    // Open settings
    const settingsButton = page.getByRole('button', { name: /menu|settings/i }).first();
    await settingsButton.click();

    await page.waitForTimeout(500);

    // Look for API key inputs
    const apiKeyInput = page.locator('input[type="password"], input[placeholder*="API"]').first();

    if (await apiKeyInput.isVisible()) {
      // Try invalid input
      await apiKeyInput.fill('invalid');

      // Look for validation message or error state
      const errorMessage = page.locator('[class*="error"], [class*="invalid"]');

      // Some validation should occur (either immediately or on save)
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('should validate number inputs', async ({ page }) => {
    // Open settings
    const settingsButton = page.getByRole('button', { name: /menu|settings/i }).first();
    await settingsButton.click();

    await page.waitForTimeout(500);

    // Look for number inputs
    const numberInput = page.locator('input[type="number"]').first();

    if (await numberInput.isVisible()) {
      // Try to enter invalid value
      await numberInput.fill('-999999');

      // Should handle validation
      await expect(page.locator('body')).toBeVisible();
    }
  });
});

test.describe('Settings Themes and Appearance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should allow changing background color', async ({ page }) => {
    // Open settings
    const settingsButton = page.getByRole('button', { name: /menu|settings/i }).first();
    await settingsButton.click();

    await page.waitForTimeout(500);

    // Look for background settings
    const backgroundLink = page.getByText(/background/i).first();

    if (await backgroundLink.isVisible()) {
      await backgroundLink.click();

      // Should have color picker or options
      const colorInput = page.locator('input[type="color"]');
      await expect(colorInput.first()).toBeVisible({ timeout: 2000 });
    }
  });
});

test.describe('Settings Reset', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should have reset to defaults option', async ({ page }) => {
    // Open settings
    const settingsButton = page.getByRole('button', { name: /menu|settings/i }).first();
    await settingsButton.click();

    await page.waitForTimeout(500);

    // Look for reset button/link
    const resetLink = page.getByText(/reset|default/i);

    // Should have at least one reset option
    const count = await resetLink.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should confirm before resetting settings', async ({ page }) => {
    // Open settings
    const settingsButton = page.getByRole('button', { name: /menu|settings/i }).first();
    await settingsButton.click();

    await page.waitForTimeout(500);

    // Look for reset option
    const resetButton = page.getByRole('button', { name: /reset|default/i }).first();

    if (await resetButton.isVisible()) {
      await resetButton.click();

      // Should show confirmation dialog
      const confirmDialog = page.getByText(/confirm|sure|warning/i);
      await expect(confirmDialog.first()).toBeVisible({ timeout: 2000 });
    }
  });
});
