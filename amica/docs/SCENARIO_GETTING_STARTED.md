# Getting Started with Amica Scenarios

## Quick Start Guide

This guide will walk you through creating your first Amica scenario from scratch, complete with testing and best practices.

---

## Table of Contents

1. [Create Your First Scenario](#create-your-first-scenario)
2. [Understanding the Structure](#understanding-the-structure)
3. [Running Your Scenario](#running-your-scenario)
4. [Testing Your Scenario](#testing-your-scenario)
5. [Next Steps](#next-steps)

---

## Create Your First Scenario

### Method 1: Using the Generator (Recommended)

The easiest way to create a scenario is using our interactive generator:

```bash
# Navigate to the amica directory
cd amica

# Run the scenario generator
node scripts/create-scenario.js my-first-scenario

# Or use npm script
npm run create:scenario my-first-scenario
```

The generator will ask you questions and create:
- ✅ Scenario JavaScript file (`public/scenarios/my-first-scenario.js`)
- ✅ Test file (`__tests__/scenarios/my-first-scenario.scenario.spec.ts`)
- ✅ README (`public/scenarios/my-first-scenario.README.md`)

**Example session:**

```
📝 Scenario Generator

Creating scenario: my-first-scenario

Description (brief): A simple bouncing ball demo
Author name (optional): Your Name

Features (press Enter with empty line to finish):
  - Spawns bouncing balls
  - Physics simulation
  - Colorful visuals

Use physics (Ammo.js)? (y/N): y
Use particles? (y/N): n
Use hooks? (y/N): n
Custom lighting? (y/N): y
Load room/environment? (y/N): n

⚙️  Generating files...

✅ Created: public/scenarios/my-first-scenario.js
✅ Created: __tests__/scenarios/my-first-scenario.scenario.spec.ts
✅ Created: public/scenarios/my-first-scenario.README.md

🎉 Scenario created successfully!

Next steps:
  1. Edit your scenario: public/scenarios/my-first-scenario.js
  2. Run tests: npm test -- scenarios/my-first-scenario
  3. Use in config: scenario_url = "/scenarios/my-first-scenario.js"
```

### Method 2: Manual Creation

If you prefer to create manually:

1. **Copy the template:**
   ```bash
   cp public/scenarios/_template.js public/scenarios/my-scenario.js
   cp __tests__/scenarios/_template.scenario.spec.ts __tests__/scenarios/my-scenario.scenario.spec.ts
   ```

2. **Customize the files** (see [Understanding the Structure](#understanding-the-structure))

3. **Run tests:**
   ```bash
   npm test -- scenarios/my-scenario
   ```

---

## Understanding the Structure

### Scenario File Structure

Every scenario follows this structure:

```javascript
class Scenario {
  // 1. Constructor - Initialize state
  constructor(ctx) {
    this.$ = ctx.scope;      // SceneCoordinator
    this.THREE = ctx.THREE;  // Three.js
    this.config = ctx.config; // Config function

    // Your state variables
    this.timer = 0;
  }

  // 2. Setup - Load resources (runs once)
  async setup() {
    await this.$.loadVrm(this.config('vrm_url'), console.log);
    this.$.setCameraPosition(0, 1.5, 4);
    this.$.setCameraLookAt(0, 1, 0);
  }

  // 3. Update - Called every frame (~60fps)
  update(delta) {
    this.timer += delta;
    // Your logic here
  }

  // 4. Cleanup - Remove resources (optional)
  async cleanup() {
    // Clean up lights, objects, physics, hooks, etc.
  }
}
```

### The Context Object

The `ctx` object passed to constructor contains:

```javascript
{
  scope: SceneCoordinator,    // Main API for scene control
  THREE: Three.js library,    // Full Three.js access
  hookManager: HookManager,   // Hook system
  config: (key) => string     // Configuration function
}
```

### Key Methods Available

From `this.$` (SceneCoordinator):

**VRM & Models:**
- `loadVrm(url, onProgress)`
- `unloadVRM()`
- `getModel()`
- `playAnimation(clip)`
- `setExpression(name, value)`
- `triggerEmotion(emotion, duration)`

**Scene & Camera:**
- `scene` - THREE.Scene
- `camera` - THREE.Camera
- `setCameraPosition(x, y, z)`
- `setCameraLookAt(x, y, z)`

**Lighting:**
- `addLight(light)`
- `removeLight(light)`

**Physics:**
- `ammo` - Ammo.js library
- `physicsWorld` - Physics world

**Particles:**
- `createParticle(options)`

**Utilities:**
- `getElapsedTime()`
- `sendMessage(text)`

See [SCENARIO_SYSTEM.md](SCENARIO_SYSTEM.md) for complete API reference.

---

## Example: Bouncing Ball Scenario

Let's create a complete bouncing ball scenario step-by-step.

### Step 1: Create the Scenario

```javascript
class Scenario {
  constructor(ctx) {
    console.log('[BouncingBall] Initializing...');

    this.$ = ctx.scope;
    this.THREE = ctx.THREE;
    this.config = ctx.config;

    // State
    this.balls = [];
    this.rigidBodies = [];
    this.spawnTimer = 0;
    this.spawnInterval = 2.0; // Spawn every 2 seconds
    this.tmpTrans = null;
    this.lights = [];
  }

  async setup() {
    console.log('[BouncingBall] Setting up...');

    // Load VRM
    await this.$.loadVrm(
      this.config('vrm_url'),
      (progress) => console.log(`Loading VRM: ${progress}`)
    );

    // Setup camera
    this.$.setCameraPosition(4, 3, 6);
    this.$.setCameraLookAt(0, 1, 0);

    // Add lighting
    const ambient = new this.THREE.AmbientLight(0xffffff, 0.5);
    this.$.addLight(ambient);
    this.lights.push(ambient);

    const dirLight = new this.THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 5, 5);
    this.$.addLight(dirLight);
    this.lights.push(dirLight);

    // Setup physics
    const Ammo = this.$.ammo;
    this.tmpTrans = new Ammo.btTransform();

    // Create ground
    this.createGround();

    console.log('[BouncingBall] Setup complete!');
  }

  createGround() {
    const Ammo = this.$.ammo;

    // Visual ground
    const groundMesh = new this.THREE.Mesh(
      new this.THREE.PlaneGeometry(10, 10),
      new this.THREE.MeshStandardMaterial({ color: 0x808080 })
    );
    groundMesh.rotation.x = -Math.PI / 2;
    this.$.scene.add(groundMesh);

    // Physics ground
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new Ammo.btVector3(0, 0, 0));
    transform.setRotation(new Ammo.btQuaternion(
      -Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)
    ));

    const shape = new Ammo.btBoxShape(new Ammo.btVector3(5, 0.1, 5));
    const motionState = new Ammo.btDefaultMotionState(transform);
    const rbInfo = new Ammo.btRigidBodyConstructionInfo(
      0, motionState, shape, new Ammo.btVector3(0, 0, 0)
    );
    const body = new Ammo.btRigidBody(rbInfo);
    body.setFriction(0.5);

    this.$.physicsWorld.addRigidBody(body);
  }

  update(delta) {
    this.spawnTimer += delta;

    // Spawn balls
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnBall();
      this.spawnTimer = 0;
    }

    // Update physics
    this.updatePhysics();

    // Cleanup fallen balls
    this.cleanupFallenBalls();
  }

  spawnBall() {
    const Ammo = this.$.ammo;
    const radius = 0.3;

    // Visual ball
    const geometry = new this.THREE.SphereGeometry(radius, 16, 16);
    const material = new this.THREE.MeshStandardMaterial({
      color: Math.random() * 0xffffff
    });
    const mesh = new this.THREE.Mesh(geometry, material);
    mesh.position.set(
      (Math.random() - 0.5) * 2,
      5,
      (Math.random() - 0.5) * 2
    );
    this.$.scene.add(mesh);

    // Physics ball
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new Ammo.btVector3(
      mesh.position.x, mesh.position.y, mesh.position.z
    ));

    const shape = new Ammo.btSphereShape(radius);
    const mass = 1;
    const localInertia = new Ammo.btVector3(0, 0, 0);
    shape.calculateLocalInertia(mass, localInertia);

    const motionState = new Ammo.btDefaultMotionState(transform);
    const rbInfo = new Ammo.btRigidBodyConstructionInfo(
      mass, motionState, shape, localInertia
    );
    const body = new Ammo.btRigidBody(rbInfo);
    body.setRestitution(0.7); // Bouncy!
    body.setFriction(0.5);

    this.$.physicsWorld.addRigidBody(body);

    mesh.userData.physicsBody = body;
    this.rigidBodies.push(mesh);

    console.log(`[BouncingBall] Spawned ball #${this.rigidBodies.length}`);
  }

  updatePhysics() {
    const Ammo = this.$.ammo;

    for (const mesh of this.rigidBodies) {
      const body = mesh.userData.physicsBody;
      if (!body) continue;

      const ms = body.getMotionState();
      if (ms) {
        ms.getWorldTransform(this.tmpTrans);
        const p = this.tmpTrans.getOrigin();
        const q = this.tmpTrans.getRotation();
        mesh.position.set(p.x(), p.y(), p.z());
        mesh.quaternion.set(q.x(), q.y(), q.z(), q.w());
      }
    }
  }

  cleanupFallenBalls() {
    for (let i = this.rigidBodies.length - 1; i >= 0; i--) {
      const mesh = this.rigidBodies[i];
      if (mesh.position.y < -10) {
        this.$.scene.remove(mesh);
        this.$.physicsWorld.removeRigidBody(mesh.userData.physicsBody);
        this.rigidBodies.splice(i, 1);
      }
    }
  }

  async cleanup() {
    console.log('[BouncingBall] Cleaning up...');

    // Remove lights
    this.lights.forEach(light => this.$.removeLight(light));

    // Remove balls
    this.rigidBodies.forEach(mesh => {
      this.$.scene.remove(mesh);
      this.$.physicsWorld.removeRigidBody(mesh.userData.physicsBody);
    });

    console.log('[BouncingBall] Cleanup complete');
  }
}
```

### Step 2: Test Your Scenario

Create `__tests__/scenarios/bouncing-ball.scenario.spec.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ScenarioTestRunner,
  ScenarioAssertions,
  ScenarioTestUtils,
} from '@/testing/ScenarioTestRunner';
import fs from 'fs';
import path from 'path';

const scenarioPath = path.join(__dirname, '../../public/scenarios/bouncing-ball.js');
const scenarioCode = fs.readFileSync(scenarioPath, 'utf-8');

describe('Bouncing Ball Scenario', () => {
  let runner: ScenarioTestRunner;
  let BouncingBallScenario: any;

  beforeEach(() => {
    BouncingBallScenario = ScenarioTestUtils.loadScenarioFromCode(scenarioCode);
    runner = new ScenarioTestRunner(BouncingBallScenario);
  });

  it('should spawn balls periodically', async () => {
    await runner.setup();
    const scenario = runner.getScenario();

    expect(scenario.rigidBodies.length).toBe(0);

    // Wait for first spawn (2 seconds)
    runner.updateForDuration(2.1);

    expect(scenario.rigidBodies.length).toBe(1);

    // Wait for second spawn
    runner.updateForDuration(2.1);

    expect(scenario.rigidBodies.length).toBe(2);
  });

  it('should cleanup fallen balls', async () => {
    await runner.setup();
    const scenario = runner.getScenario();

    // Spawn a ball
    runner.updateForDuration(2.1);

    // Make it fall
    scenario.rigidBodies[0].position.y = -15;
    runner.update(0.016);

    // Should be removed
    expect(scenario.rigidBodies.length).toBe(0);
  });
});
```

### Step 3: Run and Test

```bash
# Run tests
npm test -- scenarios/bouncing-ball

# Should see:
# ✓ should spawn balls periodically
# ✓ should cleanup fallen balls
```

---

## Running Your Scenario

### 1. Update Configuration

Edit your config file (`.toml` or `/config` endpoint):

```toml
scenario_url = "/scenarios/my-first-scenario.js"
```

### 2. Start Amica

```bash
npm run dev
```

### 3. View in Browser

Open `http://localhost:5173` and watch your scenario in action!

---

## Testing Your Scenario

### Running Tests

```bash
# All scenario tests
npm test -- scenarios

# Specific scenario
npm test -- scenarios/my-scenario

# Watch mode
npm run test:watch -- scenarios/my-scenario

# With coverage
npm run test:coverage
```

### Writing Tests

Use the provided test template and assertions:

```typescript
// Test setup
it('should load resources', async () => {
  await runner.setup();
  ScenarioAssertions.assertVrmLoaded(runner);
});

// Test state changes
it('should update over time', () => {
  const scenario = runner.getScenario();
  runner.updateForDuration(1.0);
  expect(scenario.timer).toBeCloseTo(1.0);
});

// Test performance
it('should run efficiently', () => {
  const perf = ScenarioTestUtils.measureUpdatePerformance(runner, 100);
  expect(perf.avgMs).toBeLessThan(1);
});
```

See [SCENARIO_TESTING.md](SCENARIO_TESTING.md) for complete testing guide.

---

## Next Steps

### 1. Explore Examples

Check out the example scenarios:

- **particle-effects.js** - Particle system demo
- **dynamic-lighting.js** - Lighting and mood
- **camera-animation.js** - Camera movements
- **physics-playground.js** - Physics simulation

### 2. Read the Documentation

- [SCENARIO_SYSTEM.md](SCENARIO_SYSTEM.md) - Complete API reference
- [SCENARIO_TESTING.md](SCENARIO_TESTING.md) - Testing guide
- [public/scenarios/README.md](./public/scenarios/README.md) - Scenario index

### 3. Common Patterns

#### Periodic Actions

```javascript
update(delta) {
  this.timer += delta;

  if (this.timer >= 1.0) {
    this.doSomething();
    this.timer = 0;
  }
}
```

#### Camera Orbit

```javascript
update(delta) {
  this.angle += delta * 0.5;
  const x = Math.cos(this.angle) * 4;
  const z = Math.sin(this.angle) * 4;
  this.$.setCameraPosition(x, 1.5, z);
  this.$.setCameraLookAt(0, 1, 0);
}
```

#### Particle Creation

```javascript
createParticle() {
  this.$.createParticle({
    position: new this.THREE.Vector3(0, 1, 0),
    velocity: new this.THREE.Vector3(0, 2, 0),
    color: new this.THREE.Color(0xff0000),
    size: 0.1,
    lifetime: 2.0
  });
}
```

#### Physics Object

```javascript
createPhysicsBox() {
  const Ammo = this.$.ammo;

  // Visual
  const mesh = new this.THREE.Mesh(
    new this.THREE.BoxGeometry(1, 1, 1),
    new this.THREE.MeshStandardMaterial({ color: 0xff0000 })
  );
  mesh.position.set(0, 5, 0);
  this.$.scene.add(mesh);

  // Physics
  const transform = new Ammo.btTransform();
  transform.setIdentity();
  transform.setOrigin(new Ammo.btVector3(0, 5, 0));

  const shape = new Ammo.btBoxShape(new Ammo.btVector3(0.5, 0.5, 0.5));
  const mass = 1;
  const localInertia = new Ammo.btVector3(0, 0, 0);
  shape.calculateLocalInertia(mass, localInertia);

  const motionState = new Ammo.btDefaultMotionState(transform);
  const rbInfo = new Ammo.btRigidBodyConstructionInfo(
    mass, motionState, shape, localInertia
  );
  const body = new Ammo.btRigidBody(rbInfo);

  this.$.physicsWorld.addRigidBody(body);
  mesh.userData.physicsBody = body;

  return mesh;
}
```

### 4. Tips and Best Practices

✅ **DO:**
- Use `delta` for frame-rate independent timing
- Clean up resources in `cleanup()`
- Test your scenario
- Log important events with `console.log('[YourScenario] ...')`
- Handle errors gracefully

❌ **DON'T:**
- Assume fixed frame rate (use `delta`)
- Leave resources unmanaged
- Perform expensive operations every frame
- Use hardcoded values (use `config()`)

### 5. Get Help

- Check [SCENARIO_SYSTEM.md](SCENARIO_SYSTEM.md) for API details
- Look at example scenarios for patterns
- Run tests to verify behavior
- Join the Amica community for support

---

## Troubleshooting

### Scenario Not Loading

**Check:**
1. File is in `/public/scenarios/`
2. `scenario_url` config is correct
3. Class is named `Scenario`
4. No JavaScript syntax errors (check browser console)

### Tests Failing

**Check:**
1. Test file matches scenario code
2. Assertions match expected behavior
3. Async operations are awaited
4. Mocks are configured correctly

### Physics Not Working

**Check:**
1. `this.$.ammo` exists
2. `this.$.physicsWorld` exists
3. Bodies are added with `addRigidBody()`
4. Physics is updated in `update()`

---

## Summary

You now know how to:

✅ Create scenarios using the generator
✅ Understand scenario structure
✅ Use the Amica API
✅ Write tests for scenarios
✅ Run and debug scenarios

**Happy scenario building!** 🎉

---

**Resources:**
- [Complete API Reference](./SCENARIO_SYSTEM.md)
- [Testing Guide](./SCENARIO_TESTING.md)
- [Example Scenarios](./public/scenarios/)
- [GitHub Repository](https://github.com/heyamica/amica)

---

**Last Updated:** 2025-10-05
**Version:** 1.0
