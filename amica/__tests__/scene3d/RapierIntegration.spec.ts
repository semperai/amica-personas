import { describe, it, expect, beforeEach } from 'vitest';
import { PhysicsSystem } from '@/features/scene3d/PhysicsSystem';
import { createPhysicsTestHelper } from '../helpers/PhysicsTestHelpers';
import RAPIER from '@dimforge/rapier3d-compat';

/**
 * Integration tests for Rapier.js physics engine
 * Tests real physics simulations without mocking
 */
describe('Rapier Integration Tests', () => {
  let physics: PhysicsSystem;
  let RAPIER_MODULE: typeof RAPIER;

  beforeEach(async () => {
    physics = new PhysicsSystem();
    await physics.initialize();
    RAPIER_MODULE = physics.getRAPIER()!;
  });

  describe('Physics World', () => {
    it('should create a physics world with correct gravity', async () => {
      const world = physics.getWorld();
      expect(world).toBeDefined();
      expect(world?.gravity).toEqual({ x: 0, y: -7.8, z: 0 });
    });

    it('should allow gravity modification', () => {
      physics.setGravity(0, -9.81, 0);
      const world = physics.getWorld();
      expect(world?.gravity).toEqual({ x: 0, y: -9.81, z: 0 });
    });

    it('should create event queue for collision detection', () => {
      const eventQueue = physics.getEventQueue();
      expect(eventQueue).toBeDefined();
    });
  });

  describe('Rigid Body Creation', () => {
    it('should create dynamic rigid body', () => {
      const body = physics.createRigidBody('dynamic', { x: 0, y: 5, z: 0 });
      expect(body).toBeDefined();

      if (body) {
        const translation = body.translation();
        expect(translation.x).toBeCloseTo(0);
        expect(translation.y).toBeCloseTo(5);
        expect(translation.z).toBeCloseTo(0);
      }
    });

    it('should create static rigid body', () => {
      const body = physics.createRigidBody('static', { x: 0, y: 0, z: 0 });
      expect(body).toBeDefined();

      if (body) {
        expect(body.isFixed()).toBe(true);
      }
    });

    it('should create kinematic rigid body', () => {
      const body = physics.createRigidBody('kinematic', { x: 0, y: 1, z: 0 });
      expect(body).toBeDefined();

      if (body) {
        expect(body.isKinematic()).toBe(true);
      }
    });

    it('should create body with rotation', () => {
      const body = physics.createRigidBody(
        'dynamic',
        { x: 0, y: 5, z: 0 },
        { x: 0, y: 0.707, z: 0, w: 0.707 } // 90 degree rotation around Y
      );
      expect(body).toBeDefined();

      if (body) {
        const rotation = body.rotation();
        expect(rotation.y).toBeCloseTo(0.707, 2);
        expect(rotation.w).toBeCloseTo(0.707, 2);
      }
    });
  });

  describe('Collider Creation', () => {
    it('should create box collider', () => {
      const body = physics.createRigidBody('dynamic', { x: 0, y: 5, z: 0 })!;
      const collider = physics.createBox({ x: 0.5, y: 0.5, z: 0.5 }, body);

      expect(collider).toBeDefined();
    });

    it('should create sphere collider', () => {
      const body = physics.createRigidBody('dynamic', { x: 0, y: 5, z: 0 })!;
      const collider = physics.createSphere(0.5, body);

      expect(collider).toBeDefined();
    });

    it('should create cylinder collider', () => {
      const body = physics.createRigidBody('dynamic', { x: 0, y: 5, z: 0 })!;
      const collider = physics.createCylinder(0.5, 0.3, body);

      expect(collider).toBeDefined();
    });

    it('should create multiple colliders on same body', () => {
      const body = physics.createRigidBody('dynamic', { x: 0, y: 5, z: 0 })!;
      const collider1 = physics.createBox({ x: 0.5, y: 0.5, z: 0.5 }, body);
      const collider2 = physics.createSphere(0.3, body);

      expect(collider1).toBeDefined();
      expect(collider2).toBeDefined();
      expect(body.numColliders()).toBe(2);
    });
  });

  describe('Physics Simulation', () => {
    it('should simulate falling object with gravity', () => {
      const world = physics.getWorld()!;
      const body = physics.createRigidBody('dynamic', { x: 0, y: 5, z: 0 })!;
      physics.createSphere(0.5, body);

      const initialY = body.translation().y;

      // Step simulation 60 times (1 second at 60fps)
      for (let i = 0; i < 60; i++) {
        physics.stepSimulation(1/60);
      }

      const finalY = body.translation().y;

      // Object should have fallen due to gravity
      expect(finalY).toBeLessThan(initialY);
      expect(finalY).toBeCloseTo(1.2, 0.5); // Approximate position after 1 second
    });

    it('should simulate object resting on ground', () => {
      const world = physics.getWorld()!;

      // Create static ground
      const ground = physics.createRigidBody('static', { x: 0, y: 0, z: 0 })!;
      const groundCollider = RAPIER_MODULE.ColliderDesc.cuboid(10, 0.1, 10);
      world.createCollider(groundCollider, ground);

      // Create falling sphere
      const sphere = physics.createRigidBody('dynamic', { x: 0, y: 2, z: 0 })!;
      const sphereCollider = RAPIER_MODULE.ColliderDesc.ball(0.5)
        .setRestitution(0.3)
        .setFriction(0.5);
      world.createCollider(sphereCollider, sphere);

      // Simulate for 2 seconds
      for (let i = 0; i < 120; i++) {
        physics.stepSimulation(1/60);
      }

      const finalY = sphere.translation().y;

      // Sphere should be resting on ground (at approximately 0.5 height due to radius)
      expect(finalY).toBeCloseTo(0.5, 0.2);

      // Velocity should be near zero (object at rest)
      const velocity = sphere.linvel();
      expect(Math.abs(velocity.y)).toBeLessThan(0.1);
    });

    it('should simulate bouncing with restitution', () => {
      const world = physics.getWorld()!;

      // Create static ground
      const ground = physics.createRigidBody('static', { x: 0, y: 0, z: 0 })!;
      const groundCollider = RAPIER_MODULE.ColliderDesc.cuboid(10, 0.1, 10)
        .setRestitution(0.9); // High restitution
      if (RAPIER_MODULE.ActiveEvents) {
        groundCollider.setActiveEvents(RAPIER_MODULE.ActiveEvents.COLLISION_EVENTS);
      }
      world.createCollider(groundCollider, ground);

      // Create falling sphere with high restitution
      const sphere = physics.createRigidBody('dynamic', { x: 0, y: 5, z: 0 })!;
      const sphereCollider = RAPIER_MODULE.ColliderDesc.ball(0.5)
        .setRestitution(0.9); // High restitution
      if (RAPIER_MODULE.ActiveEvents) {
        sphereCollider.setActiveEvents(RAPIER_MODULE.ActiveEvents.COLLISION_EVENTS);
      }
      world.createCollider(sphereCollider, sphere);

      let minY = 5;
      let maxYAfterBounce = 0;
      let hitGround = false;

      // Let it fall and bounce, tracking trajectory
      for (let i = 0; i < 300; i++) {
        physics.stepSimulation(1/60);
        const y = sphere.translation().y;

        // Track minimum (when it hits ground)
        if (y < minY) {
          minY = y;
          hitGround = true;
        }

        // Track maximum after hitting ground (the bounce)
        if (hitGround && y > maxYAfterBounce) {
          maxYAfterBounce = y;
        }
      }

      // Should have hit the ground
      expect(minY).toBeLessThan(2);

      // With high restitution, ball should bounce back up significantly
      expect(maxYAfterBounce).toBeGreaterThan(1);
    });

    it('should apply impulse to rigid body', () => {
      const body = physics.createRigidBody('dynamic', { x: 0, y: 5, z: 0 })!;
      physics.createSphere(0.5, body);

      // Apply horizontal impulse
      body.applyImpulse({ x: 10, y: 0, z: 0 }, true);

      // Simulate
      for (let i = 0; i < 30; i++) {
        physics.stepSimulation(1/60);
      }

      const finalX = body.translation().x;

      // Object should have moved horizontally
      expect(finalX).toBeGreaterThan(1);
    });
  });

  describe('Collision Detection', () => {
    it('should detect collisions between objects', () => {
      const world = physics.getWorld()!;
      const eventQueue = physics.getEventQueue()!;

      // Create two objects that will collide
      const obj1 = physics.createRigidBody('dynamic', { x: 0, y: 5, z: 0 })!;
      const collider1 = RAPIER_MODULE.ColliderDesc.ball(0.5);
      if (RAPIER_MODULE.ActiveEvents) {
        collider1.setActiveEvents(RAPIER_MODULE.ActiveEvents.COLLISION_EVENTS);
      }
      world.createCollider(collider1, obj1);

      const obj2 = physics.createRigidBody('static', { x: 0, y: 0, z: 0 })!;
      const collider2 = RAPIER_MODULE.ColliderDesc.ball(0.5);
      if (RAPIER_MODULE.ActiveEvents) {
        collider2.setActiveEvents(RAPIER_MODULE.ActiveEvents.COLLISION_EVENTS);
      }
      world.createCollider(collider2, obj2);

      let collisionDetected = false;

      // Simulate until collision
      for (let i = 0; i < 120; i++) {
        physics.stepSimulation(1/60);

        eventQueue.drainCollisionEvents((handle1, handle2, started) => {
          collisionDetected = true;
        });
      }

      expect(collisionDetected).toBe(true);
    });
  });

  describe('Body Removal', () => {
    it('should remove rigid body from world', () => {
      const world = physics.getWorld()!;
      const body = physics.createRigidBody('dynamic', { x: 0, y: 5, z: 0 })!;
      physics.createSphere(0.5, body);

      const numBodiesBefore = world.bodies.len();

      physics.removeRigidBody(body);

      // Process deferred removals
      physics.stepSimulation(1/60);

      const numBodiesAfter = world.bodies.len();

      expect(numBodiesAfter).toBe(numBodiesBefore - 1);
    });

    it('should handle removing non-existent body gracefully', () => {
      // Create a body in a different physics instance
      const otherPhysics = new PhysicsSystem();

      // This should not throw when queueing removal
      expect(() => {
        const fakeBody = {} as any;
        physics.removeRigidBody(fakeBody);
      }).not.toThrow();

      // And should not throw when processing the deferred removal
      expect(() => physics.stepSimulation(1/60)).not.toThrow();
    });
  });

  describe('Complex Scenarios', () => {
    it('should simulate stack of boxes', () => {
      const world = physics.getWorld()!;

      // Create ground
      const ground = physics.createRigidBody('static', { x: 0, y: 0, z: 0 })!;
      const groundCollider = RAPIER_MODULE.ColliderDesc.cuboid(10, 0.1, 10)
        .setFriction(0.8);
      world.createCollider(groundCollider, ground);

      // Create stack of 5 boxes
      const boxes = [];
      for (let i = 0; i < 5; i++) {
        const box = physics.createRigidBody('dynamic', { x: 0, y: 0.5 + i * 1, z: 0 })!;
        const boxCollider = RAPIER_MODULE.ColliderDesc.cuboid(0.5, 0.5, 0.5)
          .setFriction(0.8)
          .setMass(1);
        world.createCollider(boxCollider, box);
        boxes.push(box);
      }

      // Simulate
      for (let i = 0; i < 300; i++) {
        physics.stepSimulation(1/60);
      }

      // Stack should have settled
      boxes.forEach((box, index) => {
        const y = box.translation().y;
        // Each box should be roughly at its stacking height
        expect(y).toBeGreaterThan(index * 0.8);
        expect(y).toBeLessThan((index + 1) * 1.2);
      });
    });

    it('should simulate pendulum with spherical joint', () => {
      const world = physics.getWorld()!;

      // Create fixed anchor point
      const anchor = physics.createRigidBody('static', { x: 0, y: 5, z: 0 })!;

      // Create pendulum ball
      const ball = physics.createRigidBody('dynamic', { x: 0, y: 3, z: 0 })!;
      const ballCollider = RAPIER_MODULE.ColliderDesc.ball(0.3)
        .setMass(1);
      world.createCollider(ballCollider, ball);

      // Create spherical joint to connect them
      const jointParams = RAPIER_MODULE.JointData.spherical(
        { x: 0, y: 0, z: 0 },  // anchor point
        { x: 0, y: 2, z: 0 }   // ball attach point
      );
      world.createImpulseJoint(jointParams, anchor, ball, true);

      // Give initial push
      ball.applyImpulse({ x: 5, y: 0, z: 0 }, true);

      // Simulate
      const positions = [];
      for (let i = 0; i < 180; i++) {
        physics.stepSimulation(1/60);
        if (i % 30 === 0) {
          positions.push(ball.translation().x);
        }
      }

      // Pendulum should swing back and forth (x position should oscillate)
      expect(positions[0]).toBeLessThan(positions[1]); // Moving right
      expect(positions[positions.length - 1]).toBeLessThan(positions[1]); // Has swung back
    });
  });

  describe('Performance', () => {
    it('should handle many rigid bodies without errors', () => {
      const world = physics.getWorld()!;

      // Create 100 objects
      const bodies = [];
      for (let i = 0; i < 100; i++) {
        const x = (i % 10) * 2;
        const z = Math.floor(i / 10) * 2;
        const body = physics.createRigidBody('dynamic', { x, y: 10 + i * 0.5, z })!;
        const collider = RAPIER_MODULE.ColliderDesc.ball(0.3)
          .setMass(0.5);
        world.createCollider(collider, body);
        bodies.push(body);
      }

      // Record simulation performance (for informational purposes)
      const startTime = performance.now();

      // Run 60 simulation steps
      for (let i = 0; i < 60; i++) {
        physics.stepSimulation(1/60);
      }

      const elapsed = performance.now() - startTime;

      // Log performance for monitoring (but don't fail on slow CI)
      if (elapsed > 500) {
        console.warn(`Physics simulation took ${elapsed.toFixed(2)}ms for 100 bodies, 60 steps`);
      }

      // Assert functional correctness instead of hard time limits
      expect(bodies.length).toBe(100);

      // All bodies should remain valid and have positions
      bodies.forEach((body, index) => {
        expect(body).toBeDefined();
        const translation = body.translation();
        expect(translation).toBeDefined();
        expect(typeof translation.x).toBe('number');
        expect(typeof translation.y).toBe('number');
        expect(typeof translation.z).toBe('number');
        expect(isNaN(translation.x)).toBe(false);
        expect(isNaN(translation.y)).toBe(false);
        expect(isNaN(translation.z)).toBe(false);
      });
    });

    it('should maintain stable simulation over long duration', () => {
      const world = physics.getWorld()!;

      // Create ground to keep objects in bounds
      const ground = physics.createRigidBody('static', { x: 0, y: -10, z: 0 })!;
      const groundCollider = RAPIER_MODULE.ColliderDesc.cuboid(100, 1, 100);
      world.createCollider(groundCollider, ground);

      // Create simple falling object
      const body = physics.createRigidBody('dynamic', { x: 0, y: 100, z: 0 })!;
      physics.createSphere(0.5, body);

      // Simulate for 10 seconds
      for (let i = 0; i < 600; i++) {
        physics.stepSimulation(1/60);
      }

      const finalY = body.translation().y;

      // Should not have exploded or become NaN
      expect(isFinite(finalY)).toBe(true);
      // Should have settled on or near the ground
      expect(finalY).toBeGreaterThan(-15);
      expect(finalY).toBeLessThan(100);
    });
  });

  describe('Determinism', () => {
    it('should produce deterministic results across multiple runs', async () => {
      const runSimulation = async () => {
        const testPhysics = new PhysicsSystem();
        const initialized = await testPhysics.initialize();
        expect(initialized).toBe(true);

        const testHelper = createPhysicsTestHelper(
          testPhysics.getRAPIER()!,
          testPhysics.getWorld()!,
          testPhysics.getEventQueue()!
        );

        // Create a simple falling ball
        const ball = testHelper.createBody(
          { position: { x: 0, y: 10, z: 0 }, mass: 1 },
          { shape: 'sphere', radius: 0.5 }
        );

        // Create ground
        testHelper.createGround();

        // Simulate for 1 second
        testHelper.simulate(1.0, 60);

        const pos = ball.translation();
        return { x: pos.x, y: pos.y, z: pos.z };
      };

      const result1 = await runSimulation();
      const result2 = await runSimulation();

      // Results should be identical (deterministic)
      expect(result1.x).toBeCloseTo(result2.x, 10);
      expect(result1.y).toBeCloseTo(result2.y, 10);
      expect(result1.z).toBeCloseTo(result2.z, 10);
    });
  });
});
