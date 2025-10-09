import * as THREE from "three";
import { setLoadingStage, completeLoading } from "@/utils/fileLoadingProgress";
import { config } from "@/utils/config";

export class ScenarioLoader {
  private scenario: any;
  private scenarioLoading: boolean = false;
  private onScenarioSetupComplete?: () => void;

  public async loadScenario(url: string, scope: any, hookManager: any) {
    "use strict";

    this.scenarioLoading = true;

    try {
      console.log('[ScenarioLoader] Starting scenario load from:', url);
      setLoadingStage("Initializing scene...", 15);

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch scenario: ${res.status} ${res.statusText}`);
      }

      const classCode = await res.text();
      console.log('[ScenarioLoader] Scenario code fetched, length:', classCode.length);

      console.log('[ScenarioLoader] Creating scenario class...');
      const ClassDefinition = new Function(`return ${classCode}`)();

      console.log('[ScenarioLoader] Instantiating scenario...');
      this.scenario = new ClassDefinition({
        scope,
        THREE,
        hookManager,
        config,
      });

      setLoadingStage("Setting up scenario...", 35);
      console.log('[ScenarioLoader] Running scenario setup...');
      await this.scenario.setup();

      console.log('[ScenarioLoader] Scenario setup complete');
      this.scenarioLoading = false;

      // Notify that scenario setup is complete
      if (this.onScenarioSetupComplete) {
        console.log('[ScenarioLoader] Notifying scenario setup complete');
        this.onScenarioSetupComplete();
      }

      console.log('[ScenarioLoader] Completing loading...');
      completeLoading();
    } catch (error) {
      console.error('[ScenarioLoader] ERROR during scenario load:', error);
      console.error('[ScenarioLoader] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      this.scenarioLoading = false;

      // Complete loading even on error to show the error properly
      completeLoading();

      // Re-throw to propagate to caller
      throw error;
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
