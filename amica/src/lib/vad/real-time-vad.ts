import * as ortInstance from "onnxruntime-web"
import { defaultModelFetcher } from "./default-model-fetcher"
import {
  FrameProcessor,
  FrameProcessorEvent,
  FrameProcessorOptions,
  defaultFrameProcessorOptions,
  validateOptions,
} from "./frame-processor"
import { log, configureLogging, type LogConfig } from "./logging"
import {
  AudioContextError,
  ModelLoadError,
  WorkletLoadError,
  validateAudioContextState,
  validateModelURL,
  validateWorkletURL,
  checkUserMediaSupport,
} from "./validation"
import { VADPerformanceTracker } from "./performance"
import { Message } from "./messages"
import {
  Model,
  ModelFactory,
  OrtOptions,
  SileroLegacy,
  SileroV5,
  SpeechProbabilities,
} from "./models"
import { Resampler } from "./resampler"

export const DEFAULT_MODEL = "legacy"

interface RealTimeVADCallbacks {
  /** Callback to run after each frame. The size (number of samples) of a frame is given by `frameSamples`. */
  onFrameProcessed: (
    probabilities: SpeechProbabilities,
    frame: Float32Array
  ) => void

  /** Callback to run if speech start was detected but `onSpeechEnd` will not be run because the
   * audio segment is smaller than `minSpeechFrames`.
   */
  onVADMisfire: () => void

  /** Callback to run when speech start is detected */
  onSpeechStart: () => void

  /**
   * Callback to run when speech end is detected.
   * Takes as arg a Float32Array of audio samples between -1 and 1, sample rate 16000.
   * This will not run if the audio segment is smaller than `minSpeechFrames`.
   */
  onSpeechEnd: (audio: Float32Array) => void

  /** Callback to run when speech is detected as valid. (i.e. not a misfire) */
  onSpeechRealStart: () => void
}

type AssetOptions = {
  workletOptions: AudioWorkletNodeOptions
  baseAssetPath: string
  onnxWASMBasePath: string
}

type ModelOptions = {
  model: "v5" | "legacy"
}

export interface RealTimeVADOptions
  extends FrameProcessorOptions,
    RealTimeVADCallbacks,
    OrtOptions,
    AssetOptions,
    ModelOptions {
  getStream: () => Promise<MediaStream>
  pauseStream: (stream: MediaStream) => Promise<void>
  resumeStream: (stream: MediaStream) => Promise<MediaStream>
  startOnLoad: boolean
  /** Configuration for VAD logging behavior */
  logConfig?: Partial<LogConfig>
  /** Enable performance tracking and metrics collection */
  enablePerformanceTracking?: boolean
}

export const ort = ortInstance

const workletFile = "vad.worklet.js" // Use our custom unminified worklet with logging
const sileroV5File = "silero_vad_v5.onnx"
const sileroLegacyFile = "silero_vad_legacy.onnx"

/**
 * Get default configuration options for Real-Time VAD
 * @param model - Which VAD model to use ("v5" or "legacy")
 * @returns Complete VAD configuration with defaults
 */
export const getDefaultRealTimeVADOptions = (
  model: "v5" | "legacy"
): RealTimeVADOptions => {
  return {
    ...defaultFrameProcessorOptions,
    logConfig: { minLevel: "warn" },
    onFrameProcessed: (
      _probabilities: SpeechProbabilities,
      _frame: Float32Array
    ) => {},
    onVADMisfire: () => {
      log.debug("VAD misfire")
    },
    onSpeechStart: () => {
      log.debug("Detected speech start")
    },
    onSpeechEnd: () => {
      log.debug("Detected speech end")
    },
    onSpeechRealStart: () => {
      log.debug("Detected real speech start")
    },
    baseAssetPath: "./",
    onnxWASMBasePath: "./",
    model: model,
    workletOptions: {},
    getStream: async () => {
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          autoGainControl: true,
          noiseSuppression: true,
        },
      })
    },
    pauseStream: async (_stream: MediaStream) => {
      _stream.getTracks().forEach((track) => {
        track.stop()
      })
    },
    resumeStream: async (_stream: MediaStream) => {
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          autoGainControl: true,
          noiseSuppression: true,
        },
      })
    },
    ortConfig: (ort) => {
      ort.env.logLevel = "error"
    },
    startOnLoad: true,
  }
}

