import { describe, it, expect, beforeEach } from 'vitest';
import {
  ScenarioTestRunner,
  ScenarioAssertions,
  ScenarioTestUtils,
} from '@/testing/ScenarioTestRunner';
import * as THREE from 'three';

// Simplified dynamic lighting scenario
const dynamicLightingCode = `
class Scenario {
  constructor(ctx) {
    this.$ = ctx.scope;
    this.THREE = ctx.THREE;
    this.config = ctx.config;

    this.ambientLight = null;
    this.spotlight = null;
    this.orbitLights = [];

    this.timeOfDay = 0;
    this.dayDuration = 30;
    this.orbitAngle = 0;
    this.orbitSpeed = 0.5;
  }

  async setup() {
    await this.$.loadVrm(this.config('vrm_url'), console.log);
    this.$.setCameraPosition(0, 1.5, 4);
    this.$.setCameraLookAt(0, 1, 0);

    this.setupLights();
  }

  setupLights() {
    this.ambientLight = new this.THREE.AmbientLight(0xffffff, 0.4);
    this.$.addLight(this.ambientLight);

    this.spotlight = new this.THREE.SpotLight(0xffffff, 1.5);
    this.spotlight.position.set(0, 3, 1);
    this.$.addLight(this.spotlight);

    const lightColors = [0xff0000, 0x00ff00, 0x0000ff];
    lightColors.forEach((color, i) => {
      const light = new this.THREE.PointLight(color, 0.6, 8);
      this.$.addLight(light);
      this.orbitLights.push({
        light,
        angleOffset: (i / lightColors.length) * Math.PI * 2,
        radius: 2,
        height: 1 + i * 0.5
      });
    });
  }

  update(delta) {
    this.updateDayNightCycle(delta);
    this.updateOrbitingLights(delta);
  }

  updateDayNightCycle(delta) {
    this.timeOfDay += delta / this.dayDuration;
    if (this.timeOfDay > 1) {
      this.timeOfDay -= 1;
    }

    const sunAngle = this.timeOfDay * Math.PI * 2;
    const sunHeight = Math.sin(sunAngle);

    let color, intensity;
    if (sunHeight > 0) {
      const t = sunHeight;
      color = new this.THREE.Color().setHSL(0.15, 0.3, 0.5 + t * 0.3);
      intensity = 0.4 + t * 0.4;
    } else {
      const t = -sunHeight;
      color = new this.THREE.Color().setHSL(0.6, 0.5, 0.1 + t * 0.1);
      intensity = 0.1 + t * 0.1;
    }

    this.ambientLight.color = color;
    this.ambientLight.intensity = intensity;
  }

  updateOrbitingLights(delta) {
    this.orbitAngle += delta * this.orbitSpeed;

    this.orbitLights.forEach(({ light, angleOffset, radius, height }) => {
      const angle = this.orbitAngle + angleOffset;
      light.position.set(
        Math.cos(angle) * radius,
        height,
        Math.sin(angle) * radius
      );

      const pulse = 0.3 + Math.sin(this.orbitAngle * 3 + angleOffset) * 0.3;
      light.intensity = pulse;
    });
  }

  async cleanup() {
    if (this.ambientLight) this.$.removeLight(this.ambientLight);
    if (this.spotlight) this.$.removeLight(this.spotlight);

    this.orbitLights.forEach(({ light }) => {
      this.$.removeLight(light);
    });
  }
}`;

