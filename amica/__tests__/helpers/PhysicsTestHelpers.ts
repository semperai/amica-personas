/**
 * Test helpers for physics-based scenarios
 * Provides utilities for testing Rapier.js physics in scenarios
 */

import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export interface PhysicsTestContext {
  rapier: typeof RAPIER;
  world: RAPIER.World;
  bodies: RAPIER.RigidBody[];
  colliders: RAPIER.Collider[];
}

export interface PhysicsBodyConfig {
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number; w: number };
  type?: 'dynamic' | 'static' | 'kinematic';
  mass?: number;
  restitution?: number;
  friction?: number;
}

export interface PhysicsColliderConfig {
  shape: 'box' | 'sphere' | 'cylinder' | 'capsule';
  size?: { x: number; y: number; z: number }; // For box
  radius?: number; // For sphere, cylinder, capsule
  halfHeight?: number; // For cylinder, capsule
  mass?: number;
  restitution?: number;
  friction?: number;
}

/**
 * Helper class for physics testing
 */
export class PhysicsTestHelper {
  private rapier: typeof RAPIER;
  private world: RAPIER.World;
  private bodies: RAPIER.RigidBody[] = [];
  private colliders: RAPIER.Collider[] = [];
  private eventQueue: RAPIER.EventQueue;

  constructor(rapier: typeof RAPIER, world: RAPIER.World, eventQueue: RAPIER.EventQueue) {
    this.rapier = rapier;
    this.world = world;
    this.eventQueue = eventQueue;
  }

  /**
   * Create a rigid body with a collider in one call
   */
  createBody(bodyConfig: PhysicsBodyConfig, colliderConfig: PhysicsColliderConfig): RAPIER.RigidBody {
    // Create rigid body
    let bodyDesc;
    switch (bodyConfig.type || 'dynamic') {
      case 'static':
        bodyDesc = this.rapier.RigidBodyDesc.fixed();
        break;
      case 'kinematic':
        bodyDesc = this.rapier.RigidBodyDesc.kinematicPositionBased();
        break;
      default:
        bodyDesc = this.rapier.RigidBodyDesc.dynamic();
    }

    bodyDesc.setTranslation(
      bodyConfig.position.x,
      bodyConfig.position.y,
      bodyConfig.position.z
    );

    if (bodyConfig.rotation) {
      bodyDesc.setRotation(bodyConfig.rotation);
    }

    const body = this.world.createRigidBody(bodyDesc);
    this.bodies.push(body);

    // Create collider
    let colliderDesc;
    switch (colliderConfig.shape) {
      case 'box':
        const size = colliderConfig.size || { x: 0.5, y: 0.5, z: 0.5 };
        colliderDesc = this.rapier.ColliderDesc.cuboid(size.x, size.y, size.z);
        break;
      case 'sphere':
        colliderDesc = this.rapier.ColliderDesc.ball(colliderConfig.radius || 0.5);
        break;
      case 'cylinder':
        colliderDesc = this.rapier.ColliderDesc.cylinder(
          colliderConfig.halfHeight || 0.5,
          colliderConfig.radius || 0.5
        );
        break;
      case 'capsule':
        colliderDesc = this.rapier.ColliderDesc.capsule(
          colliderConfig.halfHeight || 0.5,
          colliderConfig.radius || 0.5
        );
        break;
    }

    if (colliderConfig.mass !== undefined) {
      colliderDesc.setMass(colliderConfig.mass);
    } else if (bodyConfig.mass !== undefined) {
      colliderDesc.setMass(bodyConfig.mass);
    }

    if (colliderConfig.restitution !== undefined) {
      colliderDesc.setRestitution(colliderConfig.restitution);
    } else if (bodyConfig.restitution !== undefined) {
      colliderDesc.setRestitution(bodyConfig.restitution);
    }

    if (colliderConfig.friction !== undefined) {
      colliderDesc.setFriction(colliderConfig.friction);
    } else if (bodyConfig.friction !== undefined) {
      colliderDesc.setFriction(bodyConfig.friction);
    }

    // Enable collision events for all colliders created in tests
    // This allows the event queue to generate collision events
    if (this.rapier.ActiveEvents) {
      colliderDesc.setActiveEvents(this.rapier.ActiveEvents.COLLISION_EVENTS);
    }

    const collider = this.world.createCollider(colliderDesc, body);
    this.colliders.push(collider);

    return body;
  }

  /**
   * Create a simple ground plane
   */
  createGround(size = 100, y = 0, friction = 0.8): RAPIER.RigidBody {
    return this.createBody(
      { position: { x: 0, y, z: 0 }, type: 'static', friction },
      { shape: 'box', size: { x: size / 2, y: 0.1, z: size / 2 } }
    );
  }