/**
 * Voice Activity Detection (VAD) with microphone input
 *
 * @example
 * ```typescript
 * import { MicVAD } from '@/lib/vad';
 *
 * const vad = await MicVAD.new({
 *   model: 'v5',
 *   onSpeechStart: () => console.log('Speech started'),
 *   onSpeechEnd: (audio) => console.log('Speech ended', audio),
 *   logConfig: { minLevel: 'info' },
 *   enablePerformanceTracking: true
 * });
 *
 * await vad.start();
 * // ... later
 * vad.pause();
 * vad.destroy();
 * ```
 */
export class MicVAD {
  public stream?: MediaStream
  private sourceNode?: MediaStreamAudioSourceNode
  private initialized = false
  public performanceTracker: VADPerformanceTracker

  /**
   * Create a new MicVAD instance
   * @param options - Configuration options (partial, will be merged with defaults)
   * @returns Promise resolving to initialized MicVAD instance
   * @throws {AudioConstraintsError} If browser doesn't support required APIs
   * @throws {AudioContextError} If AudioContext creation/initialization fails
   * @throws {ModelLoadError} If VAD model fails to load
   * @throws {WorkletLoadError} If AudioWorklet fails to load
   */
  static async new(options: Partial<RealTimeVADOptions> = {}) {
    let audioContext: AudioContext | undefined
    let audioNodeVAD: AudioNodeVAD | undefined

    const perfTracker = new VADPerformanceTracker(
      options.enablePerformanceTracking ?? false
    )
    const initTimer = perfTracker.startTiming()

    try {
      const fullOptions: RealTimeVADOptions = {
        ...getDefaultRealTimeVADOptions(options.model ?? DEFAULT_MODEL),
        ...options,
      }

      // Configure logging if specified
      if (fullOptions.logConfig) {
        configureLogging(fullOptions.logConfig)
      }

      log.info("Initializing MicVAD")

      // Validate options
      validateOptions(fullOptions)

      // Check browser support
      checkUserMediaSupport()

      // Create and validate AudioContext
      try {
        audioContext = new AudioContext()
        validateAudioContextState(audioContext)
      } catch (error) {
        throw new AudioContextError(
          "Failed to create AudioContext",
          error as Error
        )
      }

      // Initialize AudioNodeVAD
      audioNodeVAD = await AudioNodeVAD.new(audioContext, fullOptions, perfTracker)

      const micVad = new MicVAD(fullOptions, audioContext, audioNodeVAD, perfTracker)

      if (fullOptions.startOnLoad) {
        try {
          await micVad.start()
        } catch (error) {
          log.error("Error starting MicVAD:", error)
          // Don't throw - let user retry with start()
        }
      }

      perfTracker.recordInitialization(initTimer.end())
      log.info("MicVAD initialized successfully")
      return micVad
    } catch (error) {
      // Cleanup on error
      log.error("Failed to initialize MicVAD:", error)

      if (audioNodeVAD) {
        try {
          audioNodeVAD.destroy()
        } catch (cleanupError) {
          log.warn("Error during cleanup:", cleanupError)
        }
      }

      if (audioContext) {
        try {
          await audioContext.close()
        } catch (cleanupError) {
          log.warn("Error closing AudioContext:", cleanupError)
        }
      }

      throw error
    }
  }

  private constructor(
    public options: RealTimeVADOptions,
    private audioContext: AudioContext,
    private audioNodeVAD: AudioNodeVAD,
    performanceTracker: VADPerformanceTracker,
    private listening = false
  ) {
    this.performanceTracker = performanceTracker
  }

  /**
   * Pause VAD processing and stop listening for speech
   */
  pause = () => {
    if (this.stream) {
      this.options.pauseStream(this.stream)
    }
    this.audioNodeVAD.pause()
    this.listening = false
  }

  /**
   * Resume VAD processing after pausing
   * @throws {AudioContextError} If stream resumption fails
   */
  resume = async () => {
    if (!this.stream) {
      log.warn("Stream not initialized")
      return
    }
    this.stream = await this.options.resumeStream(this.stream)
    if (this.sourceNode) {
      this.sourceNode.disconnect()
    }
    this.sourceNode = new MediaStreamAudioSourceNode(this.audioContext, {
      mediaStream: this.stream,
    })
    this.audioNodeVAD.receive(this.sourceNode)

    if (this.audioContext.state === "suspended") {
      try {
        await this.audioContext.resume()
      } catch (error) {
        log.error('Failed to resume AudioContext:', error)
        throw new Error('Failed to resume audio context')
      }
    }
    this.audioNodeVAD.start()
    this.listening = true
  }

