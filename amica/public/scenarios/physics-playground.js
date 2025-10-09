class Scenario {
  /*
   * Description: Physics Playground
   * Version: 2.0 (Rapier.js)
   *
   * This scenario demonstrates Rapier.js physics integration:
   * - Falling objects of various shapes (spheres, boxes, cylinders)
   * - Stacking blocks
   * - Pendulum simulation
   * - Domino chain reaction
   */
  constructor(ctx) {
    console.log('[PhysicsPlayground] Initializing scenario');
    this.$ = ctx.scope;
    this.THREE = ctx.THREE;
    this.config = ctx.config;

    // Physics state
    this.rigidBodies = [];

    // Spawn timers
    this.randomObjectTimer = 0;
    this.randomObjectInterval = 1.0; // Spawn object every second

    // Demo mode
    this.demoMode = 'falling'; // falling, stacking, pendulum, dominoes
    this.demoTimer = 0;
    this.demoDuration = 15; // 15 seconds per demo
    this.demoIndex = 0;
    this.demos = ['falling', 'stacking', 'pendulum', 'dominoes'];

    // Demo-specific state
    this.stackHeight = 0;
    this.maxStackHeight = 5;
    this.pendulumBodies = [];
    this.dominoSpawned = false;
  }

  async setup() {
    console.log('[PhysicsPlayground] Setting up scene');

    const RAPIER = this.$.rapier;
    const world = this.$.physicsWorld;

    if (!RAPIER || !world) {
      console.error('[PhysicsPlayground] Rapier.js not available!');
      return;
    }

    // Load VRM model
    await this.$.loadVrm(
      this.config('vrm_url'),
      (progress) => console.log(`[PhysicsPlayground] Loading VRM: ${progress}`)
    );

    // Position camera for better view
    this.$.setCameraPosition(4, 3, 6);
    this.$.setCameraLookAt(0, 1, 0);

    // Create ground plane
    this.createGround();

    console.log('[PhysicsPlayground] Setup complete - physics playground active!');
    console.log(`[PhysicsPlayground] Demo mode: ${this.demoMode}`);
  }

  update(delta) {
    const RAPIER = this.$.rapier;
    const world = this.$.physicsWorld;
    if (!RAPIER || !world) return;

    // Demo switching
    this.demoTimer += delta;
    if (this.demoTimer >= this.demoDuration) {
      this.switchDemo();
      this.demoTimer = 0;
    }

    // Update demo
    switch (this.demoMode) {
      case 'falling':
        this.updateFallingDemo(delta);
        break;
      case 'stacking':
        this.updateStackingDemo(delta);
        break;
      case 'pendulum':
        this.updatePendulumDemo(delta);
        break;
      case 'dominoes':
        this.updateDominoesDemo(delta);
        break;
    }

    // Update all rigid bodies
    this.updateRigidBodies();

    // Clean up objects that fell too far
    this.cleanupFallenObjects();
  }

  switchDemo() {
    // Clear current demo
    this.clearAllPhysicsObjects();

    // Switch to next demo
    this.demoIndex = (this.demoIndex + 1) % this.demos.length;
    this.demoMode = this.demos[this.demoIndex];

    console.log(`[PhysicsPlayground] 🎮 Switching to demo: ${this.demoMode}`);

    // Reset demo-specific state
    this.stackHeight = 0;
    this.dominoSpawned = false;
    this.randomObjectTimer = 0;

    // Setup new demo
    if (this.demoMode === 'pendulum') {
      this.createPendulum();
    } else if (this.demoMode === 'dominoes') {
      this.createDominoChain();
      this.dominoSpawned = true;
    }
  }

  updateFallingDemo(delta) {
    // Spawn random falling objects
    this.randomObjectTimer += delta;

    if (this.randomObjectTimer >= this.randomObjectInterval) {
      const shapes = ['sphere', 'box', 'cylinder'];
      const shape = shapes[Math.floor(Math.random() * shapes.length)];
      this.createRandomObject(shape);
      this.randomObjectTimer = 0;
    }
  }

  updateStackingDemo(delta) {
    // Build a tower of blocks
    this.randomObjectTimer += delta;

    if (this.randomObjectTimer >= 0.8 && this.stackHeight < this.maxStackHeight) {
      this.createStackBlock();
      this.randomObjectTimer = 0;
    }
  }

  updatePendulumDemo(delta) {
    // Pendulum updates happen in physics automatically
  }

  updateDominoesDemo(delta) {
    // Trigger first domino after 2 seconds
    if (this.demoTimer > 2 && this.rigidBodies.length > 0) {
      const firstDomino = this.rigidBodies[0];
      if (firstDomino && firstDomino.userData.physicsBody && !firstDomino.userData.pushed) {
        console.log('[PhysicsPlayground] 🎯 Pushing first domino!');

        const body = firstDomino.userData.physicsBody;
        const impulse = { x: 3, y: 0, z: 0 };
        const point = { x: 0, y: 0.5, z: 0 };
        body.applyImpulseAtPoint(impulse, point, true);

        firstDomino.userData.pushed = true;
      }
    }
  }

  createGround() {
    const RAPIER = this.$.rapier;
    const world = this.$.physicsWorld;

    // Visual ground
    const groundSize = 20;
    const groundMesh = new this.THREE.Mesh(
      new this.THREE.PlaneGeometry(groundSize, groundSize),
      new this.THREE.MeshStandardMaterial({
        color: 0x808080,
        roughness: 0.8,
        metalness: 0.2
      })
    );
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    this.$.scene.add(groundMesh);

    // Physics ground (static rigid body)
    const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(0, 0, 0);
    const rigidBody = world.createRigidBody(rigidBodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.cuboid(groundSize / 2, 0.1, groundSize / 2)
      .setFriction(0.8);
    world.createCollider(colliderDesc, rigidBody);

    console.log('[PhysicsPlayground] Ground created');
  }

  createRandomObject(shapeType) {
    const RAPIER = this.$.rapier;
    const world = this.$.physicsWorld;

    const spawnHeight = 4 + Math.random() * 2;
    const spawnX = (Math.random() - 0.5) * 4;
    const spawnZ = (Math.random() - 0.5) * 4;

    let geometry, colliderDesc, size;
    const color = new this.THREE.Color().setHSL(Math.random(), 0.8, 0.5);

    switch (shapeType) {
      case 'sphere': {
        const radius = 0.2 + Math.random() * 0.2;
        geometry = new this.THREE.SphereGeometry(radius, 16, 16);
        colliderDesc = RAPIER.ColliderDesc.ball(radius);
        size = radius;
        break;
      }
      case 'box': {
        const sizeX = 0.2 + Math.random() * 0.3;
        const sizeY = 0.2 + Math.random() * 0.3;
        const sizeZ = 0.2 + Math.random() * 0.3;
        geometry = new this.THREE.BoxGeometry(sizeX * 2, sizeY * 2, sizeZ * 2);
        colliderDesc = RAPIER.ColliderDesc.cuboid(sizeX, sizeY, sizeZ);
        size = Math.max(sizeX, sizeY, sizeZ);
        break;
      }
      case 'cylinder': {
        const radius = 0.2 + Math.random() * 0.2;
        const height = 0.4 + Math.random() * 0.4;
        geometry = new this.THREE.CylinderGeometry(radius, radius, height, 16);
        colliderDesc = RAPIER.ColliderDesc.cylinder(height / 2, radius);
        size = Math.max(radius, height);
        break;
      }
      default:
        return;
    }

    const material = new this.THREE.MeshStandardMaterial({
      color,
      roughness: 0.7,
      metalness: 0.3
    });
    const mesh = new this.THREE.Mesh(geometry, material);
    mesh.position.set(spawnX, spawnHeight, spawnZ);
    mesh.castShadow = true;
    this.$.scene.add(mesh);

    // Physics
    const mass = size * size * size; // Approximate volume
    const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(spawnX, spawnHeight, spawnZ);
    const rigidBody = world.createRigidBody(rigidBodyDesc);

    colliderDesc
      .setMass(mass)
      .setFriction(0.5)
      .setRestitution(0.3);
    world.createCollider(colliderDesc, rigidBody);

    mesh.userData.physicsBody = rigidBody;
    this.rigidBodies.push(mesh);
  }

  createStackBlock() {
    const RAPIER = this.$.rapier;
    const world = this.$.physicsWorld;

    const blockSize = 0.5;
    const y = 0.25 + this.stackHeight * blockSize;

    const geometry = new this.THREE.BoxGeometry(blockSize, blockSize, blockSize);
    const material = new this.THREE.MeshStandardMaterial({
      color: new this.THREE.Color().setHSL(this.stackHeight / this.maxStackHeight, 0.8, 0.5),
      roughness: 0.7,
      metalness: 0.3
    });
    const mesh = new this.THREE.Mesh(geometry, material);
    mesh.position.set(0, y, 0);
    mesh.castShadow = true;
    this.$.scene.add(mesh);

    // Physics
    const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, y, 0);
    const rigidBody = world.createRigidBody(rigidBodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.cuboid(blockSize / 2, blockSize / 2, blockSize / 2)
      .setMass(1)
      .setFriction(0.8);
    world.createCollider(colliderDesc, rigidBody);

    mesh.userData.physicsBody = rigidBody;
    this.rigidBodies.push(mesh);

    this.stackHeight++;
  }

  createPendulum() {
    const pendulumCount = 5;
    const spacing = 0.5;

    for (let i = 0; i < pendulumCount; i++) {
      const x = (i - pendulumCount / 2) * spacing;
      this.createPendulumBall(x, 3, 0);
    }

    console.log('[PhysicsPlayground] Pendulum created with', pendulumCount, 'balls');
  }

  createPendulumBall(x, y, z) {
    const RAPIER = this.$.rapier;
    const world = this.$.physicsWorld;

    const radius = 0.2;

    // Visual
    const geometry = new this.THREE.SphereGeometry(radius, 16, 16);
    const material = new this.THREE.MeshStandardMaterial({
      color: 0xff0000,
      roughness: 0.5,
      metalness: 0.5
    });
    const mesh = new this.THREE.Mesh(geometry, material);
    mesh.position.set(x, y - 2, z); // Hang 2 units down
    mesh.castShadow = true;
    this.$.scene.add(mesh);

    // Physics - Create dynamic body
    const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(x, y - 2, z);
    const rigidBody = world.createRigidBody(rigidBodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.ball(radius)
      .setMass(1);
    world.createCollider(colliderDesc, rigidBody);

    // Create fixed anchor point
    const anchorDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(x, y, z);
    const anchor = world.createRigidBody(anchorDesc);

    // Create ball joint (spherical joint) to simulate rope
    const params = RAPIER.JointData.spherical(
      { x: 0, y: 0, z: 0 },  // anchor point on anchor body
      { x: 0, y: 2, z: 0 }   // attach point on ball (2 units up from center)
    );
    const joint = world.createImpulseJoint(params, anchor, rigidBody, true);

    mesh.userData.physicsBody = rigidBody;
    mesh.userData.anchor = anchor;
    mesh.userData.joint = joint;
    this.rigidBodies.push(mesh);
    this.pendulumBodies.push({ mesh, body: rigidBody, anchor, joint });

    // Give first ball initial impulse
    if (this.pendulumBodies.length === 1) {
      setTimeout(() => {
        const impulse = { x: -5, y: 0, z: 0 };
        const point = { x: 0, y: 0, z: 0 };
        rigidBody.applyImpulseAtPoint(impulse, point, true);
      }, 500);
    }
  }

  createDominoChain() {
    const dominoCount = 15;
    const spacing = 0.6;
    const dominoWidth = 0.1;
    const dominoHeight = 0.8;
    const dominoDepth = 0.4;

    for (let i = 0; i < dominoCount; i++) {
      const x = -3 + i * spacing;
      this.createDomino(x, dominoHeight / 2, 0, dominoWidth, dominoHeight, dominoDepth);
    }

    console.log('[PhysicsPlayground] Domino chain created with', dominoCount, 'dominoes');
  }

  createDomino(x, y, z, width, height, depth) {
    const RAPIER = this.$.rapier;
    const world = this.$.physicsWorld;

    // Visual
    const geometry = new this.THREE.BoxGeometry(width, height, depth);
    const material = new this.THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.7,
      metalness: 0.1
    });
    const mesh = new this.THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    this.$.scene.add(mesh);

    // Physics
    const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(x, y, z);
    const rigidBody = world.createRigidBody(rigidBodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.cuboid(width / 2, height / 2, depth / 2)
      .setMass(0.5)
      .setFriction(0.5)
      .setRestitution(0.1);
    world.createCollider(colliderDesc, rigidBody);

    mesh.userData.physicsBody = rigidBody;
    this.rigidBodies.push(mesh);
  }

  updateRigidBodies() {
    for (let i = 0; i < this.rigidBodies.length; i++) {
      const mesh = this.rigidBodies[i];
      const body = mesh.userData.physicsBody;

      if (!body) continue;

      // Update mesh position and rotation from physics body
      const position = body.translation();
      const rotation = body.rotation();

      mesh.position.set(position.x, position.y, position.z);
      mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    }
  }

  cleanupFallenObjects() {
    for (let i = this.rigidBodies.length - 1; i >= 0; i--) {
      const mesh = this.rigidBodies[i];
      if (mesh.position.y < -10) {
        this.$.scene.remove(mesh);
        if (mesh.userData.physicsBody) {
          this.$.removeRigidBody(mesh.userData.physicsBody);
        }
        // Remove anchor if it exists (for pendulum)
        if (mesh.userData.anchor) {
          this.$.removeRigidBody(mesh.userData.anchor);
        }
        this.rigidBodies.splice(i, 1);
      }
    }
  }

  clearAllPhysicsObjects() {
    // Remove all rigid bodies
    for (const mesh of this.rigidBodies) {
      this.$.scene.remove(mesh);
      if (mesh.userData.physicsBody) {
        this.$.removeRigidBody(mesh.userData.physicsBody);
      }
      // Remove anchor if it exists (for pendulum)
      if (mesh.userData.anchor) {
        this.$.removeRigidBody(mesh.userData.anchor);
      }
    }

    this.rigidBodies = [];
    this.pendulumBodies = [];
  }

  async cleanup() {
    console.log('[PhysicsPlayground] Cleaning up physics objects');
    this.clearAllPhysicsObjects();
    console.log('[PhysicsPlayground] Cleanup complete');
  }
}
