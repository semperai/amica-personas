class Scenario {
  /*
   * Description: Interactive Particle Effects Demo
   * Version: 2.0
   *
   * This scenario demonstrates the improved particle system with various effects:
   * - Continuous particle fountain (left side)
   * - Periodic firework bursts (above)
   * - Orbiting sparkles around the character
   * - Magic effect (right side)
   * - Smoke effect (behind)
   * - Energy beam effect (rotating)
   * - Individual color-changing particles
   */
  constructor(ctx) {
    console.log('[ParticleEffects] Initializing scenario v2.0');
    this.$ = ctx.scope;
    this.THREE = ctx.THREE;
    this.config = ctx.config;

    // Particle effect emitters (persistent)
    this.fountainEmitter = null;
    this.magicEmitter = null;
    this.smokeEmitter = null;
    this.energyEmitter = null;
    this.sparkleEmitter = null;

    // Particle system state
    this.fountainTimer = 0;
    this.fountainInterval = 0.05; // 20 particles per second

    this.fireworkTimer = 0;
    this.fireworkInterval = 4; // Firework every 4 seconds

    this.individualParticleTimer = 0;
    this.individualParticleInterval = 0.1;

    this.orbitAngle = 0;
    this.orbitRadius = 1.5;
    this.orbitHeight = 1.2;
    this.orbitSpeed = 1.0; // radians per second

    this.energyAngle = 0;
    this.energySpeed = 0.5;

    // Color cycling for effects
    this.colorHue = 0;

    // Effect cycling
    this.effectIndex = 0;
    this.effectTimer = 0;
    this.effectInterval = 10; // Change effect every 10 seconds
  }

  async setup() {
    console.log('[ParticleEffects] Setting up scene');

    // Load VRM model
    await this.$.loadVrm(
      this.config('vrm_url'),
      (progress) => console.log(`[ParticleEffects] Loading VRM: ${progress}`)
    );

    // Position camera for better view
    this.$.setCameraPosition(0, 1.5, 5);
    this.$.setCameraLookAt(0, 1, 0);

    // Create persistent particle effects
    this.setupPersistentEffects();

    console.log('[ParticleEffects] Setup complete - particle effects active!');
  }

  setupPersistentEffects() {
    // Fountain effect on the left
    this.fountainEmitter = this.$.createParticleEffect(
      'fountain',
      new this.THREE.Vector3(-1.2, 0, 0),
      { color: new this.THREE.Color(0.3, 0.7, 1.0), size: 0.06 }
    );

    // Magic effect on the right
    this.magicEmitter = this.$.createParticleEffect(
      'magic',
      new this.THREE.Vector3(1.2, 1, 0),
      { color: new this.THREE.Color(0.8, 0.3, 1.0), size: 0.05 }
    );

    // Smoke effect behind
    this.smokeEmitter = this.$.createParticleEffect(
      'smoke',
      new this.THREE.Vector3(0, 0.2, -1),
      { color: new this.THREE.Color(0.6, 0.6, 0.7), size: 0.25 }
    );

    // Sparkle effect orbiting
    this.sparkleEmitter = this.$.createParticleEffect(
      'sparkle',
      new this.THREE.Vector3(0, 1.5, 0),
      { color: new this.THREE.Color(1, 1, 0.5), size: 0.04 }
    );

    // Energy beam (will be rotated in update)
    this.energyEmitter = this.$.createParticleEffect(
      'energy',
      new this.THREE.Vector3(0, 0.5, 1.5),
      { color: new this.THREE.Color(0.2, 1.0, 0.8), size: 0.06 }
    );

    console.log('[ParticleEffects] Persistent effects created');
  }

  update(delta) {
    // Update timers
    this.fireworkTimer += delta;
    this.individualParticleTimer += delta;
    this.orbitAngle += delta * this.orbitSpeed;
    this.energyAngle += delta * this.energySpeed;
    this.colorHue = (this.colorHue + delta * 30) % 360; // Cycle through hues

    // Update persistent effect positions
    this.updatePersistentEffects();

    // Effect 1: Periodic firework bursts
    if (this.fireworkTimer >= this.fireworkInterval) {
      this.createFirework();
      this.fireworkTimer = 0;
    }

    // Effect 2: Individual color-changing particles
    if (this.individualParticleTimer >= this.individualParticleInterval) {
      this.createIndividualParticle();
      this.individualParticleTimer = 0;
    }
  }

  updatePersistentEffects() {
    // Orbit the sparkle emitter around the character
    if (this.sparkleEmitter) {
      const x = Math.cos(this.orbitAngle) * this.orbitRadius;
      const z = Math.sin(this.orbitAngle) * this.orbitRadius;
      this.sparkleEmitter.position.set(x, this.orbitHeight, z);
    }

    // Rotate the energy emitter
    if (this.energyEmitter) {
      const ex = Math.cos(this.energyAngle) * 1.5;
      const ez = Math.sin(this.energyAngle) * 1.5;
      this.energyEmitter.position.set(ex, 0.8, ez);

      // Point towards center
      this.energyEmitter.lookAt(0, 1, 0);
    }
  }

  createIndividualParticle() {
    // Create individual particles with custom behavior
    // These showcase the createParticle API for one-off effects

    const spread = 2.0;
    const height = 0.5 + Math.random() * 2;

    const position = new this.THREE.Vector3(
      (Math.random() - 0.5) * spread,
      height,
      (Math.random() - 0.5) * spread
    );

    const velocity = new this.THREE.Vector3(
      (Math.random() - 0.5) * 1.5,
      Math.random() * 0.5, // Slight upward velocity
      (Math.random() - 0.5) * 1.5
    );

    const color = new this.THREE.Color().setHSL(this.colorHue / 360, 1.0, 0.6);

    this.$.createParticle({
      position,
      velocity,
      color,
      size: 0.06 + Math.random() * 0.04,
      lifetime: 1.0 + Math.random() * 1.0
    });
  }

  createFirework() {
    console.log('[ParticleEffects] 💥 Firework burst!');

    // Use the pre-configured firework effect
    const burstX = (Math.random() - 0.5) * 3;
    const burstY = 2.5 + Math.random() * 1;
    const burstZ = (Math.random() - 0.5) * 2;

    const burstPos = new this.THREE.Vector3(burstX, burstY, burstZ);

    // Random color for this firework
    const fireworkHue = Math.random() * 360;
    const color = new this.THREE.Color().setHSL(fireworkHue / 360, 1.0, 0.6);

    // Create the firework effect (it auto-destroys after burst)
    this.$.createParticleEffect('firework', burstPos, {
      color: color,
      size: 0.1
    });
  }

  async cleanup() {
    console.log('[ParticleEffects] Cleaning up scenario');

    // Remove persistent emitters
    if (this.fountainEmitter) this.fountainEmitter.parent?.remove(this.fountainEmitter);
    if (this.magicEmitter) this.magicEmitter.parent?.remove(this.magicEmitter);
    if (this.smokeEmitter) this.smokeEmitter.parent?.remove(this.smokeEmitter);
    if (this.sparkleEmitter) this.sparkleEmitter.parent?.remove(this.sparkleEmitter);
    if (this.energyEmitter) this.energyEmitter.parent?.remove(this.energyEmitter);
  }
}
