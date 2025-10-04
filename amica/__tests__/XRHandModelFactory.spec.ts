import { describe, expect, test, vi } from "vitest";
import { XRHandModelFactory } from "@/features/scene3d/XRHandModelFactory";
import { Object3D } from "three";

describe("XRHandModelFactory", () => {
  test("should create factory instance", () => {
    const factory = new XRHandModelFactory();

    expect(factory).toBeDefined();
    expect(factory.gltfLoader).toBeNull();
    expect(factory.path).toBeNull();
    expect(factory.onLoad).toBeNull();
  });

  test("should create factory with custom loader and callback", () => {
    const mockLoader = {} as any;
    const mockCallback = vi.fn();

    const factory = new XRHandModelFactory(mockLoader, mockCallback);

    expect(factory.gltfLoader).toBe(mockLoader);
    expect(factory.onLoad).toBe(mockCallback);
  });

  test("should set path", () => {
    const factory = new XRHandModelFactory();
    const path = "/custom/path";

    const result = factory.setPath(path);

    expect(factory.path).toBe(path);
    expect(result).toBe(factory); // Should return this for chaining
  });

  test("should create hand model with controller", () => {
    const factory = new XRHandModelFactory();
    const mockController = {
      addEventListener: vi.fn(),
      visible: false
    } as any;

    const handModel = factory.createHandModel(mockController);

    expect(handModel).toBeDefined();
    expect(handModel).toBeInstanceOf(Object3D);
    expect(mockController.addEventListener).toHaveBeenCalledTimes(2);
    expect(mockController.addEventListener).toHaveBeenCalledWith('connected', expect.any(Function));
    expect(mockController.addEventListener).toHaveBeenCalledWith('disconnected', expect.any(Function));
  });

  test("should create sphere profile by default", () => {
    const factory = new XRHandModelFactory();
    const mockController = {
      addEventListener: vi.fn(),
      visible: false
    } as any;

    const handModel = factory.createHandModel(mockController, 'spheres');

    expect(handModel).toBeDefined();
  });

  test("should create box profile when specified", () => {
    const factory = new XRHandModelFactory();
    const mockController = {
      addEventListener: vi.fn(),
      visible: false
    } as any;

    const handModel = factory.createHandModel(mockController, 'boxes');

    expect(handModel).toBeDefined();
  });

  test("should create mesh profile when specified", () => {
    const factory = new XRHandModelFactory();
    const mockController = {
      addEventListener: vi.fn(),
      visible: false
    } as any;

    const handModel = factory.createHandModel(mockController, 'mesh');

    expect(handModel).toBeDefined();
  });
});
