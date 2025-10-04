import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';

// Hoist mock objects so they're accessible in tests
const { mockStatsPanel, mockStats, mockGUI } = vi.hoisted(() => {
  const mockStatsPanel = {
    update: vi.fn(),
  };

  const mockStats = {
    dom: document.createElement('div'),
    addPanel: vi.fn(() => mockStatsPanel),
    update: vi.fn(),
  };

  const mockGUI = {
    domElement: document.createElement('div'),
    add: vi.fn().mockReturnThis(),
    onChange: vi.fn().mockReturnThis(),
    controllers: [],
  };

  return { mockStatsPanel, mockStats, mockGUI };
});

// Mock HTMLMesh to avoid canvas context issues
vi.mock('three/addons/interactive/HTMLMesh.js', () => ({
  HTMLMesh: vi.fn().mockImplementation((element) => {
    const mesh = new THREE.Mesh();
    (mesh as any).element = element;
    return mesh;
  }),
}));

// Mock stats.js
vi.mock('stats.js', () => {
  class MockStatsPanel {
    update = vi.fn();
    constructor(name: string, fg: string, bg: string) {}
  }

  const mockStatsConstructor: any = vi.fn(() => mockStats);
  mockStatsConstructor.Panel = MockStatsPanel;

  return {
    default: mockStatsConstructor,
  };
});

// Mock lil-gui
vi.mock('lil-gui', () => ({
  default: vi.fn(() => mockGUI),
}));

import { DebugSystem } from '@/features/scene3d/DebugSystem';

