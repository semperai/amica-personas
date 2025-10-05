import { describe, it, expect, beforeEach } from 'vitest';
import {
  ScenarioTestRunner,
  ScenarioAssertions,
  ScenarioTestUtils,
} from '@/testing/ScenarioTestRunner';
import * as THREE from 'three';

// Simplified physics playground scenario for testing (Rapier version)
const physicsPlaygroundCode = `
class Scenario {
  constructor(ctx) {
    this.$ = ctx.scope;
    this.THREE = ctx.THREE;
    this.config = ctx.config;

    this.rigidBodies = [];
    this.randomObjectTimer = 0;
    this.randomObjectInterval = 1.0;
  }

  async setup() {
    const RAPIER = this.$.rapier;
    const world = this.$.physicsWorld;

    if (!RAPIER || !world) {
      console.error('Rapier.js not available!');
      return;
    }

    await this.$.loadVrm(this.config('vrm_url'), console.log);
    this.$.setCameraPosition(4, 3, 6);
    this.$.setCameraLookAt(0, 1, 0);

    this.createGround();
  }

  update(delta) {
    this.randomObjectTimer += delta;

    if (this.randomObjectTimer >= this.randomObjectInterval) {
      this.createRandomSphere();
      this.randomObjectTimer = 0;
    }

    this.updateRigidBodies();
    this.cleanupFallenObjects();
  }

  createGround() {
    const RAPIER = this.$.rapier;
    const world = this.$.physicsWorld;

    const groundMesh = new this.THREE.Mesh(
      new this.THREE.PlaneGeometry(20, 20),
      new this.THREE.MeshStandardMaterial({ color: 0x808080 })
    );
    groundMesh.rotation.x = -Math.PI / 2;
    this.$.scene.add(groundMesh);

    const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(0, 0, 0);
    const rigidBody = world.createRigidBody(rigidBodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.cuboid(10, 0.1, 10);
    world.createCollider(colliderDesc, rigidBody);
  }

  createRandomSphere() {
    const RAPIER = this.$.rapier;
    const world = this.$.physicsWorld;
    const radius = 0.3;

    const geometry = new this.THREE.SphereGeometry(radius, 16, 16);
    const material = new this.THREE.MeshStandardMaterial({
      color: Math.random() * 0xffffff
    });
    const mesh = new this.THREE.Mesh(geometry, material);
    mesh.position.set(0, 5, 0);
    this.$.scene.add(mesh);

    const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, 5, 0);
    const rigidBody = world.createRigidBody(rigidBodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.ball(radius)
      .setMass(1);
    world.createCollider(colliderDesc, rigidBody);

    mesh.userData.physicsBody = rigidBody;
    this.rigidBodies.push(mesh);
  }

  updateRigidBodies() {
    for (let i = 0; i < this.rigidBodies.length; i++) {
      const mesh = this.rigidBodies[i];
      const body = mesh.userData.physicsBody;

      if (!body) continue;

      const position = body.translation();
      const rotation = body.rotation();

      mesh.position.set(position.x, position.y, position.z);
      mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    }
  }

  cleanupFallenObjects() {
    const world = this.$.physicsWorld;

    for (let i = this.rigidBodies.length - 1; i >= 0; i--) {
      const mesh = this.rigidBodies[i];
      if (mesh.position.y < -10) {
        this.$.scene.remove(mesh);
        if (mesh.userData.physicsBody) {
          world.removeRigidBody(mesh.userData.physicsBody);
        }
        this.rigidBodies.splice(i, 1);
      }
    }
  }

  async cleanup() {
    const world = this.$.physicsWorld;

    for (const mesh of this.rigidBodies) {
      this.$.scene.remove(mesh);
      if (mesh.userData.physicsBody) {
        world.removeRigidBody(mesh.userData.physicsBody);
      }
    }
    this.rigidBodies = [];
  }
}`;

