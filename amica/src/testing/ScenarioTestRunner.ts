/**
 * Scenario Testing Framework
 *
 * Provides utilities for testing Amica scenarios with mocked dependencies
 * and assertion helpers for common scenario patterns.
 */

import * as THREE from 'three';

export interface MockScope {
  // Scene
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer?: THREE.WebGLRenderer;
  igroup: THREE.Group;

  // Rapier.js physics
  rapier: any;
  physicsWorld: any;

  // Managers
  vrm?: any;
  environment?: any;
  particles?: any;
  xr?: any;
  render?: any;
  raycast?: any;
  physics?: any;
  debug?: any;
  scenario?: any;
  chat?: any;

  // Methods
  loadVrm: jest.Mock;
  unloadVRM: jest.Mock;
  loadRoom: jest.Mock;
  unloadRoom: jest.Mock;
  loadSplat: jest.Mock;
  playAnimation: jest.Mock;
  setExpression: jest.Mock;
  triggerEmotion: jest.Mock;
  setCameraPosition: jest.Mock;
  setCameraLookAt: jest.Mock;
  addLight: jest.Mock;
  removeLight: jest.Mock;
  sendMessage: jest.Mock;
  createParticle: jest.Mock;
  getModel: jest.Mock;
  getElapsedTime: jest.Mock;
}

export interface MockHookManager {
  register: jest.Mock;
  unregister: jest.Mock;
  trigger: jest.Mock;
  getMetrics: jest.Mock;
}

export interface ScenarioTestContext {
  scope: MockScope;
  THREE: typeof THREE;
  hookManager: MockHookManager;
  config: jest.Mock;
}

export interface ScenarioTestOptions {
  skipSetup?: boolean;
  mockVrmLoad?: boolean;
  mockRoomLoad?: boolean;
  initialElapsedTime?: number;
}

/**
 * Create a mock scope for testing scenarios
 */
export function createMockScope(): MockScope {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  const igroup = new THREE.Group();

  // Mock Rapier.js
  const mockRigidBody = {
    translation: jest.fn().mockReturnValue({ x: 0, y: 0, z: 0 }),
    rotation: jest.fn().mockReturnValue({ x: 0, y: 0, z: 0, w: 1 }),
    setTranslation: jest.fn(),
    setRotation: jest.fn(),
    applyImpulse: jest.fn(),
    applyImpulseAtPoint: jest.fn(),
  };

  const mockRapier = {
    RigidBodyDesc: {
      dynamic: jest.fn().mockReturnValue({
        setTranslation: jest.fn().mockReturnThis(),
        setRotation: jest.fn().mockReturnThis(),
      }),
      fixed: jest.fn().mockReturnValue({
        setTranslation: jest.fn().mockReturnThis(),
        setRotation: jest.fn().mockReturnThis(),
      }),
      kinematicPositionBased: jest.fn().mockReturnValue({
        setTranslation: jest.fn().mockReturnThis(),
        setRotation: jest.fn().mockReturnThis(),
      }),
    },
    ColliderDesc: {
      cuboid: jest.fn().mockReturnValue({
        setMass: jest.fn().mockReturnThis(),
        setFriction: jest.fn().mockReturnThis(),
        setRestitution: jest.fn().mockReturnThis(),
      }),
      ball: jest.fn().mockReturnValue({
        setMass: jest.fn().mockReturnThis(),
        setFriction: jest.fn().mockReturnThis(),
        setRestitution: jest.fn().mockReturnThis(),
      }),
      cylinder: jest.fn().mockReturnValue({
        setMass: jest.fn().mockReturnThis(),
        setFriction: jest.fn().mockReturnThis(),
        setRestitution: jest.fn().mockReturnThis(),
      }),
    },
    JointData: {
      spherical: jest.fn(),
    },
  };

  const mockPhysicsWorld = {
    createRigidBody: jest.fn().mockReturnValue(mockRigidBody),
    createCollider: jest.fn(),
    removeRigidBody: jest.fn(),
    createImpulseJoint: jest.fn(),
    step: jest.fn(),
    gravity: { x: 0, y: -7.8, z: 0 },
  };

  return {
    scene,
    camera,
    igroup,
    rapier: mockRapier,
    physicsWorld: mockPhysicsWorld,

    loadVrm: jest.fn().mockResolvedValue(undefined),
    unloadVRM: jest.fn(),
    loadRoom: jest.fn().mockResolvedValue(undefined),
    unloadRoom: jest.fn(),
    loadSplat: jest.fn().mockResolvedValue(undefined),
    playAnimation: jest.fn(),
    setExpression: jest.fn(),
    triggerEmotion: jest.fn(),
    setCameraPosition: jest.fn((x, y, z) => camera.position.set(x, y, z)),
    setCameraLookAt: jest.fn((x, y, z) => camera.lookAt(x, y, z)),
    addLight: jest.fn((light) => scene.add(light)),
    removeLight: jest.fn((light) => scene.remove(light)),
    sendMessage: jest.fn(),
    createParticle: jest.fn().mockReturnValue({}),
    getModel: jest.fn().mockReturnValue(null),
    getElapsedTime: jest.fn().mockReturnValue(0),
  };
}

