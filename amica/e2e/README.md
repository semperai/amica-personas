# E2E Testing with Playwright

## Overview

End-to-end tests for Amica using Playwright. These tests verify the application works correctly from a user's perspective.

## Test Suites

### 1. Smoke Tests (`smoke.spec.ts`)
Basic tests to ensure the application loads and core functionality works:
- ✅ Application loads without errors
- ✅ 3D viewer renders
- ✅ UI elements are visible
- ✅ Responsive design works

### 2. Chat Tests (`chat.spec.ts`)
Tests for messaging and chat functionality:
- ✅ Message input and sending
- ✅ Chat history display
- ✅ Keyboard shortcuts (Enter to send, Shift+Enter for newline)
- ✅ Processing states
- ✅ Interruption handling

### 3. Settings Tests (`settings.spec.ts`)
Tests for configuration and settings:
- ✅ Settings menu navigation
- ✅ Settings persistence across reloads
- ✅ Input validation
- ✅ Theme and appearance settings
- ✅ Reset to defaults

### 4. Visual & Accessibility Tests (`visual.spec.ts`)
Visual regression and accessibility tests:
- ✅ Visual snapshots for regression detection
- ✅ Multi-viewport testing (desktop, tablet, mobile)
- ✅ Accessibility compliance (ARIA, keyboard navigation)
- ✅ Performance metrics

## Running Tests

### Prerequisites

```bash
# Install Playwright browsers
npx playwright install
```

### Run All Tests

```bash
# Run all E2E tests (headless)
npm run test:e2e

# Run with UI mode (recommended for development)
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Debug mode (step through tests)
npm run test:e2e:debug
```

### Run Specific Tests

```bash
# Run only smoke tests
npx playwright test smoke

# Run specific test file
npx playwright test e2e/chat.spec.ts

# Run tests matching pattern
npx playwright test --grep "should load"
```

### View Test Reports

```bash
# Show last test report
npm run test:e2e:report
```

## Test Configuration

See `playwright.config.ts` for configuration:

- **Browsers**: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- **Base URL**: http://localhost:3000
- **Retries**: 2 on CI, 0 locally
- **Screenshots**: On failure only
- **Video**: On failure only
- **Traces**: On first retry

## Writing New Tests

### Basic Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should do something', async ({ page }) => {
    // Arrange
    const button = page.getByRole('button', { name: /click me/i });

    // Act
    await button.click();

    // Assert
    await expect(page.locator('.result')).toBeVisible();
  });
});
```

### Best Practices

1. **Use User-Facing Selectors**
   ```typescript
   // Good
   page.getByRole('button', { name: /submit/i })
   page.getByText('Hello World')

   // Avoid
   page.locator('.btn-submit')
   page.locator('#submit-button')
   ```

2. **Wait for State Changes**
   ```typescript
   // Wait for network to be idle
   await page.waitForLoadState('networkidle');

   // Wait for element to be visible
   await expect(element).toBeVisible({ timeout: 5000 });
   ```

3. **Use Descriptive Test Names**
   ```typescript
   // Good
   test('should display error message when API key is invalid', ...)

   // Avoid
   test('test 1', ...)
   ```

4. **Clean Up After Tests**
   ```typescript
   test.afterEach(async ({ page }) => {
    // Reset state if needed
    await page.evaluate(() => localStorage.clear());
  });
   ```

5. **Handle Timing Issues**
   ```typescript
   // Use built-in waits
   await expect(element).toBeVisible();

   // Avoid arbitrary timeouts
   await page.waitForTimeout(1000); // Only when necessary
   ```

## Visual Regression Testing

Visual tests capture screenshots and compare them to baseline images:

```bash
# Update baseline screenshots
npx playwright test --update-snapshots

# Run only visual tests
npx playwright test visual
```

**Note**: Visual snapshots are platform-specific. Run tests on the same OS for consistent results.

## Accessibility Testing

The visual test suite includes basic accessibility checks:
- Heading hierarchy
- Form labels
- Button labels
- Keyboard navigation
- Color contrast
- Alt text for images
- ARIA landmarks

For comprehensive accessibility audits, consider integrating [axe-core](https://github.com/dequelabs/axe-core).

## Performance Testing

Performance tests measure:
- Page load time
- Time to interactive
- Bundle sizes

View metrics in test output or use Playwright's built-in tracing:

```bash
npx playwright test --trace on
```

## Debugging Tests

### UI Mode (Recommended)
```bash
npm run test:e2e:ui
```

Features:
- Watch mode
- Time travel debugging
- DOM snapshots
- Network logs
- Console logs

### VS Code Extension

Install the [Playwright Test for VSCode](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright) extension for:
- Run tests from editor
- Set breakpoints
- Watch mode
- Test generation

### Debug in Browser

```bash
npm run test:e2e:debug
```

Playwright Inspector will open, allowing you to:
- Step through tests
- Inspect selectors
- View console logs
- Record new tests

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Pushes to main/master/develop
- Scheduled runs

See `.github/workflows/test.yml` for configuration.

### CI-Specific Behavior

- Runs in headless mode
- 2 retries for flaky tests
- Parallel execution disabled for stability
- HTML and GitHub reporters
- Artifacts for failed tests

## Common Issues

### Port Already in Use

If dev server fails to start:
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Browsers Not Installed

```bash
npx playwright install --with-deps
```

### Flaky Tests

1. Add explicit waits:
   ```typescript
   await expect(element).toBeVisible({ timeout: 10000 });
   ```

2. Use `test.retry(2)` for known flaky tests:
   ```typescript
   test('flaky test', async ({ page }) => {
     test.retry(2);
     // test code
   });
   ```

3. Check for race conditions

### Visual Snapshot Failures

```bash
# Update snapshots if changes are intentional
npx playwright test --update-snapshots
```

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Selectors Guide](https://playwright.dev/docs/selectors)
- [Assertions](https://playwright.dev/docs/test-assertions)
- [CI Guide](https://playwright.dev/docs/ci)

---

**Last Updated**: 2025-10-02
**Playwright Version**: 1.55+
