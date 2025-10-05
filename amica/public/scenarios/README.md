# Amica Scenario Examples

This directory contains example scenarios demonstrating the capabilities of the Amica Scenario System.

## Available Scenarios

### 1. **test1.js** - Basic VRM Loader
A simple scenario that loads a VRM model and optionally a room environment. Good starting point for understanding scenario structure.

**Features:**
- VRM model loading
- Room loading (commented examples included)
- Progress tracking

**Usage:**
```toml
scenario_url = "/scenarios/test1.js"
```

---

### 2. **test2.js** - Physics Demo
Demonstrates Ammo.js physics integration with falling spheres and a static floor.

**Features:**
- Physics simulation
- Rigid body creation
- Ball spawning at regular intervals
- Motion state synchronization

**Usage:**
```toml
scenario_url = "/scenarios/test2.js"
```

---

### 3. **hooks-example.js** - Hook System Demo
Comprehensive example of the Hook System for intercepting and monitoring pipeline stages.

**Features:**
- User message hooks
- LLM request/response hooks
- TTS generation hooks
- Vision processing hooks
- Performance metrics tracking
- Conditional hooks

**Usage:**
```toml
scenario_url = "/scenarios/hooks-example.js"
```

**Learn More:** See Hook System section in [SCENARIO_SYSTEM.md](../../docs/SCENARIO_SYSTEM.md#hook-system)

---

### 4. **particle-effects.js** - Particle System Demo
Interactive particle effects showcasing the particle system with various visual effects.

**Features:**
- Continuous particle fountain
- Firework burst effects
- Orbiting particles around character
- Color-cycling particle trails
- Dynamic particle properties

**Usage:**
```toml
scenario_url = "/scenarios/particle-effects.js"
```

**Preview:**
- 💦 Fountain effect at character's feet
- 💥 Periodic firework bursts
- 🌈 Color-changing orbiting particles

---

### 5. **dynamic-lighting.js** - Lighting and Mood Demo
Advanced lighting demonstration with day/night cycles and mood-based effects.

**Features:**
- Day/night cycle (30-second cycle)
- Dynamic ambient lighting
- Pulsing spotlight
- Orbiting colored point lights
- Lightning flash effects (nighttime only)
- Mood-based lighting synced with character emotions

**Usage:**
```toml
scenario_url = "/scenarios/dynamic-lighting.js"
```

**Preview:**
- 🌅 Smooth day/night transitions
- ⚡ Random lightning strikes at night
- 😊 Mood changes every 5 seconds with matching lights
- 💡 Three orbiting RGB lights

---

### 6. **camera-animation.js** - Camera Animation Demo
Showcases various camera movement and animation techniques.

**Features:**
- **Orbit Mode:** Camera circles around character
- **Preset Mode:** Smooth transitions between camera positions
- **Dolly Zoom:** Vertigo effect with dynamic FOV
- **Shake Mode:** Camera shake effect with increasing intensity
- **Follow Mode:** Smooth camera that tracks character's head

**Usage:**
```toml
scenario_url = "/scenarios/camera-animation.js"
```

**Preview:**
- 🎥 5 different camera modes
- 🔄 Modes switch every 8 seconds
- 📹 Smooth easing and interpolation

---

### 7. **physics-playground.js** - Advanced Physics Demo
Comprehensive physics demonstration with multiple interactive demos.

**Features:**
- **Falling Demo:** Random objects (spheres, boxes, cylinders) spawn and fall
- **Stacking Demo:** Builds a tower of colored blocks
- **Pendulum Demo:** Newton's cradle-style pendulum simulation
- **Dominoes Demo:** Chain reaction with 15 dominoes

**Usage:**
```toml
scenario_url = "/scenarios/physics-playground.js"
```

**Preview:**
- 🎮 4 different physics demos
- 🔄 Demos switch every 15 seconds
- 🎯 Automatic cleanup and transitions
- 🎨 Colorful objects with realistic physics

---

## Quick Start

1. **Choose a scenario** from the list above
2. **Update your config** file to point to the scenario:
   ```toml
   scenario_url = "/scenarios/<scenario-name>.js"
   ```
3. **Reload Amica** to load the new scenario
4. **Check the console** for scenario logs and status

## Creating Your Own Scenario

See the comprehensive [SCENARIO_SYSTEM.md](../../docs/SCENARIO_SYSTEM.md) documentation for:
- Full API reference
- Best practices
- Debugging tips
- Advanced techniques

### Minimal Template

```javascript
class Scenario {
  constructor(ctx) {
    this.$ = ctx.scope;
    this.THREE = ctx.THREE;
    this.config = ctx.config;
  }

  async setup() {
    await this.$.loadVrm(this.config('vrm_url'), console.log);
  }

  update(delta) {
    // Your animation code here
  }

  async cleanup() {
    // Optional cleanup
  }
}
```

## Combining Features

You can combine features from multiple scenarios:

```javascript
class Scenario {
  constructor(ctx) {
    this.$ = ctx.scope;
    this.THREE = ctx.THREE;
    this.config = ctx.config;

    // From camera-animation.js
    this.orbitAngle = 0;
    this.orbitSpeed = 0.3;

    // From particle-effects.js
    this.colorHue = 0;
  }

  async setup() {
    await this.$.loadVrm(this.config('vrm_url'), console.log);

    // From dynamic-lighting.js
    const light = new this.THREE.PointLight(0xffffff, 1, 10);
    light.position.set(0, 2, 0);
    this.$.addLight(light);
  }

  update(delta) {
    // From camera-animation.js: Orbit camera
    this.orbitAngle += delta * this.orbitSpeed;
    const x = Math.cos(this.orbitAngle) * 4;
    const z = Math.sin(this.orbitAngle) * 4;
    this.$.setCameraPosition(x, 1.5, z);
    this.$.setCameraLookAt(0, 1, 0);

    // From particle-effects.js: Create particles
    this.colorHue = (this.colorHue + delta * 30) % 360;
    const color = new this.THREE.Color().setHSL(this.colorHue / 360, 1.0, 0.5);

    if (Math.random() < 0.1) { // 10% chance per frame
      this.$.createParticle({
        position: new this.THREE.Vector3(0, 1, 0),
        velocity: new this.THREE.Vector3(
          (Math.random() - 0.5) * 2,
          Math.random() * 2,
          (Math.random() - 0.5) * 2
        ),
        color,
        size: 0.05,
        lifetime: 2.0
      });
    }
  }
}
```

## Troubleshooting

### Scenario not loading?
- Check browser console for errors
- Verify `scenario_url` path in config
- Ensure class is named `Scenario`
- Check JavaScript syntax

### Physics not working?
- Verify Ammo.js is loaded: check `this.$.ammo`
- Ensure physics world exists: check `this.$.physicsWorld`
- Add objects to physics world with `addRigidBody()`

### Performance issues?
- Reduce particle count or spawn rate
- Limit physics objects
- Throttle expensive operations (run once per second instead of per frame)
- Use performance.now() to profile slow code

## Resources

- [Full Scenario System Documentation](../../docs/SCENARIO_SYSTEM.md)
- [Three.js Documentation](https://threejs.org/docs/)
- [Ammo.js GitHub](https://github.com/kripken/ammo.js/)
- [VRM Specification](https://vrm.dev/en/)

## Contributing

To add your scenario to this collection:

1. Create a new `.js` file in this directory
2. Add a descriptive header comment with version and description
3. Follow the coding style of existing scenarios
4. Update this README with your scenario's documentation
5. Test thoroughly before submitting

---

**Last Updated:** 2025-10-05
**Version:** 1.0