/**
 * Create a mock hook manager for testing
 */
export function createMockHookManager(): MockHookManager {
  return {
    register: jest.fn().mockReturnValue('hook-id-123'),
    unregister: jest.fn(),
    trigger: jest.fn(),
    getMetrics: jest.fn().mockReturnValue({
      calls: 0,
      avgDuration: 0,
      errors: 0,
    }),
  };
}

/**
 * Create a mock config function for testing
 */
export function createMockConfig(overrides: Record<string, string> = {}): jest.Mock {
  const defaults: Record<string, string> = {
    vrm_url: '/vrm/test.vrm',
    animation_url: '/animations/idle.vrma',
    scenario_url: '/scenarios/test.js',
    name: 'TestCharacter',
    system_prompt: 'Test prompt',
    ...overrides,
  };

  return jest.fn((key: string) => {
    if (!(key in defaults)) {
      throw new Error(`Config key not found: ${key}`);
    }
    return defaults[key];
  });
}

/**
 * Create a complete test context for scenarios
 */
export function createScenarioTestContext(
  configOverrides: Record<string, string> = {}
): ScenarioTestContext {
  return {
    scope: createMockScope(),
    THREE,
    hookManager: createMockHookManager(),
    config: createMockConfig(configOverrides),
  };
}

/**
 * Test runner for scenarios
 */
export class ScenarioTestRunner {
  private scenario: any;
  private context: ScenarioTestContext;
  private updateCount: number = 0;
  private totalDelta: number = 0;

  constructor(ScenarioClass: any, options: ScenarioTestOptions = {}) {
    this.context = createScenarioTestContext();
    this.scenario = new ScenarioClass(this.context);

    if (!options.skipSetup) {
      // Auto-run setup in constructor for convenience
      // Tests can await runner.setup() if they need async control
    }

    // Setup mock elapsed time
    if (options.initialElapsedTime !== undefined) {
      this.totalDelta = options.initialElapsedTime;
      this.context.scope.getElapsedTime = jest.fn(() => this.totalDelta);
    }
  }

  /**
   * Run scenario setup
   */
  async setup(): Promise<void> {
    if (this.scenario.setup) {
      await this.scenario.setup();
    }
  }

  /**
   * Run scenario update for one frame
   */
  update(delta: number = 0.016): void {
    if (this.scenario.update) {
      this.scenario.update(delta);
      this.updateCount++;
      this.totalDelta += delta;

      // Update elapsed time mock
      this.context.scope.getElapsedTime = jest.fn(() => this.totalDelta);
    }
  }

  /**
   * Run scenario update for multiple frames
   */
  updateFrames(frameCount: number, deltaPerFrame: number = 0.016): void {
    for (let i = 0; i < frameCount; i++) {
      this.update(deltaPerFrame);
    }
  }

  /**
   * Run scenario update for a specific duration
   */
  updateForDuration(duration: number, deltaPerFrame: number = 0.016): void {
    const frames = Math.ceil(duration / deltaPerFrame);
    this.updateFrames(frames, deltaPerFrame);
  }

  /**
   * Run scenario cleanup
   */
  async cleanup(): Promise<void> {
    if (this.scenario.cleanup) {
      await this.scenario.cleanup();
    }
  }

  /**
   * Get the scenario instance
   */
  getScenario(): any {
    return this.scenario;
  }

  /**
   * Get the test context
   */
  getContext(): ScenarioTestContext {
    return this.context;
  }

  /**
   * Get the mock scope
   */
  getScope(): MockScope {
    return this.context.scope;
  }

  /**
   * Get number of updates run
   */
  getUpdateCount(): number {
    return this.updateCount;
  }

  /**
   * Get total elapsed time
   */
  getElapsedTime(): number {
    return this.totalDelta;
  }

  /**
   * Get scene objects by type
   */
  getSceneObjects<T extends THREE.Object3D>(type: new (...args: any[]) => T): T[] {
    const objects: T[] = [];
    this.context.scope.scene.traverse((obj) => {
      if (obj instanceof type) {
        objects.push(obj);
      }
    });
    return objects;
  }

  /**
   * Get all lights in scene
   */
  getLights(): THREE.Light[] {
    return this.getSceneObjects(THREE.Light);
  }

  /**
   * Get all meshes in scene
   */
  getMeshes(): THREE.Mesh[] {
    return this.getSceneObjects(THREE.Mesh);
  }

  /**
   * Count objects in scene by type
   */
  countSceneObjects<T extends THREE.Object3D>(type: new (...args: any[]) => T): number {
    return this.getSceneObjects(type).length;
  }
}

/**
 * Assertion helpers for scenarios
 */
