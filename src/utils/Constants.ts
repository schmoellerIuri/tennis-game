// ── Court Dimensions (meters, regulation) ──────────────────────────
export const COURT_LENGTH = 23.77;
export const HALF_LENGTH = COURT_LENGTH / 2;          // 11.885
export const SINGLES_WIDTH = 8.23;
export const DOUBLES_WIDTH = 10.97;
export const SERVICE_LINE_DIST = 6.40;                // from net
export const CENTER_MARK_LENGTH = 0.10;
export const NET_HEIGHT = 0.914;                       // center
export const NET_POST_HEIGHT = 1.07;
export const LINE_WIDTH = 0.05;

// ── Surround / Play Area ───────────────────────────────────────────
export const SURROUND_MARGIN = 5.0;                    // extra ground around court

// ── Player Movement Boundaries ─────────────────────────────────────
export const BOUNDARY_MARGIN_X = 2.0;
export const BOUNDARY_MARGIN_Z_BACK = 3.0;
export const BOUNDARY_NET_Z = 0.5;                     // can't cross net

export const PLAYER_BOUNDS = {
  minX: -(SINGLES_WIDTH / 2 + BOUNDARY_MARGIN_X),     // -6.115
  maxX:  (SINGLES_WIDTH / 2 + BOUNDARY_MARGIN_X),     //  6.115
  minZ:  BOUNDARY_NET_Z,                               //  0.5
  maxZ:  HALF_LENGTH + BOUNDARY_MARGIN_Z_BACK,         // 14.885
};

// ── Player Body Proportions ────────────────────────────────────────
export const PLAYER = {
  height: 1.80,
  headRadius: 0.12,
  torsoLength: 0.50,
  torsoRadius: 0.15,
  upperArmLength: 0.28,
  lowerArmLength: 0.25,
  upperLegLength: 0.40,
  lowerLegLength: 0.42,
  limbRadius: 0.04,
  hipY: 0.85,
  shoulderOffsetX: 0.20,
  hipOffsetX: 0.10,
  moveSpeed: 7.0,
};

// ── Physics ────────────────────────────────────────────────────────
export const PHYSICS = {
  gravity: { x: 0, y: -9.81, z: 0 },
  fixedTimestep: 1 / 60,
};

// ── Camera ─────────────────────────────────────────────────────────
export const CAMERA = {
  fov: 45,
  near: 0.1,
  far: 200,
  height: 5.5,
  distanceBehind: 8,
  lookAheadZ: -3,
  lateralTrackingSpeed: 3.0,
  lateralTrackingFactor: 0.5,
};

// ── Ball ──────────────────────────────────────────────────────────
export const BALL = {
  radius: 0.0335,
  restitution: 0.75,
  serveSpeed: 8,
  returnSpeed: 9,
  serveArcY: 4,
  returnArcY: 3.5,
  outOfBoundsY: -1,
  outOfBoundsZ: 16,
  outOfBoundsX: 8,
  resetDelay: 2.0,
  serveStartZ: -9,
  serveStartY: 1.5,
  autoReturnDelayMin: 0.8,
  autoReturnDelayMax: 1.2,
};

// ── Swing ─────────────────────────────────────────────────────────
export const SWING = {
  duration: 0.35,
  hitRadius: 1.8,
  hitHeightMin: 0,
  hitHeightMax: 2.5,
  hitSpeedZ: -12,
  hitSpeedY: 4,
  hitSpeedXMultiplier: 0.4,
  movementInfluenceX: 0.3,
};

// ── Colors ─────────────────────────────────────────────────────────
export const COLORS = {
  clay: 0xC4662B,
  clayDark: 0xA8522A,
  surround: 0x2D7A3A,
  lines: 0xFFFFFF,
  net: 0xFFFFFF,
  netPost: 0x888888,
  sky: 0x87CEEB,
  playerShirt: 0x2255CC,
  playerShorts: 0x222222,
  playerSkin: 0xE8B89D,
  playerHair: 0x3A2512,
  playerShoes: 0xFFFFFF,
  racketHandle: 0x8B4513,
  racketHead: 0xCC3333,
};
