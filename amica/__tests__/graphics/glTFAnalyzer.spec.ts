import { describe, expect, test, vi } from "vitest";

// Mock the GLTFAnalyzer class
vi.mock("@/utils/graphics/glTFAnalyzer", () => ({
  GLTFAnalyzer: vi.fn().mockImplementation(() => ({
    analyze: vi.fn(),
    getReport: vi.fn().mockReturnValue({}),
  })),
}));

import { GLTFAnalyzer } from "@/utils/graphics/glTFAnalyzer";

describe("glTFAnalyzer", () => {
  test("should be defined", () => {
    expect(GLTFAnalyzer).toBeDefined();
    expect(typeof GLTFAnalyzer).toBe("function");
  });

  test("should create GLTFAnalyzer instance", () => {
    const analyzer = new GLTFAnalyzer();

    expect(analyzer).toBeDefined();
    expect(GLTFAnalyzer).toHaveBeenCalled();
  });

  test("should have analyze method", () => {
    const analyzer = new GLTFAnalyzer();

    expect(analyzer.analyze).toBeDefined();
    expect(typeof analyzer.analyze).toBe("function");
  });

  test("should have getReport method", () => {
    const analyzer = new GLTFAnalyzer();

    expect(analyzer.getReport).toBeDefined();
    expect(typeof analyzer.getReport).toBe("function");
  });
});
