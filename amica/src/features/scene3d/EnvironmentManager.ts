import * as THREE from "three";
import { Room } from "./EnvironmentRoom";
import { setLoadingStage, completeLoading } from "@/utils/fileLoadingProgress";

/**
 * Configuration options for loading a room
 */
export interface RoomLoadConfig {
  /** URL of the room model */
  url: string;
  /** Position in 3D space */
  position?: THREE.Vector3;
  /** Rotation in 3D space */
  rotation?: THREE.Euler;
  /** Scale of the model */
  scale?: THREE.Vector3;
  /** Whether to auto-complete loading after room loads */
  autoCompleteLoading?: boolean;
  /** Progress callback */
  onProgress?: (progress: string) => void;
  /** Completion callback */
  onComplete?: () => void;
  /** Error callback */
  onError?: (error: Error) => void;
}

/**
 * Configuration options for loading a splat
 */
export interface SplatLoadConfig {
  /** URL of the splat file */
  url: string;
  /** Position in 3D space */
  position?: THREE.Vector3;
  /** Rotation in 3D space */
  rotation?: THREE.Euler;
  /** Scale of the splat */
  scale?: THREE.Vector3;
  /** Enable progressive loading */
  progressiveLoad?: boolean;
  /** Use shared memory for workers (requires special headers) */
  sharedMemoryForWorkers?: boolean;
  /** Enable GPU-accelerated sorting */
  gpuAcceleratedSort?: boolean;
  /** Alpha removal threshold for splat optimization */
  splatAlphaRemovalThreshold?: number;
  /** Completion callback */
  onComplete?: () => void;
  /** Error callback */
  onError?: (error: Error) => void;
}

/**
 * Manages 3D environment loading and lifecycle
 *
 * Features:
 * - Room (GLTF) loading with transform configuration
 * - Gaussian splat loading and rendering
 * - Lifecycle callbacks for load events
 * - Automatic cleanup and memory management
 *
 * Usage:
 *   const manager = new EnvironmentManager(scene);
 *   await manager.loadRoom({ url: 'room.glb', position: new THREE.Vector3(0, 0, 0) });
 */
export class EnvironmentManager {
  private room?: Room;
  private scene: THREE.Scene;
  private callbacks = {
    onRoomLoaded: new Set<() => void>(),
    onRoomUnloaded: new Set<() => void>(),
    onSplatLoaded: new Set<() => void>(),
  };

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  // ========== Event Subscription API ==========

  /**
   * Subscribe to room loaded events
   * @returns Unsubscribe function
   */
  public onRoomLoaded(callback: () => void): () => void {
    this.callbacks.onRoomLoaded.add(callback);
    return () => this.callbacks.onRoomLoaded.delete(callback);
  }

  /**
   * Subscribe to room unloaded events
   * @returns Unsubscribe function
   */
  public onRoomUnloaded(callback: () => void): () => void {
    this.callbacks.onRoomUnloaded.add(callback);
    return () => this.callbacks.onRoomUnloaded.delete(callback);
  }

  /**
   * Subscribe to splat loaded events
   * @returns Unsubscribe function
   */
  public onSplatLoaded(callback: () => void): () => void {
    this.callbacks.onSplatLoaded.add(callback);
    return () => this.callbacks.onSplatLoaded.delete(callback);
  }


  // ========== Room Management API ==========

