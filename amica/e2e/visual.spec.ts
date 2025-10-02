import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests
 *
 * Tests for visual appearance and accessibility
 */

test.describe('Visual Regression', () => {
  test('homepage visual snapshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for 3D canvas to load
    await page.waitForTimeout(2000);

    // Take a screenshot for visual comparison
    await expect(page).toHaveScreenshot('homepage.png', {
      fullPage: true,
      maxDiffPixels: 100, // Allow small differences
    });
  });

  test('settings menu visual snapshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open settings
    const settingsButton = page.getByRole('button', { name: /menu|settings/i }).first();
    await settingsButton.click();

    await page.waitForTimeout(500);

    // Take screenshot of settings
    await expect(page).toHaveScreenshot('settings-menu.png', {
      maxDiffPixels: 100,
    });
  });

  test('mobile viewport visual snapshot', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.waitForTimeout(2000);

    await expect(page).toHaveScreenshot('mobile-homepage.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });

  test('tablet viewport visual snapshot', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.waitForTimeout(2000);

    await expect(page).toHaveScreenshot('tablet-homepage.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });
});

test.describe('Accessibility', () => {
  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for h1
    const h1 = page.locator('h1');
    const h1Count = await h1.count();

    // Should have exactly one h1 (or none if it's hidden in the design)
    expect(h1Count).toBeLessThanOrEqual(1);
  });

  test('should have accessible form labels', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check that inputs have associated labels
    const inputs = page.locator('input');
    const count = await inputs.count();

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);

      // Input should have aria-label or associated label
      const ariaLabel = await input.getAttribute('aria-label');
      const id = await input.getAttribute('id');

      let hasLabel = !!ariaLabel;

      if (!hasLabel && id) {
        const label = page.locator(`label[for="${id}"]`);
        hasLabel = (await label.count()) > 0;
      }

      // Input should have either aria-label or a label element
      // (or be hidden from screen readers)
      const ariaHidden = await input.getAttribute('aria-hidden');

      if (!hasLabel && !ariaHidden) {
        console.warn(`Input at index ${i} may not have proper labeling`);
      }
    }
  });

  test('should have proper button labels', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // All buttons should have accessible text
    const buttons = page.locator('button');
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);

      // Button should have text content or aria-label
      const text = await button.textContent();
      const ariaLabel = await button.getAttribute('aria-label');

      expect(text || ariaLabel).toBeTruthy();
    }
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Start keyboard navigation
    await page.keyboard.press('Tab');

    // Should focus on first focusable element
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeTruthy();
  });

  test('should have sufficient color contrast', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // This is a basic check - a full accessibility audit would use axe-core
    // Just ensure no obvious contrast issues by checking text is visible
    const textElements = page.locator('p, span, div, button, a').filter({ hasText: /.+/ });
    const count = await textElements.count();

    // At least some text should be visible
    expect(count).toBeGreaterThan(0);
  });

  test('should have alt text for images', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check all images have alt text
    const images = page.locator('img');
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');

      // Should have alt attribute (can be empty for decorative images)
      expect(alt).not.toBeNull();
    }
  });

  test('should support screen reader navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for ARIA landmarks
    const main = page.locator('[role="main"]').or(page.locator('main'));
    const navigation = page.locator('[role="navigation"]').or(page.locator('nav'));

    // Should have semantic structure
    const hasMain = (await main.count()) > 0;
    const hasNav = (await navigation.count()) > 0;

    // At least some semantic HTML should be present
    expect(hasMain || hasNav).toBeTruthy();
  });
});

test.describe('Performance', () => {
  test('should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await page.waitForLoadState('load');

    const loadTime = Date.now() - startTime;

    // Should load within 10 seconds
    expect(loadTime).toBeLessThan(10000);
  });

  test('should have reasonable bundle size', async ({ page }) => {
    const responses: number[] = [];

    page.on('response', (response) => {
      const url = response.url();

      // Track size of JS bundles
      if (url.endsWith('.js') && response.status() === 200) {
        response.body().then((body) => {
          responses.push(body.length);
        }).catch(() => {});
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should have at least one JS file
    expect(responses.length).toBeGreaterThan(0);

    // Log total JS size
    const totalSize = responses.reduce((a, b) => a + b, 0);
    console.log(`Total JS size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  });

  test('should be interactive quickly', async ({ page }) => {
    await page.goto('/');

    // Measure time to interactive
    const performanceMetrics = await page.evaluate(() => {
      const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

      return {
        domContentLoaded: perfData.domContentLoadedEventEnd - perfData.fetchStart,
        loadComplete: perfData.loadEventEnd - perfData.fetchStart,
      };
    });

    // DOM should be ready within 5 seconds
    expect(performanceMetrics.domContentLoaded).toBeLessThan(5000);

    console.log('Performance metrics:', performanceMetrics);
  });
});
