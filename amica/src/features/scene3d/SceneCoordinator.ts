import * as THREE from "three";
import {
  computeBoundsTree,
  disposeBoundsTree,
  computeBatchedBoundsTree,
  disposeBatchedBoundsTree,
  acceleratedRaycast,
} from "three-mesh-bvh";

import { config } from "@/utils/config";
import { RenderSystem } from "./RenderSystem";
import { XRSystem } from "./XRSystem";
import { PhysicsSystem } from "./PhysicsSystem";
import { RaycastSystem } from "./RaycastSystem";
import { VRMManager } from "./VRMManager";
import { EnvironmentManager } from "./EnvironmentManager";
import { ParticleManager } from "./ParticleManager";
import { DebugSystem } from "./DebugSystem";
import { ScenarioLoader } from "./ScenarioLoader";

// Add the extension functions
THREE.Mesh.prototype.raycast = acceleratedRaycast;
THREE.BatchedMesh.prototype.raycast = acceleratedRaycast;

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;

THREE.BatchedMesh.prototype.computeBoundsTree = computeBatchedBoundsTree;
THREE.BatchedMesh.prototype.disposeBatchedBoundsTree = disposeBatchedBoundsTree;

/**
 * Coordinates all 3D scene systems
 * Provides a clean API for scene management
 *
 * Usage:
 *   coordinator.render.camera
 *   coordinator.vrm.getModel()
 *   coordinator.loadVrm(url, onProgress)
 */
export class SceneCoordinator {
  public isReady: boolean = false;
  public chat?: any;

  // Public systems - access directly for fine-grained control
  public render?: RenderSystem;
  public xr?: XRSystem;
  public physics: PhysicsSystem;
  public raycast?: RaycastSystem;
  public vrm?: VRMManager;
  public environment?: EnvironmentManager;
  public particles?: ParticleManager;
  public debug: DebugSystem;
  public scenario: ScenarioLoader;

  // Timing
  private clock: THREE.Clock;
  private elapsedMsMid: number = 0;
  private elapsedMsSlow: number = 0;

  constructor() {
    this.isReady = false;
    this.clock = new THREE.Clock();
    this.clock.start();

    this.physics = new PhysicsSystem();
    this.debug = new DebugSystem();
    this.scenario = new ScenarioLoader();
  }

  public async setup(canvas: HTMLCanvasElement) {
    console.log("setup canvas");

    // Initialize render system
    this.render = await RenderSystem.create(canvas);
    this.render.setupResizeHandler();

    // Initialize physics
    await this.physics.initialize();

    // Initialize systems that depend on render system
    this.raycast = new RaycastSystem(this.render.scene);
    this.raycast.setupMouseTracking(canvas);

    this.vrm = new VRMManager(this.render.scene, this.render.camera);
    this.environment = new EnvironmentManager(this.render.scene);
    this.particles = new ParticleManager(this.render.scene);

    // Initialize XR system
    this.xr = new XRSystem(
      this.render.renderer,
      this.render.scene,
      this.render.camera,
      this.render.igroup,
    );

    // Setup debug system
    this.debug.addToScene(this.render.scene);
    this.debug.addToInteractiveGroup(this.render.igroup);
    this.debug.setupGUIControls(
      (value: number) => this.environment?.getRoom()?.room?.position.setX(value),
      (value: number) => this.environment?.getRoom()?.room?.position.setY(value),
      (value: number) => this.environment?.getRoom()?.room?.position.setZ(value),
      (value: number) => this.environment?.getRoom()?.room?.scale.set(value, value, value),
      (value: number) => this.xr?.teleport(0, value, 0),
    );

    this.isReady = true;
    this.render.renderer.setAnimationLoop(() => {
      this.update();
    });
  }

  // High-level XR session management
  public async startXRSession(session: XRSession, immersiveType: XRSessionMode) {
    if (!this.render || !this.xr) return;
    await this.xr.onSessionStarted(session, immersiveType, () =>
      this.endXRSession(),
    );
  }

  public endXRSession() {
    this.xr?.onSessionEnded();
    this.render?.resetCamera(this.vrm?.getModel());

    const canvas = this.render?.getCanvas();
    if (canvas) {
      canvas.style.display = "inline";
    }
  }

