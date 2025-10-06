import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import {
  VADPerformanceTracker,
  PerformanceTimer,
  type VADPerformanceMetrics,
} from "../../src/lib/vad/performance";
import { configureLogging } from "../../src/lib/vad/logging";

describe("VAD Performance Tracking", () => {
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleInfoSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    configureLogging({ minLevel: "info" });
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe("VADPerformanceTracker", () => {
    test("should initialize with default metrics", () => {
      const tracker = new VADPerformanceTracker(false);
      const metrics = tracker.getMetrics();

      expect(metrics.framesProcessed).toBe(0);
      expect(metrics.avgFrameProcessingTime).toBe(0);
      expect(metrics.maxFrameProcessingTime).toBe(0);
      expect(metrics.minFrameProcessingTime).toBe(Infinity);
      expect(metrics.speechSegmentsDetected).toBe(0);
      expect(metrics.vadMisfires).toBe(0);
    });

    test("should enable and disable tracking", () => {
      const tracker = new VADPerformanceTracker(false);

      tracker.setEnabled(true);
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.anything(),
        "Performance tracking enabled"
      );

      consoleInfoSpy.mockClear();

      tracker.setEnabled(false);
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.anything(),
        "Performance tracking disabled"
      );
    });

    test("should not record when disabled", () => {
      const tracker = new VADPerformanceTracker(false);

      tracker.recordFrameProcessing(10);
      tracker.recordModelInference(5);
      tracker.recordSpeechSegment();
      tracker.recordMisfire();

      const metrics = tracker.getMetrics();
      expect(metrics.framesProcessed).toBe(0);
      expect(metrics.speechSegmentsDetected).toBe(0);
      expect(metrics.vadMisfires).toBe(0);
    });

    test("should record frame processing times", () => {
      const tracker = new VADPerformanceTracker(true);

      tracker.recordFrameProcessing(10);
      tracker.recordFrameProcessing(20);
      tracker.recordFrameProcessing(15);

      const metrics = tracker.getMetrics();
      expect(metrics.framesProcessed).toBe(3);
      expect(metrics.avgFrameProcessingTime).toBe(15); // (10+20+15)/3
      expect(metrics.minFrameProcessingTime).toBe(10);
      expect(metrics.maxFrameProcessingTime).toBe(20);
    });

    test("should record model inference times", () => {
      const tracker = new VADPerformanceTracker(true);

      tracker.recordModelInference(5);
      tracker.recordModelInference(7);
      tracker.recordModelInference(6);

      const metrics = tracker.getMetrics();
      expect(metrics.avgModelInferenceTime).toBe(6); // (5+7+6)/3
    });

    test("should record initialization metrics", () => {
      const tracker = new VADPerformanceTracker(true);

      tracker.recordInitialization(100);
      tracker.recordModelLoad(50);
      tracker.recordWorkletLoad(25);

      const metrics = tracker.getMetrics();
      expect(metrics.initializationTime).toBe(100);
      expect(metrics.modelLoadTime).toBe(50);
      expect(metrics.workletLoadTime).toBe(25);
    });

    test("should count speech segments and misfires", () => {
      const tracker = new VADPerformanceTracker(true);

      tracker.recordSpeechSegment();
      tracker.recordSpeechSegment();
      tracker.recordSpeechSegment();
      tracker.recordMisfire();

      const metrics = tracker.getMetrics();
      expect(metrics.speechSegmentsDetected).toBe(3);
      expect(metrics.vadMisfires).toBe(1);
    });

    test("should reset all metrics", () => {
      const tracker = new VADPerformanceTracker(true);

      tracker.recordFrameProcessing(10);
      tracker.recordSpeechSegment();
      tracker.recordInitialization(100);

      tracker.reset();

      const metrics = tracker.getMetrics();
      expect(metrics.framesProcessed).toBe(0);
      expect(metrics.speechSegmentsDetected).toBe(0);
      expect(metrics.initializationTime).toBe(0);
      expect(metrics.minFrameProcessingTime).toBe(Infinity);
    });

    test("should limit stored samples to maxSamples", () => {
      const tracker = new VADPerformanceTracker(true);

      // Record more than maxSamples (1000) frame times
      for (let i = 0; i < 1500; i++) {
        tracker.recordFrameProcessing(10);
      }

      const metrics = tracker.getMetrics();
      expect(metrics.framesProcessed).toBe(1500);
      // Average should still be calculated correctly
      expect(metrics.avgFrameProcessingTime).toBe(10);
    });

    test("should handle edge cases for min/max", () => {
      const tracker = new VADPerformanceTracker(true);

      tracker.recordFrameProcessing(0); // Zero time
      tracker.recordFrameProcessing(1000); // Large time

      const metrics = tracker.getMetrics();
      expect(metrics.minFrameProcessingTime).toBe(0);
      expect(metrics.maxFrameProcessingTime).toBe(1000);
    });

    test("should log summary when enabled", () => {
      const tracker = new VADPerformanceTracker(true);

      tracker.recordInitialization(100);
      tracker.recordModelLoad(50);
      tracker.recordFrameProcessing(10);
      tracker.recordSpeechSegment();

      tracker.logSummary();

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining("Performance Summary")
      );
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining("Initialization: 100")
      );
    });

    test("should warn when logging summary while disabled", () => {
      const tracker = new VADPerformanceTracker(false);

      tracker.logSummary();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.anything(),
        "Performance tracking is disabled"
      );
    });

    test("should return a copy of metrics to prevent mutation", () => {
      const tracker = new VADPerformanceTracker(true);

      tracker.recordFrameProcessing(10);

      const metrics1 = tracker.getMetrics();
      (metrics1 as VADPerformanceMetrics).framesProcessed = 999;

      const metrics2 = tracker.getMetrics();
      expect(metrics2.framesProcessed).toBe(1); // Original unchanged
    });
  });

  describe("PerformanceTimer", () => {
    test("should measure elapsed time when enabled", async () => {
      const timer = new PerformanceTimer(true);

      await new Promise((resolve) => setTimeout(resolve, 50));

      const elapsed = timer.elapsed();
      expect(elapsed).toBeGreaterThanOrEqual(45); // Allow some variance
      expect(elapsed).toBeLessThan(100);
    });

    test("should return 0 when disabled", async () => {
      const timer = new PerformanceTimer(false);

      await new Promise((resolve) => setTimeout(resolve, 50));

      const elapsed = timer.elapsed();
      expect(elapsed).toBe(0);
    });

    test("should return duration with end()", async () => {
      const timer = new PerformanceTimer(true);

      await new Promise((resolve) => setTimeout(resolve, 30));

      const duration = timer.end();
      expect(duration).toBeGreaterThanOrEqual(25);
      expect(duration).toBeLessThan(80);
    });

    test("should allow multiple elapsed() calls", async () => {
      const timer = new PerformanceTimer(true);

      await new Promise((resolve) => setTimeout(resolve, 20));
      const elapsed1 = timer.elapsed();

      await new Promise((resolve) => setTimeout(resolve, 20));
      const elapsed2 = timer.elapsed();

      expect(elapsed2).toBeGreaterThan(elapsed1);
    });
  });

  describe("Integration scenarios", () => {
    test("should track realistic VAD workflow", () => {
      const tracker = new VADPerformanceTracker(true);

      // Initialization
      const initTimer = tracker.startTiming();
      tracker.recordModelLoad(50);
      tracker.recordWorkletLoad(25);
      tracker.recordInitialization(initTimer.end());

      // Process frames
      for (let i = 0; i < 100; i++) {
        const frameTimer = tracker.startTiming();
        const inferenceTimer = tracker.startTiming();
        // Simulate inference
        tracker.recordModelInference(inferenceTimer.end());
        tracker.recordFrameProcessing(frameTimer.end());
      }

      // Detect speech
      tracker.recordSpeechSegment();
      tracker.recordSpeechSegment();
      tracker.recordMisfire();

      const metrics = tracker.getMetrics();
      expect(metrics.framesProcessed).toBe(100);
      expect(metrics.speechSegmentsDetected).toBe(2);
      expect(metrics.vadMisfires).toBe(1);
      expect(metrics.modelLoadTime).toBe(50);
      expect(metrics.workletLoadTime).toBe(25);
    });

    test("should handle disabled then enabled workflow", () => {
      const tracker = new VADPerformanceTracker(false);

      tracker.recordFrameProcessing(10);
      expect(tracker.getMetrics().framesProcessed).toBe(0);

      tracker.setEnabled(true);

      tracker.recordFrameProcessing(20);
      expect(tracker.getMetrics().framesProcessed).toBe(1);
    });
  });
});
