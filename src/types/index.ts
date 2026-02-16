export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PlayerInput {
  moveX: number;
  moveY: number;
  aimAngle: number;
  shotType: ShotType | null;
  shotPower: number;
}

export enum ShotType {
  Normal = 'normal',
  Lob = 'lob',
}

export enum Difficulty {
  Easy = 'easy',
  Medium = 'medium',
  Hard = 'hard',
}

export enum GamePhase {
  Serving = 'serving',
  Rally = 'rally',
  PointOver = 'point_over',
  MatchOver = 'match_over',
}

export enum PlayerSide {
  Near = 'near',
  Far = 'far',
}

export enum AnimationState {
  Idle = 'idle',
  Running = 'running',
  Swinging = 'swinging',
  Serving = 'serving',
}

export interface MatchConfig {
  sets: number;
  difficulty: Difficulty;
}

export interface MatchStats {
  aces: number;
  winners: number;
  unforcedErrors: number;
  totalPoints: number;
}

export interface GameState {
  phase: GamePhase;
  ball: BallState;
  players: [PlayerState, PlayerState];
  score: ScoreState;
}

export interface BallState {
  position: Vec3;
  velocity: Vec3;
  inPlay: boolean;
  lastHitBy: PlayerSide | null;
  hasBounced: boolean;
  bounceCount: number;
}

export interface PlayerState {
  side: PlayerSide;
  position: Vec2;
  animation: AnimationState;
  canHit: boolean;
}

export interface ScoreState {
  points: [number, number];
  games: [number[], number[]];
  sets: [number, number];
  servingSide: PlayerSide;
  currentSet: number;
  isDeuce: boolean;
  advantage: PlayerSide | null;
  maxSets: number;
}
