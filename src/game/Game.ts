import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { GamePhase, MatchStats, PlayerSide, ShotType, Difficulty } from '@/types';
import { COURT, GAME, RENDER } from '@/utils/Constants';
import { worldToScreen, screenToWorld } from '@/utils/IsometricUtils';
import { Court } from './Court';
import { Player } from './Player';
import { Ball } from './Ball';
import { Score } from './Score';
import { InputManager } from '@/input/InputManager';
import { AIController } from '@/ai/AIController';

export class Game {
  readonly container = new Container();
  private readonly court: Court;
  private readonly playerNear: Player;
  private readonly playerFar: Player;
  private readonly ball: Ball;
  private readonly score: Score;
  private readonly input: InputManager;
  private readonly ai: AIController;
  private readonly scoreDisplay: Container;

  private phase: GamePhase = GamePhase.Serving;
  private pauseTimer = 0;
  private accumulator = 0;
  private stats: MatchStats = { aces: 0, winners: 0, unforcedErrors: 0, totalPoints: 0 };
  private centerX = 0;
  private centerY = 0;
  private onMatchEnd: ((winner: PlayerSide, stats: MatchStats) => void) | null = null;

  constructor(input: InputManager, difficulty: Difficulty, sets: number = 1) {
    this.court = new Court();
    this.playerNear = new Player(PlayerSide.Near);
    this.playerFar = new Player(PlayerSide.Far);
    this.ball = new Ball();
    this.score = new Score(sets);
    this.input = input;
    this.ai = new AIController(difficulty);
    this.scoreDisplay = new Container();

    this.container.addChild(this.court.container);
    this.container.addChild(this.playerFar.container);
    this.container.addChild(this.ball.container);
    this.container.addChild(this.playerNear.container);
    this.container.addChild(this.scoreDisplay);

    this.ball.reset(this.score.state.servingSide);
    this.setupServe();
  }

  setOnMatchEnd(cb: (winner: PlayerSide, stats: MatchStats) => void): void {
    this.onMatchEnd = cb;
  }

  setCenter(x: number, y: number): void {
    this.centerX = x;
    this.centerY = y;
    this.container.x = x;
    this.container.y = y;
  }

  update(dt: number): void {
    this.accumulator += dt;
    const fixedDt = GAME.TICK_DURATION / 1000;

    while (this.accumulator >= fixedDt) {
      this.fixedUpdate(fixedDt);
      this.accumulator -= fixedDt;
    }

    this.render();
  }

