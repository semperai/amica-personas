import * as THREE from "three";
import {
  BatchedParticleRenderer,
  BatchedRenderer,
  ParticleEmitter,
  ParticleSystem,
  QuarksLoader,
  QuarksUtil,
  RenderMode,
} from "three.quarks";
import {
  ConstantValue,
  ConstantColor,
  IntervalValue,
  PiecewiseFunction,
  ColorRange,
  SphereEmitter,
  ConeEmitter,
  Vector4 as QuarksVector4,
} from "quarks.core";

export interface ParticleOptions {
  position?: THREE.Vector3;
  velocity?: THREE.Vector3;
  color?: THREE.Color;
  size?: number;
  lifetime?: number;
}

export type ParticleEffectType =
  | 'fountain'
  | 'firework'
  | 'sparkle'
  | 'smoke'
  | 'magic'
  | 'energy'
  | 'custom';

export class ParticleManager {
  private particleRenderer: BatchedRenderer;
  private particleCartoonStarField: THREE.Object3D | null = null;
  private scene: THREE.Scene;
  private activeEmitters: Map<string, ParticleEmitter> = new Map();
  private emitterPool: ParticleEmitter[] = [];
  private particleTexture: THREE.Texture;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.particleRenderer = new BatchedParticleRenderer();
    this.scene.add(this.particleRenderer);

    // Create a simple particle texture
    this.particleTexture = this.createParticleTexture();

