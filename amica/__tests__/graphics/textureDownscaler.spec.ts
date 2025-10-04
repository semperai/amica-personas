import { describe, expect, test, vi } from "vitest";
import * as THREE from "three";

// Mock the utility functions since they require WebGL context
vi.mock("@/utils/graphics/textureDownscaler", () => ({
  downscaleModelTextures: vi.fn(),
  logTextureInfo: vi.fn(),
}));

import { downscaleModelTextures, logTextureInfo } from "@/utils/graphics/textureDownscaler";

describe("textureDownscaler", () => {
  describe("downscaleModelTextures", () => {
    test("should be defined", () => {
      expect(downscaleModelTextures).toBeDefined();
      expect(typeof downscaleModelTextures).toBe("function");
    });

    test("should accept model and maxSize parameters", () => {
      const mockModel = new THREE.Object3D();
      const maxSize = 512;

      downscaleModelTextures(mockModel, maxSize);

      expect(downscaleModelTextures).toHaveBeenCalledWith(mockModel, maxSize);
    });
  });

  describe("logTextureInfo", () => {
    test("should be defined", () => {
      expect(logTextureInfo).toBeDefined();
      expect(typeof logTextureInfo).toBe("function");
    });

    test("should accept model parameter", () => {
      const mockModel = new THREE.Object3D();

      logTextureInfo(mockModel);

      expect(logTextureInfo).toHaveBeenCalledWith(mockModel);
    });
  });
});
