# Scenario Testing Guide

## Overview

The Scenario Testing Framework provides comprehensive utilities for testing Amica scenarios in an isolated, reproducible environment. It includes mocked dependencies, assertion helpers, and performance measurement tools.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Test Runner API](#test-runner-api)
3. [Assertions](#assertions)
4. [Best Practices](#best-practices)
5. [Examples](#examples)
6. [CI/CD Integration](#cicd-integration)

---

## Quick Start

### Installation

The testing framework is already included in the Amica project. No additional installation needed.

### Writing Your First Test

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ScenarioTestRunner,
  ScenarioAssertions,
  ScenarioTestUtils,
} from '@/testing/ScenarioTestRunner';

// Load your scenario code
const myScenarioCode = `
class Scenario {
  constructor(ctx) {
    this.$ = ctx.scope;
    this.THREE = ctx.THREE;
  }

  async setup() {
    await this.$.loadVrm('/vrm/model.vrm', console.log);
  }

  update(delta) {
    // Your update logic
  }
}`;

describe('My Scenario', () => {
  let runner: ScenarioTestRunner;
  let MyScenario: any;

  beforeEach(() => {
    MyScenario = ScenarioTestUtils.loadScenarioFromCode(myScenarioCode);
    runner = new ScenarioTestRunner(MyScenario);
  });

  it('should load VRM model', async () => {
    await runner.setup();
    ScenarioAssertions.assertVrmLoaded(runner);
  });
});
```

### Running Tests

```bash
# Run all tests including scenario tests
npm test

# Run scenario tests only
npm test -- scenarios

# Run specific scenario test
npm test -- scenarios/my-scenario.spec.ts

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch

# UI mode
npm run test:ui
```

---

## Test Runner API

### ScenarioTestRunner

The main test runner for scenarios.

#### Constructor

```typescript
new ScenarioTestRunner(ScenarioClass, options?)
```

**Options:**
- `skipSetup?: boolean` - Skip auto-running setup()
- `mockVrmLoad?: boolean` - Mock VRM loading
- `mockRoomLoad?: boolean` - Mock room loading
- `initialElapsedTime?: number` - Set initial elapsed time

#### Methods

##### `async setup(): Promise<void>`

Run scenario setup phase.

```typescript
await runner.setup();
```

##### `update(delta: number = 0.016): void`

Run scenario update for one frame (default 60fps = 0.016s).

```typescript
runner.update(); // 60fps
runner.update(0.033); // 30fps
```

##### `updateFrames(frameCount: number, deltaPerFrame?: number): void`

Run scenario update for multiple frames.

```typescript
runner.updateFrames(60); // 60 frames at 60fps = 1 second
runner.updateFrames(30, 0.033); // 30 frames at 30fps = 1 second
```

##### `updateForDuration(duration: number, deltaPerFrame?: number): void`

Run scenario update for a specific duration.

```typescript
runner.updateForDuration(5.0); // 5 seconds
runner.updateForDuration(10.0, 0.033); // 10 seconds at 30fps
```

##### `async cleanup(): Promise<void>`

Run scenario cleanup phase.

```typescript
await runner.cleanup();
```

##### `getScenario(): any`

Get the scenario instance.

```typescript
const scenario = runner.getScenario();
expect(scenario.orbitAngle).toBeCloseTo(1.0);
```

##### `getContext(): ScenarioTestContext`

Get the full test context.

```typescript
const context = runner.getContext();
const { scope, THREE, hookManager, config } = context;
```

##### `getScope(): MockScope`

Get the mock scope (SceneCoordinator).

```typescript
const scope = runner.getScope();
expect(scope.loadVrm).toHaveBeenCalled();
```

##### `getUpdateCount(): number`

Get number of update calls made.

```typescript
runner.updateFrames(100);
expect(runner.getUpdateCount()).toBe(100);
```

##### `getElapsedTime(): number`

Get total elapsed time.

```typescript
runner.updateForDuration(5.0);
expect(runner.getElapsedTime()).toBeCloseTo(5.0);
```

##### `getSceneObjects<T>(type: Class<T>): T[]`

Get scene objects by type.

```typescript
const meshes = runner.getSceneObjects(THREE.Mesh);
const lights = runner.getSceneObjects(THREE.Light);
```

##### `getLights(): THREE.Light[]`

Get all lights in scene.

```typescript
const lights = runner.getLights();
expect(lights.length).toBe(3);
```

##### `getMeshes(): THREE.Mesh[]`

Get all meshes in scene.

```typescript
const meshes = runner.getMeshes();
expect(meshes.length).toBeGreaterThan(0);
```

##### `countSceneObjects<T>(type: Class<T>): number`

Count objects in scene by type.

```typescript
const lightCount = runner.countSceneObjects(THREE.PointLight);
expect(lightCount).toBe(3);
```

---

## Assertions

### ScenarioAssertions

Helper assertions for common scenario patterns.

#### `assertVrmLoaded(runner, expectedUrl?)`

Assert that VRM was loaded.

```typescript
ScenarioAssertions.assertVrmLoaded(runner);
ScenarioAssertions.assertVrmLoaded(runner, '/vrm/specific-model.vrm');
```

#### `assertRoomLoaded(runner)`

Assert that room was loaded.

```typescript
ScenarioAssertions.assertRoomLoaded(runner);
```

#### `assertCameraPosition(runner, expectedPos, tolerance?)`

Assert camera position with optional tolerance.

```typescript
ScenarioAssertions.assertCameraPosition(runner, { x: 0, y: 1.5, z: 4 });
ScenarioAssertions.assertCameraPosition(runner, { x: 0, y: 1.5, z: 4 }, 0.01);
```

#### `assertLightCount(runner, expectedCount)`

Assert number of lights in scene.

```typescript
ScenarioAssertions.assertLightCount(runner, 5);
```

#### `assertParticleCreated(runner, minCount?)`

Assert particles were created.

```typescript
ScenarioAssertions.assertParticleCreated(runner);
ScenarioAssertions.assertParticleCreated(runner, 10); // At least 10
```

#### `assertEmotionTriggered(runner, emotion?, duration?)`

Assert emotion was triggered.

```typescript
ScenarioAssertions.assertEmotionTriggered(runner);
ScenarioAssertions.assertEmotionTriggered(runner, 'happy');
ScenarioAssertions.assertEmotionTriggered(runner, 'happy', 3.0);
```

#### `assertPhysicsBodyAdded(runner, minCount?)`

Assert physics bodies were added.

```typescript
ScenarioAssertions.assertPhysicsBodyAdded(runner);
ScenarioAssertions.assertPhysicsBodyAdded(runner, 5);
```

#### `assertHookRegistered(runner, hookName?)`

Assert hook was registered.

```typescript
ScenarioAssertions.assertHookRegistered(runner);
ScenarioAssertions.assertHookRegistered(runner, 'before:llm:request');
```

#### `async assertCleanup(runner, checks)`

Assert cleanup was performed.

```typescript
await ScenarioAssertions.assertCleanup(runner, {
  hooksUnregistered: true,
  lightsRemoved: true,
  physicsObjectsRemoved: true,
});
```

---

## ScenarioTestUtils

Utility functions for scenario testing.

#### `loadScenarioFromCode(code: string)`

Load scenario class from code string.

```typescript
const code = `class Scenario { ... }`;
const ScenarioClass = ScenarioTestUtils.loadScenarioFromCode(code);
const runner = new ScenarioTestRunner(ScenarioClass);
```

#### `createMinimalScenario()`

Create a minimal scenario for testing.

```typescript
const MinimalScenario = ScenarioTestUtils.createMinimalScenario();
const runner = new ScenarioTestRunner(MinimalScenario);
```

#### `measureUpdatePerformance(runner, frameCount?)`

Measure performance of scenario update.

```typescript
const perf = ScenarioTestUtils.measureUpdatePerformance(runner, 100);
console.log(`Average: ${perf.avgMs}ms, Max: ${perf.maxMs}ms, Min: ${perf.minMs}ms`);

expect(perf.avgMs).toBeLessThan(1); // Should be fast
```

---

## Best Practices

### 1. Test Structure

```typescript
describe('Scenario Name', () => {
  let runner: ScenarioTestRunner;
  let ScenarioClass: any;

  beforeEach(() => {
    ScenarioClass = ScenarioTestUtils.loadScenarioFromCode(scenarioCode);
    runner = new ScenarioTestRunner(ScenarioClass);
  });

  describe('setup', () => {
    // Test setup phase
  });

  describe('update logic', () => {
    beforeEach(async () => {
      await runner.setup();
    });

    // Test update phase
  });

  describe('cleanup', () => {
    // Test cleanup phase
  });

  describe('performance', () => {
    // Performance tests
  });
});
```

### 2. Test Setup Phase

```typescript
it('should load required resources', async () => {
  await runner.setup();

  ScenarioAssertions.assertVrmLoaded(runner);
  ScenarioAssertions.assertLightCount(runner, 3);
});
```

### 3. Test Update Logic

```typescript
it('should update state over time', () => {
  const scenario = runner.getScenario();
  const initialValue = scenario.orbitAngle;

  runner.updateForDuration(1.0);

  expect(scenario.orbitAngle).toBeGreaterThan(initialValue);
});
```

### 4. Test Cleanup

```typescript
it('should clean up resources', async () => {
  await runner.setup();
  runner.updateForDuration(5.0);

  await ScenarioAssertions.assertCleanup(runner, {
    lightsRemoved: true,
    physicsObjectsRemoved: true,
  });
});
```

### 5. Performance Testing

```typescript
it('should run efficiently', () => {
  const perf = ScenarioTestUtils.measureUpdatePerformance(runner, 100);

  expect(perf.avgMs).toBeLessThan(1);
  expect(perf.maxMs).toBeLessThan(5);
});
```

### 6. Testing Time-Based Logic

```typescript
it('should trigger action after interval', () => {
  const scope = runner.getScope();

  // Just before trigger
  runner.updateForDuration(2.9);
  expect(scope.createParticle).not.toHaveBeenCalled();

  // After trigger
  runner.update(0.2); // Total: 3.1s

  expect(scope.createParticle).toHaveBeenCalled();
});
```

### 7. Testing State Transitions

```typescript
it('should cycle through modes', () => {
  const scenario = runner.getScenario();

  expect(scenario.currentMode).toBe('orbit');

  runner.updateForDuration(8.1); // Mode duration is 8s

  expect(scenario.currentMode).toBe('preset');
});
```

---

## Examples

### Example 1: Testing Particle Generation

```typescript
it('should create particles periodically', () => {
  const scope = runner.getScope();

  runner.updateForDuration(1.0);

  ScenarioAssertions.assertParticleCreated(runner, 10);

  // Verify particle properties
  const particleCall = (scope.createParticle as any).mock.calls[0][0];
  expect(particleCall).toHaveProperty('position');
  expect(particleCall).toHaveProperty('velocity');
  expect(particleCall).toHaveProperty('color');
});
```

### Example 2: Testing Physics Simulation

```typescript
it('should add physics bodies', () => {
  const scope = runner.getScope();

  runner.updateForDuration(3.0);

  ScenarioAssertions.assertPhysicsBodyAdded(runner, 3);

  // Verify bodies were configured correctly
  const addCalls = (scope.physicsWorld.addRigidBody as any).mock.calls;
  expect(addCalls.length).toBe(4); // Ground + 3 objects
});
```

### Example 3: Testing Camera Movement

```typescript
it('should orbit camera around character', () => {
  const scope = runner.getScope();

  // Quarter orbit
  const quarterCircleTime = (Math.PI / 2) / 0.3;
  runner.updateForDuration(quarterCircleTime);

  // Camera should be at 90 degrees
  const calls = (scope.setCameraPosition as any).mock.calls;
  const [x, y, z] = calls[calls.length - 1];

  expect(x).toBeCloseTo(0, 0);
  expect(z).toBeCloseTo(4, 0);
});
```

### Example 4: Testing Lighting

```typescript
it('should update light intensity over time', () => {
  const scenario = runner.getScenario();

  const intensities: number[] = [];
  for (let i = 0; i < 20; i++) {
    runner.update(0.1);
    intensities.push(scenario.ambientLight.intensity);
  }

  const min = Math.min(...intensities);
  const max = Math.max(...intensities);

  expect(max).toBeGreaterThan(min); // Should vary
});
```

---

## CI/CD Integration

### GitHub Actions

Add to `.github/workflows/test.yml`:

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '22'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm test

      - name: Run scenario tests
        run: npm test -- scenarios

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

### Running in CI

```bash
# CI-optimized command
npm run test:ci

# With coverage
npm run test:coverage
```

### Test Reports

Tests generate JUnit XML reports for CI integration:

```bash
npm run test:coverage
```

Reports are saved to `test-results/junit.xml`.

---

## Troubleshooting

### Tests Failing in CI

**Problem:** Tests pass locally but fail in CI.

**Solution:**
- Ensure deterministic timing: use `updateForDuration()` instead of exact frame counts
- Mock time-dependent functions
- Use tolerances for floating-point comparisons

### Mock Not Working

**Problem:** Mock function not being called.

**Solution:**
```typescript
// Check mock setup
const scope = runner.getScope();
expect(scope.loadVrm).toBeDefined();
expect(typeof scope.loadVrm).toBe('function');

// Verify scenario is calling the mock
await runner.setup();
expect(scope.loadVrm).toHaveBeenCalled();
```

### Performance Tests Flaky

**Problem:** Performance tests fail intermittently.

**Solution:**
- Increase frame count for more stable averages
- Use wider thresholds
- Warm up before measuring:

```typescript
// Warm up
runner.updateFrames(10);

// Measure
const perf = ScenarioTestUtils.measureUpdatePerformance(runner, 100);
```

---

## Advanced Topics

### Testing Hooks

```typescript
it('should register hooks', async () => {
  await runner.setup();

  const hookManager = runner.getContext().hookManager;

  ScenarioAssertions.assertHookRegistered(runner, 'before:llm:request');

  expect(hookManager.register).toHaveBeenCalledWith(
    'before:llm:request',
    expect.any(Function),
    expect.anything()
  );
});
```

### Custom Matchers

```typescript
expect.extend({
  toBeWithinRadius(received, center, radius) {
    const distance = Math.sqrt(
      (received.x - center.x) ** 2 +
      (received.y - center.y) ** 2 +
      (received.z - center.z) ** 2
    );

    return {
      pass: distance <= radius,
      message: () => `Expected position to be within ${radius} of center`,
    };
  },
});

// Usage
expect(camera.position).toBeWithinRadius({ x: 0, y: 0, z: 0 }, 5);
```

### Snapshot Testing

```typescript
it('should match scene snapshot', async () => {
  await runner.setup();
  runner.updateForDuration(1.0);

  const lights = runner.getLights().map(l => ({
    type: l.type,
    intensity: l.intensity,
    color: l.color.getHex(),
  }));

  expect(lights).toMatchSnapshot();
});
```

---

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Scenario System Documentation](./SCENARIO_SYSTEM.md)
- [Example Tests](./__tests__/scenarios/)

---

**Last Updated:** 2025-10-05
**Version:** 1.0
