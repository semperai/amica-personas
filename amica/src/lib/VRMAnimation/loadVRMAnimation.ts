import { GLTFLoader } from 'three/addons/loaders/GLTFLoader';
import { VRMAnimation } from './VRMAnimation';
import { VRMAnimationLoaderPlugin } from './VRMAnimationLoaderPlugin';

const loader = new GLTFLoader();
loader.register((parser) => new VRMAnimationLoaderPlugin(parser));

export async function loadVRMAnimation(
  url: string,
  onProgress?: (progress: string) => void
): Promise<VRMAnimation | null> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        const vrmAnimations: VRMAnimation[] = gltf.userData.vrmAnimations;
        const vrmAnimation: VRMAnimation | undefined = vrmAnimations[0];
        resolve(vrmAnimation ?? null);
      },
      (xhr) => {
        if (onProgress) {
          const percentage = (xhr.loaded / xhr.total) * 100;
          onProgress(`${percentage.toFixed(2)}% loaded`);
        }
      },
      (error) => {
        reject(error);
      }
    );
  });
}
