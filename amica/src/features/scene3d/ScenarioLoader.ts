import * as THREE from "three";

export class ScenarioLoader {
  private scenario: any;
  private scenarioLoading: boolean = false;

  public async loadScenario(url: string, scope: any, hookManager: any) {
    "use strict";

    this.scenarioLoading = true;
    const res = await fetch(url);
    const classCode = await res.text();

    const ClassDefinition = new Function(`return ${classCode}`)();

    this.scenario = new ClassDefinition({
      scope,
      THREE,
      hookManager,
    });

    await this.scenario.setup();
    this.scenarioLoading = false;
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
