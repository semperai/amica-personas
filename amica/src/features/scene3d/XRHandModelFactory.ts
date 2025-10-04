import {
  Object3D
} from 'three';

import {
  XRHandPrimitiveModel
} from './XRHandPrimitiveModel';

import {
  XRHandMeshModel
} from './XRHandMeshModel';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader';

interface XRInputSource {
  hand?: any;
  handedness: string;
}

interface XRController extends Object3D {
  addEventListener(type: string, listener: (event: any) => void): void;
  visible: boolean;
}

class XRHandModel extends Object3D {
  controller: XRController;
  motionController: XRHandPrimitiveModel | XRHandMeshModel | null;
  envMap: any;
  mesh: any;
  xrInputSource?: XRInputSource;

  constructor(controller: XRController) {
    super();

    this.controller = controller;
    this.motionController = null;
    this.envMap = null;
    this.mesh = null;
  }

  updateMatrixWorld(force?: boolean): void {
    super.updateMatrixWorld(force);

    if (this.motionController) {
      this.motionController.updateMesh();
    }
  }
}

export class XRHandModelFactory {
  gltfLoader: GLTFLoader | null;
  path: string | null;
  onLoad: ((object: Object3D) => void) | null;

  constructor(gltfLoader: GLTFLoader | null = null, onLoad: ((object: Object3D) => void) | null = null) {
    this.gltfLoader = gltfLoader;
    this.path = null;
    this.onLoad = onLoad;
  }

  setPath(path: string): this {
    this.path = path;
    return this;
  }

  createHandModel(controller: XRController, profile?: string): XRHandModel {
    const handModel = new XRHandModel(controller);

    controller.addEventListener('connected', (event: any) => {
      const xrInputSource: XRInputSource = event.data;

      if (xrInputSource.hand && !handModel.motionController) {
        handModel.xrInputSource = xrInputSource;

        // @todo Detect profile if not provided
        if (profile === undefined || profile === 'spheres') {
          handModel.motionController = new XRHandPrimitiveModel(handModel, controller as any, this.path, xrInputSource.handedness, { primitive: 'sphere' });
        } else if (profile === 'boxes') {
          handModel.motionController = new XRHandPrimitiveModel(handModel, controller as any, this.path, xrInputSource.handedness, { primitive: 'box' });
        } else if (profile === 'mesh') {
          handModel.motionController = new XRHandMeshModel(handModel, controller as any, this.path, xrInputSource.handedness, this.gltfLoader, this.onLoad);
        }
      }

      controller.visible = true;
    });

    controller.addEventListener('disconnected', () => {
      controller.visible = false;
      // handModel.motionController = null;
      // handModel.remove(scene);
      // scene = null;
    });

    return handModel;
  }
}
