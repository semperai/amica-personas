// Local VAD implementation based on @ricky0123/vad-web
// Copied here for easier debugging and modification

export { MicVAD, AudioNodeVAD, getDefaultRealTimeVADOptions, DEFAULT_MODEL, ort } from "./real-time-vad";
export type { RealTimeVADOptions } from "./real-time-vad";
export * as utils from "./utils";
export type { SpeechProbabilities } from "./models/common";
export { configureLogging, getLoggingConfig, type LogConfig } from "./logging";
export {
  validateAudioConstraints,
  checkUserMediaSupport,
  checkBrowserCompatibility,
  VADError,
  AudioConstraintsError,
  ModelLoadError,
  WorkletLoadError,
  AudioContextError,
  type BrowserCompatibility,
} from "./validation";
export { VADPerformanceTracker, PerformanceTimer, type VADPerformanceMetrics } from "./performance";
