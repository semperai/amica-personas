import * as THREE from "three";
import { InteractiveGroup } from "three/addons/interactive/InteractiveGroup.js";
import { XRControllerModelFactory } from "./XRControllerModelFactory";
import { config } from "@/utils/config";

const joints: string[] = [
  "wrist",
  "thumb-metacarpal",
  "thumb-phalanx-proximal",
  "thumb-phalanx-distal",
  "thumb-tip",
  "index-finger-metacarpal",
  "index-finger-phalanx-proximal",
  "index-finger-phalanx-intermediate",
  "index-finger-phalanx-distal",
  "index-finger-tip",
  "middle-finger-metacarpal",
  "middle-finger-phalanx-proximal",
  "middle-finger-phalanx-intermediate",
  "middle-finger-phalanx-distal",
  "middle-finger-tip",
  "ring-finger-metacarpal",
  "ring-finger-phalanx-proximal",
  "ring-finger-phalanx-intermediate",
  "ring-finger-phalanx-distal",
  "ring-finger-tip",
  "pinky-finger-metacarpal",
  "pinky-finger-phalanx-proximal",
  "pinky-finger-phalanx-intermediate",
  "pinky-finger-phalanx-distal",
  "pinky-finger-tip",
];

export class XRSystem {
  public currentSession: XRSession | null = null;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private igroup: InteractiveGroup;

  // Controllers
  private controller1: THREE.Group | null = null;
  private controller2: THREE.Group | null = null;
  private controllerGrip1: THREE.Group | null = null;
  private controllerGrip2: THREE.Group | null = null;
  private usingController1 = false;
  private usingController2 = false;

  // Hands
  private hand1: THREE.Group | null = null;
  private hand2: THREE.Group | null = null;
  private isPinching1 = false;
  private isPinching2 = false;
  private jointMeshes1: THREE.Mesh[] = [];
  private jointMeshes2: THREE.Mesh[] = [];
  private handGroup = new THREE.Group();

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    igroup: InteractiveGroup,
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.igroup = igroup;