  /**
   * Create a wall
   */
  createWall(
    position: { x: number; y: number; z: number },
    size: { width: number; height: number; thickness: number }
  ): RAPIER.RigidBody {
    return this.createBody(
      { position, type: 'static' },
      { shape: 'box', size: { x: size.width / 2, y: size.height / 2, z: size.thickness / 2 } }
    );
  }

  /**
   * Simulate physics for a duration
   */
  simulate(durationSeconds: number, fps = 60): void {
    const frames = Math.floor(durationSeconds * fps);
    const dt = 1 / fps;

    for (let i = 0; i < frames; i++) {
      this.world.step(this.eventQueue);
    }
  }

  /**
   * Step physics simulation once
   */
  step(): void {
    this.world.step(this.eventQueue);
  }

  /**
   * Simulate until a condition is met or timeout
   */
  simulateUntil(
    condition: () => boolean,
    maxDuration = 10,
    fps = 60
  ): { success: boolean; duration: number } {
    const maxFrames = Math.floor(maxDuration * fps);
    const dt = 1 / fps;

    for (let i = 0; i < maxFrames; i++) {
      this.world.step(this.eventQueue);

      if (condition()) {
        return { success: true, duration: i / fps };
      }
    }

    return { success: false, duration: maxDuration };
  }

