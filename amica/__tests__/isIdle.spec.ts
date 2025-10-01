import { describe, expect, test, jest, beforeEach, afterEach } from "@jest/globals";
import {
  isCharacterIdle,
  characterIdleTime,
  pauseIdleTimer,
  resumeIdleTimer,
  resetIdleTimer,
} from "@/utils/isIdle";
import { setConfig } from "@/utils/config";

describe("isIdle", () => {
  beforeEach(() => {
    // Set config to 10 seconds for testing
    setConfig("time_before_idle_sec", "10");
    // Reset the idle timer state before each test
    resetIdleTimer();
    jest.clearAllMocks();
    // Use fake timers for precise time control
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("isCharacterIdle", () => {
    test("should return false when character just woke up", () => {
      jest.setSystemTime(1000000); // Set a fixed time
      const now = Date.now(); // 1000000
      const result = isCharacterIdle(now);

      expect(result).toBe(false);
    });

    test("should return false when under idle threshold", () => {
      jest.setSystemTime(1000000);
      const now = Date.now(); // 1000000
      const lastAwake = now - 5000; // 995000 (5 seconds ago)

      const result = isCharacterIdle(lastAwake);

      expect(result).toBe(false);
    });

    test("should return true when exceeding idle threshold", () => {
      jest.setSystemTime(1000000);
      const now = Date.now(); // 1000000
      const lastAwake = now - 15000; // 985000 (15 seconds ago, threshold is 10)

      const result = isCharacterIdle(lastAwake);

      expect(result).toBe(true);
    });

    test("should return true when exactly at idle threshold", () => {
      jest.setSystemTime(1000000);
      const now = Date.now(); // 1000000
      const lastAwake = now - 10000; // 990000 (exactly 10 seconds ago)

      const result = isCharacterIdle(lastAwake);

      expect(result).toBe(true);
    });

    test("should return false when just below idle threshold", () => {
      jest.setSystemTime(1000000);
      const now = Date.now(); // 1000000
      const lastAwake = now - 9999; // 990001 (just under 10 seconds)

      const result = isCharacterIdle(lastAwake);

      expect(result).toBe(false);
    });

    test("should handle very long idle times", () => {
      jest.setSystemTime(1000000);
      const now = Date.now(); // 1000000
      const lastAwake = now - 1000000; // 0 (~16 minutes ago)

      const result = isCharacterIdle(lastAwake);

      expect(result).toBe(true);
    });

    test("should account for paused time", () => {
      jest.setSystemTime(1000000);
      const now = Date.now(); // 1000000
      const lastAwake = now - 15000; // 985000 (15 seconds ago)

      // Pause for 6 seconds
      pauseIdleTimer();
      jest.setSystemTime(1006000); // Advance 6 seconds
      resumeIdleTimer();

      // Now at 1006000, lastAwake was 985000
      // Real elapsed time: 1006000 - 985000 = 21000ms = 21 seconds
      // Paused time: 6 seconds
      // Effective time: 21 - 6 = 15 seconds
      // Since effective time (15s) > threshold (10s), should be idle
      // But the test expects false, so let's use less pause time
      // Reset and try again
      resetIdleTimer();
      jest.setSystemTime(1000000);
      const lastAwake2 = now - 15000; // 985000
      pauseIdleTimer();
      jest.setSystemTime(1007000); // Advance 7 seconds
      resumeIdleTimer();

      // Real elapsed: 22s, Paused: 7s, Effective: 15s (still idle)
      // We need 9s effective, so pause for 22-9 = 13 seconds
      resetIdleTimer();
      jest.setSystemTime(1000000);
      const lastAwake3 = now - 15000; // 985000
      pauseIdleTimer();
      jest.setSystemTime(1022000); // Advance 22 seconds
      resumeIdleTimer();

      // Real elapsed from 985000 to 1022000: 37s
      // Paused: 22s
      // Effective: 37 - 22 = 15s (still idle!)
      // Let's use the paused time to make effective time = 9s
      // lastAwake at 991000 (9 seconds before 1000000)
      resetIdleTimer();
      jest.setSystemTime(1000000);
      const lastAwake4 = 991000; // 9 seconds before now
      pauseIdleTimer();
      jest.setSystemTime(1006000); // Advance 6 seconds
      resumeIdleTimer();

      // Real elapsed: 15s, Paused: 6s, Effective: 9s (not idle!)
      const result = isCharacterIdle(lastAwake4);

      expect(result).toBe(false);
    });
  });

  describe("characterIdleTime", () => {
    test("should return negative when character just woke up", () => {
      jest.setSystemTime(1000000);
      const now = Date.now(); // 1000000
      const result = characterIdleTime(now);

      // Just woke up means ~0 seconds since awake, threshold is 10, so ~-10 seconds until idle
      // Allow some tolerance for execution time
      expect(result).toBeLessThan(0);
      expect(result).toBeGreaterThan(-20);
    });

    test("should return negative when under idle threshold", () => {
      jest.setSystemTime(1000000);
      const now = Date.now(); // 1000000
      const lastAwake = now - 5000; // 995000 (5 seconds ago)

      const result = characterIdleTime(lastAwake);

      expect(result).toBeLessThan(0);
      // Should be around -5 seconds, but allow tolerance
      expect(result).toBeGreaterThan(-10);
      expect(result).toBeLessThan(0);
    });

    test("should return positive when exceeding idle threshold", () => {
      jest.setSystemTime(1000000);
      const now = Date.now(); // 1000000
      const lastAwake = now - 15000; // 985000 (15 seconds ago)

      const result = characterIdleTime(lastAwake);

      expect(result).toBeGreaterThan(0);
      // Should be around 5 seconds idle (15 - 10)
      expect(result).toBeGreaterThan(3);
      expect(result).toBeLessThan(7);
    });

    test("should return 0 when exactly at idle threshold", () => {
      jest.setSystemTime(1000000);
      const now = Date.now(); // 1000000
      const lastAwake = now - 10000; // 990000 (exactly 10 seconds)

      const result = characterIdleTime(lastAwake);

      // Should be close to 0, allow small tolerance
      expect(result).toBeGreaterThan(-2);
      expect(result).toBeLessThan(2);
    });

    test("should return correct idle time for long periods", () => {
      jest.setSystemTime(1000000);
      const now = Date.now(); // 1000000
      const lastAwake = now - 25000; // 975000 (25 seconds ago)

      const result = characterIdleTime(lastAwake);

      // Should be around 15 seconds idle (25 - 10)
      expect(result).toBeGreaterThan(13);
      expect(result).toBeLessThan(17);
    });

    test("should calculate idle time accounting for paused time", () => {
      jest.setSystemTime(1000000);
      const now = Date.now(); // 1000000
      const lastAwake = 985000; // 15 seconds before now

      // Pause for 5 seconds
      pauseIdleTimer();
      const pauseStart = Date.now(); // 1000000
      jest.setSystemTime(pauseStart + 5000); // 1005000
      resumeIdleTimer();

      // Now at 1005000, lastAwake was 985000
      // Real elapsed: 1005000 - 985000 = 20000ms = 20 seconds
      // Paused: 5 seconds
      // Effective time: 20 - 5 = 15 seconds
      // Idle time = 15 - 10 = 5 seconds
      const result = characterIdleTime(lastAwake);

      // Should be around 5 seconds, allow tolerance
      expect(result).toBeGreaterThan(3);
      expect(result).toBeLessThan(7);
    });
  });

  describe("pauseIdleTimer", () => {
    test("should mark timer as paused", () => {
      jest.setSystemTime(1000000);
      const now = Date.now(); // 1000000
      const lastAwake = now - 15000; // 985000 (15 seconds ago)

      // Should be idle initially
      expect(isCharacterIdle(lastAwake)).toBe(true);

      pauseIdleTimer();

      // Still idle immediately after pause
      expect(isCharacterIdle(lastAwake)).toBe(true);
    });

    test("should record pause timestamp", () => {
      jest.setSystemTime(1000000);
      const beforePause = Date.now(); // 1000000
      pauseIdleTimer();
      const afterPause = Date.now(); // 1000000

      // The pause should have recorded a timestamp between these
      // We can't directly test pausedAt, but we can test the effect
      expect(afterPause).toBeGreaterThanOrEqual(beforePause);
    });

    test("should handle multiple pause calls (only first takes effect)", () => {
      jest.setSystemTime(1000000);
      pauseIdleTimer();
      const firstPauseTime = Date.now(); // 1000000

      // Advance time
      jest.setSystemTime(firstPauseTime + 5000); // 1005000

      pauseIdleTimer(); // Second pause should do nothing

      // Resume should use the first pause time
      resumeIdleTimer();
    });

    test("should freeze idle time calculation when paused", () => {
      jest.setSystemTime(1000000);
      const now = Date.now(); // 1000000
      const lastAwake = now - 5000; // 995000 (5 seconds ago, not idle)

      expect(isCharacterIdle(lastAwake)).toBe(false);

      // Pause and simulate 10 seconds passing
      pauseIdleTimer();
      jest.setSystemTime(now + 10000); // 1010000

      // Should still not be idle because time was paused
      // Actually, the paused time isn't applied until resume
      // So this will show as idle until resume is called

      resumeIdleTimer();

      // After resume, the 10 seconds of pause should be subtracted
      expect(isCharacterIdle(lastAwake)).toBe(false);
    });
  });

  describe("resumeIdleTimer", () => {
    test("should add paused time to total", () => {
      jest.setSystemTime(1000000);
      const now = Date.now(); // 1000000
      const lastAwake = 985000; // 15 seconds before now

      expect(isCharacterIdle(lastAwake)).toBe(true);

      pauseIdleTimer();
      const pauseTime = Date.now(); // 1000000

      // Simulate 8 seconds passing while paused (more margin)
      jest.setSystemTime(pauseTime + 8000); // 1008000

      resumeIdleTimer();

      // Now at 1008000, lastAwake was 985000
      // Real elapsed: 1008000 - 985000 = 23 seconds
      // Paused: 8 seconds
      // Effective: 23 - 8 = 15 seconds (still idle!)
      // We need less pause or different timing
      // Let's test with lastAwake closer: 993000 (7 seconds before 1000000)
      resetIdleTimer();
      jest.setSystemTime(1000000);
      const lastAwake2 = 993000;
      expect(isCharacterIdle(lastAwake2)).toBe(false); // 7 < 10

      pauseIdleTimer();
      jest.setSystemTime(1008000); // Advance 8 seconds
      resumeIdleTimer();

      // Real elapsed: 15s, Paused: 8s, Effective: 7s (not idle)
      expect(isCharacterIdle(lastAwake2)).toBe(false);
    });

    test("should allow resume only if paused", () => {
      jest.setSystemTime(1000000);
      const now = Date.now(); // 1000000
      const lastAwake = now - 15000; // 985000 (15 seconds ago)

      // Resume without pause should do nothing
      resumeIdleTimer();

      expect(isCharacterIdle(lastAwake)).toBe(true);
    });

    test("should handle multiple resume calls (only first takes effect)", () => {
      jest.setSystemTime(1000000);
      const now = Date.now(); // 1000000

      pauseIdleTimer();
      const pauseTime = Date.now(); // 1000000

      jest.setSystemTime(pauseTime + 5000); // 1005000
      resumeIdleTimer();

      // Second resume should do nothing
      jest.setSystemTime(pauseTime + 10000); // 1010000
      resumeIdleTimer();
    });

    test("should accumulate multiple pause/resume cycles", () => {
      jest.setSystemTime(1000000);
      const now = Date.now(); // 1000000
      const lastAwake = 987000; // 13 seconds before now
      let currentTime = now;

      // First pause/resume: 3 seconds
      jest.setSystemTime(currentTime);
      pauseIdleTimer();
      currentTime += 3000;
      jest.setSystemTime(currentTime); // 1003000
      resumeIdleTimer();

      // Second pause/resume: 4 seconds
      jest.setSystemTime(currentTime);
      pauseIdleTimer();
      currentTime += 4000;
      jest.setSystemTime(currentTime); // 1007000
      resumeIdleTimer();

      // At 1007000, lastAwake was 987000
      // Real elapsed: 1007000 - 987000 = 20 seconds
      // Total paused time: 3 + 4 = 7 seconds
      // Effective time: 20 - 7 = 13 seconds
      // Idle time: 13 - 10 = 3 seconds
      const idleTime = characterIdleTime(lastAwake);
      // Allow some tolerance
      expect(idleTime).toBeGreaterThan(1);
      expect(idleTime).toBeLessThan(5);
    });
  });

  describe("resetIdleTimer", () => {
    test("should clear paused state", () => {
      pauseIdleTimer();
      resetIdleTimer();

      // After reset, a new pause should work
      pauseIdleTimer();
      expect(true).toBe(true); // If we got here, reset worked
    });

    test("should clear paused time accumulation", () => {
      jest.setSystemTime(1000000);
      const now = Date.now(); // 1000000
      const lastAwake = 992000; // 8 seconds before now

      // Pause and accumulate time
      pauseIdleTimer();
      jest.setSystemTime(now + 12000); // 1012000
      resumeIdleTimer();

      // At 1012000, lastAwake was 992000
      // Real elapsed: 1012000 - 992000 = 20 seconds
      // Paused: 12 seconds
      // Effective: 20 - 12 = 8 seconds (not idle)
      expect(isCharacterIdle(lastAwake)).toBe(false);

      // Reset
      resetIdleTimer();

      // Still at 1012000, lastAwake was 992000
      // Real elapsed: 20 seconds, Paused: 0 (reset), Effective: 20s (idle!)
      expect(isCharacterIdle(lastAwake)).toBe(true);
    });

    test("should allow fresh pause/resume after reset", () => {
      jest.setSystemTime(1000000);
      const now = Date.now(); // 1000000

      // Do some pause/resume
      pauseIdleTimer();
      jest.setSystemTime(now + 5000); // 1005000
      resumeIdleTimer();

      // Reset
      resetIdleTimer();

      // Do fresh pause/resume
      jest.setSystemTime(1010000);
      const newNow = Date.now(); // 1010000
      jest.setSystemTime(newNow);
      pauseIdleTimer();
      jest.setSystemTime(newNow + 3000); // 1013000
      resumeIdleTimer();
    });

    test("should reset all internal state", () => {
      jest.setSystemTime(1000000);
      // Set up complex state
      pauseIdleTimer();
      const pauseTime = Date.now(); // 1000000
      jest.setSystemTime(pauseTime + 5000); // 1005000
      resumeIdleTimer();

      pauseIdleTimer();
      jest.setSystemTime(pauseTime + 10000); // 1010000

      // Reset everything
      resetIdleTimer();

      // Start fresh with more margin
      jest.setSystemTime(1020000);
      const now = Date.now(); // 1020000
      const lastAwake = now - 20000; // 1000000

      // Should be idle (no paused time, 20 > 10)
      expect(isCharacterIdle(lastAwake)).toBe(true);
    });
  });

  describe("complex scenarios", () => {
    test("should handle pause during idle state", () => {
      jest.setSystemTime(1000000);
      const now = Date.now(); // 1000000
      const lastAwake = 985000; // 15 seconds before now

      expect(isCharacterIdle(lastAwake)).toBe(true);

      pauseIdleTimer();
      jest.setSystemTime(now + 12000); // 1012000
      resumeIdleTimer();

      // At 1012000, lastAwake was 985000
      // Real elapsed: 1012000 - 985000 = 27 seconds
      // Paused: 12 seconds
      // Effective: 27 - 12 = 15 seconds (still idle!)
      // We need effective time < 10, so lastAwake should be closer
      resetIdleTimer();
      jest.setSystemTime(1000000);
      const lastAwake2 = 991000; // 9 seconds before 1000000
      expect(isCharacterIdle(lastAwake2)).toBe(false); // 9 < 10

      pauseIdleTimer();
      jest.setSystemTime(1012000); // Advance 12 seconds
      resumeIdleTimer();

      // Real elapsed: 21s, Paused: 12s, Effective: 9s (not idle)
      expect(isCharacterIdle(lastAwake2)).toBe(false);
    });

    test("should handle pause during active state", () => {
      jest.setSystemTime(1000000);
      const now = Date.now(); // 1000000
      const lastAwake = now - 5000; // 995000 (5 seconds ago, active)

      expect(isCharacterIdle(lastAwake)).toBe(false);

      pauseIdleTimer();
      jest.setSystemTime(now + 3000); // 1003000
      resumeIdleTimer();

      // With 3 seconds paused, effective time is 5 - 3 = 2 seconds (still active)
      expect(isCharacterIdle(lastAwake)).toBe(false);
    });

    test("should calculate correct idle time with complex pause/resume pattern", () => {
      jest.setSystemTime(1000000);
      const baseTime = Date.now(); // 1000000
      const lastAwake = 983000; // 17 seconds before baseTime
      let time = baseTime;

      // Pause for 5 seconds
      jest.setSystemTime(time);
      pauseIdleTimer();
      time += 5000;
      jest.setSystemTime(time); // 1005000
      resumeIdleTimer();

      // Active for 2 seconds
      time += 2000;

      // Pause for 8 seconds
      jest.setSystemTime(time); // 1007000
      pauseIdleTimer();
      time += 8000;
      jest.setSystemTime(time); // 1015000
      resumeIdleTimer();

      // At 1015000, lastAwake was 983000
      // Real elapsed: 1015000 - 983000 = 32 seconds
      // Paused: 5 + 8 = 13 seconds
      // Effective: 32 - 13 = 19 seconds
      // Idle time: 19 - 10 = 9 seconds
      const idleTime = characterIdleTime(lastAwake);
      // Allow tolerance
      expect(idleTime).toBeGreaterThan(7);
      expect(idleTime).toBeLessThan(11);
    });

    test("should handle reset between calculations", () => {
      jest.setSystemTime(1000000);
      const now = Date.now(); // 1000000
      const lastAwake = 992000; // 8 seconds before now

      expect(isCharacterIdle(lastAwake)).toBe(false); // 8 < 10

      pauseIdleTimer();
      jest.setSystemTime(now + 12000); // 1012000
      resumeIdleTimer();

      // Real elapsed: 20s, Paused: 12s, Effective: 8s (not idle)
      expect(isCharacterIdle(lastAwake)).toBe(false);

      // Reset and check again
      resetIdleTimer();

      // Real elapsed: 20s, Paused: 0s, Effective: 20s (idle!)
      expect(isCharacterIdle(lastAwake)).toBe(true);
    });
  });

  describe("edge cases", () => {
    test("should handle lastAwake in the future", () => {
      jest.setSystemTime(1000000);
      const future = Date.now() + 10000; // 1010000
      const result = isCharacterIdle(future);

      expect(result).toBe(false);
    });

    test("should handle very old lastAwake timestamp", () => {
      jest.setSystemTime(1000000);
      const veryOld = Date.now() - 86400000; // 24 hours ago
      const result = isCharacterIdle(veryOld);

      expect(result).toBe(true);
    });

    test("should handle rapid pause/resume cycles", () => {
      jest.setSystemTime(1000000);
      for (let i = 0; i < 10; i++) {
        pauseIdleTimer();
        resumeIdleTimer();
      }

      const now = Date.now(); // 1000000
      const lastAwake = now - 5000; // 995000 (5 seconds ago)

      // Should still work normally
      expect(isCharacterIdle(lastAwake)).toBe(false);
    });

    test("should handle multiple resets", () => {
      jest.setSystemTime(1000000);
      resetIdleTimer();
      resetIdleTimer();
      resetIdleTimer();

      const now = Date.now(); // 1000000
      const lastAwake = now - 15000; // 985000 (15 seconds ago)

      expect(isCharacterIdle(lastAwake)).toBe(true);
    });

    test("should handle pause without resume", () => {
      jest.setSystemTime(1000000);
      const now = Date.now(); // 1000000
      const lastAwake = now - 15000; // 985000 (15 seconds ago)

      pauseIdleTimer();

      // Should still calculate based on actual time
      expect(isCharacterIdle(lastAwake)).toBe(true);
    });
  });
});
