import * as THREE from 'three';
import { GamePhase, MatchStats, PlayerSide, Difficulty, PlayerInput, ServePhase, Vec2 } from '@/types';
import { COURT, GAME, INPUT } from '@/utils/Constants';
import { Court } from './Court';
import { Player } from './Player';
import { Ball } from './Ball';
import { Score } from './Score';
import { AIController } from '@/ai/AIController';
import { InputManager } from '@/input/InputManager';
import { UIManager } from '@/ui/UIManager';

export class Game {
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly court: Court;
  private readonly playerNear: Player;
  private readonly playerFar: Player;
  private readonly ball: Ball;
  private readonly score: Score;
  private readonly ai: AIController;
  private readonly inputManager: InputManager;
  private readonly ui: UIManager;

  // Game state
  private phase: GamePhase = GamePhase.Countdown;
  private pauseTimer = 2;
  private accumulator = 0;
  private hasServed = false;
  private stats: MatchStats = { aces: 0, winners: 0, unforcedErrors: 0, totalPoints: 0 };
  private onMatchEnd: ((winner: PlayerSide, stats: MatchStats) => void) | null = null;

  // Tennis serve state
  private faultCount = 0;
  private pointsInCurrentGame = 0;
  private serveInProgress = false;
  private serveBounceChecked = false;
  private lastPointMessage = '';
  private rallyHitCount = 0;
  private aiServeDelay = 0;

  // New serve mechanic
  private servePhase: ServePhase = ServePhase.WaitingForToss;
  private spaceWasDown = false;

  constructor(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    inputManager: InputManager,
    ui: UIManager,
    difficulty: Difficulty,
    sets: number = 1,
  ) {
    this.scene = scene;
    this.camera = camera;
    this.inputManager = inputManager;
    this.ui = ui;

    this.court = new Court(scene);
    this.playerNear = new Player(scene, PlayerSide.Near);
    this.playerFar = new Player(scene, PlayerSide.Far);
    this.ball = new Ball(scene);
    this.score = new Score(sets);
    this.ai = new AIController(difficulty);

    this.ball.reset(this.score.state.servingSide);
    this.setupServe();
  }

  setOnMatchEnd(cb: (winner: PlayerSide, stats: MatchStats) => void): void {
    this.onMatchEnd = cb;
  }

  update(dt: number): void {
    this.accumulator += dt;
    const fixedDt = GAME.TICK_DURATION / 1000;

    while (this.accumulator >= fixedDt) {
      this.fixedUpdate(fixedDt);
      this.accumulator -= fixedDt;
    }

    this.updateVisuals();
    this.updateCamera();
    this.updateHUD();
  }

  // ============= Game state machine =============

  private fixedUpdate(dt: number): void {
    switch (this.phase) {
      case GamePhase.Countdown:
        this.updateCountdown(dt);
        break;
      case GamePhase.Serving:
        this.updateServing(dt);
        break;
      case GamePhase.Rally:
        this.updateRally(dt);
        break;
      case GamePhase.PointOver:
        this.updatePointOver(dt);
        break;
      case GamePhase.MatchOver:
        break;
    }
  }

  private updateCountdown(dt: number): void {
    this.playerNear.tickAnimation(dt);
    this.playerFar.tickAnimation(dt);
    this.pauseTimer -= dt;
    if (this.pauseTimer <= 0) {
      this.setupServe();
      this.phase = GamePhase.Serving;
    }
  }

  private get isDeuceSide(): boolean {
    return this.pointsInCurrentGame % 2 === 0;
  }

  private updateServing(dt: number): void {
    this.playerNear.tickAnimation(dt);
    this.playerFar.tickAnimation(dt);

    const isPlayerServing = this.score.state.servingSide === PlayerSide.Near;

    if (isPlayerServing) {
      this.updatePlayerServe(dt);
    } else {
      this.updateAIServe(dt);
    }
  }

