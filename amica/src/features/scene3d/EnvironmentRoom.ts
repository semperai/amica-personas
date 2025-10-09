import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader";
// @ts-ignore
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';
import { downscaleModelTextures, logTextureInfo } from '@/utils/graphics/textureDownscaler';
import { OptimizedGLTFLoader } from '@/utils/graphics/glTFOptimizer';
import { GLTFAnalyzer } from '@/utils/graphics/glTFAnalyzer';
import { TransparencyOptimizer, checkAndOptimizeTransparency } from '@/utils/graphics/transparencyOptimizer';
import { config } from "@/utils/config";

/**
 * Configuration options for loading a room GLTF model
 */
export interface RoomGLTFConfig {
  /** URL of the GLTF/GLB file */
  url: string;
  /** Progress callback */
  onProgress?: (progress: string) => void;
  /** Error callback */
  onError?: (error: Error) => void;
}

/**
 * Configuration options for loading a Gaussian splat
 */
export interface RoomSplatConfig {
  /** URL of the splat file */
  url: string;
  /** Enable progressive loading */
  progressiveLoad?: boolean;
  /** Use shared memory for workers (requires special headers) */
  sharedMemoryForWorkers?: boolean;
  /** Enable GPU-accelerated sorting */
  gpuAcceleratedSort?: boolean;
  /** Alpha removal threshold for splat optimization */
  splatAlphaRemovalThreshold?: number;
  /** Error callback */
  onError?: (error: Error) => void;
}

/**
 * Manages individual room assets (GLTF models and Gaussian splats)
 *
 * This class handles the low-level loading of 3D assets.
 * For scene management, use EnvironmentManager instead.
 */
export class Room {
  public room?: THREE.Group;
  public splat?: any;

  /**
   * Load a GLTF room model with configuration options
   */
  public async loadRoom(config: RoomGLTFConfig): Promise<void> {
    const { url, onProgress, onError } = config;

    try {
      const loader = new GLTFLoader();

      return new Promise((resolve, reject) => {
        loader.load(
          url,
          async (gltf) => {
            onProgress?.('Room fully 100% loaded');
            this.room = gltf.scene;
            resolve();
          },
          (xhr) => {
            const progress = `${Math.floor((xhr.loaded / xhr.total) * 10000) / 100}% loaded`;
            onProgress?.(progress);
          },
          (error) => {
            const err = error instanceof Error ? error : new Error(String(error));
            onError?.(err);
            reject(err);
          },
        );
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
      throw err;
    }
  }


  /**
   * Load a Gaussian splat with configuration options
   */
  public async loadSplat(config: RoomSplatConfig): Promise<void> {
    const {
      url,
      progressiveLoad = true,
      sharedMemoryForWorkers = false,
      gpuAcceleratedSort = false,
      splatAlphaRemovalThreshold = 20,
      onError,
    } = config;

    try {
      this.splat = new GaussianSplats3D.DropInViewer({
        progressiveLoad,
        sharedMemoryForWorkers,
        gpuAcceleratedSort,
      });

      return this.splat.addSplatScene(url, {
        splatAlphaRemovalThreshold,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
      throw err;
    }
  }


  /**
   * Dispose of all loaded resources
   */
  public dispose(): void {
    if (this.room) {
      this.room.traverse((obj: any) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((mat: any) => mat.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
      this.room = undefined;
    }

    if (this.splat) {
      // TODO: Add proper splat disposal if available
      this.splat = undefined;
    }
  }
}
