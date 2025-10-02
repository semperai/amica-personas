import { test, expect } from '@playwright/test';

/**
 * Smoke Tests
 *
 * Basic tests to ensure the application loads and core functionality works
 */

test.describe('Application Smoke Tests', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/');

    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Check that the page title is set
    await expect(page).toHaveTitle(/Amica/i);
  });

  test('should display the VRM viewer', async ({ page }) => {
    await page.goto('/');

    // Wait for canvas element (3D viewer)
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 10000 });
  });

  test('should have a settings button', async ({ page }) => {
    await page.goto('/');

    // Look for settings/menu button
    const settingsButton = page.getByRole('button', { name: /menu|settings/i });
    await expect(settingsButton).toBeVisible();
  });

  test('should load without console errors', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Allow some benign errors but check for critical ones
    const criticalErrors = consoleErrors.filter(
      (error) => !error.includes('ResizeObserver') && !error.includes('favicon')
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('should be responsive', async ({ page }) => {
    await page.goto('/');

    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('body')).toBeVisible();

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('body')).toBeVisible();

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('body')).toBeVisible();
  });
});
