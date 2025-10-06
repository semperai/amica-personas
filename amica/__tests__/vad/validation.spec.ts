import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import {
  validateAudioConstraints,
  checkUserMediaSupport,
  checkAudioWorkletSupport,
  validateModelURL,
  validateWorkletURL,
  validateAudioContextState,
  checkBrowserCompatibility,
  AudioConstraintsError,
  ModelLoadError,
  WorkletLoadError,
  AudioContextError,
} from "../../src/lib/vad/validation";
import { configureLogging } from "../../src/lib/vad/logging";

describe("VAD Validation", () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    configureLogging({ minLevel: "debug" });
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleDebugSpy.mockRestore();
  });

  describe("validateAudioConstraints", () => {
    test("should accept valid mono constraints", () => {
      const constraints: MediaTrackConstraints = {
        channelCount: 1,
        echoCancellation: true,
        autoGainControl: true,
        noiseSuppression: true,
      };

      expect(() => validateAudioConstraints(constraints)).not.toThrow();
    });

    test("should warn about non-mono audio", () => {
      const constraints: MediaTrackConstraints = {
        channelCount: 2,
      };

      validateAudioConstraints(constraints);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining("mono audio")
      );
    });

    test("should reject sample rate below 16kHz", () => {
      const constraints: MediaTrackConstraints = {
        sampleRate: 8000,
      };

      expect(() => validateAudioConstraints(constraints)).toThrow(
        AudioConstraintsError
      );
      expect(() => validateAudioConstraints(constraints)).toThrow(
        /Sample rate must be at least 16000 Hz/
      );
    });

    test("should accept sample rate at or above 16kHz", () => {
      expect(() =>
        validateAudioConstraints({ sampleRate: 16000 })
      ).not.toThrow();
      expect(() =>
        validateAudioConstraints({ sampleRate: 48000 })
      ).not.toThrow();
    });

    test("should warn when noise suppression is disabled", () => {
      validateAudioConstraints({ noiseSuppression: false });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining("Noise suppression is disabled")
      );
    });

    test("should warn when echo cancellation is disabled", () => {
      validateAudioConstraints({ echoCancellation: false });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining("Echo cancellation is disabled")
      );
    });

    test("should handle ConstrainULong range objects", () => {
      const constraints: MediaTrackConstraints = {
        channelCount: { ideal: 2 },
        sampleRate: { exact: 48000 },
      };

      validateAudioConstraints(constraints);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining("mono audio")
      );
    });

    test("should throw for low sample rate in ConstrainULong format", () => {
      const constraints: MediaTrackConstraints = {
        sampleRate: { exact: 8000 },
      };

      expect(() => validateAudioConstraints(constraints)).toThrow(
        AudioConstraintsError
      );
    });
  });

  describe("checkUserMediaSupport", () => {
    test("should pass when getUserMedia is available", () => {
      // Mock getUserMedia for this test
      const mockGetUserMedia = vi.fn();
      Object.defineProperty(navigator, "mediaDevices", {
        value: { getUserMedia: mockGetUserMedia },
        configurable: true,
      });

      expect(() => checkUserMediaSupport()).not.toThrow();
    });

    test("should throw when getUserMedia is not available", () => {
      const original = navigator.mediaDevices;
      Object.defineProperty(navigator, "mediaDevices", {
        value: undefined,
        configurable: true,
      });

      expect(() => checkUserMediaSupport()).toThrow(AudioConstraintsError);
      expect(() => checkUserMediaSupport()).toThrow(/getUserMedia is not supported/);

      // Restore
      Object.defineProperty(navigator, "mediaDevices", {
        value: original,
        configurable: true,
      });
    });
  });

  describe("checkAudioWorkletSupport", () => {
    test("should return true when AudioWorklet is supported", () => {
      // Mock AudioContext with audioWorklet and AudioWorkletNode
      const mockCtx = {
        audioWorklet: {},
      } as unknown as AudioContext;

      // Mock AudioWorkletNode for this test
      (globalThis as typeof globalThis & { AudioWorkletNode?: unknown }).AudioWorkletNode = class {};

      const result = checkAudioWorkletSupport(mockCtx);

      expect(result).toBe(true);

      // Cleanup
      delete (globalThis as typeof globalThis & { AudioWorkletNode?: unknown }).AudioWorkletNode;
    });

    test("should return false and warn when AudioWorklet is not supported", () => {
      const ctx = {} as AudioContext;

      const result = checkAudioWorkletSupport(ctx);

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining("AudioWorklet is not supported")
      );
    });
  });

  describe("validateModelURL", () => {
    test("should accept valid relative URLs", () => {
      expect(() => validateModelURL("./model.onnx")).not.toThrow();
      expect(() => validateModelURL("/assets/model.onnx")).not.toThrow();
    });

    test("should accept valid absolute URLs", () => {
      expect(() =>
        validateModelURL("https://example.com/model.onnx")
      ).not.toThrow();
      expect(() =>
        validateModelURL("http://localhost:3000/model.onnx")
      ).not.toThrow();
    });

    test("should accept relative URLs as valid", () => {
      // Relative URLs are valid in browser context
      expect(() => validateModelURL("not-a-url")).not.toThrow();
    });
  });

  describe("validateWorkletURL", () => {
    test("should accept valid relative URLs", () => {
      expect(() => validateWorkletURL("./worklet.js")).not.toThrow();
      expect(() => validateWorkletURL("/public/worklet.js")).not.toThrow();
    });

    test("should accept valid absolute URLs", () => {
      expect(() =>
        validateWorkletURL("https://cdn.example.com/worklet.js")
      ).not.toThrow();
    });

    test("should accept relative URLs as valid", () => {
      // Relative URLs are valid in browser context
      expect(() => validateWorkletURL("worklet-file")).not.toThrow();
    });
  });

  describe("validateAudioContextState", () => {
    test("should pass for running context", () => {
      const ctx = { state: "running" } as AudioContext;

      expect(() => validateAudioContextState(ctx)).not.toThrow();
    });

    test("should pass for suspended context with warning", () => {
      const ctx = { state: "suspended" } as AudioContext;

      expect(() => validateAudioContextState(ctx)).not.toThrow();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining("suspended")
      );
    });

    test("should throw for closed context", () => {
      const ctx = { state: "closed" } as AudioContext;

      expect(() => validateAudioContextState(ctx)).toThrow(AudioContextError);
      expect(() => validateAudioContextState(ctx)).toThrow(/closed/);
    });
  });

  describe("checkBrowserCompatibility", () => {
    test("should return compatibility status", () => {
      // In jsdom, some APIs may not be available
      const result = checkBrowserCompatibility();

      expect(typeof result.getUserMedia).toBe("boolean");
      expect(typeof result.audioContext).toBe("boolean");
      expect(typeof result.audioWorklet).toBe("boolean");
      expect(typeof result.onnxRuntime).toBe("boolean");
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    test("should detect missing getUserMedia", () => {
      const original = navigator.mediaDevices;
      Object.defineProperty(navigator, "mediaDevices", {
        value: undefined,
        configurable: true,
      });

      const result = checkBrowserCompatibility();

      expect(result.getUserMedia).toBe(false);
      expect(result.warnings).toContain("getUserMedia API not available");

      // Restore
      Object.defineProperty(navigator, "mediaDevices", {
        value: original,
        configurable: true,
      });
    });

    test("should return warnings array when features are missing", () => {
      const result = checkBrowserCompatibility();

      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  describe("Error types", () => {
    test("AudioConstraintsError should have correct properties", () => {
      const error = new AudioConstraintsError("test message");

      expect(error.name).toBe("AudioConstraintsError");
      expect(error.code).toBe("AUDIO_CONSTRAINTS_ERROR");
      expect(error.message).toBe("test message");
      expect(error instanceof Error).toBe(true);
    });

    test("ModelLoadError should have correct properties", () => {
      const cause = new Error("fetch failed");
      const error = new ModelLoadError("test message", cause);

      expect(error.name).toBe("ModelLoadError");
      expect(error.code).toBe("MODEL_LOAD_ERROR");
      expect(error.cause).toBe(cause);
    });

    test("WorkletLoadError should have correct properties", () => {
      const error = new WorkletLoadError("test message");

      expect(error.name).toBe("WorkletLoadError");
      expect(error.code).toBe("WORKLET_LOAD_ERROR");
    });

    test("AudioContextError should have correct properties", () => {
      const error = new AudioContextError("test message");

      expect(error.name).toBe("AudioContextError");
      expect(error.code).toBe("AUDIO_CONTEXT_ERROR");
    });
  });
});
