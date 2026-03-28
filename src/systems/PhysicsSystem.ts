import { PhysicsWorld } from '@/core/PhysicsWorld';

export class PhysicsSystem {
  private physics: PhysicsWorld;

  constructor(physics: PhysicsWorld) {
    this.physics = physics;
  }

  sync(): void {
    // Iterate all dynamic bodies and sync Three.js meshes
    // Currently no dynamic bodies (player is kinematic).
    // This will be used by the ball in a future step.
    this.physics.world.forEachRigidBody((_body) => {
      // Future: sync body.translation() → mesh.position
    });
  }
}
