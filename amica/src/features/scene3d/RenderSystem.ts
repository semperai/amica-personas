import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls";
import { InteractiveGroup } from "three/addons/interactive/InteractiveGroup.js";
import { config } from "@/utils/config";
import { Model } from "./VrmCharacterModel";
import type WebGPURenderer from "three/src/renderers/webgpu/WebGPURenderer.Nodes.js";

/**
 * Union type for WebGL and WebGPU renderers
 * Both renderers extend from the common Renderer base class
 * This allows the code to work with both renderer types while maintaining type safety
 */
export type WebRenderer = THREE.WebGLRenderer | WebGPURenderer;

export class RenderSystem {
  public renderer: WebRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public cameraControls: OrbitControls;
  public igroup: InteractiveGroup;

  private sendScreenshotToCallback: boolean = false;
  private screenshotCallback: BlobCallback | undefined;

  private constructor(
    renderer: WebRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    cameraControls: OrbitControls,
    igroup: InteractiveGroup,
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.cameraControls = cameraControls;
    this.igroup = igroup;
  }

  public static async create(canvas: HTMLCanvasElement): Promise<RenderSystem> {
    const parentElement = canvas.parentElement;
    const width = parentElement?.clientWidth || canvas.width;
    const height = parentElement?.clientHeight || canvas.height;

    // Mobile-specific checks to prevent crashes
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    // Check WebGL support before attempting to create renderer
    const testCanvas = document.createElement('canvas');
    const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');

    if (!gl) {
      throw new Error('WebGL is not supported on this device. Please try a different browser.');
    }

    console.log('[Renderer] WebGL supported. Creating renderer...');
    console.log('[Renderer] Device:', isMobile ? 'Mobile' : 'Desktop');
    console.log('[Renderer] User Agent:', navigator.userAgent);

    let renderer: WebRenderer;

    if (config("use_webgpu") === "true") {
      // Import from three/webgpu to match MToonNodeMaterial's imports
      // This ensures we use the same Three.js instance
      const { WebGPURenderer } = await import("three/webgpu");

      renderer = new WebGPURenderer({
        canvas: canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });

      // WebGPU renderer requires async initialization
      console.log('[Renderer] Initializing WebGPU renderer...');
      try {
        await renderer.init!();
        console.log('[Renderer] WebGPU renderer initialized');
      } catch (error) {
        console.error('[Renderer] Failed to initialize WebGPU renderer:', error);
        throw new Error('WebGPU initialization failed. Try disabling use_webgpu in config.');
      }
    } else {
      // Mobile-optimized settings
      const rendererOptions = {
        canvas: canvas,
        alpha: true,
        antialias: !isMobile, // Disable antialias on mobile for better performance
        powerPreference: isMobile ? "default" : "high-performance",
        failIfMajorPerformanceCaveat: false, // Don't fail on low-end devices
        preserveDrawingBuffer: false, // Better performance on mobile
      };

      console.log('[Renderer] Creating WebGL renderer with options:', rendererOptions);

      try {
        renderer = new THREE.WebGLRenderer(rendererOptions);
        console.log('[Renderer] WebGL renderer created successfully');
      } catch (error) {
        console.error('[Renderer] Failed to create WebGL renderer:', error);
        throw new Error(`Failed to create WebGL renderer: ${error}`);
      }
    }

    renderer.setClearColor(0x000000, 0);

    // shadowMap is only available in WebGL renderer
    if (renderer.shadowMap) {
      renderer.shadowMap.enabled = false;
    }

    renderer.setSize(width, height);

    // Limit pixel ratio on mobile to prevent performance issues
    const pixelRatio = isMobile
      ? Math.min(window.devicePixelRatio, 2)
      : window.devicePixelRatio;

    console.log('[Renderer] Setting pixel ratio:', pixelRatio);
    renderer.setPixelRatio(pixelRatio);

    // XR features are only available in WebGL renderer
    // WebGPU renderer has different XR API that doesn't support these methods
    if (renderer.xr && typeof renderer.xr.setFramebufferScaleFactor === 'function') {
      renderer.xr.enabled = true;
      renderer.xr.setFramebufferScaleFactor(2.0);
      renderer.xr.setFoveation(0);
    }

    // Create scene
    const scene = new THREE.Scene();

    // Setup lighting - WebGPU and WebGL use different light systems
    if (config("use_webgpu") === "true") {
      // WebGPU uses node-based lighting system
      // Import lighting nodes from three/webgpu
      // @ts-ignore
      const { DirectionalLight, AmbientLight } = await import("three/webgpu");

      const directionalLight = new DirectionalLight(0xffffff, 1.2);
      directionalLight.position.set(1.0, 1.0, 1.0).normalize();
      scene.add(directionalLight);

      const ambientLight = new AmbientLight(0xffffff, 2);
      scene.add(ambientLight);
    } else {
      // WebGL uses standard Three.js lights
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
      directionalLight.position.set(1.0, 1.0, 1.0).normalize();
      directionalLight.castShadow = false;
      scene.add(directionalLight);

      const ambientLight = new THREE.AmbientLight(0xffffff, 2);
      scene.add(ambientLight);
    }

    // Create camera
    const camera = new THREE.PerspectiveCamera(20.0, width / height, 0.1, 20.0);
    camera.position.set(0, -3, 3.5);

    const cameraControls = new OrbitControls(camera, renderer.domElement);
    cameraControls.screenSpacePanning = true;
    cameraControls.minDistance = 0.5;
    cameraControls.maxDistance = 8;
    cameraControls.update();

    // Create interactive group
    const igroup = new InteractiveGroup();
    igroup.position.set(-0.25, 1.3, -0.8);
    igroup.rotation.set(0, Math.PI / 8, 0);
    igroup.visible = false;
    scene.add(igroup);

    // InteractiveGroup only works with WebGLRenderer
    // TypeScript doesn't know renderer is WebGLRenderer at this point for WebGL mode
    if (renderer instanceof THREE.WebGLRenderer) {
      igroup.listenToPointerEvents(renderer, camera);
    }

    return new RenderSystem(renderer, scene, camera, cameraControls, igroup);
  }

