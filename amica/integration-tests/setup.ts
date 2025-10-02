/**
 * Integration Test Setup
 *
 * This file contains setup utilities for integration tests that interact
 * with external services like Ollama, Whisper.cpp, etc.
 */

export interface ServiceConfig {
  name: string;
  url: string;
  healthEndpoint: string;
  timeout?: number;
}

export const INTEGRATION_SERVICES: Record<string, ServiceConfig> = {
  ollama: {
    name: 'Ollama',
    url: 'http://localhost:11434',
    healthEndpoint: '/api/tags',
    timeout: 30000,
  },
  localai: {
    name: 'LocalAI',
    url: 'http://localhost:8080',
    healthEndpoint: '/readyz',
    timeout: 30000,
  },
  koboldai: {
    name: 'KoboldAI',
    url: 'http://localhost:5001',
    healthEndpoint: '/api/v1/model',
    timeout: 30000,
  },
  llamacpp: {
    name: 'llama.cpp',
    url: 'http://localhost:8081',
    healthEndpoint: '/health',
    timeout: 30000,
  },
  whispercpp: {
    name: 'Whisper.cpp',
    url: 'http://localhost:9000',
    healthEndpoint: '/',
    timeout: 30000,
  },
  coqui: {
    name: 'Coqui TTS',
    url: 'http://localhost:5002',
    healthEndpoint: '/',
    timeout: 30000,
  },
  piper: {
    name: 'Piper TTS',
    url: 'http://localhost:10200',
    healthEndpoint: '/',
    timeout: 30000,
  },
};

/**
 * Check if a service is healthy and ready
 */
export async function waitForService(
  service: ServiceConfig,
  maxRetries = 30,
  retryDelay = 1000
): Promise<boolean> {
  console.log(`Waiting for ${service.name} at ${service.url}...`);

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${service.url}${service.healthEndpoint}`, {
        signal: AbortSignal.timeout(service.timeout || 5000),
      });

      if (response.ok) {
        console.log(`✓ ${service.name} is ready`);
        return true;
      }
    } catch (error) {
      // Service not ready yet, continue waiting
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  console.warn(`✗ ${service.name} did not become ready`);
  return false;
}

/**
 * Wait for all services to be ready
 */
export async function waitForAllServices(
  serviceKeys: string[] = Object.keys(INTEGRATION_SERVICES)
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();

  const promises = serviceKeys.map(async (key) => {
    const service = INTEGRATION_SERVICES[key];
    if (service) {
      const ready = await waitForService(service);
      results.set(key, ready);
    }
  });

  await Promise.all(promises);
  return results;
}

/**
 * Check if integration tests should run
 * Set INTEGRATION_TESTS=true environment variable to enable
 */
export function shouldRunIntegrationTests(): boolean {
  return process.env.INTEGRATION_TESTS === 'true';
}

/**
 * Skip test if integration tests are not enabled
 */
export function skipIfNoIntegrationTests(test: any) {
  if (!shouldRunIntegrationTests()) {
    test.skip();
  }
}