describe('Dynamic Lighting Scenario', () => {
  let runner: ScenarioTestRunner;
  let DynamicLightingScenario: any;

  beforeEach(() => {
    DynamicLightingScenario = ScenarioTestUtils.loadScenarioFromCode(dynamicLightingCode);
    runner = new ScenarioTestRunner(DynamicLightingScenario);
  });

  describe('setup', () => {
    it('should load VRM model', async () => {
      await runner.setup();
      ScenarioAssertions.assertVrmLoaded(runner);
    });

    it('should create ambient light', async () => {
      await runner.setup();

      const lights = runner.getLights();
      const ambientLight = lights.find(l => l instanceof THREE.AmbientLight);

      expect(ambientLight).toBeDefined();
    });

    it('should create spotlight', async () => {
      await runner.setup();

      const lights = runner.getLights();
      const spotlight = lights.find(l => l instanceof THREE.SpotLight);

      expect(spotlight).toBeDefined();
    });

    it('should create orbiting point lights', async () => {
      await runner.setup();

      const lights = runner.getLights();
      const pointLights = lights.filter(l => l instanceof THREE.PointLight);

      // Should have 3 orbiting RGB lights
      expect(pointLights.length).toBe(3);
    });

    it('should add all lights to scene', async () => {
      await runner.setup();

      ScenarioAssertions.assertLightCount(runner, 5); // 1 ambient + 1 spot + 3 point
    });
  });

  describe('day/night cycle', () => {
    beforeEach(async () => {
      await runner.setup();
    });

    it('should advance time of day', () => {
      const scenario = runner.getScenario();
      const initialTime = scenario.timeOfDay;

      runner.updateForDuration(1.0);

      expect(scenario.timeOfDay).toBeGreaterThan(initialTime);
    });

    it('should wrap time of day after full cycle', () => {
      const scenario = runner.getScenario();

      // Run for more than dayDuration (30s)
      runner.updateForDuration(31);

      // Should have wrapped
      expect(scenario.timeOfDay).toBeLessThan(1);
      expect(scenario.timeOfDay).toBeGreaterThanOrEqual(0);
    });

    it('should update ambient light color', () => {
      const scenario = runner.getScenario();

      runner.updateForDuration(5.0);

      expect(scenario.ambientLight.color).toBeDefined();
      expect(scenario.ambientLight.color).toBeInstanceOf(THREE.Color);
    });

    it('should update ambient light intensity', () => {
      const scenario = runner.getScenario();
      const initialIntensity = scenario.ambientLight.intensity;

      runner.updateForDuration(5.0);

      // Intensity should change
      expect(scenario.ambientLight.intensity).not.toBe(initialIntensity);
    });

    it('should cycle between day and night colors', () => {
      const scenario = runner.getScenario();

      // Midday (timeOfDay = 0.25)
      scenario.timeOfDay = 0.25;
      runner.update(0.016);
      const dayIntensity = scenario.ambientLight.intensity;

      // Midnight (timeOfDay = 0.75)
      scenario.timeOfDay = 0.75;
      runner.update(0.016);
      const nightIntensity = scenario.ambientLight.intensity;

      // Day should be brighter
      expect(dayIntensity).toBeGreaterThan(nightIntensity);
    });
  });

  describe('orbiting lights', () => {
    beforeEach(async () => {
      await runner.setup();
    });

    it('should update orbit angle', () => {
      const scenario = runner.getScenario();
      const initialAngle = scenario.orbitAngle;

      runner.updateForDuration(1.0);

      expect(scenario.orbitAngle).toBeGreaterThan(initialAngle);
      expect(scenario.orbitAngle).toBeCloseTo(0.5, 1);
    });

    it('should move lights in orbital pattern', () => {
      const scenario = runner.getScenario();

      const initialPositions = scenario.orbitLights.map(({ light }) =>
        light.position.clone()
      );

      runner.updateForDuration(1.0);

      const finalPositions = scenario.orbitLights.map(({ light }) =>
        light.position.clone()
      );

      // All lights should have moved
      for (let i = 0; i < initialPositions.length; i++) {
        expect(finalPositions[i].equals(initialPositions[i])).toBe(false);
      }
    });

    it('should pulse light intensity', () => {
      const scenario = runner.getScenario();

      const intensities: number[] = [];

      // Sample intensity over time
      for (let i = 0; i < 10; i++) {
        runner.update(0.1);
        intensities.push(scenario.orbitLights[0].light.intensity);
      }

      // Should have variation (pulsing)
      const minIntensity = Math.min(...intensities);
      const maxIntensity = Math.max(...intensities);

      expect(maxIntensity).toBeGreaterThan(minIntensity);
    });

    it('should maintain light spacing', () => {
      const scenario = runner.getScenario();

      runner.updateForDuration(5.0);

      // Calculate angles between lights
      const angles = scenario.orbitLights.map(({ light }) => {
        return Math.atan2(light.position.z, light.position.x);
      });

      // Lights should be evenly spaced (120 degrees apart)
      const expectedSpacing = (Math.PI * 2) / 3;

      for (let i = 1; i < angles.length; i++) {
        let angleDiff = angles[i] - angles[i - 1];
        if (angleDiff < 0) angleDiff += Math.PI * 2;

        // Tighter precision (1 decimal = ~±0.05 radians or ±2.9°) to better validate spacing
        expect(angleDiff).toBeCloseTo(expectedSpacing, 1);
      }
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      await runner.setup();
    });

    it('should remove all lights on cleanup', async () => {
      await runner.cleanup();

      const scope = runner.getScope();

      // Should remove 5 lights (1 ambient + 1 spot + 3 point)
      expect((scope.removeLight as any).mock.calls.length).toBe(5);
    });
  });

  describe('performance', () => {
    beforeEach(async () => {
      await runner.setup();
    });

    it('should run efficiently with multiple lights', () => {
      const perf = ScenarioTestUtils.measureUpdatePerformance(runner, 100);

      // Performance thresholds account for JIT warmup and environment variance
      // These are upper bounds that should catch major performance regressions
      expect(perf.avgMs).toBeLessThan(5); // Average should be reasonable
      expect(perf.maxMs).toBeLessThan(50); // Max allows for outliers/warmup
    });

    it('should handle long-running simulation', () => {
      expect(() => {
        runner.updateForDuration(60); // 1 minute
      }).not.toThrow();
    });
  });
});