  public setupResizeHandler() {
    window.addEventListener("resize", () => {
      this.resize();
    });
  }

  public resize() {
    const parentElement = this.renderer.domElement.parentElement;
    if (!parentElement) return;

    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(
      parentElement.clientWidth,
      parentElement.clientHeight,
    );

    this.camera.aspect =
      parentElement.clientWidth / parentElement.clientHeight;
    this.camera.updateProjectionMatrix();
  }

  public resizeChatMode(on: boolean) {
    const parentElement = this.renderer.domElement.parentElement;
    if (!parentElement) return;

    this.renderer.setPixelRatio(window.devicePixelRatio);

    let width = parentElement.clientWidth;
    let height = parentElement.clientHeight;
    if (on) {
      width = width / 2;
      height = height / 2;
    }

    this.renderer.setSize(width, height);

    this.camera.aspect =
      parentElement.clientWidth / parentElement.clientHeight;
    this.camera.updateProjectionMatrix();
  }

  public resetCamera(model?: Model) {
    const headNode = model?.vrm?.humanoid.getNormalizedBoneNode("head");

    if (headNode) {
      const headWPos = headNode.getWorldPosition(new THREE.Vector3());
      this.camera.position.set(
        this.camera.position.x,
        headWPos.y,
        this.camera.position.z,
      );
      this.cameraControls.target.set(headWPos.x, headWPos.y, headWPos.z);
      this.cameraControls.update();
    }
  }

  public resetCameraLerp() {
    // y = 1.3 is from initial setup position of camera
    const newPosition = new THREE.Vector3(
      this.camera.position.x,
      1.3,
      this.camera.position.z,
    );
    this.camera.position.lerpVectors(this.camera.position, newPosition, 0);
  }

  public render() {
    try {
      this.renderer.render(this.scene, this.camera);
    } catch (e) {
      console.error("render error", e);
    }
  }

  public getCanvas(): HTMLCanvasElement | undefined {
    return this.renderer.domElement.parentElement?.getElementsByTagName(
      "canvas",
    )[0];
  }

  public getScreenshotBlob = (callback: BlobCallback) => {
    this.screenshotCallback = callback;
    this.sendScreenshotToCallback = true;
  };

  public captureScreenshotIfRequested() {
    if (this.sendScreenshotToCallback && this.screenshotCallback) {
      this.renderer.domElement.toBlob(this.screenshotCallback, "image/jpeg");
      this.sendScreenshotToCallback = false;
    }
  }
}
