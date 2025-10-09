import { useEffect, useState } from "react";

type LoadingFile = {
  file: string;
  progress: number;
}

type LoadingStage = {
  stage: string;
  progress: number;
}

const FUNNY_LOADING_MESSAGES = [
  "Reticulating splines...",
  "Calibrating personality matrix...",
  "Teaching VRM model to smile...",
  "Adding random gestures...",
  "Downloading enthusiasm...",
  "Initializing small talk protocols...",
  "Charging social batteries...",
  "Practicing friendly waves...",
  "Loading conversation starters...",
  "Tuning voice synthesizer...",
  "Adjusting eye contact settings...",
  "Warming up animation joints...",
  "Syncing facial expressions...",
  "Buffering charisma...",
  "Installing sense of humor...",
  "Polishing virtual appearance...",
  "Stretching polygons...",
  "Applying finishing touches...",
  "Testing virtual reality...",
  "Summoning digital presence...",
];

// ============================================================================
// DEBUG OPTIONS - For design/development work on the loading screen
// ============================================================================
// Set DEBUG_FREEZE_LOADING to true to freeze the loading bar at a specific state.
// This allows you to work on the design without the loading bar disappearing.
// The funny messages will still rotate every 2 seconds.
//
// Example loading stages you can use:
//   - "Initializing scene..." (10%)
//   - "Setting up scenario..." (30%)
//   - "Loading VRM model... 45%" (40-60%)
//   - "Processing VRM model..." (58%)
//   - "Loading animation... 67%" (70-80%)
//   - "Loading environment... 82%" (85-95%)
//   - "Ready!" (100%)
// ============================================================================

const DEBUG_FREEZE_LOADING = false;
const DEBUG_FROZEN_STAGE: LoadingStage = {
  stage: "Loading VRM model... 45%",
  progress: 52.5,
};

// Progress bar gradient - cyan to blue
const PROGRESS_BAR_GRADIENT = "from-cyan-400 via-blue-500 to-blue-600";

export function LoadingProgress() {
  if (typeof window !== "undefined") {
    if(! (window as any).chatvrm_loading_progress) {
      (window as any).chatvrm_loading_progress = {};
      (window as any).chatvrm_loading_progress_cnt = 0;
    }
    if(! (window as any).chatvrm_loading_stage) {
      (window as any).chatvrm_loading_stage = null;
      (window as any).chatvrm_loading_stage_cnt = 0;
    }
  }

  const [files, setFiles] = useState<LoadingFile[]>([]);
  const [progressCnt, setProgressCnt] = useState(0);
  const [loadingStage, setLoadingStage] = useState<LoadingStage | null>(
    DEBUG_FREEZE_LOADING ? DEBUG_FROZEN_STAGE : null
  );
  const [stageCnt, setStageCnt] = useState(0);
  const [funnyMessage, setFunnyMessage] = useState("");
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    // Set initial funny message
    setFunnyMessage(FUNNY_LOADING_MESSAGES[Math.floor(Math.random() * FUNNY_LOADING_MESSAGES.length)]);

    // If debug freeze is enabled, don't update from window
    if (DEBUG_FREEZE_LOADING) {
      // Still update funny messages
      const funnyInterval = setInterval(() => {
        setFunnyMessage(FUNNY_LOADING_MESSAGES[Math.floor(Math.random() * FUNNY_LOADING_MESSAGES.length)]);
      }, 2000);
      return () => clearInterval(funnyInterval);
    }

    const interval = setInterval(() => {
      if (typeof window !== "undefined") {
        const progress = (window as any).chatvrm_loading_progress;
        const cnt = (window as any).chatvrm_loading_progress_cnt;
        if (progressCnt !== cnt) {
          setFiles(Object.entries(progress).map(([k, v]) => ({
            file: k as string,
            progress: v as number,
          })));
          setProgressCnt(cnt);
        }

        const stage = (window as any).chatvrm_loading_stage;
        const stageCntWindow = (window as any).chatvrm_loading_stage_cnt;
        if (stageCnt !== stageCntWindow) {
          setLoadingStage(stage);
          setStageCnt(stageCntWindow);

          // When loading completes, add delay before hiding
          if (stage === null && shouldShow) {
            setTimeout(() => {
              setShouldShow(false);
            }, 200);
          } else if (stage !== null) {
            setShouldShow(true);
          }
        }
      }
    }, 100);

    // Change funny message every 2 seconds
    const funnyInterval = setInterval(() => {
      setFunnyMessage(FUNNY_LOADING_MESSAGES[Math.floor(Math.random() * FUNNY_LOADING_MESSAGES.length)]);
    }, 2000);

    return () => {
      clearInterval(interval);
      clearInterval(funnyInterval);
    };
  }, [progressCnt, stageCnt, shouldShow]);

  return (
    <>
      {/* Main loading bar overlay */}
      {(loadingStage || shouldShow) && loadingStage && (
        <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-white via-gray-50 to-gray-100 z-[9999] p-4" style={{ fontFamily: 'Fredoka, sans-serif' }}>
          <div className="w-full max-w-[600px] px-4 sm:px-8">
            {/* Stage text - larger on mobile */}
            <div className="text-gray-800 text-xl sm:text-2xl md:text-3xl mb-4 sm:mb-6 text-center font-bold tracking-wide">
              {loadingStage.stage}
            </div>

            {/* Progress bar - thicker on mobile */}
            <div className="w-full bg-gray-200 rounded-2xl sm:rounded-3xl h-10 sm:h-12 md:h-14 overflow-hidden shadow-lg border-2 border-gray-300">
              <div
                className={`bg-gradient-to-r ${PROGRESS_BAR_GRADIENT} h-full rounded-xl sm:rounded-2xl transition-all duration-500 ease-out relative overflow-hidden`}
                style={{ width: `${loadingStage.progress}%` }}
              >
                {/* Animated shine effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-40 animate-shimmer"
                     style={{
                       backgroundSize: '200% 100%',
                       animation: 'shimmer 2s infinite linear'
                     }}
                />
              </div>
            </div>

            {/* Percentage - larger on mobile */}
            <div className="text-gray-900 text-2xl sm:text-3xl md:text-4xl mt-4 sm:mt-5 text-center font-bold">
              {Math.round(loadingStage.progress)}%
            </div>

            {/* Funny message - larger and more readable on mobile */}
            <div className="text-gray-600 text-base sm:text-lg md:text-xl mt-4 sm:mt-6 text-center min-h-[2rem] font-medium px-4">
              {funnyMessage}
            </div>
          </div>
        </div>
      )}

      {/* File loading details (only show when not in main loading stage) */}
      {!loadingStage && files.length > 0 && (
        <div className="absolute top-16 right-0 mt-4 pt-16 pr-2 w-30 text-white text-xs z-20 text-right">
          <div>
            [loading files]
          </div>
          {files.map((row) => (
            <div key={row.file}>
              {row.file}: {((row.progress * 100)|0)/100}%
            </div>
          ))}
        </div>
      )}
    </>
  );
}
