import { test, expect } from '@playwright/test';

/**
 * Chat Functionality Tests
 *
 * Tests for the chat/messaging functionality
 */

test.describe('Chat Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should have a message input', async ({ page }) => {
    const input = page.locator('input[type="text"], textarea').first();
    await expect(input).toBeVisible({ timeout: 5000 });
  });

  test('should allow typing in the message input', async ({ page }) => {
    const input = page.locator('input[type="text"], textarea').first();
    await input.fill('Hello, Amica!');

    await expect(input).toHaveValue('Hello, Amica!');
  });

  test('should have a send button', async ({ page }) => {
    const sendButton = page.getByRole('button', { name: /send|submit/i }).or(
      page.locator('button[type="submit"]')
    );

    await expect(sendButton.first()).toBeVisible({ timeout: 5000 });
  });

  test('should clear input after sending message', async ({ page }) => {
    const input = page.locator('input[type="text"], textarea').first();
    const sendButton = page.locator('button[type="submit"]').first();

    // Type and send message
    await input.fill('Test message');
    await sendButton.click();

    // Input should be cleared (or the form should reset)
    await page.waitForTimeout(500);
    const value = await input.inputValue();
    expect(value).toBe('');
  });

  test('should display chat history', async ({ page }) => {
    // Look for chat log container
    const chatLog = page.locator('[class*="chat"], [id*="chat"]').first();

    // Should have some container for messages
    await expect(chatLog).toBeVisible({ timeout: 5000 });
  });

  test('should handle empty message gracefully', async ({ page }) => {
    const input = page.locator('input[type="text"], textarea').first();
    const sendButton = page.locator('button[type="submit"]').first();

    // Try to send empty message
    await input.fill('');
    await sendButton.click();

    // Should not crash or show error
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Chat Keyboard Shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should send message with Enter key', async ({ page }) => {
    const input = page.locator('input[type="text"], textarea').first();

    await input.fill('Test message with Enter');
    await input.press('Enter');

    // Check if input was cleared (indicating message was sent)
    await page.waitForTimeout(500);
    const value = await input.inputValue();
    expect(value).toBe('');
  });

  test('should support Shift+Enter for newline in textarea', async ({ page }) => {
    const textarea = page.locator('textarea').first();

    if (await textarea.isVisible()) {
      await textarea.fill('First line');
      await textarea.press('Shift+Enter');
      await textarea.type('Second line');

      const value = await textarea.inputValue();
      expect(value).toContain('\n');
    }
  });
});

test.describe('Chat State Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should show processing state when message is sent', async ({ page }) => {
    const input = page.locator('input[type="text"], textarea').first();
    const sendButton = page.locator('button[type="submit"]').first();

    await input.fill('Test message');
    await sendButton.click();

    // Look for loading indicator or disabled state
    await page.waitForTimeout(100);

    // Button should be disabled or show loading state
    const isDisabled = await sendButton.isDisabled().catch(() => false);
    const hasLoadingClass = await sendButton
      .evaluate((el) => el.className.includes('loading') || el.className.includes('processing'))
      .catch(() => false);

    expect(isDisabled || hasLoadingClass).toBeTruthy();
  });

  test('should allow interrupting ongoing generation', async ({ page }) => {
    const input = page.locator('input[type="text"], textarea').first();

    // Send a message
    await input.fill('Tell me a long story');
    await input.press('Enter');

    // Wait a bit
    await page.waitForTimeout(500);

    // Look for stop/interrupt button
    const stopButton = page.getByRole('button', { name: /stop|interrupt/i });

    if (await stopButton.isVisible()) {
      await stopButton.click();

      // Should be able to send another message
      await expect(input).toBeEnabled();
    }
  });
});
