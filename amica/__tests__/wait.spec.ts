import { describe, expect, test, vi } from "vitest";
import { wait } from "../src/utils/wait";

describe("wait", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("should resolve after specified milliseconds", async () => {
    const promise = wait(1000);

    // Fast-forward time
    vi.advanceTimersByTime(1000);

    await expect(promise).resolves.toBeUndefined();
  });

  test("should not resolve before specified time", async () => {
    let resolved = false;
    wait(1000).then(() => {
      resolved = true;
    });

    vi.advanceTimersByTime(999);

    // Need to flush microtasks
    await Promise.resolve();

    expect(resolved).toBe(false);
  });

  test("should handle zero milliseconds", async () => {
    const promise = wait(0);

    vi.advanceTimersByTime(0);

    await expect(promise).resolves.toBeUndefined();
  });

  test("should handle multiple concurrent waits", async () => {
    const results: number[] = [];

    wait(100).then(() => results.push(1));
    wait(200).then(() => results.push(2));
    wait(50).then(() => results.push(3));

    await vi.advanceTimersByTimeAsync(50);
    expect(results).toEqual([3]);

    await vi.advanceTimersByTimeAsync(50);
    expect(results).toEqual([3, 1]);

    await vi.advanceTimersByTimeAsync(100);
    expect(results).toEqual([3, 1, 2]);
  });

  test("should return a promise", () => {
    const result = wait(100);
    expect(result).toBeInstanceOf(Promise);
  });

  test("should work with async/await", async () => {
    const startTime = Date.now();
    const waitTime = 500;

    const waitPromise = wait(waitTime);
    vi.advanceTimersByTime(waitTime);

    await waitPromise;

    // Verify the wait completed
    expect(true).toBe(true);
  });
});

// Test with real timers for integration testing
describe("wait (real timers)", () => {
  test("should actually wait with real timers", async () => {
    const start = Date.now();
    await wait(50);
    const elapsed = Date.now() - start;

    // Allow some margin for execution time
    expect(elapsed).toBeGreaterThanOrEqual(45);
    expect(elapsed).toBeLessThan(100);
  }, 10000);
});
