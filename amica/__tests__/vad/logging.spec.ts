import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { log, configureLogging, getLoggingConfig, LOG_PREFIX } from "../../src/lib/vad/logging";

describe("VAD Logging", () => {
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Reset to default config
    configureLogging({ minLevel: "warn", timestamps: false, prefix: LOG_PREFIX });
  });

  afterEach(() => {
    consoleDebugSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe("log levels", () => {
    test("should respect minLevel filtering (default: warn)", () => {
      log.debug("debug message");
      log.info("info message");
      log.warn("warn message");
      log.error("error message");

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith(LOG_PREFIX, "warn message");
      expect(consoleErrorSpy).toHaveBeenCalledWith(LOG_PREFIX, "error message");
    });

    test("should log all levels when minLevel is debug", () => {
      configureLogging({ minLevel: "debug" });

      log.debug("debug message");
      log.info("info message");
      log.warn("warn message");
      log.error("error message");

      expect(consoleDebugSpy).toHaveBeenCalledWith(LOG_PREFIX, "debug message");
      expect(consoleLogSpy).toHaveBeenCalledWith(LOG_PREFIX, "info message");
      expect(consoleWarnSpy).toHaveBeenCalledWith(LOG_PREFIX, "warn message");
      expect(consoleErrorSpy).toHaveBeenCalledWith(LOG_PREFIX, "error message");
    });

    test("should only log errors when minLevel is error", () => {
      configureLogging({ minLevel: "error" });

      log.debug("debug message");
      log.info("info message");
      log.warn("warn message");
      log.error("error message");

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(LOG_PREFIX, "error message");
    });

    test("should log info and above when minLevel is info", () => {
      configureLogging({ minLevel: "info" });

      log.debug("debug message");
      log.info("info message");
      log.warn("warn message");
      log.error("error message");

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(LOG_PREFIX, "info message");
      expect(consoleWarnSpy).toHaveBeenCalledWith(LOG_PREFIX, "warn message");
      expect(consoleErrorSpy).toHaveBeenCalledWith(LOG_PREFIX, "error message");
    });
  });

  describe("timestamps", () => {
    test("should not include timestamps by default", () => {
      configureLogging({ minLevel: "debug" });

      log.debug("test message");

      expect(consoleDebugSpy).toHaveBeenCalledWith(LOG_PREFIX, "test message");
      expect(consoleDebugSpy).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.stringMatching(/\[.*T.*Z\]/)
      );
    });

    test("should include ISO timestamps when enabled", () => {
      configureLogging({ minLevel: "debug", timestamps: true });

      log.debug("test message");

      const calls = consoleDebugSpy.mock.calls[0];
      expect(calls).toBeDefined();
      expect(calls?.[0]).toBe(LOG_PREFIX);
      expect(calls?.[1]).toMatch(/\[.*T.*Z\]/); // ISO 8601 format
      expect(calls?.[2]).toBe("test message");
    });

    test("should include timestamps for all log levels when enabled", () => {
      configureLogging({ minLevel: "debug", timestamps: true });

      log.error("error message");
      log.warn("warn message");
      log.info("info message");
      log.debug("debug message");

      expect(consoleErrorSpy.mock.calls[0]?.[1]).toMatch(/\[.*T.*Z\]/);
      expect(consoleWarnSpy.mock.calls[0]?.[1]).toMatch(/\[.*T.*Z\]/);
      expect(consoleLogSpy.mock.calls[0]?.[1]).toMatch(/\[.*T.*Z\]/);
      expect(consoleDebugSpy.mock.calls[0]?.[1]).toMatch(/\[.*T.*Z\]/);
    });
  });

  describe("custom prefix", () => {
    test("should use custom prefix", () => {
      configureLogging({ minLevel: "debug", prefix: "[CustomVAD]" });

      log.debug("test message");

      expect(consoleDebugSpy).toHaveBeenCalledWith("[CustomVAD]", "test message");
    });

    test("should use custom prefix for all log levels", () => {
      configureLogging({ minLevel: "debug", prefix: "[MyPrefix]" });

      log.error("error");
      log.warn("warn");
      log.info("info");
      log.debug("debug");

      expect(consoleErrorSpy).toHaveBeenCalledWith("[MyPrefix]", "error");
      expect(consoleWarnSpy).toHaveBeenCalledWith("[MyPrefix]", "warn");
      expect(consoleLogSpy).toHaveBeenCalledWith("[MyPrefix]", "info");
      expect(consoleDebugSpy).toHaveBeenCalledWith("[MyPrefix]", "debug");
    });
  });

  describe("configureLogging", () => {
    test("should merge with existing config", () => {
      configureLogging({ minLevel: "debug" });
      const config1 = getLoggingConfig();
      expect(config1.minLevel).toBe("debug");
      expect(config1.timestamps).toBe(false);

      configureLogging({ timestamps: true });
      const config2 = getLoggingConfig();
      expect(config2.minLevel).toBe("debug"); // Unchanged
      expect(config2.timestamps).toBe(true); // Updated
    });

    test("should allow resetting to defaults", () => {
      configureLogging({ minLevel: "debug", timestamps: true, prefix: "[Custom]" });

      configureLogging({ minLevel: "warn", timestamps: false, prefix: LOG_PREFIX });

      const config = getLoggingConfig();
      expect(config.minLevel).toBe("warn");
      expect(config.timestamps).toBe(false);
      expect(config.prefix).toBe(LOG_PREFIX);
    });
  });

  describe("getLoggingConfig", () => {
    test("should return current config", () => {
      configureLogging({ minLevel: "info", timestamps: true, prefix: "[Test]" });

      const config = getLoggingConfig();

      expect(config.minLevel).toBe("info");
      expect(config.timestamps).toBe(true);
      expect(config.prefix).toBe("[Test]");
    });

    test("should return a copy to prevent mutation", () => {
      configureLogging({ minLevel: "warn" });

      const config = getLoggingConfig();
      // Try to mutate
      (config as { minLevel: string }).minLevel = "debug";

      // Original should be unchanged
      const config2 = getLoggingConfig();
      expect(config2.minLevel).toBe("warn");
    });
  });

  describe("multiple arguments", () => {
    test("should handle multiple arguments", () => {
      configureLogging({ minLevel: "debug" });

      const obj = { key: "value" };
      const arr = [1, 2, 3];

      log.debug("message", obj, arr, 123, true);

      expect(consoleDebugSpy).toHaveBeenCalledWith(
        LOG_PREFIX,
        "message",
        obj,
        arr,
        123,
        true
      );
    });

    test("should handle objects and arrays", () => {
      configureLogging({ minLevel: "error" });

      const error = new Error("Test error");
      const data = { user: "test", count: 5 };

      log.error("Error occurred:", error, "Data:", data);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        LOG_PREFIX,
        "Error occurred:",
        error,
        "Data:",
        data
      );
    });
  });

  describe("edge cases", () => {
    test("should handle empty message", () => {
      configureLogging({ minLevel: "debug" });

      log.debug();

      expect(consoleDebugSpy).toHaveBeenCalledWith(LOG_PREFIX);
    });

    test("should handle undefined and null", () => {
      configureLogging({ minLevel: "debug" });

      log.debug("value:", undefined, null);

      expect(consoleDebugSpy).toHaveBeenCalledWith(LOG_PREFIX, "value:", undefined, null);
    });

    test("should work with empty prefix", () => {
      configureLogging({ minLevel: "debug", prefix: "" });

      log.debug("message");

      expect(consoleDebugSpy).toHaveBeenCalledWith("", "message");
    });
  });

  describe("runtime level changes", () => {
    test("should apply level changes immediately", () => {
      configureLogging({ minLevel: "error" });

      log.debug("should not log");
      expect(consoleDebugSpy).not.toHaveBeenCalled();

      configureLogging({ minLevel: "debug" });

      log.debug("should log now");
      expect(consoleDebugSpy).toHaveBeenCalledWith(LOG_PREFIX, "should log now");
    });

    test("should allow toggling timestamps at runtime", () => {
      configureLogging({ minLevel: "debug", timestamps: false });

      log.debug("no timestamp");
      expect(consoleDebugSpy.mock.calls[0]?.length).toBe(2); // prefix + message

      consoleDebugSpy.mockClear();

      configureLogging({ timestamps: true });

      log.debug("with timestamp");
      expect(consoleDebugSpy.mock.calls[0]?.length).toBe(3); // prefix + timestamp + message
    });
  });
});
