import { describe, it, expect, beforeEach } from 'vitest';
import {
  ScenarioTestRunner,
  ScenarioAssertions,
  ScenarioTestUtils,
} from '@/testing/ScenarioTestRunner';

// Import the scenario code
const particleEffectsCode = `
class Scenario {
  constructor(ctx) {
    this.$ = ctx.scope;
    this.THREE = ctx.THREE;
    this.config = ctx.config;

    this.fountainTimer = 0;
    this.fountainInterval = 0.05;
    this.fireworkTimer = 0;
    this.fireworkInterval = 3;
    this.orbitAngle = 0;
    this.colorHue = 0;
  }

  async setup() {
    await this.$.loadVrm(this.config('vrm_url'), console.log);
    this.$.setCameraPosition(0, 1.5, 4);
    this.$.setCameraLookAt(0, 1, 0);
  }

  update(delta) {
    this.fountainTimer += delta;
    this.fireworkTimer += delta;
    this.orbitAngle += delta * 1.0;
    this.colorHue = (this.colorHue + delta * 30) % 360;

    if (this.fountainTimer >= this.fountainInterval) {
      this.createFountainParticle();
      this.fountainTimer = 0;
    }

    if (this.fireworkTimer >= this.fireworkInterval) {
      this.createFirework();
      this.fireworkTimer = 0;
    }

    this.createOrbitingParticle();
  }

  createFountainParticle() {
    const position = new this.THREE.Vector3(0, 0, 0);
    const velocity = new this.THREE.Vector3(0, 2, 0);
    const color = new this.THREE.Color().setHSL(this.colorHue / 360, 1.0, 0.5);

    this.$.createParticle({
      position,
      velocity,
      color,
      size: 0.05,
      lifetime: 1.5
    });
  }

  createFirework() {
    const burstPos = new this.THREE.Vector3(0, 2, 0);
    const particleCount = 20;

    for (let i = 0; i < particleCount; i++) {
      const velocity = new this.THREE.Vector3(
        Math.random() - 0.5,
        Math.random(),
        Math.random() - 0.5
      );
      this.$.createParticle({
        position: burstPos,
        velocity,
        color: new this.THREE.Color(0xff0000),
        size: 0.08,
        lifetime: 1.0
      });
    }
  }

  createOrbitingParticle() {
    const x = Math.cos(this.orbitAngle) * 1.5;
    const z = Math.sin(this.orbitAngle) * 1.5;
    const position = new this.THREE.Vector3(x, 1.2, z);
    const velocity = new this.THREE.Vector3(0, 0, 0);

    this.$.createParticle({
      position,
      velocity,
      color: new this.THREE.Color(0x00ff00),
      size: 0.06,
      lifetime: 0.5
    });
  }
}`;

describe('Particle Effects Scenario', () => {
  let runner: ScenarioTestRunner;
  let ParticleEffectsScenario: any;

  beforeEach(() => {
    // Load scenario from code
    ParticleEffectsScenario = ScenarioTestUtils.loadScenarioFromCode(particleEffectsCode);
    runner = new ScenarioTestRunner(ParticleEffectsScenario);
  });

  describe('setup', () => {
    it('should load VRM model', async () => {
      await runner.setup();
      ScenarioAssertions.assertVrmLoaded(runner, '/vrm/test.vrm');
    });

    it('should position camera correctly', async () => {
      await runner.setup();
      ScenarioAssertions.assertCameraPosition(runner, { x: 0, y: 1.5, z: 4 });
    });
  });

  describe('particle generation', () => {
    beforeEach(async () => {
      await runner.setup();
    });

    it('should create fountain particles periodically', () => {
      const scope = runner.getScope();

      // Run for 1 second (should create ~20 fountain particles)
      runner.updateForDuration(1.0);

      // Fountain interval is 0.05s, so in 1s we get ~20 particles
      // Plus orbiting particles (1 per frame)
      // Plus potentially 1 firework (every 3s)
      expect(scope.createParticle).toHaveBeenCalled();
      const callCount = (scope.createParticle as any).mock.calls.length;
      expect(callCount).toBeGreaterThan(20); // At least fountain particles
    });

    it('should create firework burst after interval', () => {
      const scope = runner.getScope();

      // Fast-forward to just before firework
      runner.updateForDuration(2.9);
      const beforeCalls = (scope.createParticle as any).mock.calls.length;

      // Trigger firework
      runner.update(0.2); // Total: 3.1s

      const afterCalls = (scope.createParticle as any).mock.calls.length;

      // Firework creates 20 particles at once
      expect(afterCalls - beforeCalls).toBeGreaterThanOrEqual(20);
    });

    it('should create orbiting particles every frame', () => {
      const scope = runner.getScope();

      runner.updateFrames(10);

      // At least 10 orbiting particles (plus fountain particles)
      const callCount = (scope.createParticle as any).mock.calls.length;
      expect(callCount).toBeGreaterThanOrEqual(10);
    });

    it('should create particles with correct properties', () => {
      const scope = runner.getScope();

      runner.update(0.016);

      // Check that particles have required properties
      const firstCall = (scope.createParticle as any).mock.calls[0][0];
      expect(firstCall).toHaveProperty('position');
      expect(firstCall).toHaveProperty('velocity');
      expect(firstCall).toHaveProperty('color');
      expect(firstCall).toHaveProperty('size');
      expect(firstCall).toHaveProperty('lifetime');
    });
  });

  describe('animation state', () => {
    beforeEach(async () => {
      await runner.setup();
    });

    it('should update orbit angle over time', () => {
      const scenario = runner.getScenario();
      const initialAngle = scenario.orbitAngle;

      runner.updateForDuration(1.0);

      expect(scenario.orbitAngle).toBeGreaterThan(initialAngle);
      expect(scenario.orbitAngle).toBeCloseTo(1.0, 1); // ~1 radian per second
    });

    it('should cycle color hue', () => {
      const scenario = runner.getScenario();

      runner.updateForDuration(12); // 12 seconds = full cycle at 30/s

      // Should wrap around 360
      expect(scenario.colorHue).toBeLessThan(360);
      expect(scenario.colorHue).toBeGreaterThanOrEqual(0);
    });
  });

  describe('performance', () => {
    beforeEach(async () => {
      await runner.setup();
    });

    it('should run efficiently for many frames', () => {
      const perf = ScenarioTestUtils.measureUpdatePerformance(runner, 100);

      // Update should be very fast (< 1ms per frame)
      expect(perf.avgMs).toBeLessThan(1);
      expect(perf.maxMs).toBeLessThan(5);
    });

    it('should handle rapid updates without errors', () => {
      expect(() => {
        runner.updateFrames(1000, 0.001); // 1000 rapid frames
      }).not.toThrow();
    });
  });
});
