# Amica Scenario Documentation

Complete documentation for creating and testing Amica scenarios.

---

## 📖 Documentation

### 🚀 Getting Started

**[SCENARIO_GETTING_STARTED.md](SCENARIO_GETTING_STARTED.md)**

Complete step-by-step tutorial for creating your first scenario. Start here if you're new!

- Quick start guide
- Understanding scenario structure
- Complete bouncing ball example
- Testing instructions
- Common patterns and best practices

### 📚 API Reference

**[SCENARIO_SYSTEM.md](SCENARIO_SYSTEM.md)**

Complete API documentation for the scenario system.

- Full API reference
- Context object documentation
- Hook system guide
- Best practices
- Advanced topics
- Troubleshooting

### 🧪 Testing Guide

**[SCENARIO_TESTING.md](SCENARIO_TESTING.md)**

How to test your scenarios with the testing framework.

- Test runner API
- Assertion helpers
- Testing patterns
- Performance testing
- CI/CD integration
- Troubleshooting

### 📝 Quick Reference

**[SCENARIO_QUICK_REFERENCE.md](SCENARIO_QUICK_REFERENCE.md)**

Cheat sheet for quick lookups while coding.

- Common API calls
- Code snippets
- Testing examples
- Debugging tips

---

## 🎯 Quick Links

### Create a New Scenario

```bash
npm run create:scenario my-scenario
```

### Example Scenarios

See [../public/scenarios/](../public/scenarios/) for working examples:
- `particle-effects.js`
- `dynamic-lighting.js`
- `camera-animation.js`
- `physics-playground.js`

### Templates

- [Scenario Template](../public/scenarios/_template.js)
- [Test Template](../__tests__/scenarios/_template.scenario.spec.ts)

---

## 📋 Documentation Map

```
docs/
├── README.md                          ← You are here
├── SCENARIO_GETTING_STARTED.md        ← Start here for beginners
├── SCENARIO_SYSTEM.md                 ← Complete API reference
├── SCENARIO_TESTING.md                ← Testing guide
└── SCENARIO_QUICK_REFERENCE.md        ← Cheat sheet

public/scenarios/
├── GETTING_STARTED.md                 ← 2-minute quick start
├── README.md                          ← Scenario index
├── _template.js                       ← Empty template
└── [examples].js                      ← Working examples

__tests__/scenarios/
└── _template.scenario.spec.ts         ← Test template

scripts/
└── create-scenario.js                 ← Scenario generator
```

---

## 🎓 Learning Path

### For Complete Beginners

1. Read [SCENARIO_GETTING_STARTED.md](SCENARIO_GETTING_STARTED.md) (Getting Started)
2. Run `npm run create:scenario my-first-scenario`
3. Edit the generated file
4. Test: `npm test -- scenarios/my-first-scenario`
5. Use [SCENARIO_QUICK_REFERENCE.md](SCENARIO_QUICK_REFERENCE.md) while coding

### For Experienced Developers

1. Skim [SCENARIO_QUICK_REFERENCE.md](SCENARIO_QUICK_REFERENCE.md) (Quick Reference)
2. Check [SCENARIO_SYSTEM.md](SCENARIO_SYSTEM.md) for specific APIs
3. Look at [example scenarios](../public/scenarios/) for patterns
4. Use the generator: `npm run create:scenario`

### For Test Writers

1. Read [SCENARIO_TESTING.md](SCENARIO_TESTING.md) (Testing Guide)
2. Check test examples in `__tests__/scenarios/`
3. Use the test template
4. Run with `npm test -- scenarios`

---

## 🛠️ Common Tasks

### Create a Scenario

```bash
npm run create:scenario bouncing-balls
```

### Test a Scenario

```bash
# All scenarios
npm run test:scenarios

# Specific scenario
npm test -- scenarios/bouncing-balls

# Watch mode
npm run test:watch -- scenarios
```

### Use a Scenario

In your config:
```toml
scenario_url = "/scenarios/bouncing-balls.js"
```

Then:
```bash
npm run dev
```

---

## 📦 What's Included

### Documentation
- ✅ Complete getting started guide
- ✅ Full API reference
- ✅ Testing guide
- ✅ Quick reference cheat sheet

### Tools
- ✅ Interactive scenario generator
- ✅ Test runner with mocks
- ✅ Assertion helpers
- ✅ Performance benchmarking

### Templates
- ✅ Scenario template
- ✅ Test template
- ✅ README template

### Examples
- ✅ 4 complete working scenarios
- ✅ Tests for all examples
- ✅ Various patterns demonstrated

---

## 🔗 External Resources

- [Three.js Documentation](https://threejs.org/docs/)
- [Ammo.js GitHub](https://github.com/kripken/ammo.js/)
- [VRM Specification](https://vrm.dev/en/)
- [Vitest Documentation](https://vitest.dev/)

---

## 💡 Get Help

1. Check this documentation
2. Look at example scenarios
3. Read the test examples
4. Ask in the Amica community
5. Create an issue on GitHub

---

**Happy scenario building!** 🎨✨

Last Updated: 2025-10-05