  private updatePlayerServe(dt: number): void {
    const input = this.inputManager.update(dt);

    // Detect space press edge (pressed this frame)
    const spaceDown = this.inputManager.isSpaceHeld() || input.shotRequested;
    const spaceJustPressed = spaceDown && !this.spaceWasDown;
    this.spaceWasDown = spaceDown;

    // Update power meter during charging
    if (this.inputManager.isSpaceHeld()) {
      this.ui.updatePowerMeter(this.inputManager.getCurrentChargePower(), true);
    }

    switch (this.servePhase) {
      case ServePhase.WaitingForToss:
        if (spaceJustPressed) {
          // Toss the ball
          this.ball.state.position = {
            x: this.playerNear.position.x,
            y: this.playerNear.position.y,
            z: 1.5,
          };
          this.ball.state.velocity = { x: 0, y: 0, z: INPUT.SERVE_TOSS_SPEED };
          this.ball.state.inPlay = true;
          this.servePhase = ServePhase.BallRising;
        }
        break;

      case ServePhase.BallRising:
        // Ball rises with gravity
        this.ball.state.position.z += this.ball.state.velocity.z * dt;
        this.ball.state.velocity.z -= GAME.GRAVITY * dt;

        if (this.ball.state.velocity.z <= 0) {
          this.servePhase = ServePhase.WaitingForHit;
        }
        break;

      case ServePhase.WaitingForHit:
        // Ball falls with gravity
        this.ball.state.position.z += this.ball.state.velocity.z * dt;
        this.ball.state.velocity.z -= GAME.GRAVITY * dt;

        if (input.shotRequested) {
          // Hit the serve
          this.ui.updatePowerMeter(0, false);
          const aimDir = input.aimDirection;
          const targetX = aimDir.x * COURT.SINGLES_WIDTH * 0.4;
          const targetY = -(COURT.SERVICE_LINE_DIST * 0.3 + input.shotPower * COURT.SERVICE_LINE_DIST * 0.5);
          this.executeServe(PlayerSide.Near, targetX, targetY, input.shotPower);
          return;
        }

        // Ball dropped too low → fault
        if (this.ball.state.position.z < INPUT.SERVE_HIT_MIN_HEIGHT) {
          this.ui.updatePowerMeter(0, false);
          this.ball.state.inPlay = false;
          this.handleFault();
        }
        break;
    }
  }

  private updateAIServe(dt: number): void {
    if (!this.hasServed) {
      this.aiServeDelay -= dt;
      if (this.aiServeDelay <= 0) {
        this.hasServed = true;
        const aiServe = this.ai.getServeTarget(this.isDeuceSide);
        this.executeServe(PlayerSide.Far, aiServe.targetX, aiServe.targetY, aiServe.power);
      }
    }
  }

  private executeServe(side: PlayerSide, targetX: number, targetY: number, power: number): void {
    const server = side === PlayerSide.Near ? this.playerNear : this.playerFar;
    server.serve();

    const speed = GAME.BALL_SPEED_NORMAL * (0.6 + power * 0.3);

    this.ball.state.position = {
      x: server.position.x,
      y: server.position.y,
      z: 2.5,
    };
    this.ball.hit(targetX, targetY, speed, 2, side);
    this.hasServed = true;
    this.phase = GamePhase.Rally;
    this.serveInProgress = true;
    this.serveBounceChecked = false;
    this.rallyHitCount = 0;
  }

  private updateRally(dt: number): void {
    // Human player input
    const playerInput = this.inputManager.update(dt);
    this.playerNear.update(dt, playerInput);

    // Show power meter while charging
    if (playerInput.isCharging) {
      this.ui.updatePowerMeter(this.inputManager.getCurrentChargePower(), true);
    } else {
      this.ui.updatePowerMeter(0, false);
    }

    // AI movement
    const ballApproaching = this.ball.state.velocity.y < 0;
    const aiInput = this.ai.getInput(
      this.playerFar.position,
      this.ball.state.position,
      this.ball.state.velocity,
      this.ball.state.inPlay,
      ballApproaching,
    );
    this.playerFar.update(dt, aiInput);

    // Ball physics
    this.ball.update(dt);

    // Serve landing validation
    if (this.serveInProgress && !this.serveBounceChecked) {
      if (this.ball.isNetHit()) {
        this.handleFault();
        return;
      }

      if (this.ball.state.bounceCount >= 1) {
        if (this.isServeInBox()) {
          this.serveBounceChecked = true;
          this.serveInProgress = false;
        } else {
          this.handleFault();
          return;
        }
      }

      if (this.ball.isOut()) {
        this.handleFault();
        return;
      }

      return;
    }

    // Hit detection - player
    if (playerInput.shotRequested && this.playerNear.canHit) {
      this.tryHit(this.playerNear, playerInput.aimDirection, playerInput.shotPower);
    }

    // Hit detection - AI
    if (aiInput.shotRequested && this.playerFar.canHit) {
      this.tryHit(this.playerFar, aiInput.aimDirection, aiInput.shotPower);
    }

    // Point resolution
    this.checkPointEnd();
  }

