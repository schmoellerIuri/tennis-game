import { Difficulty, PlayerInput, PlayerSide, ShotType, Vec2, Vec3 } from '@/types';
import { COURT, GAME } from '@/utils/Constants';

interface AIConfig {
  reactionSpeed: number;
  accuracy: number;
  returnToCenter: number;
}

const DIFFICULTY_CONFIG: Record<Difficulty, AIConfig> = {
  [Difficulty.Easy]: { reactionSpeed: 0.4, accuracy: 0.3, returnToCenter: 0.2 },
  [Difficulty.Medium]: { reactionSpeed: 0.7, accuracy: 0.6, returnToCenter: 0.5 },
  [Difficulty.Hard]: { reactionSpeed: 0.95, accuracy: 0.85, returnToCenter: 0.8 },
};

export class AIController {
  private config: AIConfig;
  private targetPosition: Vec2 = { x: 0, y: -COURT.HALF_LENGTH + 2 };
  private shotCooldown = 0;

  constructor(difficulty: Difficulty) {
    this.config = DIFFICULTY_CONFIG[difficulty];
  }

  setDifficulty(difficulty: Difficulty): void {
    this.config = DIFFICULTY_CONFIG[difficulty];
  }

  getInput(
    aiPosition: Vec2,
    ballPosition: Vec3,
    ballVelocity: Vec3,
    ballInPlay: boolean,
    isBallApproaching: boolean,
  ): PlayerInput {
    if (this.shotCooldown > 0) this.shotCooldown -= 1 / GAME.TICK_RATE;

    if (ballInPlay && isBallApproaching) {
      this.targetPosition = this.predictLanding(ballPosition, ballVelocity);
    } else if (!ballInPlay || !isBallApproaching) {
      const centerBias = this.config.returnToCenter;
      this.targetPosition = {
        x: aiPosition.x * (1 - centerBias),
        y: -COURT.HALF_LENGTH + 2,
      };
    }

    const dx = this.targetPosition.x - aiPosition.x;
    const dy = this.targetPosition.y - aiPosition.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    let moveX = 0;
    let moveY = 0;

    if (dist > 0.3) {
      const speed = this.config.reactionSpeed;
      moveX = (dx / dist) * speed;
      moveY = (dy / dist) * speed;
    }

    let shotType: ShotType | null = null;
    let shotPower = 0.7;
    const aimAngle = this.calculateAimAngle(aiPosition);

    if (ballInPlay && this.canHitBall(aiPosition, ballPosition) && this.shotCooldown <= 0) {
      shotType = Math.random() > 0.8 ? ShotType.Lob : ShotType.Normal;
      shotPower = 0.4 + Math.random() * 0.4 * this.config.accuracy;
      this.shotCooldown = 0.5;
    }

    return { moveX, moveY, aimAngle, shotType, shotPower };
  }

  getServeTarget(isDeuceSide: boolean): { targetX: number; targetY: number; power: number } {
    const hw = COURT.SINGLES_WIDTH / 2;
    const sl = COURT.SERVICE_LINE_DIST;

    // Far player serves toward +y, targets Near service box [0, sl]
    // Cross-court: deuce side (Far right = -x) → target +x half; ad side (+x) → target -x half
    let targetX: number;
    if (isDeuceSide) {
      targetX = (0.2 + Math.random() * 0.5) * hw * this.config.accuracy;
    } else {
      targetX = -(0.2 + Math.random() * 0.5) * hw * this.config.accuracy;
    }

    const targetY = sl * (0.3 + Math.random() * 0.5);
    const power = 0.5 + Math.random() * 0.3;

    return { targetX, targetY, power };
  }

  private predictLanding(pos: Vec3, vel: Vec3): Vec2 {
    let px = pos.x;
    let py = pos.y;
    let pz = pos.z;
    const vx = vel.x;
    let vy = vel.y;
    let vz = vel.z;
    const dt = 1 / 30;

    for (let i = 0; i < 120; i++) {
      px += vx * dt;
      py += vy * dt;
      pz += vz * dt;
      vz -= GAME.GRAVITY * dt;

      if (pz <= 0) {
        return { x: px, y: py };
      }
    }

    return { x: px, y: py };
  }

  private canHitBall(aiPos: Vec2, ballPos: Vec3): boolean {
    const dx = aiPos.x - ballPos.x;
    const dy = aiPos.y - ballPos.y;
    return Math.sqrt(dx * dx + dy * dy) < GAME.PLAYER_HIT_RADIUS && ballPos.z <= 2.5;
  }

  private calculateAimAngle(aiPos: Vec2): number {
    const targetX = (Math.random() - 0.5) * COURT.SINGLES_WIDTH * this.config.accuracy;
    const targetY = COURT.HALF_LENGTH - 1;

    return Math.atan2(targetY - aiPos.y, targetX - aiPos.x);
  }
}
