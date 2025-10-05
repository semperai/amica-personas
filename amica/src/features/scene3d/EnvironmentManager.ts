import * as THREE from "three";
import { Room } from "./EnvironmentRoom";
import { setLoadingStage, completeLoading } from "@/utils/fileLoadingProgress";

export class EnvironmentManager {
  private room?: Room;
  private scene: THREE.Scene;
  private onRoomLoadedCallback?: () => void;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public setOnRoomLoadedCallback(callback: () => void): void {
    this.onRoomLoadedCallback = callback;
  }

  public async loadRoom(
    url: string,
    pos: THREE.Vector3,
    rot: THREE.Euler,
    scale: THREE.Vector3,
    setLoadingProgress: (progress: string) => void,
  ) {
    if (this.room?.room) {
      this.unloadRoom();
    }

    this.room = new Room();
    setLoadingProgress("Loading room");
    setLoadingStage("Loading environment...", 85);

    // Wrap the room's progress callback to update our loading stage
    await this.room.loadRoom(url, (progress: string) => {
      setLoadingProgress(progress);
      // Extract percentage from progress string like "45.67% loaded"
      const match = progress.match(/(\d+\.?\d*)\s*%/);
      if (match) {
        const percentage = parseFloat(match[1]);
        // Map room loading (0-100%) to our overall progress (85-95%)
        const overallProgress = 85 + (percentage / 100) * 10;
        setLoadingStage(`Loading environment... ${Math.round(percentage)}%`, overallProgress);
      }
    });

    setLoadingProgress(`Room load complete`);
    setLoadingStage("Environment loaded", 95);

    if (!this.room?.room) return;

    this.room.room.position.set(pos.x, pos.y, pos.z);
    this.room.room.rotation.set(rot.x, rot.y, rot.z);
    this.room.room.scale.set(scale.x, scale.y, scale.z);
    this.scene.add(this.room.room);

    // Notify that room was loaded
    if (this.onRoomLoadedCallback) {
      this.onRoomLoadedCallback();
    }

    setLoadingStage("Ready!", 100);
    // Complete loading after a brief delay to show 100%
    setTimeout(() => completeLoading(), 500);
  }

  public unloadRoom(): void {
    if (this.room?.room) {
      this.scene.remove(this.room.room);
    }
  }

  public async loadSplat(url: string) {
    if (!this.room) {
      this.room = new Room();
    }

    await this.room.loadSplat(url);
    console.log("splat loaded");

    if (!this.room?.splat) return;

    this.room.splat.position.set(0, 4, 0);
    this.room.splat.rotation.set(0, 0, Math.PI);
    this.scene.add(this.room.splat);
  }

  public getRoom(): Room | undefined {
    return this.room;
  }

  public updateSplat(renderer: THREE.WebGLRenderer | undefined, camera: THREE.PerspectiveCamera | undefined) {
    this.room?.splat?.update(renderer, camera);
    this.room?.splat?.render();
  }
}
