import {
  Mesh,
  MeshBasicMaterial,
  Object3D,
  SphereGeometry,
  Texture,
} from 'three';

import { GLTFLoader } from "three/addons/loaders/GLTFLoader";
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader';

import {
  Constants as MotionControllerConstants,
  fetchProfile,
  MotionController
} from '@/lib/motion-controllers.module.js';

const DEFAULT_PROFILES_PATH = '/controllers';
const DEFAULT_PROFILE = 'generic-trigger';

interface XRInputSource {
  targetRayMode: string;
  gamepad?: any;
  hand?: any;
}

interface XRController extends Object3D {
  addEventListener(type: string, listener: (event: any) => void): void;
}

class XRControllerModel extends Object3D {
  motionController: any;
  envMap: Texture | null;

  constructor() {
    super();

    this.motionController = null;
    this.envMap = null;
  }

  setEnvironmentMap(envMap: Texture | null): this {
    if (this.envMap == envMap) {
      return this;
    }

    this.envMap = envMap;
    this.traverse((child) => {
      if ((child as any).isMesh) {
        const mesh = child as Mesh;
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(mat => {
            (mat as any).envMap = this.envMap;
            mat.needsUpdate = true;
          });
        } else {
          (mesh.material as any).envMap = this.envMap;
          mesh.material.needsUpdate = true;
        }
      }
    });

    return this;
  }

  /**
   * Polls data from the XRInputSource and updates the model's components to match
   * the real world data
   */
  updateMatrixWorld(force?: boolean): void {
    super.updateMatrixWorld(force);

    if (!this.motionController) return;

    // Cause the MotionController to poll the Gamepad for data
    this.motionController.updateFromGamepad();

    // Update the 3D model to reflect the button, thumbstick, and touchpad state
    Object.values(this.motionController.components).forEach((component: any) => {

      // Update node data based on the visual responses' current states
      Object.values(component.visualResponses).forEach((visualResponse: any) => {
        const { valueNode, minNode, maxNode, value, valueNodeProperty } = visualResponse;

        // Skip if the visual response node is not found. No error is needed,
        // because it will have been reported at load time.
        if (!valueNode) return;

        // Calculate the new properties based on the weight supplied
        if (valueNodeProperty === MotionControllerConstants.VisualResponseProperty.VISIBILITY) {

          valueNode.visible = value;

        } else if (valueNodeProperty === MotionControllerConstants.VisualResponseProperty.TRANSFORM) {

          valueNode.quaternion.slerpQuaternions(
            minNode.quaternion,
            maxNode.quaternion,
            value
          );

          valueNode.position.lerpVectors(
            minNode.position,
            maxNode.position,
            value
          );
        }
      });
    });
  }
}

/**
 * Walks the model's tree to find the nodes needed to animate the components and
 * saves them to the motionContoller components for use in the frame loop. When
 * touchpads are found, attaches a touch dot to them.
 */
function findNodes(motionController: any, scene: Object3D): void {
  // Loop through the components and find the nodes needed for each components' visual responses
  Object.values(motionController.components).forEach((component: any) => {
    const { type, touchPointNodeName, visualResponses } = component;

    if (type === MotionControllerConstants.ComponentType.TOUCHPAD) {
      component.touchPointNode = scene.getObjectByName(touchPointNodeName);
      if (component.touchPointNode) {

        // Attach a touch dot to the touchpad.
        const sphereGeometry = new SphereGeometry(0.001);
        const material = new MeshBasicMaterial({ color: 0x0000FF });
        const sphere = new Mesh(sphereGeometry, material);
        component.touchPointNode.add(sphere);
      } else {
        console.warn(`Could not find touch dot, ${component.touchPointNodeName}, in touchpad component ${component.id}`);
      }
    }

    // Loop through all the visual responses to be applied to this component
    Object.values(visualResponses).forEach((visualResponse: any) => {
      const { valueNodeName, minNodeName, maxNodeName, valueNodeProperty } = visualResponse;

      // If animating a transform, find the two nodes to be interpolated between.
      if (valueNodeProperty === MotionControllerConstants.VisualResponseProperty.TRANSFORM) {
        visualResponse.minNode = scene.getObjectByName(minNodeName);
        visualResponse.maxNode = scene.getObjectByName(maxNodeName);

        // If the extents cannot be found, skip this animation
        if (!visualResponse.minNode) {
          console.warn(`Could not find ${minNodeName} in the model`);
          return;
        }

        if (!visualResponse.maxNode) {
          console.warn(`Could not find ${maxNodeName} in the model`);
          return;
        }
      }

      // If the target node cannot be found, skip this animation
      visualResponse.valueNode = scene.getObjectByName(valueNodeName);
      if (!visualResponse.valueNode) {
        console.warn(`Could not find ${valueNodeName} in the model`);
      }
    });
  });
}

