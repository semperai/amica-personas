# Physics Testing Guide

This guide covers testing physics-based scenarios and features in Amica using Rapier.js.

## Table of Contents

1. [Test Infrastructure Overview](#test-infrastructure-overview)
2. [Physics Test Helpers](#physics-test-helpers)
3. [Writing Physics Tests](#writing-physics-tests)
4. [Performance Benchmarks](#performance-benchmarks)
5. [Visual Regression Tests](#visual-regression-tests)
6. [Best Practices](#best-practices)

---

## Test Infrastructure Overview

The physics testing infrastructure consists of several components:

### Test Files

- **`RapierIntegration.spec.ts`** - Integration tests for Rapier.js physics engine
- **`PhysicsBenchmarks.spec.ts`** - Performance benchmarks and stress tests
- **`CollisionDetection.spec.ts`** - Collision detection and response tests
- **`PhysicsVisualTests.spec.ts`** - Visual regression tests for physics simulations

### Helper Utilities

- **`PhysicsTestHelpers.ts`** - Test utilities and helper classes for physics testing

---

## Physics Test Helpers

The `PhysicsTestHelper` class provides utilities for creating and testing physics scenarios.

### Creating a Helper Instance

```typescript
import { createPhysicsTestHelper } from '../helpers/PhysicsTestHelpers';
import { PhysicsSystem } from '@/features/scene3d/PhysicsSystem';

const physics = new PhysicsSystem();
await physics.initialize();

const helper = createPhysicsTestHelper(
  physics.getRAPIER()!,
  physics.getWorld()!,
  physics.getEventQueue()!
);
```

### Helper Methods

#### Creating Bodies and Colliders

```typescript
// Create a body with collider
const sphere = helper.createBody(
  { position: { x: 0, y: 5, z: 0 }, mass: 1, restitution: 0.5 },
  { shape: 'sphere', radius: 0.5 }
);

// Create ground
helper.createGround(100, 0, 0.8);

// Create wall
helper.createWall(
  { x: 5, y: 2, z: 0 },
  { width: 0.2, height: 4, thickness: 10 }
);

// Create stack of boxes
const boxes = helper.createStack({ x: 0, y: 0, z: 0 }, 5, 0.5);

// Create pendulum
const { anchor, ball, joint } = helper.createPendulum(
  { x: 0, y: 5, z: 0 },
  2, // length
  0.3, // ball radius
  1 // ball mass
);

// Create chain
const chain = helper.createChain({ x: 0, y: 5, z: 0 }, 5, 0.3, 0.6);
```

#### Simulation Control

```typescript
// Simulate for a duration
helper.simulate(2); // 2 seconds at 60fps

// Simulate until condition is met
const result = helper.simulateUntil(
  () => helper.isBodyAtRest(ball),
  10 // max 10 seconds
);

if (result.success) {
  console.log(`Ball settled in ${result.duration} seconds`);
}
```

#### Physics Queries

```typescript
// Check if bodies are colliding
if (helper.areBodiesColliding(body1, body2)) {
  console.log('Bodies are colliding!');
}

// Get body speed
const speed = helper.getBodySpeed(body);

// Check if body is at rest
if (helper.isBodyAtRest(body, 0.01)) {
  console.log('Body is at rest');
}

// Get distance between bodies
const distance = helper.getDistance(body1, body2);

// Get collision events
const events = helper.getCollisionEvents();
events.forEach(event => {
  console.log(`Collision: ${event.handle1} <-> ${event.handle2}, started: ${event.started}`);
});
```

#### Applying Forces

```typescript
// Apply impulse to body
helper.applyImpulse(body, { x: 10, y: 0, z: 0 });

// Apply impulse at point
helper.applyImpulse(
  body,
  { x: 5, y: 0, z: 0 },
  { x: 0, y: 0.5, z: 0 }
);
```

---

## Writing Physics Tests

### Basic Test Structure

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { PhysicsSystem } from '@/features/scene3d/PhysicsSystem';
import { createPhysicsTestHelper, PhysicsAssertions } from '../helpers/PhysicsTestHelpers';

describe('My Physics Test', () => {
  let physics: PhysicsSystem;
  let helper: PhysicsTestHelper;

  beforeEach(async () => {
    physics = new PhysicsSystem();
    await physics.initialize();

    helper = createPhysicsTestHelper(
      physics.getRAPIER()!,
      physics.getWorld()!,
      physics.getEventQueue()!
    );
  });

  it('should fall under gravity', () => {
    const ball = helper.createBody(
      { position: { x: 0, y: 5, z: 0 }, mass: 1 },
      { shape: 'sphere', radius: 0.5 }
    );

    const initialY = ball.translation().y;

    helper.simulate(1);

    const finalY = ball.translation().y;

    expect(finalY).toBeLessThan(initialY);
  });
});
```

### Using Assertions

```typescript
import { PhysicsAssertions } from '../helpers/PhysicsTestHelpers';

// Assert body fell
PhysicsAssertions.assertBodyFell(body, 0);

// Assert body position
PhysicsAssertions.assertBodyPosition(
  body,
  { x: 0, y: 5, z: 0 },
  0.1 // tolerance
);

// Assert body is moving
PhysicsAssertions.assertBodyIsMoving(body, 0.1);

// Assert body at rest
PhysicsAssertions.assertBodyAtRest(body, 0.01);

// Assert bodies colliding
PhysicsAssertions.assertBodiesColliding(helper, body1, body2);

// Assert body in bounds
PhysicsAssertions.assertBodyInBounds(body, {
  min: { x: -10, y: 0, z: -10 },
  max: { x: 10, y: 10, z: 10 }
});
```

### Testing Collisions

```typescript
it('should detect collision', () => {
  helper.createGround();

  const ball = helper.createBody(
    { position: { x: 0, y: 5, z: 0 }, mass: 1 },
    { shape: 'sphere', radius: 0.5 }
  );

  const result = helper.simulateUntil(() => {
    const events = helper.getCollisionEvents();
    return events.some(e => e.started);
  }, 5);

  expect(result.success).toBe(true);
  expect(result.duration).toBeLessThan(2);
});
```

---

## Performance Benchmarks

Performance benchmarks measure and validate physics engine performance.

### Running Benchmarks

```bash
npm test -- PhysicsBenchmarks.spec.ts
```

### Example Benchmark

```typescript
it('should simulate 100 objects at 60fps', () => {
  helper.createGround();

  // Create 100 objects
  for (let i = 0; i < 100; i++) {
    const x = (Math.random() - 0.5) * 20;
    const z = (Math.random() - 0.5) * 20;
    const body = helper.createBody(
      { position: { x, y: 10 + i * 0.5, z }, mass: 1 },
      { shape: 'sphere', radius: 0.5 }
    );
  }

  const startTime = performance.now();

  for (let i = 0; i < 60; i++) {
    helper.simulate(1/60);
  }

  const elapsed = performance.now() - startTime;
  const avgFrameTime = elapsed / 60;

  console.log(`100 objects: ${avgFrameTime.toFixed(2)}ms per frame`);

  // Should maintain 60fps (< 16.67ms per frame)
  expect(avgFrameTime).toBeLessThan(16.67);
});
```

### Benchmark Categories

- **Creation Performance** - Testing body/collider creation speed
- **Simulation Performance** - Testing step simulation performance
- **Collision Performance** - Testing collision detection overhead
- **Memory Performance** - Testing memory usage and leaks
- **Scaling Tests** - Testing performance as object count increases
- **Stress Tests** - Testing extreme scenarios

---

## Visual Regression Tests

Visual regression tests verify that physics simulations produce consistent, expected visual results.

### Testing Trajectories

```typescript
it('should produce consistent fall trajectory', () => {
  const sphere = helper.createBody(
    { position: { x: 0, y: 10, z: 0 }, mass: 1 },
    { shape: 'sphere', radius: 0.5 }
  );

  const trajectory = [];

  for (let i = 0; i < 60; i++) {
    helper.simulate(1/60);
    trajectory.push({ time: i / 60, y: sphere.translation().y });
  }

  // Verify expected fall pattern
  expect(trajectory[0].y).toBeCloseTo(10, 0.1);
  expect(trajectory[59].y).toBeLessThan(6.5);

  // Trajectory should be smooth (monotonically decreasing)
  for (let i = 1; i < trajectory.length; i++) {
    expect(trajectory[i].y).toBeLessThanOrEqual(trajectory[i - 1].y);
  }
});
```

### Testing Determinism

```typescript
it('should produce identical results (deterministic)', () => {
  const runSimulation = () => {
    const testPhysics = new PhysicsSystem();
    testPhysics.initialize();

    const testHelper = createPhysicsTestHelper(
      testPhysics.getRAPIER()!,
      testPhysics.getWorld()!,
      testPhysics.getEventQueue()!
    );

    testHelper.createGround();

    const ball = testHelper.createBody(
      { position: { x: 1, y: 5, z: 2 }, mass: 1 },
      { shape: 'sphere', radius: 0.5 }
    );

    for (let i = 0; i < 120; i++) {
      testHelper.simulate(1/60);
    }

    const pos = ball.translation();
    return { x: pos.x, y: pos.y, z: pos.z };
  };

  const result1 = runSimulation();
  const result2 = runSimulation();

  // Results should be identical
  expect(result1.x).toBeCloseTo(result2.x, 5);
  expect(result1.y).toBeCloseTo(result2.y, 5);
  expect(result1.z).toBeCloseTo(result2.z, 5);
});
```

---

## Best Practices

### 1. Use Appropriate Time Steps

Always use consistent time steps for deterministic results:

```typescript
// Good - fixed time step
helper.simulate(1/60);

// Avoid - variable time step
helper.simulate(delta);
```

### 2. Clean Up After Tests

```typescript
afterEach(() => {
  helper.cleanup();
});
```

### 3. Use Realistic Parameters

Use realistic mass, friction, and restitution values:

```typescript
// Good
const ball = helper.createBody(
  { position: { x: 0, y: 5, z: 0 }, mass: 1, restitution: 0.5, friction: 0.5 },
  { shape: 'sphere', radius: 0.5 }
);

// Avoid unrealistic values
const ball = helper.createBody(
  { position: { x: 0, y: 5, z: 0 }, mass: 1000000, restitution: 2, friction: -1 },
  { shape: 'sphere', radius: 0.5 }
);
```

### 4. Test Edge Cases

Always test edge cases and boundary conditions:

```typescript
it('should handle very small objects', () => {
  const tiny = helper.createBody(
    { position: { x: 0, y: 2, z: 0 }, mass: 0.01 },
    { shape: 'sphere', radius: 0.01 }
  );

  helper.simulate(2);

  expect(tiny.translation().y).toBeCloseTo(0.01, 0.05);
});
```

### 5. Use Timeouts for Long Simulations

```typescript
it('should settle eventually', () => {
  const result = helper.simulateUntil(
    () => helper.isBodyAtRest(ball),
    10 // timeout after 10 seconds
  );

  expect(result.success).toBe(true);
}, 15000); // Vitest timeout
```

### 6. Document Expected Behavior

```typescript
it('should bounce with 0.8 restitution', () => {
  // Ball should bounce to ~80% of original height
  // First bounce: 5m -> ~4m
  // Second bounce: 4m -> ~3.2m
  const ball = helper.createBody(
    { position: { x: 0, y: 5, z: 0 }, mass: 1, restitution: 0.8 },
    { shape: 'sphere', radius: 0.5 }
  );

  helper.createGround();
  helper.simulate(3);

  // ... assertions
});
```

---

## Running Tests

```bash
# Run all physics tests
npm test -- scene3d

# Run specific test file
npm test -- RapierIntegration.spec.ts

# Run with coverage
npm run test:coverage

# Run benchmarks
npm test -- PhysicsBenchmarks.spec.ts
```

---

## Troubleshooting

### Tests are flaky

- Ensure deterministic time steps
- Increase tolerance values
- Check for race conditions

### Tests are slow

- Reduce simulation duration
- Decrease object count
- Use appropriate timeouts

### Unexpected physics behavior

- Verify mass/friction/restitution values
- Check gravity settings
- Ensure colliders are properly sized
- Verify body types (dynamic/static/kinematic)

---

## Additional Resources

- [Rapier.js Documentation](https://rapier.rs/)
- [Rapier.js API Reference](https://rapier.rs/javascript3d/index.html)
- [Physics System Implementation](../../src/features/scene3d/PhysicsSystem.ts)
- [Example Scenarios](../../public/scenarios/)
