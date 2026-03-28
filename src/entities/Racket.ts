import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class Racket {
  readonly group: THREE.Group;

  private constructor(group: THREE.Group) {
    this.group = group;
  }

  static async create(): Promise<Racket> {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync('/src/assets/tennis_racket.glb');
    const model = gltf.scene;

    // Compute bounding box to normalize scale
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    // Target: full racket length ~0.68m (regulation 27 inches)
    const targetLength = 0.68;
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = targetLength / maxDim;
    model.scale.multiplyScalar(scale);

    // Recompute box after scaling, then offset the model so the
    // handle bottom sits at the group origin (the hand attachment point).
    box.setFromObject(model);
    model.position.set(
      -(box.min.x + box.max.x) / 2,   // center X
      -box.min.y,                       // handle bottom at y=0
      -(box.min.z + box.max.z) / 2,    // center Z
    );

    // Enable shadows on all meshes
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
      }
    });

    // Wrap in a group for positioning/rotation adjustments when attached to hand
    const group = new THREE.Group();
    group.add(model);

    return new Racket(group);
  }
}
