class Scenario {
  /*
   * Description: [Brief description of what this scenario does]
   * Version: 1.0
   * Author: [Your name]
   * Created: [Date]
   *
   * Features:
   * - [Feature 1]
   * - [Feature 2]
   * - [Feature 3]
   */

  constructor(ctx) {
    console.log('[ScenarioName] Initializing...');

    // Core references - DO NOT REMOVE
    this.$ = ctx.scope;           // SceneCoordinator - main API
    this.THREE = ctx.THREE;       // Three.js library
    this.hookManager = ctx.hookManager;  // Hook system (optional)
    this.config = ctx.config;     // Configuration function

    // ============================================
    // YOUR STATE VARIABLES HERE
    // ============================================
    // Example state variables:
    // this.isActive = false;
    // this.timer = 0;
    // this.objects = [];
    // this.lights = [];
  }

  async setup() {
    console.log('[ScenarioName] Running setup...');

    // ============================================
    // LOAD RESOURCES
    // ============================================

    // 1. Load VRM Model
    await this.$.loadVrm(
      this.config('vrm_url'),
      (progress) => console.log(`[ScenarioName] Loading VRM: ${progress}`)
    );

    // 2. Load Room/Environment (optional)
    // await this.$.loadRoom(
    //   '/room/your-room.glb',
    //   new this.THREE.Vector3(0, 0, 0),  // Position
    //   new this.THREE.Euler(0, 0, 0),    // Rotation
    //   new this.THREE.Vector3(1, 1, 1),  // Scale
    //   (progress) => console.log(`[ScenarioName] Loading room: ${progress}`)
    // );

    // 3. Load Splat (optional)
    // await this.$.loadSplat('/splat/your-splat.splat');

    // ============================================
    // SETUP CAMERA
    // ============================================
    this.$.setCameraPosition(0, 1.5, 4);
    this.$.setCameraLookAt(0, 1, 0);

    // ============================================
    // SETUP LIGHTING
    // ============================================
    // Example: Add ambient light
    // const ambientLight = new this.THREE.AmbientLight(0xffffff, 0.5);
    // this.$.addLight(ambientLight);
    // this.lights.push(ambientLight);

    // Example: Add directional light
    // const dirLight = new this.THREE.DirectionalLight(0xffffff, 1);
    // dirLight.position.set(5, 5, 5);
    // this.$.addLight(dirLight);
    // this.lights.push(dirLight);

    // ============================================
    // SETUP PHYSICS (optional)
    // ============================================
    // const Ammo = this.$.ammo;
    // if (Ammo) {
    //   this.tmpTrans = new Ammo.btTransform();
    //   // Setup physics objects here
    // }

    // ============================================
    // REGISTER HOOKS (optional)
    // ============================================
    // if (this.hookManager) {
    //   this.hookIds = [];
    //
    //   const hookId = this.hookManager.register(
    //     'before:llm:request',
    //     (context) => {
    //       console.log('[ScenarioName] LLM request intercepted');
    //       return context;
    //     }
    //   );
    //   this.hookIds.push(hookId);
    // }

    console.log('[ScenarioName] Setup complete!');
  }

  update(delta) {
    // This runs every frame (~60fps)
    // delta = time since last frame in seconds (typically ~0.016s)

    // ============================================
    // YOUR UPDATE LOGIC HERE
    // ============================================

    // Example: Update timer
    // this.timer += delta;

    // Example: Spawn objects periodically
    // if (this.timer >= 1.0) {
    //   this.spawnObject();
    //   this.timer = 0;
    // }

    // Example: Update camera orbit
    // this.orbitAngle += delta * 0.5;
    // const x = Math.cos(this.orbitAngle) * 4;
    // const z = Math.sin(this.orbitAngle) * 4;
    // this.$.setCameraPosition(x, 1.5, z);
    // this.$.setCameraLookAt(0, 1, 0);

    // Example: Update physics
    // this.updatePhysics();

    // Example: Update animations
    // this.updateAnimations(delta);
  }

  // ============================================
  // YOUR CUSTOM METHODS
  // ============================================

  // Example method:
  // spawnObject() {
  //   const geometry = new this.THREE.SphereGeometry(0.3);
  //   const material = new this.THREE.MeshStandardMaterial({
  //     color: Math.random() * 0xffffff
  //   });
  //   const mesh = new this.THREE.Mesh(geometry, material);
  //   mesh.position.set(0, 2, 0);
  //   this.$.scene.add(mesh);
  //   this.objects.push(mesh);
  // }

  // ============================================
  // CLEANUP (optional but recommended)
  // ============================================
  async cleanup() {
    console.log('[ScenarioName] Cleaning up...');

    // Remove lights
    // this.lights.forEach(light => {
    //   this.$.removeLight(light);
    // });
    // this.lights = [];

    // Remove objects
    // this.objects.forEach(obj => {
    //   this.$.scene.remove(obj);
    // });
    // this.objects = [];

    // Unregister hooks
    // if (this.hookManager && this.hookIds) {
    //   this.hookIds.forEach(id => {
    //     this.hookManager.unregister(id);
    //   });
    // }

    // Remove physics bodies
    // if (this.rigidBodies) {
    //   this.rigidBodies.forEach(mesh => {
    //     if (mesh.userData.physicsBody) {
    //       this.$.physicsWorld.removeRigidBody(mesh.userData.physicsBody);
    //     }
    //   });
    // }

    console.log('[ScenarioName] Cleanup complete');
  }
}
