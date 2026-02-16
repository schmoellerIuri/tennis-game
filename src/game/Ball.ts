import { Container, Graphics } from 'pixi.js';
import { BallState, PlayerSide, Vec3 } from '@/types';
import { COURT, GAME, RENDER } from '@/utils/Constants';
import { getShadowPosition, worldToScreen3D } from '@/utils/IsometricUtils';

export class Ball {
  readonly container = new Container();

  state: BallState = {
    position: { x: 0, y: 0, z: 1 },
    velocity: { x: 0, y: 0, z: 0 },
    inPlay: false,
    lastHitBy: null,
    hasBounced: false,
    bounceCount: 0,
  };

  reset(side: PlayerSide): void {
    const y = side === PlayerSide.Near ? COURT.HALF_LENGTH - 2 : -COURT.HALF_LENGTH + 2;
    this.state = {
      position: { x: 0, y, z: 1.5 },
      velocity: { x: 0, y: 0, z: 0 },
      inPlay: false,
      lastHitBy: null,
      hasBounced: false,
      bounceCount: 0,
    };
  }

  hit(targetX: number, targetY: number, speed: number, lobHeight: number, hitter: PlayerSide): void {
    const dx = targetX - this.state.position.x;
    const dy = targetY - this.state.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.01) return;

    const flightTime = dist / speed;
    const vx = dx / flightTime;
    const vy = dy / flightTime;
    const vz = (lobHeight - this.state.position.z + 0.5 * GAME.GRAVITY * flightTime * flightTime) / flightTime;

    this.state.velocity = { x: vx, y: vy, z: vz };
    this.state.inPlay = true;
    this.state.lastHitBy = hitter;
    this.state.hasBounced = false;
    this.state.bounceCount = 0;
  }

  update(dt: number): void {
    if (!this.state.inPlay) return;

    const pos = this.state.position;
    const vel = this.state.velocity;

    pos.x += vel.x * dt;
    pos.y += vel.y * dt;
    pos.z += vel.z * dt;

    vel.z -= GAME.GRAVITY * dt;

    if (pos.z <= GAME.BALL_RADIUS) {
      pos.z = GAME.BALL_RADIUS;
      vel.z = -vel.z * GAME.BALL_BOUNCE_DAMPING;
      vel.x *= 0.9;
      vel.y *= 0.9;
      this.state.hasBounced = true;
      this.state.bounceCount++;
    }
  }

  isOut(): boolean {
    const p = this.state.position;
    const hw = COURT.SINGLES_WIDTH / 2;
    const hl = COURT.HALF_LENGTH;
    return this.state.hasBounced && (
      Math.abs(p.x) > hw + 0.1 || Math.abs(p.y) > hl + 0.1
    );
  }

  isNetHit(): boolean {
    const p = this.state.position;
    return Math.abs(p.y) < 0.3 && p.z < COURT.NET_HEIGHT && this.state.inPlay;
  }

  isDoubleBounce(): boolean {
    return this.state.bounceCount >= 2;
  }

  getLandingSide(): PlayerSide | null {
    if (!this.state.hasBounced) return null;
    return this.state.position.y > 0 ? PlayerSide.Near : PlayerSide.Far;
  }

  render(): void {
    this.container.removeChildren();
    if (!this.state.inPlay && this.state.velocity.x === 0 && this.state.velocity.y === 0) return;

    const g = new Graphics();
    const screen = worldToScreen3D(this.state.position);
    const shadow = getShadowPosition(this.state.position);

    // Shadow
    const shadowScale = Math.max(0.3, 1 - this.state.position.z * 0.15);
    g.ellipse(shadow.x, shadow.y, RENDER.BALL_VISUAL_RADIUS * shadowScale, RENDER.BALL_VISUAL_RADIUS * shadowScale * 0.5);
    g.fill({ color: RENDER.COLORS.BALL_SHADOW, alpha: 0.3 * shadowScale });

    // Ball
    g.circle(screen.x, screen.y, RENDER.BALL_VISUAL_RADIUS);
    g.fill(RENDER.COLORS.BALL);

    this.container.addChild(g);
  }
}