  /**
   * Load a room with configuration options
   */
  public async loadRoom(config: RoomLoadConfig): Promise<void> {
    const {
      url,
      position = new THREE.Vector3(0, 0, 0),
      rotation = new THREE.Euler(0, 0, 0),
      scale: configScale = new THREE.Vector3(1, 1, 1),
      autoCompleteLoading = true,
      onProgress,
      onComplete,
      onError,
    } = config;

    try {
      // Unload existing room
      if (this.room?.room) {
        this.unloadRoom();
      }

      this.room = new Room();
      onProgress?.("Loading room");
      setLoadingStage("Loading environment...", 85);

      // Load room with progress tracking
      await this.room.loadRoom({
        url,
        onProgress: (progress: string) => {
          onProgress?.(progress);
          // Extract percentage from progress string like "45.67% loaded"
          const match = progress.match(/(\d+\.?\d*)\s*%/);
          if (match) {
            const percentage = parseFloat(match[1]);
            // Map room loading (0-100%) to our overall progress (85-95%)
            const overallProgress = 85 + (percentage / 100) * 10;
            setLoadingStage(`Loading environment... ${Math.round(percentage)}%`, overallProgress);
          }
        },
        onError,
      });

      onProgress?.(`Room load complete`);
      setLoadingStage("Environment loaded", 95);

      if (!this.room?.room) {
        throw new Error("Room failed to load");
      }

      // Apply transforms
      this.room.room.position.copy(position);
      this.room.room.rotation.copy(rotation);
      this.room.room.scale.copy(configScale);
      this.scene.add(this.room.room);

      // Notify subscribers
      this.callbacks.onRoomLoaded.forEach(cb => cb());
      onComplete?.();

      // Auto-complete loading if enabled
      if (autoCompleteLoading) {
        setLoadingStage("Ready!", 100);
        setTimeout(() => completeLoading(), 500);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
      throw err;
    }
  }


  /**
   * Unload the current room and clean up resources
   */
  public unloadRoom(): void {
    if (this.room?.room) {
      this.scene.remove(this.room.room);
      this.room.room = undefined;
      this.callbacks.onRoomUnloaded.forEach(cb => cb());
    }
  }

  /**
   * Check if a room is currently loaded
   */
  public hasRoom(): boolean {
    return !!this.room?.room;
  }

  /**
   * Get the current room instance
   */
  public getRoom(): Room | undefined {
    return this.room;
  }

  /**
   * Get the room's 3D object
   */
  public getRoomObject(): THREE.Group | undefined {
    return this.room?.room;
  }

  // ========== Splat Management API ==========

  /**
   * Load a Gaussian splat with configuration options
   */
  public async loadSplat(config: SplatLoadConfig): Promise<void> {
    const {
      url,
      position = new THREE.Vector3(0, 4, 0),
      rotation = new THREE.Euler(0, 0, Math.PI),
      scale,
      progressiveLoad,
      sharedMemoryForWorkers,
      gpuAcceleratedSort,
      splatAlphaRemovalThreshold,
      onComplete,
      onError,
    } = config;

    try {
      if (!this.room) {
        this.room = new Room();
      }

      await this.room.loadSplat({
        url,
        progressiveLoad,
        sharedMemoryForWorkers,
        gpuAcceleratedSort,
        splatAlphaRemovalThreshold,
        onError,
      });

      if (!this.room?.splat) {
        throw new Error("Splat failed to load");
      }

      // Apply transforms
      this.room.splat.position.copy(position);
      this.room.splat.rotation.copy(rotation);
      if (scale) {
        this.room.splat.scale.copy(scale);
      }
      this.scene.add(this.room.splat);

      // Notify subscribers
      this.callbacks.onSplatLoaded.forEach(cb => cb());
      onComplete?.();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
      throw err;
    }
  }


  /**
   * Unload the current splat
   */
  public unloadSplat(): void {
    if (this.room?.splat) {
      this.scene.remove(this.room.splat);
      this.room.splat = undefined;
    }
  }

  /**
   * Check if a splat is currently loaded
   */
  public hasSplat(): boolean {
    return !!this.room?.splat;
  }

  /**
   * Get the splat object
   */
  public getSplat(): any {
    return this.room?.splat;
  }

  /**
   * Update splat rendering (call in animation loop)
   */
  public updateSplat(renderer: import("./RenderSystem").WebRenderer | undefined, camera: THREE.PerspectiveCamera | undefined): void {
    this.room?.splat?.update(renderer, camera);
    this.room?.splat?.render();
  }

  // ========== Utility API ==========

  /**
   * Completely clean up all resources
   */
  public dispose(): void {
    this.unloadRoom();
    this.unloadSplat();
    this.callbacks.onRoomLoaded.clear();
    this.callbacks.onRoomUnloaded.clear();
    this.callbacks.onSplatLoaded.clear();
    this.room = undefined;
  }
}
