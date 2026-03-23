import * as THREE from 'three';
import { AnimationState, PlayerInput, PlayerSide, Vec2 } from '@/types';
import { COURT, GAME, RENDER_3D } from '@/utils/Constants';

export class Player {
  readonly group: THREE.Group;
  readonly side: PlayerSide;

  position: Vec2;
  animation: AnimationState = AnimationState.Idle;
  canHit = true;

  private swingTimer = 0;
  private bounceTimer = 0;
  private idleTimer = 0;
  private swingProgress = 0;
  private serveProgress = 0;
  private facingAngle = 0; // radians, 0 = toward -z (opponent)

  private readonly SWING_DURATION = 0.3;
  private readonly SERVE_DURATION = 0.5;

  // 3D parts
  private body: THREE.Mesh;
  private head: THREE.Mesh;
  private racketGroup: THREE.Group;
  private racketHandle: THREE.Mesh;
  private racketHead: THREE.Mesh;

  // Shadow
  private shadow: THREE.Mesh;

  constructor(scene: THREE.Scene, side: PlayerSide) {
    this.side = side;
    const startY = side === PlayerSide.Near ? COURT.HALF_LENGTH - 2 : -COURT.HALF_LENGTH + 2;
    this.position = { x: 0, y: startY };

    this.group = new THREE.Group();

    const bodyColor = side === PlayerSide.Near
      ? RENDER_3D.COLORS.PLAYER_NEAR
      : RENDER_3D.COLORS.PLAYER_FAR;

    // Body (capsule)
    const bodyGeo = new THREE.CapsuleGeometry(
      RENDER_3D.PLAYER_BODY_RADIUS,
      RENDER_3D.PLAYER_BODY_HEIGHT,
      8, 16,
    );
    const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
    this.body = new THREE.Mesh(bodyGeo, bodyMat);
    this.body.position.y = RENDER_3D.PLAYER_BODY_RADIUS + RENDER_3D.PLAYER_BODY_HEIGHT / 2;
    this.body.castShadow = true;
    this.group.add(this.body);

    // Head
    const headGeo = new THREE.SphereGeometry(RENDER_3D.PLAYER_HEAD_RADIUS, 16, 16);
    const headMat = new THREE.MeshLambertMaterial({ color: RENDER_3D.COLORS.SKIN });
    this.head = new THREE.Mesh(headGeo, headMat);
    this.head.position.y = RENDER_3D.PLAYER_BODY_HEIGHT + RENDER_3D.PLAYER_BODY_RADIUS * 2 + RENDER_3D.PLAYER_HEAD_RADIUS * 0.6;
    this.head.castShadow = true;
    this.group.add(this.head);

    // Racket group
    this.racketGroup = new THREE.Group();

    // Racket handle
    const handleGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8);
    const handleMat = new THREE.MeshLambertMaterial({ color: RENDER_3D.COLORS.RACKET_GRIP });
    this.racketHandle = new THREE.Mesh(handleGeo, handleMat);
    this.racketHandle.position.y = 0.15;
    this.racketGroup.add(this.racketHandle);