    // Disabled particle loading - file not found
    // new QuarksLoader().load('particles/cartoon_star_field', (obj) => {
    //   this.particleCartoonStarField = obj;
    // });
  }

  /**
   * Creates a circular gradient texture for particles
   */
  private createParticleTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Creates a pre-configured particle effect
   */
  public createEffect(
    type: ParticleEffectType,
    position: THREE.Vector3 = new THREE.Vector3(),
    options: Partial<ParticleOptions> = {}
  ): ParticleEmitter {
    let system: ParticleSystem;

    switch (type) {
      case 'fountain':
        system = this.createFountainSystem(options);
        break;
      case 'firework':
        system = this.createFireworkSystem(options);
        break;
      case 'sparkle':
        system = this.createSparkleSystem(options);
        break;
      case 'smoke':
        system = this.createSmokeSystem(options);
        break;
      case 'magic':
        system = this.createMagicSystem(options);
        break;
      case 'energy':
        system = this.createEnergySystem(options);
        break;
      default:
        system = this.createBasicSystem(options);
    }

    const emitter = new ParticleEmitter(system);
    emitter.position.copy(position);
    this.scene.add(emitter);
    this.particleRenderer.addSystem(system);

    return emitter;
  }

  /**
   * Creates a single particle with custom properties
   */
  public createParticle(options: ParticleOptions): ParticleEmitter {
    const position = options.position || new THREE.Vector3();
    const velocity = options.velocity || new THREE.Vector3();
    const color = options.color || new THREE.Color(1, 1, 1);
    const size = options.size || 0.1;
    const lifetime = options.lifetime || 1.0;

    // Create a one-shot emitter
    const material = new THREE.MeshBasicMaterial({
      map: this.particleTexture,
      blending: THREE.AdditiveBlending,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const system = new ParticleSystem({
      duration: 0.01, // Very short duration for single particle
      looping: false,
      autoDestroy: true,
      startLife: new ConstantValue(lifetime),
      startSpeed: new ConstantValue(velocity.length()),
      startSize: new ConstantValue(size),
      startColor: new ConstantColor(new QuarksVector4(color.r, color.g, color.b, 1)),
      worldSpace: true,
      emissionOverTime: new ConstantValue(0),
      emissionBursts: [{
        time: 0,
        count: new ConstantValue(1),
        cycle: 1,
        interval: 0,
        probability: 1,
      }],
      shape: new SphereEmitter({
        radius: 0.01,
        thickness: 1,
        arc: Math.PI * 2,
      }),
      material: material,
      renderMode: RenderMode.BillBoard,
    });

    // Add gravity behavior
    const gravity = new THREE.Vector3(0, -9.8, 0);
    system.addBehavior({
      type: 'GravityForce',
      initialize: () => {},
      update: (particle: any, delta: number) => {
        particle.velocity.x += gravity.x * delta;
        particle.velocity.y += gravity.y * delta;
        particle.velocity.z += gravity.z * delta;
      },
      toJSON: () => ({ type: 'GravityForce' }),
      frameUpdate: () => {},
      clone: () => this,
    } as any);

    // Fade out behavior
    system.addBehavior({
      type: 'SizeOverLife',
      initialize: () => {},
      update: (particle: any, delta: number) => {
        const t = particle.age / particle.life;
        particle.size = size * (1 - t * 0.5); // Shrink to 50% size
      },
      toJSON: () => ({ type: 'SizeOverLife' }),
      frameUpdate: () => {},
      clone: () => this,
    } as any);

    const emitter = new ParticleEmitter(system);
    emitter.position.copy(position);

    // Set initial velocity direction
    if (velocity.length() > 0) {
      const dir = velocity.clone().normalize();
      const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      emitter.quaternion.copy(quaternion);
    }

    this.scene.add(emitter);
    this.particleRenderer.addSystem(system);

    // Auto-cleanup
    setTimeout(() => {
      this.scene.remove(emitter);
      this.particleRenderer.deleteSystem(system);
      system.dispose();
    }, (lifetime + 0.1) * 1000);

    return emitter;
  }

  private createBasicSystem(options: Partial<ParticleOptions>): ParticleSystem {
    const color = options.color || new THREE.Color(1, 1, 1);
    const size = options.size || 0.1;
    const lifetime = options.lifetime || 1.0;

    const material = new THREE.MeshBasicMaterial({
      map: this.particleTexture,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });

    return new ParticleSystem({
      duration: 1,
      looping: true,
      startLife: new ConstantValue(lifetime),
      startSpeed: new ConstantValue(1),
      startSize: new ConstantValue(size),
      startColor: new ConstantColor(new QuarksVector4(color.r, color.g, color.b, 1)),
      worldSpace: false,
      emissionOverTime: new ConstantValue(50),
      shape: new SphereEmitter({
        radius: 0.1,
        thickness: 1,
        arc: Math.PI * 2,
      }),
      material: material,
      renderMode: RenderMode.BillBoard,
    });
  }

  private createFountainSystem(options: Partial<ParticleOptions>): ParticleSystem {
    const color = options.color || new THREE.Color(0.3, 0.7, 1.0);
    const size = options.size || 0.08;

    const material = new THREE.MeshBasicMaterial({
      map: this.particleTexture,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });

    return new ParticleSystem({
      duration: 999,
      looping: true,
      startLife: new IntervalValue(1.5, 2.5),
      startSpeed: new IntervalValue(2, 4),
      startSize: new ConstantValue(size),
      startColor: new ColorRange(
        new QuarksVector4(color.r * 0.8, color.g * 0.8, color.b * 0.8, 1),
        new QuarksVector4(color.r, color.g, color.b, 1)
      ),
      worldSpace: true,
      emissionOverTime: new ConstantValue(40),
      shape: new ConeEmitter({
        radius: 0.2,
        arc: Math.PI * 2,
        thickness: 0.5,
        angle: Math.PI / 6, // 30 degree cone
      }),
      material: material,
      renderMode: RenderMode.BillBoard,
    });
  }

  private createFireworkSystem(options: Partial<ParticleOptions>): ParticleSystem {
    const color = options.color || new THREE.Color(1, 0.5, 0.2);
    const size = options.size || 0.1;

    const material = new THREE.MeshBasicMaterial({
      map: this.particleTexture,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });

    return new ParticleSystem({
      duration: 0.1,
      looping: false,
      autoDestroy: true,
      startLife: new IntervalValue(1.0, 2.0),
      startSpeed: new IntervalValue(2, 5),
      startSize: new ConstantValue(size),
      startColor: new ColorRange(
        new QuarksVector4(color.r, color.g * 0.5, color.b * 0.3, 1),
        new QuarksVector4(color.r, color.g, color.b, 1)
      ),
      worldSpace: true,
      emissionOverTime: new ConstantValue(0),
      emissionBursts: [{
        time: 0,
        count: new ConstantValue(80),
        cycle: 1,
        interval: 0,
        probability: 1,
      }],
      shape: new SphereEmitter({
        radius: 0.1,
        thickness: 1,
        arc: Math.PI * 2,
      }),
      material: material,
      renderMode: RenderMode.BillBoard,
    });
  }

  private createSparkleSystem(options: Partial<ParticleOptions>): ParticleSystem {
    const color = options.color || new THREE.Color(1, 1, 0.5);
    const size = options.size || 0.05;

    const material = new THREE.MeshBasicMaterial({
      map: this.particleTexture,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });

    const system = new ParticleSystem({
      duration: 999,
      looping: true,
      startLife: new IntervalValue(0.3, 0.8),
      startSpeed: new IntervalValue(0.1, 0.5),
      startSize: new IntervalValue(size * 0.5, size),
      startColor: new ConstantColor(new QuarksVector4(color.r, color.g, color.b, 1)),
      worldSpace: false,
      emissionOverTime: new ConstantValue(30),
      shape: new SphereEmitter({
        radius: 0.3,
        thickness: 0.8,
        arc: Math.PI * 2,
      }),
      material: material,
      renderMode: RenderMode.BillBoard,
    });

    return system;
  }

  private createSmokeSystem(options: Partial<ParticleOptions>): ParticleSystem {
    const color = options.color || new THREE.Color(0.5, 0.5, 0.5);
    const size = options.size || 0.3;

    const material = new THREE.MeshBasicMaterial({
      map: this.particleTexture,
      blending: THREE.NormalBlending,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });

    const system = new ParticleSystem({
      duration: 999,
      looping: true,
      startLife: new IntervalValue(2.0, 3.0),
      startSpeed: new IntervalValue(0.3, 0.8),
      startSize: new IntervalValue(size * 0.5, size),
      startColor: new ColorRange(
        new QuarksVector4(color.r * 0.7, color.g * 0.7, color.b * 0.7, 0.3),
        new QuarksVector4(color.r, color.g, color.b, 0.5)
      ),
      worldSpace: true,
      emissionOverTime: new ConstantValue(15),
      shape: new SphereEmitter({
        radius: 0.1,
        thickness: 0.5,
        arc: Math.PI * 2,
      }),
      material: material,
      renderMode: RenderMode.BillBoard,
    });

    return system;
  }

  private createMagicSystem(options: Partial<ParticleOptions>): ParticleSystem {
    const color = options.color || new THREE.Color(0.8, 0.3, 1.0);
    const size = options.size || 0.06;

    const material = new THREE.MeshBasicMaterial({
      map: this.particleTexture,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });

    const system = new ParticleSystem({
      duration: 999,
      looping: true,
      startLife: new IntervalValue(1.0, 1.5),
      startSpeed: new IntervalValue(0.5, 1.5),
      startSize: new ConstantValue(size),
      startColor: new ColorRange(
        new QuarksVector4(color.r * 0.6, color.g * 0.6, color.b, 1),
        new QuarksVector4(color.r, color.g, color.b, 1)
      ),
      worldSpace: false,
      emissionOverTime: new ConstantValue(50),
      shape: new SphereEmitter({
        radius: 0.2,
        thickness: 0.3,
        arc: Math.PI * 2,
      }),
      material: material,
      renderMode: RenderMode.BillBoard,
    });

    return system;
  }

  private createEnergySystem(options: Partial<ParticleOptions>): ParticleSystem {
    const color = options.color || new THREE.Color(0.2, 1.0, 0.8);
    const size = options.size || 0.08;

    const material = new THREE.MeshBasicMaterial({
      map: this.particleTexture,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });

    const system = new ParticleSystem({
      duration: 999,
      looping: true,
      startLife: new IntervalValue(0.8, 1.2),
      startSpeed: new IntervalValue(1.0, 2.0),
      startSize: new ConstantValue(size),
      startColor: new ConstantColor(new QuarksVector4(color.r, color.g, color.b, 1)),
      worldSpace: false,
      emissionOverTime: new ConstantValue(80),
      shape: new ConeEmitter({
        radius: 0.05,
        arc: Math.PI * 2,
        thickness: 0.3,
        angle: Math.PI / 12, // Narrow cone
      }),
      material: material,
      renderMode: RenderMode.BillBoard,
    });

    return system;
  }

  /**
   * Update all particle systems
   */
  public update(delta: number) {
    this.particleRenderer.update(delta);
  }

  public newParticleInstance() {
    if (!this.particleCartoonStarField) return;

    function listener(event: any) {
      console.log(event.type);
    }

    const effect = this.particleCartoonStarField.clone(true);
    QuarksUtil.runOnAllParticleEmitters(effect, (emitter) => {
      emitter.system.addEventListener("emitEnd", listener);
    });
    QuarksUtil.setAutoDestroy(effect, true);
    QuarksUtil.addToBatchRenderer(effect, this.particleRenderer);
    QuarksUtil.play(effect);
    this.scene.add(effect);
  }

  public getRenderer(): BatchedRenderer {
    return this.particleRenderer;
  }
}
