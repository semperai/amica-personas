import { describe, expect, test } from "vitest";
import { Resampler } from "../../src/lib/vad/resampler";

describe("Resampler", () => {
  describe("constructor", () => {
    test("should create a resampler with valid options", () => {
      const resampler = new Resampler({
        nativeSampleRate: 48000,
        targetSampleRate: 16000,
        targetFrameSize: 512,
      });

      expect(resampler).toBeDefined();
      expect(resampler.inputBuffer).toEqual([]);
    });

    test("should throw when native sample rate is less than target sample rate", () => {
      expect(() => {
        new Resampler({
          nativeSampleRate: 8000,
          targetSampleRate: 16000,
          targetFrameSize: 512,
        });
      }).toThrow(/Resampler only supports downsampling\. nativeSampleRate \(\d+\) must be >= targetSampleRate \(\d+\)\./);
    });
  });

  describe("process", () => {
    test("should downsample from 48kHz to 16kHz", () => {
      const resampler = new Resampler({
        nativeSampleRate: 48000,
        targetSampleRate: 16000,
        targetFrameSize: 512,
      });

      // Create 1536 samples at 48kHz (which equals 512 samples at 16kHz)
      const input = new Float32Array(1536);
      for (let i = 0; i < input.length; i++) {
        input[i] = Math.sin((2 * Math.PI * 440 * i) / 48000); // 440 Hz sine wave
      }

      const outputs = resampler.process(input);

      expect(outputs.length).toBe(1);
      expect(outputs[0]?.length).toBe(512);
    });

    test("should handle multiple frames", () => {
      const resampler = new Resampler({
        nativeSampleRate: 48000,
        targetSampleRate: 16000,
        targetFrameSize: 512,
      });

      // Process enough samples for 3 frames
      const input = new Float32Array(4608); // 3 * 1536
      for (let i = 0; i < input.length; i++) {
        input[i] = 0.5;
      }

      const outputs = resampler.process(input);

      expect(outputs.length).toBe(3);
      outputs.forEach((output) => {
        expect(output.length).toBe(512);
      });
    });

    test("should buffer incomplete frames", () => {
      const resampler = new Resampler({
        nativeSampleRate: 48000,
        targetSampleRate: 16000,
        targetFrameSize: 512,
      });

      // Only 500 samples (not enough for a frame)
      const input = new Float32Array(500);
      input.fill(0.5);

      const outputs = resampler.process(input);

      expect(outputs.length).toBe(0);
      expect(resampler.inputBuffer.length).toBe(500);
    });

    test("should preserve audio characteristics during resampling", () => {
      const resampler = new Resampler({
        nativeSampleRate: 48000,
        targetSampleRate: 16000,
        targetFrameSize: 512,
      });

      // Create a DC signal (constant value)
      const input = new Float32Array(1536);
      input.fill(0.75);

      const outputs = resampler.process(input);

      expect(outputs.length).toBe(1);
      const output = outputs[0] as Float32Array;

      // All samples should be approximately 0.75
      for (let i = 0; i < output.length; i++) {
        expect(output[i]).toBeCloseTo(0.75, 5);
      }
    });

    test("should handle zero signal", () => {
      const resampler = new Resampler({
        nativeSampleRate: 48000,
        targetSampleRate: 16000,
        targetFrameSize: 512,
      });

      const input = new Float32Array(1536);
      input.fill(0);

      const outputs = resampler.process(input);

      expect(outputs.length).toBe(1);
      const output = outputs[0] as Float32Array;

      for (let i = 0; i < output.length; i++) {
        expect(output[i]).toBe(0);
      }
    });

    test("should handle incremental processing", () => {
      const resampler = new Resampler({
        nativeSampleRate: 48000,
        targetSampleRate: 16000,
        targetFrameSize: 512,
      });

      // Process in small chunks
      let totalOutputs = 0;
      for (let i = 0; i < 10; i++) {
        const input = new Float32Array(200);
        input.fill(0.5);
        const outputs = resampler.process(input);
        totalOutputs += outputs.length;
      }

      // 10 * 200 = 2000 samples at 48kHz
      // Should produce 2000 * (16000/48000) / 512 = ~1.3 frames
      expect(totalOutputs).toBeGreaterThanOrEqual(1);
      expect(totalOutputs).toBeLessThanOrEqual(2);
    });

    test("should handle common audio sample rates", () => {
      const testCases = [
        { native: 48000, target: 16000, frameSize: 512 },
        { native: 44100, target: 16000, frameSize: 512 },
        { native: 16000, target: 16000, frameSize: 512 }, // No resampling
      ];

      testCases.forEach(({ native, target, frameSize }) => {
        const resampler = new Resampler({
          nativeSampleRate: native,
          targetSampleRate: target,
          targetFrameSize: frameSize,
        });

        const ratio = native / target;
        const inputSize = Math.ceil(frameSize * ratio);
        const input = new Float32Array(inputSize);
        input.fill(0.5);

        const outputs = resampler.process(input);

        // For 1:1 ratio (no resampling), should produce exactly 1 frame
        const expectedFrames = ratio === 1 ? 1 : 1;
        expect(outputs.length).toBe(expectedFrames);
        if (outputs.length > 0) {
          expect(outputs[0]?.length).toBe(frameSize);
        }
      });
    });
  });

  describe("stream", () => {
    test("should yield frames as async generator", async () => {
      const resampler = new Resampler({
        nativeSampleRate: 48000,
        targetSampleRate: 16000,
        targetFrameSize: 512,
      });

      const input = new Float32Array(3072); // 2 frames worth
      input.fill(0.5);

      const frames: Float32Array[] = [];
      for await (const frame of resampler.stream(input)) {
        frames.push(frame);
      }

      expect(frames.length).toBe(2);
      frames.forEach((frame) => {
        expect(frame.length).toBe(512);
      });
    });

    test("should handle empty input", async () => {
      const resampler = new Resampler({
        nativeSampleRate: 48000,
        targetSampleRate: 16000,
        targetFrameSize: 512,
      });

      const input = new Float32Array(0);

      const frames: Float32Array[] = [];
      for await (const frame of resampler.stream(input)) {
        frames.push(frame);
      }

      expect(frames.length).toBe(0);
    });
  });

  describe("edge cases", () => {
    test("should handle very small frame sizes", () => {
      const resampler = new Resampler({
        nativeSampleRate: 48000,
        targetSampleRate: 16000,
        targetFrameSize: 64,
      });

      const input = new Float32Array(192); // 1 frame
      input.fill(0.5);

      const outputs = resampler.process(input);

      expect(outputs.length).toBe(1);
      expect(outputs[0]?.length).toBe(64);
    });

    test("should handle large batch processing", () => {
      const resampler = new Resampler({
        nativeSampleRate: 48000,
        targetSampleRate: 16000,
        targetFrameSize: 512,
      });

      // 1 second of audio at 48kHz
      const input = new Float32Array(48000);
      for (let i = 0; i < input.length; i++) {
        input[i] = Math.sin((2 * Math.PI * 440 * i) / 48000);
      }

      const outputs = resampler.process(input);

      // Should produce approximately 48000 * (16000/48000) / 512 = ~31 frames
      expect(outputs.length).toBeGreaterThanOrEqual(30);
      expect(outputs.length).toBeLessThanOrEqual(32);
    });

    test("should maintain state across multiple calls", () => {
      const resampler = new Resampler({
        nativeSampleRate: 48000,
        targetSampleRate: 16000,
        targetFrameSize: 512,
      });

      // First call - partial frame
      const input1 = new Float32Array(1000);
      input1.fill(0.25);
      const outputs1 = resampler.process(input1);

      // Second call - complete the frame
      const input2 = new Float32Array(600);
      input2.fill(0.75);
      const outputs2 = resampler.process(input2);

      const totalFrames = outputs1.length + outputs2.length;
      expect(totalFrames).toBeGreaterThanOrEqual(1);
    });
  });
});
