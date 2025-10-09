import { describe, expect, test } from "vitest";
import {
  minFramesForTargetMS,
  arrayBufferToBase64,
  encodeWAV,
} from "../../src/lib/vad/utils";

describe("VAD Utils", () => {
  describe("minFramesForTargetMS", () => {
    test("should calculate correct frames for standard durations", () => {
      // 1000ms at 16kHz with 512 samples per frame
      // = (1000 * 16000) / 1000 / 512 = 31.25 frames
      expect(minFramesForTargetMS(1000, 512, 16000)).toBe(32);
    });

    test("should handle 400ms (minSpeechMs default)", () => {
      // 400ms at 16kHz with 512 samples per frame
      // = (400 * 16000) / 1000 / 512 = 12.5 frames
      expect(minFramesForTargetMS(400, 512, 16000)).toBe(13);
    });

    test("should handle 800ms (preSpeechPadMs default)", () => {
      // 800ms at 16kHz with 512 samples per frame
      // = (800 * 16000) / 1000 / 512 = 25 frames
      expect(minFramesForTargetMS(800, 512, 16000)).toBe(25);
    });

    test("should handle legacy model frame size (1536)", () => {
      // 1000ms at 16kHz with 1536 samples per frame
      // = (1000 * 16000) / 1000 / 1536 = 10.42 frames
      expect(minFramesForTargetMS(1000, 1536, 16000)).toBe(11);
    });

    test("should round up partial frames", () => {
      // Ensure we always get enough frames for target duration
      expect(minFramesForTargetMS(100, 512, 16000)).toBe(4); // 3.125 -> 4
      expect(minFramesForTargetMS(50, 512, 16000)).toBe(2); // 1.5625 -> 2
    });

    test("should handle zero duration", () => {
      expect(minFramesForTargetMS(0, 512, 16000)).toBe(0);
    });

    test("should handle very short durations", () => {
      expect(minFramesForTargetMS(1, 512, 16000)).toBe(1);
      expect(minFramesForTargetMS(10, 512, 16000)).toBe(1);
    });

    test("should handle different sample rates", () => {
      expect(minFramesForTargetMS(1000, 512, 8000)).toBe(16); // 8kHz
      expect(minFramesForTargetMS(1000, 512, 16000)).toBe(32); // 16kHz
      expect(minFramesForTargetMS(1000, 512, 48000)).toBe(94); // 48kHz
    });

    test("should default to 16kHz sample rate", () => {
      const withDefault = minFramesForTargetMS(1000, 512);
      const withExplicit = minFramesForTargetMS(1000, 512, 16000);
      expect(withDefault).toBe(withExplicit);
    });
  });

  describe("arrayBufferToBase64", () => {
    test("should encode empty buffer", () => {
      const buffer = new ArrayBuffer(0);
      const result = arrayBufferToBase64(buffer);
      expect(result).toBe("");
    });

    test("should encode simple byte array", () => {
      const buffer = new ArrayBuffer(3);
      const view = new Uint8Array(buffer);
      view[0] = 65; // 'A'
      view[1] = 66; // 'B'
      view[2] = 67; // 'C'

      const result = arrayBufferToBase64(buffer);
      expect(result).toBe("QUJD"); // Base64 for "ABC"
    });

    test("should encode zeros", () => {
      const buffer = new ArrayBuffer(4);
      const view = new Uint8Array(buffer);
      view.fill(0);

      const result = arrayBufferToBase64(buffer);
      expect(result).toBe("AAAAAA==");
    });

    test("should encode 0xFF pattern", () => {
      const buffer = new ArrayBuffer(3);
      const view = new Uint8Array(buffer);
      view.fill(0xff);

      const result = arrayBufferToBase64(buffer);
      expect(result).toBe("////");
    });

    test("should handle audio sample data", () => {
      // Create a small audio buffer
      const samples = new Float32Array([0.5, -0.5, 0.0, 1.0]);
      const buffer = samples.buffer;

      const result = arrayBufferToBase64(buffer);
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    test("should produce valid base64", () => {
      const buffer = new ArrayBuffer(16);
      const view = new Uint8Array(buffer);
      for (let i = 0; i < 16; i++) {
        view[i] = i * 16;
      }

      const result = arrayBufferToBase64(buffer);

      // Valid base64 characters: A-Z, a-z, 0-9, +, /, =
      expect(result).toMatch(/^[A-Za-z0-9+/]*={0,2}$/);
    });
  });

  describe("encodeWAV", () => {
    test("should create valid WAV header", () => {
      const samples = new Float32Array([0.5, -0.5, 0.0, 1.0, -1.0]);
      const buffer = encodeWAV(samples);

      const view = new DataView(buffer);

      // Check RIFF header
      expect(String.fromCharCode(view.getUint8(0))).toBe("R");
      expect(String.fromCharCode(view.getUint8(1))).toBe("I");
      expect(String.fromCharCode(view.getUint8(2))).toBe("F");
      expect(String.fromCharCode(view.getUint8(3))).toBe("F");

      // Check WAVE format
      expect(String.fromCharCode(view.getUint8(8))).toBe("W");
      expect(String.fromCharCode(view.getUint8(9))).toBe("A");
      expect(String.fromCharCode(view.getUint8(10))).toBe("V");
      expect(String.fromCharCode(view.getUint8(11))).toBe("E");
    });

    test("should use default format (float32)", () => {
      const samples = new Float32Array([0.5]);
      const buffer = encodeWAV(samples);

      const view = new DataView(buffer);

      // Audio format (offset 20): 3 = IEEE float
      expect(view.getUint16(20, true)).toBe(3);

      // Bits per sample (offset 34): 32
      expect(view.getUint16(34, true)).toBe(32);
    });

    test("should use correct sample rate", () => {
      const samples = new Float32Array([0.5]);
      const buffer = encodeWAV(samples, 3, 16000);

      const view = new DataView(buffer);

      // Sample rate at offset 24
      expect(view.getUint32(24, true)).toBe(16000);
    });

    test("should handle mono channel (default)", () => {
      const samples = new Float32Array([0.5]);
      const buffer = encodeWAV(samples);

      const view = new DataView(buffer);

      // Number of channels at offset 22
      expect(view.getUint16(22, true)).toBe(1);
    });

    test("should calculate correct file size", () => {
      const samples = new Float32Array(100);
      samples.fill(0.5);

      const buffer = encodeWAV(samples);

      // WAV file = 44 byte header + samples
      const expectedSize = 44 + 100 * 4; // 4 bytes per float32 sample
      expect(buffer.byteLength).toBe(expectedSize);
    });

    test("should encode silence correctly", () => {
      const samples = new Float32Array(10);
      samples.fill(0);

      const buffer = encodeWAV(samples);

      expect(buffer.byteLength).toBe(44 + 10 * 4);

      const view = new DataView(buffer);
      // Check a few data samples are zero
      expect(view.getFloat32(44, true)).toBe(0);
      expect(view.getFloat32(48, true)).toBe(0);
    });

    test("should preserve sample values", () => {
      const samples = new Float32Array([0.5, -0.5, 0.25, -0.25]);
      const buffer = encodeWAV(samples);

      const view = new DataView(buffer);

      // Data starts at offset 44
      expect(view.getFloat32(44, true)).toBeCloseTo(0.5, 5);
      expect(view.getFloat32(48, true)).toBeCloseTo(-0.5, 5);
      expect(view.getFloat32(52, true)).toBeCloseTo(0.25, 5);
      expect(view.getFloat32(56, true)).toBeCloseTo(-0.25, 5);
    });

    test("should handle empty samples", () => {
      const samples = new Float32Array(0);
      const buffer = encodeWAV(samples);

      // Should still have header
      expect(buffer.byteLength).toBe(44);
    });

    test("should handle PCM format (format=1)", () => {
      const samples = new Float32Array([0.5, -0.5]);
      const buffer = encodeWAV(samples, 1, 16000, 1, 16);

      const view = new DataView(buffer);

      // Audio format: 1 = PCM
      expect(view.getUint16(20, true)).toBe(1);

      // Bits per sample: 16
      expect(view.getUint16(34, true)).toBe(16);

      // File size for PCM: 44 + samples * 2 bytes
      expect(buffer.byteLength).toBe(44 + 2 * 2);
    });

    test("should handle different sample rates", () => {
      const testRates = [8000, 16000, 44100, 48000];

      testRates.forEach((rate) => {
        const samples = new Float32Array(10);
        const buffer = encodeWAV(samples, 3, rate);

        const view = new DataView(buffer);
        expect(view.getUint32(24, true)).toBe(rate);
      });
    });

    test("should calculate correct byte rate", () => {
      const samples = new Float32Array(1);
      const sampleRate = 16000;
      const buffer = encodeWAV(samples, 3, sampleRate, 1, 32);

      const view = new DataView(buffer);

      // Byte rate = sample rate * num channels * bytes per sample
      const expectedByteRate = sampleRate * 1 * 4;
      expect(view.getUint32(28, true)).toBe(expectedByteRate);
    });
  });

  describe("WAV encoding integration", () => {
    test("should create playable WAV from VAD audio", () => {
      // Simulate 1 second of 440Hz sine wave (A4 note)
      const sampleRate = 16000;
      const duration = 1;
      const frequency = 440;
      const samples = new Float32Array(sampleRate * duration);

      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * 0.5;
      }

      const buffer = encodeWAV(samples, 3, sampleRate);

      // Verify structure
      expect(buffer.byteLength).toBe(44 + samples.length * 4);

      const view = new DataView(buffer);
      // Verify it's a valid RIFF/WAVE file
      const riff = String.fromCharCode(
        view.getUint8(0),
        view.getUint8(1),
        view.getUint8(2),
        view.getUint8(3)
      );
      expect(riff).toBe("RIFF");

      const wave = String.fromCharCode(
        view.getUint8(8),
        view.getUint8(9),
        view.getUint8(10),
        view.getUint8(11)
      );
      expect(wave).toBe("WAVE");
    });

    test("should encode and convert to base64", () => {
      const samples = new Float32Array([0.5, -0.5, 0.25]);
      const wavBuffer = encodeWAV(samples);
      const base64 = arrayBufferToBase64(wavBuffer);

      expect(base64).toBeDefined();
      expect(base64.length).toBeGreaterThan(0);
      expect(base64).toMatch(/^[A-Za-z0-9+/]*={0,2}$/);
    });
  });
});