  /**
   * Start VAD and begin listening for speech
   * @throws {AudioContextError} If microphone access is denied or stream creation fails
   */
  start = async () => {
    log.debug('[MicVAD] start() called, initialized:', this.initialized, 'stream active:', this.stream?.active)

    try {
      if (!this.initialized) {
        log.debug('[MicVAD] First time initialization')
        this.initialized = true

        try {
          this.stream = await this.options.getStream()
        } catch (error) {
          this.initialized = false
          throw new AudioContextError(
            "Failed to get media stream. Microphone access may be denied.",
            error as Error
          )
        }

        try {
          this.sourceNode = new MediaStreamAudioSourceNode(this.audioContext, {
            mediaStream: this.stream,
          })
          log.debug('[MicVAD] Created MediaStreamAudioSourceNode, now connecting to VAD')
          this.audioNodeVAD.receive(this.sourceNode)
        } catch (error) {
          // Cleanup stream on error
          if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop())
            this.stream = undefined
          }
          this.initialized = false
          throw new AudioContextError(
            "Failed to create audio source node",
            error as Error
          )
        }
      }

      if (!this.stream?.active) {
        log.debug('[MicVAD] Stream not active, resuming')
        await this.resume()
        this.audioNodeVAD.start()
        this.listening = true
      } else {
        log.debug('[MicVAD] Stream already active, just starting processor')
        this.audioNodeVAD.start()
        this.listening = true
      }

      log.info('[MicVAD] Start complete, listening:', this.listening)
    } catch (error) {
      log.error('[MicVAD] Error in start():', error)
      throw error
    }
  }

  /**
   * Destroy VAD instance and clean up all resources
   * Stops all audio streams, disconnects nodes, and closes AudioContext
   */
  destroy = () => {
    if (this.listening) {
      this.pause()
    }
    if (this.stream) {
      this.options.pauseStream(this.stream)
    } else {
      log.warn("Stream not initialized")
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect()
    } else {
      log.warn("Source node not initialized")
    }
    this.audioNodeVAD.destroy()
    try {
      this.audioContext.close()
    } catch (error) {
      log.error('Failed to close AudioContext:', error)
    }
  }

  /**
   * Update frame processor options dynamically
   * @param options - Partial frame processor options to update
   */
  setOptions = (options: Partial<FrameProcessorOptions>) => {
    this.audioNodeVAD.setFrameProcessorOptions(options)
  }
}

/**
 * VAD implementation using AudioNode (AudioWorkletNode or ScriptProcessorNode fallback)
 * Lower-level API than MicVAD - use MicVAD for most use cases
 */
export class AudioNodeVAD {
  private audioNode!: AudioWorkletNode | ScriptProcessorNode
  private frameProcessor: FrameProcessor
  private gainNode?: GainNode
  private resampler?: Resampler
  private performanceTracker: VADPerformanceTracker