export class ScenarioAssertions {
  /**
   * Assert that VRM was loaded
   */
  static assertVrmLoaded(runner: ScenarioTestRunner, expectedUrl?: string) {
    const scope = runner.getScope();
    expect(scope.loadVrm).toHaveBeenCalled();

    if (expectedUrl) {
      expect(scope.loadVrm).toHaveBeenCalledWith(
        expectedUrl,
        expect.any(Function)
      );
    }
  }

  /**
   * Assert that room was loaded
   */
  static assertRoomLoaded(runner: ScenarioTestRunner) {
    const scope = runner.getScope();
    expect(scope.loadRoom).toHaveBeenCalled();
  }

  /**
   * Assert camera position
   */
  static assertCameraPosition(
    runner: ScenarioTestRunner,
    expectedPos: { x: number; y: number; z: number },
    tolerance: number = 0.01
  ) {
    const camera = runner.getContext().scope.camera;
    expect(camera.position.x).toBeCloseTo(expectedPos.x, tolerance);
    expect(camera.position.y).toBeCloseTo(expectedPos.y, tolerance);
    expect(camera.position.z).toBeCloseTo(expectedPos.z, tolerance);
  }

  /**
   * Assert number of lights in scene
   */
  static assertLightCount(runner: ScenarioTestRunner, expectedCount: number) {
    const lights = runner.getLights();
    expect(lights.length).toBe(expectedCount);
  }

  /**
   * Assert particle was created
   */
  static assertParticleCreated(runner: ScenarioTestRunner, minCount: number = 1) {
    const scope = runner.getScope();
    expect(scope.createParticle).toHaveBeenCalled();
    expect(scope.createParticle).toHaveBeenCalledTimes(
      expect.any(Number)
    );
    expect((scope.createParticle as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(minCount);
  }

  /**
   * Assert emotion was triggered
   */
  static assertEmotionTriggered(
    runner: ScenarioTestRunner,
    emotion?: string,
    duration?: number
  ) {
    const scope = runner.getScope();
    expect(scope.triggerEmotion).toHaveBeenCalled();

    if (emotion) {
      expect(scope.triggerEmotion).toHaveBeenCalledWith(
        emotion,
        duration !== undefined ? duration : expect.any(Number)
      );
    }
  }

  /**
   * Assert physics body was added
   */
  static assertPhysicsBodyAdded(runner: ScenarioTestRunner, minCount: number = 1) {
    const scope = runner.getScope();
    expect(scope.physicsWorld.addRigidBody).toHaveBeenCalled();
    expect((scope.physicsWorld.addRigidBody as jest.Mock).mock.calls.length)
      .toBeGreaterThanOrEqual(minCount);
  }

  /**
   * Assert hook was registered
   */
  static assertHookRegistered(
    runner: ScenarioTestRunner,
    hookName?: string
  ) {
    const hookManager = runner.getContext().hookManager;
    expect(hookManager.register).toHaveBeenCalled();

    if (hookName) {
      expect(hookManager.register).toHaveBeenCalledWith(
        hookName,
        expect.any(Function),
        expect.anything()
      );
    }
  }

  /**
   * Assert cleanup was performed
   */
  static async assertCleanup(
    runner: ScenarioTestRunner,
    checks: {
      hooksUnregistered?: boolean;
      lightsRemoved?: boolean;
      physicsObjectsRemoved?: boolean;
    } = {}
  ) {
    await runner.cleanup();

    const scope = runner.getScope();
    const hookManager = runner.getContext().hookManager;

    if (checks.hooksUnregistered) {
      expect(hookManager.unregister).toHaveBeenCalled();
    }

    if (checks.lightsRemoved) {
      expect(scope.removeLight).toHaveBeenCalled();
    }

    if (checks.physicsObjectsRemoved) {
      expect(scope.physicsWorld.removeRigidBody).toHaveBeenCalled();
    }
  }
}

/**
 * Scenario test utilities
 */
export const ScenarioTestUtils = {
  /**
   * Load scenario code from string
   */
  loadScenarioFromCode(code: string): any {
    const ClassDefinition = new Function(`return ${code}`)();
    return ClassDefinition;
  },

  /**
   * Create a minimal scenario for testing
   */
  createMinimalScenario(): any {
    return class MinimalScenario {
      constructor(ctx: any) {
        this.$ = ctx.scope;
        this.THREE = ctx.THREE;
      }

      async setup() {}

      update(delta: number) {}
    };
  },

  /**
   * Measure performance of scenario update
   */
  measureUpdatePerformance(
    runner: ScenarioTestRunner,
    frameCount: number = 100
  ): { avgMs: number; maxMs: number; minMs: number } {
    const times: number[] = [];

    for (let i = 0; i < frameCount; i++) {
      const start = performance.now();
      runner.update(0.016);
      const elapsed = performance.now() - start;
      times.push(elapsed);
    }

    return {
      avgMs: times.reduce((a, b) => a + b, 0) / times.length,
      maxMs: Math.max(...times),
      minMs: Math.min(...times),
    };
  },
};
