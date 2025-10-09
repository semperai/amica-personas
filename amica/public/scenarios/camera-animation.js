class Scenario {
  /*
   * Description: Camera Animation Demo
   * Version: 1.0
   *
   * This scenario demonstrates various camera movements:
   * - Orbiting camera around the character
   * - Dolly zoom (Vertigo effect)
   * - Camera shake effects
   * - Smooth camera transitions between preset positions
   * - Follow camera that tracks character's head
   */
  constructor(ctx) {
    console.log('[CameraAnimation] Initializing scenario');
    this.$ = ctx.scope;
    this.THREE = ctx.THREE;
    this.config = ctx.config;

    // Camera animation state
    this.currentMode = 'orbit'; // orbit, preset, dolly, shake, follow
    this.modeTimer = 0;
    this.modeDuration = 8; // 8 seconds per mode

    // Orbit mode
    this.orbitAngle = 0;
    this.orbitRadius = 4;
    this.orbitHeight = 1.5;
    this.orbitSpeed = 0.3;

    // Preset positions mode
    this.presetPositions = [
      { pos: [3, 1.5, 3], look: [0, 1, 0], name: 'Front-Right' },
      { pos: [-3, 1.5, 3], look: [0, 1, 0], name: 'Front-Left' },
      { pos: [0, 2.5, 5], look: [0, 1, 0], name: 'High Front' },
      { pos: [0, 0.5, 2], look: [0, 1.3, 0], name: 'Low Front' },
      { pos: [0, 1.5, -3], look: [0, 1, 0], name: 'Behind' },
    ];
    this.currentPresetIndex = 0;
    this.presetTransitionDuration = 2;
    this.presetTimer = 0;
    this.presetStartPos = new this.THREE.Vector3();
    this.presetEndPos = new this.THREE.Vector3();
    this.presetStartLook = new this.THREE.Vector3();
    this.presetEndLook = new this.THREE.Vector3();

    // Dolly zoom mode
    this.dollyDirection = 1; // 1 = zoom in, -1 = zoom out
    this.dollyMinDistance = 2;
    this.dollyMaxDistance = 6;
    this.dollySpeed = 1;

    // Shake mode
    this.shakeIntensity = 0.1;
    this.shakeFrequency = 10;
    this.baseShakePosition = new this.THREE.Vector3();

    // Follow mode
    this.followDistance = 3;
    this.followHeight = 1.5;
    this.followLerpSpeed = 2;

    this.modes = ['orbit', 'preset', 'dolly', 'shake', 'follow'];
    this.currentModeIndex = 0;
  }

  async setup() {
    console.log('[CameraAnimation] Setting up scene');

    // Load VRM model
    await this.$.loadVrm(
      this.config('vrm_url'),
      (progress) => console.log(`[CameraAnimation] Loading VRM: ${progress}`)
    );

    // Set initial camera position
    this.$.setCameraPosition(0, 1.5, 4);
    this.$.setCameraLookAt(0, 1, 0);

    console.log('[CameraAnimation] Setup complete - camera animations active!');
    console.log('[CameraAnimation] Mode: orbit');
  }

  update(delta) {
    // Mode switching
    this.modeTimer += delta;
    if (this.modeTimer >= this.modeDuration) {
      this.switchMode();
      this.modeTimer = 0;
    }

    // Run current mode
    switch (this.currentMode) {
      case 'orbit':
        this.updateOrbitMode(delta);
        break;
      case 'preset':
        this.updatePresetMode(delta);
        break;
      case 'dolly':
        this.updateDollyMode(delta);
        break;
      case 'shake':
        this.updateShakeMode(delta);
        break;
      case 'follow':
        this.updateFollowMode(delta);
        break;
    }
  }

  switchMode() {
    this.currentModeIndex = (this.currentModeIndex + 1) % this.modes.length;
    this.currentMode = this.modes[this.currentModeIndex];

    console.log(`[CameraAnimation] 🎥 Switching to mode: ${this.currentMode}`);

    // Initialize mode-specific state
    if (this.currentMode === 'preset') {
      this.currentPresetIndex = 0;
      this.presetTimer = 0;
      this.presetStartPos.copy(this.$.camera.position);
      this.presetEndPos.set(...this.presetPositions[0].pos);
      this.presetStartLook.set(0, 1, 0);
      this.presetEndLook.set(...this.presetPositions[0].look);
    } else if (this.currentMode === 'dolly') {
      this.dollyDirection = 1;
    } else if (this.currentMode === 'shake') {
      this.baseShakePosition.set(0, 1.5, 3);
    }
  }

  updateOrbitMode(delta) {
    // Orbit camera around character
    this.orbitAngle += delta * this.orbitSpeed;

    const x = Math.cos(this.orbitAngle) * this.orbitRadius;
    const z = Math.sin(this.orbitAngle) * this.orbitRadius;

    this.$.setCameraPosition(x, this.orbitHeight, z);
    this.$.setCameraLookAt(0, 1, 0);
  }

  updatePresetMode(delta) {
    this.presetTimer += delta;

    if (this.presetTimer >= this.presetTransitionDuration) {
      // Move to next preset
      this.currentPresetIndex = (this.currentPresetIndex + 1) % this.presetPositions.length;
      const preset = this.presetPositions[this.currentPresetIndex];

      console.log(`[CameraAnimation] Moving to preset: ${preset.name}`);

      this.presetStartPos.copy(this.$.camera.position);
      this.presetEndPos.set(...preset.pos);
      this.presetStartLook.copy(this.$.camera.position);
      this.presetEndLook.set(...preset.look);
      this.presetTimer = 0;
    }

    // Smooth interpolation
    const t = this.easeInOutCubic(this.presetTimer / this.presetTransitionDuration);

    const currentPos = new this.THREE.Vector3().lerpVectors(
      this.presetStartPos,
      this.presetEndPos,
      t
    );

    const currentLook = new this.THREE.Vector3().lerpVectors(
      this.presetStartLook,
      this.presetEndLook,
      t
    );

    this.$.setCameraPosition(currentPos.x, currentPos.y, currentPos.z);
    this.$.setCameraLookAt(currentLook.x, currentLook.y, currentLook.z);
  }

  updateDollyMode(delta) {
    // Dolly zoom effect (Vertigo effect)
    // Move camera in/out while adjusting FOV to keep subject same size

    const currentDistance = Math.sqrt(
      this.$.camera.position.x ** 2 +
      this.$.camera.position.z ** 2
    );

    let newDistance = currentDistance + this.dollyDirection * delta * this.dollySpeed;

    // Reverse direction at limits
    if (newDistance >= this.dollyMaxDistance) {
      this.dollyDirection = -1;
      newDistance = this.dollyMaxDistance;
    } else if (newDistance <= this.dollyMinDistance) {
      this.dollyDirection = 1;
      newDistance = this.dollyMinDistance;
    }

    // Calculate new position
    const angle = Math.atan2(this.$.camera.position.z, this.$.camera.position.x);
    const x = Math.cos(angle) * newDistance;
    const z = Math.sin(angle) * newDistance;

    this.$.setCameraPosition(x, 1.5, z);
    this.$.setCameraLookAt(0, 1, 0);

    // Adjust FOV to maintain subject size (if PerspectiveCamera)
    if (this.$.camera.fov !== undefined) {
      // Dolly zoom formula: FOV increases as distance increases
      const baseFov = 50;
      const fovScale = newDistance / ((this.dollyMinDistance + this.dollyMaxDistance) / 2);
      this.$.camera.fov = baseFov * fovScale;
      this.$.camera.updateProjectionMatrix();
    }
  }

  updateShakeMode(delta) {
    // Camera shake effect
    const time = this.$.getElapsedTime();

    // Perlin-like noise using multiple sine waves
    const shakeX = Math.sin(time * this.shakeFrequency) * this.shakeIntensity +
                   Math.sin(time * this.shakeFrequency * 2.3) * this.shakeIntensity * 0.5;

    const shakeY = Math.sin(time * this.shakeFrequency * 1.7) * this.shakeIntensity +
                   Math.sin(time * this.shakeFrequency * 3.1) * this.shakeIntensity * 0.5;

    const shakeZ = Math.sin(time * this.shakeFrequency * 1.3) * this.shakeIntensity +
                   Math.sin(time * this.shakeFrequency * 2.7) * this.shakeIntensity * 0.5;

    // Gradually increase shake intensity over time
    const intensityScale = Math.min(this.modeTimer / 2, 1);

    this.$.setCameraPosition(
      this.baseShakePosition.x + shakeX * intensityScale,
      this.baseShakePosition.y + shakeY * intensityScale,
      this.baseShakePosition.z + shakeZ * intensityScale
    );
    this.$.setCameraLookAt(0, 1, 0);
  }

  updateFollowMode(delta) {
    // Smooth follow camera (tracks model's head position)
    const model = this.$.getModel();

    if (model && model.vrm) {
      // Get head bone position
      const headBone = model.vrm.humanoid?.getNormalizedBoneNode('head');

      if (headBone) {
        // Get world position of head
        const headWorldPos = new this.THREE.Vector3();
        headBone.getWorldPosition(headWorldPos);

        // Calculate desired camera position (behind and above)
        const cameraOffset = new this.THREE.Vector3(0, 0.3, this.followDistance);

        // Rotate offset to face the head's direction
        const headRotation = new this.THREE.Quaternion();
        headBone.getWorldQuaternion(headRotation);
        cameraOffset.applyQuaternion(headRotation);

        const desiredPos = headWorldPos.clone().add(cameraOffset);

        // Smooth lerp to desired position
        const currentPos = this.$.camera.position.clone();
        const newPos = currentPos.lerp(desiredPos, delta * this.followLerpSpeed);

        this.$.setCameraPosition(newPos.x, newPos.y, newPos.z);
        this.$.setCameraLookAt(headWorldPos.x, headWorldPos.y, headWorldPos.z);

        return;
      }
    }

    // Fallback if no model/head bone
    this.$.setCameraPosition(0, 1.8, this.followDistance);
    this.$.setCameraLookAt(0, 1.3, 0);
  }

  // Easing function for smooth transitions
  easeInOutCubic(t) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  async cleanup() {
    // Reset camera FOV if it was modified
    if (this.$.camera.fov !== undefined) {
      this.$.camera.fov = 50;
      this.$.camera.updateProjectionMatrix();
    }

    console.log('[CameraAnimation] Cleanup complete');
  }
}
