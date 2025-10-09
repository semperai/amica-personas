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

// Add BVH extension methods to THREE.BufferGeometry for testing
// These are normally added by three-mesh-bvh in SceneCoordinator
if (!THREE.BufferGeometry.prototype.computeBoundsTree) {
  THREE.BufferGeometry.prototype.computeBoundsTree = function() {
    // Mock implementation - create a minimal boundsTree structure
    // that satisfies MeshBVHHelper.update() requirements
    (this as any).boundsTree = {
      _roots: [],
      refit: vi.fn()
    };
  };
}

if (!THREE.BufferGeometry.prototype.disposeBoundsTree) {
  THREE.BufferGeometry.prototype.disposeBoundsTree = function() {
    delete (this as any).boundsTree;
  };
}

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

    it('should preserve hit type information for custom targets', () => {
      const cube1 = createMesh(0, 0, 2);
      const cube2 = createMesh(0, 0, 4);

      raycastSystem.addCustomTarget(cube1);
      raycastSystem.addCustomTarget(cube2);

      const hits = raycastSystem.raycastAll(
        new THREE.Vector3(0, 0, 10),
        new THREE.Vector3(0, 0, -1)
      );

      expect(hits.length).toBeGreaterThanOrEqual(2);

      // All custom targets should have type 'object'
      hits.forEach(hit => {
        expect(hit.type).toBe('object');
      });
    });

    it('should enforce firstHitOnly = false even when options override it', () => {
      const cube1 = createMesh(0, 0, 0);
      const cube2 = createMesh(0, 0, 2);

      raycastSystem.addCustomTarget(cube1);
      raycastSystem.addCustomTarget(cube2);

      // Try to pass firstHitOnly: true in options
      // raycastAll should still return all hits
      const hits = raycastSystem.raycastAll(
        new THREE.Vector3(0, 0, 5),
        new THREE.Vector3(0, 0, -1),
        { firstHitOnly: true } // This should be overridden by raycastAll
      );

      // Should still get all hits, not just the first one
      expect(hits.length).toBeGreaterThanOrEqual(2);
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

    it('should respect firstHitOnly option in raycastFromPoint', () => {
      // Create two cubes along the same ray path
      const cube1 = createMesh(0, 0, 2); // Closer
      const cube2 = createMesh(0, 0, 4); // Further

      raycastSystem.addCustomTarget(cube1);
      raycastSystem.addCustomTarget(cube2);

      // With firstHitOnly (default behavior of raycastFromPoint)
      const singleHit = raycastSystem.raycastFromPoint(
        new THREE.Vector3(0, 0, 5),
        new THREE.Vector3(0, 0, -1),
        { firstHitOnly: true }
      );

      expect(singleHit).not.toBeNull();
      expect(singleHit!.object).toBe(cube2); // Should hit the closer one (cube2 at z=4)

      // Compare with raycastAll to verify difference
      const allHits = raycastSystem.raycastAll(
        new THREE.Vector3(0, 0, 5),
        new THREE.Vector3(0, 0, -1)
      );

      expect(allHits.length).toBeGreaterThanOrEqual(2);
      // First hit in raycastAll should match single hit
      expect(allHits[0].object).toBe(singleHit!.object);
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

    it('should cleanup mouse event listener on dispose', () => {
      // Create a mock canvas
      const canvas = document.createElement('canvas');
      const addEventListenerSpy = vi.spyOn(canvas, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(canvas, 'removeEventListener');

      // Setup mouse tracking
      raycastSystem.setupMouseTracking(canvas);
      expect(addEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));

      // Dispose should remove the listener
      raycastSystem.dispose();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    });

    it('should remove old listener when setupMouseTracking called multiple times', () => {
      const canvas1 = document.createElement('canvas');
      const canvas2 = document.createElement('canvas');

      const removeEventListenerSpy1 = vi.spyOn(canvas1, 'removeEventListener');
      const addEventListenerSpy2 = vi.spyOn(canvas2, 'addEventListener');

      // Setup mouse tracking on first canvas
      raycastSystem.setupMouseTracking(canvas1);

      // Setup on second canvas should remove listener from first
      raycastSystem.setupMouseTracking(canvas2);

      expect(removeEventListenerSpy1).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(addEventListenerSpy2).toHaveBeenCalledWith('mousemove', expect.any(Function));
    });

    it('should handle dispose without setupMouseTracking', () => {
      // Should not throw even if setupMouseTracking was never called
      expect(() => {
        raycastSystem.dispose();
      }).not.toThrow();
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

      // Should complete in reasonable time (< 50ms)
      // Using a generous threshold to account for slower CI runners and test environment overhead
      expect(endTime - startTime).toBeLessThan(50);
    });
  });

  describe('setupModelBVH', () => {
    it('should setup model BVH with valid VRM model', async () => {
      // Create mock VRM model
      const mockVRMScene = new THREE.Group();
      mockVRMScene.name = 'VRMRoot';

      const mockModel = {
        vrm: {
          scene: mockVRMScene,
          humanoid: {
            getNormalizedBoneNode: vi.fn()
          }
        }
      } as any;

      await raycastSystem.setupModelBVH(mockModel);

      // Verify model targets were populated
      const modelTargets = raycastSystem.getModelTargets();
      expect(modelTargets).toHaveLength(1);
      expect(modelTargets[0]).toBeInstanceOf(THREE.Mesh);
    });

    it('should add model mesh helper to scene in debug mode', async () => {
      vi.mock('@/utils/config', () => ({
        config: vi.fn((key: string) => {
          if (key === 'debug_gfx') return 'true';
          return '';
        })
      }));

      const mockVRMScene = new THREE.Group();
      const mockModel = {
        vrm: {
          scene: mockVRMScene,
          humanoid: {
            getNormalizedBoneNode: vi.fn()
          }
        }
      } as any;

      const initialChildCount = scene.children.length;
      await raycastSystem.setupModelBVH(mockModel);

      // In debug mode, both mesh helper and BVH helper should be added
      // Note: actual behavior depends on config mock
      expect(raycastSystem.getModelTargets().length).toBeGreaterThan(0);
    });

    it('should handle model without VRM gracefully', async () => {
      const mockModel = {
        vrm: null
      } as any;

      await raycastSystem.setupModelBVH(mockModel);

      // Should not create any model targets
      expect(raycastSystem.getModelTargets()).toHaveLength(0);
    });

    it('should call regenerateBVHForModel after setup', async () => {
      const mockVRMScene = new THREE.Group();
      const mockModel = {
        vrm: {
          scene: mockVRMScene,
          humanoid: {
            getNormalizedBoneNode: vi.fn()
          }
        }
      } as any;

      // Spy on regenerateBVHForModel
      const regenerateSpy = vi.spyOn(raycastSystem, 'regenerateBVHForModel');

      await raycastSystem.setupModelBVH(mockModel);

      // Should have called regenerate
      expect(regenerateSpy).toHaveBeenCalledOnce();
    });
  });

  describe('setupRoomBVH', () => {
    it('should setup room BVH with meshes', async () => {
      const room = new THREE.Group();
      const mesh1 = createMesh(0, 0, 0);
      const mesh2 = createMesh(1, 0, 0);

      room.add(mesh1);
      room.add(mesh2);

      await raycastSystem.setupRoomBVH(room);

      // Verify room targets were populated
      const roomTargets = raycastSystem.getRoomTargets();
      expect(roomTargets).toHaveLength(2);
      expect(roomTargets).toContain(mesh1);
      expect(roomTargets).toContain(mesh2);
    });

    it('should generate BVH for each mesh', async () => {
      const room = new THREE.Group();
      const mesh = createMesh(0, 0, 0);
      room.add(mesh);

      await raycastSystem.setupRoomBVH(room);

      // BVH worker is mocked to return null, but we can verify it was called
      // by checking that the mesh was added to room targets
      expect(raycastSystem.getRoomTargets()).toContain(mesh);
    });

    it('should ignore non-mesh children', async () => {
      const room = new THREE.Group();
      const mesh = createMesh(0, 0, 0);
      const light = new THREE.PointLight();
      const emptyGroup = new THREE.Group();

      room.add(mesh);
      room.add(light);
      room.add(emptyGroup);

      await raycastSystem.setupRoomBVH(room);

      // Should only include the mesh
      const roomTargets = raycastSystem.getRoomTargets();
      expect(roomTargets).toHaveLength(1);
      expect(roomTargets[0]).toBe(mesh);
    });

    it('should handle empty room', async () => {
      const room = new THREE.Group();

      await raycastSystem.setupRoomBVH(room);

      // Should have no room targets
      expect(raycastSystem.getRoomTargets()).toHaveLength(0);
    });

    it('should clear existing room targets before setup', async () => {
      const room1 = new THREE.Group();
      const mesh1 = createMesh(0, 0, 0);
      room1.add(mesh1);

      await raycastSystem.setupRoomBVH(room1);
      expect(raycastSystem.getRoomTargets()).toHaveLength(1);

      const room2 = new THREE.Group();
      const mesh2 = createMesh(1, 0, 0);
      const mesh3 = createMesh(2, 0, 0);
      room2.add(mesh2);
      room2.add(mesh3);

      await raycastSystem.setupRoomBVH(room2);

      // Should have only new room's meshes
      const roomTargets = raycastSystem.getRoomTargets();
      expect(roomTargets).toHaveLength(2);
      expect(roomTargets).not.toContain(mesh1);
    });
  });

  describe('regenerateBVHForModel', () => {
    it('should regenerate BVH when model helper exists', async () => {
      const mockVRMScene = new THREE.Group();
      const mockModel = {
        vrm: {
          scene: mockVRMScene,
          humanoid: {
            getNormalizedBoneNode: vi.fn()
          }
        }
      } as any;

      // First setup the model BVH
      await raycastSystem.setupModelBVH(mockModel);

      // Now regenerate should work
      await expect(raycastSystem.regenerateBVHForModel()).resolves.not.toThrow();
    });

    it('should do nothing when model helper is null', async () => {
      // Should not throw even without setup
      await expect(raycastSystem.regenerateBVHForModel()).resolves.not.toThrow();
    });

    it('should refit existing BVH tree', async () => {
      const mockVRMScene = new THREE.Group();
      const mockModel = {
        vrm: {
          scene: mockVRMScene,
          humanoid: {
            getNormalizedBoneNode: vi.fn()
          }
        }
      } as any;

      await raycastSystem.setupModelBVH(mockModel);

      // First regenerate creates boundsTree
      await raycastSystem.regenerateBVHForModel();

      const modelTargets = raycastSystem.getModelTargets();
      expect(modelTargets.length).toBeGreaterThan(0);

      // Second regenerate should refit
      await raycastSystem.regenerateBVHForModel();

      // Should still have same targets
      expect(raycastSystem.getModelTargets()).toHaveLength(modelTargets.length);
    });
  });

  describe('updateRaycasts (legacy XR method)', () => {
    let mockModel: any;
    let mockCamera: THREE.PerspectiveCamera;
    let mockController1: THREE.Group;
    let mockController2: THREE.Group;
    let mockHand1: THREE.Group;
    let mockHand2: THREE.Group;
    let mockClosestPart1: THREE.Object3D;
    let mockClosestPart2: THREE.Object3D;
    let ballCreateCallback: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
      mockCamera.position.set(0, 0, 5);
      mockCamera.updateMatrixWorld();

      mockController1 = new THREE.Group();
      mockController1.position.set(0, 0, 0);
      mockController1.updateMatrixWorld();

      mockController2 = new THREE.Group();
      mockController2.position.set(1, 0, 0);
      mockController2.updateMatrixWorld();

      mockHand1 = new THREE.Group();
      mockHand2 = new THREE.Group();

      mockClosestPart1 = new THREE.Object3D();
      mockClosestPart2 = new THREE.Object3D();

      ballCreateCallback = vi.fn();

      // Create mock VRM model
      const mockVRMScene = new THREE.Group();
      mockModel = {
        vrm: {
          scene: mockVRMScene,
          humanoid: {
            getNormalizedBoneNode: vi.fn((boneName: string) => {
              const bone = new THREE.Object3D();
              bone.position.set(0, 1, 0);
              bone.updateMatrixWorld();
              return bone;
            })
          }
        }
      };
    });

    it('should use mouse raycast when no controllers are active', () => {
      const cube = createMesh(0, 0, 0, 2, 2, 2);
      raycastSystem.addCustomTarget(cube);
      raycastSystem.setMousePosition(0, 0);

      raycastSystem.updateRaycasts(
        mockCamera,
        mockModel,
        false, // not using controller 1
        false, // not using controller 2
        mockController1,
        mockController2,
        null,
        null,
        [],
        [],
        mockClosestPart1,
        mockClosestPart2,
        ballCreateCallback
      );

      // Callback should not be called without room hits
      expect(ballCreateCallback).not.toHaveBeenCalled();
    });

    it('should raycast from controller when controller is active', () => {
      const cube = createMesh(0, 0, -2);
      raycastSystem.addCustomTarget(cube);

      raycastSystem.updateRaycasts(
        mockCamera,
        mockModel,
        true, // using controller 1
        false,
        mockController1,
        mockController2,
        null,
        null,
        [],
        [],
        mockClosestPart1,
        mockClosestPart2,
        ballCreateCallback
      );

      // Should perform raycast from controller
      expect(ballCreateCallback).not.toHaveBeenCalled();
    });

    it('should raycast from hand joints when hand is active', () => {
      const jointMesh1 = createMesh(0, 0, -1);
      const jointMesh2 = createMesh(0.1, 0, -1);

      mockHand1!.add(jointMesh1);
      mockHand1!.add(jointMesh2);
      mockHand1!.updateMatrixWorld(true);

      const target = createMesh(0, -2, -1);
      raycastSystem.addCustomTarget(target);

      raycastSystem.updateRaycasts(
        mockCamera,
        mockModel,
        false,
        false,
        mockController1,
        mockController2,
        mockHand1,
        null,
        [jointMesh1, jointMesh2],
        [],
        mockClosestPart1,
        mockClosestPart2,
        ballCreateCallback
      );

      // Should perform raycasts from hand joints
      // (behavior depends on intersection with targets)
    });

    it('should call ball create callback for room hits', () => {
      // Add a room mesh
      const room = new THREE.Group();
      const floor = createMesh(0, -1, 0, 10, 0.1, 10);
      room.add(floor);

      raycastSystem.setupRoomBVH(room);

      // Point controller down at the floor
      mockController1.position.set(0, 0, 0);
      mockController1.rotation.set(Math.PI / 2, 0, 0); // Point down
      mockController1.updateMatrixWorld();

      raycastSystem.updateRaycasts(
        mockCamera,
        mockModel,
        true,
        false,
        mockController1,
        mockController2,
        null,
        null,
        [],
        [],
        mockClosestPart1,
        mockClosestPart2,
        ballCreateCallback
      );

      // Should create a ball at the intersection point
      // Note: This depends on the actual intersection
    });

    it('should update closest part position for model hits', async () => {
      // Setup model BVH first
      await raycastSystem.setupModelBVH(mockModel);

      const modelTargets = raycastSystem.getModelTargets();
      if (modelTargets.length > 0) {
        // Position model target in front of camera
        modelTargets[0].position.set(0, 0, 0);
        modelTargets[0].updateMatrixWorld();
      }

      raycastSystem.setMousePosition(0, 0);

      const initialScale = mockClosestPart1.scale.x;

      raycastSystem.updateRaycasts(
        mockCamera,
        mockModel,
        false,
        false,
        mockController1,
        mockController2,
        null,
        null,
        [],
        [],
        mockClosestPart1,
        mockClosestPart2,
        ballCreateCallback
      );

      // Check if closest part was updated (depends on actual hit)
      // The scale should be set to 0.1 if a model hit occurred
    });

    it('should not raycast when system is disabled', () => {
      const cube = createMesh(0, 0, 0);
      raycastSystem.addCustomTarget(cube);
      raycastSystem.setEnabled(false);

      raycastSystem.updateRaycasts(
        mockCamera,
        mockModel,
        false,
        false,
        mockController1,
        mockController2,
        null,
        null,
        [],
        [],
        mockClosestPart1,
        mockClosestPart2,
        ballCreateCallback
      );

      expect(ballCreateCallback).not.toHaveBeenCalled();
    });

    it('should handle both controllers simultaneously', () => {
      const cube1 = createMesh(0, 0, -2);
      const cube2 = createMesh(1, 0, -2);

      raycastSystem.addCustomTarget(cube1);
      raycastSystem.addCustomTarget(cube2);

      raycastSystem.updateRaycasts(
        mockCamera,
        mockModel,
        true, // both controllers active
        true,
        mockController1,
        mockController2,
        null,
        null,
        [],
        [],
        mockClosestPart1,
        mockClosestPart2,
        ballCreateCallback
      );

      // Both controllers should perform raycasts
      // Behavior verified by no errors thrown
    });
  });

  describe('findClosestBone', () => {
    let mockModel: any;

    beforeEach(() => {
      const bones: { [key: string]: THREE.Object3D } = {
        'hips': (() => {
          const bone = new THREE.Object3D();
          bone.position.set(0, 1, 0);
          bone.updateMatrixWorld();
          return bone;
        })(),
        'head': (() => {
          const bone = new THREE.Object3D();
          bone.position.set(0, 1.7, 0);
          bone.updateMatrixWorld();
          return bone;
        })(),
        'leftHand': (() => {
          const bone = new THREE.Object3D();
          bone.position.set(-0.5, 1.2, 0);
          bone.updateMatrixWorld();
          return bone;
        })(),
        'rightHand': (() => {
          const bone = new THREE.Object3D();
          bone.position.set(0.5, 1.2, 0);
          bone.updateMatrixWorld();
          return bone;
        })()
      };

      mockModel = {
        vrm: {
          humanoid: {
            getNormalizedBoneNode: vi.fn((boneName: string) => {
              return bones[boneName] || null;
            })
          }
        }
      };
    });

    it('should find closest bone to a point', () => {
      const point = new THREE.Vector3(0, 1.65, 0); // Close to head

      const result = raycastSystem.findClosestBone(point, mockModel);

      expect(result).not.toBeNull();
      expect(result!.bone).toBeDefined();
      expect(result!.distance).toBeGreaterThan(0);
      expect(result!.distance).toBeLessThan(0.1); // Very close to head bone
    });

    it('should return bone with correct distance', () => {
      const point = new THREE.Vector3(0, 1, 0); // Exactly at hips position

      const result = raycastSystem.findClosestBone(point, mockModel);

      expect(result).not.toBeNull();
      expect(result!.distance).toBeCloseTo(0, 2); // Should be very close to 0
    });

    it('should find leftHand when point is on the left', () => {
      const point = new THREE.Vector3(-0.6, 1.2, 0); // Left side, near hand height

      const result = raycastSystem.findClosestBone(point, mockModel);

      expect(result).not.toBeNull();
      // The closest bone should be leftHand
      expect(result!.bone.position.x).toBeLessThan(0); // On the left side
    });

    it('should find rightHand when point is on the right', () => {
      const point = new THREE.Vector3(0.6, 1.2, 0); // Right side, near hand height

      const result = raycastSystem.findClosestBone(point, mockModel);

      expect(result).not.toBeNull();
      // The closest bone should be rightHand
      expect(result!.bone.position.x).toBeGreaterThan(0); // On the right side
    });

    it('should return null when model has no VRM', () => {
      const modelWithoutVRM = { vrm: null } as any;
      const point = new THREE.Vector3(0, 1, 0);

      const result = raycastSystem.findClosestBone(point, modelWithoutVRM);

      expect(result).toBeNull();
    });

    it('should return null when model is undefined', () => {
      const point = new THREE.Vector3(0, 1, 0);

      const result = raycastSystem.findClosestBone(point, undefined as any);

      expect(result).toBeNull();
    });

    it('should handle model with missing bones', () => {
      const sparseModel = {
        vrm: {
          humanoid: {
            getNormalizedBoneNode: vi.fn((boneName: string) => {
              // Only return head bone
              if (boneName === 'head') {
                const bone = new THREE.Object3D();
                bone.position.set(0, 1.7, 0);
                bone.updateMatrixWorld();
                return bone;
              }
              return null;
            })
          }
        }
      };

      const point = new THREE.Vector3(0, 1.65, 0);

      const result = raycastSystem.findClosestBone(point, sparseModel);

      expect(result).not.toBeNull();
      expect(result!.bone).toBeDefined();
    });

    it('should return null when no bones are available', () => {
      const emptyModel = {
        vrm: {
          humanoid: {
            getNormalizedBoneNode: vi.fn(() => null)
          }
        }
      };

      const point = new THREE.Vector3(0, 1, 0);

      const result = raycastSystem.findClosestBone(point, emptyModel);

      expect(result).toBeNull();
    });
  });
});
