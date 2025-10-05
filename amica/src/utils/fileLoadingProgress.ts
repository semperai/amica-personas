export function updateFileProgress(file: string, progress: number) {
  if (typeof window !== "undefined") {
    if(! (<any>window).chatvrm_loading_progress) {
      (<any>window).chatvrm_loading_progress = {};
      (<any>window).chatvrm_loading_progress_cnt = 0;
    }
  }

  if (progress === 100) {
    delete (<any>window).chatvrm_loading_progress[file];
  } else {
    (<any>window).chatvrm_loading_progress[file] = progress;
  }

  (<any>window).chatvrm_loading_progress_cnt++;
}

export function setLoadingStage(stage: string, progress: number = 0) {
  if (typeof window !== "undefined") {
    if(! (<any>window).chatvrm_loading_stage) {
      (<any>window).chatvrm_loading_stage = { stage: '', progress: 0 };
      (<any>window).chatvrm_loading_stage_cnt = 0;
    }
    (<any>window).chatvrm_loading_stage = { stage, progress };
    (<any>window).chatvrm_loading_stage_cnt++;
  }
}

export function completeLoading() {
  if (typeof window !== "undefined") {
    (<any>window).chatvrm_loading_stage = null;
    (<any>window).chatvrm_loading_stage_cnt++;

    // Show debug UI elements when loading completes
    const statsElements = document.querySelectorAll('.stats-js, .lil-gui');
    statsElements.forEach((el) => {
      if (el instanceof HTMLElement) {
        el.style.display = 'block';
      }
    });
  }
}
