import * as THREE from "three";
import { MeshBVHHelper, StaticGeometryGenerator } from "three-mesh-bvh";
import { GenerateMeshBVHWorker } from "@/workers/bvh/GenerateMeshBVHWorker";
import { WorkerBase } from "@/workers/bvh/utils/WorkerBase";
import { VRMHumanBoneName } from "@pixiv/three-vrm";
import { Model } from "./VrmCharacterModel";
import { config } from "@/utils/config";

const amicaBones: VRMHumanBoneName[] = [
  "hips",
  "spine",
  "chest",
  "upperChest",
  "neck",
  "head",
  "leftEye",
  "rightEye",
  "jaw",
  "leftUpperLeg",
  "leftLowerLeg",
  "leftFoot",
  "leftToes",
  "rightUpperLeg",
  "rightLowerLeg",
  "rightFoot",
  "rightToes",
  "leftShoulder",
  "leftUpperArm",
  "leftLowerArm",
  "leftHand",
  "rightShoulder",
  "rightUpperArm",
  "rightLowerArm",
  "rightHand",
];

export interface RaycastHit {
  point: THREE.Vector3;
  distance: number;
  object: THREE.Object3D;
  face?: THREE.Face;
  faceIndex?: number;
  uv?: THREE.Vector2;
  normal?: THREE.Vector3;
  type: 'model' | 'room' | 'object';
}

export interface RaycastOptions {
  maxDistance?: number;
  layers?: THREE.Layers;
  firstHitOnly?: boolean;
}

export interface RaySource {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
}

export class RaycastSystem {
  private bvhWorker: WorkerBase;
  private modelBVHGenerator: StaticGeometryGenerator | null = null;
  private modelMeshHelper: THREE.Mesh | null = null;
  private modelBVHHelper: MeshBVHHelper | null = null;
  private roomBVHHelperGroup = new THREE.Group();
  private modelTargets: THREE.Mesh[] = [];
  private roomTargets: THREE.Mesh[] = [];
  private customTargets: THREE.Object3D[] = [];
  private raycaster = new THREE.Raycaster();
  private raycasterTempM = new THREE.Matrix4();
  private intersectsModel: THREE.Intersection[] = [];
  private intersectsRoom: THREE.Intersection[] = [];
  private intersectsCustom: THREE.Intersection[] = [];
  private mouse = new THREE.Vector2();
  private enabled = true;

  constructor(private scene: THREE.Scene) {
    this.bvhWorker = new GenerateMeshBVHWorker();
    this.raycaster.firstHitOnly = true;
    this.scene.add(this.roomBVHHelperGroup);
  }

