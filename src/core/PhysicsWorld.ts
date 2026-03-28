import RAPIER from '@dimforge/rapier3d-compat';
import { PHYSICS } from '@/utils/Constants';

export class PhysicsWorld {
  readonly world: RAPIER.World;
  readonly RAPIER: typeof RAPIER;

  private constructor(world: RAPIER.World, rapier: typeof RAPIER) {
    this.world = world;
    this.RAPIER = rapier;
  }

  static async create(): Promise<PhysicsWorld> {
    await RAPIER.init();

    const gravity = new RAPIER.Vector3(
      PHYSICS.gravity.x,
      PHYSICS.gravity.y,
      PHYSICS.gravity.z,
    );
    const world = new RAPIER.World(gravity);

    // Ground collider (large flat cuboid at Y=0)
    const groundDesc = RAPIER.ColliderDesc.cuboid(50, 0.1, 50)
      .setTranslation(0, -0.1, 0);
    world.createCollider(groundDesc);

    return new PhysicsWorld(world, RAPIER);
  }

  step(): void {
    this.world.step();
  }
}