  private fixedUpdate(dt: number): void {
    switch (this.phase) {
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

  private updateServing(dt: number): void {
    const isPlayerServing = this.score.state.servingSide === PlayerSide.Near;

    if (isPlayerServing) {
      const playerScreen = worldToScreen(this.playerNear.position.x, this.playerNear.position.y);
      const input = this.input.getInput(
        playerScreen.x + this.centerX,
        playerScreen.y + this.centerY,
      );

      if (input.shotType !== null) {
        this.executeServe(PlayerSide.Near, input.aimAngle, input.shotPower);
      }
    } else {
      const aiInput = this.ai.getServeInput();
      this.executeServe(PlayerSide.Far, aiInput.aimAngle, aiInput.shotPower);
    }
  }

  private executeServe(side: PlayerSide, aimAngle: number, power: number): void {
    const server = side === PlayerSide.Near ? this.playerNear : this.playerFar;
    server.serve();

    const speed = GAME.BALL_SPEED_NORMAL * (0.7 + power * 0.3);
    const targetY = side === PlayerSide.Near
      ? -COURT.SERVICE_LINE_DIST + Math.random() * 2
      : COURT.SERVICE_LINE_DIST - Math.random() * 2;
    const targetX = Math.cos(aimAngle) * COURT.SINGLES_WIDTH * 0.3;

    this.ball.state.position = {
      x: server.position.x,
      y: server.position.y,
      z: 2.5,
    };
    this.ball.hit(targetX, targetY, speed, 2, side);
    this.phase = GamePhase.Rally;
  }

  private updateRally(dt: number): void {
    // Update player (near - human)
    const playerScreen = worldToScreen(this.playerNear.position.x, this.playerNear.position.y);
    const playerInput = this.input.getInput(
      playerScreen.x + this.centerX,
      playerScreen.y + this.centerY,
    );

    // Player movement uses isometric-corrected input
    const isoInput = { ...playerInput };
    isoInput.moveX = playerInput.moveX;
    isoInput.moveY = playerInput.moveY;
    this.playerNear.update(dt, isoInput);

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

    // Ball
    this.ball.update(dt);

    // Hit detection - player
    if (playerInput.shotType !== null && this.playerNear.canHit) {
      this.tryHit(this.playerNear, playerInput.aimAngle, playerInput.shotPower, playerInput.shotType);
    }

    // Hit detection - AI
    if (aiInput.shotType !== null && this.playerFar.canHit) {
      this.tryHit(this.playerFar, aiInput.aimAngle, aiInput.shotPower, aiInput.shotType);
    }

    // Point resolution
    this.checkPointEnd();
  }

  private tryHit(player: Player, aimAngle: number, power: number, shotType: ShotType): void {
    const bp = this.ball.state.position;
    const pp = player.position;
    const dx = bp.x - pp.x;
    const dy = bp.y - pp.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > GAME.PLAYER_HIT_RADIUS || bp.z > 2.5) return;
    if (this.ball.state.lastHitBy === player.side) return;

    player.swing();

    const isLob = shotType === ShotType.Lob;
    const speed = isLob ? GAME.BALL_SPEED_LOB : GAME.BALL_SPEED_NORMAL;
    const lobHeight = isLob ? 4 : 1.5;

    const direction = player.side === PlayerSide.Near ? -1 : 1;
    const targetX = Math.cos(aimAngle) * COURT.SINGLES_WIDTH * 0.4;
    const targetY = direction * (COURT.HALF_LENGTH - 2 + power * 3);

    this.ball.hit(targetX, targetY, speed * (0.7 + power * 0.3), lobHeight, player.side);
  }

  private checkPointEnd(): void {
    const ball = this.ball;

    if (ball.isOut()) {
      const winner = ball.state.lastHitBy === PlayerSide.Near ? PlayerSide.Far : PlayerSide.Near;
      this.stats.unforcedErrors++;
      this.endPoint(winner);
      return;
    }

    if (ball.isNetHit()) {
      const winner = ball.state.lastHitBy === PlayerSide.Near ? PlayerSide.Far : PlayerSide.Near;
      this.endPoint(winner);
      return;
    }

    if (ball.isDoubleBounce()) {
      const landingSide = ball.getLandingSide();
      if (landingSide !== null) {
        const winner = landingSide === PlayerSide.Near ? PlayerSide.Far : PlayerSide.Near;
        if (!ball.state.hasBounced || ball.state.bounceCount <= 1) {
          this.stats.aces++;
        } else {
          this.stats.winners++;
        }
        this.endPoint(winner);
      }
      return;
    }

    // Ball fell too far off court
    if (ball.state.position.z < -5) {
      const winner = ball.state.lastHitBy === PlayerSide.Near ? PlayerSide.Far : PlayerSide.Near;
      this.endPoint(winner);
    }
  }

  private endPoint(winner: PlayerSide): void {
    this.stats.totalPoints++;
    this.score.pointWon(winner);
    this.phase = GamePhase.PointOver;
    this.pauseTimer = GAME.POINT_PAUSE_DURATION / 1000;

    if (this.score.isMatchOver()) {
      this.phase = GamePhase.MatchOver;
      if (this.onMatchEnd) {
        this.onMatchEnd(this.score.getMatchWinner()!, { ...this.stats });
      }
    }
  }

  private updatePointOver(dt: number): void {
    this.pauseTimer -= dt;
    if (this.pauseTimer <= 0) {
      this.setupServe();
      this.phase = GamePhase.Serving;
    }
  }

  private setupServe(): void {
    this.playerNear.resetPosition();
    this.playerFar.resetPosition();

    const servingSide = this.score.state.servingSide;
    const server = servingSide === PlayerSide.Near ? this.playerNear : this.playerFar;

    server.position.x = (Math.random() > 0.5 ? 1 : -1) * 2;
    this.ball.reset(servingSide);
    this.ball.state.position = {
      x: server.position.x,
      y: server.position.y,
      z: 1,
    };
  }

  private render(): void {
    this.playerNear.render();
    this.playerFar.render();
    this.ball.render();
    this.renderScore();

    // Depth sort: far player behind net, near player in front
    const ballDepth = this.ball.state.position.x + this.ball.state.position.y;
    const netDepth = 0;

    this.container.removeChildren();
    this.container.addChild(this.court.container);

    if (ballDepth < netDepth) {
      this.container.addChild(this.ball.container);
    }
    this.container.addChild(this.playerFar.container);
    if (ballDepth >= netDepth) {
      this.container.addChild(this.ball.container);
    }
    this.container.addChild(this.playerNear.container);
    this.container.addChild(this.scoreDisplay);
  }

  private renderScore(): void {
    this.scoreDisplay.removeChildren();

    const display = this.score.getDisplayScore();
    const set = this.score.state.currentSet;
    const games = this.score.state.games;

    const style = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 18,
      fill: RENDER.COLORS.UI_TEXT,
      fontWeight: 'bold',
    });

