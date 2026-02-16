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
  private frameIndex = 0;
  private frameTimer = 0;
  private readonly FRAME_DURATION = 100;

  constructor(side: PlayerSide) {
    this.side = side;
    const startY = side === PlayerSide.Near ? COURT.HALF_LENGTH - 2 : -COURT.HALF_LENGTH + 2;
    this.position = { x: 0, y: startY };
  }

  update(dt: number, input: PlayerInput): void {
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
      this.frameTimer += dt * 1000;
      if (this.frameTimer >= this.FRAME_DURATION) {
        this.frameTimer = 0;
        this.frameIndex = (this.frameIndex + 1) % 4;
      }
    } else {
      this.animation = AnimationState.Idle;
      this.frameIndex = 0;
      this.frameTimer = 0;
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
  }

  render(): void {
    this.container.removeChildren();

    const screen = worldToScreen(this.position.x, this.position.y);
    const g = new Graphics();
    const color = this.side === PlayerSide.Near ? RENDER.COLORS.PLAYER_NEAR : RENDER.COLORS.PLAYER_FAR;

    const w = RENDER.PLAYER_WIDTH;
    const h = RENDER.PLAYER_HEIGHT;
    const bounceOffset = this.animation === AnimationState.Running
      ? Math.sin(this.frameIndex * Math.PI / 2) * 2
      : 0;

    // Shadow
    g.ellipse(screen.x, screen.y + 2, w * 0.4, w * 0.2);
    g.fill({ color: 0x000000, alpha: 0.3 });

    // Body
    g.ellipse(screen.x, screen.y - h * 0.3 - bounceOffset, w * 0.3, h * 0.35);
    g.fill(color);

    // Head
    g.circle(screen.x, screen.y - h * 0.7 - bounceOffset, w * 0.2);
    g.fill(0xFFDBB4);

    // Racket arm
    if (this.animation === AnimationState.Swinging || this.animation === AnimationState.Serving) {
      const racketExtend = this.animation === AnimationState.Serving ? -12 : 10;
      const racketY = this.animation === AnimationState.Serving
        ? screen.y - h * 0.9 - bounceOffset
        : screen.y - h * 0.4 - bounceOffset;

      g.moveTo(screen.x, screen.y - h * 0.4 - bounceOffset);
      g.lineTo(screen.x + racketExtend, racketY);
      g.stroke({ width: 2, color: 0xFFDBB4 });

      g.circle(screen.x + racketExtend, racketY, 5);
      g.stroke({ width: 2, color: 0x8B4513 });
    }

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
