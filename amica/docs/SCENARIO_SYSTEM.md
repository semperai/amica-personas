# Amica Scenario System Documentation

## Overview

The Amica Scenario System allows you to create custom interactive experiences by controlling all aspects of the 3D environment, VRM models, physics, animations, emotions, and more. Scenarios are JavaScript classes that are dynamically loaded and executed, with full access to Three.js, Ammo.js physics, and the Amica API.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Scenario Lifecycle](#scenario-lifecycle)
3. [Context API Reference](#context-api-reference)
4. [Examples](#examples)
5. [Hook System](#hook-system)
6. [Best Practices](#best-practices)

---

## Getting Started

### Basic Structure

Every scenario is a JavaScript class with the following structure:

```javascript
class Scenario {
  constructor(ctx) {
    // Initialization - runs once when scenario is loaded
    this.$ = ctx.scope;           // SceneCoordinator - main API
    this.THREE = ctx.THREE;       // Three.js library
    this.hookManager = ctx.hookManager;  // Hook system
    this.config = ctx.config;     // Configuration function
  }

  async setup() {
    // Async setup - load models, rooms, etc.
    await this.$.loadVrm('/vrm/model.vrm', (progress) => {
      console.log('Loading:', progress);
    });
  }

  update(delta) {
    // Called every frame - delta is time since last frame
  }

  async cleanup() {
    // Optional - called when scenario is unloaded
  }
}
```

### File Location

Place scenario files in `/public/scenarios/` directory with `.js` extension.

Configure the scenario URL in your config:
```
scenario_url = "/scenarios/your-scenario.js"
```

---

## Scenario Lifecycle

### 1. Constructor Phase
- Runs immediately when scenario is loaded
- Store references to context objects
- Initialize variables
- **Do NOT** perform async operations here

### 2. Setup Phase
- Runs after constructor completes
- Load VRM models, rooms, environments
- Initialize physics objects
- Register hooks
- Set up lighting, particles, etc.

### 3. Update Loop
- Runs every frame (typically 60fps)
- `delta` parameter is time elapsed since last frame (in seconds)
- Update animations, physics, particles
- Check for user interactions

### 4. Cleanup Phase (Optional)
- Runs when scenario is being replaced
- Unregister hooks
- Clean up resources
- Remove physics bodies

---

## Context API Reference

### `ctx.scope` - SceneCoordinator

The main API for controlling the scene. Accessed via `this.$` in your scenario.

#### Scene Access

```javascript
// Get scene components
this.$.scene          // THREE.Scene
this.$.camera         // THREE.Camera
this.$.renderer       // THREE.WebGLRenderer
this.$.igroup         // Interactive group for objects
```

#### VRM Model Control

```javascript
// Load VRM model
await this.$.loadVrm(url, (progress) => {
  console.log('Loading:', progress);
});

// Unload current VRM
this.$.unloadVRM();

// Get current model
const model = this.$.getModel();

// Access VRM directly
const vrm = model.vrm;  // VRM instance
```

#### Animation Control

```javascript
// Play animation clip
this.$.playAnimation(animationClip);

// Example: Load and play custom animation
const loader = new this.THREE.AnimationClip.parse(animationData);
this.$.playAnimation(loader);
```

#### Emotion & Expression Control

```javascript
// Set expression value (0.0 to 1.0)
this.$.setExpression('happy', 1.0);
this.$.setExpression('sad', 0.0);

// Available expressions: happy, angry, sad, relaxed, surprised, etc.

// Trigger emotion with optional duration
this.$.triggerEmotion('happy', 3.0);  // 3 seconds
this.$.triggerEmotion('sad');         // Default duration
```

#### Camera Control

```javascript
// Set camera position
this.$.setCameraPosition(0, 1.5, 3);

// Set camera look-at target
this.$.setCameraLookAt(0, 1, 0);

// Example: Orbit camera around model
const time = this.$.getElapsedTime();
const radius = 3;
this.$.setCameraPosition(
  Math.cos(time) * radius,
  1.5,
  Math.sin(time) * radius
);
this.$.setCameraLookAt(0, 1, 0);
```

#### Lighting Control

```javascript
// Add light to scene
const light = new this.THREE.PointLight(0xffffff, 1, 100);
light.position.set(0, 5, 0);
this.$.addLight(light);

// Remove light
this.$.removeLight(light);

// Example: Pulsing light
const light = new this.THREE.PointLight(0xff0000, 1, 10);
light.position.set(0, 2, 0);
this.$.addLight(light);

// In update():
light.intensity = 0.5 + Math.sin(this.$.getElapsedTime() * 2) * 0.5;
```

#### Environment & Room

```javascript
// Load room/environment
await this.$.loadRoom(
  url,                              // GLB/GLTF file
  new this.THREE.Vector3(0, 0, 0), // Position
  new this.THREE.Euler(0, 0, 0),   // Rotation
  new this.THREE.Vector3(1, 1, 1), // Scale
  (progress) => console.log(progress)
);

// Unload room
this.$.unloadRoom();

// Load Gaussian Splat
await this.$.loadSplat(url);
```

#### Physics (Ammo.js)

```javascript
// Access Ammo.js library
const Ammo = this.$.ammo;

// Get physics world
const physicsWorld = this.$.physicsWorld;

// Example: Create physics sphere
const transform = new Ammo.btTransform();
transform.setIdentity();
transform.setOrigin(new Ammo.btVector3(0, 5, 0));

const shape = new Ammo.btSphereShape(0.5);
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

#### Particle System

```javascript
// Create particle
const particle = this.$.createParticle({
  position: new this.THREE.Vector3(0, 2, 0),
  velocity: new this.THREE.Vector3(0, 1, 0),
  color: new this.THREE.Color(0xff0000),
  size: 0.1,
  lifetime: 2.0  // seconds
});
```

#### Chat/Bot Interaction

```javascript
// Send message to chat bot
this.$.sendMessage("Hello!");

// Access chat system
const chat = this.$.chat;
```

#### Utility Functions

```javascript
// Get elapsed time since app start
const time = this.$.getElapsedTime();  // seconds

// Get VRM model
const model = this.$.getModel();
```

#### XR/VR Systems

```javascript
// Access XR system
const xr = this.$.xr;

// Access VRM manager
const vrm = this.$.vrm;

// Access environment manager
const environment = this.$.environment;

// Access particle manager
const particles = this.$.particles;

// Access debug system
const debug = this.$.debug;

// Access render system
const render = this.$.render;

// Access raycast system
const raycast = this.$.raycast;

// Access physics system
const physics = this.$.physics;
```

### `ctx.THREE` - Three.js Library

Complete Three.js library for creating 3D objects, materials, geometries, etc.

```javascript
// Create objects
const geometry = new this.THREE.BoxGeometry(1, 1, 1);
const material = new this.THREE.MeshStandardMaterial({ color: 0xff0000 });
const cube = new this.THREE.Mesh(geometry, material);
this.$.scene.add(cube);

// Vectors and math
const pos = new this.THREE.Vector3(0, 1, 0);
const euler = new this.THREE.Euler(0, Math.PI / 2, 0);
const quaternion = new this.THREE.Quaternion();
```

### `ctx.config` - Configuration System

Access Amica configuration values:

```javascript
// Get config value
const vrmUrl = this.config('vrm_url');
const ttsBackend = this.config('tts_backend');
const characterName = this.config('name');

// Available config keys:
// - vrm_url, animation_url, scenario_url
// - chatbot_backend, openai_apikey, openai_model
// - tts_backend, stt_backend, vision_backend
// - name, system_prompt
// - and many more...
```

### `ctx.hookManager` - Hook System

Intercept and modify pipeline stages. See [Hook System](#hook-system) section.

---

## Examples

### Example 1: Simple VRM Loader

```javascript
class Scenario {
  constructor(ctx) {
    this.$ = ctx.scope;
    this.THREE = ctx.THREE;
  }

  async setup() {
    await this.$.loadVrm('/vrm/AvatarSample_A.vrm', (progress) => {
      console.log('Loading:', progress);
    });
  }

  update(delta) {
    // Empty - just displaying the model
  }
}
```

### Example 2: Rotating Camera

```javascript
class Scenario {
  constructor(ctx) {
    this.$ = ctx.scope;
    this.THREE = ctx.THREE;
    this.cameraAngle = 0;
    this.cameraDistance = 3;
  }

  async setup() {
    await this.$.loadVrm('/vrm/AvatarSample_B.vrm', (progress) => {
      console.log('Loading:', progress);
    });
  }

  update(delta) {
    // Rotate camera around model
    this.cameraAngle += delta * 0.3;  // 0.3 radians per second

    const x = Math.cos(this.cameraAngle) * this.cameraDistance;
    const z = Math.sin(this.cameraAngle) * this.cameraDistance;

    this.$.setCameraPosition(x, 1.5, z);
    this.$.setCameraLookAt(0, 1, 0);
  }
}
```

### Example 3: Dynamic Lighting

```javascript
class Scenario {
  constructor(ctx) {
    this.$ = ctx.scope;
    this.THREE = ctx.THREE;
    this.lights = [];
  }

  async setup() {
    await this.$.loadVrm('/vrm/AvatarSample_B.vrm', (progress) => {
      console.log('Loading:', progress);
    });

    // Create colored lights
    const colors = [0xff0000, 0x00ff00, 0x0000ff];
    const positions = [
      new this.THREE.Vector3(-2, 2, 0),
      new this.THREE.Vector3(2, 2, 0),
      new this.THREE.Vector3(0, 2, 2)
    ];

    colors.forEach((color, i) => {
      const light = new this.THREE.PointLight(color, 0.5, 10);
      light.position.copy(positions[i]);
      this.$.addLight(light);
      this.lights.push(light);
    });
  }

  update(delta) {
    const time = this.$.getElapsedTime();

    // Pulse lights
    this.lights.forEach((light, i) => {
      const offset = (i * Math.PI * 2) / this.lights.length;
      light.intensity = 0.3 + Math.sin(time * 2 + offset) * 0.3;
    });
  }
}
```

### Example 4: Physics Playground

```javascript
class Scenario {
  constructor(ctx) {
    this.$ = ctx.scope;
    this.THREE = ctx.THREE;
    this.rigidBodies = [];
    this.tmpTrans = null;
    this.timeSinceLastBall = 0;
  }

  async setup() {
    const Ammo = this.$.ammo;

    await this.$.loadVrm('/vrm/AvatarSample_B.vrm', (progress) => {
      console.log('Loading:', progress);
    });

    this.tmpTrans = new Ammo.btTransform();

    // Create ground plane
    const groundMesh = new this.THREE.Mesh(
      new this.THREE.PlaneGeometry(10, 10),
      new this.THREE.MeshStandardMaterial({ color: 0x808080 })
    );
    groundMesh.rotation.x = -Math.PI / 2;
    this.$.scene.add(groundMesh);

    // Ground physics
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
    this.$.physicsWorld.addRigidBody(body);
  }

  update(delta) {
    const Ammo = this.$.ammo;

    // Spawn ball every 0.5 seconds
    this.timeSinceLastBall += delta;
    if (this.timeSinceLastBall > 0.5) {
      this.createBall();
      this.timeSinceLastBall = 0;
    }

    // Update physics objects
    for (let i = 0; i < this.rigidBodies.length; i++) {
      const mesh = this.rigidBodies[i];
      const body = mesh.userData.physicsBody;
      const ms = body.getMotionState();

      if (ms) {
        ms.getWorldTransform(this.tmpTrans);
        const p = this.tmpTrans.getOrigin();
        const q = this.tmpTrans.getRotation();
        mesh.position.set(p.x(), p.y(), p.z());
        mesh.quaternion.set(q.x(), q.y(), q.z(), q.w());
      }

      // Remove if fallen too far
      if (mesh.position.y < -10) {
        this.$.scene.remove(mesh);
        this.$.physicsWorld.removeRigidBody(body);
        this.rigidBodies.splice(i, 1);
        i--;
      }
    }
  }

  createBall() {
    const Ammo = this.$.ammo;
    const radius = 0.3;
    const mass = 1;

    // Visual mesh
    const geometry = new this.THREE.SphereGeometry(radius, 16, 16);
    const material = new this.THREE.MeshStandardMaterial({
      color: Math.random() * 0xffffff
    });
    const mesh = new this.THREE.Mesh(geometry, material);
    mesh.position.set(
      (Math.random() - 0.5) * 4,
      5,
      (Math.random() - 0.5) * 4
    );
    this.$.scene.add(mesh);

    // Physics body
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new Ammo.btVector3(
      mesh.position.x,
      mesh.position.y,
      mesh.position.z
    ));

    const shape = new Ammo.btSphereShape(radius);
    const localInertia = new Ammo.btVector3(0, 0, 0);
    shape.calculateLocalInertia(mass, localInertia);

    const motionState = new Ammo.btDefaultMotionState(transform);
    const rbInfo = new Ammo.btRigidBodyConstructionInfo(
      mass, motionState, shape, localInertia
    );
    const body = new Ammo.btRigidBody(rbInfo);
    this.$.physicsWorld.addRigidBody(body);

    mesh.userData.physicsBody = body;
    this.rigidBodies.push(mesh);
  }
}
```

### Example 5: Emotion Cycle

```javascript
class Scenario {
  constructor(ctx) {
    this.$ = ctx.scope;
    this.THREE = ctx.THREE;
    this.emotions = ['happy', 'sad', 'angry', 'relaxed', 'neutral'];
    this.currentEmotion = 0;
    this.emotionTimer = 0;
    this.emotionDuration = 3;  // 3 seconds per emotion
  }

  async setup() {
    await this.$.loadVrm('/vrm/AvatarSample_B.vrm', (progress) => {
      console.log('Loading:', progress);
    });
  }

  update(delta) {
    this.emotionTimer += delta;

    if (this.emotionTimer >= this.emotionDuration) {
      // Switch to next emotion
      this.currentEmotion = (this.currentEmotion + 1) % this.emotions.length;
      const emotion = this.emotions[this.currentEmotion];

      console.log('Triggering emotion:', emotion);
      this.$.triggerEmotion(emotion, this.emotionDuration);

      this.emotionTimer = 0;
    }
  }
}
```

---

## Hook System

The Hook System allows you to intercept and modify various pipeline stages including user input, LLM requests/responses, TTS generation, vision processing, and more.

### Available Hooks

```javascript
// User message hooks
'before:user:message:receive'  // Before processing user message
'after:user:message:receive'   // After processing user message

// LLM hooks
'before:llm:request'           // Before sending to LLM
'on:llm:chunk'                 // Each chunk received from LLM
'after:llm:complete'           // After LLM completes

// TTS hooks
'before:tts:generate'          // Before generating speech
'after:tts:generate'           // After generating speech

// Vision hooks
'before:vision:capture'        // Before vision capture
'after:vision:response'        // After vision response

// STT hooks
'before:stt:process'           // Before speech-to-text
'after:stt:result'             // After speech-to-text
```

### Registering Hooks

```javascript
// Basic hook registration
const hookId = this.hookManager.register(
  'before:llm:request',
  (context) => {
    console.log('LLM request:', context);
    // Modify context if needed
    return context;
  }
);

// Hook with options
const hookId = this.hookManager.register(
  'after:llm:complete',
  (context) => {
    console.log('Response:', context.response);
    return context;
  },
  {
    priority: 100,    // Higher = runs later
    condition: (ctx) => ctx.response.length > 100,  // Conditional
    timeout: 5000     // Max execution time (ms)
  }
);
```

### Hook Context Examples

```javascript
// before:user:message:receive
{
  message: "Hello!",
  timestamp: 1234567890
}

// before:llm:request
{
  backend: "chatgpt",
  messages: [...],
  options: {...}
}

// on:llm:chunk
{
  chunk: "Hello ",
  totalChunks: 1
}

// before:tts:generate
{
  text: "Hello there!",
  backend: "openai_tts",
  options: {...}
}

// before:vision:capture
{
  imageData: "data:image/png;base64,...",
  timestamp: 1234567890
}
```

### Unregistering Hooks

```javascript
// Store hook IDs
this.hookIds = [];

// In setup()
const hookId = this.hookManager.register(...);
this.hookIds.push(hookId);

// In cleanup()
this.hookIds.forEach(id => {
  this.hookManager.unregister(id);
});
```

### Hook Metrics

```javascript
// Get metrics for a hook
const metrics = this.hookManager.getMetrics(hookId);
console.log({
  calls: metrics.calls,          // Number of times called
  avgDuration: metrics.avgDuration,  // Average execution time
  errors: metrics.errors         // Number of errors
});
```

---

## Best Practices

### 1. Resource Management

```javascript
// ✅ Good - Clean up resources
async cleanup() {
  this.hookIds.forEach(id => this.hookManager.unregister(id));
  this.rigidBodies.forEach(mesh => {
    this.$.scene.remove(mesh);
    this.$.physicsWorld.removeRigidBody(mesh.userData.physicsBody);
  });
}

// ❌ Bad - Memory leaks
// No cleanup method
```

### 2. Performance

```javascript
// ✅ Good - Efficient update loop
update(delta) {
  this.timer += delta;
  if (this.timer > 1.0) {  // Only once per second
    this.expensiveOperation();
    this.timer = 0;
  }
}

// ❌ Bad - Runs every frame
update(delta) {
  this.expensiveOperation();  // 60 times per second!
}
```

### 3. Error Handling

```javascript
// ✅ Good - Handle errors
async setup() {
  try {
    await this.$.loadVrm('/vrm/model.vrm', console.log);
  } catch (error) {
    console.error('Failed to load VRM:', error);
  }
}

// ❌ Bad - No error handling
async setup() {
  await this.$.loadVrm('/vrm/model.vrm', console.log);
}
```

### 4. Use Delta Time

```javascript
// ✅ Good - Frame-rate independent
update(delta) {
  this.rotation += delta * 1.0;  // 1 radian per second
}

// ❌ Bad - Depends on frame rate
update(delta) {
  this.rotation += 0.016;  // Assumes 60fps
}
```

### 5. Configuration

```javascript
// ✅ Good - Use config system
constructor(ctx) {
  this.$ = ctx.scope;
  this.THREE = ctx.THREE;
  this.config = ctx.config;
}

async setup() {
  const vrmUrl = this.config('vrm_url');
  await this.$.loadVrm(vrmUrl, console.log);
}

// ❌ Bad - Hardcoded values
async setup() {
  await this.$.loadVrm('/vrm/specific-model.vrm', console.log);
}
```

### 6. Logging

```javascript
// ✅ Good - Meaningful logs
console.log('[Scenario] Loading VRM:', url);
console.log('[Scenario] Created', count, 'physics objects');

// ❌ Bad - Spam or no context
console.log('test');
console.log(x);
```

---

## Debugging Tips

### 1. Access Debug System

```javascript
// Enable debug visualizations
this.$.debug.params['show-stats'] = true;
```

### 2. Scene Inspection

```javascript
// List all scene objects
console.log('Scene children:', this.$.scene.children);

// Get model info
const model = this.$.getModel();
console.log('Model:', model);
console.log('VRM:', model?.vrm);
```

### 3. Physics Debugging

```javascript
// Log physics world info
console.log('Physics world:', this.$.physicsWorld);
console.log('Rigid bodies:', this.rigidBodies.length);
```

### 4. Performance Monitoring

```javascript
update(delta) {
  const start = performance.now();

  // Your code here

  const elapsed = performance.now() - start;
  if (elapsed > 5) {  // More than 5ms
    console.warn('Slow update:', elapsed, 'ms');
  }
}
```

---

## Advanced Topics

### Custom Animation Loading

```javascript
async setup() {
  const loader = new this.THREE.GLTFLoader();

  loader.load('/animations/custom.glb', (gltf) => {
    const clip = gltf.animations[0];
    this.$.playAnimation(clip);
  });
}
```

### Multi-Character Scenes

```javascript
// Note: Current API supports one VRM at a time
// For multiple characters, you'd need to manually load GLTFs
async setup() {
  const loader = new this.THREE.GLTFLoader();

  loader.load('/models/character2.glb', (gltf) => {
    const character = gltf.scene;
    character.position.set(2, 0, 0);
    this.$.scene.add(character);
  });
}
```

### Procedural Geometry

```javascript
async setup() {
  await this.$.loadVrm('/vrm/model.vrm', console.log);

  // Create procedural terrain
  const size = 20;
  const segments = 50;
  const geometry = new this.THREE.PlaneGeometry(size, size, segments, segments);

  const vertices = geometry.attributes.position.array;
  for (let i = 0; i < vertices.length; i += 3) {
    vertices[i + 2] = Math.sin(vertices[i]) * Math.cos(vertices[i + 1]) * 0.5;
  }
  geometry.computeVertexNormals();

  const material = new this.THREE.MeshStandardMaterial({
    color: 0x228B22,
    wireframe: false
  });
  const terrain = new this.THREE.Mesh(geometry, material);
  terrain.rotation.x = -Math.PI / 2;
  this.$.scene.add(terrain);
}
```

---

## Troubleshooting

### Scenario Not Loading
- Check browser console for errors
- Verify file path in `scenario_url` config
- Ensure class is named `Scenario`
- Check for syntax errors in JavaScript

### Physics Not Working
- Ensure Ammo.js is loaded: `this.$.ammo`
- Check physics world exists: `this.$.physicsWorld`
- Verify rigid bodies are added to world
- Update physics objects in `update()` loop

### Model Not Appearing
- Check VRM loaded successfully in `setup()`
- Verify camera position and orientation
- Check console for loading errors
- Ensure lighting is adequate

### Performance Issues
- Reduce update frequency for expensive operations
- Limit number of physics objects
- Use lower-poly models
- Optimize particle count
- Profile with browser DevTools

---

## Resources

- [Three.js Documentation](https://threejs.org/docs/)
- [Ammo.js Examples](https://github.com/kripken/ammo.js/)
- [VRM Specification](https://vrm.dev/en/)
- [Example Scenarios](/public/scenarios/)

---

## Version History

- **1.0** - Initial documentation
  - Basic API reference
  - Example scenarios
  - Hook system documentation
  - Best practices guide
