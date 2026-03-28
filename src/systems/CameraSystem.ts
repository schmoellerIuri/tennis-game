import * as THREE from 'three';
import { CAMERA } from '@/utils/Constants';

export class CameraSystem {
  private camera: THREE.PerspectiveCamera;
  private currentX = 0;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    // Smooth lateral tracking of player
    const targetX = playerPos.x * CAMERA.lateralTrackingFactor;
    this.currentX += (targetX - this.currentX) * Math.min(1, CAMERA.lateralTrackingSpeed * dt);

    this.camera.position.set(
      this.currentX,
      CAMERA.height,
      playerPos.z + CAMERA.distanceBehind,
    );

    this.camera.lookAt(this.currentX, 0, playerPos.z + CAMERA.lookAheadZ);
  }
}
