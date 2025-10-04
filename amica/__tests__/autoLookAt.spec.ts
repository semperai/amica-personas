import { describe, it, expect, vi } from 'vitest';
import { AutoLookAt } from '../src/features/emoteController/autoLookAt';
import * as THREE from 'three';

// Mock VRM
const createMockVRM = (hasLookAt: boolean = true) => {
  const lookAt = hasLookAt ? {
    target: null as any,
    autoUpdate: true,
    update: vi.fn(),
  } : undefined;

  return {
    lookAt,
    scene: new THREE.Group(),
    humanoid: {} as any,
    meta: {} as any,
    materials: [] as any[],
    expressionManager: null as any,
    firstPerson: null as any,
    springBoneManager: null as any,
    nodeConstraintManager: null as any,
    update: vi.fn(),
  };
};

describe('AutoLookAt', () => {
  describe('constructor', () => {
    it('should create AutoLookAt instance', () => {
      const mockVRM = createMockVRM();
      const mockCamera = new THREE.Object3D();

      const autoLookAt = new AutoLookAt(mockVRM as any, mockCamera);

      expect(autoLookAt).toBeDefined();
    });

    it('should add look at target to camera', () => {
      const mockVRM = createMockVRM();
      const mockCamera = new THREE.Object3D();

      new AutoLookAt(mockVRM as any, mockCamera);

      expect(mockCamera.children.length).toBe(1);
      expect(mockCamera.children[0]).toBeInstanceOf(THREE.Object3D);
    });

    it('should set VRM lookAt target when vrm.lookAt exists', () => {
      const mockVRM = createMockVRM(true);
      const mockCamera = new THREE.Object3D();

      new AutoLookAt(mockVRM as any, mockCamera);

      expect(mockVRM.lookAt?.target).toBeDefined();
      expect(mockVRM.lookAt?.target).toBeInstanceOf(THREE.Object3D);
    });

    it('should handle VRM without lookAt', () => {
      const mockVRM = createMockVRM(false);
      const mockCamera = new THREE.Object3D();

      const autoLookAt = new AutoLookAt(mockVRM as any, mockCamera);

      expect(autoLookAt).toBeDefined();
      expect(mockCamera.children.length).toBe(1);
    });

    it('should create lookAt target as child of camera', () => {
      const mockVRM = createMockVRM();
      const mockCamera = new THREE.Object3D();

      new AutoLookAt(mockVRM as any, mockCamera);

      const lookAtTarget = mockCamera.children[0];
      expect(lookAtTarget.parent).toBe(mockCamera);
    });

    it('should initialize lookAt target at origin', () => {
      const mockVRM = createMockVRM();
      const mockCamera = new THREE.Object3D();

      new AutoLookAt(mockVRM as any, mockCamera);

      const lookAtTarget = mockCamera.children[0];
      expect(lookAtTarget.position.x).toBe(0);
      expect(lookAtTarget.position.y).toBe(0);
      expect(lookAtTarget.position.z).toBe(0);
    });

    it('should work with positioned camera', () => {
      const mockVRM = createMockVRM();
      const mockCamera = new THREE.Object3D();
      mockCamera.position.set(1, 2, 3);

      new AutoLookAt(mockVRM as any, mockCamera);

      expect(mockCamera.children.length).toBe(1);
    });

    it('should work with rotated camera', () => {
      const mockVRM = createMockVRM();
      const mockCamera = new THREE.Object3D();
      mockCamera.rotation.set(Math.PI / 4, Math.PI / 4, 0);

      new AutoLookAt(mockVRM as any, mockCamera);

      expect(mockCamera.children.length).toBe(1);
    });

    it('should maintain reference to same lookAt target', () => {
      const mockVRM = createMockVRM();
      const mockCamera = new THREE.Object3D();

      new AutoLookAt(mockVRM as any, mockCamera);

      const target1 = mockVRM.lookAt?.target;
      const target2 = mockCamera.children[0];

      expect(target1).toBe(target2);
    });
  });

  describe('integration', () => {
    it('should handle multiple AutoLookAt instances', () => {
      const mockVRM1 = createMockVRM();
      const mockVRM2 = createMockVRM();
      const mockCamera1 = new THREE.Object3D();
      const mockCamera2 = new THREE.Object3D();

      const autoLookAt1 = new AutoLookAt(mockVRM1 as any, mockCamera1);
      const autoLookAt2 = new AutoLookAt(mockVRM2 as any, mockCamera2);

      expect(autoLookAt1).toBeDefined();
      expect(autoLookAt2).toBeDefined();
      expect(mockCamera1.children[0]).not.toBe(mockCamera2.children[0]);
    });

    it('should work with PerspectiveCamera', () => {
      const mockVRM = createMockVRM();
      const perspectiveCamera = new THREE.PerspectiveCamera();

      const autoLookAt = new AutoLookAt(mockVRM as any, perspectiveCamera);

      expect(autoLookAt).toBeDefined();
      expect(perspectiveCamera.children.length).toBe(1);
    });

    it('should work with OrthographicCamera', () => {
      const mockVRM = createMockVRM();
      const orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1);

      const autoLookAt = new AutoLookAt(mockVRM as any, orthoCamera);

      expect(autoLookAt).toBeDefined();
      expect(orthoCamera.children.length).toBe(1);
    });
  });
});
