import { describe, expect, test, vi } from "vitest";
import { XRControllerModelFactory } from "@/features/scene3d/XRControllerModelFactory";
import { Object3D } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader";

describe("XRControllerModelFactory", () => {
  test("should create factory instance", () => {
    const factory = new XRControllerModelFactory();

    expect(factory).toBeDefined();
    expect(factory.gltfLoader).toBeDefined();
    expect(factory.gltfLoader).toBeInstanceOf(GLTFLoader);
    expect(factory.path).toBe('/controllers');
    expect(factory.onLoad).toBeNull();
  });

  test("should create factory with custom loader and callback", () => {
    const mockLoader = new GLTFLoader();
    const mockCallback = vi.fn();

    const factory = new XRControllerModelFactory(mockLoader, mockCallback);

    expect(factory.gltfLoader).toBe(mockLoader);
    expect(factory.onLoad).toBe(mockCallback);
  });

  test("should set path", () => {
    const factory = new XRControllerModelFactory();
    const path = "/custom/controllers";

    const result = factory.setPath(path);

    expect(factory.path).toBe(path);
    expect(result).toBe(factory); // Should return this for chaining
  });

  test("should create controller model with controller", () => {
    const factory = new XRControllerModelFactory();
    const mockController = {
      addEventListener: vi.fn(),
      visible: false
    } as any;

    const controllerModel = factory.createControllerModel(mockController);

    expect(controllerModel).toBeDefined();
    expect(controllerModel).toBeInstanceOf(Object3D);
    expect(mockController.addEventListener).toHaveBeenCalledTimes(2);
    expect(mockController.addEventListener).toHaveBeenCalledWith('connected', expect.any(Function));
    expect(mockController.addEventListener).toHaveBeenCalledWith('disconnected', expect.any(Function));
  });

  test("should initialize controller model with null motionController", () => {
    const factory = new XRControllerModelFactory();
    const mockController = {
      addEventListener: vi.fn(),
      visible: false
    } as any;

    const controllerModel = factory.createControllerModel(mockController);

    expect(controllerModel.motionController).toBeNull();
  });

  test("should initialize controller model with null envMap", () => {
    const factory = new XRControllerModelFactory();
    const mockController = {
      addEventListener: vi.fn(),
      visible: false
    } as any;

    const controllerModel = factory.createControllerModel(mockController);

    expect(controllerModel.envMap).toBeNull();
  });

  test("should initialize asset cache", () => {
    const factory = new XRControllerModelFactory();

    expect(factory._assetCache).toBeDefined();
    expect(typeof factory._assetCache).toBe('object');
  });
});
