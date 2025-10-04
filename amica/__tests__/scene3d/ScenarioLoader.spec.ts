import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScenarioLoader } from '@/features/scene3d/ScenarioLoader';

describe('ScenarioLoader', () => {
  let scenarioLoader: ScenarioLoader;

  beforeEach(() => {
    scenarioLoader = new ScenarioLoader();
  });

  describe('initialization', () => {
    it('should start with no scenario loaded', () => {
      expect(scenarioLoader.isReady()).toBe(false);
      expect(scenarioLoader.isLoading()).toBe(false);
    });
  });

  describe('loadScenario', () => {
    it('should load scenario from URL', async () => {
      const mockScenarioCode = `(class TestScenario {
          constructor({ scope, THREE, hookManager }) {
            this.scope = scope;
          }
          async setup() {}
          update(delta) {}
        })`;

      global.fetch = vi.fn().mockResolvedValue({
        text: () => Promise.resolve(mockScenarioCode),
      } as Response);

      await scenarioLoader.loadScenario('http://example.com/scenario.js', {}, {});

      expect(scenarioLoader.isReady()).toBe(true);
      expect(scenarioLoader.isLoading()).toBe(false);
    });

    it('should set loading state during load', async () => {
      const mockScenarioCode = `(class TestScenario {
          constructor({ scope }) {}
          async setup() {
            await new Promise(resolve => setTimeout(resolve, 10));
          }
          update(delta) {}
        })`;

      global.fetch = vi.fn().mockResolvedValue({
        text: () => Promise.resolve(mockScenarioCode),
      } as Response);

      const loadPromise = scenarioLoader.loadScenario('http://example.com/scenario.js', {}, {});

      expect(scenarioLoader.isLoading()).toBe(true);

      await loadPromise;

      expect(scenarioLoader.isLoading()).toBe(false);
    });
  });

  describe('updateScenario', () => {
    it('should not update if scenario not loaded', () => {
      expect(() => scenarioLoader.updateScenario(0.016)).not.toThrow();
    });

    it('should not update if scenario is loading', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockScenarioCode = `(class TestScenario {
          constructor({ scope }) {}
          async setup() {}
          update(delta) { throw new Error('Should not be called'); }
        })`;

      global.fetch = vi.fn().mockResolvedValue({
        text: () => Promise.resolve(mockScenarioCode),
      } as Response);

      // Start loading but don't await
      const loadPromise = scenarioLoader.loadScenario('http://example.com/scenario.js', {}, {});

      expect(() => scenarioLoader.updateScenario(0.016)).not.toThrow();

      await loadPromise;
      consoleSpy.mockRestore();
    });

    it('should update scenario when ready', async () => {
      const updateSpy = vi.fn();
      const mockScenarioCode = `(class TestScenario {
          constructor({ scope }) {
            this.updateSpy = scope.updateSpy;
          }
          async setup() {}
          update(delta) {
            this.updateSpy(delta);
          }
        })`;

      global.fetch = vi.fn().mockResolvedValue({
        text: () => Promise.resolve(mockScenarioCode),
      } as Response);

      await scenarioLoader.loadScenario('http://example.com/scenario.js', { updateSpy }, {});

      scenarioLoader.updateScenario(0.016);

      expect(updateSpy).toHaveBeenCalledWith(0.016);
    });

    it('should handle update errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockScenarioCode = `(class TestScenario {
          constructor({ scope }) {}
          async setup() {}
          update(delta) {
            throw new Error('Update error');
          }
        })`;

      global.fetch = vi.fn().mockResolvedValue({
        text: () => Promise.resolve(mockScenarioCode),
      } as Response);

      await scenarioLoader.loadScenario('http://example.com/scenario.js', {}, {});

      expect(() => scenarioLoader.updateScenario(0.016)).not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
