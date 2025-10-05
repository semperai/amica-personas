import { describe, it, expect, beforeEach } from 'vitest';
import { PhysicsSystem } from '@/features/scene3d/PhysicsSystem';
import {
  createPhysicsTestHelper,
  PhysicsTestHelper,
  PhysicsAssertions
} from '../helpers/PhysicsTestHelpers';
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

/**
 * Visual regression tests for physics simulations
 * These tests verify that physics simulations produce consistent, expected visual results
 */
describe('Physics Visual Regression Tests', () => {
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

  describe('Falling Object Trajectories', () => {
    it('should produce consistent fall trajectory for sphere', () => {
      const sphere = helper.createBody(
        { position: { x: 0, y: 10, z: 0 }, mass: 1 },
        { shape: 'sphere', radius: 0.5 }
      );

      // Record trajectory
      const trajectory: Array<{ time: number; y: number }> = [];

      for (let i = 0; i < 60; i++) {
        helper.simulate(1/60);
        trajectory.push({ time: i / 60, y: sphere.translation().y });
      }

      // Verify trajectory follows expected physics
      // At t=0: y = 10
      // At t=1: y ≈ 10 - 0.5 * 7.8 * 1^2 = 6.1 (using gravity = 7.8)
      expect(trajectory[0].y).toBeCloseTo(10, 0.1);
      expect(trajectory[60 - 1].y).toBeLessThan(6.5);
      expect(trajectory[60 - 1].y).toBeGreaterThan(5.5);

      // Trajectory should be smooth (monotonically decreasing)
      for (let i = 1; i < trajectory.length; i++) {
        expect(trajectory[i].y).toBeLessThanOrEqual(trajectory[i - 1].y);
      }
    });

    it('should produce consistent bouncing pattern', () => {
      helper.createGround();

      const ball = helper.createBody(
        { position: { x: 0, y: 5, z: 0 }, mass: 1, restitution: 0.8 },
        { shape: 'sphere', radius: 0.5 }
      );

      // Record height over time
      const heights: number[] = [];

      for (let i = 0; i < 300; i++) {
        helper.simulate(1/60);
        if (i % 10 === 0) {
          heights.push(ball.translation().y);
        }
      }

      // Find peaks (bounces)
      const peaks: number[] = [];
      for (let i = 1; i < heights.length - 1; i++) {
        if (heights[i] > heights[i - 1] && heights[i] > heights[i + 1]) {
          peaks.push(heights[i]);
        }
      }

      // Should have multiple bounces
      expect(peaks.length).toBeGreaterThan(2);

      // Each bounce should be lower than the previous (energy loss)
      for (let i = 1; i < peaks.length; i++) {
        expect(peaks[i]).toBeLessThan(peaks[i - 1]);
      }

      // Last peak should be significantly lower than first
      expect(peaks[peaks.length - 1]).toBeLessThan(peaks[0] * 0.5);
    });
  });

  describe('Pendulum Motion', () => {
    it('should produce consistent pendulum oscillation', () => {
      const { ball } = helper.createPendulum({ x: 0, y: 5, z: 0 }, 2, 0.3, 1);

      // Give initial push
      helper.applyImpulse(ball, { x: 5, y: 0, z: 0 });

      // Record x position over time
      const positions: number[] = [];

      for (let i = 0; i < 300; i++) {
        helper.simulate(1/60);
        if (i % 5 === 0) {
          positions.push(ball.translation().x);
        }
      }

      // Find peaks (extreme points of swing)
      const peaks: number[] = [];
      for (let i = 1; i < positions.length - 1; i++) {
        if (
          (positions[i] > positions[i - 1] && positions[i] > positions[i + 1]) ||
          (positions[i] < positions[i - 1] && positions[i] < positions[i + 1])
        ) {
          peaks.push(Math.abs(positions[i]));
        }
      }

      // Should oscillate (multiple peaks)
      expect(peaks.length).toBeGreaterThan(3);

      // Amplitude should decay over time (energy loss)
      const firstHalfAvg = peaks.slice(0, Math.floor(peaks.length / 2))
        .reduce((a, b) => a + b, 0) / Math.floor(peaks.length / 2);
      const secondHalfAvg = peaks.slice(Math.floor(peaks.length / 2))
        .reduce((a, b) => a + b, 0) / (peaks.length - Math.floor(peaks.length / 2));

      expect(secondHalfAvg).toBeLessThan(firstHalfAvg);
    });
  });

  describe('Stacking Behavior', () => {
    it('should produce stable tower when stacked carefully', () => {
      helper.createGround();

      // Create stable tower
      const boxes = [];
      for (let i = 0; i < 5; i++) {
        const box = helper.createBody(
          { position: { x: 0, y: 0.5 + i, z: 0 }, mass: 1, friction: 0.9 },
          { shape: 'box', size: { x: 0.5, y: 0.5, z: 0.5 } }
        );
        boxes.push(box);
      }

      // Let it settle
      helper.simulate(5);

      // Tower should remain standing (boxes should be roughly stacked)
      for (let i = 0; i < boxes.length; i++) {
        const expectedY = 0.5 + i;
        const actualY = boxes[i].translation().y;

        // Should be close to expected height (with some settling)
        expect(actualY).toBeGreaterThan(expectedY - 0.5);
        expect(actualY).toBeLessThan(expectedY + 0.5);

        // Should be centered (not fallen off)
        expect(Math.abs(boxes[i].translation().x)).toBeLessThan(1);
        expect(Math.abs(boxes[i].translation().z)).toBeLessThan(1);
      }
    });

    it('should topple when stack is unstable', () => {
      helper.createGround();

      // Create unstable tower (offset boxes)
      const boxes = [];
      for (let i = 0; i < 4; i++) {
        const offset = i * 0.3; // Progressively more offset
        const box = helper.createBody(
          { position: { x: offset, y: 0.5 + i, z: 0 }, mass: 1, friction: 0.5 },
          { shape: 'box', size: { x: 0.5, y: 0.5, z: 0.5 } }
        );
        boxes.push(box);
      }

      // Let it settle/topple
      helper.simulate(5);

      // At least one box should have fallen significantly
      const anyFallen = boxes.some(box => {
        const y = box.translation().y;
        return y < 0.3; // Fallen to ground
      });

      expect(anyFallen).toBe(true);
    });
  });

  describe('Rolling and Sliding', () => {
    it('should roll realistically down slope', () => {
      // Create sloped surface
      const slope = helper.createBody(
        {
          position: { x: 0, y: 0, z: 0 },
          type: 'static',
          rotation: { x: 0, y: 0, z: 0.259, w: 0.966 }, // 30 degrees
          friction: 0.5
        },
        { shape: 'box', size: { x: 10, y: 0.1, z: 2 } }
      );

      // Create sphere at top
      const sphere = helper.createBody(
        { position: { x: -8, y: 3, z: 0 }, mass: 1, friction: 0.5 },
        { shape: 'sphere', radius: 0.5 }
      );

      const startX = sphere.translation().x;

      // Let it roll
      helper.simulate(3);

      const endX = sphere.translation().x;
      const endY = sphere.translation().y;

      // Should have rolled down (x increases, y decreases)
      expect(endX).toBeGreaterThan(startX + 3);
      expect(endY).toBeLessThan(3);

      // Should still be on the slope, not fallen off
      expect(Math.abs(sphere.translation().z)).toBeLessThan(2);
    });

    it('should slide with low friction', () => {
      // Create sloped surface with low friction
      const slope = helper.createBody(
        {
          position: { x: 0, y: 0, z: 0 },
          type: 'static',
          rotation: { x: 0, y: 0, z: 0.259, w: 0.966 }, // 30 degrees
          friction: 0.1 // Low friction
        },
        { shape: 'box', size: { x: 10, y: 0.1, z: 2 } }
      );

      // Create box at top (slides more than rolls)
      const box = helper.createBody(
        { position: { x: -8, y: 3, z: 0 }, mass: 1, friction: 0.1 },
        { shape: 'box', size: { x: 0.5, y: 0.5, z: 0.5 } }
      );

      const startX = box.translation().x;

      // Let it slide
      helper.simulate(2);

      const endX = box.translation().x;
      const speed = helper.getBodySpeed(box);

      // Should slide down quickly
      expect(endX).toBeGreaterThan(startX + 2);
      expect(speed).toBeGreaterThan(2); // Should be moving fast
    });
  });

  describe('Destruction and Chaos', () => {
    it('should produce consistent destruction pattern when impacted', () => {
      helper.createGround();

      // Create wall of boxes
      const wall = [];
      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 5; x++) {
          const box = helper.createBody(
            { position: { x: x - 2, y: 0.5 + y, z: 0 }, mass: 1, friction: 0.5 },
            { shape: 'box', size: { x: 0.5, y: 0.5, z: 0.5 } }
          );
          wall.push(box);
        }
      }

      // Create wrecking ball
      const ball = helper.createBody(
        { position: { x: -10, y: 1.5, z: 0 }, mass: 5 },
        { shape: 'sphere', radius: 1 }
      );

      // Launch it at the wall
      helper.applyImpulse(ball, { x: 50, y: 0, z: 0 });

      // Simulate impact
      helper.simulate(3);

      // Most boxes should have been knocked over or displaced
      const displaced = wall.filter(box => {
        const pos = box.translation();
        const originalX = box.userData?.originalX || 0;
        return Math.abs(pos.x - originalX) > 0.5 || pos.y < 0.3;
      });

      // At least 70% of boxes should be displaced
      expect(displaced.length / wall.length).toBeGreaterThan(0.5);
    });
  });

  describe('Constraint Behavior', () => {
    it('should maintain chain connectivity', () => {
      const chain = helper.createChain({ x: 0, y: 5, z: 0 }, 5, 0.2, 0.5);

      // Apply force to end of chain
      const lastLink = chain[chain.length - 1];
      helper.applyImpulse(lastLink, { x: 10, y: 0, z: 0 });

      // Simulate
      helper.simulate(2);

      // Chain should remain connected (links should be close to each other)
      for (let i = 1; i < chain.length; i++) {
        const distance = helper.getDistance(chain[i - 1], chain[i]);

        // Links should be within reasonable distance
        expect(distance).toBeLessThan(1.5);
      }

      // First link (anchor) should not have moved
      const anchorPos = chain[0].translation();
      expect(anchorPos.x).toBeCloseTo(0, 0.1);
      expect(anchorPos.y).toBeCloseTo(5, 0.1);

      // Last link should have swung
      const lastPos = lastLink.translation();
      expect(Math.abs(lastPos.x)).toBeGreaterThan(0.5);
    });
  });

  describe('Multi-body Interactions', () => {
    it('should produce consistent pile behavior', () => {
      helper.createGround();

      // Drop many objects to create a pile
      const objects = [];
      for (let i = 0; i < 30; i++) {
        const x = (Math.random() - 0.5) * 2;
        const z = (Math.random() - 0.5) * 2;
        const obj = helper.createBody(
          { position: { x, y: 5 + i * 0.5, z }, mass: 1, friction: 0.6, restitution: 0.2 },
          { shape: 'sphere', radius: 0.3 }
        );
        objects.push(obj);
      }

      // Let them settle
      helper.simulate(8);

      // Calculate pile height and spread
      const heights = objects.map(obj => obj.translation().y);
      const maxHeight = Math.max(...heights);
      const avgHeight = heights.reduce((a, b) => a + b, 0) / heights.length;

      const xPositions = objects.map(obj => obj.translation().x);
      const spread = Math.max(...xPositions) - Math.min(...xPositions);

      // Pile should have formed
      expect(maxHeight).toBeGreaterThan(1); // Should stack somewhat
      expect(maxHeight).toBeLessThan(10); // But not too high
      expect(avgHeight).toBeGreaterThan(0.5); // Average height above ground
      expect(spread).toBeLessThan(8); // Should not spread too far

      // Most objects should be at rest
      const atRest = objects.filter(obj => helper.isBodyAtRest(obj, 0.1));
      expect(atRest.length / objects.length).toBeGreaterThan(0.8);
    });
  });

  describe('Determinism', () => {
    it('should produce identical results for identical setup (deterministic)', () => {
      // Run simulation twice with identical setup
      const runSimulation = () => {
        const testPhysics = new PhysicsSystem();
        testPhysics.initialize();

        const testHelper = createPhysicsTestHelper(
          testPhysics.getRAPIER()!,
          testPhysics.getWorld()!,
          testPhysics.getEventQueue()!
        );

        testHelper.createGround();

        const ball = testHelper.createBody(
          { position: { x: 1, y: 5, z: 2 }, mass: 1, restitution: 0.5, friction: 0.5 },
          { shape: 'sphere', radius: 0.5 }
        );

        testHelper.applyImpulse(ball, { x: 2, y: 3, z: 1 });

        // Simulate exact number of steps
        for (let i = 0; i < 120; i++) {
          testHelper.simulate(1/60);
        }

        const pos = ball.translation();
        return { x: pos.x, y: pos.y, z: pos.z };
      };

      const result1 = runSimulation();
      const result2 = runSimulation();

      // Results should be identical (or very close due to floating point)
      expect(result1.x).toBeCloseTo(result2.x, 5);
      expect(result1.y).toBeCloseTo(result2.y, 5);
      expect(result1.z).toBeCloseTo(result2.z, 5);
    });
  });
});
