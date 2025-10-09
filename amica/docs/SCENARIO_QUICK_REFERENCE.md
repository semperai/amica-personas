# Scenario Quick Reference

Quick reference for common Amica scenario patterns and APIs.

## Create New Scenario

```bash
npm run create:scenario my-scenario
```

## Scenario Structure

```javascript
class Scenario {
  constructor(ctx) {
    this.$ = ctx.scope;
    this.THREE = ctx.THREE;
    this.config = ctx.config;
  }

  async setup() { }
  update(delta) { }
  async cleanup() { }
}
```

## Common APIs

### VRM & Models

```javascript
// Load VRM
await this.$.loadVrm(url, onProgress);

// Get model
const model = this.$.getModel();

// Trigger emotion
this.$.triggerEmotion('happy', 3.0);

// Set expression
this.$.setExpression('happy', 1.0);

// Play animation
this.$.playAnimation(animationClip);
```

### Camera

```javascript
// Position camera
this.$.setCameraPosition(x, y, z);

// Look at point
this.$.setCameraLookAt(x, y, z);

// Access camera directly
this.$.camera.position.set(x, y, z);
```

### Lighting

```javascript
// Add light
const light = new this.THREE.PointLight(0xffffff, 1);
this.$.addLight(light);

// Remove light
this.$.removeLight(light);
```

### Physics

```javascript
const Ammo = this.$.ammo;
const physicsWorld = this.$.physicsWorld;

// Create rigid body
const transform = new Ammo.btTransform();
transform.setIdentity();
transform.setOrigin(new Ammo.btVector3(x, y, z));

const shape = new Ammo.btSphereShape(radius);
const mass = 1;
const localInertia = new Ammo.btVector3(0, 0, 0);
shape.calculateLocalInertia(mass, localInertia);

const motionState = new Ammo.btDefaultMotionState(transform);
const rbInfo = new Ammo.btRigidBodyConstructionInfo(
  mass, motionState, shape, localInertia
);
const body = new Ammo.btRigidBody(rbInfo);

physicsWorld.addRigidBody(body);
```

### Particles

```javascript
this.$.createParticle({
  position: new this.THREE.Vector3(0, 1, 0),
  velocity: new this.THREE.Vector3(0, 2, 0),
  color: new this.THREE.Color(0xff0000),
  size: 0.1,
  lifetime: 2.0
});
```

### Scene

```javascript
// Add object to scene
this.$.scene.add(mesh);

// Remove from scene
this.$.scene.remove(mesh);

// Access scene directly
this.$.scene.background = new this.THREE.Color(0x000000);
```

### Config

```javascript
const vrmUrl = this.config('vrm_url');
const name = this.config('name');
```

### Time

```javascript
const elapsed = this.$.getElapsedTime();
```

## Common Patterns

### Periodic Action

```javascript
constructor(ctx) {
  this.timer = 0;
  this.interval = 1.0;
}

update(delta) {
  this.timer += delta;
  if (this.timer >= this.interval) {
    this.doAction();
    this.timer = 0;
  }
}
```

### Camera Orbit

```javascript
constructor(ctx) {
  this.angle = 0;
  this.radius = 4;
}

update(delta) {
  this.angle += delta * 0.5;
  const x = Math.cos(this.angle) * this.radius;
  const z = Math.sin(this.angle) * this.radius;
  this.$.setCameraPosition(x, 1.5, z);
  this.$.setCameraLookAt(0, 1, 0);
}
```

### Object Spawning

```javascript
spawnObject() {
  const geometry = new this.THREE.SphereGeometry(0.3);
  const material = new this.THREE.MeshStandardMaterial({
    color: Math.random() * 0xffffff
  });
  const mesh = new this.THREE.Mesh(geometry, material);
  mesh.position.set(0, 2, 0);
  this.$.scene.add(mesh);
  this.objects.push(mesh);
}
```

### Light Pulsing

```javascript
update(delta) {
  const time = this.$.getElapsedTime();
  this.light.intensity = 0.5 + Math.sin(time * 2) * 0.3;
}
```

## Testing

### Create Test

```typescript
import { ScenarioTestRunner, ScenarioAssertions } from '@/testing/ScenarioTestRunner';

describe('My Scenario', () => {
  let runner: ScenarioTestRunner;

  beforeEach(() => {
    runner = new ScenarioTestRunner(MyScenario);
  });

  it('should work', async () => {
    await runner.setup();
    runner.updateForDuration(1.0);

    ScenarioAssertions.assertVrmLoaded(runner);
  });
});
```

### Run Tests

```bash
npm test -- scenarios
npm test -- scenarios/my-scenario
npm run test:watch -- scenarios
```

## Debugging

```javascript
// Log with scenario name
console.log('[MyScenario]', 'Message');

// Check values
console.log('Timer:', this.timer);
console.log('Objects:', this.objects.length);

// Scene inspection
console.log('Scene children:', this.$.scene.children.length);
```

## Resources

- [Full Documentation](./SCENARIO_SYSTEM.md)
- [Getting Started](./SCENARIO_GETTING_STARTED.md)
- [Testing Guide](./SCENARIO_TESTING.md)
- [Examples](./public/scenarios/)
