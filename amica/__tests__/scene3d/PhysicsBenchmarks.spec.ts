import { describe, it, expect, beforeEach } from 'vitest';
import { PhysicsSystem } from '@/features/scene3d/PhysicsSystem';
import RAPIER from '@dimforge/rapier3d-compat';
import { createPhysicsTestHelper } from '../helpers/PhysicsTestHelpers';

/**
 * Performance benchmarks for Rapier.js physics engine
 * These tests measure and validate physics performance
 */
describe('Physics Performance Benchmarks', () => {
  let physics: PhysicsSystem;
  let RAPIER_MODULE: typeof RAPIER;

  beforeEach(async () => {
    physics = new PhysicsSystem();
    await physics.initialize();
    RAPIER_MODULE = physics.getRAPIER()!;
  });

  describe('Rigid Body Creation Performance', () => {
    it('should create 1000 rigid bodies quickly', () => {
      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        physics.createRigidBody('dynamic', { x: i % 10, y: i, z: Math.floor(i / 10) });
      }

      const elapsed = performance.now() - startTime;

      console.log(`Created 1000 rigid bodies in ${elapsed.toFixed(2)}ms`);
      expect(elapsed).toBeLessThan(100); // Should be very fast
    });

    it('should create 1000 colliders quickly', () => {
      const world = physics.getWorld()!;
      const bodies = [];

      // Pre-create bodies
      for (let i = 0; i < 1000; i++) {
        const body = physics.createRigidBody('dynamic', { x: 0, y: i, z: 0 })!;
        bodies.push(body);
      }

      const startTime = performance.now();

      for (const body of bodies) {
        const collider = RAPIER_MODULE.ColliderDesc.ball(0.5);
        world.createCollider(collider, body);
      }

      const elapsed = performance.now() - startTime;

      console.log(`Created 1000 colliders in ${elapsed.toFixed(2)}ms`);
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe('Simulation Performance', () => {
    it('should simulate 100 objects at 60fps', () => {
      const world = physics.getWorld()!;

      // Create ground
      const ground = physics.createRigidBody('static', { x: 0, y: 0, z: 0 })!;
      const groundCollider = RAPIER_MODULE.ColliderDesc.cuboid(50, 0.1, 50);
      world.createCollider(groundCollider, ground);

      // Create 100 falling objects
      for (let i = 0; i < 100; i++) {
        const x = (Math.random() - 0.5) * 20;
        const z = (Math.random() - 0.5) * 20;
        const body = physics.createRigidBody('dynamic', { x, y: 10 + i * 0.5, z })!;
        const collider = RAPIER_MODULE.ColliderDesc.ball(0.5)
          .setMass(1)
          .setRestitution(0.3)
          .setFriction(0.5);
        world.createCollider(collider, body);
      }

      // Measure 60 frames of simulation
      const startTime = performance.now();

      for (let i = 0; i < 60; i++) {
        physics.stepSimulation(1/60);
      }

      const elapsed = performance.now() - startTime;
      const avgFrameTime = elapsed / 60;

      console.log(`100 objects: ${avgFrameTime.toFixed(2)}ms avg per frame (${(1000/avgFrameTime).toFixed(1)} fps)`);

      // Should maintain 60fps (< 16.67ms per frame)
      expect(avgFrameTime).toBeLessThan(16.67);
    });

    it('should simulate 500 objects reasonably fast', () => {
      const world = physics.getWorld()!;

      // Create ground
      const ground = physics.createRigidBody('static', { x: 0, y: 0, z: 0 })!;
      const groundCollider = RAPIER_MODULE.ColliderDesc.cuboid(100, 0.1, 100);
      world.createCollider(groundCollider, ground);

      // Create 500 objects
      for (let i = 0; i < 500; i++) {
        const x = (Math.random() - 0.5) * 50;
        const z = (Math.random() - 0.5) * 50;
        const body = physics.createRigidBody('dynamic', { x, y: 10 + i * 0.3, z })!;
        const collider = RAPIER_MODULE.ColliderDesc.ball(0.3)
          .setMass(0.5);
        world.createCollider(collider, body);
      }

      // Measure 60 frames
      const startTime = performance.now();

      for (let i = 0; i < 60; i++) {
        physics.stepSimulation(1/60);
      }

      const elapsed = performance.now() - startTime;
      const avgFrameTime = elapsed / 60;

      console.log(`500 objects: ${avgFrameTime.toFixed(2)}ms avg per frame (${(1000/avgFrameTime).toFixed(1)} fps)`);

      // Should complete in reasonable time (< 100ms per frame)
      expect(avgFrameTime).toBeLessThan(100);
    });

    it('should handle complex shapes efficiently', () => {
      const world = physics.getWorld()!;

      // Create ground
      const ground = physics.createRigidBody('static', { x: 0, y: 0, z: 0 })!;
      const groundCollider = RAPIER_MODULE.ColliderDesc.cuboid(50, 0.1, 50);
      world.createCollider(groundCollider, ground);

      // Create mix of complex shapes
      for (let i = 0; i < 100; i++) {
        const x = (Math.random() - 0.5) * 20;
        const z = (Math.random() - 0.5) * 20;
        const body = physics.createRigidBody('dynamic', { x, y: 10 + i * 0.5, z })!;

        const shapeType = i % 3;
        let collider;

        if (shapeType === 0) {
          // Box
          collider = RAPIER_MODULE.ColliderDesc.cuboid(0.5, 0.5, 0.5);
        } else if (shapeType === 1) {
          // Sphere
          collider = RAPIER_MODULE.ColliderDesc.ball(0.5);
        } else {
          // Cylinder
          collider = RAPIER_MODULE.ColliderDesc.cylinder(0.5, 0.3);
        }

        collider.setMass(1).setRestitution(0.3).setFriction(0.5);
        world.createCollider(collider, body);
      }

      // Measure simulation
      const startTime = performance.now();

      for (let i = 0; i < 60; i++) {
        physics.stepSimulation(1/60);
      }

      const elapsed = performance.now() - startTime;
      const avgFrameTime = elapsed / 60;

      console.log(`100 mixed shapes: ${avgFrameTime.toFixed(2)}ms avg per frame`);

      // Should maintain good performance
      expect(avgFrameTime).toBeLessThan(20);
    });
  });

  describe('Collision Detection Performance', () => {
    it('should handle many collisions efficiently', () => {
      const world = physics.getWorld()!;
      const eventQueue = physics.getEventQueue()!;

      // Create dense grid of static objects
      for (let x = -5; x <= 5; x++) {
        for (let z = -5; z <= 5; z++) {
          const body = physics.createRigidBody('static', { x: x * 2, y: 0, z: z * 2 })!;
          const collider = RAPIER_MODULE.ColliderDesc.ball(0.8);
          world.createCollider(collider, body);
        }
      }

      // Drop many objects from above
      for (let i = 0; i < 50; i++) {
        const x = (Math.random() - 0.5) * 20;
        const z = (Math.random() - 0.5) * 20;
        const body = physics.createRigidBody('dynamic', { x, y: 20 + i, z })!;
        const collider = RAPIER_MODULE.ColliderDesc.ball(0.5)
          .setMass(1);
        world.createCollider(collider, body);
      }

      let totalCollisions = 0;
      const startTime = performance.now();

      // Simulate and count collisions
      for (let i = 0; i < 120; i++) {
        physics.stepSimulation(1/60);

        eventQueue.drainCollisionEvents((handle1, handle2, started) => {
          if (started) totalCollisions++;
        });
      }

      const elapsed = performance.now() - startTime;
      const avgFrameTime = elapsed / 120;

      console.log(`Collision test: ${totalCollisions} collisions, ${avgFrameTime.toFixed(2)}ms avg per frame`);

      // Should handle many collisions efficiently
      expect(avgFrameTime).toBeLessThan(20);
      expect(totalCollisions).toBeGreaterThan(0); // Collisions should occur
    });
  });

  describe('Memory Performance', () => {
    it('should not leak memory when creating/destroying bodies', () => {
      const world = physics.getWorld()!;
      const initialBodyCount = world.bodies.len();

      // Create and destroy many bodies
      for (let iteration = 0; iteration < 10; iteration++) {
        const bodies = [];

        // Create 100 bodies
        for (let i = 0; i < 100; i++) {
          const body = physics.createRigidBody('dynamic', { x: i, y: 0, z: 0 })!;
          physics.createSphere(0.5, body);
          bodies.push(body);
        }

        // Remove all bodies
        for (const body of bodies) {
          physics.removeRigidBody(body);
        }
      }

      const finalBodyCount = world.bodies.len();

      // Body count should return to initial state
      expect(finalBodyCount).toBe(initialBodyCount);
    });
  });

  describe('Scaling Tests', () => {
    it('should scale linearly with object count', () => {
      const results: { count: number; time: number }[] = [];

      for (const objectCount of [10, 50, 100, 200]) {
        const testPhysics = new PhysicsSystem();
        await testPhysics.initialize();

        const world = testPhysics.getWorld()!;
        const RAPIER_TEST = testPhysics.getRAPIER()!;

        // Create ground
        const ground = testPhysics.createRigidBody('static', { x: 0, y: 0, z: 0 })!;
        const groundCollider = RAPIER_TEST.ColliderDesc.cuboid(100, 0.1, 100);
        world.createCollider(groundCollider, ground);

        // Create objects
        for (let i = 0; i < objectCount; i++) {
          const x = (Math.random() - 0.5) * 50;
          const z = (Math.random() - 0.5) * 50;
          const body = testPhysics.createRigidBody('dynamic', { x, y: 10 + i * 0.3, z })!;
          const collider = RAPIER_TEST.ColliderDesc.ball(0.5).setMass(1);
          world.createCollider(collider, body);
        }

        // Measure
        const startTime = performance.now();
        for (let i = 0; i < 60; i++) {
          testPhysics.stepSimulation(1/60);
        }
        const elapsed = performance.now() - startTime;

        results.push({ count: objectCount, time: elapsed / 60 });
      }

      // Print results
      console.log('Scaling results:');
      results.forEach(r => {
        console.log(`  ${r.count} objects: ${r.time.toFixed(2)}ms per frame`);
      });

      // Performance should degrade roughly linearly (not exponentially)
      const time10 = results[0].time;
      const time200 = results[3].time;
      const ratio = time200 / time10;

      // 200 objects should not be more than 30x slower than 10 objects
      expect(ratio).toBeLessThan(30);
    });
  });

  describe('Stress Tests', () => {
    it('should handle 1000 objects falling', () => {
      const world = physics.getWorld()!;

      // Create ground
      const ground = physics.createRigidBody('static', { x: 0, y: 0, z: 0 })!;
      const groundCollider = RAPIER_MODULE.ColliderDesc.cuboid(200, 0.1, 200);
      world.createCollider(groundCollider, ground);

      // Create 1000 objects
      for (let i = 0; i < 1000; i++) {
        const x = (Math.random() - 0.5) * 100;
        const z = (Math.random() - 0.5) * 100;
        const body = physics.createRigidBody('dynamic', { x, y: 10 + i * 0.1, z })!;
        const collider = RAPIER_MODULE.ColliderDesc.ball(0.3)
          .setMass(0.5);
        world.createCollider(collider, body);
      }

      const startTime = performance.now();

      // Simulate 1 second
      for (let i = 0; i < 60; i++) {
        physics.stepSimulation(1/60);
      }

      const elapsed = performance.now() - startTime;
      const avgFrameTime = elapsed / 60;

      console.log(`1000 objects stress test: ${avgFrameTime.toFixed(2)}ms avg per frame`);

      // Should complete without crashing
      expect(avgFrameTime).toBeLessThan(200); // Reasonable threshold for stress test
    });

    it('should handle complex scenario with mixed constraints', () => {
      const world = physics.getWorld()!;

      // Create ground
      const ground = physics.createRigidBody('static', { x: 0, y: 0, z: 0 })!;
      const groundCollider = RAPIER_MODULE.ColliderDesc.cuboid(50, 0.1, 50);
      world.createCollider(groundCollider, ground);

      // Create chain of connected objects (pendulum chain)
      let prevBody = ground;
      for (let i = 0; i < 20; i++) {
        const body = physics.createRigidBody('dynamic', { x: 0, y: 10 - i * 0.5, z: 0 })!;
        const collider = RAPIER_MODULE.ColliderDesc.ball(0.3).setMass(1);
        world.createCollider(collider, body);

        // Connect to previous body with spherical joint
        const jointParams = RAPIER_MODULE.JointData.spherical(
          { x: 0, y: -0.25, z: 0 },
          { x: 0, y: 0.25, z: 0 }
        );
        world.createImpulseJoint(jointParams, prevBody, body, true);

        prevBody = body;
      }

      // Add more falling objects
      for (let i = 0; i < 50; i++) {
        const x = (Math.random() - 0.5) * 20;
        const z = (Math.random() - 0.5) * 20;
        const body = physics.createRigidBody('dynamic', { x, y: 15 + i * 0.5, z })!;
        const collider = RAPIER_MODULE.ColliderDesc.box(0.5).setMass(1);
        world.createCollider(collider, body);
      }

      const startTime = performance.now();

      // Simulate complex scenario
      for (let i = 0; i < 60; i++) {
        physics.stepSimulation(1/60);
      }

      const elapsed = performance.now() - startTime;
      const avgFrameTime = elapsed / 60;

      console.log(`Complex scenario: ${avgFrameTime.toFixed(2)}ms avg per frame`);

      // Should handle complex constraints
      expect(avgFrameTime).toBeLessThan(50);
    });
  });
});
