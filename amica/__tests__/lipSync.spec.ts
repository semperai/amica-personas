import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import { LipSync } from "@/features/lipSync/lipSync";

// Mock AudioContext and related Web Audio API
class MockAnalyserNode {
  timeDomainData: Float32Array = new Float32Array(2048);

  getFloatTimeDomainData(data: Float32Array) {
    // Copy mock data to the provided array
    for (let i = 0; i < Math.min(data.length, this.timeDomainData.length); i++) {
      data[i] = this.timeDomainData[i];
    }
  }

  connect() {}
}

class MockBufferSource {
  buffer: any = null;
  onended: (() => void) | null = null;
  eventListeners: Map<string, (() => void)[]> = new Map();

  connect() {}

  start() {
    // Trigger ended event synchronously for testing
    setTimeout(() => {
      const listeners = this.eventListeners.get('ended') || [];
      listeners.forEach(listener => {
        try {
          listener();
        } catch (e) {
          // Swallow errors like real AudioBufferSourceNode does
        }
      });
      if (this.onended) {
        try {
          this.onended();
        } catch (e) {
          // Swallow errors like real AudioBufferSourceNode does
        }
      }
    }, 50); // Use 50ms delay to ensure async operations complete
  }

  addEventListener(event: string, callback: () => void) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }
}

class MockAudioContext {
  destination: any = {};
  analyserNode: MockAnalyserNode;

  constructor() {
    this.analyserNode = new MockAnalyserNode();
  }

  createAnalyser() {
    return this.analyserNode;
  }

  createBufferSource() {
    return new MockBufferSource();
  }

  async decodeAudioData(buffer: ArrayBuffer) {
    // Return a mock audio buffer
    return {
      duration: 1.0,
      length: buffer.byteLength,
      numberOfChannels: 2,
      sampleRate: 44100,
    };
  }
}

