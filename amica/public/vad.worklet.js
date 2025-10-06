"use strict";
(() => {
  const LOG_PREFIX = "[VAD Worklet]";
  const log = {
    debug: (...args) => console.debug(LOG_PREFIX, ...args),
    info: (...args) => console.log(LOG_PREFIX, ...args),
    error: (...args) => console.error(LOG_PREFIX, ...args),
    warn: (...args) => console.warn(LOG_PREFIX, ...args)
  };
  const Message = {
    AudioFrame: "AUDIO_FRAME",
    SpeechStart: "SPEECH_START",
    VADMisfire: "VAD_MISFIRE",
    SpeechEnd: "SPEECH_END",
    SpeechStop: "SPEECH_STOP",
    SpeechRealStart: "SPEECH_REAL_START",
    FrameProcessed: "FRAME_PROCESSED"
  };
  class Resampler {
    options;
    inputBuffer;
    constructor(options) {
      this.options = options;
      if (options.nativeSampleRate < 16e3) {
        log.error("nativeSampleRate is too low. Should have 16000 = targetSampleRate <= nativeSampleRate");
      }
      this.inputBuffer = [];
    }
    process(inputFrame) {
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
      return this.inputBuffer.length * this.options.targetSampleRate / this.options.nativeSampleRate >= this.options.targetFrameSize;
    }
    generateOutputFrame() {
      const outputFrame = new Float32Array(this.options.targetFrameSize);
      let outputIndex = 0;
      let inputIndex = 0;
      while (outputIndex < this.options.targetFrameSize) {
        let sum = 0;
        let count = 0;
        while (inputIndex < Math.min(
          this.inputBuffer.length,
          (outputIndex + 1) * this.options.nativeSampleRate / this.options.targetSampleRate
        )) {
          const sample = this.inputBuffer[inputIndex];
          if (sample !== void 0) {
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
  class VadWorkletProcessor extends AudioWorkletProcessor {
    options;
    resampler;
    _initialized;
    _stopProcessing;
    _frameCount;
    constructor(options) {
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
      log.info("Initializing worklet, sampleRate:", sampleRate);
      this.resampler = new Resampler({
        nativeSampleRate: sampleRate,
        targetSampleRate: 16e3,
        targetFrameSize: this.options.frameSamples
      });
      this._initialized = true;
      log.info("Worklet initialized successfully");
      this.port.postMessage({
        message: "WORKLET_INITIALIZED",
        sampleRate,
        frameSamples: this.options.frameSamples
      });
    }
    process(inputs, outputs, parameters) {
      if (this._stopProcessing) {
        log.debug("Stop processing flag set, returning false");
        return false;
      }
      const input = inputs[0];
      const channel = input ? input[0] : null;
      if (this._frameCount < 5) {
        log.debug(`Process called, frame ${this._frameCount}, input:`, input, "channel:", channel, "initialized:", this._initialized);
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
})();
