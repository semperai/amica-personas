import * as THREE from "three";
import { VRM } from "@pixiv/three-vrm";
import RAPIER from "@dimforge/rapier3d-compat";

export class PhysicsSystem {
  private RAPIER?: typeof RAPIER;
  private world?: RAPIER.World;
  private eventQueue?: RAPIER.EventQueue;
  private bodiesToRemove: RAPIER.RigidBody[] = [];

  public isInitialized = false;

  public async initialize() {
    // Prevent double initialization
    if (this.isInitialized) {
      console.warn("PhysicsSystem already initialized, skipping");
      return true;
    }

    try {
      // Initialize Rapier
      const rapierModule = await import("@dimforge/rapier3d-compat");
      this.RAPIER = rapierModule.default;

      // Initialize WASM module (only call init() once globally)
      if (typeof this.RAPIER.init === 'function') {
        await this.RAPIER.init({});
      } else {
        console.warn("Rapier already initialized globally");
      }

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
      // Remove any bodies that were queued for deletion BEFORE stepping
      this.processDeferredRemovals();

      this.world.step();
    } catch (e) {
      // Rapier errors often indicate memory corruption from improper body management
      // Common causes: removing bodies during physics step, using freed bodies
      if (e instanceof Error) {
        if (e.message?.includes('recursive use')) {
          console.error("physics update error: Detected recursive use of Rapier object. This usually means a rigid body was removed during the physics step. Bodies should only be removed between steps.", e);
        } else if (e.message?.includes('memory access out of bounds')) {
          console.error("physics update error: Memory access error in Rapier. A body or collider may have been used after being freed.", e);
        } else {
          console.error("physics update error", e);
        }
      } else {
        console.error("physics update error", e);
      }
    }
  }

  private processDeferredRemovals() {
    if (!this.world || this.bodiesToRemove.length === 0) return;

    for (const body of this.bodiesToRemove) {
      try {
        this.world.removeRigidBody(body);
      } catch (e) {
        console.warn("Failed to remove rigid body:", e);
      }
    }
    this.bodiesToRemove = [];
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

  // Helper to remove a rigid body (deferred until after physics step)
  public removeRigidBody(rigidBody: RAPIER.RigidBody) {
    if (!this.isInitialized || !this.world) return;

    // Queue for removal after the current physics step completes
    // This prevents "recursive use" errors
    this.bodiesToRemove.push(rigidBody);
  }

  public setGravity(x: number, y: number, z: number) {
    if (!this.isInitialized || !this.world) return;
    this.world.gravity = { x, y, z };
  }

  // Cleanup method to properly dispose of physics resources
  public dispose() {
    if (!this.isInitialized) return;

    try {
      // Free the world and all its resources
      if (this.world) {
        this.world.free();
        this.world = undefined;
      }

      if (this.eventQueue) {
        this.eventQueue.free();
        this.eventQueue = undefined;
      }

      this.RAPIER = undefined;
      this.isInitialized = false;
      console.log("Physics system disposed");
    } catch (error) {
      console.error("Error disposing physics system:", error);
    }
  }
}
