import * as THREE from "three";
import { Model } from "./model";
import { loadVRMAnimation } from "@/lib/VRMAnimation/loadVRMAnimation";
import { loadMixamoAnimation } from "@/lib/VRMAnimation/loadMixamoAnimation";
import { config } from "@/utils/config";

export class VRMManager {
  private model?: Model;
  private camera: THREE.Object3D;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene, camera: THREE.Object3D) {
    this.scene = scene;
    this.camera = camera;
  }

  public async loadVrm(
    url: string,
    setLoadingProgress: (progress: string) => void,
  ) {
    if (this.model?.vrm) {
      this.unloadVRM();
    }

    setLoadingProgress("Loading VRM");

    this.model = new Model(this.camera);
    await this.model.loadVRM(url, setLoadingProgress);
    setLoadingProgress("VRM loaded");

    if (!this.model?.vrm) return;

    this.scene.add(this.model.vrm.scene);

    // Load animation if not using procedural animation
    if (config("animation_procedural") !== "true") {
      setLoadingProgress("Loading animation");
      const animation =
        config("animation_url").indexOf("vrma") > 0
          ? await loadVRMAnimation(config("animation_url"))
          : await loadMixamoAnimation(config("animation_url"), this.model?.vrm);
      if (animation) {
        await this.model.loadAnimation(animation);
        this.model.update(0);
      }
    }

    setLoadingProgress("Complete");
  }

  public unloadVRM(): void {
    if (this.model?.vrm) {
      this.scene.remove(this.model.vrm.scene);
      this.model.unLoadVrm();
    }
  }

  public getModel(): Model | undefined {
    return this.model;
  }

  public updateModel(delta: number) {
    try {
      this.model?.update(delta);
    } catch (e) {
      console.error("model update error", e);
    }
  }
}
