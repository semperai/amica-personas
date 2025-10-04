import * as THREE from "three";
import {
  BatchedParticleRenderer,
  QuarksLoader,
  QuarksUtil,
} from "three.quarks";

export class ParticleManager {
  private particleRenderer: BatchedParticleRenderer;
  private particleCartoonStarField: THREE.Object3D | null = null;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.particleRenderer = new BatchedParticleRenderer();
    this.scene.add(this.particleRenderer);

    // Disabled particle loading - file not found
    // new QuarksLoader().load('particles/cartoon_star_field', (obj) => {
    //   this.particleCartoonStarField = obj;
    // });
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

  public getRenderer(): BatchedParticleRenderer {
    return this.particleRenderer;
  }
}