  /**
   * Create a new AudioNodeVAD instance
   * @param ctx - AudioContext to use
   * @param options - Configuration options
   * @param perfTracker - Optional performance tracker instance
   * @returns Promise resolving to initialized AudioNodeVAD
   * @throws {ModelLoadError} If VAD model fails to load
   * @throws {WorkletLoadError} If AudioWorklet fails to load
   */
  static async new(
    ctx: AudioContext,
    options: Partial<RealTimeVADOptions> = {},
    perfTracker?: VADPerformanceTracker
  ) {
    const fullOptions: RealTimeVADOptions = {
      ...getDefaultRealTimeVADOptions(options.model ?? DEFAULT_MODEL),
      ...options,
    } as RealTimeVADOptions

    const performanceTracker =
      perfTracker ?? new VADPerformanceTracker(fullOptions.enablePerformanceTracking ?? false)

    // Configure logging if specified
    if (fullOptions.logConfig) {
      configureLogging(fullOptions.logConfig)
    }

    log.info("Initializing AudioNodeVAD")

    // Validate options
    validateOptions(fullOptions)

    // Validate AudioContext
    validateAudioContextState(ctx)

    // Configure ONNX Runtime
    ort.env.wasm.wasmPaths = fullOptions.onnxWASMBasePath
    if (fullOptions.ortConfig !== undefined) {
      fullOptions.ortConfig(ort)
    }

    // Load model
    const modelFile =
      fullOptions.model === "v5" ? sileroV5File : sileroLegacyFile
    const modelURL = fullOptions.baseAssetPath + modelFile

    // Validate model URL
    validateModelURL(modelURL)

    const modelFactory: ModelFactory =
      fullOptions.model === "v5" ? SileroV5.new : SileroLegacy.new

    let model: Model
    try {
      log.info(`Loading VAD model from ${modelURL}`)
      const modelTimer = performanceTracker.startTiming()
      model = await modelFactory(ort, () => defaultModelFetcher(modelURL))
      performanceTracker.recordModelLoad(modelTimer.end())
      log.info("VAD model loaded successfully")
    } catch (error) {
      throw new ModelLoadError(
        `Failed to load model from ${modelURL}`,
        error as Error
      )
    }

    const frameSamples = fullOptions.model === "v5" ? 512 : 1536
    const msPerFrame = frameSamples / 16

    const frameProcessor = new FrameProcessor(
      model.process,
      model.reset_state,
      {
        positiveSpeechThreshold: fullOptions.positiveSpeechThreshold,
        negativeSpeechThreshold: fullOptions.negativeSpeechThreshold,
        redemptionMs: fullOptions.redemptionMs,
        preSpeechPadMs: fullOptions.preSpeechPadMs,
        minSpeechMs: fullOptions.minSpeechMs,
        submitUserSpeechOnPause: fullOptions.submitUserSpeechOnPause,
      },
      msPerFrame
    )

    const audioNodeVAD = new AudioNodeVAD(
      ctx,
      fullOptions,
      frameProcessor,
      frameSamples,
      msPerFrame,
      performanceTracker
    )
    await audioNodeVAD.setupAudioNode()
    return audioNodeVAD
  }

  constructor(
    public ctx: AudioContext,
    public options: RealTimeVADOptions,
    frameProcessor: FrameProcessor,
    public frameSamples: number,
    public msPerFrame: number,
    performanceTracker: VADPerformanceTracker
  ) {
    this.frameProcessor = frameProcessor
    this.performanceTracker = performanceTracker
  }

  private async setupAudioNode() {
    const hasAudioWorklet =
      "audioWorklet" in this.ctx && typeof AudioWorkletNode === "function"
    if (hasAudioWorklet) {
      try {
        const workletURL = this.options.baseAssetPath + workletFile + '?v=' + Date.now()

        // Validate worklet URL
        validateWorkletURL(workletURL)

        log.info('[VAD] Loading worklet from:', workletURL)

        try {
          const workletTimer = this.performanceTracker.startTiming()
          await this.ctx.audioWorklet.addModule(workletURL)
          this.performanceTracker.recordWorkletLoad(workletTimer.end())
          log.info('[VAD] Worklet loaded successfully')
        } catch (error) {
          throw new WorkletLoadError(
            `Failed to load worklet from ${workletURL}`,
            error as Error
          )
        }

        const workletOptions = this.options.workletOptions ?? {}
        workletOptions.processorOptions = {
          ...(workletOptions.processorOptions ?? {}),
          frameSamples: this.frameSamples,
        }

        this.audioNode = new AudioWorkletNode(
          this.ctx,
          "vad-helper-worklet",
          workletOptions
        )

        log.info('[VAD] AudioWorkletNode created successfully')

        ;(this.audioNode as AudioWorkletNode).port.onmessage = async (
          ev: MessageEvent
        ) => {
          switch (ev.data?.message) {
            case 'WORKLET_INITIALIZED':
              log.debug('[VAD] Worklet initialized!', ev.data);
              break
            case Message.AudioFrame: {
              let buffer: ArrayBuffer = ev.data.data
              if (!(buffer instanceof ArrayBuffer)) {
                buffer = new ArrayBuffer(ev.data.data.byteLength)
                new Uint8Array(buffer).set(new Uint8Array(ev.data.data))
              }
              const frame = new Float32Array(buffer)
              await this.processFrame(frame)
              break
            }
          }
        }

        // FIX: Connect AudioWorkletNode to destination so process() gets called
        // Create a gain node with zero gain to avoid audio feedback
        this.gainNode = this.ctx.createGain()
        this.gainNode.gain.value = 0
        this.audioNode.connect(this.gainNode)
        this.gainNode.connect(this.ctx.destination)
        log.info('[VAD] AudioWorkletNode connected to audio graph')

        return
      } catch (error) {
        log.warn(
          "AudioWorklet setup failed, falling back to ScriptProcessor",
          error
        )
        // Continue to fallback
      }
    }

    // ScriptProcessor fallback
    log.info('[VAD] Using ScriptProcessor fallback (AudioWorklet not available)')

    // Initialize resampler for ScriptProcessor
    this.resampler = new Resampler({
      nativeSampleRate: this.ctx.sampleRate,
      targetSampleRate: 16000, // VAD models expect 16kHz
      targetFrameSize: this.frameSamples ?? 480,
    })

    // Fallback to ScriptProcessor
    const bufferSize = 4096 // Increased for more stable processing
    this.audioNode = this.ctx.createScriptProcessor(bufferSize, 1, 1)

    // Create a gain node with zero gain to handle the audio chain
    this.gainNode = this.ctx.createGain()
    this.gainNode.gain.value = 0

    let processingAudio = false

    ;(this.audioNode as ScriptProcessorNode).onaudioprocess = async (
      e: AudioProcessingEvent
    ) => {
      if (processingAudio) return
      processingAudio = true

      try {
        const input = e.inputBuffer.getChannelData(0)
        const output = e.outputBuffer.getChannelData(0)
        output.fill(0)

        // Process through resampler
        if (this.resampler) {
          const frames = this.resampler.process(input)
          for (const frame of frames) {
            await this.processFrame(frame)
          }
        }
      } catch (error) {
        log.error("Error processing audio:", error as Error)
      } finally {
        processingAudio = false
      }
    }

    // Connect the audio chain
    this.audioNode.connect(this.gainNode)
    this.gainNode.connect(this.ctx.destination)
  }