  /**
   * Get all collision events from the last step
   */
  getCollisionEvents(): Array<{ handle1: number; handle2: number; started: boolean }> {
    const events: Array<{ handle1: number; handle2: number; started: boolean }> = [];

    this.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
      events.push({ handle1, handle2, started });
    });

    return events;
  }

  /**
   * Check if two bodies are colliding
   * Uses Rapier's intersection test between colliders
   */
  areBodiesColliding(body1: RAPIER.RigidBody, body2: RAPIER.RigidBody): boolean {
    // Check all collider pairs between the two bodies for intersection
    for (let i = 0; i < body1.numColliders(); i++) {
      const collider1 = body1.collider(i);
      if (!collider1) continue;

      for (let j = 0; j < body2.numColliders(); j++) {
        const collider2 = body2.collider(j);
        if (!collider2) continue;

        // Use Rapier's intersection test
        if (this.world.intersectionPair(collider1, collider2)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get body velocity magnitude
   */
  getBodySpeed(body: RAPIER.RigidBody): number {
    const vel = body.linvel();
    return Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);
  }

  /**
   * Check if body is at rest (near zero velocity)
   */
  isBodyAtRest(body: RAPIER.RigidBody, threshold = 0.01): boolean {
    return this.getBodySpeed(body) < threshold;
  }

  /**
   * Get distance between two bodies
   */
  getDistance(body1: RAPIER.RigidBody, body2: RAPIER.RigidBody): number {
    const pos1 = body1.translation();
    const pos2 = body2.translation();

    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const dz = pos2.z - pos1.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Apply impulse to body
   */
  applyImpulse(
    body: RAPIER.RigidBody,
    impulse: { x: number; y: number; z: number },
    point?: { x: number; y: number; z: number }
  ): void {
    if (point) {
      body.applyImpulseAtPoint(impulse, point, true);
    } else {
      body.applyImpulse(impulse, true);
    }
  }

  /**
   * Create a stack of boxes
   */
  createStack(
    basePosition: { x: number; y: number; z: number },
    levels: number,
    boxSize = 0.5
  ): RAPIER.RigidBody[] {
    const boxes: RAPIER.RigidBody[] = [];

    for (let i = 0; i < levels; i++) {
      const y = basePosition.y + i * boxSize * 2 + boxSize;
      const box = this.createBody(
        { position: { x: basePosition.x, y, z: basePosition.z }, mass: 1, friction: 0.8 },
        { shape: 'box', size: { x: boxSize, y: boxSize, z: boxSize } }
      );
      boxes.push(box);
    }

    return boxes;
  }

  /**
   * Create a pendulum
   */
  createPendulum(
    anchorPosition: { x: number; y: number; z: number },
    length: number,
    ballRadius = 0.3,
    ballMass = 1
  ): { anchor: RAPIER.RigidBody; ball: RAPIER.RigidBody; joint: RAPIER.ImpulseJoint } {
    // Create anchor
    const anchor = this.createBody(
      { position: anchorPosition, type: 'static' },
      { shape: 'sphere', radius: 0.1 }
    );

    // Create ball
    const ball = this.createBody(
      {
        position: { x: anchorPosition.x, y: anchorPosition.y - length, z: anchorPosition.z },
        mass: ballMass
      },
      { shape: 'sphere', radius: ballRadius }
    );

    // Create joint
    const jointParams = this.rapier.JointData.spherical(
      { x: 0, y: 0, z: 0 }, // anchor point
      { x: 0, y: length, z: 0 } // ball attach point
    );
    const joint = this.world.createImpulseJoint(jointParams, anchor, ball, true);

    return { anchor, ball, joint };
  }

  /**
   * Create a chain of connected objects
   */
  createChain(
    startPosition: { x: number; y: number; z: number },
    links: number,
    linkSize = 0.3,
    spacing = 0.6
  ): RAPIER.RigidBody[] {
    const chain: RAPIER.RigidBody[] = [];

    // Create anchor
    const anchor = this.createBody(
      { position: startPosition, type: 'static' },
      { shape: 'sphere', radius: 0.1 }
    );
    chain.push(anchor);

    // Create links
    let prevBody = anchor;
    for (let i = 0; i < links; i++) {
      const y = startPosition.y - (i + 1) * spacing;
      const link = this.createBody(
        { position: { x: startPosition.x, y, z: startPosition.z }, mass: 1 },
        { shape: 'sphere', radius: linkSize }
      );

      // Connect to previous link
      const jointParams = this.rapier.JointData.spherical(
        { x: 0, y: -spacing / 2, z: 0 },
        { x: 0, y: spacing / 2, z: 0 }
      );
      this.world.createImpulseJoint(jointParams, prevBody, link, true);

      chain.push(link);
      prevBody = link;
    }

    return chain;
  }

  /**
   * Clean up all created bodies
   */
  cleanup(): void {
    for (const body of this.bodies) {
      this.world.removeRigidBody(body);
    }
    this.bodies = [];
    this.colliders = [];
  }

  /**
   * Get number of bodies
   */
  getBodyCount(): number {
    return this.bodies.length;
  }

  /**
   * Get all bodies
   */
  getBodies(): RAPIER.RigidBody[] {
    return this.bodies;
  }

  /**
   * Get body at index
   */
  getBody(index: number): RAPIER.RigidBody | undefined {
    return this.bodies[index];
  }
}

/**
 * Physics assertions for testing
 */
export class PhysicsAssertions {
  /**
   * Assert that a body has fallen below a threshold
   */
  static assertBodyFell(body: RAPIER.RigidBody, threshold = 0): void {
    const pos = body.translation();
    if (pos.y >= threshold) {
      throw new Error(`Expected body to fall below ${threshold}, but y position is ${pos.y}`);
    }
  }

  /**
   * Assert that a body is at a specific position (with tolerance)
   */
  static assertBodyPosition(
    body: RAPIER.RigidBody,
    expected: { x: number; y: number; z: number },
    tolerance = 0.1
  ): void {
    const pos = body.translation();
    const dx = Math.abs(pos.x - expected.x);
    const dy = Math.abs(pos.y - expected.y);
    const dz = Math.abs(pos.z - expected.z);

    if (dx > tolerance || dy > tolerance || dz > tolerance) {
      throw new Error(
        `Body position mismatch. Expected (${expected.x}, ${expected.y}, ${expected.z}), ` +
        `got (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`
      );
    }
  }

  /**
   * Assert that a body is moving
   */
  static assertBodyIsMoving(body: RAPIER.RigidBody, minSpeed = 0.1): void {
    const vel = body.linvel();
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);

    if (speed < minSpeed) {
      throw new Error(`Expected body to be moving (speed >= ${minSpeed}), but speed is ${speed.toFixed(3)}`);
    }
  }

  /**
   * Assert that a body is at rest
   */
  static assertBodyAtRest(body: RAPIER.RigidBody, maxSpeed = 0.01): void {
    const vel = body.linvel();
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);

    if (speed > maxSpeed) {
      throw new Error(`Expected body to be at rest (speed <= ${maxSpeed}), but speed is ${speed.toFixed(3)}`);
    }
  }

  /**
   * Assert that two bodies are colliding
   */
  static assertBodiesColliding(
    helper: PhysicsTestHelper,
    body1: RAPIER.RigidBody,
    body2: RAPIER.RigidBody
  ): void {
    if (!helper.areBodiesColliding(body1, body2)) {
      throw new Error('Expected bodies to be colliding, but they are not');
    }
  }

  /**
   * Assert that a body stayed within bounds
   */
  static assertBodyInBounds(
    body: RAPIER.RigidBody,
    bounds: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }
  ): void {
    const pos = body.translation();

    if (
      pos.x < bounds.min.x || pos.x > bounds.max.x ||
      pos.y < bounds.min.y || pos.y > bounds.max.y ||
      pos.z < bounds.min.z || pos.z > bounds.max.z
    ) {
      throw new Error(
        `Body out of bounds. Position: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}), ` +
        `Bounds: (${bounds.min.x},${bounds.min.y},${bounds.min.z}) to (${bounds.max.x},${bounds.max.y},${bounds.max.z})`
      );
    }
  }
}

/**
 * Create a physics test helper from a physics system
 */
export function createPhysicsTestHelper(
  rapier: typeof RAPIER,
  world: RAPIER.World,
  eventQueue: RAPIER.EventQueue
): PhysicsTestHelper {
  return new PhysicsTestHelper(rapier, world, eventQueue);
}
