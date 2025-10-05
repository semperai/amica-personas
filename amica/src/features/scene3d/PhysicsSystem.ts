import * as THREE from "three";
import { VRM } from "@pixiv/three-vrm";
import RAPIER from "@dimforge/rapier3d-compat";

export class PhysicsSystem {
  private RAPIER?: typeof RAPIER;
  private world?: RAPIER.World;
  private eventQueue?: RAPIER.EventQueue;

  public isInitialized = false;

  public async initialize() {
    try {
      // Initialize Rapier
      this.RAPIER = await import("@dimforge/rapier3d-compat");

      // Create the physics world
      const gravity = { x: 0.0, y: -7.8, z: 0.0 };
      this.world = new this.RAPIER.World(gravity);

      // Create event queue for collision detection
      this.eventQueue = new this.RAPIER.EventQueue(true);

      this.isInitialized = true;
      console.log("Rapier physics initialized successfully");
      return true;
    } catch (error) {
      console.error("Failed to initialize Rapier physics:", error);
      return false;
    }
  }

  public stepSimulation(delta: number) {
    if (!this.isInitialized || !this.world) return;

    try {
      this.world.step(this.eventQueue);
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

  public getWorld() {
    return this.world;
  }

  public getRAPIER() {
    return this.RAPIER;
  }

  public getEventQueue() {
    return this.eventQueue;
  }

  // Helper method to create a rigid body
  public createRigidBody(
    type: "dynamic" | "static" | "kinematic",
    position: { x: number; y: number; z: number },
    rotation?: { x: number; y: number; z: number; w: number }
  ) {
    if (!this.isInitialized || !this.world || !this.RAPIER) return null;

    const rigidBodyDesc =
      type === "dynamic"
        ? this.RAPIER.RigidBodyDesc.dynamic()
        : type === "kinematic"
        ? this.RAPIER.RigidBodyDesc.kinematicPositionBased()
        : this.RAPIER.RigidBodyDesc.fixed();

    rigidBodyDesc.setTranslation(position.x, position.y, position.z);
    if (rotation) {
      rigidBodyDesc.setRotation(rotation);
    }

    return this.world.createRigidBody(rigidBodyDesc);
  }

  // Helper method to create a collider
  public createCollider(
    shape: RAPIER.ColliderDesc,
    rigidBody: RAPIER.RigidBody
  ) {
    if (!this.isInitialized || !this.world) return null;

    return this.world.createCollider(shape, rigidBody);
  }

  // Helper methods for common shapes
  public createBox(
    halfExtents: { x: number; y: number; z: number },
    rigidBody: RAPIER.RigidBody
  ) {
    if (!this.RAPIER) return null;
    const shape = this.RAPIER.ColliderDesc.cuboid(
      halfExtents.x,
      halfExtents.y,
      halfExtents.z
    );
    return this.createCollider(shape, rigidBody);
  }

  public createSphere(radius: number, rigidBody: RAPIER.RigidBody) {
    if (!this.RAPIER) return null;
    const shape = this.RAPIER.ColliderDesc.ball(radius);
    return this.createCollider(shape, rigidBody);
  }

  public createCylinder(
    halfHeight: number,
    radius: number,
    rigidBody: RAPIER.RigidBody
  ) {
    if (!this.RAPIER) return null;
    const shape = this.RAPIER.ColliderDesc.cylinder(halfHeight, radius);
    return this.createCollider(shape, rigidBody);
  }

  // Helper to remove a rigid body
  public removeRigidBody(rigidBody: RAPIER.RigidBody) {
    if (!this.isInitialized || !this.world) return;
    this.world.removeRigidBody(rigidBody);
  }

  public setGravity(x: number, y: number, z: number) {
    if (!this.isInitialized || !this.world) return;
    this.world.gravity = { x, y, z };
  }
}
