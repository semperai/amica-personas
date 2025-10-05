import * as THREE from "three";
import { Model } from "./VrmCharacterModel";
import { loadVRMAnimation } from "@/lib/VRMAnimation/loadVRMAnimation";
import { loadMixamoAnimation } from "@/lib/VRMAnimation/loadMixamoAnimation";
import { config } from "@/utils/config";
import { setLoadingStage } from "@/utils/fileLoadingProgress";

export class VRMManager {
  private model?: Model;
  private camera: THREE.Object3D;
  private scene: THREE.Scene;
  private loadedWithoutRoom: boolean = false;

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
    setLoadingStage("Loading VRM model...", 40);

    this.model = new Model(this.camera);

    // Wrap the model's progress callback to update our loading stage
    await this.model.loadVRM(url, (progress: string) => {
      setLoadingProgress(progress);
      // Extract percentage from progress string like "45.67% loaded"
      const match = progress.match(/(\d+\.?\d*)\s*%/);
      if (match) {
        const percentage = parseFloat(match[1]);
        // Map VRM loading (0-100%) to our overall progress (40-60%)
        const overallProgress = 40 + (percentage / 100) * 20;
        setLoadingStage(`Loading VRM model... ${Math.round(percentage)}%`, overallProgress);
      } else if (progress.includes("Processing")) {
        setLoadingStage("Processing VRM model...", 58);
      }
    });

    setLoadingProgress("VRM loaded");
    setLoadingStage("VRM model loaded", 60);

    if (!this.model?.vrm) return;

    this.scene.add(this.model.vrm.scene);

    // Load animation if not using procedural animation
    if (config("animation_procedural") !== "true") {
      setLoadingProgress("Loading animation");
      setLoadingStage("Loading animation...", 70);

      // Progress callback for animation loading
      const animationProgressCallback = (progress: string) => {
        // Extract percentage from progress string like "45.67% loaded"
        const match = progress.match(/(\d+\.?\d*)\s*%/);
        if (match) {
          const percentage = parseFloat(match[1]);
          // Map animation loading (0-100%) to our overall progress (70-80%)
          const overallProgress = 70 + (percentage / 100) * 10;
          setLoadingStage(`Loading animation... ${Math.round(percentage)}%`, overallProgress);
        }
      };

      const animation =
        config("animation_url").indexOf("vrma") > 0
          ? await loadVRMAnimation(config("animation_url"), animationProgressCallback)
          : await loadMixamoAnimation(config("animation_url"), this.model?.vrm, animationProgressCallback);
      if (animation) {
        await this.model.loadAnimation(animation);
        this.model.update(0);
      }
      setLoadingStage("Animation loaded", 80);
    } else {
      // Skip to 80% if not loading animation
      setLoadingStage("VRM ready", 80);
    }

    setLoadingProgress("Complete");
    this.loadedWithoutRoom = true;
  }

  public roomWasLoaded(): void {
    this.loadedWithoutRoom = false;
  }

  public shouldCompleteLoadingAfterVrm(): boolean {
    return this.loadedWithoutRoom;
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
