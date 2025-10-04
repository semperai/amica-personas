import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls";
import { InteractiveGroup } from "three/addons/interactive/InteractiveGroup.js";
import { config } from "@/utils/config";
import { Model } from "./model";

export class RenderSystem {
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public cameraControls: OrbitControls;
  public igroup: InteractiveGroup;

  private sendScreenshotToCallback: boolean = false;
  private screenshotCallback: BlobCallback | undefined;

  private constructor(
    renderer: THREE.WebGLRenderer,
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

    let WebRendererType = THREE.WebGLRenderer;
    if (config("use_webgpu") === "true") {
      // @ts-ignore
      WebRendererType = (
        await import("three/src/renderers/webgpu/WebGPURenderer.js")
      ).default;
    }

    const renderer = new WebRendererType({
      canvas: canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    }) as THREE.WebGLRenderer;

    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = false;
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.xr.enabled = true;
    renderer.xr.setFramebufferScaleFactor(2.0);

    // webgpu does not support foveation yet
    if (config("use_webgpu") !== "true") {
      renderer.xr.setFoveation(0);
    }

    // Create scene
    const scene = new THREE.Scene();

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(1.0, 1.0, 1.0).normalize();
    directionalLight.castShadow = false;
    scene.add(directionalLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 2);
    scene.add(ambientLight);

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

    igroup.listenToPointerEvents(renderer, camera);

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
