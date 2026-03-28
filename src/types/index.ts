export interface PlayerInput {
  moveX: number;   // -1 (left) to 1 (right)
  moveZ: number;   // -1 (forward/toward net) to 1 (backward/toward baseline)
  swingPressed: boolean;
}

export type PlayerSide = 'near' | 'far';

export type AnimationState = 'idle' | 'running' | 'swinging';

export type BallState = 'idle' | 'in_play' | 'resetting';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
