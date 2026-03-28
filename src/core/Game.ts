import { SceneManager } from './SceneManager';
import { PhysicsWorld } from './PhysicsWorld';
import { Court } from '@/entities/Court';
import { Net } from '@/entities/Net';
import { Player } from '@/entities/Player';
import { InputManager } from '@/input/InputManager';
import { PhysicsSystem } from '@/systems/PhysicsSystem';
import { CameraSystem } from '@/systems/CameraSystem';
import { PHYSICS } from '@/utils/Constants';

export class Game {
  private sceneManager: SceneManager;
  private physicsWorld: PhysicsWorld;
  private player: Player;
  private inputManager: InputManager;
  private physicsSystem: PhysicsSystem;
  private cameraSystem: CameraSystem;

  private accumulator = 0;
  private lastTime = 0;
  private running = false;

  private constructor(
    sceneManager: SceneManager,
    physicsWorld: PhysicsWorld,
    player: Player,
    inputManager: InputManager,
    physicsSystem: PhysicsSystem,
    cameraSystem: CameraSystem,
  ) {
    this.sceneManager = sceneManager;
    this.physicsWorld = physicsWorld;
    this.player = player;
    this.inputManager = inputManager;
    this.physicsSystem = physicsSystem;
    this.cameraSystem = cameraSystem;
  }

  static async create(container: HTMLElement): Promise<Game> {
    const sceneManager = new SceneManager(container);
    const physicsWorld = await PhysicsWorld.create();

    // Create entities
    const court = new Court();
    sceneManager.scene.add(court.group);

    const net = new Net(physicsWorld);
    sceneManager.scene.add(net.group);

    const player = await Player.create(physicsWorld, 'near');
    sceneManager.scene.add(player.group);

    // Input
    const inputManager = new InputManager();

    // Systems
    const physicsSystem = new PhysicsSystem(physicsWorld);
    const cameraSystem = new CameraSystem(sceneManager.camera);

    return new Game(
      sceneManager,
      physicsWorld,
      player,
      inputManager,
      physicsSystem,
      cameraSystem,
    );
  }

  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  private loop(time: number): void {
    if (!this.running) return;

    const dt = (time - this.lastTime) / 1000;
    this.lastTime = time;

    // Cap accumulated time to avoid spiral of death
    this.accumulator += Math.min(dt, 0.1);

    const fixedDt = PHYSICS.fixedTimestep;

    // Fixed-timestep updates
    while (this.accumulator >= fixedDt) {
      const input = this.inputManager.getInput();
      this.player.update(fixedDt, input);
      this.physicsWorld.step();
      this.physicsSystem.sync();
      this.accumulator -= fixedDt;
    }

    // Variable-rate updates
    this.player.updateAnimation(dt);
    this.cameraSystem.update(dt, this.player.group.position);

    // Render
    this.sceneManager.render();

    requestAnimationFrame((t) => this.loop(t));
  }
}
