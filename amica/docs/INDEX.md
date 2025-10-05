# Amica Scenario System - Complete Index

This is your one-stop reference for all scenario-related documentation.

## 📁 File Structure

```
amica/
├── docs/                                  # All documentation
│   ├── README.md                          # Documentation hub
│   ├── SCENARIO_GETTING_STARTED.md        # Tutorial (start here!)
│   ├── SCENARIO_SYSTEM.md                 # API reference
│   ├── SCENARIO_TESTING.md                # Testing guide
│   └── SCENARIO_QUICK_REFERENCE.md        # Cheat sheet
│
├── public/scenarios/                      # Scenario files
│   ├── GETTING_STARTED.md                 # Quick 2-min guide
│   ├── README.md                          # Scenario index
│   ├── _template.js                       # Template for manual creation
│   ├── particle-effects.js                # Example: Particles
│   ├── dynamic-lighting.js                # Example: Lighting
│   ├── camera-animation.js                # Example: Camera
│   └── physics-playground.js              # Example: Physics
│
├── __tests__/scenarios/                   # Test files
│   ├── _template.scenario.spec.ts         # Test template
│   ├── particle-effects.scenario.spec.ts
│   ├── dynamic-lighting.scenario.spec.ts
│   ├── camera-animation.scenario.spec.ts
│   └── physics-playground.scenario.spec.ts
│
├── src/testing/                           # Testing framework
│   └── ScenarioTestRunner.ts              # Test utilities
│
└── scripts/
    └── create-scenario.js                 # Scenario generator
```

## 🚦 Where to Start

### I'm New to Scenarios
👉 **[docs/SCENARIO_GETTING_STARTED.md](SCENARIO_GETTING_STARTED.md)**

### I Need API Docs
👉 **[docs/SCENARIO_SYSTEM.md](SCENARIO_SYSTEM.md)**

### I Need to Write Tests
👉 **[docs/SCENARIO_TESTING.md](SCENARIO_TESTING.md)**

### I Need Quick Snippets
👉 **[docs/SCENARIO_QUICK_REFERENCE.md](SCENARIO_QUICK_REFERENCE.md)**

### I Want to See Examples
👉 **[public/scenarios/](../public/scenarios/)**

## ⚡ Quick Commands

```bash
# Create new scenario
npm run create:scenario my-scenario

# Test scenarios
npm run test:scenarios

# Test specific scenario
npm test -- scenarios/my-scenario

# Run Amica
npm run dev
```

## 📚 Documentation by Topic

### Setup & Creation
- [Getting Started](SCENARIO_GETTING_STARTED.md) - Complete tutorial
- [Quick Start](../public/scenarios/GETTING_STARTED.md) - 2-minute guide
- [Generator](../scripts/create-scenario.js) - CLI tool

### API & Reference
- [System API](SCENARIO_SYSTEM.md) - Full API docs
- [Quick Reference](SCENARIO_QUICK_REFERENCE.md) - Cheat sheet
- [Examples](../public/scenarios/README.md) - Example index

### Testing
- [Testing Guide](SCENARIO_TESTING.md) - Complete testing docs
- [Test Examples](../__tests__/scenarios/) - Working tests
- [Test Template](../__tests__/scenarios/_template.scenario.spec.ts) - Template

### Templates
- [Scenario Template](../public/scenarios/_template.js) - Code template
- [Test Template](../__tests__/scenarios/_template.scenario.spec.ts) - Test template

## 🎯 By Use Case

### "I want to create my first scenario"
1. Read [Getting Started](SCENARIO_GETTING_STARTED.md) (15 min)
2. Run `npm run create:scenario my-first-scenario`
3. Edit generated file
4. Test with `npm test -- scenarios/my-first-scenario`