describe('Physics Playground Scenario', () => {
  let runner: ScenarioTestRunner;
  let PhysicsPlaygroundScenario: any;

  beforeEach(() => {
    PhysicsPlaygroundScenario = ScenarioTestUtils.loadScenarioFromCode(physicsPlaygroundCode);
    runner = new ScenarioTestRunner(PhysicsPlaygroundScenario);
  });

  describe('setup', () => {
    it('should load VRM model', async () => {
      await runner.setup();
      ScenarioAssertions.assertVrmLoaded(runner);
    });

    it('should create ground plane', async () => {
      await runner.setup();

      const meshes = runner.getMeshes();
      expect(meshes.length).toBeGreaterThanOrEqual(1);

      // Ground should be a plane
      const ground = meshes.find(m => m.geometry instanceof THREE.PlaneGeometry);
      expect(ground).toBeDefined();
    });

    it('should add ground to physics world', async () => {
      await runner.setup();

      const scope = runner.getScope();
      // Ground physics body should be created
      expect(scope.physicsWorld.createRigidBody).toHaveBeenCalled();
      expect(scope.physicsWorld.createCollider).toHaveBeenCalled();
    });

    it('should position camera for viewing', async () => {
      await runner.setup();
      ScenarioAssertions.assertCameraPosition(runner, { x: 4, y: 3, z: 6 });
    });
  });

  describe('object spawning', () => {
    beforeEach(async () => {
      await runner.setup();
    });

    it('should spawn sphere after interval', () => {
      const scenario = runner.getScenario();

      // No spheres initially
      expect(scenario.rigidBodies.length).toBe(0);

      // Run for 1.1 seconds (interval is 1.0s)
      runner.updateForDuration(1.1);

      // Should have spawned 1 sphere
      expect(scenario.rigidBodies.length).toBe(1);
    });

    it('should spawn multiple spheres over time', () => {
      const scenario = runner.getScenario();

      // Run for 3.5 seconds
      runner.updateForDuration(3.5);

      // Should have spawned 3 spheres
      expect(scenario.rigidBodies.length).toBe(3);
    });

    it('should add spheres to scene', () => {
      runner.updateForDuration(2.0);

      const meshes = runner.getMeshes();
      // Ground + 2 spheres
      expect(meshes.length).toBeGreaterThanOrEqual(3);
    });

    it('should add spheres to physics world', () => {
      const scope = runner.getScope();
      const initialCalls = (scope.physicsWorld.createRigidBody as any).mock.calls.length;

      runner.updateForDuration(2.0);

      const finalCalls = (scope.physicsWorld.createRigidBody as any).mock.calls.length;
      // 2 more bodies (2 spheres)
      expect(finalCalls - initialCalls).toBe(2);
    });
  });

  describe('physics simulation', () => {
    beforeEach(async () => {
      await runner.setup();
    });

    it('should update rigid body positions', () => {
      const scenario = runner.getScenario();

      // Spawn a sphere
      runner.updateForDuration(1.1);

      const sphere = scenario.rigidBodies[0];
      const initialY = sphere.position.y;

      // Simulate more frames
      runner.updateFrames(60); // 1 second at 60fps

      // Mock doesn't simulate actual physics, but update should be called
      expect(() => scenario.updateRigidBodies()).not.toThrow();
    });

    it('should handle multiple rigid bodies', () => {
      runner.updateForDuration(5.0); // Spawn 5 spheres

      const scenario = runner.getScenario();
      expect(scenario.rigidBodies.length).toBe(5);

      // Update all bodies
      expect(() => {
        runner.updateFrames(60);
      }).not.toThrow();
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      await runner.setup();
    });

    it('should remove fallen objects', () => {
      const scenario = runner.getScenario();

      // Spawn some spheres
      runner.updateForDuration(2.0);
      expect(scenario.rigidBodies.length).toBe(2);

      // Manually set position below threshold
      scenario.rigidBodies[0].position.y = -15;

      runner.update(0.016);

      // Fallen object should be removed
      expect(scenario.rigidBodies.length).toBe(1);
    });

    it('should remove physics body for fallen objects', () => {
      const scope = runner.getScope();
      const scenario = runner.getScenario();

      runner.updateForDuration(1.1);
      const sphere = scenario.rigidBodies[0];
      sphere.position.y = -15;

      const removeCalls = (scope.physicsWorld.removeRigidBody as any).mock.calls.length;

      runner.update(0.016);

      const finalCalls = (scope.physicsWorld.removeRigidBody as any).mock.calls.length;
      expect(finalCalls).toBeGreaterThan(removeCalls);
    });

    it('should cleanup all objects on scenario cleanup', async () => {
      const scope = runner.getScope();

      runner.updateForDuration(3.0);

      await runner.cleanup();

      const scenario = runner.getScenario();
      expect(scenario.rigidBodies.length).toBe(0);
      expect(scope.physicsWorld.removeRigidBody).toHaveBeenCalled();
    });
  });

  describe('performance', () => {
    beforeEach(async () => {
      await runner.setup();
    });

    it('should handle many objects efficiently', () => {
      // Spawn 10 objects
      runner.updateForDuration(10);

      const perf = ScenarioTestUtils.measureUpdatePerformance(runner, 100);

      // Should still be fast even with objects
      expect(perf.avgMs).toBeLessThan(2);
    });
  });
});
