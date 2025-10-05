class Scenario {
  /*
   * Description: Interactive Particle Effects Demo
   * Version: 1.0
   *
   * This scenario demonstrates the particle system with various effects:
   * - Continuous particle fountain
   * - Firework bursts
   * - Orbiting particles around the character
   * - Color-changing particle trails
   */
  constructor(ctx) {
    console.log('[ParticleEffects] Initializing scenario');
    this.$ = ctx.scope;
    this.THREE = ctx.THREE;
    this.config = ctx.config;

    // Particle system state
    this.fountainTimer = 0;
    this.fountainInterval = 0.05; // 20 particles per second

    this.fireworkTimer = 0;
    this.fireworkInterval = 3; // Firework every 3 seconds

    this.orbitAngle = 0;
    this.orbitRadius = 1.5;
    this.orbitHeight = 1.2;
    this.orbitSpeed = 1.0; // radians per second

    // Color cycling for effects
    this.colorHue = 0;
  }

  async setup() {
    console.log('[ParticleEffects] Setting up scene');

    // Load VRM model
    await this.$.loadVrm(
      this.config('vrm_url'),
      (progress) => console.log(`[ParticleEffects] Loading VRM: ${progress}`)
    );

    // Position camera for better view
    this.$.setCameraPosition(0, 1.5, 4);
    this.$.setCameraLookAt(0, 1, 0);

    console.log('[ParticleEffects] Setup complete - particle effects active!');
  }

  update(delta) {
    // Update timers
    this.fountainTimer += delta;
    this.fireworkTimer += delta;
    this.orbitAngle += delta * this.orbitSpeed;
    this.colorHue = (this.colorHue + delta * 30) % 360; // Cycle through hues

    // Effect 1: Continuous fountain at model's feet
    if (this.fountainTimer >= this.fountainInterval) {
      this.createFountainParticle();
      this.fountainTimer = 0;
    }

    // Effect 2: Periodic firework bursts
    if (this.fireworkTimer >= this.fireworkInterval) {
      this.createFirework();
      this.fireworkTimer = 0;
    }

    // Effect 3: Orbiting particles
    this.createOrbitingParticle();
  }

  createFountainParticle() {
    // Create particle at model's feet shooting upward
    const spread = 0.3;
    const position = new this.THREE.Vector3(
      (Math.random() - 0.5) * spread,
      0,
      (Math.random() - 0.5) * spread
    );

    const velocity = new this.THREE.Vector3(
      (Math.random() - 0.5) * 0.5,
      2 + Math.random() * 1, // Upward velocity
      (Math.random() - 0.5) * 0.5
    );

    const color = new this.THREE.Color().setHSL(this.colorHue / 360, 1.0, 0.5);

    this.$.createParticle({
      position,
      velocity,
      color,
      size: 0.05 + Math.random() * 0.05,
      lifetime: 1.5 + Math.random() * 0.5
    });
  }

  createFirework() {
    console.log('[ParticleEffects] 💥 Firework burst!');

    // Burst position above and to the side
    const burstX = (Math.random() - 0.5) * 2;
    const burstY = 2 + Math.random() * 1;
    const burstZ = (Math.random() - 0.5) * 2;

    const burstPos = new this.THREE.Vector3(burstX, burstY, burstZ);
    const particleCount = 20 + Math.floor(Math.random() * 20);

    // Random color for this firework
    const fireworkHue = Math.random() * 360;
    const color = new this.THREE.Color().setHSL(fireworkHue / 360, 1.0, 0.6);

    // Create burst particles
    for (let i = 0; i < particleCount; i++) {
      // Random direction on a sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;

      const speed = 1 + Math.random() * 2;
      const velocity = new this.THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.sin(phi) * Math.sin(theta) * speed,
        Math.cos(phi) * speed
      );

      this.$.createParticle({
        position: burstPos.clone(),
        velocity,
        color: color.clone(),
        size: 0.08 + Math.random() * 0.04,
        lifetime: 1.0 + Math.random() * 1.0
      });
    }
  }

  createOrbitingParticle() {
    // Create particles that orbit around the character
    const x = Math.cos(this.orbitAngle) * this.orbitRadius;
    const z = Math.sin(this.orbitAngle) * this.orbitRadius;
    const y = this.orbitHeight;

    const position = new this.THREE.Vector3(x, y, z);

    // Velocity tangent to orbit (for trailing effect)
    const velocity = new this.THREE.Vector3(
      -Math.sin(this.orbitAngle) * 0.5,
      0,
      Math.cos(this.orbitAngle) * 0.5
    );

    // Color based on position in orbit
    const hue = (this.orbitAngle / (Math.PI * 2)) * 360;
    const color = new this.THREE.Color().setHSL(hue / 360, 1.0, 0.5);

    this.$.createParticle({
      position,
      velocity,
      color,
      size: 0.06,
      lifetime: 0.5
    });
  }

  async cleanup() {
    console.log('[ParticleEffects] Cleaning up scenario');
  }
}
