// VAD AudioWorklet Processor
// Based on @ricky0123/vad-web but fixed to ensure process() is called

const LOG_PREFIX = "[VAD Worklet]";
const log = {
  debug: (...args: any[]) => console.debug(LOG_PREFIX, ...args),
  error: (...args: any[]) => console.error(LOG_PREFIX, ...args),
  warn: (...args: any[]) => console.warn(LOG_PREFIX, ...args),
};

const Message = {
  AudioFrame: "AUDIO_FRAME",
  SpeechStart: "SPEECH_START",
  VADMisfire: "VAD_MISFIRE",
  SpeechEnd: "SPEECH_END",
  SpeechStop: "SPEECH_STOP",
  SpeechRealStart: "SPEECH_REAL_START",
  FrameProcessed: "FRAME_PROCESSED",
};

interface ResamplerOptions {
  nativeSampleRate: number;
  targetSampleRate: number;
  targetFrameSize: number;
}

class Resampler {
  options: ResamplerOptions;
  inputBuffer: number[];

  constructor(options: ResamplerOptions) {
    this.options = options;
    if (options.nativeSampleRate < 16000) {
      log.error("nativeSampleRate is too low. Should have 16000 = targetSampleRate <= nativeSampleRate");
    }
    this.inputBuffer = [];
  }

  process(inputFrame: Float32Array): Float32Array[] {
    const outputFrames = [];
    for (const sample of inputFrame) {
      this.inputBuffer.push(sample);
      while (this.hasEnoughDataForFrame()) {
        const frame = this.generateOutputFrame();
        outputFrames.push(frame);
      }
    }
    return outputFrames;
  }

  hasEnoughDataForFrame() {
    return (
      (this.inputBuffer.length * this.options.targetSampleRate) /
        this.options.nativeSampleRate >=
      this.options.targetFrameSize
    );
  }

  generateOutputFrame() {
    const outputFrame = new Float32Array(this.options.targetFrameSize);
    let outputIndex = 0;
    let inputIndex = 0;

    while (outputIndex < this.options.targetFrameSize) {
      let sum = 0;
      let count = 0;

      while (
        inputIndex <
        Math.min(
          this.inputBuffer.length,
          ((outputIndex + 1) * this.options.nativeSampleRate) /
            this.options.targetSampleRate
        )
      ) {
        const sample = this.inputBuffer[inputIndex];
        if (sample !== undefined) {
          sum += sample;
          count++;
        }
        inputIndex++;
      }

      outputFrame[outputIndex] = sum / count;
      outputIndex++;
    }

    this.inputBuffer = this.inputBuffer.slice(inputIndex);
    return outputFrame;
  }
}

interface WorkletOptions {
  frameSamples: number;
}

class VadWorkletProcessor extends AudioWorkletProcessor {
  options: WorkletOptions;
  resampler!: Resampler;
  _initialized: boolean;
  _stopProcessing: boolean;
  _frameCount: number;

  constructor(options: any) {
    super();
    this._initialized = false;
    this._stopProcessing = false;
    this._frameCount = 0;
    this.options = options.processorOptions;

    log.debug("Worklet constructor called with options:", this.options);

    this.port.onmessage = (ev) => {
      if (ev.data.message === Message.SpeechStop) {
        log.debug("Received SpeechStop message");
        this._stopProcessing = true;
      }
    };

    this.init();
  }

  async init() {
    log.debug("Initializing worklet, sampleRate:", sampleRate);
    this.resampler = new Resampler({
      nativeSampleRate: sampleRate,
      targetSampleRate: 16000,
      targetFrameSize: this.options.frameSamples,
    });
    this._initialized = true;
    log.debug("Worklet initialized successfully");

    // Send initialization message to main thread
    this.port.postMessage({
      message: "WORKLET_INITIALIZED",
      sampleRate: sampleRate,
      frameSamples: this.options.frameSamples
    });
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean {
    if (this._stopProcessing) {
      log.debug("Stop processing flag set, returning false");
      return false;
    }

    const input = inputs[0];
    const channel = input ? input[0] : null;

    // Log first few frames to verify we're receiving audio
    if (this._frameCount < 5) {
      log.debug(`Process called, frame ${this._frameCount}, input:`, input, 'channel:', channel, 'initialized:', this._initialized);
      this._frameCount++;
    }

    if (this._initialized && channel instanceof Float32Array && channel.length > 0) {
      const frames = this.resampler.process(channel);

      if (this._frameCount === 5 && frames.length > 0) {
        log.debug(`Posting ${frames.length} frames back to main thread`);
      }

      for (const frame of frames) {
        this.port.postMessage(
          { message: Message.AudioFrame, data: frame.buffer },
          [frame.buffer]
        );
      }
    } else if (this._frameCount < 10 && this._initialized) {
      log.warn(`No valid audio data in frame ${this._frameCount}, channel:`, channel);
    }

    return true;
  }
}

registerProcessor("vad-helper-worklet", VadWorkletProcessor);