    this.setupControllers();
    this.setupHands();
  }

  private setupControllers() {
    try {
      // Setup controllers
      this.controller1 = this.renderer.xr.getController(0);
      this.controller2 = this.renderer.xr.getController(1);

      this.scene.add(this.controller1);
      this.scene.add(this.controller2);

      // @ts-ignore
      this.controller1.addEventListener("connected", (event) => {
        this.usingController1 = true;
      });
      // @ts-ignore
      this.controller2.addEventListener("connected", (event) => {
        this.usingController2 = true;
      });

      const controllerModelFactory = new XRControllerModelFactory();

      this.controllerGrip1 = this.renderer.xr.getControllerGrip(0);
      this.controllerGrip1.add(
        controllerModelFactory.createControllerModel(this.controllerGrip1),
      );
      this.scene.add(this.controllerGrip1);

      this.controllerGrip2 = this.renderer.xr.getControllerGrip(1);
      this.controllerGrip2.add(
        controllerModelFactory.createControllerModel(this.controllerGrip2),
      );
      this.scene.add(this.controllerGrip2);

      // Add raycast lines
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -1),
      ]);

      const line = new THREE.Line(geometry);
      line.scale.z = 5;

      this.controller1.add(line.clone());
      this.controller2.add(line.clone());

      // webgpu does not support xr controller events yet
      if (config("use_webgpu") !== "true") {
        // @ts-ignore
        this.igroup.listenToXRControllerEvents(this.controller1);
        // @ts-ignore
        this.igroup.listenToXRControllerEvents(this.controller2);
      }
    } catch (e) {
      console.log("No controller available", e);
    }
  }

  private setupHands() {
    try {
      this.hand1 = this.renderer.xr.getHand(0);
      this.scene.add(this.hand1);

      this.hand2 = this.renderer.xr.getHand(1);
      this.scene.add(this.hand2);

      // @ts-ignore
      this.hand1.addEventListener("pinchstart", () => {
        this.isPinching1 = true;
      });
      // @ts-ignore
      this.hand2.addEventListener("pinchstart", () => {
        this.isPinching2 = true;
      });

      // @ts-ignore
      this.hand1.addEventListener("pinchend", () => {
        this.isPinching1 = false;
      });
      // @ts-ignore
      this.hand2.addEventListener("pinchend", () => {
        this.isPinching2 = false;
      });

      // Create hand joint meshes
      const geometry = new THREE.BoxGeometry(0.005, 0.005, 0.005);
      const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 1.0,
        metalness: 0.0,
      });
      const mesh = new THREE.Mesh(geometry, material);

      for (const _ of joints) {
        this.jointMeshes1.push(mesh.clone());
        this.jointMeshes2.push(mesh.clone());
        this.handGroup.add(this.jointMeshes1[this.jointMeshes1.length - 1]);
        this.handGroup.add(this.jointMeshes2[this.jointMeshes2.length - 1]);
      }

      this.handGroup.visible = false;
      this.scene.add(this.handGroup);
    } catch (e) {
      console.log("No hands available", e);
    }
  }

  public async onSessionStarted(
    session: XRSession,
    immersiveType: XRSessionMode,
    onSessionEnd: () => void,
  ) {
    console.log("session", session);

    this.renderer.xr.setReferenceSpaceType("local");
    await this.renderer.xr.setSession(session);

    this.teleport(0, -1.2, -1);

    // TODO igroup should only be visible if xr doesnt support dom-overlay
    this.igroup.visible = true;
    if (immersiveType === "immersive-vr") {
      this.handGroup.visible = true;
    }

    this.currentSession = session;
    this.currentSession.addEventListener("end", onSessionEnd);
  }

  public onSessionEnded() {
    if (!this.currentSession) return;

    // reset camera
    this.camera.position.set(0, -3, 3.5);

    this.currentSession = null;

    this.igroup.visible = false;
    this.handGroup.visible = false;
  }

  public teleport(x: number, y: number, z: number) {
    if (!this.renderer.xr.isPresenting) return;

    const baseReferenceSpace = this.renderer.xr.getReferenceSpace();
    if (!baseReferenceSpace) {
      console.warn("baseReferenceSpace not found");
      return;
    }

    const offsetPosition = { x, y, z, w: 1 };
    const offsetRotation = new THREE.Quaternion();
    const transform = new XRRigidTransform(offsetPosition, offsetRotation);
    const teleportSpaceOffset =
      baseReferenceSpace.getOffsetReferenceSpace(transform);

    this.renderer.xr.setReferenceSpace(teleportSpaceOffset);
  }

  public updateHands() {
    const handle = (hand: THREE.Group, jointMeshes: THREE.Mesh[]) => {
      // @ts-ignore
      if (hand.joints) {
        let i = 0;
        for (const name of joints) {
          // @ts-ignore
          const joint = hand?.joints[name];
          if (!joint) {
            break; // if one isnt found then they all wont be found
          }
          const mesh = jointMeshes[i];
          mesh.position.setFromMatrixPosition(joint.matrix);
          mesh.quaternion.setFromRotationMatrix(joint.matrix);
          ++i;
        }
      }
    };

    if (this.hand1) handle(this.hand1, this.jointMeshes1);
    if (this.hand2) handle(this.hand2, this.jointMeshes2);
  }

  public doublePinchHandler() {
    if (!this.controller1 || !this.controller2) return;

    const cam = this.renderer.xr.getCamera();

    const avgControllerPos = new THREE.Vector3()
      .addVectors(this.controller1.position, this.controller2.position)
      .multiplyScalar(0.5);

    const directionToControllers = new THREE.Vector3()
      .subVectors(avgControllerPos, cam.position)
      .normalize();

    const controller1Distance = cam.position.distanceTo(
      this.controller1.position,
    );
    const controller2Distance = cam.position.distanceTo(
      this.controller2.position,
    );
    const avgControllerDistance =
      (controller1Distance + controller2Distance) / 2;

    const distanceScale = 1;
    const d = 0.7 + avgControllerDistance * distanceScale;

    const pos = new THREE.Vector3().addVectors(
      cam.position,
      directionToControllers.multiplyScalar(d),
    );

    this.igroup.position.copy(pos);
    this.igroup.lookAt(cam.position);
  }

  // Getters
  public isDoublePinching(): boolean {
    return this.isPinching1 && this.isPinching2;
  }

  public isUsingController1(): boolean {
    return this.usingController1;
  }

  public isUsingController2(): boolean {
    return this.usingController2;
  }

  public getController1(): THREE.Group | null {
    return this.controller1;
  }

  public getController2(): THREE.Group | null {
    return this.controller2;
  }

  public getHand1(): THREE.Group | null {
    return this.hand1;
  }

  public getHand2(): THREE.Group | null {
    return this.hand2;
  }

  public getJointMeshes1(): THREE.Mesh[] {
    return this.jointMeshes1;
  }

  public getJointMeshes2(): THREE.Mesh[] {
    return this.jointMeshes2;
  }
}
