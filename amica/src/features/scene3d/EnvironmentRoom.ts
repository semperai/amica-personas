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
  public async loadRoom(config: RoomGLTFConfig): Promise<void>;
  /**
   * @deprecated Use loadRoom(config) instead
   */
  public async loadRoom(url: string, setLoadingProgress: (progress: string) => void): Promise<void>;
  public async loadRoom(
    urlOrConfig: string | RoomGLTFConfig,
    setLoadingProgress?: (progress: string) => void,
  ): Promise<void> {
    // Handle legacy API
    if (typeof urlOrConfig === 'string') {
      return this._loadRoomLegacy(urlOrConfig, setLoadingProgress!);
    }

    // Use new config-based API
    const { url, onProgress, onError } = urlOrConfig;

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
   * Legacy room loading implementation
   * @private
   */
  private async _loadRoomLegacy(
    url: string,
    setLoadingProgress: (progress: string) => void,
  ): Promise<void> {
    const loader = new GLTFLoader();
    /*
    const loader = new OptimizedGLTFLoader({
      // Texture optimizations
      skipTextures: true,          // Skip loading textures completely
      maxTextureSize: 512,         // Maximum texture size
      generateMipmaps: false,      // Disable mipmaps

      // Geometry optimizations
      skipDraco: true,            // Skip Draco decoder setup
      preserveIndices: false,     // Remove index buffers

      // Animation/Material optimizations
      skipAnimations: true,       // Skip loading animations
      simplifyMaterials: true,    // Use simplified materials
      disableNormalMaps: true,    // Disable normal maps

      // Performance optimizations
      disposeSourceData: true,    // Clear source data after load

      // Optional callbacks for fine-tuning
      onMesh: (mesh) => {
        // Custom mesh optimizations
        mesh.castShadow = false;
        mesh.receiveShadow = false;
      },
      onMaterial: (material) => {
        // Custom material optimizations
        if (material instanceof THREE.MeshStandardMaterial) {
          material.envMapIntensity = 0;
        }
      },
      onTexture: (texture) => {
        // Custom texture optimizations
        texture.encoding = THREE.LinearEncoding;
      },
    });
    */
    return new Promise((resolve, reject) => {
      loader.load(
        url,
        async (gltf) => {
          setLoadingProgress('Room fully 100% loaded');
          /*
          {
            const analyzer = new GLTFAnalyzer();
            const stats = analyzer.analyzeModel(gltf);
            console.log('Model Statistics:', stats);
            const suggestions = analyzer.suggestOptimizations(stats);
            console.log('Optimization Suggestions:', suggestions);
          }
          {
          // Or for more control:
            const optimizer = new TransparencyOptimizer();
            const stats = optimizer.analyzeTransparency(gltf);
            console.log('Transparency analysis:', stats);
            // Check for issues
            const issues = optimizer.logTransparencyIssues();
            console.log('Transparency issues:', issues);

            // Apply optimizations
            optimizer.optimizeTransparency(gltf, {
              disableTransparency: true,     // Completely disable all transparency
              minAlphaThreshold: 0.9,        // Convert nearly opaque materials to fully opaque
              convertToAlphaTest: false,      // Convert transparency to alphaTest where possible
              alphaTestThreshold: 0.5        // Threshold for alphaTest conversion
            });
          }
          */

          // await downscaleModelTextures(gltf, 128);
          /*
          gltf.scene.traverse((obj: any) => {
            obj.frustumCulled = false;
          });
          */
          this.room = gltf.scene;

          resolve();
        },
        (xhr) => {
          setLoadingProgress(
            `${Math.floor((xhr.loaded / xhr.total) * 10000) / 100}% loaded`,
          );
        },
        (error) => {
          reject(error);
        },
      );
    });
  }

  /**
   * Load a Gaussian splat with configuration options
   */
  public async loadSplat(config: RoomSplatConfig): Promise<void>;
  /**
   * @deprecated Use loadSplat(config) instead
   */
  public async loadSplat(url: string): Promise<void>;
  public async loadSplat(urlOrConfig: string | RoomSplatConfig): Promise<void> {
    // Handle legacy API
    if (typeof urlOrConfig === 'string') {
      return this._loadSplatLegacy(urlOrConfig);
    }

    // Use new config-based API
    const {
      url,
      progressiveLoad = true,
      sharedMemoryForWorkers = false,
      gpuAcceleratedSort = false,
      splatAlphaRemovalThreshold = 20,
      onError,
    } = urlOrConfig;

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
   * Legacy splat loading implementation
   * @private
   */
  private async _loadSplatLegacy(url: string): Promise<void> {
    this.splat = new GaussianSplats3D.DropInViewer({
      progressiveLoad: true,
      // freeIntermediateSplatData: true,
      // https://github.com/mkkellogg/GaussianSplats3D?tab=readme-ov-file#cors-issues-and-sharedarraybuffer
      sharedMemoryForWorkers: false,
      gpuAcceleratedSort: false,
    });
    return this.splat.addSplatScene(url, {
      // splatAlphaRemovalThreshold: 5,
      splatAlphaRemovalThreshold: 20,
      // scale: [3, 3, 3],
      // position: [0, -1, 0],
    });
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
