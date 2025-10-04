import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PhysicsSystem } from '@/features/scene3d/PhysicsSystem';
import * as THREE from 'three';

// Mock Ammo.js
const mockAmmo = {
  btDefaultCollisionConfiguration: vi.fn(),
  btCollisionDispatcher: vi.fn(),
  btDbvtBroadphase: vi.fn(),
  btSequentialImpulseConstraintSolver: vi.fn(),
  btDiscreteDynamicsWorld: vi.fn().mockReturnValue({
    setGravity: vi.fn(),
    stepSimulation: vi.fn(),
  }),
  btVector3: vi.fn(),
  btTransform: vi.fn(),
};

global.window = {
  Ammo: mockAmmo,
} as any;

describe('PhysicsSystem', () => {
  let physicsSystem: PhysicsSystem;

  beforeEach(async () => {
    physicsSystem = new PhysicsSystem();
    await physicsSystem.initialize();
  });

  describe('initialization', () => {
    it('should initialize physics world', async () => {
      expect(physicsSystem.isInitialized).toBe(true);
    });

    it('should create physics world components', async () => {
      expect(mockAmmo.btDefaultCollisionConfiguration).toHaveBeenCalled();
      expect(mockAmmo.btCollisionDispatcher).toHaveBeenCalled();
      expect(mockAmmo.btDbvtBroadphase).toHaveBeenCalled();
      expect(mockAmmo.btSequentialImpulseConstraintSolver).toHaveBeenCalled();
      expect(mockAmmo.btDiscreteDynamicsWorld).toHaveBeenCalled();
    });
  });

  describe('stepSimulation', () => {
    it('should step physics simulation', () => {
      const delta = 0.016;
      physicsSystem.stepSimulation(delta);

      const physicsWorld = physicsSystem.getPhysicsWorld();
      expect(physicsWorld.stepSimulation).toHaveBeenCalledWith(delta, 10);
    });

    it('should handle errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const physicsWorld = physicsSystem.getPhysicsWorld();
      physicsWorld.stepSimulation.mockImplementationOnce(() => {
        throw new Error('Physics error');
      });

      expect(() => physicsSystem.stepSimulation(0.016)).not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('applyWind', () => {
    it('should apply wind to VRM spring bones', () => {
      const mockSpringBone = {
        settings: {
          gravityDir: new THREE.Vector3(),
          gravityPower: 0,
        },
      };

      const mockVrm = {
        springBoneManager: {
          joints: [mockSpringBone, mockSpringBone],
        },
      } as any;

      const windDir = new THREE.Vector3(1, 0, 0);
      const strength = 2.5;

      physicsSystem.applyWind(mockVrm, windDir, strength);

      expect(mockSpringBone.settings.gravityDir).toBe(windDir);
      expect(mockSpringBone.settings.gravityPower).toBe(strength);
    });

    it('should handle undefined VRM', () => {
      const windDir = new THREE.Vector3(1, 0, 0);
      expect(() => physicsSystem.applyWind(undefined, windDir, 1)).not.toThrow();
    });
  });
});
