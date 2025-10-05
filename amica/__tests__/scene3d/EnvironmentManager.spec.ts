import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { EnvironmentManager } from '@/features/scene3d/EnvironmentManager';
import { Room } from '@/features/scene3d/EnvironmentRoom';

// Mock the Room class
vi.mock('@/features/scene3d/EnvironmentRoom', () => ({
  Room: vi.fn().mockImplementation(() => ({
    room: undefined,
    splat: undefined,
    loadRoom: vi.fn(),
    loadSplat: vi.fn(),
    dispose: vi.fn(),
  })),
}));

// Mock loading progress utilities
vi.mock('@/utils/fileLoadingProgress', () => ({
  setLoadingStage: vi.fn(),
  completeLoading: vi.fn(),
}));

describe('EnvironmentManager', () => {
  let manager: EnvironmentManager;
  let scene: THREE.Scene;

  beforeEach(() => {
    vi.clearAllMocks();
    scene = new THREE.Scene();
    manager = new EnvironmentManager(scene);
  });

  describe('initialization', () => {
    it('should initialize with a scene', () => {
      expect(manager).toBeDefined();
      expect(manager.hasRoom()).toBe(false);
      expect(manager.hasSplat()).toBe(false);
    });
  });

  describe('event subscription API', () => {
    it('should subscribe to room loaded events', () => {
      const callback = vi.fn();
      const unsubscribe = manager.onRoomLoaded(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should unsubscribe from room loaded events', () => {
      const callback = vi.fn();
      const unsubscribe = manager.onRoomLoaded(callback);

      unsubscribe();
      // After unsubscribing, callback should not be called
      // This would be tested in integration when loadRoom is implemented
    });

    it('should subscribe to room unloaded events', () => {
      const callback = vi.fn();
      const unsubscribe = manager.onRoomUnloaded(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should subscribe to splat loaded events', () => {
      const callback = vi.fn();
      const unsubscribe = manager.onSplatLoaded(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should support legacy setOnRoomLoadedCallback', () => {
      const callback = vi.fn();
      manager.setOnRoomLoadedCallback(callback);
      // Should not throw
    });
  });

  describe('loadRoom with config API', () => {
    beforeEach(() => {
      // Setup mock Room instance
      const mockRoom = new Room();
      mockRoom.room = new THREE.Group();
      (mockRoom.loadRoom as any).mockResolvedValue(undefined);
      (Room as any).mockImplementation(() => mockRoom);
    });

    it('should load room with minimal config', async () => {
      const mockRoom = new Room();
      mockRoom.room = new THREE.Group();
      (mockRoom.loadRoom as any).mockResolvedValue(undefined);
      (Room as any).mockImplementation(() => mockRoom);

      await manager.loadRoom({
        url: 'test-room.glb',
      });

      expect(manager.hasRoom()).toBe(true);
      expect(scene.children).toContain(mockRoom.room);
    });

    it('should load room with full config', async () => {
      const mockRoom = new Room();
      mockRoom.room = new THREE.Group();
      (mockRoom.loadRoom as any).mockResolvedValue(undefined);
      (Room as any).mockImplementation(() => mockRoom);

      const onProgress = vi.fn();
      const onComplete = vi.fn();
      const onError = vi.fn();

      await manager.loadRoom({
        url: 'test-room.glb',
        position: new THREE.Vector3(1, 2, 3),
        rotation: new THREE.Euler(0.1, 0.2, 0.3),
        scale: new THREE.Vector3(2, 2, 2),
        autoCompleteLoading: false,
        onProgress,
        onComplete,
        onError,
      });

      expect(manager.hasRoom()).toBe(true);
      expect(onProgress).toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();

      const roomObj = mockRoom.room!;
      expect(roomObj.position.x).toBe(1);
      expect(roomObj.position.y).toBe(2);
      expect(roomObj.position.z).toBe(3);
      expect(roomObj.scale.x).toBe(2);
      expect(roomObj.scale.y).toBe(2);
      expect(roomObj.scale.z).toBe(2);
    });

    it('should apply default transforms when not specified', async () => {
      const mockRoom = new Room();
      mockRoom.room = new THREE.Group();
      (mockRoom.loadRoom as any).mockResolvedValue(undefined);
      (Room as any).mockImplementation(() => mockRoom);

      await manager.loadRoom({
        url: 'test-room.glb',
      });

      const roomObj = mockRoom.room!;
      expect(roomObj.position.x).toBe(0);
      expect(roomObj.position.y).toBe(0);
      expect(roomObj.position.z).toBe(0);
      expect(roomObj.scale.x).toBe(1);
      expect(roomObj.scale.y).toBe(1);
      expect(roomObj.scale.z).toBe(1);
    });

    it('should call onRoomLoaded callbacks', async () => {
      const mockRoom = new Room();
      mockRoom.room = new THREE.Group();
      (mockRoom.loadRoom as any).mockResolvedValue(undefined);
      (Room as any).mockImplementation(() => mockRoom);

      const callback1 = vi.fn();
      const callback2 = vi.fn();

      manager.onRoomLoaded(callback1);
      manager.onRoomLoaded(callback2);

      await manager.loadRoom({
        url: 'test-room.glb',
      });

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should handle room load errors', async () => {
      const mockRoom = new Room();
      const error = new Error('Failed to load room');
      (mockRoom.loadRoom as any).mockRejectedValue(error);
      (Room as any).mockImplementation(() => mockRoom);

      const onError = vi.fn();

      await expect(
        manager.loadRoom({
          url: 'invalid-room.glb',
          onError,
        })
      ).rejects.toThrow('Failed to load room');

      expect(onError).toHaveBeenCalledWith(error);
    });

    it('should throw error when room fails to load', async () => {
      const mockRoom = new Room();
      mockRoom.room = undefined; // Simulate failure
      (mockRoom.loadRoom as any).mockResolvedValue(undefined);
      (Room as any).mockImplementation(() => mockRoom);

      await expect(
        manager.loadRoom({
          url: 'test-room.glb',
        })
      ).rejects.toThrow('Room failed to load');
    });
  });

  describe('loadRoom legacy API', () => {
    it('should support legacy loadRoom signature', async () => {
      const mockRoom = new Room();
      mockRoom.room = new THREE.Group();
      (mockRoom.loadRoom as any).mockResolvedValue(undefined);
      (Room as any).mockImplementation(() => mockRoom);

      const onProgress = vi.fn();

      await manager.loadRoom(
        'test-room.glb',
        new THREE.Vector3(0, 0, 0),
        new THREE.Euler(0, 0, 0),
        new THREE.Vector3(1, 1, 1),
        onProgress
      );

      expect(manager.hasRoom()).toBe(true);
      expect(onProgress).toHaveBeenCalled();
    });
  });

  describe('unloadRoom', () => {
    it('should unload room from scene', async () => {
      const mockRoom = new Room();
      mockRoom.room = new THREE.Group();
      (mockRoom.loadRoom as any).mockResolvedValue(undefined);
      (Room as any).mockImplementation(() => mockRoom);

      await manager.loadRoom({
        url: 'test-room.glb',
      });

      expect(scene.children).toContain(mockRoom.room);

      manager.unloadRoom();

      expect(scene.children).not.toContain(mockRoom.room);
    });

    it('should call onRoomUnloaded callbacks', async () => {
      const mockRoom = new Room();
      mockRoom.room = new THREE.Group();
      (mockRoom.loadRoom as any).mockResolvedValue(undefined);
      (Room as any).mockImplementation(() => mockRoom);

      const callback = vi.fn();
      manager.onRoomUnloaded(callback);

      await manager.loadRoom({
        url: 'test-room.glb',
      });

      manager.unloadRoom();

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should handle unloadRoom when no room is loaded', () => {
      expect(() => manager.unloadRoom()).not.toThrow();
    });
  });

  describe('room status checks', () => {
    it('should return false for hasRoom when no room loaded', () => {
      expect(manager.hasRoom()).toBe(false);
    });

    it('should return true for hasRoom when room loaded', async () => {
      const mockRoom = new Room();
      mockRoom.room = new THREE.Group();
      (mockRoom.loadRoom as any).mockResolvedValue(undefined);
      (Room as any).mockImplementation(() => mockRoom);

      await manager.loadRoom({
        url: 'test-room.glb',
      });

      expect(manager.hasRoom()).toBe(true);
    });

    it('should return room instance via getRoom', async () => {
      const mockRoom = new Room();
      mockRoom.room = new THREE.Group();
      (mockRoom.loadRoom as any).mockResolvedValue(undefined);
      (Room as any).mockImplementation(() => mockRoom);

      await manager.loadRoom({
        url: 'test-room.glb',
      });

      expect(manager.getRoom()).toBe(mockRoom);
    });

    it('should return room object via getRoomObject', async () => {
      const mockRoom = new Room();
      mockRoom.room = new THREE.Group();
      (mockRoom.loadRoom as any).mockResolvedValue(undefined);
      (Room as any).mockImplementation(() => mockRoom);

      await manager.loadRoom({
        url: 'test-room.glb',
      });

      expect(manager.getRoomObject()).toBe(mockRoom.room);
    });
  });

  describe('loadSplat with config API', () => {
    beforeEach(() => {
      // Mock scene.add to accept our mock objects
      scene.add = vi.fn();
      scene.remove = vi.fn();
    });

    it('should load splat with minimal config', async () => {
      const mockRoom = new Room();
      const mockSplatObj: any = {}
      mockSplatObj.position = new THREE.Vector3();
      mockSplatObj.rotation = new THREE.Euler();
      mockRoom.splat = mockSplatObj;
      (mockRoom.loadSplat as any).mockResolvedValue(undefined);
      (Room as any).mockImplementation(() => mockRoom);

      await manager.loadSplat({
        url: 'test-splat.ply',
      });

      expect(manager.hasSplat()).toBe(true);
      expect(scene.add).toHaveBeenCalledWith(mockRoom.splat);
    });

    it('should load splat with full config', async () => {
      const mockRoom = new Room();
      const mockSplatObj: any = {}
      mockSplatObj.position = new THREE.Vector3();
      mockSplatObj.rotation = new THREE.Euler();
      mockSplatObj.scale = new THREE.Vector3(1, 1, 1);
      mockRoom.splat = mockSplatObj;
      (mockRoom.loadSplat as any).mockResolvedValue(undefined);
      (Room as any).mockImplementation(() => mockRoom);

      const onComplete = vi.fn();
      const onError = vi.fn();

      await manager.loadSplat({
        url: 'test-splat.ply',
        position: new THREE.Vector3(5, 6, 7),
        rotation: new THREE.Euler(0.5, 0.6, 0.7),
        scale: new THREE.Vector3(2, 3, 4),
        progressiveLoad: true,
        gpuAcceleratedSort: true,
        onComplete,
        onError,
      });

      expect(manager.hasSplat()).toBe(true);
      expect(onComplete).toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    it('should call onSplatLoaded callbacks', async () => {
      const mockRoom = new Room();
      const mockSplatObj: any = {}
      mockSplatObj.position = new THREE.Vector3();
      mockSplatObj.rotation = new THREE.Euler();
      mockRoom.splat = mockSplatObj;
      (mockRoom.loadSplat as any).mockResolvedValue(undefined);
      (Room as any).mockImplementation(() => mockRoom);

      const callback = vi.fn();
      manager.onSplatLoaded(callback);

      await manager.loadSplat({
        url: 'test-splat.ply',
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should handle splat load errors', async () => {
      const mockRoom = new Room();
      const error = new Error('Failed to load splat');
      (mockRoom.loadSplat as any).mockRejectedValue(error);
      (Room as any).mockImplementation(() => mockRoom);

      const onError = vi.fn();

      await expect(
        manager.loadSplat({
          url: 'invalid-splat.ply',
          onError,
        })
      ).rejects.toThrow('Failed to load splat');

      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  describe('loadSplat legacy API', () => {
    beforeEach(() => {
      scene.add = vi.fn();
    });

    it('should support legacy loadSplat signature', async () => {
      const mockRoom = new Room();
      const mockSplatObj: any = {}
      mockSplatObj.position = new THREE.Vector3();
      mockSplatObj.rotation = new THREE.Euler();
      mockRoom.splat = mockSplatObj;
      (mockRoom.loadSplat as any).mockResolvedValue(undefined);
      (Room as any).mockImplementation(() => mockRoom);

      await manager.loadSplat('test-splat.ply');

      expect(manager.hasSplat()).toBe(true);
    });
  });

  describe('unloadSplat', () => {
    beforeEach(() => {
      scene.add = vi.fn();
      scene.remove = vi.fn();
    });

    it('should unload splat from scene', async () => {
      const mockRoom = new Room();
      const mockSplatObj: any = {}
      mockSplatObj.position = new THREE.Vector3();
      mockSplatObj.rotation = new THREE.Euler();
      mockRoom.splat = mockSplatObj;
      (mockRoom.loadSplat as any).mockResolvedValue(undefined);
      (Room as any).mockImplementation(() => mockRoom);

      await manager.loadSplat({
        url: 'test-splat.ply',
      });

      expect(scene.add).toHaveBeenCalledWith(mockSplatObj);

      const splatBeforeUnload = mockRoom.splat;
      manager.unloadSplat();

      expect(scene.remove).toHaveBeenCalledWith(splatBeforeUnload);
      expect(manager.hasSplat()).toBe(false);
    });

    it('should handle unloadSplat when no splat is loaded', () => {
      expect(() => manager.unloadSplat()).not.toThrow();
    });
  });

  describe('splat status checks', () => {
    beforeEach(() => {
      scene.add = vi.fn();
    });

    it('should return false for hasSplat when no splat loaded', () => {
      expect(manager.hasSplat()).toBe(false);
    });

    it('should return true for hasSplat when splat loaded', async () => {
      const mockRoom = new Room();
      const mockSplatObj: any = {}
      mockSplatObj.position = new THREE.Vector3();
      mockSplatObj.rotation = new THREE.Euler();
      mockRoom.splat = mockSplatObj;
      (mockRoom.loadSplat as any).mockResolvedValue(undefined);
      (Room as any).mockImplementation(() => mockRoom);

      await manager.loadSplat({
        url: 'test-splat.ply',
      });

      expect(manager.hasSplat()).toBe(true);
    });

    it('should return splat object via getSplat', async () => {
      const mockRoom = new Room();
      const mockSplatObj: any = {}
      mockSplatObj.position = new THREE.Vector3();
      mockSplatObj.rotation = new THREE.Euler();
      mockRoom.splat = mockSplatObj;
      (mockRoom.loadSplat as any).mockResolvedValue(undefined);
      (Room as any).mockImplementation(() => mockRoom);

      await manager.loadSplat({
        url: 'test-splat.ply',
      });

      expect(manager.getSplat()).toBe(mockRoom.splat);
    });
  });

  describe('updateSplat', () => {
    beforeEach(() => {
      scene.add = vi.fn();
    });

    it('should call splat update and render methods', async () => {
      const mockRoom = new Room();
      const mockSplatObj: any = {}
      mockSplatObj.position = new THREE.Vector3();
      mockSplatObj.rotation = new THREE.Euler();
      (mockSplatObj as any).update = vi.fn();
      (mockSplatObj as any).render = vi.fn();
      mockRoom.splat = mockSplatObj;
      (mockRoom.loadSplat as any).mockResolvedValue(undefined);
      (Room as any).mockImplementation(() => mockRoom);

      await manager.loadSplat({
        url: 'test-splat.ply',
      });

      const renderer = undefined; // WebGL not available in test env
      const camera = undefined;

      manager.updateSplat(renderer, camera);

      expect((mockRoom.splat as any).update).toHaveBeenCalledWith(renderer, camera);
      expect((mockRoom.splat as any).render).toHaveBeenCalled();
    });

    it('should handle updateSplat when no splat is loaded', () => {
      const renderer = undefined;
      const camera = undefined;

      expect(() => manager.updateSplat(renderer, camera)).not.toThrow();
    });

    it('should handle updateSplat with undefined renderer and camera', async () => {
      const mockRoom = new Room();
      const mockSplatObj: any = {}
      mockSplatObj.position = new THREE.Vector3();
      mockSplatObj.rotation = new THREE.Euler();
      (mockSplatObj as any).update = vi.fn();
      (mockSplatObj as any).render = vi.fn();
      mockRoom.splat = mockSplatObj;
      (mockRoom.loadSplat as any).mockResolvedValue(undefined);
      (Room as any).mockImplementation(() => mockRoom);

      await manager.loadSplat({
        url: 'test-splat.ply',
      });

      expect(() => manager.updateSplat(undefined, undefined)).not.toThrow();
    });
  });

  describe('dispose', () => {
    beforeEach(() => {
      scene.add = vi.fn();
    });

    it('should clean up all resources', async () => {
      const mockRoom = new Room();
      mockRoom.room = new THREE.Group();
      const mockSplatObj: any = {}
      mockSplatObj.position = new THREE.Vector3();
      mockSplatObj.rotation = new THREE.Euler();
      mockRoom.splat = mockSplatObj;
      (mockRoom.loadRoom as any).mockResolvedValue(undefined);
      (mockRoom.loadSplat as any).mockResolvedValue(undefined);
      (Room as any).mockImplementation(() => mockRoom);

      const callback = vi.fn();
      manager.onRoomLoaded(callback);

      await manager.loadRoom({ url: 'test-room.glb' });
      await manager.loadSplat({ url: 'test-splat.ply' });

      manager.dispose();

      expect(manager.hasRoom()).toBe(false);
      expect(manager.hasSplat()).toBe(false);
      expect(manager.getRoom()).toBeUndefined();
    });

    it('should handle dispose when nothing is loaded', () => {
      expect(() => manager.dispose()).not.toThrow();
    });
  });

  describe('auto-unload on new room load', () => {
    it('should automatically unload previous room when loading new one', async () => {
      const mockScene = new THREE.Scene();
      const sceneRemoveSpy = vi.spyOn(mockScene, 'remove');
      const sceneAddSpy = vi.spyOn(mockScene, 'add');
      manager = new EnvironmentManager(mockScene);

      const mockRoom1 = new Room();
      mockRoom1.room = new THREE.Group();
      (mockRoom1.loadRoom as any).mockResolvedValue(undefined);

      const mockRoom2 = new Room();
      mockRoom2.room = new THREE.Group();
      (mockRoom2.loadRoom as any).mockResolvedValue(undefined);

      (Room as any)
        .mockImplementationOnce(() => mockRoom1)
        .mockImplementationOnce(() => mockRoom2);

      const unloadCallback = vi.fn();
      manager.onRoomUnloaded(unloadCallback);

      await manager.loadRoom({ url: 'room1.glb' });
      expect(sceneAddSpy).toHaveBeenCalledWith(mockRoom1.room);

      await manager.loadRoom({ url: 'room2.glb' });
      expect(sceneRemoveSpy).toHaveBeenCalledWith(mockRoom1.room);
      expect(sceneAddSpy).toHaveBeenCalledWith(mockRoom2.room);
      expect(unloadCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('multiple subscribers', () => {
    it('should support multiple subscribers for same event', async () => {
      const mockRoom = new Room();
      mockRoom.room = new THREE.Group();
      (mockRoom.loadRoom as any).mockResolvedValue(undefined);
      (Room as any).mockImplementation(() => mockRoom);

      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      manager.onRoomLoaded(callback1);
      manager.onRoomLoaded(callback2);
      manager.onRoomLoaded(callback3);

      await manager.loadRoom({ url: 'test-room.glb' });

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(callback3).toHaveBeenCalledTimes(1);
    });

    it('should allow selective unsubscription', async () => {
      const mockRoom = new Room();
      mockRoom.room = new THREE.Group();
      (mockRoom.loadRoom as any).mockResolvedValue(undefined);
      (Room as any).mockImplementation(() => mockRoom);

      const callback1 = vi.fn();
      const callback2 = vi.fn();

      manager.onRoomLoaded(callback1);
      const unsubscribe2 = manager.onRoomLoaded(callback2);

      unsubscribe2();

      await manager.loadRoom({ url: 'test-room.glb' });

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).not.toHaveBeenCalled();
    });
  });
});
