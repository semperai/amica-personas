import { describe, expect, test, jest, beforeEach, afterEach } from "@jest/globals";

/**
 * Advanced Integration Tests
 *
 * These tests cover complex scenarios that involve multiple modules working together,
 * async race conditions, error propagation, and edge cases.
 */

describe("Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("Complex Async Flows", () => {
    test("should handle Promise.race with timeout", async () => {
      const slowOperation = new Promise((resolve) => {
        setTimeout(() => resolve("slow"), 5000);
      });

      const timeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Timeout")), 1000);
      });

      const racePromise = Promise.race([slowOperation, timeout]);

      // Fast-forward 1000ms to trigger timeout
      jest.advanceTimersByTime(1000);

      await expect(racePromise).rejects.toThrow("Timeout");
    });

    test("should handle Promise.race with successful fast operation", async () => {
      const fastOperation = new Promise((resolve) => {
        setTimeout(() => resolve("fast"), 100);
      });

      const slowOperation = new Promise((resolve) => {
        setTimeout(() => resolve("slow"), 5000);
      });

      const racePromise = Promise.race([fastOperation, slowOperation]);

      // Fast-forward 100ms to trigger fast operation
      jest.advanceTimersByTime(100);

      await expect(racePromise).resolves.toBe("fast");
    });

    test("should handle Promise.all with mixed timings", async () => {
      const promises = [
        new Promise((resolve) => setTimeout(() => resolve("first"), 100)),
        new Promise((resolve) => setTimeout(() => resolve("second"), 200)),
        new Promise((resolve) => setTimeout(() => resolve("third"), 300)),
      ];

      const allPromise = Promise.all(promises);

      // Fast-forward to complete all promises
      jest.advanceTimersByTime(300);

      await expect(allPromise).resolves.toEqual(["first", "second", "third"]);
    });

    test("should handle Promise.all with one failure", async () => {
      const promises = [
        new Promise((resolve) => setTimeout(() => resolve("first"), 100)),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Failed")), 200)),
        new Promise((resolve) => setTimeout(() => resolve("third"), 300)),
      ];

      const allPromise = Promise.all(promises);

      // Fast-forward to trigger the rejection
      jest.advanceTimersByTime(200);

      await expect(allPromise).rejects.toThrow("Failed");
    });

    test("should handle Promise.allSettled with mixed results", async () => {
      const promises = [
        new Promise((resolve) => setTimeout(() => resolve("success"), 100)),
        new Promise((_, reject) => setTimeout(() => reject(new Error("failed")), 200)),
        new Promise((resolve) => setTimeout(() => resolve("another success"), 300)),
      ];

      const settledPromise = Promise.allSettled(promises);

      // Fast-forward to complete all promises
      jest.advanceTimersByTime(300);

      const results = await settledPromise;

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ status: "fulfilled", value: "success" });
      expect(results[1]).toMatchObject({ status: "rejected" });
      expect(results[2]).toEqual({ status: "fulfilled", value: "another success" });
    });

    test("should handle retry logic with exponential backoff", async () => {
      let attempts = 0;
      const maxAttempts = 3;

      const operation = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < maxAttempts) {
          return Promise.reject(new Error(`Attempt ${attempts} failed`));
        }
        return Promise.resolve("Success");
      });

      const retryWithBackoff = async (fn: () => Promise<string>, maxRetries: number): Promise<string> => {
        let lastError: Error | undefined;

        for (let i = 0; i < maxRetries; i++) {
          try {
            return await fn();
          } catch (error) {
            lastError = error as Error;
            if (i < maxRetries - 1) {
              // Exponential backoff: 100ms, 200ms, 400ms
              const delay = 100 * Math.pow(2, i);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }

        throw lastError;
      };

      const retryPromise = retryWithBackoff(operation, maxAttempts);

      // Run all timers to completion
      await jest.runAllTimersAsync();

      const result = await retryPromise;

      expect(result).toBe("Success");
      expect(operation).toHaveBeenCalledTimes(3);
    });

    test("should handle debounce pattern", async () => {
      const mockFn = jest.fn();
      const debounceDelay = 300;

      const debounce = (fn: Function, delay: number) => {
        let timeoutId: NodeJS.Timeout | null = null;

        return (...args: any[]) => {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }

          timeoutId = setTimeout(() => {
            fn(...args);
          }, delay);
        };
      };

      const debouncedFn = debounce(mockFn, debounceDelay);

      // Call multiple times rapidly
      debouncedFn("first");
      jest.advanceTimersByTime(100);

      debouncedFn("second");
      jest.advanceTimersByTime(100);

      debouncedFn("third");
      jest.advanceTimersByTime(100);

      // At this point, no calls should have been made yet
      expect(mockFn).not.toHaveBeenCalled();

      // Wait for debounce delay from last call
      jest.advanceTimersByTime(200);

      // Should have been called once with the last value
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith("third");
    });

    test("should handle throttle pattern", () => {
      jest.setSystemTime(1000);

      const mockFn = jest.fn();
      const throttleDelay = 1000;

      const throttle = (fn: Function, delay: number) => {
        let lastCall: number | null = null;

        return (...args: any[]) => {
          const now = Date.now();

          if (lastCall === null || now - lastCall >= delay) {
            lastCall = now;
            fn(...args);
          }
        };
      };

      const throttledFn = throttle(mockFn, throttleDelay);

      // First call should execute immediately
      throttledFn("first");
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith("first");

      // Rapid calls within throttle window should be ignored
      jest.setSystemTime(1500);
      throttledFn("second");
      expect(mockFn).toHaveBeenCalledTimes(1);

      jest.setSystemTime(1800);
      throttledFn("third");
      expect(mockFn).toHaveBeenCalledTimes(1);

      // After throttle window, next call should execute
      jest.setSystemTime(2000);
      throttledFn("fourth");
      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenCalledWith("fourth");
    });

    test("should handle async queue with concurrency limit", async () => {
      const results: string[] = [];
      let activeCount = 0;
      let maxConcurrent = 0;

      const task = (id: string, duration: number) => {
        return new Promise<string>((resolve) => {
          activeCount++;
          maxConcurrent = Math.max(maxConcurrent, activeCount);

          setTimeout(() => {
            activeCount--;
            results.push(id);
            resolve(id);
          }, duration);
        });
      };

      const asyncQueue = async (tasks: Array<() => Promise<string>>, limit: number) => {
        const executing: Promise<any>[] = [];
        const results: string[] = [];

        for (const taskFn of tasks) {
          const promise = taskFn().then(result => {
            executing.splice(executing.indexOf(promise), 1);
            return result;
          });

          executing.push(promise);
          results.push(await promise.then(r => r));

          if (executing.length >= limit) {
            await Promise.race(executing);
          }
        }

        await Promise.all(executing);
        return results;
      };

      const tasks = [
        () => task("task1", 100),
        () => task("task2", 200),
        () => task("task3", 150),
        () => task("task4", 100),
        () => task("task5", 50),
      ];

      const queuePromise = asyncQueue(tasks, 2);

      // Execute all timers
      await jest.runAllTimersAsync();

      await queuePromise;

      // Should never have more than 2 concurrent
      expect(maxConcurrent).toBeLessThanOrEqual(2);
      expect(results).toHaveLength(5);
    });
  });

  describe("Error Propagation", () => {
    test("should propagate errors through async chain", async () => {
      const step1 = async () => "step1";
      const step2 = async (data: string) => {
        if (data === "step1") {
          throw new Error("Step 2 failed");
        }
        return "step2";
      };
      const step3 = async (data: string) => data + "-step3";

      const pipeline = async () => {
        const result1 = await step1();
        const result2 = await step2(result1);
        const result3 = await step3(result2);
        return result3;
      };

      await expect(pipeline()).rejects.toThrow("Step 2 failed");
    });

    test("should handle errors in Promise.all with cleanup", async () => {
      const cleanup = jest.fn();

      const taskWithCleanup = (shouldFail: boolean) => {
        return new Promise<string>((resolve, reject) => {
          setTimeout(() => {
            if (shouldFail) {
              cleanup();
              reject(new Error("Task failed"));
            } else {
              resolve("success");
            }
          }, 100);
        });
      };

      const tasks = [
        taskWithCleanup(false),
        taskWithCleanup(true),
        taskWithCleanup(false),
      ];

      const allPromise = Promise.all(tasks);
      jest.advanceTimersByTime(100);

      await expect(allPromise).rejects.toThrow("Task failed");
      expect(cleanup).toHaveBeenCalled();
    });

    test("should handle nested try-catch with finally", async () => {
      const outerFinally = jest.fn();
      const innerFinally = jest.fn();
      const catchHandler = jest.fn();

      const operation = async () => {
        try {
          try {
            throw new Error("Inner error");
          } catch (error) {
            catchHandler(error);
            throw error; // Re-throw
          } finally {
            innerFinally();
          }
        } finally {
          outerFinally();
        }
      };

      await expect(operation()).rejects.toThrow("Inner error");
      expect(catchHandler).toHaveBeenCalled();
      expect(innerFinally).toHaveBeenCalled();
      expect(outerFinally).toHaveBeenCalled();
    });

    test("should handle error recovery with fallback", async () => {
      const primaryOperation = jest.fn().mockRejectedValue(new Error("Primary failed"));
      const fallbackOperation = jest.fn().mockResolvedValue("Fallback success");

      const operationWithFallback = async () => {
        try {
          return await primaryOperation();
        } catch (error) {
          console.log("Primary failed, using fallback");
          return await fallbackOperation();
        }
      };

      const result = await operationWithFallback();

      expect(result).toBe("Fallback success");
      expect(primaryOperation).toHaveBeenCalled();
      expect(fallbackOperation).toHaveBeenCalled();
    });

    test("should handle circular promise dependencies", async () => {
      // This tests a scenario where promises depend on each other
      let resolveA: (value: string) => void;
      let resolveB: (value: string) => void;

      const promiseA = new Promise<string>((resolve) => {
        resolveA = resolve;
      });

      const promiseB = new Promise<string>((resolve) => {
        resolveB = resolve;
      });

      const combined = Promise.all([promiseA, promiseB]).then(([a, b]) => {
        return `${a}-${b}`;
      });

      // Resolve in reverse order
      resolveB!("B");
      resolveA!("A");

      await expect(combined).resolves.toBe("A-B");
    });
  });

  describe("Race Conditions", () => {
    test("should handle concurrent state updates", async () => {
      let state = 0;
      const updates: number[] = [];

      const updateState = async (value: number, delay: number) => {
        await new Promise(resolve => setTimeout(resolve, delay));
        state = value;
        updates.push(value);
      };

      const concurrent = [
        updateState(1, 100),
        updateState(2, 50),
        updateState(3, 150),
      ];

      // Fast-forward through all delays
      jest.advanceTimersByTime(50);
      await Promise.resolve();

      jest.advanceTimersByTime(50);
      await Promise.resolve();

      jest.advanceTimersByTime(50);
      await Promise.resolve();

      await Promise.all(concurrent);

      // State should be the last one to complete
      expect(state).toBe(3);
      expect(updates).toEqual([2, 1, 3]);
    });

    test("should handle resource locking pattern", async () => {
      let isLocked = false;
      const operations: string[] = [];

      const withLock = async (fn: () => Promise<void>) => {
        while (isLocked) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        isLocked = true;
        try {
          await fn();
        } finally {
          isLocked = false;
        }
      };

      const operation = async (id: string) => {
        await withLock(async () => {
          operations.push(`${id}-start`);
          await new Promise(resolve => setTimeout(resolve, 50));
          operations.push(`${id}-end`);
        });
      };

      const concurrent = [
        operation("A"),
        operation("B"),
        operation("C"),
      ];

      // Run all operations
      await jest.runAllTimersAsync();
      await Promise.all(concurrent);

      // Operations should not interleave
      expect(operations).toEqual([
        "A-start", "A-end",
        "B-start", "B-end",
        "C-start", "C-end",
      ]);
    });

    test("should handle signal/abort pattern", async () => {
      const abortController = new AbortController();

      const longRunningOperation = async (signal: AbortSignal) => {
        for (let i = 0; i < 10; i++) {
          if (signal.aborted) {
            throw new Error("Operation aborted");
          }

          await new Promise(resolve => setTimeout(resolve, 100));
        }

        return "Completed";
      };

      const operationPromise = longRunningOperation(abortController.signal);

      // Abort after 250ms (should be in the middle)
      jest.advanceTimersByTime(250);
      abortController.abort();

      await expect(operationPromise).rejects.toThrow("Operation aborted");
    });

    test("should handle last-write-wins pattern", async () => {
      let latestTimestamp = 0;
      let data = "";

      const update = async (newData: string, timestamp: number, delay: number) => {
        await new Promise(resolve => setTimeout(resolve, delay));

        // Only update if this timestamp is newer
        if (timestamp >= latestTimestamp) {
          latestTimestamp = timestamp;
          data = newData;
        }
      };

      const updates = [
        update("first", 3, 300),   // Latest timestamp, slowest
        update("second", 1, 100),  // Earliest timestamp, fastest
        update("third", 2, 200),   // Middle timestamp, middle speed
      ];

      await jest.runAllTimersAsync();
      await Promise.all(updates);

      // Should have the write with highest timestamp (first)
      expect(data).toBe("first");
      expect(latestTimestamp).toBe(3);
    });
  });

  describe("Memory and Resource Management", () => {
    test("should handle cleanup of event listeners", () => {
      const eventTarget = new EventTarget();
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      eventTarget.addEventListener("test", handler1);
      eventTarget.addEventListener("test", handler2);

      // Dispatch event
      eventTarget.dispatchEvent(new Event("test"));
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);

      // Remove one handler
      eventTarget.removeEventListener("test", handler1);

      // Dispatch again
      eventTarget.dispatchEvent(new Event("test"));
      expect(handler1).toHaveBeenCalledTimes(1); // Not called again
      expect(handler2).toHaveBeenCalledTimes(2);
    });

    test("should handle WeakMap for memory management", () => {
      const cache = new WeakMap<object, string>();

      let obj1: object | null = { id: 1 };
      let obj2: object | null = { id: 2 };

      cache.set(obj1, "value1");
      cache.set(obj2, "value2");

      expect(cache.get(obj1)).toBe("value1");
      expect(cache.get(obj2)).toBe("value2");

      // Simulate garbage collection by removing references
      obj1 = null;

      // obj2 should still be accessible
      expect(cache.get(obj2!)).toBe("value2");
    });

    test("should handle cleanup on component unmount pattern", () => {
      const cleanup1 = jest.fn();
      const cleanup2 = jest.fn();
      const cleanupFunctions: Array<() => void> = [];

      const useEffect = (effect: () => (() => void) | void) => {
        const cleanup = effect();
        if (cleanup) {
          cleanupFunctions.push(cleanup);
        }
      };

      const unmount = () => {
        cleanupFunctions.forEach(fn => fn());
        cleanupFunctions.length = 0;
      };

      // Simulate mounting with effects
      useEffect(() => {
        return cleanup1;
      });

      useEffect(() => {
        return cleanup2;
      });

      // Simulate unmount
      unmount();

      expect(cleanup1).toHaveBeenCalledTimes(1);
      expect(cleanup2).toHaveBeenCalledTimes(1);
    });
  });

  describe("Complex Data Transformations", () => {
    test("should handle async data pipeline", async () => {
      const transform1 = async (data: number[]) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return data.map(x => x * 2);
      };

      const transform2 = async (data: number[]) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return data.filter(x => x > 5);
      };

      const transform3 = async (data: number[]) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return data.reduce((sum, x) => sum + x, 0);
      };

      const pipeline = async (input: number[]) => {
        const step1 = await transform1(input);
        const step2 = await transform2(step1);
        const step3 = await transform3(step2);
        return step3;
      };

      const pipelinePromise = pipeline([1, 2, 3, 4, 5]);

      await jest.runAllTimersAsync();

      const result = await pipelinePromise;

      // [1,2,3,4,5] -> [2,4,6,8,10] -> [6,8,10] -> 24
      expect(result).toBe(24);
    });

    test("should handle streaming data processing", async () => {
      const chunks: string[] = [];

      async function* generateChunks() {
        yield "Hello";
        await new Promise(resolve => setTimeout(resolve, 50));
        yield " ";
        await new Promise(resolve => setTimeout(resolve, 50));
        yield "World";
      }

      const processStream = async () => {
        for await (const chunk of generateChunks()) {
          chunks.push(chunk);
        }
      };

      const streamPromise = processStream();

      // Run all timers to process the async generator
      await jest.runAllTimersAsync();
      await streamPromise;

      expect(chunks).toEqual(["Hello", " ", "World"]);
    });

    test("should handle batching pattern", async () => {
      const batches: number[][] = [];

      const processBatch = async (items: number[]) => {
        batches.push([...items]);
        await new Promise(resolve => setTimeout(resolve, 100));
      };

      const batchProcessor = (batchSize: number, flushInterval: number) => {
        let batch: number[] = [];
        let timeoutId: NodeJS.Timeout | null = null;

        const flush = async () => {
          if (batch.length > 0) {
            await processBatch(batch);
            batch = [];
          }
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
        };

        const add = (item: number) => {
          batch.push(item);

          if (batch.length >= batchSize) {
            flush();
          } else if (!timeoutId) {
            timeoutId = setTimeout(flush, flushInterval);
          }
        };

        return { add, flush };
      };

      const processor = batchProcessor(3, 1000);

      // Add items
      processor.add(1);
      processor.add(2);
      processor.add(3); // Should trigger batch flush

      await jest.runAllTimersAsync();

      expect(batches).toHaveLength(1);
      expect(batches[0]).toEqual([1, 2, 3]);

      // Add more items, but not enough for a full batch
      processor.add(4);
      processor.add(5);

      // Wait for timeout flush
      jest.advanceTimersByTime(1000);
      await jest.runAllTimersAsync();

      expect(batches).toHaveLength(2);
      expect(batches[1]).toEqual([4, 5]);
    });
  });
});
