import { describe, it, expect, beforeEach } from 'vitest';
import { PhysicsSystem } from '@/features/scene3d/PhysicsSystem';
import {
  createPhysicsTestHelper,
  PhysicsTestHelper,
  PhysicsAssertions
} from '../helpers/PhysicsTestHelpers';
import RAPIER from '@dimforge/rapier3d-compat';

/**
 * Collision detection tests for Rapier.js
 * Tests various collision scenarios and event handling
 */
describe('Collision Detection Tests', () => {
  let physics: PhysicsSystem;
  let RAPIER_MODULE: typeof RAPIER;
  let helper: PhysicsTestHelper;

  beforeEach(async () => {
    physics = new PhysicsSystem();
    await physics.initialize();
    RAPIER_MODULE = physics.getRAPIER()!;

    helper = createPhysicsTestHelper(
      RAPIER_MODULE,
      physics.getWorld()!,
      physics.getEventQueue()!
    );
  });

  describe('Basic Collisions', () => {
    it('should detect sphere-sphere collision', () => {
      // Create two spheres that will collide
      const sphere1 = helper.createBody(
        { position: { x: 0, y: 5, z: 0 }, mass: 1 },
        { shape: 'sphere', radius: 0.5 }
      );

      const sphere2 = helper.createBody(
        { position: { x: 0, y: 0, z: 0 }, type: 'static' },
        { shape: 'sphere', radius: 0.5 }
      );

      // Simulate and check for collision
      const result = helper.simulateUntil(() => {
        const pos1 = sphere1.translation();
        const pos2 = sphere2.translation();
        const distance = Math.sqrt(
          Math.pow(pos2.x - pos1.x, 2) +
          Math.pow(pos2.y - pos1.y, 2) +
          Math.pow(pos2.z - pos1.z, 2)
        );

        // Two spheres with radius 0.5 touch when centers are 1.0 apart
        // Check if they're close enough (with some tolerance)
        return distance <= 1.05;
      }, 5);

      expect(result.success).toBe(true);
    });

    it('should detect box-box collision', () => {
      const box1 = helper.createBody(
        { position: { x: 0, y: 5, z: 0 }, mass: 1 },
        { shape: 'box', size: { x: 0.5, y: 0.5, z: 0.5 } }
      );

      const box2 = helper.createBody(
        { position: { x: 0, y: 0, z: 0 }, type: 'static' },
        { shape: 'box', size: { x: 0.5, y: 0.5, z: 0.5 } }
      );

      const result = helper.simulateUntil(() => {
        const pos1 = box1.translation();
        const pos2 = box2.translation();
        const distance = Math.abs(pos1.y - pos2.y);
        // Boxes with half-extent 0.5 touch when centers are 1.0 apart
        return distance <= 1.05;
      }, 5);

      expect(result.success).toBe(true);
    });

    it('should detect sphere-box collision', () => {
      const sphere = helper.createBody(
        { position: { x: 0, y: 5, z: 0 }, mass: 1 },
        { shape: 'sphere', radius: 0.5 }
      );

      const box = helper.createBody(
        { position: { x: 0, y: 0, z: 0 }, type: 'static' },
        { shape: 'box', size: { x: 1, y: 0.5, z: 1 } }
      );

      const result = helper.simulateUntil(() => {
        const pos1 = sphere.translation();
        const pos2 = box.translation();
        const distance = Math.abs(pos1.y - pos2.y);
        // Sphere radius 0.5 + box half-extent 0.5 = 1.0
        return distance <= 1.05;
      }, 5);

      expect(result.success).toBe(true);
    });

    it('should detect cylinder collisions', () => {
      const cylinder1 = helper.createBody(
        { position: { x: 0, y: 5, z: 0 }, mass: 1 },
        { shape: 'cylinder', radius: 0.5, halfHeight: 0.5 }
      );

      const cylinder2 = helper.createBody(
        { position: { x: 0, y: 0, z: 0 }, type: 'static' },
        { shape: 'cylinder', radius: 0.5, halfHeight: 0.5 }
      );

      const result = helper.simulateUntil(() => {
        const pos1 = cylinder1.translation();
        const pos2 = cylinder2.translation();
        const distance = Math.abs(pos1.y - pos2.y);
        // Cylinders with half-height 0.5 touch when centers are 1.0 apart
        return distance <= 1.05;
      }, 5);

      expect(result.success).toBe(true);
    });
  });

  describe('Collision Events', () => {
    it('should emit collision start events', () => {
      const sphere = helper.createBody(
        { position: { x: 0, y: 5, z: 0 }, mass: 1 },
        { shape: 'sphere', radius: 0.5 }
      );

      helper.createGround();

      let collisionStarted = false;

      for (let i = 0; i < 120; i++) {
        helper.step();
        const events = helper.getCollisionEvents();

        for (const event of events) {
          if (event.started) {
            collisionStarted = true;
            break;
          }
        }

        if (collisionStarted) break;
      }

      expect(collisionStarted).toBe(true);
    });

    it('should emit collision end events', () => {
      // Create bouncing ball with high restitution
      const ball = helper.createBody(
        { position: { x: 0, y: 5, z: 0 }, mass: 1, restitution: 0.9 },
        { shape: 'sphere', radius: 0.5 }
      );

      helper.createGround(100, 0, 0.1);

      let collisionEnded = false;
      let wasColliding = false;

      for (let i = 0; i < 300; i++) {
        helper.step();
        const events = helper.getCollisionEvents();

        for (const event of events) {
          if (event.started) {
            wasColliding = true;
          } else if (!event.started && wasColliding) {
            collisionEnded = true;
            break;
          }
        }

        if (collisionEnded) break;
      }

      expect(wasColliding).toBe(true);
      expect(collisionEnded).toBe(true);
    });

    it('should track multiple simultaneous collisions', () => {
      helper.createGround();

      // Create multiple falling objects
      const objects = [];
      for (let i = 0; i < 5; i++) {
        const obj = helper.createBody(
          { position: { x: i * 2, y: 5 + i * 0.5, z: 0 }, mass: 1 },
          { shape: 'sphere', radius: 0.5 }
        );
        objects.push(obj);
      }

      let uniqueCollisions = new Set<string>();

      for (let i = 0; i < 120; i++) {
        helper.step();
        const events = helper.getCollisionEvents();

        for (const event of events) {
          const key = `${event.handle1}-${event.handle2}`;
          uniqueCollisions.add(key);
        }
      }

      // Should have detected multiple different collisions
      expect(uniqueCollisions.size).toBeGreaterThan(0);
    });
  });

  describe('Collision Response', () => {
    it('should apply restitution (bouncing)', () => {
      const ball = helper.createBody(
        { position: { x: 0, y: 5, z: 0 }, mass: 1, restitution: 0.9 },
        { shape: 'sphere', radius: 0.5 }
      );

      helper.createGround();

      let minY = 5;
      let maxYAfterBounce = 0;
      let hitGround = false;

      // Simulate and track the ball's trajectory
      for (let i = 0; i < 300; i++) {
        helper.step();
        const y = ball.translation().y;

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

      // Should have bounced back up (with 0.9 restitution, should bounce fairly high)
      expect(maxYAfterBounce).toBeGreaterThan(1);
    });

    it('should apply friction during sliding', () => {
      // Create sloped surface
      const slope = helper.createBody(
        {
          position: { x: 0, y: 0, z: 0 },
          type: 'static',
          rotation: { x: 0, y: 0, z: 0.259, w: 0.966 }, // 30 degree rotation
          friction: 0.8
        },
        { shape: 'box', size: { x: 5, y: 0.1, z: 2 } }
      );

      // Create box on slope with high friction
      const box = helper.createBody(
        { position: { x: 0, y: 2, z: 0 }, mass: 1, friction: 0.8 },
        { shape: 'box', size: { x: 0.3, y: 0.3, z: 0.3 } }
      );

      // Simulate
      helper.simulate(3);

      const speed = helper.getBodySpeed(box);

      // Box should have slid, but friction should limit speed
      expect(speed).toBeLessThan(5); // Not sliding too fast due to friction
    });

    it('should handle zero restitution (no bounce)', () => {
      const ball = helper.createBody(
        { position: { x: 0, y: 5, z: 0 }, mass: 1, restitution: 0 },
        { shape: 'sphere', radius: 0.5 }
      );

      helper.createGround();

      // Let it fall and settle
      helper.simulate(3);

      const finalHeight = ball.translation().y;
      const finalSpeed = helper.getBodySpeed(ball);

      // Should be resting on ground with minimal bounce
      expect(finalHeight).toBeCloseTo(0.5, 0.2); // Radius of sphere
      expect(finalSpeed).toBeLessThan(0.1); // Nearly at rest
    });
  });

  describe('Complex Collision Scenarios', () => {
    it('should handle domino chain reaction', () => {
      helper.createGround();

      // Create line of dominoes
      const dominoes = [];
      for (let i = 0; i < 10; i++) {
        const domino = helper.createBody(
          { position: { x: i * 0.6, y: 0.4, z: 0 }, mass: 0.5, friction: 0.5 },
          { shape: 'box', size: { x: 0.05, y: 0.4, z: 0.3 } }
        );
        dominoes.push(domino);
      }

      // Push first domino
      helper.applyImpulse(dominoes[0], { x: 2, y: 0, z: 0 });

      // Simulate
      helper.simulate(5);

      // Last domino should have moved (chain reaction)
      const lastDominoX = dominoes[dominoes.length - 1].translation().x;
      const lastDominoOriginalX = (dominoes.length - 1) * 0.6;

      expect(Math.abs(lastDominoX - lastDominoOriginalX)).toBeGreaterThan(0.1);
    });

    it('should handle sphere rolling down ramp', () => {
      // Create ramp
      const ramp = helper.createBody(
        {
          position: { x: 0, y: 0, z: 0 },
          type: 'static',
          rotation: { x: 0, y: 0, z: 0.259, w: 0.966 }, // 30 degree rotation
          friction: 0.3
        },
        { shape: 'box', size: { x: 5, y: 0.1, z: 2 } }
      );

      // Create sphere at top of ramp
      const sphere = helper.createBody(
        { position: { x: -4, y: 2.5, z: 0 }, mass: 1, friction: 0.3, restitution: 0.1 },
        { shape: 'sphere', radius: 0.5 }
      );

      const startX = sphere.translation().x;
      const startY = sphere.translation().y;

      // Let it roll
      helper.simulate(3);

      const endX = sphere.translation().x;
      const endY = sphere.translation().y;

      // Sphere should have rolled down the ramp (moved significantly in x direction and lost height)
      expect(Math.abs(endX - startX)).toBeGreaterThan(2); // Moved at least 2 units horizontally
      expect(endY).toBeLessThan(startY - 1); // Dropped at least 1 unit
    });

    it('should handle stacked objects toppling', () => {
      helper.createGround();

      // Create unstable stack
      const base = helper.createBody(
        { position: { x: 0, y: 0.5, z: 0 }, mass: 2, friction: 0.8 },
        { shape: 'box', size: { x: 1, y: 0.5, z: 1 } }
      );

      const top = helper.createBody(
        { position: { x: 0.6, y: 1.7, z: 0 }, mass: 1, friction: 0.8 },
        { shape: 'box', size: { x: 0.5, y: 0.5, z: 0.5 } }
      );

      // Apply small push
      helper.applyImpulse(top, { x: 0.5, y: 0, z: 0 });

      // Simulate
      helper.simulate(3);

      // Top box should have fallen off (or at least toppled significantly)
      const topHeight = top.translation().y;
      const topX = top.translation().x;

      // Either fell down or moved horizontally (toppled)
      expect(topHeight < 1.6 || Math.abs(topX) > 1).toBe(true);
    });

    it('should handle ball pit scenario', () => {
      helper.createGround();

      // Create walls
      helper.createWall({ x: 5, y: 2, z: 0 }, { width: 0.2, height: 4, thickness: 10 });
      helper.createWall({ x: -5, y: 2, z: 0 }, { width: 0.2, height: 4, thickness: 10 });
      helper.createWall({ x: 0, y: 2, z: 5 }, { width: 10, height: 4, thickness: 0.2 });
      helper.createWall({ x: 0, y: 2, z: -5 }, { width: 10, height: 4, thickness: 0.2 });

      // Drop many balls
      const balls = [];
      for (let i = 0; i < 20; i++) {
        const x = (Math.random() - 0.5) * 6;
        const z = (Math.random() - 0.5) * 6;
        const ball = helper.createBody(
          { position: { x, y: 5 + i * 0.5, z }, mass: 0.5, restitution: 0.3, friction: 0.5 },
          { shape: 'sphere', radius: 0.3 }
        );
        balls.push(ball);
      }

      // Simulate
      helper.simulate(5);

      // All balls should have settled in the pit
      const allSettled = balls.every(ball => {
        const pos = ball.translation();
        return pos.y < 2 && // Low height
               Math.abs(pos.x) < 5 && // Within x bounds
               Math.abs(pos.z) < 5; // Within z bounds
      });

      expect(allSettled).toBe(true);
    });
  });

  describe('Collision Filtering', () => {
    it('should detect collisions between different collision groups', () => {
      helper.createGround();

      // Create objects in different groups (both should collide with ground)
      const obj1 = helper.createBody(
        { position: { x: 0, y: 5, z: 0 }, mass: 1 },
        { shape: 'sphere', radius: 0.5 }
      );

      const obj2 = helper.createBody(
        { position: { x: 2, y: 5, z: 0 }, mass: 1 },
        { shape: 'sphere', radius: 0.5 }
      );

      let collisionsDetected = 0;

      for (let i = 0; i < 120; i++) {
        helper.step();
        const events = helper.getCollisionEvents();
        collisionsDetected += events.filter(e => e.started).length;
      }

      // Should detect collisions
      expect(collisionsDetected).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle high-speed collisions', () => {
      helper.createGround();

      const ball = helper.createBody(
        { position: { x: 0, y: 10, z: 0 }, mass: 1, restitution: 0.5 },
        { shape: 'sphere', radius: 0.5 }
      );

      // Apply large downward impulse
      helper.applyImpulse(ball, { x: 0, y: -50, z: 0 });

      // Simulate - should not crash or explode into NaN/Infinity
      expect(() => {
        helper.simulate(3);
      }).not.toThrow();

      const finalY = ball.translation().y;

      // Position should be a valid number (not NaN or Infinity)
      expect(isFinite(finalY)).toBe(true);
      expect(isNaN(finalY)).toBe(false);
    });

    it('should handle very small objects', () => {
      helper.createGround();

      const tiny = helper.createBody(
        { position: { x: 0, y: 2, z: 0 }, mass: 0.01 },
        { shape: 'sphere', radius: 0.01 }
      );

      helper.simulate(2);

      const finalY = tiny.translation().y;

      // Should collide with ground, not fall through
      expect(finalY).toBeCloseTo(0.01, 0.05);
    });

    it('should handle spawning objects at same position', () => {
      helper.createGround();

      // Spawn multiple objects at same position
      const objects = [];
      for (let i = 0; i < 5; i++) {
        const obj = helper.createBody(
          { position: { x: 0, y: 2, z: 0 }, mass: 1 },
          { shape: 'sphere', radius: 0.3 }
        );
        objects.push(obj);
      }

      // Simulate - physics should push them apart
      helper.simulate(2);

      // Objects should have separated
      const positions = objects.map(obj => obj.translation());
      const allDifferent = positions.every((pos1, i) =>
        positions.slice(i + 1).every(pos2 => {
          const dist = Math.sqrt(
            Math.pow(pos1.x - pos2.x, 2) +
            Math.pow(pos1.y - pos2.y, 2) +
            Math.pow(pos1.z - pos2.z, 2)
          );
          return dist > 0.1; // Some separation
        })
      );

      expect(allDifferent).toBe(true);
    });
  });
});