    const gamesStr0 = games[0].map((g) => g.toString()).join(' ');
    const gamesStr1 = games[1].map((g) => g.toString()).join(' ');

    const scoreText = new Text({
      text: `YOU  ${gamesStr0}  ${display.near}\nCPU  ${gamesStr1}  ${display.far}`,
      style,
    });

    scoreText.x = -this.centerX + 20;
    scoreText.y = -this.centerY + 20;

    const bg = new Graphics();
    bg.roundRect(scoreText.x - 10, scoreText.y - 8, scoreText.width + 20, scoreText.height + 16, 6);
    bg.fill({ color: RENDER.COLORS.UI_BG, alpha: 0.85 });

    this.scoreDisplay.addChild(bg);
    this.scoreDisplay.addChild(scoreText);

    if (this.phase === GamePhase.PointOver) {
      const phaseStyle = new TextStyle({
        fontFamily: 'monospace',
        fontSize: 28,
        fill: RENDER.COLORS.UI_ACCENT,
        fontWeight: 'bold',
      });
      const phaseText = new Text({ text: this.getPointMessage(), style: phaseStyle });
      phaseText.anchor.set(0.5);
      phaseText.x = 0;
      phaseText.y = -80;
      this.scoreDisplay.addChild(phaseText);
    }

    if (this.phase === GamePhase.Serving) {
      const servingStyle = new TextStyle({
        fontFamily: 'monospace',
        fontSize: 16,
        fill: 0xCCCCCC,
      });
      const isPlayer = this.score.state.servingSide === PlayerSide.Near;
      const serveText = new Text({
        text: isPlayer ? 'Click to serve' : 'Opponent serving...',
        style: servingStyle,
      });
      serveText.anchor.set(0.5);
      serveText.x = 0;
      serveText.y = 100;
      this.scoreDisplay.addChild(serveText);
    }
  }

  private getPointMessage(): string {
    if (this.score.state.isDeuce) return 'DEUCE';
    if (this.score.state.advantage) {
      return this.score.state.advantage === PlayerSide.Near ? 'ADVANTAGE YOU' : 'ADVANTAGE CPU';
    }
    return '';
  }
}
