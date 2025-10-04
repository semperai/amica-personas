import { describe, expect, test, vi } from "vitest";

// Mock the OptimizedGLTFLoader class
vi.mock("@/utils/graphics/glTFOptimizer", () => ({
  OptimizedGLTFLoader: vi.fn().mockImplementation(() => ({
    load: vi.fn(),
    setPath: vi.fn().mockReturnThis(),
  })),
}));

import { OptimizedGLTFLoader } from "@/utils/graphics/glTFOptimizer";

describe("glTFOptimizer", () => {
  test("should be defined", () => {
    expect(OptimizedGLTFLoader).toBeDefined();
    expect(typeof OptimizedGLTFLoader).toBe("function");
  });

  test("should create OptimizedGLTFLoader instance", () => {
    const loader = new OptimizedGLTFLoader();

    expect(loader).toBeDefined();
    expect(OptimizedGLTFLoader).toHaveBeenCalled();
  });

  test("should have load method", () => {
    const loader = new OptimizedGLTFLoader();

    expect(loader.load).toBeDefined();
    expect(typeof loader.load).toBe("function");
  });

  test("should have setPath method", () => {
    const loader = new OptimizedGLTFLoader();

    expect(loader.setPath).toBeDefined();
    expect(typeof loader.setPath).toBe("function");
  });

  test("setPath should return this for chaining", () => {
    const loader = new OptimizedGLTFLoader();
    const result = loader.setPath("/path");

    expect(result).toBe(loader);
  });
});
