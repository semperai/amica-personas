import { describe, it, expect, beforeEach } from 'vitest';
import {
  ScenarioTestRunner,
  ScenarioAssertions,
  ScenarioTestUtils,
} from '@/testing/ScenarioTestRunner';

// Simple test scenario for particle effects
class TestParticleScenario {
  private $: any;
  private THREE: any;
  private config: any;
  private fireworkTimer = 0;
  private fireworkInterval = 4;
  private individualParticleTimer = 0;
  private individualParticleInterval = 0.1;
  private orbitAngle = 0;
  private colorHue = 0;

  constructor(ctx: any) {
    this.$ = ctx.scope;
    this.THREE = ctx.THREE;
    this.config = ctx.config;
  }

  async setup() {
    await this.$.loadVrm(this.config('vrm_url'));
    this.$.setCameraPosition(0, 1.5, 5);
    this.$.setCameraLookAt(0, 1, 0);
  }

  update(delta: number) {
    this.fireworkTimer += delta;
    this.individualParticleTimer += delta;
    this.orbitAngle += delta * 1.0;
    this.colorHue = (this.colorHue + delta * 30) % 360;

    if (this.fireworkTimer >= this.fireworkInterval) {
      this.createFirework();
      this.fireworkTimer = 0;
    }

    if (this.individualParticleTimer >= this.individualParticleInterval) {
      this.createIndividualParticle();
      this.individualParticleTimer = 0;
    }
  }

  createIndividualParticle() {
    const position = new this.THREE.Vector3(0, 1, 0);
    const velocity = new this.THREE.Vector3(
      (Math.random() - 0.5) * 1.5,
      Math.random() * 0.5,
      (Math.random() - 0.5) * 1.5
    );
    const color = new this.THREE.Color().setHSL(this.colorHue / 360, 1.0, 0.6);

    this.$.createParticle({
      position,
      velocity,
      color,
      size: 0.08,
      lifetime: 1.5
    });
  }

  createFirework() {
    const burstPos = new this.THREE.Vector3(0, 2.5, 0);
    const color = new this.THREE.Color().setHSL(Math.random(), 1.0, 0.6);

    this.$.createParticleEffect?.('firework', burstPos, {
      color: color,
      size: 0.1
    });
  }

  async cleanup() {}
}

describe('Particle Effects Scenario', () => {
  let runner: ScenarioTestRunner;

  beforeEach(() => {
    runner = new ScenarioTestRunner(TestParticleScenario);
  });

  describe('setup', () => {
    it('should load VRM model', async () => {
      await runner.setup();
      const scope = runner.getScope();
      expect(scope.loadVrm).toHaveBeenCalledWith('/vrm/test.vrm');
    });

    it('should position camera correctly', async () => {
      await runner.setup();
      ScenarioAssertions.assertCameraPosition(runner, { x: 0, y: 1.5, z: 5 });
    });
  });

  describe('particle generation', () => {
    beforeEach(async () => {
      await runner.setup();
    });

    it('should create individual particles periodically', () => {
      const scope = runner.getScope();

      // Run for 1 second (should create ~10 individual particles)
      runner.updateForDuration(1.0);

      // Individual particle interval is 0.1s, so in 1s we get ~10 particles
      expect(scope.createParticle).toHaveBeenCalled();
      const callCount = (scope.createParticle as any).mock.calls.length;
      expect(callCount).toBeGreaterThanOrEqual(8); // At least 8 particles in 1s
    });

    it('should create firework burst after interval', () => {
      const scope = runner.getScope();

      // Fast-forward to just before firework
      runner.updateForDuration(3.9);
      const beforeCalls = scope.createParticleEffect
        ? (scope.createParticleEffect as any).mock.calls.length
        : 0;

      // Trigger firework
      runner.update(0.2); // Total: 4.1s

      // Check if createParticleEffect was called (new API)
      if (scope.createParticleEffect) {
        const afterCalls = (scope.createParticleEffect as any).mock.calls.length;
        expect(afterCalls).toBeGreaterThan(beforeCalls);
      }
    });

    it('should create particles every frame', () => {
      const scope = runner.getScope();

      runner.updateFrames(10, 0.016);

      // Should have particle calls (1-2 per frame depending on timing)
      const callCount = (scope.createParticle as any).mock.calls.length;
      expect(callCount).toBeGreaterThanOrEqual(1);
    });

    it('should create particles with correct properties', () => {
      const scope = runner.getScope();

      // Run for enough time to trigger a particle (> 0.1s)
      runner.update(0.11);

      // Check that particles have required properties
      expect(scope.createParticle).toHaveBeenCalled();
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
