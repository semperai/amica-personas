import { GLTFLoader } from "three/addons/loaders/GLTFLoader";
import { Object3D } from 'three';

const DEFAULT_HAND_PROFILE_PATH = '/controllers/generic-hand/';

interface XRJoint {
  visible: boolean;
  position: any;
  quaternion: any;
  jointRadius?: number;
}

interface XRController {
  joints: Record<string, XRJoint>;
}

interface Bone extends Object3D {
  jointName?: string;
}

export class XRHandMeshModel {
  controller: XRController;
  handModel: Object3D;
  bones: (Bone | undefined)[];

  constructor(
    handModel: Object3D,
    controller: XRController,
    path: string | null,
    handedness: string,
    loader: GLTFLoader | null = null,
    onLoad: ((object: Object3D) => void) | null = null
  ) {
    this.controller = controller;
    this.handModel = handModel;
    this.bones = [];

    if (loader === null) {
      loader = new GLTFLoader();
      loader.setPath(path || DEFAULT_HAND_PROFILE_PATH);
    }

    loader.load(`${handedness}.glb`, gltf => {
      const object = gltf.scene.children[0];
      this.handModel.add(object);

      const mesh = object.getObjectByProperty('type', 'SkinnedMesh');
      if (mesh) {
        mesh.frustumCulled = false;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }

      const joints = [
        'wrist',
        'thumb-metacarpal',
        'thumb-phalanx-proximal',
        'thumb-phalanx-distal',
        'thumb-tip',
        'index-finger-metacarpal',
        'index-finger-phalanx-proximal',
        'index-finger-phalanx-intermediate',
        'index-finger-phalanx-distal',
        'index-finger-tip',
        'middle-finger-metacarpal',
        'middle-finger-phalanx-proximal',
        'middle-finger-phalanx-intermediate',
        'middle-finger-phalanx-distal',
        'middle-finger-tip',
        'ring-finger-metacarpal',
        'ring-finger-phalanx-proximal',
        'ring-finger-phalanx-intermediate',
        'ring-finger-phalanx-distal',
        'ring-finger-tip',
        'pinky-finger-metacarpal',
        'pinky-finger-phalanx-proximal',
        'pinky-finger-phalanx-intermediate',
        'pinky-finger-phalanx-distal',
        'pinky-finger-tip',
      ];

      joints.forEach(jointName => {
        const bone = object.getObjectByName(jointName) as Bone | undefined;

        if (bone !== undefined) {
          bone.jointName = jointName;
        } else {
          console.warn(`Couldn't find ${jointName} in ${handedness} hand mesh`);
        }

        this.bones.push(bone);
      });

      if (onLoad) onLoad(object);
    });
  }

  updateMesh(): void {
    // XR Joints
    const XRJoints = this.controller.joints;

    for (let i = 0; i < this.bones.length; i++) {
      const bone = this.bones[i];

      if (bone && bone.jointName) {
        const XRJoint = XRJoints[bone.jointName];

        if (XRJoint && XRJoint.visible) {
          const position = XRJoint.position;
          bone.position.copy(position);
          bone.quaternion.copy(XRJoint.quaternion);
          // bone.scale.setScalar(XRJoint.jointRadius || defaultRadius);
        }
      }
    }
  }
}
