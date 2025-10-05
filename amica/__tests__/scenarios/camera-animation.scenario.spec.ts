import { describe, it, expect, beforeEach } from 'vitest';
import {
  ScenarioTestRunner,
  ScenarioAssertions,
  ScenarioTestUtils,
} from '@/testing/ScenarioTestRunner';

// Simplified camera animation scenario
const cameraAnimationCode = `
class Scenario {
  constructor(ctx) {
    this.$ = ctx.scope;
    this.THREE = ctx.THREE;
    this.config = ctx.config;

    this.orbitAngle = 0;
    this.orbitRadius = 4;
    this.orbitHeight = 1.5;
    this.orbitSpeed = 0.3;
  }

  async setup() {
    await this.$.loadVrm(this.config('vrm_url'), console.log);
    this.$.setCameraPosition(0, 1.5, 4);
    this.$.setCameraLookAt(0, 1, 0);
  }

  update(delta) {
    this.orbitAngle += delta * this.orbitSpeed;

    const x = Math.cos(this.orbitAngle) * this.orbitRadius;
    const z = Math.sin(this.orbitAngle) * this.orbitRadius;

    this.$.setCameraPosition(x, this.orbitHeight, z);
    this.$.setCameraLookAt(0, 1, 0);
  }
}`;

describe('Camera Animation Scenario', () => {
  let runner: ScenarioTestRunner;
  let CameraAnimationScenario: any;

  beforeEach(() => {
    CameraAnimationScenario = ScenarioTestUtils.loadScenarioFromCode(cameraAnimationCode);
    runner = new ScenarioTestRunner(CameraAnimationScenario);
  });

  describe('setup', () => {
    it('should load VRM model', async () => {
      await runner.setup();
      ScenarioAssertions.assertVrmLoaded(runner);
    });

    it('should set initial camera position', async () => {
      await runner.setup();
      ScenarioAssertions.assertCameraPosition(runner, { x: 0, y: 1.5, z: 4 });
    });

    it('should set camera look-at point', async () => {
      await runner.setup();

      const scope = runner.getScope();
      expect(scope.setCameraLookAt).toHaveBeenCalledWith(0, 1, 0);
    });
  });

  describe('camera orbit', () => {
    beforeEach(async () => {
      await runner.setup();
    });

    it('should update orbit angle over time', () => {
      const scenario = runner.getScenario();
      const initialAngle = scenario.orbitAngle;

      runner.updateForDuration(1.0);

      expect(scenario.orbitAngle).toBeGreaterThan(initialAngle);
      expect(scenario.orbitAngle).toBeCloseTo(0.3, 1); // ~0.3 radians per second
    });

    it('should move camera in circular path', () => {
      const scope = runner.getScope();

      // Move to 90 degrees (π/2)
      const time = (Math.PI / 2) / 0.3; // ~5.24 seconds
      runner.updateForDuration(time);

      const calls = (scope.setCameraPosition as any).mock.calls;
      const lastCall = calls[calls.length - 1];

      // At 90 degrees: x ≈ 0, z ≈ 4
      expect(lastCall[0]).toBeCloseTo(0, 0);
      expect(lastCall[1]).toBe(1.5);
      expect(lastCall[2]).toBeCloseTo(4, 0);
    });

    it('should continuously update camera look-at', () => {
      const scope = runner.getScope();

      runner.updateFrames(10);

      // Should call lookAt every frame
      expect((scope.setCameraLookAt as any).mock.calls.length).toBeGreaterThanOrEqual(10);
    });

    it('should maintain constant orbit radius', () => {
      const scope = runner.getScope();
      const scenario = runner.getScenario();

      runner.updateForDuration(5.0);

      const calls = (scope.setCameraPosition as any).mock.calls;

      // Check multiple frames maintain radius
      for (let i = calls.length - 5; i < calls.length; i++) {
        const [x, y, z] = calls[i];
        const distance = Math.sqrt(x * x + z * z);
        expect(distance).toBeCloseTo(scenario.orbitRadius, 0);
      }
    });
  });

  describe('performance', () => {
    beforeEach(async () => {
      await runner.setup();
    });

    it('should run camera updates efficiently', () => {
      const perf = ScenarioTestUtils.measureUpdatePerformance(runner, 100);

      expect(perf.avgMs).toBeLessThan(1);
      expect(perf.maxMs).toBeLessThan(5);
    });

    it('should handle continuous updates without errors', () => {
      expect(() => {
        runner.updateFrames(1000);
      }).not.toThrow();
    });
  });
});
