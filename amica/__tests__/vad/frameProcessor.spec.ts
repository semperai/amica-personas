import { describe, expect, test, vi, beforeEach } from "vitest";
import {
  FrameProcessor,
  validateOptions,
  defaultFrameProcessorOptions,
  type FrameProcessorOptions,
} from "../../src/lib/vad/frame-processor";
import { Message } from "../../src/lib/vad/messages";
import type { SpeechProbabilities } from "../../src/lib/vad/models/common";

describe("validateOptions", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test("should accept valid default options", () => {
    validateOptions(defaultFrameProcessorOptions);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test("should accept valid custom options", () => {
    const options: FrameProcessorOptions = {
      positiveSpeechThreshold: 0.5,
      negativeSpeechThreshold: 0.3,
      redemptionMs: 1000,
      preSpeechPadMs: 500,
      minSpeechMs: 300,
      submitUserSpeechOnPause: true,
    };

    validateOptions(options);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  describe("positiveSpeechThreshold validation", () => {
    test("should reject threshold below 0", () => {
      const options = { ...defaultFrameProcessorOptions, positiveSpeechThreshold: -0.1 };
      validateOptions(options);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[VAD]"),
        "positiveSpeechThreshold should be a number between 0 and 1"
      );
    });

    test("should reject threshold above 1", () => {
      const options = { ...defaultFrameProcessorOptions, positiveSpeechThreshold: 1.1 };
      validateOptions(options);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[VAD]"),
        "positiveSpeechThreshold should be a number between 0 and 1"
      );
    });

    test("should accept threshold at boundaries (0 and 1)", () => {
      validateOptions({
        ...defaultFrameProcessorOptions,
        positiveSpeechThreshold: 0,
        negativeSpeechThreshold: 0,
      });
      validateOptions({ ...defaultFrameProcessorOptions, positiveSpeechThreshold: 1 });

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe("negativeSpeechThreshold validation", () => {
    test("should reject threshold below 0", () => {
      const options = { ...defaultFrameProcessorOptions, negativeSpeechThreshold: -0.1 };
      validateOptions(options);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[VAD]"),
        "negativeSpeechThreshold should be between 0 and positiveSpeechThreshold"
      );
    });

    test("should reject threshold above positiveSpeechThreshold", () => {
      const options = {
        ...defaultFrameProcessorOptions,
        positiveSpeechThreshold: 0.3,
        negativeSpeechThreshold: 0.4,
      };
      validateOptions(options);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[VAD]"),
        "negativeSpeechThreshold should be between 0 and positiveSpeechThreshold"
      );
    });

    test("should accept threshold equal to positiveSpeechThreshold", () => {
      const options = {
        ...defaultFrameProcessorOptions,
        positiveSpeechThreshold: 0.3,
        negativeSpeechThreshold: 0.3,
      };
      validateOptions(options);

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe("timing validation", () => {
    test("should reject negative preSpeechPadMs", () => {
      const options = { ...defaultFrameProcessorOptions, preSpeechPadMs: -100 };
      validateOptions(options);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[VAD]"),
        "preSpeechPadMs should be positive"
      );
    });

    test("should reject negative redemptionMs", () => {
      const options = { ...defaultFrameProcessorOptions, redemptionMs: -100 };
      validateOptions(options);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[VAD]"),
        "redemptionMs should be positive"
      );
    });

    test("should reject negative minSpeechMs", () => {
      const options = { ...defaultFrameProcessorOptions, minSpeechMs: -100 };
      validateOptions(options);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[VAD]"),
        "minSpeechMs should be positive"
      );
    });

    test("should accept zero timing values", () => {
      const options = {
        ...defaultFrameProcessorOptions,
        preSpeechPadMs: 0,
        redemptionMs: 0,
        minSpeechMs: 0,
      };
      validateOptions(options);

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });
});

describe("FrameProcessor", () => {
  let mockModelProcess: ReturnType<typeof vi.fn>;
  let mockModelReset: ReturnType<typeof vi.fn>;
  let mockHandleEvent: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockModelProcess = vi.fn().mockResolvedValue({ isSpeech: 0.5, notSpeech: 0.5 });
    mockModelReset = vi.fn();
    mockHandleEvent = vi.fn();
  });

  describe("constructor", () => {
    test("should initialize with default options", () => {
      const processor = new FrameProcessor(
        mockModelProcess,
        mockModelReset,
        defaultFrameProcessorOptions,
        32 // msPerFrame (512 samples / 16kHz = 32ms)
      );

      expect(processor.speaking).toBe(false);
      expect(processor.active).toBe(false);
      expect(processor.audioBuffer).toEqual([]);
    });

    test("should calculate frame counts correctly", () => {
      const processor = new FrameProcessor(
        mockModelProcess,
        mockModelReset,
        {
          ...defaultFrameProcessorOptions,
          preSpeechPadMs: 640, // 640ms / 32ms = 20 frames
          redemptionMs: 320, // 320ms / 32ms = 10 frames
          minSpeechMs: 160, // 160ms / 32ms = 5 frames
        },
        32
      );

      expect(processor.preSpeechPadFrames).toBe(20);
      expect(processor.redemptionFrames).toBe(10);
      expect(processor.minSpeechFrames).toBe(5);
    });
  });

  describe("resume and pause", () => {
    test("resume should activate processor", () => {
      const processor = new FrameProcessor(
        mockModelProcess,
        mockModelReset,
        defaultFrameProcessorOptions,
        32
      );

      processor.resume();
      expect(processor.active).toBe(true);
    });

    test("pause should deactivate and reset", () => {
      const processor = new FrameProcessor(
        mockModelProcess,
        mockModelReset,
        defaultFrameProcessorOptions,
        32
      );

      processor.resume();
      processor.speaking = true;
      processor.pause(mockHandleEvent);

      expect(processor.active).toBe(false);
      expect(processor.speaking).toBe(false);
      expect(mockModelReset).toHaveBeenCalled();
    });
  });

  describe("process - speech detection", () => {
    test("should detect speech start", async () => {
      const processor = new FrameProcessor(
        mockModelProcess,
        mockModelReset,
        { ...defaultFrameProcessorOptions, positiveSpeechThreshold: 0.5 },
        32
      );

      mockModelProcess.mockResolvedValue({ isSpeech: 0.8, notSpeech: 0.2 });

      processor.resume();
      const frame = new Float32Array(512);

      await processor.process(frame, mockHandleEvent);

      expect(mockHandleEvent).toHaveBeenCalledWith(
        expect.objectContaining({ msg: Message.SpeechStart })
      );
      expect(processor.speaking).toBe(true);
    });

    test("should not detect speech when below threshold", async () => {
      const processor = new FrameProcessor(
        mockModelProcess,
        mockModelReset,
        { ...defaultFrameProcessorOptions, positiveSpeechThreshold: 0.5 },
        32
      );

      mockModelProcess.mockResolvedValue({ isSpeech: 0.3, notSpeech: 0.7 });

      processor.resume();
      const frame = new Float32Array(512);

      await processor.process(frame, mockHandleEvent);

      const speechStartCalls = mockHandleEvent.mock.calls.filter(
        (call) => call[0].msg === Message.SpeechStart
      );
      expect(speechStartCalls.length).toBe(0);
      expect(processor.speaking).toBe(false);
    });

    test("should emit FrameProcessed for every frame", async () => {
      const processor = new FrameProcessor(
        mockModelProcess,
        mockModelReset,
        defaultFrameProcessorOptions,
        32
      );

      processor.resume();
      const frame = new Float32Array(512);

      await processor.process(frame, mockHandleEvent);

      expect(mockHandleEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: Message.FrameProcessed,
          probs: expect.any(Object),
          frame: expect.any(Float32Array),
        })
      );
    });

    test("should fire SpeechRealStart after minSpeechFrames", async () => {
      const processor = new FrameProcessor(
        mockModelProcess,
        mockModelReset,
        {
          ...defaultFrameProcessorOptions,
          positiveSpeechThreshold: 0.5,
          minSpeechMs: 64, // 2 frames at 32ms per frame
        },
        32
      );

      mockModelProcess.mockResolvedValue({ isSpeech: 0.8, notSpeech: 0.2 });
      processor.resume();

      // Process first frame - should trigger SpeechStart
      await processor.process(new Float32Array(512), mockHandleEvent);
      expect(mockHandleEvent).toHaveBeenCalledWith(
        expect.objectContaining({ msg: Message.SpeechStart })
      );

      mockHandleEvent.mockClear();

      // Process second frame - should trigger SpeechRealStart
      await processor.process(new Float32Array(512), mockHandleEvent);
      expect(mockHandleEvent).toHaveBeenCalledWith(
        expect.objectContaining({ msg: Message.SpeechRealStart })
      );
    });
  });

  describe("process - speech end detection", () => {
    test("should detect speech end with redemption", async () => {
      const processor = new FrameProcessor(
        mockModelProcess,
        mockModelReset,
        {
          ...defaultFrameProcessorOptions,
          positiveSpeechThreshold: 0.5,
          negativeSpeechThreshold: 0.3,
          minSpeechMs: 32, // 1 frame
          redemptionMs: 64, // 2 frames
        },
        32
      );

      processor.resume();

      // Start speech
      mockModelProcess.mockResolvedValue({ isSpeech: 0.8, notSpeech: 0.2 });
      await processor.process(new Float32Array(512), mockHandleEvent);
      expect(processor.speaking).toBe(true);

      mockHandleEvent.mockClear();

      // Silence for redemption period
      mockModelProcess.mockResolvedValue({ isSpeech: 0.2, notSpeech: 0.8 });
      await processor.process(new Float32Array(512), mockHandleEvent);
      expect(processor.speaking).toBe(true); // Still speaking (redemption)

      await processor.process(new Float32Array(512), mockHandleEvent);

      // Should now end speech
      expect(mockHandleEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: Message.SpeechEnd,
          audio: expect.any(Float32Array),
        })
      );
      expect(processor.speaking).toBe(false);
    });

    test("should trigger VADMisfire for short speech segments", async () => {
      const processor = new FrameProcessor(
        mockModelProcess,
        mockModelReset,
        {
          ...defaultFrameProcessorOptions,
          positiveSpeechThreshold: 0.5,
          negativeSpeechThreshold: 0.3,
          minSpeechMs: 128, // 4 frames
          redemptionMs: 32, // 1 frame
        },
        32
      );

      processor.resume();

      // One speech frame
      mockModelProcess.mockResolvedValue({ isSpeech: 0.8, notSpeech: 0.2 });
      await processor.process(new Float32Array(512), mockHandleEvent);

      mockHandleEvent.mockClear();

      // Then silence
      mockModelProcess.mockResolvedValue({ isSpeech: 0.2, notSpeech: 0.8 });
      await processor.process(new Float32Array(512), mockHandleEvent);

      // Should trigger misfire (only 1 speech frame, need 4)
      expect(mockHandleEvent).toHaveBeenCalledWith(
        expect.objectContaining({ msg: Message.VADMisfire })
      );
    });

    test("should cancel redemption if speech resumes", async () => {
      const processor = new FrameProcessor(
        mockModelProcess,
        mockModelReset,
        {
          ...defaultFrameProcessorOptions,
          positiveSpeechThreshold: 0.5,
          negativeSpeechThreshold: 0.3,
          redemptionMs: 64, // 2 frames
        },
        32
      );

      processor.resume();

      // Start speech
      mockModelProcess.mockResolvedValue({ isSpeech: 0.8, notSpeech: 0.2 });
      await processor.process(new Float32Array(512), mockHandleEvent);

      // One frame of silence
      mockModelProcess.mockResolvedValue({ isSpeech: 0.2, notSpeech: 0.8 });
      await processor.process(new Float32Array(512), mockHandleEvent);
      expect(processor.redemptionCounter).toBe(1);

      // Speech resumes - should reset redemption
      mockModelProcess.mockResolvedValue({ isSpeech: 0.8, notSpeech: 0.2 });
      await processor.process(new Float32Array(512), mockHandleEvent);
      expect(processor.redemptionCounter).toBe(0);
      expect(processor.speaking).toBe(true);
    });
  });

  describe("process - pre-speech padding", () => {
    test("should maintain pre-speech buffer", async () => {
      const processor = new FrameProcessor(
        mockModelProcess,
        mockModelReset,
        {
          ...defaultFrameProcessorOptions,
          preSpeechPadMs: 64, // 2 frames
        },
        32
      );

      processor.resume();

      // Process 5 frames of silence
      mockModelProcess.mockResolvedValue({ isSpeech: 0.2, notSpeech: 0.8 });
      for (let i = 0; i < 5; i++) {
        await processor.process(new Float32Array(512), mockHandleEvent);
      }

      // Buffer should only keep last 2 frames
      expect(processor.audioBuffer.length).toBe(2);
    });

    test("should include pre-speech padding in speech segment", async () => {
      const processor = new FrameProcessor(
        mockModelProcess,
        mockModelReset,
        {
          ...defaultFrameProcessorOptions,
          positiveSpeechThreshold: 0.5,
          negativeSpeechThreshold: 0.3,
          preSpeechPadMs: 64, // 2 frames
          minSpeechMs: 32, // 1 frame
          redemptionMs: 32, // 1 frame
        },
        32
      );

      processor.resume();

      // 2 frames of silence (pre-speech padding)
      mockModelProcess.mockResolvedValue({ isSpeech: 0.2, notSpeech: 0.8 });
      await processor.process(new Float32Array(512), mockHandleEvent);
      await processor.process(new Float32Array(512), mockHandleEvent);

      // 1 frame of speech
      mockModelProcess.mockResolvedValue({ isSpeech: 0.8, notSpeech: 0.2 });
      await processor.process(new Float32Array(512), mockHandleEvent);

      mockHandleEvent.mockClear();

      // Silence to end speech
      mockModelProcess.mockResolvedValue({ isSpeech: 0.2, notSpeech: 0.8 });
      await processor.process(new Float32Array(512), mockHandleEvent);

      // Check SpeechEnd was called with audio including padding
      const speechEndCall = mockHandleEvent.mock.calls.find(
        (call) => call[0].msg === Message.SpeechEnd
      );
      expect(speechEndCall).toBeDefined();
      const audio = speechEndCall[0].audio as Float32Array;
      // Should include 2 padding frames + 1 speech frame + 1 silence frame = 4 frames * 512 = 2048 samples
      expect(audio.length).toBe(2048);
    });
  });

  describe("reset", () => {
    test("should reset all state", () => {
      const processor = new FrameProcessor(
        mockModelProcess,
        mockModelReset,
        defaultFrameProcessorOptions,
        32
      );

      processor.speaking = true;
      processor.speechRealStartFired = true;
      processor.speechFrameCount = 10;
      processor.redemptionCounter = 5;
      processor.audioBuffer = [{ frame: new Float32Array(512), isSpeech: true }];

      processor.reset();

      expect(processor.speaking).toBe(false);
      expect(processor.speechRealStartFired).toBe(false);
      expect(processor.speechFrameCount).toBe(0);
      expect(processor.redemptionCounter).toBe(0);
      expect(processor.audioBuffer).toEqual([]);
      expect(mockModelReset).toHaveBeenCalled();
    });
  });

  describe("endSegment", () => {
    test("should end speech segment manually", () => {
      const processor = new FrameProcessor(
        mockModelProcess,
        mockModelReset,
        { ...defaultFrameProcessorOptions, minSpeechMs: 32 },
        32
      );

      processor.speaking = true;
      processor.audioBuffer = [
        { frame: new Float32Array(512), isSpeech: true },
        { frame: new Float32Array(512), isSpeech: true },
      ];

      processor.endSegment(mockHandleEvent);

      expect(mockHandleEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: Message.SpeechEnd,
          audio: expect.any(Float32Array),
        })
      );
      expect(processor.speaking).toBe(false);
    });

    test("should trigger misfire if manual end with insufficient speech", () => {
      const processor = new FrameProcessor(
        mockModelProcess,
        mockModelReset,
        { ...defaultFrameProcessorOptions, minSpeechMs: 128 }, // 4 frames
        32
      );

      processor.speaking = true;
      processor.audioBuffer = [
        { frame: new Float32Array(512), isSpeech: true }, // Only 1 speech frame
      ];

      processor.endSegment(mockHandleEvent);

      expect(mockHandleEvent).toHaveBeenCalledWith(
        expect.objectContaining({ msg: Message.VADMisfire })
      );
    });
  });
});
