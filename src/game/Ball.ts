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

  private trail: Vec3[] = [];
  private prevY = 0;
  private lastBouncePos: Vec3 = { x: 0, y: 0, z: 0 };

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
    this.trail = [];
    this.prevY = y;
    this.lastBouncePos = { x: 0, y: 0, z: 0 };
  }

  hit(targetX: number, targetY: number, speed: number, _lobHeight: number, hitter: PlayerSide): void {
    const dx = targetX - this.state.position.x;
    const dy = targetY - this.state.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.01) return;

    const flightTime = dist / speed;
    const vx = dx / flightTime;
    const vy = dy / flightTime;

    // Compute vz so ball lands at z=0 at the target position
    let vz = (0.5 * GAME.GRAVITY * flightTime * flightTime - this.state.position.z) / flightTime;

    // Ensure ball clears the net (at y=0) with some margin
    if (vy !== 0) {
      const timeToNet = -this.state.position.y / vy;
      if (timeToNet > 0 && timeToNet < flightTime) {
        const zAtNet = this.state.position.z + vz * timeToNet - 0.5 * GAME.GRAVITY * timeToNet * timeToNet;
        const minClearance = COURT.NET_HEIGHT + 0.3;
        if (zAtNet < minClearance) {
          vz = (minClearance - this.state.position.z + 0.5 * GAME.GRAVITY * timeToNet * timeToNet) / timeToNet;
        }
      }
    }

    this.state.velocity = { x: vx, y: vy, z: vz };
    this.state.inPlay = true;
    this.state.lastHitBy = hitter;
    this.state.hasBounced = false;
    this.state.bounceCount = 0;
    this.trail = [];
  }

  update(dt: number): void {
    if (!this.state.inPlay) return;

    const pos = this.state.position;
    const vel = this.state.velocity;

    this.prevY = pos.y;

    // Store trail position
    this.trail.push({ x: pos.x, y: pos.y, z: pos.z });
    if (this.trail.length > 8) this.trail.shift();

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
      this.lastBouncePos = { x: pos.x, y: pos.y, z: 0 };
    }
  }

  isOut(): boolean {
    if (!this.state.hasBounced) return false;
    const p = this.lastBouncePos;
    const hw = COURT.SINGLES_WIDTH / 2;
    const hl = COURT.HALF_LENGTH;
    return Math.abs(p.x) > hw + 0.3 || Math.abs(p.y) > hl + 0.3;
  }

  isNetHit(): boolean {
    const p = this.state.position;
    // Wider zone + swept check: detect if ball crossed y=0 between frames
    const crossedNet = (this.prevY > 0 && p.y < 0) || (this.prevY < 0 && p.y > 0);
    const inNetZone = Math.abs(p.y) < 0.5;
    return (inNetZone || crossedNet) && p.z < COURT.NET_HEIGHT && this.state.inPlay;
  }

  isDoubleBounce(): boolean {
    return this.state.bounceCount >= 2;
  }

  getLandingSide(): PlayerSide | null {
    if (!this.state.hasBounced) return null;
    return this.lastBouncePos.y > 0 ? PlayerSide.Near : PlayerSide.Far;
  }

  getLastBouncePos(): Vec3 {
    return this.lastBouncePos;
  }

  render(): void {
    this.container.removeChildren();
    if (!this.state.inPlay && this.state.velocity.x === 0 && this.state.velocity.y === 0) return;

    const g = new Graphics();

    // Trail
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      const trailScreen = worldToScreen3D(t);
      const alpha = (i / this.trail.length) * 0.3;
      const radius = RENDER.BALL_VISUAL_RADIUS * (0.3 + (i / this.trail.length) * 0.5);
      g.circle(trailScreen.x, trailScreen.y, radius);
      g.fill({ color: RENDER.COLORS.BALL, alpha });
    }

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
