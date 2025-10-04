import * as THREE from "three";
import { VRM } from "@pixiv/three-vrm";

export class PhysicsSystem {
  private ammo: any;
  private collisionConfiguration: any;
  private dispatcher: any;
  private broadphase: any;
  private solver: any;
  private physicsWorld: any;
  private transformAux1: any;
  private tempBtVec3_1: any;

  public isInitialized = false;

  public async initialize() {
    // we have this weird construct because ammo is loaded globally
    // and things get funny with hot reloading
    if (typeof window.Ammo === "undefined") {
      console.error("Ammo not found");
      return false;
    } else if (typeof window.Ammo === "function") {
      this.ammo = await window.Ammo();
    } else {
      this.ammo = window.Ammo;
    }

    if (this.ammo) {
      this.collisionConfiguration =
        new this.ammo.btDefaultCollisionConfiguration();
      this.dispatcher = new this.ammo.btCollisionDispatcher(
        this.collisionConfiguration,
      );
      this.broadphase = new this.ammo.btDbvtBroadphase();
      this.solver = new this.ammo.btSequentialImpulseConstraintSolver();
      this.physicsWorld = new this.ammo.btDiscreteDynamicsWorld(
        this.dispatcher,
        this.broadphase,
        this.solver,
        this.collisionConfiguration,
      );
      this.physicsWorld.setGravity(new this.ammo.btVector3(0, -7.8, 0));
      this.transformAux1 = new this.ammo.btTransform();
      this.tempBtVec3_1 = new this.ammo.btVector3(0, 0, 0);

      this.isInitialized = true;
      return true;
    }

    return false;
  }

  public stepSimulation(delta: number) {
    if (!this.isInitialized) return;

    try {
      this.physicsWorld.stepSimulation(delta, 10);
    } catch (e) {
      console.error("physics update error", e);
    }
  }

  public applyWind(vrm: VRM | undefined, dir: THREE.Vector3, strength: number) {
    vrm?.springBoneManager?.joints.forEach((e) => {
      e.settings.gravityDir = dir;
      e.settings.gravityPower = strength;
    });
  }

  public getPhysicsWorld() {
    return this.physicsWorld;
  }
}