### "I need to add physics to my scenario"
1. Check [Quick Reference](SCENARIO_QUICK_REFERENCE.md#physics)
2. Look at [physics-playground.js](../public/scenarios/physics-playground.js)
3. See [API docs](SCENARIO_SYSTEM.md#physics-ammojs)

### "I want to add particles"
1. Check [Quick Reference](SCENARIO_QUICK_REFERENCE.md#particles)
2. Look at [particle-effects.js](../public/scenarios/particle-effects.js)
3. See [API docs](SCENARIO_SYSTEM.md#particle-system)

### "I need to test my scenario"
1. Read [Testing Guide](SCENARIO_TESTING.md)
2. Copy [test template](../__tests__/scenarios/_template.scenario.spec.ts)
3. Look at [test examples](../__tests__/scenarios/)

### "I want to animate the camera"
1. Check [Quick Reference](SCENARIO_QUICK_REFERENCE.md#camera)
2. Look at [camera-animation.js](../public/scenarios/camera-animation.js)
3. See [API docs](SCENARIO_SYSTEM.md#camera-control)

### "I need to add custom lighting"
1. Check [Quick Reference](SCENARIO_QUICK_REFERENCE.md#lighting)
2. Look at [dynamic-lighting.js](../public/scenarios/dynamic-lighting.js)
3. See [API docs](SCENARIO_SYSTEM.md#lighting-control)

## 🔍 Quick Lookups

### Scenario Structure
```javascript
class Scenario {
  constructor(ctx) { }
  async setup() { }
  update(delta) { }
  async cleanup() { }
}
```

### Available APIs
- `this.$` - SceneCoordinator (main API)
- `this.THREE` - Three.js library
- `this.config()` - Configuration
- `this.hookManager` - Hook system

### Common Methods
- `loadVrm()` - Load character
- `setCameraPosition()` - Move camera
- `addLight()` - Add lighting
- `createParticle()` - Create particles
- `physicsWorld.addRigidBody()` - Add physics

See [Quick Reference](SCENARIO_QUICK_REFERENCE.md) for complete list.

## 📖 Full Documentation List

### Main Documentation
1. **[README.md](README.md)** - Documentation hub
2. **[SCENARIO_GETTING_STARTED.md](SCENARIO_GETTING_STARTED.md)** - Tutorial
3. **[SCENARIO_SYSTEM.md](SCENARIO_SYSTEM.md)** - API reference
4. **[SCENARIO_TESTING.md](SCENARIO_TESTING.md)** - Testing
5. **[SCENARIO_QUICK_REFERENCE.md](SCENARIO_QUICK_REFERENCE.md)** - Cheat sheet

### Scenario Documentation
6. **[../public/scenarios/GETTING_STARTED.md](../public/scenarios/GETTING_STARTED.md)** - Quick start
7. **[../public/scenarios/README.md](../public/scenarios/README.md)** - Example index

### Examples & Templates
8. **[../public/scenarios/_template.js](../public/scenarios/_template.js)** - Code template
9. **[../__tests__/scenarios/_template.scenario.spec.ts](../__tests__/scenarios/_template.scenario.spec.ts)** - Test template
10. **[../public/scenarios/particle-effects.js](../public/scenarios/particle-effects.js)** - Example
11. **[../public/scenarios/dynamic-lighting.js](../public/scenarios/dynamic-lighting.js)** - Example
12. **[../public/scenarios/camera-animation.js](../public/scenarios/camera-animation.js)** - Example
13. **[../public/scenarios/physics-playground.js](../public/scenarios/physics-playground.js)** - Example

## 🎓 Learning Paths

### Path 1: Fast Track (30 minutes)
1. Skim [Quick Reference](SCENARIO_QUICK_REFERENCE.md) - 5 min
2. Run `npm run create:scenario test` - 2 min
3. Look at generated code - 5 min
4. Check one [example](../public/scenarios/particle-effects.js) - 10 min
5. Test it - 5 min
6. Customize it - ∞

### Path 2: Comprehensive (2 hours)
1. Read [Getting Started](SCENARIO_GETTING_STARTED.md) - 30 min
2. Complete bouncing ball example - 30 min
3. Read [API Reference](SCENARIO_SYSTEM.md) - 30 min
4. Read [Testing Guide](SCENARIO_TESTING.md) - 20 min
5. Create your own - ∞

### Path 3: Example-Driven (1 hour)
1. Look at [particle-effects.js](../public/scenarios/particle-effects.js) - 15 min
2. Look at [dynamic-lighting.js](../public/scenarios/dynamic-lighting.js) - 15 min
3. Look at [camera-animation.js](../public/scenarios/camera-animation.js) - 15 min
4. Look at [physics-playground.js](../public/scenarios/physics-playground.js) - 15 min
5. Mix & match for your scenario - ∞

## 💡 Tips

- Use `npm run create:scenario` - saves time!
- Check examples for patterns
- Use Quick Reference while coding
- Test as you build
- Read error messages carefully

## 🆘 Troubleshooting

**Scenario not loading?**
→ Check [Getting Started - Troubleshooting](SCENARIO_GETTING_STARTED.md#troubleshooting)

**Tests failing?**
→ Check [Testing Guide - Troubleshooting](SCENARIO_TESTING.md#troubleshooting)

**Physics not working?**
→ Check [API Docs - Physics](SCENARIO_SYSTEM.md#physics-ammojs)

**Need API help?**
→ Check [Quick Reference](SCENARIO_QUICK_REFERENCE.md)

---

**Last Updated:** 2025-10-05
**Version:** 1.0
