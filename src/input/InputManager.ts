import { PlayerInput } from '@/types/index';

export class InputManager {
  private keys: Set<string> = new Set();
  private justPressed: Set<string> = new Set();

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) {
        this.justPressed.add(e.code);
      }
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    // Prevent stuck keys when window loses focus
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.justPressed.clear();
    });
  }

  getInput(): PlayerInput {
    let moveX = 0;
    let moveZ = 0;

    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft'))  moveX -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) moveX += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp'))    moveZ -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown'))  moveZ += 1;

    // Normalize diagonal movement
    if (moveX !== 0 && moveZ !== 0) {
      const invSqrt2 = 1 / Math.SQRT2;
      moveX *= invSqrt2;
      moveZ *= invSqrt2;
    }

    const swingPressed = this.justPressed.has('Space');

    return { moveX, moveZ, swingPressed };
  }

  consumeJustPressed(): void {
    this.justPressed.clear();
  }
}