  private isServeInBox(): boolean {
    const pos = this.ball.getLastBouncePos();
    const hw = COURT.SINGLES_WIDTH / 2;
    const sl = COURT.SERVICE_LINE_DIST;
    const servingSide = this.score.state.servingSide;

    if (servingSide === PlayerSide.Near) {
      if (pos.y < -sl || pos.y > 0) return false;
      if (Math.abs(pos.x) > hw) return false;
      if (this.isDeuceSide && pos.x > 0) return false;
      if (!this.isDeuceSide && pos.x < 0) return false;
    } else {
      if (pos.y > sl || pos.y < 0) return false;
      if (Math.abs(pos.x) > hw) return false;
      if (this.isDeuceSide && pos.x < 0) return false;
      if (!this.isDeuceSide && pos.x > 0) return false;
    }

    return true;
  }

  private handleFault(): void {
    this.faultCount++;
    if (this.faultCount >= 2) {
      this.lastPointMessage = 'DOUBLE FAULT';
      const receiver = this.score.state.servingSide === PlayerSide.Near
        ? PlayerSide.Far
        : PlayerSide.Near;
      this.endPoint(receiver);
    } else {
      this.lastPointMessage = 'FAULT';
      this.phase = GamePhase.PointOver;
      this.pauseTimer = 1.5;
    }
  }

  private tryHit(player: Player, aimDirection: Vec2, power: number): void {
    const bp = this.ball.state.position;
    const pp = player.position;
    const dx = bp.x - pp.x;
    const dy = bp.y - pp.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > GAME.PLAYER_HIT_RADIUS || bp.z > 2.5) return;
    if (this.ball.state.lastHitBy === player.side) return;

    this.rallyHitCount++;
    player.swing();

    const isLob = power > INPUT.LOB_THRESHOLD;
    const speed = isLob ? GAME.BALL_SPEED_LOB : GAME.BALL_SPEED_NORMAL;
    const lobHeight = isLob ? 4 : 1.5;

    const direction = player.side === PlayerSide.Near ? -1 : 1;

    const targetX = aimDirection.x * COURT.SINGLES_WIDTH * 0.4;
    const targetY = direction * (COURT.HALF_LENGTH * 0.3 + power * COURT.HALF_LENGTH * 0.7);

