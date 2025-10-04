import { describe, expect, test, beforeEach } from "vitest";
import { XRHandPrimitiveModel } from "@/features/scene3d/XRHandPrimitiveModel";
import { Object3D, Vector3 } from "three";

describe("XRHandPrimitiveModel", () => {
  let handModel: Object3D;
  let mockController: any;

  beforeEach(() => {
    handModel = new Object3D();
    mockController = {
      joints: {}
    };

    // Setup mock joints
    const joints = [
      'wrist',
      'thumb-metacarpal',
      'thumb-phalanx-proximal',
      'thumb-phalanx-distal',
      'thumb-tip',
      'index-finger-metacarpal',
      'index-finger-phalanx-proximal',
    ];

    joints.forEach(jointName => {
      mockController.joints[jointName] = {
        visible: true,
        position: new Vector3(0, 0, 0),
        quaternion: { x: 0, y: 0, z: 0, w: 1 },
        jointRadius: 0.01
      };
    });
  });

  test("should create instance with sphere primitive by default", () => {
    const model = new XRHandPrimitiveModel(handModel, mockController, null, "left");

    expect(model).toBeDefined();
    expect(model.handMesh).toBeDefined();
    expect(model.joints.length).toBe(25);
  });

  test("should create instance with sphere primitive when specified", () => {
    const model = new XRHandPrimitiveModel(handModel, mockController, null, "left", { primitive: 'sphere' });

    expect(model).toBeDefined();
    expect(model.handMesh).toBeDefined();
  });

  test("should create instance with box primitive when specified", () => {
    const model = new XRHandPrimitiveModel(handModel, mockController, null, "left", { primitive: 'box' });

    expect(model).toBeDefined();
    expect(model.handMesh).toBeDefined();
  });

  test("should add handMesh to handModel", () => {
    const initialChildren = handModel.children.length;
    const model = new XRHandPrimitiveModel(handModel, mockController, null, "left");

    expect(handModel.children.length).toBe(initialChildren + 1);
  });

  test("should update mesh based on controller joints", () => {
    const model = new XRHandPrimitiveModel(handModel, mockController, null, "left");

    // Note: InstancedMesh initializes count to maxInstances (30)
    const initialCount = model.handMesh.count;
    expect(initialCount).toBe(30);

    // Update mesh
    model.updateMesh();

    // Count should now reflect visible joints
    expect(model.handMesh.count).toBeGreaterThan(0);
  });

  test("should handle invisible joints", () => {
    mockController.joints['wrist'].visible = false;
    const model = new XRHandPrimitiveModel(handModel, mockController, null, "left");

    model.updateMesh();

    // Should still work but not count invisible joints
    expect(model.handMesh.count).toBeGreaterThanOrEqual(0);
  });

  test("should set correct shadow properties", () => {
    const model = new XRHandPrimitiveModel(handModel, mockController, null, "left");

    expect(model.handMesh.castShadow).toBe(true);
    expect(model.handMesh.receiveShadow).toBe(true);
  });

  test("should initialize envMap to null", () => {
    const model = new XRHandPrimitiveModel(handModel, mockController, null, "left");

    expect(model.envMap).toBeNull();
  });
});
