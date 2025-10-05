import * as THREE from "three";
import { setLoadingStage, completeLoading } from "@/utils/fileLoadingProgress";

export class ScenarioLoader {
  private scenario: any;
  private scenarioLoading: boolean = false;
  private onScenarioSetupComplete?: () => void;

  public async loadScenario(url: string, scope: any, hookManager: any) {
    "use strict";

    this.scenarioLoading = true;

    setLoadingStage("Initializing scene...", 10);
    const res = await fetch(url);
    const classCode = await res.text();

    const ClassDefinition = new Function(`return ${classCode}`)();

    this.scenario = new ClassDefinition({
      scope,
      THREE,
      hookManager,
    });

    setLoadingStage("Setting up scenario...", 30);
    await this.scenario.setup();
    this.scenarioLoading = false;

    // Notify that scenario setup is complete
    if (this.onScenarioSetupComplete) {
      this.onScenarioSetupComplete();
    }
  }

  public setOnScenarioSetupComplete(callback: () => void): void {
    this.onScenarioSetupComplete = callback;
  }

  public updateScenario(delta: number) {
    if (!this.scenario || this.scenarioLoading) return;

    try {
      this.scenario.update(delta);
    } catch (e) {
      console.error("scenario update error", e);
    }
  }

  public isLoading(): boolean {
    return this.scenarioLoading;
  }

  public isReady(): boolean {
    return !!this.scenario && !this.scenarioLoading;
  }
}
