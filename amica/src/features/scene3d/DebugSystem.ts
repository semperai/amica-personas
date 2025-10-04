import * as THREE from "three";
import GUI from "lil-gui";
import Stats from "stats.js";
import { HTMLMesh } from "three/addons/interactive/HTMLMesh.js";
import { InteractiveGroup } from "three/addons/interactive/InteractiveGroup.js";

export interface DebugParams {
  "y-offset": number;
  "room-x": number;
  "room-y": number;
  "room-z": number;
  "room-scale": number;
}

export class DebugSystem {
  private gui: GUI;
  private guiMesh: HTMLMesh;
  private stats: Stats;
  private statsMesh: HTMLMesh;

  // Stats panels
  private updateMsPanel: any;
  private renderMsPanel: any;
  private scenarioMsPanel: any;
  private physicsMsPanel: any;
  private modelMsPanel: any;
  private bvhMsPanel: any;
  private raycastMsPanel: any;
  private statsMsPanel: any;

  // Debug visualization
  private closestPart1: THREE.Mesh;
  private closestPart2: THREE.Mesh;

  public params: DebugParams = {
    "y-offset": 0,
    "room-x": 0,
    "room-y": 0,
    "room-z": 0,
    "room-scale": 1,
  };

  constructor() {
    // Initialize GUI
    this.gui = new GUI();
    this.gui.domElement.style.marginTop = "56px";

    // Initialize Stats
    this.stats = new Stats();
    this.stats.dom.style.width = "80px";
    this.stats.dom.style.height = "48px";
    this.stats.dom.style.position = "absolute";
    this.stats.dom.style.top = "56px";
    this.stats.dom.style.left = window.innerWidth - 80 + "px";
    document.body.appendChild(this.stats.dom);

    // Setup stats panels
    this.updateMsPanel = this.stats.addPanel(new Stats.Panel("update_ms", "#fff", "#221"));
    this.renderMsPanel = this.stats.addPanel(new Stats.Panel("render_ms", "#ff8", "#221"));
    this.scenarioMsPanel = this.stats.addPanel(new Stats.Panel("scenario_ms", "#f8f", "#221"));
    this.physicsMsPanel = this.stats.addPanel(new Stats.Panel("physics_ms", "#88f", "#212"));
    this.modelMsPanel = this.stats.addPanel(new Stats.Panel("model_ms", "#f8f", "#212"));
    this.bvhMsPanel = this.stats.addPanel(new Stats.Panel("bvh_ms", "#8ff", "#122"));
    this.raycastMsPanel = this.stats.addPanel(new Stats.Panel("raycast_ms", "#f8f", "#212"));
    this.statsMsPanel = this.stats.addPanel(new Stats.Panel("stats_ms", "#8f8", "#212"));

    // Create GUI mesh
    this.guiMesh = new HTMLMesh(this.gui.domElement);
    this.guiMesh.position.set(0, 0, 0);
    this.guiMesh.scale.setScalar(2);

    // Create stats mesh
    this.statsMesh = new HTMLMesh(this.stats.dom);
    this.statsMesh.position.set(0, 0.25, 0);
    this.statsMesh.scale.setScalar(2.5);

    // Create debug visualization meshes
    const geometry = new THREE.SphereGeometry(1, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.5,
    });
    this.closestPart1 = new THREE.Mesh(geometry, material);
    this.closestPart2 = new THREE.Mesh(geometry, material);
    this.closestPart1.visible = false;
    this.closestPart2.visible = false;
  }

  public setupGUIControls(
    onRoomXChange: (value: number) => void,
    onRoomYChange: (value: number) => void,
    onRoomZChange: (value: number) => void,
    onRoomScaleChange: (value: number) => void,
    onYOffsetChange: (value: number) => void,
  ) {
    this.gui.add(this.params, "room-x", -10, 10).onChange(onRoomXChange);
    this.gui.add(this.params, "room-y", -10, 10).onChange(onRoomYChange);
    this.gui.add(this.params, "room-z", -10, 10).onChange(onRoomZChange);
    this.gui.add(this.params, "room-scale", 0, 1).onChange(onRoomScaleChange);

    let updateDebounceId: ReturnType<typeof setTimeout> | null = null;
    this.gui.add(this.params, "y-offset", -0.2, 0.2).onChange((value: number) => {
      if (updateDebounceId) {
        clearTimeout(updateDebounceId);
      }
      updateDebounceId = setTimeout(() => {
        onYOffsetChange(value);
        this.params["y-offset"] = 0;
      }, 1000);
    });
  }

  public addToInteractiveGroup(igroup: InteractiveGroup) {
    igroup.add(this.guiMesh);
    igroup.add(this.statsMesh);
  }

  public addToScene(scene: THREE.Scene) {
    scene.add(this.closestPart1);
    scene.add(this.closestPart2);
  }

  public updateGUIDisplay() {
    this.gui.controllers.forEach((c) => {
      c.updateDisplay();
    });
  }

  public updateStats() {
    this.stats.update();
  }

  public updateStatsMeshTexture() {
    // @ts-ignore
    this.statsMesh.material.map.update();
    // @ts-ignore
    this.guiMesh.material.map.update();
  }

  // Performance monitoring methods
  public recordUpdateTime(ms: number) {
    this.updateMsPanel.update(ms, 40);
  }

  public recordRenderTime(ms: number) {
    this.renderMsPanel.update(ms, 100);
  }

  public recordScenarioTime(ms: number) {
    this.scenarioMsPanel.update(ms, 100);
  }

  public recordPhysicsTime(ms: number) {
    this.physicsMsPanel.update(ms, 100);
  }

  public recordModelTime(ms: number) {
    this.modelMsPanel.update(ms, 40);
  }

  public recordBVHTime(ms: number) {
    this.bvhMsPanel.update(ms, 100);
  }

  public recordRaycastTime(ms: number) {
    this.raycastMsPanel.update(ms, 100);
  }

  public recordStatsTime(ms: number) {
    this.statsMsPanel.update(ms, 100);
  }

  // Debug visualization
  public getClosestPart1(): THREE.Mesh {
    return this.closestPart1;
  }

  public getClosestPart2(): THREE.Mesh {
    return this.closestPart2;
  }

  public hslToRgb(h: number, s: number, l: number): number {
    let r, g, b;

    if (s == 0) {
      r = g = b = l; // achromatic
    } else {
      function hue2rgb(p: number, q: number, t: number) {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      }

      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var p = 2 * l - q;

      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    return parseInt(
      `0x` +
        [r * 255, g * 255, b * 255]
          .map(Math.floor)
          .map((v) => v.toString(16).padStart(2, "0"))
          .join(""),
    );
  }

  public createBallAtPoint(
    scene: THREE.Scene,
    point: THREE.Vector3,
    cameraPosition: THREE.Vector3,
    itype: number = 0,
  ) {
    return; // disabled by default

    const distance = point.distanceTo(cameraPosition);
    const s = 5;
    const h = distance * s - Math.floor(distance * s);

    const getAmicaColor = () => {
      return this.hslToRgb(h, 1, 0.5);
    };
    const getRoomColor = () => {
      return this.hslToRgb(h, 0.1, 0.4);
    };

    const color = itype == 0 ? getAmicaColor() : getRoomColor();

    const ballMaterial = new THREE.MeshBasicMaterial({ color });
    const ballGeometry = new THREE.SphereGeometry(0.005, 16, 16);
    const ball = new THREE.Mesh(ballGeometry, ballMaterial);
    ball.position.copy(point);
    scene.add(ball);

    setTimeout(() => {
      scene.remove(ball);
    }, 10000);
  }
}