  // High-level VRM operations
  public async loadVrm(url: string, onProgress: (progress: string) => void) {
    await this.vrm?.loadVrm(url, onProgress);

    const model = this.vrm?.getModel();
    if (model && this.raycast) {
      await this.raycast.setupModelBVH(model);
    }

    this.render?.resetCamera(model);
  }

  public unloadVRM(): void {
    this.vrm?.unloadVRM();
    this.raycast?.cleanupModelBVH();
  }

  // High-level environment operations
  public async loadRoom(
    url: string,
    pos: THREE.Vector3,
    rot: THREE.Euler,
    scale: THREE.Vector3,
    onProgress: (progress: string) => void,
  ) {
    await this.environment?.loadRoom(url, pos, rot, scale, onProgress);

    this.debug.params["room-x"] = pos.x;
    this.debug.params["room-y"] = pos.y;
    this.debug.params["room-z"] = pos.z;
    this.debug.params["room-scale"] = scale.x;
    this.debug.updateGUIDisplay();

    const room = this.environment?.getRoom();
    if (room?.room && this.raycast) {
      await this.raycast.setupRoomBVH(room.room);
    }
  }

  public unloadRoom(): void {
    this.environment?.unloadRoom();
    this.raycast?.cleanupRoomBVH();
  }

  // Screenshot
  public captureScreenshot(callback: BlobCallback) {
    this.render?.getScreenshotBlob(callback);
  }

  // Main update loop
  public update(time?: DOMHighResTimeStamp, frame?: XRFrame) {
    let utime = performance.now();

    // Quick exit until setup finishes
    if (!this.isReady) return;
    if (!this.scenario.isReady()) return;

    const delta = this.clock.getDelta();

    this.elapsedMsSlow += delta;
    this.elapsedMsMid += delta;

    // Update hands
    this.xr?.updateHands();

    // Update stats
    this.debug.updateStats();

    // Update scenario
    let ptime = performance.now();
    this.scenario.updateScenario(delta);
    this.debug.recordScenarioTime(performance.now() - ptime);

    // Update physics
    ptime = performance.now();
    this.physics.stepSimulation(delta);
    this.debug.recordPhysicsTime(performance.now() - ptime);

    // Update model
    ptime = performance.now();
    this.vrm?.updateModel(delta);
    this.debug.recordModelTime(performance.now() - ptime);

    // Render
    ptime = performance.now();
    this.render?.render();
    this.debug.recordRenderTime(performance.now() - ptime);

    // Update splat
    this.environment?.updateSplat(this.render?.renderer, this.render?.camera);

    // Handle double pinch
    if (this.xr?.isDoublePinching()) {
      this.xr.doublePinchHandler();
    }

    // Mid-frequency updates (30fps)
    if (this.elapsedMsMid > 1 / 30) {
      ptime = performance.now();
      this.raycast?.updateRaycasts(
        this.render!.camera,
        this.vrm?.getModel(),
        this.xr!.isUsingController1(),
        this.xr!.isUsingController2(),
        this.xr!.getController1(),
        this.xr!.getController2(),
        this.xr!.getHand1(),
        this.xr!.getHand2(),
        this.xr!.getJointMeshes1(),
        this.xr!.getJointMeshes2(),
        this.debug.getClosestPart1(),
        this.debug.getClosestPart2(),
        (point: THREE.Vector3, itype: number) =>
          this.debug.createBallAtPoint(
            this.render!.scene,
            point,
            this.render!.camera.position,
            itype,
          ),
      );
      this.debug.recordRaycastTime(performance.now() - ptime);

      this.elapsedMsMid = 0;
    }

    // Slow updates (1fps)
    if (this.elapsedMsSlow > 1) {
      ptime = performance.now();
      this.debug.updateStatsMeshTexture();
      this.debug.recordStatsTime(performance.now() - ptime);

      ptime = performance.now();
      // this.raycast?.regenerateBVHForModel(); // Disabled - too slow
      this.debug.recordBVHTime(performance.now() - ptime);

      this.elapsedMsSlow = 0;
    }

    // Screenshot capture
    this.render?.captureScreenshotIfRequested();

    this.debug.recordUpdateTime(performance.now() - utime);
  }
}
