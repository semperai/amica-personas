# Create Your First Amica Scenario

## 🚀 Quick Start (2 minutes)

### 1. Generate Your Scenario

```bash
cd amica
npm run create:scenario my-awesome-scenario
```

The generator will ask a few questions and create:
- ✅ Scenario file
- ✅ Test file
- ✅ Documentation

### 2. Edit Your Scenario

Open `public/scenarios/my-awesome-scenario.js` and customize it!

The template includes helpful comments showing you where to add:
- State variables
- Resource loading
- Camera setup
- Lighting
- Physics
- Your custom logic

### 3. Test Your Scenario

```bash
npm test -- scenarios/my-awesome-scenario
```

### 4. Run Your Scenario

Update your config:
```toml
scenario_url = "/scenarios/my-awesome-scenario.js"
```

Then start Amica:
```bash
npm run dev
```

That's it! 🎉

---

## 📚 Learn More

### Complete Guides

- **[Getting Started Tutorial](../../docs/SCENARIO_GETTING_STARTED.md)** - Step-by-step walkthrough
- **[API Documentation](../../docs/SCENARIO_SYSTEM.md)** - Complete API reference
- **[Testing Guide](../../docs/SCENARIO_TESTING.md)** - How to test scenarios
- **[Quick Reference](../../docs/SCENARIO_QUICK_REFERENCE.md)** - Common patterns cheat sheet

### Example Scenarios

Browse working examples in this directory:

- `particle-effects.js` - Particle system demo
- `dynamic-lighting.js` - Advanced lighting
- `camera-animation.js` - Camera movements
- `physics-playground.js` - Physics simulation
- `_template.js` - Empty template

---

## 💡 Need Help?

1. Check the [examples](.) in this directory
2. Read the [full documentation](../../docs/SCENARIO_SYSTEM.md)
3. Look at the [test examples](../../__tests__/scenarios/)
4. Ask in the Amica community

---

**Happy scenario building!** 🎨✨
