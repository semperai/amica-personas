class Scenario {
  /*
   * Description: Physics Playground
   * Version: 1.0
   *
   * This scenario demonstrates Ammo.js physics integration:
   * - Falling objects of various shapes (spheres, boxes, cylinders)
   * - Stacking blocks
   * - Pendulum simulation
   * - Domino chain reaction
   * - Interactive ragdoll-like constraints
   */
  constructor(ctx) {
    console.log('[PhysicsPlayground] Initializing scenario');
    this.$ = ctx.scope;
    this.THREE = ctx.THREE;
    this.config = ctx.config;

    // Physics state
    this.rigidBodies = [];
    this.tmpTrans = null;

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

    const Ammo = this.$.ammo;
    if (!Ammo) {
      console.error('[PhysicsPlayground] Ammo.js not available!');
      return;
    }

    this.tmpTrans = new Ammo.btTransform();

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
    const Ammo = this.$.ammo;
    if (!Ammo) return;

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
    // Could add forces or constraints here
  }

  updateDominoesDemo(delta) {
    // Trigger first domino after 2 seconds
    if (this.demoTimer > 2 && this.rigidBodies.length > 0) {
      const firstDomino = this.rigidBodies[0];
      if (firstDomino && firstDomino.userData.physicsBody && !firstDomino.userData.pushed) {
        console.log('[PhysicsPlayground] 🎯 Pushing first domino!');

        const body = firstDomino.userData.physicsBody;
        const impulse = new this.$.ammo.btVector3(3, 0, 0);
        const relativePos = new this.$.ammo.btVector3(0, 0.5, 0);
        body.applyImpulse(impulse, relativePos);

        firstDomino.userData.pushed = true;
      }
    }
  }

  createGround() {
    const Ammo = this.$.ammo;

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

    // Physics ground
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new Ammo.btVector3(0, 0, 0));
    transform.setRotation(new Ammo.btQuaternion(
      -Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)
    ));

    const shape = new Ammo.btBoxShape(new Ammo.btVector3(groundSize / 2, 0.1, groundSize / 2));
    const motionState = new Ammo.btDefaultMotionState(transform);
    const rbInfo = new Ammo.btRigidBodyConstructionInfo(
      0, motionState, shape, new Ammo.btVector3(0, 0, 0)
    );
    const body = new Ammo.btRigidBody(rbInfo);
    body.setFriction(0.8);
    this.$.physicsWorld.addRigidBody(body);

    console.log('[PhysicsPlayground] Ground created');
  }

  createRandomObject(shapeType) {
    const Ammo = this.$.ammo;
    const spawnHeight = 4 + Math.random() * 2;
    const spawnX = (Math.random() - 0.5) * 4;
    const spawnZ = (Math.random() - 0.5) * 4;

    let geometry, shape, size;
    const color = new this.THREE.Color().setHSL(Math.random(), 0.8, 0.5);

    switch (shapeType) {
      case 'sphere': {
        const radius = 0.2 + Math.random() * 0.2;
        geometry = new this.THREE.SphereGeometry(radius, 16, 16);
        shape = new Ammo.btSphereShape(radius);
        size = radius;
        break;
      }
      case 'box': {
        const sizeX = 0.2 + Math.random() * 0.3;
        const sizeY = 0.2 + Math.random() * 0.3;
        const sizeZ = 0.2 + Math.random() * 0.3;
        geometry = new this.THREE.BoxGeometry(sizeX * 2, sizeY * 2, sizeZ * 2);
        shape = new Ammo.btBoxShape(new Ammo.btVector3(sizeX, sizeY, sizeZ));
        size = Math.max(sizeX, sizeY, sizeZ);
        break;
      }
      case 'cylinder': {
        const radius = 0.2 + Math.random() * 0.2;
        const height = 0.4 + Math.random() * 0.4;
        geometry = new this.THREE.CylinderGeometry(radius, radius, height, 16);
        shape = new Ammo.btCylinderShape(new Ammo.btVector3(radius, height / 2, radius));
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
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new Ammo.btVector3(spawnX, spawnHeight, spawnZ));

    const localInertia = new Ammo.btVector3(0, 0, 0);
    shape.calculateLocalInertia(mass, localInertia);

    const motionState = new Ammo.btDefaultMotionState(transform);
    const rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
    const body = new Ammo.btRigidBody(rbInfo);
    body.setFriction(0.5);
    body.setRestitution(0.3);

    this.$.physicsWorld.addRigidBody(body);

    mesh.userData.physicsBody = body;
    this.rigidBodies.push(mesh);
  }

  createStackBlock() {
    const Ammo = this.$.ammo;
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
    const mass = 1;
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new Ammo.btVector3(0, y, 0));

    const shape = new Ammo.btBoxShape(new Ammo.btVector3(blockSize / 2, blockSize / 2, blockSize / 2));
    const localInertia = new Ammo.btVector3(0, 0, 0);
    shape.calculateLocalInertia(mass, localInertia);

    const motionState = new Ammo.btDefaultMotionState(transform);
    const rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
    const body = new Ammo.btRigidBody(rbInfo);
    body.setFriction(0.8);

    this.$.physicsWorld.addRigidBody(body);

    mesh.userData.physicsBody = body;
    this.rigidBodies.push(mesh);

    this.stackHeight++;
  }

  createPendulum() {
    const Ammo = this.$.ammo;
    const pendulumCount = 5;
    const spacing = 0.5;

    for (let i = 0; i < pendulumCount; i++) {
      const x = (i - pendulumCount / 2) * spacing;
      this.createPendulumBall(x, 3, 0);
    }

    console.log('[PhysicsPlayground] Pendulum created with', pendulumCount, 'balls');
  }

  createPendulumBall(x, y, z) {
    const Ammo = this.$.ammo;
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

    // Physics
    const mass = 1;
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new Ammo.btVector3(x, y - 2, z));

    const shape = new Ammo.btSphereShape(radius);
    const localInertia = new Ammo.btVector3(0, 0, 0);
    shape.calculateLocalInertia(mass, localInertia);

    const motionState = new Ammo.btDefaultMotionState(transform);
    const rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
    const body = new Ammo.btRigidBody(rbInfo);

    this.$.physicsWorld.addRigidBody(body);

    // Point-to-point constraint (acts like a rope)
    const pivotInWorld = new Ammo.btVector3(x, y, z);
    const pivotInBody = new Ammo.btVector3(0, 0, 0);
    const constraint = new Ammo.btPoint2PointConstraint(body, pivotInBody);
    this.$.physicsWorld.addConstraint(constraint, false);

    mesh.userData.physicsBody = body;
    this.rigidBodies.push(mesh);
    this.pendulumBodies.push({ mesh, body, constraint });

    // Give first ball initial impulse
    if (this.pendulumBodies.length === 1) {
      setTimeout(() => {
        const impulse = new Ammo.btVector3(-5, 0, 0);
        const relativePos = new Ammo.btVector3(0, 0, 0);
        body.applyImpulse(impulse, relativePos);
      }, 500);
    }
  }

  createDominoChain() {
    const Ammo = this.$.ammo;
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
    const Ammo = this.$.ammo;

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
    const mass = 0.5;
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new Ammo.btVector3(x, y, z));

    const shape = new Ammo.btBoxShape(new Ammo.btVector3(width / 2, height / 2, depth / 2));
    const localInertia = new Ammo.btVector3(0, 0, 0);
    shape.calculateLocalInertia(mass, localInertia);

    const motionState = new Ammo.btDefaultMotionState(transform);
    const rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
    const body = new Ammo.btRigidBody(rbInfo);
    body.setFriction(0.5);
    body.setRestitution(0.1);

    this.$.physicsWorld.addRigidBody(body);

    mesh.userData.physicsBody = body;
    this.rigidBodies.push(mesh);
  }

  updateRigidBodies() {
    const Ammo = this.$.ammo;

    for (let i = 0; i < this.rigidBodies.length; i++) {
      const mesh = this.rigidBodies[i];
      const body = mesh.userData.physicsBody;

      if (!body) continue;

      const ms = body.getMotionState();
      if (ms) {
        ms.getWorldTransform(this.tmpTrans);
        const p = this.tmpTrans.getOrigin();
        const q = this.tmpTrans.getRotation();
        mesh.position.set(p.x(), p.y(), p.z());
        mesh.quaternion.set(q.x(), q.y(), q.z(), q.w());
      }
    }
  }

  cleanupFallenObjects() {
    for (let i = this.rigidBodies.length - 1; i >= 0; i--) {
      const mesh = this.rigidBodies[i];
      if (mesh.position.y < -10) {
        this.$.scene.remove(mesh);
        if (mesh.userData.physicsBody) {
          this.$.physicsWorld.removeRigidBody(mesh.userData.physicsBody);
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
        this.$.physicsWorld.removeRigidBody(mesh.userData.physicsBody);
      }
    }

    // Remove constraints
    for (const pendulum of this.pendulumBodies) {
      if (pendulum.constraint) {
        this.$.physicsWorld.removeConstraint(pendulum.constraint);
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