    this.ball.hit(targetX, targetY, speed * (0.8 + power * 0.2), lobHeight, player.side);
  }

  private checkPointEnd(): void {
    const ball = this.ball;

    if (ball.isNetHit()) {
      const winner = ball.state.lastHitBy === PlayerSide.Near ? PlayerSide.Far : PlayerSide.Near;
      this.lastPointMessage = 'NET';
      this.endPoint(winner);
      return;
    }

    if (ball.isDoubleBounce()) {
      const landingSide = ball.getLandingSide();
      if (landingSide !== null) {
        const winner = landingSide === PlayerSide.Near ? PlayerSide.Far : PlayerSide.Near;
        if (this.rallyHitCount === 0) {
          this.stats.aces++;
          this.lastPointMessage = 'ACE';
        } else {
          this.stats.winners++;
          this.lastPointMessage = '';
        }
        this.endPoint(winner);
      }
      return;
    }

    if (ball.isOut()) {
      const winner = ball.state.lastHitBy === PlayerSide.Near ? PlayerSide.Far : PlayerSide.Near;
      this.stats.unforcedErrors++;
      this.lastPointMessage = 'OUT';
      this.endPoint(winner);
      return;
    }

    if (ball.state.position.z < -5) {
      const winner = ball.state.lastHitBy === PlayerSide.Near ? PlayerSide.Far : PlayerSide.Near;
      this.endPoint(winner);
    }
  }

  private endPoint(winner: PlayerSide): void {
    this.stats.totalPoints++;
    this.pointsInCurrentGame++;

    const prevTotalGames = this.score.state.games[0].reduce((a, b) => a + b, 0) +
                           this.score.state.games[1].reduce((a, b) => a + b, 0);

    this.score.pointWon(winner);

    const newTotalGames = this.score.state.games[0].reduce((a, b) => a + b, 0) +
                          this.score.state.games[1].reduce((a, b) => a + b, 0);

    if (newTotalGames !== prevTotalGames) {
      this.pointsInCurrentGame = 0;
    }

    this.faultCount = 0;
    this.serveInProgress = false;
    this.phase = GamePhase.PointOver;
    this.pauseTimer = GAME.POINT_PAUSE_DURATION / 1000;
    this.ui.updatePowerMeter(0, false);

    if (this.score.isMatchOver()) {
      this.phase = GamePhase.MatchOver;
      if (this.onMatchEnd) {
        this.onMatchEnd(this.score.getMatchWinner()!, { ...this.stats });
      }
    }
  }

  private updatePointOver(dt: number): void {
    this.playerNear.tickAnimation(dt);
    this.playerFar.tickAnimation(dt);
    this.pauseTimer -= dt;
    if (this.pauseTimer <= 0) {
      if (this.lastPointMessage === 'FAULT') {
        this.lastPointMessage = '';
        this.positionForServe();
        this.phase = GamePhase.Serving;
      } else {
        this.lastPointMessage = '';
        this.setupServe();
        this.phase = GamePhase.Serving;
      }
    }
  }

  private positionForServe(): void {
    const servingSide = this.score.state.servingSide;
    const server = servingSide === PlayerSide.Near ? this.playerNear : this.playerFar;
    const receiver = servingSide === PlayerSide.Near ? this.playerFar : this.playerNear;

    if (servingSide === PlayerSide.Near) {
      server.position.x = this.isDeuceSide ? 1.5 : -1.5;
      server.position.y = COURT.HALF_LENGTH;
    } else {
      server.position.x = this.isDeuceSide ? -1.5 : 1.5;
      server.position.y = -COURT.HALF_LENGTH;
    }

    if (servingSide === PlayerSide.Near) {
      receiver.position.x = this.isDeuceSide ? -1 : 1;
      receiver.position.y = -COURT.HALF_LENGTH + 2;
    } else {
      receiver.position.x = this.isDeuceSide ? 1 : -1;
      receiver.position.y = COURT.HALF_LENGTH - 2;
    }

    this.ball.reset(servingSide);
    this.ball.state.position = {
      x: server.position.x,
      y: server.position.y,
      z: 1,
    };

    this.hasServed = false;
    this.serveInProgress = false;
    this.servePhase = ServePhase.WaitingForToss;
    this.spaceWasDown = false;
    this.aiServeDelay = 1.0 + Math.random() * 0.5;
  }

  private setupServe(): void {
    if (this.score.state.points[0] === 0 && this.score.state.points[1] === 0
        && !this.score.state.isDeuce) {
      this.pointsInCurrentGame = 0;
    }

    this.faultCount = 0;
    this.playerNear.resetPosition();
    this.playerFar.resetPosition();
    this.positionForServe();
  }

  // ============= Visuals =============

  private updateVisuals(): void {
    this.playerNear.updateVisuals();
    this.playerFar.updateVisuals();
    this.ball.updateVisuals();
  }

  private updateCamera(): void {
    // Behind and above the near player, looking at center court
    const playerZ = this.playerNear.position.y; // game y → three.js z
    const targetCamZ = playerZ + 12;
    const targetCamY = 8;

    // Smooth follow
    this.camera.position.x += (0 - this.camera.position.x) * 0.05;
    this.camera.position.y += (targetCamY - this.camera.position.y) * 0.05;
    this.camera.position.z += (targetCamZ - this.camera.position.z) * 0.05;

    this.camera.lookAt(0, 1, 0);
  }

  private updateHUD(): void {
    const display = this.score.getDisplayScore();
    const games = this.score.state.games;
    const servingSide = this.score.state.servingSide;

    let message = this.lastPointMessage;
    if (!message && this.phase === GamePhase.PointOver) {
      message = this.getPointMessage();
    }

    this.ui.updateHUD(
      display,
      games,
      servingSide,
      this.phase,
      message,
      this.faultCount,
      this.pauseTimer,
    );
  }

  private getPointMessage(): string {
    if (this.score.state.isDeuce) return 'DEUCE';
    if (this.score.state.advantage) {
      return this.score.state.advantage === PlayerSide.Near ? 'ADVANTAGE YOU' : 'ADVANTAGE CPU';
    }
    return '';
  }

  destroy(): void {
    // Remove meshes from scene
    this.scene.remove(this.court.group);
    this.scene.remove(this.playerNear.group);
    this.scene.remove(this.playerFar.group);
    this.scene.remove(this.ball.mesh);
  }
}
