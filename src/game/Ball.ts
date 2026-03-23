import * as THREE from 'three';
import { BallState, PlayerSide, Vec3 } from '@/types';
import { COURT, GAME, RENDER_3D } from '@/utils/Constants';

export class Ball {
  readonly mesh: THREE.Mesh;
  private readonly shadowMesh: THREE.Mesh;

  state: BallState = {
    position: { x: 0, y: 0, z: 1 },
    velocity: { x: 0, y: 0, z: 0 },
    inPlay: false,
    lastHitBy: null,
    hasBounced: false,
    bounceCount: 0,
  };

  private prevY = 0;
  private lastBouncePos: Vec3 = { x: 0, y: 0, z: 0 };

  constructor(scene: THREE.Scene) {
    // Ball mesh
    const geo = new THREE.SphereGeometry(RENDER_3D.BALL_VISUAL_RADIUS, 16, 16);
    const mat = new THREE.MeshLambertMaterial({ color: RENDER_3D.COLORS.BALL });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    scene.add(this.mesh);

    // Shadow on ground
    const shadowGeo = new THREE.CircleGeometry(0.15, 16);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.3,
    });
    this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowMesh.rotation.x = -Math.PI / 2;
    this.shadowMesh.position.y = 0.005;
    scene.add(this.shadowMesh);
  }

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
  }

  update(dt: number): void {
    if (!this.state.inPlay) return;

    const pos = this.state.position;
    const vel = this.state.velocity;

    this.prevY = pos.y;

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

  /** Sync Three.js mesh positions with physics state. y↔z swap happens here. */
  updateVisuals(): void {
    const pos = this.state.position;
    // Game coords: x=across, y=along court, z=height
    // Three.js: x=across, y=height, z=along court
    this.mesh.position.set(pos.x, pos.z, pos.y);

    const visible = this.state.inPlay || (this.state.velocity.x !== 0 || this.state.velocity.y !== 0);
    this.mesh.visible = visible;
    this.shadowMesh.visible = visible;

    if (visible) {
      // Shadow on ground directly below ball
      this.shadowMesh.position.set(pos.x, 0.005, pos.y);
      const shadowScale = Math.max(0.3, 1 - pos.z * 0.15);
      this.shadowMesh.scale.set(shadowScale, shadowScale, shadowScale);
      (this.shadowMesh.material as THREE.MeshBasicMaterial).opacity = 0.3 * shadowScale;
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
}
