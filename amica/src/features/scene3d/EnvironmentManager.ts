import * as THREE from "three";
import { Room } from "./EnvironmentRoom";

export class EnvironmentManager {
  private room?: Room;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
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
    await this.room.loadRoom(url, setLoadingProgress);
    setLoadingProgress(`Room load complete`);

    if (!this.room?.room) return;

    this.room.room.position.set(pos.x, pos.y, pos.z);
    this.room.room.rotation.set(rot.x, rot.y, rot.z);
    this.room.room.scale.set(scale.x, scale.y, scale.z);
    this.scene.add(this.room.room);
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
