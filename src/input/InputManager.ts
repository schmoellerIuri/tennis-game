import { PlayerInput, Vec2 } from '@/types';
import { INPUT } from '@/utils/Constants';

export class InputManager {
  private keys: Record<string, boolean> = {};
  private spaceHeld = false;
  private spaceHeldTime = 0;
  private spaceJustReleased = false;
  private lastMoveDirection: Vec2 = { x: 0, y: -1 }; // Default: forward (toward opponent)

  private enabled = true;

  constructor() {
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!this.enabled) return;
    this.keys[e.code] = true;

    if (e.code === 'Space') {
      e.preventDefault();
      if (!this.spaceHeld) {
        this.spaceHeld = true;
        this.spaceHeldTime = 0;
      }
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keys[e.code] = false;

    if (e.code === 'Space') {
      e.preventDefault();
      if (this.spaceHeld) {
        this.spaceJustReleased = true;
        this.spaceHeld = false;
      }
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.keys = {};
      this.spaceHeld = false;
      this.spaceHeldTime = 0;
      this.spaceJustReleased = false;
    }
  }

  update(dt: number): PlayerInput {
    let moveX = 0;
    let moveY = 0;

    if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveX = -1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) moveX = 1;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) moveY = -1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) moveY = 1;

    // Normalize diagonal
    if (moveX !== 0 && moveY !== 0) {
      const len = Math.sqrt(moveX * moveX + moveY * moveY);
      moveX /= len;
      moveY /= len;
    }

    // Update last move direction when WASD is pressed
    if (moveX !== 0 || moveY !== 0) {
      const len = Math.sqrt(moveX * moveX + moveY * moveY);
      this.lastMoveDirection = { x: moveX / len, y: moveY / len };
    }

    // Charge timing
    if (this.spaceHeld) {
      this.spaceHeldTime += dt;
    }

    const shotRequested = this.spaceJustReleased;
    const rawPower = Math.min(1, this.spaceHeldTime / INPUT.CHARGE_RATE);
    const shotPower = shotRequested ? Math.max(INPUT.MIN_SHOT_POWER, rawPower) : 0;

    const result: PlayerInput = {
      moveX,
      moveY,
      shotRequested,
      shotPower,
      aimDirection: { ...this.lastMoveDirection },
      isCharging: this.spaceHeld,
    };

    // Reset one-frame flag
    if (this.spaceJustReleased) {
      this.spaceJustReleased = false;
      this.spaceHeldTime = 0;
    }

    return result;
  }

  /** Get whether space was just pressed this frame (for serve toss) */
  isSpaceJustPressed(): boolean {
    return this.spaceHeld && this.spaceHeldTime === 0;
  }

  /** Check if space is currently held */
  isSpaceHeld(): boolean {
    return this.spaceHeld;
  }

  /** Get current charge power without consuming it */
  getCurrentChargePower(): number {
    return Math.min(1, Math.max(INPUT.MIN_SHOT_POWER, this.spaceHeldTime / INPUT.CHARGE_RATE));
  }

  getLastMoveDirection(): Vec2 {
    return { ...this.lastMoveDirection };
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown.bind(this));
    window.removeEventListener('keyup', this.onKeyUp.bind(this));
  }
}
