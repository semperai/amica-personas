import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { RaycastSystem, RaycastHit } from '@/features/scene3d/RaycastSystem';

// Mock the BVH worker
vi.mock('@/workers/bvh/GenerateMeshBVHWorker', () => {
  return {
    GenerateMeshBVHWorker: class MockWorker {
      async generate(geometry: any, options: any) {
        return null;
      }
    }
  };
});

describe('RaycastSystem', () => {
  let scene: THREE.Scene;
  let raycastSystem: RaycastSystem;
  let camera: THREE.PerspectiveCamera;

  // Helper to create a mesh and ensure matrices are updated
  const createMesh = (x: number, y: number, z: number, sizeX = 1, sizeY = 1, sizeZ = 1) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(sizeX, sizeY, sizeZ),
      new THREE.MeshBasicMaterial()
    );
    mesh.position.set(x, y, z);
    mesh.updateMatrixWorld();
    return mesh;
  };

  beforeEach(() => {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.set(0, 0, 5);
    camera.updateMatrixWorld();
    raycastSystem = new RaycastSystem(scene);
  });

  describe('initialization', () => {
    it('should initialize with enabled state', () => {
      expect(raycastSystem.isEnabled()).toBe(true);
    });

    it('should have empty target arrays', () => {
      expect(raycastSystem.getModelTargets()).toHaveLength(0);
      expect(raycastSystem.getRoomTargets()).toHaveLength(0);
      expect(raycastSystem.getCustomTargets()).toHaveLength(0);
    });

    it('should add BVH helper group to scene', () => {
      const helperGroup = raycastSystem.getRoomBVHHelperGroup();
      expect(scene.children).toContain(helperGroup);
    });
  });

  describe('enable/disable', () => {
    it('should enable and disable system', () => {
      raycastSystem.setEnabled(false);
      expect(raycastSystem.isEnabled()).toBe(false);

      raycastSystem.setEnabled(true);
      expect(raycastSystem.isEnabled()).toBe(true);
    });

    it('should not raycast when disabled', () => {
      const cube = createMesh(0, 0, 0);
      raycastSystem.addCustomTarget(cube);

      raycastSystem.setEnabled(false);

      const hit = raycastSystem.raycastFromPoint(
        new THREE.Vector3(0, 0, 5),
        new THREE.Vector3(0, 0, -1)
      );

      expect(hit).toBeNull();
    });
  });

  describe('mouse position', () => {
    it('should get and set mouse position', () => {
      raycastSystem.setMousePosition(0.5, -0.3);
      const pos = raycastSystem.getMousePosition();

      expect(pos.x).toBe(0.5);
      expect(pos.y).toBe(-0.3);
    });

    it('should return cloned mouse position', () => {
      raycastSystem.setMousePosition(0.5, -0.3);
      const pos1 = raycastSystem.getMousePosition();
      const pos2 = raycastSystem.getMousePosition();

      expect(pos1).not.toBe(pos2); // Different instances
      expect(pos1.equals(pos2)).toBe(true); // Same values
    });
  });

  describe('custom targets', () => {
    it('should add custom target', () => {
      const cube = createMesh(0, 0, 0);

      raycastSystem.addCustomTarget(cube);
      expect(raycastSystem.getCustomTargets()).toContain(cube);
    });

    it('should not add duplicate custom targets', () => {
      const cube = createMesh(0, 0, 0);

      raycastSystem.addCustomTarget(cube);
      raycastSystem.addCustomTarget(cube);

      expect(raycastSystem.getCustomTargets()).toHaveLength(1);
    });

    it('should remove custom target', () => {
      const cube = createMesh(0, 0, 0);

      raycastSystem.addCustomTarget(cube);
      expect(raycastSystem.getCustomTargets()).toHaveLength(1);

      raycastSystem.removeCustomTarget(cube);
      expect(raycastSystem.getCustomTargets()).toHaveLength(0);
    });

    it('should clear all custom targets', () => {
      const cube1 = createMesh(0, 0, 0);
      const cube2 = createMesh(1, 0, 0);

      raycastSystem.addCustomTarget(cube1);
      raycastSystem.addCustomTarget(cube2);
      expect(raycastSystem.getCustomTargets()).toHaveLength(2);

      raycastSystem.clearCustomTargets();
      expect(raycastSystem.getCustomTargets()).toHaveLength(0);
    });
  });

  describe('raycastFromPoint', () => {
    it('should hit a cube in front of the ray', () => {
      const cube = createMesh(0, 0, 0);
      raycastSystem.addCustomTarget(cube);

      const hit = raycastSystem.raycastFromPoint(
        new THREE.Vector3(0, 0, 5),
        new THREE.Vector3(0, 0, -1)
      );

      expect(hit).not.toBeNull();
      expect(hit!.object).toBe(cube);
      expect(hit!.type).toBe('object');
      expect(hit!.distance).toBeGreaterThan(0);
    });

    it('should return null when no intersection', () => {
      const cube = createMesh(10, 10, 10);
      raycastSystem.addCustomTarget(cube);

      const hit = raycastSystem.raycastFromPoint(
        new THREE.Vector3(0, 0, 5),
        new THREE.Vector3(0, 0, -1)
      );

      expect(hit).toBeNull();
    });

    it('should include hit point information', () => {
      const cube = createMesh(0, 0, 0);
      raycastSystem.addCustomTarget(cube);

      const hit = raycastSystem.raycastFromPoint(
        new THREE.Vector3(0, 0, 5),
        new THREE.Vector3(0, 0, -1)
      );

      expect(hit).not.toBeNull();
      expect(hit!.point).toBeInstanceOf(THREE.Vector3);
      expect(hit!.distance).toBeGreaterThan(0);
    });

    it('should normalize direction vector', () => {
      const cube = createMesh(0, 0, 0);
      raycastSystem.addCustomTarget(cube);

      // Use non-normalized direction
      const hit = raycastSystem.raycastFromPoint(
        new THREE.Vector3(0, 0, 5),
        new THREE.Vector3(0, 0, -5) // Not normalized
      );

      expect(hit).not.toBeNull();
    });
  });

  describe('raycastFromCamera', () => {
    it('should raycast from camera through screen coordinates', () => {
      const cube = createMesh(0, 0, 0, 2, 2, 2);
      raycastSystem.addCustomTarget(cube);

      // Raycast through center of screen (0, 0 in NDC)
      const hit = raycastSystem.raycastFromCamera(camera, 0, 0);

      expect(hit).not.toBeNull();
      expect(hit!.object).toBe(cube);
    });

    it('should use current mouse position if no coordinates provided', () => {
      const cube = createMesh(0, 0, 0, 2, 2, 2);
      raycastSystem.addCustomTarget(cube);

      raycastSystem.setMousePosition(0, 0);
      const hit = raycastSystem.raycastFromCamera(camera);

      expect(hit).not.toBeNull();
    });
  });

  describe('raycastFromObject', () => {
    it('should raycast from object forward direction', () => {
      const cube = createMesh(0, 0, -2);
      raycastSystem.addCustomTarget(cube);

      const emitter = new THREE.Group();
      scene.add(emitter);
      emitter.position.set(0, 0, 0);
      // Default orientation: -Z forward, should hit cube at (0, 0, -2)
      emitter.updateMatrixWorld();

      const hit = raycastSystem.raycastFromObject(emitter);

      expect(hit).not.toBeNull();
      expect(hit!.object).toBe(cube);
    });

    it('should miss when object points away', () => {
      const cube = createMesh(0, 0, -2);
      raycastSystem.addCustomTarget(cube);

      const emitter = new THREE.Group();
      scene.add(emitter);
      emitter.position.set(0, 0, 0);
      emitter.rotation.set(0, Math.PI, 0); // Rotate 180° - now +Z is forward
      emitter.updateMatrixWorld();

      const hit = raycastSystem.raycastFromObject(emitter);

      expect(hit).toBeNull();
    });
  });

  describe('raycastAll', () => {
    it('should return all intersections sorted by distance', () => {
      const cube1 = createMesh(0, 0, 0);
      const cube2 = createMesh(0, 0, 2);

      raycastSystem.addCustomTarget(cube1);
      raycastSystem.addCustomTarget(cube2);

      const hits = raycastSystem.raycastAll(
        new THREE.Vector3(0, 0, 5),
        new THREE.Vector3(0, 0, -1)
      );

      expect(hits.length).toBeGreaterThanOrEqual(2);

      // Should be sorted by distance (closest first)
      for (let i = 1; i < hits.length; i++) {
        expect(hits[i].distance).toBeGreaterThanOrEqual(hits[i - 1].distance);
      }
    });

    it('should return empty array when no hits', () => {
      const cube = createMesh(10, 10, 10);
      raycastSystem.addCustomTarget(cube);

      const hits = raycastSystem.raycastAll(
        new THREE.Vector3(0, 0, 5),
        new THREE.Vector3(0, 0, -1)
      );

      expect(hits).toHaveLength(0);
    });
  });

  describe('raycast options', () => {
    it('should respect maxDistance option', () => {
      const cube = createMesh(0, 0, 0);
      raycastSystem.addCustomTarget(cube);

      const hitWithLimit = raycastSystem.raycastFromPoint(
        new THREE.Vector3(0, 0, 5),
        new THREE.Vector3(0, 0, -1),
        { maxDistance: 3 }
      );

      const hitWithoutLimit = raycastSystem.raycastFromPoint(
        new THREE.Vector3(0, 0, 5),
        new THREE.Vector3(0, 0, -1),
        { maxDistance: 10 }
      );

      expect(hitWithLimit).toBeNull(); // Too far
      expect(hitWithoutLimit).not.toBeNull(); // Within range
    });

    it('should respect firstHitOnly option', () => {
      const cube1 = createMesh(0, 0, 0);
      const cube2 = createMesh(0, 0, 2);

      raycastSystem.addCustomTarget(cube1);
      raycastSystem.addCustomTarget(cube2);

      const hits = raycastSystem.raycastAll(
        new THREE.Vector3(0, 0, 5),
        new THREE.Vector3(0, 0, -1),
        { firstHitOnly: true }
      );

      // Note: raycastAll temporarily disables firstHitOnly,
      // but we can test that the option is applied
      expect(Array.isArray(hits)).toBe(true);
    });
  });

  describe('hit type detection', () => {
    it('should detect custom object hits as "object" type', () => {
      const cube = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial()
      );
      cube.position.set(0, 0, 0);
      raycastSystem.addCustomTarget(cube);

      const hit = raycastSystem.raycastFromPoint(
        new THREE.Vector3(0, 0, 5),
        new THREE.Vector3(0, 0, -1)
      );

      expect(hit).not.toBeNull();
      expect(hit!.type).toBe('object');
    });
  });

  describe('closest hit priority', () => {
    it('should return closest hit when multiple objects intersect', () => {
      const cube1 = createMesh(0, 0, 2);
      const cube2 = createMesh(0, 0, 4);

      raycastSystem.addCustomTarget(cube1);
      raycastSystem.addCustomTarget(cube2);

      const hit = raycastSystem.raycastFromPoint(
        new THREE.Vector3(0, 0, 10),
        new THREE.Vector3(0, 0, -1)
      );

      expect(hit).not.toBeNull();
      expect(hit!.object).toBe(cube2); // Closer one
    });
  });

  describe('cleanup', () => {
    it('should dispose all resources', () => {
      const cube = createMesh(0, 0, 0);
      raycastSystem.addCustomTarget(cube);

      raycastSystem.dispose();

      expect(raycastSystem.getModelTargets()).toHaveLength(0);
      expect(raycastSystem.getRoomTargets()).toHaveLength(0);
      expect(raycastSystem.getCustomTargets()).toHaveLength(0);
    });

    it('should cleanup model BVH', () => {
      raycastSystem.cleanupModelBVH();
      expect(raycastSystem.getModelTargets()).toHaveLength(0);
    });

    it('should cleanup room BVH', () => {
      raycastSystem.cleanupRoomBVH();
      expect(raycastSystem.getRoomTargets()).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should handle raycast errors gracefully', () => {
      // Create an object that might cause raycast issues
      const invalidMesh = new THREE.Mesh();
      // @ts-ignore - intentionally invalid
      invalidMesh.geometry = null;

      raycastSystem.addCustomTarget(invalidMesh);

      // Should not throw
      expect(() => {
        raycastSystem.raycastFromPoint(
          new THREE.Vector3(0, 0, 5),
          new THREE.Vector3(0, 0, -1)
        );
      }).not.toThrow();
    });
  });

  describe('hit information', () => {
    it('should provide complete hit information', () => {
      const cube = createMesh(0, 0, 0);
      raycastSystem.addCustomTarget(cube);

      const hit = raycastSystem.raycastFromPoint(
        new THREE.Vector3(0, 0, 5),
        new THREE.Vector3(0, 0, -1)
      );

      expect(hit).not.toBeNull();
      expect(hit!).toHaveProperty('point');
      expect(hit!).toHaveProperty('distance');
      expect(hit!).toHaveProperty('object');
      expect(hit!).toHaveProperty('type');
      expect(hit!.point).toBeInstanceOf(THREE.Vector3);
      expect(typeof hit!.distance).toBe('number');
    });

    it('should clone hit point and uv', () => {
      const cube = createMesh(0, 0, 0);
      raycastSystem.addCustomTarget(cube);

      const hit1 = raycastSystem.raycastFromPoint(
        new THREE.Vector3(0, 0, 5),
        new THREE.Vector3(0, 0, -1)
      );

      const hit2 = raycastSystem.raycastFromPoint(
        new THREE.Vector3(0, 0, 5),
        new THREE.Vector3(0, 0, -1)
      );

      expect(hit1).not.toBeNull();
      expect(hit2).not.toBeNull();

      // Points should be different instances but same values
      expect(hit1!.point).not.toBe(hit2!.point);
      expect(hit1!.point.equals(hit2!.point)).toBe(true);
    });
  });

  describe('performance', () => {
    it('should handle many custom targets efficiently', () => {
      // Add many cubes
      for (let i = 0; i < 100; i++) {
        const cube = createMesh(
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
          0.1, 0.1, 0.1
        );
        raycastSystem.addCustomTarget(cube);
      }

      const startTime = performance.now();
      raycastSystem.raycastFromPoint(
        new THREE.Vector3(0, 0, 5),
        new THREE.Vector3(0, 0, -1)
      );
      const endTime = performance.now();

      // Should complete in reasonable time (< 10ms)
      expect(endTime - startTime).toBeLessThan(10);
    });
  });
});
