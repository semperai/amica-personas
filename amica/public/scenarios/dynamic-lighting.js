class Scenario {
  /*
   * Description: Dynamic Lighting and Mood Demo
   * Version: 1.0
   *
   * This scenario demonstrates dynamic lighting effects:
   * - Day/night cycle with color-changing ambient light
   * - Pulsing spotlight that follows the character
   * - Orbiting colored point lights
   * - Lightning flash effects
   * - Mood-based lighting that syncs with character emotions
   */
  constructor(ctx) {
    console.log('[DynamicLighting] Initializing scenario');
    this.$ = ctx.scope;
    this.THREE = ctx.THREE;
    this.config = ctx.config;

    // Lighting objects
    this.ambientLight = null;
    this.spotlight = null;
    this.orbitLights = [];
    this.lightningLight = null;

    // Animation state
    this.timeOfDay = 0; // 0-1 represents full day cycle
    this.dayDuration = 30; // 30 seconds for full day/night cycle

    this.lightningTimer = 0;
    this.lightningInterval = 8; // Lightning every 8 seconds
    this.lightningFlashing = false;
    this.lightningFlashTimer = 0;

    this.orbitAngle = 0;
    this.orbitSpeed = 0.5; // radians per second

    // Mood cycling
    this.moodTimer = 0;
    this.moodInterval = 5; // Change mood every 5 seconds
    this.moods = ['happy', 'relaxed', 'sad', 'neutral'];
    this.currentMoodIndex = 0;
  }

  async setup() {
    console.log('[DynamicLighting] Setting up scene');

    // Load VRM model
    await this.$.loadVrm(
      this.config('vrm_url'),
      (progress) => console.log(`[DynamicLighting] Loading VRM: ${progress}`)
    );

    // Position camera
    this.$.setCameraPosition(0, 1.5, 4);
    this.$.setCameraLookAt(0, 1, 0);

    // Setup lighting
    this.setupLights();

    console.log('[DynamicLighting] Setup complete - dynamic lighting active!');
  }

  setupLights() {
    // 1. Ambient light (will change with day/night)
    this.ambientLight = new this.THREE.AmbientLight(0xffffff, 0.4);
    this.$.addLight(this.ambientLight);

    // 2. Spotlight that follows character
    this.spotlight = new this.THREE.SpotLight(0xffffff, 1.5);
    this.spotlight.position.set(0, 3, 1);
    this.spotlight.angle = Math.PI / 6;
    this.spotlight.penumbra = 0.3;
    this.spotlight.decay = 2;
    this.spotlight.distance = 10;
    this.$.addLight(this.spotlight);

    // Add target for spotlight
    this.spotlight.target.position.set(0, 1, 0);
    this.$.scene.add(this.spotlight.target);

    // 3. Orbiting colored lights
    const lightColors = [
      0xff0000, // Red
      0x00ff00, // Green
      0x0000ff, // Blue
    ];

    lightColors.forEach((color, i) => {
      const light = new this.THREE.PointLight(color, 0.6, 8);
      this.$.addLight(light);
      this.orbitLights.push({
        light,
        angleOffset: (i / lightColors.length) * Math.PI * 2,
        radius: 2,
        height: 1 + i * 0.5
      });
    });

    // 4. Lightning light (initially off)
    this.lightningLight = new this.THREE.PointLight(0xaaaaff, 0, 50);
    this.lightningLight.position.set(0, 10, 0);
    this.$.addLight(this.lightningLight);

    console.log('[DynamicLighting] Lights configured');
  }

  update(delta) {
    // Update day/night cycle
    this.updateDayNightCycle(delta);

    // Update orbiting lights
    this.updateOrbitingLights(delta);

    // Update spotlight pulse
    this.updateSpotlight(delta);

    // Update lightning
    this.updateLightning(delta);

    // Update mood-based lighting
    this.updateMoodLighting(delta);
  }

  updateDayNightCycle(delta) {
    // Advance time of day
    this.timeOfDay += delta / this.dayDuration;
    if (this.timeOfDay > 1) {
      this.timeOfDay -= 1;
      console.log('[DynamicLighting] 🌅 New day cycle started');
    }

    // Calculate sun position (0 = midnight, 0.5 = noon)
    const sunAngle = this.timeOfDay * Math.PI * 2;
    const sunHeight = Math.sin(sunAngle);

    // Day = warm colors, Night = cool colors
    let color, intensity;

    if (sunHeight > 0) {
      // Daytime - warm yellow/white
      const t = sunHeight; // 0 (dawn/dusk) to 1 (noon)
      color = new this.THREE.Color().setHSL(0.15, 0.3, 0.5 + t * 0.3);
      intensity = 0.4 + t * 0.4;
    } else {
      // Nighttime - cool blue
      const t = -sunHeight; // 0 (dusk/dawn) to 1 (midnight)
      color = new this.THREE.Color().setHSL(0.6, 0.5, 0.1 + t * 0.1);
      intensity = 0.1 + t * 0.1;
    }

    this.ambientLight.color = color;
    this.ambientLight.intensity = intensity;
  }

  updateOrbitingLights(delta) {
    this.orbitAngle += delta * this.orbitSpeed;

    this.orbitLights.forEach(({ light, angleOffset, radius, height }) => {
      const angle = this.orbitAngle + angleOffset;
      light.position.set(
        Math.cos(angle) * radius,
        height,
        Math.sin(angle) * radius
      );

      // Pulse intensity
      const pulse = 0.3 + Math.sin(this.orbitAngle * 3 + angleOffset) * 0.3;
      light.intensity = pulse;
    });
  }

  updateSpotlight(delta) {
    // Pulse spotlight intensity
    const time = this.$.getElapsedTime();
    this.spotlight.intensity = 1.0 + Math.sin(time * 2) * 0.5;

    // Slightly move spotlight target in a figure-8 pattern
    const t = time * 0.5;
    this.spotlight.target.position.set(
      Math.sin(t) * 0.3,
      1.0,
      Math.sin(t * 2) * 0.3
    );
  }

  updateLightning(delta) {
    if (!this.lightningFlashing) {
      // Check if it's time for lightning
      this.lightningTimer += delta;

      if (this.lightningTimer >= this.lightningInterval) {
        // Only during "night" (when ambient is dark)
        if (this.ambientLight.intensity < 0.3) {
          console.log('[DynamicLighting] ⚡ Lightning strike!');
          this.lightningFlashing = true;
          this.lightningFlashTimer = 0;
          this.lightningTimer = 0;
        } else {
          // Reset timer if it's daytime
          this.lightningTimer = 0;
        }
      }
    } else {
      // Animate lightning flash
      this.lightningFlashTimer += delta;

      // Quick flashes
      const flashPattern = [0, 0.1, 0.15, 0.3, 0.35]; // Flash times
      let intensity = 0;

      for (const flashTime of flashPattern) {
        const timeSinceFlash = this.lightningFlashTimer - flashTime;
        if (timeSinceFlash >= 0 && timeSinceFlash < 0.05) {
          // Flash duration = 50ms
          intensity = 8 * (1 - timeSinceFlash / 0.05);
          break;
        }
      }

      this.lightningLight.intensity = intensity;

      // End lightning after 0.5 seconds
      if (this.lightningFlashTimer > 0.5) {
        this.lightningFlashing = false;
        this.lightningLight.intensity = 0;
      }
    }
  }

  updateMoodLighting(delta) {
    this.moodTimer += delta;

    if (this.moodTimer >= this.moodInterval) {
      // Cycle to next mood
      this.currentMoodIndex = (this.currentMoodIndex + 1) % this.moods.length;
      const mood = this.moods[this.currentMoodIndex];

      console.log('[DynamicLighting] 😊 Changing mood to:', mood);

      // Trigger emotion on character
      this.$.triggerEmotion(mood, this.moodInterval);

      // Change spotlight color based on mood
      const moodColors = {
        happy: 0xffff00,    // Yellow
        relaxed: 0x00ffaa,  // Cyan
        sad: 0x4444ff,      // Blue
        neutral: 0xffffff,  // White
      };

      this.spotlight.color.setHex(moodColors[mood] || 0xffffff);

      this.moodTimer = 0;
    }
  }

  async cleanup() {
    console.log('[DynamicLighting] Cleaning up lights');

    // Remove all lights
    if (this.ambientLight) this.$.removeLight(this.ambientLight);
    if (this.spotlight) this.$.removeLight(this.spotlight);
    if (this.lightningLight) this.$.removeLight(this.lightningLight);

    this.orbitLights.forEach(({ light }) => {
      this.$.removeLight(light);
    });

    console.log('[DynamicLighting] Cleanup complete');
  }
}
