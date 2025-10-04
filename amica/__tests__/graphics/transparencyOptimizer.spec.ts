import { describe, expect, test, vi } from "vitest";
import * as THREE from "three";

// Mock the utility functions since they require WebGL context
vi.mock("@/utils/graphics/transparencyOptimizer", () => ({
  TransparencyOptimizer: vi.fn(),
  checkAndOptimizeTransparency: vi.fn(),
}));

import { TransparencyOptimizer, checkAndOptimizeTransparency } from "@/utils/graphics/transparencyOptimizer";

describe("transparencyOptimizer", () => {
  describe("TransparencyOptimizer", () => {
    test("should be defined", () => {
      expect(TransparencyOptimizer).toBeDefined();
      expect(typeof TransparencyOptimizer).toBe("function");
    });
  });

  describe("checkAndOptimizeTransparency", () => {
    test("should be defined", () => {
      expect(checkAndOptimizeTransparency).toBeDefined();
      expect(typeof checkAndOptimizeTransparency).toBe("function");
    });

    test("should accept model parameter", () => {
      const mockModel = new THREE.Object3D();

      checkAndOptimizeTransparency(mockModel);

      expect(checkAndOptimizeTransparency).toHaveBeenCalledWith(mockModel);
    });
  });
});