  /**
   * Enable or disable the raycast system
   */
  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Setup mouse tracking for raycasting
   */
  public setupMouseTracking(canvas: HTMLCanvasElement) {
    const handler = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      // Skip calculation if canvas has zero size to avoid division by zero
      if (rect.width === 0 || rect.height === 0) return;

      // Calculate mouse position relative to canvas, then convert to NDC (-1 to 1)
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };
    canvas.addEventListener("mousemove", handler);
  }

  /**
   * Get the current mouse position in normalized device coordinates
   */
  public getMousePosition(): THREE.Vector2 {
    return this.mouse.clone();
  }

  /**
   * Set mouse position manually (useful for testing)
   */
  public setMousePosition(x: number, y: number) {
    this.mouse.set(x, y);
  }

  /**
   * Setup BVH for model raycasting
   */
  public async setupModelBVH(model: Model) {
    if (!model.vrm) return;

    this.modelBVHGenerator = new StaticGeometryGenerator(model.vrm.scene);

    const wireframeMaterial = new THREE.MeshBasicMaterial({
      wireframe: true,
      transparent: true,
      opacity: 0.05,
      depthWrite: false,
    });

    this.modelMeshHelper = new THREE.Mesh(
      new THREE.BufferGeometry(),
      wireframeMaterial,
    );
    this.modelTargets = [this.modelMeshHelper];

    if (config("debug_gfx") === "true") {
      this.scene.add(this.modelMeshHelper);
    }

    this.modelBVHHelper = new MeshBVHHelper(this.modelMeshHelper);
    if (config("debug_gfx") === "true") {
      this.scene.add(this.modelBVHHelper);
    }

    await this.regenerateBVHForModel();
  }

  /**
   * Regenerate BVH for model (call when model pose changes significantly)
   */
  public async regenerateBVHForModel() {
    if (!this.modelMeshHelper || !this.modelBVHGenerator) return;

    this.modelBVHGenerator.generate(this.modelMeshHelper.geometry);

    if (!this.modelMeshHelper.geometry.boundsTree) {
      this.modelMeshHelper.geometry.computeBoundsTree();
    } else {
      this.modelMeshHelper.geometry.boundsTree.refit();
    }

    this.modelBVHHelper!.update();
  }

  /**
   * Setup BVH for room/environment raycasting
   */
  public async setupRoomBVH(room: THREE.Group) {
    this.roomTargets = [];

    for (let child of room.children) {
      if (child instanceof THREE.Mesh) {
        this.roomTargets.push(child);
        const geometry = child.geometry.clone() as THREE.BufferGeometry;
        const bvh = await this.bvhWorker.generate(geometry, {
          maxLeafTris: 1,
        })!;
        child.geometry.boundsTree = bvh;

        if (config("debug_gfx") === "true") {
          const helper = new MeshBVHHelper(child, bvh);
          helper.color.set(0xe91e63);
          this.roomBVHHelperGroup.add(helper);
        }
      }
    }
  }

  /**
   * Add custom objects for raycasting
   */
  public addCustomTarget(object: THREE.Object3D) {
    if (!this.customTargets.includes(object)) {
      this.customTargets.push(object);
    }
  }

  /**
   * Remove custom object from raycasting
   */
  public removeCustomTarget(object: THREE.Object3D) {
    const index = this.customTargets.indexOf(object);
    if (index > -1) {
      this.customTargets.splice(index, 1);
    }
  }

  /**
   * Clear all custom targets
   */
  public clearCustomTargets() {
    this.customTargets = [];
  }

  /**
   * Perform a raycast from camera through screen coordinates
   */
  public raycastFromCamera(
    camera: THREE.Camera,
    screenX: number = this.mouse.x,
    screenY: number = this.mouse.y,
    options: RaycastOptions = {}
  ): RaycastHit | null {
    if (!this.enabled) return null;

    this.applyRaycastOptions(options);
    this.raycaster.setFromCamera(new THREE.Vector2(screenX, screenY), camera);
    return this.performRaycast();
  }

  /**
   * Perform a raycast from a specific point in a direction
   */
  public raycastFromPoint(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    options: RaycastOptions = {}
  ): RaycastHit | null {
    if (!this.enabled) return null;

    this.applyRaycastOptions(options);
    this.raycaster.set(origin, direction.clone().normalize());
    return this.performRaycast();
  }

  /**
   * Perform a raycast from an object (using its world position and forward direction)
   */
  public raycastFromObject(
    object: THREE.Object3D,
    options: RaycastOptions = {}
  ): RaycastHit | null {
    if (!this.enabled) return null;

    const origin = new THREE.Vector3();
    const direction = new THREE.Vector3();

    origin.setFromMatrixPosition(object.matrixWorld);
    this.raycasterTempM.identity().extractRotation(object.matrixWorld);
    direction.set(0, 0, -1).applyMatrix4(this.raycasterTempM);

    return this.raycastFromPoint(origin, direction, options);
  }

  /**
   * Get all intersections (not just the first one)
   */
  public raycastAll(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    options: RaycastOptions = {}
  ): RaycastHit[] {
    if (!this.enabled) return [];

    const previousFirstHitOnly = this.raycaster.firstHitOnly;
    this.raycaster.firstHitOnly = false;

    this.applyRaycastOptions(options);
    this.raycaster.set(origin, direction.clone().normalize());

    // Collect intersections by type
    this.intersectsModel = [];
    this.intersectsRoom = [];
    this.intersectsCustom = [];

    if (this.modelTargets.length > 0) {
      this.intersectsModel = this.raycaster.intersectObjects(this.modelTargets, true);
    }
    if (this.roomTargets.length > 0) {
      this.intersectsRoom = this.raycaster.intersectObjects(this.roomTargets, true);
    }
    if (this.customTargets.length > 0) {
      this.intersectsCustom = this.raycaster.intersectObjects(this.customTargets, true);
    }

    const hits: RaycastHit[] = [];

    for (const intersection of this.intersectsModel) {
      hits.push(this.convertIntersectionToHit(intersection, 'model'));
    }
    for (const intersection of this.intersectsRoom) {
      hits.push(this.convertIntersectionToHit(intersection, 'room'));
    }
    for (const intersection of this.intersectsCustom) {
      hits.push(this.convertIntersectionToHit(intersection, 'object'));
    }

    this.raycaster.firstHitOnly = previousFirstHitOnly;
    return hits.sort((a, b) => a.distance - b.distance);
  }

  /**
   * Find the closest bone to a point (for VRM models)
   */
  public findClosestBone(
    point: THREE.Vector3,
    model: Model
  ): { bone: THREE.Object3D; distance: number } | null {
    if (!model?.vrm) return null;

    let vec3 = new THREE.Vector3();
    let closestBone = null;
    let minDist = Number.MAX_VALUE;

    for (const boneName of amicaBones) {
      const node = model.vrm.humanoid.getNormalizedBoneNode(boneName);
      if (!node) continue;

      const dist = point.distanceTo(node.getWorldPosition(vec3));
      if (dist < minDist) {
        minDist = dist;
        closestBone = node;
      }
    }

    return closestBone ? { bone: closestBone, distance: minDist } : null;
  }

  private applyRaycastOptions(options: RaycastOptions) {
    if (options.maxDistance !== undefined) {
      this.raycaster.far = options.maxDistance;
    }
    if (options.layers !== undefined) {
      this.raycaster.layers = options.layers;
    }
    if (options.firstHitOnly !== undefined) {
      this.raycaster.firstHitOnly = options.firstHitOnly;
    }
  }

  private performRaycast(): RaycastHit | null {
    try {
      this.intersectsModel = [];
      this.intersectsRoom = [];
      this.intersectsCustom = [];

      if (this.modelTargets.length > 0) {
        this.intersectsModel = this.raycaster.intersectObjects(
          this.modelTargets,
          true,
        );
      }
      if (this.roomTargets.length > 0) {
        this.intersectsRoom = this.raycaster.intersectObjects(
          this.roomTargets,
          true,
        );
      }
      if (this.customTargets.length > 0) {
        this.intersectsCustom = this.raycaster.intersectObjects(
          this.customTargets,
          true,
        );
      }

      // Find the closest intersection
      let closest: THREE.Intersection | null = null;
      let closestType: 'model' | 'room' | 'object' = 'object';

      if (this.intersectsModel.length > 0) {
        closest = this.intersectsModel[0];
        closestType = 'model';
      }

      if (this.intersectsRoom.length > 0 &&
          (!closest || this.intersectsRoom[0].distance < closest.distance)) {
        closest = this.intersectsRoom[0];
        closestType = 'room';
      }

      if (this.intersectsCustom.length > 0 &&
          (!closest || this.intersectsCustom[0].distance < closest.distance)) {
        closest = this.intersectsCustom[0];
        closestType = 'object';
      }

      return closest ? this.convertIntersectionToHit(closest, closestType) : null;
    } catch (e) {
      console.error("Raycast error:", e);
      return null;
    }
  }

  private getAllIntersections(): THREE.Intersection[] {
    const all: THREE.Intersection[] = [];

    if (this.modelTargets.length > 0) {
      all.push(...this.raycaster.intersectObjects(this.modelTargets, true));
    }
    if (this.roomTargets.length > 0) {
      all.push(...this.raycaster.intersectObjects(this.roomTargets, true));
    }
    if (this.customTargets.length > 0) {
      all.push(...this.raycaster.intersectObjects(this.customTargets, true));
    }

    return all;
  }

  private convertIntersectionToHit(
    intersection: THREE.Intersection,
    type: 'model' | 'room' | 'object'
  ): RaycastHit {
    return {
      point: intersection.point.clone(),
      distance: intersection.distance,
      object: intersection.object,
      face: intersection.face,
      faceIndex: intersection.faceIndex,
      uv: intersection.uv?.clone(),
      normal: intersection.normal?.clone(),
      type,
    };
  }

  /**
   * Legacy method for XR system compatibility
   */
  public updateRaycasts(
    camera: THREE.PerspectiveCamera,
    model: Model | undefined,
    usingController1: boolean,
    usingController2: boolean,
    controller1: THREE.Group | null,
    controller2: THREE.Group | null,
    hand1: THREE.Group | null,
    hand2: THREE.Group | null,
    jointMeshes1: THREE.Mesh[],
    jointMeshes2: THREE.Mesh[],
    closestPart1: THREE.Object3D,
    closestPart2: THREE.Object3D,
    onBallCreate?: (point: THREE.Vector3, itype: number) => void,
  ) {
    if (!this.enabled) return;

    const checkIntersection = (closestPart: THREE.Object3D) => {
      const hit = this.performRaycast();

      if (hit) {
        if (hit.type === 'model' && model) {
          const closestBone = this.findClosestBone(hit.point, model);
          if (closestBone) {
            closestPart.position.copy(closestBone.bone.getWorldPosition(new THREE.Vector3()));
            closestPart.scale.setScalar(0.1);
          }
        } else if (hit.type === 'room') {
          onBallCreate?.(hit.point, 1);
        }
      }
    };

    if (!usingController1 && !usingController2) {
      this.raycaster.setFromCamera(this.mouse, camera);
      checkIntersection(closestPart1);
    }

    const handleController = (
      controller: THREE.Group,
      closestPart: THREE.Object3D,
    ) => {
      this.raycasterTempM.identity().extractRotation(controller.matrixWorld);
      this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
      this.raycaster.ray.direction
        .set(0, 0, -1)
        .applyMatrix4(this.raycasterTempM);
      checkIntersection(closestPart);
    };

    const handleHand = (joints: THREE.Mesh[], closestPart: THREE.Object3D) => {
      for (const joint of joints) {
        const m = joint.matrixWorld;
        this.raycasterTempM.identity().extractRotation(m);
        this.raycaster.ray.origin.setFromMatrixPosition(m);
        this.raycaster.ray.direction.set(0, -1, 0).applyMatrix4(this.raycasterTempM);
        checkIntersection(closestPart);
      }
    };

    if (hand1) {
      handleHand(jointMeshes1, closestPart1);
    } else if (controller1) {
      handleController(controller1, closestPart1);
    }

    if (hand2) {
      handleHand(jointMeshes2, closestPart2);
    } else if (controller2) {
      handleController(controller2, closestPart2);
    }
  }

  /**
   * Cleanup model BVH
   */
  public cleanupModelBVH() {
    if (this.modelMeshHelper) {
      const geometry = this.modelMeshHelper.geometry;
      (geometry as any)?.disposeBoundsTree?.();
      geometry?.dispose();
      this.scene.remove(this.modelMeshHelper);
      if (this.modelBVHHelper) {
        this.scene.remove(this.modelBVHHelper);
      }
    }
    this.modelBVHGenerator = null;
    this.modelMeshHelper = null;
    this.modelBVHHelper = null;
    this.modelTargets = [];
  }

  /**
   * Cleanup room BVH
   */
  public cleanupRoomBVH() {
    for (const item of this.roomBVHHelperGroup.children) {
      if (item instanceof MeshBVHHelper) {
        try {
          const geometry = (item as any).geometry as THREE.BufferGeometry | undefined;
          (geometry as any)?.disposeBoundsTree?.();
          geometry?.dispose();
        } catch (e) {
          console.error("error disposing room geometry", e);
        }
      }
    }
    this.roomBVHHelperGroup.clear();
    this.roomTargets = [];
  }

  /**
   * Cleanup all resources
   */
  public dispose() {
    this.cleanupModelBVH();
    this.cleanupRoomBVH();
    this.clearCustomTargets();
  }

  /**
   * Get room BVH helper group (for debugging)
   */
  public getRoomBVHHelperGroup(): THREE.Group {
    return this.roomBVHHelperGroup;
  }

  /**
   * Get current model targets
   */
  public getModelTargets(): THREE.Mesh[] {
    return [...this.modelTargets];
  }

  /**
   * Get current room targets
   */
  public getRoomTargets(): THREE.Mesh[] {
    return [...this.roomTargets];
  }

  /**
   * Get current custom targets
   */
  public getCustomTargets(): THREE.Object3D[] {
    return [...this.customTargets];
  }
}
