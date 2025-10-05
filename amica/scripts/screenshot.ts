#!/usr/bin/env node
/**
 * Screenshot Script for Amica
 *
 * Captures a clean screenshot of Amica without UI elements.
 * Supports config overrides via command-line arguments.
 *
 * Usage:
 *   npm run screenshot -- --output=screenshot.png --vrm_url=/vrm/model.vrm --bg_color=#ffffff
 *
 * Options:
 *   --output=<path>          Output file path (default: amica-screenshot.png)
 *   --width=<number>         Screenshot width (default: 1920)
 *   --height=<number>        Screenshot height (default: 1080)
 *   --wait=<number>          Additional wait time in ms after load (default: 3000)
 *   --headless=<bool>        Run in headless mode (default: true)
 *   --<config_key>=<value>   Override any Amica config (e.g., --vrm_url=/vrm/model.vrm)
 */

import { chromium, Browser, Page } from '@playwright/test';
import { AmicaConfigKey } from '../src/types/config';

interface ScreenshotOptions {
  output: string;
  width: number;
  height: number;
  wait: number;
  headless: boolean;
  configOverrides: Record<string, string>;
}

/**
 * Parse command-line arguments
 */
function parseArgs(): ScreenshotOptions {
  const args = process.argv.slice(2);
  const options: ScreenshotOptions = {
    output: 'amica-screenshot.png',
    width: 1920,
    height: 1080,
    wait: 3000,
    headless: true,
    configOverrides: {},
  };

  for (const arg of args) {
    if (!arg.startsWith('--')) continue;

    const [key, value] = arg.slice(2).split('=');

    switch (key) {
      case 'output':
        options.output = value;
        break;
      case 'width':
        options.width = parseInt(value, 10);
        break;
      case 'height':
        options.height = parseInt(value, 10);
        break;
      case 'wait':
        options.wait = parseInt(value, 10);
        break;
      case 'headless':
        options.headless = value !== 'false';
        break;
      case 'help':
        printHelp();
        process.exit(0);
        break;
      default:
        // Treat unknown args as config overrides
        options.configOverrides[key] = value;
        break;
    }
  }

  return options;
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
Screenshot Script for Amica

Usage:
  npm run screenshot -- [options]

Options:
  --output=<path>          Output file path (default: amica-screenshot.png)
  --width=<number>         Screenshot width (default: 1920)
  --height=<number>        Screenshot height (default: 1080)
  --wait=<number>          Additional wait time in ms after load (default: 3000)
  --headless=<bool>        Run in headless mode (default: true)
  --<config_key>=<value>   Override any Amica config

Examples:
  # Basic screenshot
  npm run screenshot

  # Custom output and size
  npm run screenshot -- --output=my-amica.png --width=2560 --height=1440

  # Override VRM model and background
  npm run screenshot -- --vrm_url=/vrm/custom.vrm --bg_color=#ffffff

  # Multiple config overrides
  npm run screenshot -- --vrm_url=/vrm/model.vrm --bg_url=/bg/custom.jpg --name=CustomAmica
`);
}

/**
 * Build URL with config overrides as URL parameters
 */
function buildUrl(baseUrl: string, configOverrides: Record<string, string>): string {
  const url = new URL(baseUrl);

  // Add config overrides as URL parameters
  // These will be picked up by the config system
  for (const [key, value] of Object.entries(configOverrides)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

/**
 * Wait for Amica to finish loading
 */
async function waitForAmicaReady(page: Page): Promise<void> {
  // Wait for the canvas element to appear
  await page.waitForSelector('canvas', { timeout: 30000 });

  // Wait for the initial loading overlay to be removed
  await page.waitForFunction(
    () => !document.getElementById('initial-loading'),
    { timeout: 30000 }
  );

  // Wait for the VRM model to be loaded
  // This checks for the VRM model in the scene
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector('canvas');
      // @ts-ignore - accessing internal THREE.js scene
      return canvas && window.__amicaSceneReady === true;
    },
    { timeout: 60000 }
  );
}

/**
 * Hide UI elements for clean screenshot
 */
async function hideUIElements(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Hide all UI elements but keep the canvas
    const selectors = [
      'nav',           // Navbar
      '.navbar',
      '[role="navigation"]',
      'button',        // All buttons
      'input',         // All inputs
      '.chat',         // Chat interface
      '.debug',        // Debug panels
      '[class*="Chat"]',
      '[class*="Debug"]',
      '[class*="Settings"]',
      '[class*="Menu"]',
      '[id*="chat"]',
      '[id*="debug"]',
      '[id*="settings"]',
      '[id*="menu"]',
    ];

    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });
    });

    // Make sure the canvas is visible and takes full space
    const canvas = document.querySelector('canvas');
    if (canvas) {
      canvas.style.display = 'block';
      canvas.style.width = '100vw';
      canvas.style.height = '100vh';
      canvas.style.position = 'fixed';
      canvas.style.top = '0';
      canvas.style.left = '0';
    }
  });
}

/**
 * Expose a flag that will be set when scene is ready
 */
async function setupReadyFlag(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // This will be checked by waitForAmicaReady
    (window as any).__amicaSceneReady = false;

    // Set to true after a short delay to allow rendering
    setTimeout(() => {
      (window as any).__amicaSceneReady = true;
    }, 2000);
  });
}

/**
 * Check if dev server is running
 */
async function checkDevServer(url: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    return response.ok || response.status === 404; // 404 is fine, means server is running
  } catch (error) {
    return false;
  }
}

/**
 * Main screenshot function
 */
async function takeScreenshot(options: ScreenshotOptions): Promise<void> {
  let browser: Browser | null = null;

  try {
    console.log('Starting screenshot process...');
    console.log('Options:', JSON.stringify(options, null, 2));

    // Check if dev server is running
    const baseUrl = 'http://localhost:5173';
    const serverRunning = await checkDevServer(baseUrl);

    if (!serverRunning) {
      console.error('\n❌ Error: Dev server is not running!');
      console.error('\nPlease start the dev server first:');
      console.error('  npm run dev\n');
      console.error('Then run the screenshot command again in another terminal.\n');
      throw new Error('Dev server not running at ' + baseUrl);
    }

    console.log('✓ Dev server is running');

    // Launch browser
    browser = await chromium.launch({
      headless: options.headless,
      args: [
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    });

    const context = await browser.newContext({
      viewport: {
        width: options.width,
        height: options.height,
      },
      deviceScaleFactor: 2, // High DPI for better quality
    });

    const page = await context.newPage();

    // Setup ready flag before navigation
    await setupReadyFlag(page);

    // Build URL with config overrides
    const url = buildUrl('http://localhost:5173', options.configOverrides);
    console.log('Loading Amica at:', url);

    // Navigate to Amica
    await page.goto(url, { waitUntil: 'networkidle' });

    // Wait for Amica to be ready
    console.log('Waiting for Amica to load...');
    await waitForAmicaReady(page);

    // Additional wait time for animations/rendering
    console.log(`Waiting additional ${options.wait}ms for rendering...`);
    await page.waitForTimeout(options.wait);

    // Hide UI elements
    console.log('Hiding UI elements...');
    await hideUIElements(page);

    // Take screenshot
    console.log(`Taking screenshot: ${options.output}`);
    await page.screenshot({
      path: options.output,
      fullPage: false,
    });

    console.log('✓ Screenshot saved successfully!');

  } catch (error) {
    console.error('Error taking screenshot:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const options = parseArgs();
  await takeScreenshot(options);
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
