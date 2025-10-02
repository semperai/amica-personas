# Integration Testing for Amica

This directory contains integration tests for Amica's external service integrations.

## Overview

Amica integrates with multiple external services for AI inference, speech recognition, and text-to-speech. These integration tests verify that Amica correctly communicates with these services.

All test services use Docker containers from the `../containers/` directory, which can also be used for local development.

## Supported Services

The integration test suite currently tests:

### LLM Backends
- **OpenAI Mock** - Mock OpenAI-compatible API (port 8083)
- **Ollama** - Local LLM inference (port 11434)

### Speech-to-Text (STT)
- **Whisper** - Speech recognition (port 9000)

### Text-to-Speech (TTS)
- **Piper** - Fast neural TTS (port 10200)

Additional services available in `../containers/` for local development:
- llama.cpp, KoboldAI (LLM)
- Coqui TTS

## Quick Start

### 1. Start All Services

```bash
docker-compose -f docker-compose.integration.yml up -d
```

### 2. Start Specific Services

```bash
# Start only Ollama
docker-compose -f docker-compose.integration.yml up -d ollama

# Start Ollama and Whisper
docker-compose -f docker-compose.integration.yml up -d ollama whispercpp
```

### 3. Run Integration Tests

```bash
# Run all integration tests
INTEGRATION_TESTS=true npm run test:e2e -- integration-tests/

# Run specific integration test
INTEGRATION_TESTS=true npm run test:e2e -- integration-tests/ollama.integration.spec.ts

# Run with UI mode
INTEGRATION_TESTS=true npm run test:e2e:ui -- integration-tests/
```

### 4. Stop Services

```bash
docker-compose -f docker-compose.integration.yml down

# Stop and remove volumes
docker-compose -f docker-compose.integration.yml down -v
```

## Service Health Checks

All services include health checks to ensure they're ready before tests run. The test setup will automatically wait for services to become healthy.

## Writing Integration Tests

Integration tests use Playwright and follow this pattern:

```typescript
import { test, expect } from '@playwright/test';
import { waitForService, INTEGRATION_SERVICES, shouldRunIntegrationTests } from './setup';

test.describe('My Integration', () => {
  test.beforeAll(async () => {
    if (!shouldRunIntegrationTests()) {
      return;
    }

    const ready = await waitForService(INTEGRATION_SERVICES.myservice);
    if (!ready) {
      throw new Error('Service not available');
    }
  });

  test.skip(({ }, testInfo) => {
    if (!shouldRunIntegrationTests()) {
      testInfo.annotations.push({
        type: 'skip',
        description: 'Integration tests disabled',
      });
    }
  });

  test('should do something', async ({ page }) => {
    // Your test here
  });
});
```

## CI/CD Integration

To run integration tests in CI:

```yaml
- name: Start integration services
  run: docker-compose -f docker-compose.integration.yml up -d

- name: Wait for services
  run: sleep 30

- name: Run integration tests
  run: INTEGRATION_TESTS=true npm run test:e2e -- integration-tests/

- name: Stop services
  run: docker-compose -f docker-compose.integration.yml down
```

## Troubleshooting

### Services not starting

Check Docker logs:
```bash
docker-compose -f docker-compose.integration.yml logs ollama
```

### Tests timing out

Increase service wait time in `setup.ts`:
```typescript
await waitForService(INTEGRATION_SERVICES.ollama, 120, 2000); // 120 retries, 2s delay
```

### Port conflicts

Check if ports are already in use:
```bash
lsof -i :11434  # Check Ollama port
```

Modify port mappings in `docker-compose.integration.yml` if needed.

## Model Setup

Some services require models to be downloaded:

### Ollama
```bash
docker exec -it amica-ollama ollama pull llama2
docker exec -it amica-ollama ollama pull mistral
```

### llama.cpp
Place GGUF models in the `llamacpp-models` volume or bind mount a local directory:
```yaml
volumes:
  - ./models:/models
```

## Resource Requirements

- **RAM**: Minimum 8GB recommended (16GB for larger models)
- **Disk**: ~10GB for all service images and models
- **CPU**: Multi-core recommended for parallel service execution

## Notes

- Integration tests are skipped by default (must set `INTEGRATION_TESTS=true`)
- Services may take 30-60 seconds to fully start
- Some services (like Ollama) require model downloads before they're fully functional
- Health checks ensure services are ready before tests run
