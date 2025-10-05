# Rapier.js Migration Plan

## Executive Summary

This document outlines the plan to migrate from Ammo.js to Rapier.js as the primary physics engine for Amica scenarios.

**Status:** Planning
**Target Completion:** TBD
**Priority:** Medium (Performance & Maintainability Improvement)

---

## Table of Contents

1. [Why Migrate?](#why-migrate)
2. [Migration Strategy](#migration-strategy)
3. [Implementation Phases](#implementation-phases)
4. [Technical Changes](#technical-changes)
5. [Breaking Changes & Compatibility](#breaking-changes--compatibility)
6. [Testing Strategy](#testing-strategy)
7. [Timeline & Milestones](#timeline--milestones)
8. [Rollback Plan](#rollback-plan)

---

## Why Migrate?

### Current Issues with Ammo.js

❌ **No longer actively maintained**
- Last significant update: Years ago
- Known bugs won't be fixed
- No new features or optimizations

❌ **Poor TypeScript support**
- No native types
- Community types are incomplete
- Difficult to work with in modern codebases

❌ **Performance limitations**
- Single-constraint SIMD optimization
- Larger bundle size
- Slower than modern alternatives

❌ **Older technology**
- Based on Bullet physics (C++ from 2000s)
- WASM compilation is outdated
- Not optimized for modern web

### Benefits of Rapier.js

✅ **5-8x faster performance**
- Rust + WASM with modern optimizations
- AoSoA SIMD (4 constraints at once)
- Comparable to PhysX

✅ **Native TypeScript support**
- Full type definitions included
- Modern, type-safe API
- Better developer experience

✅ **Actively maintained**
- Regular updates (2024-2025)
- Active community
- Bug fixes and improvements

✅ **Modern architecture**
- Written in Rust (2019+)
- Optimized for WebAssembly
- Cross-platform determinism
- Better memory management

✅ **Smaller bundle size**
- More efficient WASM
- Better compression
- Faster load times

✅ **Better features**
- Character controllers
- Improved collision detection
- Better constraint system
- More stable simulations

---

## Migration Strategy

### Approach: **Gradual, Non-Breaking Migration**

We will **NOT** do a hard cutover. Instead:

1. **Add Rapier.js alongside Ammo.js** (dual support)
2. **Update scenario system** to support both engines
3. **Migrate examples** to Rapier.js
4. **Document migration path** for users
5. **Deprecate Ammo.js** gradually (6-12 months)
6. **Remove Ammo.js** eventually (12+ months)

This ensures:
- ✅ No breaking changes for existing scenarios
- ✅ Users have time to migrate
- ✅ We can test thoroughly
- ✅ Rollback is easy if issues arise

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Goals:**
- Install Rapier.js
- Create physics abstraction layer
- Update SceneCoordinator

**Tasks:**

1. **Install Dependencies**
   ```bash
   npm install @dimforge/rapier3d-compat
   # -compat version for broader browser support
   ```

2. **Create Physics Abstraction Layer**
   ```
   src/features/scene3d/physics/
   ├── PhysicsEngine.ts           # Interface
   ├── AmmoPhysicsEngine.ts       # Ammo.js implementation
   ├── RapierPhysicsEngine.ts     # Rapier.js implementation
   └── PhysicsFactory.ts          # Factory to create engines
   ```

3. **Update SceneCoordinator**
   - Add physics engine selection
   - Expose unified API
   - Maintain backward compatibility

4. **Update Configuration**
   ```toml
   # New config option
   physics_engine = "rapier"  # or "ammo" for legacy
   ```

**Deliverables:**
- [ ] Rapier.js installed
- [ ] Physics abstraction layer created
- [ ] Tests passing
- [ ] Documentation updated

---

### Phase 2: API Compatibility Layer (Week 2-3)

**Goals:**
- Create unified physics API
- Both engines work through same interface
- Scenarios can use either engine

**Tasks:**

1. **Define Common Physics API**
   ```typescript
   interface PhysicsEngine {
     initialize(): Promise<void>;
     createRigidBody(config: RigidBodyConfig): RigidBody;
     createCollider(config: ColliderConfig): Collider;
     addRigidBody(body: RigidBody): void;
     removeRigidBody(body: RigidBody): void;
     step(deltaTime: number): void;
     // ... more methods
   }
   ```

2. **Implement Ammo.js Wrapper**
   - Wrap existing Ammo.js code
   - Conform to new interface
   - Maintain exact same behavior

3. **Implement Rapier.js Wrapper**
   - Use Rapier.js API
   - Conform to same interface
   - Match Ammo.js behavior where possible

4. **Update PhysicsSystem**
   - Use physics engine abstraction
   - Support switching engines
   - Graceful fallback

**Deliverables:**
- [ ] Unified physics API defined
- [ ] Ammo.js wrapper complete
- [ ] Rapier.js wrapper complete
- [ ] Tests for both engines
- [ ] Documentation for API

---

### Phase 3: SceneCoordinator Integration (Week 3-4)

**Goals:**
- Expose physics engine choice to scenarios
- Update scenario context
- Backward compatible API

**Tasks:**

1. **Update Scenario Context**
   ```javascript
   // Old way (still works)
   const Ammo = this.$.ammo;
   const physicsWorld = this.$.physicsWorld;

   // New way (recommended)
   const physics = this.$.physics;
   physics.createRigidBody({ ... });
   ```

2. **Add Convenience Methods**
   ```javascript
   // High-level helpers
   this.$.createPhysicsBox({ size, position, mass });
   this.$.createPhysicsSphere({ radius, position, mass });
   this.$.createPhysicsGround({ size, position });
   ```

3. **Update Existing Scenario Examples**
   - Keep Ammo.js versions as legacy
   - Create Rapier.js versions
   - Document differences

**Deliverables:**
- [ ] SceneCoordinator updated
- [ ] New convenience methods
- [ ] Backward compatibility maintained
- [ ] Examples work with both engines

---

### Phase 4: Example Scenarios (Week 4-5)

**Goals:**
- Create Rapier.js versions of all examples
- Show best practices
- Demonstrate performance improvements

**Tasks:**

1. **Create Rapier.js Examples**
   ```
   public/scenarios/
   ├── physics-playground-rapier.js
   ├── particle-effects-rapier.js  (if using physics)
   └── advanced-physics-rapier.js   (new: showcases Rapier features)
   ```

2. **Create Comparison Demo**
   - Side-by-side Ammo vs Rapier
   - Same simulation with both engines
   - Performance metrics shown

3. **Update Example Tests**
   - Tests for Rapier.js examples
   - Performance benchmarks
   - Comparison tests

**Deliverables:**
- [ ] Rapier.js example scenarios
- [ ] Comparison demo
- [ ] Tests for new examples
- [ ] Performance benchmarks

---

### Phase 5: Testing & Validation (Week 5-6)

**Goals:**
- Comprehensive testing
- Performance validation
- Stability verification

**Tasks:**

1. **Unit Tests**
   - Physics engine abstraction
   - Both engine implementations
   - Factory and selection logic

2. **Integration Tests**
   - Scenarios with Rapier.js
   - Scenarios with Ammo.js
   - Switching between engines

3. **Performance Tests**
   ```typescript
   describe('Physics Performance', () => {
     it('Rapier should be faster than Ammo', () => {
       const rapierTime = benchmarkPhysics('rapier', 1000);
       const ammoTime = benchmarkPhysics('ammo', 1000);

       expect(rapierTime).toBeLessThan(ammoTime);
     });
   });
   ```

4. **Visual Tests**
   - Same simulation with both engines
   - Results should be visually similar
   - No regressions

5. **Load Tests**
   - Many physics objects
   - Complex scenes
   - Memory usage

**Deliverables:**
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Performance benchmarks documented
- [ ] Visual validation complete

---

### Phase 6: Documentation (Week 6-7)

**Goals:**
- Complete documentation
- Migration guide
- Best practices

**Tasks:**

1. **Update Scenario Documentation**
   ```
   docs/
   ├── PHYSICS_ENGINES.md          # Comparison & choosing
   ├── RAPIER_GUIDE.md             # Rapier.js guide
   ├── AMMO_TO_RAPIER.md           # Migration guide
   └── SCENARIO_SYSTEM.md          # Updated with physics info
   ```

2. **Create Migration Guide**
   - Step-by-step instructions
   - Code examples
   - Common patterns
   - Troubleshooting

3. **Update API Reference**
   - Document new physics API
   - Show both old and new ways
   - Deprecation warnings

4. **Create Video Tutorial** (optional)
   - Migrating a scenario
   - Performance comparison
   - Best practices

**Deliverables:**
- [ ] Physics engines comparison doc
- [ ] Rapier.js guide
- [ ] Migration guide
- [ ] Updated API docs
- [ ] Video tutorial (optional)

---

### Phase 7: Generator Updates (Week 7)

**Goals:**
- Update scenario generator
- Generate Rapier.js code by default
- Support both engines

**Tasks:**

1. **Update Generator Script**
   ```bash
   npm run create:scenario my-scenario

   # Prompts:
   Use physics? (y/N): y
   Physics engine? (rapier/ammo) [rapier]: rapier
   ```

2. **Update Templates**
   - Rapier.js template (default)
   - Ammo.js template (legacy)
   - Abstract physics template

3. **Update Generated Tests**
   - Test with correct engine
   - Mock correct physics API

**Deliverables:**
- [ ] Generator supports both engines
- [ ] Rapier.js is default
- [ ] Templates updated
- [ ] Generated tests work

---

### Phase 8: Deprecation (Month 3-6)

**Goals:**
- Mark Ammo.js as deprecated
- Encourage migration
- No removal yet

**Tasks:**

1. **Add Deprecation Warnings**
   ```javascript
   if (config('physics_engine') === 'ammo') {
     console.warn(`
       ⚠️ Ammo.js is deprecated and will be removed in v2.0
       Please migrate to Rapier.js for better performance.
       See: docs/AMMO_TO_RAPIER.md
     `);
   }
   ```

2. **Update Documentation**
   - Mark Ammo.js as deprecated
   - Recommend Rapier.js
   - Provide migration timeline

3. **Community Communication**
   - Blog post about migration
   - Discord/forum announcements
   - Migration support

**Deliverables:**
- [ ] Deprecation warnings in place
- [ ] Documentation updated
- [ ] Community informed

---

### Phase 9: Removal (Month 6-12)

**Goals:**
- Remove Ammo.js entirely
- Clean up codebase
- Rapier.js only

**Tasks:**

1. **Remove Ammo.js Code**
   - Delete AmmoPhysicsEngine.ts
   - Remove Ammo.js dependencies
   - Clean up legacy code

2. **Remove Config Option**
   ```toml
   # physics_engine option removed
   # Rapier.js is always used
   ```

3. **Update Documentation**
   - Remove Ammo.js references
   - Simplify docs
   - Archive migration guide

4. **Breaking Changes Release**
   - Version 2.0
   - Breaking change announcement
   - Migration deadline

**Deliverables:**
- [ ] Ammo.js removed
- [ ] Tests passing
- [ ] Documentation updated
- [ ] v2.0 released

---

## Technical Changes

### New File Structure

```
src/features/scene3d/
├── physics/
│   ├── PhysicsEngine.ts              # Interface
│   ├── RapierPhysicsEngine.ts        # Rapier implementation
│   ├── AmmoPhysicsEngine.ts          # Ammo implementation (deprecated)
│   ├── PhysicsFactory.ts             # Create engines
│   ├── RigidBody.ts                  # Unified rigid body
│   ├── Collider.ts                   # Unified collider
│   └── types.ts                      # Shared types
├── PhysicsSystem.ts                  # Updated to use abstraction
└── SceneCoordinator.ts               # Updated API
```

### API Changes

#### Old API (Ammo.js - Still Works)

```javascript
class Scenario {
  async setup() {
    const Ammo = this.$.ammo;
    const world = this.$.physicsWorld;

    // Create rigid body (verbose)
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

    world.addRigidBody(body);
  }
}
```

#### New API (Rapier.js - Recommended)

```javascript
class Scenario {
  async setup() {
    const physics = this.$.physics;

    // Create rigid body (simple)
    const body = physics.createRigidBody({
      type: 'dynamic',
      position: { x: 0, y: 5, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
    });

    const collider = physics.createCollider({
      shape: 'cuboid',
      size: { x: 0.5, y: 0.5, z: 0.5 },
      mass: 1,
      rigidBody: body,
    });
  }
}
```

#### Convenience API (New)

```javascript
class Scenario {
  async setup() {
    // Super simple for common cases
    const box = this.$.createPhysicsBox({
      position: [0, 5, 0],
      size: [1, 1, 1],
      mass: 1,
      material: { friction: 0.5, restitution: 0.7 }
    });

    const sphere = this.$.createPhysicsSphere({
      position: [2, 5, 0],
      radius: 0.5,
      mass: 2
    });

    const ground = this.$.createPhysicsGround({
      size: [10, 10]
    });
  }
}
```

### Configuration Changes

**New Config Option:**

```toml
# .amica/config.toml or /config endpoint

[physics]
engine = "rapier"  # "rapier" or "ammo" (deprecated)
gravity = [0, -9.81, 0]
timestep = 0.016  # Fixed timestep (60fps)
```

**Environment Variable:**

```bash
# For development/testing
VITE_PHYSICS_ENGINE=rapier npm run dev
```

---

## Breaking Changes & Compatibility

### Breaking Changes (v2.0+)

When Ammo.js is removed:

1. **Config option removed**
   - `physics_engine` config no longer exists
   - Rapier.js always used

2. **Direct Ammo.js access removed**
   - `this.$.ammo` will be undefined
   - `this.$.physicsWorld` will be undefined

3. **Legacy scenarios break**
   - Scenarios using Ammo.js API won't work
   - Migration required

### Compatibility Strategy

**Before v2.0 (6-12 months):**
- ✅ Both engines supported
- ✅ Old API works
- ✅ New API available
- ⚠️ Deprecation warnings shown

**Migration Path:**

```javascript
// Option 1: Switch to Rapier.js (recommended)
physics_engine = "rapier"
// Update scenario code to use new API

// Option 2: Keep Ammo.js (deprecated, temporary)
physics_engine = "ammo"
// No code changes needed
// But you'll see deprecation warnings

// Option 3: Use compatibility layer
// Write once, works with both
const physics = this.$.physics;  // Works with both engines
```

---

## Testing Strategy

### Test Coverage

1. **Unit Tests**
   - PhysicsEngine interface
   - RapierPhysicsEngine implementation
   - AmmoPhysicsEngine implementation
   - PhysicsFactory
   - All helper methods

2. **Integration Tests**
   - SceneCoordinator with Rapier
   - SceneCoordinator with Ammo
   - Switching engines
   - Scenario lifecycle

3. **Scenario Tests**
   - All example scenarios
   - Both physics engines
   - Performance benchmarks
   - Visual consistency

4. **Performance Tests**
   ```typescript
   describe('Rapier Performance', () => {
     it('should handle 1000 bodies efficiently', () => {
       const start = performance.now();

       for (let i = 0; i < 1000; i++) {
         physics.createRigidBody({ ... });
       }

       for (let i = 0; i < 60; i++) {
         physics.step(1/60);
       }

       const elapsed = performance.now() - start;
       expect(elapsed).toBeLessThan(1000); // < 1 second
     });
   });
   ```

5. **Regression Tests**
   - Same simulation with both engines
   - Results should be similar
   - No visual regressions

### CI/CD Integration

**GitHub Actions:**

```yaml
name: Physics Tests

on: [push, pull_request]

jobs:
  test-physics:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        physics-engine: [rapier, ammo]

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
        env:
          PHYSICS_ENGINE: ${{ matrix.physics-engine }}

      - name: Performance Benchmarks
        run: npm run benchmark:physics

      - name: Upload Results
        uses: actions/upload-artifact@v3
        with:
          name: physics-benchmarks-${{ matrix.physics-engine }}
          path: benchmarks/
```

---

## Timeline & Milestones

### Estimated Timeline: 7-12 Months

| Phase | Duration | Milestone |
|-------|----------|-----------|
| **Phase 1: Foundation** | 1-2 weeks | Rapier.js installed, abstraction layer created |
| **Phase 2: API Layer** | 1-2 weeks | Unified physics API working |
| **Phase 3: Integration** | 1-2 weeks | SceneCoordinator supports both engines |
| **Phase 4: Examples** | 1-2 weeks | All examples migrated |
| **Phase 5: Testing** | 1-2 weeks | Comprehensive test coverage |
| **Phase 6: Documentation** | 1 week | Complete documentation |
| **Phase 7: Generator** | 1 week | Generator updated |
| **Phase 8: Deprecation** | 3-6 months | Ammo.js marked deprecated |
| **Phase 9: Removal** | 6-12 months | Ammo.js removed (v2.0) |

### Key Milestones

- [ ] **M1:** Rapier.js working (Week 2)
- [ ] **M2:** Both engines supported (Week 4)
- [ ] **M3:** Examples migrated (Week 6)
- [ ] **M4:** Documentation complete (Week 7)
- [ ] **M5:** v1.5 released (Week 8) - Dual support
- [ ] **M6:** Deprecation period starts (Month 3)
- [ ] **M7:** v2.0 released (Month 6-12) - Rapier only

---

## Rollback Plan

### If Issues Arise

**Option 1: Pause Migration**
- Stop at current phase
- Fix issues
- Resume when ready

**Option 2: Rollback to Previous Phase**
- Revert to last stable state
- Keep Ammo.js as default
- Rapier.js optional/experimental

**Option 3: Extend Timeline**
- Delay deprecation
- More testing time
- Community feedback

### Rollback Triggers

Rollback if:
- Major performance regressions
- Critical bugs in Rapier.js
- Community backlash
- Compatibility issues
- Maintenance burden too high

### Safety Measures

1. **Feature Flags**
   ```javascript
   if (config('enable_rapier') === 'true') {
     // Use Rapier.js
   } else {
     // Use Ammo.js
   }
   ```

2. **Version Control**
   - Branch: `feature/rapier-migration`
   - PRs for each phase
   - Easy to revert

3. **Backwards Compatibility**
   - Always maintain Ammo.js support (until v2.0)
   - Default to Ammo.js initially
   - Gradual rollout

4. **User Control**
   - Users can choose engine
   - Easy to switch back
   - No forced migration

---

## Success Criteria

### Technical Success

- [ ] Rapier.js integrated successfully
- [ ] All tests passing
- [ ] Performance improved 3-5x
- [ ] No critical bugs
- [ ] TypeScript types work perfectly

### User Success

- [ ] Migration path is clear
- [ ] Documentation is comprehensive
- [ ] Examples demonstrate benefits
- [ ] Community is supportive
- [ ] No major complaints

### Performance Success

- [ ] 3-5x faster physics simulation
- [ ] Lower memory usage
- [ ] Smaller bundle size
- [ ] Better frame rates

### Code Quality Success

- [ ] Cleaner API
- [ ] Better type safety
- [ ] Maintainable code
- [ ] Good test coverage (>80%)

---

## Risks & Mitigation

### Risk 1: Breaking Existing Scenarios

**Mitigation:**
- Maintain backwards compatibility for 6-12 months
- Provide migration tools
- Clear deprecation warnings
- Comprehensive migration guide

### Risk 2: Performance Regressions

**Mitigation:**
- Extensive benchmarking
- Performance tests in CI
- Comparison with Ammo.js
- Rollback plan ready

### Risk 3: Rapier.js Bugs/Issues

**Mitigation:**
- Thorough testing
- Report issues upstream
- Contribute fixes if needed
- Keep Ammo.js as fallback

### Risk 4: Community Resistance

**Mitigation:**
- Clear communication
- Show performance benefits
- Gradual migration
- Support during transition

### Risk 5: Maintenance Burden

**Mitigation:**
- Don't support both engines forever
- Clear removal timeline
- Automate testing
- Good documentation

---

## Open Questions

1. **Should we support both engines indefinitely?**
   - **Recommendation:** No, remove Ammo.js after 6-12 months

2. **What about existing user scenarios?**
   - **Recommendation:** Provide migration guide, 6-month deprecation notice

3. **Should Rapier.js be opt-in or default?**
   - **Recommendation:** Start opt-in, become default after testing

4. **Bundle size concerns?**
   - **Recommendation:** Lazy-load physics engines, only load what's needed

5. **WASM loading time?**
   - **Recommendation:** Preload during app initialization, show loading progress

---

## Next Steps

1. **Review this plan** with team
2. **Get approval** to proceed
3. **Create GitHub issues** for each phase
4. **Assign tasks**
5. **Start Phase 1**

---

## References

- [Rapier.js Documentation](https://rapier.rs/)
- [Rapier.js GitHub](https://github.com/dimforge/rapier)
- [Rapier.js JavaScript Bindings](https://github.com/dimforge/rapier.js/)
- [Three.js Physics Comparison](https://discourse.threejs.org/t/rapier-vs-cannon-performance/53475)
- [React Three Rapier](https://github.com/pmndrs/react-three-rapier) (reference)

---

**Last Updated:** 2025-10-06
**Status:** Planning
**Owner:** TBD
**Priority:** Medium
