import * as THREE from 'three';
import { PhysicsWorld } from '@/core/PhysicsWorld';
import { DOUBLES_WIDTH, NET_HEIGHT, NET_POST_HEIGHT, COLORS } from '@/utils/Constants';

export class Net {
  readonly group: THREE.Group;

  constructor(physics: PhysicsWorld) {
    this.group = new THREE.Group();

    const halfWidth = DOUBLES_WIDTH / 2;

    // Net mesh (semi-transparent plane)
    const netGeo = new THREE.PlaneGeometry(DOUBLES_WIDTH, NET_HEIGHT);
    const netMat = new THREE.MeshStandardMaterial({
      color: COLORS.net,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });
    const netMesh = new THREE.Mesh(netGeo, netMat);
    netMesh.position.set(0, NET_HEIGHT / 2, 0);
    netMesh.castShadow = true;
    this.group.add(netMesh);

    // Net cord (top edge)
    const cordGeo = new THREE.CylinderGeometry(0.015, 0.015, DOUBLES_WIDTH, 8);
    const cordMat = new THREE.MeshStandardMaterial({ color: COLORS.net });
    const cord = new THREE.Mesh(cordGeo, cordMat);
    cord.rotation.z = Math.PI / 2;
    cord.position.set(0, NET_HEIGHT, 0);
    this.group.add(cord);

    // Posts
    const postGeo = new THREE.CylinderGeometry(0.04, 0.04, NET_POST_HEIGHT, 8);
    const postMat = new THREE.MeshStandardMaterial({ color: COLORS.netPost });

    const leftPost = new THREE.Mesh(postGeo, postMat);
    leftPost.position.set(-halfWidth, NET_POST_HEIGHT / 2, 0);
    leftPost.castShadow = true;
    this.group.add(leftPost);

    const rightPost = new THREE.Mesh(postGeo, postMat);
    rightPost.position.set(halfWidth, NET_POST_HEIGHT / 2, 0);
    rightPost.castShadow = true;
    this.group.add(rightPost);

    // Physics collider (thin cuboid)
    const R = physics.RAPIER;
    const colliderDesc = R.ColliderDesc.cuboid(halfWidth, NET_HEIGHT / 2, 0.05)
      .setTranslation(0, NET_HEIGHT / 2, 0);
    physics.world.createCollider(colliderDesc);
  }
}