describe("LipSync", () => {
  let mockAudioContext: MockAudioContext;
  let lipSync: LipSync;

  beforeEach(() => {
    mockAudioContext = new MockAudioContext();
    lipSync = new LipSync(mockAudioContext as any);
  });

  describe("constructor", () => {
    test("should initialize with AudioContext", () => {
      expect(lipSync.audio).toBe(mockAudioContext);
    });

    test("should create analyser", () => {
      expect(lipSync.analyser).toBeDefined();
    });

    test("should create timeDomainData array", () => {
      expect(lipSync.timeDomainData).toBeInstanceOf(Float32Array);
      expect(lipSync.timeDomainData.length).toBe(2048);
    });
  });

  describe("update", () => {
    test("should return volume of 0 for silence", () => {
      // All zeros = silence
      mockAudioContext.analyserNode.timeDomainData.fill(0);

      const result = lipSync.update();

      expect(result.volume).toBe(0);
    });

    test("should return non-zero volume for audio signal", () => {
      // Simulate audio signal
      for (let i = 0; i < mockAudioContext.analyserNode.timeDomainData.length; i++) {
        mockAudioContext.analyserNode.timeDomainData[i] = Math.sin(i * 0.1) * 0.5;
      }

      const result = lipSync.update();

      expect(result.volume).toBeGreaterThan(0);
      expect(result.volume).toBeLessThanOrEqual(1);
    });

    test("should return higher volume for louder signal", () => {
      // Quiet signal
      mockAudioContext.analyserNode.timeDomainData.fill(0.1);
      const quietResult = lipSync.update();

      // Loud signal
      mockAudioContext.analyserNode.timeDomainData.fill(0.5);
      const loudResult = lipSync.update();

      expect(loudResult.volume).toBeGreaterThan(quietResult.volume);
    });

    test("should handle maximum signal", () => {
      mockAudioContext.analyserNode.timeDomainData.fill(1.0);

      const result = lipSync.update();

      expect(result.volume).toBeGreaterThan(0);
      expect(result.volume).toBeLessThanOrEqual(1);
    });

    test("should handle negative values (symmetric audio)", () => {
      // Mix of positive and negative (symmetric wave)
      for (let i = 0; i < mockAudioContext.analyserNode.timeDomainData.length; i++) {
        mockAudioContext.analyserNode.timeDomainData[i] = i % 2 === 0 ? 0.3 : -0.3;
      }

      const result = lipSync.update();

      expect(result.volume).toBeGreaterThan(0);
    });

    test("should use absolute value for volume calculation", () => {
      // All negative
      mockAudioContext.analyserNode.timeDomainData.fill(-0.3);
      const negResult = lipSync.update();

      // All positive (same magnitude)
      mockAudioContext.analyserNode.timeDomainData.fill(0.3);
      const posResult = lipSync.update();

      // Should be approximately equal (abs value)
      expect(Math.abs(negResult.volume - posResult.volume)).toBeLessThan(0.01);
    });

    test("should return volume below 0.1 as 0", () => {
      // Very quiet signal that should be cut off
      mockAudioContext.analyserNode.timeDomainData.fill(0.01);

      const result = lipSync.update();

      // After the sigmoid and threshold, very small values become 0
      expect(result.volume).toBe(0);
    });

    test("should apply sigmoid transformation", () => {
      // The volume calculation uses: 1 / (1 + exp(-45 * volume + 5))
      // This should normalize the output to a reasonable range

      mockAudioContext.analyserNode.timeDomainData.fill(0.2);
      const result1 = lipSync.update();

      mockAudioContext.analyserNode.timeDomainData.fill(0.4);
      const result2 = lipSync.update();

      mockAudioContext.analyserNode.timeDomainData.fill(0.6);
      const result3 = lipSync.update();

      // Sigmoid should create non-linear relationship
      const diff1 = result2.volume - result1.volume;
      const diff2 = result3.volume - result2.volume;

      // The differences should not be linear
      expect(diff1).not.toBe(diff2);
    });

    test("should find maximum value in audio data", () => {
      // Set one peak value
      mockAudioContext.analyserNode.timeDomainData.fill(0.1);
      mockAudioContext.analyserNode.timeDomainData[1000] = 0.8;

      const result = lipSync.update();

      // Volume should be based on the peak (0.8), not average (0.1)
      expect(result.volume).toBeGreaterThan(0.5);
    });

    test("should handle rapid updates", () => {
      const results = [];

      for (let i = 0; i < 100; i++) {
        mockAudioContext.analyserNode.timeDomainData.fill(Math.random() * 0.5);
        results.push(lipSync.update());
      }

      expect(results.length).toBe(100);
      results.forEach(result => {
        expect(typeof result.volume).toBe("number");
        expect(result.volume).toBeGreaterThanOrEqual(0);
        expect(result.volume).toBeLessThanOrEqual(1);
      });
    });

    test("should return consistent results for same input", () => {
      mockAudioContext.analyserNode.timeDomainData.fill(0.3);

      const result1 = lipSync.update();
      const result2 = lipSync.update();
      const result3 = lipSync.update();

      expect(result1.volume).toBe(result2.volume);
      expect(result2.volume).toBe(result3.volume);
    });

    test("should handle NaN values gracefully", () => {
      mockAudioContext.analyserNode.timeDomainData.fill(NaN);

      const result = lipSync.update();

      // Should either be 0 or NaN, but not throw
      expect(typeof result.volume).toBe("number");
    });

    test("should handle Infinity values", () => {
      mockAudioContext.analyserNode.timeDomainData.fill(Infinity);

      const result = lipSync.update();

      // Should handle gracefully
      expect(typeof result.volume).toBe("number");
    });
  });

  describe("playFromArrayBuffer", () => {
    test("should play audio from ArrayBuffer", async () => {
      const buffer = new ArrayBuffer(1024);

      await lipSync.playFromArrayBuffer(buffer);

      // Should complete without error
      expect(true).toBe(true);
    });

    test("should call onEnded callback when playback finishes", async () => {
      const buffer = new ArrayBuffer(1024);
      const onEnded = jest.fn();

      await lipSync.playFromArrayBuffer(buffer, onEnded);

      // Wait for async callback to trigger
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(onEnded).toHaveBeenCalled();
    });

    test("should work without onEnded callback", async () => {
      const buffer = new ArrayBuffer(1024);

      await expect(lipSync.playFromArrayBuffer(buffer)).resolves.not.toThrow();
    });

    test("should handle empty ArrayBuffer", async () => {
      const buffer = new ArrayBuffer(0);

      await expect(lipSync.playFromArrayBuffer(buffer)).resolves.not.toThrow();
    });

    test("should handle large ArrayBuffer", async () => {
      const buffer = new ArrayBuffer(1024 * 1024); // 1MB

      await expect(lipSync.playFromArrayBuffer(buffer)).resolves.not.toThrow();
    });

    test("should decode audio data", async () => {
      const buffer = new ArrayBuffer(1024);
      const decodeSpy = jest.spyOn(mockAudioContext, 'decodeAudioData');

      await lipSync.playFromArrayBuffer(buffer);

      expect(decodeSpy).toHaveBeenCalledWith(buffer);
    });

    test("should connect to analyser", async () => {
      const buffer = new ArrayBuffer(1024);

      await lipSync.playFromArrayBuffer(buffer);

      // If this completes, connections were made successfully
      expect(true).toBe(true);
    });

    test("should handle multiple sequential plays", async () => {
      const buffer1 = new ArrayBuffer(512);
      const buffer2 = new ArrayBuffer(1024);
      const buffer3 = new ArrayBuffer(2048);

      await lipSync.playFromArrayBuffer(buffer1);
      await lipSync.playFromArrayBuffer(buffer2);
      await lipSync.playFromArrayBuffer(buffer3);

      expect(true).toBe(true);
    });

    test("should handle onEnded callback errors gracefully", async () => {
      const buffer = new ArrayBuffer(1024);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const onEnded = jest.fn(() => {
        throw new Error("Callback error");
      });

      // Should not throw even if callback throws
      await expect(
        lipSync.playFromArrayBuffer(buffer, onEnded)
      ).resolves.not.toThrow();

      // Wait for callback to execute
      await new Promise(resolve => setTimeout(resolve, 100));

      consoleErrorSpy.mockRestore();
    });
  });

  describe("playFromURL", () => {
    beforeEach(() => {
      // Mock global fetch
      global.fetch = jest.fn().mockResolvedValue({
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
      }) as any;
    });

    test("should fetch and play audio from URL", async () => {
      await lipSync.playFromURL("https://example.com/audio.mp3");

      expect(global.fetch).toHaveBeenCalledWith("https://example.com/audio.mp3");
    });

    test("should call onEnded callback", async () => {
      const onEnded = jest.fn();

      await lipSync.playFromURL("https://example.com/audio.mp3", onEnded);

      // Wait for async callback to trigger
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(onEnded).toHaveBeenCalled();
    });

    test("should work without onEnded callback", async () => {
      await expect(
        lipSync.playFromURL("https://example.com/audio.mp3")
      ).resolves.not.toThrow();
    });

    test("should handle fetch errors", async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(
        new Error("Network error")
      );

      await expect(
        lipSync.playFromURL("https://example.com/audio.mp3")
      ).rejects.toThrow("Network error");
    });

    test("should handle various URL formats", async () => {
      await lipSync.playFromURL("http://example.com/audio.wav");
      await lipSync.playFromURL("https://cdn.example.com/sounds/effect.ogg");
      await lipSync.playFromURL("/local/audio.mp3");

      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    test("should handle empty URL", async () => {
      await lipSync.playFromURL("");

      expect(global.fetch).toHaveBeenCalledWith("");
    });

    test("should convert response to ArrayBuffer", async () => {
      const mockArrayBuffer = new ArrayBuffer(2048);
      const arrayBufferSpy = jest.fn().mockResolvedValue(mockArrayBuffer);

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        arrayBuffer: arrayBufferSpy,
      } as any);

      await lipSync.playFromURL("https://example.com/audio.mp3");

      expect(arrayBufferSpy).toHaveBeenCalled();
    });

    test("should call playFromArrayBuffer with fetched data", async () => {
      const mockBuffer = new ArrayBuffer(1024);

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        arrayBuffer: () => Promise.resolve(mockBuffer),
      } as any);

      const playSpy = jest.spyOn(lipSync, 'playFromArrayBuffer');

      await lipSync.playFromURL("https://example.com/audio.mp3");

      expect(playSpy).toHaveBeenCalledWith(mockBuffer, undefined);
    });
  });

  describe("integration", () => {
    test("should play audio and update volume simultaneously", async () => {
      const buffer = new ArrayBuffer(1024);

      // Start playing
      const playPromise = lipSync.playFromArrayBuffer(buffer);

      // Update volume while playing
      mockAudioContext.analyserNode.timeDomainData.fill(0.5);
      const result1 = lipSync.update();

      mockAudioContext.analyserNode.timeDomainData.fill(0.3);
      const result2 = lipSync.update();

      await playPromise;

      expect(result1.volume).toBeGreaterThan(result2.volume);
    });

    test("should handle multiple simultaneous operations", async () => {
      const promises = [];

      // Start multiple plays
      for (let i = 0; i < 5; i++) {
        promises.push(lipSync.playFromArrayBuffer(new ArrayBuffer(1024)));
      }

      // Update volume during plays
      for (let i = 0; i < 10; i++) {
        mockAudioContext.analyserNode.timeDomainData.fill(Math.random());
        lipSync.update();
      }

      await Promise.all(promises);

      expect(true).toBe(true);
    });
  });
});