    // Racket head (flat disc)
    const racketHeadGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.02, 16);
    const racketHeadMat = new THREE.MeshLambertMaterial({ color: RENDER_3D.COLORS.RACKET_STRING });
    this.racketHead = new THREE.Mesh(racketHeadGeo, racketHeadMat);
    this.racketHead.position.y = 0.35;
    this.racketGroup.add(this.racketHead);

    // Position racket at hand level
    this.racketGroup.position.set(0.35, 0.8, 0);
    this.group.add(this.racketGroup);

    // Shadow
    const shadowGeo = new THREE.CircleGeometry(0.3, 16);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.25,
    });
    this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.005;
    this.group.add(this.shadow);

    scene.add(this.group);
  }

  update(dt: number, input: PlayerInput): void {
    this.idleTimer += dt;

    if (this.swingTimer > 0) {
      this.swingTimer -= dt;
      if (this.animation === AnimationState.Swinging) {
        this.swingProgress = 1 - Math.max(0, this.swingTimer) / this.SWING_DURATION;
      } else if (this.animation === AnimationState.Serving) {
        this.serveProgress = 1 - Math.max(0, this.swingTimer) / this.SERVE_DURATION;
      }
      if (this.swingTimer <= 0) {
        this.animation = AnimationState.Idle;
        this.canHit = true;
        this.swingProgress = 0;
        this.serveProgress = 0;
      }
      return;
    }

    const moveX = input.moveX * GAME.PLAYER_SPEED * dt;
    const moveY = input.moveY * GAME.PLAYER_SPEED * dt;

    this.position.x += moveX;
    this.position.y += moveY;

    this.clampPosition();

    if (Math.abs(input.moveX) > 0.1 || Math.abs(input.moveY) > 0.1) {
      this.animation = input.isCharging ? AnimationState.Preparing : AnimationState.Running;
      this.bounceTimer += dt * 8;
      this.facingAngle = Math.atan2(input.moveX, -input.moveY);
    } else if (input.isCharging) {
      this.animation = AnimationState.Preparing;
    } else {
      this.animation = AnimationState.Idle;
      this.bounceTimer = 0;
    }
  }

  tickAnimation(dt: number): void {
    this.idleTimer += dt;
    if (this.swingTimer > 0) {
      this.swingTimer -= dt;
      if (this.animation === AnimationState.Swinging) {
        this.swingProgress = 1 - Math.max(0, this.swingTimer) / this.SWING_DURATION;
      } else if (this.animation === AnimationState.Serving) {
        this.serveProgress = 1 - Math.max(0, this.swingTimer) / this.SERVE_DURATION;
      }
      if (this.swingTimer <= 0) {
        this.animation = AnimationState.Idle;
        this.canHit = true;
        this.swingProgress = 0;
        this.serveProgress = 0;
      }
    }
  }

  swing(): void {
    this.animation = AnimationState.Swinging;
    this.canHit = false;
    this.swingTimer = this.SWING_DURATION;
    this.swingProgress = 0;
  }

  serve(): void {
    this.animation = AnimationState.Serving;
    this.canHit = false;
    this.swingTimer = this.SERVE_DURATION;
    this.serveProgress = 0;
  }

  resetPosition(): void {
    const startY = this.side === PlayerSide.Near ? COURT.HALF_LENGTH - 2 : -COURT.HALF_LENGTH + 2;
    this.position = { x: 0, y: startY };
    this.animation = AnimationState.Idle;
    this.canHit = true;
    this.swingTimer = 0;
    this.bounceTimer = 0;
    this.facingAngle = 0;
    this.swingProgress = 0;
    this.serveProgress = 0;
  }

  /** Sync Three.js group position with physics state. y↔z swap happens here. */
  updateVisuals(): void {
    // Game coords: x=across, y=along court
    // Three.js: x=across, z=along court
    this.group.position.set(this.position.x, 0, this.position.y);

    // Face movement direction
    this.group.rotation.y = this.facingAngle;

    // Animations
    let bounceY = 0;
    if (this.animation === AnimationState.Running) {
      bounceY = Math.abs(Math.sin(this.bounceTimer)) * 0.05;
    } else if (this.animation === AnimationState.Idle) {
      bounceY = Math.sin(this.idleTimer * 2) * 0.015;
    }
    this.body.position.y = RENDER_3D.PLAYER_BODY_RADIUS + RENDER_3D.PLAYER_BODY_HEIGHT / 2 + bounceY;
    this.head.position.y = RENDER_3D.PLAYER_BODY_HEIGHT + RENDER_3D.PLAYER_BODY_RADIUS * 2 + RENDER_3D.PLAYER_HEAD_RADIUS * 0.6 + bounceY;

    // Racket animation
    if (this.animation === AnimationState.Swinging) {
      const p = this.swingProgress;
      if (p < 0.3) {
        // Wind-up
        const t = p / 0.3;
        this.racketGroup.rotation.x = -t * 1.2;
        this.racketGroup.position.set(0.35, 0.8 + t * 0.2, t * 0.3);
      } else if (p < 0.6) {
        // Contact
        const t = (p - 0.3) / 0.3;
        this.racketGroup.rotation.x = -1.2 + t * 2.4;
        this.racketGroup.position.set(0.35, 0.8 + 0.2 - t * 0.3, 0.3 - t * 0.6);
      } else {
        // Follow-through
        const t = (p - 0.6) / 0.4;
        this.racketGroup.rotation.x = 1.2 - t * 1.2;
        this.racketGroup.position.set(0.35, 0.8 - 0.1 + t * 0.1, -0.3 + t * 0.3);
      }
    } else if (this.animation === AnimationState.Serving) {
      const p = this.serveProgress;
      if (p < 0.3) {
        const t = p / 0.3;
        this.racketGroup.rotation.x = -t * 2.0;
        this.racketGroup.position.set(0.35, 0.8 + t * 0.6, t * 0.2);
      } else if (p < 0.6) {
        const t = (p - 0.3) / 0.3;
        this.racketGroup.rotation.x = -2.0 + t * 3.0;
        this.racketGroup.position.set(0.35, 1.4 + t * 0.2, 0.2 - t * 0.4);
      } else {
        const t = (p - 0.6) / 0.4;
        this.racketGroup.rotation.x = 1.0 - t * 1.0;
        this.racketGroup.position.set(0.35, 1.6 - t * 0.8, -0.2 + t * 0.2);
      }
    } else if (this.animation === AnimationState.Preparing) {
      // Charge wind-back: racket pulls back
      this.racketGroup.rotation.x = -0.8;
      this.racketGroup.position.set(0.35, 0.9, 0.25);
    } else {
      // Idle
      const breathOff = Math.sin(this.idleTimer * 2) * 0.01;
      this.racketGroup.rotation.x = 0;
      this.racketGroup.position.set(0.35, 0.8 + breathOff, 0);
    }
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
