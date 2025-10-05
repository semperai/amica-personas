import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PhysicsSystem } from '@/features/scene3d/PhysicsSystem';
import * as THREE from 'three';

// Mock Rapier.js
let mockWorld: any;
let mockEventQueue: any;

vi.mock('@dimforge/rapier3d-compat', () => {
  mockWorld = {
    step: vi.fn(),
    createRigidBody: vi.fn(),
    createCollider: vi.fn(),
    removeRigidBody: vi.fn(),
    createImpulseJoint: vi.fn(),
    gravity: { x: 0, y: -7.8, z: 0 },
  };

  mockEventQueue = {
    drainCollisionEvents: vi.fn(),
    drainContactForceEvents: vi.fn(),
  };

  return {
    default: {
      World: vi.fn(() => mockWorld),
      EventQueue: vi.fn(() => mockEventQueue),
      RigidBodyDesc: {
        dynamic: vi.fn(() => ({
          setTranslation: vi.fn().mockReturnThis(),
          setRotation: vi.fn().mockReturnThis(),
        })),
        fixed: vi.fn(() => ({
          setTranslation: vi.fn().mockReturnThis(),
          setRotation: vi.fn().mockReturnThis(),
        })),
        kinematicPositionBased: vi.fn(() => ({
          setTranslation: vi.fn().mockReturnThis(),
          setRotation: vi.fn().mockReturnThis(),
        })),
      },
      ColliderDesc: {
        cuboid: vi.fn(() => ({
          setMass: vi.fn().mockReturnThis(),
          setFriction: vi.fn().mockReturnThis(),
          setRestitution: vi.fn().mockReturnThis(),
        })),
        ball: vi.fn(() => ({
          setMass: vi.fn().mockReturnThis(),
          setFriction: vi.fn().mockReturnThis(),
          setRestitution: vi.fn().mockReturnThis(),
        })),
        cylinder: vi.fn(() => ({
          setMass: vi.fn().mockReturnThis(),
          setFriction: vi.fn().mockReturnThis(),
          setRestitution: vi.fn().mockReturnThis(),
        })),
      },
      JointData: {
        spherical: vi.fn(),
      },
    },
  };
});

describe('PhysicsSystem', () => {
  let physicsSystem: PhysicsSystem;

  beforeEach(async () => {
    // Reset gravity before each test
    mockWorld.gravity = { x: 0, y: -7.8, z: 0 };

    physicsSystem = new PhysicsSystem();
    await physicsSystem.initialize();
  });

  describe('initialization', () => {
    it('should initialize physics world', async () => {
      expect(physicsSystem.isInitialized).toBe(true);
    });

    it('should create world and event queue', async () => {
      expect(physicsSystem.getWorld()).toBeDefined();
      expect(physicsSystem.getEventQueue()).toBeDefined();
    });

    it('should have RAPIER module available', async () => {
      expect(physicsSystem.getRAPIER()).toBeDefined();
    });
  });

  describe('stepSimulation', () => {
    it('should step physics simulation', () => {
      const delta = 0.016;

      physicsSystem.stepSimulation(delta);

      expect(mockWorld.step).toHaveBeenCalled();
    });

    it('should handle errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockWorld.step.mockImplementationOnce(() => {
        throw new Error('Physics error');
      });

      expect(() => physicsSystem.stepSimulation(0.016)).not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      // Restore step function
      mockWorld.step.mockImplementation(() => {});
    });

    it('should not step when not initialized', () => {
      const newSystem = new PhysicsSystem();
      expect(() => newSystem.stepSimulation(0.016)).not.toThrow();
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

  describe('helper methods', () => {
    it('should create rigid body', () => {
      const body = physicsSystem.createRigidBody('dynamic', { x: 0, y: 1, z: 0 });
      expect(body).toBeDefined();
    });

    it('should set gravity', () => {
      physicsSystem.setGravity(0, -9.81, 0);
      expect(mockWorld.gravity).toEqual({ x: 0, y: -9.81, z: 0 });
    });
  });
});
