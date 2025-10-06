import { log } from "./logging"

/**
 * Performance metrics for VAD operations
 */
export interface VADPerformanceMetrics {
  /** Total frames processed */
  framesProcessed: number
  /** Average time to process a single frame (ms) */
  avgFrameProcessingTime: number
  /** Maximum time to process a single frame (ms) */
  maxFrameProcessingTime: number
  /** Minimum time to process a single frame (ms) */
  minFrameProcessingTime: number
  /** Average model inference time (ms) */
  avgModelInferenceTime: number
  /** Time taken to load the model (ms) */
  modelLoadTime: number
  /** Time taken to load the worklet (ms) */
  workletLoadTime: number
  /** Time taken to initialize VAD (ms) */
  initializationTime: number
  /** Number of speech segments detected */
  speechSegmentsDetected: number
  /** Number of VAD misfires */
  vadMisfires: number
}

/**
 * Performance tracker for VAD operations
 */
export class VADPerformanceTracker {
  private enabled: boolean
  private frameProcessingTimes: number[] = []
  private modelInferenceTimes: number[] = []
  private metrics: VADPerformanceMetrics = {
    framesProcessed: 0,
    avgFrameProcessingTime: 0,
    maxFrameProcessingTime: 0,
    minFrameProcessingTime: Infinity,
    avgModelInferenceTime: 0,
    modelLoadTime: 0,
    workletLoadTime: 0,
    initializationTime: 0,
    speechSegmentsDetected: 0,
    vadMisfires: 0,
  }

  // Keep only last N samples for averages
  private readonly maxSamples = 1000

  constructor(enabled = false) {
    this.enabled = enabled
    if (enabled) {
      log.info("Performance tracking enabled")
    }
  }

  /**
   * Enable or disable performance tracking
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (enabled) {
      log.info("Performance tracking enabled")
    } else {
      log.info("Performance tracking disabled")
    }
  }

  /**
   * Start timing an operation
   */
  startTiming(): PerformanceTimer {
    if (!this.enabled) {
      return new PerformanceTimer(false)
    }
    return new PerformanceTimer(true)
  }

  /**
   * Record frame processing time
   */
  recordFrameProcessing(durationMs: number): void {
    if (!this.enabled) return

    this.metrics.framesProcessed++
    this.frameProcessingTimes.push(durationMs)

    // Keep only recent samples
    if (this.frameProcessingTimes.length > this.maxSamples) {
      this.frameProcessingTimes.shift()
    }

    // Update min/max
    if (durationMs > this.metrics.maxFrameProcessingTime) {
      this.metrics.maxFrameProcessingTime = durationMs
    }
    if (durationMs < this.metrics.minFrameProcessingTime) {
      this.metrics.minFrameProcessingTime = durationMs
    }

    // Update average
    const sum = this.frameProcessingTimes.reduce((a, b) => a + b, 0)
    this.metrics.avgFrameProcessingTime =
      sum / this.frameProcessingTimes.length
  }

  /**
   * Record model inference time
   */
  recordModelInference(durationMs: number): void {
    if (!this.enabled) return

    this.modelInferenceTimes.push(durationMs)

    // Keep only recent samples
    if (this.modelInferenceTimes.length > this.maxSamples) {
      this.modelInferenceTimes.shift()
    }

    // Update average
    const sum = this.modelInferenceTimes.reduce((a, b) => a + b, 0)
    this.metrics.avgModelInferenceTime = sum / this.modelInferenceTimes.length
  }

  /**
   * Record model load time
   */
  recordModelLoad(durationMs: number): void {
    if (!this.enabled) return

    this.metrics.modelLoadTime = durationMs
    log.info(`Model loaded in ${durationMs.toFixed(2)}ms`)
  }

  /**
   * Record worklet load time
   */
  recordWorkletLoad(durationMs: number): void {
    if (!this.enabled) return

    this.metrics.workletLoadTime = durationMs
    log.info(`Worklet loaded in ${durationMs.toFixed(2)}ms`)
  }

  /**
   * Record initialization time
   */
  recordInitialization(durationMs: number): void {
    if (!this.enabled) return

    this.metrics.initializationTime = durationMs
    log.info(`VAD initialized in ${durationMs.toFixed(2)}ms`)
  }

  /**
   * Record speech segment detected
   */
  recordSpeechSegment(): void {
    if (!this.enabled) return

    this.metrics.speechSegmentsDetected++
  }

  /**
   * Record VAD misfire
   */
  recordMisfire(): void {
    if (!this.enabled) return

    this.metrics.vadMisfires++
  }

  /**
   * Get current metrics
   */
  getMetrics(): Readonly<VADPerformanceMetrics> {
    return { ...this.metrics }
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.frameProcessingTimes = []
    this.modelInferenceTimes = []
    this.metrics = {
      framesProcessed: 0,
      avgFrameProcessingTime: 0,
      maxFrameProcessingTime: 0,
      minFrameProcessingTime: Infinity,
      avgModelInferenceTime: 0,
      modelLoadTime: 0,
      workletLoadTime: 0,
      initializationTime: 0,
      speechSegmentsDetected: 0,
      vadMisfires: 0,
    }
    log.info("Performance metrics reset")
  }

  /**
   * Log current metrics summary
   */
  logSummary(): void {
    if (!this.enabled) {
      log.warn("Performance tracking is disabled")
      return
    }

    const m = this.metrics
    log.info("=== VAD Performance Summary ===")
    log.info(`Initialization: ${m.initializationTime.toFixed(2)}ms`)
    log.info(`Model Load: ${m.modelLoadTime.toFixed(2)}ms`)
    log.info(`Worklet Load: ${m.workletLoadTime.toFixed(2)}ms`)
    log.info(`Frames Processed: ${m.framesProcessed}`)
    log.info(
      `Frame Processing: avg=${m.avgFrameProcessingTime.toFixed(2)}ms, min=${m.minFrameProcessingTime.toFixed(2)}ms, max=${m.maxFrameProcessingTime.toFixed(2)}ms`
    )
    log.info(
      `Model Inference: avg=${m.avgModelInferenceTime.toFixed(2)}ms`
    )
    log.info(`Speech Segments: ${m.speechSegmentsDetected}`)
    log.info(`VAD Misfires: ${m.vadMisfires}`)
    log.info("===============================")
  }
}

/**
 * Performance timer helper
 */
export class PerformanceTimer {
  private startTime: number
  private enabled: boolean

  constructor(enabled: boolean) {
    this.enabled = enabled
    this.startTime = enabled ? performance.now() : 0
  }

  /**
   * Get elapsed time in milliseconds
   */
  elapsed(): number {
    if (!this.enabled) return 0
    return performance.now() - this.startTime
  }

  /**
   * End timing and return duration
   */
  end(): number {
    return this.elapsed()
  }
}
