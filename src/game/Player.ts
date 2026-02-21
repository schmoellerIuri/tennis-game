import { Container, Graphics } from 'pixi.js';
import { AnimationState, PlayerInput, PlayerSide, Vec2 } from '@/types';
import { COURT, GAME, RENDER } from '@/utils/Constants';
import { worldToScreen } from '@/utils/IsometricUtils';

export class Player {
  readonly container = new Container();
  readonly side: PlayerSide;

  position: Vec2;
  animation: AnimationState = AnimationState.Idle;
  canHit = true;

  private swingTimer = 0;
  private bounceTimer = 0;
  private idleTimer = 0;

  constructor(side: PlayerSide) {
    this.side = side;
    const startY = side === PlayerSide.Near ? COURT.HALF_LENGTH - 2 : -COURT.HALF_LENGTH + 2;
    this.position = { x: 0, y: startY };
  }

  update(dt: number, input: PlayerInput): void {
    // Always tick idle timer for breathing animation
    this.idleTimer += dt;

    if (this.swingTimer > 0) {
      this.swingTimer -= dt;
      if (this.swingTimer <= 0) {
        this.animation = AnimationState.Idle;
        this.canHit = true;
      }
      return;
    }

    const moveX = input.moveX * GAME.PLAYER_SPEED * dt;
    const moveY = input.moveY * GAME.PLAYER_SPEED * dt;

    this.position.x += moveX;
    this.position.y += moveY;

    this.clampPosition();

    if (Math.abs(input.moveX) > 0.1 || Math.abs(input.moveY) > 0.1) {
      this.animation = AnimationState.Running;
      this.bounceTimer += dt * 8;
    } else {
      this.animation = AnimationState.Idle;
      this.bounceTimer = 0;
    }
  }

  /** Tick only the animation timer (used during phases where movement is locked) */
  tickAnimation(dt: number): void {
    this.idleTimer += dt;
    if (this.swingTimer > 0) {
      this.swingTimer -= dt;
      if (this.swingTimer <= 0) {
        this.animation = AnimationState.Idle;
        this.canHit = true;
      }
    }
  }

  swing(): void {
    this.animation = AnimationState.Swinging;
    this.canHit = false;
    this.swingTimer = 0.3;
  }

  serve(): void {
    this.animation = AnimationState.Serving;
    this.canHit = false;
    this.swingTimer = 0.5;
  }

  resetPosition(): void {
    const startY = this.side === PlayerSide.Near ? COURT.HALF_LENGTH - 2 : -COURT.HALF_LENGTH + 2;
    this.position = { x: 0, y: startY };
    this.animation = AnimationState.Idle;
    this.canHit = true;
    this.swingTimer = 0;
    this.bounceTimer = 0;
  }

  render(): void {
    this.container.removeChildren();

    const screen = worldToScreen(this.position.x, this.position.y);
    const g = new Graphics();
    const color = this.side === PlayerSide.Near ? RENDER.COLORS.PLAYER_NEAR : RENDER.COLORS.PLAYER_FAR;

    const w = RENDER.PLAYER_WIDTH;
    const h = RENDER.PLAYER_HEIGHT;

    // Idle breathing + running bounce
    let bounceOffset = 0;
    if (this.animation === AnimationState.Running) {
      bounceOffset = Math.abs(Math.sin(this.bounceTimer)) * 3;
    } else if (this.animation === AnimationState.Idle) {
      bounceOffset = Math.sin(this.idleTimer * 2) * 1; // subtle breathing
    }

    // Shadow
    g.ellipse(screen.x, screen.y + 2, w * 0.4, w * 0.2);
    g.fill({ color: 0x000000, alpha: 0.3 });

    // Body
    g.ellipse(screen.x, screen.y - h * 0.3 - bounceOffset, w * 0.3, h * 0.35);
    g.fill(color);

    // Head
    g.circle(screen.x, screen.y - h * 0.7 - bounceOffset, w * 0.2);
    g.fill(0xFFDBB4);

    // Racket - always visible with different positions per state
    let racketExtendX: number;
    let racketY: number;

    switch (this.animation) {
      case AnimationState.Serving:
        racketExtendX = 0;
        racketY = screen.y - h * 0.95 - bounceOffset;
        break;
      case AnimationState.Swinging:
        racketExtendX = 10;
        racketY = screen.y - h * 0.4 - bounceOffset;
        break;
      case AnimationState.Running:
        racketExtendX = 7;
        racketY = screen.y - h * 0.35 - bounceOffset;
        break;
      default: // Idle
        racketExtendX = 6;
        racketY = screen.y - h * 0.3 - bounceOffset;
        break;
    }

    // Arm
    g.moveTo(screen.x, screen.y - h * 0.4 - bounceOffset);
    g.lineTo(screen.x + racketExtendX, racketY);
    g.stroke({ width: 2, color: 0xFFDBB4 });

    // Racket head
    g.circle(screen.x + racketExtendX, racketY, 5);
    g.stroke({ width: 2, color: 0x8B4513 });

    this.container.addChild(g);
  }

  private clampPosition(): void {
    const hw = COURT.SINGLES_WIDTH / 2 + 1;
    this.position.x = Math.max(-hw, Math.min(hw, this.position.x));

    if (this.side === PlayerSide.Near) {
      this.position.y = Math.max(0.5, Math.min(COURT.HALF_LENGTH + 2, this.position.y));
    } else {
      this.position.y = Math.max(-COURT.HALF_LENGTH - 2, Math.min(-0.5, this.position.y));
    }
  }
}