  pause = () => {
    this.frameProcessor.pause(this.handleFrameProcessorEvent)
  }

  start = () => {
    log.debug('[AudioNodeVAD] start() called, resuming frame processor')
    this.frameProcessor.resume()
  }

  receive = async (node: AudioNode) => {
    log.debug('[VAD] Connecting source node to AudioWorkletNode')
    log.debug('[VAD] AudioContext state:', this.ctx.state)

    // FIX: Resume AudioContext if suspended
    if (this.ctx.state === 'suspended') {
      log.debug('[VAD] AudioContext is suspended, resuming...')
      try {
        await this.ctx.resume()
        log.debug('[VAD] AudioContext resumed, state:', this.ctx.state)
      } catch (error) {
        log.error('[VAD] Failed to resume AudioContext:', error as Error)
      }
    }

    log.debug('[VAD] Source node:', node)
    log.debug('[VAD] AudioWorkletNode:', this.audioNode)
    node.connect(this.audioNode)
    log.debug('[VAD] Source connected successfully')
  }

  processFrame = async (frame: Float32Array) => {
    await this.frameProcessor.process(frame, this.handleFrameProcessorEvent)
  }

  handleFrameProcessorEvent = (ev: FrameProcessorEvent) => {
    switch (ev.msg) {
      case Message.FrameProcessed:
        this.options.onFrameProcessed(ev.probs, ev.frame as Float32Array)
        break

      case Message.SpeechStart:
        this.options.onSpeechStart()
        break

      case Message.SpeechRealStart:
        this.options.onSpeechRealStart()
        break

      case Message.VADMisfire:
        this.options.onVADMisfire()
        break

      case Message.SpeechEnd:
        this.options.onSpeechEnd(ev.audio as Float32Array)
        break
    }
  }

  destroy = () => {
    if (this.audioNode instanceof AudioWorkletNode) {
      this.audioNode.port.postMessage({
        message: Message.SpeechStop,
      })
    }
    this.audioNode.disconnect()
    this.gainNode?.disconnect()
  }

  setFrameProcessorOptions = (options: Partial<FrameProcessorOptions>) => {
    // Merge and validate options to prevent invalid runtime states
    const nextOptions = {
      ...this.frameProcessor.options,
      ...options,
    }
    validateOptions(nextOptions)
    this.frameProcessor.options = nextOptions
  }
}
