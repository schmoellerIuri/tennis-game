import { Vec2, Vec3 } from '@/types';
import { RENDER } from './Constants';

const SCALE = RENDER.COURT_SCALE;
const TW = RENDER.TILE_WIDTH;
const TH = RENDER.TILE_HEIGHT;

export function worldToScreen(worldX: number, worldY: number): Vec2 {
  const sx = (worldX - worldY) * (TW / 2) * (SCALE / TW);
  const sy = (worldX + worldY) * (TH / 2) * (SCALE / TW);
  return { x: sx, y: sy };
}

export function worldToScreen3D(pos: Vec3): Vec2 {
  const screen = worldToScreen(pos.x, pos.y);
  const heightOffset = pos.z * SCALE * 0.8;
  return { x: screen.x, y: screen.y - heightOffset };
}

export function screenToWorld(screenX: number, screenY: number): Vec2 {
  const factor = SCALE / TW;
  const twHalf = (TW / 2) * factor;
  const thHalf = (TH / 2) * factor;
  const worldX = (screenX / twHalf + screenY / thHalf) / 2;
  const worldY = (screenY / thHalf - screenX / twHalf) / 2;
  return { x: worldX, y: worldY };
}

export function getShadowPosition(pos: Vec3): Vec2 {
  return worldToScreen(pos.x, pos.y);
}

export function depthSort(a: Vec3, b: Vec3): number {
  return (a.x + a.y) - (b.x + b.y);
}
