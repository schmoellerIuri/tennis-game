import { PlayerInput, ShotType } from '@/types';

export class InputManager {
  private keys = new Set<string>();
  private mouseX = 0;
  private mouseY = 0;
  private mouseDown = false;
  private rightMouseDown = false;
  private mousePressed = false;
  private rightMousePressed = false;
  private canvas: HTMLCanvasElement | null = null;

  bind(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    canvas.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.mousePressed = true;
      }
      if (e.button === 2) {
        this.rightMouseDown = true;
        this.rightMousePressed = true;
      }
    });

    canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
      if (e.button === 2) this.rightMouseDown = false;
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  getInput(playerScreenX: number, playerScreenY: number): PlayerInput {
    let moveX = 0;
    let moveY = 0;

    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) moveY = -1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) moveY = 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) moveX = -1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) moveX = 1;

    // Normalize diagonal
    if (moveX !== 0 && moveY !== 0) {
      const len = Math.sqrt(moveX * moveX + moveY * moveY);
      moveX /= len;
      moveY /= len;
    }

    const dx = this.mouseX - playerScreenX;
    const dy = this.mouseY - playerScreenY;
    const aimAngle = Math.atan2(dy, dx);

    let shotType: ShotType | null = null;
    if (this.mousePressed) shotType = ShotType.Normal;
    if (this.rightMousePressed) shotType = ShotType.Lob;

    const distToMouse = Math.sqrt(dx * dx + dy * dy);
    const shotPower = Math.min(1, distToMouse / 300);

    this.mousePressed = false;
    this.rightMousePressed = false;

    return { moveX, moveY, aimAngle, shotType, shotPower };
  }

  isKeyDown(code: string): boolean {
    return this.keys.has(code);
  }

  getMousePosition(): { x: number; y: number } {
    return { x: this.mouseX, y: this.mouseY };
  }
}
