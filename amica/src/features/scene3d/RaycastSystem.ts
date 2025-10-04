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

export class RaycastSystem {
  private bvhWorker: WorkerBase;
  private modelBVHGenerator: StaticGeometryGenerator | null = null;
  private modelMeshHelper: THREE.Mesh | null = null;
  private modelBVHHelper: MeshBVHHelper | null = null;
  private roomBVHHelperGroup = new THREE.Group();
  private modelTargets: THREE.Mesh[] = [];
  private roomTargets: THREE.Mesh[] = [];
  private raycaster = new THREE.Raycaster();
  private raycasterTempM = new THREE.Matrix4();
  private intersectsModel: THREE.Intersection[] = [];
  private intersectsRoom: THREE.Intersection[] = [];
  private mouse = new THREE.Vector2();

  constructor(private scene: THREE.Scene) {
    this.bvhWorker = new GenerateMeshBVHWorker();
    this.raycaster.firstHitOnly = true;
    this.scene.add(this.roomBVHHelperGroup);
  }

  public setupMouseTracking(canvas: HTMLCanvasElement) {
    canvas.addEventListener("mousemove", (event) => {
      this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    });
  }

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

  public cleanupModelBVH() {
    if (this.modelMeshHelper) {
      const geometry = this.modelMeshHelper.geometry;
      geometry?.dispose();
      for (const key in geometry?.attributes) {
        geometry?.deleteAttribute(key);
      }
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

  public cleanupRoomBVH() {
    for (const item of this.roomBVHHelperGroup.children) {
      if (item instanceof MeshBVHHelper) {
        try {
          // @ts-ignore
          const geometry = item.geometry;
          geometry?.dispose();
          for (const key in geometry?.attributes) {
            geometry?.deleteAttribute(key);
          }
        } catch (e) {
          console.error("error disposing room geometry", e);
        }
      }
    }
    this.roomBVHHelperGroup.clear();
    this.roomTargets = [];
  }

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
    const checkIntersection = (closestPart: THREE.Object3D) => {
      try {
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
      } catch (e) {
        console.error("intersectObjects error", e);
        return;
      }

      const highlightClosestBone = (point: THREE.Vector3) => {
        if (!model?.vrm) return;

        let vec3 = new THREE.Vector3();
        let closestBone = null;
        let mindist = Number.MAX_VALUE;

        for (const bone of amicaBones) {
          const node = model.vrm.humanoid.getNormalizedBoneNode(bone);
          if (!node) continue;

          const dist = point.distanceTo(node.getWorldPosition(vec3));
          if (dist < mindist) {
            mindist = dist;
            closestBone = node;
          }
        }

        if (closestBone) {
          closestPart.position.copy(closestBone.getWorldPosition(vec3));
          closestPart.scale.setScalar(0.1);
        }
      };

      const handleAmicaIntersection = (point: THREE.Vector3) => {
        highlightClosestBone(point);
      };

      // check which object is closer
      if (this.intersectsModel.length > 0 && this.intersectsRoom.length > 0) {
        if (
          this.intersectsModel[0].distance < this.intersectsRoom[0].distance
        ) {
          handleAmicaIntersection(this.intersectsModel[0].point);
        } else {
          onBallCreate?.(this.intersectsRoom[0].point, 1);
        }
      } else if (this.intersectsModel.length > 0) {
        handleAmicaIntersection(this.intersectsModel[0].point);
      } else if (this.intersectsRoom.length > 0) {
        onBallCreate?.(this.intersectsRoom[0].point, 1);
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

  public getRoomBVHHelperGroup(): THREE.Group {
    return this.roomBVHHelperGroup;
  }
}