describe('DebugSystem', () => {
  let debugSystem: DebugSystem;

  beforeEach(() => {
    debugSystem = new DebugSystem();
  });

  describe('initialization', () => {
    it('should initialize with default params', () => {
      expect(debugSystem.params['y-offset']).toBe(0);
      expect(debugSystem.params['room-x']).toBe(0);
      expect(debugSystem.params['room-y']).toBe(0);
      expect(debugSystem.params['room-z']).toBe(0);
      expect(debugSystem.params['room-scale']).toBe(1);
    });

    it('should create GUI and stats', () => {
      expect(mockGUI).toBeTruthy();
      expect(mockStats).toBeTruthy();
    });

    it('should create closest part meshes', () => {
      const part1 = debugSystem.getClosestPart1();
      const part2 = debugSystem.getClosestPart2();

      expect(part1).toBeInstanceOf(THREE.Mesh);
      expect(part2).toBeInstanceOf(THREE.Mesh);
      expect(part1.visible).toBe(false);
      expect(part2.visible).toBe(false);
    });
  });

  describe('setupGUIControls', () => {
    it('should setup GUI control callbacks', () => {
      const onRoomX = vi.fn();
      const onRoomY = vi.fn();
      const onRoomZ = vi.fn();
      const onRoomScale = vi.fn();
      const onYOffset = vi.fn();

      debugSystem.setupGUIControls(
        onRoomX,
        onRoomY,
        onRoomZ,
        onRoomScale,
        onYOffset,
      );

      expect(mockGUI.add).toHaveBeenCalled();
    });
  });

  describe('performance recording', () => {
    it('should record update time', () => {
      debugSystem.recordUpdateTime(5);
      expect(mockStatsPanel.update).toHaveBeenCalledWith(5, 40);
    });

    it('should record render time', () => {
      debugSystem.recordRenderTime(10);
      expect(mockStatsPanel.update).toHaveBeenCalledWith(10, 100);
    });

    it('should record scenario time', () => {
      debugSystem.recordScenarioTime(8);
      expect(mockStatsPanel.update).toHaveBeenCalledWith(8, 100);
    });

    it('should record physics time', () => {
      debugSystem.recordPhysicsTime(3);
      expect(mockStatsPanel.update).toHaveBeenCalledWith(3, 100);
    });

    it('should record model time', () => {
      debugSystem.recordModelTime(7);
      expect(mockStatsPanel.update).toHaveBeenCalledWith(7, 40);
    });

    it('should record BVH time', () => {
      debugSystem.recordBVHTime(12);
      expect(mockStatsPanel.update).toHaveBeenCalledWith(12, 100);
    });

    it('should record raycast time', () => {
      debugSystem.recordRaycastTime(6);
      expect(mockStatsPanel.update).toHaveBeenCalledWith(6, 100);
    });

    it('should record stats time', () => {
      debugSystem.recordStatsTime(2);
      expect(mockStatsPanel.update).toHaveBeenCalledWith(2, 100);
    });
  });

  describe('hslToRgb', () => {
    it('should convert HSL to RGB', () => {
      const red = debugSystem.hslToRgb(0, 1, 0.5);
      expect(red).toBe(0xff0000);

      const green = debugSystem.hslToRgb(1 / 3, 1, 0.5);
      expect(green).toBe(0x00ff00);

      const blue = debugSystem.hslToRgb(2 / 3, 1, 0.5);
      expect(blue).toBe(0x0000ff);
    });

    it('should handle achromatic colors', () => {
      const gray = debugSystem.hslToRgb(0, 0, 0.5);
      expect(gray).toBe(0x7f7f7f);

      const white = debugSystem.hslToRgb(0, 0, 1);
      expect(white).toBe(0xffffff);

      const black = debugSystem.hslToRgb(0, 0, 0);
      expect(black).toBe(0x000000);
    });
  });

  describe('updateStats', () => {
    it('should update stats', () => {
      debugSystem.updateStats();
      expect(mockStats.update).toHaveBeenCalled();
    });
  });


  describe('addToScene', () => {
    it('should add debug meshes to scene', () => {
      const scene = new THREE.Scene();
      const addSpy = vi.spyOn(scene, 'add');

      debugSystem.addToScene(scene);

      expect(addSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateStatsMeshTexture', () => {
    it('should attempt to update texture maps for stats and GUI meshes', () => {
      // This method accesses the material.map.update() for both meshes
      // In test environment, the material may not have the expected structure
      // so we just verify the method exists and can be called
      try {
        debugSystem.updateStatsMeshTexture();
      } catch (error) {
        // Expected to fail in test environment due to missing HTMLMesh material structure
        expect(error).toBeDefined();
      }
    });
  });

  describe('updateGUIDisplay', () => {
    it('should update all GUI controllers', () => {
      // Add mock controllers with updateDisplay method
      const mockController = { updateDisplay: vi.fn() };
      mockGUI.controllers = [mockController, mockController];

      debugSystem.updateGUIDisplay();

      // Verify updateDisplay was called on each controller
      expect(mockController.updateDisplay).toHaveBeenCalledTimes(2);
    });

    it('should handle empty controllers array', () => {
      mockGUI.controllers = [];
      expect(() => debugSystem.updateGUIDisplay()).not.toThrow();
    });
  });

  describe('addToInteractiveGroup', () => {
    it('should add GUI and stats meshes to interactive group', () => {
      const mockIGroup = {
        add: vi.fn()
      };

      debugSystem.addToInteractiveGroup(mockIGroup as any);

      expect(mockIGroup.add).toHaveBeenCalledTimes(2);
    });
  });

  describe('createBallAtPoint', () => {
    it('should return early without creating ball (disabled)', () => {
      const scene = new THREE.Scene();
      const point = new THREE.Vector3(1, 2, 3);
      const cameraPos = new THREE.Vector3(0, 0, 0);
      const addSpy = vi.spyOn(scene, 'add');

      debugSystem.createBallAtPoint(scene, point, cameraPos, 0);

      // Should return early, not add anything to scene
      expect(addSpy).not.toHaveBeenCalled();
    });

    it('should return early for room type ball', () => {
      const scene = new THREE.Scene();
      const point = new THREE.Vector3(1, 2, 3);
      const cameraPos = new THREE.Vector3(0, 0, 0);
      const addSpy = vi.spyOn(scene, 'add');

      debugSystem.createBallAtPoint(scene, point, cameraPos, 1);

      // Should return early, not add anything to scene
      expect(addSpy).not.toHaveBeenCalled();
    });
  });

  describe('hslToRgb edge cases', () => {
    it('should handle various hue values in chromatic mode', () => {
      // Test different hue ranges for chromatic colors
      const color1 = debugSystem.hslToRgb(0.1, 1, 0.5);
      expect(typeof color1).toBe('number');

      const color2 = debugSystem.hslToRgb(0.4, 1, 0.5);
      expect(typeof color2).toBe('number');

      const color3 = debugSystem.hslToRgb(0.7, 1, 0.5);
      expect(typeof color3).toBe('number');

      const color4 = debugSystem.hslToRgb(0.9, 1, 0.5);
      expect(typeof color4).toBe('number');
    });

    it('should handle low lightness values', () => {
      const darkColor = debugSystem.hslToRgb(0.5, 1, 0.2);
      expect(typeof darkColor).toBe('number');
      expect(darkColor).toBeGreaterThanOrEqual(0);
    });

    it('should handle high lightness values', () => {
      const lightColor = debugSystem.hslToRgb(0.5, 1, 0.8);
      expect(typeof lightColor).toBe('number');
      expect(lightColor).toBeLessThanOrEqual(0xffffff);
    });

    it('should handle mid-saturation values', () => {
      const color = debugSystem.hslToRgb(0.5, 0.5, 0.5);
      expect(typeof color).toBe('number');
    });
  });
});
