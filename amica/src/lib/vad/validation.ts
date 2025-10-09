import { log } from "./logging"

/**
 * Error types that can occur during VAD initialization or operation
 */
export class VADError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message)
    this.name = "VADError"
  }
}

export class AudioConstraintsError extends VADError {
  constructor(message: string, cause?: Error) {
    super(message, "AUDIO_CONSTRAINTS_ERROR", cause)
    this.name = "AudioConstraintsError"
  }
}

export class ModelLoadError extends VADError {
  constructor(message: string, cause?: Error) {
    super(message, "MODEL_LOAD_ERROR", cause)
    this.name = "ModelLoadError"
  }
}

export class WorkletLoadError extends VADError {
  constructor(message: string, cause?: Error) {
    super(message, "WORKLET_LOAD_ERROR", cause)
    this.name = "WorkletLoadError"
  }
}

export class AudioContextError extends VADError {
  constructor(message: string, cause?: Error) {
    super(message, "AUDIO_CONTEXT_ERROR", cause)
    this.name = "AudioContextError"
  }
}

/**
 * Validate audio constraints before requesting user media
 */
export function validateAudioConstraints(
  constraints: MediaTrackConstraints
): void {
  log.debug("Validating audio constraints:", constraints)

  // Check channel count
  if (constraints.channelCount) {
    const channelCount =
      typeof constraints.channelCount === "number"
        ? constraints.channelCount
        : (constraints.channelCount as ConstrainULongRange).ideal ??
          (constraints.channelCount as ConstrainULongRange).exact

    if (channelCount && channelCount !== 1) {
      log.warn(
        `VAD works best with mono audio (channelCount: 1), got ${channelCount}`
      )
    }
  }

  // Check sample rate
  if (constraints.sampleRate) {
    const sampleRate =
      typeof constraints.sampleRate === "number"
        ? constraints.sampleRate
        : (constraints.sampleRate as ConstrainULongRange).ideal ??
          (constraints.sampleRate as ConstrainULongRange).exact

    if (sampleRate && sampleRate < 16000) {
      throw new AudioConstraintsError(
        `Sample rate must be at least 16000 Hz, got ${sampleRate} Hz`
      )
    }
  }

  // Warn about audio processing flags that might interfere with VAD
  if (constraints.noiseSuppression === false) {
    log.warn(
      "Noise suppression is disabled. This may reduce VAD accuracy in noisy environments."
    )
  }

  if (constraints.echoCancellation === false) {
    log.warn(
      "Echo cancellation is disabled. This may cause false positives if system audio is playing."
    )
  }

  log.debug("Audio constraints validation passed")
}

/**
 * Check if getUserMedia is available in the current environment
 */
export function checkUserMediaSupport(): void {
  if (!navigator?.mediaDevices?.getUserMedia) {
    throw new AudioConstraintsError(
      "getUserMedia is not supported in this browser. VAD requires microphone access."
    )
  }

  log.debug("getUserMedia support confirmed")
}

/**
 * Check if AudioWorklet is supported
 */
export function checkAudioWorkletSupport(ctx: AudioContext): boolean {
  const hasWorklet =
    "audioWorklet" in ctx && typeof AudioWorkletNode === "function"

  if (!hasWorklet) {
    log.warn(
      "AudioWorklet is not supported. Falling back to ScriptProcessorNode (deprecated)."
    )
  } else {
    log.debug("AudioWorklet support confirmed")
  }

  return hasWorklet
}

/**
 * Validate model file URL
 */
export function validateModelURL(url: string): void {
  try {
    new URL(url, window.location.origin)
  } catch (e) {
    throw new ModelLoadError(`Invalid model URL: ${url}`, e as Error)
  }
}

/**
 * Validate worklet file URL
 */
export function validateWorkletURL(url: string): void {
  try {
    new URL(url, window.location.origin)
  } catch (e) {
    throw new WorkletLoadError(`Invalid worklet URL: ${url}`, e as Error)
  }
}

/**
 * Validate AudioContext state
 */
export function validateAudioContextState(ctx: AudioContext): void {
  if (ctx.state === "closed") {
    throw new AudioContextError(
      "AudioContext is closed. Cannot initialize VAD."
    )
  }

  if (ctx.state === "suspended") {
    log.warn(
      "AudioContext is suspended. It will be resumed when VAD starts."
    )
  }

  log.debug("AudioContext state validated:", ctx.state)
}

/**
 * Check browser compatibility for VAD features
 */
export interface BrowserCompatibility {
  getUserMedia: boolean
  audioWorklet: boolean
  audioContext: boolean
  onnxRuntime: boolean
  warnings: string[]
}

export function checkBrowserCompatibility(): BrowserCompatibility {
  const warnings: string[] = []
  const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent)
  const isBrave = !!(navigator as any).brave
  const isChromeMobile = /chrome.*mobile/i.test(navigator.userAgent)

  const getUserMedia = !!navigator?.mediaDevices?.getUserMedia
  if (!getUserMedia) {
    warnings.push("getUserMedia API not available")
  } else if (isMobile && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
    warnings.push("Mobile browsers require HTTPS for microphone access")
  }

  const audioContext = typeof AudioContext !== "undefined"
  if (!audioContext) {
    warnings.push("AudioContext API not available")
  } else if (isMobile) {
    warnings.push("Mobile browsers may require user interaction before AudioContext can start")
  }

  const audioWorklet =
    audioContext &&
    "audioWorklet" in AudioContext.prototype &&
    typeof AudioWorkletNode === "function"
  if (!audioWorklet) {
    warnings.push("AudioWorklet API not available (will use fallback)")
  } else if (isChromeMobile) {
    warnings.push("Chrome on Android may have limited AudioWorklet support")
  }

  // Check for ONNX Runtime dependencies
  const onnxRuntime =
    typeof WebAssembly !== "undefined" &&
    typeof SharedArrayBuffer !== "undefined"
  if (!onnxRuntime) {
    warnings.push(
      "WebAssembly or SharedArrayBuffer not available. ONNX Runtime may not work."
    )
  } else if (typeof SharedArrayBuffer === "undefined") {
    if (isBrave) {
      warnings.push(
        "SharedArrayBuffer not available in Brave. Server must send Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy headers."
      )
    } else {
      warnings.push(
        "SharedArrayBuffer not available. Ensure server sends proper COOP/COEP headers."
      )
    }
  }

  const result: BrowserCompatibility = {
    getUserMedia,
    audioWorklet,
    audioContext,
    onnxRuntime,
    warnings,
  }

  if (warnings.length > 0) {
    log.warn("Browser compatibility warnings:", warnings)
    if (isMobile) {
      log.warn("Mobile browser detected. VAD may require additional user interaction.")
    }
  } else {
    log.info("Browser is fully compatible with VAD")
  }

  return result
}
