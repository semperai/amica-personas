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
});