function addAssetSceneToControllerModel(controllerModel: XRControllerModel, scene: Object3D): void {
  // Find the nodes needed for animation and cache them on the motionController.
  findNodes(controllerModel.motionController, scene);

  // Apply any environment map that the mesh already has set.
  if (controllerModel.envMap) {
    scene.traverse((child) => {
      if ((child as any).isMesh) {
        const mesh = child as Mesh;
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(mat => {
            (mat as any).envMap = controllerModel.envMap;
            mat.needsUpdate = true;
          });
        } else {
          (mesh.material as any).envMap = controllerModel.envMap;
          mesh.material.needsUpdate = true;
        }
      }
    });
  }

  // Add the glTF scene to the controllerModel.
  controllerModel.add(scene);
}

export class XRControllerModelFactory {
  gltfLoader: GLTFLoader;
  path: string;
  _assetCache: Record<string, GLTF>;
  onLoad: ((scene: Object3D) => void) | null;

  constructor(gltfLoader: GLTFLoader | null = null, onLoad: ((scene: Object3D) => void) | null = null) {
    this.path = DEFAULT_PROFILES_PATH;
    this._assetCache = {};
    this.onLoad = onLoad;

    // If a GLTFLoader wasn't supplied to the constructor create a new one.
    if (!gltfLoader) {
      this.gltfLoader = new GLTFLoader();
    } else {
      this.gltfLoader = gltfLoader;
    }
  }

  setPath(path: string): this {
    this.path = path;
    return this;
  }

  createControllerModel(controller: XRController): XRControllerModel {
    const controllerModel = new XRControllerModel();
    let scene: Object3D | null = null;

    controller.addEventListener('connected', (event: any) => {
      const xrInputSource: XRInputSource = event.data;
      if (xrInputSource.targetRayMode !== 'tracked-pointer' || !xrInputSource.gamepad || xrInputSource.hand) return;

      fetchProfile(xrInputSource, this.path, DEFAULT_PROFILE).then(({ profile, assetPath }: any) => {
        controllerModel.motionController = new MotionController(
          xrInputSource,
          profile,
          assetPath
        );

        const cachedAsset = this._assetCache[controllerModel.motionController.assetUrl];
        if (cachedAsset) {
          scene = cachedAsset.scene.clone();
          addAssetSceneToControllerModel(controllerModel, scene);
          if (this.onLoad) this.onLoad(scene);
        } else {
          if (!this.gltfLoader) {
            throw new Error('GLTFLoader not set.');
          }

          this.gltfLoader.setPath('');
          this.gltfLoader.load(controllerModel.motionController.assetUrl, (asset: GLTF) => {
            this._assetCache[controllerModel.motionController.assetUrl] = asset;
            scene = asset.scene.clone();
            addAssetSceneToControllerModel(controllerModel, scene);

            if (this.onLoad) this.onLoad(scene);
          },
          undefined,
          () => {
            throw new Error(`Asset ${controllerModel.motionController.assetUrl} missing or malformed.`);
          });
        }
      }).catch((err: Error) => {
        console.warn(err);
      });
    });

    controller.addEventListener('disconnected', () => {
      controllerModel.motionController = null;
      if (scene) {
        controllerModel.remove(scene);
      }
      scene = null;
    });

    return controllerModel;
  }
}
